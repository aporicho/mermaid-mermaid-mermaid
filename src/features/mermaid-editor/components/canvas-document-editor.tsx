import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type React from "react";
import { CreditCard, FrameSimple, Link, Maximize, Plus, Text as TextIcon, Xmark } from "iconoir-react/regular";
import * as PIXI from "pixi.js";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text as PixiText, Texture } from "pixi.js";
import { PixiPlugin } from "gsap/PixiPlugin";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { superellipseRectPathPoints } from "@/features/mermaid-editor/lib/canvas-card-geometry";
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
  canvasDocumentEndpointPoint,
  canvasDocumentScreenToWorld,
  canvasDocumentVisibleElements,
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
import type { MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { gsap } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { cn } from "@/lib/utils";

type CanvasDocumentEditorProps = {
  document: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
  onChange: (document: CanvasDocument, status?: string) => void;
  onStatus?: (status: string) => void;
};

type Point = {
  x: number;
  y: number;
};

type CanvasDocumentMoveDraft = {
  baseDocument: CanvasDocument;
  origins: Record<string, Point>;
  ids: string[];
  changed: boolean;
};

type CanvasDocumentResizeDraft = {
  id: string;
  baseDocument: CanvasDocument;
  frame: { x: number; y: number; width: number; height: number };
  changed: boolean;
};

type CanvasDocumentInlineEdit =
  | { type: "item"; id: string; value: string }
  | { type: "connection"; id: string; value: string };

type CanvasDocumentInlineEditStyle = {
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textAlign: "left" | "center";
  fontWeight: number;
  color: string;
  verticalAlign: "top" | "middle";
  borderRadius?: number;
  paddingX?: number;
};

type PixiElementView = {
  id: string;
  type: CanvasDocumentElement["type"];
  container: Container;
  body: Graphics;
  sprite?: Sprite;
  text?: PixiText;
  textKey?: string;
  imageSrc?: string;
  signature?: string;
};

type PixiCanvasRuntime = {
  app: Application;
  grid: Graphics;
  world: Container;
  connectors: Container;
  objects: Container;
  selection: Graphics;
  views: Map<string, PixiElementView>;
  renderFrame: number | null;
  viewportCommitTimer: number | null;
  disposed: boolean;
};

const SHAPE_OPTIONS: { shape: CanvasShapeKind; label: string }[] = [
  { shape: "rect", label: "矩形" },
  { shape: "roundRect", label: "圆角" },
  { shape: "ellipse", label: "椭圆" },
  { shape: "diamond", label: "菱形" }
];
const DEFAULT_IMAGE_WIDTH = 240;
const DEFAULT_IMAGE_HEIGHT = 160;
const DEFAULT_DIMENSIONS = { width: 800, height: 600 };
const DEFAULT_TEXT_COLOR = "#2f2a25";
const SELECTED_COLOR = "#e85d5d";
const SURFACE_COLOR = "#fbf6ef";
const IMAGE_BORDER_COLOR = "#d8cfc3";
const GRID_COLOR = 0x4b4137;
const PIXI_TEXT_FONT_FAMILY = "Noto Sans SC, Arial, sans-serif";
const VIEWPORT_COMMIT_DELAY_MS = 80;
const MIN_RENDERER_RESOLUTION = 2;
const MAX_RENDERER_RESOLUTION = 3;
const MAX_TEXT_TEXTURE_RESOLUTION = 4;
const CANVAS_DOCUMENT_INTERACTION_GRAPH: MermaidGraph = {
  direction: "LR",
  nodes: [],
  edges: [],
  subgraphs: [],
  editableKind: "flowchart",
  parseStatus: "parsed"
};

let pixiPluginRegistered = false;

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
  const itemEditorRef = useRef<HTMLTextAreaElement>(null);
  const itemEditorMeasureRef = useRef<HTMLDivElement>(null);
  const connectionEditorRef = useRef<HTMLInputElement>(null);
  const dimensions = useContainerSize(containerRef);
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const [interactionState, setInteractionState] = useState<StandardCanvasInteractionState>(standardIdleInteraction);
  const [connectorStartId, setConnectorStartIdState] = useState<string | null>(null);
  const [imageDisplaySrcBySrc, setImageDisplaySrcBySrc] = useState<Record<string, string>>({});
  const [inlineEdit, setInlineEditState] = useState<CanvasDocumentInlineEdit | null>(null);
  const [inlineEditLayoutRevision, setInlineEditLayoutRevision] = useState(0);
  const [itemEditorLayout, setItemEditorLayout] = useState({ insetTop: 0, height: 1, scrollable: false });
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
    if (inlineEdit?.type === "item") {
      const editor = itemEditorRef.current;
      if (!editor) return;
      editor.focus();
      editor.select();
      return;
    }

    if (inlineEdit?.type === "connection") {
      const editor = connectionEditorRef.current;
      if (!editor) return;
      editor.focus();
      editor.select();
    }
  }, [inlineEdit?.id, inlineEdit?.type]);

  useEffect(() => {
    const sources = Array.from(new Set(normalizedDocument.elements.flatMap((element) => (element.type === "image" && element.src ? [element.src] : []))));
    if (!sources.length) {
      setImageDisplaySrcBySrc({});
      return;
    }

    let disposed = false;
    void Promise.all(
      sources.map(async (src) => {
        try {
          return [src, await runtime.resolveImageAssetSrc(fileRef, src)] as const;
        } catch {
          return [src, src] as const;
        }
      })
    ).then((entries) => {
      if (!disposed) setImageDisplaySrcBySrc(Object.fromEntries(entries));
    });

    return () => {
      disposed = true;
    };
  }, [fileRef, normalizedDocument.elements, runtime]);

  useEffect(() => {
    let disposed = false;
    const host = containerRef.current;
    if (!host) return;

    registerPixiPlugin();
    const app = new Application();

    void app
      .init({
        width: dimensionsRef.current.width,
        height: dimensionsRef.current.height,
        autoDensity: true,
        resolution: canvasRendererResolution(),
        autoStart: false,
        preference: "webgl",
        powerPreference: "high-performance",
        antialias: true,
        backgroundAlpha: 0
      })
      .then(() => {
        if (disposed) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }

        app.canvas.className = "block";
        app.canvas.style.display = "block";
        host.appendChild(app.canvas);

        const grid = new Graphics();
        const world = new Container();
        const connectors = new Container();
        const objects = new Container();
        const selection = new Graphics();
        connectors.interactiveChildren = false;
        objects.interactiveChildren = false;
        selection.eventMode = "none";
        world.addChild(connectors, objects, selection);
        app.stage.addChild(grid, world);

        const pixi: PixiCanvasRuntime = {
          app,
          grid,
          world,
          connectors,
          objects,
          selection,
          views: new Map(),
          renderFrame: null,
          viewportCommitTimer: null,
          disposed: false
        };
        pixiRef.current = pixi;
        resizePixiRenderer(pixi, dimensionsRef.current);
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
      pixi.disposed = true;
      if (pixi.renderFrame !== null) window.cancelAnimationFrame(pixi.renderFrame);
      if (pixi.viewportCommitTimer !== null) window.clearTimeout(pixi.viewportCommitTimer);
      for (const tween of gsap.getTweensOf([...pixi.views.values()].map((view) => view.container))) tween.kill();
      pixi.app.destroy({ removeView: true }, { children: true });
    };
  }, [onStatus]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (inlineEditRef.current) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIdsRef.current.length) {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (interactionStateRef.current.kind !== "idle" || connectorStartIdRef.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Enter" && event.key !== "F2") return;
      if (selectedIdsRef.current.length !== 1) return;

      const element = documentRef.current.elements.find((item) => item.id === selectedIdsRef.current[0]);
      if (!element || (element.type !== "shape" && element.type !== "card" && element.type !== "text")) return;
      event.preventDefault();
      startInlineEdit(element);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const editStyle = inlineEditLayoutRevision >= 0 ? inlineEditStyle() : null;
  const activeScale = documentRef.current.viewport.scale;

  useLayoutEffect(() => {
    if (inlineEdit?.type !== "item" || !editStyle) return;
    const measure = itemEditorMeasureRef.current;
    if (!measure) return;

    const minimumHeight = editStyle.lineHeight;
    const measuredHeight = Math.max(minimumHeight, Math.ceil(measure.scrollHeight));
    const scrollable = measuredHeight > editStyle.height + 1;
    const height = scrollable ? editStyle.height : Math.min(editStyle.height, measuredHeight);
    const insetTop = editStyle.verticalAlign === "middle" ? Math.max(0, Math.floor((editStyle.height - height) / 2)) : 0;

    setItemEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [activeScale, editStyle, inlineEdit?.type, inlineEdit?.value]);

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

  function inlineEditStyle(): CanvasDocumentInlineEditStyle | null {
    if (!inlineEdit) return null;
    const element = documentRef.current.elements.find((item) => item.id === inlineEdit.id);
    if (!element) return null;
    const scale = Math.max(documentRef.current.viewport.scale, 0.01);

    if (inlineEdit.type === "item") {
      if (element.type === "shape") {
        const insetX = 12;
        const insetY = 12;
        const screen = screenFromWorld({ x: element.x + insetX, y: element.y + insetY });
        return {
          left: screen.x,
          top: screen.y,
          width: Math.max(1, element.width - insetX * 2) * scale,
          height: Math.max(1, element.height - insetY * 2) * scale,
          fontFamily: PIXI_TEXT_FONT_FAMILY,
          fontSize: 14 * scale,
          lineHeight: Math.round(14 * 1.25 * scale),
          textAlign: "center",
          fontWeight: 400,
          color: DEFAULT_TEXT_COLOR,
          verticalAlign: "middle"
        };
      }

      if (element.type === "card") {
        const insetX = 22;
        const insetY = 22;
        const screen = screenFromWorld({ x: element.x + insetX, y: element.y + insetY });
        return {
          left: screen.x,
          top: screen.y,
          width: Math.max(1, element.width - insetX * 2) * scale,
          height: Math.max(1, element.height - insetY * 2) * scale,
          fontFamily: PIXI_TEXT_FONT_FAMILY,
          fontSize: 16 * scale,
          lineHeight: Math.round(16 * 1.3 * scale),
          textAlign: "left",
          fontWeight: 400,
          color: DEFAULT_TEXT_COLOR,
          verticalAlign: "top"
        };
      }

      if (element.type === "text") {
        const screen = screenFromWorld({ x: element.x, y: element.y });
        return {
          left: screen.x,
          top: screen.y,
          width: Math.max(1, element.width) * scale,
          height: Math.max(1, element.height) * scale,
          fontFamily: PIXI_TEXT_FONT_FAMILY,
          fontSize: element.fontSize * scale,
          lineHeight: Math.round(element.fontSize * 1.25 * scale),
          textAlign: "left",
          fontWeight: 400,
          color: element.fill,
          verticalAlign: "top"
        };
      }

      return null;
    }

    if (element.type !== "connector") return null;
    const elementsById = new Map(documentRef.current.elements.map((item) => [item.id, item]));
    const from = canvasDocumentEndpointPoint(element.from, elementsById);
    const to = canvasDocumentEndpointPoint(element.to, elementsById);
    const center = screenFromWorld({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 8 });
    const width = 180 * scale;
    const height = 28 * scale;
    return {
      left: center.x - width / 2,
      top: center.y - height / 2,
      width,
      height,
      fontFamily: PIXI_TEXT_FONT_FAMILY,
      fontSize: 12 * scale,
      lineHeight: Math.round(12 * 1.25 * scale),
      textAlign: "center",
      fontWeight: 400,
      color: DEFAULT_TEXT_COLOR,
      verticalAlign: "middle",
      borderRadius: 4 * scale,
      paddingX: 8 * scale
    };
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
    window.requestAnimationFrame(() => {
      const view = pixiRef.current?.views.get(id);
      const pixi = pixiRef.current;
      if (!view || !pixi) return;
      view.container.alpha = 0.72;
      view.container.scale.set(0.96);
      gsap.to(view.container, {
        alpha: 1,
        duration: 0.16,
        ease: "power2.out",
        onUpdate: () => schedulePixiRender(pixi)
      });
      gsap.to(view.container.scale, {
        x: 1,
        y: 1,
        duration: 0.16,
        ease: "power2.out",
        onUpdate: () => schedulePixiRender(pixi)
      });
    });
  }

  return (
    <TooltipProvider delayDuration={160}>
      <section className="relative h-full min-h-0 overflow-hidden bg-background">
        <div className="absolute left-[76px] top-4 z-20 flex items-center gap-1 rounded-md border bg-card/95 p-1 shadow-sm backdrop-blur">
          {SHAPE_OPTIONS.map((option) => (
            <ToolbarButton key={option.shape} label={`添加${option.label}`} onClick={() => addShape(option.shape)}>
              <Plus className="size-4" />
            </ToolbarButton>
          ))}
          <ToolbarButton label="添加卡片" onClick={addCard}>
            <CreditCard className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="添加文本" onClick={addText}>
            <TextIcon className="size-4" />
          </ToolbarButton>
          <ToolbarButton label={connectorStartId ? "点击第二个对象完成连线" : "添加连线"} active={Boolean(connectorStartId)} onClick={addConnectorFromSelection}>
            <Link className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="添加图片" onClick={() => void addImage()}>
            <FrameSimple className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="删除选中内容" disabled={!selectedIds.length} onClick={deleteSelection}>
            <Xmark className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="重置视图" onClick={resetViewport}>
            <Maximize className="size-4" />
          </ToolbarButton>
        </div>
        {connectorStartId ? (
          <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            选择第二个对象完成连线
          </div>
        ) : null}
        {imageUrlDialogOpen ? (
          <div
            className="absolute inset-0 z-50 grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setImageUrlDialogOpen(false);
            }}
          >
            <form
              className="grid w-[min(420px,100%)] gap-3 rounded-md border bg-card p-4 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void addImageFromUrl(imageUrlDraft);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">添加图片 URL</div>
                  <div className="mt-1 text-xs text-muted-foreground">输入 http、https、data 或本地可访问的图片地址。</div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => setImageUrlDialogOpen(false)} aria-label="关闭图片 URL 输入">
                  <Xmark className="size-4" />
                </Button>
              </div>
              <Input
                value={imageUrlDraft}
                autoFocus
                placeholder="https://example.com/image.png"
                onChange={(event) => setImageUrlDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setImageUrlDialogOpen(false);
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setImageUrlDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={!imageUrlDraft.trim()}>
                  添加图片
                </Button>
              </div>
            </form>
          </div>
        ) : null}
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
        {inlineEdit?.type === "item" && editStyle ? (
          <>
            <div
              ref={itemEditorMeasureRef}
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] top-0 whitespace-pre-wrap"
              style={{
                width: editStyle.width,
                fontFamily: editStyle.fontFamily,
                fontSize: editStyle.fontSize,
                fontWeight: editStyle.fontWeight,
                lineHeight: `${editStyle.lineHeight}px`,
                textAlign: editStyle.textAlign,
                overflowWrap: "break-word",
                wordBreak: "break-word",
                visibility: "hidden"
              }}
            >
              {inlineEdit.value || "\u200b"}
            </div>
            <Textarea
              ref={itemEditorRef}
              aria-label="编辑画布文字"
              value={inlineEdit.value}
              className="absolute z-40 block min-h-0 resize-none overflow-x-hidden rounded-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{
                left: editStyle.left,
                top: editStyle.top + itemEditorLayout.insetTop,
                width: editStyle.width,
                height: itemEditorLayout.height,
                color: editStyle.color,
                fontFamily: editStyle.fontFamily,
                fontSize: editStyle.fontSize,
                fontWeight: editStyle.fontWeight,
                lineHeight: `${editStyle.lineHeight}px`,
                textAlign: editStyle.textAlign,
                overflowWrap: "break-word",
                wordBreak: "break-word",
                overflowY: itemEditorLayout.scrollable ? "auto" : "hidden"
              }}
              onChange={(event) => setCanvasInlineEdit({ ...inlineEdit, value: event.target.value }, { renderScene: false })}
              onBlur={() => commitInlineEdit(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  commitInlineEdit(true);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  commitInlineEdit(false);
                }
              }}
            />
          </>
        ) : null}
        {inlineEdit?.type === "connection" && editStyle ? (
          <Input
            ref={connectionEditorRef}
            aria-label="编辑连线文字"
            value={inlineEdit.value}
            className="absolute z-40 h-auto min-h-0 rounded-none border bg-card p-0 text-center font-normal shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              left: editStyle.left,
              top: editStyle.top,
              width: editStyle.width,
              height: editStyle.height,
              borderRadius: editStyle.borderRadius,
              color: editStyle.color,
              fontFamily: editStyle.fontFamily,
              fontSize: editStyle.fontSize,
              fontWeight: editStyle.fontWeight,
              lineHeight: `${editStyle.lineHeight}px`,
              paddingLeft: editStyle.paddingX,
              paddingRight: editStyle.paddingX,
              textAlign: editStyle.textAlign
            }}
            onChange={(event) => setCanvasInlineEdit({ ...inlineEdit, value: event.target.value }, { renderScene: false })}
            onBlur={() => commitInlineEdit(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitInlineEdit(true);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                commitInlineEdit(false);
              }
            }}
          />
        ) : null}
      </section>
    </TooltipProvider>
  );
}

