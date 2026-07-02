import { useEffect, useMemo, useRef, useState } from "react";

import { animateCanvasDocumentElementCreated } from "@/features/mermaid-editor/components/canvas-document-editor/canvas-document-animation";
import { VIEWPORT_COMMIT_DELAY_MS } from "@/features/mermaid-editor/components/canvas-document-editor/constants";
import { resolveCanvasDocumentInlineEditStyle } from "@/features/mermaid-editor/components/canvas-document-editor/inline-edit-style";
import type { CanvasDocumentInlineEdit, CanvasDocumentMoveDraft, CanvasDocumentResizeDraft, Point } from "@/features/mermaid-editor/components/canvas-document-editor/types";
import { useCanvasDocumentScene } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-scene";
import {
  canvasDocumentSelectedIds,
  canvasDocumentSelectionFromIds,
  canvasDocumentSelectionVersionKey,
  emptyCanvasDocumentSelection,
  standardHitTargetFromCanvasDocumentHit,
  type CanvasDocumentSelection
} from "@/features/mermaid-editor/lib/canvas-document-interaction";
import {
  type CanvasDocument,
  type CanvasDocumentElement,
  normalizeCanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  canvasDocumentClientToScreen,
  canvasDocumentScreenToWorld,
  hitCanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document-rendering";
import {
  standardIdleInteraction,
  type StandardBlankClickIntent,
  type StandardCanvasHitTarget,
  type StandardCanvasInteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import { createWheelIntentTracker } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

type UseCanvasDocumentModelArgs = {
  document: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
  onChange: (document: CanvasDocument, status?: string) => void;
  onStatus?: (status: string) => void;
};

export function useCanvasDocumentModel({ document, fileRef, runtime, onChange, onStatus }: UseCanvasDocumentModelArgs) {
  const normalizedDocument = useMemo(() => normalizeCanvasDocument(document), [document]);
  const documentRef = useRef<CanvasDocument>(normalizedDocument);
  const selectionRef = useRef<CanvasDocumentSelection>(emptyCanvasDocumentSelection);
  const selectedIdsRef = useRef<string[]>([]);
  const connectorStartIdRef = useRef<string | null>(null);
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
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const [interactionState, setInteractionState] = useState<StandardCanvasInteractionState>(standardIdleInteraction);
  const [connectorStartId, setConnectorStartIdState] = useState<string | null>(null);
  const [inlineEdit, setInlineEditState] = useState<CanvasDocumentInlineEdit | null>(null);
  const [inlineEditLayoutRevision, setInlineEditLayoutRevision] = useState(0);
  const { containerRef, pixiRef, dimensionsRef, renderCurrentSceneRef, renderViewportOnlyRef } = useCanvasDocumentScene({
    normalizedDocument,
    fileRef,
    runtime,
    documentRef,
    selectedIdsRef,
    connectorStartIdRef,
    interactionStateRef,
    inlineEditRef,
    onStatus
  });

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
    // Keep this synchronized only with external document changes; setters and refs are stable for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedDocument]);

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

  function standardHitFromScreen(screen: Point) {
    return standardHitTargetFromCanvasDocumentHit(hitCanvasDocument(documentRef.current, screen, dimensionsRef.current, selectedIdsRef.current), documentRef.current);
  }

  function resetStandardInteraction() {
    moveDraftRef.current = null;
    resizeDraftRef.current = null;
    setCanvasInteractionState(standardIdleInteraction);
  }

  function animateCreatedElement(id: string) {
    animateCanvasDocumentElementCreated(pixiRef.current, id);
  }

  return {
    containerRef,
    documentRef,
    dimensionsRef,
    selectionRef,
    selectedIdsRef,
    connectorStartIdRef,
    interactionStateRef,
    inlineEditRef,
    blankClickIntentRef,
    selectionVersionRef,
    interactionGenerationRef,
    wheelIntentTrackerRef,
    moveDraftRef,
    resizeDraftRef,
    suppressNextClickRef,
    lastPointerUpHitRef,
    selectedIds,
    interactionState,
    connectorStartId,
    inlineEdit,
    editStyle,
    commit,
    commitElements,
    commitViewport,
    setCanvasDocumentSelection,
    setSelectedIds,
    setCanvasInteractionState,
    setCanvasInlineEdit,
    setConnectorStartId,
    updateDocumentVisual,
    updateViewportVisual,
    worldFromScreen,
    clientScreenPoint,
    viewportCenterPoint,
    standardHitFromScreen,
    resetStandardInteraction,
    animateCreatedElement
  };
}

export type CanvasDocumentModel = ReturnType<typeof useCanvasDocumentModel>;
