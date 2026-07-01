export const NODE_COLORS = [
  "#fbf6ef",
  "#ffe1e5",
  "#fff0cf",
  "#eadfd2",
  "#e9eff0",
  "#f3e6f1",
  "#e7eadb",
  "#f1eadf"
];

const DEFAULT_SOURCE = `flowchart LR
  Start([想法]) --> Draft[写 Mermaid]
  Draft --> Canvas[拖拽画布整理]
  Canvas --> Preview{渲染满意吗}
  Preview -->|是| Ship[导出 / 复制]
  Preview -->|否| Canvas`;

export const palette = NODE_COLORS;
export const initialMermaidSource = DEFAULT_SOURCE;
