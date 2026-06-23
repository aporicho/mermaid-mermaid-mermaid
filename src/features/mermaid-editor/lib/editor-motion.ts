import type { EditorMotionTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { DEFAULT_EDITOR_MOTION } from "@/features/mermaid-editor/lib/editor-theme";

export type RuntimeEditorMotion = EditorMotionTokens & {
  reduced: boolean;
};

export type MotionOffset = {
  x: number;
  y: number;
};

export function resolveRuntimeEditorMotion(tokens: EditorMotionTokens = DEFAULT_EDITOR_MOTION, reduced = false): RuntimeEditorMotion {
  if (!reduced) return { ...cloneMotionTokens(tokens), reduced: false };

  return {
    ...cloneMotionTokens(tokens),
    duration: {
      fast: 0,
      base: 0,
      slow: 0,
      layout: 0
    },
    distance: {
      chrome: 0,
      panel: 0,
      viewport: 0
    },
    stagger: {
      button: 0,
      list: 0
    },
    canvas: {
      ...tokens.canvas,
      createScale: 1,
      selectedScale: 1,
      highlightDuration: 0
    },
    reduced: true
  };
}

export function shouldAnimateCanvasItemCount(count: number, motion: RuntimeEditorMotion | EditorMotionTokens = DEFAULT_EDITOR_MOTION) {
  return count > 0 && count <= motion.canvas.maxAnimatedItems && motion.duration.layout > 0;
}

export function floatingPlacementOffset(placement: string, distance: number): MotionOffset {
  if (!distance) return { x: 0, y: 0 };
  if (placement.startsWith("left")) return { x: -distance, y: 0 };
  if (placement.startsWith("right")) return { x: distance, y: 0 };
  if (placement.startsWith("bottom")) return { x: 0, y: distance };
  return { x: 0, y: -distance };
}

export function panelMotionOffset(variant: "left" | "right" | "bottom" | "top" | "workspace", distance: number): MotionOffset {
  if (!distance || variant === "workspace") return { x: 0, y: 0 };
  if (variant === "left") return { x: -distance, y: 0 };
  if (variant === "right") return { x: distance, y: 0 };
  if (variant === "bottom") return { x: 0, y: distance };
  return { x: 0, y: -distance };
}

function cloneMotionTokens(tokens: EditorMotionTokens): EditorMotionTokens {
  return {
    duration: { ...tokens.duration },
    ease: { ...tokens.ease },
    distance: { ...tokens.distance },
    stagger: { ...tokens.stagger },
    canvas: { ...tokens.canvas }
  };
}
