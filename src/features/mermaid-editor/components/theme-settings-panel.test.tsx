// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSettingsPanel } from "@/features/mermaid-editor/components/theme-settings-panel";
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

  it("opens the Markdown page and resets structured Markdown styles as a v5 custom theme", () => {
    const onPreview = vi.fn();
    act(() => {
      root?.render(
        createElement(ThemeSettingsPanel, {
          themeId: DEFAULT_EDITOR_THEME.id,
          customTheme: null,
          activeTheme: DEFAULT_EDITOR_THEME,
          onPreview,
          onCancel: vi.fn(),
          onSave: vi.fn()
        })
      );
    });

    const markdownTab = [...(container?.querySelectorAll("button") ?? [])].find((button) => button.textContent === "Markdown");
    expect(markdownTab).toBeDefined();
    act(() => markdownTab?.click());

    expect(container?.textContent).toContain("Markdown 排版");
    expect(container?.textContent).toContain("一级标题");
    expect(container?.textContent).toContain("分隔线与图片");

    const resetButton = [...(container?.querySelectorAll("button") ?? [])].find((button) => button.textContent === "重置 Markdown");
    expect(resetButton).toBeDefined();
    act(() => resetButton?.click());

    expect(onPreview).toHaveBeenCalledWith(
      "custom",
      expect.objectContaining({
        version: 5,
        markdown: expect.objectContaining({
          body: expect.objectContaining({ color: DEFAULT_EDITOR_THEME.ui.foreground }),
          heading: expect.objectContaining({ h1: expect.any(Object) }),
          codeBlock: expect.any(Object),
          table: expect.any(Object)
        })
      })
    );
  });
});
