import type { CanvasPoint, HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasInteractionKind } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";

export type InteractionEntry = "web-ui" | "cli-api" | "file" | "system";

export type InteractionModifiers = {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type StandardPointerPhase = "down" | "move" | "up" | "click" | "double-click" | "tap";

export type StandardPointerInput = {
  kind: "pointer";
  entry: InteractionEntry;
  phase: StandardPointerPhase;
  pointerId: number;
  button: number;
  screen: CanvasPoint;
  world?: CanvasPoint;
  hit: HitTarget;
  modifiers: InteractionModifiers;
  timestamp?: number;
};

export type StandardWheelInput = {
  kind: "wheel";
  entry: InteractionEntry;
  pointer: CanvasPoint;
  canvasSize: { width: number; height: number };
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  modifiers: InteractionModifiers;
  timestamp?: number;
  interactionKind: CanvasInteractionKind;
};

export type StandardGesturePhase = "start" | "change" | "end";

export type StandardGestureInput = {
  kind: "gesture";
  entry: InteractionEntry;
  phase: StandardGesturePhase;
  pointer: CanvasPoint;
  canvasSize: { width: number; height: number };
  scale: number;
  modifiers: InteractionModifiers;
  timestamp?: number;
  interactionKind: CanvasInteractionKind;
};

export type StandardKeyboardInput = {
  kind: "keyboard";
  entry: InteractionEntry;
  phase: "down" | "up";
  key: string;
  code: string;
  repeat: boolean;
  modifiers: InteractionModifiers;
  timestamp?: number;
};

export type StandardMenuInput = {
  kind: "menu";
  entry: InteractionEntry;
  command: string;
  payload?: unknown;
  modifiers: InteractionModifiers;
  timestamp?: number;
};

export type StandardFileInput = {
  kind: "file";
  entry: InteractionEntry;
  action: "open" | "save" | "save-as" | "source-change" | "refresh";
  fileName?: string;
  timestamp?: number;
};

export type StandardContextQueryInput = {
  kind: "context-query";
  entry: InteractionEntry;
  query: "editor-context" | "selection" | "visible-scope" | "runtime-snapshot";
  timestamp?: number;
};

export type StandardInput =
  | StandardPointerInput
  | StandardWheelInput
  | StandardGestureInput
  | StandardKeyboardInput
  | StandardMenuInput
  | StandardFileInput
  | StandardContextQueryInput;

export const emptyInteractionModifiers: InteractionModifiers = {
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false
};

export function modifiersFromEvent(event: Pick<MouseEvent | WheelEvent | KeyboardEvent, "shiftKey" | "altKey" | "ctrlKey" | "metaKey">): InteractionModifiers {
  return {
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey
  };
}

export function createStandardWheelInput(input: Omit<StandardWheelInput, "kind" | "entry" | "modifiers"> & {
  entry?: InteractionEntry;
  modifiers?: Partial<InteractionModifiers>;
}): StandardWheelInput {
  return {
    kind: "wheel",
    entry: input.entry || "web-ui",
    pointer: input.pointer,
    canvasSize: input.canvasSize,
    deltaX: input.deltaX,
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    modifiers: normalizeModifiers(input.modifiers),
    timestamp: input.timestamp,
    interactionKind: input.interactionKind
  };
}

export function createStandardGestureInput(input: Omit<StandardGestureInput, "kind" | "entry" | "modifiers"> & {
  entry?: InteractionEntry;
  modifiers?: Partial<InteractionModifiers>;
}): StandardGestureInput {
  return {
    kind: "gesture",
    entry: input.entry || "web-ui",
    phase: input.phase,
    pointer: input.pointer,
    canvasSize: input.canvasSize,
    scale: input.scale,
    modifiers: normalizeModifiers(input.modifiers),
    timestamp: input.timestamp,
    interactionKind: input.interactionKind
  };
}

export function createStandardKeyboardInput(input: Omit<StandardKeyboardInput, "kind" | "entry" | "modifiers"> & {
  entry?: InteractionEntry;
  modifiers?: Partial<InteractionModifiers>;
}): StandardKeyboardInput {
  return {
    kind: "keyboard",
    entry: input.entry || "web-ui",
    phase: input.phase,
    key: input.key,
    code: input.code,
    repeat: input.repeat,
    modifiers: normalizeModifiers(input.modifiers),
    timestamp: input.timestamp
  };
}

export function normalizeModifiers(modifiers: Partial<InteractionModifiers> | undefined): InteractionModifiers {
  return {
    shiftKey: Boolean(modifiers?.shiftKey),
    altKey: Boolean(modifiers?.altKey),
    ctrlKey: Boolean(modifiers?.ctrlKey),
    metaKey: Boolean(modifiers?.metaKey)
  };
}
