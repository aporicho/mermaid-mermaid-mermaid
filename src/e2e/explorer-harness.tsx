import { useEffect, useMemo, useRef, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ExplorerWorkspaceWindow } from "@/features/mermaid-editor/components/mermaid-editor/explorer-workspace-window";
import { documentKindFromPath } from "@/features/mermaid-editor/lib/document-kind";
import { DEFAULT_EDITOR_MOTION } from "@/features/mermaid-editor/lib/editor-theme";
import type { RuntimeFileRef, RuntimeProjectResourceKind } from "@/features/mermaid-editor/lib/editor-runtime";
import { resolveRuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type {
  ProjectExplorerOrderState,
  ProjectFileEntry,
  ProjectResourceEntry,
  ProjectWorkspace
} from "@/features/mermaid-editor/lib/project-workspace";
import { EditorMotionProvider } from "@/features/mermaid-editor/lib/use-gsap-motion";

const E2E_ROOT_NAME = "project";
const E2E_ROOT_PATH = "/project";

type ExplorerE2EEvent =
  | { type: "open-project" }
  | { type: "refresh-project" }
  | { type: "create-file"; request: { directoryPath: string; fileName: string; kind: string } }
  | { type: "create-directory"; request: { directoryPath: string; directoryName: string } }
  | { type: "rename"; relativePath: string; name: string }
  | { type: "move"; relativePaths: string[]; targetDirectoryPath: string; placement?: unknown }
  | { type: "reorder"; parentDirectoryPath: string; kind: RuntimeProjectResourceKind; orderedRelativePaths: string[] }
  | { type: "copy"; relativePaths: string[]; targetDirectoryPath: string }
  | { type: "import"; externalPaths: string[]; targetDirectoryPath: string }
  | { type: "delete"; relativePaths: string[] }
  | { type: "show-in-file-manager"; relativePath: string }
  | { type: "open-file"; surface: "editor" | "markdown-window" | "html-window" | "image-window" | "text-window" | "csv-window"; relativePath: string }
  | { type: "canvas-drag"; relativePath: string; kind: "markdown" | "html" | "text" | "csv"; phase: "move" | "drop" | "cancel"; point: { x: number; y: number } }
  | { type: "status"; message: string }
  | { type: "focus-panel" }
  | { type: "close-panel" }
  | { type: "window-state"; state: "normal" | "fullscreen" };

type ExplorerE2EState = {
  projectBusy: boolean;
  currentFilePath: string | null;
  lastStatus: string;
  treeState: ExplorerWorkspaceTreeState;
  resourceOrder: ProjectExplorerOrderState | null;
};

type ExplorerE2EApi = {
  readonly events: ExplorerE2EEvent[];
  reset: () => void;
  getEvents: () => ExplorerE2EEvent[];
  getState: () => ExplorerE2EState;
  setBusy: (busy: boolean) => void;
  setCurrentFile: (relativePath: string | null) => void;
  clearEvents: () => void;
};

declare global {
  interface Window {
    __MMM_EXPLORER_E2E__?: ExplorerE2EApi;
  }
}

export function ExplorerE2EHarness() {
  const [projectWorkspace, setProjectWorkspace] = useState<ProjectWorkspace>(() => createExplorerE2EWorkspace());
  const [treeState, setTreeState] = useState<ExplorerWorkspaceTreeState>(() => createExplorerTreeState());
  const [projectBusy, setProjectBusy] = useState(false);
  const [currentFileRef, setCurrentFileRef] = useState<RuntimeFileRef | null>(null);
  const [lastStatus, setLastStatus] = useState("");
  const [windowState, setWindowState] = useState<"normal" | "fullscreen">("normal");
  const eventsRef = useRef<ExplorerE2EEvent[]>([]);
  const snapshotRef = useRef<ExplorerE2EState>({
    projectBusy,
    currentFilePath: currentFileRef?.path ?? null,
    lastStatus,
    treeState,
    resourceOrder: projectWorkspace.resourceOrder ?? null
  });
  const motion = useMemo(() => resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION, false), []);

  snapshotRef.current = {
    projectBusy,
    currentFilePath: currentFileRef?.path ?? null,
    lastStatus,
    treeState,
    resourceOrder: projectWorkspace.resourceOrder ?? null
  };

  useEffect(() => {
    const api: ExplorerE2EApi = {
      get events() {
        return eventsRef.current;
      },
      reset() {
        eventsRef.current.splice(0);
        const workspace = createExplorerE2EWorkspace();
        setProjectWorkspace(workspace);
        setTreeState(createExplorerTreeState());
        setProjectBusy(false);
        setCurrentFileRef(null);
        setLastStatus("");
        setWindowState("normal");
      },
      getEvents() {
        return [...eventsRef.current];
      },
      getState() {
        return snapshotRef.current;
      },
      setBusy(busy) {
        setProjectBusy(busy);
      },
      setCurrentFile(relativePath) {
        const file = relativePath ? findProjectFile(projectWorkspace, relativePath) : null;
        setCurrentFileRef(file ? { name: file.name, path: file.path } : null);
      },
      clearEvents() {
        eventsRef.current.splice(0);
      }
    };
    window.__MMM_EXPLORER_E2E__ = api;
    return () => {
      if (window.__MMM_EXPLORER_E2E__ === api) delete window.__MMM_EXPLORER_E2E__;
    };
  }, [projectWorkspace]);

  function record(event: ExplorerE2EEvent) {
    eventsRef.current.push(event);
  }

  function status(message: string) {
    setLastStatus(message);
    record({ type: "status", message });
  }

  function renameResource(resource: ProjectResourceEntry, name: string) {
    record({ type: "rename", relativePath: resource.relativePath, name });
    setProjectWorkspace((current) => renameResourceInWorkspace(current, resource.relativePath, name));
  }

  function reorderResources(parentDirectoryPath: string, kind: RuntimeProjectResourceKind, orderedRelativePaths: string[]) {
    record({ type: "reorder", parentDirectoryPath, kind, orderedRelativePaths });
    setProjectWorkspace((current) => ({
      ...current,
      resourceOrder: reorderWorkspaceResources(current.resourceOrder, parentDirectoryPath, kind, orderedRelativePaths),
      scannedAt: current.scannedAt + 1
    }));
  }

  function deleteResources(resources: ProjectResourceEntry[]) {
    record({ type: "delete", relativePaths: resources.map((resource) => resource.relativePath) });
    setProjectWorkspace((current) => deleteResourcesFromWorkspace(current, resources.map((resource) => resource.relativePath)));
  }

  return (
    <TooltipProvider delayDuration={0}>
      <EditorMotionProvider value={motion}>
        <div className="relative h-screen w-screen overflow-hidden bg-background" data-testid="explorer-e2e-root">
          <ExplorerWorkspaceWindow
            open
            active
            stackIndex={1}
            titlebarAutoHide
            windowState={windowState}
            onFocusPanel={() => record({ type: "focus-panel" })}
            onWindowStateChange={(state) => {
              setWindowState(state);
              record({ type: "window-state", state });
            }}
            onClose={() => record({ type: "close-panel" })}
            runtimeKind="desktop"
            projectWorkspace={projectWorkspace}
            projectFiles={projectWorkspace.files}
            currentFileRef={currentFileRef}
            projectBusy={projectBusy}
            treeState={treeState}
            resourceStatuses={{}}
            onTreeStateChange={(state) => setTreeState((current) => ({ ...current, ...state, updatedAt: current.updatedAt + 1 }))}
            onOpenProject={() => record({ type: "open-project" })}
            onRefreshProject={() => record({ type: "refresh-project" })}
            onCreateProjectFile={(request) => record({ type: "create-file", request })}
            onCreateProjectDirectory={(request) => record({ type: "create-directory", request })}
            onRenameProjectResource={renameResource}
            onMoveProjectFile={(resource, targetDirectoryPath) => record({ type: "move", relativePaths: [resource.relativePath], targetDirectoryPath })}
            onMoveProjectResources={(resources, targetDirectoryPath, placement) => record({
              type: "move",
              relativePaths: resources.map((resource) => resource.relativePath),
              targetDirectoryPath,
              ...(placement ? { placement } : {})
            })}
            onReorderProjectResources={reorderResources}
            onCopyProjectResources={(resources, targetDirectoryPath) => record({
              type: "copy",
              relativePaths: resources.map((resource) => resource.relativePath),
              targetDirectoryPath
            })}
            onImportProjectResources={(externalPaths, targetDirectoryPath) => record({ type: "import", externalPaths, targetDirectoryPath })}
            onDeleteProjectResources={deleteResources}
            onShowProjectResourceInFileManager={(resource) => record({ type: "show-in-file-manager", relativePath: resource.relativePath })}
            onOpenProjectFile={(file) => record({ type: "open-file", surface: "editor", relativePath: file.relativePath })}
            onOpenProjectMarkdownWindow={(file) => record({ type: "open-file", surface: "markdown-window", relativePath: file.relativePath })}
            onOpenProjectHtmlWindow={(file) => record({ type: "open-file", surface: "html-window", relativePath: file.relativePath })}
            onOpenProjectImageWindow={(file) => record({ type: "open-file", surface: "image-window", relativePath: file.relativePath })}
            onOpenProjectTextWindow={(file) => record({ type: "open-file", surface: "text-window", relativePath: file.relativePath })}
            onOpenProjectCsvWindow={(file) => record({ type: "open-file", surface: "csv-window", relativePath: file.relativePath })}
            onProjectDocumentPointerDrag={(file, kind, point, phase) => record({ type: "canvas-drag", relativePath: file.relativePath, kind, phase, point })}
            onStatus={status}
          />
          <output className="sr-only" aria-live="polite" data-testid="explorer-e2e-status">{lastStatus}</output>
        </div>
      </EditorMotionProvider>
    </TooltipProvider>
  );
}

