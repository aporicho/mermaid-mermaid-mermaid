"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";

import { Input } from "@/components/ui/input";
import { DiagnosticPanel } from "@/features/mermaid-editor/components/diagnostic-panel";
import { selectOnlyEdge, selectOnlyNode, updateEdge, updateNodeLabel } from "@/features/mermaid-editor/lib/editor-actions";
import { normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDITOR_THEME, type MermaidThemeVariables, themeToMermaidThemeVariables } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveWheelNavigation, zoomViewportAtPoint } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import { incrementPerformanceCounter, measureAsyncPerformance, recordPerformanceMetric } from "@/features/mermaid-editor/lib/editor-performance";

type PreviewPanelProps = {
  source: string;
  graph?: MermaidGraph;
  framed?: boolean;
  diagnostics?: EditorDiagnostic[];
  mermaidThemeVariables?: MermaidThemeVariables;
  onGraphChange?: (graph: MermaidGraph, selection?: Selection, message?: string) => void;
};

type RenderView = {
  x: number;
  y: number;
  scale: number;
};

type SvgSize = {
  width: number;
  height: number;
};

type InlineEdit =
  | { type: "node"; id: string; value: string; left: number; top: number; width: number }
  | { type: "edge"; id: string; value: string; left: number; top: number; width: number };

type SafariGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

const DEFAULT_MERMAID_THEME_VARIABLES = themeToMermaidThemeVariables(DEFAULT_EDITOR_THEME);
const EMPTY_DIAGNOSTICS: EditorDiagnostic[] = [];
const MAX_RENDER_CACHE_ITEMS = 8;

