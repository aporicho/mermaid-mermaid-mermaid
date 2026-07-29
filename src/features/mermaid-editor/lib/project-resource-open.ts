import type { FloatingPanelRect } from "@/features/mermaid-editor/lib/floating-chrome";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";

export type ProjectResourceOpenMode = "current" | "floating";

export type ProjectResourceOpenSource =
  | "explorer"
  | "markdown-link"
  | "canvas-node"
  | "recent"
  | "drop";

export type WorkspaceWindowPlacementAnchor = {
  anchorRect?: FloatingPanelRect;
  sourcePanelId?: string;
  sourcePanelRect?: FloatingPanelRect;
  sourceTitlebarHeight?: number;
};

export type ProjectResourceOpenRequest = {
  file: ProjectFileEntry;
  mode: ProjectResourceOpenMode;
  source: ProjectResourceOpenSource;
  placementAnchor?: WorkspaceWindowPlacementAnchor;
};
