import type { ElectronBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import type { RuntimeEmbeddedBrowserHandle } from "@/features/mermaid-editor/lib/editor-runtime/types";

export function createElectronEmbeddedBrowserHandle(
  label: string,
  bridge: ElectronBridge
): RuntimeEmbeddedBrowserHandle {
  let closed = false;
  let unlistenError: (() => void) | null = null;
  let unlistenFocus: (() => void) | null = null;
  let unlistenState: (() => void) | null = null;

  return {
    async close() {
      if (closed) return;
      closed = true;
      unlistenError?.();
      unlistenFocus?.();
      unlistenState?.();
      unlistenError = null;
      unlistenFocus = null;
      unlistenState = null;
      await bridge.closeEmbeddedBrowser(label);
    },
    async hide() {
      if (!closed) await bridge.hideEmbeddedBrowser(label);
    },
    async show() {
      if (!closed) await bridge.showEmbeddedBrowser(label);
    },
    async focus() {
      if (!closed) await bridge.focusEmbeddedBrowser(label);
    },
    async navigate(url) {
      if (!closed) await bridge.navigateEmbeddedBrowser(label, url);
    },
    async reload() {
      if (!closed) await bridge.reloadEmbeddedBrowser(label);
    },
    async setRect(rect) {
      if (!closed) await bridge.setEmbeddedBrowserRect(label, rect);
    },
    async onCreated(handler) {
      window.requestAnimationFrame(() => {
        if (!closed) handler();
      });
    },
    async onError(handler) {
      unlistenError?.();
      unlistenError = bridge.onEmbeddedBrowserError((event) => {
        if (!closed && event.label === label) handler(event.message || event);
      });
    },
    async onFocus(handler) {
      unlistenFocus?.();
      unlistenFocus = bridge.onEmbeddedBrowserFocus((event) => {
        if (!closed && event.label === label) handler();
      });
    },
    async onState(handler) {
      unlistenState?.();
      unlistenState = bridge.onEmbeddedBrowserState((event) => {
        if (!closed && event.label === label) {
          handler({ url: event.url, title: event.title, loading: event.loading });
        }
      });
    }
  };
}
