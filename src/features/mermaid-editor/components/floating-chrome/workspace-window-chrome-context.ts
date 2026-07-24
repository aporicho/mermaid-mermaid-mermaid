import { createContext, useContext } from "react";

import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";

export type WorkspaceWindowChrome = {
  titleId: string;
  allowFullscreen: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  closeLabel: string;
  tooltipSide: "top" | "right" | "bottom" | "left";
};

export const WorkspaceWindowChromeContext = createContext<WorkspaceWindowChrome | null>(null);

export function useWorkspaceWindowChrome() {
  return useContext(WorkspaceWindowChromeContext);
}
