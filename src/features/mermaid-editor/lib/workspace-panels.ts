import { useCallback, useEffect, useMemo, useState } from "react";

import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { BrowserToolWindowRequest } from "@/features/mermaid-editor/lib/browser-tool-window";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  bringFloatingPanelToFront,
  floatingPanelStackIndex,
  type FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";

export type StaticWorkspacePanelId = "explorer" | "inspector" | "terminal" | "agent" | "theme";
export type ChromeWorkspacePanelId = Exclude<StaticWorkspacePanelId, "theme">;
export type MarkdownWindowPanelId = `markdown:${string}`;
export type BrowserWindowPanelId = `browser:${string}`;
export type HtmlWindowPanelId = `html:${string}`;
export type ImageWindowPanelId = `image:${string}`;
export type WorkspaceFloatingPanelId = StaticWorkspacePanelId | MarkdownWindowPanelId | BrowserWindowPanelId | HtmlWindowPanelId | ImageWindowPanelId;

export type DetachedMarkdownWindow = {
  id: MarkdownWindowPanelId;
  file: RuntimeFileRef;
  title: string;
  value: string;
  savedValue: string;
  missing?: boolean;
};

export type DetachedBrowserWindow = {
  id: BrowserWindowPanelId;
  request: BrowserToolWindowRequest;
};

export type DetachedHtmlWindow = {
  id: HtmlWindowPanelId;
  file: RuntimeFileRef & { path: string };
  title: string;
  url: string;
  revision?: number;
  missing?: boolean;
};

export type DetachedImageWindow = {
  id: ImageWindowPanelId;
  file: RuntimeFileRef & { path: string };
  title: string;
  source?: string;
  documentFile?: RuntimeFileRef | null;
  watchPath?: string;
  revision?: number;
  missing?: boolean;
  navigation?: ImageWindowNavigation;
};

export type ImageWindowNavigationKind = "project-directory" | "canvas";

export type ImageWindowNavigationItem = {
  source: string;
  title: string;
  identity: string;
  documentFile?: RuntimeFileRef | null;
  watchPath?: string;
};

export type ImageWindowNavigation = {
  kind: ImageWindowNavigationKind;
  items: ImageWindowNavigationItem[];
  index: number;
};

export type ImageWindowNavigationRequest = {
  kind: ImageWindowNavigationKind;
  items: Array<Omit<ImageWindowNavigationItem, "title"> & { title?: string }>;
};

export type ImageWindowOpenRequest = {
  source: string;
  title?: string;
  identity?: string;
  documentFile?: RuntimeFileRef | null;
  watchPath?: string;
  navigation?: ImageWindowNavigationRequest;
};

export const MARKDOWN_WINDOW_A4_SIZE = { width: 1050, height: 1485 } as const;

const DEFAULT_WORKSPACE_PANEL_STACK: WorkspaceFloatingPanelId[] = ["explorer", "inspector", "terminal", "agent", "theme"];
const DEFAULT_WORKSPACE_PANEL_WINDOW_STATES: Record<StaticWorkspacePanelId, FloatingPanelWindowState> = {
  explorer: "normal",
  inspector: "normal",
  terminal: "normal",
  agent: "normal",
  theme: "normal"
};

export const WORKSPACE_PANEL_DEFAULT_SIZES: Record<StaticWorkspacePanelId | "markdown" | "browser" | "html" | "image", { width: number; height: number }> = {
  explorer: { width: 360, height: 640 },
  inspector: { width: 360, height: 640 },
  terminal: { width: 860, height: 320 },
  agent: { width: 960, height: 720 },
  theme: { width: 620, height: 720 },
  markdown: MARKDOWN_WINDOW_A4_SIZE,
  browser: { width: 1040, height: 720 },
  html: { width: 1040, height: 720 },
  image: { width: 960, height: 720 }
};

export const WORKSPACE_PANEL_MIN_SIZES: Record<StaticWorkspacePanelId | "markdown" | "browser" | "html" | "image", { width: number; height: number }> = {
  explorer: { width: 320, height: 220 },
  inspector: { width: 320, height: 220 },
  terminal: { width: 560, height: 260 },
  agent: { width: 640, height: 420 },
  theme: { width: 480, height: 360 },
  markdown: { width: 420, height: 300 },
  browser: { width: 640, height: 420 },
  html: { width: 640, height: 420 },
  image: { width: 420, height: 300 }
};

export function markdownWindowPanelId(file: Pick<RuntimeFileRef, "name" | "path">): MarkdownWindowPanelId {
  return `markdown:${file.path || file.name}` as MarkdownWindowPanelId;
}

export function htmlWindowPanelId(file: Pick<RuntimeFileRef, "name" | "path">): HtmlWindowPanelId {
  return `html:${file.path || file.name}` as HtmlWindowPanelId;
}

export function imageWindowPanelId(file: Pick<RuntimeFileRef, "name" | "path">): ImageWindowPanelId {
  return `image:${file.path || file.name}` as ImageWindowPanelId;
}

