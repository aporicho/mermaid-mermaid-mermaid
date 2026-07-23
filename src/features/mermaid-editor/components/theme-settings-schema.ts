import {
  DEFAULT_EDITOR_THEME,
  MARKDOWN_ELEMENT_DEFINITIONS,
  MARKDOWN_TOKEN_DEFINITIONS,
  type EditorTheme,
  type EditorTypographyTokens,
  type MarkdownTokenFieldKind
} from "@/features/mermaid-editor/lib/editor-theme";

export type ThemeSettingsCategoryId = "library" | "interface" | "agent" | "canvas" | "specialNode" | "markdown" | "source" | "terminal" | "motion" | "diagnostics";

export type AppearanceTokenState = "editable" | "derived" | "fixed" | "legacy";
export type AppearanceTokenLevel = "common" | "advanced";
export type AppearanceTokenConsumer = "css" | "konva" | "mermaid-svg" | "terminal" | "motion" | "diagnostics" | "theme-registry";
export type AppearanceTokenControlKind = "color" | "font" | "number" | "text" | "css-border-style" | "canvas-stroke-style" | "dash";

export type AppearanceTokenDefinition = {
  path: readonly string[];
  label: string;
  category: ThemeSettingsCategoryId;
  groupId: string;
  hierarchy: readonly string[];
  state: AppearanceTokenState;
  level: AppearanceTokenLevel;
  consumer: AppearanceTokenConsumer;
  control: {
    kind: AppearanceTokenControlKind;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
  };
};

export type ThemeTokenGroupDefinition = {
  id: string;
  category: Exclude<ThemeSettingsCategoryId, "library">;
  title: string;
  description: string;
  path: readonly string[];
  commonKeys?: readonly string[];
  hiddenKeys?: readonly string[];
  level?: "common" | "advanced";
  consumer: AppearanceTokenConsumer;
  typographyGroup?: keyof EditorTypographyTokens;
};

export const THEME_SETTINGS_CATEGORIES = [
  { id: "library", label: "主题库", description: "选择预设或从当前外观开始定制" },
  { id: "interface", label: "界面", description: "应用框架、文字、密度与控件" },
  { id: "agent", label: "Agent", description: "对话、消息、工具过程与输入器" },
  { id: "canvas", label: "画布", description: "节点、连线、分组、网格与交互" },
  { id: "specialNode", label: "特殊节点", description: "链接、Markdown、图片和表格节点" },
  { id: "markdown", label: "Markdown", description: "集中设置全部 Markdown 排版、色彩、间距和富文本外观" },
  { id: "source", label: "源码", description: "源码编辑器、分隔线和诊断文字" },
  { id: "terminal", label: "终端", description: "终端基础色和 ANSI 调色板" },
  { id: "motion", label: "动效", description: "时长、缓动、位移与画布反馈" },
  { id: "diagnostics", label: "诊断", description: "可读性阈值与主题问题" }
] as const satisfies readonly { id: ThemeSettingsCategoryId; label: string; description: string }[];

