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
import { Flip } from "gsap/Flip";
import {
  Collapse,
  Expand,
  Folder,
  FolderPlus,
  InputSearch,
  Plus,
  Refresh as RefreshCw
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  EditorEmptyState,
  EditorIconButton,
  EditorTree,
  EditorTreeGroup,
  EditorTreeItem,
  EditorTreeRow
} from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { RuntimeFileRef, RuntimeMarkdownExportResult, RuntimeProjectResourceKind, RuntimeProjectResourcePlacement } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import { isHtmlDocumentFilePath } from "@/features/mermaid-editor/lib/html-document";
import { isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";
import { isTextDocumentFilePath } from "@/features/mermaid-editor/lib/text-document";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import { projectDirectoryAncestors, validExpandedDirectoryPaths } from "@/features/mermaid-editor/lib/explorer-tree-state";
import {
  buildProjectResourceTree,
  isProjectFileActive,
  projectResourcesFromFiles,
  projectTreeDirectoryIds,
  sortProjectResources,
  type ProjectFileEntry,
  type ProjectResourceEntry,
  type ProjectTreeNode,
  type ProjectWorkspace
} from "@/features/mermaid-editor/lib/project-workspace";
import { cn } from "@/lib/utils";
import { ProjectResourceContextMenu } from "@/features/mermaid-editor/components/explorer-panel-context-menu";
import { ExplorerMarkdownExportProvider } from "@/features/mermaid-editor/components/explorer-markdown-export";
import {
  CreateProjectDirectoryDialog,
  CreateProjectFileDialog,
  DeleteProjectResourcesDialog,
  MoveProjectResourcesDialog
} from "@/features/mermaid-editor/components/explorer-panel-dialogs";
import { ProjectFileRow } from "@/features/mermaid-editor/components/explorer-panel-file-row";
import { ExplorerInlineRename } from "@/features/mermaid-editor/components/explorer-panel-inline-rename";
import {
  isDirectoryDropAllowed,
  orderedRelativePathsForDrop,
  parentResourceDirectory,
  resolveExplorerDropIntentAtPoint,
  sameExplorerDropIntent,
  type ExplorerDropIntent
} from "@/features/mermaid-editor/components/explorer-panel-drag";
import { ExplorerDragOverlay, ExplorerInsertionIndicator } from "@/features/mermaid-editor/components/explorer-panel-drag-overlay";
import {
  ProjectResourceIcon,
  type ExplorerResourceStatus
} from "@/features/mermaid-editor/components/explorer-resource-ui";
import { gsap, useEditorMotion } from "@/features/mermaid-editor/lib/use-gsap-motion";

const EMPTY_EXPANDED_DIRECTORY_PATHS: string[] = [];
const PROJECT_RESOURCE_ICON_CLASS_NAME = "shrink-0";

export type { ExplorerResourceStatus } from "@/features/mermaid-editor/components/explorer-resource-ui";

gsap.registerPlugin(Flip);

type ExplorerFilePointerDrag = {
  pointerId: number;
  resource: ProjectResourceEntry;
  resources: ProjectResourceEntry[];
  file?: ProjectFileEntry;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  sourceWidth: number;
  sourceHeight: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  dragging: boolean;
  documentCanvasKind?: ExplorerCanvasNodeKind;
};

type ExplorerDragOverlayState = {
  resource: ProjectResourceEntry;
  count: number;
  width: number;
  height: number;
};

export type ExplorerProjectFileKind = "markdown" | "mermaid" | "csv" | "html" | "text";
export type ExplorerCanvasNodeKind = "markdown" | "html" | "text" | "csv" | "image";

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
  onOpenProjectTextWindow = onOpenProjectFile,
  onOpenProjectCsvWindow = onOpenProjectFile,
  onCreateProjectFile,
  onCreateProjectDirectory,
  onRenameProjectResource,
  onMoveProjectFile: _onMoveProjectFile,
  onMoveProjectResources,
  onReorderProjectResources,
  onCopyProjectResources,
  onImportProjectResources,
  onDeleteProjectResources,
  onShowProjectResourceInFileManager,
  onProjectDocumentPointerDrag,
  onExportProjectMarkdown,
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
  onOpenProjectTextWindow?: (file: ProjectFileEntry) => void;
  onOpenProjectCsvWindow?: (file: ProjectFileEntry) => void;
  onCreateProjectFile: (request: ExplorerCreateProjectFileRequest) => void;
  onCreateProjectDirectory: (request: ExplorerCreateProjectDirectoryRequest) => void;
  onRenameProjectResource: (resource: ProjectResourceEntry, name: string) => void;
  onMoveProjectFile: (file: ProjectResourceEntry, targetDirectoryPath: string) => void;
  onMoveProjectResources: (resources: ProjectResourceEntry[], targetDirectoryPath: string, placement?: RuntimeProjectResourcePlacement) => void;
  onReorderProjectResources: (parentDirectoryPath: string, kind: RuntimeProjectResourceKind, orderedRelativePaths: string[]) => void;
  onCopyProjectResources: (resources: ProjectResourceEntry[], targetDirectoryPath: string) => void;
  onImportProjectResources: (externalPaths: string[], targetDirectoryPath: string) => void;
  onDeleteProjectResources: (resources: ProjectResourceEntry[]) => void;
  onShowProjectResourceInFileManager: (resource: ProjectResourceEntry) => void;
  onProjectDocumentPointerDrag: (file: ProjectFileEntry, kind: ExplorerCanvasNodeKind, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  onExportProjectMarkdown?: (file: ProjectFileEntry) => Promise<RuntimeMarkdownExportResult>;
  onStatus: (message: string) => void;
}) {
  const motion = useEditorMotion();
  const resources = useMemo(
    () => sortProjectResources(projectWorkspace?.resources ?? projectResourcesFromFiles(projectFiles), projectWorkspace?.resourceOrder),
    [projectFiles, projectWorkspace?.resourceOrder, projectWorkspace?.resources]
  );
  const tree = useMemo(() => buildProjectResourceTree(resources, projectFiles, projectWorkspace?.resourceOrder), [projectFiles, projectWorkspace?.resourceOrder, resources]);
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
  const [renamingResourcePath, setRenamingResourcePath] = useState<string | null>(null);
  const [selectedResourcePaths, setSelectedResourcePaths] = useState<Set<string>>(() => new Set());
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null);
  const [resourceClipboard, setResourceClipboard] = useState<ProjectResourceEntry[]>([]);
  const [draggedResourcePath, setDraggedResourcePath] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<ExplorerDropIntent | null>(null);
  const [dragOverlay, setDragOverlay] = useState<ExplorerDragOverlayState | null>(null);
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
  const dropIntentRef = useRef<ExplorerDropIntent | null>(null);
  const dragOverlayRef = useRef<HTMLDivElement | null>(null);
  const layoutAnimationFrameRef = useRef<number | null>(null);
  const layoutAnimationVersionRef = useRef(0);
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
    setRenamingResourcePath((current) => current && !resourcesByPath.has(current) ? null : current);
  }, [resourcesByPath]);

  useEffect(() => () => {
    if (pendingRenameClickRef.current) window.clearTimeout(pendingRenameClickRef.current);
    layoutAnimationVersionRef.current += 1;
    if (layoutAnimationFrameRef.current !== null) window.cancelAnimationFrame(layoutAnimationFrameRef.current);
    clearExplorerRowLayoutTransforms(explorerRowLayoutTargets(treeRef.current));
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
    dropIntentRef.current = null;
    setDropIntent(null);
    setDragOverlay(null);
    if (drag?.documentCanvasKind && drag.file) {
      onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: drag.lastX, y: drag.lastY }, "cancel");
    }
  }, [onProjectDocumentPointerDrag, projectBusy]);

  useEffect(() => {
    const element = dragOverlayRef.current;
    if (!element || !dragOverlay) return;
    try {
      const drag = filePointerDragRef.current;
      if (drag) {
        const point = dragOverlayPoint(drag.lastX, drag.lastY, drag);
        gsap.set(element, { x: point.x, y: point.y });
      }
      if (!motion.reduced) {
        gsap.fromTo(element, { scale: 0.98, autoAlpha: 0.92 }, { scale: 1, autoAlpha: 1, duration: 0.1, ease: "power2.out" });
      }
    } catch {
      // Drag preview positioning is decorative; the resource drop contract still owns behavior.
    }
    return () => {
      gsap.killTweensOf(element);
    };
  }, [dragOverlay, motion.reduced]);

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

  function startInlineRename(resource: ProjectResourceEntry) {
    if (projectBusy) return;
    setRenamingResourcePath(resource.path);
  }

  function commitInlineRename(resource: ProjectResourceEntry, name: string) {
    setRenamingResourcePath(null);
    onRenameProjectResource(resource, name);
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

  function handleResourceClick(resource: ProjectResourceEntry, event: ReactMouseEvent<HTMLButtonElement>, nameClickOverride?: boolean) {
    if (renamingResourcePath === resource.path) return;
    const selected = selectedResourcePaths.has(resource.path);
    const nameClick = nameClickOverride ?? isResourceNameEventTarget(event.target);
    focusAndSelectResource(resource, event);
    if (selected && nameClick && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      if (pendingRenameClickRef.current) window.clearTimeout(pendingRenameClickRef.current);
      pendingRenameClickRef.current = window.setTimeout(() => {
        startInlineRename(resource);
        pendingRenameClickRef.current = null;
      }, 260);
    }
  }

  function handleResourceDoubleClick(resource: ProjectResourceEntry, file: ProjectFileEntry | undefined) {
    if (renamingResourcePath === resource.path) return;
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
    const textFile = isTextDocumentFilePath(resource.path);
    const csvFile = isCsvTableFilePath(resource.path);
    if (file && imageFile) onOpenProjectImageWindow(file);
    else if (file && htmlFile) onOpenProjectHtmlWindow(file);
    else if (file && (textFile || csvFile)) onOpenProjectFile(file);
    else if (file) onOpenProjectFile(file);
    else onStatus(`暂不支持打开 ${resource.name}。`);
  }

  function openProjectAuxiliaryWindow(file: ProjectFileEntry) {
    if (isTextDocumentFilePath(file.path)) onOpenProjectTextWindow(file);
    else if (isCsvTableFilePath(file.path)) onOpenProjectCsvWindow(file);
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
    if (projectBusy || event.button !== 0 || renamingResourcePath === resource.path) return;
    const sourceRect = event.currentTarget.getBoundingClientRect();
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
      sourceWidth: sourceRect.width,
      sourceHeight: sourceRect.height,
      pointerOffsetX: event.clientX - sourceRect.left,
      pointerOffsetY: event.clientY - sourceRect.top,
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
      animateExplorerRowLayout();
      setDraggedResourcePath(drag.resource.path);
      setDragOverlay({ resource: drag.resource, count: drag.resources.length, width: drag.sourceWidth, height: drag.sourceHeight });
      updateDragOverlayPosition(event.clientX, event.clientY);
    }
    event.preventDefault();
    updateDragOverlayPosition(event.clientX, event.clientY);

    const intent = dropIntentAtPoint(drag, event.clientX, event.clientY);
    if (intent) {
      updateDropIntent(intent);
      if (drag.documentCanvasKind && drag.file) {
        onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
        drag.documentCanvasKind = undefined;
      }
      return;
    }

    if (explorerInsertionAtPoint(treeRef.current, event.clientX, event.clientY)) {
      return;
    }

    updateDropIntent(null);
    if (explorerRowAtPoint(treeRef.current, event.clientX, event.clientY)) {
      if (drag.documentCanvasKind && drag.file) {
        onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
        drag.documentCanvasKind = undefined;
      }
      return;
    }
    const documentKind = projectCanvasNodeKind(drag.resource);
    if (drag.resources.length === 1 && drag.file && documentKind) {
      onProjectDocumentPointerDrag(drag.file, documentKind, { x: event.clientX, y: event.clientY }, "move");
      drag.documentCanvasKind = documentKind;
    }
  }

  function finishFilePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = filePointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    const intent = drag.dragging
      ? dropIntentAtPoint(drag, event.clientX, event.clientY) ??
        (explorerInsertionAtPoint(treeRef.current, event.clientX, event.clientY) ? dropIntentRef.current : null)
      : null;
    const rowAtPoint = drag.dragging ? explorerRowAtPoint(treeRef.current, event.clientX, event.clientY) : null;
    filePointerDragRef.current = null;
    setDraggedResourcePath(null);
    updateDropIntent(null);
    setDragOverlay(null);
    if (!drag.dragging) return false;
    event.preventDefault();

    if (intent) {
      if (drag.documentCanvasKind && drag.file) {
        onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
      }
      commitResourceDrop(drag, intent);
      return true;
    }

    if (rowAtPoint) {
      if (drag.documentCanvasKind && drag.file) {
        onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
      }
      return true;
    }

    const documentKind = projectCanvasNodeKind(drag.resource);
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
    updateDropIntent(null);
    setDragOverlay(null);
    if (drag.documentCanvasKind && drag.file) {
      onProjectDocumentPointerDrag(drag.file, drag.documentCanvasKind, { x: event.clientX, y: event.clientY }, "cancel");
    }
  }

  function dropIntentAtPoint(drag: ExplorerFilePointerDrag, x: number, y: number) {
    const intent = resolveExplorerDropIntentAtPoint(treeRef.current, x, y, {
      sortingEnabled: !filtering,
      draggedKind: drag.resource.kind
    });
    if (!intent) return null;
    if (intent.kind === "directory") {
      return isDirectoryDropAllowed(resources, drag.resources, intent.directoryPath) ? intent : null;
    }
    if (drag.resource.kind !== intent.resourceKind) return null;
    const sameGroup = drag.resources.every((resource) =>
      resource.kind === intent.resourceKind &&
      parentResourceDirectory(resource.relativePath) === intent.parentDirectoryPath
    );
    if (sameGroup) return intent;
    return isDirectoryDropAllowed(resources, drag.resources, intent.parentDirectoryPath) ? intent : null;
  }

  function commitResourceDrop(drag: ExplorerFilePointerDrag, intent: ExplorerDropIntent) {
    if (projectBusy) return;
    if (intent.kind === "directory") {
      onMoveProjectResources(drag.resources, intent.directoryPath);
      return;
    }

    const sameGroup = drag.resources.every((resource) =>
      resource.kind === intent.resourceKind &&
      parentResourceDirectory(resource.relativePath) === intent.parentDirectoryPath
    );
    if (sameGroup) {
      const nextOrder = orderedRelativePathsForDrop(resources, drag.resources, intent);
      if (nextOrder) onReorderProjectResources(intent.parentDirectoryPath, intent.resourceKind, nextOrder);
      return;
    }

    onMoveProjectResources(drag.resources, intent.parentDirectoryPath, {
      kind: intent.resourceKind,
      parentDirectoryPath: intent.parentDirectoryPath,
      beforeRelativePath: intent.beforeRelativePath
    });
  }

  function updateDragOverlayPosition(x: number, y: number) {
    const element = dragOverlayRef.current;
    if (!element) return;
    const point = dragOverlayPoint(x, y, filePointerDragRef.current);
    const nextX = point.x;
    const nextY = point.y;
    try {
      gsap.set(element, { x: nextX, y: nextY });
    } catch {
      element.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    }
  }

  function updateDropIntent(nextIntent: ExplorerDropIntent | null) {
    dropIntentRef.current = nextIntent;
    setDropIntent((current) => {
      if (sameExplorerDropIntent(current, nextIntent)) return current;
      animateExplorerRowLayout();
      return nextIntent;
    });
  }

  function animateExplorerRowLayout() {
    const root = treeRef.current;
    if (!root) return;
    const targets = explorerRowLayoutTargets(root);
    if (!targets.length) return;
    const version = layoutAnimationVersionRef.current + 1;
    layoutAnimationVersionRef.current = version;
    if (layoutAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutAnimationFrameRef.current);
      layoutAnimationFrameRef.current = null;
    }
    try {
      gsap.killTweensOf(targets);
      if (motion.reduced || motion.duration.layout <= 0) {
        clearExplorerRowLayoutTransforms(targets);
        return;
      }
      const state = Flip.getState(targets);
      layoutAnimationFrameRef.current = window.requestAnimationFrame(() => {
        layoutAnimationFrameRef.current = null;
        if (layoutAnimationVersionRef.current !== version) return;
        const nextTargets = explorerRowLayoutTargets(root);
        try {
          Flip.from(state, {
            duration: Math.min(0.18, motion.duration.layout),
            ease: "power2.out",
            absolute: false,
            overwrite: true,
            onComplete: () => {
              if (layoutAnimationVersionRef.current !== version) return;
              clearExplorerRowLayoutTransforms(nextTargets);
            }
          });
        } catch {
          // Layout animation is decorative; pointer drop behavior must remain deterministic.
          clearExplorerRowLayoutTransforms(nextTargets);
        }
      });
    } catch {
      // GSAP Flip can be unavailable in test-like DOMs.
      clearExplorerRowLayoutTransforms(targets);
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
      if (targets.length === 1) startInlineRename(targets[0]);
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
    <ExplorerMarkdownExportProvider onExport={onExportProjectMarkdown} onStatus={onStatus}>
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
	                onRename={startInlineRename}
	                onDelete={requestDeleteResources}
	                onCopyResources={copyResourcesToClipboard}
	                onPasteResources={pasteResources}
	                onCopyPaths={copyResourcePaths}
	                onShowInFileManager={onShowProjectResourceInFileManager}
	              >
	                <EditorTreeRow
                  data-tree-item-id={rootItemId}
                  data-project-directory-path=""
                  data-project-drop-target={dropIntent?.kind === "directory" && dropIntent.directoryPath === "" || undefined}
                  aria-level={1}
	                  aria-expanded={filtering || rootExpanded}
	                  tabIndex={focusedItemId === rootItemId ? 0 : -1}
                  className={cn(dropIntent?.kind === "directory" && dropIntent.directoryPath === "" && "text-[hsl(var(--ui-tree-selected-foreground))] before:bg-[hsl(var(--ui-tree-selected-background))]")}
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
	                  {filteredTree.length ? filteredTree.map((node, index, siblings) => (
	                    <ProjectTreeNodeRow
                      key={node.id}
                      node={node}
                      siblings={siblings}
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
                      onOpenProjectAuxiliaryWindow={openProjectAuxiliaryWindow}
                      onProjectDocumentPointerDrag={onProjectDocumentPointerDrag}
                      projectBusy={projectBusy}
                      draggedResourcePath={draggedResourcePath}
                      dropIntent={dropIntent}
                      renamingResourcePath={renamingResourcePath}
                      onStartFilePointerDrag={startFilePointerDrag}
                      onMoveFilePointerDrag={moveFilePointerDrag}
                      onFinishFilePointerDrag={finishFilePointerDrag}
                      onCancelFilePointerDrag={cancelFilePointerDrag}
                      rootName={projectWorkspace.rootName}
	                      onMoveResource={moveResource}
	                      onCreateFile={createFileInDirectory}
	                      onCreateDirectory={createDirectoryInDirectory}
	                      onRenameResource={startInlineRename}
                      onCommitRename={commitInlineRename}
                      onCancelRename={() => setRenamingResourcePath(null)}
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
          {dragOverlay ? (
            <ExplorerDragOverlay
              ref={dragOverlayRef}
              icon={<ProjectResourceIcon resource={dragOverlay.resource} />}
              label={dragOverlay.resource.name}
              count={dragOverlay.count}
              width={dragOverlay.width}
              height={dragOverlay.height}
            />
          ) : null}
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
      {projectWorkspace ? (
        <div className="editor-ui-panel-footer flex shrink-0 items-center">
          <InputGroup>
            <InputGroupAddon><InputSearch aria-hidden data-icon /></InputGroupAddon>
            <InputGroupInput
              ref={filterInputRef}
              value={filterQuery}
              placeholder="搜索文件"
              aria-label="搜索资源"
              onChange={(event) => setFilterQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                setFilterQuery("");
                treeRef.current?.querySelector<HTMLButtonElement>('[role="treeitem"]')?.focus();
              }}
            />
          </InputGroup>
        </div>
      ) : null}
      </aside>
    </ExplorerMarkdownExportProvider>
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
  siblings,
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
  onOpenProjectAuxiliaryWindow,
  onProjectDocumentPointerDrag,
  projectBusy,
  draggedResourcePath,
  dropIntent,
  renamingResourcePath,
  onStartFilePointerDrag,
  onMoveFilePointerDrag,
  onFinishFilePointerDrag,
  onCancelFilePointerDrag,
  rootName,
  onMoveResource,
  onCreateFile,
  onCreateDirectory,
  onRenameResource,
  onCommitRename,
  onCancelRename,
  onDeleteResources,
  onCopyResources,
  onPasteResources,
  onImportExternalResources,
  onCopyPaths,
  onShowInFileManager,
  onUnsupportedResource
}: {
  node: ProjectTreeNode;
  siblings: ProjectTreeNode[];
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
  onSelectResource: (resource: ProjectResourceEntry, event: ReactMouseEvent<HTMLButtonElement>, nameClick?: boolean) => void;
  onContextMenuResource: (resource: ProjectResourceEntry) => void;
  onDoubleClickResource: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenProjectHtmlWindow: (file: ProjectFileEntry) => void;
  onOpenProjectImageWindow: (file: ProjectFileEntry) => void;
  onOpenProjectAuxiliaryWindow: (file: ProjectFileEntry) => void;
  onProjectDocumentPointerDrag: (file: ProjectFileEntry, kind: ExplorerCanvasNodeKind, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  projectBusy: boolean;
  draggedResourcePath: string | null;
  dropIntent: ExplorerDropIntent | null;
  renamingResourcePath: string | null;
  onStartFilePointerDrag: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinishFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => boolean;
  onCancelFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  rootName: string;
  onMoveResource: (resource: ProjectResourceEntry) => void;
  onCreateFile: (directoryPath: string) => void;
  onCreateDirectory: (directoryPath: string) => void;
  onRenameResource: (resource: ProjectResourceEntry) => void;
  onCommitRename: (resource: ProjectResourceEntry, name: string) => void;
  onCancelRename: () => void;
  onDeleteResources: (resources: ProjectResourceEntry[]) => void;
  onCopyResources: (resources: ProjectResourceEntry[]) => void;
  onPasteResources: (directoryPath: string) => void;
  onImportExternalResources: (externalPaths: string[], directoryPath: string) => void;
  onCopyPaths: (resources: ProjectResourceEntry[], relative?: boolean) => void;
  onShowInFileManager: (resource: ProjectResourceEntry) => void;
  onUnsupportedResource: (resource: ProjectResourceEntry) => void;
}) {
  const suppressClickRef = useRef(false);
  const pointerDownNameRef = useRef(false);
  const showInsertionBefore = shouldShowInsertionBefore(dropIntent, node, parentPath);
  const showInsertionAfter = shouldShowAppendInsertionAfter(dropIntent, node, siblings, parentPath);
  const visualLast = isVisualLastTreeNode(node, siblings, draggedResourcePath);

  if (node.kind === "directory") {
    const expanded = filtering || expandedDirectoryPaths.has(node.relativePath);
    const resource = nodeResourceFromDirectory(node);
    const selected = selectedResourcePaths.has(resource.path);
    const dragging = draggedResourcePath === resource.path;
    const renaming = renamingResourcePath === resource.path;
    const directoryDropTarget = dropIntent?.kind === "directory" && dropIntent.directoryPath === node.relativePath;
    const row = (
      <EditorTreeRow
        data-tree-item-id={node.id}
        data-project-resource-path={resource.path}
        data-project-resource-relative-path={resource.relativePath}
        data-project-resource-kind="directory"
        data-project-resource-parent-path={parentPath}
        data-project-directory-path={node.relativePath}
        data-project-drop-target={directoryDropTarget || undefined}
        data-project-resource-dragging={dragging || undefined}
        aria-level={level}
        aria-expanded={expanded}
        aria-selected={selected || undefined}
        tabIndex={focusedItemId === node.id ? 0 : -1}
        active={selected}
        className={cn(
          dragging && "pointer-events-none absolute inset-x-0 top-0 cursor-grabbing opacity-0",
          directoryDropTarget && "text-[hsl(var(--ui-tree-selected-foreground))] before:bg-[hsl(var(--ui-tree-selected-background))]"
        )}
        title={node.path}
        onFocus={() => onFocusItem(node.id)}
        onKeyDown={(event) => {
          if (renaming) return;
          if (!openContextMenuFromKeyboard(event)) {
            onTreeKeyDown(event, { id: node.id, kind: "directory", expanded, relativePath: node.relativePath, parentPath, resource });
          }
        }}
        onPointerDown={renaming ? undefined : (event) => {
          pointerDownNameRef.current = isResourceNameEventTarget(event.target);
          onStartFilePointerDrag(resource, undefined, event);
        }}
        onPointerMove={renaming ? undefined : onMoveFilePointerDrag}
        onPointerUp={renaming ? undefined : (event) => {
          if (onFinishFilePointerDrag(event)) suppressClickRef.current = true;
        }}
        onPointerCancel={renaming ? undefined : (event) => {
          pointerDownNameRef.current = false;
          onCancelFilePointerDrag(event);
        }}
        onLostPointerCapture={renaming ? undefined : onCancelFilePointerDrag}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            pointerDownNameRef.current = false;
            event.preventDefault();
            return;
          }
          const nameClick = pointerDownNameRef.current || isResourceNameEventTarget(event.target);
          pointerDownNameRef.current = false;
          if (!renaming) onSelectResource(resource, event, nameClick);
        }}
        onDoubleClick={() => { if (!renaming) onDoubleClickResource(resource, undefined); }}
        onContextMenu={(mouseEvent) => {
          if (renaming) {
            mouseEvent.preventDefault();
            return;
          }
          onContextMenuResource(resource);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => handleExternalResourceDropFromRow(node.relativePath, event, onImportExternalResources)}
      >
        <Folder className={PROJECT_RESOURCE_ICON_CLASS_NAME} data-project-resource-icon="folder" />
        {renaming ? (
          <ExplorerInlineRename
            resource={resource}
            projectBusy={projectBusy}
            onCancel={onCancelRename}
            onCommit={(name) => onCommitRename(resource, name)}
          />
        ) : (
          <span className="min-w-0 truncate" data-project-resource-name>{node.name}</span>
        )}
      </EditorTreeRow>
    );

    return (
      <>
      <ExplorerInsertionIndicator active={showInsertionBefore} />
      <EditorTreeItem visualLast={visualLast} connectorHidden={dragging}>
        {renaming ? row : (
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
          {row}
        </ProjectResourceContextMenu>
        )}
        {expanded && !dragging ? (
          <EditorTreeGroup>
            {node.children.map((child, _index, childSiblings) => (
              <ProjectTreeNodeRow
                key={child.id}
                node={child}
                siblings={childSiblings}
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
                onOpenProjectAuxiliaryWindow={onOpenProjectAuxiliaryWindow}
                onProjectDocumentPointerDrag={onProjectDocumentPointerDrag}
                projectBusy={projectBusy}
                draggedResourcePath={draggedResourcePath}
                dropIntent={dropIntent}
                renamingResourcePath={renamingResourcePath}
                onStartFilePointerDrag={onStartFilePointerDrag}
                onMoveFilePointerDrag={onMoveFilePointerDrag}
                onFinishFilePointerDrag={onFinishFilePointerDrag}
                onCancelFilePointerDrag={onCancelFilePointerDrag}
                rootName={rootName}
                onMoveResource={onMoveResource}
                onCreateFile={onCreateFile}
                onCreateDirectory={onCreateDirectory}
                onRenameResource={onRenameResource}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
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
      <ExplorerInsertionIndicator active={showInsertionAfter} />
      </>
    );
  }

  return (
    <>
    <ExplorerInsertionIndicator active={showInsertionBefore} />
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
      onOpenProjectAuxiliaryWindow={onOpenProjectAuxiliaryWindow}
      projectBusy={projectBusy}
      dragging={draggedResourcePath === node.resource.path}
      visualLast={visualLast}
      renaming={renamingResourcePath === node.resource.path}
      onStartFilePointerDrag={onStartFilePointerDrag}
      onMoveFilePointerDrag={onMoveFilePointerDrag}
      onFinishFilePointerDrag={onFinishFilePointerDrag}
      onCancelFilePointerDrag={onCancelFilePointerDrag}
      rootName={rootName}
      onMoveResource={onMoveResource}
      onCreateFile={onCreateFile}
      onCreateDirectory={onCreateDirectory}
      onRenameResource={onRenameResource}
      onCommitRename={onCommitRename}
      onCancelRename={onCancelRename}
      onDeleteResources={onDeleteResources}
      onCopyResources={onCopyResources}
      onPasteResources={onPasteResources}
      onCopyPaths={onCopyPaths}
      onShowInFileManager={onShowInFileManager}
    />
    <ExplorerInsertionIndicator active={showInsertionAfter} />
    </>
  );
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

function isResourceNameEventTarget(target: EventTarget | null) {
  return Boolean((target as HTMLElement | null)?.closest("[data-project-resource-name]"));
}

function visibleTreeItems(root: HTMLDivElement | null) {
  return root ? [...root.querySelectorAll<HTMLButtonElement>('[role="treeitem"]')] : [];
}

function visibleResourceRows(root: HTMLDivElement | null) {
  return root ? [...root.querySelectorAll<HTMLButtonElement>('[data-project-resource-path]')] : [];
}

function explorerRowLayoutTargets(root: HTMLDivElement | null) {
  return root ? [...root.querySelectorAll<HTMLElement>("[data-project-resource-path],[data-project-resource-insertion]")] : [];
}

function clearExplorerRowLayoutTransforms(targets: HTMLElement[]) {
  if (!targets.length) return;
  try {
    gsap.set(targets, { clearProps: "transform" });
  } catch {
    for (const target of targets) target.style.transform = "";
  }
}

function focusTreeItem(item: HTMLButtonElement | undefined, onFocusItem: (id: string) => void) {
  if (!item) return;
  const id = item.dataset.treeItemId;
  if (id) onFocusItem(id);
  item.focus();
}

function nodeResourceFromDirectory(node: Extract<ProjectTreeNode, { kind: "directory" }>): ProjectResourceEntry {
  return {
    kind: "directory",
    name: node.name,
    path: node.path,
    relativePath: node.relativePath
  };
}

function projectCanvasNodeKind(resource: ProjectResourceEntry): ExplorerCanvasNodeKind | undefined {
  if (resource.documentKind === "markdown") return "markdown";
  if (isHtmlDocumentFilePath(resource.path)) return "html";
  if (isTextDocumentFilePath(resource.path)) return "text";
  if (isCsvTableFilePath(resource.path)) return "csv";
  if (isSupportedImagePath(resource.path)) return "image";
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

function shouldShowInsertionBefore(dropIntent: ExplorerDropIntent | null, node: ProjectTreeNode, parentPath: string) {
  if (dropIntent?.kind !== "order" || dropIntent.beforeRelativePath !== node.relativePath) return false;
  return dropIntent.parentDirectoryPath === parentPath && dropIntent.resourceKind === node.kind;
}

function shouldShowAppendInsertionAfter(dropIntent: ExplorerDropIntent | null, node: ProjectTreeNode, siblings: readonly ProjectTreeNode[], parentPath: string) {
  if (dropIntent?.kind !== "order" || dropIntent.beforeRelativePath !== null) return false;
  if (dropIntent.parentDirectoryPath !== parentPath || dropIntent.resourceKind !== node.kind) return false;
  const lastSameKind = [...siblings].reverse().find((sibling) => sibling.kind === node.kind);
  return lastSameKind?.id === node.id;
}

function isVisualLastTreeNode(node: ProjectTreeNode, siblings: readonly ProjectTreeNode[], draggedResourcePath: string | null) {
  const visibleSiblings = siblings.filter((sibling) => projectTreeNodeResourcePath(sibling) !== draggedResourcePath);
  return visibleSiblings.at(-1)?.id === node.id;
}

function projectTreeNodeResourcePath(node: ProjectTreeNode) {
  return node.kind === "directory" ? node.path : node.resource.path;
}

function explorerRowAtPoint(root: HTMLDivElement | null, x: number, y: number) {
  if (!root || typeof document === "undefined" || typeof document.elementFromPoint !== "function") return null;
  const element = document.elementFromPoint(x, y);
  const row = element?.closest<HTMLElement>("[data-project-resource-path],[data-project-directory-path]");
  return row && root.contains(row) ? row : null;
}

function explorerInsertionAtPoint(root: HTMLDivElement | null, x: number, y: number) {
  if (!root || typeof document === "undefined" || typeof document.elementFromPoint !== "function") return false;
  const element = document.elementFromPoint(x, y);
  const insertion = element?.closest<HTMLElement>("[data-project-resource-insertion]");
  return Boolean(insertion && root.contains(insertion));
}

function dragOverlayPoint(x: number, y: number, drag: ExplorerFilePointerDrag | null) {
  if (!drag) return { x: x + 12, y: y + 12 };
  return { x: x - drag.pointerOffsetX, y: y - drag.pointerOffsetY };
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
