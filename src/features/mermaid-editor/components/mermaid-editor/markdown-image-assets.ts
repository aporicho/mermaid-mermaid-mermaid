import type {
  EditorRuntime,
  RuntimeFileRef,
  RuntimeImageAssetContext,
  RuntimeImageAssetResult
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export type MarkdownImageAssets = {
  onUpload: (file: File) => Promise<string>;
  resolveDisplaySrc: (src: string) => Promise<string>;
  insertProjectImage: (file: ProjectFileEntry) => Promise<string>;
};

export type MarkdownImageAssetDependencies = {
  runtime: EditorRuntime;
  projectWorkspace: ProjectWorkspace | null;
  refreshProjectWorkspace: (rootPath?: string) => Promise<unknown> | void;
  onStatus: (message: string) => void;
  onError: (error: unknown, fallbackMessage?: string) => void;
};

export function markdownImageAssetsForDocument(
  dependencies: MarkdownImageAssetDependencies,
  documentFile: RuntimeFileRef | null
): MarkdownImageAssets {
  const context = markdownImageAssetContext(dependencies.projectWorkspace);

  return {
    async onUpload(file) {
      const target = requireSavedMarkdownDocument(documentFile, dependencies.onStatus);
      const result = await runImageAssetOperation(
        () => dependencies.runtime.importImageAssetFile(target, file, context),
        dependencies,
        "插入本地图片失败。"
      );
      return finishImageAssetImport(result, file.name, dependencies, context.projectRoot);
    },
    async resolveDisplaySrc(src) {
      if (!documentFile?.path) return src;
      try {
        return await dependencies.runtime.resolveImageAssetSrc(documentFile, src, context);
      } catch {
        return src;
      }
    },
    async insertProjectImage(file) {
      const target = requireSavedMarkdownDocument(documentFile, dependencies.onStatus);
      const result = await runImageAssetOperation(
        () => dependencies.runtime.importImageAssetPath(target, file.path, context),
        dependencies,
        "引用项目图片失败。"
      );
      return finishImageAssetImport(result, file.name, dependencies, context.projectRoot);
    }
  };
}

function markdownImageAssetContext(projectWorkspace: ProjectWorkspace | null): RuntimeImageAssetContext {
  return {
    storageScope: "project",
    rootFallback: true,
    ...(projectWorkspace?.rootPath ? { projectRoot: projectWorkspace.rootPath } : {})
  };
}

function requireSavedMarkdownDocument(
  documentFile: RuntimeFileRef | null,
  onStatus: (message: string) => void
): RuntimeFileRef {
  if (documentFile?.path) return documentFile;
  const message = "请先保存 Markdown 文档，再插入本地图片。";
  onStatus(message);
  throw new Error(message);
}

async function runImageAssetOperation(
  operation: () => Promise<RuntimeImageAssetResult>,
  dependencies: MarkdownImageAssetDependencies,
  fallbackMessage: string
) {
  try {
    return await operation();
  } catch (error) {
    dependencies.onError(error, fallbackMessage);
    throw error;
  }
}

async function finishImageAssetImport(
  result: RuntimeImageAssetResult,
  fileName: string,
  dependencies: MarkdownImageAssetDependencies,
  projectRoot: string | undefined
) {
  if (result.status === "ready") {
    if (result.copied && projectRoot) await dependencies.refreshProjectWorkspace(projectRoot);
    dependencies.onStatus(result.copied ? `已复制并插入 ${fileName}。` : `已引用 ${fileName}。`);
    return result.src;
  }

  const message = result.status === "unsupported"
    ? result.message
    : result.status === "needs-document"
      ? "请先保存 Markdown 文档，再插入本地图片。"
      : "已取消图片插入。";
  dependencies.onStatus(message);
  throw new Error(message);
}