export const THEME_TOKEN_GROUPS: readonly ThemeTokenGroupDefinition[] = [
  group("interface-colors", "interface", "基础色彩", ["interface", "colors"], "css"),
  group("interface-surface", "interface", "边框与焦点", ["interface", "surface"], "css"),
  group("interface-state", "interface", "交互状态", ["interface", "state"], "css"),
  group("interface-radius", "interface", "圆角", ["interface", "radius"], "css"),
  group("interface-shadow", "interface", "阴影", ["interface", "shadow"], "css"),
  group("interface-spacing", "interface", "间距与尺寸", ["interface", "spacing"], "css"),
  group("interface-icon", "interface", "图标", ["interface", "icon"], "css", { hiddenKeys: ["family"] }),
  group("interface-scrollbar", "interface", "滚动条", ["interface", "scrollbar"], "css"),
  typographyGroup("typography-interface", "interface", "界面文字", "interface", "css"),

  group("agent-layout", "agent", "布局", ["agent", "layout"], "css"),
  group("agent-typography", "agent", "文字", ["agent", "typography"], "css"),
  group("agent-message", "agent", "消息", ["agent", "message"], "css"),
  group("agent-composer", "agent", "输入器", ["agent", "composer"], "css"),
  group("agent-tool", "agent", "工具过程", ["agent", "tool"], "css"),
  group("agent-thinking", "agent", "思考过程", ["agent", "thinking"], "css"),

  group("canvas-surface", "canvas", "画布表面", ["canvas", "surface"], "konva"),
  group("canvas-grid", "canvas", "网格", ["canvas", "grid"], "konva", { level: "advanced" }),
  group("canvas-node", "canvas", "普通节点", ["canvas", "ordinaryNode"], "konva"),
  group("canvas-edge", "canvas", "连线与箭头", ["canvas", "edge"], "konva"),
  group("canvas-edge-label", "canvas", "连线标签", ["canvas", "edgeLabel"], "konva"),
  group("canvas-group", "canvas", "组", ["canvas", "group"], "konva"),
  group("canvas-overlay", "canvas", "选择与辅助", ["canvas", "overlay"], "konva"),
  group("canvas-action-badge", "canvas", "节点操作徽标", ["canvas", "actionBadge"], "konva"),
  group("canvas-mermaid-svg", "canvas", "Mermaid SVG", ["canvas", "mermaidSvg"], "mermaid-svg"),
  typographyGroup("typography-canvas", "canvas", "画布文字", "canvas", "konva"),
  typographyGroup("typography-mermaid", "canvas", "Mermaid SVG 文字", "mermaid", "mermaid-svg"),

  group("special-node-shared", "specialNode", "共享语义", ["specialNode", "shared"], "konva"),
  group("special-node-link-card", "specialNode", "链接卡片", ["specialNode", "linkCard"], "konva"),
  group("special-node-markdown-document", "specialNode", "Markdown 文档", ["specialNode", "markdownDocument"], "konva"),
  group("special-node-image", "specialNode", "图片节点", ["specialNode", "image"], "konva"),
  group("special-node-table", "specialNode", "CSV 表格", ["specialNode", "table"], "konva"),
  typographyGroup("typography-link-card", "specialNode", "链接卡片文字", "linkCard", "konva"),
  typographyGroup("typography-markdown-card", "specialNode", "Markdown 卡片文字", "markdownCard", "konva"),
  typographyGroup("typography-table-node", "specialNode", "CSV 表格文字", "tableNode", "konva"),

  group("source-appearance", "source", "源码外观", ["source"], "css"),
  typographyGroup("typography-source", "source", "源码与诊断文字", "source", "css"),

  group("terminal-colors", "terminal", "基础色彩", ["terminal"], "terminal"),
  group("terminal-ansi", "terminal", "ANSI 16 色", ["ansi"], "terminal"),
  typographyGroup("typography-terminal", "terminal", "终端文字", "terminal", "terminal"),

  group("motion-duration", "motion", "持续时间", ["motion", "duration"], "motion"),
  group("motion-ease", "motion", "缓动曲线", ["motion", "ease"], "motion"),
  group("motion-distance", "motion", "位移距离", ["motion", "distance"], "motion"),
  group("motion-stagger", "motion", "错峰", ["motion", "stagger"], "motion"),
  group("motion-canvas", "motion", "画布反馈", ["motion", "canvas"], "motion"),

  group("diagnostics", "diagnostics", "可读性阈值", ["diagnostics"], "diagnostics")
];

function group(
  id: string,
  category: ThemeTokenGroupDefinition["category"],
  title: string,
  path: readonly string[],
  consumer: AppearanceTokenConsumer,
  options: Pick<ThemeTokenGroupDefinition, "level" | "hiddenKeys"> = {}
): ThemeTokenGroupDefinition {
  return { id, category, title, description: "", path, consumer, ...options };
}

function typographyGroup(
  id: string,
  category: ThemeTokenGroupDefinition["category"],
  title: string,
  typography: keyof EditorTypographyTokens,
  consumer: AppearanceTokenConsumer
): ThemeTokenGroupDefinition {
  return { id, category, title, description: "", path: ["typography", typography], consumer, typographyGroup: typography };
}

