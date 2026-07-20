import { Ellipse, Line, Path, Rect } from "react-konva";

import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { flattenShapePoints, flowchartPolygonPoints } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { CANVAS_VISUAL_TOKENS, resolveCanvasNodeFill, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";

export function CanvasNodeShape({
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
  const fill = resolveCanvasNodeFill(node.fill, visualTokens);
  const shape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  const common = { fill, stroke, strokeWidth };
  const polygonPoints = flowchartPolygonPoints(shape, { x: 0, y: 0, width, height });
  const cornerRadius = visualTokens.shape.fallbackCornerRadius;

  if (shape === "text") return null;
  if (shape === "circle" || shape === "sm-circ" || shape === "f-circ") return <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} {...common} />;
  if (shape === "dbl-circ" || shape === "fr-circ" || shape === "cross-circ") return <CircleVariant width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} crossed={shape === "cross-circ"} />;
  if (shape === "fork") return <Rect width={width} height={height} cornerRadius={visualTokens.shape.forkCornerRadius} {...common} />;
  if (polygonPoints.length) return <PolygonShape points={flattenShapePoints(polygonPoints)} radius={visualTokens.shape.polygonCornerRadius} {...common} />;
  if (shape === "cloud") return <Path data={cloudPath(width, height)} {...common} />;
  if (shape === "cyl") return <CylinderShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined={false} horizontal={false} />;
  if (shape === "lin-cyl") return <CylinderShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined horizontal={false} />;
  if (shape === "h-cyl") return <CylinderShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined={false} horizontal />;
  if (shape === "datastore") return <DataStoreShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} cornerRadius={cornerRadius} />;
  if (shape === "doc" || shape === "lin-doc" || shape === "tag-doc" || shape === "flag") return <DocumentShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} lined={shape === "lin-doc"} tagged={shape === "tag-doc"} flag={shape === "flag"} />;
  if (shape === "docs") return <StackedShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} kind="document" cornerRadius={cornerRadius} />;
  if (shape === "st-rect") return <StackedShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} kind="rect" cornerRadius={cornerRadius} />;
  if (shape === "lin-rect" || shape === "div-rect" || shape === "win-pane") return <LinedRectShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} mode={shape} cornerRadius={cornerRadius} />;
  if (shape === "tag-rect") return <TaggedRectShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} cornerRadius={cornerRadius} />;
  if (shape === "curv-trap") return <Path data={curvedTrapezoidPath(width, height)} {...common} />;
  if (shape === "delay") return <Path data={delayPath(width, height)} {...common} />;
  if (shape === "brace" || shape === "brace-r" || shape === "braces") return <BraceShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} mode={shape} cornerRadius={cornerRadius} />;
  if (shape === "fr-rect") return <SubroutineShape width={width} height={height} stroke={stroke} strokeWidth={strokeWidth} fill={fill} cornerRadius={cornerRadius} />;
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

function SubroutineShape({ width, height, stroke, strokeWidth, fill, cornerRadius }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; cornerRadius: number }) {
  const inset = Math.min(18, Math.max(10, width * 0.12));
  return (
    <>
      <Rect width={width} height={height} cornerRadius={cornerRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
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

function DataStoreShape({ width, height, stroke, strokeWidth, fill, cornerRadius }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; cornerRadius: number }) {
  return (
    <>
      <Rect width={width} height={height} cornerRadius={cornerRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
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

function StackedShape({ width, height, stroke, strokeWidth, fill, kind, cornerRadius }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; kind: "rect" | "document"; cornerRadius: number }) {
  const offset = 7;
  return (
    <>
      <Rect x={offset * 2} y={0} width={width - offset * 2} height={height - offset * 2} cornerRadius={cornerRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.7} />
      <Rect x={offset} y={offset} width={width - offset * 2} height={height - offset * 2} cornerRadius={cornerRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.85} />
      {kind === "document" ? (
        <DocumentShape width={width - offset * 2} height={height - offset * 2} stroke={stroke} strokeWidth={strokeWidth} fill={fill} />
      ) : (
        <Rect y={offset * 2} width={width - offset * 2} height={height - offset * 2} cornerRadius={cornerRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
    </>
  );
}

function LinedRectShape({ width, height, stroke, strokeWidth, fill, mode, cornerRadius }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; mode: "lin-rect" | "div-rect" | "win-pane"; cornerRadius: number }) {
  return (
    <>
      <Rect width={width} height={height} cornerRadius={cornerRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
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

function TaggedRectShape({ width, height, stroke, strokeWidth, fill, cornerRadius }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; cornerRadius: number }) {
  const tag = Math.min(18, width * 0.18);
  return (
    <>
      <Rect width={width} height={height} cornerRadius={cornerRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <Line points={[width - tag, 0, width - tag, tag, width, tag]} stroke={stroke} strokeWidth={strokeWidth} listening={false} />
    </>
  );
}

function BraceShape({ width, height, stroke, strokeWidth, fill, mode, cornerRadius }: { width: number; height: number; stroke: string; strokeWidth: number; fill: string; mode: "brace" | "brace-r" | "braces"; cornerRadius: number }) {
  const left = `M${width * 0.32},0 C${width * 0.08},0 ${width * 0.18},${height * 0.35} ${width * 0.02},${height * 0.5} C${width * 0.18},${height * 0.65} ${width * 0.08},${height} ${width * 0.32},${height}`;
  const right = `M${width * 0.68},0 C${width * 0.92},0 ${width * 0.82},${height * 0.35} ${width * 0.98},${height * 0.5} C${width * 0.82},${height * 0.65} ${width * 0.92},${height} ${width * 0.68},${height}`;
  return (
    <>
      <Rect width={width} height={height} cornerRadius={cornerRadius} fill={fill} opacity={0.28} listening={false} />
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
