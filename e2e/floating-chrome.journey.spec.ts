import { expect, test } from "@playwright/test";

test.describe("Floating window titlebar journeys", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__e2e__/floating-chrome");
    await expect(page.getByTestId("floating-chrome-e2e-root")).toBeVisible();
  });

  test("keeps top content reachable outside the 8px reveal strip", async ({ page }) => {
    const panel = page.locator("[data-floating-panel-id='floating-chrome-e2e']");
    const header = page.locator("[data-workspace-panel-header='true']");
    const hotZone = page.locator("[data-floating-panel-header-hot-zone]");
    const panelBox = await requiredBox(panel);

    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "hidden");
    await expect(hotZone).toHaveCSS("height", "8px");
    await page.mouse.move(panelBox.x - 20, panelBox.y + 24);
    await page.getByTestId("floating-top-content").click();

    await expect(page.getByTestId("floating-top-content-clicks")).toHaveText("1");
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "hidden");
  });

  test("reveals immediately at the top edge and keeps center controls clickable", async ({ page }) => {
    const panel = page.locator("[data-floating-panel-id='floating-chrome-e2e']");
    const header = page.locator("[data-workspace-panel-header='true']");
    const hotZone = page.locator("[data-floating-panel-header-hot-zone]");
    const hotZoneBox = await requiredBox(hotZone);
    const initialLeft = (await requiredBox(panel)).x;

    await page.mouse.move(hotZoneBox.x + 120, hotZoneBox.y + 2);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "visible");
    await page.getByTestId("floating-titlebar-action").click();

    await expect(page.getByTestId("floating-titlebar-action-clicks")).toHaveText("1");
    expect((await requiredBox(panel)).x).toBe(initialLeft);
  });

  test("hides as soon as the pointer leaves the titlebar", async ({ page }) => {
    const header = page.locator("[data-workspace-panel-header='true']");
    const hotZoneBox = await requiredBox(page.locator("[data-floating-panel-header-hot-zone]"));

    await page.mouse.move(hotZoneBox.x + 120, hotZoneBox.y + 2);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "visible");
    await page.mouse.move(20, 20);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "hidden");
  });

  test("clicks terminal tabs but drags the window when a tab crosses the movement threshold", async ({ page }) => {
    const panel = page.locator("[data-floating-panel-id='floating-chrome-e2e']");
    const header = page.locator("[data-workspace-panel-header='true']");
    const hotZoneBox = await requiredBox(page.locator("[data-floating-panel-header-hot-zone]"));

    await page.mouse.move(hotZoneBox.x + 120, hotZoneBox.y + 2);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "visible");
    await page.getByTestId("terminal-two").click();
    await expect(page.getByTestId("active-terminal-tab")).toHaveText("terminal-two");

    const initial = await requiredBox(panel);
    const tab = page.getByTestId("terminal-one");
    const tabBox = await requiredBox(tab);
    await page.mouse.move(tabBox.x + 12, tabBox.y + tabBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(tabBox.x + 36, tabBox.y + tabBox.height / 2 + 10);
    await page.mouse.up();

    const moved = await requiredBox(panel);
    expect(moved.x).toBe(initial.x + 24);
    expect(moved.y).toBe(initial.y + 10);
    await expect(page.getByTestId("active-terminal-tab")).toHaveText("terminal-two");
  });

  test("drags the terminal window from unused tab-strip space", async ({ page }) => {
    const panel = page.locator("[data-floating-panel-id='floating-chrome-e2e']");
    const hotZoneBox = await requiredBox(page.locator("[data-floating-panel-header-hot-zone]"));
    await page.mouse.move(hotZoneBox.x + 120, hotZoneBox.y + 2);
    const initial = await requiredBox(panel);
    const stripBox = await requiredBox(page.getByTestId("terminal-tab-strip"));

    await page.mouse.move(stripBox.x + stripBox.width - 6, stripBox.y + stripBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(stripBox.x + stripBox.width + 14, stripBox.y + stripBox.height / 2 + 8);
    await page.mouse.up();

    const moved = await requiredBox(panel);
    expect(moved.x).toBe(initial.x + 20);
    expect(moved.y).toBe(initial.y + 8);
  });

  test("keeps terminal close controls interactive without moving the window", async ({ page }) => {
    const panel = page.locator("[data-floating-panel-id='floating-chrome-e2e']");
    const hotZoneBox = await requiredBox(page.locator("[data-floating-panel-header-hot-zone]"));
    await page.mouse.move(hotZoneBox.x + 120, hotZoneBox.y + 2);
    const initial = await requiredBox(panel);

    await page.getByRole("button", { name: "关闭测试终端 1" }).click();

    await expect(page.getByTestId("closed-terminal-tabs")).toHaveText("1");
    expect((await requiredBox(panel)).x).toBe(initial.x);
    expect((await requiredBox(panel)).y).toBe(initial.y);
  });

  test("ignores click jitter but moves after the drag threshold", async ({ page }) => {
    const panel = page.locator("[data-floating-panel-id='floating-chrome-e2e']");
    const header = page.locator("[data-workspace-panel-header='true']");
    const initial = await requiredBox(panel);
    const hotZoneBox = await requiredBox(page.locator("[data-floating-panel-header-hot-zone]"));

    await page.mouse.move(hotZoneBox.x + 120, hotZoneBox.y + 2);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "visible");
    const title = page.getByTestId("floating-title-drag-target");
    const titleBox = await requiredBox(title);
    await page.mouse.move(titleBox.x + 2, titleBox.y + titleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(titleBox.x + 5, titleBox.y + titleBox.height / 2);
    await page.mouse.up();
    expect((await requiredBox(panel)).x).toBe(initial.x);

    const secondTitleBox = await requiredBox(title);
    await page.mouse.move(secondTitleBox.x + 2, secondTitleBox.y + secondTitleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondTitleBox.x + 22, secondTitleBox.y + secondTitleBox.height / 2 + 12);
    await page.mouse.up();
    const moved = await requiredBox(panel);
    expect(moved.x).toBe(initial.x + 20);
    expect(moved.y).toBe(initial.y + 12);
  });
});

async function requiredBox(locator: import("@playwright/test").Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected element to have a bounding box.");
  return box;
}
