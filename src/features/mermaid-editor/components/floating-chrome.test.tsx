// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorPanelHeader } from "@/features/mermaid-editor/components/editor-ui";
import { FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS, WORKSPACE_PANEL_HEADER_HOT_ZONE_PX } from "@/features/mermaid-editor/components/floating-chrome/workspace-panel-header-context";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";

describe("FloatingPanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function createContainer() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }

  function renderWorkspacePanel() {
    createContainer();

    act(() => {
      root?.render(
        createElement(
          FloatingPanel,
          {
            open: true,
            placement: "center-panel",
            kind: "workspace",
            panelId: "markdown-window",
            defaultSize: { width: 640, height: 480 },
            children: createElement("div", { "data-testid": "workspace-content" })
          }
        )
      );
    });

    const content = requiredElement<HTMLElement>("[data-testid='workspace-content']");
    const surface = content.parentElement;
    if (!(surface instanceof HTMLElement)) throw new Error("Expected workspace panel surface.");
    const panel = content.closest("[data-floating-panel-kind='workspace']");
    if (!(panel instanceof HTMLElement)) throw new Error("Expected workspace panel root.");

    return { panel, surface };
  }

  function renderWorkspaceHeaderPanel({
    open = true,
    titlebarAutoHide = true,
    leadingActions
  }: { open?: boolean; titlebarAutoHide?: boolean; leadingActions?: ReactNode } = {}) {
    createContainer();

    function render(next: { open: boolean; titlebarAutoHide: boolean }) {
      act(() => {
        root?.render(
          <TooltipProvider delayDuration={0}>
            <FloatingPanel
              open={next.open}
              placement="center-panel"
              kind="workspace"
              panelId="header-test"
              titlebarAutoHide={next.titlebarAutoHide}
              defaultSize={{ width: 640, height: 480 }}
              windowState="normal"
              onWindowStateChange={() => undefined}
            >
              <section className="flex h-full min-h-0 flex-col">
                <EditorPanelHeader
                  title="测试面板"
                  actions={
                    <WorkspacePanelControls
                      allowFullscreen
                      leadingActions={leadingActions}
                      windowState="normal"
                      onWindowStateChange={() => undefined}
                      onClose={() => undefined}
                      closeLabel="关闭测试面板"
                      closeTooltipSide="top"
                      closeIcon={<span aria-hidden>×</span>}
                    />
                  }
                />
                <button type="button" data-testid="workspace-content">内容</button>
              </section>
            </FloatingPanel>
          </TooltipProvider>
        );
      });
    }

    render({ open, titlebarAutoHide });

    return {
      rerender: render,
      header: () => requiredElement<HTMLElement>("[data-workspace-panel-header='true']"),
      hotZone: () => container?.querySelector<HTMLElement>("[data-floating-panel-header-hot-zone]") ?? null,
      content: () => requiredElement<HTMLButtonElement>("[data-testid='workspace-content']"),
      titlebarButton: (label: string) => requiredElement<HTMLButtonElement>(`button[aria-label='${label}']`)
    };
  }

  function requiredElement<T extends Element>(selector: string) {
    const element = container?.querySelector(selector);
    if (!element) throw new Error(`Expected element matching ${selector}.`);
    return element as T;
  }

  function advanceHeaderDelay() {
    act(() => vi.advanceTimersByTime(WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS));
  }

  function dispatchPointer(target: Element, type: "pointerover" | "pointerout" | "pointerdown") {
    const event = new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 4,
      clientY: 4,
      relatedTarget: type === "pointerout" ? document.body : null
    });
    Object.defineProperty(event, "pointerId", { value: 1 });
    act(() => target.dispatchEvent(event));
  }

  it("does not wrap workspace content in fixed-position containing block classes", () => {
    const { panel, surface } = renderWorkspacePanel();

    expect(panel.className).not.toContain("will-change-transform");
    expect(surface.className).not.toContain("will-change-transform");
    expect(surface.className).not.toContain("backdrop-blur");
  });

  it("keeps resize handles in an absolute overlay instead of workspace layout flow", () => {
    renderWorkspacePanel();

    const handle = requiredElement<HTMLElement>("[data-floating-panel-resize-handle='se']");
    const overlay = handle.parentElement;
    expect(overlay?.className).toContain("absolute");
    expect(overlay?.className).toContain("inset-0");
    expect(overlay?.className).toContain("pointer-events-none");
  });

  it("leaves non-workspace panel headers in their ordinary layout", () => {
    createContainer();
    act(() => {
      root?.render(
        <FloatingPanel open placement="right" kind="popover">
          <EditorPanelHeader title="普通浮层" />
        </FloatingPanel>
      );
    });

    const header = requiredElement<HTMLElement>("header");
    expect(header.hasAttribute("data-workspace-panel-header")).toBe(false);
    expect(header.className).not.toContain("absolute");
    expect(container?.querySelector("[data-floating-panel-header-hot-zone]")).toBeNull();
  });

  it("auto-hides workspace headers after 800ms and reveals them from the 8px drag zone", () => {
    vi.useFakeTimers();
    const panel = renderWorkspaceHeaderPanel();

    expect(panel.header().dataset.workspacePanelHeaderState).toBe("visible");
    expect(panel.header().className).toContain("absolute");
    expect(panel.header().className).toContain("motion-reduce:transition-none");
    expect(panel.hotZone()?.style.height).toBe(`${WORKSPACE_PANEL_HEADER_HOT_ZONE_PX}px`);
    expect(panel.hotZone()?.hasAttribute("data-floating-panel-drag-handle")).toBe(true);

    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");

    const hotZone = panel.hotZone();
    if (!hotZone) throw new Error("Expected the workspace titlebar hot zone.");
    dispatchPointer(hotZone, "pointerover");
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("visible");
    dispatchPointer(hotZone, "pointerout");
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
  });

  it("keeps the titlebar visible while it has keyboard focus and lets Tab reveal it", () => {
    vi.useFakeTimers();
    const panel = renderWorkspaceHeaderPanel();
    advanceHeaderDelay();

    const pinButton = panel.titlebarButton("固定标题栏");
    expect(panel.header().hasAttribute("inert")).toBe(false);
    expect(panel.header().getAttribute("aria-hidden")).toBeNull();
    act(() => pinButton.focus());
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("visible");

    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("visible");
    act(() => panel.content().focus());
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
  });

  it("keeps leading actions in the same drag-excluded control group as the window controls", () => {
    const panel = renderWorkspaceHeaderPanel({
      leadingActions: <button type="button" data-testid="leading-action">前置操作</button>
    });
    const leadingAction = requiredElement<HTMLButtonElement>("[data-testid='leading-action']");
    const pinButton = panel.titlebarButton("固定标题栏");
    const maximizeButton = panel.titlebarButton("全屏");
    const closeButton = panel.titlebarButton("关闭测试面板");
    const controlGroup = leadingAction.parentElement;

    expect(controlGroup).not.toBeNull();
    expect(controlGroup?.hasAttribute("data-floating-panel-drag-exclude")).toBe(true);
    expect(pinButton.parentElement).toBe(controlGroup);
    expect(maximizeButton.parentElement).toBe(controlGroup);
    expect(closeButton.parentElement).toBe(controlGroup);
    expect(Array.from(controlGroup?.children ?? [])).toEqual([
      leadingAction,
      pinButton,
      maximizeButton,
      closeButton
    ]);
  });

  it("keeps the titlebar visible while dragging from the top hot zone", () => {
    vi.useFakeTimers();
    const panel = renderWorkspaceHeaderPanel();
    advanceHeaderDelay();
    const hotZone = panel.hotZone();
    if (!hotZone) throw new Error("Expected the workspace titlebar hot zone.");

    dispatchPointer(hotZone, "pointerdown");
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("visible");
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("visible");
  });

  it("uses the pin control as a temporary per-window inverse of the global preference", () => {
    vi.useFakeTimers();
    const panel = renderWorkspaceHeaderPanel({ titlebarAutoHide: true });

    act(() => panel.titlebarButton("固定标题栏").click());
    expect(panel.hotZone()).toBeNull();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("fixed");
    expect(panel.header().className).not.toContain("absolute");
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("fixed");

    act(() => panel.titlebarButton("启用自动隐藏").click());
    expect(panel.hotZone()).not.toBeNull();
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
  });

  it("can temporarily enable auto-hide when the global preference is off and clears the override on close", () => {
    vi.useFakeTimers();
    const panel = renderWorkspaceHeaderPanel({ titlebarAutoHide: false });

    expect(panel.hotZone()).toBeNull();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("fixed");
    act(() => panel.titlebarButton("启用自动隐藏").click());
    expect(panel.hotZone()).not.toBeNull();
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");

    panel.rerender({ open: false, titlebarAutoHide: false });
    panel.rerender({ open: true, titlebarAutoHide: false });
    expect(panel.hotZone()).toBeNull();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("fixed");
  });
});
