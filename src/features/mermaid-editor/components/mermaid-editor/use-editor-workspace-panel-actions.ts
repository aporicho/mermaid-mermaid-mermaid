import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import type { StaticWorkspacePanelId, WorkspaceFloatingPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

type UseEditorWorkspacePanelActionsArgs = {
  bringWorkspacePanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  setWorkspacePanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  setLeftCollapsed: (collapsed: boolean) => void;
  setRightCollapsed: (collapsed: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
};

export function useEditorWorkspacePanelActions({
  bringWorkspacePanelToFront,
  setWorkspacePanelWindowState,
  setLeftCollapsed,
  setRightCollapsed,
  setTerminalOpen
}: UseEditorWorkspacePanelActionsArgs) {
  function openWorkspacePanel(panelId: StaticWorkspacePanelId) {
    bringWorkspacePanelToFront(panelId);
    if (panelId === "explorer") setLeftCollapsed(false);
    if (panelId === "inspector") setRightCollapsed(false);
    if (panelId === "terminal") setTerminalOpen(true);
  }

  function closeWorkspacePanel(panelId: StaticWorkspacePanelId) {
    setWorkspacePanelWindowState(panelId, "normal");
    if (panelId === "explorer") setLeftCollapsed(true);
    if (panelId === "inspector") setRightCollapsed(true);
    if (panelId === "terminal") setTerminalOpen(false);
  }

  return { openWorkspacePanel, closeWorkspacePanel };
}
