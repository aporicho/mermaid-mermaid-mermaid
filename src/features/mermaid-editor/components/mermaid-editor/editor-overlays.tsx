import type { ComponentProps } from "react";

import {
  FileDropFeedbackBadge,
  FileConflictPrompt,
  FileWorkflowErrorBanner,
  UnsavedFilePrompt,
  type FileDropFeedback
} from "@/features/mermaid-editor/components/file-workflow-feedback";
import type { FileConflictChoice, FileConflictPromptState, UnsavedPromptState } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { NodeActionEditorDialog } from "@/features/mermaid-editor/components/node-action-editor-dialog";
import { MarkdownDocumentDialog } from "@/features/mermaid-editor/components/markdown-document-dialog";
import { CsvTableDialog } from "@/features/mermaid-editor/components/csv-table-dialog";
import { HtmlDocumentDialog } from "@/features/mermaid-editor/components/html-document-dialog";
import { EditorStatusBadge } from "@/features/mermaid-editor/components/editor-ui";
import type { UnsavedPromptChoice } from "@/features/mermaid-editor/lib/desktop-close-workflow";
import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import type { FileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

type EditorOverlaysProps = {
  fileDropFeedback: FileDropFeedback | null;
  fileWorkflowError: FileWorkflowError | null;
  unsavedPrompt: UnsavedPromptState | null;
  fileConflictPrompt: FileConflictPromptState | null;
  nodeActionEditorNode?: CanvasNode;
  markdownDocumentDialog?: ComponentProps<typeof MarkdownDocumentDialog>;
  htmlDocumentDialog?: ComponentProps<typeof HtmlDocumentDialog>;
  csvTableDialog?: ComponentProps<typeof CsvTableDialog>;
  projectFiles: ProjectFileEntry[];
  status: string;
  statusMessages: boolean;
  onCloseFileWorkflowError: () => void;
  onResolveUnsavedPrompt: (choice: UnsavedPromptChoice) => void;
  onResolveFileConflictPrompt: (choice: FileConflictChoice) => void;
  onCloseNodeActionEditor: () => void;
  onSaveCanvasNodeAction: (nodeId: string, action: CanvasNodeAction | undefined) => void;
  onExecuteNodeActionDraft: (action: CanvasNodeAction) => void;
};

export function EditorOverlays({
  fileDropFeedback,
  fileWorkflowError,
  unsavedPrompt,
  fileConflictPrompt,
  nodeActionEditorNode,
  markdownDocumentDialog,
  htmlDocumentDialog,
  csvTableDialog,
  projectFiles,
  status,
  statusMessages,
  onCloseFileWorkflowError,
  onResolveUnsavedPrompt,
  onResolveFileConflictPrompt,
  onCloseNodeActionEditor,
  onSaveCanvasNodeAction,
  onExecuteNodeActionDraft
}: EditorOverlaysProps) {
  return (
    <>
      {fileDropFeedback ? <FileDropFeedbackBadge feedback={fileDropFeedback} /> : null}
      {fileWorkflowError ? <FileWorkflowErrorBanner error={fileWorkflowError} onClose={onCloseFileWorkflowError} /> : null}
      {unsavedPrompt ? <UnsavedFilePrompt prompt={unsavedPrompt} onResolve={onResolveUnsavedPrompt} /> : null}
      {fileConflictPrompt ? <FileConflictPrompt fileName={fileConflictPrompt.fileName} path={fileConflictPrompt.path} onResolve={onResolveFileConflictPrompt} /> : null}
      {nodeActionEditorNode ? (
        <NodeActionEditorDialog
          node={nodeActionEditorNode}
          projectFiles={projectFiles}
          onClose={onCloseNodeActionEditor}
          onSave={onSaveCanvasNodeAction}
          onTestOpen={onExecuteNodeActionDraft}
        />
      ) : null}
      {markdownDocumentDialog ? <MarkdownDocumentDialog {...markdownDocumentDialog} /> : null}
      {htmlDocumentDialog ? <HtmlDocumentDialog {...htmlDocumentDialog} /> : null}
      {csvTableDialog ? <CsvTableDialog {...csvTableDialog} /> : null}
      {statusMessages && status ? (
        <EditorStatusBadge
          className="editor-ui-surface pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 px-3 py-2 text-muted-foreground"
          style={{ zIndex: OVERLAY_Z_INDEX.statusToast }}
          data-overlay-layer="status"
          data-overlay-scope-id="application"
        >
          {status}
        </EditorStatusBadge>
      ) : null}
    </>
  );
}
