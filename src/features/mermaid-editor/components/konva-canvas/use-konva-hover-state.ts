import { useEffect, useState } from "react";

import { isEdgeHitTarget } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";

type UseKonvaHoverStateArgs = {
  viewEdges: boolean;
};

export function useKonvaHoverState({ viewEdges }: UseKonvaHoverStateArgs) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredSubgraphId, setHoveredSubgraphId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredHitTarget, setHoveredHitTarget] = useState<HitTarget>({ kind: "blank" });

  function clearHover() {
    setHoveredNodeId(null);
    setHoveredSubgraphId(null);
    setHoveredEdgeId(null);
    setHoveredHitTarget({ kind: "blank" });
  }

  function updateHoverFromHit(hit: HitTarget) {
    setHoveredHitTarget(hit);

    if (hit.kind === "node" || hit.kind === "tableCell" || hit.kind === "tableHeader") {
      setHoveredNodeId(hit.kind === "node" ? hit.id : hit.nodeId);
      setHoveredSubgraphId(null);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "nodeAnchor") {
      setHoveredNodeId(hit.nodeId);
      setHoveredSubgraphId(null);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "subgraph" || hit.kind === "subgraphTitle") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(hit.id);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "subgraphAnchor") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(hit.subgraphId);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "edge" || hit.kind === "edgeLabel") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(null);
      setHoveredEdgeId(hit.id);
      return;
    }

    if (hit.kind === "edgeEndpoint") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(null);
      setHoveredEdgeId(hit.edgeId);
      return;
    }

    clearHover();
  }

  useEffect(() => {
    if (viewEdges) return;
    setHoveredEdgeId(null);
    setHoveredHitTarget((current) => (isEdgeHitTarget(current) ? { kind: "blank" } : current));
  }, [viewEdges]);

  return {
    hoveredNodeId,
    hoveredSubgraphId,
    hoveredEdgeId,
    hoveredHitTarget,
    updateHoverFromHit,
    clearHover
  };
}
