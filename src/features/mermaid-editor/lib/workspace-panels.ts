import { useCallback, useMemo, useState } from "react";

import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  bringFloatingPanelToFront,
  floatingPanelStackIndex,
  type FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";

export type StaticWorkspacePanelId = "explorer" | "inspector" | "terminal" | "theme";
export type ChromeWorkspacePanelId = Exclude<StaticWorkspacePanelId, "theme">;
export type MarkdownWindowPanelId = `markdown:${string}`;
export type BrowserWindowPanelId = `browser:${string}`;
export type WorkspaceFloatingPanelId = StaticWorkspacePanelId | MarkdownWindowPanelId;

export type DetachedMarkdownWindow = {
  id: MarkdownWindowPanelId;
  file: RuntimeFileRef;
  title: string;
  value: string;
  savedValue: string;
};

export const MARKDOWN_WINDOW_A4_SIZE = { width: 1050, height: 1485 } as const;

const DEFAULT_WORKSPACE_PANEL_STACK: WorkspaceFloatingPanelId[] = ["explorer", "inspector", "terminal", "theme"];
const DEFAULT_WORKSPACE_PANEL_WINDOW_STATES: Record<StaticWorkspacePanelId, FloatingPanelWindowState> = {
  explorer: "normal",
  inspector: "normal",
  terminal: "normal",
  theme: "normal"
};

export const WORKSPACE_PANEL_DEFAULT_SIZES: Record<StaticWorkspacePanelId | "markdown", { width: number; height: number }> = {
  explorer: { width: 360, height: 640 },
  inspector: { width: 360, height: 640 },
  terminal: { width: 860, height: 320 },
  theme: { width: 620, height: 720 },
  markdown: MARKDOWN_WINDOW_A4_SIZE
};

export const WORKSPACE_PANEL_MIN_SIZES: Record<StaticWorkspacePanelId | "markdown", { width: number; height: number }> = {
  explorer: { width: 320, height: 220 },
  inspector: { width: 320, height: 220 },
  terminal: { width: 560, height: 260 },
  theme: { width: 480, height: 360 },
  markdown: { width: 420, height: 300 }
};

export function markdownWindowPanelId(file: Pick<RuntimeFileRef, "name" | "path">): MarkdownWindowPanelId {
  return `markdown:${file.path || file.name}` as MarkdownWindowPanelId;
}

export function useWorkspacePanels({
  leftCollapsed,
  rightCollapsed,
  terminalOpen,
  themeSettingsOpen,
  documentKind,
  detachedMarkdownWindows
}: {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  themeSettingsOpen: boolean;
  documentKind: DocumentKind;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
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
    if (themeSettingsOpen) panelIds.push("theme");
    panelIds.push(...detachedMarkdownWindows.map((window) => window.id));
    return panelIds;
  }, [detachedMarkdownWindows, documentKind, leftCollapsed, rightCollapsed, terminalOpen, themeSettingsOpen]);

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
