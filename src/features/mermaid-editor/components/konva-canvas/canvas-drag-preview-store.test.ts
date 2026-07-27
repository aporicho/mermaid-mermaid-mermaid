import { describe, expect, it, vi } from "vitest";

import { CanvasDragPreviewStore } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";

describe("canvas drag preview store", () => {
  it("publishes frame snapshots without requiring React state", () => {
    const store = new CanvasDragPreviewStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const snapshot = {
      nodePositions: { A: { x: 120, y: 80 } },
      subgraphPositions: { Group: { x: 40, y: 20 } }
    };

    store.publish(snapshot);
    expect(store.getSnapshot()).toBe(snapshot);
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.publish(null);
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toBeNull();
  });
});
