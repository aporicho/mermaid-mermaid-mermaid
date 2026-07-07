const crypto = require("node:crypto");

const { previewImageExtension, readImageDimensions } = require("./image-size.cjs");
const { writePreviewAssetOrCache } = require("./image-assets.cjs");

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10000;
const LINK_PREVIEW_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

async function resolveLinkPreview(request) {
  if (request?.pluginId !== "xiaohongshu") {
    return { status: "unsupported", message: "Unsupported link preview plugin." };
  }
  return resolveXiaohongshuLinkPreview(String(request.url || ""), request.documentPath);
}

async function resolveXiaohongshuLinkPreview(rawUrl, documentPath) {
  const sourceUrl = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return linkPreviewFallback(sourceUrl, "", "小红书链接无效。");
  }

  if (!isAllowedXiaohongshuHost(parsed.hostname)) {
    return linkPreviewFallback(sourceUrl, "", "不是小红书链接。");
  }

  let response;
  try {
    response = await fetchWithTimeout(parsed.toString(), {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.5",
        "user-agent": LINK_PREVIEW_USER_AGENT
      },
      redirect: "follow"
    });
  } catch {
    return linkPreviewFallback(sourceUrl, "", "小红书页面暂时无法访问。");
  }

  const finalUrl = safeUrl(response.url || parsed.toString());
  if (!finalUrl || !isAllowedXiaohongshuHost(finalUrl.hostname)) {
    return linkPreviewFallback(sourceUrl, "", "小红书短链跳转目标不受支持。");
  }
  if (!response.ok) {
    return linkPreviewFallback(sourceUrl, finalUrl.toString(), "小红书页面暂时无法访问。");
  }
  if (numberHeader(response, "content-length") > MAX_HTML_BYTES) {
    return linkPreviewFallback(sourceUrl, finalUrl.toString(), "小红书页面过大，已生成链接卡片。");
  }

  let html = "";
  try {
    html = await response.text();
  } catch {
    return linkPreviewFallback(sourceUrl, finalUrl.toString(), "小红书页面读取失败。");
  }
  if (html.length > MAX_HTML_BYTES) {
    return linkPreviewFallback(sourceUrl, finalUrl.toString(), "小红书页面过大，已生成链接卡片。");
  }

  const title = firstNonEmpty([extractMeta(html, "og:title"), extractMeta(html, "twitter:title"), extractTitle(html)]) || "小红书笔记";
  const cover = await resolvePreviewCoverCandidates(extractXiaohongshuPreviewCoverUrls(html, finalUrl), documentPath);
  return {
    status: "ready",
    provider: "小红书",
    sourceUrl,
    canonicalUrl: chooseXiaohongshuCanonicalUrl(sourceUrl, finalUrl, extractMeta(html, "og:url")),
    title: cleanPreviewText(title),
    ...(cover ? { cover } : {})
  };
}

async function resolvePreviewCoverCandidates(coverUrls, documentPath) {
  for (const coverUrl of coverUrls) {
    const cover = await resolvePreviewCover(coverUrl, documentPath);
    if (cover) return cover;
  }
  return undefined;
}

async function resolvePreviewCover(coverUrl, documentPath) {
  let response;
  try {
    response = await fetchWithTimeout(coverUrl, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: "https://www.xiaohongshu.com/",
        "user-agent": LINK_PREVIEW_USER_AGENT
      }
    });
  } catch {
    return undefined;
  }

  if (!response.ok || numberHeader(response, "content-length") > MAX_IMAGE_BYTES) return undefined;
  const contentType = response.headers.get("content-type") || "";
  const extension = previewImageExtension(contentType, coverUrl);
  if (!extension) return undefined;

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) return undefined;
  const dimensions = readImageDimensions(contentType, bytes);
  if (!dimensions) return undefined;

  const fileName = `xiaohongshu-${shortTextHash(coverUrl)}.${extension}`;
  try {
    const asset = await writePreviewAssetOrCache(documentPath, fileName, bytes);
    return {
      src: asset.src,
      width: dimensions.width,
      height: dimensions.height,
      persistent: asset.persistent
    };
  } catch {
    return undefined;
  }
}

