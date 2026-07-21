// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSettingsPanel } from "@/features/mermaid-editor/components/theme-settings-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
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
    expect(container?.textContent).not.toContain("选择预设后会立即应用");
    expect(container?.textContent).not.toContain("当前编辑副本");
    expect(container?.textContent).not.toContain("当前设置已应用");
  });

  it("keeps explanations out of the visual hierarchy while retaining accessible reset actions", () => {
    const customTheme = toCustomTheme(DEFAULT_EDITOR_THEME);
    renderPanel({ themeId: "custom", customTheme, activeTheme: customTheme });

    clickButton("Markdown");
    expect(container?.textContent).not.toContain("每个元素的排版、色彩、布局和边框集中在同一处");
    expect(container?.textContent).not.toContain("正文排版、颜色和段落间距");
    expect(container?.textContent).not.toContain("markdown.body.fontFamily");
    expect(container?.textContent).not.toContain("默认：");
    expect(container?.querySelector('[aria-label="重置全部 Markdown 外观"]')).not.toBeNull();
    expect(container?.querySelector('[aria-label="重置基础"]')).not.toBeNull();
    clickButton("基础");
    clickButton("正文与段落");
    expect(container?.querySelector('[data-theme-token-path="markdown.body.fontFamily"]')).not.toBeNull();

    clickButton("界面");
    clickButton("界面基础");
    expect(container?.textContent).not.toContain("每个角色的字体、字号、字重、行高和字距完全独立");
    expect(container?.textContent).not.toContain("应用正文、控件、导航、菜单和技术信息");
    expect(container?.querySelector('[aria-label="重置界面基础"]')).not.toBeNull();
    expect(container?.querySelector('[aria-label="重置正文"]')).not.toBeNull();
  });

  it("shows Markdown tokens grouped by element and resets one element to the base theme", () => {
    const onPreview = vi.fn();
    const customTheme = toCustomTheme(DEFAULT_EDITOR_THEME);
    renderPanel({ themeId: "custom", customTheme, activeTheme: customTheme, onPreview });

    clickButton("Markdown");
    expect(container?.querySelector('[data-markdown-category="base"]')).not.toBeNull();
    expect(container?.querySelector('[data-markdown-category="heading"]')).not.toBeNull();
    expect(container?.querySelector('[data-markdown-category="inline"]')).not.toBeNull();
    expect(container?.querySelector('[data-markdown-category="block"]')).not.toBeNull();
    for (const category of ["基础", "标题", "行内语义", "块级语义"]) clickButton(category);
    expect(container?.textContent).toContain("正文与段落");
    expect(container?.textContent).toContain("一级标题");
    expect(container?.textContent).toContain("删除线");
    expect(container?.textContent).toContain("无序列表");
    expect(container?.textContent).toContain("有序列表");
    expect(container?.textContent).toContain("任务列表");
    expect(container?.textContent).toContain("表格");

    const resetButton = container?.querySelector<HTMLButtonElement>('[aria-label="重置一级标题"]');
    expect(resetButton).not.toBeNull();
    act(() => resetButton?.click());

    expect(onPreview).toHaveBeenCalledWith(
      "custom",
      expect.objectContaining({
        version: 11,
        markdown: expect.objectContaining({
          heading: expect.objectContaining({ h1: DEFAULT_EDITOR_THEME.markdown.heading.h1 })
        })
      })
    );
  });

  it("keeps lower-level canvas tokens in an expandable advanced section", () => {
    renderPanel();
    clickButton("画布");
    clickButton("网格");

    const interactionGroup = container?.querySelector('[data-theme-settings-group="canvas-grid"]');
    expect(interactionGroup?.textContent).not.toContain("小格显示缩放");
    const advancedButton = interactionGroup?.querySelector<HTMLButtonElement>('[aria-label="展开网格高级选项"]');
    act(() => advancedButton?.click());
    expect(interactionGroup?.textContent).toContain("小格显示缩放");
    expect(interactionGroup?.querySelector('[data-theme-token-path="canvas.grid.minorVisibleScale"]')).not.toBeNull();
  });

  it("searches localized labels and token paths while expanding only matching groups", () => {
    renderPanel();
    clickButton("画布");
    const search = container?.querySelector<HTMLInputElement>('[aria-label="搜索外观 token"]');
    changeInput(search, "canvas.ordinaryNode.radius");

    expect(container?.querySelector('[data-theme-settings-group="canvas-node"] button[aria-expanded="true"]')).not.toBeNull();
    expect(container?.querySelector('[data-theme-token-path="canvas.ordinaryNode.radius"]')).not.toBeNull();
    expect(container?.querySelector('[data-theme-settings-group="canvas-edge"]')).toBeNull();
  });

  it("renders semantic border style selects and hides custom dash until it is selected", () => {
    renderPanel();
    clickButton("画布");
    clickButton("普通节点");

    expect(container?.querySelector('[data-theme-token-path="canvas.ordinaryNode.borderStyle"] [role="combobox"]')).not.toBeNull();
    expect(container?.querySelector('[data-theme-token-path="canvas.ordinaryNode.customDash"]')).toBeNull();

    const customTheme = toCustomTheme(DEFAULT_EDITOR_THEME);
    customTheme.canvas.ordinaryNode.borderStyle = "custom";
    customTheme.canvas.ordinaryNode.customDash = [6, 3];
    renderPanel({ themeId: "custom", customTheme, activeTheme: customTheme });
    expect(container?.querySelector('[data-theme-token-path="canvas.ordinaryNode.customDash"]')).not.toBeNull();

    clickButton("Markdown");
    clickButton("块级语义");
    clickButton("引用");
    expect(container?.querySelector('[data-theme-token-path="markdown.blockquote.borderStyle"] [role="combobox"]')).not.toBeNull();
  });

  it("embeds typography in its owning object and renders Markdown element font controls", () => {
    const customTheme = {
      ...toCustomTheme(DEFAULT_EDITOR_THEME),
      typography: {
        ...DEFAULT_EDITOR_THEME.typography,
        interface: {
          ...DEFAULT_EDITOR_THEME.typography.interface,
          body: { ...DEFAULT_EDITOR_THEME.typography.interface.body, family: "Example Sans, sans-serif" }
        }
      }
    };
    renderPanel({ themeId: "custom", customTheme, activeTheme: customTheme });

    expect([...(container?.querySelectorAll("nav button") ?? [])].some((button) => button.textContent === "排版")).toBe(false);
    clickButton("界面");
    expect(container?.querySelector('[aria-label="搜索外观 token"]')).not.toBeNull();
    clickButton("界面基础");
    const bodyRole = container?.querySelector('[data-typography-group="interface"] [data-typography-role="body"]');
    expect(bodyRole?.querySelector('[role="combobox"]')?.textContent).toContain("Example Sans");
    expect(container?.querySelector('[data-typography-role="technical"] [role="combobox"]')).not.toBeNull();
    expect(container?.querySelector('[data-typography-group="markdown"]')).toBeNull();

    clickButton("Markdown");
    const search = container?.querySelector<HTMLInputElement>('[aria-label="搜索 Markdown 外观 token"]');
    expect(search).not.toBeNull();
    changeInput(search, "字体");
    for (const element of ["body", "heading-h1", "code-block"]) {
      expect(container?.querySelector(`[data-markdown-element="${element}"] [role="combobox"]`)).not.toBeNull();
    }
    expect(container?.querySelector('[data-theme-token-path="markdown.body.fontFamily"]')).not.toBeNull();
    expect(container?.querySelector('[data-theme-token-path="markdown.heading.h1.fontFamily"]')).not.toBeNull();
    expect(container?.querySelector('[data-theme-token-path="markdown.codeBlock.fontFamily"]')).not.toBeNull();
  });

  it("uses one collapsed interaction for every logical settings group", () => {
    renderPanel();

    clickButton("界面");
    expect(expandedStates('[data-theme-settings-group] > header > button[aria-expanded]')).not.toContain("true");

    clickButton("画布");
    expect(expandedStates('[data-theme-settings-group] > header > button[aria-expanded]')).not.toContain("true");

    clickButton("Markdown");
    expect(expandedStates('[data-markdown-category] > section > header > button[aria-expanded]')).not.toContain("true");

    clickButton("特殊节点");
    expect(expandedStates('[data-typography-group] > header > button[aria-expanded]')).not.toContain("true");
  });

  it("keeps reset actions disabled until a built-in theme becomes a custom draft", () => {
    renderPanel();

    clickButton("界面");
    clickButton("界面基础");
    expect(container?.querySelector<HTMLButtonElement>('[aria-label="重置界面基础"]')?.disabled).toBe(true);
    expect(container?.querySelector<HTMLButtonElement>('[aria-label="重置正文"]')?.disabled).toBe(true);

    clickButton("Markdown");
    expect(container?.querySelector<HTMLButtonElement>('[aria-label="重置全部 Markdown 外观"]')?.disabled).toBe(true);
  });

  it("exposes explicit discard and apply actions without closing itself", () => {
    const onDiscard = vi.fn();
    const onApply = vi.fn();
    renderPanel({ hasDraft: true, onDiscard, onApply });

    clickButton("放弃");
    clickButton("应用");
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledOnce();
  });

  function renderPanel(overrides: Partial<Parameters<typeof ThemeSettingsPanel>[0]> = {}) {
    act(() => {
      root?.render(
        createElement(TooltipProvider, {
          delayDuration: 0,
          children: createElement(ThemeSettingsPanel, {
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
        })
      );
    });
  }

  function clickButton(label: string) {
    const button = [...(container?.querySelectorAll("button") ?? [])].find((entry) => entry.textContent === label);
    expect(button).toBeDefined();
    act(() => button?.click());
  }

  function changeInput(input: HTMLInputElement | null | undefined, value: string) {
    expect(input).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function expandedStates(selector: string) {
    return [...(container?.querySelectorAll<HTMLElement>(selector) ?? [])].map((entry) => entry.getAttribute("aria-expanded"));
  }
});
