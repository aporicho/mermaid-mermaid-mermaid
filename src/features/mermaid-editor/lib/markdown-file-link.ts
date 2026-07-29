import { isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import { isHtmlDocumentFilePath } from "@/features/mermaid-editor/lib/html-document";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import {
  isAbsoluteRuntimePath,
  joinRuntimePath,
  parentDirectoryPath,
  runtimeFileNameFromPath
} from "@/features/mermaid-editor/lib/runtime-paths";
import { isTextDocumentFilePath } from "@/features/mermaid-editor/lib/text-document";

export type MarkdownFileWindowKind = "markdown" | "html" | "image" | "text" | "csv";

export type MarkdownFileWindowTarget = {
  kind: MarkdownFileWindowKind;
  file: ProjectFileEntry;
};

export type MarkdownFileLinkIndex = {
  readonly kind: "markdown-file-link-index";
  readonly rootPath: string;
  readonly filesByAbsolutePath: ReadonlyMap<string, ProjectFileEntry>;
  readonly filesByRelativePath: ReadonlyMap<string, ProjectFileEntry>;
};

export function createMarkdownFileLinkIndex(
  workspace: ProjectWorkspace | null | undefined
): MarkdownFileLinkIndex {
  const filesByAbsolutePath = new Map<string, ProjectFileEntry>();
  const filesByRelativePath = new Map<string, ProjectFileEntry>();

  const addFile = (file: ProjectFileEntry) => {
    const absoluteKey = comparablePath(file.path);
    if (!absoluteKey || filesByAbsolutePath.has(absoluteKey)) return;

    filesByAbsolutePath.set(absoluteKey, file);
    const relativeKey = comparablePath(file.relativePath);
    if (relativeKey && !filesByRelativePath.has(relativeKey)) {
      filesByRelativePath.set(relativeKey, file);
    }
  };

  for (const file of workspace?.files ?? []) addFile(file);
  for (const resource of workspace?.resources ?? []) {
    if (resource.kind !== "file") continue;
    addFile({
      name: resource.name,
      path: resource.path,
      relativePath: resource.relativePath,
      ...(resource.modifiedAt === undefined ? {} : { modifiedAt: resource.modifiedAt })
    });
  }

  return {
    kind: "markdown-file-link-index",
    rootPath: workspace?.rootPath ?? "",
    filesByAbsolutePath,
    filesByRelativePath
  };
}

export function resolveMarkdownFileWindowTarget(
  href: string,
  sourceFilePath: string | undefined,
  workspaceOrIndex: ProjectWorkspace | MarkdownFileLinkIndex | null | undefined
): MarkdownFileWindowTarget | null {
  const targetPath = localPathFromMarkdownHref(href);
  const kind = targetPath ? markdownFileWindowKind(targetPath) : null;
  if (!targetPath || !kind) return null;

  const index = isMarkdownFileLinkIndex(workspaceOrIndex)
    ? workspaceOrIndex
    : createMarkdownFileLinkIndex(workspaceOrIndex);

  return {
    kind,
    file: resolveLinkedProjectFile(targetPath, sourceFilePath, index)
  };
}

export function markdownFileWindowKind(path: string): MarkdownFileWindowKind | null {
  if (isSupportedMarkdownFilePath(path)) return "markdown";
  if (isHtmlDocumentFilePath(path)) return "html";
  if (isSupportedImagePath(path)) return "image";
  if (isTextDocumentFilePath(path)) return "text";
  if (isCsvTableFilePath(path)) return "csv";
  return null;
}

export function localPathFromMarkdownHref(href: string) {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return "";

  if (/^file:/i.test(trimmed)) return fileUrlToRuntimePath(trimmed);
  if (!isAbsoluteRuntimePath(trimmed) && /^[a-z][a-z\d+.-]*:/i.test(trimmed)) return "";

  const path = trimmed.slice(0, firstSuffixIndex(trimmed));
  return decodeUrlPath(path);
}

function resolveLinkedProjectFile(
  targetPath: string,
  sourceFilePath: string | undefined,
  index: MarkdownFileLinkIndex
): ProjectFileEntry {
  if (isAbsoluteRuntimePath(targetPath)) {
    return indexedFileOrFallback(normalizeRuntimePath(targetPath), targetPath, index);
  }

  if (isDocumentRelativePath(targetPath)) {
    const sourceDirectory = parentDirectoryPath(sourceFilePath);
    const absolutePath = normalizeRuntimePath(joinRuntimePath(sourceDirectory || index.rootPath, targetPath));
    return indexedFileOrFallback(absolutePath, targetPath, index);
  }

  // Bare relative paths deliberately resolve from the project root. Use ./ or ../
  // when a Markdown link should resolve from the source document's directory.
  const relativeKey = comparablePath(targetPath);
  const indexedRelativeFile = index.filesByRelativePath.get(relativeKey);
  if (indexedRelativeFile) return indexedRelativeFile;

  const absolutePath = normalizeRuntimePath(joinRuntimePath(index.rootPath, targetPath));
  return indexedFileOrFallback(absolutePath, targetPath, index);
}

function indexedFileOrFallback(
  absolutePath: string,
  relativePath: string,
  index: MarkdownFileLinkIndex
): ProjectFileEntry {
  const indexedFile = index.filesByAbsolutePath.get(comparablePath(absolutePath));
  if (indexedFile) return indexedFile;

  const fallbackPath = absolutePath || normalizeRuntimePath(relativePath);
  return {
    name: runtimeFileNameFromPath(fallbackPath),
    path: fallbackPath,
    relativePath
  };
}

function isDocumentRelativePath(path: string) {
  return /^\.\.?([\\/]|$)/.test(path);
}

function isMarkdownFileLinkIndex(
  value: ProjectWorkspace | MarkdownFileLinkIndex | null | undefined
): value is MarkdownFileLinkIndex {
  return Boolean(value && "kind" in value && value.kind === "markdown-file-link-index");
}

function firstSuffixIndex(value: string) {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : value.length;
}

function decodeUrlPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function fileUrlToRuntimePath(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "file:") return "";
    const pathname = decodeUrlPath(url.pathname);
    if (url.hostname && url.hostname !== "localhost") return `//${url.hostname}${pathname}`;
    return /^\/[A-Za-z]:\//.test(pathname) ? pathname.slice(1) : pathname;
  } catch {
    return "";
  }
}

function normalizeRuntimePath(value: string) {
  const path = value.trim().replaceAll("\\", "/");
  if (!path) return "";

  const drive = path.match(/^[A-Za-z]:/)?.[0] || "";
  const unc = path.startsWith("//");
  const rooted = path.startsWith("/") || Boolean(drive);
  const prefix = drive ? `${drive}/` : unc ? "//" : path.startsWith("/") ? "/" : "";
  const body = drive ? path.slice(drive.length).replace(/^\/+/, "") : path.replace(/^\/+/, "");
  const segments: string[] = [];
  for (const segment of body.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length && segments.at(-1) !== "..") segments.pop();
      else if (!rooted) segments.push(segment);
      continue;
    }
    segments.push(segment);
  }
  const normalized = `${prefix}${segments.join("/")}`;
  if (normalized === "/" || normalized === "//") return normalized;
  return normalized.replace(/\/$/, "");
}

function comparablePath(value: string) {
  const normalized = normalizeRuntimePath(value);
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith("//")
    ? normalized.toLowerCase()
    : normalized;
}
