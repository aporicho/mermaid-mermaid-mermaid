import type { CanvasPoint, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export function viewportAtPanningPointer(
  interaction: Extract<InteractionState, { kind: "panning" }>,
  screen: CanvasPoint
): ViewportState {
  return {
    ...interaction.originViewport,
    x: interaction.originViewport.x + screen.x - interaction.startScreen.x,
    y: interaction.originViewport.y + screen.y - interaction.startScreen.y
  };
}
