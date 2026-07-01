import { Circle, Group, Line } from "react-konva";

import type { EdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge, EdgeMarker } from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";

export function EdgeMarkers({
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
  return (
    <>
      <EdgeMarkerShape side="start" marker={edgeMarker(edge, "start")} geometry={geometry} stroke={stroke} strokeWidth={strokeWidth} surfaceFill={surfaceFill} visualTokens={visualTokens} />
      <EdgeMarkerShape side="end" marker={edgeMarker(edge, "end")} geometry={geometry} stroke={stroke} strokeWidth={strokeWidth} surfaceFill={surfaceFill} visualTokens={visualTokens} />
    </>
  );
}

export function PathArrowHead({ point, tangent, fill, length, width }: { point: { x: number; y: number }; tangent: { x: number; y: number }; fill: string; length: number; width: number }) {
  if (length <= 0 || width <= 0) return null;

  const rotation = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;

  return (
    <Line
      x={point.x}
      y={point.y}
      rotation={rotation}
      points={[0, 0, -length, -width / 2, -length, width / 2]}
      closed
      fill={fill}
      stroke={fill}
      listening={false}
    />
  );
}

function EdgeMarkerShape({
  side,
  marker,
  geometry,
  stroke,
  strokeWidth,
  surfaceFill,
  visualTokens
}: {
  side: "start" | "end";
  marker: EdgeMarker;
  geometry: EdgePathGeometry;
  stroke: string;
  strokeWidth: number;
  surfaceFill: string;
  visualTokens: CanvasVisualTokens;
}) {
  if (marker === "none") return null;

  if (marker === "arrow") {
    const tangent = side === "start" ? { x: -geometry.startTangent.x, y: -geometry.startTangent.y } : geometry.endTangent;
    const point = side === "start" ? geometry.start : geometry.end;
    return <PathArrowHead point={point} tangent={tangent} fill={stroke} length={visualTokens.edge.pointerLength} width={visualTokens.edge.pointerWidth} />;
  }

  const point = side === "start" ? geometry.start : geometry.end;
  if (marker === "circle") {
    return <Circle x={point.x} y={point.y} radius={visualTokens.edge.endpointMarkerRadius} fill={surfaceFill} stroke={stroke} strokeWidth={strokeWidth} listening={false} />;
  }

  const size = visualTokens.edge.endpointMarkerRadius + 1;
  return (
    <Group x={point.x} y={point.y} listening={false}>
      <Line points={[-size, -size, size, size]} stroke={stroke} strokeWidth={strokeWidth} lineCap="round" />
      <Line points={[-size, size, size, -size]} stroke={stroke} strokeWidth={strokeWidth} lineCap="round" />
    </Group>
  );
}

function edgeMarker(edge: CanvasEdge, side: "start" | "end"): EdgeMarker {
  if (edge.style === "invisible") return "none";
  if (side === "start") return edge.markerStart || "none";
  return edge.markerEnd || edge.arrowType || "arrow";
}
