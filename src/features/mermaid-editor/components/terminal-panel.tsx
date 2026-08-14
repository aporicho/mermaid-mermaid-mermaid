import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { Erase, MultiWindow, Plus, Restart, Terminal as TerminalIcon, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import {
  TerminalSessionPane,
  type TerminalSessionPaneHandle,
  type TerminalSessionPaneMeta
} from "@/features/mermaid-editor/components/terminal-session-pane";
import type { EditorRuntime, RuntimeTerminalShellOption } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorTheme, XtermThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";

type TerminalPanelProps = {
  runtime: EditorRuntime;
  cwd?: string;
  contextKey: string;
  visible: boolean;
  theme: EditorTheme;
  terminalTheme: XtermThemeTokens;
  onStatus: (message: string) => void;
  windowOrdinal?: number;
  onNewWindow?: () => void;
  hiddenWindows?: Array<{ id: string; label: string }>;
  onOpenWindow?: (windowId: string) => void;
  className?: string;
};

type TerminalTab = {
  id: string;
  ordinal: number;
  shellId: string;
};

let fallbackTabId = 0;

export function TerminalPanel({
  runtime,
  cwd,
  contextKey,
  visible,
  theme,
  terminalTheme,
  onStatus,
  windowOrdinal = 1,
  onNewWindow,
  hiddenWindows = [],
  onOpenWindow,
  className
}: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>(() => [createTerminalTab(1, "default")]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [metadata, setMetadata] = useState<Record<string, TerminalSessionPaneMeta>>({});
  const [shellOptions, setShellOptions] = useState<RuntimeTerminalShellOption[]>([]);
  const nextOrdinalRef = useRef(2);
  const contextKeyRef = useRef(contextKey);
  const paneHandlesRef = useRef(new Map<string, TerminalSessionPaneHandle>());
  const tabElementsRef = useRef(new Map<string, HTMLButtonElement>());

  const updateTabMeta = useCallback((tabId: string, meta: TerminalSessionPaneMeta) => {
    setMetadata((current) => sameMeta(current[tabId], meta) ? current : { ...current, [tabId]: meta });
  }, []);

  useEffect(() => {
    let disposed = false;
    void runtime.listTerminalShells().then((options) => {
      if (disposed) return;
      const availableOptions = options.filter((option) => option.available);
      setShellOptions(availableOptions.length ? availableOptions : options);
    }).catch(() => {
      if (!disposed) setShellOptions([]);
    });
    return () => {
      disposed = true;
    };
  }, [runtime]);

  useEffect(() => {
    if (contextKeyRef.current === contextKey) return;
    contextKeyRef.current = contextKey;
    nextOrdinalRef.current = 2;
    paneHandlesRef.current.clear();
    tabElementsRef.current.clear();
    const nextTab = createTerminalTab(1, "default");
    setTabs([nextTab]);
    setActiveTabId(nextTab.id);
    setMetadata({});
  }, [contextKey]);

  useEffect(() => {
    const activeElement = tabElementsRef.current.get(activeTabId);
    activeElement?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs.length]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const activeMeta = activeTab ? metadata[activeTab.id] : undefined;
  const activeBusy = Boolean(activeMeta?.busy);

  function addTab() {
    const ordinal = nextOrdinalRef.current++;
    const nextTab = createTerminalTab(ordinal, activeTab?.shellId || "default");
    setTabs((current) => [...current, nextTab]);
    setActiveTabId(nextTab.id);
  }

  function closeTab(tabId: string) {
    const index = tabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;
    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) setActiveTabId(nextTabs[index]?.id || nextTabs[index - 1]?.id || "");
    setMetadata((current) => {
      if (!(tabId in current)) return current;
      const next = { ...current };
      delete next[tabId];
      return next;
    });
    paneHandlesRef.current.delete(tabId);
    tabElementsRef.current.delete(tabId);
  }

  async function changeShell(value: string) {
    if (!activeTab || value === activeTab.shellId) return;
    setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, shellId: value } : tab));
    await paneHandlesRef.current.get(activeTab.id)?.restart(value);
  }

  function restartActiveTab() {
    if (!activeTab) return;
    void paneHandlesRef.current.get(activeTab.id)?.restart();
  }

  function clearActiveTab() {
    if (!activeTab) return;
    paneHandlesRef.current.get(activeTab.id)?.clear();
  }

  return (
    <section
      className={cn("terminal-panel isolate flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/[var(--ui-surface-opacity)]", className)}
      data-editor-floating-menu-ignore
    >
      <Tabs value={activeTabId} onValueChange={setActiveTabId} className="h-full min-h-0 gap-0">
        <WorkspaceWindowHeader
          icon={<TerminalIcon className="size-4 shrink-0 text-icon" />}
          title={<span className="terminal-heading">{windowOrdinal === 1 ? "终端" : `终端 ${windowOrdinal}`}</span>}
          titleTooltip={activeMeta?.session?.cwd || cwd || "桌面终端"}
          center={tabs.length ? (
            <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
              <TabsList variant="line" className="h-full min-w-max justify-start p-0" aria-label="终端会话">
                {tabs.map((tab) => {
                  const meta = metadata[tab.id];
                  const label = `终端 ${tab.ordinal}`;
                  const statusLabel = terminalStatusLabel(meta);
                  return (
                    <div key={tab.id} className="group/terminal-tab relative min-w-24 max-w-40 flex-none">
                      <TabsTrigger
                        ref={(element) => {
                          if (element) tabElementsRef.current.set(tab.id, element);
                          else tabElementsRef.current.delete(tab.id);
                        }}
                        value={tab.id}
                        className="w-full justify-start pr-8"
                        data-window-titlebar-drag-allow
                        aria-label={`${label}${statusLabel ? `，${statusLabel}` : ""}`}
                        title={meta?.session ? `${label} · ${meta.session.shellLabel} · ${meta.session.cwd}` : `${label}${statusLabel ? ` · ${statusLabel}` : ""}`}
                        onMouseDown={(event) => {
                          if (event.button === 0 && !event.ctrlKey) event.preventDefault();
                        }}
                        onClick={() => setActiveTabId(tab.id)}
                      >
                        <span className="truncate">{label}</span>
                      </TabsTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`关闭 ${label}`}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/terminal-tab:opacity-100 group-focus-within/terminal-tab:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeTab(tab.id);
                        }}
                      >
                        <Xmark data-icon="inline-start" />
                      </Button>
                    </div>
                  );
                })}
              </TabsList>
            </div>
          ) : null}
          actions={<>
            {activeTab && shellOptions.length > 1 ? (
              <Select value={activeTab.shellId} onValueChange={(value) => void changeShell(value)} disabled={activeBusy || runtime.kind !== "desktop"}>
                <SelectTrigger size="sm" className="w-[132px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>{shellOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}</SelectGroup>
                </SelectContent>
              </Select>
            ) : null}
            <PanelIconButton label="新建终端" disabled={runtime.kind !== "desktop"} onClick={addTab}>
              <Plus data-icon />
            </PanelIconButton>
            {onNewWindow ? (
              <PanelIconButton label="新建终端窗口" disabled={runtime.kind !== "desktop"} onClick={onNewWindow}>
                <MultiWindow data-icon />
              </PanelIconButton>
            ) : null}
            <PanelIconButton label="重启当前终端" disabled={!activeTab || activeBusy || runtime.kind !== "desktop"} onClick={restartActiveTab}>
              <Restart data-icon />
            </PanelIconButton>
          </>}
          overflowActions={[
            ...(activeTab ? [
              { id: "clear-terminal", label: "清空当前终端", icon: <Erase data-icon />, onSelect: clearActiveTab }
            ] : []),
            ...hiddenWindows.map((window) => ({
              id: `open-${window.id}`,
              label: `打开${window.label}`,
              icon: <MultiWindow data-icon />,
              onSelect: () => onOpenWindow?.(window.id)
            }))
          ]}
        />

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} forceMount className="m-0 min-h-0 p-2 data-[state=inactive]:hidden">
            <TerminalSessionPane
              ref={(handle) => {
                if (handle) paneHandlesRef.current.set(tab.id, handle);
                else paneHandlesRef.current.delete(tab.id);
              }}
              runtime={runtime}
              cwd={cwd}
              shellId={tab.shellId}
              active={tab.id === activeTabId}
              visible={visible}
              theme={theme}
              terminalTheme={terminalTheme}
              onMetaChange={(meta) => updateTabMeta(tab.id, meta)}
              onStatus={onStatus}
            />
          </TabsContent>
        ))}

        {!tabs.length ? (
          <Empty className="min-h-0">
            <EmptyHeader>
              <EmptyMedia><TerminalIcon /></EmptyMedia>
              <EmptyTitle>没有终端会话</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={addTab} disabled={runtime.kind !== "desktop"}>
                <Plus data-icon="inline-start" />
                新建终端
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}
      </Tabs>
    </section>
  );
}

function createTerminalTab(ordinal: number, shellId: string): TerminalTab {
  const id = globalThis.crypto?.randomUUID?.() || `terminal-tab-${++fallbackTabId}`;
  return { id, ordinal, shellId };
}

function terminalStatusLabel(meta: TerminalSessionPaneMeta | undefined) {
  if (!meta) return "正在准备";
  if (meta.phase === "opening") return "正在启动";
  if (meta.phase === "exited") return "已退出";
  if (meta.phase === "unsupported") return "不可用";
  if (meta.phase === "error") return "启动失败";
  return "";
}

function sameMeta(left: TerminalSessionPaneMeta | undefined, right: TerminalSessionPaneMeta) {
  return left?.busy === right.busy && left.phase === right.phase && left.session === right.session;
}

function PanelIconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <EditorIconButton context="panel" label={label} tooltipSide="top" {...props}>{children}</EditorIconButton>;
}
