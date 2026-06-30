import { useEffect, useState } from "react";
import { FloppyDisk, Link, OpenNewWindow, Refresh as RefreshCw, Text, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmbeddedBrowserSurface } from "@/features/mermaid-editor/components/embedded-browser-surface";
import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import { cn } from "@/lib/utils";

export function MarkdownWindowPanel({
  title,
  path,
  value,
  dirty,
  windowState,
  onWindowStateChange,
  onClose,
  onSave,
  onChange
}: {
  title: string;
  path?: string;
  value: string;
  dirty: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)] bg-card/95">
      <header data-floating-panel-drag-handle className="flex min-w-0 cursor-grab items-center justify-between gap-2 border-b bg-card/95 px-3 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2">
          <Text className="size-4 shrink-0 text-icon" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-sm font-medium">
              <span className="truncate">{title}</span>
              {dirty ? <span className="size-1.5 shrink-0 rounded-full bg-foreground/60" aria-hidden /> : null}
            </div>
            <div className="truncate text-[11px] leading-4 text-muted-foreground" title={path || title}>{path || "Markdown 窗口"}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" data-floating-panel-drag-exclude>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={cn(EDITOR_CHROME_CLASSES.panelIconButton, "bg-card/85")} onClick={onSave} aria-label="保存 Markdown 窗口">
                <FloppyDisk className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">保存 Markdown 窗口</TooltipContent>
          </Tooltip>
          <WorkspacePanelControls
            windowState={windowState}
            onWindowStateChange={onWindowStateChange}
            onClose={onClose}
            closeLabel="关闭 Markdown 窗口"
            closeTooltipSide="top"
            closeIcon={<Xmark />}
          />
        </div>
      </header>
      <MarkdownPanel
        key={`${title}:markdown-window`}
        value={value}
        onChange={onChange}
        className="markdown-editor-panel--window bg-background/95"
      />
    </section>
  );
}

export function BrowserWindowPanel({
  panelId,
  title,
  url,
  runtime,
  active,
  domOverlayActive,
  windowState,
  onWindowStateChange,
  onNavigate,
  onClose,
  onStatus,
  onBrowserError
}: {
  panelId: string;
  title: string;
  url: string;
  runtime: EditorRuntime;
  active: boolean;
  domOverlayActive: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onNavigate: (url: string) => void;
  onClose: () => void;
  onStatus: (message: string) => void;
  onBrowserError: (url: string, message: string) => void;
}) {
  const [address, setAddress] = useState(url);
  const [reloadRevision, setReloadRevision] = useState(0);

  useEffect(() => {
    setAddress(url);
  }, [url]);

  function submitAddress() {
    onNavigate(address);
  }

  function copyAddress() {
    void navigator.clipboard?.writeText(url);
    onStatus("已复制链接。");
  }

  function openInSystemBrowser() {
    runtime.openExternalUrl(url);
    onStatus("已请求使用系统浏览器打开。");
  }

  function reloadBrowser() {
    setReloadRevision((current) => current + 1);
  }

  return (
    <section className="grid h-full w-full min-h-0 grid-rows-[42px_42px_minmax(0,1fr)] overflow-hidden bg-card/95">
      <header data-floating-panel-drag-handle className="flex min-w-0 cursor-grab items-center justify-between gap-2 border-b bg-card/95 px-3 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2">
          <OpenNewWindow className="size-4 shrink-0 text-icon" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="truncate text-[11px] leading-4 text-muted-foreground" title={url}>{url}</div>
          </div>
        </div>
        <WorkspacePanelControls
          windowState={windowState}
          onWindowStateChange={onWindowStateChange}
          onClose={onClose}
          closeLabel="关闭浏览器窗口"
          closeTooltipSide="top"
          closeIcon={<Xmark />}
        />
      </header>
      <div className="flex min-w-0 items-center gap-2 border-b bg-muted/20 px-2" data-floating-panel-drag-exclude>
        <Input
          value={address}
          className="h-8 min-w-0 flex-1 bg-background/95"
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitAddress();
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} onClick={reloadBrowser} aria-label="重新载入网页">
              <RefreshCw className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">重新载入网页</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} onClick={copyAddress} aria-label="复制链接">
              <Link className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">复制链接</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} onClick={openInSystemBrowser} aria-label="系统浏览器打开">
              <OpenNewWindow className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">系统浏览器打开</TooltipContent>
        </Tooltip>
      </div>
      <EmbeddedBrowserSurface
        panelId={panelId}
        url={url}
        runtime={runtime}
        active={active}
        domOverlayActive={domOverlayActive}
        reloadRevision={reloadRevision}
        onReload={reloadBrowser}
        onStatus={onStatus}
        onBrowserError={onBrowserError}
      />
    </section>
  );
}
