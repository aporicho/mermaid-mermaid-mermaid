import {
  DOCUMENT_FILE_EXTENSIONS,
  type DocumentKind
} from "@/features/mermaid-editor/lib/document-kind";
import { ensureRuntimeDocumentFileName } from "@/features/mermaid-editor/lib/editor-runtime/shared";
import type { BrowserFileHandle } from "@/features/mermaid-editor/lib/editor-runtime/types";

export type BrowserFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<BrowserFileHandle>;
};

export const FILE_PICKER_TYPES = [
  {
    description: "项目文档",
    accept: {
      "text/plain": DOCUMENT_FILE_EXTENSIONS.filter((extension) => extension !== ".canvas.json"),
      "application/json": [".canvas.json"]
    }
  }
];

export async function writeDocumentToHandle(handle: BrowserFileHandle, documentText: string) {
  const writable = await handle.createWritable();
  await writable.write(documentText);
  await writable.close();
}

export function downloadTextDocument(documentText: string, name: string, documentKind: DocumentKind) {
  const blob = new Blob([documentText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureRuntimeDocumentFileName(name, documentKind);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