function syncPixiScene(
  pixi: PixiCanvasRuntime,
  document: CanvasDocument,
  dimensions: CanvasDocumentDimensions,
  selectedIds: string[],
  connectorStartId: string | null,
  imageDisplaySrcBySrc: Record<string, string>,
  interactionState: StandardCanvasInteractionState,
  inlineEdit: CanvasDocumentInlineEdit | null
) {
  if (pixi.disposed) return;
  const visibleElements = canvasDocumentVisibleElements(document, dimensions, selectedIds, connectorStartId);
  const visibleIds = new Set(visibleElements.map((element) => element.id));
  for (const [id, view] of pixi.views) {
    if (visibleIds.has(id)) continue;
    view.container.removeFromParent();
    view.container.destroy({ children: true });
    pixi.views.delete(id);
  }

  pixi.connectors.removeChildren();
  pixi.objects.removeChildren();
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const selected = new Set(selectedIds);

  for (const element of visibleElements) {
    const view = getPixiElementView(pixi, element);
    syncElementView(pixi, view, element, elementsById, selected, connectorStartId, imageDisplaySrcBySrc[element.type === "image" ? element.src : ""], document.viewport.scale, inlineEdit);
    if (element.type === "connector") pixi.connectors.addChild(view.container);
    else pixi.objects.addChild(view.container);
  }

  applyPixiViewport(pixi, document.viewport, dimensions);
  drawSelectionOverlay(pixi, document, selectedIds, interactionState);
  schedulePixiRender(pixi);
}

