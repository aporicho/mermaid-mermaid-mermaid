import { expect, test, type Locator, type Page } from "@playwright/test";

type ExplorerE2EEvent = {
  type: string;
  [key: string]: unknown;
};

test.describe("Explorer tree journeys", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__e2e__/explorer");
    await expect(page.getByTestId("explorer-e2e-root")).toBeVisible();
    await page.evaluate(() => window.__MMM_EXPLORER_E2E__?.reset());
    await expect(tree(page)).toBeVisible();
  });

  test("reveals the floating titlebar only from the top edge and keeps tree controls usable", async ({ page }) => {
    const panel = explorerPanel(page);
    const header = page.locator("[data-workspace-panel-header='true']");

    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "hidden");
    const panelBox = await requiredBox(panel);
    await page.mouse.move(panelBox.x + 120, panelBox.y + 110);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "hidden");

    await page.mouse.move(panelBox.x + 120, panelBox.y + 2);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "visible");

    await page.mouse.move(panelBox.x + 120, panelBox.y + 160);
    await expect(header).toHaveAttribute("data-workspace-panel-header-state", "hidden", { timeout: 2_000 });

    await expect(resourceRow(page, "docs")).not.toHaveCSS("cursor", "grab");
    await expect(resourceRow(page, "docs/note.md")).not.toHaveCSS("cursor", "grab");

    await searchInput(page).click();
    await searchInput(page).fill("cover");
    await expect(resourceRow(page, "docs")).toBeVisible();
    await expect(resourceRow(page, "docs/cover.png")).toBeVisible();
    await expect(resourceRow(page, "docs/note.md")).toHaveCount(0);
  });

  test("supports search, keyboard navigation, file opening, and unsupported-file status", async ({ page }) => {
    await resourceRow(page, "docs").focus();
    await page.keyboard.press(modifierShortcut("F"));
    await expect(searchInput(page)).toBeFocused();
    await searchInput(page).fill("note");
    await expect(resourceRow(page, "docs")).toBeVisible();
    await expect(resourceRow(page, "docs/note.md")).toBeVisible();
    await expect(resourceRow(page, "docs/cover.png")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(searchInput(page)).toHaveValue("");
    await expect(resourceRow(page, "docs/cover.png")).toBeVisible();

    await rootRow(page).focus();
    await page.keyboard.press("ArrowDown");
    await expect(resourceRow(page, "docs")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(resourceRow(page, "docs/core")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(resourceRow(page, "docs")).toBeFocused();

    await resourceRow(page, "docs/note.md").dblclick();
    await expectEvent(page, { type: "open-file", surface: "editor", relativePath: "docs/note.md" });

    await resourceRow(page, "README.txt").dblclick();
    await expectEvent(page, { type: "open-file", surface: "editor", relativePath: "README.txt" });
    await resourceRow(page, "docs/theme.css").dblclick();
    await expectEvent(page, { type: "status", message: "暂不支持打开 theme.css。" });
  });

  test("renames inline from both selected-name click and F2 without opening a dialog", async ({ page }) => {
    await selectResourceRow(page, "docs/note.md");
    await page.waitForTimeout(350);
    await resourceName(page, "docs/note.md").click();
    const renameInput = page.getByLabel("重命名 note.md");
    await expect(renameInput).toBeVisible();
    await expect(page.getByRole("dialog", { name: /重命名 note\.md/ })).toHaveCount(0);

    await renameInput.fill("renamed.md");
    await renameInput.press("Enter");
    await expectEvent(page, { type: "rename", relativePath: "docs/note.md", name: "renamed.md" });
    await expect(resourceRow(page, "docs/renamed.md")).toBeVisible();

    await resourceRow(page, "docs/diagram.mmd").focus();
    await page.keyboard.press("F2");
    const keyboardRenameInput = page.getByLabel("重命名 diagram.mmd");
    await expect(keyboardRenameInput).toBeVisible();
    await keyboardRenameInput.fill("diagram-next.mmd");
    await keyboardRenameInput.press("Escape");
    await expect(resourceRow(page, "docs/diagram.mmd")).toBeVisible();
    await expectNoEvent(page, { type: "rename", relativePath: "docs/diagram.mmd" });
  });

  test("uses contextual menus for file actions, copy/paste, and multi-select delete", async ({ page }) => {
    await resourceRow(page, "docs/note.md").click();
    await resourceRow(page, "docs/note.md").click({ button: "right" });
    let menu = page.getByRole("menu", { name: "note.md 操作" });
    await expect(menu).toBeVisible();
    await expect(menuItems(menu)).toHaveText([
      "打开",
      "在浮窗中打开",
      "移动到…",
      "重命名",
      "删除",
      "复制",
      "复制路径",
      "复制相对路径",
      "在 Finder 中显示"
    ]);

    await menuItem(menu, "在浮窗中打开").click();
    await expectEvent(page, { type: "open-file", surface: "markdown-window", relativePath: "docs/note.md" });

    await resourceRow(page, "docs/note.md").click({ button: "right" });
    menu = page.getByRole("menu", { name: "note.md 操作" });
    await menuItem(menu, "复制").click();
    await expectEvent(page, { type: "status", message: "已复制 1 项，选择目标文件夹后可粘贴。" });

    await resourceRow(page, "empty").click({ button: "right" });
    menu = page.getByRole("menu", { name: "empty 操作" });
    await expect(menuItem(menu, "粘贴")).not.toHaveAttribute("data-disabled", /.*/);
    await menuItem(menu, "粘贴").click();
    await expectEvent(page, { type: "copy", relativePaths: ["docs/note.md"], targetDirectoryPath: "empty" });

    const modifier = multiSelectModifier();
    await resourceRow(page, "docs/note.md").click();
    await resourceRow(page, "docs/diagram.mmd").click({ modifiers: [modifier] });
    await resourceRow(page, "docs/note.md").click({ button: "right" });
    menu = page.getByRole("menu", { name: "note.md 操作" });
    await expect(menuItem(menu, "重命名")).toHaveAttribute("data-disabled", /.*/);
    await menuItem(menu, "删除").click();

    const deleteDialog = page.getByRole("dialog", { name: "删除 2 项" });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog.getByText("note.md", { exact: true }).first()).toBeVisible();
    await expect(deleteDialog.getByText("diagram.mmd", { exact: true }).first()).toBeVisible();
    await deleteDialog.getByRole("button", { name: "删除" }).click();
    await expectEvent(page, { type: "delete", relativePaths: ["docs/note.md", "docs/diagram.mmd"] });
  });

  test("opens typed resources from double click and validates file icons", async ({ page }) => {
    const expectedIcons: Record<string, string> = {
      "docs/diagram.mmd": "mermaid",
      "docs/note.md": "markdown",
      "docs/people.csv": "csv",
      "docs/index.html": "html",
      "docs/cover.png": "png",
      "docs/theme.css": "code",
      "README.txt": "text"
    };

    for (const [relativePath, icon] of Object.entries(expectedIcons)) {
      await expect(resourceRow(page, relativePath).locator("[data-project-resource-icon]")).toHaveAttribute("data-project-resource-icon", icon);
    }

    await resourceRow(page, "docs/index.html").dblclick();
    await expectEvent(page, { type: "open-file", surface: "html-window", relativePath: "docs/index.html" });
    await resourceRow(page, "docs/cover.png").dblclick();
    await expectEvent(page, { type: "open-file", surface: "image-window", relativePath: "docs/cover.png" });
    await resourceRow(page, "docs/people.csv").dblclick();
    await expectEvent(page, { type: "open-file", surface: "editor", relativePath: "docs/people.csv" });
    await resourceRow(page, "README.txt").dblclick();
    await expectEvent(page, { type: "open-file", surface: "editor", relativePath: "README.txt" });

    await resourceRow(page, "docs/people.csv").click({ button: "right" });
    await menuItem(page.getByRole("menu", { name: "people.csv 操作" }), "在浮窗中打开").click();
    await expectEvent(page, { type: "open-file", surface: "csv-window", relativePath: "docs/people.csv" });
    await resourceRow(page, "README.txt").click({ button: "right" });
    await menuItem(page.getByRole("menu", { name: "README.txt 操作" }), "在浮窗中打开").click();
    await expectEvent(page, { type: "open-file", surface: "text-window", relativePath: "README.txt" });
  });

  test("drags rows with overlay, insertion gap, reorder, directory move, and canvas handoff", async ({ page }) => {
    await dragRow(page, resourceRow(page, "docs/cover.png"), resourceRow(page, "docs/people.csv"), { targetRatioY: 0.25, holdBeforeDrop: true });
    await expect(page.locator("[data-project-resource-insertion]")).toHaveCount(0);
    const reorderEvent = await expectEvent(page, {
      type: "reorder",
      parentDirectoryPath: "docs",
      kind: "file"
    });
    const orderedRelativePaths = (reorderEvent as { orderedRelativePaths?: unknown }).orderedRelativePaths;
    expect(Array.isArray(orderedRelativePaths)).toBe(true);
    expect(orderedRelativePaths).toEqual(expect.arrayContaining([
      "docs/cover.png",
      "docs/diagram.mmd",
      "docs/index.html",
      "docs/note.md",
      "docs/people.csv",
      "docs/theme.css"
    ]));
    expect((orderedRelativePaths as string[]).indexOf("docs/cover.png")).toBeGreaterThan(0);

    await dragRow(page, resourceRow(page, "docs/theme.css"), resourceRow(page, "empty"));
    await expectEvent(page, { type: "move", relativePaths: ["docs/theme.css"], targetDirectoryPath: "empty" });

    const panelBox = await requiredBox(explorerPanel(page));
    const canvasNodeFiles = [
      { relativePath: "docs/note.md", kind: "markdown" },
      { relativePath: "docs/index.html", kind: "html" },
      { relativePath: "README.txt", kind: "text" },
      { relativePath: "docs/people.csv", kind: "csv" },
      { relativePath: "docs/cover.png", kind: "image" }
    ];
    for (const [index, file] of canvasNodeFiles.entries()) {
      await dragRowToPoint(page, resourceRow(page, file.relativePath), panelBox.x + panelBox.width + 120, panelBox.y + 180 + index * 20);
      await expectLastEvent(page, { type: "canvas-drag", relativePath: file.relativePath, kind: file.kind, phase: "drop" });
    }
  });

  test("opens an unmarked gap while dragging the last visible file", async ({ page }) => {
    const sourceItem = connectorItemForResource(page, "README.txt");
    const previousItem = connectorItemForResource(page, "ideas.md");

    await expect(sourceItem).toHaveAttribute("data-tree-visual-last", "true");
    await startDraggingRow(page, resourceRow(page, "README.txt"));

    await expect(sourceItem).toHaveAttribute("data-tree-connector-hidden", "true");
    await expectConnectorPseudoDisplay(sourceItem, "none");
    await expect(previousItem).toHaveAttribute("data-tree-visual-last", "true");

    const previousBox = await requiredBox(resourceRow(page, "ideas.md"));
    await page.mouse.move(previousBox.x + previousBox.width / 2, previousBox.y + previousBox.height * 0.75, { steps: 8 });

    const insertion = page.locator("[data-project-resource-insertion]");
    await expect(insertion).toBeVisible();
    await expect(insertion).not.toHaveAttribute("data-editor-tree-item", "true");
    await expect(insertion).toHaveText("");
    await expect(insertion).toHaveCSS("height", "8px");
    await expect(previousItem).toHaveAttribute("data-tree-visual-last", "true");

    await page.mouse.up();
    await expect(page.locator("[data-project-resource-insertion]")).toHaveCount(0);
    await expectTreeRowsSettled(page);
  });

  test("keeps tree row spacing stable after repeated animated reorders", async ({ page }) => {
    await expectTreeRowsSettled(page);
    await dragRow(page, resourceRow(page, "docs/cover.png"), resourceRow(page, "docs/people.csv"), { targetRatioY: 0.25 });
    await expectTreeRowsSettled(page);

    await dragRow(page, resourceRow(page, "docs/people.csv"), resourceRow(page, "docs/diagram.mmd"), { targetRatioY: 0.25 });
    await expectTreeRowsSettled(page);

    await dragRow(page, resourceRow(page, "docs/note.md"), resourceRow(page, "docs/index.html"), { targetRatioY: 0.25 });
    await expectTreeRowsSettled(page);

    await dragRow(page, resourceRow(page, "docs/diagram.mmd"), resourceRow(page, "docs/theme.css"), { targetRatioY: 0.75 });
    await expectTreeRowsSettled(page);
  });

  test("keeps journeys usable in a narrow explorer window", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 760 });
    await page.goto("/__e2e__/explorer");
    await expect(tree(page)).toBeVisible();

    await expect(rootRow(page).locator("span").first()).toHaveClass("min-w-0 truncate");
    await expect(resourceRow(page, "docs/note.md")).toBeVisible();
    await expect(resourceRow(page, "docs/note.md").locator("[data-project-resource-name]")).toHaveCSS("overflow", "hidden");

    await selectResourceRow(page, "docs/note.md");
    await page.waitForTimeout(350);
    await resourceName(page, "docs/note.md").click();
    await expect(page.getByLabel("重命名 note.md")).toBeVisible();
  });
});

