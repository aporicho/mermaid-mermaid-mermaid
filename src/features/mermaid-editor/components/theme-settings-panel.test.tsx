// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSettingsPanel } from "@/features/mermaid-editor/components/theme-settings-panel";
import { toCustomTheme } from "@/features/mermaid-editor/components/theme-settings-utils";
import { DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";

describe("ThemeSettingsPanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  it("renders as workspace content with a category tree and no embedded preview", () => {
    renderPanel();

    expect(container?.querySelector("[data-theme-settings-panel]")).not.toBeNull();
    expect(container?.querySelector(".fixed")).toBeNull();
    expect(container?.textContent).toContain("主题库");
    expect(container?.textContent).toContain("诊断");
    expect(container?.textContent).not.toContain("样式预览");
  });

  it("shows structured Markdown groups and resets a group to the base theme", () => {
    const onPreview = vi.fn();
    const customTheme = toCustomTheme(DEFAULT_EDITOR_THEME);
    renderPanel({ themeId: "custom", customTheme, activeTheme: customTheme, onPreview });

    clickButton("Markdown");
    expect(container?.textContent).toContain("正文");
    expect(container?.textContent).toContain("一级标题");
    expect(container?.textContent).toContain("表格");

    const resetButton = container?.querySelector<HTMLButtonElement>('[aria-label="重置一级标题"]');
    expect(resetButton).not.toBeNull();
    act(() => resetButton?.click());

    expect(onPreview).toHaveBeenCalledWith(
      "custom",
      expect.objectContaining({
        version: 5,
        markdown: expect.objectContaining({
          heading: expect.objectContaining({ h1: DEFAULT_EDITOR_THEME.markdown.heading.h1 })
        })
      })
    );
  });

  it("keeps lower-level canvas tokens in an expandable advanced section", () => {
    renderPanel();
    clickButton("画布");

    const interactionGroup = container?.querySelector('[data-theme-settings-group="canvas-interaction"]');
    expect(interactionGroup?.textContent).not.toContain("小格显示缩放");
    const advancedButton = interactionGroup?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
    act(() => advancedButton?.click());
    expect(interactionGroup?.textContent).toContain("小格显示缩放");
    expect(interactionGroup?.querySelector('[data-theme-token-path="canvasInteraction.gridMinorVisibleScale"]')).not.toBeNull();
  });

  it("exposes explicit discard and apply actions without closing itself", () => {
    const onDiscard = vi.fn();
    const onApply = vi.fn();
    renderPanel({ hasDraft: true, onDiscard, onApply });

    clickButton("放弃更改");
    clickButton("应用");
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledOnce();
  });

  function renderPanel(overrides: Partial<Parameters<typeof ThemeSettingsPanel>[0]> = {}) {
    act(() => {
      root?.render(
        createElement(ThemeSettingsPanel, {
          themeId: DEFAULT_EDITOR_THEME.id,
          customTheme: null,
          activeTheme: DEFAULT_EDITOR_THEME,
          hasDraft: false,
          onPreview: vi.fn(),
          onDiscard: vi.fn(),
          onApply: vi.fn(),
          windowControls: createElement("span", null, "窗口控件"),
          ...overrides
        })
      );
    });
  }

  function clickButton(label: string) {
    const button = [...(container?.querySelectorAll("button") ?? [])].find((entry) => entry.textContent === label);
    expect(button).toBeDefined();
    act(() => button?.click());
  }
});