function createExplorerTreeState(): ExplorerWorkspaceTreeState {
  return {
    rootPath: E2E_ROOT_PATH,
    rootExpanded: true,
    expandedDirectoryPaths: ["docs"],
    updatedAt: 1
  };
}

function createExplorerE2EWorkspace(): ProjectWorkspace {
  const files = [
    projectFile("docs/diagram.mmd"),
    projectFile("docs/note.md"),
    projectFile("docs/core/nested.md"),
    projectFile("ideas.md")
  ];
  const resources = [
    directoryResource("docs"),
    directoryResource("docs/core"),
    directoryResource("empty"),
    fileResource("docs/diagram.mmd"),
    fileResource("docs/index.html"),
    fileResource("docs/note.md"),
    fileResource("docs/cover.png"),
    fileResource("docs/people.csv"),
    fileResource("docs/theme.css"),
    fileResource("docs/core/nested.md"),
    fileResource("ideas.md"),
    fileResource("README.txt")
  ];

  return {
    rootName: E2E_ROOT_NAME,
    rootPath: E2E_ROOT_PATH,
    files,
    resources,
    resourceOrder: {
      version: 1,
      directories: {
        "": { directories: ["docs", "empty"], files: ["ideas.md", "README.txt"] },
        docs: {
          directories: ["docs/core"],
          files: [
            "docs/cover.png",
            "docs/diagram.mmd",
            "docs/index.html",
            "docs/note.md",
            "docs/people.csv",
            "docs/theme.css"
          ]
        },
        "docs/core": { directories: [], files: ["docs/core/nested.md"] }
      }
    },
    scannedAt: 1
  };
}

