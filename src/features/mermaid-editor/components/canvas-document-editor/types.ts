import type { Application, Container, Graphics, Sprite, Text as PixiText } from "pixi.js";

import type { CanvasDocument, CanvasDocumentElement } from "@/features/mermaid-editor/lib/canvas-document";

export type Point = {
  x: number;
  y: number;
};

export type CanvasDocumentInlineEdit =
  | { type: "item"; id: string; value: string }
  | { type: "connection"; id: string; value: string };

export type CanvasDocumentInlineEditStyle = {
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textAlign: "left" | "center";
  fontWeight: number;
  letterSpacing: number;
  color: string;
  verticalAlign: "top" | "middle";
  borderRadius?: number;
  paddingX?: number;
};

export type PixiElementView = {
  id: string;
  type: CanvasDocumentElement["type"];
  container: Container;
  body: Graphics;
  sprite?: Sprite;
  text?: PixiText;
  textKey?: string;
  imageSrc?: string;
  signature?: string;
};

export type PixiCanvasRuntime = {
  app: Application;
  grid: Graphics;
  world: Container;
  connectors: Container;
  objects: Container;
  selection: Graphics;
  views: Map<string, PixiElementView>;
  renderFrame: number | null;
  viewportCommitTimer: number | null;
  disposed: boolean;
};

export type CanvasDocumentMoveDraft = {
  baseDocument: CanvasDocument;
  origins: Record<string, Point>;
  ids: string[];
  changed: boolean;
};

export type CanvasDocumentResizeDraft = {
  id: string;
  baseDocument: CanvasDocument;
  frame: { x: number; y: number; width: number; height: number };
  changed: boolean;
};
