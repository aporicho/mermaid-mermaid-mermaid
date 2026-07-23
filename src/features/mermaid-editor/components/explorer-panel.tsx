import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";
import {
  Archive,
  CodeBrackets,
  Database,
  EmptyPage,
  Folder,
  OpenNewWindow,
  Page,
  PagePlus,
  PathArrow,
  Plus,
  MediaImage,
  Refresh as RefreshCw,
  Text
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  EditorDialog,
  EditorEmptyState,
  EditorField,
  EditorIconButton,
  EditorList,
  EditorListRow,
  EditorPointMenu,
  EditorSegmentedControl,
  EditorSegmentedControlItem,
  EditorTree,
  EditorTreeGroup,
  EditorTreeItem,
  EditorTreeRow
} from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import { projectDirectoryAncestors, validExpandedDirectoryPaths } from "@/features/mermaid-editor/lib/explorer-tree-state";
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
import { cn } from "@/lib/utils";

const EMPTY_EXPANDED_DIRECTORY_PATHS: string[] = [];

type ExplorerFilePointerDrag = {
  pointerId: number;
  resource: ProjectResourceEntry;
  file?: ProjectFileEntry;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
  markdownCanvasActive: boolean;
};

type ExplorerDirectoryDropTarget = {
  directoryPath: string;
};

type ExplorerContextMenu = {
  x: number;
  y: number;
} & (
  | { kind: "file"; resource: ProjectResourceEntry; file?: ProjectFileEntry }
  | { kind: "directory"; directoryPath: string }
);

export type ExplorerProjectFileKind = "markdown" | "mermaid" | "canvas" | "csv";

export type ExplorerCreateProjectFileRequest = {
  directoryPath: string;
  fileName: string;
  kind: ExplorerProjectFileKind;
};

