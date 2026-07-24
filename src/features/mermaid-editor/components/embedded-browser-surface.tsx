import { useEffect, useRef, useState } from "react";
import { OpenNewWindow, Refresh as RefreshCw, WarningTriangle } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { EditorNotice } from "@/features/mermaid-editor/components/editor-ui";
import { useWorkspacePanelHeader } from "@/features/mermaid-editor/components/floating-chrome/workspace-panel-header-context";
import { disposeRuntimeEmbeddedBrowserHandle } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-embedded-browser-handles";
import { embeddedBrowserLogicalRect, embeddedBrowserRectKey } from "@/features/mermaid-editor/lib/embedded-browser-rect";
import { isEmbeddedBrowserSurfaceOccluded } from "@/features/mermaid-editor/lib/embedded-browser-visibility";
import type { EditorRuntime, RuntimeEmbeddedBrowserHandle, RuntimeEmbeddedBrowserState } from "@/features/mermaid-editor/lib/editor-runtime";
import type { BrowserWindowPanelId, HtmlWindowPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

type EmbeddedBrowserPanelId = BrowserWindowPanelId | HtmlWindowPanelId;

type EmbeddedBrowserSurfaceProps = {
  panelId: EmbeddedBrowserPanelId;
  url: string;
  runtime: EditorRuntime;
  retryRevision: number;
  onRetry: () => void;
  onStatus: (message: string) => void;
  onBrowserError: (url: string, message: string) => void;
  onBrowserFocus: () => void;
  onBrowserHandleChange: (panelId: EmbeddedBrowserPanelId, handle: RuntimeEmbeddedBrowserHandle | null) => void;
  onBrowserStateChange: (state: RuntimeEmbeddedBrowserState) => void;
};

type EmbeddedBrowserCallbacks = Pick<EmbeddedBrowserSurfaceProps, "onStatus" | "onBrowserError" | "onBrowserFocus" | "onBrowserHandleChange" | "onBrowserStateChange">;

export function EmbeddedBrowserSurface({
  panelId,
  url,
  runtime,
  retryRevision,
  onRetry,
  onStatus,
  onBrowserError,
  onBrowserFocus,
  onBrowserHandleChange,
  onBrowserStateChange
}: EmbeddedBrowserSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const browserRef = useRef<RuntimeEmbeddedBrowserHandle | null>(null);
  const workspaceHeader = useWorkspacePanelHeader();
  const workspaceHeaderRef = useRef(workspaceHeader);
  const nativeCreatedRef = useRef(false);
  const desiredUrlRef = useRef(url);
  const loadedUrlRef = useRef(url);
  const syncErrorReportedRef = useRef(false);
  const callbacksRef = useRef<EmbeddedBrowserCallbacks>({ onStatus, onBrowserError, onBrowserFocus, onBrowserHandleChange, onBrowserStateChange });
  const instanceIdRef = useRef<number | null>(null);
  const creationSeqRef = useRef(0);
  const [nativeState, setNativeState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [nativeError, setNativeError] = useState("");
  workspaceHeaderRef.current = workspaceHeader;

  if (instanceIdRef.current === null) {
    instanceIdRef.current = nextEmbeddedBrowserInstanceId();
  }

  useEffect(() => {
    callbacksRef.current = { onStatus, onBrowserError, onBrowserFocus, onBrowserHandleChange, onBrowserStateChange };
  }, [onBrowserError, onBrowserFocus, onBrowserHandleChange, onBrowserStateChange, onStatus]);

  useEffect(() => {
    desiredUrlRef.current = url;
    const browser = browserRef.current;
    if (!browser || !nativeCreatedRef.current || loadedUrlRef.current === url) return;
    loadedUrlRef.current = url;
    void browser.navigate(url).catch((error) => {
      const message = formatEmbeddedBrowserError(error);
      callbacksRef.current.onStatus(`内置浏览器导航失败${message ? `：${message}` : "。"}`);
      callbacksRef.current.onBrowserError(url, message || "navigation failed");
    });
  }, [url]);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;
    let lastRectKey = "";
    let nativeCreated = false;
    let readyToShow = false;
    let lastVisible: boolean | null = null;
    const initialUrl = desiredUrlRef.current;
    const browserLabel = `browser_${hashText(`${instanceIdRef.current}:${panelId}:${initialUrl}:${retryRevision}:${creationSeqRef.current++}`)}`;
    syncErrorReportedRef.current = false;
    nativeCreatedRef.current = false;

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
          url: initialUrl,
          rect: embeddedBrowserViewRect(surface, embeddedBrowserTitlebarHotZoneHeight(workspaceHeaderRef.current))
        });
      } catch (error) {
        if (disposed) return;
        const message = formatEmbeddedBrowserError(error);
        setNativeError(message);
        setNativeState("error");
        callbacksRef.current.onStatus(`内置浏览器创建失败${message ? `：${message}` : "。"}`);
        callbacksRef.current.onBrowserError(initialUrl, message || "create rejected");
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
          callbacksRef.current.onStatus(`内置浏览器不可用${result.message ? `：${result.message}` : "。"}`);
          callbacksRef.current.onBrowserError(initialUrl, result.message || "create failed");
        }
        return;
      }

      const browser = result.browser;
      browserRef.current = browser;
      loadedUrlRef.current = initialUrl;
      callbacksRef.current.onBrowserHandleChange(panelId, browser);

      const reportSyncError = (operation: string, error: unknown) => {
        if (disposed || syncErrorReportedRef.current) return;
        syncErrorReportedRef.current = true;
        const message = formatEmbeddedBrowserError(error) || operation;
        callbacksRef.current.onStatus(`内置浏览器同步失败：${message}`);
        callbacksRef.current.onBrowserError(desiredUrlRef.current, `sync ${operation}: ${message}`);
      };

      const syncBrowserRect = (force = false) => {
        if (!nativeCreated) return;
        syncRuntimeEmbeddedBrowserRect(surfaceRef.current, browserRef.current, lastRectKey, (nextKey) => {
          lastRectKey = nextKey;
        }, {
          force,
          onError: reportSyncError,
          titlebarHotZoneHeight: embeddedBrowserTitlebarHotZoneHeight(workspaceHeaderRef.current)
        });
      };

      const syncBrowserVisibility = (force = false) => {
        if (!nativeCreated || !readyToShow) return;
        const surface = surfaceRef.current;
        const shouldShow = surface !== null
          && !isEmbeddedBrowserSurfaceOccluded(surface);
        if (!force && lastVisible === shouldShow) return;
        lastVisible = shouldShow;
        void (shouldShow ? browser.show() : browser.hide()).catch((error) => reportSyncError("visibility", error));
      };

      const sync = () => {
        if (disposed) return;
        syncBrowserRect();
        syncBrowserVisibility();
        frameId = window.requestAnimationFrame(sync);
      };

      void browser.onCreated(() => {
        if (disposed) return;
        nativeCreated = true;
        nativeCreatedRef.current = true;
        setNativeState("ready");
        syncBrowserRect(true);
        window.requestAnimationFrame(() => {
          if (disposed) return;
          syncBrowserRect(true);
          window.requestAnimationFrame(() => {
            if (disposed) return;
            readyToShow = true;
            syncBrowserRect(true);
            syncBrowserVisibility(true);
          });
        });
        if (!frameId) sync();
        if (desiredUrlRef.current !== loadedUrlRef.current) {
          loadedUrlRef.current = desiredUrlRef.current;
          void browser.navigate(desiredUrlRef.current).catch((error) => reportSyncError("navigation", error));
        }
      });

      void browser.onFocus(() => {
        if (!disposed) callbacksRef.current.onBrowserFocus();
      });

      void browser.onTitlebarHotZoneChange((inside) => {
        if (disposed) return;
        const header = workspaceHeaderRef.current;
        if (!header) return;
        if (inside && header.autoHide) header.showFromHotZone();
        else if (!inside) header.leaveHotZone();
      });

      void browser.onState((state) => {
        if (disposed) return;
        if (state.url) loadedUrlRef.current = state.url;
        callbacksRef.current.onBrowserStateChange(state);
      });

      void browser.onError((event) => {
        if (disposed) return;
        if (browserRef.current === browser) {
          browserRef.current = null;
          nativeCreatedRef.current = false;
          callbacksRef.current.onBrowserHandleChange(panelId, null);
        }
        disposeRuntimeEmbeddedBrowserHandle(browser);
        const message = formatEmbeddedBrowserError(event);
        setNativeError(message);
        setNativeState("error");
        callbacksRef.current.onStatus(`内置浏览器创建失败${message ? `：${message}` : "。"}`);
        callbacksRef.current.onBrowserError(desiredUrlRef.current, message || "desktop-browser-error");
      });
    }

    void createNativeBrowser();

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      nativeCreatedRef.current = false;
      const browser = browserRef.current;
      browserRef.current = null;
      callbacksRef.current.onBrowserHandleChange(panelId, null);
      if (browser) disposeRuntimeEmbeddedBrowserHandle(browser);
    };
  }, [panelId, retryRevision, runtime]);

  return (
    <div ref={surfaceRef} className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-background" data-workspace-native-surface>
      {nativeState === "unavailable" || nativeState === "error" ? (
        <EmbeddedBrowserUnavailable
          url={url}
          reason={nativeState === "unavailable" ? "需要桌面版内置浏览器" : "内置浏览器创建失败"}
          detail={nativeError}
          onRetry={onRetry}
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
      <EditorNotice
        tone="danger"
        className="w-full max-w-md"
        icon={<WarningTriangle className="editor-ui-icon mt-0.5 shrink-0 text-destructive" />}
        title={reason}
        description={<div className="mt-1 space-y-3">
            {detail ? (
              <div className="type-interface-technical max-h-24 overflow-auto border border-destructive/20 bg-destructive/5 px-2 py-1 text-destructive">
                {detail}
              </div>
            ) : null}
            <div className="type-interface-technical truncate border bg-muted/30 px-2 py-1 text-muted-foreground" title={url}>
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
          </div>}
      />
    </div>
  );
}

function syncRuntimeEmbeddedBrowserRect(
  surface: HTMLDivElement | null,
  browser: RuntimeEmbeddedBrowserHandle | null,
  lastRectKey: string,
  updateLastRectKey: (key: string) => void,
  options: {
    force?: boolean;
    onError?: (operation: string, error: unknown) => void;
    titlebarHotZoneHeight?: number;
  } = {}
) {
  if (!surface || !browser) return;
  const rect = embeddedBrowserViewRect(surface, options.titlebarHotZoneHeight);
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

function embeddedBrowserViewRect(surface: HTMLElement, titlebarHotZoneHeight = 0) {
  const bounds = surface.getBoundingClientRect();
  const panel = surface.closest<HTMLElement>(".editor-ui-panel");
  const borderRadius = panel ? Number.parseFloat(window.getComputedStyle(panel).borderTopLeftRadius) : 0;
  return embeddedBrowserLogicalRect({
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    borderRadius: Number.isFinite(borderRadius) ? borderRadius : 0,
    titlebarHotZoneHeight
  });
}

export function embeddedBrowserTitlebarHotZoneHeight(header: { autoHide: boolean; visible: boolean; headerHeightPx: number } | null) {
  return header?.autoHide && !header.visible ? header.headerHeightPx : 0;
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
