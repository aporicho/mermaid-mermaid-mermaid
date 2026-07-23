import type { CanvasBorderTokens, ShadowTokens } from "./appearance-types";

export type SpecialNodeSharedTokens = {
  textColor: string;
  mutedTextColor: string;
  accentColor: string;
  errorColor: string;
};

/** @deprecated v10 compatibility alias. The v11 theme key is `shared`. */
export type SpecialNodeCommonTokens = SpecialNodeSharedTokens;

export type SpecialNodeSurfaceTokens = {
  background: string;
  border: CanvasBorderTokens;
  radius: number;
  shadow: ShadowTokens;
};

export type SpecialNodeStateTokens = {
  hoverBorderColor: string;
  selectedBorderColor: string;
  errorBorderColor: string;
  editingBorderColor: string;
  emphasizedBorderWidth: number;
};

export type SpecialNodeVisualState =
  | "normal"
  | "hovered"
  | "selected"
  | "dragging"
  | "editing"
  | "connectionTarget"
  | "connectionInvalid"
  | "error";

export type SpecialNodeLinkCardTokens = {
  surface: SpecialNodeSurfaceTokens;
  state: SpecialNodeStateTokens;
  width: number;
  inset: number;
  coverBackground: string;
  coverBorder: CanvasBorderTokens;
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
  surface: SpecialNodeSurfaceTokens;
  state: SpecialNodeStateTokens;
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
  surface: SpecialNodeSurfaceTokens;
  state: SpecialNodeStateTokens;
};

export type SpecialNodeHtmlDocumentTokens = {
  surface: SpecialNodeSurfaceTokens;
  state: SpecialNodeStateTokens;
  width: number;
  height: number;
  contentPadding: number;
  badgeSize: number;
  badgeBackground: string;
  badgeColor: string;
  badgeOpacity: number;
  badgeRadius: number;
  titleGap: number;
  pathGap: number;
  separatorColor: string;
  separatorWidth: number;
  separatorOpacity: number;
  excerptGap: number;
  pathOpacity: number;
  excerptOpacity: number;
};

export type SpecialNodeTableTokens = {
  surface: SpecialNodeSurfaceTokens;
  state: SpecialNodeStateTokens;
  headerBackground: string;
  headerTextColor: string;
  bodyTextColor: string;
  hoverCellBackground: string;
  selectedCellBackground: string;
  selectedCellBorder: CanvasBorderTokens;
  grid: CanvasBorderTokens;
  cellPaddingX: number;
  cellPaddingY: number;
  placeholderGap: number;
  minColumnWidth: number;
  minRowHeight: number;
  resizeHandleWidth: number;
};

export type SpecialNodeThemeTokens = {
  shared: SpecialNodeSharedTokens;
  linkCard: SpecialNodeLinkCardTokens;
  markdownDocument: SpecialNodeMarkdownDocumentTokens;
  htmlDocument: SpecialNodeHtmlDocumentTokens;
  image: SpecialNodeImageTokens;
  table: SpecialNodeTableTokens;
};