function applyPixiViewport(pixi: PixiCanvasRuntime, viewport: ViewportState, dimensions: CanvasDocumentDimensions) {
  pixi.world.position.set(viewport.x, viewport.y);
  pixi.world.scale.set(viewport.scale);
  drawGrid(pixi.grid, viewport, dimensions);
}

function resizePixiRenderer(pixi: PixiCanvasRuntime, dimensions: CanvasDocumentDimensions) {
  const width = Math.max(1, Math.floor(dimensions.width));
  const height = Math.max(1, Math.floor(dimensions.height));
  pixi.app.renderer.resize(width, height, canvasRendererResolution());
  pixi.app.canvas.style.width = `${width}px`;
  pixi.app.canvas.style.height = `${height}px`;
}

function getPixiElementView(pixi: PixiCanvasRuntime, element: CanvasDocumentElement) {
  const existing = pixi.views.get(element.id);
  if (existing?.type === element.type) return existing;
  if (existing) {
    existing.container.removeFromParent();
    existing.container.destroy({ children: true });
  }

  const container = new Container();
  const body = new Graphics();
  container.addChild(body);
  container.eventMode = "static";
  container.cursor = "pointer";
  const view: PixiElementView = { id: element.id, type: element.type, container, body };
  pixi.views.set(element.id, view);
  return view;
}

