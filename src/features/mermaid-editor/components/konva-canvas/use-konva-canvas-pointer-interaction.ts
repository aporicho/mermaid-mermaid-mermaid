import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

import type { KonvaCanvasModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-canvas-model";
import {
  pointerInputFromKonvaEvent,
  pointerInputFromMoveSnapshot,
  sameInteractionState,
  shouldResolvePointerMove,
  useLatestPointerMoveFrame,
  type KonvaCanvasPointerStageProps,
  type PointerMoveSnapshot
} from "@/features/mermaid-editor/components/konva-canvas/pointer-interaction-runtime";
import {
  isPanningButton,
  type CanvasPoint,
  type HitTarget,
  type InteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction";
import { resolveKonvaHitTarget } from "@/features/mermaid-editor/lib/canvas-hit-target";
import { graphImageNodeForDoubleClick } from "@/features/mermaid-editor/lib/canvas-image-window";
import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import { selectOnlyNode } from "@/features/mermaid-editor/lib/editor-actions";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
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
import {
  buildNodeGeometry,
  nodeIntersectsRect
} from "@/features/mermaid-editor/lib/node-geometry";
import {
  subgraphAtPoint,
  subgraphIntersectsRect
} from "@/features/mermaid-editor/lib/subgraph-geometry";

type UseKonvaCanvasPointerInteractionArgs = {
  model: KonvaCanvasModel;
  onEditorCommand: (command: EditorCommand) => void;
};

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
  const pointerMoveFrame = useLatestPointerMoveFrame(flushPointerMove);
  interactionStateRef.current = interactionState;

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
    if (options?.commitState && resolution.state && !sameInteractionState(interactionStateRef.current, resolution.state)) {
      interactionStateRef.current = resolution.state;
      setInteractionState(resolution.state);
    }
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
      const newNode = { id: "", label: "新节点", x: 0, y: 0, fill: visualTokens.surface.background };
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

    if (effect.type === "nodeAction.open") {
      const node = graph.nodes.find((item) => item.id === effect.nodeId);
      if (node) model.stageProps.onOpenNodeAction?.(node);
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
      const nodeIds = viewFilters.nodes
        ? geometryIndex.queryNodes(effect.rect).flatMap((candidate) => {
            const geometry = nodeGeometryById.get(candidate.id);
            return geometry && nodeIntersectsRect(geometry, effect.rect) ? [geometry.id] : [];
          })
        : [];
      const subgraphIds = viewFilters.subgraphs
        ? geometryIndex.querySubgraphs(effect.rect).flatMap((candidate) => {
            const geometry = subgraphGeometryById.get(candidate.id);
            return geometry && subgraphIntersectsRect(geometry, effect.rect) ? [geometry.id] : [];
          })
        : [];
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
      resetPointerInteraction();
    }
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

  function handleCanvasPointerDown(event: KonvaEventObject<MouseEvent>, explicitHit?: HitTarget, worldOverride?: CanvasPoint) {
    pointerMoveFrame.cancel();
    const pointer = viewportController.pointerScreenPoint();
    const world = worldOverride ?? viewportController.pointerWorldPoint();
    if (!pointer || !world) return;
    viewportController.trackPointerWorldPoint(world);

    proximity.updateNodeProximityScales(pointer);
    const hit = explicitHit ?? hitTargetFromEvent(event);
    if (isPanningButton(event.evt.button) || panningRequested) event.evt.preventDefault();

    const pointerInput = pointerInputFromKonvaEvent("down", event, hit, pointer, world);
    const result = resolveCanvasPointerDown(
      pointerInput,
      interactionContextForPointer(hit, pointerInput.modifiers),
      {
        state: interactionStateRef.current,
        selectionVersion: selectionVersionRef.current,
        panningRequested,
        dragEnabled
      }
    );

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerMove(event: KonvaEventObject<MouseEvent>) {
    const hit = hitTargetFromEvent(event);
    hoverState.updateHoverFromHit(hit);

    const pointer = viewportController.pointerScreenPoint();
    const world = viewportController.pointerWorldPoint();
    if (!pointer || !world) return;
    viewportController.trackPointerWorldPoint(world);

    const activeInteraction = interactionStateRef.current;
    if (activeInteraction.kind === "panning") {
      viewportController.scheduleViewportChange(
        {
          ...viewportController.currentViewport(),
          x: activeInteraction.originViewport.x + pointer.x - activeInteraction.startScreen.x,
          y: activeInteraction.originViewport.y + pointer.y - activeInteraction.startScreen.y
        },
        "pointer"
      );
      return;
    }

    if (!shouldResolvePointerMove(activeInteraction)) return;

    pointerMoveFrame.schedule({
      hit,
      pointer,
      world,
      button: event.evt.button,
      modifiers: modifiersFromEvent(event.evt),
      timestamp: event.evt.timeStamp
    });
  }

  function flushPointerMove(pending: PointerMoveSnapshot) {
    const pointerInput = pointerInputFromMoveSnapshot(pending);
    const result = resolveCanvasPointerMove(pointerInput, interactionContextForPointer(pending.hit, pointerInput.modifiers), {
      state: interactionStateRef.current,
      selectionVersion: selectionVersionRef.current
    });

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerUp(event: KonvaEventObject<MouseEvent>) {
    pointerMoveFrame.flushScheduled();
    const pointer = viewportController.pointerScreenPoint();
    const world = viewportController.pointerWorldPoint();
    if (!pointer || !world) {
      resetPointerInteraction();
      return;
    }
    viewportController.trackPointerWorldPoint(world);

    const hit = hitTargetFromEvent(event);
    const pointerInput = pointerInputFromKonvaEvent("up", event, hit, pointer, world);
    const result = resolveCanvasPointerUp(
      pointerInput,
      interactionContextForPointer(hit, pointerInput.modifiers),
      {
        state: interactionStateRef.current,
        selectionVersion: selectionVersionRef.current,
        previousBlankClick: blankClickIntentRef.current,
        interactionGeneration: interactionGenerationRef.current,
        now: performance.now()
      }
    );

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerTracking(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = viewportController.screenPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    viewportController.trackPointerWorldPoint(viewportController.screenToWorld(pointer));

    if (event.buttons !== 0 && !nodeProximityInteractive) {
      proximity.setLastProximityPointerScreen(pointer);
      proximity.clearNodeProximityScales(true, { preservePointer: true });
      return;
    }

    proximity.updateNodeProximityScales(pointer);
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
    pointerMoveFrame.cancel();
    const currentInteraction = interactionStateRef.current;
    const draggingCanvasItems = currentInteraction.kind === "draggingNodes" || currentInteraction.kind === "draggingSubgraphs";
    proximity.clearNodeProximityScales(draggingCanvasItems);
    if (!draggingCanvasItems) {
      resetPointerInteraction();
      clearAlignmentGuides();
    }
    hoverState.clearHover();
  }

  function handleCanvasClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    closeNodeContextMenu();
    const pointer = viewportController.pointerScreenPoint() || viewportController.screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const pointerInput = pointerInputFromKonvaEvent("click", event, hit, pointer, viewportController.pointerWorldPoint() || undefined);
    applyPointerResolution(resolveCanvasPointerClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasTap(event: KonvaEventObject<Event>, hit: HitTarget) {
    event.cancelBubble = true;
    closeNodeContextMenu();
    const pointer = viewportController.pointerScreenPoint();
    if (!pointer) return;
    const pointerInput: StandardPointerInput = {
      kind: "pointer",
      entry: "web-ui",
      phase: "tap",
      pointerId: 0,
      button: 0,
      screen: pointer,
      world: viewportController.pointerWorldPoint() || undefined,
      hit,
      modifiers: normalizeModifiers(undefined),
      timestamp: event.evt.timeStamp
    };

    applyPointerResolution(resolveCanvasPointerClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasDoubleClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    closeNodeContextMenu();
    const pointer = viewportController.pointerScreenPoint() || viewportController.screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const imageNode = graphImageNodeForDoubleClick(graph, hit);
    if (imageNode && model.stageProps.onOpenNodeImage) {
      invalidateBlankClickIntent();
      onEditorCommand({ type: "selection.set", selection: selectOnlyNode(imageNode.id), source: "pointer" });
      model.stageProps.onOpenNodeImage(imageNode);
      return;
    }

    const pointerInput = pointerInputFromKonvaEvent("double-click", event, hit, pointer, viewportController.pointerWorldPoint() || undefined);
    applyPointerResolution(resolveCanvasPointerDoubleClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function finishConnection(draft: Extract<InteractionState, { kind: "connectingEdge" }>) {
    const point = viewportController.pointerWorldPoint();
    if (!point) return;

    const preview = resolveConnectionPreview({
      fromId: draft.fromId,
      currentWorld: point,
      nodes: renderedNodeGeometries,
      subgraphs: renderedSubgraphGeometries,
      geometryIndex,
      nodeById: nodeGeometryById,
      subgraphById: subgraphGeometryById,
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
      geometryIndex,
      nodeById: nodeGeometryById,
      subgraphById: subgraphGeometryById,
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

  function resetPointerInteraction() {
    interactionStateRef.current = { kind: "idle" };
    resetInteraction();
  }

  const stageProps: KonvaCanvasPointerStageProps = {
    nodeContextMenu,
    onCanvasPointerDown: handleCanvasPointerDown,
    onCanvasPointerMove: handleCanvasPointerMove,
    onCanvasPointerUp: handleCanvasPointerUp,
    onCanvasPointerLeave: handleCanvasPointerLeave,
    onCanvasPointerTracking: handleCanvasPointerTracking,
    onCanvasClick: handleCanvasClick,
    onCanvasTap: handleCanvasTap,
    onCanvasDoubleClick: handleCanvasDoubleClick,
    onStartNodeDrag: (nodeId) => applyCanvasPointerLocalEffect({ type: "drag.startNode", nodeId }),
    onStartSubgraphDrag: (subgraphId) => applyCanvasPointerLocalEffect({ type: "drag.startSubgraph", subgraphId }),
    onNodeContextMenu: openNodeContextMenu,
    onCloseNodeContextMenu: closeNodeContextMenu
  };

  return { stageProps };
}
