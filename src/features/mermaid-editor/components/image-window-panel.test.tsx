// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { ImageWindowPanel } from "@/features/mermaid-editor/components/image-window-panel";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DetachedImageWindow } from "@/features/mermaid-editor/lib/workspace-panels";

describe("image window panel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderPanel(onNavigate = vi.fn(), active = true) {
    const imageWindow: DetachedImageWindow = {
      id: "image:/project/a.png",
      file: { name: "a.png", path: "/project/a.png" },
      title: "a.png",
      source: "/project/a.png",
      watchPath: "/project/a.png",
      navigation: {
        kind: "project-directory",
        index: 0,
        items: [
          { source: "/project/a.png", title: "a.png", identity: "/project/a.png", watchPath: "/project/a.png" },
          { source: "/project/b.png", title: "b.png", identity: "/project/b.png", watchPath: "/project/b.png" }
        ]
      }
    };
    const runtime = {
      resolveImageAssetSrc: vi.fn(async () => "mmm-asset://image/a.png")
    } as unknown as EditorRuntime;

    act(() => {
      root.render(
        <TooltipProvider delayDuration={0}>
          <WorkspaceFloatingWindow
            open
            placement="center-panel"
            panelId={imageWindow.id}
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
            <ImageWindowPanel imageWindow={imageWindow} runtime={runtime} active={active} onNavigate={onNavigate} onStatus={() => undefined} />
          </WorkspaceFloatingWindow>
        </TooltipProvider>
      );
    });
    return { onNavigate };
  }

  it("uses an opaque canvas viewport and exposes cyclic navigation controls", async () => {
    const { onNavigate } = renderPanel();
    await act(async () => Promise.resolve());

    const viewport = required<HTMLElement>("[data-image-viewer-viewport]");
    expect(viewport.className).toContain("bg-background");
    expect(viewport.style.backgroundImage).toBe("");

    act(() => required<HTMLButtonElement>("button[aria-label='上一张']").click());
    act(() => required<HTMLButtonElement>("button[aria-label='下一张']").click());
    expect(onNavigate).toHaveBeenNthCalledWith(1, -1);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 1);
  });

  it("navigates the active image window with all four arrow keys", async () => {
    const { onNavigate } = renderPanel();
    await act(async () => Promise.resolve());

    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
    }

    expect(onNavigate.mock.calls).toEqual([[-1], [-1], [1], [1]]);
  });

  it("does not capture arrow keys for inactive windows or text entry", async () => {
    const inactiveNavigate = vi.fn();
    renderPanel(inactiveNavigate, false);
    await act(async () => Promise.resolve());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })));
    expect(inactiveNavigate).not.toHaveBeenCalled();

    act(() => root.unmount());
    root = createRoot(container);
    const activeNavigate = vi.fn();
    renderPanel(activeNavigate);
    await act(async () => Promise.resolve());
    const input = document.createElement("input");
    container.appendChild(input);
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })));
    expect(activeNavigate).not.toHaveBeenCalled();
  });

  it("zooms the canvas with a mouse wheel and pans it by dragging", async () => {
    renderPanel();
    await act(async () => Promise.resolve());
    const image = required<HTMLImageElement>("img");
    Object.defineProperty(image, "naturalWidth", { value: 800 });
    Object.defineProperty(image, "naturalHeight", { value: 600 });
    act(() => image.dispatchEvent(new Event("load", { bubbles: true })));

    const viewport = required<HTMLElement>("[data-image-viewer-viewport]");
    act(() => viewport.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
      deltaY: -120
    })));
    expect(viewport.dataset.imageViewerViewMode).toBe("manual");

    const world = required<HTMLElement>("[data-image-viewer-world]");
    const before = world.style.transform;
    dispatchPointer(viewport, "pointerdown", 20, 20);
    dispatchPointer(viewport, "pointermove", 48, 42);
    dispatchPointer(viewport, "pointerup", 48, 42);
    expect(world.style.transform).not.toBe(before);
  });

  function required<T extends Element>(selector: string) {
    const element = container.querySelector(selector);
    if (!element) throw new Error(`Expected ${selector}`);
    return element as T;
  }
});

function dispatchPointer(target: Element, type: "pointerdown" | "pointermove" | "pointerup", clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY });
  Object.defineProperty(event, "pointerId", { value: 1 });
  act(() => target.dispatchEvent(event));
}
