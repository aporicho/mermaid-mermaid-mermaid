import type { PointerEventHandler } from "react";
import {
  DotsGrid3x3 as Grid3X3,
  SidebarExpand as PanelLeftOpen,
  SidebarExpand as PanelRightOpen,
  ChatBubble,
  Terminal
} from "iconoir-react/regular";

import { FileMenu, SecondaryActionsMenu, ViewFilterMenu } from "@/features/mermaid-editor/components/editor-menus";
import { FloatingChromeLayer, FloatingChromeSlot, FloatingIconButton } from "@/features/mermaid-editor/components/floating-chrome";
import { DesktopWindowControls, ToolModeCluster, WorkspaceViewCluster } from "@/features/mermaid-editor/components/workspace-view-controls";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditableKind, EdgeRouting, EditorMode, GraphDirection, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { ChromeWorkspacePanelId } from "@/features/mermaid-editor/lib/workspace-panels";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";

type EditorFloatingChromeProps = {
  runtime: EditorRuntime;
  isDesktopChrome: boolean;
  documentKind: DocumentKind;
  editableKind: EditableKind;
  workspaceView: WorkspaceView;
  canvasViewTooltip: string;
  fileMenuOpen: boolean;
  viewFiltersOpen: boolean;
  secondaryActionsOpen: boolean;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  agentOpen: boolean;
  terminalOpen: boolean;
  recentFiles: RecentFileEntry[];
  projectBusy: boolean;
  isDirty: boolean;
  viewFilters: ViewFilters;
  hiddenViewFilters: number;
  isCanvasEditable: boolean;
  direction: GraphDirection;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  preferences: EditorPreferences;
  mode: EditorMode;
  onFileMenuOpenChange: (open: boolean) => void;
  onViewFiltersOpenChange: (open: boolean) => void;
  onSecondaryActionsOpenChange: (open: boolean) => void;
  onNewMermaidFile: () => void | Promise<unknown>;
  onNewMarkdownFile: () => void | Promise<unknown>;
  onNewCanvasFile: () => void | Promise<unknown>;
  onOpenFile: () => void | Promise<unknown>;
  onOpenRecent: (file: RecentFileEntry) => void | Promise<unknown>;
  onOpenProject: () => void | Promise<unknown>;
  onSaveFile: () => void | Promise<unknown>;
  onSaveAs: () => void | Promise<unknown>;
  onStartDesktopWindowDrag: PointerEventHandler<HTMLButtonElement>;
  onToggleDesktopWindowMaximize: () => void | Promise<unknown>;
  onWorkspaceViewChange: (view: WorkspaceView) => void;
  onViewFiltersChange: (filters: ViewFilters, message: string) => void;
  onResetViewFilters: () => void;
  onOpenWorkspacePanel: (panelId: ChromeWorkspacePanelId) => void;
  onAddNode: () => void;
  onAddTableNode: () => void;
  onAddImageNode: () => void | Promise<unknown>;
  onAddMarkdownDocument: () => void;
  onAddHtmlDocument: () => void;
  onCreateGroup: () => void;
  onDirectionChange: (direction: GraphDirection) => void;
  onEdgeRoutingChange: (edgeRouting: EdgeRouting) => void;
  onLayoutModeChange: (layoutMode: LayoutMode) => void;
  onPreferencesChange: (preferences: EditorPreferences, message?: string) => void;
  onRefreshSource: () => void;
  onSyncAutoLayout: () => void;
  onResetView: () => void;
  onOpenThemeSettings: () => void;
  onToolModeChange: (mode: EditorMode) => void;
};

