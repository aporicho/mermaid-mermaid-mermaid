import type { EditorHistory, EditorSnapshot } from "@/features/mermaid-editor/lib/editor-types";

const MAX_HISTORY = 80;

export function createHistory(): EditorHistory {
  return { undoStack: [], redoStack: [] };
}

export function pushHistory(history: EditorHistory, snapshot: EditorSnapshot): EditorHistory {
  return {
    undoStack: [...history.undoStack, snapshot].slice(-MAX_HISTORY),
    redoStack: []
  };
}

export function undo(history: EditorHistory, current: EditorSnapshot): { history: EditorHistory; snapshot: EditorSnapshot | null } {
  const snapshot = history.undoStack.at(-1) || null;
  if (!snapshot) return { history, snapshot: null };

  return {
    snapshot,
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, current].slice(-MAX_HISTORY)
    }
  };
}

export function redo(history: EditorHistory, current: EditorSnapshot): { history: EditorHistory; snapshot: EditorSnapshot | null } {
  const snapshot = history.redoStack.at(-1) || null;
  if (!snapshot) return { history, snapshot: null };

  return {
    snapshot,
    history: {
      undoStack: [...history.undoStack, current].slice(-MAX_HISTORY),
      redoStack: history.redoStack.slice(0, -1)
    }
  };
}