function syncElementView(
  pixi: PixiCanvasRuntime,
  view: PixiElementView,
  element: CanvasDocumentElement,
  elementsById: Map<string, CanvasDocumentElement>,
  selected: Set<string>,
  connectorStartId: string | null,
  displaySrc: string | undefined,
  viewportScale: number,
  inlineEdit: CanvasDocumentInlineEdit | null
) {
  const selectedOrConnecting = selected.has(element.id) || connectorStartId === element.id;
  const editingText = (inlineEdit?.type === "item" && inlineEdit.id === element.id) || (inlineEdit?.type === "connection" && inlineEdit.id === element.id);
  const signature = elementSignature(element, elementsById, selectedOrConnecting, displaySrc, viewportScale, editingText);
  if (view.signature === signature) return;
  view.signature = signature;
  view.body.clear();
  view.container.position.set(0, 0);
  view.container.scale.set(1);
  view.container.alpha = 1;

  if (element.type === "shape") {
    drawShape(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    if (editingText) {
      removeTextDisplay(view);
    } else {
      syncTextDisplay(view, element.text || "", {
        x: element.width / 2,
        y: element.height / 2,
        width: Math.max(1, element.width - 24),
        fontSize: 14,
        fill: DEFAULT_TEXT_COLOR,
        anchor: 0.5,
        align: "center",
        viewportScale
      });
    }
    return;
  }

  if (element.type === "card") {
    drawCard(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    if (editingText) {
      removeTextDisplay(view);
    } else {
      syncTextDisplay(view, element.text || "", {
        x: 22,
        y: 22,
        width: Math.max(1, element.width - 44),
        fontSize: 16,
        fill: DEFAULT_TEXT_COLOR,
        anchor: { x: 0, y: 0 },
        align: "left",
        viewportScale
      });
    }
    return;
  }

  if (element.type === "text") {
    drawTextFrame(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    if (editingText) {
      removeTextDisplay(view);
    } else {
      syncTextDisplay(view, element.text, {
        x: 0,
        y: element.height / 2,
        width: Math.max(1, element.width),
        fontSize: element.fontSize,
        fill: element.fill,
        anchor: { x: 0, y: 0.5 },
        align: "left",
        viewportScale
      });
    }
    return;
  }

  if (element.type === "image") {
    drawImageFrame(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    syncImageSprite(pixi, view, element, displaySrc);
    removeTextDisplay(view);
    return;
  }

  drawConnector(view, element, elementsById, selected.has(element.id), viewportScale, editingText);
}

function elementSignature(
  element: CanvasDocumentElement,
  elementsById: Map<string, CanvasDocumentElement>,
  selectedOrConnecting: boolean,
  displaySrc: string | undefined,
  viewportScale: number,
  editingText: boolean
) {
  const textResolution = canvasTextResolution(viewportScale);
  if (element.type === "connector") {
    const from = canvasDocumentEndpointPoint(element.from, elementsById);
    const to = canvasDocumentEndpointPoint(element.to, elementsById);
    return JSON.stringify({ ...element, fromPoint: from, toPoint: to, selectedOrConnecting, textResolution, editingText });
  }
  return JSON.stringify({ ...element, selectedOrConnecting, displaySrc, textResolution, editingText });
}

function drawShape(graphics: Graphics, element: CanvasShapeElement, selectedOrConnecting: boolean) {
  const stroke = parsePixiColor(selectedOrConnecting ? SELECTED_COLOR : element.stroke, 0x2f2a25);
  const strokeWidth = selectedOrConnecting ? Math.max(2, element.strokeWidth + 0.5) : element.strokeWidth;
  const fill = parsePixiColor(element.fill, 0xfbf6ef);
  if (element.shape === "ellipse") {
    graphics.ellipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2).fill({ color: fill }).stroke({ color: stroke, width: strokeWidth });
    return;
  }
  if (element.shape === "diamond") {
    graphics
      .poly([element.width / 2, 0, element.width, element.height / 2, element.width / 2, element.height, 0, element.height / 2], true)
      .fill({ color: fill })
      .stroke({ color: stroke, width: strokeWidth });
    return;
  }
  graphics
    .roundRect(0, 0, element.width, element.height, element.shape === "roundRect" ? 16 : 4)
    .fill({ color: fill })
    .stroke({ color: stroke, width: strokeWidth });
}

function drawCard(graphics: Graphics, element: CanvasCardElement, selectedOrConnecting: boolean) {
  const stroke = parsePixiColor(selectedOrConnecting ? SELECTED_COLOR : element.stroke, 0xd8d3ca);
  const strokeWidth = selectedOrConnecting ? Math.max(2, element.strokeWidth + 0.5) : element.strokeWidth;
  const fill = parsePixiColor(element.fill, 0xfffdf8);
  const points = superellipseRectPathPoints({
    width: element.width,
    height: element.height,
    radius: element.cornerRadius
  });
  const [first, ...rest] = points;
  if (!first) return;
  graphics.moveTo(first.x, first.y);
  for (const point of rest) graphics.lineTo(point.x, point.y);
  graphics.closePath().fill({ color: fill }).stroke({ color: stroke, width: strokeWidth });
}

function drawTextFrame(graphics: Graphics, element: CanvasTextElement, selectedOrConnecting: boolean) {
  if (!selectedOrConnecting) return;
  graphics.roundRect(0, 0, element.width, element.height, 4).stroke({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), width: 1.5, alpha: 0.95 });
}

function drawImageFrame(graphics: Graphics, element: CanvasImageElement, selectedOrConnecting: boolean) {
  const stroke = parsePixiColor(selectedOrConnecting ? SELECTED_COLOR : IMAGE_BORDER_COLOR, 0xd8cfc3);
  graphics.roundRect(0, 0, element.width, element.height, 6).stroke({ color: stroke, width: 1.5 });
}

function drawConnector(view: PixiElementView, element: CanvasConnectorElement, elementsById: Map<string, CanvasDocumentElement>, selected: boolean, viewportScale: number, editingText: boolean) {
  const from = canvasDocumentEndpointPoint(element.from, elementsById);
  const to = canvasDocumentEndpointPoint(element.to, elementsById);
  const color = parsePixiColor(selected ? SELECTED_COLOR : element.stroke, 0x2f2a25);
  const width = selected ? element.strokeWidth + 0.75 : element.strokeWidth;
  view.body.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color, width });
  if (element.markerEnd !== "none") drawArrowHead(view.body, from, to, color, width);

  const minX = Math.min(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  view.container.hitArea = new Rectangle(minX - 8, minY - 8, Math.abs(from.x - to.x) + 16, Math.abs(from.y - to.y) + 16);
  if (element.label && !editingText) {
    syncTextDisplay(view, element.label, {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 8,
      width: 180,
      fontSize: 12,
      fill: DEFAULT_TEXT_COLOR,
      anchor: 0.5,
      align: "center",
      viewportScale
    });
  } else {
    removeTextDisplay(view);
  }
}

function drawArrowHead(graphics: Graphics, from: Point, to: Point, color: number, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = 10 + width;
  const half = 4 + width * 0.4;
  const back = {
    x: to.x - Math.cos(angle) * length,
    y: to.y - Math.sin(angle) * length
  };
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  graphics
    .poly([to.x, to.y, back.x + normal.x * half, back.y + normal.y * half, back.x - normal.x * half, back.y - normal.y * half], true)
    .fill({ color })
    .stroke({ color, width: Math.max(1, width * 0.75) });
}

function syncImageSprite(pixi: PixiCanvasRuntime, view: PixiElementView, element: CanvasImageElement, displaySrc: string | undefined) {
  if (!view.sprite) {
    view.sprite = new Sprite(Texture.EMPTY);
    view.container.addChildAt(view.sprite, 0);
  }
  layoutImageSprite(view.sprite, element);
  if (!displaySrc) {
    view.imageSrc = undefined;
    view.sprite.texture = Texture.EMPTY;
    return;
  }
  if (view.imageSrc === displaySrc) return;

  view.imageSrc = displaySrc;
  view.sprite.texture = Texture.EMPTY;
  void Assets.load(displaySrc)
    .then((texture) => {
      const current = pixi.views.get(view.id);
      if (!current || current !== view || current.imageSrc !== displaySrc || !view.sprite) return;
      texture.source.style.scaleMode = "linear";
      view.sprite.texture = texture;
      const currentElement = findImageElementById(view.id, pixi, element);
      layoutImageSprite(view.sprite, currentElement || element);
      schedulePixiRender(pixi);
    })
    .catch(() => {
      schedulePixiRender(pixi);
    });
}

function findImageElementById(id: string, pixi: PixiCanvasRuntime, fallback: CanvasImageElement) {
  const view = pixi.views.get(id);
  return view?.type === "image" ? fallback : null;
}

function layoutImageSprite(sprite: Sprite, element: CanvasImageElement) {
  const textureWidth = sprite.texture.width || element.width;
  const textureHeight = sprite.texture.height || element.height;
  if (!element.preserveAspectRatio || !textureWidth || !textureHeight) {
    sprite.x = 0;
    sprite.y = 0;
    sprite.width = element.width;
    sprite.height = element.height;
    return;
  }
  const scale = Math.min(element.width / textureWidth, element.height / textureHeight);
  sprite.width = textureWidth * scale;
  sprite.height = textureHeight * scale;
  sprite.x = (element.width - sprite.width) / 2;
  sprite.y = (element.height - sprite.height) / 2;
}

function syncTextDisplay(
  view: PixiElementView,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    fontSize: number;
    fill: string;
    anchor: number | { x: number; y: number };
    align: "left" | "center";
    viewportScale: number;
  }
) {
  if (!text) {
    removeTextDisplay(view);
    return;
  }

  const textResolution = canvasTextResolution(options.viewportScale);
  const key = JSON.stringify({ text, options, textResolution });
  if (view.text && view.textKey === key) return;
  removeTextDisplay(view);

  const style = {
    fontFamily: PIXI_TEXT_FONT_FAMILY,
    fontSize: options.fontSize,
    fill: parsePixiColor(options.fill, 0x2f2a25),
    align: options.align,
    wordWrap: true,
    wordWrapWidth: options.width,
    lineHeight: Math.round(options.fontSize * 1.25)
  };
  const display = new PixiText({
    text,
    style,
    anchor: options.anchor,
    resolution: textResolution,
    textureStyle: {
      scaleMode: "linear"
    },
    autoGenerateMipmaps: true
  });
  display.x = options.x;
  display.y = options.y;
  display.eventMode = "none";
  view.text = display;
  view.textKey = key;
  view.container.addChild(display);
}

