import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  CodeBrackets,
  Database,
  EmptyPage,
  Folder,
  MediaImage,
  Refresh as RefreshCw,
  Text,
  Xmark
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import {
  EditorEmptyState,
  EditorIconButton,
  EditorMenuItem,
  EditorMenuSurface,
  EditorPanelHeader,
  EditorTree,
  EditorTreeDisclosure,
  EditorTreeGroup,
  EditorTreeItem,
  EditorTreeRow
} from "@/features/mermaid-editor/components/editor-ui";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import { projectDirectoryAncestors, validExpandedDirectoryPaths } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  buildProjectResourceTree,
  isProjectFileActive,
  projectResourcesFromFiles,
  projectTreeDirectoryIds,
  type ProjectFileEntry,
  type ProjectResourceEntry,
  type ProjectTreeNode,
  type ProjectWorkspace
} from "@/features/mermaid-editor/lib/project-workspace";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { cn } from "@/lib/utils";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayRegistration } from "@/lib/use-overlay-registration";

const EMPTY_EXPANDED_DIRECTORY_PATHS: string[] = [];

export function ExplorerPanel({
  runtimeKind,
  projectWorkspace,
  projectFiles,
  currentFileRef,
  projectBusy,
  treeState,
  onTreeStateChange,
  onOpenProject,
  onRefreshProject,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onMarkdownDocumentPointerDrag,
  onStatus,
  windowState,
  onWindowStateChange,
  onCollapse
}: {
  runtimeKind: "web" | "desktop";
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  currentFileRef: RuntimeFileRef | null;
  projectBusy: boolean;
  treeState: ExplorerWorkspaceTreeState | null;
  onTreeStateChange: (state: Omit<ExplorerWorkspaceTreeState, "rootPath" | "updatedAt">) => void;
  onOpenProject: () => void;
  onRefreshProject: () => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onMarkdownDocumentPointerDrag: (file: ProjectFileEntry, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  onStatus: (message: string) => void;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onCollapse: () => void;
}) {
  const resources = useMemo(
    () => projectWorkspace?.resources ?? projectResourcesFromFiles(projectFiles),
    [projectFiles, projectWorkspace?.resources]
  );
  const tree = useMemo(() => buildProjectResourceTree(resources, projectFiles), [projectFiles, resources]);
  const directoryPaths = useMemo(
    () => new Set(projectTreeDirectoryIds(tree).map((id) => id.slice("dir:".length))),
    [tree]
  );
  const rootExpanded = treeState?.rootExpanded ?? true;
  const expandedDirectoryPaths = treeState?.expandedDirectoryPaths ?? EMPTY_EXPANDED_DIRECTORY_PATHS;
  const expandedDirectoryPathKey = expandedDirectoryPaths.join("\n");
  const expandedDirectorySet = useMemo(() => new Set(expandedDirectoryPaths), [expandedDirectoryPaths]);
  const [fileContextMenu, setFileContextMenu] = useState<{ file: ProjectFileEntry; x: number; y: number } | null>(null);
  const activeFile = useMemo(
    () => projectFiles.find((file) => isProjectFileActive(file, currentFileRef)),
    [currentFileRef, projectFiles]
  );
  const rootItemId = projectWorkspace ? `root:${projectWorkspace.rootPath}` : "root:none";
  const [focusedItemId, setFocusedItemId] = useState(rootItemId);
  const treeRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const lastAutoRevealRef = useRef("");
  const projectAvailable = runtimeKind === "desktop";

  useEffect(() => {
    setFocusedItemId(activeFile ? `file:${activeFile.path}` : rootItemId);
  }, [activeFile, rootItemId]);

  useEffect(() => {
    if (!projectWorkspace || !treeState) return;
    const valid = validExpandedDirectoryPaths(expandedDirectoryPaths, directoryPaths);
    if (!samePaths(valid, expandedDirectoryPaths)) {
      onTreeStateChange({ rootExpanded, expandedDirectoryPaths: valid });
    }
  }, [directoryPaths, expandedDirectoryPaths, onTreeStateChange, projectWorkspace, rootExpanded, treeState]);

  useEffect(() => {
    if (!projectWorkspace || !activeFile || !treeState) return;
    const revealKey = `${projectWorkspace.rootPath}\n${activeFile.path}`;
    if (lastAutoRevealRef.current === revealKey) return;
    lastAutoRevealRef.current = revealKey;
    const nextPaths = [...new Set([...expandedDirectoryPaths, ...projectDirectoryAncestors(activeFile.relativePath)])];
    if (!rootExpanded || !samePaths(nextPaths, expandedDirectoryPaths)) {
      onTreeStateChange({ rootExpanded: true, expandedDirectoryPaths: nextPaths });
    }
  }, [activeFile, expandedDirectoryPaths, onTreeStateChange, projectWorkspace, rootExpanded, treeState]);

  useEffect(() => {
    if (!activeFile) return;
    const frame = window.requestAnimationFrame(() => activeRowRef.current?.scrollIntoView({ block: "nearest" }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeFile, expandedDirectoryPathKey, rootExpanded]);

  function updateExpansion(nextRootExpanded: boolean, nextPaths: string[]) {
    onTreeStateChange({ rootExpanded: nextRootExpanded, expandedDirectoryPaths: nextPaths });
  }

  function toggleDirectory(relativePath: string) {
    const next = new Set(expandedDirectoryPaths);
    if (next.has(relativePath)) next.delete(relativePath);
    else next.add(relativePath);
    updateExpansion(rootExpanded, [...next]);
  }

  function openFileContextMenu(file: ProjectFileEntry, event: ReactMouseEvent) {
    event.preventDefault();
    setFileContextMenu({ file, x: event.clientX, y: event.clientY });
  }

  function handleTreeKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    item: { id: string; kind: "root" | "directory" | "file"; expanded?: boolean; relativePath?: string; parentPath?: string }
  ) {
    const items = visibleTreeItems(treeRef.current);
    const index = items.findIndex((candidate) => candidate.dataset.treeItemId === item.id);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusTreeItem(items[Math.min(items.length - 1, index + 1)], setFocusedItemId);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusTreeItem(items[Math.max(0, index - 1)], setFocusedItemId);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTreeItem(items[0], setFocusedItemId);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTreeItem(items.at(-1), setFocusedItemId);
    } else if (event.key === "ArrowRight" && item.kind !== "file") {
      event.preventDefault();
      if (!item.expanded) {
        if (item.kind === "root") updateExpansion(true, expandedDirectoryPaths);
        else if (item.relativePath) toggleDirectory(item.relativePath);
      } else {
        focusTreeItem(items[index + 1], setFocusedItemId);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (item.kind === "root" && item.expanded) {
        updateExpansion(false, expandedDirectoryPaths);
      } else if (item.kind === "directory" && item.expanded && item.relativePath) {
        toggleDirectory(item.relativePath);
      } else {
        const parentId = item.parentPath ? `dir:${item.parentPath}` : rootItemId;
        focusTreeItem(items.find((candidate) => candidate.dataset.treeItemId === parentId), setFocusedItemId);
      }
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card/[var(--ui-surface-opacity)]">
      <EditorPanelHeader
        title="资源管理器"
        className="cursor-grab active:cursor-grabbing"
        actions={<WorkspacePanelControls
          leadingActions={
            <>
              <EditorIconButton context="panel" label="打开文件夹" tooltipSide="right" disabled={!projectAvailable || projectBusy} onClick={onOpenProject}>
                <Folder />
              </EditorIconButton>
              {projectWorkspace ? (
                <EditorIconButton context="panel" label="刷新文件夹" tooltipSide="right" disabled={projectBusy} onClick={onRefreshProject}>
                  <RefreshCw className={cn(projectBusy && "animate-spin")} />
                </EditorIconButton>
              ) : null}
            </>
          }
          windowState={windowState}
          onWindowStateChange={onWindowStateChange}
          onClose={onCollapse}
          closeLabel="关闭资源管理器"
          closeTooltipSide="right"
          closeIcon={<Xmark />}
        />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1.5">
        {!projectWorkspace ? (
          <WorkspaceFolderEmptyState projectAvailable={projectAvailable} projectBusy={projectBusy} onOpenProject={onOpenProject} />
        ) : (
          <EditorTree ref={treeRef} aria-label={`${projectWorkspace.rootName} 资源树`}>
            <EditorTreeItem root>
              <EditorTreeRow
                data-tree-item-id={rootItemId}
                aria-level={1}
                aria-expanded={rootExpanded}
                tabIndex={focusedItemId === rootItemId ? 0 : -1}
                title={projectWorkspace.rootPath}
                onFocus={() => setFocusedItemId(rootItemId)}
                onKeyDown={(event) => handleTreeKeyDown(event, { id: rootItemId, kind: "root", expanded: rootExpanded })}
                onClick={() => updateExpansion(!rootExpanded, expandedDirectoryPaths)}
              >
                <EditorTreeDisclosure expanded={rootExpanded} />
                <Folder className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{projectWorkspace.rootName}</span>
              </EditorTreeRow>
              {rootExpanded ? (
                <EditorTreeGroup>
                  {tree.length ? tree.map((node) => (
                    <ProjectTreeNodeRow
                      key={node.id}
                      node={node}
                      level={2}
                      parentPath=""
                      expandedDirectoryPaths={expandedDirectorySet}
                      focusedItemId={focusedItemId}
                      currentFileRef={currentFileRef}
                      activeRowRef={activeRowRef}
                      onFocusItem={setFocusedItemId}
                      onTreeKeyDown={handleTreeKeyDown}
                      onToggleDirectory={toggleDirectory}
                      onOpenProjectFile={onOpenProjectFile}
                      onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                      onMarkdownDocumentPointerDrag={onMarkdownDocumentPointerDrag}
                      onOpenFileContextMenu={openFileContextMenu}
                      onUnsupportedResource={(resource) => onStatus(`暂不支持打开 ${resource.name}。`)}
                    />
                  )) : <EditorEmptyState className="border-0" title="此文件夹为空" />}
                </EditorTreeGroup>
              ) : null}
            </EditorTreeItem>
            {projectWorkspace.resourcesTruncated ? (
              <div role="status" className="px-3 py-2 text-xs text-muted-foreground">资源较多，仅显示前 10,000 项。</div>
            ) : null}
          </EditorTree>
        )}
        <ProjectFileContextMenu
          menu={fileContextMenu}
          onOpenChange={(open) => { if (!open) setFileContextMenu(null); }}
          onOpenProjectFile={(file) => { setFileContextMenu(null); onOpenProjectFile(file); }}
          onOpenProjectMarkdownWindow={(file) => { setFileContextMenu(null); onOpenProjectMarkdownWindow(file); }}
        />
      </div>
    </aside>
  );
}

function WorkspaceFolderEmptyState({ projectAvailable, projectBusy, onOpenProject }: {
  projectAvailable: boolean;
  projectBusy: boolean;
  onOpenProject: () => void;
}) {
  return (
    <div className="grid px-2 py-3" title={projectAvailable ? undefined : "仅桌面版支持文件夹浏览"}>
      <Button
        variant="outline"
        className={cn(EDITOR_CHROME_CLASSES.menuRow, "text-xs")}
        aria-label={projectAvailable ? undefined : "打开文件夹（仅桌面版支持）"}
        disabled={!projectAvailable || projectBusy}
        onClick={onOpenProject}
      >
        <Folder className="size-4" />
        打开文件夹
      </Button>
    </div>
  );
}

function ProjectTreeNodeRow({
  node,
  level,
  parentPath,
  expandedDirectoryPaths,
  focusedItemId,
  currentFileRef,
  activeRowRef,
  onFocusItem,
  onTreeKeyDown,
  onToggleDirectory,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onMarkdownDocumentPointerDrag,
  onOpenFileContextMenu,
  onUnsupportedResource
}: {
  node: ProjectTreeNode;
  level: number;
  parentPath: string;
  expandedDirectoryPaths: Set<string>;
  focusedItemId: string;
  currentFileRef: RuntimeFileRef | null;
  activeRowRef: { current: HTMLButtonElement | null };
  onFocusItem: (id: string) => void;
  onTreeKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, item: { id: string; kind: "root" | "directory" | "file"; expanded?: boolean; relativePath?: string; parentPath?: string }) => void;
  onToggleDirectory: (relativePath: string) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onMarkdownDocumentPointerDrag: (file: ProjectFileEntry, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  onOpenFileContextMenu: (file: ProjectFileEntry, event: ReactMouseEvent) => void;
  onUnsupportedResource: (resource: ProjectResourceEntry) => void;
}) {
  if (node.kind === "directory") {
    const expanded = expandedDirectoryPaths.has(node.relativePath);
    return (
      <EditorTreeItem>
        <EditorTreeRow
          data-tree-item-id={node.id}
          aria-level={level}
          aria-expanded={expanded}
          tabIndex={focusedItemId === node.id ? 0 : -1}
          title={node.path}
          onFocus={() => onFocusItem(node.id)}
          onKeyDown={(event) => onTreeKeyDown(event, { id: node.id, kind: "directory", expanded, relativePath: node.relativePath, parentPath })}
          onClick={() => onToggleDirectory(node.relativePath)}
        >
          <EditorTreeDisclosure expanded={expanded} />
          <Folder className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
        </EditorTreeRow>
        {expanded ? (
          <EditorTreeGroup>
            {node.children.map((child) => (
              <ProjectTreeNodeRow
                key={child.id}
                node={child}
                level={level + 1}
                parentPath={node.relativePath}
                expandedDirectoryPaths={expandedDirectoryPaths}
                focusedItemId={focusedItemId}
                currentFileRef={currentFileRef}
                activeRowRef={activeRowRef}
                onFocusItem={onFocusItem}
                onTreeKeyDown={onTreeKeyDown}
                onToggleDirectory={onToggleDirectory}
                onOpenProjectFile={onOpenProjectFile}
                onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                onMarkdownDocumentPointerDrag={onMarkdownDocumentPointerDrag}
                onOpenFileContextMenu={onOpenFileContextMenu}
                onUnsupportedResource={onUnsupportedResource}
              />
            ))}
          </EditorTreeGroup>
        ) : null}
      </EditorTreeItem>
    );
  }

  return (
    <ProjectFileRow
      node={node}
      level={level}
      parentPath={parentPath}
      focused={focusedItemId === node.id}
      currentFileRef={currentFileRef}
      activeRowRef={activeRowRef}
      onFocusItem={onFocusItem}
      onTreeKeyDown={onTreeKeyDown}
      onOpenProjectFile={onOpenProjectFile}
      onMarkdownDocumentPointerDrag={onMarkdownDocumentPointerDrag}
      onOpenFileContextMenu={onOpenFileContextMenu}
      onUnsupportedResource={onUnsupportedResource}
    />
  );
}

function ProjectFileRow({
  node,
  level,
  parentPath,
  focused,
  currentFileRef,
  activeRowRef,
  onFocusItem,
  onTreeKeyDown,
  onOpenProjectFile,
  onMarkdownDocumentPointerDrag,
  onOpenFileContextMenu,
  onUnsupportedResource
}: {
  node: Extract<ProjectTreeNode, { kind: "file" }>;
  level: number;
  parentPath: string;
  focused: boolean;
  currentFileRef: RuntimeFileRef | null;
  activeRowRef: { current: HTMLButtonElement | null };
  onFocusItem: (id: string) => void;
  onTreeKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, item: { id: string; kind: "root" | "directory" | "file"; parentPath?: string }) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onMarkdownDocumentPointerDrag: (file: ProjectFileEntry, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  onOpenFileContextMenu: (file: ProjectFileEntry, event: ReactMouseEvent) => void;
  onUnsupportedResource: (resource: ProjectResourceEntry) => void;
}) {
  const file = node.file ?? (node.resource.documentKind ? resourceProjectFile(node.resource) : undefined);
  const active = file ? isProjectFileActive(file, currentFileRef) : false;
  const markdownFile = node.resource.documentKind === "markdown";
  const pointerDragRef = useRef<{ pointerId: number; startX: number; startY: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  function startMarkdownDocumentPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!markdownFile || !file || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
  }

  function moveMarkdownDocumentPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !file) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    drag.dragging = true;
    event.preventDefault();
    onMarkdownDocumentPointerDrag(file, { x: event.clientX, y: event.clientY }, "move");
  }

  function finishMarkdownDocumentPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !file) return;
    pointerDragRef.current = null;
    if (!drag.dragging) return;
    event.preventDefault();
    suppressClickRef.current = true;
    onMarkdownDocumentPointerDrag(file, { x: event.clientX, y: event.clientY }, "drop");
  }

  function cancelMarkdownDocumentPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !file) return;
    pointerDragRef.current = null;
    if (drag.dragging) onMarkdownDocumentPointerDrag(file, { x: event.clientX, y: event.clientY }, "cancel");
  }

  return (
    <EditorTreeItem>
      <EditorTreeRow
        ref={(element) => { if (active) activeRowRef.current = element; }}
        active={active}
        data-tree-item-id={node.id}
        data-resource-supported={Boolean(file)}
        aria-level={level}
        aria-selected={active}
        tabIndex={focused ? 0 : -1}
        className={cn(markdownFile && "cursor-grab active:cursor-grabbing", !file && "text-muted-foreground")}
        title={file ? node.resource.path : `${node.resource.path}\n当前文件类型暂不支持打开`}
        onFocus={() => onFocusItem(node.id)}
        onKeyDown={(event) => onTreeKeyDown(event, { id: node.id, kind: "file", parentPath })}
        onPointerDown={startMarkdownDocumentPointerDrag}
        onPointerMove={moveMarkdownDocumentPointerDrag}
        onPointerUp={finishMarkdownDocumentPointerDrag}
        onPointerCancel={cancelMarkdownDocumentPointerDrag}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            return;
          }
          if (file) onOpenProjectFile(file);
          else onUnsupportedResource(node.resource);
        }}
        onContextMenu={file ? (event) => onOpenFileContextMenu(file, event) : undefined}
      >
        <EditorTreeDisclosure />
        <ProjectResourceIcon resource={node.resource} />
        <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
      </EditorTreeRow>
    </EditorTreeItem>
  );
}