export function PreviewPanel({
  source,
  graph,
  framed = true,
  diagnostics = EMPTY_DIAGNOSTICS,
  mermaidThemeVariables = DEFAULT_MERMAID_THEME_VARIABLES,
  onGraphChange
}: PreviewPanelProps) {
  const [svg, setSvg] = useState("");
  const [svgSize, setSvgSize] = useState<SvgSize | null>(null);
  const [renderDiagnostic, setRenderDiagnostic] = useState<EditorDiagnostic | null>(null);
  const [view, setView] = useState<RenderView>({ x: 40, y: 40, scale: 1 });
  const [viewportSize, setViewportSize] = useState<SvgSize>({ width: 0, height: 0 });
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const renderKey = useMemo(() => `mmd-${Math.random().toString(36).slice(2)}`, []);
  const renderVersionRef = useRef(0);
  const renderCacheRef = useRef<Map<string, { svg: string; svgSize: SvgSize }>>(new Map());
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null);
  const gestureNavigationRef = useRef<{ view: RenderView; pointer: { x: number; y: number } } | null>(null);
  const pendingViewRef = useRef<RenderView | null>(null);
  const visualViewRef = useRef<RenderView>({ x: 40, y: 40, scale: 1 });
  const viewRafRef = useRef<number | null>(null);
  const viewCommitTimerRef = useRef<number | null>(null);
  const viewCommitRef = useRef<RenderView | null>(null);
  const suppressWheelZoomUntilRef = useRef(0);
  const hasUserAdjustedViewRef = useRef(false);
  const hasFittedInitialViewRef = useRef(false);
  const viewportWidth = viewportSize.width;
  const viewportHeight = viewportSize.height;

  async function render(renderVersion: number, renderSource: string, themeVariables: MermaidThemeVariables) {
    const cacheKey = renderCacheKey(renderSource, themeVariables);
    const cached = renderCacheRef.current.get(cacheKey);
    if (cached) {
      incrementPerformanceCounter("mermaid-render-cache-hit");
      if (renderVersion !== renderVersionRef.current) return;
      setSvg(cached.svg);
      setSvgSize(cached.svgSize);
      setRenderDiagnostic(null);
      return;
    }

    try {
      await measureAsyncPerformance("document-fonts-ready", () => document.fonts.ready);
      if (renderVersion !== renderVersionRef.current) return;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        themeVariables
      });
      const result = await measureAsyncPerformance("mermaid-render", () => mermaid.render(`${renderKey}-${Date.now()}`, renderSource), {
        sourceLength: renderSource.length
      });
      if (renderVersion !== renderVersionRef.current) return;

      const nextSvgSize = parseSvgSize(result.svg) || { width: 640, height: 360 };
      rememberRenderCache(cacheKey, { svg: result.svg, svgSize: nextSvgSize });
      setSvg(result.svg);
      setSvgSize(nextSvgSize);
      setRenderDiagnostic(null);
    } catch (err) {
      if (renderVersion !== renderVersionRef.current) return;
      setSvg("");
      setSvgSize(null);
      setRenderDiagnostic(normalizeMermaidError(err, renderSource, "mermaid-render"));
    }
  }

  function rememberRenderCache(cacheKey: string, value: { svg: string; svgSize: SvgSize }) {
    renderCacheRef.current.delete(cacheKey);
    renderCacheRef.current.set(cacheKey, value);

    while (renderCacheRef.current.size > MAX_RENDER_CACHE_ITEMS) {
      const firstKey = renderCacheRef.current.keys().next().value;
      if (!firstKey) return;
      renderCacheRef.current.delete(firstKey);
    }
  }

  const currentView = useCallback(() => pendingViewRef.current || visualViewRef.current, []);

  const applyViewToContent = useCallback((nextView: RenderView) => {
    visualViewRef.current = nextView;
    const content = contentRef.current;
    if (!content) return;
    content.style.transform = `translate(${nextView.x}px, ${nextView.y}px) scale(${nextView.scale})`;
  }, []);

  const queueViewCommit = useCallback((nextView: RenderView) => {
    viewCommitRef.current = nextView;
    if (viewCommitTimerRef.current) window.clearTimeout(viewCommitTimerRef.current);

    viewCommitTimerRef.current = window.setTimeout(() => {
      const viewToCommit = viewCommitRef.current;
      viewCommitRef.current = null;
      viewCommitTimerRef.current = null;
      if (viewToCommit) setView(viewToCommit);
    }, 80);
  }, []);

  const scheduleViewChange = useCallback(
    (nextView: RenderView) => {
      pendingViewRef.current = nextView;
      hasUserAdjustedViewRef.current = true;
      queueViewCommit(nextView);

      if (viewRafRef.current !== null) return;
      const scheduledAt = performance.now();
      viewRafRef.current = window.requestAnimationFrame(() => {
        viewRafRef.current = null;
        const pending = pendingViewRef.current;
        pendingViewRef.current = null;
        if (pending) {
          applyViewToContent(pending);
          recordPerformanceMetric("preview-viewport-visual-latency", performance.now() - scheduledAt);
        }
      });
    },
    [applyViewToContent, queueViewCommit]
  );

  function pointFromClient(clientX: number, clientY: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const pointer = pointFromClient(event.clientX, event.clientY);
    if (!pointer) return;

    const isZoomWheel = !event.shiftKey && Math.abs(event.deltaY) > 0;
    if (isZoomWheel && Date.now() < suppressWheelZoomUntilRef.current) return;

    const result = resolveWheelNavigation({
      viewport: currentView(),
      pointer,
      canvasSize: viewportSize,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      interactionKind: "idle"
    });

    if (result.kind === "ignored") return;
    scheduleViewChange(result.viewport);
  }

  function startPan(event: React.MouseEvent<HTMLDivElement>) {
    const shouldPan = event.button === 1 || (event.button === 0 && !isEditableTextTarget(event.target));
    if (!shouldPan) return;

    event.preventDefault();
    panRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      viewX: currentView().x,
      viewY: currentView().y
    };
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan) return;
    scheduleViewChange({
      ...currentView(),
      x: pan.viewX + event.clientX - pan.pointerX,
      y: pan.viewY + event.clientY - pan.pointerY
    });
  }

  function stopPan() {
    panRef.current = null;
  }

  function onDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!graph || !onGraphChange) return;
    const match = findEditableLabel(event.target, graph);
    if (!match) return;

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    setInlineEdit({
      ...match,
      left: event.clientX - rect.left - 70,
      top: event.clientY - rect.top - 18,
      width: 140
    });
  }

  function commitInlineEdit(save: boolean) {
    if (!inlineEdit || !graph || !onGraphChange) {
      setInlineEdit(null);
      return;
    }

    if (save && inlineEdit.type === "node") {
      onGraphChange(updateNodeLabel(graph, inlineEdit.id, inlineEdit.value), selectOnlyNode(inlineEdit.id), "已从渲染视图更新节点文本。");
    }
    if (save && inlineEdit.type === "edge") {
      onGraphChange(updateEdge(graph, inlineEdit.id, { label: inlineEdit.value }), selectOnlyEdge(inlineEdit.id), "已从渲染视图更新连线文本。");
    }
    setInlineEdit(null);
  }

  useEffect(() => {
    const renderVersion = renderVersionRef.current + 1;
    renderVersionRef.current = renderVersion;

    if (diagnostics.length) {
      setSvg("");
      setSvgSize(null);
      setRenderDiagnostic(null);
      return;
    }

    const id = window.setTimeout(() => {
      void render(renderVersion, source, mermaidThemeVariables);
    }, 180);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, mermaidThemeVariables, diagnostics]);

  useEffect(() => {
    visualViewRef.current = view;
  }, [view]);

  useEffect(() => {
    applyViewToContent(view);
  }, [applyViewToContent, svg, svgSize, view]);

  useEffect(() => {
    return () => {
      if (viewRafRef.current !== null) window.cancelAnimationFrame(viewRafRef.current);
      if (viewCommitTimerRef.current) window.clearTimeout(viewCommitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observedElement = element;

    function updateSize() {
      const rect = observedElement.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(observedElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgSize || !viewportWidth || !viewportHeight) return;
    if (hasFittedInitialViewRef.current && hasUserAdjustedViewRef.current) return;

    const nextView = fitRenderView(svgSize, { width: viewportWidth, height: viewportHeight });
    visualViewRef.current = nextView;
    setView(nextView);
    hasFittedInitialViewRef.current = true;
  }, [svgSize, viewportHeight, viewportWidth]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    function gesturePoint(event: SafariGestureEvent) {
      if (typeof event.clientX === "number" && typeof event.clientY === "number") {
        const point = pointFromClient(event.clientX, event.clientY);
        if (point) return point;
      }
      return { x: viewportSize.width / 2, y: viewportSize.height / 2 };
    }

    function onGestureStart(event: SafariGestureEvent) {
      event.preventDefault();
      suppressWheelZoomUntilRef.current = Date.now() + 350;
      gestureNavigationRef.current = {
        view: currentView(),
        pointer: gesturePoint(event)
      };
    }

    function onGestureChange(event: SafariGestureEvent) {
      event.preventDefault();
      suppressWheelZoomUntilRef.current = Date.now() + 250;

      const start = gestureNavigationRef.current;
      const scale = typeof event.scale === "number" && Number.isFinite(event.scale) ? event.scale : 1;
      if (!start || scale <= 0) return;

      scheduleViewChange(zoomViewportAtPoint(start.view, start.pointer, start.view.scale * scale));
    }

    function onGestureEnd(event: SafariGestureEvent) {
      event.preventDefault();
      gestureNavigationRef.current = null;
      suppressWheelZoomUntilRef.current = Date.now() + 350;
    }

    element.addEventListener("gesturestart", onGestureStart as EventListener, { passive: false });
    element.addEventListener("gesturechange", onGestureChange as EventListener, { passive: false });
    element.addEventListener("gestureend", onGestureEnd as EventListener, { passive: false });

    return () => {
      element.removeEventListener("gesturestart", onGestureStart as EventListener);
      element.removeEventListener("gesturechange", onGestureChange as EventListener);
      element.removeEventListener("gestureend", onGestureEnd as EventListener);
    };
  }, [currentView, scheduleViewChange, viewportSize.height, viewportSize.width]);

  return (
    <section className={framed ? "relative h-full min-h-0 border-b bg-card" : "relative h-full min-h-0 bg-card"}>
      <div
        ref={viewportRef}
        className="render-grid relative h-full min-h-0 touch-none cursor-grab overflow-hidden overscroll-none"
        onWheel={onWheel}
        onMouseDown={startPan}
        onMouseMove={onMouseMove}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onAuxClick={(event) => event.preventDefault()}
        onDoubleClick={onDoubleClick}
      >
        {diagnostics.length || renderDiagnostic ? (
          <DiagnosticPanel diagnostics={diagnostics.length ? diagnostics : [renderDiagnostic!]} />
        ) : (
          <div
            ref={contentRef}
            className="mermaid-render absolute left-0 top-0 origin-top-left [&_svg]:!h-full [&_svg]:!max-w-none [&_svg]:!w-full [&_svg]:block"
            style={{
              width: svgSize?.width,
              height: svgSize?.height,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}

        {inlineEdit ? (
          <Input
            autoFocus
            value={inlineEdit.value}
            className="absolute z-40 h-9 rounded-md border bg-card px-2 text-sm shadow-none"
            style={{
              left: inlineEdit.left,
              top: inlineEdit.top,
              width: inlineEdit.width
            }}
            onChange={(event) => setInlineEdit({ ...inlineEdit, value: event.target.value })}
            onBlur={() => commitInlineEdit(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitInlineEdit(true);
              if (event.key === "Escape") commitInlineEdit(false);
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function fitRenderView(svgSize: SvgSize, viewportSize: SvgSize): RenderView {
  const padding = 64;
  const availableWidth = Math.max(1, viewportSize.width - padding * 2);
  const availableHeight = Math.max(1, viewportSize.height - padding * 2);
  const scale = Math.min(2.8, Math.max(0.25, Math.min(availableWidth / svgSize.width, availableHeight / svgSize.height)));

  return {
    scale,
    x: (viewportSize.width - svgSize.width * scale) / 2,
    y: (viewportSize.height - svgSize.height * scale) / 2
  };
}

function renderCacheKey(source: string, themeVariables: MermaidThemeVariables) {
  return `${source}\n%%theme:${JSON.stringify(themeVariables)}`;
}

function parseSvgSize(svgText: string): SvgSize | null {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = document.querySelector("svg");
  if (!svg) return null;

  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }

  const width = parseSvgLength(svg.getAttribute("width"));
  const height = parseSvgLength(svg.getAttribute("height"));
  if (width && height) return { width, height };

  return null;
}

function parseSvgLength(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isEditableTextTarget(target: EventTarget) {
  const element = target as Element | null;
  if (!element) return false;
  return Boolean(element.closest("text,tspan,foreignObject,span,p"));
}

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function findEditableLabel(target: EventTarget, graph: MermaidGraph) {
  const element = target as Element | null;
  if (!element) return null;

  const textElement = element.closest("text,tspan,foreignObject,span,p");
  const label = normalizeText(textElement?.textContent);
  if (!label) return null;

  const idCarrier = element.closest("[id]");
  const carrierId = idCarrier?.getAttribute("id") || "";
  const nodeById = graph.nodes.find((node) => carrierId.includes(node.id));
  if (nodeById) return { type: "node" as const, id: nodeById.id, value: nodeById.label };

  const edgeById = graph.edges.find((edge) => carrierId.includes(edge.from) && carrierId.includes(edge.to));
  if (edgeById) return { type: "edge" as const, id: edgeById.id, value: edgeById.label };

  const edgeByLabel = graph.edges.find((edge) => edge.label && normalizeText(edge.label) === label);
  if (edgeByLabel) return { type: "edge" as const, id: edgeByLabel.id, value: edgeByLabel.label };

  const nodeByLabel = graph.nodes.find((node) => normalizeText(node.label) === label || normalizeText(node.id) === label);
  if (nodeByLabel) return { type: "node" as const, id: nodeByLabel.id, value: nodeByLabel.label };

  return null;
}
