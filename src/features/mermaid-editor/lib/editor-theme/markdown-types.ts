import type { CssBorderStyle } from "./appearance-types";

export type MarkdownTextTokens = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
};

export type MarkdownBodyTokens = MarkdownTextTokens & {
  paragraphSpacing: number;
};

export type MarkdownHeadingTokens = MarkdownTextTokens & {
  marginTop: number;
  marginBottom: number;
};

export type MarkdownLinkTokens = MarkdownTextTokens & {
  hoverColor: string;
  underlineThickness: number;
  underlineOffset: number;
};

export type MarkdownStrikethroughTokens = MarkdownTextTokens & {
  decorationColor: string;
  decorationThickness: number;
};

export type MarkdownListTokens = MarkdownTextTokens & {
  markerColor: string;
  indent: number;
  itemSpacing: number;
  marginTop: number;
  marginBottom: number;
};

export type MarkdownTaskListTokens = Omit<MarkdownListTokens, "markerColor"> & {
  checkboxSize: number;
  checkboxBorderWidth: number;
  checkboxBorderStyle: CssBorderStyle;
  checkboxBorderColor: string;
  checkboxBackground: string;
  checkboxCheckedBackground: string;
  checkboxCheckColor: string;
  checkboxRadius: number;
};

export type MarkdownBlockquoteTokens = MarkdownTextTokens & {
  background: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: CssBorderStyle;
  paddingX: number;
  paddingY: number;
  marginTop: number;
  marginBottom: number;
  radius: number;
};

export type MarkdownInlineCodeTokens = MarkdownTextTokens & {
  background: string;
  paddingX: number;
  paddingY: number;
  radius: number;
};

export type MarkdownCodeBlockTokens = MarkdownInlineCodeTokens & {
  marginTop: number;
  marginBottom: number;
};

export type MarkdownTableTokens = MarkdownTextTokens & {
  borderColor: string;
  headerBackground: string;
  bodyBackground: string;
  cellPaddingX: number;
  cellPaddingY: number;
  borderWidth: number;
  borderStyle: CssBorderStyle;
  radius: number;
  marginTop: number;
  marginBottom: number;
};

export type MarkdownThemeTokens = {
  layout: {
    paddingX: number;
    paddingY: number;
    listMarkerWidth: number;
    listMarkerGap: number;
    taskCheckboxPlaceholderWidth: number;
    headingStackSpacing: number;
  };
  body: MarkdownBodyTokens;
  heading: {
    h1: MarkdownHeadingTokens;
    h2: MarkdownHeadingTokens;
    h3: MarkdownHeadingTokens;
    h4: MarkdownHeadingTokens;
    h5: MarkdownHeadingTokens;
    h6: MarkdownHeadingTokens;
  };
  link: MarkdownLinkTokens;
  emphasis: MarkdownTextTokens;
  strong: MarkdownTextTokens;
  strikethrough: MarkdownStrikethroughTokens;
  list: {
    unordered: MarkdownListTokens;
    ordered: MarkdownListTokens;
    task: MarkdownTaskListTokens;
  };
  blockquote: MarkdownBlockquoteTokens;
  inlineCode: MarkdownInlineCodeTokens;
  codeBlock: MarkdownCodeBlockTokens;
  table: MarkdownTableTokens;
  divider: {
    color: string;
    thickness: number;
    marginTop: number;
    marginBottom: number;
  };
  image: {
    borderColor: string;
    borderWidth: number;
    borderStyle: CssBorderStyle;
    radius: number;
    marginTop: number;
    marginBottom: number;
  };
};
