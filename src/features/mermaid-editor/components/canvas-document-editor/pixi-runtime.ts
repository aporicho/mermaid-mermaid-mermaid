import * as PIXI from "pixi.js";
import { Application, Container, Graphics } from "pixi.js";
import { PixiPlugin } from "gsap/PixiPlugin";

import type { CanvasDocumentDimensions } from "@/features/mermaid-editor/lib/canvas-document-rendering";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { gsap } from "@/features/mermaid-editor/lib/use-gsap-motion";

import {
  GRID_COLOR,
  MAX_RENDERER_RESOLUTION,
  MAX_TEXT_TEXTURE_RESOLUTION,
  MIN_RENDERER_RESOLUTION
} from "./constants";
import type { PixiCanvasRuntime } from "./types";

let pixiPluginRegistered = false;

export async function createPixiCanvasRuntime(dimensions: CanvasDocumentDimensions) {
  registerPixiPlugin();

  const app = new Application();
  await app.init({
    width: dimensions.width,
    height: dimensions.height,
    autoDensity: true,
    resolution: canvasRendererResolution(),
    autoStart: false,
    preference: "webgl",
    powerPreference: "high-performance",
    antialias: true,
    backgroundAlpha: 0
  });

  app.canvas.className = "block";
  app.canvas.style.display = "block";

  const grid = new Graphics();
  const world = new Container();
  const connectors = new Container();
  const objects = new Container();
  const selection = new Graphics();
  connectors.interactiveChildren = false;
  objects.interactiveChildren = false;
  selection.eventMode = "none";
  world.addChild(connectors, objects, selection);
  app.stage.addChild(grid, world);

  const pixi: PixiCanvasRuntime = {
    app,
    grid,
    world,
    connectors,
    objects,
    selection,
    views: new Map(),
    renderFrame: null,
    viewportCommitTimer: null,
    disposed: false
  };
  resizePixiRenderer(pixi, dimensions);
  return pixi;
}

export function destroyPixiCanvasRuntime(pixi: PixiCanvasRuntime) {
  pixi.disposed = true;
  if (pixi.renderFrame !== null) window.cancelAnimationFrame(pixi.renderFrame);
  if (pixi.viewportCommitTimer !== null) window.clearTimeout(pixi.viewportCommitTimer);
  for (const tween of gsap.getTweensOf([...pixi.views.values()].map((view) => view.container))) tween.kill();
  pixi.app.destroy({ removeView: true }, { children: true });
}

export function applyPixiViewport(pixi: PixiCanvasRuntime, viewport: ViewportState, dimensions: CanvasDocumentDimensions) {
  pixi.world.position.set(viewport.x, viewport.y);
  pixi.world.scale.set(viewport.scale);
  drawGrid(pixi.grid, viewport, dimensions);
}

export function resizePixiRenderer(pixi: PixiCanvasRuntime, dimensions: CanvasDocumentDimensions) {
  const width = Math.max(1, Math.floor(dimensions.width));
  const height = Math.max(1, Math.floor(dimensions.height));
  pixi.app.renderer.resize(width, height, canvasRendererResolution());
  pixi.app.canvas.style.width = `${width}px`;
  pixi.app.canvas.style.height = `${height}px`;
}

export function schedulePixiRender(pixi: PixiCanvasRuntime) {
  if (pixi.disposed || pixi.renderFrame !== null) return;
  pixi.renderFrame = window.requestAnimationFrame(() => {
    pixi.renderFrame = null;
    if (!pixi.disposed) pixi.app.render();
  });
}

export function parsePixiColor(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return Number.parseInt(trimmed.slice(1), 16);
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }
  return fallback;
}

export function canvasTextResolution(viewportScale: number) {
  const scaled = canvasRendererResolution() * Math.max(1, viewportScale);
  return Math.min(MAX_TEXT_TEXTURE_RESOLUTION, Math.max(MIN_RENDERER_RESOLUTION, Math.ceil(scaled * 2) / 2));
}

function registerPixiPlugin() {
  if (pixiPluginRegistered) return;
  gsap.registerPlugin(PixiPlugin);
  PixiPlugin.registerPIXI(PIXI);
  pixiPluginRegistered = true;
}

function canvasRendererResolution() {
  const ratio = typeof window === "undefined" ? MIN_RENDERER_RESOLUTION : window.devicePixelRatio || 1;
  return Math.min(MAX_RENDERER_RESOLUTION, Math.max(MIN_RENDERER_RESOLUTION, ratio));
}

function drawGrid(graphics: Graphics, viewport: ViewportState, dimensions: CanvasDocumentDimensions) {
  graphics.clear();
  const rawStep = 32 * viewport.scale;
  const step = rawStep < 8 ? rawStep * Math.ceil(8 / Math.max(rawStep, 0.01)) : rawStep;
  const offsetX = positiveModulo(viewport.x, step);
  const offsetY = positiveModulo(viewport.y, step);

  for (let x = offsetX; x < dimensions.width; x += step) {
    graphics.moveTo(x, 0).lineTo(x, dimensions.height);
  }
  for (let y = offsetY; y < dimensions.height; y += step) {
    graphics.moveTo(0, y).lineTo(dimensions.width, y);
  }
  graphics.stroke({ color: GRID_COLOR, width: 1, alpha: 0.08 });
}

function positiveModulo(value: number, modulus: number) {
  return ((value % modulus) + modulus) % modulus;
}
