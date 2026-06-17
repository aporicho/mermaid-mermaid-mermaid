import { buildMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import type { CanvasEdge, CanvasNode, CanvasSubgraph, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

export type PerformanceFixtureSize = 100 | 300 | 800;

export const PERFORMANCE_FIXTURE_SIZES: PerformanceFixtureSize[] = [100, 300, 800];

const NODE_GAP_X = 220;
const NODE_GAP_Y = 130;
const GROUP_SIZE = 25;

export function createPerformanceFixtureGraph(size: PerformanceFixtureSize): MermaidGraph {
  const columns = columnsForSize(size);
  const nodes = buildFixtureNodes(size, columns);
  const edges = buildFixtureEdges(size, columns);
  const subgraphs = buildFixtureSubgraphs(size);

  return {
    diagramType: "flowchart",
    editableKind: "flowchart",
    parseStatus: "parsed",
    direction: "LR",
    nodes,
    edges,
    subgraphs
  };
}

export function createPerformanceFixtureDocument(size: PerformanceFixtureSize) {
  const graph = createPerformanceFixtureGraph(size);
  return buildMermaidDocument(serializeMermaid(graph), graph, { x: 120, y: 90, scale: 0.7 }, "bezier", "manual");
}

function buildFixtureNodes(size: PerformanceFixtureSize, columns: number): CanvasNode[] {
  return Array.from({ length: size }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      id: fixtureNodeId(index),
      label: `节点 ${index + 1}`,
      x: column * NODE_GAP_X,
      y: row * NODE_GAP_Y,
      fill: index % 7 === 0 ? "#fff2d9" : index % 5 === 0 ? "#e8f4f0" : "#ffffff",
      shape: index % 11 === 0 ? "rounded" : index % 13 === 0 ? "diam" : undefined
    };
  });
}

function buildFixtureEdges(size: PerformanceFixtureSize, columns: number): CanvasEdge[] {
  const edges: CanvasEdge[] = [];

  for (let index = 0; index < size - 1; index += 1) {
    edges.push({
      id: `E${edges.length}`,
      from: fixtureNodeId(index),
      to: fixtureNodeId(index + 1),
      label: index % 10 === 0 ? `步骤 ${index + 1}` : "",
      style: index % 9 === 0 ? "dotted" : index % 7 === 0 ? "thick" : "solid",
      arrowType: index % 17 === 0 ? "circle" : "arrow"
    });
  }

  for (let index = 0; index + columns < size; index += 3) {
    edges.push({
      id: `E${edges.length}`,
      from: fixtureNodeId(index),
      to: fixtureNodeId(index + columns),
      label: "",
      style: "solid",
      arrowType: "arrow"
    });
  }

  return edges;
}

function buildFixtureSubgraphs(size: PerformanceFixtureSize): CanvasSubgraph[] {
  const groups = Math.ceil(size / GROUP_SIZE);
  return Array.from({ length: groups }, (_, groupIndex) => {
    const start = groupIndex * GROUP_SIZE;
    const end = Math.min(size, start + GROUP_SIZE);
    return {
      id: `Group${groupIndex + 1}`,
      title: `分区 ${groupIndex + 1}`,
      nodeIds: range(start, end).map(fixtureNodeId)
    };
  });
}

function columnsForSize(size: PerformanceFixtureSize) {
  return size === 100 ? 10 : size === 300 ? 18 : 32;
}

function fixtureNodeId(index: number) {
  return `N${index + 1}`;
}

function range(start: number, end: number) {
  return Array.from({ length: end - start }, (_, offset) => start + offset);
}
