import { ensureDocumentFileName, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";

export const EDITOR_DRAFT_STORAGE_KEY = "mermaid-canvas-editor:v1";

export function ensureRuntimeMermaidFileName(value: string | undefined) {
  return ensureRuntimeDocumentFileName(value, "mermaid");
}

export function ensureRuntimeDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  return ensureDocumentFileName(value, documentKind);
}

export function isRuntimeAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function openExternalUrl(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function isExternalAssetSrc(src: string) {
  return /^(https?:|data:|blob:|asset:|tauri:)/i.test(src);
}
