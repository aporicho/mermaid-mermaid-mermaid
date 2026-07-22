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

  it("keeps every top-level list flush and reserves indent tokens for nested levels", () => {
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror ul")).toContain("padding-left: 0");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror ol")).toContain("padding-left: 0");
    expect(cssRuleGroup('.markdown-editor-panel .milkdown .ProseMirror ul:has(> li[data-item-type="task"])')).toContain("padding-left: 0");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror :is(ul, ol) ul")).toContain("padding-left: var(--markdown-unordered-list-indent)");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror :is(ul, ol) ol")).toContain("padding-left: var(--markdown-ordered-list-indent)");
    expect(cssRuleGroup('.markdown-editor-panel .milkdown .ProseMirror :is(ul, ol) ul:has(> li[data-item-type="task"])')).toContain("padding-left: var(--markdown-task-list-indent)");
  });

  it("replaces Crepe's fixed list marker geometry with Markdown layout tokens", () => {
    expect(cssRule(".markdown-editor-panel .milkdown .milkdown-list-item-block li")).toContain("gap: var(--markdown-list-marker-gap)");
    const marker = cssRule(".markdown-editor-panel .milkdown .milkdown-list-item-block li > .label-wrapper");
    expect(marker).toContain("width: var(--markdown-list-marker-width)");
    expect(marker).toContain("flex: 0 0 var(--markdown-list-marker-width)");
  });

  it("applies the exposed inline code typography scale", () => {
    const rule = cssRule(".markdown-editor-panel .milkdown .ProseMirror :not(pre) > code");
    expect(rule).toContain("font-size: calc(var(--markdown-inline-code-font-size) * var(--markdown-text-scale))");
    expect(rule).toContain("line-height: calc(var(--markdown-inline-code-line-height) * var(--markdown-text-scale))");
  });

  it("scales Markdown typography and vertical rhythm without scaling horizontal or appearance tokens", () => {
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

    const verticalRhythmTokens = [
      "paragraph-spacing",
      "heading-stack-spacing",
      "unordered-list-margin-top",
      "unordered-list-margin-bottom",
      "unordered-list-item-spacing",
      "unordered-list-nested-spacing",
      "ordered-list-margin-top",
      "ordered-list-margin-bottom",
      "ordered-list-item-spacing",
      "ordered-list-nested-spacing",
      "task-list-margin-top",
      "task-list-margin-bottom",
      "task-list-item-spacing",
      "task-list-nested-spacing",
      "blockquote-margin-top",
      "blockquote-margin-bottom",
      "code-block-margin-top",
      "code-block-margin-bottom",
      "table-margin-top",
      "table-margin-bottom",
      "divider-margin-top",
      "divider-margin-bottom",
      "image-margin-top",
      "image-margin-bottom"
    ];
    for (const token of verticalRhythmTokens) {
      expect(css).toContain(`calc(var(--markdown-${token}) * var(--markdown-text-scale))`);
    }
    for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(css).toContain(`calc(var(--markdown-${level}-margin-top) * var(--markdown-text-scale))`);
      expect(css).toContain(`calc(var(--markdown-${level}-margin-bottom) * var(--markdown-text-scale))`);
    }

    expect(css).toContain("width: var(--markdown-task-list-checkbox-size)");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror ul")).toContain("padding-left: 0");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror ol")).toContain("padding-left: 0");
    expect(css).toContain("padding: var(--markdown-blockquote-padding-y) var(--markdown-blockquote-padding-x)");
    expect(css).toContain("padding: var(--markdown-code-block-padding-y) var(--markdown-code-block-padding-x)");
    expect(css).toContain("padding: var(--markdown-table-cell-padding-y) var(--markdown-table-cell-padding-x)");
    expect(css).toContain("border-radius: var(--markdown-table-radius)");
  });

  it("uses directional spacing tokens instead of legacy symmetric block spacing", () => {
    for (const legacyToken of [
      "unordered-list-block-spacing",
      "ordered-list-block-spacing",
      "task-list-block-spacing",
      "blockquote-margin-y",
      "code-block-margin-y",
      "table-margin-y",
      "divider-margin-y",
      "image-margin-y"
    ]) {
      expect(css).not.toContain(`--markdown-${legacyToken}`);
    }
  });

  it("lets headings control adjacent section spacing and closes the document boundaries", () => {
    const headingThenContent = cssRule(
      ".markdown-editor-panel .milkdown .ProseMirror > :is(h1, h2, h3, h4, h5, h6) + :not(:is(h1, h2, h3, h4, h5, h6))"
    );
    const contentThenHeading = cssRule(
      ".markdown-editor-panel .milkdown .ProseMirror > :not(:is(h1, h2, h3, h4, h5, h6)):has(+ :is(h1, h2, h3, h4, h5, h6))"
    );

    expect(headingThenContent).toContain("margin-top: 0");
    expect(contentThenHeading).toContain("margin-bottom: 0");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror > :is(h1, h2, h3, h4, h5, h6):has(+ :is(h1, h2, h3, h4, h5, h6))")).toContain("margin-bottom: 0");
    for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      const stackedHeading = cssRule(`.markdown-editor-panel .milkdown .ProseMirror > :is(h1, h2, h3, h4, h5, h6) + ${level}`);
      expect(stackedHeading).toContain("margin-top: max(");
      expect(stackedHeading).toContain("var(--markdown-heading-stack-spacing)");
      expect(stackedHeading).toContain(`var(--markdown-${level}-margin-bottom)`);
    }
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror > :first-child")).toContain("margin-top: 0");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror > :last-child")).toContain("margin-bottom: 0");
  });

  it("spaces only adjacent list items and gives nested lists their own rhythm", () => {
    expect(css).toContain(".markdown-editor-panel .milkdown .ProseMirror ul > li + li,");
    expect(css).toContain(".markdown-editor-panel .milkdown .ProseMirror ol > li + li,");
    expect(css).toContain(".milkdown-list-item-block + .milkdown-list-item-block > .list-item");
    expect(css).not.toMatch(/margin-block:\s*var\(--markdown-(?:unordered|ordered|task)-list-item-spacing\)/);
    const nestedUnordered = cssRule(".markdown-editor-panel .milkdown .ProseMirror :is(ul, ol) ul");
    const nestedOrdered = cssRule(".markdown-editor-panel .milkdown .ProseMirror :is(ul, ol) ol");
    expect(nestedUnordered).toContain("var(--markdown-unordered-list-nested-spacing)");
    expect(nestedUnordered).toContain("padding-left: var(--markdown-unordered-list-indent)");
    expect(nestedOrdered).toContain("var(--markdown-ordered-list-nested-spacing)");
    expect(nestedOrdered).toContain("padding-left: var(--markdown-ordered-list-indent)");
    expect(css).toContain("var(--markdown-task-list-nested-spacing)");
    expect(css).toContain("padding-left: var(--markdown-task-list-indent)");
    expect(css).toContain(".ProseMirror li > p:has(+ :is(ul, ol)),");
    expect(css).toContain(".milkdown-list-item-block .list-item > .children > p:has(+ :is(ul, ol))");
  });

  it("closes paragraph spacing inside quotes, table cells, and both list DOM forms", () => {
    expect(css).toContain(".ProseMirror :where(blockquote, li, th, td) > p:first-child,");
    expect(css).toContain(".ProseMirror :where(blockquote, li, th, td) > p:last-child,");
    expect(css).toContain(".milkdown-list-item-block .list-item > .children > p:first-child");
    expect(css).toContain(".milkdown-list-item-block .list-item > .children > p:last-child");
  });

  it("uses theme tokens for reading layout and every exposed Markdown border style", () => {
    expect(cssRule(".markdown-editor-panel .milkdown .editor")).toContain("padding: var(--markdown-layout-padding-y) var(--markdown-layout-padding-x)");
    expect(cssRule(".markdown-editor-panel .milkdown .ProseMirror blockquote")).toContain("var(--markdown-blockquote-border-style)");
    expect(cssRule(".markdown-editor-panel .milkdown .milkdown-table-block table")).toContain("var(--markdown-table-border-style)");
    expect(css).toContain("var(--markdown-image-border-width) var(--markdown-image-border-style) var(--markdown-image-border-color)");
    expect(css).toContain("var(--markdown-task-list-checkbox-border-style)");
    expect(css).toContain("var(--markdown-task-checkbox-placeholder-width)");
    expect(css).toContain("var(--markdown-list-marker-width)");
    expect(css).toContain("var(--markdown-list-marker-gap)");
  });
});

function cssRule(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("}\n", start);
  return css.slice(start, end + 1);
}

function cssRuleGroup(firstSelector: string) {
  const start = css.indexOf(firstSelector);
  expect(start).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf("{", start);
  const end = css.indexOf("}\n", bodyStart);
  return css.slice(start, end + 1);
}
