export type ThemeSettingsCategoryId = "library" | "interface" | "canvas" | "markdown" | "terminal" | "motion" | "diagnostics";

export type ThemeTokenGroupDefinition = {
  id: string;
  category: Exclude<ThemeSettingsCategoryId, "library">;
  title: string;
  description: string;
  path: readonly string[];
  commonKeys?: readonly string[];
  hiddenKeys?: readonly string[];
};

export const THEME_SETTINGS_CATEGORIES = [
  { id: "library", label: "主题库", description: "选择预设或从当前外观开始定制" },
  { id: "interface", label: "界面", description: "应用框架、字体、密度与控件" },
  { id: "canvas", label: "画布", description: "节点、连线、分组、网格与交互" },
  { id: "markdown", label: "Markdown", description: "正文、标题、代码与富文本元素" },
  { id: "terminal", label: "终端", description: "终端基础色和 ANSI 调色板" },
  { id: "motion", label: "动效", description: "时长、缓动、位移与画布反馈" },
  { id: "diagnostics", label: "诊断", description: "可读性阈值与主题问题" }
] as const satisfies readonly { id: ThemeSettingsCategoryId; label: string; description: string }[];

export const THEME_TOKEN_GROUPS: readonly ThemeTokenGroupDefinition[] = [
  group("ui", "interface", "基础色彩", "界面表面、文字、强调色和状态色。", ["ui"], ["background", "foreground", "card", "primary", "muted", "border"]),
  group("font", "interface", "字体与字重", "应用、画布、源码和终端使用的字体指标。", ["font"], ["familySans", "familyMono", "sizeUiSm", "sizeNode", "sizeSource", "sizeTerminal"]),
  group("space", "interface", "密度与间距", "面板、控件、节点和网格的尺寸节奏。", ["space"], ["panelPadding", "controlGap", "controlPaddingX", "controlPaddingY", "iconButtonSize", "nodePaddingX", "nodePaddingY"]),
  group("radius", "interface", "圆角", "应用、控件、节点和标签的圆角。", ["radius"]),
  group("icon", "interface", "控件与图标", "Iconoir 图标尺寸、描边和按钮高度。", ["icon"], ["sizeSm", "sizeButton", "strokeWidth"], ["family"]),

  group("canvas-colors", "canvas", "画布色彩", "画布、节点、连线和非法状态的颜色。", ["canvas"], ["surface", "nodeStroke", "nodeText", "edge", "edgeText", "labelStroke"]),
  group("canvas-appearance", "canvas", "节点外观", "节点填色层级和拖动预览阴影。", ["canvasAppearance"]),
  group("render", "canvas", "源码与渲染", "源码分隔线、渲染背景与网格点。", ["source"]),
  group("render-surface", "canvas", "渲染表面", "导出及渲染视图使用的背景和网格。", ["render"]),
  group("stroke", "canvas", "描边与虚线", "节点、连线、选择框、引导线和分组描边。", ["stroke"], ["node", "nodeEmphasized", "edge", "edgeThick", "overlay", "anchor"]),
  group("canvas-interaction", "canvas", "连线与交互", "锚点、箭头、曲线精度、命中区域和网格细节。", ["canvasInteraction"], ["anchorRadius", "endpointRadius", "edgeHitStrokeWidth", "pointerLength", "pointerWidth", "parallelEdgeSpacing", "edgeCurveSegments"]),
  group("subgraph", "canvas", "分组", "分组容器、标题、内边距和最小尺寸。", ["subgraph"], ["paddingX", "paddingTop", "paddingBottom", "titleHeight", "titleFontSize", "titleFontWeight", "minWidth", "minHeight", "fillOpacity"]),
  group("edge-label", "canvas", "连线标签", "标签宽度、字号、行高和内边距。", ["edgeLabel"]),

  group("markdown-font", "markdown", "字体", "Markdown 正文、标题和代码字体。", ["markdown", "font"]),
  group("markdown-body", "markdown", "正文", "正文颜色、字号、行高和段落节奏。", ["markdown", "body"], ["color", "fontSize", "lineHeight", "fontWeight", "paragraphSpacing"]),
  ...(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((level, index) =>
    group(`markdown-${level}`, "markdown", `${["一", "二", "三", "四", "五", "六"][index]}级标题`, "标题颜色、层级尺寸和上下间距。", ["markdown", "heading", level], ["color", "fontSize", "lineHeight", "fontWeight"])
  ),
  group("markdown-link", "markdown", "链接", "链接颜色和下划线。", ["markdown", "link"]),
  group("markdown-emphasis", "markdown", "强调", "强调文字的颜色和字重。", ["markdown", "emphasis"]),
  group("markdown-list", "markdown", "列表", "列表标记、缩进和条目间距。", ["markdown", "list"]),
  group("markdown-quote", "markdown", "引用", "引用文字、背景、边线和空间。", ["markdown", "quote"], ["textColor", "borderColor", "background", "borderWidth"]),
  group("markdown-inline-code", "markdown", "行内代码", "行内代码颜色、字号和盒模型。", ["markdown", "inlineCode"], ["textColor", "background", "fontSize"]),
  group("markdown-code-block", "markdown", "代码块", "代码块颜色、字体和空间。", ["markdown", "codeBlock"], ["textColor", "background", "fontSize", "lineHeight"]),
  group("markdown-table", "markdown", "表格", "表格文字、边框、表头和交替行。", ["markdown", "table"], ["textColor", "borderColor", "headerBackground", "alternateBackground"]),
  group("markdown-divider", "markdown", "分隔线", "分隔线颜色、粗细和间距。", ["markdown", "divider"]),
  group("markdown-image", "markdown", "图片", "图片边框、圆角和上下间距。", ["markdown", "image"]),

  group("terminal", "terminal", "基础色彩", "终端背景、文字、光标和选区。", ["terminal"]),
  group("ansi", "terminal", "ANSI 16 色", "标准色与高亮色调色板。", ["ansi"]),

  group("motion-duration", "motion", "持续时间", "界面反馈、面板和布局变化的时长。", ["motion", "duration"]),
  group("motion-ease", "motion", "缓动曲线", "标准、强调、退出和线性缓动。", ["motion", "ease"]),
  group("motion-distance", "motion", "位移距离", "控件、面板和视图进出场位移。", ["motion", "distance"]),
  group("motion-stagger", "motion", "错峰", "按钮和列表项目依次出现的间隔。", ["motion", "stagger"]),
  group("motion-canvas", "motion", "画布反馈", "创建、选中、高亮和靠近反馈。", ["motion", "canvas"], ["createScale", "selectedScale", "highlightDuration", "proximityRadiusPx", "proximityMaxScale", "proximityDuration"]),

  group("diagnostics", "diagnostics", "可读性阈值", "编译主题时使用的文字、焦点和选区对比度阈值。", ["diagnostics"])
];

function group(
  id: string,
  category: ThemeTokenGroupDefinition["category"],
  title: string,
  description: string,
  path: readonly string[],
  commonKeys?: readonly string[],
  hiddenKeys?: readonly string[]
): ThemeTokenGroupDefinition {
  return { id, category, title, description, path, commonKeys, hiddenKeys };
}

const TOKEN_LABELS: Record<string, string> = {
  background: "背景",
  foreground: "文字",
  icon: "图标颜色",
  card: "面板",
  popover: "浮层",
  primary: "主强调色",
  secondary: "次级背景",
  muted: "弱背景",
  mutedForeground: "弱文字",
  accent: "轻强调",
  accentForeground: "强调文字",
  destructive: "危险状态",
  border: "边框",
  surface: "表面",
  nodeStroke: "节点描边",
  nodeText: "节点文字",
  edge: "连线",
  edgeText: "连线文字",
  labelStroke: "标签描边",
  connectionInvalid: "非法连接",
  previewInvalid: "无效预览",
  nodeFillSaturation: "节点填色饱和度",
  nodeFillLuminanceSteps: "节点明度阶数",
  previewShadowOpacity: "预览阴影透明度",
  line: "源码分隔线",
  gridDot: "渲染网格点",
  familySans: "无衬线字体",
  familyMono: "等宽字体",
  familyBody: "正文字体",
  familyHeading: "标题字体",
  familyCode: "代码字体",
  sizeUiXs: "极小界面字号",
  sizeUiSm: "界面字号",
  sizeNode: "节点字号",
  sizeEdgeLabel: "连线标签字号",
  sizeSource: "源码字号",
  sizeTerminal: "终端字号",
  weightRegular: "常规字重",
  weightMedium: "中等字重",
  weightBold: "粗体字重",
  lineHeightNode: "节点行高",
  lineHeightEdgeLabel: "连线标签行高",
  lineHeightSource: "源码行高",
  lineHeightTerminal: "终端行高",
  letterSpacing: "字距",
  panelPadding: "面板内边距",
  panelHeaderHeight: "面板标题高度",
  panelFooterHeight: "面板底栏高度",
  controlGap: "控件间距",
  controlPaddingX: "控件横向内边距",
  controlPaddingY: "控件纵向内边距",
  iconButtonSize: "图标按钮尺寸",
  nodePaddingX: "节点横向内边距",
  nodePaddingY: "节点纵向内边距",
  nodeMinChars: "节点最小字符",
  nodeMaxChars: "节点最大字符",
  nodeMaxLines: "节点最大行数",
  gridMinorStep: "小格步长",
  gridMajorEvery: "主格倍率",
  app: "应用圆角",
  controlSm: "小控件圆角",
  controlMd: "中控件圆角",
  controlLg: "大控件圆角",
  canvasNode: "节点圆角",
  edgeLabel: "标签圆角",
  polygonCorner: "多边形圆角",
  subgraphTitle: "分组标题圆角",
  node: "节点线宽",
  nodeEmphasized: "节点强调线宽",
  edgeThick: "粗连线宽",
  edgeDotted: "点线间隔",
  overlay: "覆盖线宽",
  anchor: "锚点线宽",
  selectionDash: "选择框虚线",
  connectionDraftDash: "连接草稿虚线",
  centerGuideDash: "居中引导虚线",
  subgraphDash: "分组虚线",
  sizeSm: "小图标尺寸",
  sizeButton: "按钮图标尺寸",
  strokeWidth: "图标描边",
  buttonHeightSm: "小按钮高度",
  buttonHeightMd: "中按钮高度",
  anchorRadius: "锚点半径",
  endpointRadius: "端点半径",
  edgeHitStrokeWidth: "连线命中宽度",
  pointerLength: "箭头长度",
  pointerWidth: "箭头宽度",
  parallelEdgeSpacing: "平行连线间距",
  edgeCurveSegments: "曲线采样段数",
  endpointMarkerRadius: "端点标记半径",
  gridMinorAlpha: "小格透明度",
  gridMajorAlpha: "主格透明度",
  gridSuperAlpha: "远景透明度",
  gridMaxDots: "网格点上限",
  gridMinorVisibleScale: "小格显示缩放",
  gridMajorVisibleScale: "主格显示缩放",
  gridMinorRadiusPx: "小格点半径",
  gridMajorRadiusPx: "主格点半径",
  gridSuperRadiusPx: "远景点半径",
  paddingX: "横向内边距",
  paddingY: "纵向内边距",
  paddingTop: "顶部内边距",
  paddingBottom: "底部内边距",
  titleHeight: "标题高度",
  titleInsetX: "标题横向缩进",
  titleInsetTop: "标题顶部缩进",
  titlePaddingX: "标题横向内边距",
  titleFontSize: "标题字号",
  titleFontWeight: "标题字重",
  minWidth: "最小宽度",
  minHeight: "最小高度",
  fallbackGap: "回退间距",
  fillOpacity: "填充透明度",
  minChars: "最小字符",
  maxChars: "最大字符",
  height: "高度",
  fontSize: "字号",
  lineHeight: "行高",
  color: "颜色",
  fontWeight: "字重",
  paragraphSpacing: "段落间距",
  marginTop: "顶部间距",
  marginBottom: "底部间距",
  hoverColor: "悬停颜色",
  underlineThickness: "下划线粗细",
  underlineOffset: "下划线偏移",
  strongWeight: "粗体字重",
  markerColor: "标记颜色",
  indent: "缩进",
  itemSpacing: "条目间距",
  blockSpacing: "列表块间距",
  textColor: "文字颜色",
  borderColor: "边线颜色",
  marginY: "上下间距",
  borderWidth: "边线宽度",
  radius: "圆角",
  headerBackground: "表头背景",
  alternateBackground: "交替行背景",
  cellPaddingX: "单元格横向内边距",
  cellPaddingY: "单元格纵向内边距",
  thickness: "粗细",
  cursor: "光标",
  cursorAccent: "光标文字",
  selectionBackground: "选区背景",
  selectionForeground: "选区文字",
  black: "黑",
  red: "红",
  green: "绿",
  yellow: "黄",
  blue: "蓝",
  magenta: "品红",
  cyan: "青",
  white: "白",
  brightBlack: "亮黑",
  brightRed: "亮红",
  brightGreen: "亮绿",
  brightYellow: "亮黄",
  brightBlue: "亮蓝",
  brightMagenta: "亮品红",
  brightCyan: "亮青",
  brightWhite: "亮白",
  fast: "快速反馈",
  base: "基础反馈",
  slow: "面板反馈",
  layout: "布局变化",
  standard: "标准缓动",
  emphasized: "强调缓动",
  exit: "退出缓动",
  linear: "线性缓动",
  chrome: "控件位移",
  panel: "面板位移",
  viewport: "视图位移",
  button: "按钮错峰",
  list: "列表错峰",
  createScale: "新建缩放",
  selectedScale: "选中缩放",
  highlightDuration: "高亮时长",
  maxAnimatedItems: "动画项目上限",
  proximityRadiusPx: "靠近反馈半径",
  proximityMaxScale: "靠近最大缩放",
  proximityDuration: "靠近反馈时长",
  minTextContrast: "文字最小对比度",
  minFocusContrast: "焦点最小对比度",
  minSelectionContrast: "选区最小对比度"
};

export function themeTokenLabel(key: string) {
  return TOKEN_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function themeTokenNumberSpec(path: readonly string[], value: number) {
  const key = path.at(-1) || "";
  const joined = path.join(".");
  const exact = EXACT_THEME_NUMBER_SPECS[joined];
  if (exact) return exact;
  const min = 0;
  let max = Math.max(10, Math.ceil(value * 2));
  let step = 1;
  const unit = "px";

  if (/Weight$/.test(key) || key === "fontWeight" || key === "strongWeight") return { min: 300, max: 900, step: 50, unit: "" };
  if (/Alpha$|Opacity$/.test(key)) return { min: 0, max: 1, step: 0.01, unit: "" };
  if (/Scale$/.test(key)) return { min: key === "createScale" ? 0.7 : 0.05, max: key.includes("proximity") ? 3 : 2, step: 0.01, unit: "" };
  if (joined.includes("motion.duration") || key.endsWith("Duration")) return { min: 0, max: key === "highlightDuration" ? 1.8 : 1.6, step: 0.01, unit: "s" };
  if (joined.includes("motion.stagger")) return { min: 0, max: 0.16, step: 0.005, unit: "s" };
  if (joined.includes("diagnostics")) return { min: 1, max: 7, step: 0.1, unit: "" };
  if (/letterSpacing$/.test(key)) return { min: joined.includes("markdown") ? -3 : 0, max: 6, step: 0.1, unit: "px" };
  if (/fontSize$/.test(key) || /^size/.test(key)) return { min: 8, max: key === "fontSize" && joined.includes("heading") ? 72 : 32, step: 1, unit: "px" };
  if (/lineHeight/.test(key)) return { min: 10, max: joined.includes("heading") ? 88 : 52, step: 1, unit: "px" };
  if (/radius|Radius|Corner/.test(key)) return { min: 0, max: key.includes("grid") ? 5 : 48, step: key.includes("grid") ? 0.1 : 1, unit: "px" };
  if (/StrokeWidth|strokeWidth|borderWidth|thickness|Thickness/.test(key) || ["node", "nodeEmphasized", "edge", "edgeThick", "overlay", "anchor"].includes(key)) return { min: 0, max: 14, step: 0.5, unit: "px" };
  if (/Alpha|Opacity/.test(key)) return { min: 0, max: 1, step: 0.01, unit: "" };
  if (/VisibleScale/.test(key)) return { min: 0.05, max: 2, step: 0.05, unit: "×" };
  if (key === "nodeFillLuminanceSteps") return { min: 2, max: 256, step: 1, unit: "" };
  if (key === "edgeCurveSegments") return { min: 12, max: 240, step: 1, unit: "段" };
  if (key === "gridMaxDots") return { min: 800, max: 20000, step: 100, unit: "" };
  if (key === "maxAnimatedItems") return { min: 0, max: 400, step: 10, unit: "" };
  if (/Chars$|Lines$|Every$/.test(key)) return { min: 1, max: key.includes("Max") ? 60 : 24, step: 1, unit: "" };
  if (/fontWeight|Weight/.test(key)) return { min: 300, max: 900, step: 50, unit: "" };
  if (key === "fillOpacity") return { min: 0, max: 1, step: 0.01, unit: "" };
  if (key === "proximityRadiusPx") return { min: 0, max: 600, step: 10, unit: "px" };
  if (/minWidth|maxWidth|padding|Padding|margin|Margin|Spacing|Gap|Height|Size|Length|Width|Offset|indent|Indent|Step/.test(key)) {
    max = /minWidth/.test(key) ? 520 : /Height/.test(key) ? 360 : 120;
  }

  if (!Number.isInteger(value)) step = 0.1;
  return { min, max, step, unit };
}

const EXACT_THEME_NUMBER_SPECS: Record<string, { min: number; max: number; step: number; unit: string }> = {
  "canvasAppearance.nodeFillSaturation": spec(0, 1, 0.05, ""),
  "canvasAppearance.nodeFillLuminanceSteps": spec(2, 256, 1, ""),
  "canvasAppearance.previewShadowOpacity": spec(0, 1, 0.01, ""),
  "radius.app": spec(0, 16, 1),
  "radius.controlSm": spec(0, 16, 1),
  "radius.controlMd": spec(0, 20, 1),
  "radius.controlLg": spec(0, 24, 1),
  "radius.canvasNode": spec(0, 48, 1),
  "radius.edgeLabel": spec(0, 24, 1),
  "radius.polygonCorner": spec(0, 24, 1),
  "radius.subgraphTitle": spec(0, 24, 1),
  "canvasInteraction.parallelEdgeSpacing": spec(0, 48, 1),
  "canvasInteraction.edgeCurveSegments": spec(12, 240, 1, "段"),
  "canvasInteraction.gridMaxDots": spec(800, 20000, 100, ""),
  "canvasInteraction.gridMinorVisibleScale": spec(0.1, 2, 0.05, "×"),
  "canvasInteraction.gridMajorVisibleScale": spec(0.05, 1, 0.05, "×"),
  "canvasInteraction.gridMinorRadiusPx": spec(0.2, 3, 0.1),
  "canvasInteraction.gridMajorRadiusPx": spec(0.2, 4, 0.1),
  "canvasInteraction.gridSuperRadiusPx": spec(0.2, 5, 0.1),
  "motion.duration.fast": spec(0, 0.4, 0.01, "s"),
  "motion.duration.base": spec(0, 0.8, 0.01, "s"),
  "motion.duration.slow": spec(0, 1.2, 0.01, "s"),
  "motion.duration.layout": spec(0, 1.6, 0.01, "s"),
  "motion.distance.chrome": spec(0, 32, 1),
  "motion.distance.panel": spec(0, 96, 1),
  "motion.distance.viewport": spec(0, 320, 4),
  "motion.stagger.button": spec(0, 0.16, 0.005, "s"),
  "motion.stagger.list": spec(0, 0.16, 0.005, "s"),
  "motion.canvas.createScale": spec(0.7, 1, 0.01, "×"),
  "motion.canvas.selectedScale": spec(1, 1.08, 0.005, "×"),
  "motion.canvas.highlightDuration": spec(0, 1.8, 0.01, "s"),
  "motion.canvas.maxAnimatedItems": spec(0, 400, 10, ""),
  "motion.canvas.proximityRadiusPx": spec(0, 600, 10),
  "motion.canvas.proximityMaxScale": spec(1, 3, 0.01, "×"),
  "motion.canvas.proximityDuration": spec(0, 0.8, 0.01, "s")
};

function spec(min: number, max: number, step: number, unit = "px") {
  return { min, max, step, unit };
}