function ProjectResourceIcon({ resource }: { resource: ProjectResourceEntry }) {
  const className = "size-4 shrink-0";
  if (resource.documentKind === "mermaid") return <CodeBrackets className={className} />;
  if (resource.documentKind === "markdown") return <Text className={className} />;
  if (resource.documentKind === "canvas") return <Database className={className} />;
  const extension = resource.name.toLocaleLowerCase().split(".").at(-1) || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico"].includes(extension)) return <MediaImage className={className} />;
  if (["zip", "tar", "gz", "7z", "rar"].includes(extension)) return <Archive className={className} />;
  return <EmptyPage className={className} />;
}

function ProjectFileContextMenu({ menu, onOpenChange, onOpenProjectFile, onOpenProjectMarkdownWindow }: {
  menu: { file: ProjectFileEntry; x: number; y: number } | null;
  onOpenChange: (open: boolean) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open: Boolean(menu), onOpenChange });
  const menuOpen = Boolean(menu);
  const overlayToken = menu ? `project-file-context-menu:${menu.file.path}` : "project-file-context-menu";
  useOverlayRegistration(overlayToken, menuOpen);
  if (!menu) return null;

  const markdownFile = menu.file.path.toLocaleLowerCase().endsWith(".md") || menu.file.path.toLocaleLowerCase().endsWith(".markdown");
  const menuWidth = 224;
  const menuHeight = markdownFile ? 82 : 46;
  const left = typeof window === "undefined" ? menu.x : Math.max(12, Math.min(menu.x, window.innerWidth - menuWidth - 12));
  const top = typeof window === "undefined" ? menu.y : Math.max(12, Math.min(menu.y, window.innerHeight - menuHeight - 12));
  const menuElement = (
    <EditorMenuSurface
      ref={menuRef}
      className="editor-ui-popover fixed w-56 p-2 text-popover-foreground"
      style={{ left, top, zIndex: OVERLAY_Z_INDEX.contextMenu }}
      aria-label={`${menu.file.name} 操作`}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    >
      <EditorMenuItem data-floating-action-item icon={<EmptyPage />} label="当前窗口打开" title={menu.file.path} onClick={() => onOpenProjectFile(menu.file)} />
      {markdownFile ? <EditorMenuItem data-floating-action-item icon={<Text />} label="新窗口打开" title={menu.file.path} onClick={() => onOpenProjectMarkdownWindow(menu.file)} /> : null}
    </EditorMenuSurface>
  );
  if (typeof document === "undefined") return menuElement;
  return createPortal(menuElement, document.body);
}

function visibleTreeItems(root: HTMLDivElement | null) {
  return root ? [...root.querySelectorAll<HTMLButtonElement>('[role="treeitem"]')] : [];
}

function focusTreeItem(item: HTMLButtonElement | undefined, onFocusItem: (id: string) => void) {
  if (!item) return;
  const id = item.dataset.treeItemId;
  if (id) onFocusItem(id);
  item.focus();
}

function resourceProjectFile(resource: ProjectResourceEntry): ProjectFileEntry {
  return {
    name: resource.name,
    path: resource.path,
    relativePath: resource.relativePath,
    ...(resource.modifiedAt ? { modifiedAt: resource.modifiedAt } : {})
  };
}

function samePaths(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((path) => rightSet.has(path));
}