function removeTextDisplay(view: PixiElementView) {
  if (!view.text) return;
  view.text.removeFromParent();
  view.text.destroy();
  view.text = undefined;
  view.textKey = undefined;
}

function drawSelectionOverlay(pixi: PixiCanvasRuntime, document: CanvasDocument, selectedIds: string[], interactionState: StandardCanvasInteractionState) {
  pixi.selection.clear();
  const scale = Math.max(document.viewport.scale, 0.01);
  if (interactionState.kind === "marqueeSelecting") {
    const x = Math.min(interactionState.startWorld.x, interactionState.currentWorld.x);
    const y = Math.min(interactionState.startWorld.y, interactionState.currentWorld.y);
    const width = Math.abs(interactionState.currentWorld.x - interactionState.startWorld.x);
    const height = Math.abs(interactionState.currentWorld.y - interactionState.startWorld.y);
    pixi.selection
      .rect(x, y, width, height)
      .fill({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), alpha: 0.08 })
      .stroke({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), width: 1 / scale, alpha: 0.7 });
  }
  if (!selectedIds.length) return;
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const selectedElements = selectedIds.map((id) => elementsById.get(id)).filter((element): element is CanvasDocumentElement => Boolean(element));
  if (selectedElements.length !== 1) return;
  const element = selectedElements[0];
  if (element.type === "connector") return;

  const frame = canvasElementFrame(element);
  const handleSize = 14 / scale;
  pixi.selection
    .rect(frame.x, frame.y, frame.width, frame.height)
    .stroke({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), width: 1 / scale, alpha: 0.95 })
    .roundRect(frame.x + frame.width - handleSize / 2, frame.y + frame.height - handleSize / 2, handleSize, handleSize, 3 / scale)
    .fill({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d) })
    .stroke({ color: parsePixiColor(SURFACE_COLOR, 0xfbf6ef), width: 1.5 / scale });
}