const EXPLORER_FILE_KINDS = [
  { kind: "markdown", label: "Markdown", defaultFileName: "document.md", extension: ".md" },
  { kind: "mermaid", label: "Mermaid", defaultFileName: "diagram.mmd", extension: ".mmd" },
  { kind: "canvas", label: "画布", defaultFileName: "board.canvas.json", extension: ".canvas.json" },
  { kind: "csv", label: "CSV", defaultFileName: "table.csv", extension: ".csv" }
] as const satisfies readonly { kind: ExplorerProjectFileKind; label: string; defaultFileName: string; extension: string }[];

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
  onCreateProjectFile,
  onMoveProjectFile,
  onMarkdownDocumentPointerDrag,
  onStatus
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
  onCreateProjectFile: (request: ExplorerCreateProjectFileRequest) => void;
  onMoveProjectFile: (file: ProjectResourceEntry, targetDirectoryPath: string) => void;
  onMarkdownDocumentPointerDrag: (file: ProjectFileEntry, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  onStatus: (message: string) => void;
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
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenu | null>(null);
  const [createFileDialog, setCreateFileDialog] = useState<{ directoryPath: string } | null>(null);
  const [moveFileDialog, setMoveFileDialog] = useState<{ resource: ProjectResourceEntry; targetDirectoryPath: string } | null>(null);
  const [draggedResourcePath, setDraggedResourcePath] = useState<string | null>(null);
  const [dropTargetDirectoryPath, setDropTargetDirectoryPath] = useState<string | null>(null);
  const activeFile = useMemo(
    () => projectFiles.find((file) => isProjectFileActive(file, currentFileRef)),
    [currentFileRef, projectFiles]
  );
  const rootItemId = projectWorkspace ? `root:${projectWorkspace.rootPath}` : "root:none";
  const [focusedItemId, setFocusedItemId] = useState(rootItemId);
  const treeRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveRevealKeyRef = useRef<string | null>(null);
  const pendingActiveRevealKeyRef = useRef<string | null>(null);
  const filePointerDragRef = useRef<ExplorerFilePointerDrag | null>(null);
  const contextMenuAnchorRef = useRef<HTMLElement | null>(null);
  const projectAvailable = runtimeKind === "desktop";
  const activeRevealKey = projectWorkspace && activeFile
    ? `${projectWorkspace.rootPath}\n${activeFile.path}`
    : null;

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
    if (!projectWorkspace || !activeFile || !treeState || !activeRevealKey) {
      lastActiveRevealKeyRef.current = null;
      pendingActiveRevealKeyRef.current = null;
      return;
    }
    if (lastActiveRevealKeyRef.current === activeRevealKey) return;
    lastActiveRevealKeyRef.current = activeRevealKey;
    pendingActiveRevealKeyRef.current = activeRevealKey;
    const nextPaths = [...new Set([...expandedDirectoryPaths, ...projectDirectoryAncestors(activeFile.relativePath)])];
    if (!rootExpanded || !samePaths(nextPaths, expandedDirectoryPaths)) {
      onTreeStateChange({ rootExpanded: true, expandedDirectoryPaths: nextPaths });
    }
  }, [activeFile, activeRevealKey, expandedDirectoryPaths, onTreeStateChange, projectWorkspace, rootExpanded, treeState]);

  useEffect(() => {
    if (!activeFile || !activeRevealKey || pendingActiveRevealKeyRef.current !== activeRevealKey || !rootExpanded) return;
    const ancestors = projectDirectoryAncestors(activeFile.relativePath);
    if (ancestors.some((path) => !expandedDirectorySet.has(path))) return;
    const frame = window.requestAnimationFrame(() => {
      if (pendingActiveRevealKeyRef.current !== activeRevealKey) return;
      const activeRow = activeRowRef.current;
      if (!activeRow) return;
      activeRow.scrollIntoView({ block: "nearest" });
      pendingActiveRevealKeyRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeFile, activeRevealKey, expandedDirectoryPathKey, expandedDirectorySet, rootExpanded]);

  useEffect(() => {
    if (!projectBusy) return;
    const drag = filePointerDragRef.current;
    filePointerDragRef.current = null;
    setDraggedResourcePath(null);
    setDropTargetDirectoryPath(null);
    if (drag?.markdownCanvasActive && drag.file && drag.resource.documentKind === "markdown") {
      onMarkdownDocumentPointerDrag(drag.file, { x: drag.lastX, y: drag.lastY }, "cancel");
    }
  }, [onMarkdownDocumentPointerDrag, projectBusy]);

  function updateExpansion(nextRootExpanded: boolean, nextPaths: string[]) {
    onTreeStateChange({ rootExpanded: nextRootExpanded, expandedDirectoryPaths: nextPaths });
  }

  function toggleDirectory(relativePath: string) {
    const next = new Set(expandedDirectoryPaths);
    if (next.has(relativePath)) next.delete(relativePath);
    else next.add(relativePath);
    updateExpansion(rootExpanded, [...next]);
  }

  function openFileContextMenu(resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactMouseEvent) {
    event.preventDefault();
    contextMenuAnchorRef.current = event.currentTarget as HTMLButtonElement;
    setContextMenu({ kind: "file", resource, file, x: event.clientX, y: event.clientY });
  }

  function openDirectoryContextMenu(directoryPath: string, event: ReactMouseEvent) {
    event.preventDefault();
    contextMenuAnchorRef.current = event.currentTarget as HTMLButtonElement;
    setContextMenu({ kind: "directory", directoryPath, x: event.clientX, y: event.clientY });
  }

  function openFileContextMenuFromKeyboard(resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return false;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    contextMenuAnchorRef.current = event.currentTarget;
    setContextMenu({ kind: "file", resource, file, x: bounds.left + 20, y: bounds.top + bounds.height / 2 });
    return true;
  }

  function openDirectoryContextMenuFromKeyboard(directoryPath: string, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return false;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    contextMenuAnchorRef.current = event.currentTarget;
    setContextMenu({ kind: "directory", directoryPath, x: bounds.left + 20, y: bounds.top + bounds.height / 2 });
    return true;
  }

  function startFilePointerDrag(resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) {
    if (projectBusy || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    filePointerDragRef.current = {
      pointerId: event.pointerId,
      resource,
      file,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
      markdownCanvasActive: false
    };
  }

  function moveFilePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = filePointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || projectBusy) return;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    if (!drag.dragging) {
      drag.dragging = true;
      setDraggedResourcePath(drag.resource.path);
    }
    event.preventDefault();

    const target = explorerDirectoryDropTargetAtPoint(treeRef.current, event.clientX, event.clientY);
    if (target) {
      const sourceDirectoryPath = parentResourceDirectory(drag.resource.relativePath);
      setDropTargetDirectoryPath(target.directoryPath === sourceDirectoryPath ? null : target.directoryPath);
      if (drag.markdownCanvasActive && drag.file) {
        onMarkdownDocumentPointerDrag(drag.file, { x: event.clientX, y: event.clientY }, "cancel");
        drag.markdownCanvasActive = false;
      }
      return;
    }

    setDropTargetDirectoryPath(null);
    if (drag.file && drag.resource.documentKind === "markdown") {
      onMarkdownDocumentPointerDrag(drag.file, { x: event.clientX, y: event.clientY }, "move");
      drag.markdownCanvasActive = true;
    }
  }

  function finishFilePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = filePointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    filePointerDragRef.current = null;
    setDraggedResourcePath(null);
    setDropTargetDirectoryPath(null);
    if (!drag.dragging) return false;
    event.preventDefault();

    const target = explorerDirectoryDropTargetAtPoint(treeRef.current, event.clientX, event.clientY);
    if (target) {
      if (drag.markdownCanvasActive && drag.file) {
        onMarkdownDocumentPointerDrag(drag.file, { x: event.clientX, y: event.clientY }, "cancel");
      }
      if (!projectBusy && target.directoryPath !== parentResourceDirectory(drag.resource.relativePath)) {
        onMoveProjectFile(drag.resource, target.directoryPath);
      }
      return true;
    }

    if (drag.file && drag.resource.documentKind === "markdown") {
      onMarkdownDocumentPointerDrag(drag.file, { x: event.clientX, y: event.clientY }, projectBusy ? "cancel" : "drop");
    }
    return true;
  }

  function cancelFilePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = filePointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    filePointerDragRef.current = null;
    setDraggedResourcePath(null);
    setDropTargetDirectoryPath(null);
    if (drag.markdownCanvasActive && drag.file && drag.resource.documentKind === "markdown") {
      onMarkdownDocumentPointerDrag(drag.file, { x: event.clientX, y: event.clientY }, "cancel");
    }
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
      <WorkspaceWindowHeader
        title="资源管理器"
        actions={<>
          <EditorIconButton context="panel" label="打开文件夹" tooltipSide="right" disabled={!projectAvailable || projectBusy} onClick={onOpenProject}>
            <Folder />
          </EditorIconButton>
          {projectWorkspace ? (
            <>
              <EditorIconButton context="panel" label="新建文件" tooltipSide="right" disabled={projectBusy} onClick={() => setCreateFileDialog({ directoryPath: "" })}>
                <Plus />
              </EditorIconButton>
              <EditorIconButton context="panel" label="刷新文件夹" tooltipSide="right" disabled={projectBusy} onClick={onRefreshProject}>
                <RefreshCw className={cn(projectBusy && "animate-spin")} />
              </EditorIconButton>
            </>
          ) : null}
        </>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1.5">
        {!projectWorkspace ? (
          <WorkspaceFolderEmptyState projectAvailable={projectAvailable} projectBusy={projectBusy} onOpenProject={onOpenProject} />
        ) : (
          <EditorTree ref={treeRef} aria-label={`${projectWorkspace.rootName} 资源树`}>
            <EditorTreeItem root>
              <EditorTreeRow
                data-tree-item-id={rootItemId}
                data-project-directory-path=""
                data-project-drop-target={dropTargetDirectoryPath === "" || undefined}
                aria-level={1}
                aria-expanded={rootExpanded}
                tabIndex={focusedItemId === rootItemId ? 0 : -1}
                className={cn(dropTargetDirectoryPath === "" && "text-[hsl(var(--ui-tree-selected-foreground))] before:bg-[hsl(var(--ui-tree-selected-background))]")}
                title={projectWorkspace.rootPath}
                onFocus={() => setFocusedItemId(rootItemId)}
                onKeyDown={(event) => {
                  if (!openDirectoryContextMenuFromKeyboard("", event)) {
                    handleTreeKeyDown(event, { id: rootItemId, kind: "root", expanded: rootExpanded });
                  }
                }}
                onClick={() => updateExpansion(!rootExpanded, expandedDirectoryPaths)}
                onContextMenu={(event) => openDirectoryContextMenu("", event)}
              >
                <Folder className="size-4 shrink-0" />
                <span className="type-interface-navigation min-w-0 truncate">{projectWorkspace.rootName}</span>
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
                      projectBusy={projectBusy}
                      draggedResourcePath={draggedResourcePath}
                      dropTargetDirectoryPath={dropTargetDirectoryPath}
                      onStartFilePointerDrag={startFilePointerDrag}
                      onMoveFilePointerDrag={moveFilePointerDrag}
                      onFinishFilePointerDrag={finishFilePointerDrag}
                      onCancelFilePointerDrag={cancelFilePointerDrag}
                      onOpenFileContextMenu={openFileContextMenu}
                      onOpenDirectoryContextMenu={openDirectoryContextMenu}
                      onOpenFileContextMenuFromKeyboard={openFileContextMenuFromKeyboard}
                      onOpenDirectoryContextMenuFromKeyboard={openDirectoryContextMenuFromKeyboard}
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
        <ProjectResourceContextMenu
          menu={contextMenu}
          rootName={projectWorkspace?.rootName ?? "项目根目录"}
          restoreFocusRef={contextMenuAnchorRef}
          onOpenChange={(open) => {
            if (open) return;
            const focusTarget = contextMenuAnchorRef.current;
            setContextMenu(null);
            window.requestAnimationFrame(() => {
              if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
            });
          }}
          onOpenProjectFile={(file) => { setContextMenu(null); onOpenProjectFile(file); }}
          onOpenProjectMarkdownWindow={(file) => { setContextMenu(null); onOpenProjectMarkdownWindow(file); }}
          onMove={(resource) => {
            setContextMenu(null);
            setMoveFileDialog({ resource, targetDirectoryPath: parentResourceDirectory(resource.relativePath) });
          }}
          projectBusy={projectBusy}
          onCreateFile={(directoryPath) => {
            setContextMenu(null);
            setCreateFileDialog({ directoryPath });
          }}
        />
        {projectWorkspace && createFileDialog ? (
          <CreateProjectFileDialog
            directoryPath={createFileDialog.directoryPath}
            rootName={projectWorkspace.rootName}
            projectBusy={projectBusy}
            onClose={() => setCreateFileDialog(null)}
            onCreate={(request) => {
              setCreateFileDialog(null);
              onCreateProjectFile(request);
            }}
          />
        ) : null}
        {projectWorkspace && moveFileDialog ? (
          <MoveProjectFileDialog
            resource={moveFileDialog.resource}
            rootName={projectWorkspace.rootName}
            directoryPaths={[...directoryPaths].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))}
            targetDirectoryPath={moveFileDialog.targetDirectoryPath}
            projectBusy={projectBusy}
            onTargetDirectoryPathChange={(targetDirectoryPath) => setMoveFileDialog((current) => current ? { ...current, targetDirectoryPath } : null)}
            onClose={() => setMoveFileDialog(null)}
            onMove={() => {
              const { resource, targetDirectoryPath } = moveFileDialog;
              setMoveFileDialog(null);
              onMoveProjectFile(resource, targetDirectoryPath);
            }}
          />
        ) : null}
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
  projectBusy,
  draggedResourcePath,
  dropTargetDirectoryPath,
  onStartFilePointerDrag,
  onMoveFilePointerDrag,
  onFinishFilePointerDrag,
  onCancelFilePointerDrag,
  onOpenFileContextMenu,
  onOpenDirectoryContextMenu,
  onOpenFileContextMenuFromKeyboard,
  onOpenDirectoryContextMenuFromKeyboard,
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
  projectBusy: boolean;
  draggedResourcePath: string | null;
  dropTargetDirectoryPath: string | null;
  onStartFilePointerDrag: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinishFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => boolean;
  onCancelFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onOpenFileContextMenu: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactMouseEvent) => void;
  onOpenDirectoryContextMenu: (relativePath: string, event: ReactMouseEvent) => void;
  onOpenFileContextMenuFromKeyboard: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactKeyboardEvent<HTMLButtonElement>) => boolean;
  onOpenDirectoryContextMenuFromKeyboard: (relativePath: string, event: ReactKeyboardEvent<HTMLButtonElement>) => boolean;
  onUnsupportedResource: (resource: ProjectResourceEntry) => void;
}) {
  if (node.kind === "directory") {
    const expanded = expandedDirectoryPaths.has(node.relativePath);
    return (
      <EditorTreeItem>
        <EditorTreeRow
          data-tree-item-id={node.id}
          data-project-directory-path={node.relativePath}
          data-project-drop-target={dropTargetDirectoryPath === node.relativePath || undefined}
          aria-level={level}
          aria-expanded={expanded}
          tabIndex={focusedItemId === node.id ? 0 : -1}
          className={cn(dropTargetDirectoryPath === node.relativePath && "text-[hsl(var(--ui-tree-selected-foreground))] before:bg-[hsl(var(--ui-tree-selected-background))]")}
          title={node.path}
          onFocus={() => onFocusItem(node.id)}
          onKeyDown={(event) => {
            if (!onOpenDirectoryContextMenuFromKeyboard(node.relativePath, event)) {
              onTreeKeyDown(event, { id: node.id, kind: "directory", expanded, relativePath: node.relativePath, parentPath });
            }
          }}
          onClick={() => onToggleDirectory(node.relativePath)}
          onContextMenu={(event) => onOpenDirectoryContextMenu(node.relativePath, event)}
        >
          <Folder className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{node.name}</span>
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
                projectBusy={projectBusy}
                draggedResourcePath={draggedResourcePath}
                dropTargetDirectoryPath={dropTargetDirectoryPath}
                onStartFilePointerDrag={onStartFilePointerDrag}
                onMoveFilePointerDrag={onMoveFilePointerDrag}
                onFinishFilePointerDrag={onFinishFilePointerDrag}
                onCancelFilePointerDrag={onCancelFilePointerDrag}
                onOpenFileContextMenu={onOpenFileContextMenu}
                onOpenDirectoryContextMenu={onOpenDirectoryContextMenu}
                onOpenFileContextMenuFromKeyboard={onOpenFileContextMenuFromKeyboard}
                onOpenDirectoryContextMenuFromKeyboard={onOpenDirectoryContextMenuFromKeyboard}
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
      projectBusy={projectBusy}
      dragging={draggedResourcePath === node.resource.path}
      onStartFilePointerDrag={onStartFilePointerDrag}
      onMoveFilePointerDrag={onMoveFilePointerDrag}
      onFinishFilePointerDrag={onFinishFilePointerDrag}
      onCancelFilePointerDrag={onCancelFilePointerDrag}
      onOpenFileContextMenu={onOpenFileContextMenu}
      onOpenFileContextMenuFromKeyboard={onOpenFileContextMenuFromKeyboard}
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
  projectBusy,
  dragging,
  onStartFilePointerDrag,
  onMoveFilePointerDrag,
  onFinishFilePointerDrag,
  onCancelFilePointerDrag,
  onOpenFileContextMenu,
  onOpenFileContextMenuFromKeyboard,
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
  projectBusy: boolean;
  dragging: boolean;
  onStartFilePointerDrag: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinishFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => boolean;
  onCancelFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onOpenFileContextMenu: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactMouseEvent) => void;
  onOpenFileContextMenuFromKeyboard: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactKeyboardEvent<HTMLButtonElement>) => boolean;
  onUnsupportedResource: (resource: ProjectResourceEntry) => void;
}) {
  const file = node.file ?? (node.resource.documentKind ? resourceProjectFile(node.resource) : undefined);
  const active = file ? isProjectFileActive(file, currentFileRef) : false;
  const suppressClickRef = useRef(false);

  return (
    <EditorTreeItem>
      <EditorTreeRow
        ref={(element) => { if (active) activeRowRef.current = element; }}
        active={active}
        data-tree-item-id={node.id}
        data-resource-supported={Boolean(file)}
        data-project-resource-dragging={dragging || undefined}
        aria-level={level}
        aria-selected={active}
        tabIndex={focused ? 0 : -1}
        className={cn(!projectBusy && "cursor-grab active:cursor-grabbing", dragging && "opacity-60", !file && "text-muted-foreground")}
        title={file ? node.resource.path : `${node.resource.path}\n当前文件类型暂不支持打开`}
        onFocus={() => onFocusItem(node.id)}
        onKeyDown={(event) => {
          if (!onOpenFileContextMenuFromKeyboard(node.resource, file, event)) {
            onTreeKeyDown(event, { id: node.id, kind: "file", parentPath });
          }
        }}
        onPointerDown={(event) => onStartFilePointerDrag(node.resource, file, event)}
        onPointerMove={onMoveFilePointerDrag}
        onPointerUp={(event) => {
          if (onFinishFilePointerDrag(event)) suppressClickRef.current = true;
        }}
        onPointerCancel={onCancelFilePointerDrag}
        onLostPointerCapture={onCancelFilePointerDrag}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            return;
          }
          if (file) onOpenProjectFile(file);
          else onUnsupportedResource(node.resource);
        }}
        onContextMenu={(event) => onOpenFileContextMenu(node.resource, file, event)}
      >
        <ProjectResourceIcon resource={node.resource} />
        <span className="min-w-0 truncate">{node.name}</span>
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

