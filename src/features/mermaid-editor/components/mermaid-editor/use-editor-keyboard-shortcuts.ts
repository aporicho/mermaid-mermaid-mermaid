import { useEffect } from "react";

import {
  hasSelection,
  setMode as setEditorMode
} from "@/features/mermaid-editor/lib/editor-actions";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { shouldCreateGroupFromShortcut } from "@/features/mermaid-editor/lib/editor-keyboard-shortcuts";
import type { CanvasNode, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";

type UseEditorKeyboardShortcutsArgs = {
  graph: MermaidGraph;
  selection: Selection;
  isCanvasEditable: boolean;
  closeFloatingOverlays: () => boolean;
  saveMermaidFile: () => void | Promise<unknown>;
  saveMermaidFileAs: () => void | Promise<unknown>;
  createGroupFromSelection: (source: "keyboard" | "menu") => void;
  editCanvasNodeAction: (node: CanvasNode) => void;
  executeCanvasNodeAction: (node: CanvasNode) => void;
  performRedo: () => void;
  performUndo: () => void;
  performCopy: () => void;
  performPaste: () => void | Promise<void>;
  performDelete: () => void;
  setSpacePanning: (next: boolean) => void;
  applyEditorCommand: (command: EditorCommand) => void;
};

export function useEditorKeyboardShortcuts({
  graph,
  selection,
  isCanvasEditable,
  closeFloatingOverlays,
  saveMermaidFile,
  saveMermaidFileAs,
  createGroupFromSelection,
  editCanvasNodeAction,
  executeCanvasNodeAction,
  performRedo,
  performUndo,
  performCopy,
  performPaste,
  performDelete,
  setSpacePanning,
  applyEditorCommand
}: UseEditorKeyboardShortcutsArgs) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTerminalInput(event.target)) return;

      if (event.key === "Escape" && closeFloatingOverlays()) {
        event.preventDefault();
        return;
      }

      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (command && key === "s") {
        event.preventDefault();
        if (event.shiftKey) void saveMermaidFileAs();
        else void saveMermaidFile();
        return;
      }

      if (isTextInput(event.target)) return;
      if (!isCanvasEditable) return;

      if (shouldCreateGroupFromShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        editable: isCanvasEditable,
        hasSelection: hasSelection(selection)
      })) {
        event.preventDefault();
        createGroupFromSelection("keyboard");
        return;
      }

      if (command && key === "k") {
        const selectedNode = selectedNodeFromSelection(graph, selection);
        if (selectedNode) {
          event.preventDefault();
          editCanvasNodeAction(selectedNode);
        }
        return;
      }

      if (command && event.key === "Enter") {
        const selectedNode = selectedNodeFromSelection(graph, selection);
        if (selectedNode?.action) {
          event.preventDefault();
          executeCanvasNodeAction(selectedNode);
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePanning(true);
        return;
      }

      if (command && key === "z" && event.shiftKey) {
        event.preventDefault();
        performRedo();
        return;
      }
      if (command && key === "z") {
        event.preventDefault();
        performUndo();
        return;
      }
      if (command && key === "y") {
        event.preventDefault();
        performRedo();
        return;
      }
      if (command && key === "c") {
        event.preventDefault();
        performCopy();
        return;
      }
      if (command && key === "v") {
        event.preventDefault();
        void performPaste();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        performDelete();
        return;
      }
      if (key === "v") applyEditorCommand({ type: "mode.set", mode: setEditorMode("select"), source: "keyboard" });
      if (key === "l") applyEditorCommand({ type: "mode.set", mode: setEditorMode("connect"), source: "keyboard" });
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") setSpacePanning(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    applyEditorCommand,
    closeFloatingOverlays,
    createGroupFromSelection,
    editCanvasNodeAction,
    executeCanvasNodeAction,
    graph,
    isCanvasEditable,
    performCopy,
    performDelete,
    performPaste,
    performRedo,
    performUndo,
    saveMermaidFile,
    saveMermaidFileAs,
    selection,
    setSpacePanning
  ]);
}

function isTextInput(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
}

function isTerminalInput(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest(".terminal-panel"));
}

function selectedNodeFromSelection(graph: MermaidGraph, selection: Selection) {
  return graph.nodes.find((node) => node.id === selection.primaryId) || graph.nodes.find((node) => node.id === selection.nodeIds[0]);
}
