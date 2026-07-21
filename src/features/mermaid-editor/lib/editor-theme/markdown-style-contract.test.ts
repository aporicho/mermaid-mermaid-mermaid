import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8");

describe("Markdown style contract", () => {
  it("uses one table body background instead of alternating rows", () => {
    expect(css).toContain("background: var(--markdown-table-body-background)");
    expect(css).not.toContain("tbody tr:nth-child(even)");
    expect(css).not.toContain("--markdown-table-alternate-background");
  });

  it("applies inline typography tokens in body contexts while headings inherit their type scale", () => {
    const linkRule = cssRule(".markdown-editor-panel .milkdown .ProseMirror a");
    const emphasisRule = cssRule(".markdown-editor-panel .milkdown .ProseMirror em");
    const strongRule = cssRule(".markdown-editor-panel .milkdown .ProseMirror strong");
    const strikeRule = cssRule(".markdown-editor-panel .milkdown .ProseMirror :is(del, s)");

    for (const rule of [linkRule, emphasisRule, strongRule, strikeRule]) {
      expect(rule).not.toContain("font-family:");
      expect(rule).not.toContain("font-size:");
      expect(rule).not.toContain("line-height:");
      expect(rule).not.toContain("letter-spacing:");
    }
    expect(strongRule).toContain("font-weight: var(--markdown-strong-font-weight)");

    expect(cssRule('.markdown-editor-panel .milkdown .ProseMirror :where(p, li, td, th, blockquote) a:not(:is(h1, h2, h3, h4, h5, h6) a)')).toContain("font-family: var(--markdown-link-font-family)");
    expect(cssRule('.markdown-editor-panel .milkdown .ProseMirror :where(p, li, td, th, blockquote) em:not(:is(h1, h2, h3, h4, h5, h6) em)')).toContain("font-size: calc(var(--markdown-emphasis-font-size) * var(--markdown-text-scale))");
    expect(cssRule('.markdown-editor-panel .milkdown .ProseMirror :where(p, li, td, th, blockquote) strong:not(:is(h1, h2, h3, h4, h5, h6) strong)')).toContain("line-height: calc(var(--markdown-strong-line-height) * var(--markdown-text-scale))");
    expect(cssRule('.markdown-editor-panel .milkdown .ProseMirror :where(p, li, td, th, blockquote) :is(del, s):not(:is(h1, h2, h3, h4, h5, h6) :is(del, s))')).toContain("letter-spacing: var(--markdown-strikethrough-letter-spacing)");
  });

  it("does not expose a fake task marker color beside the real checkbox tokens", () => {
    expect(css).not.toContain("--markdown-task-list-marker-color");
  });

  it("applies the exposed inline code typography scale", () => {
    const rule = cssRule(".markdown-editor-panel .milkdown .ProseMirror :not(pre) > code");
    expect(rule).toContain("font-size: calc(var(--markdown-inline-code-font-size) * var(--markdown-text-scale))");
    expect(rule).toContain("line-height: calc(var(--markdown-inline-code-line-height) * var(--markdown-text-scale))");
  });

  it("scales every Markdown text role without scaling non-typographic appearance tokens", () => {
    const roles = [
      "body", "h1", "h2", "h3", "h4", "h5", "h6", "link", "emphasis", "strong", "strikethrough",
      "unordered-list", "ordered-list", "task-list", "blockquote", "inline-code", "code-block", "table"
    ];
    for (const role of roles) {
      expect(css).toContain(`font-size: calc(var(--markdown-${role}-font-size) * var(--markdown-text-scale))`);
      expect(css).toContain(`line-height: calc(var(--markdown-${role}-line-height) * var(--markdown-text-scale))`);
    }
    expect(css).not.toMatch(/font-size:\s*var\(--markdown-[^)]+-font-size\)/);
    expect(css).not.toMatch(/line-height:\s*var\(--markdown-[^)]+-line-height\)/);
    expect(css).toContain("width: var(--markdown-task-list-checkbox-size)");
    expect(css).toContain("padding: var(--markdown-blockquote-padding-y) var(--markdown-blockquote-padding-x)");
    expect(css).toContain("border-radius: var(--markdown-table-radius)");
  });

  it("uses theme tokens for reading layout and every exposed Markdown border style", () => {
    expect(cssRule(".markdown-editor-panel .milkdown .editor")).toContain("padding: var(--markdown-layout-padding-y) var(--markdown-layout-padding-x)");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror blockquote")).toContain("var(--markdown-blockquote-border-style)");
    expect(cssRule(".markdown-editor-panel .milkdown .milkdown-table-block table")).toContain("var(--markdown-table-border-style)");
    expect(css).toContain("var(--markdown-image-border-width) var(--markdown-image-border-style) var(--markdown-image-border-color)");
    expect(css).toContain("var(--markdown-task-list-checkbox-border-style)");
    expect(css).toContain("var(--markdown-task-checkbox-placeholder-width)");
  });
});

function cssRule(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("}\n", start);
  return css.slice(start, end + 1);
}