function drawGrid(graphics: Graphics, viewport: ViewportState, dimensions: CanvasDocumentDimensions) {
  graphics.clear();
  const rawStep = 32 * viewport.scale;
  const step = rawStep < 8 ? rawStep * Math.ceil(8 / Math.max(rawStep, 0.01)) : rawStep;
  const offsetX = positiveModulo(viewport.x, step);
  const offsetY = positiveModulo(viewport.y, step);

  for (let x = offsetX; x < dimensions.width; x += step) {
    graphics.moveTo(x, 0).lineTo(x, dimensions.height);
  }
  for (let y = offsetY; y < dimensions.height; y += step) {
    graphics.moveTo(0, y).lineTo(dimensions.width, y);
  }
  graphics.stroke({ color: GRID_COLOR, width: 1, alpha: 0.08 });
}

function schedulePixiRender(pixi: PixiCanvasRuntime) {
  if (pixi.disposed || pixi.renderFrame !== null) return;
  pixi.renderFrame = window.requestAnimationFrame(() => {
    pixi.renderFrame = null;
    if (!pixi.disposed) pixi.app.render();
  });
}

function registerPixiPlugin() {
  if (pixiPluginRegistered) return;
  gsap.registerPlugin(PixiPlugin);
  PixiPlugin.registerPIXI(PIXI);
  pixiPluginRegistered = true;
}

