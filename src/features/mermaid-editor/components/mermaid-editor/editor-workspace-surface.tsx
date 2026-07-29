import { Suspense, lazy } from "react";

import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import { MainPlainDocumentPanel } from "@/features/mermaid-editor/components/main-plain-document-panel";
import { PreviewPanel } from "@/features/mermaid-editor/components/preview-panel";
import { SourcePanel } from "@/features/mermaid-editor/components/source-panel";
import type { CanvasLiveState } from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import type { DagreEdgeRoute } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { documentKindLabel, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { RuntimeAgentTextSelection, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type {
  CanvasNode,
  EdgeRouting,
  EditorMode,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorThemeGeometryTokens, EditorTypographyTokens, MarkdownThemeTokens, MermaidThemeVariables, SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import type { MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { TextDocumentPreview } from "@/features/mermaid-editor/lib/text-document";
import type { MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";
import { mermaidGraphImageNavigation } from "@/features/mermaid-editor/lib/canvas-image-window";
import type { ImageWindowOpenRequest } from "@/features/mermaid-editor/lib/workspace-panels";
const KonvaCanvas = lazy(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => ({ default: mod.KonvaCanvas })));

type EditorWorkspaceSurfaceProps = {
  documentKind: DocumentKind; fileRef: RuntimeFileRef | null; fileName: string;
  workspaceView: WorkspaceView;
  isCanvasEditable: boolean;
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  spacePanning: boolean;
  viewFilters: ViewFilters;
  edgeRouting: EdgeRouting;
  mermaidEdgeRoutes: DagreEdgeRoute[];
  layoutMode: LayoutMode;
  imageDisplaySrcBySrc: Record<string, string>;
  markdownDocumentPreviewByNodeId: Record<string, MarkdownDocumentPreview>;
  textDocumentPreviewByNodeId: Record<string, TextDocumentPreview>;
  markdownSpellcheckEnabled: boolean; markdownContentWidth: number; markdownTextScale: number;
  visualTokens: CanvasVisualTokens;
  geometryTokens: EditorThemeGeometryTokens;
  typography: EditorTypographyTokens;
  markdownTokens: MarkdownThemeTokens;
  specialNodeTokens: SpecialNodeThemeTokens;
  fontRevision: number;
  motion: RuntimeEditorMotion;
  source: string;
  isDirty: boolean; canUndo: boolean; canRedo: boolean;
  previewSource: string;
  diagnostics: EditorDiagnostic[];
  mermaidThemeVariables: MermaidThemeVariables;
  onMarkdownChange: (value: string) => void;
  onOpenMarkdownFileLink?: (href: string) => boolean;
  onTextSelectionChange?: (selection: RuntimeAgentTextSelection | null) => void;
  markdownFoldState: MarkdownFoldSnapshot | null | undefined;
  onMarkdownFoldStateChange?: (snapshot: MarkdownFoldSnapshot) => void;
  onSourceChange: (value: string) => void;
  onSave: () => void; onUndo: () => void; onRedo: () => void;
  onRunSource: () => void;
  onEditorCommand: (command: EditorCommand) => void;
  onOpenNodeAction: (node: CanvasNode) => void;
  onOpenCanvasImage: (request: ImageWindowOpenRequest) => void;
  onEditNodeAction: (node: CanvasNode) => void;
  onPointerWorldChange: (point: { x: number; y: number }) => void;
  onLiveStateChange: (state: CanvasLiveState) => void;
  onRequestMarkdownDocumentPreview: (node: CanvasNode) => void;
  onRequestTextDocumentPreview: (node: CanvasNode) => void;
};

export function EditorWorkspaceSurface({
  documentKind,
  fileRef,
  fileName,
  workspaceView,
  isCanvasEditable,
  graph,
  selection,
  viewport,
  mode,
  spacePanning,
  viewFilters,
  edgeRouting,
  mermaidEdgeRoutes,
  layoutMode,
  imageDisplaySrcBySrc,
  markdownDocumentPreviewByNodeId,
  textDocumentPreviewByNodeId,
  markdownSpellcheckEnabled,
  markdownContentWidth,
  markdownTextScale,
  visualTokens,
  geometryTokens,
  typography,
  markdownTokens,
  specialNodeTokens,
  fontRevision,
  motion,
  source,
  isDirty,
  canUndo,
  canRedo,
  previewSource,
  diagnostics,
  mermaidThemeVariables,
  onMarkdownChange,
  onOpenMarkdownFileLink,
  onTextSelectionChange,
  markdownFoldState,
  onMarkdownFoldStateChange,
  onSourceChange,
  onSave,
  onUndo,
  onRedo,
  onRunSource,
  onEditorCommand,
  onOpenNodeAction,
  onOpenCanvasImage,
  onEditNodeAction,
  onPointerWorldChange,
  onLiveStateChange,
  onRequestMarkdownDocumentPreview,
  onRequestTextDocumentPreview
}: EditorWorkspaceSurfaceProps) {
  if ((workspaceView === "text" && documentKind === "text") || (workspaceView === "csv" && documentKind === "csv")) {
    return (
      <MainPlainDocumentPanel
        key={`${fileRef?.path || fileName}:${documentKind}`}
        documentKind={documentKind}
        title={fileName}
        path={fileRef?.path}
        value={source}
        dirty={isDirty}
        canUndo={canUndo}
        canRedo={canRedo}
        onChange={onSourceChange}
        onSave={onSave}
        onUndo={onUndo}
        onRedo={onRedo}
      />
    );
  }

  if (workspaceView === "canvas" && isCanvasEditable) {
    const documentIdentity = fileRef?.path || fileName;
    return (
      <Suspense fallback={<div className="grid min-h-0 place-items-center bg-card text-sm text-muted-foreground">正在载入画布</div>}>
        <KonvaCanvas
          graph={graph}
          selection={selection}
          viewport={viewport}
          mode={mode}
          panningRequested={spacePanning}
          viewFilters={viewFilters}
          edgeRouting={edgeRouting}
          mermaidEdgeRoutes={mermaidEdgeRoutes}
          layoutMode={layoutMode}
          imageDisplaySrcBySrc={imageDisplaySrcBySrc}
          markdownDocumentPreviewByNodeId={markdownDocumentPreviewByNodeId}
          textDocumentPreviewByNodeId={textDocumentPreviewByNodeId}
          visualTokens={visualTokens}
          geometryTokens={geometryTokens}
          typography={typography}
          markdownTokens={markdownTokens}
          specialNodeTokens={specialNodeTokens}
          fontRevision={fontRevision}
          motion={motion}
          onEditorCommand={onEditorCommand}
          onOpenNodeAction={onOpenNodeAction}
          onOpenNodeImage={(node) => node.asset?.kind === "image" && onOpenCanvasImage({
            source: node.asset.src,
            title: node.label,
            identity: `mermaid:${documentIdentity}:image:${node.id}`,
            navigation: mermaidGraphImageNavigation(graph, node.id, documentIdentity)
          })}
          onEditNodeAction={onEditNodeAction}
          onPointerWorldChange={onPointerWorldChange}
          onLiveStateChange={onLiveStateChange}
          onRequestMarkdownDocumentPreview={onRequestMarkdownDocumentPreview}
          onRequestTextDocumentPreview={onRequestTextDocumentPreview}
        />
      </Suspense>
    );
  }

  if (workspaceView === "markdown" && documentKind === "markdown") {
    return (
      <MarkdownPanel
        key={`${fileRef?.path || fileName}:markdown`}
        value={source}
        spellCheck={markdownSpellcheckEnabled}
        contentWidth={markdownContentWidth}
        textScale={markdownTextScale}
        foldState={markdownFoldState}
        onFoldStateChange={onMarkdownFoldStateChange}
        onChange={onMarkdownChange}
        onOpenFileLink={onOpenMarkdownFileLink}
        onSelectionChange={onTextSelectionChange}
      />
    );
  }

  if (workspaceView === "source") {
    return (
      <SourcePanel
        value={source}
        title={`${documentKindLabel(documentKind)} 源码`}
        diagnostics={documentKind === "mermaid" ? diagnostics : []}
        onChange={onSourceChange}
        onSelectionChange={onTextSelectionChange}
        onRun={documentKind === "mermaid" ? onRunSource : undefined}
        className="border-0"
      />
    );
  }

  return (
    <PreviewPanel
      source={previewSource}
      graph={isCanvasEditable ? graph : undefined}
      framed={false}
      diagnostics={diagnostics}
      mermaidThemeVariables={mermaidThemeVariables}
      mermaidTypography={typography.mermaid}
      onEditorCommand={isCanvasEditable ? onEditorCommand : undefined}
    />
  );
}
