import { useEffect, useLayoutEffect, useRef } from "react";
import type Konva from "konva";
import { Group } from "react-konva";

import type { CanvasDragPreviewSnapshot } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";
import type { CanvasViewportCompositor } from "@/features/mermaid-editor/components/konva-canvas/canvas-viewport-compositor";
import { nodeVisualId, subgraphVisualId } from "@/features/mermaid-editor/lib/canvas-hit-target";

type PromotedVisual = {
  id: string;
  node: Konva.Node;
  parent: Konva.Container;
  zIndex: number;
};

export function CanvasActiveDragVisuals({
  dragPreview,
  activeNodeIds,
  activeSubgraphIds,
  viewportCompositor
}: {
  dragPreview: CanvasDragPreviewSnapshot | null;
  activeNodeIds: string[];
  activeSubgraphIds: string[];
  viewportCompositor: CanvasViewportCompositor;
}) {
  const promotedRef = useRef<PromotedVisual[]>([]);
  const activeVisualGroupRef = useRef<Konva.Group | null>(null);

  function syncVisuals() {
    const activeVisualGroup = activeVisualGroupRef.current;
    const stage = activeVisualGroup?.getStage();
    if (!activeVisualGroup || !stage) return false;
    const desired = new Set([
      ...activeNodeIds.map(nodeVisualId),
      ...activeSubgraphIds.map(subgraphVisualId),
      ...Object.keys(dragPreview?.nodePositions || {}).map(nodeVisualId),
      ...Object.keys(dragPreview?.subgraphPositions || {}).map(subgraphVisualId)
    ]);
    let sceneChanged = false;
    const restored = promotedRef.current.filter((item) => !desired.has(item.id));
    if (restored.length) {
      restorePromoted(restored);
      promotedRef.current = promotedRef.current.filter((item) => desired.has(item.id));
      sceneChanged = true;
    }
    for (const id of activeSubgraphIds) {
      const promoted = ensurePromoted(subgraphVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
    }
    for (const id of activeNodeIds) {
      const promoted = ensurePromoted(nodeVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
    }
    for (const [id, position] of Object.entries(dragPreview?.subgraphPositions || {})) {
      const promoted = ensurePromoted(subgraphVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
      promoted.item?.node.position(position);
    }
    for (const [id, position] of Object.entries(dragPreview?.nodePositions || {})) {
      const promoted = ensurePromoted(nodeVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
      promoted.item?.node.position(position);
    }
    return sceneChanged;
  }

  useLayoutEffect(() => {
    viewportCompositor.commitActiveVisualMutation(syncVisuals(), "active-visual-sync");
  });

  useEffect(() => () => {
    restorePromoted(promotedRef.current);
    promotedRef.current = [];
  }, []);

  return <Group ref={activeVisualGroupRef} name="canvas-active-visuals" listening={false} />;
}

function ensurePromoted(
  visualId: string,
  stage: Konva.Stage,
  activeLayer: Konva.Container,
  promoted: PromotedVisual[]
) {
  const existing = promoted.find((item) => item.id === visualId);
  if (existing) return { item: existing, created: false };
  const node = stage.findOne((candidate: Konva.Node) => candidate.id() === visualId);
  const parent = node?.getParent();
  if (!node || !parent || parent === activeLayer) return { item: null, created: false };
  const item = { id: visualId, node, parent, zIndex: node.zIndex() };
  promoted.push(item);
  node.moveTo(activeLayer);
  return { item, created: true };
}

function restorePromoted(promoted: PromotedVisual[]) {
  for (const item of promoted) item.node.moveTo(item.parent);
  for (const item of [...promoted].sort((left, right) => left.zIndex - right.zIndex)) {
    item.node.zIndex(Math.min(item.zIndex, Math.max(0, item.parent.getChildren().length - 1)));
  }
}
