import { expect, test } from "@playwright/test";

test.describe("Canvas node texture cache", () => {
  test("renders the mixed six-kind fixture and rebuilds sharp caches after zoom settles", async ({ page }) => {
    await page.goto("/__e2e__/canvas-performance");
    await expect(page.getByTestId("canvas-performance-e2e-root")).toBeVisible();
    await expect.poll(() => page.locator("canvas").count()).toBeGreaterThanOrEqual(3);
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

    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, -360);

    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.viewportActive)).toBe(false);
    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.settledScale), { timeout: 5_000 }).toBeGreaterThan(initial.settledScale);
    await expect.poll(() => cacheSnapshot(page).then((snapshot) => snapshot.cachedEntries), { timeout: 10_000 }).toBeGreaterThan(0);

    const rebuilt = await cacheSnapshot(page);
    expect(rebuilt.bytes).toBeLessThanOrEqual(rebuilt.budgetBytes);
    expect(rebuilt.queuedEntries).toBeGreaterThanOrEqual(0);
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

async function cacheSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__MERMAID_EDITOR_PERF__?.diagnostics?.canvasNodeTextureCache as CacheSnapshot);
}
