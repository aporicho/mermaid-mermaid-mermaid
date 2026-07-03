import type { CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";

export const LINK_CARD_NODE_WIDTH = 220;
export const LINK_CARD_NODE_HEIGHT = 292;
export const LINK_CARD_COVER_HEIGHT = 188;

export function normalizeCanvasNodePreview(preview: CanvasNodePreview | null | undefined): CanvasNodePreview | undefined {
  if (!preview || preview.kind !== "link-card") return undefined;

  const pluginId = preview.pluginId.trim();
  const provider = preview.provider.trim();
  const sourceUrl = preview.sourceUrl.trim();
  const title = normalizePreviewTitle(preview.title);
  if (!pluginId || !provider || !sourceUrl || !title) return undefined;

  const canonicalUrl = preview.canonicalUrl?.trim();
  const coverSrc = preview.cover?.src.trim();

  return {
    kind: "link-card",
    pluginId,
    provider,
    sourceUrl,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    title,
    ...(coverSrc
      ? {
          cover: {
            src: coverSrc,
            ...(typeof preview.cover?.width === "number" ? { width: preview.cover.width } : {}),
            ...(typeof preview.cover?.height === "number" ? { height: preview.cover.height } : {}),
            persistent: preview.cover?.persistent === true
          }
        }
      : {}),
    status: preview.status === "ready" ? "ready" : "fallback"
  };
}

export function previewSuggestedLabel(preview: CanvasNodePreview | undefined) {
  const normalized = normalizeCanvasNodePreview(preview);
  return normalized?.title || "链接卡片";
}

function normalizePreviewTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}
