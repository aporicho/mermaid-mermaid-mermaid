import type { EmbeddedBrowserLogicalRect } from "@/features/mermaid-editor/lib/embedded-browser-rect";
import { formatRuntimeError, isTauriRuntime } from "@/features/mermaid-editor/lib/editor-runtime/tauri-bridge";
import type { RuntimeEmbeddedBrowserResult } from "@/features/mermaid-editor/lib/editor-runtime/types";

type NativeEmbeddedWebview = {
  close: () => Promise<void>;
  setPosition: (position: unknown) => Promise<void>;
  setSize: (size: unknown) => Promise<void>;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  setFocus: () => Promise<void>;
  once?: (event: string, handler: (event?: unknown) => void) => Promise<() => void>;
};

type NativeEmbeddedWebviewConstructor = { getByLabel?: (label: string) => Promise<NativeEmbeddedWebview | null> };

export async function createDesktopEmbeddedBrowser(request: {
  label: string;
  url: string;
  rect: EmbeddedBrowserLogicalRect;
}): Promise<RuntimeEmbeddedBrowserResult> {
  if (!isTauriRuntime()) {
    return {
      status: "unsupported",
      message: "应用内浏览器需要桌面版 WebView2。"
    };
  }

  try {
    const [{ Webview }, { getCurrentWindow }, dpi] = await Promise.all([
      import("@tauri-apps/api/webview"),
      import("@tauri-apps/api/window"),
      import("@tauri-apps/api/dpi")
    ]);
    const currentWindow = getCurrentWindow();

    const webview = new Webview(currentWindow, request.label, {
      url: request.url,
      x: request.rect.x,
      y: request.rect.y,
      width: request.rect.width,
      height: request.rect.height,
      focus: false,
      dragDropEnabled: false
    }) as NativeEmbeddedWebview;
    const webviewApi = Webview as NativeEmbeddedWebviewConstructor;
    let closed = false;

    async function closeWebview() {
      if (closed) return;
      closed = true;
      await webview.hide().catch(() => undefined);
      try {
        await webview.close();
      } catch {
        const labeledWebview = await webviewApi.getByLabel?.(request.label).catch(() => null);
        await labeledWebview?.close().catch(() => undefined);
      }
    }

    return {
      status: "created",
      browser: {
        close: closeWebview,
        async hide() {
          if (!closed) await webview.hide();
        },
        async show() {
          if (!closed) await webview.show();
        },
        async focus() {
          if (!closed) await webview.setFocus();
        },
        async setRect(rect) {
          if (closed) return;
          await webview.setPosition(new dpi.LogicalPosition(rect.x, rect.y));
          if (closed) return;
          await webview.setSize(new dpi.LogicalSize(rect.width, rect.height));
        },
        async onCreated(handler) {
          if (webview.once) {
            await webview.once("tauri://created", () => {
              if (!closed) handler();
            });
            return;
          }
          window.requestAnimationFrame(() => {
            if (!closed) handler();
          });
        },
        async onError(handler) {
          await webview.once?.("tauri://error", (event) => {
            if (!closed) handler(event);
          });
        }
      }
    };
  } catch (error) {
    return {
      status: "error",
      message: formatRuntimeError(error)
    };
  }
}
