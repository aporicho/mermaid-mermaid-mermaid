import { lazy, Suspense } from "react";
import { Xmark } from "iconoir-react/regular";

import type { AgentController } from "@/features/mermaid-editor/components/agent/use-agent-session";
import { FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";
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
    <FloatingPanel
      open={props.terminalOpen}
      placement="bottom-panel"
      kind="workspace"
      dismissMode="explicit"
      panelId="terminal"
      titlebarAutoHide={props.titlebarAutoHide}
      active={props.activePanel === "terminal"}
      stackIndex={props.stackPosition("terminal")}
      onFocusPanel={() => props.bringToFront("terminal")}
      resetDragOnOpen={false}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.terminal}
      minSize={WORKSPACE_PANEL_MIN_SIZES.terminal}
      windowState={props.windowState("terminal")}
      onWindowStateChange={(state) => props.setWindowState("terminal", state)}
      className="grid h-full w-full overflow-hidden"
    >
      <TerminalPanel
        runtime={props.runtime}
        cwd={props.terminalCwd}
        theme={props.activeTheme}
        terminalTheme={props.terminalTheme}
        onClose={() => props.closePanel("terminal")}
        onStatus={props.onStatus}
        windowControls={<WorkspacePanelControls
          allowFullscreen
          windowState={props.windowState("terminal")}
          onWindowStateChange={(state) => props.setWindowState("terminal", state)}
          onClose={() => props.closePanel("terminal")}
          closeLabel="关闭终端"
          closeTooltipSide="top"
          closeIcon={<Xmark />}
        />}
      />
    </FloatingPanel>
    <FloatingPanel
      open={props.agentOpen}
      placement="bottom-panel"
      kind="workspace"
      dismissMode="explicit"
      panelId="agent"
      titlebarAutoHide={props.titlebarAutoHide}
      active={props.activePanel === "agent"}
      stackIndex={props.stackPosition("agent")}
      onFocusPanel={() => props.bringToFront("agent")}
      resetDragOnOpen={false}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.agent}
      minSize={WORKSPACE_PANEL_MIN_SIZES.agent}
      windowState={props.windowState("agent")}
      onWindowStateChange={(state) => props.setWindowState("agent", state)}
      className="grid h-full w-full overflow-hidden"
    >
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">正在载入 Pi Agent…</div>}>
        <AgentPanel
          runtime={props.runtime}
          controller={props.agentController}
          windowControls={<WorkspacePanelControls
            allowFullscreen
            windowState={props.windowState("agent")}
            onWindowStateChange={(state) => props.setWindowState("agent", state)}
            onClose={() => props.closePanel("agent")}
            closeLabel="关闭 Pi Agent"
            closeTooltipSide="top"
            closeIcon={<Xmark />}
          />}
        />
      </Suspense>
    </FloatingPanel>
  </>;
}
