import { useCallback, useRef } from "react";

import type { ClipboardPayload, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { readClipboardImageFile } from "@/features/mermaid-editor/lib/clipboard-image";
import { extractNodeActionsFromClipboardText, nodeActionSuggestedLabel } from "@/features/mermaid-editor/lib/node-actions";

type UseEditorClipboardActionsArgs = {
  clipboard: ClipboardPayload | null;
  selection: Selection;
  viewport: ViewportState;
  lastWindowFocusAtRef: { current: number };
  lastCanvasPointerWorldRef: { current: { x: number; y: number } | null };
  applyEditorCommand: (command: EditorCommand) => void;
  pasteClipboardImage?: (file: File) => Promise<void>;
};

export function useEditorClipboardActions({
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
    const actions = extractNodeActionsFromClipboardText(systemClipboardText);

    if (actions.length) {
      const basePoint = lastCanvasPointerWorldRef.current || {
        x: (420 - viewport.x) / viewport.scale,
        y: (260 - viewport.y) / viewport.scale
      };
      applyEditorCommand({
        type: "graph.addNodesAt",
        nodes: actions.map((action, index) => ({
          point: {
            x: basePoint.x,
            y: basePoint.y + index * 104
          },
          label: nodeActionSuggestedLabel(action),
          action
        })),
        message: actions.length > 1 ? `已从剪贴板添加 ${actions.length} 个链接节点。` : "已从剪贴板添加链接节点。",
        source: "keyboard"
      });
      return;
    }

    if (!clipboard) return;
    applyEditorCommand({ type: "graph.pasteClipboard", payload: clipboard, source: "keyboard" });
  }, [applyEditorCommand, clipboard, lastCanvasPointerWorldRef, lastWindowFocusAtRef, pasteClipboardImage, viewport]);

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
