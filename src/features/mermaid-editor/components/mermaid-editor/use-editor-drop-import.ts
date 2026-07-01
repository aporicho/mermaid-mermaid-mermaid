import type { DragEvent as ReactDragEvent } from "react";

import type { DropPoint, FileDropCandidate } from "@/features/mermaid-editor/lib/file-drop";

export type BrowserDroppedFile = FileDropCandidate & {
  file: File;
  name: string;
};

export function browserDroppedFiles(dataTransfer: DataTransfer): BrowserDroppedFile[] {
  return Array.from(dataTransfer.files).map((file) => ({
    file,
    name: file.name,
    path: exposedDroppedFilePath(file)
  }));
}

export function isExternalFileDrag(dataTransfer: DataTransfer | null) {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes("Files"));
}

export function dragEventDropPoint(event: ReactDragEvent<HTMLElement>): DropPoint {
  return { x: event.clientX, y: event.clientY };
}

function exposedDroppedFilePath(file: File) {
  const path = (file as File & { path?: unknown }).path;
  return typeof path === "string" && path ? path : undefined;
}
