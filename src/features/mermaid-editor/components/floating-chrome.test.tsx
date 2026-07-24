// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EditorSectionHeader } from "@/features/mermaid-editor/components/editor-ui";
import {
  FloatingPopover,
  WorkspaceFloatingWindow,
  WorkspaceWindowHeader
} from "@/features/mermaid-editor/components/floating-chrome";
import { WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS } from "@/features/mermaid-editor/components/floating-chrome/workspace-panel-header-context";

describe("floating chrome", () => {
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
        <TooltipProvider delayDuration={0}>
          <WorkspaceFloatingWindow
            open
            placement="center-panel"
            panelId="markdown-window"
            titlebarAutoHide={false}
            active
            stackIndex={0}
            onFocusPanel={() => undefined}
            defaultSize={{ width: 640, height: 480 }}
            minSize={{ width: 320, height: 220 }}
            windowState="normal"
            onWindowStateChange={() => undefined}
            onClose={() => undefined}
            closeLabel="关闭 Markdown 窗口"
          >
            <section className="flex h-full min-h-0 flex-col">
              <WorkspaceWindowHeader title="Markdown" />
              <div data-testid="workspace-content" />
            </section>
          </WorkspaceFloatingWindow>
        </TooltipProvider>
      );
    });

    const content = requiredElement<HTMLElement>("[data-testid='workspace-content']");
    const surface = content.closest(".editor-ui-panel");
    if (!(surface instanceof HTMLElement)) throw new Error("Expected workspace panel surface.");
    const panel = content.closest("[data-floating-panel-kind='workspace']");
    if (!(panel instanceof HTMLElement)) throw new Error("Expected workspace panel root.");

    return { panel, surface };
  }

  function renderWorkspaceHeaderPanel({
    open = true,
    titlebarAutoHide = true,
    initialFrameSize,
    initialFrameSizeKey,
    leadingActions,
    center
  }: { open?: boolean; titlebarAutoHide?: boolean; initialFrameSize?: { width: number; height: number }; initialFrameSizeKey?: string; leadingActions?: ReactNode; center?: ReactNode } = {}) {
    createContainer();

    function render(next: { open: boolean; titlebarAutoHide: boolean; initialFrameSize?: { width: number; height: number }; initialFrameSizeKey?: string }) {
      act(() => {
        root?.render(
          <TooltipProvider delayDuration={0}>
            <WorkspaceFloatingWindow
              open={next.open}
              placement="center-panel"
              panelId="header-test"
              titlebarAutoHide={next.titlebarAutoHide}
              active
              stackIndex={0}
              onFocusPanel={() => undefined}
              defaultSize={{ width: 640, height: 480 }}
              initialFrameSize={next.initialFrameSize}
              initialFrameSizeKey={next.initialFrameSizeKey}
              minSize={{ width: 320, height: 220 }}
              windowState="normal"
              onWindowStateChange={() => undefined}
              onClose={() => undefined}
              closeLabel="关闭测试面板"
            >
              <section className="flex h-full min-h-0 flex-col">
                <WorkspaceWindowHeader
                  title="测试面板"
                  leadingActions={leadingActions}
                  center={center}
                  actions={<button type="button" data-testid="business-action">业务操作</button>}
                />
                <button type="button" data-testid="workspace-content">内容</button>
              </section>
            </WorkspaceFloatingWindow>
          </TooltipProvider>
        );
      });
    }

    render({ open, titlebarAutoHide, initialFrameSize, initialFrameSizeKey });

    return {
      rerender: render,
      panel: () => requiredElement<HTMLElement>("[data-floating-panel-id='header-test']"),
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

  function dispatchDragPointer(target: Element, type: "pointerdown" | "pointermove" | "pointerup", x: number, y: number) {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, "pointerId", { value: 7 });
    act(() => target.dispatchEvent(event));
  }

  it("does not wrap workspace content in fixed-position containing block classes", () => {
    const { panel, surface } = renderWorkspacePanel();

    expect(panel.className).not.toContain("will-change-transform");
    expect(surface.className).not.toContain("will-change-transform");
    expect(surface.className).not.toContain("backdrop-blur");
  });

  it("keeps a keep-alive workspace mounted but inert while it is hidden", () => {
    createContainer();

    function render(open: boolean) {
      act(() => {
        root?.render(
          <WorkspaceFloatingWindow
            open={open}
            placement="bottom-panel"
            panelId="terminal-test"
            titlebarAutoHide={false}
            active={open}
            stackIndex={0}
            onFocusPanel={() => undefined}
            defaultSize={{ width: 640, height: 480 }}
            minSize={{ width: 320, height: 220 }}
            windowState="normal"
            onWindowStateChange={() => undefined}
            onClose={() => undefined}
            closeLabel="隐藏终端"
            mountStrategy="keep-alive"
          >
            <div data-testid="terminal-content" />
          </WorkspaceFloatingWindow>
        );
      });
    }

    render(true);
    const content = requiredElement<HTMLElement>("[data-testid='terminal-content']");
    const panel = requiredElement<HTMLElement>("[data-floating-panel-id='terminal-test']");
    render(false);

    expect(container?.querySelector("[data-testid='terminal-content']")).toBe(content);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.hasAttribute("inert")).toBe(true);

    render(true);
    expect(container?.querySelector("[data-testid='terminal-content']")).toBe(content);
    expect(panel.hasAttribute("inert")).toBe(false);
  });

  it("keeps resize handles in an absolute overlay instead of workspace layout flow", () => {
    renderWorkspacePanel();

    const handle = requiredElement<HTMLElement>("[data-floating-panel-resize-handle='se']");
    const overlay = handle.parentElement;
    expect(overlay?.className).toContain("absolute");
    expect(overlay?.className).toContain("inset-0");
    expect(overlay?.className).toContain("pointer-events-none");
  });

  it("applies a late initial frame size once and caps it to the application viewport", () => {
    createContainer();
    const render = (initialFrameSize?: { width: number; height: number }) => act(() => {
      root?.render(
        <WorkspaceFloatingWindow
          open
          placement="center-panel"
          panelId="content-sized"
          titlebarAutoHide
          active
          stackIndex={0}
          onFocusPanel={() => undefined}
          defaultSize={{ width: 640, height: 480 }}
          initialFrameSize={initialFrameSize}
          minSize={{ width: 320, height: 220 }}
          windowState="normal"
          onWindowStateChange={() => undefined}
          onClose={() => undefined}
          closeLabel="关闭"
        >
          <div />
        </WorkspaceFloatingWindow>
      );
    });

    render();
    const panel = requiredElement<HTMLElement>("[data-floating-panel-id='content-sized']");
    expect(panel.style.width).toBe("640px");
    expect(panel.style.height).toBe("480px");

    render({ width: 800, height: 600 });
    expect(panel.style.width).toBe("800px");
    expect(panel.style.height).toBe("600px");
    expect(panel.style.left).toBe(`${(window.innerWidth - 800) / 2}px`);
    expect(panel.style.top).toBe(`${(window.innerHeight - 600) / 2}px`);

    act(() => root?.unmount());
    root = createRoot(container!);
    render({ width: 5000, height: 5000 });
    const cappedPanel = requiredElement<HTMLElement>("[data-floating-panel-id='content-sized']");
    expect(cappedPanel.style.width).toBe(`${window.innerWidth - 24}px`);
    expect(cappedPanel.style.height).toBe(`${window.innerHeight - 24}px`);
  });

  it("does not replace a frame the user moved before content sizing completed", () => {
    const workspace = renderWorkspaceHeaderPanel({ titlebarAutoHide: false });
    const panel = workspace.panel();
    const initialLeft = panel.style.left;

    dispatchDragPointer(workspace.header(), "pointerdown", 100, 100);
    dispatchDragPointer(panel, "pointermove", 140, 120);
    dispatchDragPointer(panel, "pointerup", 140, 120);
    expect(panel.style.left).not.toBe(initialLeft);

    workspace.rerender({ open: true, titlebarAutoHide: false, initialFrameSize: { width: 800, height: 600 } });
    expect(panel.style.width).toBe("640px");
    expect(panel.style.height).toBe("480px");
  });

  it("applies natural frame sizing again when the content key changes", () => {
    const workspace = renderWorkspaceHeaderPanel({
      initialFrameSize: { width: 800, height: 600 },
      initialFrameSizeKey: "image-a"
    });
    expect(workspace.panel().style.width).toBe("800px");
    expect(workspace.panel().style.height).toBe("600px");

    workspace.rerender({ open: true, titlebarAutoHide: true, initialFrameSizeKey: "image-b" });
    workspace.rerender({
      open: true,
      titlebarAutoHide: true,
      initialFrameSize: { width: 500, height: 400 },
      initialFrameSizeKey: "image-b"
    });
    expect(workspace.panel().style.width).toBe("500px");
    expect(workspace.panel().style.height).toBe("400px");
  });

  it("restores a natural initial frame size that arrives while fullscreen", () => {
    createContainer();
    const render = (windowState: "normal" | "fullscreen", initialFrameSize?: { width: number; height: number }) => act(() => {
      root?.render(
        <WorkspaceFloatingWindow
          open placement="center-panel" panelId="fullscreen-sized" titlebarAutoHide active stackIndex={0}
          onFocusPanel={() => undefined} defaultSize={{ width: 640, height: 480 }} initialFrameSize={initialFrameSize}
          minSize={{ width: 320, height: 220 }} windowState={windowState} onWindowStateChange={() => undefined}
          onClose={() => undefined} closeLabel="关闭"
        ><div /></WorkspaceFloatingWindow>
      );
    });

    render("normal");
    render("fullscreen");
    render("fullscreen", { width: 800, height: 600 });
    render("normal", { width: 800, height: 600 });

    const panel = requiredElement<HTMLElement>("[data-floating-panel-id='fullscreen-sized']");
    expect(panel.style.width).toBe("800px");
    expect(panel.style.height).toBe("600px");
  });

  it("portals a window menu into the overlay host owned by that window", () => {
    createContainer();
    act(() => {
      root?.render(
        <WorkspaceFloatingWindow
          open
          placement="center-panel"
          panelId="menu-owner"
          titlebarAutoHide={false}
          active
          stackIndex={0}
          onFocusPanel={() => undefined}
          defaultSize={{ width: 640, height: 480 }}
          minSize={{ width: 320, height: 220 }}
          windowState="normal"
          onWindowStateChange={() => undefined}
          onClose={() => undefined}
          closeLabel="关闭"
        >
          <DropdownMenu open>
            <DropdownMenuTrigger>打开</DropdownMenuTrigger>
            <DropdownMenuContent><DropdownMenuItem>菜单项</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </WorkspaceFloatingWindow>
      );
    });

    const panel = requiredElement<HTMLElement>("[data-floating-panel-id='menu-owner']");
    const host = panel.querySelector<HTMLElement>("[data-overlay-layer-host='workspace']");
    const menu = host?.querySelector<HTMLElement>("[data-overlay-layer='dropdown']");
    expect(host?.dataset.overlayScopeId).toBe("workspace:menu-owner");
    expect(menu?.dataset.overlayScopeId).toBe("workspace:menu-owner");
    expect(document.body.querySelector("[data-overlay-layer='dropdown']")).toBe(menu);
  });

  it("labels workspace windows from their shared titlebar and moves them by that titlebar", () => {
    const { panel } = renderWorkspacePanel();
    const header = requiredElement<HTMLElement>("[data-workspace-panel-header='true']");
    const initialLeft = Number.parseFloat(panel.style.left);
    const initialTop = Number.parseFloat(panel.style.top);

    expect(panel.getAttribute("role")).toBe("region");
    expect(panel.getAttribute("aria-labelledby")).toBe(header.querySelector("[id]")?.id);

    dispatchDragPointer(header, "pointerdown", 100, 100);
    dispatchDragPointer(panel, "pointermove", 140, 125);
    dispatchDragPointer(panel, "pointerup", 140, 125);

    expect(Number.parseFloat(panel.style.left)).toBe(initialLeft + 40);
    expect(Number.parseFloat(panel.style.top)).toBe(initialTop + 25);
  });

  it("leaves non-workspace panel headers in their ordinary layout", () => {
    createContainer();
    act(() => {
      root?.render(
        <FloatingPopover open placement="right">
          <EditorSectionHeader title="普通浮层" />
        </FloatingPopover>
      );
    });

    const header = requiredElement<HTMLElement>("header");
    expect(header.hasAttribute("data-workspace-panel-header")).toBe(false);
    expect(header.className).not.toContain("absolute");
    expect(container?.querySelector("[data-floating-panel-header-hot-zone]")).toBeNull();
  });

  it("opens workspace headers hidden and reveals them from a full-titlebar drag zone", () => {
    vi.useFakeTimers();
    const panel = renderWorkspaceHeaderPanel();

    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
    expect(panel.header().className).toContain("absolute");
    expect(panel.header().className).toContain("motion-reduce:transition-none");
    expect(panel.hotZone()?.style.height).toBe("var(--theme-panel-header-height)");
    expect(panel.hotZone()?.hasAttribute("data-floating-panel-drag-handle")).toBe(true);

    const hotZone = panel.hotZone();
    if (!hotZone) throw new Error("Expected the workspace titlebar hot zone.");
    dispatchPointer(hotZone, "pointerover");
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("visible");
    expect(panel.hotZone()).toBeNull();
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
  });

  it("reopens keep-alive workspace headers in their hidden auto-hide state", () => {
    const panel = renderWorkspaceHeaderPanel();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");

    panel.rerender({ open: false, titlebarAutoHide: true });
    panel.rerender({ open: true, titlebarAutoHide: true });

    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
    expect(panel.hotZone()).not.toBeNull();
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

  it("separates leading and trailing actions into drag-excluded titlebar groups", () => {
    const panel = renderWorkspaceHeaderPanel({
      leadingActions: <button type="button" data-testid="leading-action">前置操作</button>
    });
    const leadingAction = requiredElement<HTMLButtonElement>("[data-testid='leading-action']");
    const businessAction = requiredElement<HTMLButtonElement>("[data-testid='business-action']");
    const pinButton = panel.titlebarButton("固定标题栏");
    const maximizeButton = panel.titlebarButton("全屏");
    const closeButton = panel.titlebarButton("关闭测试面板");
    const leadingGroup = leadingAction.parentElement;
    const actionGroup = businessAction.parentElement;

    expect(leadingGroup?.hasAttribute("data-window-titlebar-drag-exclude")).toBe(true);
    expect(actionGroup?.hasAttribute("data-window-titlebar-drag-exclude")).toBe(true);
    expect(pinButton.parentElement).toBe(actionGroup);
    expect(maximizeButton.parentElement).toBe(actionGroup);
    expect(closeButton.parentElement).toBe(actionGroup);
    expect(Array.from(actionGroup?.children ?? [])).toEqual([
      businessAction,
      pinButton,
      maximizeButton,
      closeButton
    ]);
  });

  it("lets passive center content drag the full visible titlebar while keeping form controls interactive", () => {
    const passivePanel = renderWorkspaceHeaderPanel({
      titlebarAutoHide: false,
      center: <><span data-testid="passive-titlebar-center">图片信息</span><input data-testid="titlebar-input" /></>
    });
    const panel = passivePanel.panel();
    const initialLeft = Number.parseFloat(panel.style.left);
    const passiveCenter = requiredElement<HTMLElement>("[data-testid='passive-titlebar-center']");

    dispatchDragPointer(passiveCenter, "pointerdown", 100, 100);
    dispatchDragPointer(panel, "pointermove", 132, 100);
    dispatchDragPointer(panel, "pointerup", 132, 100);
    expect(Number.parseFloat(panel.style.left)).toBe(initialLeft + 32);

    const movedLeft = Number.parseFloat(panel.style.left);
    const input = requiredElement<HTMLInputElement>("[data-testid='titlebar-input']");
    dispatchDragPointer(input, "pointerdown", 132, 100);
    dispatchDragPointer(panel, "pointermove", 180, 100);
    dispatchDragPointer(panel, "pointerup", 180, 100);
    expect(Number.parseFloat(panel.style.left)).toBe(movedLeft);
  });

  it("keeps the visible auto-hide header above window content", () => {
    const panel = renderWorkspaceHeaderPanel({ titlebarAutoHide: true });
    expect(panel.header().className).toContain("z-[3]");
    expect(panel.header().className).toContain("touch-none");
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
    expect(panel.hotZone()).toBeNull();
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
    expect(panel.hotZone()).not.toBeNull();
  });

  it("can temporarily enable auto-hide when the global preference is off and clears the override on close", () => {
    vi.useFakeTimers();
    const panel = renderWorkspaceHeaderPanel({ titlebarAutoHide: false });

    expect(panel.hotZone()).toBeNull();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("fixed");
    act(() => panel.titlebarButton("启用自动隐藏").click());
    expect(panel.hotZone()).toBeNull();
    advanceHeaderDelay();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("hidden");
    expect(panel.hotZone()).not.toBeNull();

    panel.rerender({ open: false, titlebarAutoHide: false });
    panel.rerender({ open: true, titlebarAutoHide: false });
    expect(panel.hotZone()).toBeNull();
    expect(panel.header().dataset.workspacePanelHeaderState).toBe("fixed");
  });
});
