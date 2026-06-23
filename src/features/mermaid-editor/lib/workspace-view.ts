import type { EditableKind } from "@/features/mermaid-editor/lib/editor-types";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";

export type WorkspaceView = "canvas" | "render" | "source" | "markdown";

export function normalizeWorkspaceView(value: unknown): WorkspaceView | undefined {
  return value === "canvas" || value === "render" || value === "source" || value === "markdown" ? value : undefined;
}

export function workspaceViewForDocument(editableKind: EditableKind, value: unknown, documentKind: DocumentKind = "mermaid"): WorkspaceView {
  const view = normalizeWorkspaceView(value);
  if (documentKind === "markdown") return view === "source" ? "source" : "markdown";
  if (editableKind === "flowchart") return view || "canvas";
  return view === "source" ? "source" : "render";
}

export function nextWorkspaceView(current: WorkspaceView, editableKind: EditableKind, documentKind: DocumentKind = "mermaid"): WorkspaceView {
  if (documentKind === "markdown") return current === "source" ? "markdown" : "source";
  if (editableKind !== "flowchart") return current === "source" ? "render" : "source";
  if (current === "canvas") return "render";
  if (current === "render") return "source";
  return "canvas";
}
