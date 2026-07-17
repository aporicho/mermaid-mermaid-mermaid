export type MarkdownHeadingTokens = {
  color: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
  marginTop: number;
  marginBottom: number;
};

export type MarkdownThemeTokens = {
  font: {
    familyBody: string;
    familyHeading: string;
    familyCode: string;
  };
  body: {
    color: string;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    letterSpacing: number;
    paragraphSpacing: number;
  };
  heading: {
    h1: MarkdownHeadingTokens;
    h2: MarkdownHeadingTokens;
    h3: MarkdownHeadingTokens;
    h4: MarkdownHeadingTokens;
    h5: MarkdownHeadingTokens;
    h6: MarkdownHeadingTokens;
  };
  link: {
    color: string;
    hoverColor: string;
    underlineThickness: number;
    underlineOffset: number;
  };
  emphasis: {
    color: string;
    strongWeight: number;
  };
  list: {
    markerColor: string;
    indent: number;
    itemSpacing: number;
    blockSpacing: number;
  };
  quote: {
    textColor: string;
    borderColor: string;
    background: string;
    paddingX: number;
    paddingY: number;
    marginY: number;
    borderWidth: number;
    radius: number;
  };
  inlineCode: {
    textColor: string;
    background: string;
    fontSize: number;
    lineHeight: number;
    paddingX: number;
    paddingY: number;
    radius: number;
  };
  codeBlock: {
    textColor: string;
    background: string;
    fontSize: number;
    lineHeight: number;
    paddingX: number;
    paddingY: number;
    marginY: number;
    radius: number;
  };
  table: {
    textColor: string;
    borderColor: string;
    headerBackground: string;
    alternateBackground: string;
    cellPaddingX: number;
    cellPaddingY: number;
    borderWidth: number;
    radius: number;
    marginY: number;
  };
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