function parsePixiColor(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return Number.parseInt(trimmed.slice(1), 16);
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }
  return fallback;
}

function positiveModulo(value: number, modulus: number) {
  return ((value % modulus) + modulus) % modulus;
}

function canvasRendererResolution() {
  const ratio = typeof window === "undefined" ? MIN_RENDERER_RESOLUTION : window.devicePixelRatio || 1;
  return Math.min(MAX_RENDERER_RESOLUTION, Math.max(MIN_RENDERER_RESOLUTION, ratio));
}

function canvasTextResolution(viewportScale: number) {
  const scaled = canvasRendererResolution() * Math.max(1, viewportScale);
  return Math.min(MAX_TEXT_TEXTURE_RESOLUTION, Math.max(MIN_RENDERER_RESOLUTION, Math.ceil(scaled * 2) / 2));
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={active ? "default" : "ghost"}
          className={cn("size-8", active ? "text-background hover:text-background" : "text-icon hover:text-icon")}
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(DEFAULT_DIMENSIONS);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height))
      });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

async function loadImageDimensions(src: string) {
  if (typeof window === "undefined" || !src) return { width: DEFAULT_IMAGE_WIDTH, height: DEFAULT_IMAGE_HEIGHT };

  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.naturalWidth || DEFAULT_IMAGE_WIDTH;
      const height = image.naturalHeight || DEFAULT_IMAGE_HEIGHT;
      const maxSide = Math.max(width, height, 1);
      const scale = maxSide > 420 ? 420 / maxSide : 1;
      resolve({
        width: Math.max(48, Math.round(width * scale)),
        height: Math.max(48, Math.round(height * scale))
      });
    };
    image.onerror = () => resolve({ width: DEFAULT_IMAGE_WIDTH, height: DEFAULT_IMAGE_HEIGHT });
    image.src = src;
  });
}
