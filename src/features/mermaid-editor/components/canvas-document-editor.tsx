import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type React from "react";
import { FrameSimple, Link, Maximize, Plus, Text as TextIcon, Xmark } from "iconoir-react/regular";
import * as PIXI from "pixi.js";
import { Application, Assets, BitmapText, Container, Graphics, Rectangle, Sprite, Text as PixiText, Texture } from "pixi.js";
import { PixiPlugin } from "gsap/PixiPlugin";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  canvasElementFrame,
  createCanvasConnectorElement,
  createCanvasImageElement,
  createCanvasShapeElement,
  createCanvasTextElement,
  normalizeCanvasDocument,
  type CanvasConnectorElement,
  type CanvasConnectorEndpoint,
  type CanvasDocument,
  type CanvasDocumentElement,
  type CanvasImageElement,
  type CanvasShapeElement,
  type CanvasShapeKind,
  type CanvasTextElement
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  canUseCanvasBitmapText,
  canvasDocumentEndpointPoint,
  canvasDocumentScreenToWorld,
  canvasDocumentVisibleElements,
  endpointReferencesSelection,
  hitCanvasDocument,
  type CanvasDocumentDimensions
} from "@/features/mermaid-editor/lib/canvas-document-rendering";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { gsap } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { cn } from "@/lib/utils";

type CanvasDocumentEditorProps = {
  document: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
  onChange: (document: CanvasDocument, status?: string) => void;
  onStatus?: (status: string) => void;
};

type DragState =
  | {
      kind: "pan";
      pointerId: number;
      startScreen: Point;
      viewport: ViewportState;
      changed: boolean;
    }
  | {
      kind: "move";
      pointerId: number;
      startWorld: Point;
      baseDocument: CanvasDocument;
      origins: Record<string, Point>;
      ids: string[];
      changed: boolean;
    }
  | {
      kind: "resize";
      pointerId: number;
      id: string;
      startWorld: Point;
      baseDocument: CanvasDocument;
      frame: { x: number; y: number; width: number; height: number };
      changed: boolean;
    };

type Point = {
  x: number;
  y: number;
};

type PixiTextDisplay = BitmapText | PixiText;

