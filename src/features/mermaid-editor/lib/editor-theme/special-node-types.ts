import type { CanvasBorderTokens, CanvasStrokeStyle, ShadowTokens } from "./appearance-types";

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

export type SpecialNodeMarkdownPreviewTextTokens = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  lineHeight: number;
  letterSpacing: number;
  color: string;
};

export type SpecialNodeMarkdownPreviewInlineTokens = {
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  letterSpacing: number;
  color: string;
};

export type SpecialNodeMarkdownPreviewListTokens = SpecialNodeMarkdownPreviewTextTokens & {
  markerColor: string;
  indent: number;
};

export type SpecialNodeMarkdownPreviewQuoteTokens = SpecialNodeMarkdownPreviewTextTokens & {
  enabled: boolean;
  backgroundEnabled: boolean;
  background: string;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  borderStyle: CanvasStrokeStyle;
  customDash: number[];
  radius: number;
  paddingX: number;
  paddingY: number;
  marginTop: number;
  marginBottom: number;
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
  previewTypography: {
    titleFontSize: number;
    contentFontSize: number;
  };
  previewSpacing: {
    indentationEnabled: boolean;
    titleBottomGap: number;
    sectionTopGap: number;
    headingBottomGap: number;
    blockGap: number;
    listItemGap: number;
  };
  previewContent: {
    layout: {
      indentationEnabled: boolean;
      titleBottomGap: number;
      sectionTopGap: number;
      headingBottomGap: number;
      blockGap: number;
      paragraphGap: number;
      listItemGap: number;
      listMarkerWidth: number;
      listMarkerGap: number;
    };
    title: SpecialNodeMarkdownPreviewTextTokens;
    paragraph: SpecialNodeMarkdownPreviewTextTokens;
    heading: {
      h1: SpecialNodeMarkdownPreviewTextTokens;
      h2: SpecialNodeMarkdownPreviewTextTokens;
      h3: SpecialNodeMarkdownPreviewTextTokens;
      h4: SpecialNodeMarkdownPreviewTextTokens;
      h5: SpecialNodeMarkdownPreviewTextTokens;
      h6: SpecialNodeMarkdownPreviewTextTokens;
    };
    strong: SpecialNodeMarkdownPreviewInlineTokens;
    emphasis: SpecialNodeMarkdownPreviewInlineTokens;
    list: {
      unordered: SpecialNodeMarkdownPreviewListTokens;
      ordered: SpecialNodeMarkdownPreviewListTokens;
    };
    blockquote: SpecialNodeMarkdownPreviewQuoteTokens;
    divider: {
      enabled: boolean;
      color: string;
      thickness: number;
      marginTop: number;
      marginBottom: number;
    };
  };
  width: number;
  height: number;
  contentPaddingTop: number;
  contentPaddingRight: number;
  contentPaddingBottom: number;
  contentPaddingLeft: number;
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
