import { useEffect, useRef, useState } from "react";

import { isEdgeHitTarget } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";

type UseKonvaHoverStateArgs = {
  viewEdges: boolean;
};

export function useKonvaHoverState({ viewEdges }: UseKonvaHoverStateArgs) {
  const hoverRef = useRef<HoverState>(EMPTY_HOVER_STATE);
  const [hover, setHover] = useState<HoverState>(EMPTY_HOVER_STATE);

  function clearHover() {
    return commitHover(EMPTY_HOVER_STATE);
  }

  function updateHoverFromHit(hit: HitTarget) {
    return commitHover(hoverStateFromHit(hit));
  }

  function commitHover(next: HoverState) {
    if (sameHoverState(hoverRef.current, next)) return false;
    hoverRef.current = next;
    setHover(next);
    return true;
  }

  useEffect(() => {
    if (viewEdges) return;
    if (!isEdgeHitTarget(hoverRef.current.hoveredHitTarget)) return;
    hoverRef.current = EMPTY_HOVER_STATE;
    setHover(EMPTY_HOVER_STATE);
  }, [viewEdges]);

  return {
    ...hover,
    updateHoverFromHit,
    clearHover
  };
}

type HoverState = {
  hoveredNodeId: string | null;
  hoveredSubgraphId: string | null;
  hoveredEdgeId: string | null;
  hoveredHitTarget: HitTarget;
};

const EMPTY_HOVER_STATE: HoverState = {
  hoveredNodeId: null,
  hoveredSubgraphId: null,
  hoveredEdgeId: null,
  hoveredHitTarget: { kind: "blank" }
};

function hoverStateFromHit(hit: HitTarget): HoverState {
  if (hit.kind === "node" || hit.kind === "tableCell" || hit.kind === "tableHeader") {
    return { ...EMPTY_HOVER_STATE, hoveredNodeId: hit.kind === "node" ? hit.id : hit.nodeId, hoveredHitTarget: hit };
  }
  if (hit.kind === "nodeAnchor") return { ...EMPTY_HOVER_STATE, hoveredNodeId: hit.nodeId, hoveredHitTarget: hit };
  if (hit.kind === "subgraph" || hit.kind === "subgraphTitle") return { ...EMPTY_HOVER_STATE, hoveredSubgraphId: hit.id, hoveredHitTarget: hit };
  if (hit.kind === "subgraphAnchor") return { ...EMPTY_HOVER_STATE, hoveredSubgraphId: hit.subgraphId, hoveredHitTarget: hit };
  if (hit.kind === "edge" || hit.kind === "edgeLabel") return { ...EMPTY_HOVER_STATE, hoveredEdgeId: hit.id, hoveredHitTarget: hit };
  if (hit.kind === "edgeEndpoint") return { ...EMPTY_HOVER_STATE, hoveredEdgeId: hit.edgeId, hoveredHitTarget: hit };
  return EMPTY_HOVER_STATE;
}

function sameHoverState(left: HoverState, right: HoverState) {
  return (
    left.hoveredNodeId === right.hoveredNodeId &&
    left.hoveredSubgraphId === right.hoveredSubgraphId &&
    left.hoveredEdgeId === right.hoveredEdgeId &&
    sameHitTarget(left.hoveredHitTarget, right.hoveredHitTarget)
  );
}

function sameHitTarget(left: HitTarget, right: HitTarget) {
  if (left.kind !== right.kind) return false;
  if (left.kind === "blank" || right.kind === "blank") return true;
  if (left.kind === "node" && right.kind === "node") return left.id === right.id;
  if (left.kind === "tableCell" && right.kind === "tableCell") return left.nodeId === right.nodeId && left.rowId === right.rowId && left.columnId === right.columnId;
  if (left.kind === "tableHeader" && right.kind === "tableHeader") return left.nodeId === right.nodeId && left.columnId === right.columnId;
  if (left.kind === "nodeAnchor" && right.kind === "nodeAnchor") return left.nodeId === right.nodeId && left.anchor === right.anchor;
  if (left.kind === "subgraph" && right.kind === "subgraph") return left.id === right.id;
  if (left.kind === "subgraphTitle" && right.kind === "subgraphTitle") return left.id === right.id;
  if (left.kind === "subgraphAnchor" && right.kind === "subgraphAnchor") return left.subgraphId === right.subgraphId && left.anchor === right.anchor;
  if (left.kind === "edge" && right.kind === "edge") return left.id === right.id;
  if (left.kind === "edgeLabel" && right.kind === "edgeLabel") return left.id === right.id;
  if (left.kind === "edgeEndpoint" && right.kind === "edgeEndpoint") return left.edgeId === right.edgeId && left.side === right.side;
  return false;
}
