import type { EditableKind } from "@/features/mermaid-editor/lib/editor-types";
import {
  documentKindDefaultWorkspaceView,
  documentKindSupportsWorkspaceView,
  documentKindWorkspaceViews,
  nextDocumentKindWorkspaceView,
  type DocumentKind,
  type DocumentWorkspaceProfile,
  type DocumentWorkspaceView
} from "@/features/mermaid-editor/lib/document-kind";

export type WorkspaceView = DocumentWorkspaceView;

export function normalizeWorkspaceView(value: unknown): WorkspaceView | undefined {
  return value === "canvas" || value === "render" || value === "source" || value === "markdown" ? value : undefined;
}

export function workspaceViewForDocument(editableKind: EditableKind, value: unknown, documentKind: DocumentKind = "mermaid"): WorkspaceView {
  const view = normalizeWorkspaceView(value);
  const profile = workspaceProfileForDocument(editableKind, documentKind);
  if (view && documentKindSupportsWorkspaceView(documentKind, view, profile)) return view;
  return documentKindDefaultWorkspaceView(documentKind, profile);
}

export function nextWorkspaceView(current: WorkspaceView, editableKind: EditableKind, documentKind: DocumentKind = "mermaid"): WorkspaceView {
  return nextDocumentKindWorkspaceView(documentKind, current, workspaceProfileForDocument(editableKind, documentKind));
}

export function workspaceViewsForDocument(editableKind: EditableKind, documentKind: DocumentKind = "mermaid"): WorkspaceView[] {
  return [...documentKindWorkspaceViews(documentKind, workspaceProfileForDocument(editableKind, documentKind))];
}

function workspaceProfileForDocument(editableKind: EditableKind, documentKind: DocumentKind): DocumentWorkspaceProfile {
  return documentKind === "mermaid" && editableKind === "flowchart" ? "flowchart" : "default";
}
