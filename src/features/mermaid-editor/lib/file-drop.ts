import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { isSupportedMermaidFilePath } from "@/features/mermaid-editor/lib/file-workflow";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";

export type DropPoint = {
  x: number;
  y: number;
};

export type FileDropCandidate = {
  path?: string;
};

export type FileDropClassification<T extends FileDropCandidate> =
  | { kind: "mermaid"; file: T }
  | { kind: "image"; file: T }
  | { kind: "unsupported"; file?: T };

export type DropSurfaceRect = {
  left: number;
  top: number;
};

export function classifyFileDrop<T extends FileDropCandidate>(files: T[]): FileDropClassification<T> {
  const mermaidFile = files.find((file) => isSupportedMermaidFilePath(file.path));
  if (mermaidFile) return { kind: "mermaid", file: mermaidFile };

  const imageFile = files.find((file) => isSupportedImagePath(file.path));
  if (imageFile) return { kind: "image", file: imageFile };

  return { kind: "unsupported", file: files[0] };
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
