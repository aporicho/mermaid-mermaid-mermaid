import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type {
  EditorDocumentBuffer,
  EditorDocumentSession
} from "@/features/mermaid-editor/lib/editor-document-session";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

type DocumentBufferInput = {
  documentKind: DocumentKind;
  fileName: string;
  fileRef: RuntimeFileRef | null;
  content: string;
  savedContent: string;
  status?: EditorDocumentBuffer["status"];
  bufferId?: string;
};

export type EditorDocumentSessionBindings = {
  editorSession: EditorDocumentSession;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  captureActiveDocumentBuffer: () => EditorDocumentSession;
  activateDocumentBuffer: (input: DocumentBufferInput) => EditorDocumentBuffer;
  registerDocumentBuffer: (input: DocumentBufferInput) => EditorDocumentBuffer;
  beginUntitledDocumentBuffer: (input: Omit<DocumentBufferInput, "fileRef" | "bufferId">) => EditorDocumentBuffer;
  findFileDocumentBuffer: (file: RuntimeFileRef | null | undefined) => EditorDocumentBuffer | null;
  markActiveDocumentBufferSaved: (file: RuntimeFileRef, content: string) => EditorDocumentSession;
  markDocumentBufferSaved: (bufferId: string, file: RuntimeFileRef, content: string) => EditorDocumentSession;
  updateDocumentBuffer: (bufferId: string, updates: Partial<Pick<EditorDocumentBuffer, "content" | "savedContent" | "revision" | "status" | "fileName" | "fileRef">>) => EditorDocumentSession;
  replaceEditorDocumentSession: (session: EditorDocumentSession) => EditorDocumentSession;
  discardAllDocumentChanges: () => EditorDocumentSession;
  reloadDocumentFromDisk: (text: string, name: string, file: RuntimeFileRef) => void;
};
