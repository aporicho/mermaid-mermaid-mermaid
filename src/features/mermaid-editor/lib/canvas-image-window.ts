import type { CanvasDocument, CanvasImageElement } from "@/features/mermaid-editor/lib/canvas-document";
import type { HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { StandardCanvasHitTarget } from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import type { CanvasNode, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { runtimeFileNameFromPath } from "@/features/mermaid-editor/lib/runtime-paths";
import type { ImageWindowNavigationRequest } from "@/features/mermaid-editor/lib/workspace-panels";

export function canvasDocumentImageForDoubleClick(document: CanvasDocument, hit: StandardCanvasHitTarget): CanvasImageElement | null {
  if (hit.kind !== "item") return null;
  const element = document.elements.find((item) => item.id === hit.id);
  return element?.type === "image" ? element : null;
}

export function graphImageNodeForDoubleClick(graph: MermaidGraph, hit: HitTarget): CanvasNode | null {
  if (hit.kind !== "node") return null;
  const node = graph.nodes.find((item) => item.id === hit.id);
  return node?.asset?.kind === "image" ? node : null;
}

export function canvasDocumentImageNavigation(
  document: CanvasDocument,
  documentIdentity: string
): ImageWindowNavigationRequest {
  return {
    kind: "canvas",
    items: spatiallySortedImages(document.elements.filter((element): element is CanvasImageElement => element.type === "image"))
      .map((image) => ({
        source: image.src,
        title: imageTitle(image.src),
        identity: `canvas:${documentIdentity}:image:${image.id}`
      }))
  };
}

export function mermaidGraphImageNavigation(
  graph: MermaidGraph,
  selectedNodeId: string,
  documentIdentity: string
): ImageWindowNavigationRequest {
  const directParentByNodeId = new Map<string, string>();
  for (const subgraph of graph.subgraphs || []) {
    for (const nodeId of subgraph.nodeIds) directParentByNodeId.set(nodeId, subgraph.id);
  }
  const selectedParentId = directParentByNodeId.get(selectedNodeId);
  const candidates = graph.nodes.filter((node) => (
    node.asset?.kind === "image" && directParentByNodeId.get(node.id) === selectedParentId
  ));

  return {
    kind: "canvas",
    items: spatiallySortedImages(candidates).map((node) => ({
      source: node.asset!.src,
      title: node.label.trim() || imageTitle(node.asset!.src),
      identity: `mermaid:${documentIdentity}:image:${node.id}`
    }))
  };
}

function spatiallySortedImages<T extends { x: number; y: number }>(items: readonly T[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => left.item.y - right.item.y || left.item.x - right.item.x || left.index - right.index)
    .map(({ item }) => item);
}

function imageTitle(source: string) {
  const cleanSource = source.split(/[?#]/, 1)[0] || source;
  return runtimeFileNameFromPath(cleanSource) || "图片";
}
