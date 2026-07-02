import type { Point } from "@/features/mermaid-editor/components/canvas-document-editor/types";
import type { CanvasDocumentModel } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-model";
import {
  canvasDocumentMarqueeSelection,
  emptyCanvasDocumentSelection,
  isCanvasDocumentItem,
  selectCanvasDocumentConnection,
  selectCanvasDocumentItem
} from "@/features/mermaid-editor/lib/canvas-document-interaction";
import {
  canvasElementFrame,
  createCanvasConnectorElement,
  createCanvasShapeElement,
  type CanvasDocumentElement
} from "@/features/mermaid-editor/lib/canvas-document";
import type { StandardCanvasInteractionCommand, StandardCanvasInteractionState } from "@/features/mermaid-editor/lib/canvas-interaction-standard";

type UseCanvasDocumentStandardCommandsArgs = {
  model: CanvasDocumentModel;
  startInlineEdit: (element: CanvasDocumentElement) => void;
};

export function useCanvasDocumentStandardCommands({ model, startInlineEdit }: UseCanvasDocumentStandardCommandsArgs) {
  function applyStandardCommands(commands: StandardCanvasInteractionCommand[]) {
    for (const command of commands) {
      if (command.type === "blankClick.invalidate") {
        model.blankClickIntentRef.current = null;
        continue;
      }
      if (command.type === "blankClick.record") {
        model.blankClickIntentRef.current = command.intent;
        continue;
      }
      if (command.type === "selection.clear") {
        model.setCanvasDocumentSelection(emptyCanvasDocumentSelection);
        model.setConnectorStartId(null);
        continue;
      }
      if (command.type === "item.addAt") {
        const element = createCanvasShapeElement(model.documentRef.current.elements, command.point.x - 84, command.point.y - 48);
        model.commitElements([...model.documentRef.current.elements, element], "已添加画布形状。");
        model.setSelectedIds([element.id]);
        model.animateCreatedElement(element.id);
        continue;
      }
      if (command.type === "selection.selectItem") {
        model.setCanvasDocumentSelection(selectCanvasDocumentItem(model.selectionRef.current, command.id, command.additive));
        continue;
      }
      if (command.type === "selection.selectConnection") {
        model.setCanvasDocumentSelection(selectCanvasDocumentConnection(model.selectionRef.current, command.id, command.additive));
        continue;
      }
      if (command.type === "text.editStart") {
        const element = model.documentRef.current.elements.find((item) => item.id === command.target.id);
        if (element) startInlineEdit(element);
        continue;
      }
      if (command.type === "item.dragStart") {
        startDocumentItemDrag(command.itemId);
        continue;
      }
      if (command.type === "selection.marquee") {
        model.setCanvasDocumentSelection(canvasDocumentMarqueeSelection(model.documentRef.current, command.rect));
        continue;
      }
      if (command.type === "connection.finish") {
        finishStandardConnection(command.draft);
        continue;
      }
      if (command.type === "interaction.reset") model.resetStandardInteraction();
    }
  }

  function startDocumentItemDrag(itemId: string) {
    const item = model.documentRef.current.elements.find((element) => element.id === itemId);
    if (!isCanvasDocumentItem(item)) return;
    const selectedItemIds = model.selectionRef.current.itemIds.includes(itemId) ? model.selectionRef.current.itemIds : [itemId];
    if (!model.selectionRef.current.itemIds.includes(itemId)) model.setCanvasDocumentSelection(selectCanvasDocumentItem(model.selectionRef.current, itemId, false));

    const elementById = new Map(model.documentRef.current.elements.map((element) => [element.id, element]));
    const movableIds = selectedItemIds.filter((id) => isCanvasDocumentItem(elementById.get(id)));
    model.moveDraftRef.current = {
      baseDocument: model.documentRef.current,
      ids: movableIds,
      origins: Object.fromEntries(
        movableIds.map((id) => {
          const element = elementById.get(id);
          return [id, isCanvasDocumentItem(element) ? { x: element.x, y: element.y } : { x: 0, y: 0 }];
        })
      ),
      changed: false
    };
  }

  function startDocumentResize(itemId: string) {
    const element = model.documentRef.current.elements.find((item) => item.id === itemId);
    if (!isCanvasDocumentItem(element)) return;
    model.setCanvasDocumentSelection(selectCanvasDocumentItem(model.selectionRef.current, itemId, false));
    model.resizeDraftRef.current = {
      id: itemId,
      baseDocument: model.documentRef.current,
      frame: canvasElementFrame(element),
      changed: false
    };
  }

  function updateDocumentItemDrag(state: Extract<StandardCanvasInteractionState, { kind: "draggingItems" }>, currentWorld: Point) {
    const draft = model.moveDraftRef.current;
    if (!draft) return;
    const dx = currentWorld.x - state.startWorld.x;
    const dy = currentWorld.y - state.startWorld.y;
    draft.changed = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
    model.updateDocumentVisual({
      ...draft.baseDocument,
      viewport: model.documentRef.current.viewport,
      elements: draft.baseDocument.elements.map((element) => {
        if (!draft.ids.includes(element.id) || element.type === "connector") return element;
        const origin = draft.origins[element.id];
        return { ...element, x: origin.x + dx, y: origin.y + dy };
      })
    });
  }

  function updateDocumentResize(state: Extract<StandardCanvasInteractionState, { kind: "resizingItem" }>) {
    const draft = model.resizeDraftRef.current;
    if (!draft) return;
    const dx = state.currentWorld.x - state.startWorld.x;
    const dy = state.currentWorld.y - state.startWorld.y;
    draft.changed = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
    model.updateDocumentVisual({
      ...draft.baseDocument,
      viewport: model.documentRef.current.viewport,
      elements: draft.baseDocument.elements.map((element) => {
        if (element.id !== draft.id || element.type === "connector") return element;
        return { ...element, width: Math.max(32, draft.frame.width + dx), height: Math.max(32, draft.frame.height + dy) };
      })
    });
  }

  function finishStandardConnection(draft: Extract<StandardCanvasInteractionState, { kind: "connecting" }>) {
    const hit = model.lastPointerUpHitRef.current;
    if (hit.kind !== "item" || hit.id === draft.fromId) return;
    const connector = createCanvasConnectorElement(model.documentRef.current.elements, { elementId: draft.fromId }, { elementId: hit.id });
    model.commitElements([...model.documentRef.current.elements, connector], "已连接两个画布对象。");
    model.setSelectedIds([connector.id]);
    model.animateCreatedElement(connector.id);
  }

  return { applyStandardCommands, startDocumentResize, updateDocumentItemDrag, updateDocumentResize };
}