function projectFile(relativePath: string): ProjectFileEntry {
  return {
    name: basename(relativePath),
    path: absolutePath(relativePath),
    relativePath,
    modifiedAt: 1
  };
}

function directoryResource(relativePath: string): ProjectResourceEntry {
  return {
    kind: "directory",
    name: basename(relativePath),
    path: absolutePath(relativePath),
    relativePath
  };
}

function fileResource(relativePath: string): ProjectResourceEntry {
  const documentKind = documentKindFromPath(relativePath);
  return {
    kind: "file",
    name: basename(relativePath),
    path: absolutePath(relativePath),
    relativePath,
    ...(documentKind ? { documentKind } : {}),
    modifiedAt: 1
  };
}

function findProjectFile(workspace: ProjectWorkspace, relativePath: string) {
  return workspace.files.find((file) => file.relativePath === relativePath) ?? null;
}

function renameResourceInWorkspace(workspace: ProjectWorkspace, sourceRelativePath: string, name: string): ProjectWorkspace {
  const targetRelativePath = joinRelativePath(parentRelativePath(sourceRelativePath), name);
  return migrateWorkspaceResourcePath(workspace, sourceRelativePath, targetRelativePath);
}

function deleteResourcesFromWorkspace(workspace: ProjectWorkspace, relativePaths: string[]): ProjectWorkspace {
  const deleted = new Set(relativePaths);
  const removed = (relativePath: string) => [...deleted].some((path) => relativePath === path || relativePath.startsWith(`${path}/`));
  return {
    ...workspace,
    files: workspace.files.filter((file) => !removed(file.relativePath)),
    resources: workspace.resources?.filter((resource) => !removed(resource.relativePath)),
    resourceOrder: workspace.resourceOrder ? {
      version: 1,
      directories: Object.fromEntries(Object.entries(workspace.resourceOrder.directories)
        .filter(([parentPath]) => !removed(parentPath))
        .map(([parentPath, group]) => [
          parentPath,
          {
            directories: group.directories.filter((path) => !removed(path)),
            files: group.files.filter((path) => !removed(path))
          }
        ]))
    } : undefined,
    scannedAt: workspace.scannedAt + 1
  };
}