export function useWorkspacePanels({
  leftCollapsed,
  rightCollapsed,
  agentOpen,
  terminalOpen,
  themeSettingsOpen,
  documentKind,
  detachedMarkdownWindows,
  detachedBrowserWindows,
  detachedHtmlWindows,
  detachedImageWindows
}: {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  agentOpen: boolean;
  terminalOpen: boolean;
  themeSettingsOpen: boolean;
  documentKind: DocumentKind;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedBrowserWindows: DetachedBrowserWindow[];
  detachedHtmlWindows: DetachedHtmlWindow[];
  detachedImageWindows: DetachedImageWindow[];
}) {
  const [workspacePanelStack, setWorkspacePanelStack] = useState<WorkspaceFloatingPanelId[]>(DEFAULT_WORKSPACE_PANEL_STACK);
  const [workspacePanelWindowStates, setWorkspacePanelWindowStates] = useState<Record<string, FloatingPanelWindowState>>(() => ({
    ...DEFAULT_WORKSPACE_PANEL_WINDOW_STATES
  }));

  const openWorkspacePanelIds = useMemo(() => {
    const panelIds: WorkspaceFloatingPanelId[] = [];
    if (!leftCollapsed) panelIds.push("explorer");
    if (!rightCollapsed && documentKind === "mermaid") panelIds.push("inspector");
    if (terminalOpen) panelIds.push("terminal");
    if (agentOpen) panelIds.push("agent");
    if (themeSettingsOpen) panelIds.push("theme");
    panelIds.push(...detachedMarkdownWindows.map((window) => window.id));
    panelIds.push(...detachedBrowserWindows.map((window) => window.id));
    panelIds.push(...detachedHtmlWindows.map((window) => window.id));
    panelIds.push(...detachedImageWindows.map((window) => window.id));
    return panelIds;
  }, [agentOpen, detachedBrowserWindows, detachedHtmlWindows, detachedImageWindows, detachedMarkdownWindows, documentKind, leftCollapsed, rightCollapsed, terminalOpen, themeSettingsOpen]);

  const activeWorkspacePanel = useMemo(() => {
    for (let index = workspacePanelStack.length - 1; index >= 0; index -= 1) {
      const panelId = workspacePanelStack[index];
      if (openWorkspacePanelIds.includes(panelId)) return panelId;
    }
    return null;
  }, [openWorkspacePanelIds, workspacePanelStack]);

  const bringWorkspacePanelToFront = useCallback((panelId: WorkspaceFloatingPanelId) => {
    setWorkspacePanelStack((current) => bringFloatingPanelToFront(current, panelId));
  }, []);

  const setWorkspacePanelWindowState = useCallback((panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => {
    const fullscreenAllowed = panelId === "agent" || panelId === "terminal" || panelId.startsWith("markdown:") || panelId.startsWith("browser:") || panelId.startsWith("html:") || panelId.startsWith("image:");
    const nextState = state === "fullscreen" && !fullscreenAllowed ? "normal" : state;
    if (nextState === "fullscreen") {
      setWorkspacePanelStack((current) => bringFloatingPanelToFront(current, panelId));
    }
    setWorkspacePanelWindowStates((current) => nextState === "fullscreen"
      ? Object.fromEntries([...Object.keys(current), panelId].map((id) => [id, id === panelId ? "fullscreen" : "normal"]))
      : { ...current, [panelId]: nextState });
  }, []);

  useEffect(() => {
    function exitFloatingPanelFullscreen(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setWorkspacePanelWindowStates((current) => {
        if (!Object.values(current).includes("fullscreen")) return current;
        return Object.fromEntries(Object.entries(current).map(([id, state]) => [id, state === "fullscreen" ? "normal" : state]));
      });
    }
    window.addEventListener("keydown", exitFloatingPanelFullscreen);
    return () => window.removeEventListener("keydown", exitFloatingPanelFullscreen);
  }, []);

  const removeWorkspacePanel = useCallback((panelId: WorkspaceFloatingPanelId) => {
    setWorkspacePanelWindowStates((current) => ({ ...current, [panelId]: "normal" }));
    setWorkspacePanelStack((current) => current.filter((item) => item !== panelId));
  }, []);

  const workspacePanelStackPosition = useCallback((panelId: WorkspaceFloatingPanelId) => {
    return floatingPanelStackIndex(workspacePanelStack, panelId);
  }, [workspacePanelStack]);

  const workspacePanelWindowState = useCallback((panelId: WorkspaceFloatingPanelId) => {
    return workspacePanelWindowStates[panelId] ?? "normal";
  }, [workspacePanelWindowStates]);

  const fullscreenWorkspacePanel = useMemo(() => {
    return resolveFullscreenWorkspacePanel(workspacePanelStack, openWorkspacePanelIds, workspacePanelWindowStates);
  }, [openWorkspacePanelIds, workspacePanelStack, workspacePanelWindowStates]);

  return {
    activeWorkspacePanel,
    fullscreenWorkspacePanel,
    bringWorkspacePanelToFront,
    removeWorkspacePanel,
    setWorkspacePanelWindowState,
    workspacePanelStackPosition,
    workspacePanelWindowState
  };
}

export function resolveFullscreenWorkspacePanel(
  stack: readonly WorkspaceFloatingPanelId[],
  openPanelIds: readonly WorkspaceFloatingPanelId[],
  windowStates: Readonly<Record<string, FloatingPanelWindowState>>
) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const panelId = stack[index];
    if (openPanelIds.includes(panelId) && windowStates[panelId] === "fullscreen") return panelId;
  }
  return null;
}
