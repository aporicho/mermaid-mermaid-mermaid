import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { animateCanvasDocumentElementCreated } from "@/features/mermaid-editor/components/canvas-document-editor/canvas-document-animation";
import { CanvasDocumentToolbar } from "@/features/mermaid-editor/components/canvas-document-editor/canvas-document-toolbar";
import { DEFAULT_DIMENSIONS, VIEWPORT_COMMIT_DELAY_MS } from "@/features/mermaid-editor/components/canvas-document-editor/constants";
import { CanvasDocumentImageUrlDialog } from "@/features/mermaid-editor/components/canvas-document-editor/image-url-dialog";
import { CanvasDocumentInlineEditOverlays } from "@/features/mermaid-editor/components/canvas-document-editor/inline-edit-overlays";
import { resolveCanvasDocumentInlineEditStyle } from "@/features/mermaid-editor/components/canvas-document-editor/inline-edit-style";
import { CANVAS_DOCUMENT_INTERACTION_GRAPH } from "@/features/mermaid-editor/components/canvas-document-editor/interaction-context";
import { loadImageDimensions } from "@/features/mermaid-editor/components/canvas-document-editor/image-utils";
import { applyPixiViewport, createPixiCanvasRuntime, destroyPixiCanvasRuntime, resizePixiRenderer, schedulePixiRender } from "@/features/mermaid-editor/components/canvas-document-editor/pixi-runtime";
import { drawSelectionOverlay, syncPixiScene } from "@/features/mermaid-editor/components/canvas-document-editor/pixi-scene";
import type {
  CanvasDocumentInlineEdit,
  CanvasDocumentMoveDraft,
  CanvasDocumentResizeDraft,
  PixiCanvasRuntime,
  Point
} from "@/features/mermaid-editor/components/canvas-document-editor/types";
import { useCanvasDocumentImageSources } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-image-sources";
import { useCanvasDocumentKeyboardShortcuts } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-keyboard-shortcuts";
import { useContainerSize } from "@/features/mermaid-editor/components/canvas-document-editor/use-container-size";
import {
  canvasDocumentHasSelection,
  canvasDocumentMarqueeSelection,
  canvasDocumentSelectedIds,
  canvasDocumentSelectionFromIds,
  canvasDocumentSelectionVersionKey,
  emptyCanvasDocumentSelection,
  isCanvasDocumentItem,
  selectCanvasDocumentConnection,
  selectCanvasDocumentItem,
  standardHitTargetFromCanvasDocumentHit,
  type CanvasDocumentSelection
} from "@/features/mermaid-editor/lib/canvas-document-interaction";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  canvasElementFrame,
  createCanvasCardElement,
  createCanvasConnectorElement,
  createCanvasImageElement,
  createCanvasShapeElement,
  createCanvasTextElement,
  normalizeCanvasDocument,
  type CanvasConnectorElement,
  type CanvasConnectorEndpoint,
  type CanvasCardElement,
  type CanvasDocument,
  type CanvasDocumentElement,
  type CanvasImageElement,
  type CanvasShapeElement,
  type CanvasShapeKind,
  type CanvasTextElement
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  canvasDocumentClientToScreen,
  canvasDocumentScreenToWorld,
  endpointReferencesSelection,
  hitCanvasDocument,
  type CanvasDocumentDimensions
} from "@/features/mermaid-editor/lib/canvas-document-rendering";
import {
  dispatchStandardCanvasClick,
  dispatchStandardCanvasDoubleClick,
  dispatchStandardCanvasPointerDown,
  dispatchStandardCanvasPointerMove,
  dispatchStandardCanvasPointerUp,
  isStandardPanningButton,
  standardIdleInteraction,
  type StandardBlankClickIntent,
  type StandardCanvasHitTarget,
  type StandardCanvasInteractionCommand,
  type StandardCanvasInteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import { createWheelIntentTracker } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import { commandFromInteractionIntent } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { createStandardWheelInput, modifiersFromEvent } from "@/features/mermaid-editor/lib/interaction/input";
import { resolveInteractionIntent } from "@/features/mermaid-editor/lib/interaction/intent";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { cn } from "@/lib/utils";

type CanvasDocumentEditorProps = {
  document: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
  onChange: (document: CanvasDocument, status?: string) => void;
  onStatus?: (status: string) => void;
};

export function CanvasDocumentEditor({ document, fileRef, runtime, onChange, onStatus }: CanvasDocumentEditorProps) {
  const normalizedDocument = useMemo(() => normalizeCanvasDocument(document), [document]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiCanvasRuntime | null>(null);
  const documentRef = useRef<CanvasDocument>(normalizedDocument);
  const dimensionsRef = useRef<CanvasDocumentDimensions>(DEFAULT_DIMENSIONS);
  const selectionRef = useRef<CanvasDocumentSelection>(emptyCanvasDocumentSelection);
  const selectedIdsRef = useRef<string[]>([]);
  const connectorStartIdRef = useRef<string | null>(null);
  const imageDisplaySrcBySrcRef = useRef<Record<string, string>>({});
  const interactionStateRef = useRef<StandardCanvasInteractionState>(standardIdleInteraction);
  const inlineEditRef = useRef<CanvasDocumentInlineEdit | null>(null);
  const blankClickIntentRef = useRef<StandardBlankClickIntent | null>(null);
  const selectionVersionRef = useRef(0);
  const lastSelectionKeyRef = useRef(canvasDocumentSelectionVersionKey(emptyCanvasDocumentSelection));
  const interactionGenerationRef = useRef(0);
  const wheelIntentTrackerRef = useRef(createWheelIntentTracker());
  const moveDraftRef = useRef<CanvasDocumentMoveDraft | null>(null);
  const resizeDraftRef = useRef<CanvasDocumentResizeDraft | null>(null);
  const suppressNextClickRef = useRef(false);
  const lastPointerUpHitRef = useRef<StandardCanvasHitTarget>({ kind: "blank" });
  const renderCurrentSceneRef = useRef(() => {});
  const renderViewportOnlyRef = useRef(() => {});
  const dimensions = useContainerSize(containerRef);
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const [interactionState, setInteractionState] = useState<StandardCanvasInteractionState>(standardIdleInteraction);
  const [connectorStartId, setConnectorStartIdState] = useState<string | null>(null);
  const imageDisplaySrcBySrc = useCanvasDocumentImageSources({ document: normalizedDocument, fileRef, runtime });
  const [inlineEdit, setInlineEditState] = useState<CanvasDocumentInlineEdit | null>(null);
  const [inlineEditLayoutRevision, setInlineEditLayoutRevision] = useState(0);
  const [imageUrlDialogOpen, setImageUrlDialogOpen] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState("");

  renderCurrentSceneRef.current = () => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    syncPixiScene(pixi, documentRef.current, dimensionsRef.current, selectedIdsRef.current, connectorStartIdRef.current, imageDisplaySrcBySrcRef.current, interactionStateRef.current, inlineEditRef.current);
  };
  renderViewportOnlyRef.current = () => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    applyPixiViewport(pixi, documentRef.current.viewport, dimensionsRef.current);
    drawSelectionOverlay(pixi, documentRef.current, selectedIdsRef.current, interactionStateRef.current);
    schedulePixiRender(pixi);
  };

  useEffect(() => {
    documentRef.current = normalizedDocument;
    const existingIds = new Set(normalizedDocument.elements.map((element) => element.id));
    const currentInlineEdit = inlineEditRef.current;
    if (currentInlineEdit && !existingIds.has(currentInlineEdit.id)) {
      inlineEditRef.current = null;
      setInlineEditState(null);
      moveDraftRef.current = null;
      resizeDraftRef.current = null;
      interactionStateRef.current = standardIdleInteraction;
      setInteractionState(standardIdleInteraction);
    }
    const selectedIds = canvasDocumentSelectedIds(selectionRef.current).filter((id) => existingIds.has(id));
    if (selectedIds.length !== selectedIdsRef.current.length) {
      setCanvasDocumentSelection(canvasDocumentSelectionFromIds(selectedIds, normalizedDocument));
      return;
    }
    renderCurrentSceneRef.current();
  }, [normalizedDocument]);

  useEffect(() => {
    dimensionsRef.current = dimensions;
    const pixi = pixiRef.current;
    if (pixi) {
      resizePixiRenderer(pixi, dimensions);
      renderCurrentSceneRef.current();
    }
  }, [dimensions]);

  useEffect(() => {
    imageDisplaySrcBySrcRef.current = imageDisplaySrcBySrc;
    renderCurrentSceneRef.current();
  }, [imageDisplaySrcBySrc]);

  useEffect(() => {
    let disposed = false;
    const host = containerRef.current;
    if (!host) return;

    void createPixiCanvasRuntime(dimensionsRef.current)
      .then((pixi) => {
        if (disposed) {
          destroyPixiCanvasRuntime(pixi);
          return;
        }

        host.appendChild(pixi.app.canvas);
        pixiRef.current = pixi;
        renderCurrentSceneRef.current();
      })
      .catch(() => {
        if (!disposed) onStatus?.("PixiJS 画布初始化失败。");
      });

    return () => {
      disposed = true;
      const pixi = pixiRef.current;
      pixiRef.current = null;
      if (!pixi) return;
      destroyPixiCanvasRuntime(pixi);
    };
  }, [onStatus]);

  useCanvasDocumentKeyboardShortcuts({
    selectedIdsRef,
    inlineEditRef,
    interactionStateRef,
    connectorStartIdRef,
    documentRef,
    onDeleteSelection: deleteSelection,
    onStartInlineEdit: startInlineEdit
  });

  const editStyle = inlineEditLayoutRevision >= 0 ? resolveCanvasDocumentInlineEditStyle({ document: documentRef.current, inlineEdit, screenFromWorld }) : null;

  function commit(next: CanvasDocument, status?: string) {
    const normalized = normalizeCanvasDocument(next);
    clearViewportCommitTimer();
    documentRef.current = normalized;
    onChange(normalized, status);
    renderCurrentSceneRef.current();
  }

  function commitElements(elements: CanvasDocumentElement[], status?: string) {
    commit({ ...documentRef.current, elements }, status);
  }

  function commitViewport(nextViewport: ViewportState) {
    commit({ ...documentRef.current, viewport: nextViewport });
  }

  function clearViewportCommitTimer() {
    const pixi = pixiRef.current;
    if (pixi?.viewportCommitTimer !== null && pixi?.viewportCommitTimer !== undefined) {
      window.clearTimeout(pixi.viewportCommitTimer);
      pixi.viewportCommitTimer = null;
    }
  }

  function scheduleViewportCommit() {
    const pixi = pixiRef.current;
    if (!pixi) return;
    if (pixi.viewportCommitTimer !== null) window.clearTimeout(pixi.viewportCommitTimer);
    pixi.viewportCommitTimer = window.setTimeout(() => {
      pixi.viewportCommitTimer = null;
      onChange(normalizeCanvasDocument(documentRef.current));
      renderCurrentSceneRef.current();
    }, VIEWPORT_COMMIT_DELAY_MS);
  }

  function setCanvasDocumentSelection(next: CanvasDocumentSelection) {
    const normalized = {
      itemIds: next.itemIds,
      connectionIds: next.connectionIds,
      groupIds: next.groupIds || [],
      primaryId: next.primaryId
    };
    const key = canvasDocumentSelectionVersionKey(normalized);
    if (key !== lastSelectionKeyRef.current) {
      lastSelectionKeyRef.current = key;
      selectionVersionRef.current += 1;
    }
    selectionRef.current = normalized;
    const ids = canvasDocumentSelectedIds(normalized);
    selectedIdsRef.current = ids;
    setSelectedIdsState(ids);
    renderViewportOnlyRef.current();
  }

  function setSelectedIds(next: string[] | ((current: string[]) => string[])) {
    const resolved = typeof next === "function" ? next(selectedIdsRef.current) : next;
    setCanvasDocumentSelection(canvasDocumentSelectionFromIds(resolved, documentRef.current));
  }

  function setCanvasInteractionState(next: StandardCanvasInteractionState) {
    interactionStateRef.current = next;
    setInteractionState(next);
    renderViewportOnlyRef.current();
  }

  function refreshInlineEditLayout() {
    if (!inlineEditRef.current) return;
    setInlineEditLayoutRevision((current) => current + 1);
  }

  function setCanvasInlineEdit(next: CanvasDocumentInlineEdit | null, options: { renderScene?: boolean; refreshLayout?: boolean } = {}) {
    inlineEditRef.current = next;
    setInlineEditState(next);
    if (options.refreshLayout !== false) refreshInlineEditLayout();
    if (options.renderScene !== false) renderCurrentSceneRef.current();
  }

  function setConnectorStartId(next: string | null) {
    connectorStartIdRef.current = next;
    setConnectorStartIdState(next);
    renderCurrentSceneRef.current();
  }

  function updateDocumentVisual(next: CanvasDocument) {
    documentRef.current = normalizeCanvasDocument(next);
    renderCurrentSceneRef.current();
    refreshInlineEditLayout();
  }

  function updateViewportVisual(nextViewport: ViewportState) {
    documentRef.current = { ...documentRef.current, viewport: nextViewport };
    renderViewportOnlyRef.current();
    refreshInlineEditLayout();
    scheduleViewportCommit();
  }

  function worldFromScreen(point: Point): Point {
    return canvasDocumentScreenToWorld(point, documentRef.current.viewport);
  }

  function screenFromWorld(point: Point): Point {
    const viewport = documentRef.current.viewport;
    return {
      x: viewport.x + point.x * viewport.scale,
      y: viewport.y + point.y * viewport.scale
    };
  }

  function pointerScreenPoint(event: React.PointerEvent): Point {
    return clientScreenPoint(event.clientX, event.clientY);
  }

  function clientScreenPoint(clientX: number, clientY: number): Point {
    const pixi = pixiRef.current;
    if (pixi) {
      const rect = pixi.app.canvas.getBoundingClientRect();
      const screen = pixi.app.renderer.screen;
      return canvasDocumentClientToScreen({ clientX, clientY }, rect, {
        width: screen.width || dimensionsRef.current.width,
        height: screen.height || dimensionsRef.current.height
      });
    }

    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: dimensionsRef.current.width, height: dimensionsRef.current.height };
    return canvasDocumentClientToScreen({ clientX, clientY }, rect, dimensionsRef.current);
  }

  function viewportCenterPoint(): Point {
    return worldFromScreen({ x: dimensionsRef.current.width / 2, y: dimensionsRef.current.height / 2 });
  }

  function updateElement(id: string, patch: Partial<CanvasShapeElement | CanvasCardElement | CanvasTextElement | CanvasImageElement | CanvasConnectorElement>, status?: string) {
    commitElements(
      documentRef.current.elements.map((element) => (element.id === id ? ({ ...element, ...patch } as CanvasDocumentElement) : element)),
      status
    );
  }

  function addShape(shape: CanvasShapeKind) {
    const current = documentRef.current;
    const center = viewportCenterPoint();
    const element = createCanvasShapeElement(current.elements, center.x - 84, center.y - 48, shape);
    commitElements([...current.elements, element], "已添加画布形状。");
    setSelectedIds([element.id]);
    animateCreatedElement(element.id);
  }

  function addCard() {
    const current = documentRef.current;
    const center = viewportCenterPoint();
    const element = createCanvasCardElement(current.elements, center.x - 120, center.y - 78);
    commitElements([...current.elements, element], "已添加卡片。");
    setSelectedIds([element.id]);
    animateCreatedElement(element.id);
  }

  function addText() {
    const current = documentRef.current;
    const center = viewportCenterPoint();
    const element = createCanvasTextElement(current.elements, center.x - 110, center.y - 36);
    commitElements([...current.elements, element], "已添加文本框。");
    setSelectedIds([element.id]);
    animateCreatedElement(element.id);
  }

  async function addImage() {
    const current = documentRef.current;
    if (fileRef?.path) {
      try {
        const result = await runtime.pickImageAsset(fileRef);
        if (result.status === "ready") {
          const size = await loadImageDimensions(result.displaySrc);
          const center = viewportCenterPoint();
          const element = createCanvasImageElement(current.elements, center.x - size.width / 2, center.y - size.height / 2, result.src, size.width, size.height);
          commitElements([...documentRef.current.elements, element], result.copied ? "已复制并添加图片。" : "已添加图片。");
          setSelectedIds([element.id]);
          animateCreatedElement(element.id);
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
    const center = viewportCenterPoint();
    const element = createCanvasImageElement(documentRef.current.elements, center.x - size.width / 2, center.y - size.height / 2, trimmed, size.width, size.height);
    commitElements([...documentRef.current.elements, element], "已添加图片。");
    setSelectedIds([element.id]);
    animateCreatedElement(element.id);
  }

  function addConnectorFromSelection() {
    const current = documentRef.current;
    const elementById = new Map(current.elements.map((element) => [element.id, element]));
    const candidates = selectedIdsRef.current
      .map((id) => elementById.get(id))
      .filter((element): element is Exclude<CanvasDocumentElement, CanvasConnectorElement> => Boolean(element && element.type !== "connector"));
    if (candidates.length === 1) {
      setConnectorStartId(candidates[0].id);
      onStatus?.("选择第二个对象完成连线。");
      return;
    }
    const center = viewportCenterPoint();
    const from: CanvasConnectorEndpoint = candidates[0] ? { elementId: candidates[0].id } : { point: { x: center.x - 120, y: center.y } };
    const to: CanvasConnectorEndpoint = candidates[1] ? { elementId: candidates[1].id } : { point: { x: center.x + 120, y: center.y } };
    const element = createCanvasConnectorElement(current.elements, from, to);
    commitElements([...current.elements, element], "已添加连线。");
    setSelectedIds([element.id]);
    setConnectorStartId(null);
    animateCreatedElement(element.id);
  }

  function deleteSelection() {
    const currentSelectedIds = selectedIdsRef.current;
    if (!currentSelectedIds.length) return;
    const selected = new Set(currentSelectedIds);
    commitElements(
      documentRef.current.elements.filter((element) => {
        if (selected.has(element.id)) return false;
        if (element.type !== "connector") return true;
        return !endpointReferencesSelection(element.from, selected) && !endpointReferencesSelection(element.to, selected);
      }),
      "已删除选中内容。"
    );
    setSelectedIds([]);
    setConnectorStartId(null);
  }

  function resetViewport() {
    commitViewport({ x: 160, y: 90, scale: 1 });
    onStatus?.("已重置画布视图。");
  }

  function startInlineEdit(element: CanvasDocumentElement) {
    if (element.type === "image") return;

    blankClickIntentRef.current = null;
    if (element.type === "connector") {
      setCanvasDocumentSelection(selectCanvasDocumentConnection(selectionRef.current, element.id, false));
      setCanvasInteractionState({ kind: "editingConnectionText", connectionId: element.id });
      setCanvasInlineEdit({ type: "connection", id: element.id, value: element.label || "" });
      return;
    }

    setCanvasDocumentSelection(selectCanvasDocumentItem(selectionRef.current, element.id, false));
    setCanvasInteractionState({ kind: "editingItemText", itemId: element.id });
    setCanvasInlineEdit({ type: "item", id: element.id, value: element.text || "" });
  }

  function commitInlineEdit(save: boolean) {
    const current = inlineEditRef.current;
    if (!current) return;

    setCanvasInlineEdit(null);
    resetStandardInteraction();

    if (!save) return;
    const element = documentRef.current.elements.find((item) => item.id === current.id);
    if (!element) return;
    if (current.type === "connection" && element.type === "connector") {
      updateElement(element.id, { label: current.value }, "已更新连线标签。");
      return;
    }
    if (current.type === "item" && (element.type === "shape" || element.type === "text")) {
      updateElement(element.id, { text: current.value }, "已更新文本。");
    }
  }

  function standardHitFromScreen(screen: Point) {
    return standardHitTargetFromCanvasDocumentHit(hitCanvasDocument(documentRef.current, screen, dimensionsRef.current, selectedIdsRef.current), documentRef.current);
  }

  function applyStandardCommands(commands: StandardCanvasInteractionCommand[]) {
    for (const command of commands) {
      if (command.type === "blankClick.invalidate") {
        blankClickIntentRef.current = null;
        continue;
      }
      if (command.type === "blankClick.record") {
        blankClickIntentRef.current = command.intent;
        continue;
      }
      if (command.type === "selection.clear") {
        setCanvasDocumentSelection(emptyCanvasDocumentSelection);
        setConnectorStartId(null);
        continue;
      }
      if (command.type === "item.addAt") {
        const element = createCanvasShapeElement(documentRef.current.elements, command.point.x - 84, command.point.y - 48);
        commitElements([...documentRef.current.elements, element], "已添加画布形状。");
        setSelectedIds([element.id]);
        animateCreatedElement(element.id);
        continue;
      }
      if (command.type === "selection.selectItem") {
        setCanvasDocumentSelection(selectCanvasDocumentItem(selectionRef.current, command.id, command.additive));
        continue;
      }
      if (command.type === "selection.selectConnection") {
        setCanvasDocumentSelection(selectCanvasDocumentConnection(selectionRef.current, command.id, command.additive));
        continue;
      }
      if (command.type === "text.editStart") {
        const element = documentRef.current.elements.find((item) => item.id === command.target.id);
        if (element) startInlineEdit(element);
        continue;
      }
      if (command.type === "item.dragStart") {
        startDocumentItemDrag(command.itemId);
        continue;
      }
      if (command.type === "selection.marquee") {
        setCanvasDocumentSelection(canvasDocumentMarqueeSelection(documentRef.current, command.rect));
        continue;
      }
      if (command.type === "connection.finish") {
        finishStandardConnection(command.draft);
        continue;
      }
      if (command.type === "interaction.reset") {
        resetStandardInteraction();
      }
    }
  }

  function startDocumentItemDrag(itemId: string) {
    const item = documentRef.current.elements.find((element) => element.id === itemId);
    if (!isCanvasDocumentItem(item)) return;
    const selectedItemIds = selectionRef.current.itemIds.includes(itemId) ? selectionRef.current.itemIds : [itemId];
    if (!selectionRef.current.itemIds.includes(itemId)) setCanvasDocumentSelection(selectCanvasDocumentItem(selectionRef.current, itemId, false));

    const elementById = new Map(documentRef.current.elements.map((element) => [element.id, element]));
    const movableIds = selectedItemIds.filter((id) => isCanvasDocumentItem(elementById.get(id)));
    moveDraftRef.current = {
      baseDocument: documentRef.current,
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
    const element = documentRef.current.elements.find((item) => item.id === itemId);
    if (!isCanvasDocumentItem(element)) return;
    setCanvasDocumentSelection(selectCanvasDocumentItem(selectionRef.current, itemId, false));
    resizeDraftRef.current = {
      id: itemId,
      baseDocument: documentRef.current,
      frame: canvasElementFrame(element),
      changed: false
    };
  }

  function updateDocumentItemDrag(state: Extract<StandardCanvasInteractionState, { kind: "draggingItems" }>, currentWorld: Point) {
    const draft = moveDraftRef.current;
    if (!draft) return;
    const dx = currentWorld.x - state.startWorld.x;
    const dy = currentWorld.y - state.startWorld.y;
    draft.changed = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
    updateDocumentVisual({
      ...draft.baseDocument,
      viewport: documentRef.current.viewport,
      elements: draft.baseDocument.elements.map((element) => {
        if (!draft.ids.includes(element.id) || element.type === "connector") return element;
        const origin = draft.origins[element.id];
        return { ...element, x: origin.x + dx, y: origin.y + dy };
      })
    });
  }

  function updateDocumentResize(state: Extract<StandardCanvasInteractionState, { kind: "resizingItem" }>) {
    const draft = resizeDraftRef.current;
    if (!draft) return;
    const dx = state.currentWorld.x - state.startWorld.x;
    const dy = state.currentWorld.y - state.startWorld.y;
    draft.changed = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
    updateDocumentVisual({
      ...draft.baseDocument,
      viewport: documentRef.current.viewport,
      elements: draft.baseDocument.elements.map((element) => {
        if (element.id !== draft.id || element.type === "connector") return element;
        return {
          ...element,
          width: Math.max(32, draft.frame.width + dx),
          height: Math.max(32, draft.frame.height + dy)
        };
      })
    });
  }

  function finishStandardConnection(draft: Extract<StandardCanvasInteractionState, { kind: "connecting" }>) {
    const hit = lastPointerUpHitRef.current;
    if (hit.kind !== "item" || hit.id === draft.fromId) return;
    const connector = createCanvasConnectorElement(documentRef.current.elements, { elementId: draft.fromId }, { elementId: hit.id });
    commitElements([...documentRef.current.elements, connector], "已连接两个画布对象。");
    setSelectedIds([connector.id]);
    animateCreatedElement(connector.id);
  }

  function resetStandardInteraction() {
    moveDraftRef.current = null;
    resizeDraftRef.current = null;
    setCanvasInteractionState(standardIdleInteraction);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (isStandardPanningButton(event.button)) event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const screen = pointerScreenPoint(event);
    const current = documentRef.current;
    const hit = standardHitFromScreen(screen);
    const world = worldFromScreen(screen);

    if (connectorStartIdRef.current && hit.kind === "item") {
      if (connectorStartIdRef.current === hit.id) {
        setConnectorStartId(null);
        return;
      }
      const connector = createCanvasConnectorElement(current.elements, { elementId: connectorStartIdRef.current }, { elementId: hit.id });
      commitElements([...current.elements, connector], "已连接两个画布对象。");
      setSelectedIds([connector.id]);
      setConnectorStartId(null);
      animateCreatedElement(connector.id);
      return;
    }

    const result = dispatchStandardCanvasPointerDown({
      state: interactionStateRef.current,
      tool: "select",
      hit,
      button: event.button,
      screen,
      world,
      now: event.timeStamp,
      selectionVersion: selectionVersionRef.current,
      viewport: current.viewport,
      pointerId: event.pointerId
    });

    applyStandardCommands(result.commands);
    setCanvasInteractionState(result.state);
    if (result.state.kind === "resizingItem") startDocumentResize(result.state.itemId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = interactionStateRef.current;
    if (state.kind === "idle" || !("pointerId" in state) || state.pointerId !== event.pointerId) return;
    const screen = pointerScreenPoint(event);

    if (state.kind === "panning") {
      updateViewportVisual({
        ...state.originViewport,
        x: state.originViewport.x + screen.x - state.startScreen.x,
        y: state.originViewport.y + screen.y - state.startScreen.y
      });
      return;
    }

    const world = worldFromScreen(screen);
    const result = dispatchStandardCanvasPointerMove({
      state,
      screen,
      world
    });
    applyStandardCommands(result.commands);
    setCanvasInteractionState(result.state);
    if (result.state.kind === "draggingItems") updateDocumentItemDrag(result.state, world);
    if (result.state.kind === "resizingItem") updateDocumentResize(result.state);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const state = interactionStateRef.current;
    if (state.kind === "idle" || !("pointerId" in state) || state.pointerId !== event.pointerId) return;
    const screen = pointerScreenPoint(event);
    const world = worldFromScreen(screen);
    const hit = standardHitFromScreen(screen);
    lastPointerUpHitRef.current = hit;
    suppressNextClickRef.current = state.kind !== "pendingBlankPointer" && state.kind !== "pendingItemPointer" && state.kind !== "pendingGroupPointer";

    if (moveDraftRef.current?.changed || resizeDraftRef.current?.changed) commit(documentRef.current);

    const result = dispatchStandardCanvasPointerUp({
      state,
      tool: "select",
      hit,
      hasSelection: canvasDocumentHasSelection(selectionRef.current),
      screen,
      world,
      now: performance.now(),
      previousBlankClick: blankClickIntentRef.current,
      selectionVersion: selectionVersionRef.current,
      interactionGeneration: interactionGenerationRef.current,
      pointerId: event.pointerId
    });
    applyStandardCommands(result.commands);
    setCanvasInteractionState(result.state);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const screen = clientScreenPoint(event.clientX, event.clientY);
    const hit = standardHitFromScreen(screen);
    applyStandardCommands(dispatchStandardCanvasClick({ tool: "select", hit, shiftKey: event.shiftKey }));
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    suppressNextClickRef.current = true;
    const screen = clientScreenPoint(event.clientX, event.clientY);
    const hit = standardHitFromScreen(screen);
    applyStandardCommands(dispatchStandardCanvasDoubleClick({ tool: "select", hit }));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = clientScreenPoint(event.clientX, event.clientY);
    const wheelInput = createStandardWheelInput({
      pointer: point,
      canvasSize: dimensionsRef.current,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      modifiers: modifiersFromEvent(event.nativeEvent),
      timestamp: event.timeStamp,
      interactionKind: interactionStateRef.current.kind
    });
    const intent = resolveInteractionIntent(
      wheelInput,
      buildInteractionContext({
        graph: CANVAS_DOCUMENT_INTERACTION_GRAPH,
        selection: {
          nodeIds: selectionRef.current.itemIds,
          edgeIds: selectionRef.current.connectionIds,
          subgraphIds: []
        },
        viewport: documentRef.current.viewport,
        canvasSize: dimensionsRef.current,
        hitTarget: { kind: "blank" },
        modifiers: wheelInput.modifiers,
        gestureState: interactionStateRef.current.kind
      }),
      { wheelIntentTracker: wheelIntentTrackerRef.current }
    );
    const command = commandFromInteractionIntent(intent);
    if (command?.type === "viewport.set") {
      blankClickIntentRef.current = null;
      updateViewportVisual(command.viewport);
    }
  }

  function animateCreatedElement(id: string) {
    animateCanvasDocumentElementCreated(pixiRef.current, id);
  }

  return (
    <TooltipProvider delayDuration={160}>
      <section className="relative h-full min-h-0 overflow-hidden bg-background">
        <CanvasDocumentToolbar
          connectorActive={Boolean(connectorStartId)}
          selectedCount={selectedIds.length}
          onAddShape={addShape}
          onAddCard={addCard}
          onAddText={addText}
          onAddConnector={addConnectorFromSelection}
          onAddImage={() => void addImage()}
          onDeleteSelection={deleteSelection}
          onResetViewport={resetViewport}
        />
        {connectorStartId ? (
          <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            选择第二个对象完成连线
          </div>
        ) : null}
        <CanvasDocumentImageUrlDialog
          open={imageUrlDialogOpen}
          value={imageUrlDraft}
          onChange={setImageUrlDraft}
          onClose={() => setImageUrlDialogOpen(false)}
          onSubmit={() => void addImageFromUrl(imageUrlDraft)}
        />
        <div
          ref={containerRef}
          className={cn("h-full min-h-0 touch-none overflow-hidden", interactionState.kind === "panning" || interactionState.kind === "draggingItems" || interactionState.kind === "resizingItem" ? "cursor-grabbing" : "cursor-default")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
        />
        <CanvasDocumentInlineEditOverlays
          inlineEdit={inlineEdit}
          editStyle={editStyle}
          onChange={(value) => {
            if (!inlineEdit) return;
            setCanvasInlineEdit({ ...inlineEdit, value }, { renderScene: false });
          }}
          onCommit={commitInlineEdit}
        />
      </section>
    </TooltipProvider>
  );
}
