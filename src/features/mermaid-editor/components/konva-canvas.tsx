"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Layer, Stage } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { AlignmentGuideOverlay, CanvasGrid } from "@/features/mermaid-editor/components/konva-canvas/canvas-overlays";
import { KonvaEdgeLayer, KonvaEdgeOverlayLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import { InlineEditOverlays } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { KonvaNodeLayer } from "@/features/mermaid-editor/components/konva-canvas/node-layer";
import { NodeActionTooltip, NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { unique } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import { KonvaSubgraphLayer } from "@/features/mermaid-editor/components/konva-canvas/subgraph-layer";
import type { CanvasLiveState } from "@/features/mermaid-editor/components/konva-canvas/types";
import { useKonvaDragDraft } from "@/features/mermaid-editor/components/konva-canvas/use-konva-drag-draft";
import {
  resolveKonvaInlineEditStyle,
  useKonvaInlineEditSession,
  useKonvaNodeEditorLayout
} from "@/features/mermaid-editor/components/konva-canvas/use-konva-inline-edit-session";
import { useKonvaMotion } from "@/features/mermaid-editor/components/konva-canvas/use-konva-motion";
import { useKonvaNodeProximity } from "@/features/mermaid-editor/components/konva-canvas/use-konva-node-proximity";
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
  isPanningButton,
  selectionVersionKey,
  type BlankClickIntent,
  type CanvasPoint,
  type HitTarget,
  type InteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction";
import { resolveKonvaHitTarget } from "@/features/mermaid-editor/lib/canvas-hit-target";
import { DEFAULT_CANVAS_GRID, type CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import { shouldRunCanvasProximity } from "@/features/mermaid-editor/lib/canvas-motion";
import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import { DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { CanvasNode, EdgeRouting, EditorMode, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import {
  DEFAULT_NODE_GEOMETRY_TOKENS,
  buildNodeGeometry,
  nodeIntersectsRect
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
import { CANVAS_VISUAL_TOKENS, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
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
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
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
  const blankClickIntentRef = useRef<BlankClickIntent | null>(null);
  const interactionGenerationRef = useRef(0);
  const selectionVersionRef = useRef(0);
  const lastSelectionKeyRef = useRef(selectionVersionKey(selection));
  const dimensions = useContainerSize(containerRef);
  const [interactionState, setInteractionState] = useState<InteractionState>(idleInteraction);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const {
    dragRef,
    subgraphDragFrameRef,
    dragDraftGraphRef,
    dragPreviewPositions,
    setDragPreviewPositionsVisual,
    scheduleDragDraftCommand,
    flushDragDraftCommand,
    clearPendingDragDraftCommand,
    clearDragRuntimeState
  } = useKonvaDragDraft({ onEditorCommand });
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
  const {
    inlineEdit,
    setInlineEdit,
    startInlineEdit,
    commitInlineEdit,
    nodeEditorRef,
    nodeEditorMeasureRef
  } = useKonvaInlineEditSession({
    graph,
    selection,
    interactionState,
    mode,
    setInteractionState,
    invalidateBlankClickIntent,
    resetInteraction,
    onEditorCommand
  });

  const dragEnabled = layoutMode === "manual";
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
  const {
    nodeProximityScale,
    syncNodeProximityRuntime,
    clearNodeProximityScales,
    updateNodeProximityScales,
    refreshNodeProximityScales,
    setLastProximityPointerScreen
  } = useKonvaNodeProximity({ currentViewport });
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
  syncNodeProximityRuntime({
    interactive: nodeProximityInteractive,
    frames: renderedNodeGeometries.map((geometry) => ({ id: geometry.id, ...geometry.frame })),
    radiusPx: runtimeMotion.canvas.proximityRadiusPx,
    maxScale: runtimeMotion.canvas.proximityMaxScale,
    durationMs: runtimeMotion.canvas.proximityDuration * 1000
  });

  useEffect(() => {
    if (!nodeProximityInteractive) {
      clearNodeProximityScales(true, { preservePointer: true });
      return;
    }

    refreshNodeProximityScales();
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
      startInlineEdit(effect.target);
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
      setLastProximityPointerScreen(pointer);
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
    clearPendingDragDraftCommand();
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
    clearPendingDragDraftCommand();
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

  function finishKonvaDrag() {
    flushDragDraftCommand();
    if (dragDraftGraphRef.current) finishDragWithMembership();
    clearDragRuntimeState();
    setAlignmentGuides([]);
    resetInteraction();
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

  const editStyle = resolveKonvaInlineEditStyle({
    inlineEdit,
    graph,
    viewFilters,
    nodeGeometryById,
    subgraphGeometryById,
    currentViewport,
    nodeProximityScale,
    worldToScreen,
    resolvedEdgeGeometry,
    edgeLabelSpec
  });
  const nodeEditorLayout = useKonvaNodeEditorLayout({
    inlineEdit,
    editStyle,
    nodeEditorMeasureRef,
    lineHeight: nodeThemeTokens.lineHeight
  });
  const activeScale = currentViewport().scale;

  const cursorClassName = interactionCursor(mode, interactionState, panningRequested, hoveredHitTarget);
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
            {viewFilters.subgraphs ? (
              <KonvaSubgraphLayer
                graph={graph}
                mode={mode}
                panningRequested={panningRequested}
                dragEnabled={dragEnabled}
                inlineEdit={inlineEdit}
                interactionState={interactionState}
                scopedSubgraphGeometries={scopedSubgraphGeometries}
                selectedSubgraphIds={selectedSubgraphIds}
                hoveredSubgraphId={hoveredSubgraphId}
                connectionTargetSubgraphId={connectionTargetSubgraphId}
                connectionInvalidSubgraphId={connectionInvalidSubgraphId}
                connectionPreview={connectionPreview}
                retargetPreview={retargetPreview}
                visualTokens={visualTokens}
                nodeThemeTokens={nodeThemeTokens}
                onStartSubgraphDrag={(subgraphId) => applyCanvasPointerLocalEffect({ type: "drag.startSubgraph", subgraphId })}
                onMoveSubgraph={moveSelectedSubgraphs}
                onEndDrag={finishKonvaDrag}
                onCanvasClick={handleCanvasClick}
                onCanvasDoubleClick={handleCanvasDoubleClick}
                onSubgraphAnchorPointerDown={(event, hit, world) => handleCanvasPointerDown(event, hit, world)}
              />
            ) : null}

            <KonvaEdgeLayer
              viewFilters={viewFilters}
              selection={selection}
              hoveredEdgeId={hoveredEdgeId}
              interactionState={interactionState}
              inlineEdit={inlineEdit}
              visualTokens={visualTokens}
              edgeLabelThemeTokens={edgeLabelThemeTokens}
              edgeLabelSpec={edgeLabelSpec}
              edgeMotion={edgeMotion}
              scopedVisibleEdges={scopedVisibleEdges}
              resolvedEdgeGeometry={resolvedEdgeGeometry}
              retargetDraft={retargetDraft}
              retargetDraftGeometry={retargetDraftGeometry}
              retargetPreview={retargetPreview}
              onCanvasClick={handleCanvasClick}
              onCanvasDoubleClick={handleCanvasDoubleClick}
              onCanvasTap={handleCanvasTap}
            />

            <KonvaNodeLayer
              viewFilters={viewFilters}
              mode={mode}
              panningRequested={panningRequested}
              dragEnabled={dragEnabled}
              selection={selection}
              inlineEdit={inlineEdit}
              interactionState={interactionState}
              hoveredNodeId={hoveredNodeId}
              connectionTargetNodeId={connectionTargetNodeId}
              connectionInvalidNodeId={connectionInvalidNodeId}
              connectionPreview={connectionPreview}
              retargetPreview={retargetPreview}
              scopedRenderedNodes={scopedRenderedNodes}
              exitingNodes={exitingNodes}
              nodeGeometryById={nodeGeometryById}
              geometrySpec={geometrySpec}
              nodeMotion={nodeMotion}
              nodeProximityScale={nodeProximityScale}
              imageDisplaySrcBySrc={imageDisplaySrcBySrc}
              runtimeCreateScale={runtimeMotion.canvas.createScale}
              visualTokens={visualTokens}
              nodeThemeTokens={nodeThemeTokens}
              onStartNodeDrag={(nodeId) => applyCanvasPointerLocalEffect({ type: "drag.startNode", nodeId })}
              onMoveNode={moveSelectedNodes}
              onEndDrag={finishKonvaDrag}
              onCanvasClick={handleCanvasClick}
              onCanvasDoubleClick={handleCanvasDoubleClick}
              onNodeContextMenu={openNodeContextMenu}
              onNodeAnchorPointerDown={(event, hit, world) => handleCanvasPointerDown(event, hit, world)}
              onOpenNodeAction={onOpenNodeAction}
            />

            <KonvaEdgeOverlayLayer
              viewFilters={viewFilters}
              mode={mode}
              hoveredHitTarget={hoveredHitTarget}
              visualTokens={visualTokens}
              retargetDraft={retargetDraft}
              connectionDraftGeometry={connectionDraftGeometry}
              connectionDraftVisual={connectionDraftVisual}
              selectionBox={selectionBox}
              selectedSingleEdge={selectedSingleEdge}
              selectedSingleEdgeGeometry={selectedSingleEdgeGeometry}
              onEdgeEndpointPointerDown={(event, hit) => handleCanvasPointerDown(event, hit)}
            />

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
