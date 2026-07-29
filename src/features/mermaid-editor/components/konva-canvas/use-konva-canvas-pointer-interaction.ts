import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { KonvaCanvasModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-canvas-model";
import { pointerInputFromMoveSnapshot, pointerInputFromNativeEvent, sameInteractionState, shouldResolvePointerMove, useLatestPointerMoveFrame, type PointerMoveSnapshot } from "@/features/mermaid-editor/components/konva-canvas/pointer-interaction-runtime";
import { isPanningButton, type CanvasPoint, type HitTarget, type InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import { createCanvasGeometryHitTester, pointerTargetInteractionHit, type CanvasPointerTarget } from "@/features/mermaid-editor/lib/canvas-geometry-hit-test";
import { graphImageNodeForDoubleClick } from "@/features/mermaid-editor/lib/canvas-image-window";
import { selectOnlyNode } from "@/features/mermaid-editor/lib/editor-actions";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { resolveCanvasPointerClick, resolveCanvasPointerDoubleClick, resolveCanvasPointerDown, resolveCanvasPointerMove, resolveCanvasPointerUp, type CanvasPointerResolution } from "@/features/mermaid-editor/lib/interaction/canvas-pointer";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { modifiersFromEvent, type InteractionModifiers } from "@/features/mermaid-editor/lib/interaction/input";
import { applyCanvasPointerLocalEffect as dispatchCanvasPointerLocalEffect } from "@/features/mermaid-editor/components/konva-canvas/canvas-pointer-local-effects";
import { commandForEdgeRetarget, commandForFinishedConnection } from "@/features/mermaid-editor/components/konva-canvas/canvas-pointer-edge-commands";
import { viewportAtPanningPointer } from "@/features/mermaid-editor/components/konva-canvas/canvas-pointer-viewport";
type UseKonvaCanvasPointerInteractionArgs = {
  model: KonvaCanvasModel;
  onEditorCommand: (command: EditorCommand) => void;
};

type TableResizeDraft = { pointerId: number; nodeId: string; columnId: string; startWidth: number; startWorld: CanvasPoint };

export function useKonvaCanvasPointerInteraction({
  model,
  onEditorCommand
}: UseKonvaCanvasPointerInteractionArgs) {
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const {
    graph,
    selection,
    mode,
    panningRequested,
    viewFilters,
    edgeRouting,
    layoutMode,
    visualTokens,
    dimensions,
    interactionState,
    setInteractionState,
    inlineEdit,
    dragEnabled,
    nodeProximityInteractive,
    selectedNodeIds,
    geometrySpec,
    geometryIndex,
    nodeGeometryById,
    renderedNodeGeometries,
    renderedSubgraphGeometries,
    subgraphGeometryById,
    connectionAnchorSnapRadiusWorld,
    startInlineEdit,
    startNodeDrag,
    startSubgraphDrag,
    moveNodeDrag,
    moveSubgraphDrag,
    finishDrag,
    cancelDrag,
    clearAlignmentGuides,
    resetInteraction,
    invalidateBlankClickIntent,
    blankClickIntentRef,
    interactionGenerationRef,
    selectionVersionRef,
    hoverState,
    viewportController,
    proximity
  } = model;
  const interactionStateRef = useRef(interactionState);
  const tableResizeRef = useRef<TableResizeDraft | null>(null);
  const suppressClickUntilRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerMoveFrame = useLatestPointerMoveFrame(flushPointerMove);
  interactionStateRef.current = interactionState;

  const hitTester = useMemo(() => createCanvasGeometryHitTester({
    nodes: model.stageProps.scopedRenderedNodes,
    nodeGeometryById,
    subgraphs: model.stageProps.scopedSubgraphGeometries,
    edges: model.stageProps.scopedVisibleEdges,
    edgeGeometry: model.stageProps.resolvedEdgeGeometry,
    edgeLabelSpec: model.stageProps.edgeLabelSpec,
    visualTokens,
    specialNodeTokens: model.stageProps.specialNodeTokens,
    nodeProximityScale: model.stageProps.nodeProximityScale,
    viewNodes: viewFilters.nodes,
    viewEdges: viewFilters.edges,
    viewEdgeLabels: viewFilters.edgeLabels,
    viewSubgraphs: viewFilters.subgraphs
  }), [
    model.stageProps.edgeLabelSpec, model.stageProps.nodeProximityScale,
    model.stageProps.resolvedEdgeGeometry, model.stageProps.scopedRenderedNodes,
    model.stageProps.scopedSubgraphGeometries, model.stageProps.scopedVisibleEdges,
    model.stageProps.specialNodeTokens, nodeGeometryById, viewFilters.edgeLabels,
    viewFilters.edges, viewFilters.nodes, viewFilters.subgraphs, visualTokens
  ]);

  function hitContext() {
    return {
      viewportScale: viewportController.currentViewport().scale,
      mode,
      selection,
      interactionState: interactionStateRef.current,
      inlineEditing: Boolean(inlineEdit),
      hoveredNodeId: hoverState.hoveredNodeId,
      hoveredSubgraphId: hoverState.hoveredSubgraphId,
      connectionTargetNodeId: model.stageProps.connectionTargetNodeId,
      connectionInvalidNodeId: model.stageProps.connectionInvalidNodeId,
      connectionTargetSubgraphId: model.stageProps.connectionTargetSubgraphId,
      connectionInvalidSubgraphId: model.stageProps.connectionInvalidSubgraphId
    };
  }

  function resolveTarget(world: CanvasPoint) {
    return hitTester.resolve(world, hitContext());
  }

  function applyPointerResolution(resolution: CanvasPointerResolution, options?: { commitState?: boolean }) {
    for (const command of resolution.editorCommands) onEditorCommand(command);
    for (const effect of resolution.localEffects) applyCanvasPointerLocalEffect(effect);
    if (options?.commitState && resolution.state && !sameInteractionState(interactionStateRef.current, resolution.state)) {
      interactionStateRef.current = resolution.state;
      setInteractionState(resolution.state);
    }
  }

  function applyCanvasPointerLocalEffect(effect: CanvasPointerResolution["localEffects"][number]) {
    const pending = interactionStateRef.current;
    const dragOrigin = pending.kind === "pendingNodePointer" || pending.kind === "pendingSubgraphPointer"
      ? { screen: pending.startScreen, world: pending.startWorld }
      : undefined;
    dispatchCanvasPointerLocalEffect(effect, {
      graphNodes: graph.nodes, visualTokens, geometrySpec, renderedSubgraphGeometries,
      subgraphGeometryById, nodeGeometryById, geometryIndex,
      viewNodes: viewFilters.nodes, viewSubgraphs: viewFilters.subgraphs,
      invalidateBlankClickIntent,
      recordBlankClick: (intent) => { blankClickIntentRef.current = intent; },
      startInlineEdit, openNodeAction,
      startNodeDrag: (node) => startNodeDrag(node, dragOrigin),
      startSubgraphDrag: (id, geometry) => startSubgraphDrag(id, geometry, dragOrigin),
      finishConnection, retargetEdge, resetInteraction: resetPointerInteraction,
      onEditorCommand
    });
  }

  function interactionContextForPointer(hit: HitTarget, modifiers: Partial<InteractionModifiers>) {
    return buildInteractionContext({
      graph,
      selection,
      viewport: viewportController.currentViewport(),
      viewFilters,
      mode,
      workspaceView: "canvas",
      editableKind: "flowchart",
      edgeRouting,
      layoutMode,
      canvasSize: dimensions,
      hitTarget: hit,
      modifiers,
      gestureState: interactionStateRef.current.kind,
      editing: inlineEdit ? { kind: inlineEdit.type === "tableCell" || inlineEdit.type === "tableHeader" ? "node" : inlineEdit.type, id: inlineEdit.id, draftText: inlineEdit.value } : null
    });
  }

  function pointerCoordinates(event: { clientX: number; clientY: number }) {
    const screen = viewportController.screenPointFromClient(event.clientX, event.clientY);
    if (!screen) return null;
    viewportController.trackPointerScreenPoint(screen);
    const world = viewportController.screenToWorld(screen);
    viewportController.trackPointerWorldPoint(world);
    return { screen, world };
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerMoveFrame.cancel();
    const coordinates = pointerCoordinates(event);
    if (!coordinates) return;
    const target = resolveTarget(coordinates.world);
    const hit = pointerTargetInteractionHit(target);
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    proximity.updateNodeProximityScales(coordinates.screen);
    closeNodeContextMenu();

    if (target.kind === "tableColumnResize" && event.button === 0) {
      tableResizeRef.current = {
        pointerId: event.pointerId,
        nodeId: target.nodeId,
        columnId: target.columnId,
        startWidth: target.startWidth,
        startWorld: coordinates.world
      };
      if (!selectedNodeIds.has(target.nodeId)) onEditorCommand({ type: "selection.set", selection: selectOnlyNode(target.nodeId), source: "pointer" });
      invalidateBlankClickIntent();
      proximity.clearNodeProximityScales(true);
      event.preventDefault();
      return;
    }

    if (isPanningButton(event.button) || panningRequested) event.preventDefault();
    const world = anchorWorldPoint(target) ?? coordinates.world;
    const pointerInput = pointerInputFromNativeEvent("down", event.nativeEvent, hit, coordinates.screen, world);
    const resolution = resolveCanvasPointerDown(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers), {
      state: interactionStateRef.current, selectionVersion: selectionVersionRef.current, panningRequested, dragEnabled
    });
    if (resolution.state?.kind === "panning") viewportController.beginViewportInteraction();
    applyPointerResolution(resolution, { commitState: true });
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const coordinates = pointerCoordinates(event);
    if (!coordinates) return;

    const resize = tableResizeRef.current;
    if (resize && resize.pointerId === event.pointerId) {
      suppressClickUntilRef.current = performance.now() + 120;
      return;
    }

    const target = resolveTarget(coordinates.world);
    const hit = pointerTargetInteractionHit(target);
    const activeInteraction = interactionStateRef.current;
    if (activeInteraction.kind !== "draggingNodes" && activeInteraction.kind !== "draggingSubgraphs" && activeInteraction.kind !== "panning") {
      hoverState.updateHoverFromHit(hit);
    }

    if (activeInteraction.kind === "panning") {
      viewportController.scheduleViewportChange(viewportAtPanningPointer(activeInteraction, coordinates.screen), "pointer");
      suppressClickUntilRef.current = performance.now() + 120;
      return;
    }

    if (event.buttons !== 0 && !nodeProximityInteractive) {
      proximity.setLastProximityPointerScreen(coordinates.screen);
      proximity.clearNodeProximityScales(true, { preservePointer: true });
    } else {
      proximity.updateNodeProximityScales(coordinates.screen);
    }

    if (!shouldResolvePointerMove(activeInteraction)) return;
    pointerMoveFrame.schedule({
      hit,
      pointer: coordinates.screen,
      world: coordinates.world,
      button: event.button,
      modifiers: modifiersFromEvent(event.nativeEvent),
      timestamp: event.timeStamp
    });
  }

  function flushPointerMove(pending: PointerMoveSnapshot) {
    const pointerInput = pointerInputFromMoveSnapshot(pending);
    const previous = interactionStateRef.current;
    const result = resolveCanvasPointerMove(pointerInput, interactionContextForPointer(pending.hit, pointerInput.modifiers), {
      state: previous,
      selectionVersion: selectionVersionRef.current
    });
    applyPointerResolution(result, { commitState: true });
    const next = result.state ?? previous;
    if (next.kind === "draggingNodes") {
      moveNodeDrag(next.nodeId, pending.world);
      suppressClickUntilRef.current = performance.now() + 120;
    }
    if (next.kind === "draggingSubgraphs") {
      moveSubgraphDrag(next.subgraphId, pending.world);
      suppressClickUntilRef.current = performance.now() + 120;
    }
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const coordinates = pointerCoordinates(event);
    pointerMoveFrame.flushScheduled();
    releasePointer(event);

    const resize = tableResizeRef.current;
    if (resize && resize.pointerId === event.pointerId) {
      tableResizeRef.current = null;
      if (coordinates) {
        const width = resize.startWidth + coordinates.world.x - resize.startWorld.x;
        model.stageProps.onResizeTableColumn(resize.nodeId, resize.columnId, width);
      }
      suppressClickUntilRef.current = performance.now() + 120;
      return;
    }

    const active = interactionStateRef.current;
    if (active.kind === "panning") {
      const finalViewport = coordinates ? viewportAtPanningPointer(active, coordinates.screen) : viewportController.currentViewport();
      viewportController.finishViewportChange(finalViewport, "pointer");
      resetPointerInteraction();
      suppressClickUntilRef.current = performance.now() + 120;
      return;
    }
    if (active.kind === "draggingNodes" || active.kind === "draggingSubgraphs") {
      finishDrag();
      interactionStateRef.current = { kind: "idle" };
      suppressClickUntilRef.current = performance.now() + 120;
      return;
    }
    if (!coordinates) {
      resetPointerInteraction();
      return;
    }

    const hit = pointerTargetInteractionHit(resolveTarget(coordinates.world));
    const pointerInput = pointerInputFromNativeEvent("up", event.nativeEvent, hit, coordinates.screen, coordinates.world);
    applyPointerResolution(resolveCanvasPointerUp(
      pointerInput,
      interactionContextForPointer(hit, pointerInput.modifiers),
      {
        state: interactionStateRef.current,
        selectionVersion: selectionVersionRef.current,
        previousBlankClick: blankClickIntentRef.current,
        interactionGeneration: interactionGenerationRef.current,
        now: performance.now()
      }
    ), { commitState: true });
  }

  function handleCanvasPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    pointerMoveFrame.cancel();
    tableResizeRef.current = null;
    releasePointer(event);
    const active = interactionStateRef.current;
    if (active.kind === "draggingNodes" || active.kind === "draggingSubgraphs") cancelDrag();
    else {
      if (active.kind === "panning") viewportController.finishViewportInteraction("pointer");
      resetPointerInteraction();
    }
    clearAlignmentGuides();
    hoverState.clearHover();
  }

  function handleCanvasPointerLeave() {
    if (activePointerIdRef.current !== null) return;
    pointerMoveFrame.cancel();
    proximity.clearNodeProximityScales(false);
    clearAlignmentGuides();
    hoverState.clearHover();
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (performance.now() < suppressClickUntilRef.current) return;
    const coordinates = pointerCoordinates(event);
    if (!coordinates) return;
    const target = resolveTarget(coordinates.world);
    closeNodeContextMenu();
    if (target.kind === "tableColumnResize") return;
    if (target.kind === "tableCell") model.stageProps.onSelectTableCell(target);
    const hit = pointerTargetInteractionHit(target);
    const pointerInput = pointerInputFromNativeEvent("click", event.nativeEvent, hit, coordinates.screen, coordinates.world);
    applyPointerResolution(resolveCanvasPointerClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (performance.now() < suppressClickUntilRef.current) return;
    const coordinates = pointerCoordinates(event);
    if (!coordinates) return;
    const target = resolveTarget(coordinates.world);
    closeNodeContextMenu();
    if (target.kind === "tableColumnResize") return;
    if (target.kind === "tableCell") {
      model.stageProps.onSelectTableCell(target);
      model.stageProps.onStartTableCellEdit(target);
      return;
    }
    if (target.kind === "tableHeader") {
      model.stageProps.onStartTableHeaderEdit(target);
      return;
    }
    const hit = pointerTargetInteractionHit(target);
    const imageNode = graphImageNodeForDoubleClick(graph, hit);
    if (imageNode && model.stageProps.onOpenNodeImage) {
      invalidateBlankClickIntent();
      onEditorCommand({ type: "selection.set", selection: selectOnlyNode(imageNode.id), source: "pointer" });
      model.stageProps.onOpenNodeImage(imageNode);
      return;
    }
    const pointerInput = pointerInputFromNativeEvent("double-click", event.nativeEvent, hit, coordinates.screen, coordinates.world);
    applyPointerResolution(resolveCanvasPointerDoubleClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const coordinates = pointerCoordinates(event);
    if (!coordinates) return;
    const target = resolveTarget(coordinates.world);
    const nodeId = targetNodeId(target);
    if (!nodeId) return;
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (node) openNodeContextMenu(event.nativeEvent, node);
  }

  function releasePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    activePointerIdRef.current = null;
  }

  function anchorWorldPoint(target: CanvasPointerTarget) {
    if (target.kind === "nodeAnchor") return nodeGeometryById.get(target.nodeId)?.anchorsWorld.find((anchor) => anchor.key === target.anchor);
    if (target.kind === "subgraphAnchor") return subgraphGeometryById.get(target.subgraphId)?.anchorsWorld.find((anchor) => anchor.key === target.anchor);
    return null;
  }

  function openNodeAction(nodeId: string) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (node) model.stageProps.onOpenNodeAction?.(node);
  }

  function closeNodeContextMenu() {
    setNodeContextMenu(null);
  }

  function openNodeContextMenu(event: MouseEvent | PointerEvent, node: CanvasNode) {
    event.preventDefault();
    if (!selectedNodeIds.has(node.id)) onEditorCommand({ type: "selection.set", selection: selectOnlyNode(node.id), source: "pointer" });
    setNodeContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }

  function finishConnection(draft: Extract<InteractionState, { kind: "connectingEdge" }>) {
    const point = viewportController.pointerWorldPoint();
    if (!point) return;
    const command = commandForFinishedConnection(draft, point, edgeCommandGeometry());
    if (command) onEditorCommand(command);
  }

  function retargetEdge(edgeId: string, side: "from" | "to", point: CanvasPoint) {
    const command = commandForEdgeRetarget(edgeId, side, point, edgeCommandGeometry());
    if (command) onEditorCommand(command);
  }

  function edgeCommandGeometry() {
    return {
      graph, nodes: renderedNodeGeometries, subgraphs: renderedSubgraphGeometries,
      geometryIndex, nodeById: nodeGeometryById, subgraphById: subgraphGeometryById,
      anchorSnapRadiusWorld: connectionAnchorSnapRadiusWorld
    };
  }

  function resetPointerInteraction() {
    interactionStateRef.current = { kind: "idle" };
    resetInteraction();
  }

  return {
    stageProps: {
      nodeContextMenu,
      onCanvasPointerDown: handleCanvasPointerDown,
      onCanvasPointerMove: handleCanvasPointerMove,
      onCanvasPointerUp: handleCanvasPointerUp,
      onCanvasPointerCancel: handleCanvasPointerCancel,
      onCanvasPointerLeave: handleCanvasPointerLeave,
      onCanvasClick: handleCanvasClick,
      onCanvasDoubleClick: handleCanvasDoubleClick,
      onCanvasContextMenu: handleCanvasContextMenu,
      onCloseNodeContextMenu: closeNodeContextMenu
    }
  };
}

function targetNodeId(target: CanvasPointerTarget) {
  if (target.kind === "node") return target.id;
  if (target.kind === "tableColumnResize" || target.kind === "tableCell" || target.kind === "tableHeader" || target.kind === "nodeAnchor") return target.nodeId;
  return null;
}
