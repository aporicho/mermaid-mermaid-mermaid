import type { CanvasContentPlugin, PluginCardDraft, PluginPasteMatch } from "@/features/mermaid-editor/lib/content-plugins/types";
import type { CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import type { RuntimeLinkPreviewResult } from "@/features/mermaid-editor/lib/editor-runtime";
import { normalizeCanvasNodePreview, previewSuggestedLabel } from "@/features/mermaid-editor/lib/node-preview";

const XIAOHONGSHU_PLUGIN_ID = "xiaohongshu";
const XIAOHONGSHU_PROVIDER = "小红书";

export const xiaohongshuPlugin: CanvasContentPlugin = {
  id: XIAOHONGSHU_PLUGIN_ID,
  label: XIAOHONGSHU_PROVIDER,
  urlPatterns: ["xhslink.com", "xiaohongshu.com"],
  matchText(text) {
    return extractUrls(text)
      .filter(isXiaohongshuUrl)
      .map((url) => ({ pluginId: XIAOHONGSHU_PLUGIN_ID, url }));
  },
  async resolve(match, context) {
    const result = await context.runtime
      .resolveLinkPreview({
        pluginId: XIAOHONGSHU_PLUGIN_ID,
        url: match.url,
        documentPath: context.fileRef?.path
      })
      .catch(() => ({ status: "unsupported" as const, message: "小红书封面抓取失败。" }));

    if (result.status === "ready" || result.status === "fallback") {
      return draftFromRuntimeResult(match, result);
    }

    return fallbackDraft(match, result.message);
  }
};

function draftFromRuntimeResult(match: PluginPasteMatch, result: Exclude<RuntimeLinkPreviewResult, { status: "unsupported" }>): PluginCardDraft {
  const preview = normalizeCanvasNodePreview({
    kind: "link-card",
    pluginId: XIAOHONGSHU_PLUGIN_ID,
    provider: result.provider || XIAOHONGSHU_PROVIDER,
    sourceUrl: result.sourceUrl || match.url,
    ...(result.canonicalUrl ? { canonicalUrl: result.canonicalUrl } : {}),
    title: result.title || "小红书笔记",
    ...(result.cover ? { cover: result.cover } : {}),
    status: result.status
  }) as CanvasNodePreview;

  return {
    label: previewSuggestedLabel(preview),
    preview,
    action: {
      kind: "url",
      url: preview.sourceUrl || preview.canonicalUrl || match.url,
      openMode: "app-browser",
      tooltip: "打开小红书笔记"
    }
  };
}

function fallbackDraft(match: PluginPasteMatch, _message?: string): PluginCardDraft {
  const preview = normalizeCanvasNodePreview({
    kind: "link-card",
    pluginId: XIAOHONGSHU_PLUGIN_ID,
    provider: XIAOHONGSHU_PROVIDER,
    sourceUrl: match.url,
    title: "小红书笔记",
    status: "fallback"
  }) as CanvasNodePreview;

  return {
    label: previewSuggestedLabel(preview),
    preview,
    action: {
      kind: "url",
      url: match.url,
      openMode: "app-browser",
      tooltip: "打开小红书笔记"
    }
  };
}

function extractUrls(text: string) {
  return (text.match(/https?:\/\/[^\s<>"']+/gi) || []).map((url) => url.replace(/[)\]）】,，。.!！?？]+$/g, ""));
}

function isXiaohongshuUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "xhslink.com" || host.endsWith(".xhslink.com") || host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com");
  } catch {
    return false;
  }
}
