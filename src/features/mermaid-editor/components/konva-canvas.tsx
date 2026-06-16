"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Ellipse, Group, Layer, Line, Path, Rect, Shape, Stage, Text } from "react-konva";
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
import { resolveWheelNavigation, zoomViewportAtPoint } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import {
  buildEdgeLabelGeometry,
  edgeLabelSingleLineText,
  type EdgeLabelGeometrySpec
} from "@/features/mermaid-editor/lib/edge-label-geometry";
import { computeEdgeDraftPath, computeEdgePath, computeEdgeRetargetPath, type EdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge, CanvasNode, EdgeRouting, EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { flattenShapePoints, flowchartPolygonPoints } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import {
  DEFAULT_NODE_GEOMETRY_TOKENS,
  buildNodeGeometry,
  defaultNodeGeometrySpec,
  nodeIntersectsRect
} from "@/features/mermaid-editor/lib/node-geometry";
import {
  CANVAS_VISUAL_TOKENS,
  type CanvasVisualTokens,
  getAlignmentGuideVisualState,
  getAnchorVisualState,
  getConnectionDraftVisualState,
  getEdgeEndpointVisualState,
  getEdgeVisualState,
  getNodeVisualState,
  getSelectionBoxVisualState
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import { recordPerformanceMetric } from "@/features/mermaid-editor/lib/editor-performance";
import { cn } from "@/lib/utils";

const NODE_TEXT_FONT_SIZE: number = DEFAULT_NODE_GEOMETRY_TOKENS.fontSize;
const NODE_TEXT_LINE_HEIGHT: number = DEFAULT_NODE_GEOMETRY_TOKENS.lineHeight;
const NODE_TEXT_FONT_FAMILY = DEFAULT_NODE_GEOMETRY_TOKENS.fontFamily;
const EDGE_LABEL_MIN_CHARS = 4;
const EDGE_LABEL_MAX_CHARS = 20;
const EDGE_LABEL_PADDING_X = 10;
const EDGE_LABEL_HEIGHT = 28;
const EDGE_LABEL_FONT_SIZE = 13;
const EDGE_LABEL_LINE_HEIGHT = 18;
const POLYGON_CORNER_RADIUS = 6;
const RECT_CORNER_ANCHOR_VISUAL_SCALE = 0.72;
const RECT_CORNER_ANCHOR_VISUAL_OPACITY = 0.65;

let textMeasureCanvas: HTMLCanvasElement | null = null;

type KonvaCanvasProps = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  panningRequested: boolean;
  showGrid: boolean;
  edgeRouting: EdgeRouting;
  visualTokens?: CanvasVisualTokens;
  onGraphDraft: (graph: MermaidGraph, message?: string, options?: { syncSource?: boolean }) => void;
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

type SafariGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

function measureNodeTextWidth(value: string) {
  if (typeof document === "undefined") return value.length * NODE_TEXT_FONT_SIZE * 0.58;

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return value.length * NODE_TEXT_FONT_SIZE * 0.58;

  context.font = `700 ${NODE_TEXT_FONT_SIZE}px ${NODE_TEXT_FONT_FAMILY}`;
  return context.measureText(value).width;
}

function measureEdgeLabelTextWidth(value: string) {
  if (typeof document === "undefined") return value.length * EDGE_LABEL_FONT_SIZE * 0.58;

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return value.length * EDGE_LABEL_FONT_SIZE * 0.58;

  context.font = `400 ${EDGE_LABEL_FONT_SIZE}px ${NODE_TEXT_FONT_FAMILY}`;
  return context.measureText(value).width;
}

function nodeGeometrySpec() {
  return defaultNodeGeometrySpec(measureNodeTextWidth);
}

function edgeLabelGeometrySpec(): EdgeLabelGeometrySpec {
  return {
    minChars: EDGE_LABEL_MIN_CHARS,
    maxChars: EDGE_LABEL_MAX_CHARS,
    paddingX: EDGE_LABEL_PADDING_X,
    height: EDGE_LABEL_HEIGHT,
    measureText: measureEdgeLabelTextWidth
  };
}

function normalizeBox(box: SelectionBox) {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return { x, y, width, height };
}

function edgePointerLength(edge: CanvasEdge) {
  return (edge.arrowType || "arrow") === "arrow" ? CANVAS_VISUAL_TOKENS.edge.pointerLength : 0;
}

function edgePointerWidth(edge: CanvasEdge) {
  return (edge.arrowType || "arrow") === "arrow" ? CANVAS_VISUAL_TOKENS.edge.pointerWidth : 0;
}

function CanvasNodeShape({
  node,
  width,
  height,
  stroke,
  strokeWidth
}: {
  node: CanvasNode;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
}) {
  const fill = node.fill;
  const shape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  const common = { fill, stroke, strokeWidth };
  const polygonPoints = flowchartPolygonPoints(shape, { x: 0, y: 0, width, height });

  if (shape === "text") return null;
  if (shape === "circle" || shape === "sm-circ" || shape === "f-circ") return <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} {...common} />;
  if (shape === "dbl-circ" || shape === "fr-circ" || shape === "cross-circ") return <CircleVariant width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} crossed={shape === "cross-circ"} />;
  if (shape === "fork") return <Rect width={width} height={height} cornerRadius={2} {...common} />;
  if (polygonPoints.length) return <PolygonShape points={flattenShapePoints(polygonPoints)} {...common} />;
  if (shape === "cloud") return <Path data={cloudPath(width, height)} {...common} />;
  if (shape === "cyl") return <CylinderShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined={false} horizontal={false} />;
  if (shape === "lin-cyl") return <CylinderShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined horizontal={false} />;
  if (shape === "h-cyl") return <CylinderShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined={false} horizontal />;
  if (shape === "datastore") return <DataStoreShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} />;
  if (shape === "doc" || shape === "lin-doc" || shape === "tag-doc" || shape === "flag") return <DocumentShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined={shape === "lin-doc"} tagged={shape === "tag-doc"} flag={shape === "flag"} />;
  if (shape === "docs") return <StackedShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} kind="document" />;
  if (shape === "st-rect") return <StackedShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} kind="rect" />;
  if (shape === "lin-rect" || shape === "div-rect" || shape === "win-pane") return <LinedRectShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} mode={shape} />;
  if (shape === "tag-rect") return <TaggedRectShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} />;
  if (shape === "curv-trap") return <Path data={curvedTrapezoidPath(width, height)} {...common} />;
  if (shape === "delay") return <Path data={delayPath(width, height)} {...common} />;
  if (shape === "brace" || shape === "brace-r" || shape === "braces") return <BraceShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} mode={shape} />;
  if (shape === "fr-rect") return <SubroutineShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} />;
  if (shape === "rounded") return <Rect width={width} height={height} cornerRadius={CANVAS_VISUAL_TOKENS.node.cornerRadius} {...common} />;
  if (shape === "stadium") return <Rect width={width} height={height} cornerRadius={height / 2} {...common} />;

  return <Rect width={width} height={height} cornerRadius={4} {...common} />;
}

