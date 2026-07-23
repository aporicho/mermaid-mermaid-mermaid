import { lazy, Suspense } from "react";

import type { AgentController } from "@/features/mermaid-editor/components/agent/use-agent-session";
import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorTheme, XtermThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type ChromeWorkspacePanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

const AgentPanel = lazy(() => import("@/features/mermaid-editor/components/agent/agent-panel").then((module) => ({ default: module.AgentPanel })));

type AgentTerminalWorkspacePanelsProps = {
  runtime: EditorRuntime;
  agentOpen: boolean;
  terminalOpen: boolean;
  agentController: AgentController;
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
  onStatus: (message: string) => void;
};

export function AgentTerminalWorkspacePanels(props: AgentTerminalWorkspacePanelsProps) {
  return <>
    <WorkspaceFloatingWindow
      open={props.terminalOpen}
      placement="bottom-panel"
      panelId="terminal"
      titlebarAutoHide={props.titlebarAutoHide}
      active={props.activePanel === "terminal"}
      stackIndex={props.stackPosition("terminal")}
      onFocusPanel={() => props.bringToFront("terminal")}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.terminal}
      minSize={WORKSPACE_PANEL_MIN_SIZES.terminal}
      windowState={props.windowState("terminal")}
      onWindowStateChange={(state) => props.setWindowState("terminal", state)}
      onClose={() => props.closePanel("terminal")}
      closeLabel="隐藏终端"
      tooltipSide="top"
      mountStrategy="keep-alive"
    >
      <TerminalPanel
        runtime={props.runtime}
        cwd={props.terminalCwd}
        contextKey={props.terminalContextKey}
        visible={props.terminalOpen}
        theme={props.activeTheme}
        terminalTheme={props.terminalTheme}
        onStatus={props.onStatus}
      />
    </WorkspaceFloatingWindow>
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
    >
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">正在载入 Pi Agent…</div>}>
        <AgentPanel
          runtime={props.runtime}
          controller={props.agentController}
        />
      </Suspense>
    </WorkspaceFloatingWindow>
  </>;
}
