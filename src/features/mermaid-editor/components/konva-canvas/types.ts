import type { CanvasPoint } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type ViewportCommandSource = Extract<EditorCommand, { type: "viewport.set" }>["source"];

export type ScheduledViewport = {
  viewport: ViewportState;
  source: ViewportCommandSource;
};

export type CanvasLiveState = {
  canvasSize?: { width: number; height: number };
  editing?: { kind: "node" | "subgraph" | "edge"; id: string; draftText: string } | null;
  interaction?: string;
};

export type CanvasNodeMotionVisual = {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  highlight: number;
};

export type CanvasEdgeMotionVisual = {
  highlight: number;
};

export type NodeProximityRuntime = {
  interactive: boolean;
  frames: { id: string; x: number; y: number; width: number; height: number }[];
  radiusPx: number;
  maxScale: number;
  durationMs: number;
};

export type SafariGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

export type ScreenPointResolver = (clientX: number | undefined, clientY: number | undefined) => CanvasPoint | null;
