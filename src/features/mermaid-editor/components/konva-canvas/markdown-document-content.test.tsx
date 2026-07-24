// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

vi.mock("react-konva", () => ({ Group: () => null, Line: () => null, Rect: () => null, Text: () => null }));

import { layoutMarkdownDocumentContent } from "@/features/mermaid-editor/components/konva-canvas/markdown-document-content";
import { DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";

describe("native Markdown document content layout", () => {
  it("uses the opened document heading, body, strong, and list theme tokens", () => {
    const preview = DEFAULT_EDITOR_THEME.specialNode.markdownDocument;
    const content = preview.previewContent;
    const items = layoutMarkdownDocumentContent({
      source: "# Title\n\nBody **strong**.\n\n- item\n1. ordered\n\n> quoted\n\n---",
      fallbackTitle: "Document",
      width: 720,
      height: 1200,
      content,
      measure: (text, style) => Array.from(text).length * style.fontSize * 0.5
    });
    const textItems = items.filter((item) => item.kind === "text");

    expect(textItems[0]).toMatchObject({
      text: "Title",
      fontFamily: content.title.fontFamily,
      fontSize: content.title.fontSize,
      fontWeight: content.title.fontWeight
    });
    expect(textItems.find((item) => item.text.includes("Body"))).toMatchObject({
      fontFamily: content.paragraph.fontFamily,
      fontSize: content.paragraph.fontSize
    });
    expect(textItems.find((item) => item.text === "strong")).toMatchObject({
      fontFamily: content.strong.fontFamily,
      fontWeight: content.strong.fontWeight,
      color: content.strong.color
    });
    expect(textItems.filter((item) => item.text === "•" || item.text === "1.")).toHaveLength(2);
    expect(items.find((item) => item.kind === "rect")).toMatchObject({
      fill: content.blockquote.background,
      cornerRadius: content.blockquote.radius
    });
    expect(items.find((item) => item.kind === "rect" && item.fill === content.divider.color)).toMatchObject({
      width: 720,
      height: content.divider.thickness,
      cornerRadius: 0
    });
    expect(textItems.find((item) => item.text === "quoted")).toMatchObject({
      color: content.blockquote.color,
      fontSize: content.blockquote.fontSize
    });
  });

  it("uses semantic preview gaps instead of full-document margins", () => {
    const preview = DEFAULT_EDITOR_THEME.specialNode.markdownDocument;
    const content = preview.previewContent;
    const items = layoutMarkdownDocumentContent({
      source: "# Title\n\nIntro\n\n## Section\n\nBody\n\n- one\n- two",
      fallbackTitle: "Document",
      width: 720,
      height: 1200,
      content,
      measure: (text, style) => Array.from(text).length * style.fontSize * 0.5
    }).filter((item) => item.kind === "text");

    const title = items.find((item) => item.text === "Title");
    const intro = items.find((item) => item.text === "Intro");
    const section = items.find((item) => item.text === "Section");
    const body = items.find((item) => item.text === "Body");
    expect(intro?.y).toBe((title?.y || 0) + (title?.lineHeight || 0) + content.layout.titleBottomGap);
    expect(section?.y).toBe((intro?.y || 0) + (intro?.lineHeight || 0) + content.layout.sectionTopGap);
    expect(body?.y).toBe((section?.y || 0) + (section?.lineHeight || 0) + content.layout.headingBottomGap);
  });

  it("bolds only top-level ordered items and can disable all content indentation", () => {
    const preview = DEFAULT_EDITOR_THEME.specialNode.markdownDocument;
    const content = preview.previewContent;
    const source = "1. top ordered\n  1. nested ordered\n- top bullet\n  - nested bullet\n\n> quote";
    const measure = (text: string, style: { fontSize: number }) => Array.from(text).length * style.fontSize * 0.5;
    const layout = (indentationEnabled: boolean) => layoutMarkdownDocumentContent({
      source,
      fallbackTitle: "",
      width: 720,
      height: 1200,
      content: { ...content, layout: { ...content.layout, indentationEnabled } },
      measure
    }).filter((item) => item.kind === "text");

    const indented = layout(true);
    const flat = layout(false);
    const indentedOrderedMarkers = indented.filter((item) => item.text === "1.");
    const flatOrderedMarkers = flat.filter((item) => item.text === "1.");
    const orderedMarkerWidth = content.list.ordered.fontSize;
    const bulletMarkerWidth = content.list.unordered.fontSize * 0.5;

    expect(indentedOrderedMarkers[0]).toMatchObject({ x: 0, fontWeight: content.strong.fontWeight });
    expect(indented.find((item) => item.text === "top ordered")).toMatchObject({ fontWeight: content.strong.fontWeight });
    expect(indentedOrderedMarkers[1]).toMatchObject({ x: content.list.ordered.indent, fontWeight: content.list.ordered.fontWeight });
    expect(indented.find((item) => item.text === "nested ordered")).toMatchObject({ fontWeight: content.list.ordered.fontWeight });
    expect(indented.find((item) => item.text === "nested bullet")?.x).toBeGreaterThan(content.layout.listMarkerWidth);
    expect(indented.find((item) => item.text === "quote")?.x).toBe(content.blockquote.paddingX);

    expect(flatOrderedMarkers[0]?.x).toBe(0);
    expect(flatOrderedMarkers[1]?.x).toBe(0);
    for (const marker of flatOrderedMarkers) {
      expect(marker).toMatchObject({ width: orderedMarkerWidth, align: "left" });
    }
    for (const marker of flat.filter((item) => item.text === "•")) {
      expect(marker).toMatchObject({ x: 0, width: bulletMarkerWidth, align: "left" });
    }
    expect(flat.find((item) => item.text === "nested ordered")?.x).toBe(orderedMarkerWidth + content.layout.listMarkerGap);
    expect(flat.find((item) => item.text === "nested bullet")?.x).toBe(bulletMarkerWidth + content.layout.listMarkerGap);
    expect(flat.find((item) => item.text === "quote")?.x).toBe(0);
  });

  it("returns wrapped list content to the left edge only when indentation is disabled", () => {
    const preview = DEFAULT_EDITOR_THEME.specialNode.markdownDocument;
    const layout = (indentationEnabled: boolean) => layoutMarkdownDocumentContent({
      source: "- alpha beta gamma",
      fallbackTitle: "",
      width: 96,
      height: 240,
      content: { ...preview.previewContent, layout: { ...preview.previewContent.layout, indentationEnabled } },
      measure: (text, style) => Array.from(text).length * style.fontSize * 0.5
    }).filter((item) => item.kind === "text");

    const indented = layout(true);
    const flat = layout(false);
    const indentedMarker = indented.find((item) => item.text === "•");
    const flatMarker = flat.find((item) => item.text === "•");
    const indentedContinuation = indented.find((item) => item.text === "gamma");
    const flatContinuation = flat.find((item) => item.text === "gamma");

    expect(indentedMarker).toMatchObject({ x: 0, width: preview.previewContent.layout.listMarkerWidth, align: "right" });
    expect(indentedContinuation).toMatchObject({ x: preview.previewContent.layout.listMarkerWidth + preview.previewContent.layout.listMarkerGap });
    expect(indentedContinuation?.y).toBeGreaterThan(indentedMarker?.y || 0);
    expect(flatMarker).toMatchObject({ x: 0, width: preview.previewContent.list.unordered.fontSize * 0.5, align: "left" });
    expect(flatContinuation).toMatchObject({ x: 0 });
    expect(flatContinuation?.y).toBeGreaterThan(flatMarker?.y || 0);
  });

  it("renders every lightweight content family from Markdown-node preview tokens", () => {
    const content = structuredClone(DEFAULT_EDITOR_THEME.specialNode.markdownDocument.previewContent);
    content.title.color = "#101112";
    content.paragraph.color = "#202122";
    content.heading.h2.fontSize = 31;
    content.strong.fontWeight = 850;
    content.emphasis.fontStyle = "italic";
    content.emphasis.color = "#303132";
    content.list.unordered.markerColor = "#404142";
    content.blockquote.backgroundEnabled = false;
    content.blockquote.borderEnabled = true;
    content.blockquote.borderStyle = "custom";
    content.blockquote.customDash = [7, 2];
    content.blockquote.borderColor = "#505152";
    content.blockquote.borderWidth = 3;
    content.blockquote.marginTop = 5;
    content.blockquote.marginBottom = 6;
    content.divider.color = "#606162";
    content.divider.thickness = 2;
    content.divider.marginTop = 3;
    content.divider.marginBottom = 4;

    const items = layoutMarkdownDocumentContent({
      source: "# Title\n\nBody *emphasis* and **strong**.\n\n## Section\n\n- item\n\n> quote\n\n---",
      fallbackTitle: "Document",
      width: 480,
      height: 1200,
      content,
      measure: (text, style) => Array.from(text).length * style.fontSize * 0.5
    });
    const text = items.filter((item) => item.kind === "text");

    expect(text.find((item) => item.text === "Title")).toMatchObject({ color: "#101112" });
    expect(text.find((item) => item.text.includes("Body"))).toMatchObject({ color: "#202122" });
    expect(text.find((item) => item.text === "Section")).toMatchObject({ fontSize: 31 });
    expect(text.find((item) => item.text === "emphasis")).toMatchObject({ color: "#303132", fontStyle: "italic" });
    expect(text.find((item) => item.text === "strong")).toMatchObject({ fontWeight: 850 });
    expect(text.find((item) => item.text === "•")).toMatchObject({ color: "#404142" });
    expect(items.find((item) => item.kind === "line")).toMatchObject({
      stroke: "#505152",
      strokeWidth: 3,
      dash: [7, 2]
    });
    expect(items.find((item) => item.kind === "rect" && item.fill === content.blockquote.background)).toBeUndefined();
    expect(items.find((item) => item.kind === "rect" && item.fill === "#606162")).toMatchObject({ height: 2 });
  });
});
