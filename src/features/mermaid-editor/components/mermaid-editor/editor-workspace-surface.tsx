import { Suspense, lazy } from "react";

import { CanvasDocumentEditor } from "@/features/mermaid-editor/components/canvas-document-editor";
import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import { PreviewPanel } from "@/features/mermaid-editor/components/preview-panel";
import { SourcePanel } from "@/features/mermaid-editor/components/source-panel";
import type { CanvasLiveState } from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import type { DagreEdgeRoute } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import type { CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import { documentKindLabel, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
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
import type { EditorThemeGeometryTokens, EditorTypographyTokens, MermaidThemeVariables, SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import type { MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";

const KonvaCanvas = lazy(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => ({ default: mod.KonvaCanvas })));

type EditorWorkspaceSurfaceProps = {
  documentKind: DocumentKind;
  canvasDocument: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  fileName: string;
  runtime: EditorRuntime;
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
  markdownSpellcheckEnabled: boolean;
  markdownContentWidth: number;
  markdownTextScale: number;
  visualTokens: CanvasVisualTokens;
  geometryTokens: EditorThemeGeometryTokens;
  typography: EditorTypographyTokens;
  specialNodeTokens: SpecialNodeThemeTokens;
  fontRevision: number;
  motion: RuntimeEditorMotion;
  source: string;
  previewSource: string;
  diagnostics: EditorDiagnostic[];
  mermaidThemeVariables: MermaidThemeVariables;
  onCanvasDocumentChange: (document: CanvasDocument, status?: string) => void;
  onStatus: (status: string) => void;
  onMarkdownChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onRunSource: () => void;
  onEditorCommand: (command: EditorCommand) => void;
  onOpenNodeAction: (node: CanvasNode) => void;
  onEditNodeAction: (node: CanvasNode) => void;
  onPointerWorldChange: (point: { x: number; y: number }) => void;
  onLiveStateChange: (state: CanvasLiveState) => void;
  onRequestMarkdownDocumentPreview: (node: CanvasNode) => void;
};

export function EditorWorkspaceSurface({
  documentKind,
  canvasDocument,
  fileRef,
  fileName,
  runtime,
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
  markdownSpellcheckEnabled,
  markdownContentWidth,
  markdownTextScale,
  visualTokens,
  geometryTokens,
  typography,
  specialNodeTokens,
  fontRevision,
  motion,
  source,
  previewSource,
  diagnostics,
  mermaidThemeVariables,
  onCanvasDocumentChange,
  onStatus,
  onMarkdownChange,
  onSourceChange,
  onRunSource,
  onEditorCommand,
  onOpenNodeAction,
  onEditNodeAction,
  onPointerWorldChange,
  onLiveStateChange,
  onRequestMarkdownDocumentPreview
}: EditorWorkspaceSurfaceProps) {
  if (documentKind === "canvas") {
    return (
      <CanvasDocumentEditor
        document={canvasDocument}
        fileRef={fileRef}
        runtime={runtime}
        typography={typography.canvasDocument}
        fontRevision={fontRevision}
        onChange={onCanvasDocumentChange}
        onStatus={onStatus}
      />
    );
  }

  if (workspaceView === "canvas" && isCanvasEditable) {
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
          visualTokens={visualTokens}
          geometryTokens={geometryTokens}
          typography={typography}
          specialNodeTokens={specialNodeTokens}
          fontRevision={fontRevision}
          motion={motion}
          onEditorCommand={onEditorCommand}
          onOpenNodeAction={onOpenNodeAction}
          onEditNodeAction={onEditNodeAction}
          onPointerWorldChange={onPointerWorldChange}
          onLiveStateChange={onLiveStateChange}
          onRequestMarkdownDocumentPreview={onRequestMarkdownDocumentPreview}
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
        onChange={onMarkdownChange}
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
