import type { CanvasPointerLocalEffect } from "@/features/mermaid-editor/lib/interaction/canvas-pointer";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { NodeGeometry, NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { buildNodeGeometry, nodeIntersectsRect } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";
import { subgraphAtPoint, subgraphIntersectsRect } from "@/features/mermaid-editor/lib/subgraph-geometry";
import type { CanvasGeometryIndex } from "@/features/mermaid-editor/lib/canvas-geometry-index";
export type CanvasPointerLocalEffectContext = {
  graphNodes: CanvasNode[];
  visualTokens: CanvasVisualTokens;
  geometrySpec: NodeGeometrySpec;
  renderedSubgraphGeometries: SubgraphGeometry[];
  subgraphGeometryById: Map<string, SubgraphGeometry>;
  nodeGeometryById: Map<string, NodeGeometry>;
  geometryIndex: CanvasGeometryIndex;
  viewNodes: boolean;
  viewSubgraphs: boolean;
  invalidateBlankClickIntent: () => void;
  recordBlankClick: (intent: Extract<CanvasPointerLocalEffect, { type: "blankClick.record" }>["intent"]) => void;
  startInlineEdit: (target: Extract<CanvasPointerLocalEffect, { type: "inlineEdit.start" }>["target"]) => void;
  openNodeAction: (nodeId: string) => void;
  startNodeDrag: (node: CanvasNode) => void;
  startSubgraphDrag: (subgraphId: string, geometry: SubgraphGeometry) => void;
  finishConnection: (draft: Extract<CanvasPointerLocalEffect, { type: "edge.resolveConnection" }>["draft"]) => void;
  retargetEdge: (edgeId: string, side: "from" | "to", point: { x: number; y: number }) => void;
  resetInteraction: () => void;
  onEditorCommand: (command: EditorCommand) => void;
};

export function applyCanvasPointerLocalEffect(effect: CanvasPointerLocalEffect, context: CanvasPointerLocalEffectContext) {
  if (effect.type === "blankClick.invalidate") return context.invalidateBlankClickIntent();
  if (effect.type === "blankClick.record") return context.recordBlankClick(effect.intent);
  if (effect.type === "graph.resolveAddNodeAt") {
    const frame = buildNodeGeometry({ id: "", label: "新节点", x: 0, y: 0, fill: context.visualTokens.surface.background }, context.geometrySpec).frame;
    const parent = subgraphAtPoint(context.renderedSubgraphGeometries, effect.point);
    context.onEditorCommand({
      type: "graph.addNodeAt",
      point: { x: effect.point.x - frame.width / 2, y: effect.point.y - frame.height / 2, parentId: parent?.id },
      source: "pointer"
    });
    return;
  }
  if (effect.type === "inlineEdit.start") return context.startInlineEdit(effect.target);
  if (effect.type === "nodeAction.open") return context.openNodeAction(effect.nodeId);
  if (effect.type === "drag.startNode") {
    const node = context.graphNodes.find((item) => item.id === effect.nodeId);
    if (node) context.startNodeDrag(node);
    return;
  }
  if (effect.type === "drag.startSubgraph") {
    const geometry = context.subgraphGeometryById.get(effect.subgraphId);
    if (geometry) context.startSubgraphDrag(effect.subgraphId, geometry);
    return;
  }
  if (effect.type === "selection.resolveMarquee") {
    const nodeIds = context.viewNodes
      ? context.geometryIndex.queryNodes(effect.rect).flatMap((candidate) => {
          const geometry = context.nodeGeometryById.get(candidate.id);
          return geometry && nodeIntersectsRect(geometry, effect.rect) ? [geometry.id] : [];
        })
      : [];
    const subgraphIds = context.viewSubgraphs
      ? context.geometryIndex.querySubgraphs(effect.rect).flatMap((candidate) => {
          const geometry = context.subgraphGeometryById.get(candidate.id);
          return geometry && subgraphIntersectsRect(geometry, effect.rect) ? [geometry.id] : [];
        })
      : [];
    context.onEditorCommand({ type: "selection.set", selection: { nodeIds, edgeIds: [], subgraphIds, primaryId: nodeIds[0] || subgraphIds[0] }, source: "pointer" });
    return;
  }
  if (effect.type === "edge.resolveConnection") return context.finishConnection(effect.draft);
  if (effect.type === "edge.resolveRetarget") return context.retargetEdge(effect.edgeId, effect.side, effect.point);
  if (effect.type === "interaction.reset") context.resetInteraction();
}
