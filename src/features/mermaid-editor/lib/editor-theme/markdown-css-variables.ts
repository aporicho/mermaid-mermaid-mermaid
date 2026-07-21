import type { EditorTheme, MarkdownTextTokens } from "./types";

export function markdownToCssVariables(theme: EditorTheme): Record<string, string> {
  const markdown = theme.markdown;
  return {
    "--markdown-font-body": markdown.body.fontFamily,
    "--markdown-font-heading": markdown.heading.h1.fontFamily,
    "--markdown-font-code": markdown.codeBlock.fontFamily,
    ...textVariables("body", markdown.body),
    "--markdown-paragraph-spacing": px(markdown.body.paragraphSpacing),
    ...headingVariables("h1", markdown.heading.h1),
    ...headingVariables("h2", markdown.heading.h2),
    ...headingVariables("h3", markdown.heading.h3),
    ...headingVariables("h4", markdown.heading.h4),
    ...headingVariables("h5", markdown.heading.h5),
    ...headingVariables("h6", markdown.heading.h6),
    ...textVariables("link", markdown.link),
    "--markdown-link-hover-color": markdown.link.hoverColor,
    "--markdown-link-underline-thickness": px(markdown.link.underlineThickness),
    "--markdown-link-underline-offset": px(markdown.link.underlineOffset),
    ...textVariables("emphasis", markdown.emphasis),
    ...textVariables("strong", markdown.strong),
    ...textVariables("strikethrough", markdown.strikethrough),
    "--markdown-strikethrough-decoration-color": markdown.strikethrough.decorationColor,
    "--markdown-strikethrough-decoration-thickness": px(markdown.strikethrough.decorationThickness),
    ...listVariables("unordered-list", markdown.list.unordered),
    ...listVariables("ordered-list", markdown.list.ordered),
    ...listVariables("task-list", markdown.list.task),
    "--markdown-task-list-checkbox-size": px(markdown.list.task.checkboxSize),
    "--markdown-task-list-checkbox-border-width": px(markdown.list.task.checkboxBorderWidth),
    "--markdown-task-list-checkbox-border-color": markdown.list.task.checkboxBorderColor,
    "--markdown-task-list-checkbox-background": markdown.list.task.checkboxBackground,
    "--markdown-task-list-checkbox-checked-background": markdown.list.task.checkboxCheckedBackground,
    "--markdown-task-list-checkbox-check-color": markdown.list.task.checkboxCheckColor,
    "--markdown-task-list-checkbox-radius": px(markdown.list.task.checkboxRadius),
    ...textVariables("blockquote", markdown.blockquote),
    "--markdown-blockquote-background": markdown.blockquote.background,
    "--markdown-blockquote-border-color": markdown.blockquote.borderColor,
    "--markdown-blockquote-border-width": px(markdown.blockquote.borderWidth),
    "--markdown-blockquote-padding-x": px(markdown.blockquote.paddingX),
    "--markdown-blockquote-padding-y": px(markdown.blockquote.paddingY),
    "--markdown-blockquote-margin-y": px(markdown.blockquote.marginY),
    "--markdown-blockquote-radius": px(markdown.blockquote.radius),
    ...textVariables("inline-code", markdown.inlineCode),
    "--markdown-inline-code-background": markdown.inlineCode.background,
    "--markdown-inline-code-padding-x": px(markdown.inlineCode.paddingX),
    "--markdown-inline-code-padding-y": px(markdown.inlineCode.paddingY),
    "--markdown-inline-code-radius": px(markdown.inlineCode.radius),
    ...textVariables("code-block", markdown.codeBlock),
    "--markdown-code-block-background": markdown.codeBlock.background,
    "--markdown-code-block-padding-x": px(markdown.codeBlock.paddingX),
    "--markdown-code-block-padding-y": px(markdown.codeBlock.paddingY),
    "--markdown-code-block-margin-y": px(markdown.codeBlock.marginY),
    "--markdown-code-block-radius": px(markdown.codeBlock.radius),
    ...textVariables("table", markdown.table),
    "--markdown-table-border-color": markdown.table.borderColor,
    "--markdown-table-header-background": markdown.table.headerBackground,
    "--markdown-table-body-background": markdown.table.bodyBackground,
    "--markdown-table-cell-padding-x": px(markdown.table.cellPaddingX),
    "--markdown-table-cell-padding-y": px(markdown.table.cellPaddingY),
    "--markdown-table-border-width": px(markdown.table.borderWidth),
    "--markdown-table-radius": px(markdown.table.radius),
    "--markdown-table-margin-y": px(markdown.table.marginY),
    "--markdown-divider-color": markdown.divider.color,
    "--markdown-divider-thickness": px(markdown.divider.thickness),
    "--markdown-divider-margin-y": px(markdown.divider.marginY),
    "--markdown-image-border-color": markdown.image.borderColor,
    "--markdown-image-border-width": px(markdown.image.borderWidth),
    "--markdown-image-radius": px(markdown.image.radius),
    "--markdown-image-margin-y": px(markdown.image.marginY)
  };
}

function textVariables(prefix: string, tokens: MarkdownTextTokens): Record<string, string> {
  return {
    [`--markdown-${prefix}-font-family`]: tokens.fontFamily,
    [`--markdown-${prefix}-font-size`]: px(tokens.fontSize),
    [`--markdown-${prefix}-font-weight`]: String(tokens.fontWeight),
    [`--markdown-${prefix}-line-height`]: px(tokens.lineHeight),
    [`--markdown-${prefix}-letter-spacing`]: px(tokens.letterSpacing),
    [`--markdown-${prefix}-color`]: tokens.color
  };
}

function headingVariables(level: string, tokens: EditorTheme["markdown"]["heading"]["h1"]): Record<string, string> {
  return {
    ...textVariables(level, tokens),
    [`--markdown-${level}-margin-top`]: px(tokens.marginTop),
    [`--markdown-${level}-margin-bottom`]: px(tokens.marginBottom)
  };
}

function listVariables(prefix: string, tokens: EditorTheme["markdown"]["list"]["unordered"] | EditorTheme["markdown"]["list"]["task"]): Record<string, string> {
  return {
    ...textVariables(prefix, tokens),
    ...("markerColor" in tokens ? { [`--markdown-${prefix}-marker-color`]: tokens.markerColor } : {}),
    [`--markdown-${prefix}-indent`]: px(tokens.indent),
    [`--markdown-${prefix}-item-spacing`]: px(tokens.itemSpacing),
    [`--markdown-${prefix}-block-spacing`]: px(tokens.blockSpacing)
  };
}

function px(value: number) {
  return `${value}px`;
}
