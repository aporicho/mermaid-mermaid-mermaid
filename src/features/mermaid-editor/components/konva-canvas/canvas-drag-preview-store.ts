import type { CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";

export type CanvasSubgraphPreviewPositions = Record<string, { x: number; y: number }>;

export type CanvasDragPreviewSnapshot = {
  nodePositions: CanvasNodePreviewPositions;
  subgraphPositions: CanvasSubgraphPreviewPositions;
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
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
