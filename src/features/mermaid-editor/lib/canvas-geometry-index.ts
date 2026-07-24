import type { NodeGeometry, Rect } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

export type CanvasGeometryIndex = {
  nodeById: Map<string, NodeGeometry>;
  subgraphById: Map<string, SubgraphGeometry>;
  queryNodes: (bounds: Rect) => NodeGeometry[];
  querySubgraphs: (bounds: Rect) => SubgraphGeometry[];
  nodesAtPoint: (point: { x: number; y: number }) => NodeGeometry[];
  subgraphsAtPoint: (point: { x: number; y: number }) => SubgraphGeometry[];
};

const DEFAULT_CELL_SIZE = 512;

export function createCanvasGeometryIndex(
  nodes: NodeGeometry[],
  subgraphs: SubgraphGeometry[],
  cellSize = DEFAULT_CELL_SIZE
): CanvasGeometryIndex {
  const normalizedCellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : DEFAULT_CELL_SIZE;
  const nodeIndex = createRectIndex(nodes, normalizedCellSize);
  const subgraphIndex = createRectIndex(subgraphs, normalizedCellSize);

  return {
    nodeById: new Map(nodes.map((node) => [node.id, node])),
    subgraphById: new Map(subgraphs.map((subgraph) => [subgraph.id, subgraph])),
    queryNodes: nodeIndex.query,
    querySubgraphs: subgraphIndex.query,
    nodesAtPoint: nodeIndex.atPoint,
    subgraphsAtPoint: subgraphIndex.atPoint
  };
}

type IndexedFrame = {
  id: string;
  frame: Rect;
};

function createRectIndex<T extends IndexedFrame>(items: T[], cellSize: number) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const orderById = new Map(items.map((item, index) => [item.id, index]));
  const cells = new Map<string, string[]>();

  for (const item of items) {
    forEachCoveredCell(item.frame, cellSize, (key) => {
      const ids = cells.get(key);
      if (ids) ids.push(item.id);
      else cells.set(key, [item.id]);
    });
  }

  function candidates(bounds: Rect) {
    const ids = new Set<string>();
    forEachCoveredCell(bounds, cellSize, (key) => {
      for (const id of cells.get(key) || []) ids.add(id);
    });
    return [...ids]
      .sort((left, right) => (orderById.get(left) ?? 0) - (orderById.get(right) ?? 0))
      .map((id) => itemById.get(id))
      .filter((item): item is T => Boolean(item));
  }

  return {
    query(bounds: Rect) {
      return candidates(bounds).filter((item) => rectIntersects(item.frame, bounds));
    },
    atPoint(point: { x: number; y: number }) {
      const pointBounds = { x: point.x, y: point.y, width: 0.0001, height: 0.0001 };
      return candidates(pointBounds).filter((item) => pointInsideRect(point, item.frame));
    }
  };
}

function forEachCoveredCell(frame: Rect, cellSize: number, visit: (key: string) => void) {
  const left = Math.floor(frame.x / cellSize);
  const top = Math.floor(frame.y / cellSize);
  const right = Math.floor((frame.x + Math.max(0, frame.width)) / cellSize);
  const bottom = Math.floor((frame.y + Math.max(0, frame.height)) / cellSize);

  for (let x = left; x <= right; x += 1) {
    for (let y = top; y <= bottom; y += 1) visit(`${x}:${y}`);
  }
}

function rectIntersects(rect: Rect, bounds: Rect) {
  return rect.x < bounds.x + bounds.width && rect.x + rect.width > bounds.x && rect.y < bounds.y + bounds.height && rect.y + rect.height > bounds.y;
}

function pointInsideRect(point: { x: number; y: number }, rect: Rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}
