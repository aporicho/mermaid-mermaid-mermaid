import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import {
  canvasLiveStateKey,
  imageLabelFromSrc,
  loadImageDimensions,
  viewportCenterPoint,
  type CanvasLiveState
} from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import { useEditorClipboardActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-clipboard-actions";
import { useEditorClipboardImagePaste } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-clipboard-image-paste";
import { useEditorDocumentCommands } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-commands";
import { type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { hasSelection, setMode as setEditorMode } from "@/features/mermaid-editor/lib/editor-actions";
import { normalizeFileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import type {
  ClipboardPayload,
  DiagramType,
  EditableKind,
  EdgeRouting,
  EditorHistory,
  EditorMode,
  EditorSnapshot,
  GraphDirection,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { DEFAULT_VIEW_FILTERS, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import { createImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import { gsap } from "@/features/mermaid-editor/lib/use-gsap-motion";
import type { CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseEditorCommandActionsArgs = {
  runtime: EditorRuntime;
  documentKind: DocumentKind;
  source: string;
  canvasDocument: CanvasDocument;
  graph: MermaidGraph;
  history: EditorHistory;
  selection: Selection;
  viewport: ViewportState;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  workspaceView: WorkspaceView;
  viewFilters: ViewFilters;
  fileRef: RuntimeFileRef | null;
  isCanvasEditable: boolean;
  mode: EditorMode;
  editableKind: EditableKind;
  clipboard: ClipboardPayload | null;
  resolvedMotion: RuntimeEditorMotion;
  sourceEditBaseRef: RefObject<EditorSnapshot | null>;
  sourceEditTimerRef: RefObject<number | null>;
  lastWindowFocusAtRef: RefObject<number>;
  setDocumentKind: StateSetter<DocumentKind>;
  setSource: StateSetter<string>;
  setCanvasDocument: StateSetter<CanvasDocument>;
  setGraph: StateSetter<MermaidGraph>;
  setDiagramType: StateSetter<DiagramType>;
  setEditableKind: StateSetter<EditableKind>;
  setMode: StateSetter<EditorMode>;
  setClipboard: StateSetter<ClipboardPayload | null>;
  setHistory: StateSetter<EditorHistory>;
  setSelection: StateSetter<Selection>;
  setViewport: StateSetter<ViewportState>;
  setEdgeRouting: StateSetter<EdgeRouting>;
  setLayoutMode: StateSetter<LayoutMode>;
  setWorkspaceView: StateSetter<WorkspaceView>;
  setViewFilters: StateSetter<ViewFilters>;
  setDiagnostics: StateSetter<EditorDiagnostic[]>;
  setStatus: StateSetter<string>;
  setFileWorkflowError: StateSetter<ReturnType<typeof normalizeFileWorkflowError> | null>;
  recordRecentAction: Parameters<typeof useEditorDocumentCommands>[0]["recordRecentAction"];
};

export function useEditorCommandActions(args: UseEditorCommandActionsArgs) {
  const {
    runtime,
    documentKind,
    source,
    canvasDocument,
    graph,
    history,
    selection,
    viewport,
    edgeRouting,
    layoutMode,
    workspaceView,
    viewFilters,
    fileRef,
    isCanvasEditable,
    mode,
    editableKind,
    resolvedMotion,
    sourceEditBaseRef,
    sourceEditTimerRef,
    lastWindowFocusAtRef,
    setDocumentKind,
    setSource,
    setCanvasDocument,
    setGraph,
    setDiagramType,
    setEditableKind,
    setMode,
    setClipboard,
    setHistory,
    setSelection,
    setViewport,
    setEdgeRouting,
    setLayoutMode,
    setWorkspaceView,
    setViewFilters,
    setDiagnostics,
    setStatus,
    setFileWorkflowError,
    recordRecentAction
  } = args;
  const viewportMotionTweenRef = useRef<gsap.core.Tween | null>(null);
  const lastCanvasPointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const [canvasLiveState, setCanvasLiveState] = useState<CanvasLiveState>({});

  useEffect(() => {
    return () => {
      viewportMotionTweenRef.current?.kill();
    };
  }, []);

  const updateCanvasLiveState = useCallback((next: CanvasLiveState) => {
    setCanvasLiveState((current) => (canvasLiveStateKey(current) === canvasLiveStateKey(next) ? current : next));
  }, []);

  const recordCanvasPointerWorld = useCallback((point: { x: number; y: number }) => {
    lastCanvasPointerWorldRef.current = point;
  }, []);

  const {
    applyEditorCommand,
    applySource,
    applyMarkdownSource,
    applyCanvasDocument,
    flushSourceHistory,
    snapshot
  } = useEditorDocumentCommands({
    documentKind,
    source,
    graph,
    history,
    selection,
    viewport,
    edgeRouting,
    layoutMode,
    workspaceView,
    viewFilters,
    isCanvasEditable,
    sourceEditBaseRef,
    sourceEditTimerRef,
    setDocumentKind,
    setSource,
    setCanvasDocument,
    setGraph,
    setDiagramType,
    setEditableKind,
    setMode,
    setClipboard,
    setHistory,
    setSelection,
    setViewport,
    setEdgeRouting,
    setLayoutMode,
    setWorkspaceView,
    setViewFilters,
    setDiagnostics,
    setStatus,
    recordRecentAction
  });

  const { pasteClipboardImageNode } = useEditorClipboardImagePaste({
    runtime,
    documentKind,
    workspaceView,
    isCanvasEditable,
    fileRef,
    viewport,
    canvasLiveState,
    lastCanvasPointerWorldRef,
    applyEditorCommand,
    setStatus,
    setFileWorkflowError
  });

  const { performCopy, performPaste } = useEditorClipboardActions({
    runtime,
    fileRef,
    clipboard: args.clipboard,
    selection,
    viewport,
    lastWindowFocusAtRef,
    lastCanvasPointerWorldRef,
    applyEditorCommand,
    pasteClipboardImage: runtime.kind === "desktop" ? pasteClipboardImageNode : undefined
  });

  function applyViewFilters(nextFilters: ViewFilters, message: string) {
    applyEditorCommand({ type: "viewFilters.set", filters: nextFilters, message, source: "menu" });
  }

  function updateViewFilter(nextFilters: ViewFilters, message: string) {
    applyViewFilters(nextFilters, message);
  }

  function resetViewFilters() {
    applyViewFilters(DEFAULT_VIEW_FILTERS, "已显示全部视图元素。");
  }

  function addNode() {
    if (!isCanvasEditable) return;
    applyEditorCommand({ type: "graph.addNodeAtViewportCenter", source: "menu" });
  }

  async function addImageNode() {
    if (!isCanvasEditable) return;
    if (!fileRef?.path) {
      setStatus("请先保存 Mermaid 文件，再添加本地图片节点。");
      return;
    }

    try {
      const result = await runtime.pickImageAsset(fileRef);
      if (result.status === "cancelled") return;
      if (result.status === "needs-document") {
        setStatus("请先保存 Mermaid 文件，再添加本地图片节点。");
        return;
      }
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }

      const dimensions = await loadImageDimensions(result.displaySrc);
      const point = viewportCenterPoint(viewport, canvasLiveState.canvasSize);
      applyEditorCommand({
        type: "graph.addImageNodeAt",
        point,
        asset: createImageAsset({
          src: result.src,
          width: dimensions.width,
          height: dimensions.height,
          preserveAspectRatio: true,
          labelPosition: "bottom"
        }),
        label: imageLabelFromSrc(result.src),
        message: result.copied ? "已复制并添加图片节点。" : "已添加图片节点。",
        source: "menu"
      });
    } catch (error) {
      setFileWorkflowError(normalizeFileWorkflowError(error, "添加图片节点失败。"));
    }
  }

  function createGroupFromSelection(source: "keyboard" | "menu" = "menu") {
    if (!isCanvasEditable || !hasSelection(selection)) return;
    applyEditorCommand({ type: "graph.createSubgraphFromSelection", source });
  }

  function updateDirection(direction: GraphDirection) {
    if (!isCanvasEditable) return;
    applyEditorCommand({ type: "graph.setDirection", direction, source: "menu" });
  }

  function updateEdgeRouting(nextEdgeRouting: EdgeRouting) {
    applyEditorCommand({ type: "edgeRouting.set", edgeRouting: nextEdgeRouting, source: "menu" });
  }

  function updateLayoutMode(nextLayoutMode: LayoutMode) {
    applyEditorCommand({ type: "layoutMode.set", layoutMode: nextLayoutMode, source: "menu" });
  }

  function refreshFromSource() {
    applyEditorCommand({ type: "source.refreshGraph", source: "menu" });
  }

  function performDelete() {
    if (!hasSelection(selection)) return;
    applyEditorCommand({ type: "graph.deleteSelection", source: "keyboard" });
  }

  function performUndo() {
    applyEditorCommand({ type: "history.undo", source: "keyboard" });
  }

  function performRedo() {
    applyEditorCommand({ type: "history.redo", source: "keyboard" });
  }

  function updateViewport(nextViewport: ViewportState, source: "wheel" | "gesture" | "keyboard" | "menu" | "api" = "wheel") {
    viewportMotionTweenRef.current?.kill();
    viewportMotionTweenRef.current = null;

    if ((source === "menu" || source === "api") && resolvedMotion.duration.slow > 0) {
      const proxy = { ...viewport };
      viewportMotionTweenRef.current = gsap.to(proxy, {
        x: nextViewport.x,
        y: nextViewport.y,
        scale: nextViewport.scale,
        duration: resolvedMotion.duration.slow,
        ease: resolvedMotion.ease.emphasized,
        overwrite: "auto",
        onUpdate: () => setViewport({ x: proxy.x, y: proxy.y, scale: proxy.scale }),
        onComplete: () => {
          viewportMotionTweenRef.current = null;
          applyEditorCommand({ type: "viewport.set", viewport: nextViewport, source });
        }
      });
      return;
    }

    applyEditorCommand({ type: "viewport.set", viewport: nextViewport, source });
  }

  function changeWorkspaceView(nextView: WorkspaceView) {
    const resolvedView = workspaceViewForDocument(editableKind, nextView, documentKind);
    setWorkspaceView(resolvedView);
  }

  function changeToolMode(nextMode: EditorMode) {
    if (mode === nextMode) return;
    applyEditorCommand({ type: "mode.set", mode: setEditorMode(nextMode), source: "menu" });
  }

  function syncAutoLayout() {
    applyEditorCommand({ type: "layout.syncAuto", source: "menu" });
  }

  function resetCanvasView() {
    if (documentKind === "canvas") {
      applyCanvasDocument({ ...canvasDocument, viewport: { x: 160, y: 90, scale: 1 } }, "已重置画布视图。");
      return;
    }
    updateViewport({ x: 160, y: 90, scale: 1 }, "menu");
  }

  return {
    canvasLiveState,
    updateCanvasLiveState,
    recordCanvasPointerWorld,
    applyEditorCommand,
    applySource,
    applyMarkdownSource,
    applyCanvasDocument,
    flushSourceHistory,
    snapshot,
    updateViewFilter,
    resetViewFilters,
    addNode,
    addImageNode,
    createGroupFromSelection,
    updateDirection,
    updateEdgeRouting,
    updateLayoutMode,
    refreshFromSource,
    performDelete,
    performUndo,
    performRedo,
    performCopy,
    performPaste,
    updateViewport,
    changeWorkspaceView,
    changeToolMode,
    syncAutoLayout,
    resetCanvasView
  };
}
