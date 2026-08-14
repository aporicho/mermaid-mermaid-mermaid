import { createContext, useContext, type ReactNode } from "react";

import type { WorkspacePanelHeaderContextValue } from "./use-workspace-panel-header-auto-hide";

export {
  WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS,
  WORKSPACE_PANEL_HEADER_REVEAL_HOT_ZONE_PX,
  useWorkspacePanelHeaderAutoHide,
  type WorkspaceTitlebarAutoHideLayout
} from "./use-workspace-panel-header-auto-hide";

const WorkspacePanelHeaderContext = createContext<WorkspacePanelHeaderContextValue | null>(null);

export function WorkspacePanelHeaderProvider({ value, children }: { value: WorkspacePanelHeaderContextValue | null; children: ReactNode }) {
  return <WorkspacePanelHeaderContext.Provider value={value}>{children}</WorkspacePanelHeaderContext.Provider>;
}

export function useWorkspacePanelHeader() {
  return useContext(WorkspacePanelHeaderContext);
}
