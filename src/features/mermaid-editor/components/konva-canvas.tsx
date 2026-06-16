"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
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
import { computeAlignmentSnap, selectionBounds, type AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import {
  dispatchCanvasClick,
  dispatchCanvasDoubleClick,
  dispatchCanvasPointerDown,
  dispatchCanvasPointerMove,
  dispatchCanvasPointerUp,
  hasSelection as hasInteractionSelection,
  idleInteraction,
  interactionCursor,
  isEditingInteraction,
  isPanningButton,
  selectionVersionKey,
  type BlankClickIntent,
  type CanvasInteractionCommand,
  type CanvasPoint,
  type HitTarget,
  type InteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  CANVAS_HIT_NAMES,
  edgeEndpointHitId,
  edgeHitId,
  edgeLabelHitId,
  nodeAnchorHitId,
  nodeHitId,
  resolveKonvaHitTarget
} from "@/features/mermaid-editor/lib/canvas-hit-target";
import { DEFAULT_CANVAS_GRID, firstGridCoordinateAtOrAfter, getCanvasGridRenderPlan, isGridCoordinate } from "@/features/mermaid-editor/lib/canvas-grid";
import { computeEdgePath } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasNode, EdgeRouting, EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import {
  buildNodeGeometry,
  nodeIntersectsRect,
  pointInsideNodeFrame,
  type NodeGeometrySpec
} from "@/features/mermaid-editor/lib/node-geometry";
import {
  CANVAS_VISUAL_TOKENS,
  getAlignmentGuideVisualState,
  getAnchorVisualState,
  getConnectionDraftVisualState,
  getEdgeEndpointVisualState,
  getEdgeVisualState,
  getNodeVisualState,
  getSelectionBoxVisualState
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import { cn } from "@/lib/utils";

const NODE_MIN_CHARS = 6;
const NODE_MAX_CHARS = 24;
const NODE_TEXT_PADDING_X = 14;
const NODE_TEXT_PADDING_Y = 14;
const NODE_TEXT_FONT_SIZE = 14;
const NODE_TEXT_LINE_HEIGHT = 18;
const NODE_MAX_LINES = 12;
const NODE_TEXT_FONT_FAMILY = "'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif";

let textMeasureCanvas: HTMLCanvasElement | null = null;

type KonvaCanvasProps = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  panningRequested: boolean;
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

type InlineEdit =
  | { type: "node"; id: string; value: string }
  | { type: "edge"; id: string; value: string };

function measureNodeTextWidth(value: string) {
  if (typeof document === "undefined") return value.length * NODE_TEXT_FONT_SIZE * 0.58;

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return value.length * NODE_TEXT_FONT_SIZE * 0.58;

  context.font = `700 ${NODE_TEXT_FONT_SIZE}px ${NODE_TEXT_FONT_FAMILY}`;
  return context.measureText(value).width;
}

function nodeGeometrySpec(): NodeGeometrySpec {
  return {
    minChars: NODE_MIN_CHARS,
    maxChars: NODE_MAX_CHARS,
    paddingX: NODE_TEXT_PADDING_X,
    paddingY: NODE_TEXT_PADDING_Y,
    lineHeight: NODE_TEXT_LINE_HEIGHT,
    maxLines: NODE_MAX_LINES,
    measureText: measureNodeTextWidth
  };
}

function normalizeBox(box: SelectionBox) {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return { x, y, width, height };
}

export function KonvaCanvas({
  graph,
  selection,
  viewport,
  mode,
  panningRequested,
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
  const dragRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const blankClickIntentRef = useRef<BlankClickIntent | null>(null);
  const interactionGenerationRef = useRef(0);
  const selectionVersionRef = useRef(0);
  const lastSelectionKeyRef = useRef(selectionVersionKey(selection));
  const dimensions = useContainerSize(containerRef);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [interactionState, setInteractionState] = useState<InteractionState>(idleInteraction);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const [nodeEditorLayout, setNodeEditorLayout] = useState({ insetTop: 0, height: NODE_TEXT_LINE_HEIGHT, scrollable: false });
  const nodeEditorRef = useRef<HTMLTextAreaElement>(null);
  const nodeEditorMeasureRef = useRef<HTMLDivElement>(null);

  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const geometrySpec = useMemo(() => nodeGeometrySpec(), []);
  const renderedNodes = useMemo(
    () =>
      inlineEdit?.type === "node"
        ? graph.nodes.map((node) => (node.id === inlineEdit.id ? { ...node, label: inlineEdit.value } : node))
        : graph.nodes,
    [graph.nodes, inlineEdit]
  );
  const renderedNodeGeometries = useMemo(() => renderedNodes.map((node) => buildNodeGeometry(node, geometrySpec)), [geometrySpec, renderedNodes]);
  const nodeGeometryById = useMemo(() => new Map(renderedNodeGeometries.map((geometry) => [geometry.id, geometry])), [renderedNodeGeometries]);
  const routedNodeRects = useMemo(() => renderedNodeGeometries.map((geometry) => geometry.routedRect), [renderedNodeGeometries]);
  const selectedSingleEdge = selection.edgeIds.length === 1 ? graph.edges.find((edge) => edge.id === selection.edgeIds[0]) : undefined;
  const selectedSingleEdgeGeometry = selectedSingleEdge ? computeEdgePath(selectedSingleEdge, routedNodeRects, edgeRouting) : null;
  const selectionBox =
    interactionState.kind === "marqueeSelecting"
      ? {
          startX: interactionState.startWorld.x,
          startY: interactionState.startWorld.y,
          endX: interactionState.currentWorld.x,
          endY: interactionState.currentWorld.y
        }
      : null;
  const connectionDraft = interactionState.kind === "connectingEdge" ? interactionState : null;

  useEffect(() => {
    const nextSelectionKey = selectionVersionKey(selection);
    if (nextSelectionKey === lastSelectionKeyRef.current) return;

    lastSelectionKeyRef.current = nextSelectionKey;
    selectionVersionRef.current += 1;
    blankClickIntentRef.current = null;
    interactionGenerationRef.current += 1;
  }, [selection]);

  useEffect(() => {
    invalidateBlankClickIntent();
  }, [mode, panningRequested]);

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
      if (inlineEdit || isEditingInteraction(interactionState) || interactionState.kind !== "idle" || mode !== "select" || isTextInput(event.target)) return;
      if (selection.nodeIds.length !== 1 || selection.edgeIds.length > 0) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Enter" && event.key !== "F2") return;

      const node = graph.nodes.find((item) => item.id === selection.nodeIds[0]);
      if (!node) return;
      event.preventDefault();
      invalidateBlankClickIntent();
      setInteractionState({ kind: "editingNodeText", nodeId: node.id });
      setInlineEdit({ type: "node", id: node.id, value: node.label });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [graph.nodes, inlineEdit, interactionState, mode, selection.edgeIds.length, selection.nodeIds]);

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

  function pointerScreenPoint(): CanvasPoint | null {
    return stageRef.current?.getPointerPosition() || null;
  }

  function invalidateBlankClickIntent() {
    blankClickIntentRef.current = null;
    interactionGenerationRef.current += 1;
  }

  function resetInteraction() {
    setInteractionState(idleInteraction);
  }

  function hitTargetFromEvent(event: KonvaEventObject<MouseEvent>): HitTarget {
    return resolveKonvaHitTarget(event.target, event.target.getStage());
  }

  function updateHoverFromHit(hit: HitTarget) {
    if (hit.kind === "node") {
      setHoveredNodeId(hit.id);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "nodeAnchor") {
      setHoveredNodeId(hit.nodeId);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "edge" || hit.kind === "edgeLabel") {
      setHoveredNodeId(null);
      setHoveredEdgeId(hit.id);
      return;
    }

    if (hit.kind === "edgeEndpoint") {
      setHoveredNodeId(null);
      setHoveredEdgeId(hit.edgeId);
      return;
    }

    setHoveredNodeId(null);
    setHoveredEdgeId(null);
  }

  function executeCanvasCommands(commands: CanvasInteractionCommand[]) {
    for (const command of commands) {
      executeCanvasCommand(command);
    }
  }

  function executeCanvasCommand(command: CanvasInteractionCommand) {
    if (command.type === "invalidateBlankClick") {
      invalidateBlankClickIntent();
      return;
    }

    if (command.type === "clearSelection") {
      onSelectionChange(emptySelection);
      return;
    }

    if (command.type === "recordBlankClick") {
      blankClickIntentRef.current = command.intent;
      return;
    }

    if (command.type === "addNodeAt") {
      const newNode = { id: "", label: "新节点", x: 0, y: 0, fill: "#ffffff" };
      const newNodeFrame = buildNodeGeometry(newNode, geometrySpec).frame;
      onAddNodeAt({
        x: command.point.x - newNodeFrame.width / 2,
        y: command.point.y - newNodeFrame.height / 2
      });
      return;
    }

    if (command.type === "selectNode") {
      onSelectionChange(command.additive ? toggleNodeSelection(selection, command.id) : selectOnlyNode(command.id));
      return;
    }

    if (command.type === "selectEdge") {
      onSelectionChange(command.additive ? toggleEdgeSelection(selection, command.id) : selectOnlyEdge(command.id));
      return;
    }

    if (command.type === "startInlineEdit") {
      if (command.target.type === "node") {
        const node = graph.nodes.find((item) => item.id === command.target.id);
        if (!node) return;
        setInteractionState({ kind: "editingNodeText", nodeId: node.id });
        setInlineEdit({ type: "node", id: node.id, value: node.label });
        return;
      }

      const edge = graph.edges.find((item) => item.id === command.target.id);
      if (!edge) return;
      setInteractionState({ kind: "editingEdgeLabel", edgeId: edge.id });
      setInlineEdit({ type: "edge", id: edge.id, value: edge.label });
      return;
    }

    if (command.type === "startNodeDrag") {
      const node = graph.nodes.find((item) => item.id === command.nodeId);
      if (node) startNodeDrag(node);
      return;
    }

    if (command.type === "selectMarquee") {
      if (command.rect.width > 4 || command.rect.height > 4) {
        const nodeIds = renderedNodeGeometries.filter((geometry) => nodeIntersectsRect(geometry, command.rect)).map((geometry) => geometry.id);
        onSelectionChange({ nodeIds, edgeIds: [], primaryId: nodeIds[0] });
      } else {
        onSelectionChange(emptySelection);
      }
      return;
    }

    if (command.type === "finishConnection") {
      finishConnection(command.draft);
      return;
    }

    if (command.type === "retargetEdge") {
      retargetEdge(command.edgeId, command.side);
      return;
    }

    if (command.type === "resetInteraction") {
      resetInteraction();
    }
  }

  function onWheel(event: KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    invalidateBlankClickIntent();
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

  function handleCanvasPointerDown(event: KonvaEventObject<MouseEvent>, explicitHit?: HitTarget, worldOverride?: CanvasPoint) {
    const pointer = pointerScreenPoint();
    const world = worldOverride ?? pointerWorldPoint();
    if (!pointer || !world) return;

    const hit = explicitHit ?? hitTargetFromEvent(event);
    if (isPanningButton(event.evt.button) || panningRequested) event.evt.preventDefault();

    const result = dispatchCanvasPointerDown({
      state: interactionState,
      tool: mode,
      hit,
      button: event.evt.button,
      screen: pointer,
      world,
      now: event.evt.timeStamp,
      selectionVersion: selectionVersionRef.current,
      viewport,
      panningRequested
    });

    executeCanvasCommands(result.commands);
    setInteractionState(result.state);
  }

  function handleCanvasPointerMove(event: KonvaEventObject<MouseEvent>) {
    const hit = hitTargetFromEvent(event);
    updateHoverFromHit(hit);

    const pointer = pointerScreenPoint();
    const world = pointerWorldPoint();
    if (!pointer || !world) return;

    if (interactionState.kind === "panning") {
      onViewportChange({
        ...viewport,
        x: interactionState.originViewport.x + pointer.x - interactionState.startScreen.x,
        y: interactionState.originViewport.y + pointer.y - interactionState.startScreen.y
      });
      return;
    }

    const result = dispatchCanvasPointerMove({ state: interactionState, screen: pointer, world });
    executeCanvasCommands(result.commands);
    setInteractionState(result.state);
  }

  function handleCanvasPointerUp(event: KonvaEventObject<MouseEvent>) {
    const pointer = pointerScreenPoint();
    const world = pointerWorldPoint();
    if (!pointer || !world) {
      resetInteraction();
      return;
    }

    const result = dispatchCanvasPointerUp({
      state: interactionState,
      tool: mode,
      hit: hitTargetFromEvent(event),
      hasSelection: hasInteractionSelection(selection),
      screen: pointer,
      world,
      now: performance.now(),
      previousBlankClick: blankClickIntentRef.current,
      selectionVersion: selectionVersionRef.current,
      interactionGeneration: interactionGenerationRef.current
    });

    executeCanvasCommands(result.commands);
  }

  function handleCanvasClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    executeCanvasCommands(dispatchCanvasClick({ tool: mode, hit, shiftKey: event.evt.shiftKey }));
  }

  function handleCanvasTap(event: KonvaEventObject<Event>, hit: HitTarget) {
    event.cancelBubble = true;
    executeCanvasCommands(dispatchCanvasClick({ tool: mode, hit, shiftKey: false }));
  }

  function handleCanvasDoubleClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    executeCanvasCommands(dispatchCanvasDoubleClick({ tool: mode, hit }));
  }

  function startNodeDrag(node: CanvasNode) {
    if (dragRef.current) return;
    const ids = selectedNodeIds.has(node.id) ? selection.nodeIds : [node.id];
    const screen = pointerScreenPoint() || { x: 0, y: 0 };
    const world = pointerWorldPoint() || { x: node.x, y: node.y };
    if (!selectedNodeIds.has(node.id)) onSelectionChange(selectOnlyNode(node.id));
    invalidateBlankClickIntent();
    setAlignmentGuides([]);
    setInteractionState({ kind: "draggingNodes", pointerId: 0, nodeId: node.id, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => ids.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    onCaptureHistory();
  }

  function moveSelectedNodes(node: CanvasNode, target: Konva.Node) {
    if (!dragRef.current) return;
    const origin = dragRef.current[node.id];
    if (!origin) return;
    const x = target.x();
    const y = target.y();
    const deltaX = x - origin.x;
    const deltaY = y - origin.y;
    const movingRects = graph.nodes
      .filter((item) => dragRef.current?.[item.id])
      .map((item) => {
        const start = dragRef.current![item.id];
        const movedNode = {
          ...item,
          x: start.x + deltaX,
          y: start.y + deltaY
        };
        return buildNodeGeometry(movedNode, geometrySpec).alignmentRect;
      });
    const movingBounds = selectionBounds(movingRects);
    const staticRects = graph.nodes.filter((item) => !dragRef.current?.[item.id]).map((item) => buildNodeGeometry(item, geometrySpec).alignmentRect);
    const snap = movingBounds ? computeAlignmentSnap(movingBounds, staticRects, viewport.scale) : { dx: 0, dy: 0, guides: [] };
    const snappedDeltaX = deltaX + snap.dx;
    const snappedDeltaY = deltaY + snap.dy;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + snappedDeltaX, y: position.y + snappedDeltaY }])
    );
    const draggedPosition = positions[node.id];
    if (draggedPosition) target.position(draggedPosition);
    setAlignmentGuides(snap.guides);
    onGraphDraft(setNodePositions(graph, positions), "正在移动节点。");
  }

  function finishConnection(draft: Extract<InteractionState, { kind: "connectingEdge" }>) {
    const point = pointerWorldPoint();
    const target = point ? graph.nodes.find((node) => node.id !== draft.fromNodeId && pointInsideNodeFrame(point, buildNodeGeometry(node, geometrySpec))) : null;
    if (target) {
      const result = createEdge(graph, draft.fromNodeId, target.id);
      onGraphCommit(result.graph, result.selection, "已创建连线。");
    }
  }

  function retargetEdge(edgeId: string, side: "from" | "to") {
    const point = pointerWorldPoint();
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!point || !edge) return;

    const target = graph.nodes.find((node) => pointInsideNodeFrame(point, buildNodeGeometry(node, geometrySpec)));
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
    resetInteraction();
  }

  function inlineEditStyle() {
    if (!inlineEdit) return null;
    if (inlineEdit.type === "node") {
      const geometry = nodeGeometryById.get(inlineEdit.id);
      if (!geometry) return null;
      const screen = worldToScreen({
        x: geometry.frame.x + geometry.textBox.x,
        y: geometry.frame.y + geometry.textBox.y
      });
      return {
        left: screen.x,
        top: screen.y,
        width: geometry.textBox.width * viewport.scale,
        height: geometry.textBox.height * viewport.scale
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
    const scrollable = measuredHeight > editStyle.height + 1;
    const height = scrollable ? editStyle.height : Math.min(editStyle.height, measuredHeight);
    const insetTop = Math.max(0, Math.floor((editStyle.height - height) / 2));

    setNodeEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [editStyle, inlineEdit?.type, inlineEdit?.value, viewport.scale]);

  const cursorClassName = interactionCursor(mode, interactionState, panningRequested);

  return (
    <section className="relative h-full min-h-0 bg-card">
      <div
        ref={containerRef}
        className={cn(
          "relative h-full min-h-0 overflow-hidden bg-background",
          cursorClassName
        )}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
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
          onMouseDown={handleCanvasPointerDown}
          onMouseMove={handleCanvasPointerMove}
          onMouseUp={handleCanvasPointerUp}
          onMouseLeave={() => {
            resetInteraction();
            setAlignmentGuides([]);
            setHoveredNodeId(null);
            setHoveredEdgeId(null);
          }}
        >
          {showGrid ? <CanvasGrid dimensions={dimensions} viewport={viewport} /> : null}

          <Layer>
            {graph.edges.map((edge) => {
              const geometry = computeEdgePath(edge, routedNodeRects, edgeRouting);
              if (!geometry) return null;
              const edgeVisual = getEdgeVisualState({ edge, selection, hoveredEdgeId, interactionState, inlineEdit });

              return (
                <Group key={edge.id}>
                  <Arrow
                    id={edgeHitId(edge.id)}
                    name={CANVAS_HIT_NAMES.edge}
                    points={geometry.points}
                    stroke="transparent"
                    fill="transparent"
                    strokeWidth={CANVAS_VISUAL_TOKENS.edge.hitStrokeWidth}
                    pointerLength={0}
                    pointerWidth={0}
                    onClick={(event) => handleCanvasClick(event, { kind: "edge", id: edge.id })}
                    onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edge", id: edge.id })}
                    onTap={(event) => handleCanvasTap(event, { kind: "edge", id: edge.id })}
                  />
                  <Arrow
                    points={geometry.points}
                    stroke={edgeVisual.stroke}
                    fill={edgeVisual.fill}
                    strokeWidth={edgeVisual.strokeWidth}
                    dash={edgeVisual.dash}
                    lineCap="round"
                    lineJoin="round"
                    pointerLength={CANVAS_VISUAL_TOKENS.edge.pointerLength}
                    pointerWidth={CANVAS_VISUAL_TOKENS.edge.pointerWidth}
                    listening={false}
                  />
                  {edge.label ? (
                    <Group
                      id={edgeLabelHitId(edge.id)}
                      name={CANVAS_HIT_NAMES.edgeLabel}
                      x={geometry.labelPoint.x - CANVAS_VISUAL_TOKENS.edge.labelWidth / 2}
                      y={geometry.labelPoint.y - CANVAS_VISUAL_TOKENS.edge.labelHeight / 2}
                      onClick={(event) => handleCanvasClick(event, { kind: "edgeLabel", id: edge.id })}
                      onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edgeLabel", id: edge.id })}
                    >
                      <Rect
                        width={CANVAS_VISUAL_TOKENS.edge.labelWidth}
                        height={CANVAS_VISUAL_TOKENS.edge.labelHeight}
                        cornerRadius={CANVAS_VISUAL_TOKENS.edge.labelCornerRadius}
                        fill={edgeVisual.labelFill}
                        stroke={edgeVisual.labelStroke}
                      />
                      <Text
                        width={CANVAS_VISUAL_TOKENS.edge.labelWidth}
                        height={CANVAS_VISUAL_TOKENS.edge.labelHeight}
                        align="center"
                        verticalAlign="middle"
                        text={edge.label}
                        fontSize={12}
                        fill={edgeVisual.labelTextFill}
                        ellipsis
                      />
                    </Group>
                  ) : null}
                </Group>
              );
            })}

            {renderedNodes.map((node) => {
              const geometry = nodeGeometryById.get(node.id);
              if (!geometry) return null;
              const nodeVisual = getNodeVisualState({ nodeId: node.id, selection, hoveredNodeId, interactionState, inlineEdit });
              const anchorVisual = getAnchorVisualState({ nodeId: node.id, mode, selection, hoveredNodeId, interactionState, inlineEdit });

              return (
                <Group
                  id={nodeHitId(node.id)}
                  name={CANVAS_HIT_NAMES.node}
                  key={node.id}
                  x={geometry.frame.x}
                  y={geometry.frame.y}
                  draggable={mode === "select" && !panningRequested && interactionState.kind !== "panning"}
                  onDragStart={(event) => {
                    if (event.evt.button !== 0) {
                      event.target.stopDrag();
                      return;
                    }
                    executeCanvasCommand({ type: "startNodeDrag", nodeId: node.id });
                  }}
                  onDragMove={(event) => moveSelectedNodes(node, event.target)}
                  onDragEnd={() => {
                    dragRef.current = null;
                    setAlignmentGuides([]);
                    resetInteraction();
                  }}
                  onClick={(event) => handleCanvasClick(event, { kind: "node", id: node.id })}
                  onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "node", id: node.id })}
                >
                  <Rect
                    width={geometry.frame.width}
                    height={geometry.frame.height}
                    cornerRadius={CANVAS_VISUAL_TOKENS.node.cornerRadius}
                    fill={node.fill}
                    stroke={nodeVisual.stroke}
                    strokeWidth={nodeVisual.strokeWidth}
                  />
                  <Text
                    x={geometry.textBox.x}
                    y={geometry.textBox.y}
                    width={geometry.textBox.width}
                    height={geometry.textBox.height}
                    align="center"
                    verticalAlign="middle"
                    text={node.label}
                    fontSize={NODE_TEXT_FONT_SIZE}
                    fontStyle="bold"
                    fontFamily={NODE_TEXT_FONT_FAMILY}
                    lineHeight={NODE_TEXT_LINE_HEIGHT / NODE_TEXT_FONT_SIZE}
                    wrap="word"
                    fill={nodeVisual.textFill}
                    ellipsis
                    visible={!(inlineEdit?.type === "node" && inlineEdit.id === node.id)}
                  />
                  {anchorVisual.visible
                    ? geometry.anchorsLocal.map((anchor) => (
                        <Circle
                          id={nodeAnchorHitId(node.id, anchor.key)}
                          name={CANVAS_HIT_NAMES.nodeAnchor}
                          key={`${node.id}-${anchor.key}`}
                          x={anchor.x}
                          y={anchor.y}
                          radius={anchorVisual.radius}
                          fill={anchorVisual.fill}
                          stroke={anchorVisual.stroke}
                          strokeWidth={anchorVisual.strokeWidth}
                          onMouseDown={(event) => {
                            event.cancelBubble = true;
                            handleCanvasPointerDown(event, { kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key }, {
                              x: geometry.frame.x + anchor.x,
                              y: geometry.frame.y + anchor.y
                            });
                          }}
                        />
                      ))
                    : null}
                </Group>
              );
            })}

            {connectionDraft ? (
              <Arrow
                points={[connectionDraft.startWorld.x, connectionDraft.startWorld.y, connectionDraft.currentWorld.x, connectionDraft.currentWorld.y]}
                {...getConnectionDraftVisualState()}
                listening={false}
              />
            ) : null}

            {selectionBox ? (
              <Rect
                {...normalizeBox(selectionBox)}
                {...getSelectionBoxVisualState()}
                listening={false}
              />
            ) : null}

            {selectedSingleEdge && selectedSingleEdgeGeometry ? (
              <>
                <Circle
                  id={edgeEndpointHitId(selectedSingleEdge.id, "from")}
                  name={CANVAS_HIT_NAMES.edgeEndpoint}
                  x={selectedSingleEdgeGeometry.start.x}
                  y={selectedSingleEdgeGeometry.start.y}
                  {...getEdgeEndpointVisualState()}
                  draggable
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    handleCanvasPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "from" });
                  }}
                  onDragEnd={() => {
                    executeCanvasCommands([
                      { type: "retargetEdge", edgeId: selectedSingleEdge.id, side: "from" },
                      { type: "resetInteraction" }
                    ]);
                  }}
                />
                <Circle
                  id={edgeEndpointHitId(selectedSingleEdge.id, "to")}
                  name={CANVAS_HIT_NAMES.edgeEndpoint}
                  x={selectedSingleEdgeGeometry.end.x}
                  y={selectedSingleEdgeGeometry.end.y}
                  {...getEdgeEndpointVisualState()}
                  draggable
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    handleCanvasPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "to" });
                  }}
                  onDragEnd={() => {
                    executeCanvasCommands([
                      { type: "retargetEdge", edgeId: selectedSingleEdge.id, side: "to" },
                      { type: "resetInteraction" }
                    ]);
                  }}
                />
              </>
            ) : null}

            {alignmentGuides.length ? <AlignmentGuideOverlay guides={alignmentGuides} /> : null}
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
              className="node-inline-editor absolute z-40 block min-h-0 resize-none overflow-x-hidden rounded-none border-0 bg-transparent p-0 text-center font-bold text-[#172022] shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
  const plan = useMemo(
    () =>
      getCanvasGridRenderPlan(
        { width: dimensions.width, height: dimensions.height },
        { x: viewport.x, y: viewport.y, scale: viewport.scale },
        DEFAULT_CANVAS_GRID
      ),
    [dimensions.height, dimensions.width, viewport.scale, viewport.x, viewport.y]
  );
  const { bounds, levels } = plan;

  return (
    <Layer listening={false}>
      <Shape
        x={bounds.left}
        y={bounds.top}
        width={bounds.width}
        height={bounds.height}
        perfectDrawEnabled={false}
        sceneFunc={(context: Konva.Context) => {
          context.save();
          for (const level of levels) {
            const radius = level.radiusPx / viewport.scale;
            const startX = firstGridCoordinateAtOrAfter(bounds.left, level.step, DEFAULT_CANVAS_GRID.origin.x);
            const startY = firstGridCoordinateAtOrAfter(bounds.top, level.step, DEFAULT_CANVAS_GRID.origin.y);

            context.beginPath();
            context.fillStyle = `rgba(${CANVAS_VISUAL_TOKENS.colors.gridDotRgb}, ${level.alpha})`;
            for (let x = startX; x <= bounds.right; x += level.step) {
              for (let y = startY; y <= bounds.bottom; y += level.step) {
                if (
                  level.skipStep &&
                  isGridCoordinate(x, level.skipStep, DEFAULT_CANVAS_GRID.origin.x) &&
                  isGridCoordinate(y, level.skipStep, DEFAULT_CANVAS_GRID.origin.y)
                ) {
                  continue;
                }
                context.moveTo(x - bounds.left + radius, y - bounds.top);
                context.arc(x - bounds.left, y - bounds.top, radius, 0, Math.PI * 2, false);
              }
            }
            context.fill();
          }
          context.restore();
        }}
      />
    </Layer>
  );
}

function AlignmentGuideOverlay({ guides }: { guides: AlignmentGuide[] }) {
  return (
    <>
      {guides.map((guide, index) => {
        const visual = getAlignmentGuideVisualState(guide.kind);

        return (
          <Line
            key={`${guide.axis}-${guide.value}-${index}`}
            points={guide.axis === "x" ? [guide.value, guide.from, guide.value, guide.to] : [guide.from, guide.value, guide.to, guide.value]}
            stroke={visual.stroke}
            strokeWidth={visual.strokeWidth}
            dash={visual.dash}
            lineCap="round"
            listening={false}
          />
        );
      })}
    </>
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
