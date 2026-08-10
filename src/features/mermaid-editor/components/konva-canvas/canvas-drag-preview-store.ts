import type { CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";
import type { AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";

export type CanvasSubgraphPreviewPositions = Record<string, { x: number; y: number }>;

export type CanvasDragPreviewSnapshot = {
  nodePositions: CanvasNodePreviewPositions;
  subgraphPositions: CanvasSubgraphPreviewPositions;
  guides?: AlignmentGuide[];
  dropTargetSubgraphId?: string;
};

export class CanvasDragPreviewStore {
  private snapshot: CanvasDragPreviewSnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = () => this.snapshot;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  publish(snapshot: CanvasDragPreviewSnapshot | null) {
    if (snapshot === this.snapshot) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
