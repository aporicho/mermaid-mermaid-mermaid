import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type Konva from "konva";
import { Group } from "react-konva";

import type { CanvasDragPreviewStore } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";
import { nodeVisualId, subgraphVisualId } from "@/features/mermaid-editor/lib/canvas-hit-target";

type PromotedVisual = {
  id: string;
  node: Konva.Node;
  parent: Konva.Container;
  zIndex: number;
};

export function CanvasActiveDragVisuals({
  sceneLayerRef,
  activeLayerRef,
  dragPreviewStore,
  activeNodeIds,
  activeSubgraphIds
}: {
  sceneLayerRef: RefObject<Konva.Layer | null>;
  activeLayerRef: RefObject<Konva.Layer | null>;
  dragPreviewStore: CanvasDragPreviewStore;
  activeNodeIds: string[];
  activeSubgraphIds: string[];
}) {
  const promotedRef = useRef<PromotedVisual[]>([]);
  const activeVisualGroupRef = useRef<Konva.Group | null>(null);
  const snapshotRef = useRef(dragPreviewStore.getSnapshot());
  const syncVisualsRef = useRef<() => void>(() => undefined);
  const activeIdsRef = useRef({ nodeIds: activeNodeIds, subgraphIds: activeSubgraphIds });
  activeIdsRef.current = { nodeIds: activeNodeIds, subgraphIds: activeSubgraphIds };

  function syncVisuals() {
    const snapshot = snapshotRef.current;
    const activeLayer = activeLayerRef.current;
    const activeVisualGroup = activeVisualGroupRef.current;
    const stage = activeVisualGroup?.getStage();
    if (!activeLayer || !activeVisualGroup || !stage) return;
    const desired = new Set([
      ...activeIdsRef.current.nodeIds.map(nodeVisualId),
      ...activeIdsRef.current.subgraphIds.map(subgraphVisualId),
      ...Object.keys(snapshot?.nodePositions || {}).map(nodeVisualId),
      ...Object.keys(snapshot?.subgraphPositions || {}).map(subgraphVisualId)
    ]);
    let sceneChanged = false;
    const restored = promotedRef.current.filter((item) => !desired.has(item.id));
    if (restored.length) {
      restorePromoted(restored);
      promotedRef.current = promotedRef.current.filter((item) => desired.has(item.id));
      sceneChanged = true;
    }
    for (const id of activeIdsRef.current.subgraphIds) {
      const promoted = ensurePromoted(subgraphVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
    }
    for (const id of activeIdsRef.current.nodeIds) {
      const promoted = ensurePromoted(nodeVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
    }
    for (const [id, position] of Object.entries(snapshot?.subgraphPositions || {})) {
      const promoted = ensurePromoted(subgraphVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
      promoted.item?.node.position(position);
    }
    for (const [id, position] of Object.entries(snapshot?.nodePositions || {})) {
      const promoted = ensurePromoted(nodeVisualId(id), stage, activeVisualGroup, promotedRef.current);
      if (promoted.created) sceneChanged = true;
      promoted.item?.node.position(position);
    }

    if (sceneChanged) sceneLayerRef.current?.drawScene();
    activeLayer.drawScene();
  }
  syncVisualsRef.current = syncVisuals;

  useLayoutEffect(syncVisuals);

  useEffect(() => dragPreviewStore.subscribe(() => {
    snapshotRef.current = dragPreviewStore.getSnapshot();
    syncVisualsRef.current();
  }), [dragPreviewStore]);

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
