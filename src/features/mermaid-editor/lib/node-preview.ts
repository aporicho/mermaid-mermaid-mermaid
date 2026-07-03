import type { CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";

export const LINK_CARD_NODE_WIDTH = 220;
export const LINK_CARD_NODE_HEIGHT = 292;
export const LINK_CARD_COVER_HEIGHT = 188;
export const LINK_CARD_INSET = 8;
export const LINK_CARD_COVER_WIDTH = LINK_CARD_NODE_WIDTH - LINK_CARD_INSET * 2;
export const LINK_CARD_MIN_COVER_HEIGHT = 128;
export const LINK_CARD_MAX_COVER_HEIGHT = 380;
export const LINK_CARD_VERTICAL_CHROME_HEIGHT = LINK_CARD_NODE_HEIGHT - LINK_CARD_COVER_HEIGHT;

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

export function linkCardCoverHeight(preview: CanvasNodePreview | undefined) {
  const width = preview?.cover?.width;
  const height = preview?.cover?.height;
  if (!isPositiveFiniteNumber(width) || !isPositiveFiniteNumber(height)) {
    return LINK_CARD_COVER_HEIGHT;
  }

  return clamp(Math.round((LINK_CARD_COVER_WIDTH * height) / width), LINK_CARD_MIN_COVER_HEIGHT, LINK_CARD_MAX_COVER_HEIGHT);
}

export function linkCardNodeHeight(preview: CanvasNodePreview | undefined) {
  return linkCardCoverHeight(preview) + LINK_CARD_VERTICAL_CHROME_HEIGHT;
}

function normalizePreviewTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