function tree(page: Page) {
  return page.getByRole("tree", { name: "project 资源树" });
}

function explorerPanel(page: Page) {
  return page.locator("[data-floating-panel-id='explorer']");
}

function searchInput(page: Page) {
  return page.getByLabel("搜索资源");
}

function rootRow(page: Page) {
  return page.locator("[data-project-directory-path='']").first();
}

function resourceRow(page: Page, relativePath: string) {
  return page.locator(`[role='treeitem'][data-project-resource-relative-path='${cssString(relativePath)}']`);
}

function resourceName(page: Page, relativePath: string) {
  return resourceRow(page, relativePath).locator("[data-project-resource-name]");
}

function connectorItemForResource(page: Page, relativePath: string) {
  return resourceRow(page, relativePath).locator("xpath=ancestor::*[@data-editor-tree-item][1]");
}

async function selectResourceRow(page: Page, relativePath: string) {
  const box = await requiredBox(resourceRow(page, relativePath));
  await page.mouse.click(box.x + 8, box.y + box.height / 2);
}

function menuItems(menu: Locator) {
  return menu.locator("[role='menuitem']");
}

function menuItem(menu: Locator, label: string) {
  return menu.getByRole("menuitem", { name: label, exact: true });
}

async function dragRow(
  page: Page,
  source: Locator,
  target: Locator,
  options: { targetRatioY?: number; holdBeforeDrop?: boolean } = {}
) {
  const sourceBox = await startDraggingRow(page, source);
  const targetBox = await requiredBox(target);
  const x = targetBox.x + targetBox.width / 2;
  const y = targetBox.y + targetBox.height * (options.targetRatioY ?? 0.5);
  await page.mouse.move(x, y, { steps: 8 });
  await expectDraggingRowPreview(page, source, sourceBox, x, y);
  if (options.holdBeforeDrop) await expect(page.locator("[data-project-resource-insertion]")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator("[data-project-resource-drag-overlay]")).toHaveCount(0);
}

