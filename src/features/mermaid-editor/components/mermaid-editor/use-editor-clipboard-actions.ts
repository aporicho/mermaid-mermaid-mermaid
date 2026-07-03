import { useCallback, useRef } from "react";

import type { ClipboardPayload, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { actionNodesPasteCommand, contentCardsPasteCommand, pasteBasePoint } from "@/features/mermaid-editor/components/mermaid-editor/clipboard-paste-commands";
import { readClipboardImageFile } from "@/features/mermaid-editor/lib/clipboard-image";
import { resolveContentPluginCardsFromText } from "@/features/mermaid-editor/lib/content-plugins/registry";
import { extractNodeActionsFromClipboardText } from "@/features/mermaid-editor/lib/node-actions";

type UseEditorClipboardActionsArgs = {
  runtime: EditorRuntime;
  fileRef: RuntimeFileRef | null;
  clipboard: ClipboardPayload | null;
  selection: Selection;
  viewport: ViewportState;
  lastWindowFocusAtRef: { current: number };
  lastCanvasPointerWorldRef: { current: { x: number; y: number } | null };
  applyEditorCommand: (command: EditorCommand) => void;
  pasteClipboardImage?: (file: File) => Promise<void>;
};

export function useEditorClipboardActions({
  runtime,
  fileRef,
  clipboard,
  selection,
  viewport,
  lastWindowFocusAtRef,
  lastCanvasPointerWorldRef,
  applyEditorCommand,
  pasteClipboardImage
}: UseEditorClipboardActionsArgs) {
  const lastInternalCopyAtRef = useRef(0);

  const performCopy = useCallback(() => {
    if (!selection.nodeIds.length) return;
    lastInternalCopyAtRef.current = Date.now();
    applyEditorCommand({ type: "clipboard.copy", source: "keyboard" });
  }, [applyEditorCommand, selection.nodeIds.length]);

  const performPaste = useCallback(async () => {
    const canUseSystemClipboard = !clipboard || lastInternalCopyAtRef.current < lastWindowFocusAtRef.current;
    if (canUseSystemClipboard && pasteClipboardImage) {
      const clipboardImage = await readClipboardImageFile();
      if (clipboardImage.status === "ready") {
        await pasteClipboardImage(clipboardImage.file);
        return;
      }
    }

    const systemClipboardText = canUseSystemClipboard ? await readSystemClipboardText() : "";
    const pluginCards = systemClipboardText ? await resolveContentPluginCardsFromText(systemClipboardText, { runtime, fileRef }) : [];

    if (pluginCards.length) {
      const basePoint = pasteBasePoint(lastCanvasPointerWorldRef.current, viewport);
      applyEditorCommand(contentCardsPasteCommand(pluginCards, basePoint));
      return;
    }

    const actions = extractNodeActionsFromClipboardText(systemClipboardText);

    if (actions.length) {
      const basePoint = pasteBasePoint(lastCanvasPointerWorldRef.current, viewport);
      applyEditorCommand(actionNodesPasteCommand(actions, basePoint));
      return;
    }

    if (!clipboard) return;
    applyEditorCommand({ type: "graph.pasteClipboard", payload: clipboard, source: "keyboard" });
  }, [applyEditorCommand, clipboard, fileRef, lastCanvasPointerWorldRef, lastWindowFocusAtRef, pasteClipboardImage, runtime, viewport]);

  return { performCopy, performPaste };
}

async function readSystemClipboardText() {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return "";

  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}
