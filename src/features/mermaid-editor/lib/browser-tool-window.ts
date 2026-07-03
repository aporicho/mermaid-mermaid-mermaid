export const BROWSER_TOOL_WINDOW_KIND = "browser-tool";
export const BROWSER_TOOL_WINDOW_PARAM = "mmmWindow";

export type BrowserToolWindowRequest = {
  url: string;
  title?: string;
  sourceNodeId?: string;
  sourceLabel?: string;
};

export function normalizeBrowserUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isHttpUrl(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return "";
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function browserToolWindowTitle(url: string, fallback?: string) {
  const normalizedFallback = fallback?.trim();
  if (normalizedFallback) return normalizedFallback;

  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

export function browserToolWindowLabel(url: string) {
  return `browser-tool-${hashText(url)}`;
}

export function browserToolShellUrl(request: BrowserToolWindowRequest, baseHref: string) {
  const url = new URL(baseHref);
  url.search = "";
  url.hash = "";
  url.searchParams.set(BROWSER_TOOL_WINDOW_PARAM, BROWSER_TOOL_WINDOW_KIND);
  url.searchParams.set("url", request.url);
  if (request.title) url.searchParams.set("title", request.title);
  if (request.sourceNodeId) url.searchParams.set("sourceNodeId", request.sourceNodeId);
  if (request.sourceLabel) url.searchParams.set("sourceLabel", request.sourceLabel);
  return url.toString();
}

export function parseBrowserToolWindowRequest(location: Pick<Location, "search">): BrowserToolWindowRequest | null {
  const params = new URLSearchParams(location.search);
  if (params.get(BROWSER_TOOL_WINDOW_PARAM) !== BROWSER_TOOL_WINDOW_KIND) return null;

  const url = normalizeBrowserUrl(params.get("url") || "");
  if (!url) return null;

  return {
    url,
    title: params.get("title") || undefined,
    sourceNodeId: params.get("sourceNodeId") || undefined,
    sourceLabel: params.get("sourceLabel") || undefined
  };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
