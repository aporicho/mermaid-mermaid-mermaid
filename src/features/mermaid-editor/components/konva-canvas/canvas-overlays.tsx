import { useMemo } from "react";
import { Layer, Line, Shape } from "react-konva";
import type Konva from "konva";

import type { AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import {
  firstGridCoordinateAtOrAfter,
  getCanvasGridRenderPlan,
  isGridCoordinate,
  type CanvasGridSpec
} from "@/features/mermaid-editor/lib/canvas-grid";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import {
  getAlignmentGuideVisualState,
  type CanvasVisualTokens
} from "@/features/mermaid-editor/lib/canvas-visual-state";

export function CanvasGrid({
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
          context.fillStyle = visualTokens.grid.color;
          for (const level of levels) {
            const radius = level.radiusPx / viewport.scale;
            const startX = firstGridCoordinateAtOrAfter(bounds.left, level.step, gridSpec.origin.x);
            const startY = firstGridCoordinateAtOrAfter(bounds.top, level.step, gridSpec.origin.y);

            context.beginPath();
            context.globalAlpha = level.alpha;
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

export function AlignmentGuideOverlay({ guides, visualTokens }: { guides: AlignmentGuide[]; visualTokens: CanvasVisualTokens }) {
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
            strokeEnabled={visual.strokeEnabled}
            dash={visual.dash}
            lineCap="round"
            listening={false}
          />
        );
      })}
    </>
  );
}