async function dragRowToPoint(
  page: Page,
  source: Locator,
  x: number,
  y: number,
  options: { holdBeforeDrop?: boolean } = {}
) {
  const sourceBox = await startDraggingRow(page, source);
  await page.mouse.move(x, y, { steps: 8 });
  await expectDraggingRowPreview(page, source, sourceBox, x, y);
  if (options.holdBeforeDrop) await expect(page.locator("[data-project-resource-insertion]")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator("[data-project-resource-drag-overlay]")).toHaveCount(0);
}

async function startDraggingRow(page: Page, source: Locator) {
  const sourceBox = await requiredBox(source);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 14, sourceBox.y + sourceBox.height / 2 + 8, { steps: 2 });
  await expect(page.locator("[data-project-resource-drag-overlay]")).toBeVisible();
  await expectCollapsedSourceSlot(source);
  return sourceBox;
}

async function expectDraggingRowPreview(page: Page, source: Locator, sourceBox: { width: number; height: number }, x: number, y: number) {
  const overlay = page.locator("[data-project-resource-drag-overlay]");
  await expect(overlay).toBeVisible();
  await expect(source).toHaveCSS("opacity", "0");
  await expectCollapsedSourceSlot(source);
  await expect(source).toHaveCSS("cursor", "grabbing");
  await expect.poll(async () => {
    const box = await overlay.boundingBox();
    return box ? Math.abs(box.width - sourceBox.width) : 9_999;
  }).toBeLessThan(2);
  await expect.poll(async () => {
    const box = await overlay.boundingBox();
    return box ? Math.abs(box.x - (x - sourceBox.width / 2)) : 9_999;
  }).toBeLessThan(40);
  await expect.poll(async () => {
    const box = await overlay.boundingBox();
    return box ? Math.abs(box.y - (y - sourceBox.height / 2)) : 9_999;
  }).toBeLessThan(40);
}

