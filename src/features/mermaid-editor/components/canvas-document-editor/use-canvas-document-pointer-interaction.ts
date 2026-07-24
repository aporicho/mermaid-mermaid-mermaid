import type React from "react";

import { CANVAS_DOCUMENT_INTERACTION_GRAPH } from "@/features/mermaid-editor/components/canvas-document-editor/interaction-context";
import type { CanvasDocumentModel } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-model";
import { useCanvasDocumentStandardCommands } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-standard-commands";
import {
  canvasDocumentHasSelection
} from "@/features/mermaid-editor/lib/canvas-document-interaction";
import {
  createCanvasConnectorElement,
  type CanvasDocumentElement,
  type CanvasImageElement
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  dispatchStandardCanvasClick,
  dispatchStandardCanvasDoubleClick,
  dispatchStandardCanvasPointerDown,
  dispatchStandardCanvasPointerMove,
  dispatchStandardCanvasPointerUp,
  isStandardPanningButton
} from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import { canvasDocumentImageForDoubleClick } from "@/features/mermaid-editor/lib/canvas-image-window";
import { commandFromInteractionIntent } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { createStandardWheelInput, modifiersFromEvent } from "@/features/mermaid-editor/lib/interaction/input";
import { resolveInteractionIntent } from "@/features/mermaid-editor/lib/interaction/intent";

type UseCanvasDocumentPointerInteractionArgs = {
  model: CanvasDocumentModel;
  startInlineEdit: (element: CanvasDocumentElement) => void;
  onOpenImage?: (image: CanvasImageElement) => void;
};

export function useCanvasDocumentPointerInteraction({ model, startInlineEdit, onOpenImage }: UseCanvasDocumentPointerInteractionArgs) {
  const { applyStandardCommands, startDocumentResize, updateDocumentItemDrag, updateDocumentResize } = useCanvasDocumentStandardCommands({ model, startInlineEdit });

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (isStandardPanningButton(event.button)) event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const screen = model.clientScreenPoint(event.clientX, event.clientY);
    const current = model.documentRef.current;
    const hit = model.standardHitFromScreen(screen);
    const world = model.worldFromScreen(screen);

    if (model.connectorStartIdRef.current && hit.kind === "item") {
      if (model.connectorStartIdRef.current === hit.id) {
        model.setConnectorStartId(null);
        return;
      }
      const connector = createCanvasConnectorElement(current.elements, { elementId: model.connectorStartIdRef.current }, { elementId: hit.id });
      model.commitElements([...current.elements, connector], "已连接两个画布对象。");
      model.setSelectedIds([connector.id]);
      model.setConnectorStartId(null);
      model.animateCreatedElement(connector.id);
      return;
    }

    const result = dispatchStandardCanvasPointerDown({
      state: model.interactionStateRef.current,
      tool: "select",
      hit,
      button: event.button,
      screen,
      world,
      now: event.timeStamp,
      selectionVersion: model.selectionVersionRef.current,
      viewport: current.viewport,
      pointerId: event.pointerId
    });

    applyStandardCommands(result.commands);
    model.setCanvasInteractionState(result.state);
    if (result.state.kind === "resizingItem") startDocumentResize(result.state.itemId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = model.interactionStateRef.current;
    if (state.kind === "idle" || !("pointerId" in state) || state.pointerId !== event.pointerId) return;
    const screen = model.clientScreenPoint(event.clientX, event.clientY);

    if (state.kind === "panning") {
      model.updateViewportVisual({
        ...state.originViewport,
        x: state.originViewport.x + screen.x - state.startScreen.x,
        y: state.originViewport.y + screen.y - state.startScreen.y
      });
      return;
    }

    const world = model.worldFromScreen(screen);
    const result = dispatchStandardCanvasPointerMove({
      state,
      screen,
      world
    });
    applyStandardCommands(result.commands);
    model.setCanvasInteractionState(result.state);
    if (result.state.kind === "draggingItems") updateDocumentItemDrag(result.state, world);
    if (result.state.kind === "resizingItem") updateDocumentResize(result.state);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const state = model.interactionStateRef.current;
    if (state.kind === "idle" || !("pointerId" in state) || state.pointerId !== event.pointerId) return;
    const screen = model.clientScreenPoint(event.clientX, event.clientY);
    const world = model.worldFromScreen(screen);
    const hit = model.standardHitFromScreen(screen);
    model.lastPointerUpHitRef.current = hit;
    model.suppressNextClickRef.current = state.kind !== "pendingBlankPointer" && state.kind !== "pendingItemPointer" && state.kind !== "pendingGroupPointer";

    if (model.moveDraftRef.current?.changed || model.resizeDraftRef.current?.changed) model.commit(model.documentRef.current);

    const result = dispatchStandardCanvasPointerUp({
      state,
      tool: "select",
      hit,
      hasSelection: canvasDocumentHasSelection(model.selectionRef.current),
      screen,
      world,
      now: performance.now(),
      previousBlankClick: model.blankClickIntentRef.current,
      selectionVersion: model.selectionVersionRef.current,
      interactionGeneration: model.interactionGenerationRef.current,
      pointerId: event.pointerId
    });
    applyStandardCommands(result.commands);
    model.setCanvasInteractionState(result.state);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (model.suppressNextClickRef.current) {
      model.suppressNextClickRef.current = false;
      return;
    }
    const screen = model.clientScreenPoint(event.clientX, event.clientY);
    const hit = model.standardHitFromScreen(screen);
    applyStandardCommands(dispatchStandardCanvasClick({ tool: "select", hit, shiftKey: event.shiftKey }));
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    model.suppressNextClickRef.current = true;
    const screen = model.clientScreenPoint(event.clientX, event.clientY);
    const hit = model.standardHitFromScreen(screen);
    const image = canvasDocumentImageForDoubleClick(model.documentRef.current, hit);
    if (image && onOpenImage) {
      applyStandardCommands(dispatchStandardCanvasClick({ tool: "select", hit, shiftKey: false }));
      onOpenImage(image);
      return;
    }
    applyStandardCommands(dispatchStandardCanvasDoubleClick({ tool: "select", hit }));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = model.clientScreenPoint(event.clientX, event.clientY);
    const wheelInput = createStandardWheelInput({
      pointer: point,
      canvasSize: model.dimensionsRef.current,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      modifiers: modifiersFromEvent(event.nativeEvent),
      timestamp: event.timeStamp,
      interactionKind: model.interactionStateRef.current.kind
    });
    const intent = resolveInteractionIntent(
      wheelInput,
      buildInteractionContext({
        graph: CANVAS_DOCUMENT_INTERACTION_GRAPH,
        selection: {
          nodeIds: model.selectionRef.current.itemIds,
          edgeIds: model.selectionRef.current.connectionIds,
          subgraphIds: []
        },
        viewport: model.documentRef.current.viewport,
        canvasSize: model.dimensionsRef.current,
        hitTarget: { kind: "blank" },
        modifiers: wheelInput.modifiers,
        gestureState: model.interactionStateRef.current.kind
      }),
      { wheelIntentTracker: model.wheelIntentTrackerRef.current }
    );
    const command = commandFromInteractionIntent(intent);
    if (command?.type === "viewport.set") {
      model.blankClickIntentRef.current = null;
      model.updateViewportVisual(command.viewport);
    }
  }

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleClick,
    handleDoubleClick,
    handleWheel
  };
}
