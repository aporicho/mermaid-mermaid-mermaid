import { lazy, Suspense } from "react";
import type { AgentWorkspaceActivity } from "@/features/mermaid-editor/components/agent/agent-workspace-types";

import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import type { EditorRuntime, RuntimeAgentDocumentBridge } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorTheme, XtermThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type ChromeWorkspacePanelId,
  type DetachedTerminalWindow,
  type TerminalWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

const AgentWorkspacePanel = lazy(() => import("@/features/mermaid-editor/components/agent/agent-workspace-panel").then((module) => ({ default: module.AgentWorkspacePanel })));

type AgentTerminalWorkspacePanelsProps = {
  runtime: EditorRuntime;
  agentOpen: boolean;
  terminalOpen: boolean;
  detachedTerminalWindows: DetachedTerminalWindow[];
  agentDocumentBridge: RuntimeAgentDocumentBridge;
  agentProjectRoot?: string;
  terminalCwd?: string;
  terminalContextKey: string;
  activeTheme: EditorTheme;
  terminalTheme: XtermThemeTokens;
  titlebarAutoHide: boolean;
  activePanel: WorkspaceFloatingPanelId | null;
  stackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  windowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  bringToFront: (panelId: WorkspaceFloatingPanelId) => void;
  closePanel: (panelId: ChromeWorkspacePanelId) => void;
  newTerminalWindow: () => void;
  openTerminalWindow: (panelId: "terminal" | TerminalWindowPanelId) => void;
  closeTerminalWindow: (panelId: TerminalWindowPanelId) => void;
  onStatus: (message: string) => void;
  onAgentActivityChange: (activity: AgentWorkspaceActivity) => void;
};

export function AgentTerminalWorkspacePanels(props: AgentTerminalWorkspacePanelsProps) {
  const terminalWindows: Array<{ id: "terminal" | TerminalWindowPanelId; ordinal: number; open: boolean }> = [
    { id: "terminal", ordinal: 1, open: props.terminalOpen },
    ...props.detachedTerminalWindows
  ];

  return <>
    {terminalWindows.map((terminalWindow) => (
      <WorkspaceFloatingWindow
        key={terminalWindow.id}
        open={terminalWindow.open}
        placement={terminalWindow.ordinal % 2 === 0 ? "center-panel" : "bottom-panel"}
        panelId={terminalWindow.id}
        titlebarAutoHide={props.titlebarAutoHide}
        active={props.activePanel === terminalWindow.id}
        stackIndex={props.stackPosition(terminalWindow.id)}
        onFocusPanel={() => props.bringToFront(terminalWindow.id)}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.terminal}
        minSize={WORKSPACE_PANEL_MIN_SIZES.terminal}
        windowState={props.windowState(terminalWindow.id)}
        onWindowStateChange={(state) => props.setWindowState(terminalWindow.id, state)}
        onClose={() => terminalWindow.id === "terminal"
          ? props.closePanel("terminal")
          : props.closeTerminalWindow(terminalWindow.id)}
        closeLabel={`隐藏终端窗口 ${terminalWindow.ordinal}`}
        tooltipSide="top"
        mountStrategy="keep-alive"
      >
        <TerminalPanel
          runtime={props.runtime}
          cwd={props.terminalCwd}
          contextKey={props.terminalContextKey}
          visible={terminalWindow.open}
          theme={props.activeTheme}
          terminalTheme={props.terminalTheme}
          windowOrdinal={terminalWindow.ordinal}
          onNewWindow={props.newTerminalWindow}
          hiddenWindows={terminalWindows
            .filter((candidate) => !candidate.open && candidate.id !== terminalWindow.id)
            .map((candidate) => ({ id: candidate.id, label: `终端窗口 ${candidate.ordinal}` }))}
          onOpenWindow={(panelId) => props.openTerminalWindow(panelId as "terminal" | TerminalWindowPanelId)}
          onStatus={props.onStatus}
        />
      </WorkspaceFloatingWindow>
    ))}
    <WorkspaceFloatingWindow
      open={props.agentOpen}
      placement="bottom-panel"
      panelId="agent"
      titlebarAutoHide={props.titlebarAutoHide}
      active={props.activePanel === "agent"}
      stackIndex={props.stackPosition("agent")}
      onFocusPanel={() => props.bringToFront("agent")}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.agent}
      minSize={WORKSPACE_PANEL_MIN_SIZES.agent}
      windowState={props.windowState("agent")}
      onWindowStateChange={(state) => props.setWindowState("agent", state)}
      onClose={() => props.closePanel("agent")}
      closeLabel="关闭 Pi Agent"
      tooltipSide="top"
      mountStrategy="keep-alive"
    >
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">正在载入 Pi Agent…</div>}>
        <AgentWorkspacePanel
          runtime={props.runtime}
          enabled={props.agentOpen}
          cwd={props.terminalCwd}
          projectRoot={props.agentProjectRoot}
          documentBridge={props.agentDocumentBridge}
          onActivityChange={props.onAgentActivityChange}
        />
      </Suspense>
    </WorkspaceFloatingWindow>
  </>;
}
