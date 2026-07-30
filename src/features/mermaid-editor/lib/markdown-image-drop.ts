import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

export type ClientPoint = { x: number; y: number };

export type MarkdownImageDropContext = {
  imageFile: ProjectFileEntry;
  documentFile: RuntimeFileRef;
  point: ClientPoint;
};

export type MarkdownImageDropTarget = {
  element: HTMLElement;
  documentFile: RuntimeFileRef;
  isEditable: () => boolean;
  preview: (context: MarkdownImageDropContext) => void;
  clearPreview: () => void;
  insertAtClientPoint: (context: MarkdownImageDropContext) => void;
};

export type MarkdownImageDropRequest =
  | { imageFile: ProjectFileEntry; point: ClientPoint; phase: "move" | "drop" }
  | { phase: "cancel" };

export type MarkdownImageDropRouteResult = {
  handled: boolean;
  target: MarkdownImageDropTarget | null;
};

export type MarkdownImageDropController = {
  register: (target: MarkdownImageDropTarget) => () => void;
  route: (request: MarkdownImageDropRequest) => MarkdownImageDropRouteResult;
  targetAtPoint: (point: ClientPoint) => MarkdownImageDropTarget | null;
  clear: () => void;
};

export function createMarkdownImageDropController(
  documentProvider: () => Document | null = () => typeof document === "undefined" ? null : document
): MarkdownImageDropController {
  const targets = new Map<symbol, MarkdownImageDropTarget>();
  let active: { key: symbol; target: MarkdownImageDropTarget } | null = null;

  function clearActivePreview() {
    if (!active) return false;
    active.target.clearPreview();
    active = null;
    return true;
  }

  function targetEntryAtPoint(point: ClientPoint) {
    const hit = documentProvider()?.elementFromPoint(point.x, point.y);
    if (!hit) return null;

    let cursor: Element | null = hit;
    while (cursor) {
      const registrations = Array.from(targets.entries());
      for (let index = registrations.length - 1; index >= 0; index -= 1) {
        const [key, target] = registrations[index];
        if (target.element === cursor && target.element.isConnected && target.isEditable()) return { key, target };
      }
      cursor = cursor.parentElement;
    }
    return null;
  }

  function route(request: MarkdownImageDropRequest): MarkdownImageDropRouteResult {
    if (request.phase === "cancel") {
      const target = active?.target ?? null;
      return { handled: clearActivePreview(), target };
    }

    const entry = targetEntryAtPoint(request.point);
    if (!entry) {
      clearActivePreview();
      return { handled: false, target: null };
    }

    if (active?.key !== entry.key) {
      clearActivePreview();
      active = entry;
    }
    const context = { imageFile: request.imageFile, documentFile: entry.target.documentFile, point: request.point };
    if (request.phase === "move") {
      entry.target.preview(context);
      return { handled: true, target: entry.target };
    }

    clearActivePreview();
    entry.target.insertAtClientPoint(context);
    return { handled: true, target: entry.target };
  }

  return {
    register(target) {
      const key = Symbol("markdown-image-drop-target");
      targets.set(key, target);
      return () => {
        if (active?.key === key) clearActivePreview();
        targets.delete(key);
      };
    },
    route,
    targetAtPoint(point) {
      return targetEntryAtPoint(point)?.target ?? null;
    },
    clear() {
      clearActivePreview();
      targets.clear();
    }
  };
}

export const markdownImageDropController = createMarkdownImageDropController();
