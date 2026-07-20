import type { ComponentProps } from "react";

import {
  FileDropFeedbackBadge,
  FileWorkflowErrorBanner,
  UnsavedFilePrompt,
  type FileDropFeedback
} from "@/features/mermaid-editor/components/file-workflow-feedback";
import type { UnsavedPromptState } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { NodeActionEditorDialog } from "@/features/mermaid-editor/components/node-action-editor-dialog";
import { MarkdownDocumentDialog } from "@/features/mermaid-editor/components/markdown-document-dialog";
import type { UnsavedPromptChoice } from "@/features/mermaid-editor/lib/desktop-close-workflow";
import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import type { FileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

type EditorOverlaysProps = {
  fileDropFeedback: FileDropFeedback | null;
  fileWorkflowError: FileWorkflowError | null;
  unsavedPrompt: UnsavedPromptState | null;
  nodeActionEditorNode?: CanvasNode;
  markdownDocumentDialog?: ComponentProps<typeof MarkdownDocumentDialog>;
  projectFiles: ProjectFileEntry[];
  status: string;
  statusMessages: boolean;
  onCloseFileWorkflowError: () => void;
  onResolveUnsavedPrompt: (choice: UnsavedPromptChoice) => void;
  onCloseNodeActionEditor: () => void;
  onSaveCanvasNodeAction: (nodeId: string, action: CanvasNodeAction | undefined) => void;
  onExecuteNodeActionDraft: (action: CanvasNodeAction) => void;
};

export function EditorOverlays({
  fileDropFeedback,
  fileWorkflowError,
  unsavedPrompt,
  nodeActionEditorNode,
  markdownDocumentDialog,
  projectFiles,
  status,
  statusMessages,
  onCloseFileWorkflowError,
  onResolveUnsavedPrompt,
  onCloseNodeActionEditor,
  onSaveCanvasNodeAction,
  onExecuteNodeActionDraft
}: EditorOverlaysProps) {
  return (
    <>
      {fileDropFeedback ? <FileDropFeedbackBadge feedback={fileDropFeedback} /> : null}
      {fileWorkflowError ? <FileWorkflowErrorBanner error={fileWorkflowError} onClose={onCloseFileWorkflowError} /> : null}
      {unsavedPrompt ? <UnsavedFilePrompt prompt={unsavedPrompt} onResolve={onResolveUnsavedPrompt} /> : null}
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
      {statusMessages && status ? (
        <div
          className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur"
          style={{ zIndex: OVERLAY_Z_INDEX.statusToast }}
        >
          {status}
        </div>
      ) : null}
    </>
  );
}
