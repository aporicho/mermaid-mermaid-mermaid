export const FLOWCHART_SHAPE_GROUPS = ["基础", "流程", "数据", "文档", "标记"] as const;

export type FlowchartShapeGroup = (typeof FLOWCHART_SHAPE_GROUPS)[number];

export type FlowchartShapeDefinition = {
  id: string;
  label: string;
  group: FlowchartShapeGroup;
  aliases: string[];
};

export const FLOWCHART_SHAPES = [
  { id: "rect", label: "矩形", group: "基础", aliases: ["rectangle", "proc", "process", "squareRect"] },
  { id: "rounded", label: "圆角矩形", group: "基础", aliases: ["event", "roundedRect"] },
  { id: "stadium", label: "胶囊", group: "基础", aliases: ["terminal", "pill"] },
  { id: "fr-rect", label: "子程序", group: "基础", aliases: ["subroutine", "subprocess", "subproc", "framed-rectangle"] },
  { id: "circle", label: "圆形", group: "基础", aliases: ["circ"] },
  { id: "diam", label: "菱形", group: "基础", aliases: ["diamond", "decision", "question"] },
  { id: "hex", label: "六边形", group: "基础", aliases: ["hexagon", "prepare"] },
  { id: "text", label: "文本", group: "基础", aliases: [] },

  { id: "lean-r", label: "输入/输出", group: "流程", aliases: ["lean-right", "in-out", "lean_right"] },
  { id: "lean-l", label: "反向输入/输出", group: "流程", aliases: ["lean-left", "out-in", "lean_left"] },
  { id: "trap-b", label: "梯形", group: "流程", aliases: ["priority", "trapezoid-bottom", "trapezoid"] },
  { id: "trap-t", label: "反向梯形", group: "流程", aliases: ["manual", "trapezoid-top", "inv-trapezoid", "inv_trapezoid"] },
  { id: "fork", label: "分叉/汇合", group: "流程", aliases: ["join", "forkJoin"] },
  { id: "hourglass", label: "沙漏", group: "流程", aliases: ["collate"] },
  { id: "delay", label: "延迟", group: "流程", aliases: ["half-rounded-rectangle"] },
  { id: "tri", label: "三角形", group: "流程", aliases: ["extract", "triangle"] },
  { id: "notch-pent", label: "循环限制", group: "流程", aliases: ["loop-limit", "notched-pentagon"] },
  { id: "flip-tri", label: "反向三角形", group: "流程", aliases: ["manual-file", "flipped-triangle"] },
  { id: "sl-rect", label: "斜矩形", group: "流程", aliases: ["manual-input", "sloped-rectangle"] },
  { id: "odd", label: "异形", group: "流程", aliases: ["rect_left_inv_arrow"] },

  { id: "cyl", label: "数据库", group: "数据", aliases: ["database", "db", "cylinder"] },
  { id: "datastore", label: "数据存储", group: "数据", aliases: ["data-store"] },
  { id: "h-cyl", label: "横向圆柱", group: "数据", aliases: ["das", "horizontal-cylinder"] },
  { id: "lin-cyl", label: "带线圆柱", group: "数据", aliases: ["disk", "lined-cylinder"] },
  { id: "win-pane", label: "内部存储", group: "数据", aliases: ["internal-storage", "window-pane"] },
  { id: "bow-rect", label: "存储数据", group: "数据", aliases: ["stored-data", "bow-tie-rectangle"] },
  { id: "curv-trap", label: "显示", group: "数据", aliases: ["curved-trapezoid", "display"] },

  { id: "doc", label: "文档", group: "文档", aliases: ["document"] },
  { id: "docs", label: "多文档", group: "文档", aliases: ["documents", "st-doc", "stacked-document"] },
  { id: "lin-doc", label: "带线文档", group: "文档", aliases: ["lined-document"] },
  { id: "tag-doc", label: "标签文档", group: "文档", aliases: ["tagged-document"] },
  { id: "flag", label: "纸带", group: "文档", aliases: ["paper-tape"] },
  { id: "notch-rect", label: "卡片", group: "文档", aliases: ["card", "notched-rectangle"] },
  { id: "lin-rect", label: "带线矩形", group: "文档", aliases: ["lined-rectangle", "lined-process", "lin-proc", "shaded-process"] },
  { id: "div-rect", label: "分隔矩形", group: "文档", aliases: ["div-proc", "divided-rectangle", "divided-process"] },
  { id: "st-rect", label: "堆叠矩形", group: "文档", aliases: ["procs", "processes", "stacked-rectangle"] },
  { id: "tag-rect", label: "标签矩形", group: "文档", aliases: ["tagged-rectangle", "tag-proc", "tagged-process"] },

  { id: "bang", label: "感叹号", group: "标记", aliases: [] },
  { id: "cloud", label: "云", group: "标记", aliases: [] },
  { id: "dbl-circ", label: "双圆", group: "标记", aliases: ["double-circle", "doublecircle"] },
  { id: "sm-circ", label: "小圆", group: "标记", aliases: ["start", "small-circle", "stateStart"] },
  { id: "fr-circ", label: "框线圆", group: "标记", aliases: ["stop", "framed-circle", "stateEnd"] },
  { id: "f-circ", label: "实心圆", group: "标记", aliases: ["junction", "filled-circle"] },
  { id: "cross-circ", label: "交叉圆", group: "标记", aliases: ["summary", "crossed-circle"] },
  { id: "brace", label: "左大括号", group: "标记", aliases: ["comment", "brace-l"] },
  { id: "brace-r", label: "右大括号", group: "标记", aliases: [] },
  { id: "braces", label: "双大括号", group: "标记", aliases: [] },
  { id: "bolt", label: "闪电", group: "标记", aliases: ["com-link", "lightning-bolt"] }
] as const satisfies readonly FlowchartShapeDefinition[];

export type FlowchartNodeShape = (typeof FLOWCHART_SHAPES)[number]["id"];

const shapeLookup = new Map<string, FlowchartNodeShape>(
  FLOWCHART_SHAPES.flatMap((shape) => [[shape.id, shape.id], ...shape.aliases.map((alias) => [alias, shape.id] as const)])
);

export const DEFAULT_FLOWCHART_NODE_SHAPE: FlowchartNodeShape = "rect";

const equalAspectShapes = new Set<FlowchartNodeShape>([
  "circle",
  "sm-circ",
  "f-circ",
  "dbl-circ",
  "fr-circ",
  "cross-circ",
  "diam",
  "hex",
  "tri",
  "flip-tri"
]);

export function normalizeFlowchartShape(value: string | undefined | null): FlowchartNodeShape | null {
  if (!value) return null;
  return shapeLookup.get(value.trim()) || null;
}

export function isFlowchartNodeShape(value: string | undefined | null): value is FlowchartNodeShape {
  return Boolean(normalizeFlowchartShape(value));
}

export function getFlowchartShapeLabel(shape: FlowchartNodeShape) {
  return FLOWCHART_SHAPES.find((item) => item.id === shape)?.label || shape;
}

export function isEqualAspectFlowchartShape(shape: FlowchartNodeShape) {
  return equalAspectShapes.has(shape);
}
