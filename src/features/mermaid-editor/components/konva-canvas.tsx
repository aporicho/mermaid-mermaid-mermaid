"use client";

import { KonvaCanvasStage } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage";
import type { KonvaCanvasProps } from "@/features/mermaid-editor/components/konva-canvas/types";
import { useKonvaCanvasModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-canvas-model";
import { useKonvaCanvasPointerInteraction } from "@/features/mermaid-editor/components/konva-canvas/use-konva-canvas-pointer-interaction";
import { CANVAS_VISUAL_TOKENS } from "@/features/mermaid-editor/lib/canvas-visual-state";

export { NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";

const EMPTY_MERMAID_EDGE_ROUTES: NonNullable<KonvaCanvasProps["mermaidEdgeRoutes"]> = [];
const EMPTY_IMAGE_DISPLAY_SOURCES: NonNullable<KonvaCanvasProps["imageDisplaySrcBySrc"]> = {};

export function KonvaCanvas({
  mermaidEdgeRoutes = EMPTY_MERMAID_EDGE_ROUTES,
  imageDisplaySrcBySrc = EMPTY_IMAGE_DISPLAY_SOURCES,
  visualTokens = CANVAS_VISUAL_TOKENS,
  ...props
}: KonvaCanvasProps) {
  const model = useKonvaCanvasModel({
    ...props,
    mermaidEdgeRoutes,
    imageDisplaySrcBySrc,
    visualTokens
  });
  const pointerInteraction = useKonvaCanvasPointerInteraction({
    model,
    onEditorCommand: props.onEditorCommand
  });

  return <KonvaCanvasStage {...model.stageProps} {...pointerInteraction.stageProps} />;
}