const TOKEN_LABELS: Record<string, string> = {
  cardForeground: "面板文字",
  family: "字体",
  size: "尺寸",
  blur: "模糊半径",
  popoverForeground: "浮层文字",
  primaryForeground: "主强调文字",
  secondaryForeground: "次级文字",
  destructiveForeground: "危险状态文字",
  success: "成功状态",
  successForeground: "成功状态文字",
  warning: "警告状态",
  warningForeground: "警告状态文字",
  info: "信息状态",
  infoForeground: "信息状态文字",
  input: "输入边框",
  focusRing: "焦点环",
  borderStyle: "边框样式",
  style: "线条样式",
  customDash: "自定义虚线",
  hoverOpacity: "悬停透明度",
  pressedOpacity: "按下透明度",
  selectedOpacity: "选中透明度",
  disabledOpacity: "禁用透明度",
  offsetX: "横向偏移",
  offsetY: "纵向偏移",
  minThumbLength: "滑块最小长度",
  opacity: "透明度",
  activeOpacity: "活动透明度",
  renderBackground: "渲染背景",
  hoverBorderColor: "悬停边框",
  selectedBorderColor: "选中边框",
  invalidBorderColor: "非法状态边框",
  emphasizedBorderWidth: "强调边框宽度",
  highlightBorderBoost: "高亮附加线宽",
  fillSaturation: "填色饱和度",
  fillLuminanceSteps: "填色明度阶数",
  roundedRadius: "圆角节点圆角",
  polygonRadius: "多边形圆角",
  forkRadius: "细长节点圆角",
  dragShadow: "拖动阴影",
  selectedColor: "选中颜色",
  invalidColor: "非法颜色",
  thickWidth: "粗线宽度",
  dottedWidth: "点线宽度",
  emphasizedWidth: "强调线宽",
  dottedDash: "点线间隔",
  invisibleOpacity: "隐藏透明度",
  invalidPreviewOpacity: "非法预览透明度",
  hitStrokeWidth: "命中宽度",
  parallelSpacing: "平行连线间距",
  curveSegments: "曲线采样段数",
  backgroundOpacity: "背景透明度",
  anchorCornerScale: "组锚点缩放",
  anchorCornerOpacity: "组锚点透明度",
  strokeColor: "描边颜色",
  validColor: "有效颜色",
  invalidOpacity: "非法状态透明度",
  strokeStyle: "描边样式",
  centerColor: "居中参考线",
  edgeColor: "边缘参考线",
  centerStyle: "居中参考线样式",
  fillColor: "填充颜色",
  targetColor: "目标颜色",
  activeRadiusBoost: "活动半径增量",
  insetX: "横向内缩",
  insetY: "纵向内缩",
  insetTop: "顶部内缩",
  errorColor: "错误颜色",
  editingBorderColor: "编辑态边框",
  errorBorderColor: "错误态边框",
  contentPadding: "内容内边距",
  headerTextColor: "表头文字",
  bodyTextColor: "表体文字",
  hoverCellBackground: "单元格悬停背景",
  selectedCellBackground: "选中单元格背景",
  placeholderGap: "占位状态间距",
  taskCheckboxPlaceholderWidth: "任务框占位宽度",
  primaryColor: "主节点背景",
  primaryTextColor: "主节点文字",
  primaryBorderColor: "主节点边框",
  secondaryColor: "次级节点背景",
  secondaryTextColor: "次级节点文字",
  tertiaryColor: "三级节点背景",
  tertiaryTextColor: "三级节点文字",
  lineColor: "图表连线",
  edgeLabelBackground: "关系标签背景",
  clusterBackground: "分组背景",
  clusterBorderColor: "分组边框",
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
  borderWidth: "边框宽度",
  dividerWidth: "分隔线宽度",
  focusRingWidth: "焦点环宽度",
  backdropBlur: "背景模糊",
  line: "源码分隔线",
  letterSpacing: "字距",
  panelPadding: "面板内边距",
  panelHeaderHeight: "面板标题高度",
  panelFooterHeight: "面板底栏高度",
  controlGap: "控件间距",
  controlPaddingX: "控件横向内边距",
  controlPaddingY: "控件纵向内边距",
  iconButtonSize: "图标按钮尺寸",
  app: "应用圆角",
  controlSm: "小控件圆角",
  controlMd: "中控件圆角",
  controlLg: "大控件圆角",
  sizeSm: "小图标尺寸",
  sizeButton: "按钮图标尺寸",
  strokeWidth: "图标描边",
  buttonHeightSm: "小按钮高度",
  buttonHeightMd: "中按钮高度",
  endpointRadius: "端点半径",
  pointerLength: "箭头长度",
  pointerWidth: "箭头宽度",
  endpointMarkerRadius: "端点标记半径",
  paddingX: "横向内边距",
  paddingY: "纵向内边距",
  paddingTop: "顶部内边距",
  paddingBottom: "底部内边距",
  titleHeight: "标题高度",
  minWidth: "最小宽度",
  minHeight: "最小高度",
  maxHeight: "最大高度",
  fallbackGap: "回退间距",
  fillOpacity: "填充透明度",
  minChars: "最小字符",
  maxChars: "最大字符",
  maxLines: "最大行数",
  height: "高度",
  fontSize: "字号",
  lineHeight: "行高",
  color: "颜色",
  fontWeight: "字重",
  paragraphSpacing: "段落间距",
  headingStackSpacing: "连续标题最小间距",
  listMarkerWidth: "列表标记栏宽度",
  listMarkerGap: "标记与正文间距",
  marginTop: "顶部间距",
  marginBottom: "底部间距",
  hoverColor: "悬停颜色",
  underlineThickness: "下划线粗细",
  underlineOffset: "下划线偏移",
  strongWeight: "粗体字重",
  markerColor: "标记颜色",
  indent: "嵌套层级缩进",
  itemSpacing: "条目间距",
  textColor: "文字颜色",
  borderColor: "边线颜色",
  radius: "圆角",
  headerBackground: "表头背景",
  bodyBackground: "表体背景",
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
  minorStep: "小格步长",
  majorEvery: "主格倍率",
  minorAlpha: "小格透明度",
  majorAlpha: "主格透明度",
  superAlpha: "远景透明度",
  minorRadiusPx: "小格点半径",
  majorRadiusPx: "主格点半径",
  superRadiusPx: "远景点半径",
  minorVisibleScale: "小格显示缩放",
  majorVisibleScale: "主格显示缩放",
  maxDots: "网格点上限",
  proximityRadiusPx: "靠近反馈半径",
  proximityMaxScale: "靠近最大缩放",
  proximityDuration: "靠近反馈时长",
  minTextContrast: "文字最小对比度",
  minFocusContrast: "焦点最小对比度",
  minSelectionContrast: "选区最小对比度",
  mutedTextColor: "弱文字颜色",
  accentColor: "强调颜色",
  shadowColor: "阴影颜色",
  shadowBlur: "阴影模糊",
  shadowOffsetY: "阴影纵向偏移",
  width: "宽度",
  inset: "内缩",
  coverBackground: "封面背景",
  coverBorderColor: "封面边框",
  coverBorderWidth: "封面边框宽度",
  coverRadius: "封面圆角",
  coverFallbackHeight: "默认封面高度",
  coverMinHeight: "封面最小高度",
  coverMaxHeight: "封面最大高度",
  contentPaddingX: "内容横向内边距",
  providerColor: "来源颜色",
  brandColor: "品牌颜色",
  providerGap: "来源间距",
  titleGap: "标题间距",
  badgeSize: "徽标尺寸",
  badgeBackground: "徽标背景",
  badgeErrorBackground: "错误徽标背景",
  badgeColor: "徽标文字",
  badgeErrorColor: "错误徽标文字",
  badgeOpacity: "徽标背景透明度",
  badgeErrorOpacity: "错误徽标透明度",
  badgeRadius: "徽标圆角",
  pathGap: "路径间距",
  separatorColor: "分隔线颜色",
  separatorWidth: "分隔线宽度",
  separatorOpacity: "分隔线透明度",
  excerptGap: "摘要间距",
  pathOpacity: "路径透明度",
  excerptOpacity: "摘要透明度",
  placeholderOpacity: "占位文字透明度",
  interactionBorderColor: "交互边框",
  interactionBorderWidth: "交互边框宽度",
  dividerColor: "分隔线颜色",
  selectedCellFill: "选中单元格背景",
  selectedCellStroke: "选中单元格边框",
  selectedCellStrokeWidth: "选中单元格边框宽度",
  minColumnWidth: "最小列宽",
  minRowHeight: "最小行高",
  resizeHandleWidth: "调整手柄宽度",
  sidebarWidth: "侧栏宽度",
  transcriptMaxWidth: "对话最大宽度",
  composerMaxWidth: "输入器最大宽度",
  contentPaddingY: "内容纵向内边距",
  turnGap: "对话轮次间距",
  partGap: "消息内容间距",
  metadataForeground: "元信息文字",
  placeholder: "占位文字",
  errorForeground: "错误文字",
  rowGap: "行间距"
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
  "interface.radius.app": spec(0, 16, 1),
  "interface.radius.controlSm": spec(0, 16, 1),
  "interface.radius.controlMd": spec(0, 20, 1),
  "interface.radius.controlLg": spec(0, 24, 1),
  "interface.surface.opacity": spec(0, 1, 0.01, ""),
  "interface.surface.backdropBlur": spec(0, 48, 1),
  "canvas.ordinaryNode.fillSaturation": spec(0, 1, 0.05, ""),
  "canvas.ordinaryNode.fillLuminanceSteps": spec(2, 256, 1, ""),
  "canvas.ordinaryNode.radius": spec(0, 48, 1),
  "canvas.ordinaryNode.roundedRadius": spec(0, 48, 1),
  "canvas.ordinaryNode.polygonRadius": spec(0, 24, 1),
  "canvas.ordinaryNode.forkRadius": spec(0, 24, 1),
  "canvas.edge.parallelSpacing": spec(0, 48, 1),
  "canvas.edge.curveSegments": spec(12, 240, 1, "段"),
  "canvas.grid.maxDots": spec(800, 20000, 100, ""),
  "canvas.grid.minorVisibleScale": spec(0.1, 2, 0.05, "×"),
  "canvas.grid.majorVisibleScale": spec(0.05, 1, 0.05, "×"),
  "canvas.grid.minorRadiusPx": spec(0.2, 3, 0.1),
  "canvas.grid.majorRadiusPx": spec(0.2, 4, 0.1),
  "canvas.grid.superRadiusPx": spec(0.2, 5, 0.1),
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

const FIXED_THEME_METADATA: readonly AppearanceTokenDefinition[] = [
  fixedToken("version", "主题版本"),
  fixedToken("id", "主题标识"),
  fixedToken("name", "主题名称"),
  fixedToken("description", "主题说明")
];

const GROUP_TOKEN_DEFINITIONS = THEME_TOKEN_GROUPS.flatMap((definition) => {
  const value = valueAtPath(DEFAULT_EDITOR_THEME, definition.path);
  return flattenTokenLeaves(value).map(({ path, value: leafValue }) => {
    const fullPath = [...definition.path, ...path];
    const key = fullPath.at(-1) || "";
    const hidden = definition.hiddenKeys?.includes(path[0] || "") ?? false;
    return tokenDefinition({
      path: fullPath,
      label: themeTokenLabel(key),
      category: definition.category,
      groupId: definition.id,
      hierarchy: [definition.category, definition.id, ...path.slice(0, -1)],
      state: hidden ? "fixed" : "editable",
      level: definition.level ?? technicalLevel(fullPath),
      consumer: definition.consumer,
      control: controlFor(fullPath, leafValue)
    });
  });
});

const MARKDOWN_APPEARANCE_TOKEN_DEFINITIONS = MARKDOWN_TOKEN_DEFINITIONS.map((definition) => {
  const element = MARKDOWN_ELEMENT_DEFINITIONS.find((candidate) => candidate.path.every((part, index) => definition.path[index] === part));
  const value = valueAtPath(DEFAULT_EDITOR_THEME.markdown, definition.path);
  return tokenDefinition({
    path: ["markdown", ...definition.path],
    label: definition.label,
    category: "markdown",
    groupId: element?.id ?? "markdown",
    hierarchy: ["markdown", element?.category ?? "base", element?.id ?? "markdown", definition.section],
    state: "editable",
    level: "common",
    consumer: "css",
    control: markdownControl(definition.kind, definition, value)
  });
});

const FIXED_CANVAS_DOCUMENT_TYPOGRAPHY = flattenTokenLeaves(DEFAULT_EDITOR_THEME.typography.canvasDocument).map(({ path, value }) => {
  const fullPath = ["typography", "canvasDocument", ...path];
  return tokenDefinition({
    path: fullPath,
    label: themeTokenLabel(fullPath.at(-1) || ""),
    category: "canvas",
    groupId: "canvas-document-fixed",
    hierarchy: ["canvas", "canvas-document-fixed", ...path.slice(0, -1)],
    state: "fixed",
    level: "advanced",
    consumer: "konva",
    control: controlFor(fullPath, value)
  });
});

/**
 * Every canonical v12 appearance leaf has exactly one registry entry. The panel,
 * search and contract tests all consume this registry instead of maintaining
 * separate path lists.
 */
export const APPEARANCE_TOKEN_DEFINITIONS: readonly AppearanceTokenDefinition[] = [
  ...FIXED_THEME_METADATA,
  ...GROUP_TOKEN_DEFINITIONS,
  ...MARKDOWN_APPEARANCE_TOKEN_DEFINITIONS,
  ...FIXED_CANVAS_DOCUMENT_TYPOGRAPHY
];

export function appearanceTokenDefinition(path: readonly string[]) {
  const key = path.join(".");
  return APPEARANCE_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === key);
}

