"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import { Crosshair, RefreshCw, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { selectOnlyEdge, selectOnlyNode, updateEdge, updateNodeLabel } from "@/features/mermaid-editor/lib/editor-actions";
import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";

type PreviewPanelProps = {
  source: string;
  graph?: MermaidGraph;
  framed?: boolean;
  onGraphChange?: (graph: MermaidGraph, selection?: Selection, message?: string) => void;
};

type RenderView = {
  x: number;
  y: number;
  scale: number;
};

type InlineEdit =
  | { type: "node"; id: string; value: string; left: number; top: number; width: number }
  | { type: "edge"; id: string; value: string; left: number; top: number; width: number };

export function PreviewPanel({ source, graph, framed = true, onGraphChange }: PreviewPanelProps) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<RenderView>({ x: 40, y: 40, scale: 1 });
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const renderKey = useMemo(() => `mmd-${Math.random().toString(36).slice(2)}`, []);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null);

  async function render() {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "base" });
      const result = await mermaid.render(`${renderKey}-${Date.now()}`, source);
      setSvg(result.svg);
      setError("");
    } catch (err) {
      setSvg("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function fitView() {
    setView({ x: 40, y: 40, scale: 1 });
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
    const id = window.setTimeout(render, 180);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <section className={framed ? "grid min-h-0 grid-rows-[42px_minmax(0,1fr)] border-b" : "grid min-h-0 grid-rows-[42px_minmax(0,1fr)] bg-card"}>
      <header className="flex items-center justify-between border-b px-3">
        <Workflow className="size-4 text-muted-foreground" />
        <div className="flex items-center gap-1">
          <span className="px-2 text-xs text-muted-foreground">{Math.round(view.scale * 100)}%</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={fitView} aria-label="重置渲染视图">
                <Crosshair className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重置视图</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={render} aria-label="刷新预览">
                <RefreshCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>刷新预览</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div
        ref={viewportRef}
        className="konva-grid relative min-h-0 cursor-grab overflow-hidden"
        onWheel={onWheel}
        onMouseDown={startPan}
        onMouseMove={onMouseMove}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onAuxClick={(event) => event.preventDefault()}
        onDoubleClick={onDoubleClick}
      >
        {error ? (
          <pre className="m-4 whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive">
            {error}
          </pre>
        ) : (
          <div
            className="absolute left-0 top-0 origin-top-left [&_svg]:h-auto [&_svg]:max-w-none"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}

        {inlineEdit ? (
          <Input
            autoFocus
            value={inlineEdit.value}
            className="absolute z-20 h-9 rounded-md bg-card px-2 text-sm shadow-lg"
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