function extractXiaohongshuPreviewCoverUrls(html, baseUrl) {
  const candidates = [];
  appendResolvedXiaohongshuImages(candidates, baseUrl, extractMetaValues(html, "property", "og:image"));
  appendResolvedXiaohongshuImages(candidates, baseUrl, extractMetaValues(html, "property", "og:image:url"));
  appendResolvedXiaohongshuImages(candidates, baseUrl, extractMetaValues(html, "property", "twitter:image"));
  appendResolvedXiaohongshuImages(candidates, baseUrl, extractMetaValues(html, "name", "twitter:image"));
  appendUniqueStrings(candidates, extractXiaohongshuCoverUrls(html, baseUrl));
  appendResolvedXiaohongshuImages(candidates, baseUrl, extractMetaValues(html, "name", "og:image"));
  appendResolvedXiaohongshuImages(candidates, baseUrl, extractMetaValues(html, "name", "og:image:url"));
  appendResolvedXiaohongshuImages(candidates, baseUrl, extractMetaValues(html, "itemprop", "image"));
  return candidates;
}

function extractXiaohongshuCoverUrls(html, baseUrl) {
  const normalized = normalizeEmbeddedUrlText(html);
  const pattern = /(?:https?:)?\/\/[^\s"'<>),;}\\]+/gi;
  const candidates = [];
  let match;
  while ((match = pattern.exec(normalized))) {
    const url = resolveXiaohongshuImageUrl(baseUrl, match[0]);
    if (!url || candidates.some((candidate) => candidate.url === url)) continue;
    const context = lossyAsciiWindow(normalized, match.index, match.index + match[0].length, 260);
    const score = xiaohongshuImageScore(url, context);
    if (score >= 0) candidates.push({ url, score, index: match.index });
  }
  return candidates
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((candidate) => candidate.url);
}

function appendResolvedXiaohongshuImages(candidates, baseUrl, values) {
  appendUniqueStrings(candidates, values.map((value) => resolveXiaohongshuImageUrl(baseUrl, value)).filter(Boolean));
}

function appendUniqueStrings(candidates, values) {
  for (const value of values) {
    if (!candidates.includes(value)) candidates.push(value);
  }
}

function extractMeta(html, key) {
  return extractMetaValues(html, "property", key)[0] || extractMetaValues(html, "name", key)[0] || "";
}

function extractMetaValues(html, attributeName, key) {
  return (html.match(/<meta\b[^>]*>/gis) || [])
    .map((tag) => {
      const property = extractHtmlAttr(tag, attributeName);
      if (!property || property.toLowerCase() !== key.toLowerCase()) return "";
      return cleanPreviewText(extractHtmlAttr(tag, "content"));
    })
    .filter(Boolean);
}

function extractHtmlAttr(tag, name) {
  const match = tag.match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "is"));
  return decodeBasicHtmlEntities(match?.[2] || match?.[3] || match?.[4] || "");
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return cleanPreviewText(decodeBasicHtmlEntities(match?.[1] || ""));
}

function resolveXiaohongshuImageUrl(baseUrl, value) {
  try {
    const joined = new URL(String(value || "").trim(), baseUrl);
    const url = cleanEmbeddedUrlCandidate(joined.toString());
    return isLikelyXiaohongshuImageUrl(url) ? url : "";
  } catch {
    return "";
  }
}

function normalizeEmbeddedUrlText(value) {
  let normalized = decodeBasicHtmlEntities(String(value || ""));
  for (const [from, to] of [
    ["\\\\u002F", "/"],
    ["\\\\u002f", "/"],
    ["\\u002F", "/"],
    ["\\u002f", "/"],
    ["\\\\u0026", "&"],
    ["\\u0026", "&"],
    ["\\\\u003D", "="],
    ["\\\\u003d", "="],
    ["\\u003D", "="],
    ["\\u003d", "="],
    ["\\\\u003A", ":"],
    ["\\\\u003a", ":"],
    ["\\u003A", ":"],
    ["\\u003a", ":"],
    ["\\\\/", "/"],
    ["\\/", "/"]
  ]) {
    normalized = normalized.split(from).join(to);
  }
  return normalized;
}

