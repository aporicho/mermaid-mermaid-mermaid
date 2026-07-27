import { useMemo } from "react";

import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type {
  EditorRuntime,
  RuntimeAgentDocumentBridge,
  RuntimeAgentDocumentSnapshot,
  RuntimeAgentDocumentSummary,
  RuntimeAgentReference,
  RuntimeAgentTextSelection,
  RuntimeFileRef
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { upsertRecentFile, type RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { applyMermaidPatch } from "@/features/mermaid-editor/lib/mermaid-patch";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import type { DetachedMarkdownWindow, MarkdownWindowPanelId, WorkspaceFloatingPanelId } from "@/features/mermaid-editor/lib/workspace-panels";
import type { EditorDocumentBuffer, EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

type UseEditorAgentDocumentsArgs = {
  runtime: EditorRuntime;
  documentKind: DocumentKind;
  source: string;
  currentDocument: string;
  graph: MermaidGraph;
  selection: Selection;
  textSelection: RuntimeAgentTextSelection | null;
  fileName: string;
  fileRef: RuntimeFileRef | null;
  isDirty: boolean;
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  documentGeneration: number;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedSelections: Record<string, RuntimeAgentTextSelection | null>;
  activeWorkspacePanel: WorkspaceFloatingPanelId | null;
  applySource: (value: string) => void;
  applyMarkdownSource: (value: string) => void;
  flushSourceHistory: () => void;
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setFileName: StateSetter<string>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setLastSavedDocument: StateSetter<string>;
  setDetachedMarkdownWindows: StateSetter<DetachedMarkdownWindow[]>;
  setWorkspaceView: StateSetter<WorkspaceView>;
  setStatus: StateSetter<string>;
  bringWorkspacePanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  findFileDocumentBuffer: (file: RuntimeFileRef | null | undefined) => EditorDocumentBuffer | null;
  updateDocumentBuffer: (bufferId: string, updates: Partial<Pick<EditorDocumentBuffer, "content" | "savedContent" | "revision" | "status" | "fileName" | "fileRef">>) => EditorDocumentSession;
  saveDocumentBufferById: (bufferId: string) => Promise<boolean>;
};

export function useEditorAgentDocuments(args: UseEditorAgentDocumentsArgs): RuntimeAgentDocumentBridge {
  return useMemo(() => {
    const mainId = documentIdForMain(args.fileRef, args.documentGeneration);
    async function mainSummary(): Promise<RuntimeAgentDocumentSummary> {
      const revision = await revisionFor(args.currentDocument);
      return {
        documentId: mainId,
        kind: args.documentKind,
        title: args.fileName,
        ...(args.fileRef?.path ? { path: args.fileRef.path } : {}),
        revision,
        dirty: args.isDirty,
        active: !args.activeWorkspacePanel?.startsWith("markdown:"),
        selection: args.textSelection,
        references: referencesForMain(mainId, revision, args.graph, args.selection, args.projectFiles)
      };
    }

    async function detachedSummary(window: DetachedMarkdownWindow): Promise<RuntimeAgentDocumentSummary> {
      return {
        documentId: window.id,
        kind: "markdown",
        title: window.title,
        ...(window.file.path ? { path: window.file.path } : {}),
        revision: await revisionFor(window.value),
        dirty: window.value !== window.savedValue,
        active: args.activeWorkspacePanel === window.id,
        selection: args.detachedSelections[window.id] || null,
        references: window.file.path ? [{ kind: "file", documentId: window.id, path: window.file.path, label: window.title }] : []
      };
    }

    async function list() {
      const documents = await Promise.all([
        mainSummary(),
        ...args.detachedMarkdownWindows.map(detachedSummary)
      ]);
      return {
        documents,
        activeDocumentId: documents.find((document) => document.active)?.documentId || mainId,
        ...(args.projectWorkspace?.rootPath ? { projectRoot: args.projectWorkspace.rootPath } : {})
      };
    }

    async function read(documentId: string): Promise<RuntimeAgentDocumentSnapshot> {
      if (documentId === mainId) return { ...(await mainSummary()), content: args.currentDocument };
      const target = args.detachedMarkdownWindows.find((window) => window.id === documentId);
      if (!target) throw new Error("文档已关闭或不存在。");
      return { ...(await detachedSummary(target)), content: target.value };
    }

    async function apply(request: Record<string, unknown>) {
      const documentId = String(request.documentId || "");
      const current = await read(documentId);
      const expectedRevision = String(request.expectedRevision || "");
      if (!expectedRevision || expectedRevision !== current.revision) {
        return {
          applied: false,
          saved: false,
          code: "REVISION_MISMATCH",
          message: "文档在读取后已发生变化，请重新读取后再修改。",
          currentRevision: current.revision
        };
      }

      const nextText = nextDocumentText(current, request);
      const changed = nextText !== current.content;
      if (!changed) return { applied: true, saved: false, changed: false, revision: current.revision };
      const autoSave = request.autoSave !== false;

      if (documentId !== mainId) {
        return applyDetachedDocument(documentId as MarkdownWindowPanelId, nextText, autoSave);
      }

      let syncedFile = args.fileRef;
      if (args.fileRef?.path) {
        const hubResult = await args.runtime.syncDocumentWorkingCopy({
          documentId: args.fileRef.documentId,
          path: args.fileRef.path,
          content: nextText,
          expectedWorkingRevision: args.fileRef.workingRevision,
          label: "Agent 修改",
          origin: "agent"
        });
        if (hubResult.status === "stale") {
          return {
            applied: false,
            saved: false,
            code: "REVISION_MISMATCH",
            message: "共享工作副本已变化，请重新读取后再修改。",
            currentRevision: hubResult.snapshot?.workingRevision
          };
        }
        if (hubResult.snapshot) syncedFile = hubResult.snapshot.file;
      }

      args.flushSourceHistory();
      if (args.documentKind === "markdown") {
        args.applyMarkdownSource(nextText);
        args.flushSourceHistory();
      } else {
        args.applySource(nextText);
        args.flushSourceHistory();
      }

      if (syncedFile) args.setFileRef(syncedFile);
      const saved = autoSave ? await saveMain(nextText, syncedFile) : false;
      args.setStatus(saved ? "Agent 已应用并保存修改。" : "Agent 已应用修改。");
      return { applied: true, saved, changed: true, revision: await revisionFor(nextText) };
    }

    async function saveMain(nextText: string, file = args.fileRef) {
      if (!file) return false;
      const result = await args.runtime.saveFile(file, nextText, args.fileName, args.documentKind);
      if (result.status !== "saved") return false;
      args.setFileRef(result.file);
      args.setFileName(result.file.name);
      args.setRecentFiles((current) => upsertRecentFile(current, result.file));
      args.setLastSavedDocument(nextText);
      return true;
    }

    async function applyDetachedDocument(documentId: MarkdownWindowPanelId, nextText: string, autoSave: boolean) {
      const target = args.detachedMarkdownWindows.find((window) => window.id === documentId);
      if (!target) throw new Error("Markdown 浮动窗口已关闭。");
      let saved = false;
      let savedFile = target.file;
      const buffer = args.findFileDocumentBuffer(target.file);
      if (target.file.path) {
        const hubResult = await args.runtime.syncDocumentWorkingCopy({
          documentId: target.file.documentId,
          path: target.file.path,
          content: nextText,
          expectedWorkingRevision: target.file.workingRevision,
          label: "Agent 修改 Markdown",
          origin: "agent"
        });
        if (hubResult.status === "stale") return {
          applied: false,
          saved: false,
          code: "REVISION_MISMATCH",
          message: "共享工作副本已变化，请重新读取后再修改。",
          currentRevision: hubResult.snapshot?.workingRevision
        };
        if (hubResult.snapshot) savedFile = hubResult.snapshot.file;
      }
      if (buffer) {
        args.updateDocumentBuffer(buffer.id, { content: nextText, status: nextText === buffer.savedContent ? "clean" : "dirty", fileRef: savedFile });
        if (autoSave) {
          saved = await args.saveDocumentBufferById(buffer.id);
          const latest = args.findFileDocumentBuffer(target.file);
          if (latest?.fileRef) savedFile = { ...latest.fileRef, revision: latest.revision || undefined };
        }
      } else if (autoSave) {
        const result = await args.runtime.saveFile(target.file, nextText, target.title, "markdown");
        if (result.status === "saved") {
          saved = true;
          savedFile = result.file;
          args.setRecentFiles((current) => upsertRecentFile(current, result.file));
        }
      }
      args.setDetachedMarkdownWindows((current) => current.map((window) => window.id === documentId ? {
        ...window,
        value: nextText,
        file: savedFile,
        ...(saved ? { savedValue: nextText, missing: false } : {})
      } : window));
      args.setStatus(saved ? "Agent 已更新并保存 Markdown 窗口。" : "Agent 已更新 Markdown 窗口。");
      return { applied: true, saved, changed: true, revision: await revisionFor(nextText) };
    }

    async function reveal(request: Record<string, unknown>) {
      const documentId = String(request.documentId || "");
      if (documentId.startsWith("markdown:")) {
        const target = args.detachedMarkdownWindows.find((window) => window.id === documentId);
        if (!target) throw new Error("Markdown 浮动窗口已关闭。");
        args.bringWorkspacePanelToFront(target.id);
      } else {
        const view = request.view;
        if (view === "source" || view === "markdown" || view === "canvas" || view === "render") args.setWorkspaceView(view);
      }
      return { revealed: true };
    }

    return { list, read, apply, reveal };
  }, [args]);
}

function documentIdForMain(file: RuntimeFileRef | null, generation: number) {
  return file?.documentId || (file?.path ? `document:${file.path}` : `document:untitled:${generation}`);
}

function referencesForMain(
  documentId: string,
  revision: string,
  graph: MermaidGraph,
  selection: Selection,
  projectFiles: ProjectFileEntry[]
): RuntimeAgentReference[] {
  const references: RuntimeAgentReference[] = projectFiles.map((file) => ({
    kind: "file",
    path: file.path,
    label: file.relativePath || file.name
  }));
  for (const id of selection.nodeIds) {
    const node = graph.nodes.find((item) => item.id === id);
    if (node) references.unshift({ kind: "mermaid-node", documentId, id, label: node.label || id, revision });
  }
  for (const id of selection.edgeIds) {
    const edge = graph.edges.find((item) => item.id === id);
    if (edge) references.unshift({ kind: "mermaid-edge", documentId, id, label: edge.label || `${edge.from} → ${edge.to}`, revision });
  }
  for (const id of selection.subgraphIds || []) {
    const group = graph.subgraphs?.find((item) => item.id === id);
    if (group) references.unshift({ kind: "mermaid-subgraph", documentId, id, label: group.title || id, revision });
  }
  return references;
}

function nextDocumentText(current: RuntimeAgentDocumentSnapshot, request: Record<string, unknown>) {
  if (typeof request.replacement === "string") return request.replacement;
  if (Array.isArray(request.edits)) return applyTextEdits(current.content, request.edits);
  if (Array.isArray(request.mermaidOperations)) {
    if (current.kind !== "mermaid") throw new Error("Mermaid 操作只能用于 Mermaid 文档。");
    const patched = applyMermaidPatch(current.content, { ops: request.mermaidOperations as never[] });
    if (!patched.ok || !patched.result) {
      throw new Error(patched.diagnostics.map((item) => item.message).join("\n") || "Mermaid patch 失败。");
    }
    return patched.result.source;
  }
  throw new Error("修改请求必须包含 replacement、edits 或 mermaidOperations。");
}

export function applyTextEdits(content: string, input: unknown[]) {
  const edits = input.map((value) => {
    if (!value || typeof value !== "object") throw new Error("文本编辑格式无效。");
    const edit = value as Record<string, unknown>;
    const start = Number(edit.start);
    const end = Number(edit.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > content.length || typeof edit.text !== "string") {
      throw new Error("文本编辑范围无效。");
    }
    return { start, end, text: edit.text };
  }).sort((left, right) => right.start - left.start);
  for (let index = 1; index < edits.length; index += 1) {
    if (edits[index - 1].start < edits[index].end) throw new Error("文本编辑范围不能重叠。");
  }
  return edits.reduce((result, edit) => `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`, content);
}

async function revisionFor(content: string) {
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(content);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return fastRevision(content);
}

function fastRevision(content: string) {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}