function ProjectResourceContextMenu({
  menu,
  rootName,
  restoreFocusRef,
  projectBusy,
  onOpenChange,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onMove,
  onCreateFile
}: {
  menu: ExplorerContextMenu | null;
  rootName: string;
  restoreFocusRef: RefObject<HTMLElement | null>;
  projectBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onMove: (resource: ProjectResourceEntry) => void;
  onCreateFile: (directoryPath: string) => void;
}) {
  if (!menu) return null;

  const fileMenu = menu.kind === "file";
  const markdownFile = fileMenu && menu.resource.documentKind === "markdown" && Boolean(menu.file);
  const targetName = fileMenu
    ? menu.resource.name
    : menu.directoryPath.split("/").at(-1) || rootName;

  return (
    <EditorPointMenu
      open
      point={{ x: menu.x, y: menu.y }}
      onOpenChange={onOpenChange}
      ariaLabel={`${targetName} 操作`}
      restoreFocusRef={restoreFocusRef}
    >
      {fileMenu && menu.file ? (
        <DropdownMenuItem title={menu.file.path} onSelect={() => onOpenProjectFile(menu.file!)}>
          <Page className="size-4" />
          <span className="truncate">打开</span>
        </DropdownMenuItem>
      ) : null}
      {markdownFile && menu.file ? (
        <DropdownMenuItem title={menu.file.path} onSelect={() => onOpenProjectMarkdownWindow(menu.file!)}>
          <OpenNewWindow className="size-4" />
          <span className="truncate">在浮窗中打开</span>
        </DropdownMenuItem>
      ) : null}
      {fileMenu ? (
        <>
          {menu.file ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem title={menu.resource.path} disabled={projectBusy} onSelect={() => onMove(menu.resource)}>
            <PathArrow className="size-4" />
            <span className="truncate">移动到…</span>
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem disabled={projectBusy} onSelect={() => onCreateFile(menu.directoryPath)}>
          <PagePlus className="size-4" />
          <span className="truncate">新建文件…</span>
        </DropdownMenuItem>
      )}
    </EditorPointMenu>
  );
}

function CreateProjectFileDialog({ directoryPath, rootName, projectBusy, onClose, onCreate }: {
  directoryPath: string;
  rootName: string;
  projectBusy: boolean;
  onClose: () => void;
  onCreate: (request: ExplorerCreateProjectFileRequest) => void;
}) {
  const [kind, setKind] = useState<ExplorerProjectFileKind>("markdown");
  const descriptor = EXPLORER_FILE_KINDS.find((item) => item.kind === kind) ?? EXPLORER_FILE_KINDS[0];
  const [fileName, setFileName] = useState<string>(descriptor.defaultFileName);
  const directoryLabel = projectDirectoryLabel(rootName, directoryPath);

  function selectKind(nextKind: ExplorerProjectFileKind) {
    const currentDescriptor = EXPLORER_FILE_KINDS.find((item) => item.kind === kind) ?? EXPLORER_FILE_KINDS[0];
    const nextDescriptor = EXPLORER_FILE_KINDS.find((item) => item.kind === nextKind) ?? EXPLORER_FILE_KINDS[0];
    setKind(nextKind);
    setFileName((current) => current === currentDescriptor.defaultFileName ? nextDescriptor.defaultFileName : current);
  }

  function submit() {
    const normalizedFileName = ensureExplorerFileName(fileName, descriptor.extension);
    if (!normalizedFileName) return;
    onCreate({ directoryPath, fileName: normalizedFileName, kind });
  }

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="新建文件"
      description={`位置：${directoryLabel}`}
      size="sm"
      dismissible={!projectBusy}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={projectBusy}>取消</Button>
          <Button type="button" onClick={submit} disabled={projectBusy || !fileName.trim()}><Plus />新建</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <EditorSegmentedControl aria-label="文件类型">
          {EXPLORER_FILE_KINDS.map((item) => (
            <EditorSegmentedControlItem key={item.kind} type="button" active={kind === item.kind} onClick={() => selectKind(item.kind)} disabled={projectBusy}>
              {item.label}
            </EditorSegmentedControlItem>
          ))}
        </EditorSegmentedControl>
        <EditorField label="文件名" htmlFor="explorer-new-file-name" description={`未填写扩展名时自动添加 ${descriptor.extension}`}>
          <Input
            id="explorer-new-file-name"
            value={fileName}
            placeholder={descriptor.defaultFileName}
            onChange={(event) => setFileName(event.target.value)}
            autoFocus
            disabled={projectBusy}
          />
        </EditorField>
      </form>
    </EditorDialog>
  );
}

