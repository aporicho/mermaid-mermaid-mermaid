export type DocumentKind = "mermaid" | "markdown" | "canvas";

export type DocumentKindDescriptor = {
  kind: DocumentKind;
  label: string;
  defaultFileName: string;
  extensions: readonly string[];
};

export const MERMAID_FILE_EXTENSIONS = [".mmd", ".mermaid"] as const;
export const MARKDOWN_FILE_EXTENSIONS = [".md", ".markdown"] as const;
export const CANVAS_FILE_EXTENSIONS = [".canvas.json"] as const;
export const DOCUMENT_KIND_DESCRIPTORS = [
  {
    kind: "mermaid",
    label: "Mermaid",
    defaultFileName: "diagram.mmd",
    extensions: MERMAID_FILE_EXTENSIONS
  },
  {
    kind: "markdown",
    label: "Markdown",
    defaultFileName: "document.md",
    extensions: MARKDOWN_FILE_EXTENSIONS
  },
  {
    kind: "canvas",
    label: "无限画布",
    defaultFileName: "board.canvas.json",
    extensions: CANVAS_FILE_EXTENSIONS
  }
] as const satisfies readonly DocumentKindDescriptor[];
export const DOCUMENT_FILE_EXTENSIONS = DOCUMENT_KIND_DESCRIPTORS.flatMap((descriptor) => [...descriptor.extensions]);

export function documentKindFromPath(path: string | undefined): DocumentKind | undefined {
  if (!path) return undefined;
  const lowered = path.toLowerCase();
  const descriptor = DOCUMENT_KIND_DESCRIPTORS.find((item) => item.extensions.some((extension) => lowered.endsWith(extension)));
  if (descriptor) return descriptor.kind;
  return undefined;
}

export function isSupportedMermaidFilePath(path: string | undefined) {
  return documentKindFromPath(path) === "mermaid";
}

export function isSupportedMarkdownFilePath(path: string | undefined) {
  return documentKindFromPath(path) === "markdown";
}

export function isSupportedCanvasFilePath(path: string | undefined) {
  return documentKindFromPath(path) === "canvas";
}

export function isSupportedDocumentFilePath(path: string | undefined) {
  return Boolean(documentKindFromPath(path));
}

export function ensureDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  const descriptor = documentKindDescriptor(documentKind);
  const name = value?.trim() || descriptor.defaultFileName;
  const kind = documentKindFromPath(name);
  if (kind === documentKind) return name;
  const extension = descriptor.extensions[0] || "";
  return `${stripKnownDocumentExtension(name).replace(/\.[^.]+$/, "")}${extension}`;
}

export function documentKindLabel(documentKind: DocumentKind) {
  return documentKindDescriptor(documentKind).label;
}

export function documentKindDescriptor(documentKind: DocumentKind) {
  return DOCUMENT_KIND_DESCRIPTORS.find((descriptor) => descriptor.kind === documentKind) || DOCUMENT_KIND_DESCRIPTORS[0];
}

function stripKnownDocumentExtension(value: string) {
  const lowered = value.toLowerCase();
  const extension = DOCUMENT_FILE_EXTENSIONS.find((item) => lowered.endsWith(item));
  return extension ? value.slice(0, -extension.length) : value;
}
