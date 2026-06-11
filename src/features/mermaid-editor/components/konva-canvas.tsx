"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Group, Layer, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { CursorPointer as MousePointer2, DragHandGesture as Hand, Expand as Maximize2, Link as Link2, Network } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createEdge,
  emptySelection,
  selectOnlyEdge,
  selectOnlyNode,
  setNodePositions,
  toggleEdgeSelection,
  toggleNodeSelection,
  updateEdge,
  updateNodeLabel
} from "@/features/mermaid-editor/lib/editor-actions";
import type { CanvasEdge, CanvasNode, EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 176;
const NODE_HEIGHT = 72;
const NODE_TEXT_PADDING_X = 14;
const NODE_TEXT_PADDING_Y = 8;
const NODE_TEXT_WIDTH = NODE_WIDTH - NODE_TEXT_PADDING_X * 2;
const NODE_TEXT_HEIGHT = NODE_HEIGHT - NODE_TEXT_PADDING_Y * 2;
const NODE_TEXT_FONT_SIZE = 14;
const NODE_TEXT_LINE_HEIGHT = 18;
const NODE_TEXT_FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const GRID_STEP = 24;
const GRID_MAJOR_STEP = GRID_STEP * 5;

type KonvaCanvasProps = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  showGrid: boolean;
  onGraphDraft: (graph: MermaidGraph, message?: string) => void;
  onGraphCommit: (graph: MermaidGraph, selection?: Selection, message?: string) => void;
  onCaptureHistory: () => void;
  onSelectionChange: (selection: Selection) => void;
  onViewportChange: (viewport: ViewportState) => void;
  onAddNodeAt: (point: { x: number; y: number }) => void;
};

type EdgeGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
};

