import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { documentKindFromPath, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";

export type DropPoint = {
  x: number;
  y: number;
};

export type FileDropCandidate = {
  name?: string;
  path?: string;
};

export type FileDropClassification<T extends FileDropCandidate> =
  | { kind: "document"; documentKind: DocumentKind; file: T }
  | { kind: "image"; file: T }
  | { kind: "unsupported"; file?: T };

export type DropSurfaceRect = {
  left: number;
  top: number;
};

export function classifyFileDrop<T extends FileDropCandidate>(files: T[]): FileDropClassification<T> {
  const documentFile = files.find((file) => documentKindFromPath(fileDropIdentity(file)));
  if (documentFile) return { kind: "document", documentKind: documentKindFromPath(fileDropIdentity(documentFile))!, file: documentFile };

  const imageFile = files.find((file) => isSupportedImagePath(fileDropIdentity(file)));
  if (imageFile) return { kind: "image", file: imageFile };

  return { kind: "unsupported", file: files[0] };
}

function fileDropIdentity(file: FileDropCandidate) {
  return file.path || file.name;
}

export function windowPointToSurfacePoint(point: DropPoint, rect: DropSurfaceRect): DropPoint {
  return {
    x: point.x - rect.left,
    y: point.y - rect.top
  };
}

export function canvasScreenToWorldPoint(point: DropPoint, viewport: ViewportState): DropPoint {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale
  };
}
