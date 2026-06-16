"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Group, Layer, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { computeEdgePath, type RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge, CanvasNode, EdgeRouting, EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { cn } from "@/lib/utils";

const NODE_CARD_RADIUS = 14;
const NODE_MIN_CHARS = 6;
const NODE_MAX_CHARS = 24;
const NODE_TEXT_PADDING_X = 14;
const NODE_TEXT_PADDING_Y = 14;
const NODE_TEXT_FONT_SIZE = 14;
const NODE_TEXT_LINE_HEIGHT = 18;
const NODE_MAX_LINES = 12;
const NODE_TEXT_FONT_FAMILY = "'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif";
const GRID_STEP = 24;
const GRID_MAJOR_STEP = GRID_STEP * 5;

let textMeasureCanvas: HTMLCanvasElement | null = null;

type KonvaCanvasProps = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  showGrid: boolean;
  edgeRouting: EdgeRouting;
  onGraphDraft: (graph: MermaidGraph, message?: string) => void;
  onGraphCommit: (graph: MermaidGraph, selection?: Selection, message?: string) => void;
  onCaptureHistory: () => void;
  onSelectionChange: (selection: Selection) => void;
  onViewportChange: (viewport: ViewportState) => void;
  onAddNodeAt: (point: { x: number; y: number }) => void;
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

function edgeVisualStyle(edge: CanvasEdge) {
  if (edge.style === "thick") return { strokeWidth: 4, dash: undefined };
  if (edge.style === "dotted") return { strokeWidth: 2, dash: [1, 8] };
  return { strokeWidth: 2, dash: undefined };
}

function measureNodeTextWidth(value: string) {
  if (typeof document === "undefined") return value.length * NODE_TEXT_FONT_SIZE * 0.58;

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return value.length * NODE_TEXT_FONT_SIZE * 0.58;

  context.font = `700 ${NODE_TEXT_FONT_SIZE}px ${NODE_TEXT_FONT_FAMILY}`;
  return context.measureText(value).width;
}

