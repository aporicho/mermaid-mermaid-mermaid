"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";

import { Input } from "@/components/ui/input";
import { DiagnosticPanel } from "@/features/mermaid-editor/components/diagnostic-panel";
import { selectOnlyEdge, selectOnlyNode, updateEdge, updateNodeLabel } from "@/features/mermaid-editor/lib/editor-actions";
import { normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDITOR_THEME, type MermaidThemeVariables, themeToMermaidThemeVariables } from "@/features/mermaid-editor/lib/editor-theme";

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

const DEFAULT_MERMAID_THEME_VARIABLES = themeToMermaidThemeVariables(DEFAULT_EDITOR_THEME);
const EMPTY_DIAGNOSTICS: EditorDiagnostic[] = [];

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
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null);
  const hasUserAdjustedViewRef = useRef(false);
  const hasFittedInitialViewRef = useRef(false);
  const viewportWidth = viewportSize.width;
  const viewportHeight = viewportSize.height;

  async function render() {
    try {
      await document.fonts.ready;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        themeVariables: mermaidThemeVariables
      });
      const result = await mermaid.render(`${renderKey}-${Date.now()}`, source);
      setSvg(result.svg);
      setSvgSize(parseSvgSize(result.svg) || { width: 640, height: 360 });
      setRenderDiagnostic(null);
    } catch (err) {
      setSvg("");
      setSvgSize(null);
      setRenderDiagnostic(normalizeMermaidError(err, source, "mermaid-render"));
    }
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const oldScale = view.scale;
    const nextScale = Math.min(2.8, Math.max(0.25, event.deltaY > 0 ? oldScale / 1.08 : oldScale * 1.08));
    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const point = {
      x: (pointer.x - view.x) / oldScale,
      y: (pointer.y - view.y) / oldScale
    };

    hasUserAdjustedViewRef.current = true;
    setView({
      scale: nextScale,
      x: pointer.x - point.x * nextScale,
      y: pointer.y - point.y * nextScale
    });
  }

  function startPan(event: React.MouseEvent<HTMLDivElement>) {
    const shouldPan = event.button === 1 || (event.button === 0 && !isEditableTextTarget(event.target));
    if (!shouldPan) return;

    event.preventDefault();
    panRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      viewX: view.x,
      viewY: view.y
    };
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan) return;
    hasUserAdjustedViewRef.current = true;
    setView({
      ...view,
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
    if (diagnostics.length) {
      setSvg("");
      setSvgSize(null);
      setRenderDiagnostic(null);
      return;
    }

    const id = window.setTimeout(render, 180);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, mermaidThemeVariables, diagnostics]);

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

    setView(fitRenderView(svgSize, { width: viewportWidth, height: viewportHeight }));
    hasFittedInitialViewRef.current = true;
  }, [svgSize, viewportHeight, viewportWidth]);

  return (
    <section className={framed ? "relative h-full min-h-0 border-b bg-card" : "relative h-full min-h-0 bg-card"}>
      <div
        ref={viewportRef}
        className="render-grid relative h-full min-h-0 cursor-grab overflow-hidden"
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
