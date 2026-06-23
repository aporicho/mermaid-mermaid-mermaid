import type { EditableKind } from "@/features/mermaid-editor/lib/editor-types";

export type WorkspaceView = "canvas" | "render" | "source";

export function normalizeWorkspaceView(value: unknown): WorkspaceView | undefined {
  return value === "canvas" || value === "render" || value === "source" ? value : undefined;
}

export function workspaceViewForDocument(editableKind: EditableKind, value: unknown): WorkspaceView {
  const view = normalizeWorkspaceView(value);
  if (editableKind === "flowchart") return view || "canvas";
  return view === "source" ? "source" : "render";
}

export function nextWorkspaceView(current: WorkspaceView, editableKind: EditableKind): WorkspaceView {
  if (editableKind !== "flowchart") return current === "source" ? "render" : "source";
  if (current === "canvas") return "render";
  if (current === "render") return "source";
  return "canvas";
}
