import {
  Archive,
  Code,
  EmptyPage,
  Folder,
  Html5,
  JpgFormat,
  MediaImage,
  Network,
  Notes,
  Page,
  PngFormat,
  SvgFormat,
  TableRows,
  WebpFormat
} from "iconoir-react/regular";

import { isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";
import { isHtmlDocumentFilePath } from "@/features/mermaid-editor/lib/html-document";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import type { ProjectResourceEntry } from "@/features/mermaid-editor/lib/project-workspace";

export const PROJECT_RESOURCE_ICON_CLASS_NAME = "shrink-0";

const ARCHIVE_FILE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "7z", "rar", "bz2", "xz"]);
const CODE_FILE_EXTENSIONS = new Set(["js", "jsx", "ts", "tsx", "css", "scss", "sass", "json", "jsonc", "yaml", "yml", "xml", "toml", "cjs", "mjs", "py", "sh", "sql"]);
const TEXT_FILE_EXTENSIONS = new Set(["txt", "log", "rst"]);

export type ExplorerResourceStatus = "clean" | "dirty" | "saving" | "conflict" | "error" | "external-changed" | "missing" | "unsupported" | "readonly";

export function ProjectResourceIcon({ resource }: { resource: ProjectResourceEntry }) {
  const className = PROJECT_RESOURCE_ICON_CLASS_NAME;
  const extension = projectResourceExtension(resource);
  if (resource.kind === "directory") return <Folder className={className} data-project-resource-icon="folder" />;
  if (resource.documentKind === "mermaid") return <Network className={className} data-project-resource-icon="mermaid" />;
  if (resource.documentKind === "markdown") return <Notes className={className} data-project-resource-icon="markdown" />;
  if (isCsvTableFilePath(resource.path)) return <TableRows className={className} data-project-resource-icon="csv" />;
  if (isHtmlDocumentFilePath(resource.path)) return <Html5 className={className} data-project-resource-icon="html" />;
  if (extension === "png") return <PngFormat className={className} data-project-resource-icon="png" />;
  if (extension === "jpg" || extension === "jpeg") return <JpgFormat className={className} data-project-resource-icon="jpg" />;
  if (extension === "svg") return <SvgFormat className={className} data-project-resource-icon="svg" />;
  if (extension === "webp") return <WebpFormat className={className} data-project-resource-icon="webp" />;
  if (isSupportedImagePath(resource.path)) return <MediaImage className={className} data-project-resource-icon="image" />;
  if (ARCHIVE_FILE_EXTENSIONS.has(extension)) return <Archive className={className} data-project-resource-icon="archive" />;
  if (CODE_FILE_EXTENSIONS.has(extension)) return <Code className={className} data-project-resource-icon="code" />;
  if (TEXT_FILE_EXTENSIONS.has(extension)) return <Page className={className} data-project-resource-icon="text" />;
  return <EmptyPage className={className} data-project-resource-icon="file" />;
}

export function ProjectResourceStatusBadge({ status }: { status?: ExplorerResourceStatus }) {
  if (!status || status === "clean") return null;
  const meta = explorerResourceStatusMeta(status);
  return (
    <span className="ml-auto shrink-0 rounded-sm px-1 text-[10px] text-muted-foreground" title={meta.label} aria-label={meta.label}>
      {meta.mark}
    </span>
  );
}

function projectResourceExtension(resource: ProjectResourceEntry) {
  return resource.name.toLowerCase().split(".").at(-1) || "";
}

function explorerResourceStatusMeta(status: ExplorerResourceStatus) {
  if (status === "dirty") return { mark: "M", label: "未保存" };
  if (status === "saving") return { mark: "S", label: "保存中" };
  if (status === "conflict") return { mark: "!", label: "保存冲突" };
  if (status === "error") return { mark: "!", label: "错误" };
  if (status === "external-changed") return { mark: "*", label: "外部已变更" };
  if (status === "missing") return { mark: "?", label: "文件缺失" };
  if (status === "readonly") return { mark: "R", label: "只读" };
  return { mark: "-", label: "当前类型暂不支持打开" };
}
