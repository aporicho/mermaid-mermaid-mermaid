import type { CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";

import { escapeMermaidStringLiteral } from "./syntax";

export function readLinkCardPreview(fields: Map<string, string>): CanvasNodePreview | undefined {
  if (fields.get("preview") !== "link-card") return undefined;

  const pluginId = fields.get("plugin") || "";
  const provider = fields.get("provider") || "";
  const sourceUrl = fields.get("url") || "";
  const canonicalUrl = fields.get("canonical") || "";
  const title = fields.get("title") || fields.get("label") || "";
  const coverSrc = fields.get("cover") || "";
  const preview = normalizeCanvasNodePreview({
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
            ...(numberField(fields, "coverW") ? { width: numberField(fields, "coverW") } : {}),
            ...(numberField(fields, "coverH") ? { height: numberField(fields, "coverH") } : {}),
            persistent: fields.get("coverPersistent") === "on"
          }
        }
      : {}),
    status: fields.get("status") === "ready" ? "ready" : "fallback"
  });

  return preview;
}

export function serializeLinkCardPreviewFields(preview: CanvasNodePreview | undefined) {
  const normalized = normalizeCanvasNodePreview(preview);
  if (!normalized) return "";

  const fields = [
    'preview: "link-card"',
    `plugin: "${escapeMermaidStringLiteral(normalized.pluginId)}"`,
    `provider: "${escapeMermaidStringLiteral(normalized.provider)}"`,
    `url: "${escapeMermaidStringLiteral(normalized.sourceUrl)}"`,
    `title: "${escapeMermaidStringLiteral(normalized.title)}"`,
    `status: "${normalized.status}"`
  ];

  if (normalized.canonicalUrl) fields.push(`canonical: "${escapeMermaidStringLiteral(normalized.canonicalUrl)}"`);
  if (normalized.cover?.src) {
    fields.push(`cover: "${escapeMermaidStringLiteral(normalized.cover.src)}"`);
    fields.push(`coverPersistent: "${normalized.cover.persistent ? "on" : "off"}"`);
    if (normalized.cover.width) fields.push(`coverW: ${Math.round(normalized.cover.width)}`);
    if (normalized.cover.height) fields.push(`coverH: ${Math.round(normalized.cover.height)}`);
  }

  return fields.join(", ");
}

function numberField(fields: Map<string, string>, key: string) {
  const value = Number(fields.get(key));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
