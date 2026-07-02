import { useState } from "react";

import { loadImageDimensions } from "@/features/mermaid-editor/components/canvas-document-editor/image-utils";
import type { CanvasDocumentModel } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-model";
import {
  selectCanvasDocumentConnection,
  selectCanvasDocumentItem
} from "@/features/mermaid-editor/lib/canvas-document-interaction";
import { endpointReferencesSelection } from "@/features/mermaid-editor/lib/canvas-document-rendering";
import {
  createCanvasCardElement,
  createCanvasConnectorElement,
  createCanvasImageElement,
  createCanvasShapeElement,
  createCanvasTextElement,
  type CanvasCardElement,
  type CanvasConnectorElement,
  type CanvasConnectorEndpoint,
  type CanvasDocumentElement,
  type CanvasImageElement,
  type CanvasShapeElement,
  type CanvasShapeKind,
  type CanvasTextElement
} from "@/features/mermaid-editor/lib/canvas-document";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

type UseCanvasDocumentActionsArgs = {
  model: CanvasDocumentModel;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
  onStatus?: (status: string) => void;
};

export function useCanvasDocumentActions({ model, fileRef, runtime, onStatus }: UseCanvasDocumentActionsArgs) {
  const [imageUrlDialogOpen, setImageUrlDialogOpen] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState("");

  function updateElement(id: string, patch: Partial<CanvasShapeElement | CanvasCardElement | CanvasTextElement | CanvasImageElement | CanvasConnectorElement>, status?: string) {
    model.commitElements(
      model.documentRef.current.elements.map((element) => (element.id === id ? ({ ...element, ...patch } as CanvasDocumentElement) : element)),
      status
    );
  }

  function addShape(shape: CanvasShapeKind) {
    const current = model.documentRef.current;
    const center = model.viewportCenterPoint();
    const element = createCanvasShapeElement(current.elements, center.x - 84, center.y - 48, shape);
    model.commitElements([...current.elements, element], "已添加画布形状。");
    model.setSelectedIds([element.id]);
    model.animateCreatedElement(element.id);
  }

  function addCard() {
    const current = model.documentRef.current;
    const center = model.viewportCenterPoint();
    const element = createCanvasCardElement(current.elements, center.x - 120, center.y - 78);
    model.commitElements([...current.elements, element], "已添加卡片。");
    model.setSelectedIds([element.id]);
    model.animateCreatedElement(element.id);
  }

  function addText() {
    const current = model.documentRef.current;
    const center = model.viewportCenterPoint();
    const element = createCanvasTextElement(current.elements, center.x - 110, center.y - 36);
    model.commitElements([...current.elements, element], "已添加文本框。");
    model.setSelectedIds([element.id]);
    model.animateCreatedElement(element.id);
  }

  async function addImage() {
    const current = model.documentRef.current;
    if (fileRef?.path) {
      try {
        const result = await runtime.pickImageAsset(fileRef);
        if (result.status === "ready") {
          const size = await loadImageDimensions(result.displaySrc);
          const center = model.viewportCenterPoint();
          const element = createCanvasImageElement(current.elements, center.x - size.width / 2, center.y - size.height / 2, result.src, size.width, size.height);
          model.commitElements([...model.documentRef.current.elements, element], result.copied ? "已复制并添加图片。" : "已添加图片。");
          model.setSelectedIds([element.id]);
          model.animateCreatedElement(element.id);
          return;
        }
        if (result.status === "cancelled") return;
        onStatus?.(result.status === "needs-document" ? "请先保存画布文件，再添加本地图片。" : result.message);
      } catch {
        onStatus?.("添加本地图片失败。");
      }
    }

    requestImageUrl();
  }

  function requestImageUrl() {
    setImageUrlDraft("");
    setImageUrlDialogOpen(true);
  }

  async function addImageFromUrl(src: string) {
    const trimmed = src.trim();
    if (!trimmed) return;
    setImageUrlDialogOpen(false);
    const size = await loadImageDimensions(trimmed);
    const center = model.viewportCenterPoint();
    const element = createCanvasImageElement(model.documentRef.current.elements, center.x - size.width / 2, center.y - size.height / 2, trimmed, size.width, size.height);
    model.commitElements([...model.documentRef.current.elements, element], "已添加图片。");
    model.setSelectedIds([element.id]);
    model.animateCreatedElement(element.id);
  }

  function addConnectorFromSelection() {
    const current = model.documentRef.current;
    const elementById = new Map(current.elements.map((element) => [element.id, element]));
    const candidates = model.selectedIdsRef.current
      .map((id) => elementById.get(id))
      .filter((element): element is Exclude<CanvasDocumentElement, CanvasConnectorElement> => Boolean(element && element.type !== "connector"));
    if (candidates.length === 1) {
      model.setConnectorStartId(candidates[0].id);
      onStatus?.("选择第二个对象完成连线。");
      return;
    }
    const center = model.viewportCenterPoint();
    const from: CanvasConnectorEndpoint = candidates[0] ? { elementId: candidates[0].id } : { point: { x: center.x - 120, y: center.y } };
    const to: CanvasConnectorEndpoint = candidates[1] ? { elementId: candidates[1].id } : { point: { x: center.x + 120, y: center.y } };
    const element = createCanvasConnectorElement(current.elements, from, to);
    model.commitElements([...current.elements, element], "已添加连线。");
    model.setSelectedIds([element.id]);
    model.setConnectorStartId(null);
    model.animateCreatedElement(element.id);
  }

  function deleteSelection() {
    const currentSelectedIds = model.selectedIdsRef.current;
    if (!currentSelectedIds.length) return;
    const selected = new Set(currentSelectedIds);
    model.commitElements(
      model.documentRef.current.elements.filter((element) => {
        if (selected.has(element.id)) return false;
        if (element.type !== "connector") return true;
        return !endpointReferencesSelection(element.from, selected) && !endpointReferencesSelection(element.to, selected);
      }),
      "已删除选中内容。"
    );
    model.setSelectedIds([]);
    model.setConnectorStartId(null);
  }

  function resetViewport() {
    model.commitViewport({ x: 160, y: 90, scale: 1 });
    onStatus?.("已重置画布视图。");
  }

  function startInlineEdit(element: CanvasDocumentElement) {
    if (element.type === "image") return;

    model.blankClickIntentRef.current = null;
    if (element.type === "connector") {
      model.setCanvasDocumentSelection(selectCanvasDocumentConnection(model.selectionRef.current, element.id, false));
      model.setCanvasInteractionState({ kind: "editingConnectionText", connectionId: element.id });
      model.setCanvasInlineEdit({ type: "connection", id: element.id, value: element.label || "" });
      return;
    }

    model.setCanvasDocumentSelection(selectCanvasDocumentItem(model.selectionRef.current, element.id, false));
    model.setCanvasInteractionState({ kind: "editingItemText", itemId: element.id });
    model.setCanvasInlineEdit({ type: "item", id: element.id, value: element.text || "" });
  }

  function commitInlineEdit(save: boolean) {
    const current = model.inlineEditRef.current;
    if (!current) return;

    model.setCanvasInlineEdit(null);
    model.resetStandardInteraction();

    if (!save) return;
    const element = model.documentRef.current.elements.find((item) => item.id === current.id);
    if (!element) return;
    if (current.type === "connection" && element.type === "connector") {
      updateElement(element.id, { label: current.value }, "已更新连线标签。");
      return;
    }
    if (current.type === "item" && (element.type === "shape" || element.type === "text")) {
      updateElement(element.id, { text: current.value }, "已更新文本。");
    }
  }

  return {
    imageUrlDialogOpen,
    setImageUrlDialogOpen,
    imageUrlDraft,
    setImageUrlDraft,
    addShape,
    addCard,
    addText,
    addImage,
    addImageFromUrl,
    addConnectorFromSelection,
    deleteSelection,
    resetViewport,
    startInlineEdit,
    commitInlineEdit
  };
}
