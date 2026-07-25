import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime/types";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export type RuntimeProjectFileKind = DocumentKind | "csv" | "html";

export type RuntimeCreateProjectDocumentResult =
  | { status: "created"; file: RuntimeFileRef; text: string }
  | { status: "exists"; file: RuntimeFileRef }
  | { status: "unsupported"; message: string };

export type RuntimeProjectFolderResult =
  | { status: "opened"; workspace: ProjectWorkspace }
  | { status: "cancelled" }
  | { status: "unsupported"; message: string };

export type RuntimeCreateProjectFileRequest = {
  rootPath: string;
  directoryPath: string;
  fileName: string;
  kind: RuntimeProjectFileKind;
  text: string;
};

export type RuntimeCreateProjectFileResult =
  | { status: "created"; file: RuntimeFileRef; text: string }
  | { status: "exists"; file: RuntimeFileRef }
  | { status: "unsupported"; message: string };

export type RuntimeMoveProjectFileRequest = {
  rootPath: string;
  sourcePath: string;
  targetDirectoryPath: string;
};

export type RuntimeMoveProjectFileResult =
  | { status: "moved"; file: RuntimeFileRef; sourcePath: string }
  | { status: "exists" | "noop"; file: RuntimeFileRef }
  | { status: "unsupported"; message: string };

export type RuntimeProjectResourceKind = "file" | "directory";

export type RuntimeProjectResourceRef = {
  kind: RuntimeProjectResourceKind;
  name: string;
  path: string;
  relativePath: string;
};

export type RuntimeCreateProjectDirectoryRequest = {
  rootPath: string;
  directoryPath: string;
  directoryName: string;
};

export type RuntimeCreateProjectDirectoryResult =
  | { status: "created" | "exists"; resource: RuntimeProjectResourceRef }
  | { status: "unsupported"; message: string };

export type RuntimeRenameProjectResourceRequest = {
  rootPath: string;
  sourcePath: string;
  name: string;
};

export type RuntimeRenameProjectResourceResult =
  | { status: "renamed" | "exists" | "noop"; resource: RuntimeProjectResourceRef; sourcePath: string }
  | { status: "unsupported"; message: string };

export type RuntimeProjectResourceMutationRequest = {
  rootPath: string;
  sourcePaths: string[];
  targetDirectoryPath: string;
  placement?: RuntimeProjectResourcePlacement;
};

export type RuntimeProjectResourcePlacement = {
  kind: RuntimeProjectResourceKind;
  parentDirectoryPath: string;
  beforeRelativePath?: string | null;
};

export type RuntimeProjectResourceMutationItem = {
  status: "moved" | "copied" | "imported" | "exists" | "noop";
  resource: RuntimeProjectResourceRef;
  sourcePath: string;
};

export type RuntimeProjectResourceMutationResult =
  | { status: "completed"; results: RuntimeProjectResourceMutationItem[] }
  | { status: "unsupported"; message: string };

export type RuntimeReorderProjectResourcesRequest = {
  rootPath: string;
  parentDirectoryPath: string;
  kind: RuntimeProjectResourceKind;
  orderedRelativePaths: string[];
};

export type RuntimeReorderProjectResourcesResult =
  | { status: "saved" }
  | { status: "unsupported"; message: string };

export type RuntimeImportProjectResourcesRequest = {
  rootPath: string;
  externalPaths: string[];
  targetDirectoryPath: string;
};

export type RuntimeDeleteProjectResourcesRequest = {
  rootPath: string;
  sourcePaths: string[];
};

export type RuntimeDeleteProjectResourcesResult =
  | { status: "deleted"; resources: RuntimeProjectResourceRef[] }
  | { status: "unsupported"; message: string };

export type RuntimeShowProjectResourceRequest = {
  rootPath: string;
  path: string;
};

export type RuntimeShowProjectResourceResult =
  | { status: "shown"; resource: RuntimeProjectResourceRef }
  | { status: "unsupported"; message: string };

export type RuntimeProjectFileOperations = {
  createProjectDocument: (request: { rootPath: string; fileName: string; documentKind: DocumentKind; text: string }) => Promise<RuntimeCreateProjectDocumentResult>;
  createProjectFile: (request: RuntimeCreateProjectFileRequest) => Promise<RuntimeCreateProjectFileResult>;
  moveProjectFile: (request: RuntimeMoveProjectFileRequest) => Promise<RuntimeMoveProjectFileResult>;
  createProjectDirectory: (request: RuntimeCreateProjectDirectoryRequest) => Promise<RuntimeCreateProjectDirectoryResult>;
  renameProjectResource: (request: RuntimeRenameProjectResourceRequest) => Promise<RuntimeRenameProjectResourceResult>;
  moveProjectResources: (request: RuntimeProjectResourceMutationRequest) => Promise<RuntimeProjectResourceMutationResult>;
  reorderProjectResources: (request: RuntimeReorderProjectResourcesRequest) => Promise<RuntimeReorderProjectResourcesResult>;
  copyProjectResources: (request: RuntimeProjectResourceMutationRequest) => Promise<RuntimeProjectResourceMutationResult>;
  importProjectResources: (request: RuntimeImportProjectResourcesRequest) => Promise<RuntimeProjectResourceMutationResult>;
  deleteProjectResources: (request: RuntimeDeleteProjectResourcesRequest) => Promise<RuntimeDeleteProjectResourcesResult>;
  showProjectResourceInFileManager: (request: RuntimeShowProjectResourceRequest) => Promise<RuntimeShowProjectResourceResult>;
  openProjectFolder: () => Promise<RuntimeProjectFolderResult>;
  readProjectFolder: (rootPath: string) => Promise<RuntimeProjectFolderResult>;
};
