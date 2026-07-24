import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  Archive,
  Code,
  Collapse,
  EmptyPage,
  Expand,
  Folder,
  FolderPlus,
  Html5,
  InputSearch,
  JpgFormat,
  Network,
  Notes,
  Page,
  Plus,
  MediaImage,
  PngFormat,
  Refresh as RefreshCw,
  SvgFormat,
  TableRows,
  WebpFormat
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EditorEmptyState,
  EditorIconButton,
  EditorTree,
  EditorTreeGroup,
  EditorTreeItem,
  EditorTreeRow
} from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import { isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import { isHtmlDocumentFilePath } from "@/features/mermaid-editor/lib/html-document";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
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
import { ProjectResourceContextMenu } from "@/features/mermaid-editor/components/explorer-panel-context-menu";
import {
  CreateProjectDirectoryDialog,
  CreateProjectFileDialog,
  DeleteProjectResourcesDialog,
  MoveProjectResourcesDialog,
  RenameProjectResourceDialog
} from "@/features/mermaid-editor/components/explorer-panel-dialogs";

const EMPTY_EXPANDED_DIRECTORY_PATHS: string[] = [];
const PROJECT_RESOURCE_ICON_CLASS_NAME = "shrink-0";
const ARCHIVE_FILE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "7z", "rar", "bz2", "xz"]);
const CODE_FILE_EXTENSIONS = new Set(["js", "jsx", "ts", "tsx", "css", "scss", "sass", "json", "jsonc", "yaml", "yml", "xml", "toml", "cjs", "mjs", "py", "sh", "sql"]);
const TEXT_FILE_EXTENSIONS = new Set(["txt", "log", "rst"]);

type ExplorerFilePointerDrag = {
  pointerId: number;
  resource: ProjectResourceEntry;
  resources: ProjectResourceEntry[];
  file?: ProjectFileEntry;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
  documentCanvasKind?: "markdown" | "html";
};

type ExplorerDirectoryDropTarget = {
  directoryPath: string;
};

export type ExplorerResourceStatus = "clean" | "dirty" | "saving" | "conflict" | "error" | "external-changed" | "missing" | "unsupported" | "readonly";

export type ExplorerProjectFileKind = "markdown" | "mermaid" | "csv" | "html";

export type ExplorerCreateProjectFileRequest = {
  directoryPath: string;
  fileName: string;
  kind: ExplorerProjectFileKind;
};

export type ExplorerCreateProjectDirectoryRequest = {
  directoryPath: string;
  directoryName: string;
};

