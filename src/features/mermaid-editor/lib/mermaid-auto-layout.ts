import mermaid from "mermaid";

import { stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { CanvasLayout, EdgeRouting, MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { MermaidThemeVariables } from "@/features/mermaid-editor/lib/editor-theme";
import { buildNodeGeometry, defaultNodeGeometrySpec, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";

export type RenderedNodeCenter = {
  id: string;
  x: number;
  y: number;
};

type AutoLayoutOptions = {
  edgeRouting: EdgeRouting;
  mermaidThemeVariables?: MermaidThemeVariables;
  viewport?: ViewportState;
  spec?: NodeGeometrySpec;
};

type LayoutFromCentersOptions = {
  edgeRouting: EdgeRouting;
  viewport?: ViewportState;
  spec?: NodeGeometrySpec;
};

const AUTO_LAYOUT_ORIGIN = { x: 120, y: 120 };
const AUTO_LAYOUT_VIEWPORT: ViewportState = { x: 160, y: 90, scale: 1 };

export async function deriveLayoutFromMermaidRender(source: string, graph: MermaidGraph, options: AutoLayoutOptions): Promise<CanvasLayout> {
  if (typeof document === "undefined") throw new Error("自动布局同步需要浏览器环境。");

  await document.fonts.ready;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: options.mermaidThemeVariables,
    flowchart: {
      useMaxWidth: false
    }
  });

  const renderId = `mmd-auto-layout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await mermaid.render(renderId, stripCanvasLayout(source).trim());
  const centers = extractRenderedNodeCenters(result.svg, graph);

  return canvasLayoutFromRenderedNodeCenters(graph, centers, {
    edgeRouting: options.edgeRouting,
    viewport: options.viewport,
    spec: options.spec
  });
}

export function canvasLayoutFromRenderedNodeCenters(graph: MermaidGraph, centers: RenderedNodeCenter[], options: LayoutFromCentersOptions): CanvasLayout {
  const centerById = new Map(centers.map((center) => [center.id, center]));
  const spec = options.spec || defaultNodeGeometrySpec();
  const resolved = graph.nodes
    .map((node) => {
      const center = centerById.get(node.id);
      if (!center) return null;

      const frame = buildNodeGeometry({ ...node, x: 0, y: 0 }, spec).frame;
      return {
        node,
        x: center.x - frame.width / 2,
        y: center.y - frame.height / 2
      };
    })
    .filter(Boolean) as { node: MermaidGraph["nodes"][number]; x: number; y: number }[];

  if (!resolved.length) throw new Error("无法从 Mermaid 渲染结果中提取节点布局。");

  const minX = Math.min(...resolved.map((item) => item.x));
  const minY = Math.min(...resolved.map((item) => item.y));
  const resolvedById = new Map(resolved.map((item) => [item.node.id, item]));

  return {
    version: 1,
    edgeRouting: options.edgeRouting,
    viewport: options.viewport || AUTO_LAYOUT_VIEWPORT,
    nodes: Object.fromEntries(
      graph.nodes.map((node) => {
        const resolvedNode = resolvedById.get(node.id);
        return [
          node.id,
          {
            x: resolvedNode ? roundLayoutPosition(resolvedNode.x - minX + AUTO_LAYOUT_ORIGIN.x) : node.x,
            y: resolvedNode ? roundLayoutPosition(resolvedNode.y - minY + AUTO_LAYOUT_ORIGIN.y) : node.y,
            fill: node.fill
          }
        ];
      })
    )
  };
}

function extractRenderedNodeCenters(svgText: string, graph: MermaidGraph): RenderedNodeCenter[] {
  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:-10000px",
    "width:1px",
    "height:1px",
    "overflow:hidden",
    "pointer-events:none",
    "opacity:0"
  ].join(";");
  host.innerHTML = svgText;
  document.body.append(host);

  try {
    const svg = host.querySelector("svg");
    if (!svg) return [];

    return graph.nodes
      .map((node) => {
        const element = findRenderedNodeElement(svg, node.id);
        if (!element) return null;
        const center = centerOfSvgElement(element);
        return center ? { id: node.id, ...center } : null;
      })
      .filter(Boolean) as RenderedNodeCenter[];
  } finally {
    host.remove();
  }
}

function findRenderedNodeElement(svg: Element, nodeId: string) {
  const candidates = Array.from(svg.querySelectorAll<SVGGraphicsElement>("[data-id], .node"));
  return (
    candidates.find((element) => element.getAttribute("data-id") === nodeId && element.classList.contains("node")) ||
    candidates.find((element) => element.getAttribute("data-id") === nodeId) ||
    candidates.find((element) => renderedElementIdMatchesNode(element.getAttribute("id"), nodeId))
  );
}

function centerOfSvgElement(element: SVGGraphicsElement) {
  const box = element.getBBox();
  if (!box.width && !box.height) return null;

  const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2);
  const matrix = element.getCTM();
  const transformed = matrix ? point.matrixTransform(matrix) : point;

  return {
    x: transformed.x,
    y: transformed.y
  };
}

function renderedElementIdMatchesNode(elementId: string | null, nodeId: string) {
  if (!elementId) return false;
  return elementId === nodeId || elementId.includes(`-${nodeId}-`) || elementId.endsWith(`-${nodeId}`);
}

function roundLayoutPosition(value: number) {
  return Math.round(value * 10) / 10;
}
