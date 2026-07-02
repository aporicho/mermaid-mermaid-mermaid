import type { EmbeddedBrowserLogicalRect } from "@/features/mermaid-editor/lib/embedded-browser-rect";
import {
  formatRuntimeError,
  isTauriRuntime
} from "@/features/mermaid-editor/lib/editor-runtime/tauri-bridge";
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

type NativeDpiConstructors = {
  LogicalPosition: new (x: number, y: number) => unknown;
  LogicalSize: new (width: number, height: number) => unknown;
};

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

    const constructors: NativeDpiConstructors = {
      LogicalPosition: dpi.LogicalPosition,
      LogicalSize: dpi.LogicalSize
    };
    const webview = new Webview(currentWindow, request.label, {
      url: request.url,
      x: request.rect.x,
      y: request.rect.y,
      width: request.rect.width,
      height: request.rect.height,
      focus: false,
      dragDropEnabled: false
    }) as NativeEmbeddedWebview;

    return {
      status: "created",
      browser: {
        close: () => webview.close(),
        hide: () => webview.hide(),
        show: () => webview.show(),
        focus: () => webview.setFocus(),
        async setRect(rect) {
          await webview.setPosition(new constructors.LogicalPosition(rect.x, rect.y));
          await webview.setSize(new constructors.LogicalSize(rect.width, rect.height));
        },
        async onCreated(handler) {
          if (webview.once) {
            await webview.once("tauri://created", () => handler());
            return;
          }
          window.requestAnimationFrame(handler);
        },
        async onError(handler) {
          await webview.once?.("tauri://error", (event) => handler(event));
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