function nodeCharacterWidth() {
  return measureNodeTextWidth("中");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function nodeTextWidth(node: CanvasNode) {
  const minWidth = NODE_MIN_CHARS * nodeCharacterWidth();
  const maxWidth = NODE_MAX_CHARS * nodeCharacterWidth();
  const lineWidths = (node.label || " ").split(/\r?\n/).map((line) => measureNodeTextWidth(line || " "));
  const preferredWidth = Math.ceil(Math.max(...lineWidths));

  return clamp(preferredWidth, minWidth, maxWidth);
}

function nodeWidth(node: CanvasNode) {
  return nodeTextWidth(node) + NODE_TEXT_PADDING_X * 2;
}

function countWrappedLines(value: string, maxWidth: number) {
  const paragraphs = (value || " ").split(/\r?\n/);

  return paragraphs.reduce((total, paragraph) => {
    if (!paragraph) return total + 1;

    let lines = 1;
    let currentWidth = 0;
    const tokens = paragraph.match(/\s+|[^\s]+/g) || [paragraph];

    for (const token of tokens) {
      if (/^\s+$/.test(token) && currentWidth === 0) continue;
      const tokenWidth = measureNodeTextWidth(token);

      if (tokenWidth > maxWidth) {
        for (const character of token) {
          const characterWidth = measureNodeTextWidth(character);
          if (currentWidth > 0 && currentWidth + characterWidth > maxWidth) {
            lines += 1;
            currentWidth = characterWidth;
          } else {
            currentWidth += characterWidth;
          }
        }
        continue;
      }

      if (currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
        lines += 1;
        currentWidth = /^\s+$/.test(token) ? 0 : tokenWidth;
      } else {
        currentWidth += tokenWidth;
      }
    }

    return total + lines;
  }, 0);
}

function nodeHeight(node: CanvasNode) {
  const textHeight = Math.min(NODE_MAX_LINES, countWrappedLines(node.label, nodeTextWidth(node))) * NODE_TEXT_LINE_HEIGHT;
  return textHeight + NODE_TEXT_PADDING_Y * 2;
}

function nodeRect(node: CanvasNode): RoutedNodeRect {
  const width = nodeWidth(node);
  const height = nodeHeight(node);

  return {
    id: node.id,
    x: node.x,
    y: node.y,
    width,
    height
  };
}

function pointInsideNode(point: { x: number; y: number }, node: CanvasNode) {
  const width = nodeWidth(node);
  const height = nodeHeight(node);
  return point.x >= node.x && point.x <= node.x + width && point.y >= node.y && point.y <= node.y + height;
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
  const width = nodeWidth(node);
  const height = nodeHeight(node);
  return node.x < rect.x + rect.width && node.x + width > rect.x && node.y < rect.y + rect.height && node.y + height > rect.y;
}

function anchorPoints(node: CanvasNode) {
  const width = nodeWidth(node);
  const height = nodeHeight(node);

  return [
    { key: "top", x: node.x + width / 2, y: node.y },
    { key: "right", x: node.x + width, y: node.y + height / 2 },
    { key: "bottom", x: node.x + width / 2, y: node.y + height },
    { key: "left", x: node.x, y: node.y + height / 2 }
  ];
}

export function KonvaCanvas({
  graph,
  selection,
  viewport,
  mode,
  showGrid,
  edgeRouting,
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
  const [nodeEditorLayout, setNodeEditorLayout] = useState({ insetTop: 0, height: NODE_TEXT_LINE_HEIGHT, scrollable: false });
  const nodeEditorRef = useRef<HTMLTextAreaElement>(null);
  const nodeEditorMeasureRef = useRef<HTMLDivElement>(null);

  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const selectedEdgeIds = useMemo(() => new Set(selection.edgeIds), [selection.edgeIds]);
  const renderedNodes = useMemo(
    () =>
      inlineEdit?.type === "node"
        ? graph.nodes.map((node) => (node.id === inlineEdit.id ? { ...node, label: inlineEdit.value } : node))
        : graph.nodes,
    [graph.nodes, inlineEdit]
  );
  const routedNodeRects = useMemo(() => renderedNodes.map(nodeRect), [renderedNodes]);
  const selectedSingleEdge = selection.edgeIds.length === 1 ? graph.edges.find((edge) => edge.id === selection.edgeIds[0]) : undefined;
  const selectedSingleEdgeGeometry = selectedSingleEdge ? computeEdgePath(selectedSingleEdge, routedNodeRects, edgeRouting) : null;

  useEffect(() => {
    if (inlineEdit?.type !== "node") return;
    const editor = nodeEditorRef.current;
    if (!editor) return;

    editor.focus();
    editor.select();
  }, [inlineEdit?.id, inlineEdit?.type]);

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
      const node = renderedNodes.find((item) => item.id === inlineEdit.id);
      if (!node) return null;
      const height = nodeHeight(node);
      const textWidth = nodeTextWidth(node);
      const textHeight = height - NODE_TEXT_PADDING_Y * 2;
      const screen = worldToScreen({ x: node.x + NODE_TEXT_PADDING_X, y: node.y + NODE_TEXT_PADDING_Y });
      return {
        left: screen.x,
        top: screen.y,
        width: textWidth * viewport.scale,
        height: textHeight * viewport.scale
      };
    }

    const edge = graph.edges.find((item) => item.id === inlineEdit.id);
    const geometry = edge ? computeEdgePath(edge, routedNodeRects, edgeRouting) : null;
    if (!geometry) return null;
    const screen = worldToScreen({ x: geometry.labelPoint.x - 60, y: geometry.labelPoint.y - 17 });
    return {
      left: screen.x,
      top: screen.y,
      width: Math.max(120, 120 * viewport.scale),
      height: Math.max(32, 34 * viewport.scale)
    };
  }

  const editStyle = inlineEditStyle();

  useLayoutEffect(() => {
    if (inlineEdit?.type !== "node" || !editStyle) return;
    const measure = nodeEditorMeasureRef.current;
    if (!measure) return;

    const minimumHeight = NODE_TEXT_LINE_HEIGHT * viewport.scale;
    const measuredHeight = Math.max(minimumHeight, Math.ceil(measure.scrollHeight));
    const height = Math.min(editStyle.height, measuredHeight);
    const insetTop = Math.max(0, Math.floor((editStyle.height - height) / 2));
    const scrollable = measuredHeight > editStyle.height;

    setNodeEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [editStyle, inlineEdit?.type, inlineEdit?.value, viewport.scale]);

  return (
    <section className="relative h-full min-h-0 bg-card">
      <div
        ref={containerRef}
        className={cn(
          "relative h-full min-h-0 overflow-hidden bg-background",
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
            const newNode = { id: "", label: "新节点", x: 0, y: 0, fill: "#ffffff" };
            const newNodeWidth = nodeWidth(newNode);
            const newNodeHeight = nodeHeight(newNode);
            onAddNodeAt({
              x: point.x - newNodeWidth / 2,
              y: point.y - newNodeHeight / 2
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
                const nodeIds = renderedNodes.filter((node) => nodeIntersectsBox(node, selectionBox)).map((node) => node.id);
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
              const geometry = computeEdgePath(edge, routedNodeRects, edgeRouting);
              if (!geometry) return null;
              const isSelected = selectedEdgeIds.has(edge.id);
              const visualStyle = edgeVisualStyle(edge);

              return (
                <Group key={edge.id}>
                  <Arrow
                    points={geometry.points}
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
                    points={geometry.points}
                    stroke={isSelected ? "#1f7a68" : "#526766"}
                    fill={isSelected ? "#1f7a68" : "#526766"}
                    strokeWidth={isSelected ? visualStyle.strokeWidth + 1 : visualStyle.strokeWidth}
                    dash={visualStyle.dash}
                    lineCap="round"
                    lineJoin="round"
                    pointerLength={10}
                    pointerWidth={10}
                    listening={false}
                  />
                  {edge.label ? (
                    <Group
                      x={geometry.labelPoint.x - 46}
                      y={geometry.labelPoint.y - 14}
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

            {renderedNodes.map((node) => {
              const isSelected = selectedNodeIds.has(node.id);
              const showAnchors = mode === "connect" || hoveredNodeId === node.id || isSelected;
              const width = nodeWidth(node);
              const textWidth = nodeTextWidth(node);
              const height = nodeHeight(node);
              const textHeight = height - NODE_TEXT_PADDING_Y * 2;

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
                      width={width}
                      height={height}
                      cornerRadius={NODE_CARD_RADIUS}
                      fill={node.fill}
                      stroke={isSelected ? "#1f7a68" : "#b8c8c4"}
                      strokeWidth={1}
                    />
                    <Text
                      x={NODE_TEXT_PADDING_X}
                      y={NODE_TEXT_PADDING_Y}
                      width={textWidth}
                      height={textHeight}
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
                  x={selectedSingleEdgeGeometry.start.x}
                  y={selectedSingleEdgeGeometry.start.y}
                  radius={7}
                  fill="#1f7a68"
                  stroke="#ffffff"
                  strokeWidth={2}
                  draggable
                  onDragEnd={() => retargetEdge(selectedSingleEdge.id, "from")}
                />
                <Circle
                  x={selectedSingleEdgeGeometry.end.x}
                  y={selectedSingleEdgeGeometry.end.y}
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
          <>
            <div
              ref={nodeEditorMeasureRef}
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] top-0 whitespace-pre-wrap text-center font-bold"
              style={{
                width: editStyle.width,
                fontFamily: NODE_TEXT_FONT_FAMILY,
                fontSize: NODE_TEXT_FONT_SIZE * viewport.scale,
                lineHeight: `${NODE_TEXT_LINE_HEIGHT * viewport.scale}px`,
                overflowWrap: "break-word",
                wordBreak: "break-word",
                visibility: "hidden"
              }}
            >
              {inlineEdit.value || "\u200b"}
            </div>
            <Textarea
              ref={nodeEditorRef}
              value={inlineEdit.value}
              className="absolute z-40 block min-h-0 resize-none overflow-x-hidden rounded-none border-0 bg-transparent p-0 text-center font-bold text-[#172022] shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{
                left: editStyle.left,
                top: editStyle.top + nodeEditorLayout.insetTop,
                width: editStyle.width,
                height: nodeEditorLayout.height,
                fontFamily: NODE_TEXT_FONT_FAMILY,
                fontSize: NODE_TEXT_FONT_SIZE * viewport.scale,
                lineHeight: `${NODE_TEXT_LINE_HEIGHT * viewport.scale}px`,
                overflowWrap: "break-word",
                wordBreak: "break-word",
                overflowY: nodeEditorLayout.scrollable ? "auto" : "hidden"
              }}
              onChange={(event) => setInlineEdit({ ...inlineEdit, value: event.target.value })}
              onBlur={() => commitInlineEdit(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  commitInlineEdit(true);
                }
                if (event.key === "Escape") commitInlineEdit(false);
              }}
            />
          </>
        ) : null}

        {inlineEdit?.type === "edge" && editStyle ? (
          <Input
            autoFocus
            value={inlineEdit.value}
            className="absolute z-40 h-9 rounded-md bg-card px-2 text-sm shadow-lg"
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
