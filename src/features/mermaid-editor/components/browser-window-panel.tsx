import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, OpenNewWindow, Refresh as RefreshCw, WebWindow } from "iconoir-react/regular";

import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { NativeWebWindowPanel } from "@/features/mermaid-editor/components/native-web-window-panel";
import {
  browserToolWindowTitle,
  normalizeBrowserUrl
} from "@/features/mermaid-editor/lib/browser-tool-window";
import type { EditorRuntime, RuntimeEmbeddedBrowserHandle, RuntimeEmbeddedBrowserState } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DetachedBrowserWindow } from "@/features/mermaid-editor/lib/workspace-panels";

export function BrowserWindowPanel({
  browserWindow,
  runtime,
  onFocusPanel,
  onStatus,
  onBrowserHandleChange = noopBrowserHandleChange
}: {
  browserWindow: DetachedBrowserWindow;
  runtime: EditorRuntime;
  onFocusPanel: () => void;
  onStatus: (message: string) => void;
  onBrowserHandleChange?: (panelId: DetachedBrowserWindow["id"], handle: RuntimeEmbeddedBrowserHandle | null) => void;
}) {
  const [currentUrl, setCurrentUrl] = useState(browserWindow.request.url);
  const [address, setAddress] = useState(browserWindow.request.url);
  const [pageTitle, setPageTitle] = useState(browserToolWindowTitle(browserWindow.request.url, browserWindow.request.title));
  const [localStatus, setLocalStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryRevision, setRetryRevision] = useState(0);
  const [browserHandle, setBrowserHandle] = useState<RuntimeEmbeddedBrowserHandle | null>(null);
  const addressFocusedRef = useRef(false);

  useEffect(() => {
    if (!localStatus) return;
    const timer = window.setTimeout(() => setLocalStatus(""), 2400);
    return () => window.clearTimeout(timer);
  }, [localStatus]);

  function reportStatus(message: string) {
    setLocalStatus(message);
    onStatus(message);
  }

  function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = normalizeBrowserUrl(address);
    if (!nextUrl) {
      reportStatus("只支持 http/https URL。");
      return;
    }
    setAddress(nextUrl);
    if (nextUrl === currentUrl) {
      reloadBrowser();
      return;
    }
    setCurrentUrl(nextUrl);
    setPageTitle(browserToolWindowTitle(nextUrl));
  }

  function reloadBrowser() {
    if (!browserHandle) {
      setRetryRevision((current) => current + 1);
      return;
    }
    void browserHandle.reload().catch((error) => reportStatus(`重新载入失败：${readableError(error)}`));
  }

  function updateBrowserState(state: RuntimeEmbeddedBrowserState) {
    setLoading(state.loading);
    if (state.url) {
      setCurrentUrl(state.url);
      if (!addressFocusedRef.current) setAddress(state.url);
    }
    setPageTitle(state.title || browserToolWindowTitle(state.url || currentUrl));
  }

  function copyAddress() {
    void navigator.clipboard?.writeText(currentUrl);
    reportStatus("已复制链接。");
  }

  function openInSystemBrowser() {
    runtime.openExternalUrl(currentUrl);
    reportStatus("已请求使用系统浏览器打开。");
  }

  return <NativeWebWindowPanel
    icon={<WebWindow className="size-4 shrink-0 text-icon" />}
    title={<span className="block max-w-44 truncate">{pageTitle}</span>}
    titleTooltip={pageTitle}
    status={localStatus}
    loading={loading}
    center={
      <form className="flex min-w-0 flex-1 items-center" onSubmit={submitAddress}>
        <InputGroup>
          <InputGroupInput
            value={address}
            className="min-w-0"
            spellCheck={false}
            aria-label="浏览器地址"
            onChange={(event) => setAddress(event.target.value)}
            onFocus={() => { addressFocusedRef.current = true; }}
            onBlur={() => { addressFocusedRef.current = false; setAddress(currentUrl); }}
          />
        </InputGroup>
      </form>
    }
    actions={<EditorIconButton context="panel" label="重新载入网页" onClick={reloadBrowser}><RefreshCw data-icon /></EditorIconButton>}
    overflowActions={[
      { id: "copy-address", label: "复制链接", icon: <Copy data-icon />, onSelect: copyAddress },
      { id: "open-external", label: "系统浏览器打开", icon: <OpenNewWindow data-icon />, onSelect: openInSystemBrowser }
    ]}
    surface={{
      panelId: browserWindow.id,
      url: currentUrl,
      runtime,
      retryRevision,
      onRetry: reloadBrowser,
      onStatus: reportStatus,
      onBrowserError: (url, message) => reportStatus(`${browserToolWindowTitle(url)} ${message}`.trim()),
      onBrowserFocus: onFocusPanel,
      onBrowserHandleChange: (_panelId, handle) => {
        setBrowserHandle(handle);
        onBrowserHandleChange(browserWindow.id, handle);
      },
      onBrowserStateChange: updateBrowserState
    }}
  />;
}

function noopBrowserHandleChange() {
  // EmbeddedBrowserSurface owns and disposes the native handle on unmount.
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