export function ExplorerPanel({
  runtimeKind,
  projectWorkspace,
  projectFiles,
  currentFileRef,
  projectBusy,
  treeState,
  resourceStatuses,
  onTreeStateChange,
  onOpenProject,
  onRefreshProject,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onOpenProjectHtmlWindow,
  onOpenProjectImageWindow,
  onCreateProjectFile,
  onCreateProjectDirectory,
  onRenameProjectResource,
  onMoveProjectFile: _onMoveProjectFile,
  onMoveProjectResources,
  onCopyProjectResources,
  onImportProjectResources,
  onDeleteProjectResources,
  onShowProjectResourceInFileManager,
  onProjectDocumentPointerDrag,
  onStatus
}: {
  runtimeKind: "web" | "desktop";
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  currentFileRef: RuntimeFileRef | null;
  projectBusy: boolean;
  treeState: ExplorerWorkspaceTreeState | null;
  resourceStatuses?: Record<string, ExplorerResourceStatus | undefined>;
  onTreeStateChange: (state: Omit<ExplorerWorkspaceTreeState, "rootPath" | "updatedAt">) => void;
  onOpenProject: () => void;
  onRefreshProject: () => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenProjectHtmlWindow: (file: ProjectFileEntry) => void;
  onOpenProjectImageWindow: (file: ProjectFileEntry) => void;
  onCreateProjectFile: (request: ExplorerCreateProjectFileRequest) => void;
  onCreateProjectDirectory: (request: ExplorerCreateProjectDirectoryRequest) => void;
  onRenameProjectResource: (resource: ProjectResourceEntry, name: string) => void;
  onMoveProjectFile: (file: ProjectResourceEntry, targetDirectoryPath: string) => void;
  onMoveProjectResources: (resources: ProjectResourceEntry[], targetDirectoryPath: string) => void;
  onCopyProjectResources: (resources: ProjectResourceEntry[], targetDirectoryPath: string) => void;
  onImportProjectResources: (externalPaths: string[], targetDirectoryPath: string) => void;
  onDeleteProjectResources: (resources: ProjectResourceEntry[]) => void;
  onShowProjectResourceInFileManager: (resource: ProjectResourceEntry) => void;
  onProjectDocumentPointerDrag: (file: ProjectFileEntry, kind: "markdown" | "html", point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  onStatus: (message: string) => void;
}) {
  const resources = useMemo(
    () => projectWorkspace?.resources ?? projectResourcesFromFiles(projectFiles),
    [projectFiles, projectWorkspace?.resources]
  );
  const tree = useMemo(() => buildProjectResourceTree(resources, projectFiles), [projectFiles, resources]);
  const resourcesByPath = useMemo(() => new Map(resources.map((resource) => [resource.path, resource])), [resources]);
  const directoryPaths = useMemo(
    () => new Set(projectTreeDirectoryIds(tree).map((id) => id.slice("dir:".length))),
    [tree]
  );
  const [filterQuery, setFilterQuery] = useState("");
  const filtering = Boolean(filterQuery.trim());
  const filteredTree = useMemo(() => filterProjectTree(tree, filterQuery), [filterQuery, tree]);
  const rootExpanded = treeState?.rootExpanded ?? true;
  const expandedDirectoryPaths = treeState?.expandedDirectoryPaths ?? EMPTY_EXPANDED_DIRECTORY_PATHS;
  const expandedDirectoryPathKey = expandedDirectoryPaths.join("\n");
  const expandedDirectorySet = useMemo(() => new Set(expandedDirectoryPaths), [expandedDirectoryPaths]);
  const [createFileDialog, setCreateFileDialog] = useState<{ directoryPath: string } | null>(null);
  const [createDirectoryDialog, setCreateDirectoryDialog] = useState<{ directoryPath: string } | null>(null);
  const [moveResourcesDialog, setMoveResourcesDialog] = useState<{ resources: ProjectResourceEntry[]; targetDirectoryPath: string } | null>(null);
  const [deleteResourcesDialog, setDeleteResourcesDialog] = useState<{ resources: ProjectResourceEntry[] } | null>(null);
  const [renameResource, setRenameResource] = useState<ProjectResourceEntry | null>(null);
  const [selectedResourcePaths, setSelectedResourcePaths] = useState<Set<string>>(() => new Set());
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null);
  const [resourceClipboard, setResourceClipboard] = useState<ProjectResourceEntry[]>([]);
  const [draggedResourcePath, setDraggedResourcePath] = useState<string | null>(null);
  const [dropTargetDirectoryPath, setDropTargetDirectoryPath] = useState<string | null>(null);
  const pendingRenameClickRef = useRef<number | null>(null);
  const activeFile = useMemo(
    () => projectFiles.find((file) => isProjectFileActive(file, currentFileRef)),
    [currentFileRef, projectFiles]
  );
  const rootItemId = projectWorkspace ? `root:${projectWorkspace.rootPath}` : "root:none";
  const [focusedItemId, setFocusedItemId] = useState(rootItemId);
  const treeRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveRevealKeyRef = useRef<string | null>(null);
  const pendingActiveRevealKeyRef = useRef<string | null>(null);
  const filePointerDragRef = useRef<ExplorerFilePointerDrag | null>(null);
  const projectAvailable = runtimeKind === "desktop";
  const selectedResources = useMemo(
    () => [...selectedResourcePaths].map((path) => resourcesByPath.get(path)).filter((resource): resource is ProjectResourceEntry => Boolean(resource)),
    [resourcesByPath, selectedResourcePaths]
  );
  const activeRevealKey = projectWorkspace && activeFile
    ? `${projectWorkspace.rootPath}\n${activeFile.path}`
    : null;

  useEffect(() => {
    setFocusedItemId(activeFile ? `file:${activeFile.path}` : rootItemId);
  }, [activeFile, rootItemId]);

  useEffect(() => {
    setSelectedResourcePaths((current) => {
      const next = new Set([...current].filter((path) => resourcesByPath.has(path)));
      return samePathSet(next, current) ? current : next;
    });
  }, [resourcesByPath]);

  useEffect(() => () => {
    if (pendingRenameClickRef.current) window.clearTimeout(pendingRenameClickRef.current);
  }, []);

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
    if (drag?.documentCanvasKind && drag.file) {
      onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: drag.lastX, y: drag.lastY }, "cancel");
    }
  }, [onProjectDocumentPointerDrag, projectBusy]);

  function updateExpansion(nextRootExpanded: boolean, nextPaths: string[]) {
    onTreeStateChange({ rootExpanded: nextRootExpanded, expandedDirectoryPaths: nextPaths });
  }

  function toggleDirectory(relativePath: string) {
    const next = new Set(expandedDirectoryPaths);
    if (next.has(relativePath)) next.delete(relativePath);
    else next.add(relativePath);
    updateExpansion(rootExpanded, [...next]);
  }

  function createFileInDirectory(directoryPath: string) {
    setCreateFileDialog({ directoryPath });
  }

  function createDirectoryInDirectory(directoryPath: string) {
    setCreateDirectoryDialog({ directoryPath });
  }

  function moveResource(resource: ProjectResourceEntry) {
    const resources = contextualResources(resource);
    setMoveResourcesDialog({ resources, targetDirectoryPath: parentResourceDirectory(resource.relativePath) });
  }

  function copyResourcesToClipboard(resources: ProjectResourceEntry[]) {
    setResourceClipboard(resources);
    onStatus(`已复制 ${resources.length} 项，选择目标文件夹后可粘贴。`);
  }

  function copyResourcePaths(resources: ProjectResourceEntry[], relative = false) {
    const text = resources.map((resource) => relative ? resource.relativePath : resource.path).join("\n");
    void navigator.clipboard?.writeText(text);
    onStatus(`已复制 ${relative ? "相对" : ""}路径。`);
  }

  function pasteResources(directoryPath: string) {
    if (!resourceClipboard.length) return;
    onCopyProjectResources(resourceClipboard, directoryPath);
  }

  function requestDeleteResources(resources: ProjectResourceEntry[]) {
    if (!resources.length) return;
    setDeleteResourcesDialog({ resources });
  }

  function contextualResources(resource: ProjectResourceEntry) {
    return selectedResourcePaths.has(resource.path) && selectedResources.length ? selectedResources : [resource];
  }

  function focusAndSelectResource(resource: ProjectResourceEntry, event: ReactMouseEvent<HTMLButtonElement>) {
    setFocusedItemId(resource.kind === "directory" ? `dir:${resource.relativePath}` : `file:${resource.path}`);
    const visible = visibleResourceRows(treeRef.current).map((row) => row.dataset.projectResourcePath).filter((path): path is string => Boolean(path));
    if (event.shiftKey && selectionAnchorPath && visible.includes(selectionAnchorPath) && visible.includes(resource.path)) {
      const anchorIndex = visible.indexOf(selectionAnchorPath);
      const targetIndex = visible.indexOf(resource.path);
      const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      setSelectedResourcePaths(new Set(visible.slice(start, end + 1)));
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedResourcePaths((current) => {
        const next = new Set(current);
        if (next.has(resource.path)) next.delete(resource.path);
        else next.add(resource.path);
        return next;
      });
      setSelectionAnchorPath(resource.path);
      return;
    }
    setSelectedResourcePaths(new Set([resource.path]));
    setSelectionAnchorPath(resource.path);
  }

  function selectResourceForContextMenu(resource: ProjectResourceEntry) {
    if (selectedResourcePaths.has(resource.path)) return;
    setSelectedResourcePaths(new Set([resource.path]));
    setSelectionAnchorPath(resource.path);
  }

  function handleResourceClick(resource: ProjectResourceEntry, event: ReactMouseEvent<HTMLButtonElement>) {
    const selected = selectedResourcePaths.has(resource.path);
    const nameClick = Boolean((event.target as HTMLElement | null)?.closest("[data-project-resource-name]"));
    focusAndSelectResource(resource, event);
    if (selected && nameClick && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      if (pendingRenameClickRef.current) window.clearTimeout(pendingRenameClickRef.current);
      pendingRenameClickRef.current = window.setTimeout(() => {
        setRenameResource(resource);
        pendingRenameClickRef.current = null;
      }, 260);
    }
  }

  function handleResourceDoubleClick(resource: ProjectResourceEntry, file: ProjectFileEntry | undefined) {
    if (pendingRenameClickRef.current) {
      window.clearTimeout(pendingRenameClickRef.current);
      pendingRenameClickRef.current = null;
    }
    if (resource.kind === "directory") {
      toggleDirectory(resource.relativePath);
      return;
    }
    openProjectResource(resource, file);
  }

  function openProjectResource(resource: ProjectResourceEntry, file: ProjectFileEntry | undefined) {
    const htmlFile = isHtmlDocumentFilePath(resource.path);
    const imageFile = isSupportedImagePath(resource.path);
    if (file && imageFile) onOpenProjectImageWindow(file);
    else if (file && htmlFile) onOpenProjectHtmlWindow(file);
    else if (file) onOpenProjectFile(file);
    else onStatus(`暂不支持打开 ${resource.name}。`);
  }

  function expandAllDirectories() {
    updateExpansion(true, [...directoryPaths]);
  }

  function collapseAllDirectories() {
    updateExpansion(true, []);
  }

  function handleExternalResourceDrop(directoryPath: string, event: ReactDragEvent<HTMLElement>) {
    const paths = droppedFilePaths(event);
    if (!paths.length) return;
    event.preventDefault();
    event.stopPropagation();
    onImportProjectResources(paths, directoryPath);
  }

  function startFilePointerDrag(resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) {
    if (projectBusy || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    filePointerDragRef.current = {
      pointerId: event.pointerId,
      resource,
      resources: contextualResources(resource),
      file,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
      documentCanvasKind: undefined
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
      if (drag.documentCanvasKind && drag.file) {
        onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
        drag.documentCanvasKind = undefined;
      }
      return;
    }

    setDropTargetDirectoryPath(null);
    const documentKind = projectDocumentNodeKind(drag.resource);
    if (drag.resources.length === 1 && drag.file && documentKind) {
      onProjectDocumentPointerDrag(drag.file, documentKind, { x: event.clientX, y: event.clientY }, "move");
      drag.documentCanvasKind = documentKind;
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
      if (drag.documentCanvasKind && drag.file) {
        onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
      }
      if (!projectBusy && target.directoryPath !== parentResourceDirectory(drag.resource.relativePath)) {
        onMoveProjectResources(drag.resources, target.directoryPath);
      }
      return true;
    }

    const documentKind = projectDocumentNodeKind(drag.resource);
    if (drag.file && documentKind) {
      onProjectDocumentPointerDrag(drag.file, documentKind, { x: event.clientX, y: event.clientY }, projectBusy ? "cancel" : "drop");
    }
    return true;
  }

  function cancelFilePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = filePointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    filePointerDragRef.current = null;
    setDraggedResourcePath(null);
    setDropTargetDirectoryPath(null);
    if (drag.documentCanvasKind && drag.file) {
      onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
    }
  }

  function handleTreeKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    item: { id: string; kind: "root" | "directory" | "file"; expanded?: boolean; relativePath?: string; parentPath?: string; resource?: ProjectResourceEntry; file?: ProjectFileEntry }
  ) {
    const items = visibleTreeItems(treeRef.current);
    const index = items.findIndex((candidate) => candidate.dataset.treeItemId === item.id);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      filterInputRef.current?.focus();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && selectedResources.length) {
      event.preventDefault();
      copyResourcesToClipboard(item.resource ? contextualResources(item.resource) : selectedResources);
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
      pasteResources(item.kind === "root" ? "" : item.kind === "directory" ? item.relativePath || "" : item.parentPath || "");
    } else if (event.key === "F2" && item.resource) {
      event.preventDefault();
      const targets = contextualResources(item.resource);
      if (targets.length === 1) setRenameResource(targets[0]);
    } else if ((event.key === "Delete" || (event.metaKey && event.key === "Backspace")) && selectedResources.length) {
      event.preventDefault();
      requestDeleteResources(item.resource ? contextualResources(item.resource) : selectedResources);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (item.kind === "root") updateExpansion(!rootExpanded, expandedDirectoryPaths);
      else if (item.kind === "directory" && item.relativePath) toggleDirectory(item.relativePath);
      else if (item.resource) openProjectResource(item.resource, item.file);
    } else if (event.key === "ArrowDown") {
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
            <Folder data-icon />
          </EditorIconButton>
	          {projectWorkspace ? (
	            <>
	              <EditorIconButton context="panel" label="新建文件" tooltipSide="right" disabled={projectBusy} onClick={() => setCreateFileDialog({ directoryPath: "" })}>
	                <Plus data-icon />
	              </EditorIconButton>
	              <EditorIconButton context="panel" label="新建文件夹" tooltipSide="right" disabled={projectBusy} onClick={() => setCreateDirectoryDialog({ directoryPath: "" })}>
	                <FolderPlus data-icon />
	              </EditorIconButton>
	              <EditorIconButton context="panel" label="刷新文件夹" tooltipSide="right" disabled={projectBusy} onClick={onRefreshProject}>
	                <RefreshCw data-icon className={cn(projectBusy && "animate-spin")} />
	              </EditorIconButton>
	              <EditorIconButton context="panel" label="全部展开" tooltipSide="right" disabled={projectBusy || !directoryPaths.size} onClick={expandAllDirectories}>
	                <Expand data-icon />
	              </EditorIconButton>
	              <EditorIconButton context="panel" label="全部折叠" tooltipSide="right" disabled={projectBusy || !directoryPaths.size} onClick={collapseAllDirectories}>
	                <Collapse data-icon />
	              </EditorIconButton>
	            </>
	          ) : null}
        </>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1.5">
	        {!projectWorkspace ? (
	          <WorkspaceFolderEmptyState projectAvailable={projectAvailable} projectBusy={projectBusy} onOpenProject={onOpenProject} />
	        ) : (
	          <>
	          <div className="px-1 pb-1">
	            <div className="flex min-w-0 items-center gap-1 rounded-sm border bg-background px-2">
	              <InputSearch className="shrink-0 text-muted-foreground" data-icon />
	              <Input
	                ref={filterInputRef}
	                value={filterQuery}
	                placeholder="搜索文件"
	                className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
	                aria-label="搜索资源"
	                onChange={(event) => setFilterQuery(event.target.value)}
	                onKeyDown={(event) => {
	                  if (event.key === "Escape") {
	                    event.preventDefault();
	                    setFilterQuery("");
	                    treeRef.current?.querySelector<HTMLButtonElement>('[role="treeitem"]')?.focus();
	                  }
	                }}
	              />
	            </div>
	          </div>
	          <EditorTree ref={treeRef} aria-label={`${projectWorkspace.rootName} 资源树`}>
	            <EditorTreeItem root>
	              <ProjectResourceContextMenu
	                menu={{ kind: "directory", directoryPath: "" }}
	                rootName={projectWorkspace.rootName}
	                projectBusy={projectBusy}
	                selectedResources={selectedResources}
	                resourceClipboard={resourceClipboard}
	                onOpenProjectFile={onOpenProjectFile}
	                onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
	                onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
	                onOpenProjectImageWindow={onOpenProjectImageWindow}
	                onMove={moveResource}
	                onCreateFile={createFileInDirectory}
	                onCreateDirectory={createDirectoryInDirectory}
	                onRename={setRenameResource}
	                onDelete={requestDeleteResources}
	                onCopyResources={copyResourcesToClipboard}
	                onPasteResources={pasteResources}
	                onCopyPaths={copyResourcePaths}
	                onShowInFileManager={onShowProjectResourceInFileManager}
	              >
	                <EditorTreeRow
                  data-tree-item-id={rootItemId}
                  data-project-directory-path=""
                  data-project-drop-target={dropTargetDirectoryPath === "" || undefined}
                  aria-level={1}
	                  aria-expanded={filtering || rootExpanded}
	                  tabIndex={focusedItemId === rootItemId ? 0 : -1}
                  className={cn(dropTargetDirectoryPath === "" && "text-[hsl(var(--ui-tree-selected-foreground))] before:bg-[hsl(var(--ui-tree-selected-background))]")}
                  title={projectWorkspace.rootPath}
                  onFocus={() => setFocusedItemId(rootItemId)}
                  onKeyDown={(event) => {
	                    if (!openContextMenuFromKeyboard(event)) {
	                      handleTreeKeyDown(event, { id: rootItemId, kind: "root", expanded: filtering || rootExpanded });
	                    }
	                  }}
	                  onClick={() => updateExpansion(!rootExpanded, expandedDirectoryPaths)}
	                  onDragOver={(event) => {
	                    event.preventDefault();
	                    event.dataTransfer.dropEffect = "copy";
	                  }}
	                  onDrop={(event) => handleExternalResourceDrop("", event)}
	                >
	                  <Folder className={PROJECT_RESOURCE_ICON_CLASS_NAME} data-project-resource-icon="folder" />
	                  <span className="min-w-0 truncate">{projectWorkspace.rootName}</span>
	                </EditorTreeRow>
	              </ProjectResourceContextMenu>
	              {(filtering || rootExpanded) ? (
	                <EditorTreeGroup>
	                  {filteredTree.length ? filteredTree.map((node) => (
	                    <ProjectTreeNodeRow
                      key={node.id}
                      node={node}
                      level={2}
                      parentPath=""
	                      expandedDirectoryPaths={expandedDirectorySet}
	                      filtering={filtering}
	                      focusedItemId={focusedItemId}
	                      selectedResourcePaths={selectedResourcePaths}
	                      selectedResources={selectedResources}
	                      resourceClipboard={resourceClipboard}
	                      resourceStatuses={resourceStatuses}
                      currentFileRef={currentFileRef}
                      activeRowRef={activeRowRef}
                      onFocusItem={setFocusedItemId}
                      onTreeKeyDown={handleTreeKeyDown}
	                      onToggleDirectory={toggleDirectory}
	                      onSelectResource={handleResourceClick}
	                      onContextMenuResource={selectResourceForContextMenu}
	                      onDoubleClickResource={handleResourceDoubleClick}
                      onOpenProjectFile={onOpenProjectFile}
                      onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                      onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
                      onOpenProjectImageWindow={onOpenProjectImageWindow}
                      onProjectDocumentPointerDrag={onProjectDocumentPointerDrag}
                      projectBusy={projectBusy}
                      draggedResourcePath={draggedResourcePath}
                      dropTargetDirectoryPath={dropTargetDirectoryPath}
                      onStartFilePointerDrag={startFilePointerDrag}
                      onMoveFilePointerDrag={moveFilePointerDrag}
                      onFinishFilePointerDrag={finishFilePointerDrag}
                      onCancelFilePointerDrag={cancelFilePointerDrag}
                      rootName={projectWorkspace.rootName}
	                      onMoveResource={moveResource}
	                      onCreateFile={createFileInDirectory}
	                      onCreateDirectory={createDirectoryInDirectory}
	                      onRenameResource={setRenameResource}
	                      onDeleteResources={requestDeleteResources}
	                      onCopyResources={copyResourcesToClipboard}
	                      onPasteResources={pasteResources}
	                      onImportExternalResources={onImportProjectResources}
	                      onCopyPaths={copyResourcePaths}
	                      onShowInFileManager={onShowProjectResourceInFileManager}
	                      onUnsupportedResource={(resource) => onStatus(`暂不支持打开 ${resource.name}。`)}
	                    />
	                  )) : <EditorEmptyState className="border-0" title={filtering ? "没有匹配资源" : "此文件夹为空"} />}
	                </EditorTreeGroup>
	              ) : null}
            </EditorTreeItem>
            {projectWorkspace.resourcesTruncated ? (
              <div role="status" className="px-3 py-2 text-xs text-muted-foreground">资源较多，仅显示前 10,000 项。</div>
            ) : null}
	          </EditorTree>
	          </>
	        )}
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
	        {projectWorkspace && createDirectoryDialog ? (
	          <CreateProjectDirectoryDialog
	            directoryPath={createDirectoryDialog.directoryPath}
	            rootName={projectWorkspace.rootName}
	            projectBusy={projectBusy}
	            onClose={() => setCreateDirectoryDialog(null)}
	            onCreate={(request) => {
	              setCreateDirectoryDialog(null);
	              onCreateProjectDirectory(request);
	            }}
	          />
	        ) : null}
	        {projectWorkspace && renameResource ? (
	          <RenameProjectResourceDialog
	            resource={renameResource}
	            projectBusy={projectBusy}
	            onClose={() => setRenameResource(null)}
	            onRename={(name) => {
	              const resource = renameResource;
	              setRenameResource(null);
	              onRenameProjectResource(resource, name);
	            }}
	          />
	        ) : null}
	        {projectWorkspace && moveResourcesDialog ? (
	          <MoveProjectResourcesDialog
	            resources={moveResourcesDialog.resources}
	            rootName={projectWorkspace.rootName}
	            directoryPaths={[...directoryPaths].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))}
	            targetDirectoryPath={moveResourcesDialog.targetDirectoryPath}
	            projectBusy={projectBusy}
	            onTargetDirectoryPathChange={(targetDirectoryPath) => setMoveResourcesDialog((current) => current ? { ...current, targetDirectoryPath } : null)}
	            onClose={() => setMoveResourcesDialog(null)}
	            onMove={() => {
	              const { resources, targetDirectoryPath } = moveResourcesDialog;
	              setMoveResourcesDialog(null);
	              onMoveProjectResources(resources, targetDirectoryPath);
	            }}
	          />
	        ) : null}
	        {projectWorkspace && deleteResourcesDialog ? (
	          <DeleteProjectResourcesDialog
	            resources={deleteResourcesDialog.resources}
	            projectBusy={projectBusy}
	            onClose={() => setDeleteResourcesDialog(null)}
	            onDelete={() => {
	              const { resources } = deleteResourcesDialog;
	              setDeleteResourcesDialog(null);
	              onDeleteProjectResources(resources);
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
        <Folder data-icon />
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
  filtering,
  focusedItemId,
  selectedResourcePaths,
  selectedResources,
  resourceClipboard,
  resourceStatuses,
  currentFileRef,
  activeRowRef,
  onFocusItem,
  onTreeKeyDown,
  onToggleDirectory,
  onSelectResource,
  onContextMenuResource,
  onDoubleClickResource,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onOpenProjectHtmlWindow,
  onOpenProjectImageWindow,
  onProjectDocumentPointerDrag,
  projectBusy,
  draggedResourcePath,
  dropTargetDirectoryPath,
  onStartFilePointerDrag,
  onMoveFilePointerDrag,
  onFinishFilePointerDrag,
  onCancelFilePointerDrag,
  rootName,
  onMoveResource,
  onCreateFile,
  onCreateDirectory,
  onRenameResource,
  onDeleteResources,
  onCopyResources,
  onPasteResources,
  onImportExternalResources,
  onCopyPaths,
  onShowInFileManager,
  onUnsupportedResource
}: {
  node: ProjectTreeNode;
  level: number;
  parentPath: string;
  expandedDirectoryPaths: Set<string>;
  filtering: boolean;
  focusedItemId: string;
  selectedResourcePaths: Set<string>;
  selectedResources: ProjectResourceEntry[];
  resourceClipboard: ProjectResourceEntry[];
  resourceStatuses?: Record<string, ExplorerResourceStatus | undefined>;
  currentFileRef: RuntimeFileRef | null;
  activeRowRef: { current: HTMLButtonElement | null };
  onFocusItem: (id: string) => void;
  onTreeKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, item: { id: string; kind: "root" | "directory" | "file"; expanded?: boolean; relativePath?: string; parentPath?: string; resource?: ProjectResourceEntry; file?: ProjectFileEntry }) => void;
  onToggleDirectory: (relativePath: string) => void;
  onSelectResource: (resource: ProjectResourceEntry, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onContextMenuResource: (resource: ProjectResourceEntry) => void;
  onDoubleClickResource: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenProjectHtmlWindow: (file: ProjectFileEntry) => void;
  onOpenProjectImageWindow: (file: ProjectFileEntry) => void;
  onProjectDocumentPointerDrag: (file: ProjectFileEntry, kind: "markdown" | "html", point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  projectBusy: boolean;
  draggedResourcePath: string | null;
  dropTargetDirectoryPath: string | null;
  onStartFilePointerDrag: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinishFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => boolean;
  onCancelFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  rootName: string;
  onMoveResource: (resource: ProjectResourceEntry) => void;
  onCreateFile: (directoryPath: string) => void;
  onCreateDirectory: (directoryPath: string) => void;
  onRenameResource: (resource: ProjectResourceEntry) => void;
  onDeleteResources: (resources: ProjectResourceEntry[]) => void;
  onCopyResources: (resources: ProjectResourceEntry[]) => void;
  onPasteResources: (directoryPath: string) => void;
  onImportExternalResources: (externalPaths: string[], directoryPath: string) => void;
  onCopyPaths: (resources: ProjectResourceEntry[], relative?: boolean) => void;
  onShowInFileManager: (resource: ProjectResourceEntry) => void;
  onUnsupportedResource: (resource: ProjectResourceEntry) => void;
}) {
  if (node.kind === "directory") {
    const expanded = filtering || expandedDirectoryPaths.has(node.relativePath);
    const resource = nodeResourceFromDirectory(node);
    const selected = selectedResourcePaths.has(resource.path);
    return (
      <EditorTreeItem>
        <ProjectResourceContextMenu
          menu={{ kind: "file", resource }}
          rootName={rootName}
          projectBusy={projectBusy}
          selectedResources={selectedResources}
          resourceClipboard={resourceClipboard}
          onOpenProjectFile={onOpenProjectFile}
          onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
          onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
          onOpenProjectImageWindow={onOpenProjectImageWindow}
          onMove={onMoveResource}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onRename={onRenameResource}
          onDelete={onDeleteResources}
          onCopyResources={onCopyResources}
          onPasteResources={onPasteResources}
          onCopyPaths={onCopyPaths}
          onShowInFileManager={onShowInFileManager}
        >
          <EditorTreeRow
            data-tree-item-id={node.id}
            data-project-resource-path={resource.path}
            data-project-directory-path={node.relativePath}
            data-project-drop-target={dropTargetDirectoryPath === node.relativePath || undefined}
            aria-level={level}
            aria-expanded={expanded}
            aria-selected={selected || undefined}
            tabIndex={focusedItemId === node.id ? 0 : -1}
            active={selected}
            className={cn(dropTargetDirectoryPath === node.relativePath && "text-[hsl(var(--ui-tree-selected-foreground))] before:bg-[hsl(var(--ui-tree-selected-background))]")}
            title={node.path}
            onFocus={() => onFocusItem(node.id)}
            onKeyDown={(event) => {
              if (!openContextMenuFromKeyboard(event)) {
                onTreeKeyDown(event, { id: node.id, kind: "directory", expanded, relativePath: node.relativePath, parentPath, resource });
              }
            }}
            onClick={(event) => onSelectResource(resource, event)}
            onDoubleClick={() => onDoubleClickResource(resource, undefined)}
            onContextMenu={() => onContextMenuResource(resource)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => handleExternalResourceDropFromRow(node.relativePath, event, onImportExternalResources)}
          >
            <Folder className={PROJECT_RESOURCE_ICON_CLASS_NAME} data-project-resource-icon="folder" />
            <span className="min-w-0 truncate" data-project-resource-name>{node.name}</span>
          </EditorTreeRow>
        </ProjectResourceContextMenu>
        {expanded ? (
          <EditorTreeGroup>
            {node.children.map((child) => (
              <ProjectTreeNodeRow
                key={child.id}
                node={child}
                level={level + 1}
                parentPath={node.relativePath}
                expandedDirectoryPaths={expandedDirectoryPaths}
                filtering={filtering}
                focusedItemId={focusedItemId}
                selectedResourcePaths={selectedResourcePaths}
                selectedResources={selectedResources}
                resourceClipboard={resourceClipboard}
                resourceStatuses={resourceStatuses}
                currentFileRef={currentFileRef}
                activeRowRef={activeRowRef}
                onFocusItem={onFocusItem}
                onTreeKeyDown={onTreeKeyDown}
                onToggleDirectory={onToggleDirectory}
                onSelectResource={onSelectResource}
                onContextMenuResource={onContextMenuResource}
                onDoubleClickResource={onDoubleClickResource}
                onOpenProjectFile={onOpenProjectFile}
                onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
                onOpenProjectImageWindow={onOpenProjectImageWindow}
                onProjectDocumentPointerDrag={onProjectDocumentPointerDrag}
                projectBusy={projectBusy}
                draggedResourcePath={draggedResourcePath}
                dropTargetDirectoryPath={dropTargetDirectoryPath}
                onStartFilePointerDrag={onStartFilePointerDrag}
                onMoveFilePointerDrag={onMoveFilePointerDrag}
                onFinishFilePointerDrag={onFinishFilePointerDrag}
                onCancelFilePointerDrag={onCancelFilePointerDrag}
                rootName={rootName}
                onMoveResource={onMoveResource}
                onCreateFile={onCreateFile}
                onCreateDirectory={onCreateDirectory}
                onRenameResource={onRenameResource}
                onDeleteResources={onDeleteResources}
                onCopyResources={onCopyResources}
                onPasteResources={onPasteResources}
                onImportExternalResources={onImportExternalResources}
                onCopyPaths={onCopyPaths}
                onShowInFileManager={onShowInFileManager}
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
      selected={selectedResourcePaths.has(node.resource.path)}
      selectedResources={selectedResources}
      resourceClipboard={resourceClipboard}
      status={resourceStatuses?.[node.resource.path]}
      currentFileRef={currentFileRef}
      activeRowRef={activeRowRef}
      onFocusItem={onFocusItem}
      onTreeKeyDown={onTreeKeyDown}
      onSelectResource={onSelectResource}
      onContextMenuResource={onContextMenuResource}
      onDoubleClickResource={onDoubleClickResource}
      onOpenProjectFile={onOpenProjectFile}
      onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
      onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
      onOpenProjectImageWindow={onOpenProjectImageWindow}
      projectBusy={projectBusy}
      dragging={draggedResourcePath === node.resource.path}
      onStartFilePointerDrag={onStartFilePointerDrag}
      onMoveFilePointerDrag={onMoveFilePointerDrag}
      onFinishFilePointerDrag={onFinishFilePointerDrag}
      onCancelFilePointerDrag={onCancelFilePointerDrag}
      rootName={rootName}
      onMoveResource={onMoveResource}
      onCreateFile={onCreateFile}
      onCreateDirectory={onCreateDirectory}
      onRenameResource={onRenameResource}
      onDeleteResources={onDeleteResources}
      onCopyResources={onCopyResources}
      onPasteResources={onPasteResources}
      onCopyPaths={onCopyPaths}
      onShowInFileManager={onShowInFileManager}
      onUnsupportedResource={onUnsupportedResource}
    />
  );
}

function ProjectFileRow({
  node,
  level,
  parentPath,
  focused,
  selected,
  selectedResources,
  resourceClipboard,
  status,
  currentFileRef,
  activeRowRef,
  onFocusItem,
  onTreeKeyDown,
  onSelectResource,
  onContextMenuResource,
  onDoubleClickResource,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onOpenProjectHtmlWindow,
  onOpenProjectImageWindow,
  projectBusy,
  dragging,
  onStartFilePointerDrag,
  onMoveFilePointerDrag,
  onFinishFilePointerDrag,
  onCancelFilePointerDrag,
  rootName,
  onMoveResource,
  onCreateFile,
  onCreateDirectory,
  onRenameResource,
  onDeleteResources,
  onCopyResources,
  onPasteResources,
  onCopyPaths,
  onShowInFileManager,
  onUnsupportedResource: _onUnsupportedResource
}: {
  node: Extract<ProjectTreeNode, { kind: "file" }>;
  level: number;
  parentPath: string;
  focused: boolean;
  selected: boolean;
  selectedResources: ProjectResourceEntry[];
  resourceClipboard: ProjectResourceEntry[];
  status?: ExplorerResourceStatus;
  currentFileRef: RuntimeFileRef | null;
  activeRowRef: { current: HTMLButtonElement | null };
  onFocusItem: (id: string) => void;
  onTreeKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, item: { id: string; kind: "root" | "directory" | "file"; parentPath?: string; resource?: ProjectResourceEntry; file?: ProjectFileEntry }) => void;
  onSelectResource: (resource: ProjectResourceEntry, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onContextMenuResource: (resource: ProjectResourceEntry) => void;
  onDoubleClickResource: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenProjectHtmlWindow: (file: ProjectFileEntry) => void;
  onOpenProjectImageWindow: (file: ProjectFileEntry) => void;
  projectBusy: boolean;
  dragging: boolean;
  onStartFilePointerDrag: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinishFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => boolean;
  onCancelFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  rootName: string;
  onMoveResource: (resource: ProjectResourceEntry) => void;
  onCreateFile: (directoryPath: string) => void;
  onCreateDirectory: (directoryPath: string) => void;
  onRenameResource: (resource: ProjectResourceEntry) => void;
  onDeleteResources: (resources: ProjectResourceEntry[]) => void;
  onCopyResources: (resources: ProjectResourceEntry[]) => void;
  onPasteResources: (directoryPath: string) => void;
  onCopyPaths: (resources: ProjectResourceEntry[], relative?: boolean) => void;
  onShowInFileManager: (resource: ProjectResourceEntry) => void;
  onUnsupportedResource: (resource: ProjectResourceEntry) => void;
}) {
  const htmlFile = isHtmlDocumentFilePath(node.resource.path);
  const imageFile = isSupportedImagePath(node.resource.path);
  const file = node.file ?? (node.resource.documentKind || htmlFile || imageFile ? resourceProjectFile(node.resource) : undefined);
  const active = file ? isProjectFileActive(file, currentFileRef) : false;
  const suppressClickRef = useRef(false);

  return (
    <EditorTreeItem>
      <ProjectResourceContextMenu
        menu={{ kind: "file", resource: node.resource, file }}
        rootName={rootName}
        projectBusy={projectBusy}
        selectedResources={selectedResources}
        resourceClipboard={resourceClipboard}
        onOpenProjectFile={onOpenProjectFile}
        onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
        onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
        onOpenProjectImageWindow={onOpenProjectImageWindow}
        onMove={onMoveResource}
        onCreateFile={onCreateFile}
        onCreateDirectory={onCreateDirectory}
        onRename={onRenameResource}
        onDelete={onDeleteResources}
        onCopyResources={onCopyResources}
        onPasteResources={onPasteResources}
        onCopyPaths={onCopyPaths}
        onShowInFileManager={onShowInFileManager}
      >
        <EditorTreeRow
          ref={(element) => { if (active) activeRowRef.current = element; }}
          active={active || selected}
          data-tree-item-id={node.id}
          data-project-resource-path={node.resource.path}
          data-resource-supported={Boolean(file)}
          data-project-resource-dragging={dragging || undefined}
          aria-level={level}
          aria-selected={active || selected}
          tabIndex={focused ? 0 : -1}
          className={cn(!projectBusy && "cursor-grab active:cursor-grabbing", dragging && "opacity-60", !file && "text-muted-foreground")}
          title={file ? node.resource.path : `${node.resource.path}\n当前文件类型暂不支持打开`}
          onFocus={() => onFocusItem(node.id)}
          onKeyDown={(event) => {
            if (!openContextMenuFromKeyboard(event)) {
              onTreeKeyDown(event, { id: node.id, kind: "file", parentPath, resource: node.resource, file });
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
            onSelectResource(node.resource, event);
          }}
          onDoubleClick={() => onDoubleClickResource(node.resource, file)}
          onContextMenu={() => onContextMenuResource(node.resource)}
        >
          <ProjectResourceIcon resource={node.resource} />
          <span className="min-w-0 truncate" data-project-resource-name>{node.name}</span>
          <ProjectResourceStatusBadge status={status || (!file ? "unsupported" : undefined)} />
        </EditorTreeRow>
      </ProjectResourceContextMenu>
    </EditorTreeItem>
  );
}

function ProjectResourceIcon({ resource }: { resource: ProjectResourceEntry }) {
  const className = PROJECT_RESOURCE_ICON_CLASS_NAME;
  const extension = projectResourceExtension(resource);
  if (resource.documentKind === "mermaid") return <Network className={className} data-project-resource-icon="mermaid" />;
  if (resource.documentKind === "markdown") return <Notes className={className} data-project-resource-icon="markdown" />;
  if (isCsvTableFilePath(resource.path)) return <TableRows className={className} data-project-resource-icon="csv" />;
  if (isHtmlDocumentFilePath(resource.path)) return <Html5 className={className} data-project-resource-icon="html" />;
  if (extension === "png") return <PngFormat className={className} data-project-resource-icon="png" />;
  if (extension === "jpg" || extension === "jpeg") return <JpgFormat className={className} data-project-resource-icon="jpg" />;
  if (extension === "svg") return <SvgFormat className={className} data-project-resource-icon="svg" />;
  if (extension === "webp") return <WebpFormat className={className} data-project-resource-icon="webp" />;
  if (isSupportedImagePath(resource.path)) return <MediaImage className={className} data-project-resource-icon="image" />;
  if (ARCHIVE_FILE_EXTENSIONS.has(extension)) return <Archive className={className} data-project-resource-icon="archive" />;
  if (CODE_FILE_EXTENSIONS.has(extension)) return <Code className={className} data-project-resource-icon="code" />;
  if (TEXT_FILE_EXTENSIONS.has(extension)) return <Page className={className} data-project-resource-icon="text" />;
  return <EmptyPage className={className} data-project-resource-icon="file" />;
}

function projectResourceExtension(resource: ProjectResourceEntry) {
  return resource.name.toLowerCase().split(".").at(-1) || "";
}

function openContextMenuFromKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return false;
  event.preventDefault();
  const trigger = event.currentTarget;
  const bounds = trigger.getBoundingClientRect();
  trigger.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: bounds.left + 20,
    clientY: bounds.top + bounds.height / 2
  }));
  return true;
}

function visibleTreeItems(root: HTMLDivElement | null) {
  return root ? [...root.querySelectorAll<HTMLButtonElement>('[role="treeitem"]')] : [];
}

function visibleResourceRows(root: HTMLDivElement | null) {
  return root ? [...root.querySelectorAll<HTMLButtonElement>('[data-project-resource-path]')] : [];
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

function nodeResourceFromDirectory(node: Extract<ProjectTreeNode, { kind: "directory" }>): ProjectResourceEntry {
  return {
    kind: "directory",
    name: node.name,
    path: node.path,
    relativePath: node.relativePath
  };
}

function ProjectResourceStatusBadge({ status }: { status?: ExplorerResourceStatus }) {
  if (!status || status === "clean") return null;
  const meta = explorerResourceStatusMeta(status);
  return (
    <span className="ml-auto shrink-0 rounded-sm px-1 text-[10px] text-muted-foreground" title={meta.label} aria-label={meta.label}>
      {meta.mark}
    </span>
  );
}

function explorerResourceStatusMeta(status: ExplorerResourceStatus) {
  if (status === "dirty") return { mark: "M", label: "未保存" };
  if (status === "saving") return { mark: "S", label: "保存中" };
  if (status === "conflict") return { mark: "!", label: "保存冲突" };
  if (status === "error") return { mark: "!", label: "错误" };
  if (status === "external-changed") return { mark: "*", label: "外部已变更" };
  if (status === "missing") return { mark: "?", label: "文件缺失" };
  if (status === "readonly") return { mark: "R", label: "只读" };
  return { mark: "-", label: "当前类型暂不支持打开" };
}

function projectDocumentNodeKind(resource: ProjectResourceEntry): "markdown" | "html" | undefined {
  if (resource.documentKind === "markdown") return "markdown";
  if (isHtmlDocumentFilePath(resource.path)) return "html";
  return undefined;
}

function samePaths(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((path) => rightSet.has(path));
}

function samePathSet(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size !== right.size) return false;
  for (const path of left) if (!right.has(path)) return false;
  return true;
}

function parentResourceDirectory(relativePath: string) {
  const segments = relativePath.replaceAll("\\", "/").split("/");
  segments.pop();
  return segments.join("/");
}

function filterProjectTree(nodes: ProjectTreeNode[], query: string): ProjectTreeNode[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return nodes;
  return nodes.flatMap((node) => filterProjectTreeNode(node, tokens));
}

function filterProjectTreeNode(node: ProjectTreeNode, tokens: string[]): ProjectTreeNode[] {
  const haystack = `${node.name}\n${node.relativePath}`.toLowerCase();
  const matched = tokens.every((token) => haystack.includes(token));
  if (node.kind === "file") return matched ? [node] : [];
  const children = node.children.flatMap((child) => filterProjectTreeNode(child, tokens));
  if (matched) return [node];
  return children.length ? [{ ...node, children }] : [];
}

function explorerDirectoryDropTargetAtPoint(root: HTMLDivElement | null, x: number, y: number): ExplorerDirectoryDropTarget | null {
  if (!root || typeof document === "undefined" || typeof document.elementFromPoint !== "function") return null;
  const element = document.elementFromPoint(x, y);
  const row = element?.closest<HTMLElement>("[data-project-directory-path]");
  if (!row || !root.contains(row)) return null;
  const directoryPath = row.dataset.projectDirectoryPath;
  return typeof directoryPath === "string" ? { directoryPath } : null;
}

function handleExternalResourceDropFromRow(
  directoryPath: string,
  event: ReactDragEvent<HTMLElement>,
  onImportExternalResources: (externalPaths: string[], directoryPath: string) => void
) {
  const paths = droppedFilePaths(event);
  if (!paths.length) return;
  event.preventDefault();
  event.stopPropagation();
  onImportExternalResources(paths, directoryPath);
}

function droppedFilePaths(event: ReactDragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.files || [])
    .map((file) => (file as File & { path?: string }).path || "")
    .filter(Boolean);
}
