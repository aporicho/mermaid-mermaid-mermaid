import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("special node render token contract", () => {
  it("renders every special-node type from its own complete surface", () => {
    const files = [
      "node-link-card.tsx",
      "markdown-document-card.tsx",
      "node-image-surface.tsx",
      "table-node.tsx"
    ].map((file) => source(`src/features/mermaid-editor/components/konva-canvas/${file}`));

    for (const component of files) {
      for (const token of [
        "surface.background",
        "surface.radius",
        "surface.shadow.color",
        "surface.shadow.blur",
        "surface.shadow.opacity",
        "surface.shadow.offsetX",
        "surface.shadow.offsetY",
        "specialNodeBorderDash"
      ]) expect(component, token).toContain(token);
    }
  });

  it("consumes every link-card subtype token", () => {
    const link = source("src/features/mermaid-editor/components/konva-canvas/node-link-card.tsx");
    const geometry = source("src/features/mermaid-editor/lib/node-preview.ts");
    for (const token of [
      "linkCard.state", "linkCard.inset", "linkCard.coverBackground", "linkCard.coverBorder", "linkCard.coverRadius",
      "linkCard.contentPaddingX", "linkCard.providerColor", "linkCard.brandColor", "linkCard.titleHeight", "shared.textColor"
    ]) expect(link, token).toContain(token);
    for (const token of ["tokens.width", "tokens.coverFallbackHeight", "tokens.coverMinHeight", "tokens.coverMaxHeight", "tokens.providerGap", "tokens.titleGap"]) {
      expect(geometry, token).toContain(token);
    }
  });

  it("consumes every Markdown subtype appearance token", () => {
    const markdown = source("src/features/mermaid-editor/components/konva-canvas/markdown-document-card.tsx");
    for (const token of [
      "tokens.state", "tokens.contentPadding", "tokens.badgeSize", "tokens.badgeBackground", "tokens.badgeErrorBackground", "tokens.badgeColor", "tokens.badgeErrorColor",
      "tokens.badgeOpacity", "tokens.badgeErrorOpacity", "tokens.badgeRadius", "tokens.titleGap", "tokens.pathGap", "tokens.separatorColor",
      "tokens.separatorWidth", "tokens.separatorOpacity", "tokens.excerptGap", "tokens.pathOpacity", "tokens.excerptOpacity", "tokens.placeholderOpacity",
      "shared.textColor", "shared.mutedTextColor"
    ]) expect(markdown, token).toContain(token);
  });

  it("uses independent image surface and interaction-state tokens", () => {
    const image = source("src/features/mermaid-editor/components/konva-canvas/node-image-surface.tsx");
    for (const token of ["image.surface", "image.state", "resolveSpecialNodeBorder", "roundedRectClip"]) {
      expect(image, token).toContain(token);
    }
    expect(image).not.toContain("specialNode.common");
  });

  it("uses table header, body, hover, selection, grid and whole-surface states", () => {
    const table = source("src/features/mermaid-editor/components/konva-canvas/table-node.tsx");
    for (const token of [
      "tokens.surface", "tokens.state", "tokens.headerBackground", "tokens.headerTextColor", "tokens.bodyTextColor",
      "tokens.hoverCellBackground", "tokens.selectedCellBackground", "tokens.selectedCellBorder", "tokens.grid", "tokens.placeholderGap"
    ]) expect(table, token).toContain(token);
  });

  it("rebuilds themed geometry when any special-node group changes", () => {
    const model = source("src/features/mermaid-editor/components/mermaid-editor/use-canvas-node-geometry-model.ts");
    expect(model).toContain("input.compiledTheme.specialNode, input.compiledTheme.typography.tableNode.cell");
  });
});
