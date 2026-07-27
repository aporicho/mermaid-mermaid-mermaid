import { useEffect, type ComponentProps } from "react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
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
import type { UnsavedPromptChoice } from "@/features/mermaid-editor/lib/desktop-close-workflow";
import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import type { FileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import type { RuntimeDocumentSnapshot } from "@/features/mermaid-editor/lib/editor-runtime";
import { DocumentMergeDialog } from "@/features/mermaid-editor/components/document-merge-dialog";

type EditorOverlaysProps = {
  fileDropFeedback: FileDropFeedback | null;
  fileWorkflowError: FileWorkflowError | null;
  unsavedPrompt: UnsavedPromptState | null;
  fileConflictPrompt: FileConflictPromptState | null;
  documentConflict: RuntimeDocumentSnapshot | null;
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
  onResolveDocumentConflict: (content: string, diskRevision: string | null) => Promise<void>;
  onCloseNodeActionEditor: () => void;
  onSaveCanvasNodeAction: (nodeId: string, action: CanvasNodeAction | undefined) => void;
  onExecuteNodeActionDraft: (action: CanvasNodeAction) => void;
};

export function EditorOverlays({
  fileDropFeedback,
  fileWorkflowError,
  unsavedPrompt,
  fileConflictPrompt,
  documentConflict,
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
  onResolveDocumentConflict,
  onCloseNodeActionEditor,
  onSaveCanvasNodeAction,
  onExecuteNodeActionDraft
}: EditorOverlaysProps) {
  useEffect(() => {
    if (!statusMessages || !status) return;
    toast(status, { id: "editor-status", duration: 2400 });
  }, [status, statusMessages]);

  return (
    <>
      {fileDropFeedback ? <FileDropFeedbackBadge feedback={fileDropFeedback} /> : null}
      {fileWorkflowError ? <FileWorkflowErrorBanner error={fileWorkflowError} onClose={onCloseFileWorkflowError} /> : null}
      {unsavedPrompt ? <UnsavedFilePrompt prompt={unsavedPrompt} onResolve={onResolveUnsavedPrompt} /> : null}
      {fileConflictPrompt ? <FileConflictPrompt fileName={fileConflictPrompt.fileName} path={fileConflictPrompt.path} onResolve={onResolveFileConflictPrompt} /> : null}
      {documentConflict?.conflict ? <DocumentMergeDialog key={`${documentConflict.documentId}:${documentConflict.conflict.diskRevision}:${documentConflict.workingRevision}`} snapshot={documentConflict} onResolve={onResolveDocumentConflict} /> : null}
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
      <Toaster position="bottom-center" visibleToasts={1} />
    </>
  );
}