function PolygonShape({ points, fill, stroke, strokeWidth }: { points: number[]; fill: string; stroke: string; strokeWidth: number }) {
  return <Path data={roundedPolygonPath(points, POLYGON_CORNER_RADIUS)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

function roundedPolygonPath(points: number[], radius: number) {
  const vertices = pointPairs(points);
  if (vertices.length < 3) return "";

  const corners = vertices.map((current, index) => {
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const previousLength = distanceBetween(current, previous);
    const nextLength = distanceBetween(current, next);
    const cornerRadius = Math.min(radius, previousLength / 2, nextLength / 2);

    return {
      current,
      before: moveToward(current, previous, cornerRadius),
      after: moveToward(current, next, cornerRadius)
    };
  });

  const [first, ...rest] = corners;
  const segments = [`M${formatPathPoint(first.before)}`, `Q${formatPathPoint(first.current)} ${formatPathPoint(first.after)}`];

  for (const corner of rest) {
    segments.push(`L${formatPathPoint(corner.before)}`, `Q${formatPathPoint(corner.current)} ${formatPathPoint(corner.after)}`);
  }

  segments.push("Z");
  return segments.join(" ");
}

function pointPairs(points: number[]) {
  const result: { x: number; y: number }[] = [];
  for (let index = 0; index < points.length - 1; index += 2) {
    result.push({ x: points[index], y: points[index + 1] });
  }
  return result;
}

function moveToward(from: { x: number; y: number }, to: { x: number; y: number }, distance: number) {
  const length = distanceBetween(from, to);
  if (length === 0) return from;

  return {
    x: from.x + ((to.x - from.x) / length) * distance,
    y: from.y + ((to.y - from.y) / length) * distance
  };
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function formatPathPoint(point: { x: number; y: number }) {
  return `${roundPathNumber(point.x)},${roundPathNumber(point.y)}`;
}

function roundPathNumber(value: number) {
  return Number(value.toFixed(3));
}

function CircleVariant({
  width,
  height,
  stroke,
  strokeWidth,
  fill,
  crossed
}: {
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  crossed?: boolean;
}) {
  const inset = Math.min(width, height) * 0.12;
  return (
    <>
      <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <Ellipse x={width / 2} y={height / 2} radiusX={Math.max(1, width / 2 - inset)} radiusY={Math.max(1, height / 2 - inset)} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
      {crossed ? (
        <>
          <Line points={[width * 0.25, height * 0.25, width * 0.75, height * 0.75]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
          <Line points={[width * 0.75, height * 0.25, width * 0.25, height * 0.75]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
        </>
      ) : null}
    </>
  );
}

function SubroutineShape({ width, height, stroke, strokeWidth, fill }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string }) {
  const inset = Math.min(18, Math.max(10, width * 0.12));
  return (
    <>
      <Rect width={width} height={height} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <Line points={[inset, 0, inset, height]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
      <Line points={[width - inset, 0, width - inset, height]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
    </>
  );
}

function CylinderShape({
  width,
  height,
  stroke,
  strokeWidth,
  fill,
  lined,
  horizontal
}: {
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  lined: boolean;
  horizontal: boolean;
}) {
  const cap = Math.min(horizontal ? width * 0.22 : height * 0.22, 22);
  if (horizontal) {
    return (
      <>
        <Path data={`M${cap},0 L${width - cap},0 C${width},0 ${width},${height} ${width - cap},${height} L${cap},${height} C0,${height} 0,0 ${cap},0 Z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        <Path data={`M${cap},0 C${cap * 2},0 ${cap * 2},${height} ${cap},${height}`} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
        <Path data={`M${width - cap},0 C${width - cap * 2},0 ${width - cap * 2},${height} ${width - cap},${height}`} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
      </>
    );
  }

  return (
    <>
      <Path data={`M0,${cap} C0,0 ${width},0 ${width},${cap} L${width},${height - cap} C${width},${height} 0,${height} 0,${height - cap} Z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <Path data={`M0,${cap} C0,${cap * 2} ${width},${cap * 2} ${width},${cap}`} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
      {lined ? <Path data={`M0,${height - cap} C0,${height - cap * 2} ${width},${height - cap * 2} ${width},${height - cap}`} stroke={stroke} strokeWidth={strokeWidth} listening={false} /> : null}
    </>
  );
}

function DataStoreShape({ width, height, stroke, strokeWidth, fill }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string }) {
  return (
    <>
      <Rect width={width} height={height} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <Line points={[0, height * 0.22, width, height * 0.22]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
      <Line points={[0, height * 0.78, width, height * 0.78]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
    </>
  );
}

function DocumentShape({
  width,
  height,
  stroke,
  strokeWidth,
  fill,
  lined,
  tagged,
  flag
}: {
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  lined?: boolean;
  tagged?: boolean;
  flag?: boolean;
}) {
  const wave = Math.min(14, height * 0.18);
  const tag = Math.min(18, width * 0.18);
  const path = flag
    ? `M0,0 L${width},0 L${width * 0.82},${height * 0.5} L${width},${height} L0,${height} Q${width * 0.18},${height - wave} ${width * 0.36},${height} Q${width * 0.54},${height + wave * 0.35} ${width * 0.72},${height} Q${width * 0.86},${height - wave * 0.25} ${width},${height} L${width},0 Z`
    : `M0,0 L${width},0 L${width},${height - wave} Q${width * 0.75},${height + wave} ${width * 0.5},${height - wave * 0.2} Q${width * 0.25},${height - wave * 1.4} 0,${height - wave * 0.2} Z`;
  return (
    <>
      <Path data={path} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {lined ? (
        <>
          <Line points={[width * 0.18, height * 0.28, width * 0.82, height * 0.28]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
          <Line points={[width * 0.18, height * 0.44, width * 0.72, height * 0.44]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
        </>
      ) : null}
      {tagged ? <PolygonShape points={[width - tag, 0, width, 0, width, tag]} fill={fill} stroke={stroke} strokeWidth={strokeWidth} /> : null}
    </>
  );
}

function StackedShape({ width, height, stroke, strokeWidth, fill, kind }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; kind: "rect" | "document" }) {
  const offset = 7;
  return (
    <>
      <Rect x={offset * 2} y={0} width={width - offset * 2} height={height - offset * 2} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.7} />
      <Rect x={offset} y={offset} width={width - offset * 2} height={height - offset * 2} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.85} />
      {kind === "document" ? (
        <DocumentShape width={width - offset * 2} height={height - offset * 2} stroke={stroke} strokeWidth={strokeWidth} fill={fill} />
      ) : (
        <Rect y={offset * 2} width={width - offset * 2} height={height - offset * 2} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
    </>
  );
}

function LinedRectShape({ width, height, stroke, strokeWidth, fill, mode }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; mode: "lin-rect" | "div-rect" | "win-pane" }) {
  return (
    <>
      <Rect width={width} height={height} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {mode === "lin-rect" ? <Line points={[0, height * 0.28, width, height * 0.28]} stroke={stroke} strokeWidth={strokeWidth} listening={false} /> : null}
      {mode === "div-rect" ? <Line points={[0, height * 0.5, width, height * 0.5]} stroke={stroke} strokeWidth={strokeWidth} listening={false} /> : null}
      {mode === "win-pane" ? (
        <>
          <Line points={[width * 0.32, 0, width * 0.32, height]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
          <Line points={[0, height * 0.34, width, height * 0.34]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
        </>
      ) : null}
    </>
  );
}

function TaggedRectShape({ width, height, stroke, strokeWidth, fill }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string }) {
  const tag = Math.min(18, width * 0.18);
  return (
    <>
      <Rect width={width} height={height} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <Line points={[width - tag, 0, width - tag, tag, width, tag]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
    </>
  );
}

function BraceShape({ width, height, stroke, strokeWidth, fill, mode }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; mode: "brace" | "brace-r" | "braces" }) {
  const left = `M${width * 0.32},0 C${width * 0.08},0 ${width * 0.18},${height * 0.35} ${width * 0.02},${height * 0.5} C${width * 0.18},${height * 0.65} ${width * 0.08},${height} ${width * 0.32},${height}`;
  const right = `M${width * 0.68},0 C${width * 0.92},0 ${width * 0.82},${height * 0.35} ${width * 0.98},${height * 0.5} C${width * 0.82},${height * 0.65} ${width * 0.92},${height} ${width * 0.68},${height}`;
  return (
    <>
      <Rect width={width} height={height} cornerRadius={4} fill={fill} opacity={0.28} listening={false} />
      {mode !== "brace-r" ? <Path data={left} stroke={stroke} strokeWidth={strokeWidth} /> : null}
      {mode !== "brace" ? <Path data={right} stroke={stroke} strokeWidth={strokeWidth} /> : null}
    </>
  );
}

function cloudPath(width: number, height: number) {
  return `M${width * 0.26},${height * 0.78} C${width * 0.1},${height * 0.78} 0,${height * 0.62} ${width * 0.08},${height * 0.46} C${width * 0.02},${height * 0.26} ${width * 0.24},${height * 0.14} ${width * 0.38},${height * 0.24} C${width * 0.48},${height * 0.02} ${width * 0.78},${height * 0.08} ${width * 0.8},${height * 0.34} C${width},${height * 0.36} ${width * 0.98},${height * 0.72} ${width * 0.78},${height * 0.78} Z`;
}

function curvedTrapezoidPath(width: number, height: number) {
  return `M${width * 0.12},0 C${width * 0.3},${height * 0.08} ${width * 0.7},${height * 0.08} ${width * 0.88},0 L${width},${height} C${width * 0.7},${height * 0.9} ${width * 0.3},${height * 0.9} 0,${height} Z`;
}

function delayPath(width: number, height: number) {
  return `M0,0 L${width - height / 2},0 C${width},0 ${width},${height} ${width - height / 2},${height} L0,${height} Z`;
}

function EdgeEndMarker({
  edge,
  geometry,
  stroke,
  strokeWidth,
  surfaceFill
}: {
  edge: CanvasEdge;
  geometry: EdgePathGeometry;
  stroke: string;
  strokeWidth: number;
  surfaceFill: string;
}) {
  const arrowType = edge.arrowType || "arrow";
  if (arrowType === "arrow" || arrowType === "none") return null;

  if (arrowType === "circle") {
    return <Circle x={geometry.end.x} y={geometry.end.y} radius={4.5} fill={surfaceFill} stroke={stroke} strokeWidth={strokeWidth} listening={false} />;
  }

  const size = 5.5;
  return (
    <Group x={geometry.end.x} y={geometry.end.y} listening={false}>
      <Line points={[-size, -size, size, size]} stroke={stroke} strokeWidth={strokeWidth} lineCap="round" />
      <Line points={[-size, size, size, -size]} stroke={stroke} strokeWidth={strokeWidth} lineCap="round" />
    </Group>
  );
}

export function KonvaCanvas({
  graph,
  selection,
  viewport,
  mode,
  panningRequested,
  showGrid,
  edgeRouting,
  visualTokens = CANVAS_VISUAL_TOKENS,
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
  const dragDraftGraphRef = useRef<MermaidGraph | null>(null);
  const blankClickIntentRef = useRef<BlankClickIntent | null>(null);
  const gestureNavigationRef = useRef<{ viewport: ViewportState; pointer: CanvasPoint } | null>(null);
  const pendingViewportRef = useRef<ViewportState | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  const visualViewportRef = useRef(viewport);
  const viewportCommitTimerRef = useRef<number | null>(null);
  const viewportCommitRef = useRef<ViewportState | null>(null);
  const viewportRef = useRef(viewport);
  const viewportRafRef = useRef<number | null>(null);
  const suppressWheelZoomUntilRef = useRef(0);
  const interactionGenerationRef = useRef(0);
  const selectionVersionRef = useRef(0);
  const lastSelectionKeyRef = useRef(selectionVersionKey(selection));
  const dimensions = useContainerSize(containerRef);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [interactionState, setInteractionState] = useState<InteractionState>(idleInteraction);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const [hoveredHitTarget, setHoveredHitTarget] = useState<HitTarget>({ kind: "blank" });
  const [nodeEditorLayout, setNodeEditorLayout] = useState({ insetTop: 0, height: NODE_TEXT_LINE_HEIGHT, scrollable: false });
  const nodeEditorRef = useRef<HTMLTextAreaElement>(null);
  const nodeEditorMeasureRef = useRef<HTMLDivElement>(null);

  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const geometrySpec = useMemo(() => nodeGeometrySpec(), []);
  const edgeLabelSpec = useMemo(() => edgeLabelGeometrySpec(), []);
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
  const selectedSingleEdgeBaseGeometry = selectedSingleEdge ? computeEdgePath(selectedSingleEdge, routedNodeRects, edgeRouting) : null;
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
  const retargetDraft = interactionState.kind === "retargetingEdge" ? interactionState : null;
  const connectionPreview = useMemo(
    () =>
      connectionDraft
        ? resolveConnectionPreview({
            fromNodeId: connectionDraft.fromNodeId,
            currentWorld: connectionDraft.currentWorld,
            nodes: renderedNodeGeometries
          })
        : null,
    [connectionDraft, renderedNodeGeometries]
  );
  const connectionDraftGeometry = useMemo(() => {
    if (!connectionDraft || !connectionPreview) return null;

    const sourceRect = routedNodeRects.find((rect) => rect.id === connectionDraft.fromNodeId);
    if (!sourceRect) return null;

    return computeEdgeDraftPath(sourceRect, connectionPreview.geometryTarget, edgeRouting);
  }, [connectionDraft, connectionPreview, edgeRouting, routedNodeRects]);
  const retargetPreview = useMemo(() => {
    if (!retargetDraft) return null;

    const edge = graph.edges.find((item) => item.id === retargetDraft.edgeId);
    if (!edge) return null;

    return resolveRetargetPreview({
      edge,
      side: retargetDraft.side,
      currentWorld: retargetDraft.currentWorld,
      nodes: renderedNodeGeometries
    });
  }, [graph.edges, renderedNodeGeometries, retargetDraft]);
  const retargetDraftGeometry = useMemo(() => {
    if (!retargetDraft || !retargetPreview) return null;

    const edge = graph.edges.find((item) => item.id === retargetDraft.edgeId);
    if (!edge) return null;

    return computeEdgeRetargetPath(edge, routedNodeRects, retargetDraft.side, retargetPreview.geometryTarget, edgeRouting);
  }, [edgeRouting, graph.edges, retargetDraft, retargetPreview, routedNodeRects]);
  const selectedSingleEdgeGeometry =
    retargetDraft?.edgeId === selectedSingleEdge?.id && retargetDraftGeometry ? retargetDraftGeometry : selectedSingleEdgeBaseGeometry;
  const connectionTargetNodeId = connectionPreview?.targetNodeId ?? retargetPreview?.targetNodeId ?? null;
  const connectionInvalidNodeId = connectionPreview?.invalidNodeId ?? retargetPreview?.invalidNodeId ?? null;

  const currentViewport = useCallback(() => pendingViewportRef.current || visualViewportRef.current, []);

  const applyViewportToStage = useCallback((nextViewport: ViewportState) => {
    const stage = stageRef.current;
    visualViewportRef.current = nextViewport;
    viewportRef.current = nextViewport;

    if (!stage) return;
    stage.position({ x: nextViewport.x, y: nextViewport.y });
    stage.scale({ x: nextViewport.scale, y: nextViewport.scale });
    stage.batchDraw();
  }, []);

  const queueViewportCommit = useCallback((nextViewport: ViewportState) => {
    viewportCommitRef.current = nextViewport;
    if (viewportCommitTimerRef.current) window.clearTimeout(viewportCommitTimerRef.current);

    viewportCommitTimerRef.current = window.setTimeout(() => {
      const viewportToCommit = viewportCommitRef.current;
      viewportCommitRef.current = null;
      viewportCommitTimerRef.current = null;
      if (viewportToCommit) onViewportChangeRef.current(viewportToCommit);
    }, 80);
  }, []);

  const scheduleViewportChange = useCallback(
    (nextViewport: ViewportState) => {
      pendingViewportRef.current = nextViewport;
      viewportRef.current = nextViewport;
      queueViewportCommit(nextViewport);

      if (viewportRafRef.current !== null) return;
      const scheduledAt = performance.now();
      viewportRafRef.current = window.requestAnimationFrame(() => {
        viewportRafRef.current = null;
        const pending = pendingViewportRef.current;
        pendingViewportRef.current = null;
        if (pending) {
          applyViewportToStage(pending);
          recordPerformanceMetric("canvas-viewport-visual-latency", performance.now() - scheduledAt);
        }
      });
    },
    [applyViewportToStage, queueViewportCommit]
  );

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
    viewportRef.current = viewport;
    visualViewportRef.current = viewport;
  }, [viewport]);

  useLayoutEffect(() => {
    applyViewportToStage(viewport);
  }, [applyViewportToStage, dimensions.height, dimensions.width, viewport]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    return () => {
      if (viewportRafRef.current !== null) window.cancelAnimationFrame(viewportRafRef.current);
      if (viewportCommitTimerRef.current) window.clearTimeout(viewportCommitTimerRef.current);
    };
  }, []);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function gesturePoint(event: SafariGestureEvent) {
      return screenPointFromClient(event.clientX, event.clientY) || { x: dimensions.width / 2, y: dimensions.height / 2 };
    }

    function onGestureStart(event: SafariGestureEvent) {
      event.preventDefault();
      suppressWheelZoomUntilRef.current = Date.now() + 350;

      if (interactionState.kind !== "idle") {
        gestureNavigationRef.current = null;
        return;
      }

      invalidateBlankClickIntent();
      gestureNavigationRef.current = {
        viewport: currentViewport(),
        pointer: gesturePoint(event)
      };
    }

    function onGestureChange(event: SafariGestureEvent) {
      event.preventDefault();
      suppressWheelZoomUntilRef.current = Date.now() + 250;

      const start = gestureNavigationRef.current;
      const scale = typeof event.scale === "number" && Number.isFinite(event.scale) ? event.scale : 1;
      if (!start || scale <= 0) return;

      scheduleViewportChange(zoomViewportAtPoint(start.viewport, start.pointer, start.viewport.scale * scale));
    }

    function onGestureEnd(event: SafariGestureEvent) {
      event.preventDefault();
      gestureNavigationRef.current = null;
      suppressWheelZoomUntilRef.current = Date.now() + 350;
    }

    container.addEventListener("gesturestart", onGestureStart as EventListener, { passive: false });
    container.addEventListener("gesturechange", onGestureChange as EventListener, { passive: false });
    container.addEventListener("gestureend", onGestureEnd as EventListener, { passive: false });

    return () => {
      container.removeEventListener("gesturestart", onGestureStart as EventListener);
      container.removeEventListener("gesturechange", onGestureChange as EventListener);
      container.removeEventListener("gestureend", onGestureEnd as EventListener);
    };
  }, [currentViewport, dimensions.height, dimensions.width, interactionState.kind, scheduleViewportChange]);

  function pointerWorldPoint() {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return null;
    const activeViewport = currentViewport();

    return {
      x: (pointer.x - activeViewport.x) / activeViewport.scale,
      y: (pointer.y - activeViewport.y) / activeViewport.scale
    };
  }

  function worldToScreen(point: { x: number; y: number }) {
    const activeViewport = currentViewport();
    return {
      x: activeViewport.x + point.x * activeViewport.scale,
      y: activeViewport.y + point.y * activeViewport.scale
    };
  }

  function pointerScreenPoint(): CanvasPoint | null {
    return stageRef.current?.getPointerPosition() || null;
  }

  function screenPointFromClient(clientX: number | undefined, clientY: number | undefined): CanvasPoint | null {
    const container = containerRef.current;
    if (!container || typeof clientX !== "number" || typeof clientY !== "number") return null;

    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
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
    setHoveredHitTarget(hit);

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
      const newNode = { id: "", label: "新节点", x: 0, y: 0, fill: visualTokens.colors.surface };
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
      retargetEdge(command.edgeId, command.side, command.point);
      return;
    }

    if (command.type === "resetInteraction") {
      resetInteraction();
    }
  }

  function onWheel(event: KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition() || screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const isZoomWheel = event.evt.ctrlKey || event.evt.metaKey;
    if (isZoomWheel && Date.now() < suppressWheelZoomUntilRef.current) return;

    const result = resolveWheelNavigation({
      viewport: currentViewport(),
      pointer,
      canvasSize: dimensions,
      deltaX: event.evt.deltaX,
      deltaY: event.evt.deltaY,
      deltaMode: event.evt.deltaMode,
      ctrlKey: event.evt.ctrlKey,
      metaKey: event.evt.metaKey,
      shiftKey: event.evt.shiftKey,
      interactionKind: interactionState.kind
    });

    if (result.kind === "ignored") return;

    invalidateBlankClickIntent();
    scheduleViewportChange(result.viewport);
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
      viewport: currentViewport(),
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
      scheduleViewportChange({
        ...currentViewport(),
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
    dragDraftGraphRef.current = null;
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
    const snap = movingBounds ? computeAlignmentSnap(movingBounds, staticRects, currentViewport().scale) : { dx: 0, dy: 0, guides: [] };
    const snappedDeltaX = deltaX + snap.dx;
    const snappedDeltaY = deltaY + snap.dy;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + snappedDeltaX, y: position.y + snappedDeltaY }])
    );
    const draggedPosition = positions[node.id];
    if (draggedPosition) target.position(draggedPosition);
    setAlignmentGuides(snap.guides);
    const nextGraph = setNodePositions(graph, positions);
    dragDraftGraphRef.current = nextGraph;
    onGraphDraft(nextGraph, "正在移动节点。", { syncSource: false });
  }

  function finishConnection(draft: Extract<InteractionState, { kind: "connectingEdge" }>) {
    const point = pointerWorldPoint();
    if (!point) return;

    const preview = resolveConnectionPreview({ fromNodeId: draft.fromNodeId, currentWorld: point, nodes: renderedNodeGeometries });
    if (!preview.valid || !preview.targetNodeId) return;

    const result = createEdge(graph, draft.fromNodeId, preview.targetNodeId);
    onGraphCommit(result.graph, result.selection, "已创建连线。");
  }

  function retargetEdge(edgeId: string, side: "from" | "to", point: CanvasPoint) {
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!edge) return;

    const preview = resolveRetargetPreview({ edge, side, currentWorld: point, nodes: renderedNodeGeometries });
    if (!preview.valid || !preview.targetNodeId) return;

    onGraphCommit(updateEdge(graph, edgeId, { [side]: preview.targetNodeId }), selectOnlyEdge(edgeId), "已重连连线。");
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
        width: geometry.textBox.width * currentViewport().scale,
        height: geometry.textBox.height * currentViewport().scale
      };
    }

    const edge = graph.edges.find((item) => item.id === inlineEdit.id);
    const geometry = edge ? computeEdgePath(edge, routedNodeRects, edgeRouting) : null;
    if (!geometry) return null;
    const labelGeometry = buildEdgeLabelGeometry(inlineEdit.value, geometry.labelPoint, edgeLabelSpec);
    const screen = worldToScreen({ x: labelGeometry.frame.x, y: labelGeometry.frame.y });
    return {
      left: screen.x,
      top: screen.y,
      width: labelGeometry.frame.width * currentViewport().scale,
      height: labelGeometry.frame.height * currentViewport().scale
    };
  }

  const editStyle = inlineEditStyle();
  const activeScale = currentViewport().scale;

  useLayoutEffect(() => {
    if (inlineEdit?.type !== "node" || !editStyle) return;
    const measure = nodeEditorMeasureRef.current;
    if (!measure) return;

    const minimumHeight = NODE_TEXT_LINE_HEIGHT * activeScale;
    const measuredHeight = Math.max(minimumHeight, Math.ceil(measure.scrollHeight));
    const scrollable = measuredHeight > editStyle.height + 1;
    const height = scrollable ? editStyle.height : Math.min(editStyle.height, measuredHeight);
    const insetTop = Math.max(0, Math.floor((editStyle.height - height) / 2));

    setNodeEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [activeScale, editStyle, inlineEdit?.type, inlineEdit?.value]);

  const cursorClassName = interactionCursor(mode, interactionState, panningRequested, hoveredHitTarget);
  const isEndpointHovered = (edgeId: string, side: "from" | "to") =>
    hoveredHitTarget.kind === "edgeEndpoint" && hoveredHitTarget.edgeId === edgeId && hoveredHitTarget.side === side;
  const isEndpointActive = (edgeId: string, side: "from" | "to") => retargetDraft?.edgeId === edgeId && retargetDraft.side === side;

  return (
    <section className="relative h-full min-h-0 bg-card">
      <div
        ref={containerRef}
        className={cn(
          "relative h-full min-h-0 touch-none overflow-hidden overscroll-none bg-background",
          cursorClassName
        )}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onWheel={onWheel}
          onMouseDown={handleCanvasPointerDown}
          onMouseMove={handleCanvasPointerMove}
          onMouseUp={handleCanvasPointerUp}
          onMouseLeave={() => {
            resetInteraction();
            setAlignmentGuides([]);
            setHoveredNodeId(null);
            setHoveredEdgeId(null);
            setHoveredHitTarget({ kind: "blank" });
          }}
        >
          {showGrid ? <CanvasGrid dimensions={dimensions} viewport={viewport} visualTokens={visualTokens} /> : null}

          <Layer>
            {graph.edges.map((edge) => {
              const baseGeometry = computeEdgePath(edge, routedNodeRects, edgeRouting);
              if (!baseGeometry) return null;
              const isRetargetPreviewEdge = retargetDraft?.edgeId === edge.id && !!retargetDraftGeometry && !!retargetPreview;
              const geometry = isRetargetPreviewEdge ? retargetDraftGeometry : baseGeometry;
              const edgeVisual = getEdgeVisualState({ edge, selection, hoveredEdgeId, interactionState, inlineEdit, visualTokens });
              const edgePreviewVisual = isRetargetPreviewEdge ? getConnectionDraftVisualState({ valid: retargetPreview.valid, edge, visualTokens }) : null;
              const isEditingEdgeLabel = inlineEdit?.type === "edge" && inlineEdit.id === edge.id;
              const edgeLabel = isEditingEdgeLabel ? inlineEdit.value : edge.label;
              const edgeLabelGeometry = edgeLabel || isEditingEdgeLabel ? buildEdgeLabelGeometry(edgeLabel, geometry.labelPoint, edgeLabelSpec) : null;

              return (
                <Group key={edge.id}>
                  <Arrow
                    id={edgeHitId(edge.id)}
                    name={CANVAS_HIT_NAMES.edge}
                    points={geometry.points}
                    stroke="transparent"
                    fill="transparent"
                    strokeWidth={visualTokens.edge.hitStrokeWidth}
                    pointerLength={0}
                    pointerWidth={0}
                    onClick={(event) => handleCanvasClick(event, { kind: "edge", id: edge.id })}
                    onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edge", id: edge.id })}
                    onTap={(event) => handleCanvasTap(event, { kind: "edge", id: edge.id })}
                  />
                  <Arrow
                    points={geometry.points}
                    stroke={edgePreviewVisual?.stroke ?? edgeVisual.stroke}
                    fill={edgePreviewVisual?.fill ?? edgeVisual.fill}
                    strokeWidth={edgePreviewVisual?.strokeWidth ?? edgeVisual.strokeWidth}
                    dash={edgePreviewVisual?.dash ?? edgeVisual.dash}
                    opacity={edgePreviewVisual?.opacity ?? 1}
                    lineCap="round"
                    lineJoin="round"
                    pointerLength={edgePreviewVisual?.pointerLength ?? edgePointerLength(edge)}
                    pointerWidth={edgePreviewVisual?.pointerWidth ?? edgePointerWidth(edge)}
                    listening={false}
                  />
                  {!edgePreviewVisual ? <EdgeEndMarker edge={edge} geometry={geometry} stroke={edgeVisual.stroke} strokeWidth={edgeVisual.strokeWidth} surfaceFill={visualTokens.colors.surface} /> : null}
                  {edgeLabelGeometry && !isEditingEdgeLabel ? (
                    <Group
                      id={edgeLabelHitId(edge.id)}
                      name={CANVAS_HIT_NAMES.edgeLabel}
                      x={edgeLabelGeometry.frame.x}
                      y={edgeLabelGeometry.frame.y}
                      onClick={(event) => handleCanvasClick(event, { kind: "edgeLabel", id: edge.id })}
                      onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edgeLabel", id: edge.id })}
                    >
                      <Rect
                        width={edgeLabelGeometry.frame.width}
                        height={edgeLabelGeometry.frame.height}
                        cornerRadius={visualTokens.edge.labelCornerRadius}
                        fill={edgeVisual.labelFill}
                        stroke={edgeVisual.labelStroke}
                        strokeWidth={1}
                      />
                      <Text
                        x={edgeLabelGeometry.textBox.x}
                        y={edgeLabelGeometry.textBox.y}
                        width={edgeLabelGeometry.textBox.width}
                        height={edgeLabelGeometry.textBox.height}
                        align="center"
                        verticalAlign="middle"
                        text={edgeLabelSingleLineText(edgeLabel)}
                        fontSize={EDGE_LABEL_FONT_SIZE}
                        fontFamily={NODE_TEXT_FONT_FAMILY}
                        lineHeight={EDGE_LABEL_LINE_HEIGHT / EDGE_LABEL_FONT_SIZE}
                        wrap="none"
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
              const nodeVisual = getNodeVisualState({
                nodeId: node.id,
                selection,
                hoveredNodeId,
                interactionState,
                connectionTargetNodeId,
                connectionInvalidNodeId,
                inlineEdit,
                visualTokens
              });
              const anchorVisual = getAnchorVisualState({ nodeId: node.id, mode, selection, hoveredNodeId, interactionState, inlineEdit, visualTokens });

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
                    if (dragDraftGraphRef.current) {
                      onGraphDraft(dragDraftGraphRef.current, "已移动节点。", { syncSource: true });
                    }
                    dragRef.current = null;
                    dragDraftGraphRef.current = null;
                    setAlignmentGuides([]);
                    resetInteraction();
                  }}
                  onClick={(event) => handleCanvasClick(event, { kind: "node", id: node.id })}
                  onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "node", id: node.id })}
                >
                  <CanvasNodeShape
                    node={node}
                    width={geometry.frame.width}
                    height={geometry.frame.height}
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
                        <Group
                          id={nodeAnchorHitId(node.id, anchor.key)}
                          name={CANVAS_HIT_NAMES.nodeAnchor}
                          key={`${node.id}-${anchor.key}`}
                          x={anchor.x}
                          y={anchor.y}
                          onMouseDown={(event) => {
                            event.cancelBubble = true;
                            handleCanvasPointerDown(event, { kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key }, {
                              x: geometry.frame.x + anchor.x,
                              y: geometry.frame.y + anchor.y
                            });
                          }}
                        >
                          <Circle radius={anchorVisual.radius} fill="rgba(0,0,0,0.001)" strokeEnabled={false} />
                          <Circle
                            radius={anchor.kind === "corner" ? anchorVisual.radius * RECT_CORNER_ANCHOR_VISUAL_SCALE : anchorVisual.radius}
                            fill={anchorVisual.fill}
                            stroke={anchorVisual.stroke}
                            strokeWidth={anchorVisual.strokeWidth}
                            opacity={anchor.kind === "corner" ? RECT_CORNER_ANCHOR_VISUAL_OPACITY : 1}
                            listening={false}
                          />
                        </Group>
                      ))
                    : null}
                </Group>
              );
            })}

            {connectionDraftGeometry ? (
              <Arrow
                points={connectionDraftGeometry.points}
                {...getConnectionDraftVisualState({ valid: connectionPreview?.valid ?? false, visualTokens })}
                listening={false}
              />
            ) : null}

            {selectionBox ? (
              <Rect
                {...normalizeBox(selectionBox)}
                {...getSelectionBoxVisualState(visualTokens)}
                listening={false}
              />
            ) : null}

            {mode === "select" && selectedSingleEdge && selectedSingleEdgeGeometry ? (
              <>
                <Circle
                  id={edgeEndpointHitId(selectedSingleEdge.id, "from")}
                  name={CANVAS_HIT_NAMES.edgeEndpoint}
                  x={selectedSingleEdgeGeometry.start.x}
                  y={selectedSingleEdgeGeometry.start.y}
                  {...getEdgeEndpointVisualState({
                    hovered: isEndpointHovered(selectedSingleEdge.id, "from"),
                    active: isEndpointActive(selectedSingleEdge.id, "from"),
                    visualTokens
                  })}
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    handleCanvasPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "from" });
                  }}
                />
                <Circle
                  id={edgeEndpointHitId(selectedSingleEdge.id, "to")}
                  name={CANVAS_HIT_NAMES.edgeEndpoint}
                  x={selectedSingleEdgeGeometry.end.x}
                  y={selectedSingleEdgeGeometry.end.y}
                  {...getEdgeEndpointVisualState({
                    hovered: isEndpointHovered(selectedSingleEdge.id, "to"),
                    active: isEndpointActive(selectedSingleEdge.id, "to"),
                    visualTokens
                  })}
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    handleCanvasPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "to" });
                  }}
                />
              </>
            ) : null}

            {alignmentGuides.length ? <AlignmentGuideOverlay guides={alignmentGuides} visualTokens={visualTokens} /> : null}
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
                fontSize: NODE_TEXT_FONT_SIZE * activeScale,
                lineHeight: `${NODE_TEXT_LINE_HEIGHT * activeScale}px`,
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
              className="node-inline-editor absolute z-40 block min-h-0 resize-none overflow-x-hidden rounded-none border-0 bg-transparent p-0 text-center font-bold text-foreground shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{
                left: editStyle.left,
                top: editStyle.top + nodeEditorLayout.insetTop,
                width: editStyle.width,
                height: nodeEditorLayout.height,
                fontFamily: NODE_TEXT_FONT_FAMILY,
                fontSize: NODE_TEXT_FONT_SIZE * activeScale,
                lineHeight: `${NODE_TEXT_LINE_HEIGHT * activeScale}px`,
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
            className="absolute z-40 h-auto min-h-0 rounded-none border bg-card p-0 text-center font-normal text-foreground shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              left: editStyle.left,
              top: editStyle.top,
              width: editStyle.width,
              height: editStyle.height,
              borderRadius: visualTokens.edge.labelCornerRadius * activeScale,
              fontFamily: NODE_TEXT_FONT_FAMILY,
              fontSize: EDGE_LABEL_FONT_SIZE * activeScale,
              lineHeight: `${EDGE_LABEL_LINE_HEIGHT * activeScale}px`,
              paddingLeft: EDGE_LABEL_PADDING_X * activeScale,
              paddingRight: EDGE_LABEL_PADDING_X * activeScale
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

function CanvasGrid({
  dimensions,
  viewport,
  visualTokens
}: {
  dimensions: { width: number; height: number };
  viewport: ViewportState;
  visualTokens: CanvasVisualTokens;
}) {
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
            context.fillStyle = `rgba(${visualTokens.colors.gridDotRgb}, ${level.alpha})`;
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

function AlignmentGuideOverlay({ guides, visualTokens }: { guides: AlignmentGuide[]; visualTokens: CanvasVisualTokens }) {
  return (
    <>
      {guides.map((guide, index) => {
        const visual = getAlignmentGuideVisualState(guide.kind, visualTokens);

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
