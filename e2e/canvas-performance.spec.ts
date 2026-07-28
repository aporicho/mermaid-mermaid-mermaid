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
    const settledPanCompositor = await compositorSnapshot(page);
    const stableStyles = await page.evaluate(() => (window as typeof window & { __MMM_STABLE_CANVAS_STYLES__?: string[] }).__MMM_STABLE_CANVAS_STYLES__ || []);
    expect(stableStyles.length).toBeGreaterThan(2);
    expect(stableStyles.every((style) => style.includes("transform:") && style.includes("will-change: transform"))).toBe(true);

    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, -360);

    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.viewportActive)).toBe(false);
    await expect.poll(() => compositorSnapshot(page).then((snapshot) => snapshot.navigationActive)).toBe(false);
    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.settledScale), { timeout: 5_000 }).toBeGreaterThan(initial.settledScale);
    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.cachedEntries), { timeout: 10_000 }).toBeGreaterThan(0);

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
};

async function cacheSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__MERMAID_EDITOR_PERF__?.diagnostics?.canvasNodeTextureCache as CacheSnapshot);
}

async function compositorSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__MERMAID_EDITOR_PERF__?.diagnostics?.canvasCompositor as CompositorSnapshot);
}
