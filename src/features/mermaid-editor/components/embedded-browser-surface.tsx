import { useEffect, useRef, useState } from "react";
import { OpenNewWindow, Refresh as RefreshCw, WarningTriangle } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { disposeRuntimeEmbeddedBrowserHandle } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-embedded-browser-handles";
import { embeddedBrowserLogicalRect, embeddedBrowserRectKey } from "@/features/mermaid-editor/lib/embedded-browser-rect";
import type { EditorRuntime, RuntimeEmbeddedBrowserHandle } from "@/features/mermaid-editor/lib/editor-runtime";
import type { BrowserWindowPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

type EmbeddedBrowserSurfaceProps = {
  panelId: BrowserWindowPanelId;
  url: string;
  runtime: EditorRuntime;
  active: boolean;
  domOverlayActive: boolean;
  reloadRevision: number;
  onReload: () => void;
  onStatus: (message: string) => void;
  onBrowserError: (url: string, message: string) => void;
  onBrowserHandleChange: (panelId: BrowserWindowPanelId, handle: RuntimeEmbeddedBrowserHandle | null) => void;
};

type EmbeddedBrowserCallbacks = Pick<EmbeddedBrowserSurfaceProps, "onStatus" | "onBrowserError" | "onBrowserHandleChange">;

export function EmbeddedBrowserSurface({
  panelId,
  url,
  runtime,
  active,
  domOverlayActive,
  reloadRevision,
  onReload,
  onStatus,
  onBrowserError,
  onBrowserHandleChange
}: EmbeddedBrowserSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const browserRef = useRef<RuntimeEmbeddedBrowserHandle | null>(null);
  const activeRef = useRef(active);
  const domOverlayActiveRef = useRef(domOverlayActive);
  const syncErrorReportedRef = useRef(false);
  const callbacksRef = useRef<EmbeddedBrowserCallbacks>({ onStatus, onBrowserError, onBrowserHandleChange });
  const instanceIdRef = useRef<number | null>(null);
  const creationSeqRef = useRef(0);
  const [nativeState, setNativeState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [nativeError, setNativeError] = useState("");

  if (instanceIdRef.current === null) {
    instanceIdRef.current = nextEmbeddedBrowserInstanceId();
  }

  useEffect(() => {
    callbacksRef.current = { onStatus, onBrowserError, onBrowserHandleChange };
  }, [onBrowserError, onBrowserHandleChange, onStatus]);

  useEffect(() => {
    activeRef.current = active;
    domOverlayActiveRef.current = domOverlayActive;
    const browser = browserRef.current;
    if (!browser) return;
    const shouldShow = active && !domOverlayActive;
    void (shouldShow ? browser.show().then(() => browser.focus()).catch(() => undefined) : browser.hide().catch(() => undefined));
  }, [active, domOverlayActive]);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;
    let lastRectKey = "";
    let nativeCreated = false;
    const browserLabel = `browser_${hashText(`${instanceIdRef.current}:${panelId}:${url}:${reloadRevision}:${creationSeqRef.current++}`)}`;
    syncErrorReportedRef.current = false;

    async function createNativeBrowser() {
      const surface = surfaceRef.current;
      if (!surface) {
        setNativeError("");
        setNativeState("unavailable");
        return;
      }

      setNativeError("");
      setNativeState("loading");

      let result: Awaited<ReturnType<EditorRuntime["createEmbeddedBrowser"]>>;
      try {
        result = await runtime.createEmbeddedBrowser({
          label: browserLabel,
          url,
          rect: embeddedBrowserLogicalRect(surface.getBoundingClientRect())
        });
      } catch (error) {
        if (disposed) return;
        const message = formatEmbeddedBrowserError(error);
        setNativeError(message);
        setNativeState("error");
        callbacksRef.current.onStatus(`WebView2 内置浏览器创建失败${message ? `：${message}` : "。"}`);
        callbacksRef.current.onBrowserError(url, message || "create rejected");
        return;
      }

      if (disposed) {
        if (result.status === "created") disposeRuntimeEmbeddedBrowserHandle(result.browser);
        return;
      }

      if (result.status !== "created") {
        setNativeError(result.message);
        setNativeState(result.status === "unsupported" ? "unavailable" : "error");
        if (result.status === "error") {
          callbacksRef.current.onStatus(`WebView2 内置浏览器不可用${result.message ? `：${result.message}` : "。"}`);
          callbacksRef.current.onBrowserError(url, result.message || "create failed");
        }
        return;
      }

      const browser = result.browser;
      browserRef.current = browser;
      callbacksRef.current.onBrowserHandleChange(panelId, browser);

      const reportSyncError = (operation: string, error: unknown) => {
        if (disposed || syncErrorReportedRef.current) return;
        syncErrorReportedRef.current = true;
        const message = formatEmbeddedBrowserError(error) || operation;
        callbacksRef.current.onStatus(`WebView2 内置浏览器同步失败：${message}`);
        callbacksRef.current.onBrowserError(url, `sync ${operation}: ${message}`);
      };

      const syncBrowserRect = (force = false) => {
        if (!nativeCreated) return;
        syncRuntimeEmbeddedBrowserRect(surfaceRef.current, browserRef.current, lastRectKey, (nextKey) => {
          lastRectKey = nextKey;
        }, { force, onError: reportSyncError });
      };

      const sync = () => {
        if (disposed) return;
        syncBrowserRect();
        frameId = window.requestAnimationFrame(sync);
      };

      void browser.onCreated(() => {
        if (disposed) return;
        nativeCreated = true;
        setNativeState("ready");
        syncBrowserRect(true);
        window.requestAnimationFrame(() => {
          if (!disposed) syncBrowserRect(true);
        });
        if (!frameId) sync();
        if (!activeRef.current || domOverlayActiveRef.current) void browser.hide().catch(() => undefined);
      });

      void browser.onError((event) => {
        if (disposed) return;
        if (browserRef.current === browser) {
          browserRef.current = null;
          callbacksRef.current.onBrowserHandleChange(panelId, null);
        }
        disposeRuntimeEmbeddedBrowserHandle(browser);
        const message = formatEmbeddedBrowserError(event);
        setNativeError(message);
        setNativeState("error");
        callbacksRef.current.onStatus(`WebView2 内置浏览器创建失败${message ? `：${message}` : "。"}`);
        callbacksRef.current.onBrowserError(url, message || "tauri://error");
      });
    }

    void createNativeBrowser();

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      const browser = browserRef.current;
      browserRef.current = null;
      callbacksRef.current.onBrowserHandleChange(panelId, null);
      if (browser) disposeRuntimeEmbeddedBrowserHandle(browser);
    };
  }, [panelId, reloadRevision, runtime, url]);

  return (
    <div ref={surfaceRef} className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-background">
      {nativeState === "unavailable" || nativeState === "error" ? (
        <EmbeddedBrowserUnavailable
          url={url}
          reason={nativeState === "unavailable" ? "应用内浏览器需要桌面版 WebView2。" : "WebView2 内置浏览器创建失败。"}
          detail={nativeError}
          onRetry={onReload}
          onOpenExternal={() => {
            runtime.openExternalUrl(url);
            onStatus("已请求使用系统浏览器打开。");
          }}
        />
      ) : (
        <div className="grid h-full w-full place-items-center p-4 text-sm text-muted-foreground">
          {nativeState === "loading" ? "正在打开网页" : ""}
        </div>
      )}
    </div>
  );
}

