export type TypographyRoleTokens = {
  family: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
};

export type EditorTypographyTokens = {
  interface: {
    body: TypographyRoleTokens;
    heading: TypographyRoleTokens;
    control: TypographyRoleTokens;
    navigation: TypographyRoleTokens;
    menu: TypographyRoleTokens;
    tooltip: TypographyRoleTokens;
    metadata: TypographyRoleTokens;
    status: TypographyRoleTokens;
    technical: TypographyRoleTokens;
  };
  canvas: {
    node: TypographyRoleTokens;
    nodeEditor: TypographyRoleTokens;
    edgeLabel: TypographyRoleTokens;
    edgeEditor: TypographyRoleTokens;
    subgraphTitle: TypographyRoleTokens;
    actionBadge: TypographyRoleTokens;
  };
  linkCard: {
    brand: TypographyRoleTokens;
    provider: TypographyRoleTokens;
    title: TypographyRoleTokens;
    titleEditor: TypographyRoleTokens;
  };
  markdownCard: {
    badge: TypographyRoleTokens;
    title: TypographyRoleTokens;
    path: TypographyRoleTokens;
    excerpt: TypographyRoleTokens;
    titleEditor: TypographyRoleTokens;
  };
  mermaid: {
    general: TypographyRoleTokens;
    diagramTitle: TypographyRoleTokens;
    primaryLabel: TypographyRoleTokens;
    relationLabel: TypographyRoleTokens;
    groupTitle: TypographyRoleTokens;
    note: TypographyRoleTokens;
  };
  canvasDocument: {
    shape: TypographyRoleTokens;
    shapeEditor: TypographyRoleTokens;
    card: TypographyRoleTokens;
    cardEditor: TypographyRoleTokens;
    freeText: TypographyRoleTokens;
    freeTextEditor: TypographyRoleTokens;
    connector: TypographyRoleTokens;
    connectorEditor: TypographyRoleTokens;
  };
  source: {
    editor: TypographyRoleTokens;
    diagnosticSummary: TypographyRoleTokens;
    diagnosticRaw: TypographyRoleTokens;
  };
  terminal: {
    content: TypographyRoleTokens;
    heading: TypographyRoleTokens;
    path: TypographyRoleTokens;
  };
};
