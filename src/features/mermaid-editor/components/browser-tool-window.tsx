import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { Copy, Maximize, OpenNewWindow, Refresh as RefreshCw, Substract, WebWindow, Xmark } from "iconoir-react/regular";

import { Input } from "@/components/ui/input";
import { EditorIconButton, WindowTitlebarLayout } from "@/features/mermaid-editor/components/editor-ui";
import { EmbeddedBrowserSurface } from "@/features/mermaid-editor/components/embedded-browser-surface";
import { createEditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  browserToolWindowLabel,
  browserToolWindowTitle,
  normalizeBrowserUrl,
  type BrowserToolWindowRequest
} from "@/features/mermaid-editor/lib/browser-tool-window";
import type { BrowserWindowPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

type BrowserToolWindowProps = {
  request: BrowserToolWindowRequest;
};

export function BrowserToolWindow({ request }: BrowserToolWindowProps) {
  const runtime = useMemo(() => createEditorRuntime(), []);
  const [currentUrl, setCurrentUrl] = useState(request.url);
  const [address, setAddress] = useState(request.url);
  const [pageTitle, setPageTitle] = useState(browserToolWindowTitle(request.url, request.title));
  const [status, setStatus] = useState("");
  const [reloadRevision, setReloadRevision] = useState(0);
  const panelId = `browser:${browserToolWindowLabel(currentUrl)}` as BrowserWindowPanelId;
  const electronDragStyle = electronWindowRegionStyle("drag", runtime.host === "electron");
  const electronNoDragStyle = electronWindowRegionStyle("no-drag", runtime.host === "electron");

  useEffect(() => {
    document.title = `MMM Browser - ${pageTitle}`;
  }, [pageTitle]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2400);
    return () => window.clearTimeout(timer);
  }, [status]);

  function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = normalizeBrowserUrl(address);
    if (!nextUrl) {
      setStatus("只支持 http/https URL。");
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
    setStatus("已复制链接。");
  }

  function openInSystemBrowser() {
    runtime.openExternalUrl(currentUrl);
    setStatus("已请求使用系统浏览器打开。");
  }

  function runWindowAction(action: "minimize" | "toggleMaximize" | "close") {
    void runtime.runDesktopWindowAction(action);
  }

  function startWindowDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || event.detail > 1 || hasDragExcludedTarget(event.target)) return;
    void runtime.startDesktopWindowDrag();
  }

  function toggleMaximize(event: ReactMouseEvent<HTMLElement>) {
    if (hasDragExcludedTarget(event.target)) return;
    void runtime.toggleDesktopWindowMaximize();
  }

  return (
    <section className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border bg-background text-foreground">
      <WindowTitlebarLayout
        icon={<WebWindow className="size-4 shrink-0 text-icon" />}
        title={<div className="hidden min-w-[128px] max-w-[220px] sm:block">
          <div className="truncate text-sm font-medium">{pageTitle}</div>
          <div className={status ? "truncate text-[11px] leading-4 text-muted-foreground" : "sr-only"} aria-live="polite">
            {status}
          </div>
        </div>}
        center={<form className="flex min-w-0 flex-1 items-center gap-1.5" style={electronNoDragStyle} onSubmit={submitAddress}>
          <Input
            value={address}
            className="min-w-0 flex-1 bg-background/95"
            spellCheck={false}
            onChange={(event) => setAddress(event.target.value)}
          />
          <BrowserToolButton label="重新载入网页" onClick={reloadBrowser}>
            <RefreshCw />
          </BrowserToolButton>
          <BrowserToolButton label="复制链接" onClick={copyAddress}>
            <Copy />
          </BrowserToolButton>
          <BrowserToolButton label="系统浏览器打开" onClick={openInSystemBrowser}>
            <OpenNewWindow />
          </BrowserToolButton>
        </form>}
        actions={<>
          <BrowserToolButton label="最小化" onClick={() => runWindowAction("minimize")}>
            <Substract />
          </BrowserToolButton>
          <BrowserToolButton label="最大化" onClick={() => runWindowAction("toggleMaximize")}>
            <Maximize />
          </BrowserToolButton>
          <BrowserToolButton label="关闭" danger onClick={() => runWindowAction("close")}>
            <Xmark />
          </BrowserToolButton>
        </>}
        className="cursor-grab bg-card/[var(--ui-surface-opacity)] active:cursor-grabbing"
        style={electronDragStyle}
        onPointerDown={startWindowDrag}
        onDoubleClick={toggleMaximize}
      />
      <EmbeddedBrowserSurface
        panelId={panelId}
        url={currentUrl}
        runtime={runtime}
        active
        domOverlayActive={false}
        reloadRevision={reloadRevision}
        onReload={reloadBrowser}
        onStatus={setStatus}
        onBrowserError={(url, message) => setStatus(`${browserToolWindowTitle(url)} ${message}`.trim())}
        onBrowserHandleChange={() => undefined}
      />
    </section>
  );
}

function electronWindowRegionStyle(value: "drag" | "no-drag", enabled: boolean): CSSProperties | undefined {
  return enabled ? ({ WebkitAppRegion: value } as CSSProperties) : undefined;
}

function BrowserToolButton({
  label,
  danger,
  onClick,
  children
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <EditorIconButton
      type="button"
      context="panel"
      tone={danger ? "danger" : "neutral"}
      label={label}
      onClick={onClick}
    >
      {children}
    </EditorIconButton>
  );
}

function hasDragExcludedTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest("[data-window-titlebar-drag-exclude]"));
}
