import type { ChangeEvent } from "react";

import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { isSupportedDocumentFilePath } from "@/features/mermaid-editor/lib/file-workflow";
import type { RuntimeFileOpenRequest } from "@/features/mermaid-editor/lib/editor-runtime";

import type {
  ApplyLoadedDocument,
  FileOpenSource,
  PrepareFileSwitch,
  ShowFileWorkflowError,
  UseEditorFileWorkflowArgs
} from "./types";
import { isAbortError } from "./utils";

export function useFileOpenWorkflow(
  args: UseEditorFileWorkflowArgs,
  {
    applyLoadedDocument,
    prepareFileSwitch,
    showFileWorkflowError
  }: {
    applyLoadedDocument: ApplyLoadedDocument;
    prepareFileSwitch: PrepareFileSwitch;
    showFileWorkflowError: ShowFileWorkflowError;
  }
) {
  const {
    runtime,
    fileInputRef,
    setFileMenuOpen
  } = args;

  async function openMermaidFile() {
    try {
      const result = await runtime.openFile();
      if (result.status === "fallback") {
        fileInputRef.current?.click();
        return;
      }
      if (result.status === "cancelled") return;
      if (!(await prepareFileSwitch(result.file.name))) return;
      applyLoadedDocument(result.text, result.file.name, result.file);
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function openFallbackFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      if (!(await prepareFileSwitch(file.name))) return;
      applyLoadedDocument(await file.text(), file.name, { name: file.name });
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function openRuntimeFileRequest(file: RuntimeFileOpenRequest, source: FileOpenSource) {
    if (!isSupportedDocumentFilePath(file.path)) {
      showFileWorkflowError({ code: "unsupported_type", path: file.path }, "文件类型不支持。");
      return;
    }
    if (!(await prepareFileSwitch(file.name))) return;

    try {
      const result = await runtime.openFilePath(file.path);
      if (result.status !== "opened") return;
      applyLoadedDocument(result.text, result.file.name, result.file, source);
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function openRecentFile(file: RecentFileEntry) {
    setFileMenuOpen(false);
    await openRuntimeFileRequest(file, "recent");
  }

  async function openProjectFile(file: ProjectFileEntry) {
    setFileMenuOpen(false);
    await openRuntimeFileRequest(file, "project");
  }

  return {
    openMermaidFile,
    openFallbackFile,
    openRuntimeFileRequest,
    openRecentFile,
    openProjectFile
  };
}
