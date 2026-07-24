import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import {
  Copy,
  Frame,
  MediaImage,
  NavArrowLeft,
  NavArrowRight,
  Refresh,
  RotateCameraRight,
  ScaleFrameEnlarge,
  ZoomIn,
  ZoomOut
} from "iconoir-react/regular";

import { Spinner } from "@/components/ui/spinner";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import {
  createWheelIntentTracker,
  resolveWheelNavigation,
  zoomViewportAtPoint
} from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import {
  imageViewerInitialViewport,
  imageViewerNavigationDirectionForKey,
  imageViewerPresetViewport,
  imageViewerZoomBounds,
  revisionedImageViewerSrc,
  type ImageViewerMode,
  type ImageViewerViewMode
} from "@/features/mermaid-editor/lib/image-viewer";
import type { DetachedImageWindow } from "@/features/mermaid-editor/lib/workspace-panels";
import { cn } from "@/lib/utils";

type ImageLoadState = "loading" | "ready" | "error";
type PanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewport: ViewportState;
  moved: boolean;
};

export function ImageWindowPanel({
  imageWindow,
  runtime,
  active,
  onNavigate,
  onStatus
}: {
  imageWindow: DetachedImageWindow;
  runtime: EditorRuntime;
  active: boolean;
  onNavigate: (direction: -1 | 1) => void;
  onStatus: (message: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<PanState | null>(null);
  const wheelIntentTrackerRef = useRef(createWheelIntentTracker());
  const [displaySrc, setDisplaySrc] = useState("");
  const [loadState, setLoadState] = useState<ImageLoadState>("loading");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, scale: 1 });
  const [viewMode, setViewMode] = useState<ImageViewerViewMode>("auto");
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);
  const [localStatus, setLocalStatus] = useState("");
  const sourceRevision = (imageWindow.revision || 0) + retryRevision;
  const imageSource = imageWindow.source || imageWindow.file.path;
  const sourceLabel = imageWindow.watchPath || imageSource;
  const navigationCount = imageWindow.navigation?.items.length || 1;
  const navigationIndex = Math.min(navigationCount - 1, Math.max(0, imageWindow.navigation?.index || 0));
  const imageIdentity = imageWindow.navigation?.items[navigationIndex]?.identity || imageWindow.file.path;
  const canNavigate = navigationCount > 1;

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;
    const update = () => setViewportSize({ width: viewportElement.clientWidth, height: viewportElement.clientHeight });
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setNaturalSize({ width: 0, height: 0 });
    setViewMode("auto");
    setRotation(0);
    setDragging(false);
    panRef.current = null;
    wheelIntentTrackerRef.current = createWheelIntentTracker();
  }, [imageIdentity]);

  useEffect(() => {
    if (imageWindow.missing) {
      setDisplaySrc("");
      setLoadState("error");
      return;
    }
    let disposed = false;
    setDisplaySrc("");
    setLoadState("loading");
    void runtime.resolveImageAssetSrc(imageWindow.documentFile ?? null, imageSource).then((src) => {
      if (!disposed) setDisplaySrc(revisionedImageViewerSrc(src, sourceRevision));
    }).catch((error) => {
      if (disposed) return;
      setLoadState("error");
      reportStatus(`无法载入图片：${readableError(error)}`);
    });
    return () => { disposed = true; };
    // reportStatus only forwards transient UI feedback and must not restart file resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSource, imageWindow.documentFile, imageWindow.missing, runtime, sourceRevision]);

  useEffect(() => {
    if (viewMode === "manual" || naturalSize.width <= 0 || naturalSize.height <= 0) return;
    const input = {
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      rotation
    };
    setViewport(viewMode === "auto"
      ? imageViewerInitialViewport(input)
      : imageViewerPresetViewport({ ...input, mode: viewMode }));
  }, [naturalSize.height, naturalSize.width, rotation, viewMode, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    if (!localStatus) return;
    const timer = window.setTimeout(() => setLocalStatus(""), 2400);
    return () => window.clearTimeout(timer);
  }, [localStatus]);

  useEffect(() => {
    if (!active || !canNavigate) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isTextEntryTarget(event.target)) return;
      const direction = imageViewerNavigationDirectionForKey(event.key);
      if (direction === null) return;
      event.preventDefault();
      onNavigate(direction);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, canNavigate, onNavigate]);

  function reportStatus(message: string) {
    setLocalStatus(message);
    onStatus(message);
  }

  function chooseMode(mode: ImageViewerMode) {
    setViewMode(mode);
    setViewport(imageViewerPresetViewport({
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      rotation,
      mode
    }));
  }

  function changeZoom(factor: number) {
    const pointer = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
    setViewport((current) => zoomViewportAtPoint(current, pointer, current.scale * factor, imageViewerZoomBounds(current.scale)));
    setViewMode("manual");
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const element = viewportRef.current;
    if (!element) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const result = resolveWheelNavigation({
      viewport,
      pointer: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      canvasSize: viewportSize,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      timestamp: event.timeStamp,
      intentTracker: wheelIntentTrackerRef.current,
      interactionKind: "idle",
      scaleBounds: imageViewerZoomBounds(viewport.scale)
    });
    if (result.kind === "ignored") return;
    setViewport(result.viewport);
    setViewMode("manual");
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewport: viewport,
      moved: false
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may fail when the platform has already released the pointer.
    }
    setDragging(true);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pan.startClientX;
    const deltaY = event.clientY - pan.startClientY;
    if (!pan.moved && Math.hypot(deltaX, deltaY) >= 2) {
      pan.moved = true;
      setViewMode("manual");
    }
    if (!pan.moved) return;
    setViewport({ ...pan.startViewport, x: pan.startViewport.x + deltaX, y: pan.startViewport.y + deltaY });
    event.preventDefault();
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may release capture before pointerup reaches React.
    }
  }

  function reloadImage() {
    setRetryRevision((current) => current + 1);
    reportStatus(`正在重新载入 ${imageWindow.title}。`);
  }

  function copyPath() {
    void navigator.clipboard?.writeText(sourceLabel);
    reportStatus("已复制图片路径。");
  }

  const scaleLabel = `${Math.round(viewport.scale * 100)}%`;
  const sizeLabel = naturalSize.width && naturalSize.height ? `${naturalSize.width} × ${naturalSize.height}` : "";
  const positionLabel = `${navigationIndex + 1} / ${navigationCount}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-image-viewer-state={imageWindow.missing ? "missing" : loadState}>
      <WorkspaceWindowHeader
        leadingActions={<>
          <EditorIconButton context="panel" label="上一张" disabled={!canNavigate} onClick={() => onNavigate(-1)}><NavArrowLeft /></EditorIconButton>
          <EditorIconButton context="panel" label="下一张" disabled={!canNavigate} onClick={() => onNavigate(1)}><NavArrowRight /></EditorIconButton>
        </>}
        icon={<MediaImage className="size-4 shrink-0 text-icon" />}
        title={<span className="block max-w-56 truncate">{imageWindow.title}</span>}
        titleTooltip={`${imageWindow.title}\n${sourceLabel}`}
        status={localStatus
          ? <span className="type-interface-status hidden max-w-40 truncate text-muted-foreground xl:block" aria-live="polite">{localStatus}</span>
          : loadState === "loading" ? <span className="type-interface-status hidden items-center gap-1.5 text-muted-foreground xl:flex"><Spinner className="size-3.5" />载入中</span> : null}
        center={<span className="min-w-0 flex-1 truncate px-2 text-center text-xs tabular-nums text-muted-foreground" title={sourceLabel}>{[positionLabel, sizeLabel, scaleLabel].filter(Boolean).join(" · ")}</span>}
        actions={<>
          <EditorIconButton context="panel" label="适应窗口" pressed={viewMode === "fit"} onClick={() => chooseMode("fit")}><Frame /></EditorIconButton>
          <EditorIconButton context="panel" label="原始尺寸" pressed={viewMode === "actual"} onClick={() => chooseMode("actual")}><ScaleFrameEnlarge /></EditorIconButton>
          <EditorIconButton context="panel" label="缩小画布" onClick={() => changeZoom(1 / 1.2)}><ZoomOut /></EditorIconButton>
          <EditorIconButton context="panel" label="放大画布" onClick={() => changeZoom(1.2)}><ZoomIn /></EditorIconButton>
          <EditorIconButton context="panel" label="顺时针旋转" onClick={() => setRotation((current) => current + 90)}><RotateCameraRight /></EditorIconButton>
          <EditorIconButton context="panel" label="重新载入图片" onClick={reloadImage}><Refresh /></EditorIconButton>
          <EditorIconButton context="panel" label="复制图片路径" onClick={copyPath}><Copy /></EditorIconButton>
        </>}
      />
      <div
        ref={viewportRef}
        className={cn("relative min-h-0 flex-1 touch-none overflow-hidden bg-background", dragging ? "cursor-grabbing" : "cursor-grab")}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={() => chooseMode(Math.abs(viewport.scale - 1) < 0.001 ? "fit" : "actual")}
        data-image-viewer-viewport
        data-image-viewer-view-mode={viewMode}
      >
        {displaySrc && !imageWindow.missing ? (
          <div
            className="pointer-events-none absolute left-0 top-0 will-change-transform"
            style={{
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
              transformOrigin: "0 0"
            }}
            data-image-viewer-world
          >
            <img
              key={displaySrc}
              src={displaySrc}
              alt={imageWindow.title}
              draggable={false}
              className="absolute left-0 top-0 max-w-none select-none shadow-[var(--ui-shadow-panel)]"
              style={{
                width: naturalSize.width || "auto",
                height: naturalSize.height || "auto",
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`
              }}
              onLoad={(event) => {
                setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                setLoadState("ready");
              }}
              onError={() => {
                setLoadState("error");
                reportStatus(`无法显示 ${imageWindow.title}。`);
              }}
            />
          </div>
        ) : null}
        {loadState === "loading" ? <ViewerMessage><Spinner className="size-5" />正在载入图片</ViewerMessage> : null}
        {loadState === "error" ? <ViewerMessage><MediaImage className="size-6" />{imageWindow.missing ? "图片已从磁盘移除" : "无法显示图片"}</ViewerMessage> : null}
      </div>
    </div>
  );
}

function ViewerMessage({ children }: { children: import("react").ReactNode }) {
  return <div className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center gap-2 text-sm text-muted-foreground">{children}</div>;
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isTextEntryTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}
