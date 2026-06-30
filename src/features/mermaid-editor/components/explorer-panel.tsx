import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EmptyPage, Folder, NavArrowDown, NavArrowRight, Refresh as RefreshCw, Text, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import { buildProjectFileTree, isProjectFileActive, type ProjectFileEntry, type ProjectTreeNode, type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { cn } from "@/lib/utils";
import { OVERLAY_Z_INDEX, setGlobalOverlayActivity } from "@/lib/overlay-layers";

export function ExplorerPanel({
  runtimeKind,
  projectWorkspace,
  projectFiles,
  currentFileRef,
  projectBusy,
  onOpenProject,
  onRefreshProject,
  onCloseProject,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  windowState,
  onWindowStateChange,
  onCollapse
}: {
  runtimeKind: "web" | "desktop";
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  currentFileRef: RuntimeFileRef | null;
  projectBusy: boolean;
  onOpenProject: () => void;
  onRefreshProject: () => void;
  onCloseProject: () => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onCollapse: () => void;
}) {
  const tree = useMemo(() => buildProjectFileTree(projectFiles), [projectFiles]);
  const [fileContextMenu, setFileContextMenu] = useState<{ file: ProjectFileEntry; x: number; y: number } | null>(null);
  const topLevelDirectoryKey = useMemo(
    () => tree.filter((node): node is Extract<ProjectTreeNode, { kind: "directory" }> => node.kind === "directory").map((node) => node.id).join("\n"),
    [tree]
  );
  const [expandedDirectoryIds, setExpandedDirectoryIds] = useState<Set<string>>(() => new Set());
  const projectAvailable = runtimeKind === "desktop";

  useEffect(() => {
    setExpandedDirectoryIds(new Set(topLevelDirectoryKey ? topLevelDirectoryKey.split("\n") : []));
  }, [projectWorkspace?.rootPath, topLevelDirectoryKey]);

  function toggleDirectory(id: string) {
    setExpandedDirectoryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openFileContextMenu(file: ProjectFileEntry, event: ReactMouseEvent) {
    event.preventDefault();
    setFileContextMenu({ file, x: event.clientX, y: event.clientY });
  }

  return (
    <aside className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)] bg-card/95">
      <header data-floating-panel-drag-handle className="flex min-w-0 cursor-grab items-center justify-between gap-2 border-b bg-card/95 px-3 active:cursor-grabbing">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">资源管理器</div>
        </div>
        <WorkspacePanelControls
          windowState={windowState}
          onWindowStateChange={onWindowStateChange}
          onClose={onCollapse}
          closeLabel="关闭资源管理器"
          closeTooltipSide="right"
          closeIcon={<Xmark />}
        />
      </header>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <ExplorerSectionTitle>文件夹</ExplorerSectionTitle>
            <div className="truncate text-xs text-muted-foreground" title={projectWorkspace?.rootPath}>
              {projectWorkspace
                ? `${projectWorkspace.rootName} · ${projectWorkspace.files.length}${projectWorkspace.truncated ? "+" : ""} 个项目文档`
                : projectAvailable
                  ? "打开文件后会自动显示同目录文档"
                  : "桌面版支持文件夹浏览"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} disabled={!projectAvailable || projectBusy} onClick={onOpenProject} aria-label="打开工作区文件夹">
                  <Folder className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">打开文件夹</TooltipContent>
            </Tooltip>
            {projectWorkspace ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} disabled={projectBusy} onClick={onRefreshProject} aria-label="刷新工作区文件">
                      <RefreshCw className={cn("size-4", projectBusy && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">刷新文件夹</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} disabled={projectBusy} onClick={onCloseProject} aria-label="关闭工作区文件夹">
                      <Xmark className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">关闭文件夹</TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-1 py-2">
          {!projectWorkspace ? (
            <WorkspaceFolderEmptyState projectAvailable={projectAvailable} projectBusy={projectBusy} onOpenProject={onOpenProject} />
          ) : tree.length ? (
            <div className="grid gap-0.5">
              {tree.map((node) => (
                <ProjectTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedDirectoryIds}
                  currentFileRef={currentFileRef}
                  onToggleDirectory={toggleDirectory}
                  onOpenProjectFile={onOpenProjectFile}
                  onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                  onOpenFileContextMenu={openFileContextMenu}
                />
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">此文件夹下没有项目文档</div>
          )}
        </div>
        <ProjectFileContextMenu
          menu={fileContextMenu}
          onOpenChange={(open) => {
            if (!open) setFileContextMenu(null);
          }}
          onOpenProjectFile={(file) => {
            setFileContextMenu(null);
            onOpenProjectFile(file);
          }}
          onOpenProjectMarkdownWindow={(file) => {
            setFileContextMenu(null);
            onOpenProjectMarkdownWindow(file);
          }}
        />
      </div>
    </aside>
  );
}

function ExplorerSectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{children}</div>;
}

function WorkspaceFolderEmptyState({
  projectAvailable,
  projectBusy,
  onOpenProject
}: {
  projectAvailable: boolean;
  projectBusy: boolean;
  onOpenProject: () => void;
}) {
  return (
    <div className="grid gap-2 px-2 py-3">
      <div className="text-xs text-muted-foreground">{projectAvailable ? "打开文件后会自动显示同目录文档" : "桌面版支持文件夹浏览"}</div>
      <Button variant="outline" className={cn(EDITOR_CHROME_CLASSES.menuRow, "text-xs")} disabled={!projectAvailable || projectBusy} onClick={onOpenProject}>
        <Folder className="size-4" />
        选择文件夹
      </Button>
    </div>
  );
}

function ProjectTreeRow({
  node,
  depth,
  expandedIds,
  currentFileRef,
  onToggleDirectory,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onOpenFileContextMenu
}: {
  node: ProjectTreeNode;
  depth: number;
  expandedIds: Set<string>;
  currentFileRef: RuntimeFileRef | null;
  onToggleDirectory: (id: string) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenFileContextMenu: (file: ProjectFileEntry, event: ReactMouseEvent) => void;
}) {
  const paddingLeft = 8 + depth * 16;

  if (node.kind === "directory") {
    const expanded = expandedIds.has(node.id);
    return (
      <div className="grid gap-0.5">
        <Button
          type="button"
          variant="ghost"
          className={cn(EDITOR_CHROME_CLASSES.treeRow, "gap-1")}
          style={{ paddingLeft }}
          aria-expanded={expanded}
          onClick={() => onToggleDirectory(node.id)}
          title={node.relativePath}
        >
          {expanded ? <NavArrowDown className="size-4 shrink-0" /> : <NavArrowRight className="size-4 shrink-0" />}
          <Folder className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
          <span className="text-xs text-muted-foreground">{node.fileCount}</span>
        </Button>
        {expanded
          ? node.children.map((child) => (
              <ProjectTreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                currentFileRef={currentFileRef}
                onToggleDirectory={onToggleDirectory}
                onOpenProjectFile={onOpenProjectFile}
                onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                onOpenFileContextMenu={onOpenFileContextMenu}
              />
            ))
          : null}
      </div>
    );
  }

  const active = isProjectFileActive(node.file, currentFileRef);
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      className={cn(EDITOR_CHROME_CLASSES.treeRow, "gap-2")}
      style={{ paddingLeft }}
      title={node.file.path}
      onClick={() => onOpenProjectFile(node.file)}
      onContextMenu={(event) => onOpenFileContextMenu(node.file, event)}
    >
      <EmptyPage className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
    </Button>
  );
}

function ProjectFileContextMenu({
  menu,
  onOpenChange,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow
}: {
  menu: { file: ProjectFileEntry; x: number; y: number } | null;
  onOpenChange: (open: boolean) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open: Boolean(menu), onOpenChange });
  const menuOpen = Boolean(menu);
  const overlayToken = menu ? `project-file-context-menu:${menu.file.path}` : "project-file-context-menu";

  useEffect(() => {
    setGlobalOverlayActivity(overlayToken, menuOpen);
    return () => setGlobalOverlayActivity(overlayToken, false);
  }, [menuOpen, overlayToken]);

  if (!menu) return null;

  const markdownFile = isSupportedMarkdownFilePath(menu.file.path);
  const menuWidth = 224;
  const menuHeight = markdownFile ? 122 : 82;
  const left = typeof window === "undefined" ? menu.x : Math.max(12, Math.min(menu.x, window.innerWidth - menuWidth - 12));
  const top = typeof window === "undefined" ? menu.y : Math.max(12, Math.min(menu.y, window.innerHeight - menuHeight - 12));

  const menuElement = (
    <div
      ref={menuRef}
      className="fixed w-56 rounded-lg border bg-popover/95 p-2 text-popover-foreground shadow-lg backdrop-blur"
      style={{ left, top, zIndex: OVERLAY_Z_INDEX.contextMenu }}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    >
      <div className="mb-1 max-w-full min-w-0 truncate px-2 py-1 text-xs text-muted-foreground" title={menu.file.path}>
        {menu.file.name}
      </div>
      <Button data-floating-action-item variant="ghost" className={cn(EDITOR_CHROME_CLASSES.menuRow, "w-full min-w-0 gap-2 overflow-hidden text-left")} onClick={() => onOpenProjectFile(menu.file)}>
        <EmptyPage className="size-4 shrink-0" />
        <span className="block min-w-0 flex-1 truncate">打开为当前文档</span>
      </Button>
      {markdownFile ? (
        <Button
          data-floating-action-item
          variant="ghost"
          className={cn(EDITOR_CHROME_CLASSES.menuRow, "w-full min-w-0 gap-2 overflow-hidden text-left")}
          onClick={() => onOpenProjectMarkdownWindow(menu.file)}
        >
          <Text className="size-4 shrink-0" />
          <span className="block min-w-0 flex-1 truncate">以窗口形式打开</span>
        </Button>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return menuElement;
  return createPortal(menuElement, document.body);
}

