import { expect, test } from "@playwright/test";

test.describe("Canvas node texture cache", () => {
  test("renders the mixed six-kind fixture and rebuilds sharp caches after zoom settles", async ({ page }) => {
    await page.goto("/__e2e__/canvas-performance");
    await expect(page.getByTestId("canvas-performance-e2e-root")).toBeVisible();
    await expect.poll(() => page.locator(".konvajs-content > canvas").count()).toBe(3);
    await expect.poll(() => compositorSnapshot(page).then((snapshot) => snapshot.layerCount)).toBe(3);
    await expect.poll(async () => {
      const snapshot = await cacheSnapshot(page);
      return ["standard", "link-card", "markdown-document", "html-document", "table"]
        .every((kind) => snapshot.byKind[kind] > 0);
    }, { timeout: 15_000 }).toBe(true);

    const initial = await cacheSnapshot(page);
    expect(initial.entries).toBeGreaterThan(0);
    expect(initial.registeredByKind.image).toBe(0);
    expect(initial.registeredByKind.standard).toBeGreaterThan(0);
    expect(initial.byKind.standard).toBeGreaterThan(0);
    expect(initial.byKind["link-card"]).toBeGreaterThan(0);
    expect(initial.byKind["markdown-document"]).toBeGreaterThan(0);
    expect(initial.byKind["html-document"]).toBeGreaterThan(0);
    expect(initial.byKind.table).toBeGreaterThan(0);
    expect(initial.bytes).toBeLessThanOrEqual(initial.budgetBytes);

    await page.mouse.click(86, 65);
    await expect.poll(() => page.evaluate(() => window.__MMM_CANVAS_PERF_E2E__?.state().selection.nodeIds[0])).toBe("M1");
    await page.waitForTimeout(100);
    const initialCompositor = await compositorSnapshot(page);

    const initialViewport = await page.evaluate(() => window.__MMM_CANVAS_PERF_E2E__?.state().viewport);
    expect(initialViewport).toBeDefined();
    await startCompositorFrameProbe(page);
    await page.evaluate(() => {
      const runtimeWindow = window as typeof window & { __MMM_STABLE_CANVAS_STYLES__?: string[] };
      runtimeWindow.__MMM_STABLE_CANVAS_STYLES__ = [];
      for (const canvas of [...document.querySelectorAll<HTMLCanvasElement>(".konvajs-content > canvas")].slice(0, 2)) {
        const record = () => runtimeWindow.__MMM_STABLE_CANVAS_STYLES__?.push(canvas.getAttribute("style") || "");
        record();
        new MutationObserver(record).observe(canvas, { attributes: true, attributeFilter: ["style"] });
      }
    });
    await page.mouse.move(1120, 700);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(1040, 650, { steps: 4 });
    await page.mouse.up({ button: "middle" });
    await expect.poll(() => page.evaluate(() => window.__MMM_CANVAS_PERF_E2E__?.state().viewport)).toEqual({
      x: initialViewport!.x - 80,
      y: initialViewport!.y - 50,
      scale: initialViewport!.scale
    });
    await expect.poll(() => compositorSnapshot(page).then((snapshot) => snapshot.navigationActive)).toBe(false);
    await expect.poll(() => compositorSnapshot(page).then((snapshot) => snapshot.baseViewport)).toEqual({
      x: initialViewport!.x - 80,
      y: initialViewport!.y - 50,
      scale: initialViewport!.scale
    });
    const panFrames = await stopCompositorFrameProbe(page);
    expect(panFrames.length).toBeGreaterThan(1);
    expect(panFrames.every((frame) => frame.stableViewportGeneration === frame.activeViewportGeneration)).toBe(true);
    const settledPanCompositor = await compositorSnapshot(page);
    const stableStyles = await page.evaluate(() => (window as typeof window & { __MMM_STABLE_CANVAS_STYLES__?: string[] }).__MMM_STABLE_CANVAS_STYLES__ || []);
    expect(stableStyles.length).toBeGreaterThan(2);
    expect(stableStyles.every((style) => style.includes("transform:") && style.includes("will-change: transform"))).toBe(true);

    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await startCompositorFrameProbe(page);
    await page.mouse.wheel(0, -360);

    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.viewportActive)).toBe(false);
    await expect.poll(() => compositorSnapshot(page).then((snapshot) => snapshot.navigationActive)).toBe(false);
    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.settledScale), { timeout: 5_000 }).toBeGreaterThan(initial.settledScale);
    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.cachedEntries), { timeout: 10_000 }).toBeGreaterThan(0);
    const zoomFrames = await stopCompositorFrameProbe(page);
    expect(zoomFrames.length).toBeGreaterThan(1);
    expect(zoomFrames.every((frame) => frame.stableViewportGeneration === frame.activeViewportGeneration)).toBe(true);

    const rebuilt = await cacheSnapshot(page);
    const rebuiltCompositor = await compositorSnapshot(page);
    const finalViewport = await page.evaluate(() => window.__MMM_CANVAS_PERF_E2E__?.state().viewport);
    expect(finalViewport).toBeDefined();
    expect(rebuilt.bytes).toBeLessThanOrEqual(rebuilt.budgetBytes);
    expect(rebuilt.queuedEntries).toBeGreaterThanOrEqual(0);
    expect(rebuiltCompositor.hitBufferPixels).toBe(3);
    expect(rebuiltCompositor.baseViewport).toEqual(finalViewport);
    expect(rebuiltCompositor.liveViewport).toEqual(finalViewport);
    expect(rebuiltCompositor.compositeFrames).toBeGreaterThan(initialCompositor.compositeFrames);
    expect(rebuiltCompositor.sceneDraws - settledPanCompositor.sceneDraws).toBeLessThanOrEqual(3);
    expect(rebuiltCompositor.guardedRebases).toBeGreaterThan(0);
    expect(rebuiltCompositor.queuedSceneInvalidations).toBe(0);
  });

  test("keeps a dragged node monotonic through active-layer promotion and restoration", async ({ page }) => {
    await page.goto("/__e2e__/canvas-performance");
    await expect(page.getByTestId("canvas-performance-e2e-root")).toBeVisible();
    await expect.poll(() => page.locator(".konvajs-content > canvas").count()).toBe(3);
    await page.mouse.click(86, 65);
    await expect.poll(() => page.evaluate(() => window.__MMM_CANVAS_PERF_E2E__?.state().selection.nodeIds[0])).toBe("M1");
    await startNodeFrameProbe(page, "M1");

    await page.mouse.move(86, 65);
    await page.mouse.down();
    for (let step = 1; step <= 8; step += 1) {
      await page.mouse.move(86 + step * 12, 65 + step * 6);
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.__MMM_CANVAS_PERF_E2E__?.state().graph.nodes[0]?.x)).toBeGreaterThan(0);
    const frames = await stopNodeFrameProbe(page);
    const positioned = frames.filter((frame): frame is NodeFrame & { x: number; y: number } => typeof frame.x === "number" && typeof frame.y === "number");

    expect(positioned.length).toBeGreaterThan(3);
    expect(isMonotonic(positioned.map((frame) => frame.x))).toBe(true);
    expect(isMonotonic(positioned.map((frame) => frame.y))).toBe(true);
    expect(positioned.some((frame) => frame.parent === "canvas-active-visuals")).toBe(true);
    await expect.poll(() => nodeVisualSnapshot(page, "M1").then((snapshot) => snapshot?.parent)).toBe("canvas-scene-layer");
    const finalVisual = await nodeVisualSnapshot(page, "M1");
    const finalGraphNode = await page.evaluate(() => window.__MMM_CANVAS_PERF_E2E__?.state().graph.nodes[0]);
    expect(finalVisual?.x).toBe(finalGraphNode?.x);
    expect(finalVisual?.y).toBe(finalGraphNode?.y);
  });
});