function MoveProjectFileDialog({
  resource,
  rootName,
  directoryPaths,
  targetDirectoryPath,
  projectBusy,
  onTargetDirectoryPathChange,
  onClose,
  onMove
}: {
  resource: ProjectResourceEntry;
  rootName: string;
  directoryPaths: string[];
  targetDirectoryPath: string;
  projectBusy: boolean;
  onTargetDirectoryPathChange: (relativePath: string) => void;
  onClose: () => void;
  onMove: () => void;
}) {
  const sourceDirectoryPath = parentResourceDirectory(resource.relativePath);
  const destinationPaths = ["", ...directoryPaths];
  const destinationUnchanged = targetDirectoryPath === sourceDirectoryPath;

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`移动 ${resource.name}`}
      description="选择目标文件夹"
      size="sm"
      dismissible={!projectBusy}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={projectBusy}>取消</Button>
          <Button type="button" onClick={onMove} disabled={projectBusy || destinationUnchanged}><PathArrow />移动</Button>
        </>
      }
    >
      <EditorList className="max-h-[min(420px,55vh)] overflow-y-auto border p-1" aria-label="目标文件夹">
        {destinationPaths.map((directoryPath) => (
          <EditorListRow
            type="button"
            key={directoryPath || "root"}
            icon={<Folder className="size-4" />}
            title={directoryPath ? directoryPath.split("/").at(-1) : rootName}
            description={directoryPath || "项目根目录"}
            tooltip={projectDirectoryLabel(rootName, directoryPath)}
            selected={targetDirectoryPath === directoryPath}
            disabled={projectBusy}
            onClick={() => onTargetDirectoryPathChange(directoryPath)}
          />
        ))}
      </EditorList>
    </EditorDialog>
  );
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

function parentResourceDirectory(relativePath: string) {
  const segments = relativePath.replaceAll("\\", "/").split("/");
  segments.pop();
  return segments.join("/");
}

function explorerDirectoryDropTargetAtPoint(root: HTMLDivElement | null, x: number, y: number): ExplorerDirectoryDropTarget | null {
  if (!root || typeof document === "undefined" || typeof document.elementFromPoint !== "function") return null;
  const element = document.elementFromPoint(x, y);
  const row = element?.closest<HTMLElement>("[data-project-directory-path]");
  if (!row || !root.contains(row)) return null;
  const directoryPath = row.dataset.projectDirectoryPath;
  return typeof directoryPath === "string" ? { directoryPath } : null;
}

function projectDirectoryLabel(rootName: string, directoryPath: string) {
  return directoryPath ? `${rootName}/${directoryPath}` : rootName;
}

function ensureExplorerFileName(value: string, extension: string) {
  const fileName = value.trim();
  if (!fileName) return "";
  if (fileName.toLocaleLowerCase().endsWith(extension)) return fileName;
  const withoutExtension = fileName.replace(/(?:\.canvas\.json|\.markdown|\.mermaid|\.[^./\\]+)$/i, "");
  return `${withoutExtension || fileName}${extension}`;
}
