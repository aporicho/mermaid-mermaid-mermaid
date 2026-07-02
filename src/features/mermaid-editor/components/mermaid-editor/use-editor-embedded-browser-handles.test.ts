import { describe, expect, it, vi } from "vitest";

import {
  createEmbeddedBrowserRegistry,
  disposeRuntimeEmbeddedBrowserHandle
} from "@/features/mermaid-editor/components/mermaid-editor/use-editor-embedded-browser-handles";
import type { RuntimeEmbeddedBrowserHandle } from "@/features/mermaid-editor/lib/editor-runtime";
import type { BrowserWindowPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

const panelId = "browser:test" as BrowserWindowPanelId;

function createHandle(): RuntimeEmbeddedBrowserHandle {
  return {
    close: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    focus: vi.fn(() => Promise.resolve()),
    setRect: vi.fn(() => Promise.resolve()),
    onCreated: vi.fn(() => Promise.resolve()),
    onError: vi.fn(() => Promise.resolve())
  };
}

describe("embedded browser handle registry", () => {
  it("closes a registered browser handle once when the panel closes", () => {
    const registry = createEmbeddedBrowserRegistry();
    const handle = createHandle();

    registry.set(panelId, handle);
    registry.close(panelId);
    registry.close(panelId);

    expect(handle.hide).toHaveBeenCalledTimes(1);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("disposes the previous handle when a panel registers a replacement", () => {
    const registry = createEmbeddedBrowserRegistry();
    const previous = createHandle();
    const next = createHandle();

    registry.set(panelId, previous);
    registry.set(panelId, next);
    registry.close(panelId);

    expect(previous.hide).toHaveBeenCalledTimes(1);
    expect(previous.close).toHaveBeenCalledTimes(1);
    expect(next.hide).toHaveBeenCalledTimes(1);
    expect(next.close).toHaveBeenCalledTimes(1);
  });

  it("closes all registered browser handles on editor unmount", () => {
    const registry = createEmbeddedBrowserRegistry();
    const first = createHandle();
    const second = createHandle();

    registry.set(panelId, first);
    registry.set("browser:other" as BrowserWindowPanelId, second);
    registry.closeAll();
    registry.closeAll();

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
  });

  it("swallows dispose errors from stale native handles", () => {
    const handle = createHandle();
    vi.mocked(handle.hide).mockRejectedValueOnce(new Error("already closed"));
    vi.mocked(handle.close).mockRejectedValueOnce(new Error("already closed"));

    expect(() => disposeRuntimeEmbeddedBrowserHandle(handle)).not.toThrow();
  });
});
