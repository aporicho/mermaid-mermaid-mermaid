// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Terminal as XtermTerminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TerminalHistoryScrollArea } from "@/features/mermaid-editor/components/terminal-history-scroll-area";

describe("TerminalHistoryScrollArea", () => {
  let container: HTMLDivElement;
  let root: Root;
  let frameId: number;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    frameId = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++frameId;
      queueMicrotask(() => callback(0));
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("maps the xterm buffer to a shadcn Scroll Area in both directions", async () => {
    const callbacks: Record<string, (...args: never[]) => void> = {};
    const activeBuffer = { baseY: 100, viewportY: 20, length: 120 };
    const scrollToLine = vi.fn((line: number) => {
      activeBuffer.viewportY = line;
    });
    const terminal = {
      rows: 20,
      buffer: { active: activeBuffer },
      scrollToLine,
      onScroll: (callback: (...args: never[]) => void) => register(callbacks, "scroll", callback),
      onWriteParsed: (callback: (...args: never[]) => void) => register(callbacks, "write", callback),
      onResize: (callback: (...args: never[]) => void) => register(callbacks, "resize", callback),
      onRender: (callback: (...args: never[]) => void) => register(callbacks, "render", callback)
    } as unknown as XtermTerminal;

    await act(async () => {
      root.render(<TerminalHistoryScrollArea terminal={terminal} />);
      await flushPromises();
    });

    const scrollArea = requiredElement<HTMLElement>(container, "[data-slot='scroll-area']");
    const viewport = requiredElement<HTMLDivElement>(container, "[data-slot='scroll-area-viewport']");
    const spacer = requiredElement<HTMLDivElement>(container, "[data-terminal-scroll-spacer]");
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 200 });

    await act(async () => {
      callbacks.render();
      await flushPromises();
    });

    expect(scrollArea.classList.contains("terminal-history-scroll-area")).toBe(true);
    expect(spacer.style.height).toBe("1200px");
    expect(viewport.scrollTop).toBe(200);

    await act(async () => {
      viewport.scrollTop = 550;
      viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
      await flushPromises();
    });
    expect(scrollToLine).toHaveBeenLastCalledWith(55);

    activeBuffer.viewportY = 30;
    await act(async () => {
      callbacks.scroll();
      await flushPromises();
    });
    expect(viewport.scrollTop).toBe(300);
  });
});

function register(callbacks: Record<string, (...args: never[]) => void>, key: string, callback: (...args: never[]) => void) {
  callbacks[key] = callback;
  return { dispose: vi.fn() };
}

function requiredElement<T extends Element>(container: ParentNode, selector: string) {
  const element = container.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element as T;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
