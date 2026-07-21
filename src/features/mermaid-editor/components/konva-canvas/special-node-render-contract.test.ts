import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("special node render token contract", () => {
  it("uses all common tokens across normal and interactive special-node surfaces", () => {
    const combined = [
      source("src/features/mermaid-editor/components/konva-canvas/node-layer.tsx"),
      source("src/features/mermaid-editor/components/konva-canvas/node-link-card.tsx"),
      source("src/features/mermaid-editor/components/konva-canvas/markdown-document-card.tsx"),
      source("src/features/mermaid-editor/components/konva-canvas/node-image-surface.tsx")
    ].join("\n");
    for (const token of ["background", "textColor", "mutedTextColor", "accentColor", "borderColor", "borderWidth", "radius", "shadowColor", "shadowBlur", "shadowOpacity", "shadowOffsetY"]) {
      expect(combined, token).toContain(token);
    }
  });

  it("consumes every link-card subtype token and common surface tokens", () => {
    const link = source("src/features/mermaid-editor/components/konva-canvas/node-link-card.tsx");
    const geometry = source("src/features/mermaid-editor/lib/node-preview.ts");
    for (const token of [
      "common.background", "common.textColor", "common.radius", "common.shadowColor", "common.shadowBlur", "common.shadowOpacity", "common.shadowOffsetY",
      "linkCard.inset", "linkCard.coverBackground", "linkCard.coverBorderColor", "linkCard.coverBorderWidth", "linkCard.coverRadius",
      "linkCard.contentPaddingX", "linkCard.providerColor", "linkCard.brandColor", "linkCard.titleHeight"
    ]) expect(link, token).toContain(token);
    for (const token of ["tokens.width", "tokens.coverFallbackHeight", "tokens.coverMinHeight", "tokens.coverMaxHeight", "tokens.providerGap", "tokens.titleGap"]) {
      expect(geometry, token).toContain(token);
    }
  });

  it("consumes every Markdown subtype appearance token", () => {
    const markdown = source("src/features/mermaid-editor/components/konva-canvas/markdown-document-card.tsx");
    for (const token of [
      "tokens.contentPadding", "tokens.badgeSize", "tokens.badgeBackground", "tokens.badgeErrorBackground", "tokens.badgeColor", "tokens.badgeErrorColor",
      "tokens.badgeOpacity", "tokens.badgeErrorOpacity", "tokens.badgeRadius", "tokens.titleGap", "tokens.pathGap", "tokens.separatorColor",
      "tokens.separatorWidth", "tokens.separatorOpacity", "tokens.excerptGap", "tokens.pathOpacity", "tokens.excerptOpacity", "tokens.placeholderOpacity"
    ]) expect(markdown, token).toContain(token);
  });

  it("uses image surface, clipping and interaction-frame tokens", () => {
    const layer = source("src/features/mermaid-editor/components/konva-canvas/node-image-surface.tsx");
    for (const token of [
      "image.background", "image.borderColor", "image.borderWidth", "image.radius", "image.interactionBorderColor", "image.interactionBorderWidth",
      "common.shadowColor", "common.shadowBlur", "common.shadowOpacity", "common.shadowOffsetY"
    ]) expect(layer, token).toContain(token);
    expect(layer).toContain("roundedRectClip");
  });

  it("rebuilds themed geometry when any special-node group changes", () => {
    const model = source("src/features/mermaid-editor/components/mermaid-editor/use-canvas-node-geometry-model.ts");
    expect(model).toContain("input.compiledTheme.specialNode, input.compiledTheme.typography.tableNode.cell");
  });
});
