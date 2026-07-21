import { Assets, Container, Graphics, Rectangle, Sprite, Text as PixiText, Texture } from "pixi.js";

import { superellipseRectPathPoints } from "@/features/mermaid-editor/lib/canvas-card-geometry";
import {
  canvasElementFrame,
  type CanvasCardElement,
  type CanvasConnectorElement,
  type CanvasDocument,
  type CanvasDocumentElement,
  type CanvasImageElement,
  type CanvasShapeElement,
  type CanvasTextElement
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  canvasDocumentEndpointPoint,
  canvasDocumentVisibleElements,
  type CanvasDocumentDimensions
} from "@/features/mermaid-editor/lib/canvas-document-rendering";
import type { StandardCanvasInteractionState } from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import type { EditorTypographyTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";

import {
  DEFAULT_TEXT_COLOR,
  IMAGE_BORDER_COLOR,
  SELECTED_COLOR,
  SURFACE_COLOR
} from "./constants";
import { applyPixiViewport, canvasTextResolution, parsePixiColor, schedulePixiRender } from "./pixi-runtime";
import type { CanvasDocumentInlineEdit, PixiCanvasRuntime, PixiElementView, Point } from "./types";

export function syncPixiScene(
  pixi: PixiCanvasRuntime,
  document: CanvasDocument,
  dimensions: CanvasDocumentDimensions,
  selectedIds: string[],
  connectorStartId: string | null,
  imageDisplaySrcBySrc: Record<string, string>,
  interactionState: StandardCanvasInteractionState,
  inlineEdit: CanvasDocumentInlineEdit | null,
  typography: EditorTypographyTokens["canvasDocument"],
  fontRevision: number
) {
  if (pixi.disposed) return;
  const visibleElements = canvasDocumentVisibleElements(document, dimensions, selectedIds, connectorStartId);
  const visibleIds = new Set(visibleElements.map((element) => element.id));
  for (const [id, view] of pixi.views) {
    if (visibleIds.has(id)) continue;
    view.container.removeFromParent();
    view.container.destroy({ children: true });
    pixi.views.delete(id);
  }

  pixi.connectors.removeChildren();
  pixi.objects.removeChildren();
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const selected = new Set(selectedIds);

  for (const element of visibleElements) {
    const view = getPixiElementView(pixi, element);
    syncElementView(pixi, view, element, elementsById, selected, connectorStartId, imageDisplaySrcBySrc[element.type === "image" ? element.src : ""], document.viewport.scale, inlineEdit, typography, fontRevision);
    if (element.type === "connector") pixi.connectors.addChild(view.container);
    else pixi.objects.addChild(view.container);
  }

  applyPixiViewport(pixi, document.viewport, dimensions);
  drawSelectionOverlay(pixi, document, selectedIds, interactionState);
  schedulePixiRender(pixi);
}

export function drawSelectionOverlay(pixi: PixiCanvasRuntime, document: CanvasDocument, selectedIds: string[], interactionState: StandardCanvasInteractionState) {
  pixi.selection.clear();
  const scale = Math.max(document.viewport.scale, 0.01);
  if (interactionState.kind === "marqueeSelecting") {
    const x = Math.min(interactionState.startWorld.x, interactionState.currentWorld.x);
    const y = Math.min(interactionState.startWorld.y, interactionState.currentWorld.y);
    const width = Math.abs(interactionState.currentWorld.x - interactionState.startWorld.x);
    const height = Math.abs(interactionState.currentWorld.y - interactionState.startWorld.y);
    pixi.selection
      .rect(x, y, width, height)
      .fill({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), alpha: 0.08 })
      .stroke({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), width: 1 / scale, alpha: 0.7 });
  }
  if (!selectedIds.length) return;
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const selectedElements = selectedIds.map((id) => elementsById.get(id)).filter((element): element is CanvasDocumentElement => Boolean(element));
  if (selectedElements.length !== 1) return;
  const element = selectedElements[0];
  if (element.type === "connector") return;

  const frame = canvasElementFrame(element);
  const handleSize = 14 / scale;
  pixi.selection
    .rect(frame.x, frame.y, frame.width, frame.height)
    .stroke({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), width: 1 / scale, alpha: 0.95 })
    .roundRect(frame.x + frame.width - handleSize / 2, frame.y + frame.height - handleSize / 2, handleSize, handleSize, 3 / scale)
    .fill({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d) })
    .stroke({ color: parsePixiColor(SURFACE_COLOR, 0xfbf6ef), width: 1.5 / scale });
}

