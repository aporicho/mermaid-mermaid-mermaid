"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Ellipse, Group, Layer, Line, Path, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  descendantNodeIds,
  descendantSubgraphIds,
  selectOnlyNode,
  selectOnlySubgraph,
  setNodePositions,
  setNodeParent,
  setSubgraphParent
} from "@/features/mermaid-editor/lib/editor-actions";
import { computeAlignmentSnap, selectionBounds, type AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import type { DagreEdgeRoute } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import {
  idleInteraction,
  interactionCursor,
  isEditingInteraction,
  isPanningButton,
  selectionVersionKey,
  type BlankClickIntent,
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
  resolveKonvaHitTarget,
  subgraphAnchorHitId,
  subgraphHitId
} from "@/features/mermaid-editor/lib/canvas-hit-target";
import { DEFAULT_CANVAS_GRID, firstGridCoordinateAtOrAfter, getCanvasGridRenderPlan, isGridCoordinate, type CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import { resolveCanvasRenderScope } from "@/features/mermaid-editor/lib/canvas-render-scope";
import { createWheelIntentTracker } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import {
  buildEdgeLabelGeometry,
  DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS,
  edgeLabelSingleLineText,
  type EdgeLabelGeometrySpec,
  type EdgeLabelGeometryTokens
} from "@/features/mermaid-editor/lib/edge-label-geometry";
import {
  computeEdgeDraftPath,
  computeEdgePath,
  computeEdgeRetargetPath,
  remapEdgePathGeometry,
  type EdgePathGeometry
} from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge, CanvasNode, EdgeRouting, EditorMode, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { flattenShapePoints, flowchartPolygonPoints } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import {
  DEFAULT_NODE_GEOMETRY_TOKENS,
  buildNodeGeometry,
  defaultNodeGeometrySpec,
  nodeIntersectsRect,
  type NodeGeometryTokens
} from "@/features/mermaid-editor/lib/node-geometry";
import {
  SUBGRAPH_GEOMETRY_TOKENS,
  buildSubgraphGeometries,
  subgraphAtPoint,
  subgraphIntersectsRect,
  type SubgraphGeometryTokens,
  type SubgraphGeometry
} from "@/features/mermaid-editor/lib/subgraph-geometry";
import type { EditorThemeGeometryTokens } from "@/features/mermaid-editor/lib/editor-theme";
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
import {
  resolveCanvasPointerClick,
  resolveCanvasPointerDoubleClick,
  resolveCanvasPointerDown,
  resolveCanvasPointerMove,
  resolveCanvasPointerUp,
  type CanvasPointerLocalEffect,
  type CanvasPointerResolution
} from "@/features/mermaid-editor/lib/interaction/canvas-pointer";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { commandFromInteractionIntent } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import {
  createStandardGestureInput,
  createStandardWheelInput,
  modifiersFromEvent,
  normalizeModifiers,
  type InteractionModifiers,
  type StandardPointerInput
} from "@/features/mermaid-editor/lib/interaction/input";
import { resolveInteractionIntent } from "@/features/mermaid-editor/lib/interaction/intent";
import { useViewportScheduler } from "@/features/mermaid-editor/lib/interaction/viewport-scheduler";
import { isEdgeVisible, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { cn } from "@/lib/utils";

let textMeasureCanvas: HTMLCanvasElement | null = null;

type KonvaCanvasProps = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  panningRequested: boolean;
  viewFilters: ViewFilters;
  edgeRouting: EdgeRouting;
  mermaidEdgeRoutes?: DagreEdgeRoute[];
  layoutMode: LayoutMode;
  visualTokens?: CanvasVisualTokens;
  geometryTokens?: EditorThemeGeometryTokens;
  onEditorCommand: (command: EditorCommand) => void;
  onLiveStateChange?: (state: CanvasLiveState) => void;
};

type ViewportCommandSource = Extract<EditorCommand, { type: "viewport.set" }>["source"];

type ScheduledViewport = {
  viewport: ViewportState;
  source: ViewportCommandSource;
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

type CanvasLiveState = {
  canvasSize?: { width: number; height: number };
  editing?: { kind: "node" | "edge"; id: string; draftText: string } | null;
  interaction?: string;
};

type SafariGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

function measureTextWidth(value: string, tokens: { fontSize: number; fontFamily: string; fontWeight: number }) {
  if (typeof document === "undefined") return value.length * tokens.fontSize * 0.58;

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return value.length * tokens.fontSize * 0.58;

  context.font = `${tokens.fontWeight} ${tokens.fontSize}px ${tokens.fontFamily}`;
  return context.measureText(value).width;
}

function measureNodeTextWidth(value: string, tokens: NodeGeometryTokens) {
  return measureTextWidth(value, tokens);
}

function measureEdgeLabelTextWidth(value: string, tokens: EdgeLabelGeometryTokens) {
  return measureTextWidth(value, tokens);
}

function nodeGeometrySpec(tokens: NodeGeometryTokens) {
  return defaultNodeGeometrySpec((value) => measureNodeTextWidth(value, tokens), tokens);
}

function edgeLabelGeometrySpec(tokens: EdgeLabelGeometryTokens): EdgeLabelGeometrySpec {
  return {
    minChars: tokens.minChars,
    maxChars: tokens.maxChars,
    paddingX: tokens.paddingX,
    height: tokens.height,
    measureText: (value) => measureEdgeLabelTextWidth(value, tokens)
  };
}

function normalizeBox(box: SelectionBox) {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return { x, y, width, height };
}

function edgePointerLength(edge: CanvasEdge, visualTokens: CanvasVisualTokens) {
  return (edge.arrowType || "arrow") === "arrow" ? visualTokens.edge.pointerLength : 0;
}

function isEdgeHitTarget(hit: HitTarget) {
  return hit.kind === "edge" || hit.kind === "edgeLabel" || hit.kind === "edgeEndpoint";
}

function edgePointerWidth(edge: CanvasEdge, visualTokens: CanvasVisualTokens) {
  return (edge.arrowType || "arrow") === "arrow" ? visualTokens.edge.pointerWidth : 0;
}

function CanvasNodeShape({
  node,
  width,
  height,
  stroke,
  strokeWidth,
  visualTokens
}: {
  node: CanvasNode;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  visualTokens: CanvasVisualTokens;
}) {
  const fill = node.fill;
  const shape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  const common = { fill, stroke, strokeWidth };
  const polygonPoints = flowchartPolygonPoints(shape, { x: 0, y: 0, width, height });

  if (shape === "text") return null;
  if (shape === "circle" || shape === "sm-circ" || shape === "f-circ") return <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} {...common} />;
  if (shape === "dbl-circ" || shape === "fr-circ" || shape === "cross-circ") return <CircleVariant width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} crossed={shape === "cross-circ"} />;
  if (shape === "fork") return <Rect width={width} height={height} cornerRadius={visualTokens.shape.forkCornerRadius} {...common} />;
  if (polygonPoints.length) return <PolygonShape points={flattenShapePoints(polygonPoints)} radius={visualTokens.shape.polygonCornerRadius} {...common} />;
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
  if (shape === "rounded") return <Rect width={width} height={height} cornerRadius={visualTokens.node.cornerRadius} {...common} />;
  if (shape === "stadium") return <Rect width={width} height={height} cornerRadius={height / 2} {...common} />;

  return <Rect width={width} height={height} cornerRadius={visualTokens.shape.fallbackCornerRadius} {...common} />;
}

function PolygonShape({ points, radius = CANVAS_VISUAL_TOKENS.shape.polygonCornerRadius, fill, stroke, strokeWidth }: { points: number[]; radius?: number; fill: string; stroke: string; strokeWidth: number }) {
  return <Path data={roundedPolygonPath(points, radius)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
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
  surfaceFill,
  visualTokens
}: {
  edge: CanvasEdge;
  geometry: EdgePathGeometry;
  stroke: string;
  strokeWidth: number;
  surfaceFill: string;
  visualTokens: CanvasVisualTokens;
}) {
  const arrowType = edge.arrowType || "arrow";
  if (arrowType === "arrow" || arrowType === "none") return null;

  if (arrowType === "circle") {
    return <Circle x={geometry.end.x} y={geometry.end.y} radius={visualTokens.edge.endpointMarkerRadius} fill={surfaceFill} stroke={stroke} strokeWidth={strokeWidth} listening={false} />;
  }

  const size = visualTokens.edge.endpointMarkerRadius + 1;
  return (
    <Group x={geometry.end.x} y={geometry.end.y} listening={false}>
      <Line points={[-size, -size, size, size]} stroke={stroke} strokeWidth={strokeWidth} lineCap="round" />
      <Line points={[-size, size, size, -size]} stroke={stroke} strokeWidth={strokeWidth} lineCap="round" />
    </Group>
  );
}

function PathArrowMarker({ edge, geometry, fill, visualTokens }: { edge: CanvasEdge; geometry: EdgePathGeometry; fill: string; visualTokens: CanvasVisualTokens }) {
  if ((edge.arrowType || "arrow") !== "arrow") return null;

  return <PathArrowHead geometry={geometry} fill={fill} length={edgePointerLength(edge, visualTokens)} width={edgePointerWidth(edge, visualTokens)} />;
}

function PathArrowHead({ geometry, fill, length, width }: { geometry: EdgePathGeometry; fill: string; length: number; width: number }) {
  if (length <= 0 || width <= 0) return null;

  const rotation = (Math.atan2(geometry.endTangent.y, geometry.endTangent.x) * 180) / Math.PI;

  return (
    <Line
      x={geometry.end.x}
      y={geometry.end.y}
      rotation={rotation}
      points={[0, 0, -length, -width / 2, -length, width / 2]}
      closed
      fill={fill}
      stroke={fill}
      listening={false}
    />
  );
}

export function KonvaCanvas({
  graph,
  selection,
  viewport,
  mode,
  panningRequested,
  viewFilters,
  edgeRouting,
  mermaidEdgeRoutes = [],
  layoutMode,
  visualTokens = CANVAS_VISUAL_TOKENS,
  geometryTokens,
  onEditorCommand,
  onLiveStateChange
}: KonvaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const dragRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const subgraphDragFrameRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const dragDraftGraphRef = useRef<MermaidGraph | null>(null);
  const blankClickIntentRef = useRef<BlankClickIntent | null>(null);
  const gestureNavigationRef = useRef<{ viewport: ViewportState; pointer: CanvasPoint } | null>(null);
  const viewportRef = useRef(viewport);
  const wheelIntentTrackerRef = useRef(createWheelIntentTracker());
  const suppressWheelZoomUntilRef = useRef(0);
  const interactionGenerationRef = useRef(0);
  const selectionVersionRef = useRef(0);
  const lastSelectionKeyRef = useRef(selectionVersionKey(selection));
  const dimensions = useContainerSize(containerRef);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredSubgraphId, setHoveredSubgraphId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [interactionState, setInteractionState] = useState<InteractionState>(idleInteraction);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const [hoveredHitTarget, setHoveredHitTarget] = useState<HitTarget>({ kind: "blank" });
  const nodeThemeTokens = geometryTokens?.node ?? DEFAULT_NODE_GEOMETRY_TOKENS;
  const edgeLabelThemeTokens = geometryTokens?.edgeLabel ?? DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS;
  const subgraphThemeTokens: SubgraphGeometryTokens = geometryTokens?.subgraph ?? SUBGRAPH_GEOMETRY_TOKENS;
  const gridThemeTokens: CanvasGridSpec = geometryTokens?.grid ?? DEFAULT_CANVAS_GRID;
  const [nodeEditorLayout, setNodeEditorLayout] = useState({ insetTop: 0, height: nodeThemeTokens.lineHeight, scrollable: false });
  const nodeEditorRef = useRef<HTMLTextAreaElement>(null);
  const nodeEditorMeasureRef = useRef<HTMLDivElement>(null);

  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const selectedSubgraphIds = useMemo(() => new Set(selection.subgraphIds || []), [selection.subgraphIds]);
  const geometrySpec = useMemo(() => nodeGeometrySpec(nodeThemeTokens), [nodeThemeTokens]);
  const edgeLabelSpec = useMemo(() => edgeLabelGeometrySpec(edgeLabelThemeTokens), [edgeLabelThemeTokens]);
  const renderedNodes = useMemo(
    () =>
      inlineEdit?.type === "node"
        ? graph.nodes.map((node) => (node.id === inlineEdit.id ? { ...node, label: inlineEdit.value } : node))
        : graph.nodes,
    [graph.nodes, inlineEdit]
  );
  const renderedNodeGeometries = useMemo(() => renderedNodes.map((node) => buildNodeGeometry(node, geometrySpec)), [geometrySpec, renderedNodes]);
  const renderedGraph = useMemo(() => ({ ...graph, nodes: renderedNodes }), [graph, renderedNodes]);
  const renderedSubgraphGeometries = useMemo(
    () => buildSubgraphGeometries(renderedGraph, renderedNodeGeometries, subgraphThemeTokens),
    [renderedGraph, renderedNodeGeometries, subgraphThemeTokens]
  );
  const nodeGeometryById = useMemo(() => new Map(renderedNodeGeometries.map((geometry) => [geometry.id, geometry])), [renderedNodeGeometries]);
  const subgraphGeometryById = useMemo(() => new Map(renderedSubgraphGeometries.map((geometry) => [geometry.id, geometry])), [renderedSubgraphGeometries]);
  const routedNodeRects = useMemo(() => renderedNodeGeometries.map((geometry) => geometry.routedRect), [renderedNodeGeometries]);
  const routedEntityRects = useMemo(
    () => [...routedNodeRects, ...renderedSubgraphGeometries.map((geometry) => geometry.routedRect)],
    [renderedSubgraphGeometries, routedNodeRects]
  );
  const dragEnabled = layoutMode === "manual";
  const mermaidRouteByEdgeId = useMemo(() => new Map(mermaidEdgeRoutes.map((route) => [route.edgeId, route])), [mermaidEdgeRoutes]);
  const draftEdgeRouting = edgeRouting;
  function resolvedEdgeGeometry(edge: CanvasEdge) {
    const fallbackGeometry = computeEdgePath(edge, routedEntityRects, draftEdgeRouting);
    const routeGeometry = mermaidRouteByEdgeId.get(edge.id);
    if (!routeGeometry) return fallbackGeometry;
    if (layoutMode === "auto" || !fallbackGeometry) return routeGeometry;

    return remapEdgePathGeometry(routeGeometry, fallbackGeometry);
  }

  const visibleEdges = useMemo(() => graph.edges.filter((edge) => isEdgeVisible(edge, graph, viewFilters)), [graph, viewFilters]);
  const selectedSingleEdge =
    selection.edgeIds.length === 1 ? visibleEdges.find((edge) => edge.id === selection.edgeIds[0]) : undefined;
  const selectedSingleEdgeBaseGeometry = selectedSingleEdge ? resolvedEdgeGeometry(selectedSingleEdge) : null;
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
            fromId: connectionDraft.fromId,
            currentWorld: connectionDraft.currentWorld,
            nodes: renderedNodeGeometries,
            subgraphs: renderedSubgraphGeometries
          })
        : null,
    [connectionDraft, renderedNodeGeometries, renderedSubgraphGeometries]
  );
  const connectionDraftGeometry = useMemo(() => {
    if (!connectionDraft || !connectionPreview) return null;

    const sourceRect = routedEntityRects.find((rect) => rect.id === connectionDraft.fromId);
    if (!sourceRect) return null;

    return computeEdgeDraftPath(sourceRect, connectionPreview.geometryTarget, draftEdgeRouting);
  }, [connectionDraft, connectionPreview, draftEdgeRouting, routedEntityRects]);
  const connectionDraftVisual = useMemo(
    () => getConnectionDraftVisualState({ valid: connectionPreview?.valid ?? false, visualTokens }),
    [connectionPreview?.valid, visualTokens]
  );
  const retargetPreview = useMemo(() => {
    if (!retargetDraft) return null;

    const edge = graph.edges.find((item) => item.id === retargetDraft.edgeId);
    if (!edge) return null;

    return resolveRetargetPreview({
      edge,
      side: retargetDraft.side,
      currentWorld: retargetDraft.currentWorld,
      nodes: renderedNodeGeometries,
      subgraphs: renderedSubgraphGeometries
    });
  }, [graph.edges, renderedNodeGeometries, renderedSubgraphGeometries, retargetDraft]);
  const retargetDraftGeometry = useMemo(() => {
    if (!retargetDraft || !retargetPreview) return null;

    const edge = graph.edges.find((item) => item.id === retargetDraft.edgeId);
    if (!edge) return null;

    return computeEdgeRetargetPath(edge, routedEntityRects, retargetDraft.side, retargetPreview.geometryTarget, draftEdgeRouting);
  }, [draftEdgeRouting, graph.edges, retargetDraft, retargetPreview, routedEntityRects]);
  const selectedSingleEdgeGeometry =
    retargetDraft?.edgeId === selectedSingleEdge?.id && retargetDraftGeometry ? retargetDraftGeometry : selectedSingleEdgeBaseGeometry;
  const connectionTargetNodeId = connectionPreview?.targetNodeId ?? retargetPreview?.targetNodeId ?? null;
  const connectionInvalidNodeId = connectionPreview?.invalidNodeId ?? retargetPreview?.invalidNodeId ?? null;
  const connectionTargetSubgraphId = connectionPreview?.targetSubgraphId ?? retargetPreview?.targetSubgraphId ?? null;
  const connectionInvalidSubgraphId = connectionPreview?.invalidSubgraphId ?? retargetPreview?.invalidSubgraphId ?? null;
  const renderScope = useMemo(
    () =>
      resolveCanvasRenderScope({
        graph,
        viewport,
        canvasSize: dimensions,
        viewFilters,
        nodeBounds: renderedNodeGeometries,
        subgraphBounds: renderedSubgraphGeometries,
        edges: visibleEdges,
        selection,
        hoveredNodeId,
        hoveredSubgraphId,
        hoveredEdgeId,
        inlineEdit,
        interactionState,
        connectionTargetNodeId,
        connectionInvalidNodeId,
        connectionTargetSubgraphId,
        connectionInvalidSubgraphId
      }),
    [
      connectionInvalidNodeId,
      connectionInvalidSubgraphId,
      connectionTargetNodeId,
      connectionTargetSubgraphId,
      dimensions,
      graph,
      hoveredEdgeId,
      hoveredNodeId,
      hoveredSubgraphId,
      inlineEdit,
      interactionState,
      renderedNodeGeometries,
      renderedSubgraphGeometries,
      selection,
      viewFilters,
      viewport,
      visibleEdges
    ]
  );
  const scopedRenderedNodes = useMemo(() => renderedNodes.filter((node) => renderScope.nodeIds.has(node.id)), [renderScope, renderedNodes]);
  const scopedSubgraphGeometries = useMemo(
    () => renderedSubgraphGeometries.filter((geometry) => renderScope.subgraphIds.has(geometry.id)),
    [renderScope, renderedSubgraphGeometries]
  );
  const scopedVisibleEdges = useMemo(() => visibleEdges.filter((edge) => renderScope.edgeIds.has(edge.id)), [renderScope, visibleEdges]);

  const applyViewportToStage = useCallback((update: ScheduledViewport) => {
    const nextViewport = update.viewport;
    const stage = stageRef.current;
    viewportRef.current = nextViewport;

    if (!stage) return;
    stage.position({ x: nextViewport.x, y: nextViewport.y });
    stage.scale({ x: nextViewport.scale, y: nextViewport.scale });
    stage.batchDraw();
  }, []);

  const {
    current: currentScheduledViewport,
    schedule: scheduleScheduledViewport,
    sync: syncScheduledViewport
  } = useViewportScheduler<ScheduledViewport>({
    initialValue: { viewport, source: "api" },
    metricName: "canvas-viewport-visual-latency",
    applyVisual: applyViewportToStage,
    commit: (update) => {
      onEditorCommand({ type: "viewport.set", viewport: update.viewport, source: update.source });
    }
  });

  const currentViewport = useCallback(() => currentScheduledViewport().viewport, [currentScheduledViewport]);

  const scheduleViewportChange = useCallback(
    (nextViewport: ViewportState, source: ViewportCommandSource = "wheel") => {
      viewportRef.current = nextViewport;
      scheduleScheduledViewport({ viewport: nextViewport, source });
    },
    [scheduleScheduledViewport]
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

  useLayoutEffect(() => {
    syncScheduledViewport({ viewport, source: "api" }, { applyVisual: true });
  }, [dimensions.height, dimensions.width, syncScheduledViewport, viewport]);

  useEffect(() => {
    onLiveStateChange?.({
      canvasSize: dimensions,
      editing: inlineEdit ? { kind: inlineEdit.type, id: inlineEdit.id, draftText: inlineEdit.value } : null,
      interaction: interactionState.kind
    });
  }, [dimensions, inlineEdit, interactionState.kind, onLiveStateChange]);

  useEffect(() => {
    if (viewFilters.edges) return;
    setHoveredEdgeId(null);
    setHoveredHitTarget((current) => (isEdgeHitTarget(current) ? { kind: "blank" } : current));
  }, [viewFilters.edges]);

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

      const gestureInput = createStandardGestureInput({
        phase: "change",
        pointer: start.pointer,
        canvasSize: dimensions,
        scale,
        timestamp: event.timeStamp,
        interactionKind: interactionState.kind
      });
      const intent = resolveInteractionIntent(
        gestureInput,
        buildInteractionContext({
          graph,
          selection,
          viewport: start.viewport,
          viewFilters,
          mode,
          workspaceView: "canvas",
          editableKind: "flowchart",
          edgeRouting,
          layoutMode,
          canvasSize: dimensions,
          hitTarget: hoveredHitTarget,
          modifiers: gestureInput.modifiers,
          gestureState: interactionState.kind
        })
      );
      const command = commandFromInteractionIntent(intent);
      if (command?.type === "viewport.set") scheduleViewportChange(command.viewport, command.source);
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
  }, [currentViewport, dimensions, edgeRouting, graph, hoveredHitTarget, interactionState.kind, layoutMode, mode, scheduleViewportChange, selection, viewFilters]);

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
      setHoveredSubgraphId(null);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "nodeAnchor") {
      setHoveredNodeId(hit.nodeId);
      setHoveredSubgraphId(null);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "subgraph") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(hit.id);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "subgraphAnchor") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(hit.subgraphId);
      setHoveredEdgeId(null);
      return;
    }

    if (hit.kind === "edge" || hit.kind === "edgeLabel") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(null);
      setHoveredEdgeId(hit.id);
      return;
    }

    if (hit.kind === "edgeEndpoint") {
      setHoveredNodeId(null);
      setHoveredSubgraphId(null);
      setHoveredEdgeId(hit.edgeId);
      return;
    }

    setHoveredNodeId(null);
    setHoveredSubgraphId(null);
    setHoveredEdgeId(null);
  }

  function applyPointerResolution(resolution: CanvasPointerResolution, options?: { commitState?: boolean }) {
    for (const command of resolution.editorCommands) {
      onEditorCommand(command);
    }
    for (const effect of resolution.localEffects) {
      applyCanvasPointerLocalEffect(effect);
    }
    if (options?.commitState && resolution.state) setInteractionState(resolution.state);
  }

  function applyCanvasPointerLocalEffect(effect: CanvasPointerLocalEffect) {
    if (effect.type === "blankClick.invalidate") {
      invalidateBlankClickIntent();
      return;
    }

    if (effect.type === "blankClick.record") {
      blankClickIntentRef.current = effect.intent;
      return;
    }

    if (effect.type === "graph.resolveAddNodeAt") {
      const newNode = { id: "", label: "新节点", x: 0, y: 0, fill: visualTokens.colors.surface };
      const newNodeFrame = buildNodeGeometry(newNode, geometrySpec).frame;
      const parent = subgraphAtPoint(renderedSubgraphGeometries, effect.point);
      onEditorCommand({
        type: "graph.addNodeAt",
        point: {
          x: effect.point.x - newNodeFrame.width / 2,
          y: effect.point.y - newNodeFrame.height / 2,
          parentId: parent?.id
        },
        source: "pointer"
      });
      return;
    }

    if (effect.type === "inlineEdit.start") {
      if (effect.target.type === "node") {
        const node = graph.nodes.find((item) => item.id === effect.target.id);
        if (!node) return;
        setInteractionState({ kind: "editingNodeText", nodeId: node.id });
        setInlineEdit({ type: "node", id: node.id, value: node.label });
        return;
      }

      const edge = graph.edges.find((item) => item.id === effect.target.id);
      if (!edge) return;
      setInteractionState({ kind: "editingEdgeLabel", edgeId: edge.id });
      setInlineEdit({ type: "edge", id: edge.id, value: edge.label });
      return;
    }

    if (effect.type === "drag.startNode") {
      const node = graph.nodes.find((item) => item.id === effect.nodeId);
      if (node) startNodeDrag(node);
      return;
    }

    if (effect.type === "drag.startSubgraph") {
      const geometry = subgraphGeometryById.get(effect.subgraphId);
      if (geometry) startSubgraphDrag(effect.subgraphId, geometry);
      return;
    }

    if (effect.type === "selection.resolveMarquee") {
      const nodeIds = viewFilters.nodes ? renderedNodeGeometries.filter((geometry) => nodeIntersectsRect(geometry, effect.rect)).map((geometry) => geometry.id) : [];
      const subgraphIds = viewFilters.subgraphs ? renderedSubgraphGeometries.filter((geometry) => subgraphIntersectsRect(geometry, effect.rect)).map((geometry) => geometry.id) : [];
      onEditorCommand({ type: "selection.set", selection: { nodeIds, edgeIds: [], subgraphIds, primaryId: nodeIds[0] || subgraphIds[0] }, source: "pointer" });
      return;
    }

    if (effect.type === "edge.resolveConnection") {
      finishConnection(effect.draft);
      return;
    }

    if (effect.type === "edge.resolveRetarget") {
      retargetEdge(effect.edgeId, effect.side, effect.point);
      return;
    }

    if (effect.type === "interaction.reset") {
      resetInteraction();
    }
  }

  function interactionContextForPointer(hit: HitTarget, modifiers: Partial<InteractionModifiers>) {
    return buildInteractionContext({
      graph,
      selection,
      viewport: currentViewport(),
      viewFilters,
      mode,
      workspaceView: "canvas",
      editableKind: "flowchart",
      edgeRouting,
      layoutMode,
      canvasSize: dimensions,
      hitTarget: hit,
      modifiers,
      gestureState: interactionState.kind,
      editing: inlineEdit ? { kind: inlineEdit.type, id: inlineEdit.id, draftText: inlineEdit.value } : null
    });
  }

  function standardPointerInput(
    phase: StandardPointerInput["phase"],
    event: KonvaEventObject<MouseEvent>,
    hit: HitTarget,
    screen: CanvasPoint,
    world?: CanvasPoint
  ): StandardPointerInput {
    return {
      kind: "pointer",
      entry: "web-ui",
      phase,
      pointerId: 0,
      button: event.evt.button,
      screen,
      world,
      hit,
      modifiers: modifiersFromEvent(event.evt),
      timestamp: event.evt.timeStamp
    };
  }

  function onWheel(event: KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition() || screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const isZoomWheel = !event.evt.shiftKey && Math.abs(event.evt.deltaY) > 0;
    if (isZoomWheel && Date.now() < suppressWheelZoomUntilRef.current) return;

    const wheelInput = createStandardWheelInput({
      pointer,
      canvasSize: dimensions,
      deltaX: event.evt.deltaX,
      deltaY: event.evt.deltaY,
      deltaMode: event.evt.deltaMode,
      modifiers: {
        ctrlKey: event.evt.ctrlKey,
        metaKey: event.evt.metaKey,
        shiftKey: event.evt.shiftKey,
        altKey: event.evt.altKey
      },
      timestamp: event.evt.timeStamp,
      interactionKind: interactionState.kind
    });
    const intent = resolveInteractionIntent(
      wheelInput,
      buildInteractionContext({
        graph,
        selection,
        viewport: currentViewport(),
        viewFilters,
        mode,
        workspaceView: "canvas",
        editableKind: "flowchart",
        edgeRouting,
        layoutMode,
        canvasSize: dimensions,
        hitTarget: hoveredHitTarget,
        modifiers: wheelInput.modifiers,
        gestureState: interactionState.kind
      }),
      { wheelIntentTracker: wheelIntentTrackerRef.current }
    );
    const command = commandFromInteractionIntent(intent);

    if (command?.type !== "viewport.set") return;

    invalidateBlankClickIntent();
    scheduleViewportChange(command.viewport, command.source);
  }

  function handleCanvasPointerDown(event: KonvaEventObject<MouseEvent>, explicitHit?: HitTarget, worldOverride?: CanvasPoint) {
    const pointer = pointerScreenPoint();
    const world = worldOverride ?? pointerWorldPoint();
    if (!pointer || !world) return;

    const hit = explicitHit ?? hitTargetFromEvent(event);
    if (isPanningButton(event.evt.button) || panningRequested) event.evt.preventDefault();

    const pointerInput = standardPointerInput("down", event, hit, pointer, world);
    const result = resolveCanvasPointerDown(
      pointerInput,
      interactionContextForPointer(hit, pointerInput.modifiers),
      {
        state: interactionState,
        selectionVersion: selectionVersionRef.current,
        panningRequested,
        dragEnabled
      }
    );

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerMove(event: KonvaEventObject<MouseEvent>) {
    const hit = hitTargetFromEvent(event);
    updateHoverFromHit(hit);

    const pointer = pointerScreenPoint();
    const world = pointerWorldPoint();
    if (!pointer || !world) return;

    if (interactionState.kind === "panning") {
      scheduleViewportChange(
        {
          ...currentViewport(),
          x: interactionState.originViewport.x + pointer.x - interactionState.startScreen.x,
          y: interactionState.originViewport.y + pointer.y - interactionState.startScreen.y
        },
        "pointer"
      );
      return;
    }

    const pointerInput = standardPointerInput("move", event, hit, pointer, world);
    const result = resolveCanvasPointerMove(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers), {
      state: interactionState,
      selectionVersion: selectionVersionRef.current
    });

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasPointerUp(event: KonvaEventObject<MouseEvent>) {
    const pointer = pointerScreenPoint();
    const world = pointerWorldPoint();
    if (!pointer || !world) {
      resetInteraction();
      return;
    }

    const hit = hitTargetFromEvent(event);
    const pointerInput = standardPointerInput("up", event, hit, pointer, world);
    const result = resolveCanvasPointerUp(
      pointerInput,
      interactionContextForPointer(hit, pointerInput.modifiers),
      {
        state: interactionState,
        selectionVersion: selectionVersionRef.current,
        previousBlankClick: blankClickIntentRef.current,
        interactionGeneration: interactionGenerationRef.current,
        now: performance.now()
      }
    );

    applyPointerResolution(result, { commitState: true });
  }

  function handleCanvasClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    const pointer = pointerScreenPoint() || screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const pointerInput = standardPointerInput("click", event, hit, pointer, pointerWorldPoint() || undefined);
    applyPointerResolution(resolveCanvasPointerClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasTap(event: KonvaEventObject<Event>, hit: HitTarget) {
    event.cancelBubble = true;
    const pointer = pointerScreenPoint();
    if (!pointer) return;
    const pointerInput: StandardPointerInput = {
      kind: "pointer",
      entry: "web-ui",
      phase: "tap",
      pointerId: 0,
      button: 0,
      screen: pointer,
      world: pointerWorldPoint() || undefined,
      hit,
      modifiers: normalizeModifiers(undefined),
      timestamp: event.evt.timeStamp
    };

    applyPointerResolution(resolveCanvasPointerClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function handleCanvasDoubleClick(event: KonvaEventObject<MouseEvent>, hit: HitTarget) {
    event.cancelBubble = true;
    const pointer = pointerScreenPoint() || screenPointFromClient(event.evt.clientX, event.evt.clientY);
    if (!pointer) return;

    const pointerInput = standardPointerInput("double-click", event, hit, pointer, pointerWorldPoint() || undefined);
    applyPointerResolution(resolveCanvasPointerDoubleClick(pointerInput, interactionContextForPointer(hit, pointerInput.modifiers)));
  }

  function startNodeDrag(node: CanvasNode) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const ids = selectedNodeIds.has(node.id) ? selection.nodeIds : [node.id];
    const screen = pointerScreenPoint() || { x: 0, y: 0 };
    const world = pointerWorldPoint() || { x: node.x, y: node.y };
    if (!selectedNodeIds.has(node.id)) onEditorCommand({ type: "selection.set", selection: selectOnlyNode(node.id), source: "pointer" });
    invalidateBlankClickIntent();
    setAlignmentGuides([]);
    setInteractionState({ kind: "draggingNodes", pointerId: 0, nodeId: node.id, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => ids.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    dragDraftGraphRef.current = null;
    onEditorCommand({ type: "history.capture", source: "pointer" });
  }

  function startSubgraphDrag(subgraphId: string, geometry: SubgraphGeometry) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const ids = selectedSubgraphIds.has(subgraphId) ? selection.subgraphIds || [] : [subgraphId];
    const nodeIds = unique(ids.flatMap((id) => descendantNodeIds(graph, id)));
    if (!nodeIds.length) return;
    const screen = pointerScreenPoint() || { x: 0, y: 0 };
    const world = pointerWorldPoint() || { x: geometry.frame.x, y: geometry.frame.y };
    if (!selectedSubgraphIds.has(subgraphId)) onEditorCommand({ type: "selection.set", selection: selectOnlySubgraph(subgraphId), source: "pointer" });
    invalidateBlankClickIntent();
    setAlignmentGuides([]);
    setInteractionState({ kind: "draggingSubgraphs", pointerId: 0, subgraphId, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => nodeIds.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    subgraphDragFrameRef.current = Object.fromEntries(
      ids.map((id) => {
        const item = subgraphGeometryById.get(id);
        return [id, item ? { x: item.frame.x, y: item.frame.y } : { x: geometry.frame.x, y: geometry.frame.y }];
      })
    );
    dragDraftGraphRef.current = null;
    onEditorCommand({ type: "history.capture", source: "pointer" });
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
    onEditorCommand({ type: "graph.draftNodePositions", positions, message: "正在移动节点。", syncSource: false, source: "pointer" });
  }

  function moveSelectedSubgraphs(subgraphId: string, target: Konva.Node) {
    if (!dragRef.current || !subgraphDragFrameRef.current) return;
    const origin = subgraphDragFrameRef.current[subgraphId];
    if (!origin) return;
    const deltaX = target.x() - origin.x;
    const deltaY = target.y() - origin.y;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + deltaX, y: position.y + deltaY }])
    );
    const draggedFrame = subgraphDragFrameRef.current[subgraphId];
    if (draggedFrame) target.position({ x: draggedFrame.x + deltaX, y: draggedFrame.y + deltaY });
    const nextGraph = setNodePositions(graph, positions);
    dragDraftGraphRef.current = nextGraph;
    onEditorCommand({ type: "graph.draftNodePositions", positions, message: "正在移动组。", syncSource: false, source: "pointer" });
  }

  function finishDragWithMembership() {
    if (!dragDraftGraphRef.current) return;
    const movingNodeIds = Object.keys(dragRef.current || {});
    let nextGraph = dragDraftGraphRef.current;
    const ignoredSubgraphIds =
      interactionState.kind === "draggingSubgraphs" ? [interactionState.subgraphId, ...descendantSubgraphIds(graph, interactionState.subgraphId)] : [];

    for (const nodeId of movingNodeIds) {
      const node = nextGraph.nodes.find((item) => item.id === nodeId);
      if (!node) continue;
      const geometry = buildNodeGeometry(node, geometrySpec);
      const center = {
        x: geometry.frame.x + geometry.frame.width / 2,
        y: geometry.frame.y + geometry.frame.height / 2
      };
      const targetSubgraph = subgraphAtPoint(renderedSubgraphGeometries, center, ignoredSubgraphIds);
      nextGraph = setNodeParent(nextGraph, nodeId, targetSubgraph?.id);
    }

    if (interactionState.kind === "draggingSubgraphs") {
      const movingSubgraphIds = selectedSubgraphIds.has(interactionState.subgraphId) ? selection.subgraphIds || [] : [interactionState.subgraphId];
      const nextNodeGeometries = nextGraph.nodes.map((node) => buildNodeGeometry(node, geometrySpec));
      const nextSubgraphGeometries = buildSubgraphGeometries(nextGraph, nextNodeGeometries, subgraphThemeTokens);

      for (const subgraphId of movingSubgraphIds) {
        const geometry = nextSubgraphGeometries.find((item) => item.id === subgraphId);
        if (!geometry) continue;
        const center = {
          x: geometry.frame.x + geometry.frame.width / 2,
          y: geometry.frame.y + geometry.frame.height / 2
        };
        const ignored = [subgraphId, ...descendantSubgraphIds(nextGraph, subgraphId)];
        const targetSubgraph = subgraphAtPoint(renderedSubgraphGeometries, center, ignored);
        nextGraph = setSubgraphParent(nextGraph, subgraphId, targetSubgraph?.id);
      }
    }

    onEditorCommand({ type: "graph.commitDragMembership", graph: nextGraph, message: "已移动并更新组成员。", source: "pointer" });
  }

  function finishConnection(draft: Extract<InteractionState, { kind: "connectingEdge" }>) {
    const point = pointerWorldPoint();
    if (!point) return;

    const preview = resolveConnectionPreview({ fromId: draft.fromId, currentWorld: point, nodes: renderedNodeGeometries, subgraphs: renderedSubgraphGeometries });
    if (!preview.valid || !preview.targetId) return;

    onEditorCommand({ type: "graph.createEdge", fromId: draft.fromId, toId: preview.targetId, message: "已创建连线。", source: "pointer" });
  }

  function retargetEdge(edgeId: string, side: "from" | "to", point: CanvasPoint) {
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!edge) return;

    const preview = resolveRetargetPreview({ edge, side, currentWorld: point, nodes: renderedNodeGeometries, subgraphs: renderedSubgraphGeometries });
    if (!preview.valid || !preview.targetId) return;

    onEditorCommand({ type: "graph.retargetEdge", edgeId, side, targetId: preview.targetId, message: "已重连连线。", source: "pointer" });
  }

  function commitInlineEdit(save: boolean) {
    if (!inlineEdit) return;

    if (save && inlineEdit.type === "node") {
      onEditorCommand({ type: "graph.updateNodeLabel", nodeId: inlineEdit.id, label: inlineEdit.value, message: "已更新节点文本。", source: "pointer" });
    }
    if (save && inlineEdit.type === "edge") {
      onEditorCommand({ type: "graph.updateEdgeLabel", edgeId: inlineEdit.id, label: inlineEdit.value, message: "已更新连线文本。", source: "pointer" });
    }
    setInlineEdit(null);
    resetInteraction();
  }

  function inlineEditStyle() {
    if (!inlineEdit) return null;
    if (inlineEdit.type === "node") {
      if (!viewFilters.nodes || !viewFilters.nodeLabels) return null;
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
    if (!edge || !viewFilters.edgeLabels || !isEdgeVisible(edge, graph, viewFilters)) return null;
    const geometry = resolvedEdgeGeometry(edge);
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

    const minimumHeight = nodeThemeTokens.lineHeight * activeScale;
    const measuredHeight = Math.max(minimumHeight, Math.ceil(measure.scrollHeight));
    const scrollable = measuredHeight > editStyle.height + 1;
    const height = scrollable ? editStyle.height : Math.min(editStyle.height, measuredHeight);
    const insetTop = Math.max(0, Math.floor((editStyle.height - height) / 2));

    setNodeEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [activeScale, editStyle, inlineEdit?.type, inlineEdit?.value, nodeThemeTokens.lineHeight]);

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
            setHoveredSubgraphId(null);
            setHoveredEdgeId(null);
            setHoveredHitTarget({ kind: "blank" });
          }}
        >
          {viewFilters.grid ? <CanvasGrid dimensions={dimensions} viewport={viewport} visualTokens={visualTokens} gridSpec={gridThemeTokens} /> : null}

          <Layer>
            {viewFilters.subgraphs
              ? [...scopedSubgraphGeometries]
              .sort((a, b) => a.depth - b.depth)
              .map((geometry) => {
                const subgraph = graph.subgraphs?.find((item) => item.id === geometry.id);
                if (!subgraph) return null;
                const selected = selectedSubgraphIds.has(geometry.id);
                const hovered = hoveredSubgraphId === geometry.id;
                const connectionTarget = connectionTargetSubgraphId === geometry.id;
                const connectionInvalid = connectionInvalidSubgraphId === geometry.id;
                const stroke = connectionInvalid
                  ? visualTokens.colors.connectionInvalid
                  : connectionTarget || selected
                    ? visualTokens.colors.accent
                    : hovered
                      ? visualTokens.colors.accentHover
                      : visualTokens.colors.labelStroke;
                const anchorVisible =
                  mode === "select" &&
                  !inlineEdit &&
                  (selected || hovered) &&
                  interactionState.kind !== "panning" &&
                  interactionState.kind !== "draggingNodes" &&
                  interactionState.kind !== "draggingSubgraphs";

                return (
                  <Group
                    id={subgraphHitId(geometry.id)}
                    name={CANVAS_HIT_NAMES.subgraph}
                    key={geometry.id}
                    x={geometry.frame.x}
                    y={geometry.frame.y}
                    draggable={dragEnabled && mode === "select" && !panningRequested && interactionState.kind !== "panning"}
                    onDragStart={(event) => {
                      if (event.evt.button !== 0) {
                        event.target.stopDrag();
                        return;
                      }
                      applyCanvasPointerLocalEffect({ type: "drag.startSubgraph", subgraphId: geometry.id });
                    }}
                    onDragMove={(event) => moveSelectedSubgraphs(geometry.id, event.target)}
                    onDragEnd={() => {
                      if (dragDraftGraphRef.current) finishDragWithMembership();
                      dragRef.current = null;
                      subgraphDragFrameRef.current = null;
                      dragDraftGraphRef.current = null;
                      setAlignmentGuides([]);
                      resetInteraction();
                    }}
                    onClick={(event) => handleCanvasClick(event, { kind: "subgraph", id: geometry.id })}
                    onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "subgraph", id: geometry.id })}
                  >
                    <Rect
                      width={geometry.frame.width}
                      height={geometry.frame.height}
                      cornerRadius={visualTokens.node.cornerRadius}
                      fill={visualTokens.colors.surface}
                      opacity={visualTokens.subgraph.fillOpacity}
                      listening={false}
                    />
                    <Rect
                      width={geometry.frame.width}
                      height={geometry.frame.height}
                      cornerRadius={visualTokens.node.cornerRadius}
                      stroke={stroke}
                      strokeWidth={selected || connectionTarget || connectionInvalid ? visualTokens.node.emphasizedStrokeWidth : visualTokens.node.strokeWidth}
                      dash={[...visualTokens.overlay.subgraphDash]}
                      fillEnabled={false}
                    />
                    <Rect
                      x={geometry.titleBox.x - geometry.frame.x}
                      y={geometry.titleBox.y - geometry.frame.y}
                      width={geometry.titleBox.width}
                      height={geometry.titleBox.height}
                      cornerRadius={visualTokens.subgraph.titleCornerRadius}
                      fill={visualTokens.colors.surface}
                      stroke={stroke}
                      strokeWidth={visualTokens.subgraph.titleStrokeWidth}
                    />
                    <Text
                      x={geometry.titleBox.x - geometry.frame.x + visualTokens.subgraph.titleInsetX}
                      y={geometry.titleBox.y - geometry.frame.y}
                      width={Math.max(1, geometry.titleBox.width - visualTokens.subgraph.titleInsetX * 2)}
                      height={geometry.titleBox.height}
                      align="left"
                      verticalAlign="middle"
                      text={subgraph.title || subgraph.id}
                      fontSize={visualTokens.subgraph.titleFontSize}
                      fontStyle={visualTokens.subgraph.titleFontWeight}
                      fontFamily={nodeThemeTokens.fontFamily}
                      fill={visualTokens.colors.nodeText}
                      ellipsis
                      listening={false}
                    />
                    {anchorVisible
                      ? geometry.anchorsLocal.map((anchor) => (
                          <Group
                            id={subgraphAnchorHitId(geometry.id, anchor.key)}
                            name={CANVAS_HIT_NAMES.subgraphAnchor}
                            key={`${geometry.id}-${anchor.key}`}
                            x={anchor.x}
                            y={anchor.y}
                            onMouseDown={(event) => {
                              event.cancelBubble = true;
                              handleCanvasPointerDown(event, { kind: "subgraphAnchor", subgraphId: geometry.id, anchor: anchor.key }, {
                                x: geometry.frame.x + anchor.x,
                                y: geometry.frame.y + anchor.y
                              });
                            }}
                          >
                            <Circle radius={visualTokens.anchor.radius} fill="rgba(0,0,0,0.001)" strokeEnabled={false} />
                            <Circle
                              radius={anchor.kind === "corner" ? visualTokens.anchor.radius * visualTokens.subgraph.anchorCornerScale : visualTokens.anchor.radius}
                              fill={visualTokens.colors.accent}
                              stroke={visualTokens.colors.anchorStroke}
                              strokeWidth={visualTokens.anchor.strokeWidth}
                              opacity={anchor.kind === "corner" ? visualTokens.subgraph.anchorCornerOpacity : 1}
                              listening={false}
                            />
                          </Group>
                        ))
                      : null}
                  </Group>
                );
              })
              : null}

            {scopedVisibleEdges.length
              ? scopedVisibleEdges.map((edge) => {
                  const baseGeometry = resolvedEdgeGeometry(edge);
                  if (!baseGeometry) return null;
                  const isRetargetPreviewEdge = retargetDraft?.edgeId === edge.id && !!retargetDraftGeometry && !!retargetPreview;
                  const geometry = isRetargetPreviewEdge ? retargetDraftGeometry : baseGeometry;
                  const edgeVisual = getEdgeVisualState({ edge, selection, hoveredEdgeId, interactionState, inlineEdit, visualTokens });
                  const edgePreviewVisual = isRetargetPreviewEdge ? getConnectionDraftVisualState({ valid: retargetPreview.valid, edge, visualTokens }) : null;
                  const shouldRenderPath = !!geometry.pathData;
                  const isEditingEdgeLabel = inlineEdit?.type === "edge" && inlineEdit.id === edge.id;
                  const edgeLabel = isEditingEdgeLabel ? inlineEdit.value : edge.label;
                  const edgeLabelGeometry = edgeLabel || isEditingEdgeLabel ? buildEdgeLabelGeometry(edgeLabel, geometry.labelPoint, edgeLabelSpec) : null;

                  return (
                    <Group key={edge.id}>
                      {shouldRenderPath ? (
                        <>
                          <Path
                            id={edgeHitId(edge.id)}
                            name={CANVAS_HIT_NAMES.edge}
                            data={geometry.pathData}
                            stroke="transparent"
                            strokeWidth={visualTokens.edge.hitStrokeWidth}
                            fillEnabled={false}
                            onClick={(event) => handleCanvasClick(event, { kind: "edge", id: edge.id })}
                            onDblClick={(event) => handleCanvasDoubleClick(event, { kind: "edge", id: edge.id })}
                            onTap={(event) => handleCanvasTap(event, { kind: "edge", id: edge.id })}
                          />
                          <Path
                            data={geometry.pathData}
                            stroke={edgePreviewVisual?.stroke ?? edgeVisual.stroke}
                            strokeWidth={edgePreviewVisual?.strokeWidth ?? edgeVisual.strokeWidth}
                            dash={edgePreviewVisual?.dash ?? edgeVisual.dash}
                            opacity={edgePreviewVisual?.opacity ?? 1}
                            lineCap="round"
                            lineJoin="round"
                            fillEnabled={false}
                            listening={false}
                          />
                          <PathArrowMarker edge={edge} geometry={geometry} fill={edgePreviewVisual?.fill ?? edgeVisual.fill} visualTokens={visualTokens} />
                        </>
                      ) : (
                        <>
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
                            pointerLength={edgePreviewVisual?.pointerLength ?? edgePointerLength(edge, visualTokens)}
                            pointerWidth={edgePreviewVisual?.pointerWidth ?? edgePointerWidth(edge, visualTokens)}
                            listening={false}
                          />
                        </>
                      )}
                      {!edgePreviewVisual ? (
                        <EdgeEndMarker edge={edge} geometry={geometry} stroke={edgeVisual.stroke} strokeWidth={edgeVisual.strokeWidth} surfaceFill={visualTokens.colors.surface} visualTokens={visualTokens} />
                      ) : null}
                      {viewFilters.edgeLabels && edgeLabelGeometry && !isEditingEdgeLabel ? (
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
                            fontSize={edgeLabelThemeTokens.fontSize}
                            fontFamily={edgeLabelThemeTokens.fontFamily}
                            lineHeight={edgeLabelThemeTokens.lineHeight / edgeLabelThemeTokens.fontSize}
                            wrap="none"
                            fill={edgeVisual.labelTextFill}
                            ellipsis
                          />
                        </Group>
                      ) : null}
                    </Group>
                  );
                })
              : null}

            {viewFilters.nodes ? scopedRenderedNodes.map((node) => {
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
                  draggable={dragEnabled && mode === "select" && !panningRequested && interactionState.kind !== "panning"}
                  onDragStart={(event) => {
                    if (event.evt.button !== 0) {
                      event.target.stopDrag();
                      return;
                    }
                    applyCanvasPointerLocalEffect({ type: "drag.startNode", nodeId: node.id });
                  }}
                  onDragMove={(event) => moveSelectedNodes(node, event.target)}
                  onDragEnd={() => {
                    if (dragDraftGraphRef.current) {
                      finishDragWithMembership();
                    }
                    dragRef.current = null;
                    subgraphDragFrameRef.current = null;
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
                    visualTokens={visualTokens}
                  />
                  <Text
                    x={geometry.textBox.x}
                    y={geometry.textBox.y}
                    width={geometry.textBox.width}
                    height={geometry.textBox.height}
                    align="center"
                    verticalAlign="middle"
                    text={node.label}
                    fontSize={nodeThemeTokens.fontSize}
                    fontStyle={String(nodeThemeTokens.fontWeight)}
                    fontFamily={nodeThemeTokens.fontFamily}
                    lineHeight={nodeThemeTokens.lineHeight / nodeThemeTokens.fontSize}
                    wrap="word"
                    fill={nodeVisual.textFill}
                    ellipsis
                    visible={viewFilters.nodeLabels && !(inlineEdit?.type === "node" && inlineEdit.id === node.id)}
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
                            radius={anchor.kind === "corner" ? anchorVisual.radius * visualTokens.subgraph.anchorCornerScale : anchorVisual.radius}
                            fill={anchorVisual.fill}
                            stroke={anchorVisual.stroke}
                            strokeWidth={anchorVisual.strokeWidth}
                            opacity={anchor.kind === "corner" ? visualTokens.subgraph.anchorCornerOpacity : 1}
                            listening={false}
                          />
                        </Group>
                      ))
                    : null}
                </Group>
              );
            }) : null}

            {connectionDraftGeometry ? (
              connectionDraftGeometry.pathData ? (
                <Group listening={false}>
                  <Path
                    data={connectionDraftGeometry.pathData}
                    stroke={connectionDraftVisual.stroke}
                    strokeWidth={connectionDraftVisual.strokeWidth}
                    dash={connectionDraftVisual.dash}
                    opacity={connectionDraftVisual.opacity}
                    lineCap="round"
                    lineJoin="round"
                    fillEnabled={false}
                  />
                  <PathArrowHead
                    geometry={connectionDraftGeometry}
                    fill={connectionDraftVisual.fill}
                    length={connectionDraftVisual.pointerLength}
                    width={connectionDraftVisual.pointerWidth}
                  />
                </Group>
              ) : (
                <Arrow points={connectionDraftGeometry.points} {...connectionDraftVisual} listening={false} />
              )
            ) : null}

            {selectionBox ? (
              <Rect
                {...normalizeBox(selectionBox)}
                {...getSelectionBoxVisualState(visualTokens)}
                listening={false}
              />
            ) : null}

            {viewFilters.edges && mode === "select" && selectedSingleEdge && selectedSingleEdgeGeometry ? (
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
                fontFamily: nodeThemeTokens.fontFamily,
                fontSize: nodeThemeTokens.fontSize * activeScale,
                lineHeight: `${nodeThemeTokens.lineHeight * activeScale}px`,
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
                fontFamily: nodeThemeTokens.fontFamily,
                fontSize: nodeThemeTokens.fontSize * activeScale,
                lineHeight: `${nodeThemeTokens.lineHeight * activeScale}px`,
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

        {viewFilters.edges && viewFilters.edgeLabels && inlineEdit?.type === "edge" && editStyle ? (
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
              fontFamily: edgeLabelThemeTokens.fontFamily,
              fontSize: edgeLabelThemeTokens.fontSize * activeScale,
              lineHeight: `${edgeLabelThemeTokens.lineHeight * activeScale}px`,
              paddingLeft: edgeLabelThemeTokens.paddingX * activeScale,
              paddingRight: edgeLabelThemeTokens.paddingX * activeScale
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
  visualTokens,
  gridSpec
}: {
  dimensions: { width: number; height: number };
  viewport: ViewportState;
  visualTokens: CanvasVisualTokens;
  gridSpec: CanvasGridSpec;
}) {
  const plan = useMemo(
    () =>
      getCanvasGridRenderPlan(
        { width: dimensions.width, height: dimensions.height },
        { x: viewport.x, y: viewport.y, scale: viewport.scale },
        gridSpec
      ),
    [dimensions.height, dimensions.width, gridSpec, viewport.scale, viewport.x, viewport.y]
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
            const startX = firstGridCoordinateAtOrAfter(bounds.left, level.step, gridSpec.origin.x);
            const startY = firstGridCoordinateAtOrAfter(bounds.top, level.step, gridSpec.origin.y);

            context.beginPath();
            context.fillStyle = `rgba(${visualTokens.colors.gridDotRgb}, ${level.alpha})`;
            for (let x = startX; x <= bounds.right; x += level.step) {
              for (let y = startY; y <= bounds.bottom; y += level.step) {
                if (
                  level.skipStep &&
                  isGridCoordinate(x, level.skipStep, gridSpec.origin.x) &&
                  isGridCoordinate(y, level.skipStep, gridSpec.origin.y)
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

function unique(values: string[]) {
  return Array.from(new Set(values));
}