function migrateWorkspaceResourcePath(workspace: ProjectWorkspace, sourceRelativePath: string, targetRelativePath: string): ProjectWorkspace {
  function migrateEntry<T extends ProjectFileEntry | ProjectResourceEntry>(entry: T): T {
    const relativePath = replaceRelativePath(entry.relativePath, sourceRelativePath, targetRelativePath);
    if (relativePath === entry.relativePath) return entry;
    return {
      ...entry,
      name: basename(relativePath),
      path: absolutePath(relativePath),
      relativePath
    };
  }

  return {
    ...workspace,
    files: workspace.files.map(migrateEntry),
    resources: workspace.resources?.map(migrateEntry),
    resourceOrder: workspace.resourceOrder ? migrateExplorerOrder(workspace.resourceOrder, sourceRelativePath, targetRelativePath) : undefined,
    scannedAt: workspace.scannedAt + 1
  };
}

function reorderWorkspaceResources(
  order: ProjectExplorerOrderState | undefined,
  parentDirectoryPath: string,
  kind: RuntimeProjectResourceKind,
  orderedRelativePaths: string[]
): ProjectExplorerOrderState {
  const current = order ?? { version: 1, directories: {} };
  const currentGroup = current.directories[parentDirectoryPath] ?? { directories: [], files: [] };
  return {
    version: 1,
    directories: {
      ...current.directories,
      [parentDirectoryPath]: {
        ...currentGroup,
        [kind === "directory" ? "directories" : "files"]: orderedRelativePaths
      }
    }
  };
}

function migrateExplorerOrder(order: ProjectExplorerOrderState, sourceRelativePath: string, targetRelativePath: string): ProjectExplorerOrderState {
  return {
    version: 1,
    directories: Object.fromEntries(Object.entries(order.directories).map(([parentPath, group]) => [
      replaceRelativePath(parentPath, sourceRelativePath, targetRelativePath),
      {
        directories: group.directories.map((relativePath) => replaceRelativePath(relativePath, sourceRelativePath, targetRelativePath)),
        files: group.files.map((relativePath) => replaceRelativePath(relativePath, sourceRelativePath, targetRelativePath))
      }
    ]))
  };
}

function replaceRelativePath(relativePath: string, sourceRelativePath: string, targetRelativePath: string) {
  if (relativePath === sourceRelativePath) return targetRelativePath;
  if (relativePath.startsWith(`${sourceRelativePath}/`)) return `${targetRelativePath}${relativePath.slice(sourceRelativePath.length)}`;
  return relativePath;
}

function absolutePath(relativePath: string) {
  return relativePath ? `${E2E_ROOT_PATH}/${relativePath}` : E2E_ROOT_PATH;
}

function basename(relativePath: string) {
  return relativePath.split("/").filter(Boolean).at(-1) || E2E_ROOT_NAME;
}

function parentRelativePath(relativePath: string) {
  const segments = relativePath.split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function joinRelativePath(parentPath: string, name: string) {
  return parentPath ? `${parentPath}/${name}` : name;
}