type CacheSnapshot = {
  entries: number;
  cachedEntries: number;
  bytes: number;
  budgetBytes: number;
  queuedEntries: number;
  viewportActive: boolean;
  settledScale: number;
  byKind: Record<string, number>;
  registeredByKind: Record<string, number>;
};

type CompositorSnapshot = {
  compositeFrames: number;
  sceneDraws: number;
  layerCount: number;
  hitBufferPixels: number;
  baseViewport: { x: number; y: number; scale: number };
  liveViewport: { x: number; y: number; scale: number };
  navigationActive: boolean;
  stableViewportGeneration: number;
  activeViewportGeneration: number;
  guardedRebases: number;
  queuedSceneInvalidations: number;
};

type CompositorFrame = Pick<CompositorSnapshot, "stableViewportGeneration" | "activeViewportGeneration">;

type NodeFrame = {
  x?: number;
  y?: number;
  parent?: string;
};

async function cacheSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__MERMAID_EDITOR_PERF__?.diagnostics?.canvasNodeTextureCache as CacheSnapshot);
}

async function compositorSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__MERMAID_EDITOR_PERF__?.diagnostics?.canvasCompositor as CompositorSnapshot);
}

async function startCompositorFrameProbe(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const runtime = window as typeof window & {
      __MMM_COMPOSITOR_FRAME_PROBE__?: { running: boolean; frames: CompositorFrame[] };
    };
    const probe = { running: true, frames: [] as CompositorFrame[] };
    runtime.__MMM_COMPOSITOR_FRAME_PROBE__ = probe;
    const sample = () => {
      const snapshot = window.__MERMAID_EDITOR_PERF__?.diagnostics?.canvasCompositor as CompositorSnapshot | undefined;
      if (snapshot) probe.frames.push({
        stableViewportGeneration: snapshot.stableViewportGeneration,
        activeViewportGeneration: snapshot.activeViewportGeneration
      });
      if (probe.running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function stopCompositorFrameProbe(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const runtime = window as typeof window & {
      __MMM_COMPOSITOR_FRAME_PROBE__?: { running: boolean; frames: CompositorFrame[] };
    };
    if (!runtime.__MMM_COMPOSITOR_FRAME_PROBE__) return [];
    runtime.__MMM_COMPOSITOR_FRAME_PROBE__.running = false;
    return runtime.__MMM_COMPOSITOR_FRAME_PROBE__.frames;
  });
}

async function startNodeFrameProbe(page: import("@playwright/test").Page, nodeId: string) {
  await page.evaluate((id) => {
    type VisualNode = { id: () => string; x: () => number; y: () => number; parent?: { name: () => string } };
    const runtime = window as typeof window & {
      Konva?: { stages: Array<{ findOne: (predicate: (node: VisualNode) => boolean) => VisualNode | undefined }> };
      __MMM_NODE_FRAME_PROBE__?: { running: boolean; frames: NodeFrame[] };
    };
    const probe = { running: true, frames: [] as NodeFrame[] };
    runtime.__MMM_NODE_FRAME_PROBE__ = probe;
    const sample = () => {
      const node = runtime.Konva?.stages[0]?.findOne((candidate) => candidate.id() === `node-visual:${id}`);
      probe.frames.push({ x: node?.x(), y: node?.y(), parent: node?.parent?.name() });
      if (probe.running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, nodeId);
}

async function stopNodeFrameProbe(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const runtime = window as typeof window & {
      __MMM_NODE_FRAME_PROBE__?: { running: boolean; frames: NodeFrame[] };
    };
    if (!runtime.__MMM_NODE_FRAME_PROBE__) return [];
    runtime.__MMM_NODE_FRAME_PROBE__.running = false;
    return runtime.__MMM_NODE_FRAME_PROBE__.frames;
  });
}

async function nodeVisualSnapshot(page: import("@playwright/test").Page, nodeId: string) {
  return page.evaluate((id) => {
    type VisualNode = { id: () => string; x: () => number; y: () => number; parent?: { name: () => string } };
    const runtime = window as typeof window & {
      Konva?: { stages: Array<{ findOne: (predicate: (node: VisualNode) => boolean) => VisualNode | undefined }> };
    };
    const node = runtime.Konva?.stages[0]?.findOne((candidate) => candidate.id() === `node-visual:${id}`);
    return node ? { x: node.x(), y: node.y(), parent: node.parent?.name() } : null;
  }, nodeId);
}

function isMonotonic(values: number[]) {
  return values.every((value, index) => index === 0 || value >= values[index - 1] - 0.001);
}