function getPixiElementView(pixi: PixiCanvasRuntime, element: CanvasDocumentElement) {
  const existing = pixi.views.get(element.id);
  if (existing?.type === element.type) return existing;
  if (existing) {
    existing.container.removeFromParent();
    existing.container.destroy({ children: true });
  }

  const container = new Container();
  const body = new Graphics();
  container.addChild(body);
  container.eventMode = "static";
  container.cursor = "pointer";
  const view: PixiElementView = { id: element.id, type: element.type, container, body };
  pixi.views.set(element.id, view);
  return view;
}

function syncElementView(
  pixi: PixiCanvasRuntime,
  view: PixiElementView,
  element: CanvasDocumentElement,
  elementsById: Map<string, CanvasDocumentElement>,
  selected: Set<string>,
  connectorStartId: string | null,
  displaySrc: string | undefined,
  viewportScale: number,
  inlineEdit: CanvasDocumentInlineEdit | null,
  typography: EditorTypographyTokens["canvasDocument"],
  fontRevision: number
) {
  const selectedOrConnecting = selected.has(element.id) || connectorStartId === element.id;
  const editingText = (inlineEdit?.type === "item" && inlineEdit.id === element.id) || (inlineEdit?.type === "connection" && inlineEdit.id === element.id);
  const role = typographyRoleForElement(element, typography);
  const signature = elementSignature(element, elementsById, selectedOrConnecting, displaySrc, viewportScale, editingText, role, fontRevision);
  if (view.signature === signature) return;
  view.signature = signature;
  view.body.clear();
  view.container.position.set(0, 0);
  view.container.scale.set(1);
  view.container.alpha = 1;

  if (element.type === "shape") {
    drawShape(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    if (editingText) {
      removeTextDisplay(view);
    } else {
      syncTextDisplay(view, element.text || "", {
        x: element.width / 2,
        y: element.height / 2,
        width: Math.max(1, element.width - 24),
        typography: role,
        fill: DEFAULT_TEXT_COLOR,
        anchor: 0.5,
        align: "center",
        viewportScale
      });
    }
    return;
  }

  if (element.type === "card") {
    drawCard(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    if (editingText) {
      removeTextDisplay(view);
    } else {
      syncTextDisplay(view, element.text || "", {
        x: 22,
        y: 22,
        width: Math.max(1, element.width - 44),
        typography: role,
        fill: DEFAULT_TEXT_COLOR,
        anchor: { x: 0, y: 0 },
        align: "left",
        viewportScale
      });
    }
    return;
  }

  if (element.type === "text") {
    drawTextFrame(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    if (editingText) {
      removeTextDisplay(view);
    } else {
      syncTextDisplay(view, element.text, {
        x: 0,
        y: element.height / 2,
        width: Math.max(1, element.width),
        typography: role,
        fill: element.fill,
        anchor: { x: 0, y: 0.5 },
        align: "left",
        viewportScale
      });
    }
    return;
  }

  if (element.type === "image") {
    drawImageFrame(view.body, element, selectedOrConnecting);
    view.container.position.set(element.x, element.y);
    view.container.hitArea = new Rectangle(0, 0, element.width, element.height);
    syncImageSprite(pixi, view, element, displaySrc);
    removeTextDisplay(view);
    return;
  }

  drawConnector(view, element, elementsById, selected.has(element.id), viewportScale, editingText, role);
}

function elementSignature(
  element: CanvasDocumentElement,
  elementsById: Map<string, CanvasDocumentElement>,
  selectedOrConnecting: boolean,
  displaySrc: string | undefined,
  viewportScale: number,
  editingText: boolean,
  typography: TypographyRoleTokens,
  fontRevision: number
) {
  const textResolution = canvasTextResolution(viewportScale);
  if (element.type === "connector") {
    const from = canvasDocumentEndpointPoint(element.from, elementsById);
    const to = canvasDocumentEndpointPoint(element.to, elementsById);
    return JSON.stringify({ ...element, fromPoint: from, toPoint: to, selectedOrConnecting, textResolution, editingText, typography, fontRevision });
  }
  return JSON.stringify({ ...element, selectedOrConnecting, displaySrc, textResolution, editingText, typography, fontRevision });
}

function drawShape(graphics: Graphics, element: CanvasShapeElement, selectedOrConnecting: boolean) {
  const stroke = parsePixiColor(selectedOrConnecting ? SELECTED_COLOR : element.stroke, 0x2f2a25);
  const strokeWidth = selectedOrConnecting ? Math.max(2, element.strokeWidth + 0.5) : element.strokeWidth;
  const fill = parsePixiColor(element.fill, 0xfbf6ef);
  if (element.shape === "ellipse") {
    graphics.ellipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2).fill({ color: fill }).stroke({ color: stroke, width: strokeWidth });
    return;
  }
  if (element.shape === "diamond") {
    graphics
      .poly([element.width / 2, 0, element.width, element.height / 2, element.width / 2, element.height, 0, element.height / 2], true)
      .fill({ color: fill })
      .stroke({ color: stroke, width: strokeWidth });
    return;
  }
  graphics
    .roundRect(0, 0, element.width, element.height, element.shape === "roundRect" ? 16 : 4)
    .fill({ color: fill })
    .stroke({ color: stroke, width: strokeWidth });
}

function drawCard(graphics: Graphics, element: CanvasCardElement, selectedOrConnecting: boolean) {
  const stroke = parsePixiColor(selectedOrConnecting ? SELECTED_COLOR : element.stroke, 0xd8d3ca);
  const strokeWidth = selectedOrConnecting ? Math.max(2, element.strokeWidth + 0.5) : element.strokeWidth;
  const fill = parsePixiColor(element.fill, 0xfffdf8);
  const points = superellipseRectPathPoints({
    width: element.width,
    height: element.height,
    radius: element.cornerRadius
  });
  const [first, ...rest] = points;
  if (!first) return;
  graphics.moveTo(first.x, first.y);
  for (const point of rest) graphics.lineTo(point.x, point.y);
  graphics.closePath().fill({ color: fill }).stroke({ color: stroke, width: strokeWidth });
}

function drawTextFrame(graphics: Graphics, element: CanvasTextElement, selectedOrConnecting: boolean) {
  if (!selectedOrConnecting) return;
  graphics.roundRect(0, 0, element.width, element.height, 4).stroke({ color: parsePixiColor(SELECTED_COLOR, 0xe85d5d), width: 1.5, alpha: 0.95 });
}

function drawImageFrame(graphics: Graphics, element: CanvasImageElement, selectedOrConnecting: boolean) {
  const stroke = parsePixiColor(selectedOrConnecting ? SELECTED_COLOR : IMAGE_BORDER_COLOR, 0xd8cfc3);
  graphics.roundRect(0, 0, element.width, element.height, 6).stroke({ color: stroke, width: 1.5 });
}

function drawConnector(view: PixiElementView, element: CanvasConnectorElement, elementsById: Map<string, CanvasDocumentElement>, selected: boolean, viewportScale: number, editingText: boolean, typography: TypographyRoleTokens) {
  const from = canvasDocumentEndpointPoint(element.from, elementsById);
  const to = canvasDocumentEndpointPoint(element.to, elementsById);
  const color = parsePixiColor(selected ? SELECTED_COLOR : element.stroke, 0x2f2a25);
  const width = selected ? element.strokeWidth + 0.75 : element.strokeWidth;
  view.body.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color, width });
  if (element.markerEnd !== "none") drawArrowHead(view.body, from, to, color, width);

  const minX = Math.min(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  view.container.hitArea = new Rectangle(minX - 8, minY - 8, Math.abs(from.x - to.x) + 16, Math.abs(from.y - to.y) + 16);
  if (element.label && !editingText) {
    syncTextDisplay(view, element.label, {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 8,
      width: 180,
      typography,
      fill: DEFAULT_TEXT_COLOR,
      anchor: 0.5,
      align: "center",
      viewportScale
    });
  } else {
    removeTextDisplay(view);
  }
}

function drawArrowHead(graphics: Graphics, from: Point, to: Point, color: number, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = 10 + width;
  const half = 4 + width * 0.4;
  const back = {
    x: to.x - Math.cos(angle) * length,
    y: to.y - Math.sin(angle) * length
  };
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  graphics
    .poly([to.x, to.y, back.x + normal.x * half, back.y + normal.y * half, back.x - normal.x * half, back.y - normal.y * half], true)
    .fill({ color })
    .stroke({ color, width: Math.max(1, width * 0.75) });
}

function syncImageSprite(pixi: PixiCanvasRuntime, view: PixiElementView, element: CanvasImageElement, displaySrc: string | undefined) {
  if (!view.sprite) {
    view.sprite = new Sprite(Texture.EMPTY);
    view.container.addChildAt(view.sprite, 0);
  }
  layoutImageSprite(view.sprite, element);
  if (!displaySrc) {
    view.imageSrc = undefined;
    view.sprite.texture = Texture.EMPTY;
    return;
  }
  if (view.imageSrc === displaySrc) return;

  view.imageSrc = displaySrc;
  view.sprite.texture = Texture.EMPTY;
  void Assets.load(displaySrc)
    .then((texture) => {
      const current = pixi.views.get(view.id);
      if (!current || current !== view || current.imageSrc !== displaySrc || !view.sprite) return;
      texture.source.style.scaleMode = "linear";
      view.sprite.texture = texture;
      const currentElement = findImageElementById(view.id, pixi, element);
      layoutImageSprite(view.sprite, currentElement || element);
      schedulePixiRender(pixi);
    })
    .catch(() => {
      schedulePixiRender(pixi);
    });
}

function findImageElementById(id: string, pixi: PixiCanvasRuntime, fallback: CanvasImageElement) {
  const view = pixi.views.get(id);
  return view?.type === "image" ? fallback : null;
}

function layoutImageSprite(sprite: Sprite, element: CanvasImageElement) {
  const textureWidth = sprite.texture.width || element.width;
  const textureHeight = sprite.texture.height || element.height;
  if (!element.preserveAspectRatio || !textureWidth || !textureHeight) {
    sprite.x = 0;
    sprite.y = 0;
    sprite.width = element.width;
    sprite.height = element.height;
    return;
  }
  const scale = Math.min(element.width / textureWidth, element.height / textureHeight);
  sprite.width = textureWidth * scale;
  sprite.height = textureHeight * scale;
  sprite.x = (element.width - sprite.width) / 2;
  sprite.y = (element.height - sprite.height) / 2;
}

function syncTextDisplay(
  view: PixiElementView,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    typography: TypographyRoleTokens;
    fill: string;
    anchor: number | { x: number; y: number };
    align: "left" | "center";
    viewportScale: number;
  }
) {
  if (!text) {
    removeTextDisplay(view);
    return;
  }

  const textResolution = canvasTextResolution(options.viewportScale);
  const key = JSON.stringify({ text, options, textResolution });
  if (view.text && view.textKey === key) return;
  removeTextDisplay(view);

  const style = {
    fontFamily: options.typography.family,
    fontSize: options.typography.fontSize,
    fontWeight: pixiFontWeight(options.typography.fontWeight),
    letterSpacing: options.typography.letterSpacing,
    fill: parsePixiColor(options.fill, 0x2f2a25),
    align: options.align,
    wordWrap: true,
    wordWrapWidth: options.width,
    lineHeight: options.typography.lineHeight
  };
  const display = new PixiText({
    text,
    style,
    anchor: options.anchor,
    resolution: textResolution,
    textureStyle: {
      scaleMode: "linear"
    },
    autoGenerateMipmaps: true
  });
  display.x = options.x;
  display.y = options.y;
  display.eventMode = "none";
  view.text = display;
  view.textKey = key;
  view.container.addChild(display);
}

function typographyRoleForElement(element: CanvasDocumentElement, typography: EditorTypographyTokens["canvasDocument"]) {
  if (element.type === "shape") return typography.shape;
  if (element.type === "card") return typography.card;
  if (element.type === "text") return typography.freeText;
  return typography.connector;
}

function pixiFontWeight(value: number): "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" {
  return String(Math.min(900, Math.max(100, Math.round(value / 100) * 100))) as "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
}

function removeTextDisplay(view: PixiElementView) {
  if (!view.text) return;
  view.text.removeFromParent();
  view.text.destroy();
  view.text = undefined;
  view.textKey = undefined;
}
