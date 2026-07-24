// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

vi.mock("react-konva", () => ({ Group: () => null, Rect: () => null, Text: () => null }));

import { layoutMarkdownDocumentContent } from "@/features/mermaid-editor/components/konva-canvas/markdown-document-content";
import { DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";

describe("native Markdown document content layout", () => {
  it("uses the opened document heading, body, strong, and list theme tokens", () => {
    const theme = DEFAULT_EDITOR_THEME.markdown;
    const preview = DEFAULT_EDITOR_THEME.specialNode.markdownDocument;
    const items = layoutMarkdownDocumentContent({
      source: "# Title\n\nBody **strong**.\n\n- item\n1. ordered\n\n> quoted",
      fallbackTitle: "Document",
      width: 720,
      height: 1200,
      theme,
      typography: preview.previewTypography,
      spacing: preview.previewSpacing,
      measure: (text, style) => Array.from(text).length * style.fontSize * 0.5
    });
    const textItems = items.filter((item) => item.kind === "text");

    expect(textItems[0]).toMatchObject({
      text: "Title",
      fontFamily: theme.heading.h1.fontFamily,
      fontSize: preview.previewTypography.titleFontSize,
      fontWeight: theme.heading.h1.fontWeight
    });
    expect(textItems.find((item) => item.text.includes("Body"))).toMatchObject({
      fontFamily: theme.body.fontFamily,
      fontSize: preview.previewTypography.contentFontSize
    });
    expect(textItems.find((item) => item.text === "strong")).toMatchObject({
      fontFamily: theme.strong.fontFamily,
      fontWeight: theme.strong.fontWeight,
      color: theme.strong.color
    });
    expect(textItems.filter((item) => item.text === "•" || item.text === "1.")).toHaveLength(2);
    expect(items.find((item) => item.kind === "rect")).toMatchObject({
      fill: theme.blockquote.background,
      cornerRadius: theme.blockquote.radius
    });
    expect(textItems.find((item) => item.text === "quoted")).toMatchObject({
      color: theme.blockquote.color,
      fontSize: preview.previewTypography.contentFontSize
    });
  });

  it("uses semantic preview gaps instead of full-document margins", () => {
    const theme = DEFAULT_EDITOR_THEME.markdown;
    const preview = DEFAULT_EDITOR_THEME.specialNode.markdownDocument;
    const items = layoutMarkdownDocumentContent({
      source: "# Title\n\nIntro\n\n## Section\n\nBody\n\n- one\n- two",
      fallbackTitle: "Document",
      width: 720,
      height: 1200,
      theme,
      typography: preview.previewTypography,
      spacing: preview.previewSpacing,
      measure: (text, style) => Array.from(text).length * style.fontSize * 0.5
    }).filter((item) => item.kind === "text");

    const title = items.find((item) => item.text === "Title");
    const intro = items.find((item) => item.text === "Intro");
    const section = items.find((item) => item.text === "Section");
    const body = items.find((item) => item.text === "Body");
    expect(intro?.y).toBe((title?.y || 0) + (title?.lineHeight || 0) + preview.previewSpacing.titleBottomGap);
    expect(section?.y).toBe((intro?.y || 0) + (intro?.lineHeight || 0) + preview.previewSpacing.sectionTopGap);
    expect(body?.y).toBe((section?.y || 0) + (section?.lineHeight || 0) + preview.previewSpacing.headingBottomGap);
  });
});
