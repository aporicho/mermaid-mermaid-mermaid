import type { EditorTheme, MarkdownThemeTokens } from "./types";

export type MarkdownTokenFieldKind = "color" | "font" | "number";
export type MarkdownTokenFieldSection = "typography" | "color" | "layout" | "border" | "state";
export type MarkdownElementCategory = "base" | "heading" | "inline" | "block";

export type MarkdownTokenDefault =
  | { kind: "literal"; value: string | number }
  | { kind: "theme"; path: readonly ["ui" | "font", string] };

export type MarkdownTokenDefinition = {
  path: readonly string[];
  label: string;
  kind: MarkdownTokenFieldKind;
  section: MarkdownTokenFieldSection;
  default: MarkdownTokenDefault;
  defaultSource: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export type MarkdownElementDefinition = {
  id: string;
  category: MarkdownElementCategory;
  title: string;
  description: string;
  path: readonly string[];
  monospace?: boolean;
};

type MarkdownDefaultThemeSource = Pick<EditorTheme, "ui" | "font">;
type TextDefaults = {
  fontFamily: MarkdownTokenDefault;
  fontSize: MarkdownTokenDefault;
  fontWeight: MarkdownTokenDefault;
  lineHeight: MarkdownTokenDefault;
  letterSpacing: MarkdownTokenDefault;
  color: MarkdownTokenDefault;
};

export const MARKDOWN_ELEMENT_CATEGORIES = [
  { id: "base", title: "基础", description: "正文与段落的基础阅读节奏。" },
  { id: "heading", title: "标题", description: "六级标题各自独立的完整外观。" },
  { id: "inline", title: "行内语义", description: "链接、强调、加粗、删除线和行内代码。" },
  { id: "block", title: "块级语义", description: "列表、引用、代码块、表格、分隔线和图片。" }
] as const;

export const MARKDOWN_ELEMENT_DEFINITIONS: readonly MarkdownElementDefinition[] = [
  element("body", "base", "正文与段落", "正文排版、颜色和段落间距。", ["body"]),
  ...(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((level, index) =>
    element(`heading-${level}`, "heading", `${["一", "二", "三", "四", "五", "六"][index]}级标题`, "标题排版、颜色和上下间距。", ["heading", level])
  ),
  element("link", "inline", "链接", "链接排版、默认/悬停颜色和下划线。", ["link"]),
  element("emphasis", "inline", "强调", "斜体强调文字的完整外观。", ["emphasis"]),
  element("strong", "inline", "加粗", "加粗文字的完整外观。", ["strong"]),
  element("strikethrough", "inline", "删除线", "删除线文字及装饰线外观。", ["strikethrough"]),
  element("inline-code", "inline", "行内代码", "行内代码排版、颜色和盒模型。", ["inlineCode"], true),
  element("list-unordered", "block", "无序列表", "无序列表文字、标记、缩进和间距。", ["list", "unordered"]),
  element("list-ordered", "block", "有序列表", "有序列表文字、编号、缩进和间距。", ["list", "ordered"]),
  element("list-task", "block", "任务列表", "任务列表文字、间距和复选框状态。", ["list", "task"]),
  element("blockquote", "block", "引用", "引用文字、背景、边线和空间。", ["blockquote"]),
  element("code-block", "block", "代码块", "代码块排版、颜色和盒模型。", ["codeBlock"], true),
  element("table", "block", "表格", "表格文字、边框、表头、统一表体和单元格空间。", ["table"]),
  element("divider", "block", "分隔线", "分隔线颜色、粗细和间距。", ["divider"]),
  element("image", "block", "图片", "图片边框、圆角和间距。", ["image"])
];

const sansBody = (colorDefault = theme("ui.foreground"), weight = theme("font.weightRegular")): TextDefaults => ({
  fontFamily: theme("font.familySans"),
  fontSize: literal(16),
  fontWeight: weight,
  lineHeight: literal(24),
  letterSpacing: theme("font.letterSpacing"),
  color: colorDefault
});

const TEXT_DEFAULTS: Record<string, TextDefaults> = {
  body: sansBody(),
  "heading-h1": headingDefaults(42, 50, "weightRegular"),
  "heading-h2": headingDefaults(36, 44, "weightRegular"),
  "heading-h3": headingDefaults(32, 40, "weightRegular"),
  "heading-h4": headingDefaults(28, 36, "weightMedium"),
  "heading-h5": headingDefaults(24, 32, "weightMedium"),
  "heading-h6": headingDefaults(18, 28, "weightBold"),
  link: sansBody(theme("ui.primary")),
  emphasis: sansBody(),
  strong: sansBody(theme("ui.foreground"), theme("font.weightBold")),
  strikethrough: sansBody(),
  "inline-code": codeDefaults(20, theme("ui.destructive")),
  "list-unordered": sansBody(),
  "list-ordered": sansBody(),
  "list-task": sansBody(),
  blockquote: sansBody(theme("ui.mutedForeground")),
  "code-block": codeDefaults(21, theme("ui.foreground")),
  table: sansBody()
};

const EXTRA_FIELDS: Record<string, readonly MarkdownTokenDefinition[]> = {
  body: [number("paragraphSpacing", "段落间距", "layout", literal(8), 0, 48)],
  "heading-h1": headingSpacing(32, 8),
  "heading-h2": headingSpacing(28, 8),
  "heading-h3": headingSpacing(24, 6),
  "heading-h4": headingSpacing(20, 6),
  "heading-h5": headingSpacing(16, 4),
  "heading-h6": headingSpacing(16, 4),
  link: [
    color("hoverColor", "悬停颜色", "state", theme("ui.accentForeground")),
    number("underlineThickness", "下划线粗细", "border", literal(1), 0, 6, 0.5),
    number("underlineOffset", "下划线偏移", "layout", literal(2), 0, 12, 0.5)
  ],
  strikethrough: [
    color("decorationColor", "删除线颜色", "color", theme("ui.mutedForeground")),
    number("decorationThickness", "删除线粗细", "border", literal(1), 0, 6, 0.5)
  ],
  list: [
    color("markerColor", "标记颜色", "color", theme("ui.mutedForeground")),
    number("indent", "缩进", "layout", literal(16), 12, 80),
    number("itemSpacing", "条目间距", "layout", literal(4), 0, 32),
    number("blockSpacing", "列表块间距", "layout", literal(8), 0, 48)
  ],
  task: [
    number("checkboxSize", "复选框尺寸", "layout", literal(16), 10, 32),
    number("checkboxBorderWidth", "复选框边框", "border", literal(1), 0, 4, 0.5),
    color("checkboxBorderColor", "复选框边线", "color", theme("ui.border")),
    color("checkboxBackground", "复选框背景", "color", theme("ui.background")),
    color("checkboxCheckedBackground", "选中背景", "state", theme("ui.primary")),
    color("checkboxCheckColor", "勾选标记", "state", theme("ui.background")),
    number("checkboxRadius", "复选框圆角", "border", literal(3), 0, 12)
  ],
  blockquote: [
    color("background", "背景", "color", theme("ui.card")),
    color("borderColor", "边线颜色", "color", theme("ui.primary")),
    number("borderWidth", "边线宽度", "border", literal(4), 0, 12, 0.5),
    number("paddingX", "横向内边距", "layout", literal(20), 0, 64),
    number("paddingY", "纵向内边距", "layout", literal(8), 0, 48),
    number("marginY", "上下间距", "layout", literal(8), 0, 48),
    number("radius", "圆角", "border", literal(4), 0, 32)
  ],
  inlineCode: [
    color("background", "背景", "color", theme("ui.muted")),
    number("paddingX", "横向内边距", "layout", literal(3), 0, 16),
    number("paddingY", "纵向内边距", "layout", literal(1), 0, 12),
    number("radius", "圆角", "border", literal(4), 0, 20)
  ],
  codeBlock: [
    color("background", "背景", "color", theme("ui.card")),
    number("paddingX", "横向内边距", "layout", literal(20), 0, 64),
    number("paddingY", "纵向内边距", "layout", literal(16), 0, 64),
    number("marginY", "上下间距", "layout", literal(8), 0, 48),
    number("radius", "圆角", "border", literal(6), 0, 32)
  ],
  table: [
    color("borderColor", "边框颜色", "color", theme("ui.border")),
    color("headerBackground", "表头背景", "color", theme("ui.muted")),
    color("bodyBackground", "表体背景", "color", theme("ui.card")),
    number("cellPaddingX", "单元格横向内边距", "layout", literal(16), 0, 40),
    number("cellPaddingY", "单元格纵向内边距", "layout", literal(8), 0, 32),
    number("borderWidth", "边框宽度", "border", literal(1), 0, 6, 0.5),
    number("radius", "圆角", "border", literal(6), 0, 32),
    number("marginY", "上下间距", "layout", literal(8), 0, 48)
  ],
  divider: [
    color("color", "颜色", "color", theme("ui.border")),
    number("thickness", "粗细", "border", literal(1), 0, 8, 0.5),
    number("marginY", "上下间距", "layout", literal(16), 0, 64)
  ],
  image: [
    color("borderColor", "边框颜色", "color", theme("ui.border")),
    number("borderWidth", "边框宽度", "border", literal(0), 0, 8, 0.5),
    number("radius", "圆角", "border", literal(8), 0, 48),
    number("marginY", "上下间距", "layout", literal(12), 0, 64)
  ]
};

export const MARKDOWN_TOKEN_DEFINITIONS: readonly MarkdownTokenDefinition[] = MARKDOWN_ELEMENT_DEFINITIONS.flatMap((elementDefinition) => {
  const path = elementDefinition.path;
  const leaf = path.at(-1) || "";
  if (leaf === "divider" || leaf === "image") return withPath(path, EXTRA_FIELDS[leaf]);
  const extras = leaf === "unordered" || leaf === "ordered"
    ? EXTRA_FIELDS.list
    : leaf === "task"
      ? [...EXTRA_FIELDS.list.filter((definition) => definition.path[0] !== "markerColor"), ...EXTRA_FIELDS.task]
      : EXTRA_FIELDS[elementDefinition.id] || EXTRA_FIELDS[leaf] || [];
  return withPath(path, [...textFields(TEXT_DEFAULTS[elementDefinition.id]), ...extras]);
});

export function createDefaultMarkdownTokens(source: MarkdownDefaultThemeSource): MarkdownThemeTokens {
  const result: Record<string, unknown> = {};
  for (const definition of MARKDOWN_TOKEN_DEFINITIONS) {
    setAtPath(result, definition.path, resolveMarkdownTokenDefault(definition.default, source));
  }
  return result as MarkdownThemeTokens;
}

export function resolveMarkdownTokenDefault(value: MarkdownTokenDefault, source: MarkdownDefaultThemeSource): string | number {
  if (value.kind === "literal") return value.value;
  const [group, key] = value.path;
  return source[group][key as keyof (typeof source)[typeof group]] as string | number;
}

export function markdownTokenDefinition(path: readonly string[]) {
  const key = path.join(".");
  return MARKDOWN_TOKEN_DEFINITIONS.find((definition) => definition.path.join(".") === key);
}

function element(id: string, category: MarkdownElementCategory, title: string, description: string, path: readonly string[], monospace = false): MarkdownElementDefinition {
  return { id, category, title, description, path, monospace };
}

function headingDefaults(fontSize: number, lineHeight: number, weight: "weightRegular" | "weightMedium" | "weightBold"): TextDefaults {
  return {
    fontFamily: theme("font.familySans"),
    fontSize: literal(fontSize),
    fontWeight: theme(`font.${weight}`),
    lineHeight: literal(lineHeight),
    letterSpacing: literal(0),
    color: theme("ui.foreground")
  };
}

function codeDefaults(lineHeight: number, colorDefault: MarkdownTokenDefault): TextDefaults {
  return {
    fontFamily: theme("font.familyMono"),
    fontSize: literal(14),
    fontWeight: theme("font.weightRegular"),
    lineHeight: literal(lineHeight),
    letterSpacing: literal(0),
    color: colorDefault
  };
}

function textFields(defaults: TextDefaults): readonly MarkdownTokenDefinition[] {
  return [
    field("fontFamily", "字体", "font", "typography", defaults.fontFamily),
    field("fontSize", "字号", "number", "typography", defaults.fontSize, 8, 96, 1, "px"),
    field("fontWeight", "字重", "number", "typography", defaults.fontWeight, 100, 900, 50),
    field("lineHeight", "行高", "number", "typography", defaults.lineHeight, 8, 128, 1, "px"),
    field("letterSpacing", "字距", "number", "typography", defaults.letterSpacing, -4, 12, 0.1, "px"),
    field("color", "文字颜色", "color", "color", defaults.color)
  ];
}

function headingSpacing(marginTop: number, marginBottom: number): readonly MarkdownTokenDefinition[] {
  return [
    number("marginTop", "顶部间距", "layout", literal(marginTop), 0, 96),
    number("marginBottom", "底部间距", "layout", literal(marginBottom), 0, 64)
  ];
}

function withPath(path: readonly string[], definitions: readonly MarkdownTokenDefinition[]) {
  return definitions.map((definition) => ({ ...definition, path: [...path, ...definition.path] }));
}

function field(
  key: string,
  label: string,
  kind: MarkdownTokenFieldKind,
  section: MarkdownTokenFieldSection,
  defaultValue: MarkdownTokenDefault,
  min?: number,
  max?: number,
  step?: number,
  unit = ""
): MarkdownTokenDefinition {
  const source = defaultSource(defaultValue);
  return {
    path: [key],
    label,
    kind,
    section,
    default: defaultValue,
    defaultSource: defaultValue.kind === "literal" && typeof defaultValue.value === "number" && unit ? `${source}${unit}` : source,
    min,
    max,
    step,
    unit
  };
}

function color(key: string, label: string, section: MarkdownTokenFieldSection, defaultValue: MarkdownTokenDefault): MarkdownTokenDefinition {
  return field(key, label, "color", section, defaultValue);
}

function number(
  key: string,
  label: string,
  section: MarkdownTokenFieldSection,
  defaultValue: MarkdownTokenDefault,
  min: number,
  max: number,
  step = 1
): MarkdownTokenDefinition {
  return field(key, label, "number", section, defaultValue, min, max, step, "px");
}

function literal(value: string | number): MarkdownTokenDefault {
  return { kind: "literal", value };
}

function theme(path: `ui.${string}` | `font.${string}`): MarkdownTokenDefault {
  const [group, key] = path.split(".") as ["ui" | "font", string];
  return { kind: "theme", path: [group, key] };
}

function defaultSource(value: MarkdownTokenDefault): string {
  return value.kind === "theme" ? value.path.join(".") : String(value.value);
}

function setAtPath(target: Record<string, unknown>, path: readonly string[], value: string | number) {
  let current = target;
  for (const key of path.slice(0, -1)) {
    const child = current[key];
    if (!child || typeof child !== "object" || Array.isArray(child)) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  current[path.at(-1) || ""] = value;
}