function EmbeddedBrowserUnavailable({
  url,
  reason,
  detail,
  onRetry,
  onOpenExternal
}: {
  url: string;
  reason: string;
  detail: string;
  onRetry: () => void;
  onOpenExternal: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-md border bg-card/95 p-4 text-sm shadow-sm">
        <div className="flex items-start gap-3">
          <WarningTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-3">
            <div>
              <div className="font-medium text-foreground">WebView2 内置浏览器不可用</div>
              <div className="mt-1 text-muted-foreground">{reason}</div>
            </div>
            {detail ? (
              <div className="max-h-24 overflow-auto rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1 font-mono text-xs text-destructive">
                {detail}
              </div>
            ) : null}
            <div className="truncate rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground" title={url}>
              {url}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 size-4" />
                重试
              </Button>
              <Button size="sm" variant="secondary" onClick={onOpenExternal}>
                <OpenNewWindow className="mr-2 size-4" />
                系统浏览器打开
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function syncRuntimeEmbeddedBrowserRect(
  surface: HTMLDivElement | null,
  browser: RuntimeEmbeddedBrowserHandle | null,
  lastRectKey: string,
  updateLastRectKey: (key: string) => void,
  options: { force?: boolean; onError?: (operation: string, error: unknown) => void } = {}
) {
  if (!surface || !browser) return;
  const rect = embeddedBrowserLogicalRect(surface.getBoundingClientRect());
  const rectKey = embeddedBrowserRectKey(rect);
  if (!options.force && rectKey === lastRectKey) return;
  updateLastRectKey(rectKey);
  void browser.setRect(rect).catch((error: unknown) => options.onError?.("rect", error));
}

function formatEmbeddedBrowserError(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "payload" in error) {
    return formatEmbeddedBrowserError((error as { payload?: unknown }).payload);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

let embeddedBrowserInstanceCounter = 0;

function nextEmbeddedBrowserInstanceId() {
  embeddedBrowserInstanceCounter += 1;
  return embeddedBrowserInstanceCounter;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
