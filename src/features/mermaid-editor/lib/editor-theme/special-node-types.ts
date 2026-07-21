export type SpecialNodeCommonTokens = {
  background: string;
  textColor: string;
  mutedTextColor: string;
  accentColor: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOpacity: number;
  shadowOffsetY: number;
};

export type SpecialNodeLinkCardTokens = {
  width: number;
  inset: number;
  coverBackground: string;
  coverBorderColor: string;
  coverBorderWidth: number;
  coverRadius: number;
  coverFallbackHeight: number;
  coverMinHeight: number;
  coverMaxHeight: number;
  contentPaddingX: number;
  providerColor: string;
  brandColor: string;
  providerGap: number;
  titleGap: number;
  titleHeight: number;
};

export type SpecialNodeMarkdownDocumentTokens = {
  width: number;
  height: number;
  contentPadding: number;
  badgeSize: number;
  badgeBackground: string;
  badgeErrorBackground: string;
  badgeColor: string;
  badgeErrorColor: string;
  badgeOpacity: number;
  badgeErrorOpacity: number;
  badgeRadius: number;
  titleGap: number;
  pathGap: number;
  separatorColor: string;
  separatorWidth: number;
  separatorOpacity: number;
  excerptGap: number;
  pathOpacity: number;
  excerptOpacity: number;
  placeholderOpacity: number;
};

export type SpecialNodeImageTokens = {
  background: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  interactionBorderColor: string;
  interactionBorderWidth: number;
};

export type SpecialNodeTableTokens = {
  background: string;
  borderColor: string;
  borderWidth: number;
  dividerColor: string;
  dividerWidth: number;
  selectedCellFill: string;
  selectedCellStroke: string;
  selectedCellStrokeWidth: number;
  cellPaddingX: number;
  cellPaddingY: number;
  minColumnWidth: number;
  minRowHeight: number;
  resizeHandleWidth: number;
};

export type SpecialNodeThemeTokens = {
  common: SpecialNodeCommonTokens;
  linkCard: SpecialNodeLinkCardTokens;
  markdownDocument: SpecialNodeMarkdownDocumentTokens;
  image: SpecialNodeImageTokens;
  table: SpecialNodeTableTokens;
};
