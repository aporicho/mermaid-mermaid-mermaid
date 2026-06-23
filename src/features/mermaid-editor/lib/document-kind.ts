export type DocumentKind = "mermaid" | "markdown";

export const MERMAID_FILE_EXTENSIONS = [".mmd", ".mermaid"] as const;
export const MARKDOWN_FILE_EXTENSIONS = [".md", ".markdown"] as const;
export const DOCUMENT_FILE_EXTENSIONS = [...MERMAID_FILE_EXTENSIONS, ...MARKDOWN_FILE_EXTENSIONS] as const;

export function documentKindFromPath(path: string | undefined): DocumentKind | undefined {
  if (!path) return undefined;
  const lowered = path.toLowerCase();
  if (MERMAID_FILE_EXTENSIONS.some((extension) => lowered.endsWith(extension))) return "mermaid";
  if (MARKDOWN_FILE_EXTENSIONS.some((extension) => lowered.endsWith(extension))) return "markdown";
  return undefined;
}

export function isSupportedMermaidFilePath(path: string | undefined) {
  return documentKindFromPath(path) === "mermaid";
}

export function isSupportedMarkdownFilePath(path: string | undefined) {
  return documentKindFromPath(path) === "markdown";
}

export function isSupportedDocumentFilePath(path: string | undefined) {
  return Boolean(documentKindFromPath(path));
}

export function ensureDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  const fallbackName = documentKind === "markdown" ? "document.md" : "diagram.mmd";
  const name = value?.trim() || fallbackName;
  const kind = documentKindFromPath(name);
  if (kind === documentKind) return name;
  const extension = documentKind === "markdown" ? ".md" : ".mmd";
  return `${name.replace(/\.[^.]+$/, "")}${extension}`;
}

export function documentKindLabel(documentKind: DocumentKind) {
  return documentKind === "markdown" ? "Markdown" : "Mermaid";
}
