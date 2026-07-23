// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { MarkdownWindowPanel } from "@/features/mermaid-editor/components/detached-window-panels";

vi.mock("@/features/mermaid-editor/components/markdown-panel", async () => {
  const { createElement: element } = await import("react");
  return {
    MarkdownPanel: ({ textScale }: { textScale: number }) => element("div", { "data-markdown-panel-scale": textScale })
  };
});

vi.mock("@/features/mermaid-editor/components/workspace-panel-controls", () => ({
  WorkspacePanelControls: () => null
}));

describe("MarkdownWindowPanel", () => {
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

  it("reports the shared percentage and changes it in 10% steps", () => {
    const onTextScaleChange = vi.fn();
    renderPanel(1, onTextScaleChange);

    const zoomOut = button("缩小 Markdown 文字（当前 100%）");
    const zoomIn = button("放大 Markdown 文字（当前 100%）");
    expect(container?.querySelector('[data-markdown-panel-scale="1"]')).not.toBeNull();

    act(() => zoomOut.click());
    act(() => zoomIn.click());
    expect(onTextScaleChange).toHaveBeenNthCalledWith(1, 0.9);
    expect(onTextScaleChange).toHaveBeenNthCalledWith(2, 1.1);
  });

  it("disables only the button at the active boundary", () => {
    renderPanel(0.7, vi.fn());
    expect(button("缩小 Markdown 文字（当前 70%）").disabled).toBe(true);
    expect(button("放大 Markdown 文字（当前 70%）").disabled).toBe(false);

    renderPanel(2, vi.fn());
    expect(button("缩小 Markdown 文字（当前 200%）").disabled).toBe(false);
    expect(button("放大 Markdown 文字（当前 200%）").disabled).toBe(true);
  });

  it("saves the detached Markdown document with Ctrl or Meta plus S", () => {
    const onSave = vi.fn();
    const globalKeyDown = vi.fn();
    window.addEventListener("keydown", globalKeyDown);
    renderPanel(1, vi.fn(), onSave);
    const markdownPanel = container?.querySelector<HTMLElement>("[data-markdown-panel-scale]");
    if (!markdownPanel) throw new Error("Missing Markdown panel.");

    const ctrlSave = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    const metaSave = new KeyboardEvent("keydown", { key: "S", metaKey: true, bubbles: true, cancelable: true });
    act(() => markdownPanel.dispatchEvent(ctrlSave));
    act(() => markdownPanel.dispatchEvent(metaSave));

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(globalKeyDown).not.toHaveBeenCalled();
    expect(ctrlSave.defaultPrevented).toBe(true);
    expect(metaSave.defaultPrevented).toBe(true);
    window.removeEventListener("keydown", globalKeyDown);
  });

  it("leaves alternate save combinations for the global shortcut handler", () => {
    const onSave = vi.fn();
    renderPanel(1, vi.fn(), onSave);
    const markdownPanel = container?.querySelector<HTMLElement>("[data-markdown-panel-scale]");
    if (!markdownPanel) throw new Error("Missing Markdown panel.");

    act(() => markdownPanel.dispatchEvent(new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })));

    expect(onSave).not.toHaveBeenCalled();
  });

  function renderPanel(textScale: number, onTextScaleChange: (value: number) => void, onSave = vi.fn()) {
    act(() => {
      root?.render(createElement(TooltipProvider, {
        delayDuration: 0,
        children: createElement(MarkdownWindowPanel, {
          title: "notes.md",
          value: "# Notes",
          dirty: false,
          spellCheck: false,
          contentWidth: 880,
          textScale,
          windowState: "normal",
          onWindowStateChange: vi.fn(),
          onClose: vi.fn(),
          onSave,
          onTextScaleChange,
          onChange: vi.fn()
        })
      }));
    });
  }

  function button(label: string) {
    const result = container?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!result) throw new Error(`Missing button: ${label}`);
    return result;
  }
});
