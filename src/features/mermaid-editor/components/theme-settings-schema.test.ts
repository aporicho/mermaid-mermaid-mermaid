import { describe, expect, it } from "vitest";

import { APPEARANCE_TOKEN_DEFINITIONS } from "@/features/mermaid-editor/components/theme-settings-schema";
import {
  createDefaultMarkdownTokens,
  DEFAULT_EDITOR_THEME,
  MARKDOWN_ELEMENT_DEFINITIONS,
  MARKDOWN_TOKEN_DEFINITIONS
} from "@/features/mermaid-editor/lib/editor-theme";

describe("theme settings schema", () => {
  it("exposes every editable visual and interaction token", () => {
    const paths = APPEARANCE_TOKEN_DEFINITIONS.map((definition) => definition.path.join("."));
    const expected = flattenLeafPaths(DEFAULT_EDITOR_THEME).filter((path) => path !== "baseThemeId");

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.sort()).toEqual(expected.sort());
    expect(APPEARANCE_TOKEN_DEFINITIONS.every((definition) => definition.label && definition.groupId && definition.consumer && definition.control.kind)).toBe(true);
    expect(APPEARANCE_TOKEN_DEFINITIONS.filter((definition) => !/[\u3400-\u9fff]/u.test(definition.label)).map((definition) => definition.path.join("."))).toEqual([]);
    expect(APPEARANCE_TOKEN_DEFINITIONS.some((definition) => definition.path.join(".") === "typography.interface.body.family" && definition.category === "interface")).toBe(true);
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "typography.interface.tree.family")).toMatchObject({ groupId: "typography-interface-tree", control: { kind: "font" } });
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "interface.tree.connectorStyle")).toMatchObject({ groupId: "interface-tree-connector", control: { kind: "tree-connector-style" } });
    expect(APPEARANCE_TOKEN_DEFINITIONS.some((definition) => definition.path.join(".") === "typography.linkCard.title.family" && definition.category === "specialNode")).toBe(true);
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "specialNode.markdownDocument.previewTypography.titleFontSize")).toMatchObject({
      category: "markdownNode",
      groupId: "special-node-markdown-preview-typography",
      control: { kind: "number", min: 8, max: 96, step: 1, unit: "px" }
    });
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "specialNode.markdownDocument.previewTypography.contentFontSize")).toMatchObject({
      label: "文档内容字号",
      groupId: "special-node-markdown-preview-typography",
      control: { kind: "number", min: 8, max: 48, step: 1, unit: "px" }
    });
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "specialNode.markdownDocument.previewSpacing.sectionTopGap")).toMatchObject({
      groupId: "special-node-markdown-preview-spacing",
      control: { kind: "number", min: 0, max: 64, step: 1, unit: "px" }
    });
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "specialNode.markdownDocument.previewSpacing.indentationEnabled")).toMatchObject({
      label: "启用内容缩进",
      category: "markdownNode",
      groupId: "special-node-markdown-preview-spacing",
      control: { kind: "boolean" }
    });
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "specialNode.markdownDocument.contentPaddingLeft")).toMatchObject({
      label: "左侧内容边距",
      category: "markdownNode",
      groupId: "special-node-markdown-document",
      control: { kind: "number", min: 0, max: 160, step: 1, unit: "px" }
    });
    expect(APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === "canvas.group.title.backgroundEnabled")).toMatchObject({
      label: "显示标题底色",
      category: "canvas",
      groupId: "canvas-group",
      control: { kind: "boolean" }
    });
  });

  it("defines every canonical Markdown token exactly once under its element", () => {
    const paths = MARKDOWN_TOKEN_DEFINITIONS.map((definition) => definition.path.join("."));
    const textFields = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color"];

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.sort()).toEqual(flattenLeafPaths(DEFAULT_EDITOR_THEME.markdown).sort());
    for (const element of MARKDOWN_ELEMENT_DEFINITIONS) {
      const elementPath = element.path.join(".");
      if (element.id === "layout" || element.id === "divider" || element.id === "image") continue;
      for (const field of textFields) expect(paths).toContain(`${elementPath}.${field}`);
    }
    expect(MARKDOWN_TOKEN_DEFINITIONS.every((definition) => definition.defaultSource.length > 0)).toBe(true);
    expect(flattenLeafPaths(createDefaultMarkdownTokens(DEFAULT_EDITOR_THEME)).sort()).toEqual(paths.sort());
    expect(paths).toContain("blockquote.borderStyle");
    expect(paths).toContain("table.borderStyle");
    expect(paths).toContain("image.borderStyle");
    expect(paths).toContain("list.task.checkboxBorderStyle");
    expect(paths).toContain("layout.headingStackSpacing");
    expect(paths).toContain("layout.listMarkerWidth");
    expect(paths).toContain("layout.listMarkerGap");
    expect(paths).toContain("list.unordered.marginTop");
    expect(paths).toContain("list.unordered.marginBottom");
    expect(paths).not.toContain("list.unordered.nestedSpacing");
    expect(paths).toContain("blockquote.marginTop");
    expect(paths).toContain("blockquote.marginBottom");
    expect(paths).not.toContain("list.unordered.blockSpacing");
    expect(paths).not.toContain("blockquote.marginY");
  });

  it("does not expose legacy Markdown typography containers", () => {
    const theme = DEFAULT_EDITOR_THEME as unknown as {
      markdown: Record<string, unknown>;
      typography: Record<string, unknown>;
    };

    expect(DEFAULT_EDITOR_THEME.version).toBe(15);
    expect(theme.markdown).not.toHaveProperty("typography");
    expect(theme.markdown).not.toHaveProperty("font");
    expect(theme.markdown).not.toHaveProperty("quote");
    expect(theme.typography).not.toHaveProperty("markdown");
  });
});

function flattenLeafPaths(value: unknown, prefix: readonly string[] = []): string[] {
  if (Array.isArray(value) || !value || typeof value !== "object") return [prefix.join(".")];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => flattenLeafPaths(entry, [...prefix, key]));
}