type PixiElementView = {
  id: string;
  type: CanvasDocumentElement["type"];
  container: Container;
  body: Graphics;
  sprite?: Sprite;
  text?: PixiTextDisplay;
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

let pixiPluginRegistered = false;

export function CanvasDocumentEditor({ document, fileRef, runtime, onChange, onStatus }: CanvasDocumentEditorProps) {
  const normalizedDocument = useMemo(() => normalizeCanvasDocument(document), [document]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiCanvasRuntime | null>(null);
  const documentRef = useRef<CanvasDocument>(normalizedDocument);
  const dimensionsRef = useRef<CanvasDocumentDimensions>(DEFAULT_DIMENSIONS);
  const selectedIdsRef = useRef<string[]>([]);
  const connectorStartIdRef = useRef<string | null>(null);
  const imageDisplaySrcBySrcRef = useRef<Record<string, string>>({});
  const dragRef = useRef<DragState | null>(null);
  const renderCurrentSceneRef = useRef(() => {});
  const renderViewportOnlyRef = useRef(() => {});
  const dimensions = useContainerSize(containerRef);
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const [connectorStartId, setConnectorStartIdState] = useState<string | null>(null);
  const [imageDisplaySrcBySrc, setImageDisplaySrcBySrc] = useState<Record<string, string>>({});

  renderCurrentSceneRef.current = () => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    syncPixiScene(pixi, documentRef.current, dimensionsRef.current, selectedIdsRef.current, connectorStartIdRef.current, imageDisplaySrcBySrcRef.current);
  };
  renderViewportOnlyRef.current = () => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    applyPixiViewport(pixi, documentRef.current.viewport, dimensionsRef.current);
    drawSelectionOverlay(pixi, documentRef.current, selectedIdsRef.current);
    schedulePixiRender(pixi);
  };

  useEffect(() => {
    documentRef.current = normalizedDocument;
    renderCurrentSceneRef.current();
  }, [normalizedDocument]);

  useEffect(() => {
    dimensionsRef.current = dimensions;
    const pixi = pixiRef.current;
    if (pixi) {
      pixi.app.renderer.resize(dimensions.width, dimensions.height, window.devicePixelRatio || 1);
      renderCurrentSceneRef.current();
    }
  }, [dimensions]);

  useEffect(() => {
    imageDisplaySrcBySrcRef.current = imageDisplaySrcBySrc;
    renderCurrentSceneRef.current();
  }, [imageDisplaySrcBySrc]);

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
        resolution: window.devicePixelRatio || 1,
        autoStart: false,
        preference: "webgl",
        powerPreference: "high-performance",
        antialias: false,
        backgroundAlpha: 0
      })
      .then(() => {
        if (disposed) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }

        app.canvas.className = "block h-full w-full";
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";
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

        pixiRef.current = {
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
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIdsRef.current.length) {
        event.preventDefault();
        deleteSelection();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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

  function setSelectedIds(next: string[] | ((current: string[]) => string[])) {
    const resolved = typeof next === "function" ? next(selectedIdsRef.current) : next;
    selectedIdsRef.current = resolved;
    setSelectedIdsState(resolved);
    renderViewportOnlyRef.current();
  }

  function setConnectorStartId(next: string | null) {
    connectorStartIdRef.current = next;
    setConnectorStartIdState(next);
    renderCurrentSceneRef.current();
  }

  function updateDocumentVisual(next: CanvasDocument) {
    documentRef.current = normalizeCanvasDocument(next);
    renderCurrentSceneRef.current();
  }

  function updateViewportVisual(nextViewport: ViewportState) {
    documentRef.current = { ...documentRef.current, viewport: nextViewport };
    renderViewportOnlyRef.current();
    scheduleViewportCommit();
  }

  function worldFromScreen(point: Point): Point {
    return canvasDocumentScreenToWorld(point, documentRef.current.viewport);
  }

  function pointerScreenPoint(event: React.PointerEvent): Point {
    return clientScreenPoint(event.clientX, event.clientY);
  }

  function clientScreenPoint(clientX: number, clientY: number): Point {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left || 0),
      y: clientY - (rect?.top || 0)
    };
  }

  function viewportCenterPoint(): Point {
    return worldFromScreen({ x: dimensionsRef.current.width / 2, y: dimensionsRef.current.height / 2 });
  }

  function updateElement(id: string, patch: Partial<CanvasShapeElement | CanvasTextElement | CanvasImageElement | CanvasConnectorElement>, status?: string) {
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

    const src = window.prompt("图片 URL");
    if (!src?.trim()) return;
    const center = viewportCenterPoint();
    const element = createCanvasImageElement(documentRef.current.elements, center.x - DEFAULT_IMAGE_WIDTH / 2, center.y - DEFAULT_IMAGE_HEIGHT / 2, src.trim());
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

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function editElementText(element: CanvasDocumentElement) {
    if (element.type !== "shape" && element.type !== "text" && element.type !== "connector") return;
    const next = window.prompt("文本", element.type === "connector" ? element.label || "" : element.text || "");
    if (next === null) return;
    if (element.type === "connector") updateElement(element.id, { label: next }, "已更新连线标签。");
    else updateElement(element.id, { text: next }, "已更新文本。");
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const screen = pointerScreenPoint(event);
    const current = documentRef.current;
    const hit = hitCanvasDocument(current, screen, dimensionsRef.current, selectedIdsRef.current);
    const element = hit.kind === "element" || hit.kind === "resize" ? current.elements.find((item) => item.id === hit.id) : null;

    if (hit.kind === "resize" && element && element.type !== "connector") {
      dragRef.current = {
        kind: "resize",
        pointerId: event.pointerId,
        id: element.id,
        startWorld: worldFromScreen(screen),
        baseDocument: current,
        frame: canvasElementFrame(element),
        changed: false
      };
      return;
    }

    if (element) {
      if (connectorStartIdRef.current && element.type !== "connector") {
        if (connectorStartIdRef.current === element.id) {
          setConnectorStartId(null);
          return;
        }
        const connector = createCanvasConnectorElement(current.elements, { elementId: connectorStartIdRef.current }, { elementId: element.id });
        commitElements([...current.elements, connector], "已连接两个画布对象。");
        setSelectedIds([connector.id]);
        setConnectorStartId(null);
        animateCreatedElement(connector.id);
        return;
      }

      if (event.shiftKey) {
        toggleSelection(element.id);
        return;
      }

      const dragIds = selectedIdsRef.current.includes(element.id) ? selectedIdsRef.current : [element.id];
      setSelectedIds(dragIds);
      if (element.type === "connector") return;

      const elementById = new Map(current.elements.map((item) => [item.id, item]));
      const movableIds = dragIds.filter((id) => elementById.get(id)?.type !== "connector");
      const origins = Object.fromEntries(
        movableIds.map((id) => {
          const item = elementById.get(id);
          if (!item || item.type === "connector") return [id, { x: 0, y: 0 }];
          return [id, { x: item.x, y: item.y }];
        })
      );
      dragRef.current = {
        kind: "move",
        pointerId: event.pointerId,
        startWorld: worldFromScreen(screen),
        baseDocument: current,
        origins,
        ids: movableIds,
        changed: false
      };
      return;
    }

    setSelectedIds([]);
    setConnectorStartId(null);
    dragRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      startScreen: screen,
      viewport: current.viewport,
      changed: false
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const screen = pointerScreenPoint(event);

    if (drag.kind === "pan") {
      drag.changed = true;
      updateViewportVisual({
        ...drag.viewport,
        x: drag.viewport.x + screen.x - drag.startScreen.x,
        y: drag.viewport.y + screen.y - drag.startScreen.y
      });
      return;
    }

    const currentWorld = worldFromScreen(screen);
    if (drag.kind === "move") {
      const dx = currentWorld.x - drag.startWorld.x;
      const dy = currentWorld.y - drag.startWorld.y;
      drag.changed = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
      updateDocumentVisual({
        ...drag.baseDocument,
        viewport: documentRef.current.viewport,
        elements: drag.baseDocument.elements.map((element) => {
          if (!drag.ids.includes(element.id) || element.type === "connector") return element;
          const origin = drag.origins[element.id];
          return { ...element, x: origin.x + dx, y: origin.y + dy };
        })
      });
      return;
    }

    if (drag.kind === "resize") {
      const dx = currentWorld.x - drag.startWorld.x;
      const dy = currentWorld.y - drag.startWorld.y;
      drag.changed = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
      updateDocumentVisual({
        ...drag.baseDocument,
        viewport: documentRef.current.viewport,
        elements: drag.baseDocument.elements.map((element) => {
          if (element.id !== drag.id || element.type === "connector") return element;
          return {
            ...element,
            width: Math.max(32, drag.frame.width + dx),
            height: Math.max(32, drag.frame.height + dy)
          };
        })
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.changed) commit(documentRef.current);
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const screen = clientScreenPoint(event.clientX, event.clientY);
    const hit = hitCanvasDocument(documentRef.current, screen, dimensionsRef.current, selectedIdsRef.current);
    if (hit.kind !== "element") return;
    const element = documentRef.current.elements.find((item) => item.id === hit.id);
    if (element) editElementText(element);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = clientScreenPoint(event.clientX, event.clientY);
    const viewport = documentRef.current.viewport;
    if (event.ctrlKey || event.metaKey) {
      const world = canvasDocumentScreenToWorld(point, viewport);
      const nextScale = Math.min(3, Math.max(0.2, viewport.scale * Math.exp(-event.deltaY * 0.0015)));
      updateViewportVisual({
        x: point.x - world.x * nextScale,
        y: point.y - world.y * nextScale,
        scale: nextScale
      });
      return;
    }

    updateViewportVisual({
      ...viewport,
      x: viewport.x - event.deltaX,
      y: viewport.y - event.deltaY
    });
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
        <div
          ref={containerRef}
          className="h-full min-h-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
        />
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
  imageDisplaySrcBySrc: Record<string, string>
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
    syncElementView(pixi, view, element, elementsById, selected, connectorStartId, imageDisplaySrcBySrc[element.type === "image" ? element.src : ""]);
    if (element.type === "connector") pixi.connectors.addChild(view.container);
    else pixi.objects.addChild(view.container);
  }

  applyPixiViewport(pixi, document.viewport, dimensions);
  drawSelectionOverlay(pixi, document, selectedIds);
  schedulePixiRender(pixi);
}

function applyPixiViewport(pixi: PixiCanvasRuntime, viewport: ViewportState, dimensions: CanvasDocumentDimensions) {
  pixi.world.position.set(viewport.x, viewport.y);
  pixi.world.scale.set(viewport.scale);
  drawGrid(pixi.grid, viewport, dimensions);
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
  displaySrc: string | undefined
) {
  const selectedOrConnecting = selected.has(element.id) || connectorStartId === element.id;
  const signature = elementSignature(element, elementsById, selectedOrConnecting, displaySrc);
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
    syncTextDisplay(view, element.text || "", {
      x: element.width / 2,
      y: element.height / 2,
      width: Math.max(1, element.width - 24),
      fontSize: 14,
      fill: DEFAULT_TEXT_COLOR,
      anchor: 0.5,
      align: "center"
    });
    return;
  }

  if (element.type === "text") {
    drawTextFrame(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    syncTextDisplay(view, element.text, {
      x: 0,
      y: element.height / 2,
      width: Math.max(1, element.width),
      fontSize: element.fontSize,
      fill: element.fill,
      anchor: { x: 0, y: 0.5 },
      align: "left"
    });
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

  drawConnector(view, element, elementsById, selected.has(element.id));
}

function elementSignature(element: CanvasDocumentElement, elementsById: Map<string, CanvasDocumentElement>, selectedOrConnecting: boolean, displaySrc: string | undefined) {
  if (element.type === "connector") {
    const from = canvasDocumentEndpointPoint(element.from, elementsById);
    const to = canvasDocumentEndpointPoint(element.to, elementsById);
    return JSON.stringify({ ...element, fromPoint: from, toPoint: to, selectedOrConnecting });
  }
  return JSON.stringify({ ...element, selectedOrConnecting, displaySrc });
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

function drawTextFrame(graphics: Graphics, element: CanvasTextElement, selectedOrConnecting: boolean) {
  if (!selectedOrConnecting) return;
  graphics.roundRect(0, 0, element.width, element.height, 4).stroke({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), width: 1.5, alpha: 0.95 });
}

function drawImageFrame(graphics: Graphics, element: CanvasImageElement, selectedOrConnecting: boolean) {
  const stroke = parsePixiColor(selectedOrConnecting ? SELECTED_COLOR : IMAGE_BORDER_COLOR, 0xd8cfc3);
  graphics.roundRect(0, 0, element.width, element.height, 6).stroke({ color: stroke, width: 1.5 });
}

function drawConnector(view: PixiElementView, element: CanvasConnectorElement, elementsById: Map<string, CanvasDocumentElement>, selected: boolean) {
  const from = canvasDocumentEndpointPoint(element.from, elementsById);
  const to = canvasDocumentEndpointPoint(element.to, elementsById);
  const color = parsePixiColor(selected ? SELECTED_COLOR : element.stroke, 0x2f2a25);
  const width = selected ? element.strokeWidth + 0.75 : element.strokeWidth;
  view.body.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color, width });
  if (element.markerEnd !== "none") drawArrowHead(view.body, from, to, color, width);

  const minX = Math.min(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  view.container.hitArea = new Rectangle(minX - 8, minY - 8, Math.abs(from.x - to.x) + 16, Math.abs(from.y - to.y) + 16);
  if (element.label) {
    syncTextDisplay(view, element.label, {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 8,
      width: 180,
      fontSize: 12,
      fill: DEFAULT_TEXT_COLOR,
      anchor: 0.5,
      align: "center"
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
  }
) {
  if (!text) {
    removeTextDisplay(view);
    return;
  }

  const useBitmap = canUseCanvasBitmapText(text);
  const key = JSON.stringify({ text, options, useBitmap });
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
  const display: PixiTextDisplay = useBitmap ? new BitmapText({ text, style, anchor: options.anchor }) : new PixiText({ text, style, anchor: options.anchor });
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

function drawSelectionOverlay(pixi: PixiCanvasRuntime, document: CanvasDocument, selectedIds: string[]) {
  pixi.selection.clear();
  if (!selectedIds.length) return;
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const selectedElements = selectedIds.map((id) => elementsById.get(id)).filter((element): element is CanvasDocumentElement => Boolean(element));
  if (selectedElements.length !== 1) return;
  const element = selectedElements[0];
  if (element.type === "connector") return;

  const frame = canvasElementFrame(element);
  const scale = Math.max(document.viewport.scale, 0.01);
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
