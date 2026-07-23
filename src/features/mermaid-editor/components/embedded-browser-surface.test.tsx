// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmbeddedBrowserSurface } from "@/features/mermaid-editor/components/embedded-browser-surface";
import type {
  EditorRuntime,
  RuntimeEmbeddedBrowserHandle,
  RuntimeEmbeddedBrowserResult
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { BrowserWindowPanelId, HtmlWindowPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

const panelId = "browser:test" as BrowserWindowPanelId;

function createHandle(): RuntimeEmbeddedBrowserHandle {
  return {
    close: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    focus: vi.fn(() => Promise.resolve()),
    navigate: vi.fn(() => Promise.resolve()),
    reload: vi.fn(() => Promise.resolve()),
    setRect: vi.fn(() => Promise.resolve()),
    onCreated: vi.fn(() => Promise.resolve()),
    onError: vi.fn(() => Promise.resolve()),
    onFocus: vi.fn(() => Promise.resolve()),
    onState: vi.fn(() => Promise.resolve())
  };
}

function createRuntime(createEmbeddedBrowser: EditorRuntime["createEmbeddedBrowser"]): EditorRuntime {
  return {
    kind: "desktop",
    openExternalUrl: vi.fn(),
    createEmbeddedBrowser
  } as unknown as EditorRuntime;
}

describe("EmbeddedBrowserSurface", () => {
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
  });

  async function renderSurface({
    runtime,
    onStatus = vi.fn(),
    onBrowserError = vi.fn(),
    onBrowserHandleChange = vi.fn()
  }: {
    runtime: EditorRuntime;
    onStatus?: (message: string) => void;
    onBrowserError?: (url: string, message: string) => void;
    onBrowserHandleChange?: (panelId: BrowserWindowPanelId | HtmlWindowPanelId, handle: RuntimeEmbeddedBrowserHandle | null) => void;
  }) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(EmbeddedBrowserSurface, {
          panelId,
          url: "https://example.com",
          runtime,
          retryRevision: 0,
          onRetry: vi.fn(),
          onStatus,
          onBrowserError,
          onBrowserFocus: vi.fn(),
          onBrowserStateChange: vi.fn(),
          onBrowserHandleChange
        })
      );
      await Promise.resolve();
    });

    return { onBrowserHandleChange };
  }

  it("registers a created native browser handle and unregisters it on unmount", async () => {
    const handle = createHandle();
    const onBrowserHandleChange = vi.fn();
    const runtime = createRuntime(vi.fn(async (): Promise<RuntimeEmbeddedBrowserResult> => ({ status: "created", browser: handle })));

    await renderSurface({ runtime, onBrowserHandleChange });

    expect(onBrowserHandleChange).toHaveBeenCalledWith(panelId, handle);

    act(() => root?.unmount());
    root = null;

    expect(onBrowserHandleChange).toHaveBeenLastCalledWith(panelId, null);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("keeps the native browser when parent callbacks change", async () => {
    const handle = createHandle();
    const createEmbeddedBrowser = vi.fn(async (): Promise<RuntimeEmbeddedBrowserResult> => ({ status: "created", browser: handle }));
    const runtime = createRuntime(createEmbeddedBrowser);

    await renderSurface({ runtime, onBrowserHandleChange: vi.fn() });

    await act(async () => {
      root?.render(
        createElement(EmbeddedBrowserSurface, {
          panelId,
          url: "https://example.com",
          runtime,
          retryRevision: 0,
          onRetry: vi.fn(),
          onStatus: vi.fn(),
          onBrowserError: vi.fn(),
          onBrowserFocus: vi.fn(),
          onBrowserStateChange: vi.fn(),
          onBrowserHandleChange: vi.fn()
        })
      );
      await Promise.resolve();
    });

    expect(createEmbeddedBrowser).toHaveBeenCalledTimes(1);
    expect(handle.close).not.toHaveBeenCalled();
  });

  it("navigates the existing native browser when the address changes", async () => {
    const handle = createHandle();
    vi.mocked(handle.onCreated).mockImplementation(async (handler) => handler());
    const createEmbeddedBrowser = vi.fn(async (): Promise<RuntimeEmbeddedBrowserResult> => ({ status: "created", browser: handle }));
    const runtime = createRuntime(createEmbeddedBrowser);

    await renderSurface({ runtime });

    await act(async () => {
      root?.render(
        createElement(EmbeddedBrowserSurface, {
          panelId,
          url: "https://openai.com",
          runtime,
          retryRevision: 0,
          onRetry: vi.fn(),
          onStatus: vi.fn(),
          onBrowserError: vi.fn(),
          onBrowserFocus: vi.fn(),
          onBrowserStateChange: vi.fn(),
          onBrowserHandleChange: vi.fn()
        })
      );
      await Promise.resolve();
    });

    expect(createEmbeddedBrowser).toHaveBeenCalledTimes(1);
    expect(handle.navigate).toHaveBeenCalledWith("https://openai.com");
    expect(handle.close).not.toHaveBeenCalled();
  });

  it("closes a native browser that is created after the surface has unmounted", async () => {
    const handle = createHandle();
    let resolveCreate: (result: RuntimeEmbeddedBrowserResult) => void = () => undefined;
    const createPromise = new Promise<RuntimeEmbeddedBrowserResult>((resolve) => {
      resolveCreate = resolve;
    });
    const onBrowserHandleChange = vi.fn();
    const runtime = createRuntime(vi.fn(() => createPromise));

    await renderSurface({ runtime, onBrowserHandleChange });
    act(() => root?.unmount());
    root = null;

    await act(async () => {
      resolveCreate({ status: "created", browser: handle });
      await createPromise;
    });

    expect(onBrowserHandleChange).not.toHaveBeenCalledWith(panelId, handle);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("reports rejected native browser creation", async () => {
    const onStatus = vi.fn();
    const onBrowserError = vi.fn();
    const runtime = createRuntime(vi.fn(async () => {
      throw new Error("webview create failed");
    }));

    await renderSurface({ runtime, onStatus, onBrowserError });

    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("webview create failed"));
    expect(onBrowserError).toHaveBeenCalledWith("https://example.com", "webview create failed");
  });

  it("shows one concise unavailable heading while keeping the target URL", async () => {
    const runtime = createRuntime(vi.fn(async (): Promise<RuntimeEmbeddedBrowserResult> => ({
      status: "unsupported",
      message: "应用内浏览器需要桌面版 WebView2。"
    })));

    await renderSurface({ runtime });

    expect(container?.textContent).toContain("需要桌面版 WebView2");
    expect(container?.textContent).toContain("https://example.com");
    expect(container?.textContent).not.toContain("WebView2 内置浏览器不可用");
  });
});
