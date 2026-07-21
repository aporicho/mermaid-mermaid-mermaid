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
  blockSpacing: number;
};

export type MarkdownTaskListTokens = MarkdownListTokens & {
  checkboxSize: number;
  checkboxBorderWidth: number;
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
  paddingX: number;
  paddingY: number;
  marginY: number;
  radius: number;
};

export type MarkdownInlineCodeTokens = MarkdownTextTokens & {
  background: string;
  paddingX: number;
  paddingY: number;
  radius: number;
};

export type MarkdownCodeBlockTokens = MarkdownInlineCodeTokens & {
  marginY: number;
};

export type MarkdownTableTokens = MarkdownTextTokens & {
  borderColor: string;
  headerBackground: string;
  alternateBackground: string;
  cellPaddingX: number;
  cellPaddingY: number;
  borderWidth: number;
  radius: number;
  marginY: number;
};

export type MarkdownThemeTokens = {
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
    marginY: number;
  };
  image: {
    borderColor: string;
    borderWidth: number;
    radius: number;
    marginY: number;
  };
};