export function EditorFloatingChrome({
  runtime,
  isDesktopChrome,
  documentKind,
  editableKind,
  workspaceView,
  canvasViewTooltip,
  fileMenuOpen,
  viewFiltersOpen,
  secondaryActionsOpen,
  leftCollapsed,
  rightCollapsed,
  agentOpen,
  terminalOpen,
  recentFiles,
  projectBusy,
  isDirty,
  viewFilters,
  hiddenViewFilters,
  isCanvasEditable,
  direction,
  edgeRouting,
  layoutMode,
  preferences,
  mode,
  onFileMenuOpenChange,
  onViewFiltersOpenChange,
  onSecondaryActionsOpenChange,
  onNewMermaidFile,
  onNewMarkdownFile,
  onNewCanvasFile,
  onOpenFile,
  onOpenRecent,
  onOpenProject,
  onSaveFile,
  onSaveAs,
  onStartDesktopWindowDrag,
  onToggleDesktopWindowMaximize,
  onWorkspaceViewChange,
  onViewFiltersChange,
  onResetViewFilters,
  onOpenWorkspacePanel,
  onAddNode,
  onAddTableNode,
  onAddImageNode,
  onAddMarkdownDocument,
  onAddHtmlDocument,
  onCreateGroup,
  onDirectionChange,
  onEdgeRoutingChange,
  onLayoutModeChange,
  onPreferencesChange,
  onRefreshSource,
  onSyncAutoLayout,
  onResetView,
  onOpenThemeSettings,
  onToolModeChange
}: EditorFloatingChromeProps) {
  return (
    <FloatingChromeLayer>
      <FloatingChromeSlot placement="topLeft" pinned={fileMenuOpen}>
        <FileMenu
          open={fileMenuOpen}
          recentFiles={recentFiles}
          runtimeKind={runtime.kind}
          projectBusy={projectBusy}
          isDirty={isDirty}
          onOpenChange={onFileMenuOpenChange}
          onNewMermaidFile={() => void onNewMermaidFile()}
          onNewMarkdownFile={() => void onNewMarkdownFile()}
          onNewCanvasFile={() => void onNewCanvasFile()}
          onOpenFile={() => void onOpenFile()}
          onOpenRecent={(file) => void onOpenRecent(file)}
          onOpenProject={() => void onOpenProject()}
          onSaveFile={() => void onSaveFile()}
          onSaveAs={() => void onSaveAs()}
        />
      </FloatingChromeSlot>

      {isDesktopChrome ? (
        <FloatingChromeSlot placement="topCenter">
          <FloatingIconButton
            type="button"
            label="拖拽移动窗口，双击最大化"
            tooltipSide="bottom"
            onPointerDown={onStartDesktopWindowDrag}
            onDoubleClick={() => void onToggleDesktopWindowMaximize()}
          >
            <Grid3X3 />
          </FloatingIconButton>
        </FloatingChromeSlot>
      ) : null}

      {isDesktopChrome ? (
        <FloatingChromeSlot placement="topRight">
          <DesktopWindowControls runtime={runtime} />
        </FloatingChromeSlot>
      ) : null}

      {documentKind !== "canvas" ? (
        <FloatingChromeSlot placement="rightView">
          <WorkspaceViewCluster
            workspaceView={workspaceView}
            editableKind={editableKind}
            documentKind={documentKind}
            canvasViewTooltip={canvasViewTooltip}
            onChange={onWorkspaceViewChange}
          />
        </FloatingChromeSlot>
      ) : null}

      {documentKind === "mermaid" ? (
        <FloatingChromeSlot placement="rightFilter" pinned={viewFiltersOpen}>
          <ViewFilterMenu
            open={viewFiltersOpen}
            filters={viewFilters}
            hiddenCount={hiddenViewFilters}
            editable={isCanvasEditable}
            onOpenChange={onViewFiltersOpenChange}
            onChange={onViewFiltersChange}
            onReset={onResetViewFilters}
          />
        </FloatingChromeSlot>
      ) : null}

      {leftCollapsed ? (
        <FloatingChromeSlot placement="leftCenter">
          <FloatingIconButton
            label="展开左侧文件夹"
            tooltipSide="right"
            onClick={() => onOpenWorkspacePanel("explorer")}
          >
            <PanelLeftOpen />
          </FloatingIconButton>
        </FloatingChromeSlot>
      ) : null}

      {documentKind === "mermaid" && rightCollapsed ? (
        <FloatingChromeSlot placement="rightCenter">
          <FloatingIconButton
            label="展开右侧检查器"
            tooltipSide="left"
            onClick={() => onOpenWorkspacePanel("inspector")}
          >
            <PanelRightOpen />
          </FloatingIconButton>
        </FloatingChromeSlot>
      ) : null}

      <FloatingChromeSlot placement="leftBottom" pinned={secondaryActionsOpen}>
        <SecondaryActionsMenu
          open={secondaryActionsOpen}
          direction={direction}
          edgeRouting={edgeRouting}
          layoutMode={layoutMode}
          preferences={preferences}
          editable={isCanvasEditable}
          documentKind={documentKind}
          onOpenChange={onSecondaryActionsOpenChange}
          onAddNode={onAddNode}
          onAddTableNode={onAddTableNode}
          onAddImageNode={() => void onAddImageNode()}
          onAddMarkdownDocument={onAddMarkdownDocument}
          onAddHtmlDocument={onAddHtmlDocument}
          onCreateGroup={onCreateGroup}
          onSaveAs={() => void onSaveAs()}
          onDirectionChange={onDirectionChange}
          onEdgeRoutingChange={onEdgeRoutingChange}
          onLayoutModeChange={onLayoutModeChange}
          onPreferencesChange={onPreferencesChange}
          onRefreshSource={onRefreshSource}
          onSyncAutoLayout={onSyncAutoLayout}
          onResetView={onResetView}
          onOpenThemeSettings={onOpenThemeSettings}
        />
      </FloatingChromeSlot>

      {!agentOpen || !terminalOpen ? (
        <FloatingChromeSlot placement="bottomCenter">
          <div className="flex items-center gap-1">
            {!agentOpen ? <FloatingIconButton
              label="打开 Pi Agent"
              tooltipSide="top"
              onClick={() => onOpenWorkspacePanel("agent")}
            >
              <ChatBubble />
            </FloatingIconButton> : null}
            {!terminalOpen ? <FloatingIconButton
              label="打开终端"
              tooltipSide="top"
              onClick={() => onOpenWorkspacePanel("terminal")}
            >
              <Terminal />
            </FloatingIconButton> : null}
          </div>
        </FloatingChromeSlot>
      ) : null}

      {isCanvasEditable && workspaceView === "canvas" ? (
        <FloatingChromeSlot placement="rightBottom">
          <ToolModeCluster mode={mode} onChange={onToolModeChange} />
        </FloatingChromeSlot>
      ) : null}
    </FloatingChromeLayer>
  );
}
