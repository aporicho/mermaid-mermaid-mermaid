import { useEffect, useState, type FormEvent } from "react";
import { Copy, OpenNewWindow, Refresh as RefreshCw, WebWindow } from "iconoir-react/regular";

import { Input } from "@/components/ui/input";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { EmbeddedBrowserSurface } from "@/features/mermaid-editor/components/embedded-browser-surface";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import {
  browserToolWindowTitle,
  normalizeBrowserUrl
} from "@/features/mermaid-editor/lib/browser-tool-window";
import type { EditorRuntime, RuntimeEmbeddedBrowserHandle } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DetachedBrowserWindow } from "@/features/mermaid-editor/lib/workspace-panels";

export function BrowserWindowPanel({
  browserWindow,
  runtime,
  active,
  domOverlayActive,
  onStatus,
  onBrowserHandleChange = noopBrowserHandleChange
}: {
  browserWindow: DetachedBrowserWindow;
  runtime: EditorRuntime;
  active: boolean;
  domOverlayActive: boolean;
  onStatus: (message: string) => void;
  onBrowserHandleChange?: (panelId: DetachedBrowserWindow["id"], handle: RuntimeEmbeddedBrowserHandle | null) => void;
}) {
  const [currentUrl, setCurrentUrl] = useState(browserWindow.request.url);
  const [address, setAddress] = useState(browserWindow.request.url);
  const [pageTitle, setPageTitle] = useState(browserToolWindowTitle(browserWindow.request.url, browserWindow.request.title));
  const [localStatus, setLocalStatus] = useState("");
  const [reloadRevision, setReloadRevision] = useState(0);

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
    setReloadRevision((current) => current + 1);
  }

  function copyAddress() {
    void navigator.clipboard?.writeText(currentUrl);
    reportStatus("已复制链接。");
  }

  function openInSystemBrowser() {
    runtime.openExternalUrl(currentUrl);
    reportStatus("已请求使用系统浏览器打开。");
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-card">
      <WorkspaceWindowHeader
        icon={<WebWindow className="size-4 shrink-0 text-icon" />}
        title={<span className="block max-w-44 truncate">{pageTitle}</span>}
        titleTooltip={pageTitle}
        status={localStatus ? <span className="type-interface-status hidden max-w-40 truncate text-muted-foreground xl:block" aria-live="polite">{localStatus}</span> : null}
        center={
          <form className="flex min-w-0 flex-1 items-center" onSubmit={submitAddress}>
            <Input
              value={address}
              className="h-[var(--ui-control-height-sm)] min-w-0 flex-1 bg-background/95"
              spellCheck={false}
              aria-label="浏览器地址"
              onChange={(event) => setAddress(event.target.value)}
            />
          </form>
        }
        actions={<>
          <EditorIconButton context="panel" label="重新载入网页" onClick={reloadBrowser}><RefreshCw /></EditorIconButton>
          <EditorIconButton context="panel" label="复制链接" onClick={copyAddress}><Copy /></EditorIconButton>
          <EditorIconButton context="panel" label="系统浏览器打开" onClick={openInSystemBrowser}><OpenNewWindow /></EditorIconButton>
        </>}
      />
      <EmbeddedBrowserSurface
        panelId={browserWindow.id}
        url={currentUrl}
        runtime={runtime}
        active={active}
        domOverlayActive={domOverlayActive}
        reloadRevision={reloadRevision}
        onReload={reloadBrowser}
        onStatus={reportStatus}
        onBrowserError={(url, message) => reportStatus(`${browserToolWindowTitle(url)} ${message}`.trim())}
        onBrowserHandleChange={onBrowserHandleChange}
      />
    </div>
  );
}

function noopBrowserHandleChange() {
  // EmbeddedBrowserSurface owns and disposes the native handle on unmount.
}
