import { useEffect, useMemo, useRef, useState } from "react";

import { type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { emptySelection } from "@/features/mermaid-editor/lib/editor-actions";
import { type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { createHistory } from "@/features/mermaid-editor/lib/editor-history";
import { loadInitialState } from "@/features/mermaid-editor/lib/editor-state";
import type {
  ClipboardPayload,
  DiagramType,
  EditableKind,
  EdgeRouting,
  EditorMode,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import { type RuntimeFileRef, type EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import { type RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { buildMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import { type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { parentDirectoryPath } from "@/features/mermaid-editor/lib/runtime-paths";
import { hiddenFilterCount, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import { configureDecodedCanvasImageCacheForSystemMemory } from "@/features/mermaid-editor/components/konva-canvas/decoded-canvas-image-cache";
import { configureCanvasNodeTextureCacheForSystemMemory } from "@/features/mermaid-editor/components/konva-canvas/canvas-node-texture-cache";
import { updatePerformanceDiagnostic } from "@/features/mermaid-editor/lib/editor-performance";
import { diagramTypeLabel, resolveGraphImageDisplaySources } from "./editor-shell-utils";

type InitialEditorState = ReturnType<typeof loadInitialState>;

type UseEditorDocumentModelArgs = {
  initial: InitialEditorState;
  runtime: EditorRuntime;
};

export function useEditorDocumentModel({ initial, runtime }: UseEditorDocumentModelArgs) {
  const [documentKind, setDocumentKind] = useState<DocumentKind>(initial.documentKind);
  const [source, setSource] = useState(initial.source);
  const [graph, setGraph] = useState<MermaidGraph>(initial.graph);
  const [diagramType, setDiagramType] = useState<DiagramType>(initial.diagramType);
  const [editableKind, setEditableKind] = useState<EditableKind>(initial.editableKind);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [viewport, setViewport] = useState<ViewportState>(initial.viewport);
  const [edgeRouting, setEdgeRouting] = useState<EdgeRouting>(initial.edgeRouting);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initial.layoutMode);
  const [mode, setMode] = useState<EditorMode>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [history, setHistory] = useState(() => createHistory());
  const [clipboard, setClipboard] = useState<ClipboardPayload | null>(null);
  const [diagnostics, setDiagnostics] = useState<EditorDiagnostic[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(initial.workspaceView);
  const [viewFilters, setViewFilters] = useState<ViewFilters>(initial.viewFilters);
  const [fileName, setFileName] = useState(initial.fileName);
  const [fileRef, setFileRef] = useState<RuntimeFileRef | null>(initial.fileRef);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(initial.recentFiles);
  const [projectWorkspace, setProjectWorkspace] = useState<ProjectWorkspace | null>(initial.projectWorkspace);
  const [projectBusy, setProjectBusy] = useState(false);
  const [lastSavedDocument, setLastSavedDocument] = useState(initial.lastSavedDocument);
  const [imageDisplaySrcBySrc, setImageDisplaySrcBySrc] = useState<Record<string, string>>({});
  const [imageAssetRevision, setImageAssetRevision] = useState(0);
  const documentGenerationRef = useRef(0);

  useEffect(() => {
    let active = true;
    void runtime.readSystemMemoryInfo().then((info) => {
      const { totalBytes } = info;
      if (active) configureDecodedCanvasImageCacheForSystemMemory(totalBytes);
      if (active) configureCanvasNodeTextureCacheForSystemMemory(totalBytes);
      if (active && info.graphics) updatePerformanceDiagnostic("graphics", info.graphics);
    }).catch(() => {
      if (active) configureDecodedCanvasImageCacheForSystemMemory(null);
      if (active) configureCanvasNodeTextureCacheForSystemMemory(null);
    });
    return () => {
      active = false;
    };
  }, [runtime]);

  function beginDocumentSession() {
    documentGenerationRef.current += 1;
  }

  function refreshImageAssets() {
    setImageAssetRevision((current) => current + 1);
  }

  const currentDocument = useMemo(
    () => {
      if (documentKind !== "mermaid") return source;
      return buildMermaidDocument(source, graph, viewport, edgeRouting, layoutMode);
    },
    [documentKind, source, graph, viewport, edgeRouting, layoutMode]
  );
  const previewSource = useMemo(
    () =>
      documentKind === "mermaid" && editableKind === "flowchart"
        ? buildMermaidDocument(serializeMermaid(resolveGraphImageDisplaySources(graph, imageDisplaySrcBySrc)), graph, viewport, edgeRouting, layoutMode)
        : source,
    [documentKind, editableKind, edgeRouting, graph, imageDisplaySrcBySrc, layoutMode, source, viewport]
  );
  const hiddenViewFilters = useMemo(() => hiddenFilterCount(viewFilters), [viewFilters]);
  const projectFiles = useMemo(() => projectWorkspace?.files || [], [projectWorkspace]);
  const terminalCwd = useMemo(() => projectWorkspace?.rootPath || parentDirectoryPath(fileRef?.path), [fileRef?.path, projectWorkspace?.rootPath]);
  const terminalContextKey = useMemo(
    () => projectWorkspace?.rootPath
      ? `project:${projectWorkspace.rootPath}`
      : terminalCwd
        ? `directory:${terminalCwd}`
        : "scratch",
    [projectWorkspace?.rootPath, terminalCwd]
  );
  const isDirty = fileRef ? currentDocument !== lastSavedDocument : !lastSavedDocument || currentDocument !== lastSavedDocument;
  const isCanvasEditable = documentKind === "mermaid" && editableKind === "flowchart";
  const canvasViewTooltip = isCanvasEditable ? "无限画布" : `${diagramTypeLabel(diagramType)} 仅支持渲染`;

  useEffect(() => {
    const assetSources = Array.from(
      new Set(
        graph.nodes
          .flatMap((node) => [node.asset?.src, node.preview?.cover?.src])
          .filter((src): src is string => Boolean(src))
      )
    );
    if (!assetSources.length) {
      setImageDisplaySrcBySrc({});
      return;
    }

    let disposed = false;
    void Promise.all(
      assetSources.map(async (src) => {
        try {
          const displaySrc = await runtime.resolveImageAssetSrc(fileRef, src);
          const revisionedSrc = imageAssetRevision > 0 && displaySrc.startsWith("mmm-asset:")
            ? `${displaySrc}${displaySrc.includes("?") ? "&" : "?"}revision=${imageAssetRevision}`
            : displaySrc;
          return [src, revisionedSrc] as const;
        } catch {
          return [src, src] as const;
        }
      })
    ).then((entries) => {
      if (!disposed) setImageDisplaySrcBySrc(Object.fromEntries(entries));
    });

    return () => {
      disposed = true;
    };
  }, [fileRef, graph.nodes, imageAssetRevision, runtime]);

  return {
    documentKind,
    setDocumentKind,
    source,
    setSource,
    graph,
    setGraph,
    diagramType,
    setDiagramType,
    editableKind,
    setEditableKind,
    selection,
    setSelection,
    viewport,
    setViewport,
    edgeRouting,
    setEdgeRouting,
    layoutMode,
    setLayoutMode,
    mode,
    setMode,
    spacePanning,
    setSpacePanning,
    history,
    setHistory,
    clipboard,
    setClipboard,
    diagnostics,
    setDiagnostics,
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    workspaceView,
    setWorkspaceView,
    viewFilters,
    setViewFilters,
    fileName,
    setFileName,
    fileRef,
    setFileRef,
    recentFiles,
    setRecentFiles,
    projectWorkspace,
    setProjectWorkspace,
    projectBusy,
    setProjectBusy,
    lastSavedDocument,
    setLastSavedDocument,
    documentGenerationRef,
    beginDocumentSession,
    refreshImageAssets,
    imageDisplaySrcBySrc,
    currentDocument,
    previewSource,
    hiddenViewFilters,
    projectFiles,
    terminalCwd,
    terminalContextKey,
    isDirty,
    isCanvasEditable,
    canvasViewTooltip
  };
}