function fixedToken(key: "version" | "id" | "name" | "description", label: string): AppearanceTokenDefinition {
  return tokenDefinition({
    path: [key],
    label,
    category: "library",
    groupId: "theme-metadata",
    hierarchy: ["library", "theme-metadata"],
    state: "fixed",
    level: "advanced",
    consumer: "theme-registry",
    control: { kind: key === "version" ? "number" : "text" }
  });
}

function tokenDefinition(definition: AppearanceTokenDefinition): AppearanceTokenDefinition {
  return definition;
}

function markdownControl(
  kind: MarkdownTokenFieldKind,
  definition: { min?: number; max?: number; step?: number; unit?: string },
  value: unknown
): AppearanceTokenDefinition["control"] {
  if (kind === "css-border-style") return { kind };
  if (kind === "font" || kind === "color") return { kind };
  const fallback = typeof value === "number" ? themeTokenNumberSpec([], value) : undefined;
  return { kind: "number", min: definition.min ?? fallback?.min, max: definition.max ?? fallback?.max, step: definition.step ?? fallback?.step, unit: definition.unit ?? fallback?.unit };
}

function controlFor(path: readonly string[], value: unknown): AppearanceTokenDefinition["control"] {
  const key = path.at(-1) || "";
  if (Array.isArray(value)) return { kind: "dash" };
  if (typeof value === "number") return { kind: "number", ...themeTokenNumberSpec(path, value) };
  if (key === "family") return { kind: "font" };
  if (key === "borderStyle" || key.endsWith("Style") || key === "style") {
    return { kind: path[0] === "interface" || path[0] === "agent" ? "css-border-style" : "canvas-stroke-style" };
  }
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return { kind: "color" };
  return { kind: "text" };
}

function technicalLevel(path: readonly string[]): AppearanceTokenLevel {
  const key = path.at(-1) || "";
  return /maxDots|VisibleScale|RadiusPx|curveSegments|hitStrokeWidth|parallelSpacing|maxAnimatedItems|proximity/.test(key) ? "advanced" : "common";
}

function flattenTokenLeaves(value: unknown, prefix: readonly string[] = []): { path: readonly string[]; value: unknown }[] {
  if (value === undefined) return [];
  if (Array.isArray(value) || value === null || typeof value !== "object") return [{ path: prefix, value }];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flattenTokenLeaves(child, [...prefix, key]));
}

function valueAtPath(value: unknown, path: readonly string[]) {
  return path.reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value);
}

// Compile-time anchor: the registry is intentionally tied to the canonical theme shape.
const _editorThemeShape: EditorTheme = DEFAULT_EDITOR_THEME;
void _editorThemeShape;
