import {
  classifyWheelInput,
  resolveWheelNavigation,
  zoomViewportAtPoint,
  type WheelInputSource,
  type WheelIntentTracker
} from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { InteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import type { StandardContextQueryInput, StandardGestureInput, StandardInput, StandardWheelInput } from "@/features/mermaid-editor/lib/interaction/input";

export type ViewIntent =
  | {
      kind: "view";
      action: "pan" | "zoom";
      viewport: InteractionContext["viewport"];
      source: "wheel";
      inputSource: WheelInputSource;
    }
  | {
      kind: "view";
      action: "zoom";
      viewport: InteractionContext["viewport"];
      source: "gesture";
    }
  | { kind: "view"; action: "ignored"; reason: "empty-delta" | "active-gesture" | "unsupported-input"; source: "wheel" | "gesture" };

export type FilterIntent = {
  kind: "filter";
  action: "set";
  filters: ViewFilters;
  message: string;
};

export type QueryIntent = {
  kind: "query";
  action: StandardContextQueryInput["query"];
};

export type InteractionIntent =
  | ViewIntent
  | FilterIntent
  | QueryIntent
  | { kind: "none"; reason: "unsupported-input" | "missing-payload" };

export type ResolveInteractionIntentOptions = {
  wheelIntentTracker?: WheelIntentTracker;
};

export function resolveInteractionIntent(
  input: StandardInput,
  context: InteractionContext,
  options: ResolveInteractionIntentOptions = {}
): InteractionIntent {
  if (input.kind === "wheel") return resolveWheelViewIntent(input, context, options.wheelIntentTracker);
  if (input.kind === "gesture") return resolveGestureViewIntent(input, context);

  if (input.kind === "context-query") {
    return { kind: "query", action: input.query };
  }

  if (input.kind === "menu" && input.command === "viewFilters.set") {
    const payload = input.payload as { filters?: ViewFilters; message?: string } | null | undefined;
    if (!payload?.filters) return { kind: "none", reason: "missing-payload" };
    return { kind: "filter", action: "set", filters: payload.filters, message: payload.message || "视图过滤器已更新。" };
  }

  return { kind: "none", reason: "unsupported-input" };
}

export function resolveGestureViewIntent(input: StandardGestureInput, context: InteractionContext): ViewIntent {
  if (input.interactionKind !== "idle") {
    return { kind: "view", action: "ignored", reason: "active-gesture", source: "gesture" };
  }

  if (input.phase !== "change") {
    return { kind: "view", action: "ignored", reason: "unsupported-input", source: "gesture" };
  }

  if (!Number.isFinite(input.scale) || input.scale <= 0) {
    return { kind: "view", action: "ignored", reason: "empty-delta", source: "gesture" };
  }

  return {
    kind: "view",
    action: "zoom",
    viewport: zoomViewportAtPoint(context.viewport, input.pointer, context.viewport.scale * input.scale),
    source: "gesture"
  };
}

export function resolveWheelViewIntent(input: StandardWheelInput, context: InteractionContext, wheelIntentTracker?: WheelIntentTracker): ViewIntent {
  const inputSource = classifyWheelInput({
    deltaMode: input.deltaMode,
    deltaX: input.deltaX,
    deltaY: input.deltaY
  });
  const result = resolveWheelNavigation({
    viewport: context.viewport,
    pointer: input.pointer,
    canvasSize: input.canvasSize,
    deltaX: input.deltaX,
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    ctrlKey: input.modifiers.ctrlKey,
    metaKey: input.modifiers.metaKey,
    shiftKey: input.modifiers.shiftKey,
    timestamp: input.timestamp,
    intentTracker: wheelIntentTracker,
    interactionKind: input.interactionKind
  });

  if (result.kind === "pan" || result.kind === "zoom") {
    return {
      kind: "view",
      action: result.kind,
      viewport: result.viewport,
      source: "wheel",
      inputSource
    };
  }

  return {
    kind: "view",
    action: "ignored",
    reason: input.interactionKind === "idle" ? "empty-delta" : "active-gesture",
    source: "wheel"
  };
}
