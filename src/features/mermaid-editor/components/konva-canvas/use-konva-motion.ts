import { useEffect, useRef, useState } from "react";

import type {
  CanvasEdgeMotionVisual,
  CanvasNodeMotionVisual
} from "@/features/mermaid-editor/components/konva-canvas/types";
import {
  resolveCanvasMotionChanges,
  snapshotCanvasNodes,
  type CanvasMotionNodeSnapshot
} from "@/features/mermaid-editor/lib/canvas-motion";
import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import type { CanvasNode, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { gsap } from "@/features/mermaid-editor/lib/use-gsap-motion";

type UseKonvaMotionArgs = {
  graph: MermaidGraph;
  selection: Selection;
  interactionState: InteractionState;
  runtimeMotion: RuntimeEditorMotion;
};

export function useKonvaMotion({ graph, selection, interactionState, runtimeMotion }: UseKonvaMotionArgs) {
  const previousNodeSnapshotRef = useRef<Map<string, CanvasMotionNodeSnapshot>>(snapshotCanvasNodes(graph));
  const previousFullNodeByIdRef = useRef<Map<string, CanvasNode>>(new Map(graph.nodes.map((node) => [node.id, node])));
  const previousSelectionRef = useRef(selection);
  const nodeMotionRef = useRef<Record<string, CanvasNodeMotionVisual>>({});
  const edgeMotionRef = useRef<Record<string, CanvasEdgeMotionVisual>>({});
  const activeMotionTweensRef = useRef<gsap.core.Tween[]>([]);
  const motionCommitFrameRef = useRef<number | null>(null);
  const [nodeMotion, setNodeMotion] = useState<Record<string, CanvasNodeMotionVisual>>({});
  const [edgeMotion, setEdgeMotion] = useState<Record<string, CanvasEdgeMotionVisual>>({});
  const [exitingNodes, setExitingNodes] = useState<CanvasNode[]>([]);

  function scheduleMotionCommit() {
    if (motionCommitFrameRef.current) return;
    motionCommitFrameRef.current = window.requestAnimationFrame(() => {
      motionCommitFrameRef.current = null;
      setNodeMotion({ ...nodeMotionRef.current });
      setEdgeMotion({ ...edgeMotionRef.current });
    });
  }

  function setNodeMotionVisual(id: string, visual: CanvasNodeMotionVisual) {
    nodeMotionRef.current = { ...nodeMotionRef.current, [id]: visual };
    scheduleMotionCommit();
  }

  function clearNodeMotionVisual(id: string) {
    if (!nodeMotionRef.current[id]) return;
    const next = { ...nodeMotionRef.current };
    delete next[id];
    nodeMotionRef.current = next;
    scheduleMotionCommit();
  }

  function setEdgeMotionVisual(id: string, visual: CanvasEdgeMotionVisual) {
    edgeMotionRef.current = { ...edgeMotionRef.current, [id]: visual };
    scheduleMotionCommit();
  }

  function clearEdgeMotionVisual(id: string) {
    if (!edgeMotionRef.current[id]) return;
    const next = { ...edgeMotionRef.current };
    delete next[id];
    edgeMotionRef.current = next;
    scheduleMotionCommit();
  }

  function stopActiveMotionTweens() {
    for (const tween of activeMotionTweensRef.current) tween.kill();
    activeMotionTweensRef.current = [];
  }

  function trackMotionTween(tween: gsap.core.Tween) {
    activeMotionTweensRef.current.push(tween);
  }

  function animateNodeVisual(id: string, from: CanvasNodeMotionVisual, to: CanvasNodeMotionVisual, duration: number) {
    const proxy = { ...from };
    setNodeMotionVisual(id, proxy);
    const tween = gsap.to(proxy, {
      ...to,
      duration,
      ease: runtimeMotion.ease.emphasized,
      overwrite: "auto",
      onUpdate: () => setNodeMotionVisual(id, { ...proxy }),
      onComplete: () => {
        if (to.opacity >= 1 && to.scale === 1 && to.highlight === 0) clearNodeMotionVisual(id);
      }
    });
    trackMotionTween(tween);
  }

  function animateNodeHighlight(id: string, node: CanvasNode) {
    const current = nodeMotionRef.current[id] ?? { x: node.x, y: node.y, opacity: 1, scale: runtimeMotion.canvas.selectedScale, highlight: 1 };
    const proxy = { ...current, scale: runtimeMotion.canvas.selectedScale, highlight: 1 };
    setNodeMotionVisual(id, proxy);
    const tween = gsap.to(proxy, {
      scale: 1,
      highlight: 0,
      duration: runtimeMotion.canvas.highlightDuration,
      ease: runtimeMotion.ease.standard,
      overwrite: "auto",
      onUpdate: () => setNodeMotionVisual(id, { ...proxy }),
      onComplete: () => clearNodeMotionVisual(id)
    });
    trackMotionTween(tween);
  }

  function animateEdgeHighlight(id: string) {
    const proxy = { highlight: 1 };
    setEdgeMotionVisual(id, proxy);
    const tween = gsap.to(proxy, {
      highlight: 0,
      duration: runtimeMotion.canvas.highlightDuration,
      ease: runtimeMotion.ease.standard,
      overwrite: "auto",
      onUpdate: () => setEdgeMotionVisual(id, { ...proxy }),
      onComplete: () => clearEdgeMotionVisual(id)
    });
    trackMotionTween(tween);
  }

  useEffect(() => {
    return () => {
      stopActiveMotionTweens();
      if (motionCommitFrameRef.current) window.cancelAnimationFrame(motionCommitFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const changes = resolveCanvasMotionChanges({
      previousNodes: previousNodeSnapshotRef.current,
      graph,
      previousSelection: previousSelectionRef.current,
      selection,
      motion: runtimeMotion,
      interactionKind: interactionState.kind
    });
    const currentNodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const previousFullNodeById = previousFullNodeByIdRef.current;

    previousNodeSnapshotRef.current = snapshotCanvasNodes(graph);
    previousFullNodeByIdRef.current = new Map(graph.nodes.map((node) => [node.id, node]));
    previousSelectionRef.current = selection;

    if (!changes.animateLayout && !changes.highlightedNodeIds.length && !changes.highlightedEdgeIds.length) return;

    stopActiveMotionTweens();

    if (changes.animateLayout) {
      const exiting = changes.removedNodeIds.map((id) => previousFullNodeById.get(id)).filter((node): node is CanvasNode => Boolean(node));
      if (exiting.length) setExitingNodes((current) => [...current.filter((node) => !changes.removedNodeIds.includes(node.id)), ...exiting]);

      for (const id of changes.movedNodeIds) {
        const previous = previousFullNodeById.get(id);
        const node = currentNodeById.get(id);
        if (!previous || !node) continue;
        animateNodeVisual(
          id,
          { x: previous.x, y: previous.y, opacity: 1, scale: 1, highlight: 0 },
          { x: node.x, y: node.y, opacity: 1, scale: 1, highlight: 0 },
          runtimeMotion.duration.layout
        );
      }

      for (const id of changes.createdNodeIds) {
        const node = currentNodeById.get(id);
        if (!node) continue;
        animateNodeVisual(
          id,
          { x: node.x, y: node.y, opacity: 0.75, scale: runtimeMotion.canvas.createScale, highlight: 0.35 },
          { x: node.x, y: node.y, opacity: 1, scale: 1, highlight: 0 },
          runtimeMotion.duration.fast
        );
      }

      for (const id of changes.removedNodeIds) {
        const previous = previousFullNodeById.get(id);
        if (!previous) continue;
        const proxy = { x: previous.x, y: previous.y, opacity: 1, scale: 1, highlight: 0 };
        setNodeMotionVisual(id, proxy);
        const tween = gsap.to(proxy, {
          opacity: 0,
          scale: runtimeMotion.canvas.createScale,
          duration: runtimeMotion.duration.base,
          ease: runtimeMotion.ease.exit,
          overwrite: "auto",
          onUpdate: () => setNodeMotionVisual(id, { ...proxy }),
          onComplete: () => {
            clearNodeMotionVisual(id);
            setExitingNodes((current) => current.filter((node) => node.id !== id));
          }
        });
        trackMotionTween(tween);
      }
    }

    const canAnimateSelectionHighlights = runtimeMotion.canvas.highlightDuration > 0 && interactionState.kind !== "draggingNodes" && interactionState.kind !== "draggingSubgraphs" && interactionState.kind !== "panning";
    if (canAnimateSelectionHighlights) {
      for (const id of changes.highlightedNodeIds) {
        const node = currentNodeById.get(id);
        if (node) animateNodeHighlight(id, node);
      }
      for (const id of changes.highlightedEdgeIds) animateEdgeHighlight(id);
    }
    // Animation helpers intentionally stay outside the dependency list; runtimeMotion,
    // graph, selection and interaction kind are the semantic invalidation boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, interactionState.kind, runtimeMotion, selection]);

  return {
    nodeMotion,
    edgeMotion,
    exitingNodes,
    stopActiveMotionTweens,
    clearNodeMotionVisual
  };
}