function cleanEmbeddedUrlCandidate(value) {
  let cleaned = decodeBasicHtmlEntities(String(value || "")).trim();
  const boundary = cleaned.search(/[)\]};]/);
  if (boundary >= 0) cleaned = cleaned.slice(0, boundary);
  cleaned = cleaned.replace(/[,.)\]};\\]+$/g, "");
  return upgradeXiaohongshuImageUrlScheme(cleaned) || cleaned;
}

function isLikelyXiaohongshuImageUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed || !["http:", "https:"].includes(parsed.protocol) || !parsed.pathname || parsed.pathname === "/") return false;
  if (!isXiaohongshuImageHost(parsed.hostname)) return false;
  const lower = parsed.toString().toLowerCase();
  return !["avatar", "profile", "favicon", "icon", "logo", "emoji", "sprite", ".svg", ".ico"].some((marker) => lower.includes(marker));
}

function xiaohongshuImageScore(url, context) {
  const lower = url.toLowerCase();
  let score = 20;
  for (const marker of ["sns-img", "sns-webpic", "ci.xiaohongshu.com"]) if (lower.includes(marker)) score += 24;
  for (const marker of ["notes_pre_post", "/note/", "imageview2", "format=", "width=", "height="]) if (lower.includes(marker)) score += 8;
  if (lower.includes("nd_dft")) score += 24;
  if (lower.includes("nd_prv")) score -= 12;
  for (const marker of [
    "imagelist",
    "url_default",
    "urldefault",
    "urlpre",
    "cover",
    "coverurl",
    "cover_url",
    "firstframe",
    "first_frame",
    "poster",
    "thumbnail",
    "note_card",
    "notecard",
    "image_info",
    "background-image",
    "player",
    "browser-player",
    "media",
    "mediav2",
    "video"
  ]) {
    if (context.includes(marker)) score += 12;
  }
  for (const marker of ["avatar", "profile", "user_avatar", "author", "favicon", "logo", "icon"]) if (context.includes(marker)) score -= 18;
  return score + Math.min(Math.floor(lower.length / 80), 8);
}

function chooseXiaohongshuCanonicalUrl(sourceUrl, finalUrl, metaUrl) {
  const source = safeUrl(sourceUrl);
  if (source?.searchParams.has("xsec_token") || finalUrl.searchParams.has("xsec_token")) return finalUrl.toString();
  if (!metaUrl) return finalUrl.toString();
  try {
    return new URL(metaUrl, finalUrl).toString();
  } catch {
    return finalUrl.toString();
  }
}

function linkPreviewFallback(sourceUrl, canonicalUrl, message) {
  return {
    status: "fallback",
    provider: "小红书",
    sourceUrl,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    title: "小红书笔记",
    message
  };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAllowedXiaohongshuHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "xhslink.com" || host.endsWith(".xhslink.com") || host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com");
}

function isXiaohongshuImageHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (host.endsWith(".xhscdn.com") && (host.startsWith("sns-img") || host.startsWith("sns-webpic"))) || host === "ci.xiaohongshu.com" || host.endsWith(".ci.xiaohongshu.com");
}

function upgradeXiaohongshuImageUrlScheme(url) {
  const parsed = safeUrl(url);
  if (!parsed || parsed.protocol !== "http:" || !isXiaohongshuImageHost(parsed.hostname)) return "";
  parsed.protocol = "https:";
  return parsed.toString();
}

function numberHeader(response, name) {
  const value = Number(response.headers.get(name));
  return Number.isFinite(value) ? value : 0;
}

function lossyAsciiWindow(value, start, end, radius) {
  return value.slice(Math.max(0, start - radius), Math.min(value.length, end + radius)).toLowerCase();
}

function cleanPreviewText(value) {
  return String(value || "").split(/\s+/).filter(Boolean).join(" ");
}

function decodeBasicHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function firstNonEmpty(values) {
  return values.find((value) => String(value || "").trim());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shortTextHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
}

module.exports = {
  extractXiaohongshuPreviewCoverUrls,
  previewImageExtension,
  resolveLinkPreview,
  resolveXiaohongshuLinkPreview
};