async function expectCollapsedSourceSlot(source: Locator) {
  await expect(source).toHaveCSS("position", "absolute");
  await expect.poll(async () => source.evaluate((element) => element.closest("[data-editor-tree-item]")?.getBoundingClientRect().height ?? 9_999)).toBeLessThan(1);
}

async function expectConnectorPseudoDisplay(item: Locator, display: string) {
  await expect.poll(() => item.evaluate((element) => ({
    before: getComputedStyle(element, "::before").display,
    after: getComputedStyle(element, "::after").display
  }))).toEqual({ before: display, after: display });
}

async function expectTreeRowsSettled(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const rows = [...document.querySelectorAll<HTMLElement>('[role="treeitem"][data-project-resource-relative-path]')]
      .map((row) => {
        const rect = row.getBoundingClientRect();
        const transform = getComputedStyle(row).transform;
        return {
          dragging: row.getAttribute("data-project-resource-dragging") === "true",
          top: rect.top,
          height: rect.height,
          transform
        };
      })
      .filter((row) => row.height > 0 || row.dragging)
      .sort((left, right) => left.top - right.top);
    const visibleRows = rows.filter((row) => !row.dragging && row.height > 0);
    const gaps = visibleRows.slice(0, -1).map((row, index) => {
      const next = visibleRows[index + 1];
      return next.top - row.top - row.height;
    });
    return {
      rowHeightCount: new Set(visibleRows.map((row) => Math.round(row.height * 100) / 100)).size,
      nonZeroGapCount: gaps.filter((gap) => Math.abs(gap) > 0.5).length,
      transformCount: rows.filter((row) => row.transform !== "none").length,
      insertionCount: document.querySelectorAll("[data-project-resource-insertion]").length
    };
  })).toEqual({
    rowHeightCount: 1,
    nonZeroGapCount: 0,
    transformCount: 0,
    insertionCount: 0
  });
}

