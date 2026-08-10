import type { PointerEventHandler } from "react";
import type { AgentWorkspaceActivity } from "@/features/mermaid-editor/components/agent/agent-workspace-types";
import {
  DotsGrid3x3 as Grid3X3,
  SidebarExpand as PanelLeftOpen,
  SidebarExpand as PanelRightOpen,
  ChatBubble,
  Terminal
} from "iconoir-react/regular";

import { FileMenu, SecondaryActionsMenu, ViewFilterMenu } from "@/features/mermaid-editor/components/editor-menus";
import { FloatingButtonCluster, FloatingChromeLayer, FloatingChromeSlot, FloatingIconButton } from "@/features/mermaid-editor/components/floating-chrome";
import { DesktopWindowControls, WorkspaceViewCluster } from "@/features/mermaid-editor/components/workspace-view-controls";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditableKind, EdgeRouting, GraphDirection, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";
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
  agentActivity: AgentWorkspaceActivity;
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
  onFileMenuOpenChange: (open: boolean) => void;
  onViewFiltersOpenChange: (open: boolean) => void;
  onSecondaryActionsOpenChange: (open: boolean) => void;
  onNewMermaidFile: () => void | Promise<unknown>;
  onNewMarkdownFile: () => void | Promise<unknown>;
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
  agentActivity,
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
  onFileMenuOpenChange,
  onViewFiltersOpenChange,
  onSecondaryActionsOpenChange,
  onNewMermaidFile,
  onNewMarkdownFile,
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
  onOpenThemeSettings
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
          onOpenFile={() => void onOpenFile()}
          onOpenRecent={(file) => void onOpenRecent(file)}
          onOpenProject={() => void onOpenProject()}
          onSaveFile={() => void onSaveFile()}
          onSaveAs={() => void onSaveAs()}
        />
      </FloatingChromeSlot>

      {isDesktopChrome ? (
        <FloatingChromeSlot placement="topCenter" hotZoneClassName="[-webkit-app-region:drag]">
          <FloatingIconButton
            type="button"
            label="拖拽移动窗口，双击最大化"
            tooltipSide="bottom"
            onPointerDown={onStartDesktopWindowDrag}
            onDoubleClick={() => void onToggleDesktopWindowMaximize()}
          >
            <Grid3X3 data-icon />
          </FloatingIconButton>
        </FloatingChromeSlot>
      ) : null}

      {isDesktopChrome ? (
        <FloatingChromeSlot placement="topRight">
          <DesktopWindowControls runtime={runtime} />
        </FloatingChromeSlot>
      ) : null}

      <FloatingChromeSlot placement="rightView">
        <WorkspaceViewCluster
          workspaceView={workspaceView}
          editableKind={editableKind}
          documentKind={documentKind}
          canvasViewTooltip={canvasViewTooltip}
          onChange={onWorkspaceViewChange}
        />
      </FloatingChromeSlot>

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
            <PanelLeftOpen data-icon />
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
            <PanelRightOpen data-icon />
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
        <FloatingChromeSlot placement="rightBottom">
          <FloatingButtonCluster>
            {!agentOpen ? <FloatingIconButton
              label={agentActivity.waiting ? `打开 Pi Agent，${agentActivity.waiting} 个会话等待确认` : agentActivity.errors ? `打开 Pi Agent，${agentActivity.errors} 个会话执行失败` : agentActivity.running ? `打开 Pi Agent，${agentActivity.running} 个会话正在执行` : "打开 Pi Agent"}
              tooltipSide="top"
              badgeCount={agentActivity.waiting || agentActivity.errors || agentActivity.running || agentActivity.unread || undefined}
              danger={Boolean(agentActivity.waiting || agentActivity.errors)}
              onClick={() => onOpenWorkspacePanel("agent")}
            >
              <ChatBubble data-icon />
            </FloatingIconButton> : null}
            {!terminalOpen ? <FloatingIconButton
              label="打开终端"
              tooltipSide="top"
              onClick={() => onOpenWorkspacePanel("terminal")}
            >
              <Terminal data-icon />
            </FloatingIconButton> : null}
          </FloatingButtonCluster>
        </FloatingChromeSlot>
      ) : null}
    </FloatingChromeLayer>
  );
}
