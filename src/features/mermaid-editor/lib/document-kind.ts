export type DocumentKind = "mermaid" | "markdown" | "canvas";

export type DocumentWorkspaceView = "canvas" | "render" | "source" | "markdown";
export type DocumentWorkspaceProfile = "default" | "flowchart";

export type DocumentWorkspaceViewProfile = {
  defaultView: DocumentWorkspaceView;
  views: readonly DocumentWorkspaceView[];
};

export type DocumentKindDescriptor = {
  kind: DocumentKind;
  label: string;
  defaultFileName: string;
  extensions: readonly string[];
  workspace: {
    default: DocumentWorkspaceViewProfile;
    flowchart?: DocumentWorkspaceViewProfile;
  };
};

export const MERMAID_FILE_EXTENSIONS = [".mmd", ".mermaid"] as const;
export const MARKDOWN_FILE_EXTENSIONS = [".md", ".markdown"] as const;
export const CANVAS_FILE_EXTENSIONS = [".canvas.json"] as const;
export const DOCUMENT_KIND_DESCRIPTORS = [
  {
    kind: "mermaid",
    label: "Mermaid",
    defaultFileName: "diagram.mmd",
    extensions: MERMAID_FILE_EXTENSIONS,
    workspace: {
      default: {
        defaultView: "render",
        views: ["render", "source"]
      },
      flowchart: {
        defaultView: "canvas",
        views: ["canvas", "render", "source"]
      }
    }
  },
  {
    kind: "markdown",
    label: "Markdown",
    defaultFileName: "document.md",
    extensions: MARKDOWN_FILE_EXTENSIONS,
    workspace: {
      default: {
        defaultView: "markdown",
        views: ["markdown", "source"]
      }
    }
  },
  {
    kind: "canvas",
    label: "无限画布",
    defaultFileName: "board.canvas.json",
    extensions: CANVAS_FILE_EXTENSIONS,
    workspace: {
      default: {
        defaultView: "canvas",
        views: ["canvas"]
      }
    }
  }
] as const satisfies readonly DocumentKindDescriptor[];
export const DOCUMENT_KIND_REGISTRY = DOCUMENT_KIND_DESCRIPTORS;
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

export function documentKindDescriptor(documentKind: DocumentKind): DocumentKindDescriptor {
  return DOCUMENT_KIND_DESCRIPTORS.find((descriptor) => descriptor.kind === documentKind) || DOCUMENT_KIND_DESCRIPTORS[0];
}

export function documentKindWorkspaceProfile(documentKind: DocumentKind, profile: DocumentWorkspaceProfile = "default") {
  const descriptor = documentKindDescriptor(documentKind);
  if (profile === "flowchart" && descriptor.workspace.flowchart) return descriptor.workspace.flowchart;
  return descriptor.workspace.default;
}

export function documentKindWorkspaceViews(documentKind: DocumentKind, profile: DocumentWorkspaceProfile = "default") {
  return documentKindWorkspaceProfile(documentKind, profile).views;
}

export function documentKindDefaultWorkspaceView(documentKind: DocumentKind, profile: DocumentWorkspaceProfile = "default") {
  return documentKindWorkspaceProfile(documentKind, profile).defaultView;
}

export function documentKindSupportsWorkspaceView(documentKind: DocumentKind, view: DocumentWorkspaceView, profile: DocumentWorkspaceProfile = "default") {
  return documentKindWorkspaceViews(documentKind, profile).includes(view);
}

export function nextDocumentKindWorkspaceView(documentKind: DocumentKind, current: DocumentWorkspaceView, profile: DocumentWorkspaceProfile = "default") {
  const views = documentKindWorkspaceViews(documentKind, profile);
  const index = views.indexOf(current);
  if (index < 0) return documentKindDefaultWorkspaceView(documentKind, profile);
  return views[(index + 1) % views.length] || documentKindDefaultWorkspaceView(documentKind, profile);
}

function stripKnownDocumentExtension(value: string) {
  const lowered = value.toLowerCase();
  const extension = DOCUMENT_FILE_EXTENSIONS.find((item) => lowered.endsWith(item));
  return extension ? value.slice(0, -extension.length) : value;
}