async function requiredBox(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected visible element with a layout box.");
  return box;
}

async function expectEvent(page: Page, expected: Partial<ExplorerE2EEvent>) {
  await expect.poll(() => matchingEvents(page, expected)).not.toEqual([]);
  const [event] = await matchingEvents(page, expected);
  if (!event) throw new Error(`Expected event ${JSON.stringify(expected)}.`);
  return event;
}

async function expectNoEvent(page: Page, expected: Partial<ExplorerE2EEvent>) {
  await expect.poll(() => matchingEvents(page, expected)).toEqual([]);
}

async function expectLastEvent(page: Page, expected: Partial<ExplorerE2EEvent>) {
  await expect.poll(async () => {
    const events = await eventsLog(page);
    return events.at(-1);
  }).toMatchObject(expected);
}

async function matchingEvents(page: Page, expected: Partial<ExplorerE2EEvent>) {
  const events = await eventsLog(page);
  return events.filter((event) => eventMatches(event, expected));
}

async function eventsLog(page: Page) {
  return page.evaluate(() => window.__MMM_EXPLORER_E2E__?.getEvents() ?? []);
}

function eventMatches(event: ExplorerE2EEvent, expected: Partial<ExplorerE2EEvent>) {
  return Object.entries(expected).every(([key, value]) => JSON.stringify(event[key]) === JSON.stringify(value));
}

function modifierShortcut(key: string) {
  return `${process.platform === "darwin" ? "Meta" : "Control"}+${key}`;
}

function multiSelectModifier() {
  return process.platform === "darwin" ? "Meta" : "Control";
}

function cssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
