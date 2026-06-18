import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

export type RecentFileEntry = {
  name: string;
  path: string;
  openedAt: number;
};

export type FileWorkflowErrorCode =
  | "file_not_found"
  | "permission_denied"
  | "unsupported_type"
  | "read_failed"
  | "write_failed"
  | "association_failed";

export type FileWorkflowError = {
  code: FileWorkflowErrorCode;
  message: string;
  path?: string;
};

export const RECENT_FILE_LIMIT = 10;
export const MERMAID_FILE_EXTENSIONS = [".mmd", ".mermaid"] as const;

type RuntimeErrorShape = {
  code?: unknown;
  message?: unknown;
  path?: unknown;
};

export function isSupportedMermaidFilePath(path: string | undefined) {
  if (!path) return false;
  const lowered = path.toLowerCase();
  return MERMAID_FILE_EXTENSIONS.some((extension) => lowered.endsWith(extension));
}

export function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "diagram.mmd";
}

export function runtimeFileRefFromPath(path: string): RuntimeFileRef {
  return {
    name: fileNameFromPath(path),
    path
  };
}

export function normalizeRecentFiles(value: unknown): RecentFileEntry[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<RecentFileEntry[]>((items, item) => {
    if (!item || typeof item !== "object") return items;
    const entry = item as Partial<RecentFileEntry>;
    if (!entry.path || !entry.name || typeof entry.path !== "string" || typeof entry.name !== "string") return items;
    return upsertRecentFile(items, { name: entry.name, path: entry.path }, Number(entry.openedAt) || 0);
  }, []);
}

export function upsertRecentFile(files: RecentFileEntry[], file: RuntimeFileRef | null | undefined, openedAt = Date.now()) {
  if (!file?.path) return files;
  const nextEntry: RecentFileEntry = {
    name: file.name || fileNameFromPath(file.path),
    path: file.path,
    openedAt
  };
  return [nextEntry, ...files.filter((item) => item.path !== nextEntry.path)]
    .sort((left, right) => right.openedAt - left.openedAt)
    .slice(0, RECENT_FILE_LIMIT);
}

export function normalizeFileWorkflowError(error: unknown, fallbackMessage = "文件操作失败。"): FileWorkflowError {
  const shaped = toRuntimeErrorShape(error);
  const code = normalizeFileWorkflowErrorCode(shaped.code);
  const path = typeof shaped.path === "string" ? shaped.path : undefined;
  const message =
    typeof shaped.message === "string" && shaped.message.trim()
      ? shaped.message
      : messageForFileWorkflowCode(code, path) || fallbackMessage;

  return {
    code,
    message,
    ...(path ? { path } : {})
  };
}

export function fileWorkflowErrorTitle(code: FileWorkflowErrorCode) {
  const titles: Record<FileWorkflowErrorCode, string> = {
    file_not_found: "文件不存在",
    permission_denied: "没有文件权限",
    unsupported_type: "文件类型不支持",
    read_failed: "读取文件失败",
    write_failed: "保存文件失败",
    association_failed: "文件关联打开失败"
  };
  return titles[code];
}

export function fileWorkflowErrorSuggestion(code: FileWorkflowErrorCode) {
  const suggestions: Record<FileWorkflowErrorCode, string> = {
    file_not_found: "确认文件没有被移动或删除，然后从最近文件或打开菜单重新选择。",
    permission_denied: "检查文件权限，或使用另存为保存到可写位置。",
    unsupported_type: "请选择 .mmd 或 .mermaid 文件。",
    read_failed: "确认文件内容可读，然后重新打开。",
    write_failed: "检查目标目录权限，或使用另存为保存到其它位置。",
    association_failed: "重新安装桌面版后再尝试双击打开 Mermaid 文件。"
  };
  return suggestions[code];
}

function normalizeFileWorkflowErrorCode(value: unknown): FileWorkflowErrorCode {
  if (
    value === "file_not_found" ||
    value === "permission_denied" ||
    value === "unsupported_type" ||
    value === "read_failed" ||
    value === "write_failed" ||
    value === "association_failed"
  ) {
    return value;
  }
  return "read_failed";
}

function messageForFileWorkflowCode(code: FileWorkflowErrorCode, path: string | undefined) {
  const target = path ? `：${path}` : "";
  const messages: Record<FileWorkflowErrorCode, string> = {
    file_not_found: `找不到文件${target}`,
    permission_denied: `没有权限访问文件${target}`,
    unsupported_type: `只支持 .mmd 或 .mermaid 文件${target}`,
    read_failed: `读取文件失败${target}`,
    write_failed: `保存文件失败${target}`,
    association_failed: `通过系统文件关联打开失败${target}`
  };
  return messages[code];
}

function toRuntimeErrorShape(error: unknown): RuntimeErrorShape {
  if (error && typeof error === "object") return error as RuntimeErrorShape;
  if (error instanceof Error) return { message: error.message };
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      if (parsed && typeof parsed === "object") return parsed as RuntimeErrorShape;
    } catch {
      // Tauri can return plain strings for legacy errors.
    }
    return { message: error };
  }
  return {};
}
