"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Arrow, Circle, Group, Layer, Path, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { AlignmentGuideOverlay, CanvasGrid } from "@/features/mermaid-editor/components/konva-canvas/canvas-overlays";
import { EdgeMarkers, PathArrowHead } from "@/features/mermaid-editor/components/konva-canvas/edge-markers";
import { InlineEditOverlays, type InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { CanvasNodeActionBadge, NodeActionTooltip, NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImage } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import { CanvasNodeShape } from "@/features/mermaid-editor/components/konva-canvas/node-shapes";
import {
  normalizeBox,
  normalizeProximityScales,
  proximityScaleMapsEqual,
  scaleLocalPointFromCenter,
  scaleLocalRectFromCenter,
  unique
} from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { CanvasLiveState, NodeProximityRuntime } from "@/features/mermaid-editor/components/konva-canvas/types";
import { useKonvaMotion } from "@/features/mermaid-editor/components/konva-canvas/use-konva-motion";
import { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import { useKonvaViewport } from "@/features/mermaid-editor/components/konva-canvas/use-konva-viewport";
import { useKonvaHoverState } from "@/features/mermaid-editor/components/konva-canvas/use-konva-hover-state";
import { useContainerSize } from "@/features/mermaid-editor/components/konva-canvas/use-container-size";
import {
  descendantNodeIds,
  descendantSubgraphIds,
  selectOnlyNode,
  selectOnlySubgraph,
  setNodePositions,
  setNodeParent,
  setSubgraphParent
} from "@/features/mermaid-editor/lib/editor-actions";
import { computeAlignmentSnap, selectionBounds, type AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import type { DagreEdgeRoute } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import {
  idleInteraction,
  interactionCursor,
  isEditingInteraction,
  isPanningButton,
  selectionVersionKey,
  type BlankClickIntent,
  type CanvasPoint,
  type HitTarget,
  type InteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  CANVAS_HIT_NAMES,
  edgeEndpointHitId,
  edgeHitId,
  edgeLabelHitId,
  nodeAnchorHitId,
  nodeHitId,
  resolveKonvaHitTarget,
  subgraphAnchorHitId,
  subgraphHitId,
  subgraphTitleHitId
} from "@/features/mermaid-editor/lib/canvas-hit-target";
import { DEFAULT_CANVAS_GRID, type CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import {
  centerScaleTransform,
  resolveCanvasProximityScales,
  resolveNextCanvasProximityScales,
  shouldRunCanvasProximity,
  type CanvasProximityScales,
  type CanvasNodePreviewPositions
} from "@/features/mermaid-editor/lib/canvas-motion";
import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import {
  buildEdgeLabelGeometry,
  DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS,
  edgeLabelSingleLineText
} from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { CanvasNode, EdgeRouting, EditorMode, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import { normalizeImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import {
  DEFAULT_NODE_GEOMETRY_TOKENS,
  buildNodeGeometry,
  nodeIntersectsRect,
} from "@/features/mermaid-editor/lib/node-geometry";
import {
  SUBGRAPH_GEOMETRY_TOKENS,
  buildSubgraphGeometries,
  subgraphAtPoint,
  subgraphIntersectsRect,
  type SubgraphGeometryTokens,
  type SubgraphGeometry
} from "@/features/mermaid-editor/lib/subgraph-geometry";
import type { EditorThemeGeometryTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveRuntimeEditorMotion, type RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import {
  CANVAS_VISUAL_TOKENS,
  type CanvasVisualTokens,
  getAnchorVisualState,
  getConnectionDraftVisualState,
  getEdgeEndpointVisualState,
  getEdgeVisualState,
  getNodeVisualState,
  getSelectionBoxVisualState
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import {
  resolveCanvasPointerClick,
  resolveCanvasPointerDoubleClick,
  resolveCanvasPointerDown,
  resolveCanvasPointerMove,
  resolveCanvasPointerUp,
  type CanvasPointerLocalEffect,
  type CanvasPointerResolution
} from "@/features/mermaid-editor/lib/interaction/canvas-pointer";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import {
  modifiersFromEvent,
  normalizeModifiers,
  type InteractionModifiers,
  type StandardPointerInput
} from "@/features/mermaid-editor/lib/interaction/input";
import { isEdgeVisible, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { cn } from "@/lib/utils";

export { NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";

type KonvaCanvasProps = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  panningRequested: boolean;
  viewFilters: ViewFilters;
  edgeRouting: EdgeRouting;
  mermaidEdgeRoutes?: DagreEdgeRoute[];
  layoutMode: LayoutMode;
  imageDisplaySrcBySrc?: Record<string, string>;
  visualTokens?: CanvasVisualTokens;
  geometryTokens?: EditorThemeGeometryTokens;
  motion?: RuntimeEditorMotion;
  onEditorCommand: (command: EditorCommand) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onEditNodeAction?: (node: CanvasNode) => void;
  onPointerWorldChange?: (point: CanvasPoint) => void;
  onLiveStateChange?: (state: CanvasLiveState) => void;
};

export function KonvaCanvas({
  graph,
  selection,
  viewport,
  mode,
  panningRequested,
  viewFilters,
  edgeRouting,
  mermaidEdgeRoutes = [],
  layoutMode,
  imageDisplaySrcBySrc = {},
  visualTokens = CANVAS_VISUAL_TOKENS,
  geometryTokens,
  motion: motionProp,
  onEditorCommand,
  onOpenNodeAction,
  onEditNodeAction,
  onPointerWorldChange,
  onLiveStateChange
}: KonvaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const runtimeMotion = useMemo(() => motionProp ?? resolveRuntimeEditorMotion(), [motionProp]);
  const dragRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const subgraphDragFrameRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const dragDraftGraphRef = useRef<MermaidGraph | null>(null);
  const dragPreviewPositionsRef = useRef<CanvasNodePreviewPositions | null>(null);
  const dragDraftCommandFrameRef = useRef<number | null>(null);
  const pendingDragDraftCommandRef = useRef<{ positions: CanvasNodePreviewPositions; message: string } | null>(null);
  const blankClickIntentRef = useRef<BlankClickIntent | null>(null);
  const nodeProximityScaleRef = useRef<CanvasProximityScales>({});
  const nodeProximityTargetScaleRef = useRef<CanvasProximityScales>({});
  const nodeProximityFrameRef = useRef<number | null>(null);
  const nodeProximityLastTickAtRef = useRef<number | null>(null);
  const lastProximityPointerScreenRef = useRef<CanvasPoint | null>(null);
  const nodeProximityRuntimeRef = useRef<NodeProximityRuntime>({
    interactive: false,
    frames: [],
    radiusPx: 0,
    maxScale: 1,
    durationMs: 0
  });
  const interactionGenerationRef = useRef(0);
  const selectionVersionRef = useRef(0);
  const lastSelectionKeyRef = useRef(selectionVersionKey(selection));
  const dimensions = useContainerSize(containerRef);
  const [interactionState, setInteractionState] = useState<InteractionState>(idleInteraction);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const [dragPreviewPositions, setDragPreviewPositions] = useState<CanvasNodePreviewPositions | null>(null);
  const [nodeProximityScale, setNodeProximityScale] = useState<CanvasProximityScales>({});
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const {
    hoveredNodeId,
    hoveredSubgraphId,
    hoveredEdgeId,
    hoveredHitTarget,
    updateHoverFromHit,
    clearHover
  } = useKonvaHoverState({ viewEdges: viewFilters.edges });
  const {
    nodeMotion,
    edgeMotion,
    exitingNodes,
    stopActiveMotionTweens,
    clearNodeMotionVisual
  } = useKonvaMotion({ graph, selection, interactionState, runtimeMotion });
  const nodeThemeTokens = geometryTokens?.node ?? DEFAULT_NODE_GEOMETRY_TOKENS;
  const edgeLabelThemeTokens = geometryTokens?.edgeLabel ?? DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS;
  const subgraphThemeTokens: SubgraphGeometryTokens = geometryTokens?.subgraph ?? SUBGRAPH_GEOMETRY_TOKENS;
  const gridThemeTokens: CanvasGridSpec = geometryTokens?.grid ?? DEFAULT_CANVAS_GRID;
  const [nodeEditorLayout, setNodeEditorLayout] = useState({ insetTop: 0, height: nodeThemeTokens.lineHeight, scrollable: false });
  const nodeEditorRef = useRef<HTMLTextAreaElement>(null);
  const nodeEditorMeasureRef = useRef<HTMLDivElement>(null);

  const dragEnabled = layoutMode === "manual";
  const {
    selectedNodeIds,
    selectedSubgraphIds,
    geometrySpec,
    edgeLabelSpec,
    renderedNodeGeometries,
    renderedSubgraphGeometries,
    nodeGeometryById,
    subgraphGeometryById,
    resolvedEdgeGeometry,
    selectedSingleEdge,
    selectedSingleEdgeGeometry,
    selectionBox,
    retargetDraft,
    connectionPreview,
    connectionDraftGeometry,
    connectionDraftVisual,
    retargetPreview,
    retargetDraftGeometry,
    connectionTargetNodeId,
    connectionInvalidNodeId,
    connectionTargetSubgraphId,
    connectionInvalidSubgraphId,
    scopedRenderedNodes,
    scopedSubgraphGeometries,
    scopedVisibleEdges,
    connectionAnchorSnapRadiusWorld
  } = useKonvaRenderModel({
    graph,
    selection,
    viewport,
    dimensions,
    viewFilters,
    edgeRouting,
    mermaidEdgeRoutes,
    layoutMode,
    inlineEdit,
    interactionState,
    hoveredNodeId,
    hoveredSubgraphId,
    hoveredEdgeId,
    dragPreviewPositions,
    nodeMotion,
    nodeProximityScale,
    nodeThemeTokens,
    edgeLabelThemeTokens,
    subgraphThemeTokens,
    visualTokens
  });
  const nodeProximityInteractive = shouldRunCanvasProximity({
    reduced: runtimeMotion.reduced,
    viewNodes: viewFilters.nodes,
    panningRequested,
    inlineEditing: Boolean(inlineEdit),
    interactionKind: interactionState.kind,
    radiusPx: runtimeMotion.canvas.proximityRadiusPx,
    maxScale: runtimeMotion.canvas.proximityMaxScale,
    mode
  });
  nodeProximityRuntimeRef.current = {
    interactive: nodeProximityInteractive,
    frames: renderedNodeGeometries.map((geometry) => ({ id: geometry.id, ...geometry.frame })),
    radiusPx: runtimeMotion.canvas.proximityRadiusPx,
    maxScale: runtimeMotion.canvas.proximityMaxScale,
    durationMs: runtimeMotion.canvas.proximityDuration * 1000
  };

  const {
    currentViewport,
    scheduleViewportChange,
    pointerWorldPoint,
    trackPointerWorldPoint,
    screenToWorld,
    worldToScreen,
    pointerScreenPoint,
    screenPointFromClient,
    onWheel
  } = useKonvaViewport({
    containerRef,
    stageRef,
    dimensions,
    viewport,
    graph,
    selection,
    viewFilters,
    mode,
    edgeRouting,
    layoutMode,
    hoveredHitTarget,
    interactionState,
    onEditorCommand,
    onPointerWorldChange,
    invalidateBlankClickIntent
  });

  function setDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions | null) {
    dragPreviewPositionsRef.current = positions;
    setDragPreviewPositions(positions);
  }

  function scheduleDragDraftCommand(positions: CanvasNodePreviewPositions, message: string) {
    pendingDragDraftCommandRef.current = { positions, message };
    if (dragDraftCommandFrameRef.current !== null) return;
    dragDraftCommandFrameRef.current = window.requestAnimationFrame(() => {
      dragDraftCommandFrameRef.current = null;
      const pending = pendingDragDraftCommandRef.current;
      pendingDragDraftCommandRef.current = null;
      if (!pending) return;
      onEditorCommand({ type: "graph.draftNodePositions", positions: pending.positions, message: pending.message, syncSource: false, source: "pointer" });
    });
  }

  function flushDragDraftCommand() {
    if (dragDraftCommandFrameRef.current !== null) {
      window.cancelAnimationFrame(dragDraftCommandFrameRef.current);
      dragDraftCommandFrameRef.current = null;
    }
    const pending = pendingDragDraftCommandRef.current;
    pendingDragDraftCommandRef.current = null;
    if (!pending) return;
    onEditorCommand({ type: "graph.draftNodePositions", positions: pending.positions, message: pending.message, syncSource: false, source: "pointer" });
  }

  function clearDragRuntimeState() {
    flushDragDraftCommand();
    dragRef.current = null;
    subgraphDragFrameRef.current = null;
    dragDraftGraphRef.current = null;
    setDragPreviewPositionsVisual(null);
  }

  function stopNodeProximityAnimation() {
    if (nodeProximityFrameRef.current === null) return;
    window.cancelAnimationFrame(nodeProximityFrameRef.current);
    nodeProximityFrameRef.current = null;
    nodeProximityLastTickAtRef.current = null;
  }

  function setNodeProximityScalesVisual(scales: CanvasProximityScales) {
    const normalized = normalizeProximityScales(scales);
    if (proximityScaleMapsEqual(nodeProximityScaleRef.current, normalized)) return;
    nodeProximityScaleRef.current = normalized;
    setNodeProximityScale(normalized);
  }

  function resolveNodeProximityTargetScales() {
    const runtime = nodeProximityRuntimeRef.current;
    const pointer = lastProximityPointerScreenRef.current;
    if (!runtime.interactive || !pointer) return {};

    return resolveCanvasProximityScales({
      frames: runtime.frames,
      pointerScreen: pointer,
      viewport: currentViewport(),
      radiusPx: runtime.radiusPx,
      maxScale: runtime.maxScale
    });
  }

  function scheduleNodeProximityAnimation() {
    if (nodeProximityFrameRef.current !== null) return;
    nodeProximityFrameRef.current = window.requestAnimationFrame(stepNodeProximityAnimation);
  }

  function stepNodeProximityAnimation(now: number) {
    const previousTickAt = nodeProximityLastTickAtRef.current ?? now - 16;
    nodeProximityLastTickAtRef.current = now;
    const target = normalizeProximityScales(resolveNodeProximityTargetScales());
    nodeProximityTargetScaleRef.current = target;
    const next = resolveNextCanvasProximityScales({
      current: nodeProximityScaleRef.current,
      target,
      deltaMs: Math.max(0, now - previousTickAt),
      durationMs: nodeProximityRuntimeRef.current.durationMs
    });

    setNodeProximityScalesVisual(next);

    if (Object.keys(next).length === 0 && Object.keys(target).length === 0) {
      nodeProximityFrameRef.current = null;
      nodeProximityLastTickAtRef.current = null;
      return;
    }

    nodeProximityFrameRef.current = window.requestAnimationFrame(stepNodeProximityAnimation);
  }

  function clearNodeProximityScales(immediate = false, options: { preservePointer?: boolean } = {}) {
    if (!options.preservePointer) lastProximityPointerScreenRef.current = null;
    nodeProximityTargetScaleRef.current = {};
    if (immediate) {
      stopNodeProximityAnimation();
      setNodeProximityScalesVisual({});
      return;
    }
    scheduleNodeProximityAnimation();
  }

  function updateNodeProximityScales(pointer: CanvasPoint) {
    lastProximityPointerScreenRef.current = pointer;
    if (!nodeProximityInteractive) {
      clearNodeProximityScales(false, { preservePointer: true });
      return;
    }

    scheduleNodeProximityAnimation();
  }

  useEffect(() => {
    return () => {
      if (dragDraftCommandFrameRef.current !== null) window.cancelAnimationFrame(dragDraftCommandFrameRef.current);
      if (nodeProximityFrameRef.current !== null) window.cancelAnimationFrame(nodeProximityFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!nodeProximityInteractive) {
      clearNodeProximityScales(true, { preservePointer: true });
      return;
    }

    const pointer = lastProximityPointerScreenRef.current;
    if (pointer) updateNodeProximityScales(pointer);
    // Proximity helpers intentionally stay outside the dependency list; the listed
    // values define when the pointer-to-node distances must be recalculated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nodeProximityInteractive,
    renderedNodeGeometries,
    runtimeMotion.canvas.proximityDuration,
    runtimeMotion.canvas.proximityMaxScale,
    runtimeMotion.canvas.proximityRadiusPx,
    viewport.scale,
    viewport.x,
    viewport.y
  ]);

  useEffect(() => {
    const nextSelectionKey = selectionVersionKey(selection);
    if (nextSelectionKey === lastSelectionKeyRef.current) return;

    lastSelectionKeyRef.current = nextSelectionKey;
    selectionVersionRef.current += 1;
    blankClickIntentRef.current = null;
    interactionGenerationRef.current += 1;
  }, [selection]);

  useEffect(() => {
    invalidateBlankClickIntent();
  }, [mode, panningRequested]);

  useEffect(() => {
    onLiveStateChange?.({
      canvasSize: dimensions,
      editing: inlineEdit ? { kind: inlineEdit.type, id: inlineEdit.id, draftText: inlineEdit.value } : null,
      interaction: interactionState.kind
    });
  }, [dimensions, inlineEdit, interactionState.kind, onLiveStateChange]);

  useEffect(() => {
    if (inlineEdit?.type !== "node") return;
    const editor = nodeEditorRef.current;
    if (!editor) return;

    editor.focus();
    editor.select();
  }, [inlineEdit?.id, inlineEdit?.type]);

  useEffect(() => {
    function isTextInput(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (inlineEdit || isEditingInteraction(interactionState) || interactionState.kind !== "idle" || mode !== "select" || isTextInput(event.target)) return;
      if (selection.nodeIds.length !== 1 || selection.edgeIds.length > 0) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Enter" && event.key !== "F2") return;

      const node = graph.nodes.find((item) => item.id === selection.nodeIds[0]);
      if (!node) return;
      event.preventDefault();
      invalidateBlankClickIntent();
      setInteractionState({ kind: "editingNodeText", nodeId: node.id });
      setInlineEdit({ type: "node", id: node.id, value: node.label });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [graph.nodes, inlineEdit, interactionState, mode, selection.edgeIds.length, selection.nodeIds]);

  function invalidateBlankClickIntent() {
    blankClickIntentRef.current = null;
    interactionGenerationRef.current += 1;
  }

  function resetInteraction() {
    setInteractionState(idleInteraction);
  }

  function hitTargetFromEvent(event: KonvaEventObject<MouseEvent>): HitTarget {
    return resolveKonvaHitTarget(event.target, event.target.getStage());
  }

  function applyPointerResolution(resolution: CanvasPointerResolution, options?: { commitState?: boolean }) {
    for (const command of resolution.editorCommands) {
      onEditorCommand(command);
    }
    for (const effect of resolution.localEffects) {
      applyCanvasPointerLocalEffect(effect);
    }
    if (options?.commitState && resolution.state) setInteractionState(resolution.state);
  }

  function applyCanvasPointerLocalEffect(effect: CanvasPointerLocalEffect) {
    if (effect.type === "blankClick.invalidate") {
      invalidateBlankClickIntent();
      return;
    }

    if (effect.type === "blankClick.record") {
      blankClickIntentRef.current = effect.intent;
      return;
    }

    if (effect.type === "graph.resolveAddNodeAt") {
      const newNode = { id: "", label: "新节点", x: 0, y: 0, fill: visualTokens.colors.surface };
      const newNodeFrame = buildNodeGeometry(newNode, geometrySpec).frame;
      const parent = subgraphAtPoint(renderedSubgraphGeometries, effect.point);
      onEditorCommand({
        type: "graph.addNodeAt",
        point: {
          x: effect.point.x - newNodeFrame.width / 2,
          y: effect.point.y - newNodeFrame.height / 2,
          parentId: parent?.id
        },
        source: "pointer"
      });
      return;
    }

    if (effect.type === "inlineEdit.start") {
      if (effect.target.type === "node") {
        const node = graph.nodes.find((item) => item.id === effect.target.id);
        if (!node) return;
        setInteractionState({ kind: "editingNodeText", nodeId: node.id });
        setInlineEdit({ type: "node", id: node.id, value: node.label });
        return;
      }

      if (effect.target.type === "subgraph") {
        const subgraph = graph.subgraphs?.find((item) => item.id === effect.target.id);
        if (!subgraph) return;
        setInteractionState({ kind: "editingSubgraphTitle", subgraphId: subgraph.id });
        setInlineEdit({ type: "subgraph", id: subgraph.id, value: subgraph.title || subgraph.id });
        return;
      }

      const edge = graph.edges.find((item) => item.id === effect.target.id);
      if (!edge) return;
      setInteractionState({ kind: "editingEdgeLabel", edgeId: edge.id });
      setInlineEdit({ type: "edge", id: edge.id, value: edge.label });
      return;
    }

    if (effect.type === "drag.startNode") {
      const node = graph.nodes.find((item) => item.id === effect.nodeId);
      if (node) startNodeDrag(node);
      return;
    }

    if (effect.type === "drag.startSubgraph") {
      const geometry = subgraphGeometryById.get(effect.subgraphId);
      if (geometry) startSubgraphDrag(effect.subgraphId, geometry);
      return;
    }

    if (effect.type === "selection.resolveMarquee") {
      const nodeIds = viewFilters.nodes ? renderedNodeGeometries.filter((geometry) => nodeIntersectsRect(geometry, effect.rect)).map((geometry) => geometry.id) : [];
      const subgraphIds = viewFilters.subgraphs ? renderedSubgraphGeometries.filter((geometry) => subgraphIntersectsRect(geometry, effect.rect)).map((geometry) => geometry.id) : [];
      onEditorCommand({ type: "selection.set", selection: { nodeIds, edgeIds: [], subgraphIds, primaryId: nodeIds[0] || subgraphIds[0] }, source: "pointer" });
      return;
    }

    if (effect.type === "edge.resolveConnection") {
      finishConnection(effect.draft);
      return;
    }

    if (effect.type === "edge.resolveRetarget") {
      retargetEdge(effect.edgeId, effect.side, effect.point);
      return;
    }

    if (effect.type === "interaction.reset") {
      resetInteraction();
    }
  }

  function interactionContextForPointer(hit: HitTarget, modifiers: Partial<InteractionModifiers>) {
    return buildInteractionContext({
      graph,
      selection,
      viewport: currentViewport(),
      viewFilters,
      mode,
      workspaceView: "canvas",
      editableKind: "flowchart",
      edgeRouting,
      layoutMode,
      canvasSize: dimensions,
      hitTarget: hit,
      modifiers,
      gestureState: interactionState.kind,
      editing: inlineEdit ? { kind: inlineEdit.type, id: inlineEdit.id, draftText: inlineEdit.value } : null
    });
  }

  function standardPointerInput(
    phase: StandardPointerInput["phase"],
    event: KonvaEventObject<MouseEvent>,
    hit: HitTarget,
    screen: CanvasPoint,
    world?: CanvasPoint
  ): StandardPointerInput {
    return {
      kind: "pointer",
      entry: "web-ui",
      phase,
      pointerId: 0,
      button: event.evt.button,
      screen,
      world,
      hit,
      modifiers: modifiersFromEvent(event.evt),
      timestamp: event.evt.timeStamp
    };
  }

  function handleCanvasPointerDown(event: KonvaEventObject<MouseEvent>, explicitHit?: HitTarget, worldOverride?: CanvasPoint) {
    const pointer = pointerScreenPoint();
    const world = worldOverride ?? pointerWorldPoint();
    if (!pointer || !world) return;
    trackPointerWorldPoint(world);

    updateNodeProximityScales(pointer);
    const hit = explicitHit ?? hitTargetFromEvent(event);
    if (isPanningButton(event.evt.button) || panningRequested) event.evt.preventDefault();

    const pointerInput = standardPointerInput("down", event, hit, pointer, world);
    const result = resolveCanvasPointerDown(
      pointerInput,
      interactionContextForPointer(hit, pointerInput.modifiers),
      {
        state: interactionState,
        selectionVersion: selectionVersionRef.current,
        panningRequested,
        dragEnabled
      }
    );

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerMove(event: KonvaEventObject<MouseEvent>) {
    const hit = hitTargetFromEvent(event);
    updateHoverFromHit(hit);

    const pointer = pointerScreenPoint();
    const world = pointerWorldPoint();
    if (!pointer || !world) return;
    trackPointerWorldPoint(world);

    if (interactionState.kind === "panning") {
      scheduleViewportChange(
        {
          ...currentViewport(),
          x: interactionState.originViewport.x + pointer.x - interactionState.startScreen.x,
          y: interactionState.originViewport.y + pointer.y - interactionState.startScreen.y
        },
        "pointer"
      );
      return;
    }

    const pointerInput = standardPointerInput("move", event, hit, pointer, world);
    const result = resolveCanvasPointerMove(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers), {
      state: interactionState,
      selectionVersion: selectionVersionRef.current
    });

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerUp(event: KonvaEventObject<MouseEvent>) {
    const pointer = pointerScreenPoint();
    const world = pointerWorldPoint();
    if (!pointer || !world) {
      resetInteraction();
      return;
    }
    trackPointerWorldPoint(world);

    const hit = hitTargetFromEvent(event);
    const pointerInput = standardPointerInput("up", event, hit, pointer, world);
    const result = resolveCanvasPointerUp(
      pointerInput,
      interactionContextForPointer(hit, pointerInput.modifiers),
      {
        state: interactionState,
        selectionVersion: selectionVersionRef.current,
        previousBlankClick: blankClickIntentRef.current,
        interactionGeneration: interactionGenerationRef.current,
        now: performance.now()
      }
    );

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerTracking(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = screenPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    trackPointerWorldPoint(screenToWorld(pointer));

    if (event.buttons !== 0 && !nodeProximityInteractive) {
      lastProximityPointerScreenRef.current = pointer;
      clearNodeProximityScales(true, { preservePointer: true });
      return;
    }

    updateNodeProximityScales(pointer);
  }

  function closeNodeContextMenu() {
    setNodeContextMenu(null);
  }

  function openNodeContextMenu(event: KonvaEventObject<PointerEvent | MouseEvent>, node: CanvasNode) {
    event.evt.preventDefault();
    event.cancelBubble = true;
    if (!selectedNodeIds.has(node.id)) onEditorCommand({ type: "selection.set", selection: selectOnlyNode(node.id), source: "pointer" });
    setNodeContextMenu({ nodeId: node.id, x: event.evt.clientX, y: event.evt.clientY });
  }

  function handleCanvasPointerLeave() {
    const draggingCanvasItems = interactionState.kind === "draggingNodes" || interactionState.kind === "draggingSubgraphs";
    clearNodeProximityScales(draggingCanvasItems);
    if (!draggingCanvasItems) {
      resetInteraction();
      setAlignmentGuides([]);
    }
    clearHover();
  }

  function handleCanvasClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    closeNodeContextMenu();
    const pointer = pointerScreenPoint() || screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const pointerInput = standardPointerInput("click", event, hit, pointer, pointerWorldPoint() || undefined);
    applyPointerResolution(resolveCanvasPointerClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasTap(event: KonvaEventObject<Event>, hit: HitTarget) {
    event.cancelBubble = true;
    closeNodeContextMenu();
    const pointer = pointerScreenPoint();
    if (!pointer) return;
    const pointerInput: StandardPointerInput = {
      kind: "pointer",
      entry: "web-ui",
      phase: "tap",
      pointerId: 0,
      button: 0,
      screen: pointer,
      world: pointerWorldPoint() || undefined,
      hit,
      modifiers: normalizeModifiers(undefined),
      timestamp: event.evt.timeStamp
    };

    applyPointerResolution(resolveCanvasPointerClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasDoubleClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    closeNodeContextMenu();
    const pointer = pointerScreenPoint() || screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const pointerInput = standardPointerInput("double-click", event, hit, pointer, pointerWorldPoint() || undefined);
    applyPointerResolution(resolveCanvasPointerDoubleClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function startNodeDrag(node: CanvasNode) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const ids = selectedNodeIds.has(node.id) ? selection.nodeIds : [node.id];
    const screen = pointerScreenPoint() || { x: 0, y: 0 };
    const world = pointerWorldPoint() || { x: node.x, y: node.y };
    if (!selectedNodeIds.has(node.id)) onEditorCommand({ type: "selection.set", selection: selectOnlyNode(node.id), source: "pointer" });
    invalidateBlankClickIntent();
    setAlignmentGuides([]);
    setInteractionState({ kind: "draggingNodes", pointerId: 0, nodeId: node.id, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => ids.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    stopActiveMotionTweens();
    for (const id of Object.keys(dragRef.current)) clearNodeMotionVisual(id);
    pendingDragDraftCommandRef.current = null;
    clearNodeProximityScales(true, { preservePointer: true });
    setDragPreviewPositionsVisual(null);
    dragDraftGraphRef.current = null;
    onEditorCommand({ type: "history.capture", source: "pointer" });
  }

  function startSubgraphDrag(subgraphId: string, geometry: SubgraphGeometry) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const ids = selectedSubgraphIds.has(subgraphId) ? selection.subgraphIds || [] : [subgraphId];
    const nodeIds = unique(ids.flatMap((id) => descendantNodeIds(graph, id)));
    if (!nodeIds.length) return;
    const screen = pointerScreenPoint() || { x: 0, y: 0 };
    const world = pointerWorldPoint() || { x: geometry.frame.x, y: geometry.frame.y };
    if (!selectedSubgraphIds.has(subgraphId)) onEditorCommand({ type: "selection.set", selection: selectOnlySubgraph(subgraphId), source: "pointer" });
    invalidateBlankClickIntent();
    setAlignmentGuides([]);
    setInteractionState({ kind: "draggingSubgraphs", pointerId: 0, subgraphId, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => nodeIds.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    stopActiveMotionTweens();
    for (const id of Object.keys(dragRef.current)) clearNodeMotionVisual(id);
    pendingDragDraftCommandRef.current = null;
    clearNodeProximityScales(true, { preservePointer: true });
    setDragPreviewPositionsVisual(null);
    subgraphDragFrameRef.current = Object.fromEntries(
      ids.map((id) => {
        const item = subgraphGeometryById.get(id);
        return [id, item ? { x: item.frame.x, y: item.frame.y } : { x: geometry.frame.x, y: geometry.frame.y }];
      })
    );
    dragDraftGraphRef.current = null;
    onEditorCommand({ type: "history.capture", source: "pointer" });
  }

  function moveSelectedNodes(node: CanvasNode, target: Konva.Node) {
    if (!dragRef.current) return;
    const origin = dragRef.current[node.id];
    if (!origin) return;
    const x = target.x();
    const y = target.y();
    const deltaX = x - origin.x;
    const deltaY = y - origin.y;
    const movingRects = graph.nodes
      .filter((item) => dragRef.current?.[item.id])
      .map((item) => {
        const start = dragRef.current![item.id];
        const movedNode = {
          ...item,
          x: start.x + deltaX,
          y: start.y + deltaY
        };
        return buildNodeGeometry(movedNode, geometrySpec).alignmentRect;
      });
    const movingBounds = selectionBounds(movingRects);
    const staticRects = graph.nodes.filter((item) => !dragRef.current?.[item.id]).map((item) => buildNodeGeometry(item, geometrySpec).alignmentRect);
    const snap = movingBounds ? computeAlignmentSnap(movingBounds, staticRects, currentViewport().scale) : { dx: 0, dy: 0, guides: [] };
    const snappedDeltaX = deltaX + snap.dx;
    const snappedDeltaY = deltaY + snap.dy;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + snappedDeltaX, y: position.y + snappedDeltaY }])
    );
    const draggedPosition = positions[node.id];
    if (draggedPosition) target.position(draggedPosition);
    setAlignmentGuides(snap.guides);
    const nextGraph = setNodePositions(graph, positions);
    dragDraftGraphRef.current = nextGraph;
    setDragPreviewPositionsVisual(positions);
    scheduleDragDraftCommand(positions, "正在移动节点。");
  }

  function moveSelectedSubgraphs(subgraphId: string, target: Konva.Node) {
    if (!dragRef.current || !subgraphDragFrameRef.current) return;
    const origin = subgraphDragFrameRef.current[subgraphId];
    if (!origin) return;
    const deltaX = target.x() - origin.x;
    const deltaY = target.y() - origin.y;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + deltaX, y: position.y + deltaY }])
    );
    const draggedFrame = subgraphDragFrameRef.current[subgraphId];
    if (draggedFrame) target.position({ x: draggedFrame.x + deltaX, y: draggedFrame.y + deltaY });
    const nextGraph = setNodePositions(graph, positions);
    dragDraftGraphRef.current = nextGraph;
    setDragPreviewPositionsVisual(positions);
    scheduleDragDraftCommand(positions, "正在移动组。");
  }

  function finishDragWithMembership() {
    if (!dragDraftGraphRef.current) return;
    const movingNodeIds = Object.keys(dragRef.current || {});
    let nextGraph = dragDraftGraphRef.current;
    const ignoredSubgraphIds =
      interactionState.kind === "draggingSubgraphs" ? [interactionState.subgraphId, ...descendantSubgraphIds(graph, interactionState.subgraphId)] : [];

    for (const nodeId of movingNodeIds) {
      const node = nextGraph.nodes.find((item) => item.id === nodeId);
      if (!node) continue;
      const geometry = buildNodeGeometry(node, geometrySpec);
      const center = {
        x: geometry.frame.x + geometry.frame.width / 2,
        y: geometry.frame.y + geometry.frame.height / 2
      };
      const targetSubgraph = subgraphAtPoint(renderedSubgraphGeometries, center, ignoredSubgraphIds);
      nextGraph = setNodeParent(nextGraph, nodeId, targetSubgraph?.id);
    }

    if (interactionState.kind === "draggingSubgraphs") {
      const movingSubgraphIds = selectedSubgraphIds.has(interactionState.subgraphId) ? selection.subgraphIds || [] : [interactionState.subgraphId];
      const nextNodeGeometries = nextGraph.nodes.map((node) => buildNodeGeometry(node, geometrySpec));
      const nextSubgraphGeometries = buildSubgraphGeometries(nextGraph, nextNodeGeometries, subgraphThemeTokens);

      for (const subgraphId of movingSubgraphIds) {
        const geometry = nextSubgraphGeometries.find((item) => item.id === subgraphId);
        if (!geometry) continue;
        const center = {
          x: geometry.frame.x + geometry.frame.width / 2,
          y: geometry.frame.y + geometry.frame.height / 2
        };
        const ignored = [subgraphId, ...descendantSubgraphIds(nextGraph, subgraphId)];
        const targetSubgraph = subgraphAtPoint(renderedSubgraphGeometries, center, ignored);
        nextGraph = setSubgraphParent(nextGraph, subgraphId, targetSubgraph?.id);
      }
    }

    onEditorCommand({ type: "graph.commitDragMembership", graph: nextGraph, message: "已移动并更新组成员。", source: "pointer" });
  }

  function finishConnection(draft: Extract<InteractionState, { kind: "connectingEdge" }>) {
    const point = pointerWorldPoint();
    if (!point) return;

    const preview = resolveConnectionPreview({
      fromId: draft.fromId,
      currentWorld: point,
      nodes: renderedNodeGeometries,
      subgraphs: renderedSubgraphGeometries,
      anchorSnapRadiusWorld: connectionAnchorSnapRadiusWorld
    });
    if (!preview.valid || !preview.targetId) return;

    onEditorCommand({
      type: "graph.createEdge",
      fromId: draft.fromId,
      toId: preview.targetId,
      fromAnchor: draft.fromAnchor,
      toAnchor: preview.targetAnchor || undefined,
      message: preview.targetAnchor || draft.fromAnchor ? "已创建固定端点连线。" : "已创建连线。",
      source: "pointer"
    });
  }

  function retargetEdge(edgeId: string, side: "from" | "to", point: CanvasPoint) {
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!edge) return;

    const preview = resolveRetargetPreview({
      edge,
      side,
      currentWorld: point,
      nodes: renderedNodeGeometries,
      subgraphs: renderedSubgraphGeometries,
      anchorSnapRadiusWorld: connectionAnchorSnapRadiusWorld
    });
    if (!preview.valid || !preview.targetId) return;

    onEditorCommand({
      type: "graph.retargetEdge",
      edgeId,
      side,
      targetId: preview.targetId,
      anchor: preview.targetAnchor,
      message: preview.targetAnchor ? "已重连并固定端点。" : "已重连为自动端点。",
      source: "pointer"
    });
  }

  function commitInlineEdit(save: boolean) {
    if (!inlineEdit) return;

    if (save && inlineEdit.type === "node") {
      onEditorCommand({ type: "graph.updateNodeLabel", nodeId: inlineEdit.id, label: inlineEdit.value, message: "已更新节点文本。", source: "pointer" });
    }
    if (save && inlineEdit.type === "subgraph") {
      onEditorCommand({
        type: "graph.updateSubgraph",
        subgraphId: inlineEdit.id,
        patch: { title: inlineEdit.value },
        message: "已更新组标题。",
        source: "pointer"
      });
    }
    if (save && inlineEdit.type === "edge") {
      onEditorCommand({ type: "graph.updateEdgeLabel", edgeId: inlineEdit.id, label: inlineEdit.value, message: "已更新连线文本。", source: "pointer" });
    }
    setInlineEdit(null);
    resetInteraction();
  }

  function inlineEditStyle() {
    if (!inlineEdit) return null;
    if (inlineEdit.type === "node") {
      if (!viewFilters.nodes || !viewFilters.nodeLabels) return null;
      const geometry = nodeGeometryById.get(inlineEdit.id);
      if (!geometry) return null;
      const viewportScale = currentViewport().scale;
      const proximityScale = nodeProximityScale[inlineEdit.id] ?? 1;
      const textBox = scaleLocalRectFromCenter(geometry.textBox, geometry.frame, proximityScale);
      const screen = worldToScreen({
        x: geometry.frame.x + textBox.x,
        y: geometry.frame.y + textBox.y
      });
      return {
        left: screen.x,
        top: screen.y,
        width: textBox.width * viewportScale,
        height: textBox.height * viewportScale,
        textScale: viewportScale * proximityScale
      };
    }

    if (inlineEdit.type === "subgraph") {
      if (!viewFilters.subgraphs) return null;
      const geometry = subgraphGeometryById.get(inlineEdit.id);
      if (!geometry) return null;
      const viewportScale = currentViewport().scale;
      const screen = worldToScreen({
        x: geometry.titleBox.x,
        y: geometry.titleBox.y
      });
      return {
        left: screen.x,
        top: screen.y,
        width: geometry.titleBox.width * viewportScale,
        height: geometry.titleBox.height * viewportScale,
        textScale: viewportScale
      };
    }

    const edge = graph.edges.find((item) => item.id === inlineEdit.id);
    if (!edge || !viewFilters.edgeLabels || !isEdgeVisible(edge, graph, viewFilters)) return null;
    const geometry = resolvedEdgeGeometry(edge);
    if (!geometry) return null;
    const viewportScale = currentViewport().scale;
    const labelGeometry = buildEdgeLabelGeometry(inlineEdit.value, geometry.labelPoint, edgeLabelSpec);
    const screen = worldToScreen({ x: labelGeometry.frame.x, y: labelGeometry.frame.y });
    return {
      left: screen.x,
      top: screen.y,
      width: labelGeometry.frame.width * viewportScale,
      height: labelGeometry.frame.height * viewportScale,
      textScale: viewportScale
    };
  }

  const editStyle = inlineEditStyle();
  const activeScale = currentViewport().scale;

  useLayoutEffect(() => {
    if (inlineEdit?.type !== "node" || !editStyle) return;
    const measure = nodeEditorMeasureRef.current;
    if (!measure) return;

    const minimumHeight = nodeThemeTokens.lineHeight * editStyle.textScale;
    const measuredHeight = Math.max(minimumHeight, Math.ceil(measure.scrollHeight));
    const scrollable = measuredHeight > editStyle.height + 1;
    const height = scrollable ? editStyle.height : Math.min(editStyle.height, measuredHeight);
    const insetTop = Math.max(0, Math.floor((editStyle.height - height) / 2));

    setNodeEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [editStyle, inlineEdit?.type, inlineEdit?.value, nodeThemeTokens.lineHeight]);

  const cursorClassName = interactionCursor(mode, interactionState, panningRequested, hoveredHitTarget);
  const isEndpointHovered = (edgeId: string, side: "from" | "to") =>
    hoveredHitTarget.kind === "edgeEndpoint" && hoveredHitTarget.edgeId === edgeId && hoveredHitTarget.side === side;
  const isEndpointActive = (edgeId: string, side: "from" | "to") => retargetDraft?.edgeId === edgeId && retargetDraft.side === side;
  const hoveredActionNode = hoveredNodeId ? graph.nodes.find((node) => node.id === hoveredNodeId) : undefined;
  const hoveredAction = normalizeNodeAction(hoveredActionNode?.action);
  const hoveredActionGeometry = hoveredActionNode ? nodeGeometryById.get(hoveredActionNode.id) : undefined;

  return (
    <section className="relative h-full min-h-0 bg-card">
      <div
        ref={containerRef}
        className={cn(
          "relative h-full min-h-0 touch-none overflow-hidden overscroll-none bg-background",
          cursorClassName
        )}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
        onPointerMove={handleCanvasPointerTracking}
        onPointerLeave={handleCanvasPointerLeave}
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onWheel={onWheel}
          onMouseDown={handleCanvasPointerDown}
          onMouseMove={handleCanvasPointerMove}
          onMouseUp={handleCanvasPointerUp}
          onMouseLeave={handleCanvasPointerLeave}
        >
          {viewFilters.grid ? <CanvasGrid dimensions={dimensions} viewport={viewport} visualTokens={visualTokens} gridSpec={gridThemeTokens} /> : null}

          <Layer>
            {viewFilters.subgraphs
              ? [...scopedSubgraphGeometries]
              .sort((a, b) => a.depth - b.depth)
              .map((geometry) => {
                const subgraph = graph.subgraphs?.find((item) => item.id === geometry.id);
                if (!subgraph) return null;
                const selected = selectedSubgraphIds.has(geometry.id);
                const hovered = hoveredSubgraphId === geometry.id;
                const isEditingSubgraphTitle = inlineEdit?.type === "subgraph" && inlineEdit.id === geometry.id;
                const connectionTarget = connectionTargetSubgraphId === geometry.id;
                const connectionInvalid = connectionInvalidSubgraphId === geometry.id;
                const connectionAnchorTarget =
                  connectionPreview?.targetSubgraphId === geometry.id || connectionPreview?.invalidSubgraphId === geometry.id
                    ? connectionPreview.targetAnchor
                    : retargetPreview?.targetSubgraphId === geometry.id || retargetPreview?.invalidSubgraphId === geometry.id
                      ? retargetPreview.targetAnchor
                      : null;
                const connectionAnchorsVisible =
                  connectionPreview?.targetSubgraphId === geometry.id ||
                  connectionPreview?.invalidSubgraphId === geometry.id ||
                  retargetPreview?.targetSubgraphId === geometry.id ||
                  retargetPreview?.invalidSubgraphId === geometry.id;
                const stroke = connectionInvalid
                  ? visualTokens.colors.connectionInvalid
                  : connectionTarget || selected
                    ? visualTokens.colors.accent
                    : hovered
                      ? visualTokens.colors.accentHover
                      : visualTokens.colors.labelStroke;
                const anchorVisible =
                  mode === "select" &&
                  !inlineEdit &&
                  (selected || hovered || connectionAnchorsVisible) &&
                  interactionState.kind !== "panning" &&
                  interactionState.kind !== "draggingNodes" &&
                  interactionState.kind !== "draggingSubgraphs";

                return (
                  <Group
                    id={subgraphHitId(geometry.id)}
                    name={CANVAS_HIT_NAMES.subgraph}
                    key={geometry.id}
                    x={geometry.frame.x}
                    y={geometry.frame.y}
                    draggable={dragEnabled && mode === "select" && !panningRequested && interactionState.kind !== "panning"}
                    onDragStart={(event) => {
                      if (event.evt.button !== 0) {
                        event.target.stopDrag();
                        return;
                      }
                      applyCanvasPointerLocalEffect({ type: "drag.startSubgraph", subgraphId: geometry.id });
                    }}
                    onDragMove={(event) => moveSelectedSubgraphs(geometry.id, event.target)}
                    onDragEnd={() => {
                      flushDragDraftCommand();
                      if (dragDraftGraphRef.current) finishDragWithMembership();
                      clearDragRuntimeState();
                      setAlignmentGuides([]);
                      resetInteraction();
                    }}
                    onClick={(event) => handleCanvasClick(event, { kind: "subgraph", id: geometry.id })}
                    onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "subgraph", id: geometry.id })}
                  >
                    <Rect
                      width={geometry.frame.width}
                      height={geometry.frame.height}
                      cornerRadius={visualTokens.node.cornerRadius}
                      fill={visualTokens.colors.surface}
                      opacity={visualTokens.subgraph.fillOpacity}
                      listening={false}
                    />
                    <Rect
                      width={geometry.frame.width}
                      height={geometry.frame.height}
                      cornerRadius={visualTokens.node.cornerRadius}
                      stroke={stroke}
                      strokeWidth={selected || connectionTarget || connectionInvalid ? visualTokens.node.emphasizedStrokeWidth : visualTokens.node.strokeWidth}
                      dash={[...visualTokens.overlay.subgraphDash]}
                      fillEnabled={false}
                    />
                    <Rect
                      id={subgraphTitleHitId(geometry.id)}
                      name={CANVAS_HIT_NAMES.subgraphTitle}
                      x={geometry.titleBox.x - geometry.frame.x}
                      y={geometry.titleBox.y - geometry.frame.y}
                      width={geometry.titleBox.width}
                      height={geometry.titleBox.height}
                      cornerRadius={visualTokens.subgraph.titleCornerRadius}
                      fill={visualTokens.colors.surface}
                      stroke={stroke}
                      strokeWidth={visualTokens.subgraph.titleStrokeWidth}
                      onClick={(event) => handleCanvasClick(event, { kind: "subgraphTitle", id: geometry.id })}
                      onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "subgraphTitle", id: geometry.id })}
                    />
                    <Text
                      x={geometry.titleBox.x - geometry.frame.x + visualTokens.subgraph.titleInsetX}
                      y={geometry.titleBox.y - geometry.frame.y}
                      width={Math.max(1, geometry.titleBox.width - visualTokens.subgraph.titleInsetX * 2)}
                      height={geometry.titleBox.height}
                      align="left"
                      verticalAlign="middle"
                      text={subgraph.title || subgraph.id}
                      fontSize={visualTokens.subgraph.titleFontSize}
                      fontStyle={visualTokens.subgraph.titleFontWeight}
                      fontFamily={nodeThemeTokens.fontFamily}
                      fill={visualTokens.colors.nodeText}
                      ellipsis
                      listening={false}
                      visible={!isEditingSubgraphTitle}
                    />
                    {anchorVisible
                      ? geometry.anchorsLocal.map((anchor) => (
                          <Group
                            id={subgraphAnchorHitId(geometry.id, anchor.key)}
                            name={CANVAS_HIT_NAMES.subgraphAnchor}
                            key={`${geometry.id}-${anchor.key}`}
                            x={anchor.x}
                            y={anchor.y}
                            onMouseDown={(event) => {
                              event.cancelBubble = true;
                              handleCanvasPointerDown(event, { kind: "subgraphAnchor", subgraphId: geometry.id, anchor: anchor.key }, {
                                x: geometry.frame.x + anchor.x,
                                y: geometry.frame.y + anchor.y
                              });
                            }}
                          >
                            <Circle radius={visualTokens.anchor.radius} fill="rgba(0,0,0,0.001)" strokeEnabled={false} />
                            <Circle
                              radius={anchor.kind === "corner" ? visualTokens.anchor.radius * visualTokens.subgraph.anchorCornerScale : visualTokens.anchor.radius}
                              fill={anchor.key === connectionAnchorTarget ? visualTokens.colors.connection : visualTokens.colors.accent}
                              stroke={visualTokens.colors.anchorStroke}
                              strokeWidth={visualTokens.anchor.strokeWidth}
                              opacity={anchor.kind === "corner" ? visualTokens.subgraph.anchorCornerOpacity : 1}
                              listening={false}
                            />
                          </Group>
                        ))
                      : null}
                  </Group>
                );
              })
              : null}

            {scopedVisibleEdges.length
              ? scopedVisibleEdges.map((edge) => {
                  const baseGeometry = resolvedEdgeGeometry(edge);
                  if (!baseGeometry) return null;
                  const isRetargetPreviewEdge = retargetDraft?.edgeId === edge.id && !!retargetDraftGeometry && !!retargetPreview;
                  const geometry = isRetargetPreviewEdge ? retargetDraftGeometry : baseGeometry;
                  const edgeVisual = getEdgeVisualState({ edge, selection, hoveredEdgeId, interactionState, inlineEdit, visualTokens });
                  const edgePreviewVisual = isRetargetPreviewEdge ? getConnectionDraftVisualState({ valid: retargetPreview.valid, edge, visualTokens }) : null;
                  const edgeMotionVisual = edgeMotion[edge.id];
                  const edgeStrokeWidth = (edgePreviewVisual?.strokeWidth ?? edgeVisual.strokeWidth) + (edgeMotionVisual?.highlight ?? 0) * visualTokens.node.emphasizedStrokeWidth;
                  const shouldRenderPath = !!geometry.pathData;
                  const isEditingEdgeLabel = inlineEdit?.type === "edge" && inlineEdit.id === edge.id;
                  const edgeLabel = isEditingEdgeLabel ? inlineEdit.value : edge.label;
                  const edgeLabelGeometry = edgeLabel || isEditingEdgeLabel ? buildEdgeLabelGeometry(edgeLabel, geometry.labelPoint, edgeLabelSpec) : null;

                  return (
                    <Group key={edge.id}>
                      {shouldRenderPath ? (
                        <>
                          <Path
                            id={edgeHitId(edge.id)}
                            name={CANVAS_HIT_NAMES.edge}
                            data={geometry.pathData}
                            stroke="transparent"
                            strokeWidth={visualTokens.edge.hitStrokeWidth}
                            fillEnabled={false}
                            onClick={(event) => handleCanvasClick(event, { kind: "edge", id: edge.id })}
                            onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edge", id: edge.id })}
                            onTap={(event) => handleCanvasTap(event, { kind: "edge", id: edge.id })}
                          />
                          <Path
                            data={geometry.pathData}
                            stroke={edgePreviewVisual?.stroke ?? edgeVisual.stroke}
                            strokeWidth={edgeStrokeWidth}
                            dash={edgePreviewVisual?.dash ?? edgeVisual.dash}
                            opacity={edgePreviewVisual?.opacity ?? edgeVisual.opacity ?? 1}
                            lineCap="round"
                            lineJoin="round"
                            fillEnabled={false}
                            listening={false}
                          />
                        </>
                      ) : (
                        <>
                          <Arrow
                            id={edgeHitId(edge.id)}
                            name={CANVAS_HIT_NAMES.edge}
                            points={geometry.points}
                            stroke="transparent"
                            fill="transparent"
                            strokeWidth={visualTokens.edge.hitStrokeWidth}
                            pointerLength={0}
                            pointerWidth={0}
                            onClick={(event) => handleCanvasClick(event, { kind: "edge", id: edge.id })}
                            onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edge", id: edge.id })}
                            onTap={(event) => handleCanvasTap(event, { kind: "edge", id: edge.id })}
                          />
                          <Arrow
                            points={geometry.points}
                            stroke={edgePreviewVisual?.stroke ?? edgeVisual.stroke}
                            fill={edgePreviewVisual?.fill ?? edgeVisual.fill}
                            strokeWidth={edgeStrokeWidth}
                            dash={edgePreviewVisual?.dash ?? edgeVisual.dash}
                            opacity={edgePreviewVisual?.opacity ?? edgeVisual.opacity ?? 1}
                            lineCap="round"
                            lineJoin="round"
                            pointerLength={0}
                            pointerWidth={0}
                            listening={false}
                          />
                        </>
                      )}
                      {!edgePreviewVisual ? (
                        <EdgeMarkers edge={edge} geometry={geometry} stroke={edgeVisual.stroke} strokeWidth={edgeStrokeWidth} surfaceFill={visualTokens.colors.surface} visualTokens={visualTokens} />
                      ) : null}
                      {viewFilters.edgeLabels && edgeLabelGeometry && !isEditingEdgeLabel ? (
                        <Group
                          id={edgeLabelHitId(edge.id)}
                          name={CANVAS_HIT_NAMES.edgeLabel}
                          x={edgeLabelGeometry.frame.x}
                          y={edgeLabelGeometry.frame.y}
                          onClick={(event) => handleCanvasClick(event, { kind: "edgeLabel", id: edge.id })}
                          onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edgeLabel", id: edge.id })}
                        >
                          <Rect
                            width={edgeLabelGeometry.frame.width}
                            height={edgeLabelGeometry.frame.height}
                            cornerRadius={visualTokens.edge.labelCornerRadius}
                            fill={edgeVisual.labelFill}
                            stroke={edgeVisual.labelStroke}
                            strokeWidth={1}
                          />
                          <Text
                            x={edgeLabelGeometry.textBox.x}
                            y={edgeLabelGeometry.textBox.y}
                            width={edgeLabelGeometry.textBox.width}
                            height={edgeLabelGeometry.textBox.height}
                            align="center"
                            verticalAlign="middle"
                            text={edgeLabelSingleLineText(edgeLabel)}
                            fontSize={edgeLabelThemeTokens.fontSize}
                            fontFamily={edgeLabelThemeTokens.fontFamily}
                            lineHeight={edgeLabelThemeTokens.lineHeight / edgeLabelThemeTokens.fontSize}
                            wrap="none"
                            fill={edgeVisual.labelTextFill}
                            ellipsis
                          />
                        </Group>
                      ) : null}
                    </Group>
                  );
                })
              : null}

            {viewFilters.nodes ? scopedRenderedNodes.map((node) => {
              const geometry = nodeGeometryById.get(node.id);
              if (!geometry) return null;
              const motionVisual = nodeMotion[node.id];
              const nodeVisual = getNodeVisualState({
                nodeId: node.id,
                selection,
                hoveredNodeId,
                interactionState,
                connectionTargetNodeId,
                connectionInvalidNodeId,
                inlineEdit,
                visualTokens
              });
              const anchorVisual = getAnchorVisualState({ nodeId: node.id, mode, selection, hoveredNodeId, interactionState, inlineEdit, visualTokens });
              const connectionAnchorTarget =
                connectionPreview?.targetNodeId === node.id || connectionPreview?.invalidNodeId === node.id
                  ? connectionPreview.targetAnchor
                  : retargetPreview?.targetNodeId === node.id || retargetPreview?.invalidNodeId === node.id
                    ? retargetPreview.targetAnchor
                    : null;
              const connectionAnchorsVisible =
                connectionPreview?.targetNodeId === node.id ||
                connectionPreview?.invalidNodeId === node.id ||
                retargetPreview?.targetNodeId === node.id ||
                retargetPreview?.invalidNodeId === node.id;
              const nodeAnchorsVisible = anchorVisual.visible || connectionAnchorsVisible;
              const imageAsset = normalizeImageAsset(node.asset);
              const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
              const nodeVisualTransform = centerScaleTransform(geometry.frame);
              const proximityScale = nodeProximityScale[node.id] ?? 1;
              const visualScale = (motionVisual?.scale ?? 1) * proximityScale;

              return (
                <Group
                  id={nodeHitId(node.id)}
                  name={CANVAS_HIT_NAMES.node}
                  key={node.id}
                  x={geometry.frame.x}
                  y={geometry.frame.y}
                  opacity={motionVisual?.opacity ?? 1}
                  draggable={dragEnabled && mode === "select" && !panningRequested && interactionState.kind !== "panning"}
                  onDragStart={(event) => {
                    if (event.evt.button !== 0) {
                      event.target.stopDrag();
                      return;
                    }
                    applyCanvasPointerLocalEffect({ type: "drag.startNode", nodeId: node.id });
                  }}
                  onDragMove={(event) => moveSelectedNodes(node, event.target)}
                  onDragEnd={() => {
                    flushDragDraftCommand();
                    if (dragDraftGraphRef.current) {
                      finishDragWithMembership();
                    }
                    clearDragRuntimeState();
                    setAlignmentGuides([]);
                    resetInteraction();
                  }}
                  onClick={(event) => handleCanvasClick(event, { kind: "node", id: node.id })}
                  onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "node", id: node.id })}
                  onContextMenu={(event) => openNodeContextMenu(event, node)}
                >
                  <Group
                    x={nodeVisualTransform.x}
                    y={nodeVisualTransform.y}
                    offsetX={nodeVisualTransform.offsetX}
                    offsetY={nodeVisualTransform.offsetY}
                    scaleX={visualScale}
                    scaleY={visualScale}
                  >
                    <CanvasNodeShape
                      node={node}
                      width={geometry.frame.width}
                      height={geometry.frame.height}
                      stroke={nodeVisual.stroke}
                      strokeWidth={nodeVisual.strokeWidth + (motionVisual?.highlight ?? 0) * visualTokens.node.emphasizedStrokeWidth}
                      visualTokens={visualTokens}
                    />
                    {imageAsset && imageDisplaySrc && geometry.imageBox ? (
                      <CanvasNodeImage
                        src={imageDisplaySrc}
                        x={geometry.imageBox.x}
                        y={geometry.imageBox.y}
                        width={geometry.imageBox.width}
                        height={geometry.imageBox.height}
                        stroke={nodeVisual.stroke}
                      />
                    ) : null}
                    <Text
                      x={geometry.textBox.x}
                      y={geometry.textBox.y}
                      width={geometry.textBox.width}
                      height={geometry.textBox.height}
                      align="center"
                      verticalAlign="middle"
                      text={node.label}
                      fontSize={nodeThemeTokens.fontSize}
                      fontStyle={String(nodeThemeTokens.fontWeight)}
                      fontFamily={nodeThemeTokens.fontFamily}
                      lineHeight={nodeThemeTokens.lineHeight / nodeThemeTokens.fontSize}
                      wrap="word"
                      fill={nodeVisual.textFill}
                      ellipsis
                      visible={viewFilters.nodeLabels && !(inlineEdit?.type === "node" && inlineEdit.id === node.id)}
                    />
                    {normalizeNodeAction(node.action) ? (
                      <CanvasNodeActionBadge
                        actionKind={node.action?.kind || "url"}
                        x={Math.max(8, geometry.frame.width - 24)}
                        y={6}
                        visualTokens={visualTokens}
                        onOpen={() => onOpenNodeAction?.(node)}
                      />
                    ) : null}
                  </Group>
                  {nodeAnchorsVisible
                    ? geometry.anchorsLocal.map((anchor) => {
                        const anchorPoint = scaleLocalPointFromCenter(anchor, geometry.frame, proximityScale);
                        return (
                        <Group
                          id={nodeAnchorHitId(node.id, anchor.key)}
                          name={CANVAS_HIT_NAMES.nodeAnchor}
                          key={`${node.id}-${anchor.key}`}
                          x={anchorPoint.x}
                          y={anchorPoint.y}
                          onMouseDown={(event) => {
                            event.cancelBubble = true;
                            handleCanvasPointerDown(event, { kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key }, {
                              x: geometry.frame.x + anchorPoint.x,
                              y: geometry.frame.y + anchorPoint.y
                            });
                          }}
                        >
                          <Circle radius={anchorVisual.radius} fill="rgba(0,0,0,0.001)" strokeEnabled={false} />
                          <Circle
                            radius={anchor.kind === "corner" ? anchorVisual.radius * visualTokens.subgraph.anchorCornerScale : anchorVisual.radius}
                            fill={anchor.key === connectionAnchorTarget ? visualTokens.colors.connection : anchorVisual.fill}
                            stroke={anchorVisual.stroke}
                            strokeWidth={anchorVisual.strokeWidth}
                            opacity={anchor.kind === "corner" ? visualTokens.subgraph.anchorCornerOpacity : 1}
                            listening={false}
                          />
                        </Group>
                        );
                      })
                    : null}
                </Group>
              );
            }) : null}

            {viewFilters.nodes
              ? exitingNodes.map((node) => {
                  const geometry = buildNodeGeometry(node, geometrySpec);
                  const motionVisual = nodeMotion[node.id] ?? { x: node.x, y: node.y, opacity: 0, scale: runtimeMotion.canvas.createScale, highlight: 0 };
                  const imageAsset = normalizeImageAsset(node.asset);
                  const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
                  const nodeVisualTransform = centerScaleTransform(geometry.frame);

                  return (
                    <Group
                      key={`exiting-${node.id}`}
                      x={motionVisual.x}
                      y={motionVisual.y}
                      opacity={motionVisual.opacity}
                      listening={false}
                    >
                      <Group
                        x={nodeVisualTransform.x}
                        y={nodeVisualTransform.y}
                        offsetX={nodeVisualTransform.offsetX}
                        offsetY={nodeVisualTransform.offsetY}
                        scaleX={motionVisual.scale}
                        scaleY={motionVisual.scale}
                      >
                        <CanvasNodeShape
                          node={node}
                          width={geometry.frame.width}
                          height={geometry.frame.height}
                          stroke={visualTokens.colors.accent}
                          strokeWidth={visualTokens.node.strokeWidth + motionVisual.highlight * visualTokens.node.emphasizedStrokeWidth}
                          visualTokens={visualTokens}
                        />
                        {imageAsset && imageDisplaySrc && geometry.imageBox ? (
                          <CanvasNodeImage
                            src={imageDisplaySrc}
                            x={geometry.imageBox.x}
                            y={geometry.imageBox.y}
                            width={geometry.imageBox.width}
                            height={geometry.imageBox.height}
                            stroke={visualTokens.colors.accent}
                          />
                        ) : null}
                        <Text
                          x={geometry.textBox.x}
                          y={geometry.textBox.y}
                          width={geometry.textBox.width}
                          height={geometry.textBox.height}
                          align="center"
                          verticalAlign="middle"
                          text={node.label}
                          fontSize={nodeThemeTokens.fontSize}
                          fontStyle={String(nodeThemeTokens.fontWeight)}
                          fontFamily={nodeThemeTokens.fontFamily}
                          lineHeight={nodeThemeTokens.lineHeight / nodeThemeTokens.fontSize}
                          wrap="word"
                          fill={visualTokens.colors.nodeText}
                          ellipsis
                          visible={viewFilters.nodeLabels}
                        />
                      </Group>
                    </Group>
                  );
                })
              : null}

            {connectionDraftGeometry ? (
              connectionDraftGeometry.pathData ? (
                <Group listening={false}>
                  <Path
                    data={connectionDraftGeometry.pathData}
                    stroke={connectionDraftVisual.stroke}
                    strokeWidth={connectionDraftVisual.strokeWidth}
                    dash={connectionDraftVisual.dash}
                    opacity={connectionDraftVisual.opacity}
                    lineCap="round"
                    lineJoin="round"
                    fillEnabled={false}
                  />
                  <PathArrowHead
                    point={connectionDraftGeometry.end}
                    tangent={connectionDraftGeometry.endTangent}
                    fill={connectionDraftVisual.fill}
                    length={connectionDraftVisual.pointerLength}
                    width={connectionDraftVisual.pointerWidth}
                  />
                </Group>
              ) : (
                <Arrow points={connectionDraftGeometry.points} {...connectionDraftVisual} listening={false} />
              )
            ) : null}

            {selectionBox ? (
              <Rect
                {...normalizeBox(selectionBox)}
                {...getSelectionBoxVisualState(visualTokens)}
                listening={false}
              />
            ) : null}

            {viewFilters.edges && mode === "select" && selectedSingleEdge && selectedSingleEdgeGeometry ? (
              <>
                <Circle
                  id={edgeEndpointHitId(selectedSingleEdge.id, "from")}
                  name={CANVAS_HIT_NAMES.edgeEndpoint}
                  x={selectedSingleEdgeGeometry.start.x}
                  y={selectedSingleEdgeGeometry.start.y}
                  {...getEdgeEndpointVisualState({
                    hovered: isEndpointHovered(selectedSingleEdge.id, "from"),
                    active: isEndpointActive(selectedSingleEdge.id, "from"),
                    visualTokens
                  })}
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    handleCanvasPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "from" });
                  }}
                />
                <Circle
                  id={edgeEndpointHitId(selectedSingleEdge.id, "to")}
                  name={CANVAS_HIT_NAMES.edgeEndpoint}
                  x={selectedSingleEdgeGeometry.end.x}
                  y={selectedSingleEdgeGeometry.end.y}
                  {...getEdgeEndpointVisualState({
                    hovered: isEndpointHovered(selectedSingleEdge.id, "to"),
                    active: isEndpointActive(selectedSingleEdge.id, "to"),
                    visualTokens
                  })}
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    handleCanvasPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "to" });
                  }}
                />
              </>
            ) : null}

            {alignmentGuides.length ? <AlignmentGuideOverlay guides={alignmentGuides} visualTokens={visualTokens} /> : null}
          </Layer>
        </Stage>
        {nodeContextMenu ? (
          <NodeContextMenu
            menu={nodeContextMenu}
            node={graph.nodes.find((item) => item.id === nodeContextMenu.nodeId)}
            onClose={closeNodeContextMenu}
            onOpenNodeAction={onOpenNodeAction}
            onEditNodeAction={onEditNodeAction}
          />
        ) : null}
        {hoveredActionNode && hoveredAction && hoveredActionGeometry ? (
          <NodeActionTooltip node={hoveredActionNode} action={hoveredAction} geometry={hoveredActionGeometry} viewport={viewport} dimensions={dimensions} />
        ) : null}

        <InlineEditOverlays
          inlineEdit={inlineEdit}
          editStyle={editStyle}
          activeScale={activeScale}
          nodeEditorLayout={nodeEditorLayout}
          nodeEditorRef={nodeEditorRef}
          nodeEditorMeasureRef={nodeEditorMeasureRef}
          nodeThemeTokens={nodeThemeTokens}
          edgeLabelThemeTokens={edgeLabelThemeTokens}
          visualTokens={visualTokens}
          viewFilters={viewFilters}
          onChange={setInlineEdit}
          onCommit={commitInlineEdit}
        />
      </div>
    </section>
  );
}
