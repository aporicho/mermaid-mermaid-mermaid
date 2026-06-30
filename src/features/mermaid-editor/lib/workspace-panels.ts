import { useCallback, useMemo, useState } from "react";

import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  bringFloatingPanelToFront,
  floatingPanelStackIndex,
  type FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";

export type StaticWorkspacePanelId = "explorer" | "inspector" | "terminal";
export type MarkdownWindowPanelId = `markdown:${string}`;
export type BrowserWindowPanelId = `browser:${string}`;
export type WorkspaceFloatingPanelId = StaticWorkspacePanelId | MarkdownWindowPanelId | BrowserWindowPanelId;

export type DetachedMarkdownWindow = {
  id: MarkdownWindowPanelId;
  file: RuntimeFileRef;
  title: string;
  value: string;
  savedValue: string;
};

export type DetachedBrowserWindow = {
  id: BrowserWindowPanelId;
  title: string;
  url: string;
};

const DEFAULT_WORKSPACE_PANEL_STACK: WorkspaceFloatingPanelId[] = ["explorer", "inspector", "terminal"];
const DEFAULT_WORKSPACE_PANEL_WINDOW_STATES: Record<StaticWorkspacePanelId, FloatingPanelWindowState> = {
  explorer: "normal",
  inspector: "normal",
  terminal: "normal"
};

export const WORKSPACE_PANEL_DEFAULT_SIZES: Record<StaticWorkspacePanelId | "markdown" | "browser", { width: number; height: number }> = {
  explorer: { width: 360, height: 640 },
  inspector: { width: 360, height: 640 },
  terminal: { width: 860, height: 320 },
  markdown: { width: 760, height: 640 },
  browser: { width: 920, height: 680 }
};

export const WORKSPACE_PANEL_MIN_SIZES: Record<StaticWorkspacePanelId | "markdown" | "browser", { width: number; height: number }> = {
  explorer: { width: 320, height: 220 },
  inspector: { width: 320, height: 220 },
  terminal: { width: 560, height: 260 },
  markdown: { width: 420, height: 300 },
  browser: { width: 520, height: 360 }
};

export function markdownWindowPanelId(file: Pick<RuntimeFileRef, "name" | "path">): MarkdownWindowPanelId {
  return `markdown:${file.path || file.name}` as MarkdownWindowPanelId;
}

export function browserWindowPanelId(url: string): BrowserWindowPanelId {
  return `browser:${hashText(url)}` as BrowserWindowPanelId;
}

export function useWorkspacePanels({
  leftCollapsed,
  rightCollapsed,
  terminalOpen,
  documentKind,
  detachedMarkdownWindows,
  detachedBrowserWindows
}: {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  documentKind: DocumentKind;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedBrowserWindows: DetachedBrowserWindow[];
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
    panelIds.push(...detachedMarkdownWindows.map((window) => window.id));
    panelIds.push(...detachedBrowserWindows.map((window) => window.id));
    return panelIds;
  }, [detachedBrowserWindows, detachedMarkdownWindows, documentKind, leftCollapsed, rightCollapsed, terminalOpen]);

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
    setWorkspacePanelWindowStates((current) => ({ ...current, [panelId]: state }));
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

  return {
    activeWorkspacePanel,
    bringWorkspacePanelToFront,
    removeWorkspacePanel,
    setWorkspacePanelWindowState,
    workspacePanelStackPosition,
    workspacePanelWindowState
  };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
