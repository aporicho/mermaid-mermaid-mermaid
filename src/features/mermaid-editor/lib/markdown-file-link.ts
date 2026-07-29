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

export function resolveMarkdownFileWindowTarget(
  href: string,
  sourceFilePath: string | undefined,
  workspace: ProjectWorkspace | null | undefined
): MarkdownFileWindowTarget | null {
  const targetPath = localPathFromMarkdownHref(href);
  const kind = targetPath ? markdownFileWindowKind(targetPath) : null;
  if (!targetPath || !kind) return null;

  return {
    kind,
    file: resolveLinkedProjectFile(targetPath, sourceFilePath, workspace)
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
  workspace: ProjectWorkspace | null | undefined
): ProjectFileEntry {
  const absolutePath = isAbsoluteRuntimePath(targetPath)
    ? targetPath
    : joinRuntimePath(parentDirectoryPath(sourceFilePath) || workspace?.rootPath, targetPath);
  const absoluteKey = comparablePath(absolutePath);
  const relativeKey = comparablePath(targetPath);
  const sourceProjectFile = projectFiles(workspace).find((file) => comparablePath(file.path) === comparablePath(sourceFilePath || ""));
  const sourceRelativePath = sourceProjectFile?.relativePath;
  const sourceRelativeTarget = sourceRelativePath
    ? comparablePath(joinRuntimePath(parentDirectoryPath(sourceRelativePath), targetPath))
    : "";

  const projectFile = projectFiles(workspace).find((file) => {
    const pathKey = comparablePath(file.path);
    const fileRelativeKey = comparablePath(file.relativePath);
    return pathKey === absoluteKey
      || fileRelativeKey === relativeKey
      || Boolean(sourceRelativeTarget && fileRelativeKey === sourceRelativeTarget);
  });
  if (projectFile) return projectFile;

  return {
    name: runtimeFileNameFromPath(absolutePath || targetPath),
    path: absolutePath || targetPath,
    relativePath: targetPath
  };
}

function projectFiles(workspace: ProjectWorkspace | null | undefined) {
  const files = [
    ...(workspace?.files || []),
    ...(workspace?.resources || [])
      .filter((resource) => resource.kind === "file")
      .map((resource) => ({
        name: resource.name,
        path: resource.path,
        relativePath: resource.relativePath,
        ...(resource.modifiedAt === undefined ? {} : { modifiedAt: resource.modifiedAt })
      }))
  ];
  return files.filter((file, index) => files.findIndex((candidate) => comparablePath(candidate.path) === comparablePath(file.path)) === index);
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

function comparablePath(value: string) {
  const path = value.trim().replaceAll("\\", "/");
  if (!path) return "";
  const drive = path.match(/^[A-Za-z]:/)?.[0] || "";
  const rooted = path.startsWith("/") || Boolean(drive);
  const prefix = drive ? `${drive}/` : path.startsWith("/") ? "/" : "";
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
  const normalized = `${prefix}${segments.join("/")}`.replace(/\/$/, "");
  return drive ? normalized.toLowerCase() : normalized;
}
