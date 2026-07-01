"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { KonvaCanvasStage } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage";
import type { KonvaCanvasProps } from "@/features/mermaid-editor/components/konva-canvas/types";
import { useKonvaDragDraft } from "@/features/mermaid-editor/components/konva-canvas/use-konva-drag-draft";
import { useKonvaDragMembership } from "@/features/mermaid-editor/components/konva-canvas/use-konva-drag-membership";
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
import { selectOnlyNode } from "@/features/mermaid-editor/lib/editor-actions";
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
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import {
  DEFAULT_NODE_GEOMETRY_TOKENS,
  buildNodeGeometry,
  nodeIntersectsRect
} from "@/features/mermaid-editor/lib/node-geometry";
import {
  SUBGRAPH_GEOMETRY_TOKENS,
  subgraphAtPoint,
  subgraphIntersectsRect,
  type SubgraphGeometryTokens
} from "@/features/mermaid-editor/lib/subgraph-geometry";
import { resolveRuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import { CANVAS_VISUAL_TOKENS } from "@/features/mermaid-editor/lib/canvas-visual-state";
import {
  resolveCanvasPointerClick,
  resolveCanvasPointerDoubleClick,
  resolveCanvasPointerDown,
  resolveCanvasPointerMove,
  resolveCanvasPointerUp,
  type CanvasPointerLocalEffect,
  type CanvasPointerResolution
} from "@/features/mermaid-editor/lib/interaction/canvas-pointer";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import {
  modifiersFromEvent,
  normalizeModifiers,
  type InteractionModifiers,
  type StandardPointerInput
} from "@/features/mermaid-editor/lib/interaction/input";

export { NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";

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
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const dragRuntime = useKonvaDragDraft({ onEditorCommand });
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
    dragPreviewPositions: dragRuntime.dragPreviewPositions,
    nodeMotion,
    nodeProximityScale,
    nodeThemeTokens,
    edgeLabelThemeTokens,
    subgraphThemeTokens,
    visualTokens
  });
  const {
    alignmentGuides,
    clearAlignmentGuides,
    startNodeDrag,
    startSubgraphDrag,
    moveSelectedNodes,
    moveSelectedSubgraphs,
    finishKonvaDrag
  } = useKonvaDragMembership({
    dragRuntime,
    graph,
    selection,
    interactionState,
    selectedNodeIds,
    selectedSubgraphIds,
    dragEnabled,
    geometrySpec,
    subgraphGeometryById,
    renderedSubgraphGeometries,
    subgraphThemeTokens,
    pointerScreenPoint,
    pointerWorldPoint,
    currentViewport,
    setInteractionState,
    invalidateBlankClickIntent,
    resetInteraction,
    stopActiveMotionTweens,
    clearNodeMotionVisual,
    clearNodeProximityScales,
    onEditorCommand
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
      clearAlignmentGuides();
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

  return (
    <KonvaCanvasStage
      containerRef={containerRef}
      stageRef={stageRef}
      dimensions={dimensions}
      viewport={viewport}
      cursorClassName={cursorClassName}
      graph={graph}
      selection={selection}
      mode={mode}
      panningRequested={panningRequested}
      dragEnabled={dragEnabled}
      viewFilters={viewFilters}
      inlineEdit={inlineEdit}
      interactionState={interactionState}
      visualTokens={visualTokens}
      gridSpec={gridThemeTokens}
      nodeThemeTokens={nodeThemeTokens}
      edgeLabelThemeTokens={edgeLabelThemeTokens}
      runtimeCreateScale={runtimeMotion.canvas.createScale}
      imageDisplaySrcBySrc={imageDisplaySrcBySrc}
      alignmentGuides={alignmentGuides}
      hoveredNodeId={hoveredNodeId}
      hoveredSubgraphId={hoveredSubgraphId}
      hoveredEdgeId={hoveredEdgeId}
      hoveredHitTarget={hoveredHitTarget}
      selectedSubgraphIds={selectedSubgraphIds}
      scopedSubgraphGeometries={scopedSubgraphGeometries}
      scopedVisibleEdges={scopedVisibleEdges}
      scopedRenderedNodes={scopedRenderedNodes}
      exitingNodes={exitingNodes}
      nodeGeometryById={nodeGeometryById}
      geometrySpec={geometrySpec}
      edgeLabelSpec={edgeLabelSpec}
      edgeMotion={edgeMotion}
      nodeMotion={nodeMotion}
      nodeProximityScale={nodeProximityScale}
      resolvedEdgeGeometry={resolvedEdgeGeometry}
      selectedSingleEdge={selectedSingleEdge}
      selectedSingleEdgeGeometry={selectedSingleEdgeGeometry}
      selectionBox={selectionBox}
      retargetDraft={retargetDraft}
      connectionPreview={connectionPreview}
      connectionDraftGeometry={connectionDraftGeometry}
      connectionDraftVisual={connectionDraftVisual}
      retargetPreview={retargetPreview}
      retargetDraftGeometry={retargetDraftGeometry}
      connectionTargetNodeId={connectionTargetNodeId}
      connectionInvalidNodeId={connectionInvalidNodeId}
      connectionTargetSubgraphId={connectionTargetSubgraphId}
      connectionInvalidSubgraphId={connectionInvalidSubgraphId}
      nodeContextMenu={nodeContextMenu}
      editStyle={editStyle}
      activeScale={activeScale}
      nodeEditorLayout={nodeEditorLayout}
      nodeEditorRef={nodeEditorRef}
      nodeEditorMeasureRef={nodeEditorMeasureRef}
      onWheel={onWheel}
      onCanvasPointerDown={handleCanvasPointerDown}
      onCanvasPointerMove={handleCanvasPointerMove}
      onCanvasPointerUp={handleCanvasPointerUp}
      onCanvasPointerLeave={handleCanvasPointerLeave}
      onCanvasPointerTracking={handleCanvasPointerTracking}
      onCanvasClick={handleCanvasClick}
      onCanvasTap={handleCanvasTap}
      onCanvasDoubleClick={handleCanvasDoubleClick}
      onStartNodeDrag={(nodeId) => applyCanvasPointerLocalEffect({ type: "drag.startNode", nodeId })}
      onStartSubgraphDrag={(subgraphId) => applyCanvasPointerLocalEffect({ type: "drag.startSubgraph", subgraphId })}
      onMoveNode={moveSelectedNodes}
      onMoveSubgraph={moveSelectedSubgraphs}
      onEndDrag={finishKonvaDrag}
      onNodeContextMenu={openNodeContextMenu}
      onCloseNodeContextMenu={closeNodeContextMenu}
      onOpenNodeAction={onOpenNodeAction}
      onEditNodeAction={onEditNodeAction}
      onInlineEditChange={setInlineEdit}
      onInlineEditCommit={commitInlineEdit}
    />
  );
}
