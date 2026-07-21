import { TooltipProvider } from "@/components/ui/tooltip";
import { CanvasDocumentToolbar } from "@/features/mermaid-editor/components/canvas-document-editor/canvas-document-toolbar";
import { CanvasDocumentImageUrlDialog } from "@/features/mermaid-editor/components/canvas-document-editor/image-url-dialog";
import { CanvasDocumentInlineEditOverlays } from "@/features/mermaid-editor/components/canvas-document-editor/inline-edit-overlays";
import { EditorStatusBadge } from "@/features/mermaid-editor/components/editor-ui";
import { useCanvasDocumentActions } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-actions";
import { useCanvasDocumentKeyboardShortcuts } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-keyboard-shortcuts";
import { useCanvasDocumentModel } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-model";
import { useCanvasDocumentPointerInteraction } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-pointer-interaction";
import type { CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorTypographyTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";

type CanvasDocumentEditorProps = {
  document: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
  typography: EditorTypographyTokens["canvasDocument"];
  fontRevision: number;
  onChange: (document: CanvasDocument, status?: string) => void;
  onStatus?: (status: string) => void;
};

export function CanvasDocumentEditor({ document, fileRef, runtime, typography, fontRevision, onChange, onStatus }: CanvasDocumentEditorProps) {
  const model = useCanvasDocumentModel({ document, fileRef, runtime, typography, fontRevision, onChange, onStatus });
  const actions = useCanvasDocumentActions({ model, fileRef, runtime, onStatus });
  const pointer = useCanvasDocumentPointerInteraction({ model, startInlineEdit: actions.startInlineEdit });

  useCanvasDocumentKeyboardShortcuts({
    selectedIdsRef: model.selectedIdsRef,
    inlineEditRef: model.inlineEditRef,
    interactionStateRef: model.interactionStateRef,
    connectorStartIdRef: model.connectorStartIdRef,
    documentRef: model.documentRef,
    onDeleteSelection: actions.deleteSelection,
    onStartInlineEdit: actions.startInlineEdit
  });

  const dragging = model.interactionState.kind === "panning" || model.interactionState.kind === "draggingItems" || model.interactionState.kind === "resizingItem";

  return (
    <TooltipProvider delayDuration={160}>
      <section className="relative h-full min-h-0 overflow-hidden bg-background">
        <CanvasDocumentToolbar
          connectorActive={Boolean(model.connectorStartId)}
          selectedCount={model.selectedIds.length}
          onAddShape={actions.addShape}
          onAddCard={actions.addCard}
          onAddText={actions.addText}
          onAddConnector={actions.addConnectorFromSelection}
          onAddImage={() => void actions.addImage()}
          onDeleteSelection={actions.deleteSelection}
          onResetViewport={actions.resetViewport}
        />
        {model.connectorStartId ? (
          <EditorStatusBadge className="editor-ui-surface pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 px-3 py-2 text-muted-foreground">
            选择第二个对象完成连线
          </EditorStatusBadge>
        ) : null}
        <CanvasDocumentImageUrlDialog
          open={actions.imageUrlDialogOpen}
          value={actions.imageUrlDraft}
          onChange={actions.setImageUrlDraft}
          onClose={() => actions.setImageUrlDialogOpen(false)}
          onSubmit={() => void actions.addImageFromUrl(actions.imageUrlDraft)}
        />
        <div
          ref={model.containerRef}
          className={cn("h-full min-h-0 touch-none overflow-hidden", dragging ? "cursor-grabbing" : "cursor-default")}
          onPointerDown={pointer.handlePointerDown}
          onPointerMove={pointer.handlePointerMove}
          onPointerUp={pointer.handlePointerUp}
          onPointerCancel={pointer.handlePointerUp}
          onClick={pointer.handleClick}
          onDoubleClick={pointer.handleDoubleClick}
          onWheel={pointer.handleWheel}
        />
        <CanvasDocumentInlineEditOverlays
          inlineEdit={model.inlineEdit}
          editStyle={model.editStyle}
          onChange={(value) => {
            if (!model.inlineEdit) return;
            model.setCanvasInlineEdit({ ...model.inlineEdit, value }, { renderScene: false });
          }}
          onCommit={actions.commitInlineEdit}
        />
      </section>
    </TooltipProvider>
  );
}
