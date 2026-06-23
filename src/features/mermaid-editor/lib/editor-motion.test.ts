import { describe, expect, it } from "vitest";

import { DEFAULT_EDITOR_MOTION } from "@/features/mermaid-editor/lib/editor-theme";
import { floatingPlacementOffset, panelMotionOffset, resolveRuntimeEditorMotion, shouldAnimateCanvasItemCount } from "@/features/mermaid-editor/lib/editor-motion";

describe("editor motion", () => {
  it("keeps normal motion tokens intact", () => {
    const motion = resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION, false);

    expect(motion.reduced).toBe(false);
    expect(motion.duration.base).toBe(DEFAULT_EDITOR_MOTION.duration.base);
    expect(motion.distance.panel).toBe(DEFAULT_EDITOR_MOTION.distance.panel);
    expect(motion.canvas.createScale).toBe(DEFAULT_EDITOR_MOTION.canvas.createScale);
  });

  it("disables displacement and duration when reduced motion is requested", () => {
    const motion = resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION, true);

    expect(motion.reduced).toBe(true);
    expect(motion.duration.layout).toBe(0);
    expect(motion.distance.chrome).toBe(0);
    expect(motion.stagger.button).toBe(0);
    expect(motion.canvas.createScale).toBe(1);
    expect(motion.canvas.selectedScale).toBe(1);
  });

  it("derives directional offsets for chrome and panels", () => {
    expect(floatingPlacementOffset("leftCenter", 8)).toEqual({ x: -8, y: 0 });
    expect(floatingPlacementOffset("rightBottom", 8)).toEqual({ x: 8, y: 0 });
    expect(floatingPlacementOffset("bottomCenter", 8)).toEqual({ x: 0, y: 8 });
    expect(panelMotionOffset("top", 24)).toEqual({ x: 0, y: -24 });
  });

  it("caps canvas item animation by theme budget", () => {
    const motion = resolveRuntimeEditorMotion({
      ...DEFAULT_EDITOR_MOTION,
      canvas: { ...DEFAULT_EDITOR_MOTION.canvas, maxAnimatedItems: 2 }
    });

    expect(shouldAnimateCanvasItemCount(2, motion)).toBe(true);
    expect(shouldAnimateCanvasItemCount(3, motion)).toBe(false);
  });
});