type SelectionBox = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type ConnectionDraft = {
  from: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type InlineEdit =
  | { type: "node"; id: string; value: string }
  | { type: "edge"; id: string; value: string };

function nodeCenter(node: CanvasNode) {
  return {
    x: node.x + NODE_WIDTH / 2,
    y: node.y + NODE_HEIGHT / 2
  };
}

function edgeGeometry(edge: CanvasEdge, nodes: CanvasNode[]): EdgeGeometry | null {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) return null;

  const start = nodeCenter(from);
  const end = nodeCenter(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ox = dx / length;
  const oy = dy / length;

  return {
    x1: start.x + ox * (NODE_WIDTH / 2 + 6),
    y1: start.y + oy * (NODE_HEIGHT / 2 + 6),
    x2: end.x - ox * (NODE_WIDTH / 2 + 10),
    y2: end.y - oy * (NODE_HEIGHT / 2 + 10),
    midX: (start.x + end.x) / 2,
    midY: (start.y + end.y) / 2
  };
}

function pointInsideNode(point: { x: number; y: number }, node: CanvasNode) {
  return point.x >= node.x && point.x <= node.x + NODE_WIDTH && point.y >= node.y && point.y <= node.y + NODE_HEIGHT;
}

function normalizeBox(box: SelectionBox) {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return { x, y, width, height };
}

function nodeIntersectsBox(node: CanvasNode, box: SelectionBox) {
  const rect = normalizeBox(box);
  return node.x < rect.x + rect.width && node.x + NODE_WIDTH > rect.x && node.y < rect.y + rect.height && node.y + NODE_HEIGHT > rect.y;
}

function anchorPoints(node: CanvasNode) {
  return [
    { key: "top", x: node.x + NODE_WIDTH / 2, y: node.y },
    { key: "right", x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 },
    { key: "bottom", x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT },
    { key: "left", x: node.x, y: node.y + NODE_HEIGHT / 2 }
  ];
}

export function KonvaCanvas({
  graph,
  selection,
  viewport,
  mode,
  showGrid,
  onGraphDraft,
  onGraphCommit,
  onCaptureHistory,
  onSelectionChange,
  onViewportChange,
  onAddNodeAt
}: KonvaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const panRef = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null);
  const dragRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const dimensions = useContainerSize(containerRef);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const [nodeEditorInsetTop, setNodeEditorInsetTop] = useState(0);
  const nodeEditorRef = useRef<HTMLTextAreaElement>(null);

  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const selectedEdgeIds = useMemo(() => new Set(selection.edgeIds), [selection.edgeIds]);
  const selectedSingleEdge = selection.edgeIds.length === 1 ? graph.edges.find((edge) => edge.id === selection.edgeIds[0]) : undefined;
  const selectedSingleEdgeGeometry = selectedSingleEdge ? edgeGeometry(selectedSingleEdge, graph.nodes) : null;
  const ModeIcon = mode === "connect" ? Link2 : mode === "pan" ? Hand : MousePointer2;

  useEffect(() => {
    if (inlineEdit?.type !== "node") return;
    const editor = nodeEditorRef.current;
    if (!editor) return;

    editor.focus();
    editor.select();
  }, [inlineEdit?.id, inlineEdit?.type]);

  useEffect(() => {
    if (inlineEdit?.type !== "node") return;
    const editor = nodeEditorRef.current;
    if (!editor) return;

    editor.style.paddingTop = "0px";
    editor.style.paddingBottom = "0px";
    const inset = Math.max(0, Math.floor((editor.clientHeight - editor.scrollHeight) / 2));
    setNodeEditorInsetTop(inset);
  }, [inlineEdit?.id, inlineEdit?.type, inlineEdit?.value, viewport.scale]);

  useEffect(() => {
    function isTextInput(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (inlineEdit || mode !== "select" || isTextInput(event.target)) return;
      if (selection.nodeIds.length !== 1 || selection.edgeIds.length > 0) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Enter" && event.key !== "F2") return;

      const node = graph.nodes.find((item) => item.id === selection.nodeIds[0]);
      if (!node) return;
      event.preventDefault();
      setInlineEdit({ type: "node", id: node.id, value: node.label });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [graph.nodes, inlineEdit, mode, selection.edgeIds.length, selection.nodeIds]);

  function pointerWorldPoint() {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return null;

    return {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale
    };
  }

  function worldToScreen(point: { x: number; y: number }) {
    return {
      x: viewport.x + point.x * viewport.scale,
      y: viewport.y + point.y * viewport.scale
    };
  }

  function fitToGraph() {
    if (!containerRef.current || graph.nodes.length === 0) return;
    const minX = Math.min(...graph.nodes.map((node) => node.x));
    const minY = Math.min(...graph.nodes.map((node) => node.y));
    const maxX = Math.max(...graph.nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...graph.nodes.map((node) => node.y + NODE_HEIGHT));
    const padding = 84;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const scale = Math.min(1.35, Math.max(0.35, Math.min(width / (maxX - minX + padding * 2), height / (maxY - minY + padding * 2))));

    onViewportChange({
      scale,
      x: padding - minX * scale,
      y: padding - minY * scale
    });
  }

  function onWheel(event: KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;

    const scaleBy = 1.08;
    const oldScale = viewport.scale;
    const nextScale = Math.min(2.4, Math.max(0.28, event.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy));
    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale
    };

    onViewportChange({
      scale: nextScale,
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale
    });
  }

  function startPanFromPointer(pointer: { x: number; y: number }) {
    panRef.current = {
      pointerX: pointer.x,
      pointerY: pointer.y,
      viewX: viewport.x,
      viewY: viewport.y
    };
  }

  function startNodeDrag(node: CanvasNode) {
    const ids = selectedNodeIds.has(node.id) ? selection.nodeIds : [node.id];
    if (!selectedNodeIds.has(node.id)) onSelectionChange(selectOnlyNode(node.id));
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => ids.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    onCaptureHistory();
  }

  function moveSelectedNodes(node: CanvasNode, x: number, y: number) {
    if (!dragRef.current) return;
    const origin = dragRef.current[node.id];
    if (!origin) return;
    const deltaX = x - origin.x;
    const deltaY = y - origin.y;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + deltaX, y: position.y + deltaY }])
    );
    onGraphDraft(setNodePositions(graph, positions), "正在移动节点。");
  }

  function startConnection(node: CanvasNode, x: number, y: number, event: KonvaEventObject<MouseEvent>) {
    event.cancelBubble = true;
    setConnectionDraft({ from: node.id, startX: x, startY: y, endX: x, endY: y });
  }

  function finishConnection() {
    if (!connectionDraft) return;
    const point = pointerWorldPoint();
    const target = point ? graph.nodes.find((node) => node.id !== connectionDraft.from && pointInsideNode(point, node)) : null;
    if (target) {
      const result = createEdge(graph, connectionDraft.from, target.id);
      onGraphCommit(result.graph, result.selection, "已创建连线。");
    }
    setConnectionDraft(null);
  }

  function retargetEdge(edgeId: string, side: "from" | "to") {
    const point = pointerWorldPoint();
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!point || !edge) return;

    const target = graph.nodes.find((node) => pointInsideNode(point, node));
    if (!target) return;

    onGraphCommit(updateEdge(graph, edgeId, { [side]: target.id }), selectOnlyEdge(edgeId), "已重连连线。");
  }

  function commitInlineEdit(save: boolean) {
    if (!inlineEdit) return;

    if (save && inlineEdit.type === "node") {
      onGraphCommit(updateNodeLabel(graph, inlineEdit.id, inlineEdit.value), selectOnlyNode(inlineEdit.id), "已更新节点文本。");
    }
    if (save && inlineEdit.type === "edge") {
      onGraphCommit(updateEdge(graph, inlineEdit.id, { label: inlineEdit.value }), selectOnlyEdge(inlineEdit.id), "已更新连线文本。");
    }
    setInlineEdit(null);
  }

  function inlineEditStyle() {
    if (!inlineEdit) return null;
    if (inlineEdit.type === "node") {
      const node = graph.nodes.find((item) => item.id === inlineEdit.id);
      if (!node) return null;
      const screen = worldToScreen({ x: node.x + NODE_TEXT_PADDING_X, y: node.y + NODE_TEXT_PADDING_Y });
      return {
        left: screen.x,
        top: screen.y,
        width: NODE_TEXT_WIDTH * viewport.scale,
        height: NODE_TEXT_HEIGHT * viewport.scale
      };
    }

    const edge = graph.edges.find((item) => item.id === inlineEdit.id);
    const geometry = edge ? edgeGeometry(edge, graph.nodes) : null;
    if (!geometry) return null;
    const screen = worldToScreen({ x: geometry.midX - 60, y: geometry.midY - 17 });
    return {
      left: screen.x,
      top: screen.y,
      width: Math.max(120, 120 * viewport.scale),
      height: Math.max(32, 34 * viewport.scale)
    };
  }

  const editStyle = inlineEditStyle();

  return (
    <section className="grid min-h-0 grid-rows-[42px_minmax(0,1fr)] bg-card">
      <header className="flex items-center justify-between border-b px-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Network className="size-4" />
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid size-7 place-items-center rounded-md bg-muted/60">
                <ModeIcon className="size-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>{mode === "connect" ? "连线模式" : mode === "pan" ? "平移模式" : "选择模式"}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{graph.nodes.length}N</span>
          <span>{graph.edges.length}E</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="size-8" onClick={fitToGraph} aria-label="适配视图">
                <Maximize2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>适配视图</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div
        ref={containerRef}
        className={cn(
          "relative min-h-0 overflow-hidden bg-background",
          mode === "pan" && "cursor-grab",
          mode === "connect" && "cursor-crosshair",
          mode === "select" && "cursor-default"
        )}
        onAuxClick={(event) => event.preventDefault()}
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onWheel={onWheel}
          onDblClick={(event) => {
            if (event.target !== event.target.getStage()) return;
            const point = pointerWorldPoint();
            if (!point) return;
            onAddNodeAt({
              x: point.x - NODE_WIDTH / 2,
              y: point.y - NODE_HEIGHT / 2
            });
          }}
          onMouseDown={(event) => {
            const pointer = stageRef.current?.getPointerPosition();
            const world = pointerWorldPoint();
            if (!pointer || !world) return;

            if (event.evt.button === 1) {
              event.evt.preventDefault();
              startPanFromPointer(pointer);
              return;
            }

            if (event.target !== event.target.getStage()) return;

            if (mode === "pan") {
              startPanFromPointer(pointer);
              return;
            }

            if (mode === "select") {
              setSelectionBox({ startX: world.x, startY: world.y, endX: world.x, endY: world.y });
            }
          }}
          onMouseMove={() => {
            const pan = panRef.current;
            const pointer = stageRef.current?.getPointerPosition();
            const world = pointerWorldPoint();

            if (pan && pointer) {
              onViewportChange({
                ...viewport,
                x: pan.viewX + pointer.x - pan.pointerX,
                y: pan.viewY + pointer.y - pan.pointerY
              });
            }

            if (selectionBox && world) {
              setSelectionBox({ ...selectionBox, endX: world.x, endY: world.y });
            }

            if (connectionDraft && world) {
              setConnectionDraft({ ...connectionDraft, endX: world.x, endY: world.y });
            }
          }}
          onMouseUp={() => {
            if (selectionBox) {
              const rect = normalizeBox(selectionBox);
              if (rect.width > 4 || rect.height > 4) {
                const nodeIds = graph.nodes.filter((node) => nodeIntersectsBox(node, selectionBox)).map((node) => node.id);
                onSelectionChange({ nodeIds, edgeIds: [], primaryId: nodeIds[0] });
              } else {
                onSelectionChange(emptySelection);
              }
              setSelectionBox(null);
            }
            finishConnection();
            panRef.current = null;
          }}
          onMouseLeave={() => {
            panRef.current = null;
          }}
        >
          {showGrid ? <CanvasGrid dimensions={dimensions} viewport={viewport} /> : null}

          <Layer>
            {graph.edges.map((edge) => {
              const geometry = edgeGeometry(edge, graph.nodes);
              if (!geometry) return null;
              const isSelected = selectedEdgeIds.has(edge.id);

              return (
                <Group key={edge.id}>
                  <Arrow
                    points={[geometry.x1, geometry.y1, geometry.x2, geometry.y2]}
                    stroke="transparent"
                    fill="transparent"
                    strokeWidth={18}
                    pointerLength={0}
                    pointerWidth={0}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      onSelectionChange(event.evt.shiftKey ? toggleEdgeSelection(selection, edge.id) : selectOnlyEdge(edge.id));
                    }}
                    onDblClick={(event) => {
                      event.cancelBubble = true;
                      onSelectionChange(selectOnlyEdge(edge.id));
                      setInlineEdit({ type: "edge", id: edge.id, value: edge.label });
                    }}
                    onTap={() => onSelectionChange(selectOnlyEdge(edge.id))}
                  />
                  <Arrow
                    points={[geometry.x1, geometry.y1, geometry.x2, geometry.y2]}
                    stroke={isSelected ? "#1f7a68" : "#526766"}
                    fill={isSelected ? "#1f7a68" : "#526766"}
                    strokeWidth={isSelected ? 3 : 2}
                    pointerLength={10}
                    pointerWidth={10}
                    listening={false}
                  />
                  {edge.label ? (
                    <Group
                      x={geometry.midX - 46}
                      y={geometry.midY - 14}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        onSelectionChange(event.evt.shiftKey ? toggleEdgeSelection(selection, edge.id) : selectOnlyEdge(edge.id));
                      }}
                      onDblClick={(event) => {
                        event.cancelBubble = true;
                        setInlineEdit({ type: "edge", id: edge.id, value: edge.label });
                      }}
                    >
                      <Rect width={92} height={28} cornerRadius={6} fill="#ffffff" stroke={isSelected ? "#1f7a68" : "#c9d5d3"} />
                      <Text
                        width={92}
                        height={28}
                        align="center"
                        verticalAlign="middle"
                        text={edge.label}
                        fontSize={12}
                        fill={isSelected ? "#115446" : "#344441"}
                        ellipsis
                      />
                    </Group>
                  ) : null}
                </Group>
              );
            })}

            {graph.nodes.map((node) => {
              const isSelected = selectedNodeIds.has(node.id);
              const showAnchors = mode === "connect" || hoveredNodeId === node.id || isSelected;

              return (
                <Group key={node.id}>
                  <Group
                    x={node.x}
                    y={node.y}
                    draggable={mode === "select"}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
                    onDragStart={(event) => {
                      if (event.evt.button !== 0) {
                        event.target.stopDrag();
                        return;
                      }
                      startNodeDrag(node);
                    }}
                    onDragMove={(event) => moveSelectedNodes(node, event.target.x(), event.target.y())}
                    onDragEnd={() => {
                      dragRef.current = null;
                    }}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      if (mode !== "select") return;
                      onSelectionChange(event.evt.shiftKey ? toggleNodeSelection(selection, node.id) : selectOnlyNode(node.id));
                    }}
                    onDblClick={(event) => {
                      event.cancelBubble = true;
                      setInlineEdit({ type: "node", id: node.id, value: node.label });
                    }}
                  >
                    <Rect
                      width={NODE_WIDTH}
                      height={NODE_HEIGHT}
                      cornerRadius={8}
                      fill={node.fill}
                      stroke={isSelected ? "#1f7a68" : "#b8c8c4"}
                      strokeWidth={isSelected ? 2 : 1}
                      shadowColor="rgba(24,39,38,0.18)"
                      shadowBlur={isSelected ? 18 : 12}
                      shadowOffsetY={6}
                    />
                    <Text
                      x={NODE_TEXT_PADDING_X}
                      y={NODE_TEXT_PADDING_Y}
                      width={NODE_TEXT_WIDTH}
                      height={NODE_TEXT_HEIGHT}
                      align="center"
                      verticalAlign="middle"
                      text={node.label}
                      fontSize={NODE_TEXT_FONT_SIZE}
                      fontStyle="bold"
                      fontFamily={NODE_TEXT_FONT_FAMILY}
                      lineHeight={NODE_TEXT_LINE_HEIGHT / NODE_TEXT_FONT_SIZE}
                      wrap="word"
                      fill="#172022"
                      ellipsis
                      visible={!(inlineEdit?.type === "node" && inlineEdit.id === node.id)}
                    />
                  </Group>

                  {showAnchors
                    ? anchorPoints(node).map((anchor) => (
                        <Circle
                          key={`${node.id}-${anchor.key}`}
                          x={anchor.x}
                          y={anchor.y}
                          radius={6}
                          fill={mode === "connect" ? "#c9872d" : "#1f7a68"}
                          stroke="#ffffff"
                          strokeWidth={2}
                          onMouseDown={(event) => startConnection(node, anchor.x, anchor.y, event)}
                        />
                      ))
                    : null}
                </Group>
              );
            })}

            {connectionDraft ? (
              <Arrow
                points={[connectionDraft.startX, connectionDraft.startY, connectionDraft.endX, connectionDraft.endY]}
                stroke="#c9872d"
                fill="#c9872d"
                strokeWidth={2}
                dash={[8, 6]}
                pointerLength={10}
                pointerWidth={10}
                listening={false}
              />
            ) : null}

            {selectionBox ? (
              <Rect
                {...normalizeBox(selectionBox)}
                fill="rgba(31,122,104,0.08)"
                stroke="#1f7a68"
                strokeWidth={1}
                dash={[6, 5]}
                listening={false}
              />
            ) : null}

            {selectedSingleEdge && selectedSingleEdgeGeometry ? (
              <>
                <Circle
                  x={selectedSingleEdgeGeometry.x1}
                  y={selectedSingleEdgeGeometry.y1}
                  radius={7}
                  fill="#1f7a68"
                  stroke="#ffffff"
                  strokeWidth={2}
                  draggable
                  onDragEnd={() => retargetEdge(selectedSingleEdge.id, "from")}
                />
                <Circle
                  x={selectedSingleEdgeGeometry.x2}
                  y={selectedSingleEdgeGeometry.y2}
                  radius={7}
                  fill="#1f7a68"
                  stroke="#ffffff"
                  strokeWidth={2}
                  draggable
                  onDragEnd={() => retargetEdge(selectedSingleEdge.id, "to")}
                />
              </>
            ) : null}
          </Layer>
        </Stage>

        {inlineEdit?.type === "node" && editStyle ? (
          <Textarea
            ref={nodeEditorRef}
            value={inlineEdit.value}
            className="absolute z-20 min-h-0 resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 text-center font-semibold text-[#172022] shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              left: editStyle.left,
              top: editStyle.top,
              width: editStyle.width,
              height: editStyle.height,
              paddingTop: nodeEditorInsetTop,
              paddingBottom: 0,
              fontFamily: NODE_TEXT_FONT_FAMILY,
              fontSize: NODE_TEXT_FONT_SIZE * viewport.scale,
              lineHeight: `${NODE_TEXT_LINE_HEIGHT * viewport.scale}px`,
              overflowWrap: "break-word",
              wordBreak: "break-word"
            }}
            onChange={(event) => setInlineEdit({ ...inlineEdit, value: event.target.value })}
            onBlur={() => commitInlineEdit(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commitInlineEdit(true);
              }
              if (event.key === "Escape") commitInlineEdit(false);
            }}
          />
        ) : null}

        {inlineEdit?.type === "edge" && editStyle ? (
          <Input
            autoFocus
            value={inlineEdit.value}
            className="absolute z-20 h-9 rounded-md bg-card px-2 text-sm shadow-lg"
            style={{
              left: editStyle.left,
              top: editStyle.top,
              width: editStyle.width,
              height: editStyle.height
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

function CanvasGrid({ dimensions, viewport }: { dimensions: { width: number; height: number }; viewport: ViewportState }) {
  const bounds = useMemo(() => {
    const padding = GRID_MAJOR_STEP;
    const left = Math.floor((-viewport.x / viewport.scale - padding) / GRID_STEP) * GRID_STEP;
    const top = Math.floor((-viewport.y / viewport.scale - padding) / GRID_STEP) * GRID_STEP;
    const right = Math.ceil(((dimensions.width - viewport.x) / viewport.scale + padding) / GRID_STEP) * GRID_STEP;
    const bottom = Math.ceil(((dimensions.height - viewport.y) / viewport.scale + padding) / GRID_STEP) * GRID_STEP;

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(GRID_STEP, right - left),
      height: Math.max(GRID_STEP, bottom - top)
    };
  }, [dimensions.height, dimensions.width, viewport.scale, viewport.x, viewport.y]);

  return (
    <Layer listening={false}>
      <Shape
        x={bounds.left}
        y={bounds.top}
        width={bounds.width}
        height={bounds.height}
        perfectDrawEnabled={false}
        sceneFunc={(context: Konva.Context) => {
          const minorRadius = 0.85 / viewport.scale;
          const majorRadius = 1.25 / viewport.scale;

          context.save();
          context.beginPath();
          context.fillStyle = "rgba(31, 122, 104, 0.18)";
          for (let x = bounds.left; x <= bounds.right; x += GRID_STEP) {
            for (let y = bounds.top; y <= bounds.bottom; y += GRID_STEP) {
              if (x % GRID_MAJOR_STEP === 0 && y % GRID_MAJOR_STEP === 0) continue;
              context.moveTo(x - bounds.left + minorRadius, y - bounds.top);
              context.arc(x - bounds.left, y - bounds.top, minorRadius, 0, Math.PI * 2, false);
            }
          }
          context.fill();

          context.beginPath();
          context.fillStyle = "rgba(31, 122, 104, 0.3)";
          for (let x = Math.ceil(bounds.left / GRID_MAJOR_STEP) * GRID_MAJOR_STEP; x <= bounds.right; x += GRID_MAJOR_STEP) {
            for (let y = Math.ceil(bounds.top / GRID_MAJOR_STEP) * GRID_MAJOR_STEP; y <= bounds.bottom; y += GRID_MAJOR_STEP) {
              context.moveTo(x - bounds.left + majorRadius, y - bounds.top);
              context.arc(x - bounds.left, y - bounds.top, majorRadius, 0, Math.PI * 2, false);
            }
          }
          context.fill();
          context.restore();
        }}
      />
    </Layer>
  );
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 800, height: 600 });

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
