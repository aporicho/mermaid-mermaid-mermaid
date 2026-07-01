import type {
  CanvasNodeAction,
  EdgeAnimation,
  EdgeMarker,
  EdgeStyle,
  GraphDirection,
  MermaidCurve
} from "@/features/mermaid-editor/lib/editor-types";

export const edgeStyleOptions: { value: EdgeStyle; label: string }[] = [
  { value: "solid", label: "实线" },
  { value: "thick", label: "粗线" },
  { value: "dotted", label: "点线" },
  { value: "invisible", label: "隐藏线" }
];

export const edgeMarkerOptions: { value: EdgeMarker; label: string }[] = [
  { value: "arrow", label: "箭头" },
  { value: "none", label: "无端点" },
  { value: "circle", label: "圆点" },
  { value: "cross", label: "叉号" }
];

export const edgeAnimationOptions: { value: EdgeAnimation; label: string }[] = [
  { value: "none", label: "不动画" },
  { value: "on", label: "开启" },
  { value: "fast", label: "快速" },
  { value: "slow", label: "慢速" }
];

export const edgeCurveOptions: { value: MermaidCurve; label: string }[] = [
  { value: "basis", label: "basis" },
  { value: "bumpX", label: "bumpX" },
  { value: "bumpY", label: "bumpY" },
  { value: "cardinal", label: "cardinal" },
  { value: "catmullRom", label: "catmullRom" },
  { value: "linear", label: "linear" },
  { value: "monotoneX", label: "monotoneX" },
  { value: "monotoneY", label: "monotoneY" },
  { value: "natural", label: "natural" },
  { value: "step", label: "step" },
  { value: "stepAfter", label: "stepAfter" },
  { value: "stepBefore", label: "stepBefore" }
];

export const directionOptions: { value: GraphDirection; label: string }[] = [
  { value: "LR", label: "LR" },
  { value: "TD", label: "TD" },
  { value: "TB", label: "TB" },
  { value: "RL", label: "RL" },
  { value: "BT", label: "BT" }
];

export const MIXED_VALUE = "__mixed__";
export const INHERIT_VALUE = "__inherit__";
export const ROOT_VALUE = "__root__";
export const DEFAULT_CURVE_VALUE = "__default_curve__";
export const NODE_ACTION_URL_MODE_APP: Extract<CanvasNodeAction, { kind: "url" }>["openMode"] = "app-browser";
export const NODE_ACTION_FILE_MODE_APP: Extract<CanvasNodeAction, { kind: "file" }>["openMode"] = "app-window";
