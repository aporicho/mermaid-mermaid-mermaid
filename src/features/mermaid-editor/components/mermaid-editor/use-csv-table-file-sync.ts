import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { parseCanvasTableCsv, serializeCanvasTableCsv } from "@/features/mermaid-editor/lib/canvas-table-csv";
import { applyCanvasTablePresentation } from "@/features/mermaid-editor/lib/canvas-table-content";
import {
  csvTableDocumentAction,
  csvTableDocumentReferenceKey,
  resolveCsvTableDocumentFile
} from "@/features/mermaid-editor/lib/csv-table-document";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { updateNode } from "@/features/mermaid-editor/lib/editor-actions";
import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import type { CanvasTableContent, LayoutMode, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { parentDirectoryPath } from "@/features/mermaid-editor/lib/runtime-paths";

type CsvFormat = { bom: boolean; lineEnding: "\n" | "\r\n" };

type CsvBinding = {
  key: string;
  sourcePath: string;
  file: ProjectFileEntry;
  revision?: string;
  savedText?: string;
  desiredText?: string;
  format: CsvFormat;
  loading: boolean;
  writing: boolean;
  blocked: boolean;
  blockReason?: "load" | "write" | "conflict";
  pending?: Promise<void>;
};

type CsvSyncContext = {
  runtime: EditorRuntime;
  setGraph: Dispatch<SetStateAction<MermaidGraph>>;
  rootPath?: string;
  bindingsRef: MutableRefObject<Map<string, CsvBinding>>;
  retiredRef: MutableRefObject<Set<CsvBinding>>;
  aliveRef: MutableRefObject<boolean>;
  graphRef: MutableRefObject<MermaidGraph>;
  documentGenerationRef: MutableRefObject<number>;
  layoutModeRef: MutableRefObject<LayoutMode | undefined>;
  nodeGeometrySpecRef: MutableRefObject<NodeGeometrySpec | undefined>;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
};

export function useCsvTableFileSync({
  runtime,
  graph,
  setGraph,
  fileRef,
  projectWorkspace,
  documentGenerationRef,
  layoutMode,
  nodeGeometrySpec,
  showFileWorkflowError
}: {
  runtime: EditorRuntime;
  graph: MermaidGraph;
  setGraph: Dispatch<SetStateAction<MermaidGraph>>;
  fileRef: RuntimeFileRef | null;
  projectWorkspace: ProjectWorkspace | null;
  documentGenerationRef: MutableRefObject<number>;
  layoutMode?: LayoutMode;
  nodeGeometrySpec?: NodeGeometrySpec;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
}) {
  const bindingsRef = useRef(new Map<string, CsvBinding>());
  const retiredRef = useRef(new Set<CsvBinding>());
  const aliveRef = useRef(true);
  const graphRef = useRef(graph);
  const layoutModeRef = useRef(layoutMode);
  const nodeGeometrySpecRef = useRef(nodeGeometrySpec);
  graphRef.current = graph;
  layoutModeRef.current = layoutMode;
  nodeGeometrySpecRef.current = nodeGeometrySpec;

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    const bindings = bindingsRef.current;
    const activeNodeIds = new Set<string>();
    const rootPath = projectWorkspace?.rootPath || parentDirectoryPath(fileRef?.path);
    const context: CsvSyncContext = {
      runtime,
      setGraph,
      rootPath,
      bindingsRef,
      retiredRef,
      aliveRef,
      graphRef,
      documentGenerationRef,
      layoutModeRef,
      nodeGeometrySpecRef,
      showFileWorkflowError
    };

    for (const node of graph.nodes) {
      const action = csvTableDocumentAction(node.action);
      if (!action) continue;
      activeNodeIds.add(node.id);
      const file = resolveCsvTableDocumentFile(action.path, fileRef?.path, projectWorkspace);
      const key = [documentGenerationRef.current, csvTableDocumentReferenceKey(file.path || action.path), file.modifiedAt ?? "", fileRef?.path ?? ""].join("::");
      let binding = bindings.get(node.id);
      if (!binding || binding.key !== key) {
        if (binding) retireCsvBinding(context, binding);
        binding = { key, sourcePath: action.path, file, format: { bom: false, lineEnding: "\r\n" }, loading: false, writing: false, blocked: false };
        bindings.set(node.id, binding);
      } else {
        binding.sourcePath = action.path;
        binding.file = file;
      }

      if ((!binding.revision || !node.content) && !binding.loading && !binding.blocked) {
        if (!node.content) {
          binding.revision = undefined;
          binding.savedText = undefined;
          binding.desiredText = undefined;
        }
        void loadCsvNode(context, node.id, binding, node.content, node.tablePresentation);
        continue;
      }
      if (!node.content || !binding.revision || binding.loading || binding.blocked) continue;
      const text = serializeWithFormat(node.content, binding.format);
      if (text === binding.savedText && !binding.writing) continue;
      binding.desiredText = text;
      if (!binding.writing) void startCsvFlush(context, node.id, binding);
    }

    for (const nodeId of bindings.keys()) {
      if (activeNodeIds.has(nodeId)) continue;
      const binding = bindings.get(nodeId);
      if (binding) retireCsvBinding(context, binding);
      bindings.delete(nodeId);
    }
  }, [documentGenerationRef, fileRef?.path, graph, layoutMode, nodeGeometrySpec, projectWorkspace, runtime, setGraph, showFileWorkflowError]);

  const flushPendingWrites = useCallback(async (options?: { overwriteConflicts?: boolean }) => {
    const context: CsvSyncContext = {
      runtime,
      setGraph,
      rootPath: projectWorkspace?.rootPath || parentDirectoryPath(fileRef?.path),
      bindingsRef,
      retiredRef,
      aliveRef,
      graphRef,
      documentGenerationRef,
      layoutModeRef,
      nodeGeometrySpecRef,
      showFileWorkflowError
    };
    if (!aliveRef.current) return false;
    for (const [nodeId, binding] of bindingsRef.current) {
      const content = graphRef.current.nodes.find((node) => node.id === nodeId)?.content;
      if (content && binding.revision) binding.desiredText = serializeWithFormat(content, binding.format);
      if (binding.blockReason === "write") {
        binding.blocked = false;
        binding.blockReason = undefined;
      }
      if (binding.blockReason === "conflict" && options?.overwriteConflicts) {
        await prepareCsvConflictOverwrite(context, binding);
      }
      if (!binding.blocked && binding.desiredText !== binding.savedText) void startCsvFlush(context, nodeId, binding);
    }
    for (const binding of retiredRef.current) {
      if (binding.blockReason === "write") {
        binding.blocked = false;
        binding.blockReason = undefined;
      }
      if (binding.blockReason === "conflict" && options?.overwriteConflicts) {
        await prepareCsvConflictOverwrite(context, binding);
      }
      if (!binding.blocked && binding.desiredText !== binding.savedText) void startCsvFlush(context, "", binding);
    }

    while (true) {
      const pending = [...bindingsRef.current.values(), ...retiredRef.current].flatMap((binding) => binding.pending ? [binding.pending] : []);
      if (!pending.length) break;
      await Promise.allSettled(pending);
    }
    return ![...bindingsRef.current.values(), ...retiredRef.current].some((binding) => {
      return (binding.blockReason === "conflict" || binding.blockReason === "write") && binding.desiredText !== binding.savedText;
    });
  }, [documentGenerationRef, fileRef?.path, projectWorkspace?.rootPath, runtime, setGraph, showFileWorkflowError]);

  const discardPendingWrites = useCallback(async () => {
    const context: CsvSyncContext = {
      runtime,
      setGraph,
      rootPath: projectWorkspace?.rootPath || parentDirectoryPath(fileRef?.path),
      bindingsRef,
      retiredRef,
      aliveRef,
      graphRef,
      documentGenerationRef,
      layoutModeRef,
      nodeGeometrySpecRef,
      showFileWorkflowError
    };
    const reloads: Promise<void>[] = [];
    for (const [nodeId, binding] of bindingsRef.current) {
      const hasUnsavedFailure = (binding.blockReason === "conflict" || binding.blockReason === "write") && binding.desiredText !== binding.savedText;
      if (!hasUnsavedFailure) continue;
      const node = graphRef.current.nodes.find((candidate) => candidate.id === nodeId);
      binding.desiredText = binding.savedText;
      binding.blocked = false;
      binding.blockReason = undefined;
      binding.revision = undefined;
      binding.savedText = undefined;
      binding.desiredText = undefined;
      if (node) reloads.push(loadCsvNode(context, nodeId, binding, undefined, node.tablePresentation));
    }
    for (const binding of retiredRef.current) {
      binding.desiredText = binding.savedText;
      binding.blocked = false;
      binding.blockReason = undefined;
      if (!binding.pending) retiredRef.current.delete(binding);
    }
    await Promise.allSettled(reloads);
  }, [documentGenerationRef, fileRef?.path, projectWorkspace?.rootPath, runtime, setGraph, showFileWorkflowError]);

  return { flushPendingWrites, discardPendingWrites };

}

async function loadCsvNode(context: CsvSyncContext, nodeId: string, binding: CsvBinding, previousContent: CanvasTableContent | undefined, presentation: MermaidGraph["nodes"][number]["tablePresentation"]) {
  const documentGeneration = context.documentGenerationRef.current;
  binding.loading = true;
  context.setGraph((current) => isCurrentCsvLoad(context, nodeId, binding, documentGeneration)
    ? updateNode(current, nodeId, { content: undefined, csvStatus: "loading" })
    : current);
  try {
    const result = await context.runtime.readCsvFile({ rootPath: context.rootPath, file: runtimeFile(binding.file) });
    if (!isCurrentCsvLoad(context, nodeId, binding, documentGeneration)) return;
    if (result.status === "unsupported") {
      binding.blocked = true;
      binding.blockReason = "load";
      context.setGraph((current) => isCurrentCsvLoad(context, nodeId, binding, documentGeneration)
        ? updateNode(current, nodeId, { content: undefined, csvStatus: "error" })
        : current);
      context.showFileWorkflowError(new Error(result.message), "无法读取 CSV 表格。");
      return;
    }
    const format = detectCsvFormat(result.snapshot.text);
    const content = applyCanvasTablePresentation(parseCanvasTableCsv(result.snapshot.text, { previousContent }), presentation);
    binding.file = {
      ...binding.file,
      name: result.snapshot.file.name,
      path: result.snapshot.file.path || binding.file.path
    };
    binding.revision = result.snapshot.revision;
    binding.format = format;
    binding.savedText = serializeWithFormat(content, format);
    binding.desiredText = binding.savedText;
    context.setGraph((current) => {
      if (!isCurrentCsvLoad(context, nodeId, binding, documentGeneration)) return current;
      const next = updateNode(current, nodeId, { content, csvStatus: undefined });
      return context.layoutModeRef.current === "auto" ? applyDagreAutoLayout(next, { spec: context.nodeGeometrySpecRef.current }) : next;
    });
  } catch (error) {
    if (!isCurrentCsvLoad(context, nodeId, binding, documentGeneration)) return;
    binding.blocked = true;
    binding.blockReason = "load";
    context.setGraph((current) => isCurrentCsvLoad(context, nodeId, binding, documentGeneration)
      ? updateNode(current, nodeId, { content: undefined, csvStatus: "error" })
      : current);
    context.showFileWorkflowError(error, `读取 CSV 表格 ${binding.file.name} 失败。`);
  } finally {
    binding.loading = false;
  }
}

function isCurrentCsvLoad(context: CsvSyncContext, nodeId: string, binding: CsvBinding, documentGeneration: number) {
  const action = csvTableDocumentAction(context.graphRef.current.nodes.find((node) => node.id === nodeId)?.action);
  return context.aliveRef.current
    && context.documentGenerationRef.current === documentGeneration
    && context.bindingsRef.current.get(nodeId) === binding
    && csvTableDocumentReferenceKey(action?.path || "") === csvTableDocumentReferenceKey(binding.sourcePath);
}

function startCsvFlush(context: CsvSyncContext, nodeId: string, binding: CsvBinding) {
  if (binding.pending) return binding.pending;
  const pending = flushCsvNode(context, nodeId, binding).finally(() => {
    if (binding.pending === pending) binding.pending = undefined;
    const current = context.graphRef.current.nodes.find((node) => node.id === nodeId)?.content;
    if (context.aliveRef.current && current && !binding.blocked && context.bindingsRef.current.get(nodeId) === binding) {
      binding.desiredText = serializeWithFormat(current, binding.format);
      if (binding.desiredText !== binding.savedText) void startCsvFlush(context, nodeId, binding);
    }
    if (binding.desiredText === binding.savedText) context.retiredRef.current.delete(binding);
  });
  binding.pending = pending;
  return pending;
}

async function flushCsvNode(context: CsvSyncContext, nodeId: string, binding: CsvBinding) {
  binding.writing = true;
  try {
    while (context.aliveRef.current && !binding.blocked && isTrackedBinding(context, nodeId, binding)) {
      const text = binding.desiredText;
      const revision = binding.revision;
      if (!text || !revision || text === binding.savedText) break;
      const result = await context.runtime.writeCsvFile({
        rootPath: context.rootPath,
        file: runtimeFile(binding.file),
        text,
        expectedRevision: revision
      });
      if (result.status === "unsupported") {
        binding.blocked = true;
        binding.blockReason = "write";
        context.showFileWorkflowError(new Error(result.message), "无法写回 CSV 表格。");
        break;
      }
      if (result.status === "conflict") {
        binding.blocked = true;
        binding.blockReason = "conflict";
        context.showFileWorkflowError(new Error(`${binding.file.name} 已被其他程序修改；画布中的编辑尚未覆盖原文件。`), "CSV 文件发生版本冲突。");
        break;
      }
      binding.revision = result.revision;
      binding.savedText = text;
      binding.file = { ...binding.file, ...result.file };
    }
  } catch (error) {
    binding.blocked = true;
    binding.blockReason = "write";
    context.showFileWorkflowError(error, `写回 CSV 表格 ${binding.file.name} 失败。`);
  } finally {
    binding.writing = false;
  }
}

async function prepareCsvConflictOverwrite(context: CsvSyncContext, binding: CsvBinding) {
  try {
    const result = await context.runtime.readCsvFile({ rootPath: context.rootPath, file: runtimeFile(binding.file) });
    if (result.status === "unsupported") throw new Error(result.message);
    binding.file = { ...binding.file, ...result.snapshot.file };
    binding.revision = result.snapshot.revision;
    binding.blocked = false;
    binding.blockReason = undefined;
  } catch (error) {
    binding.blocked = true;
    binding.blockReason = "write";
    context.showFileWorkflowError(error, `重新读取 CSV 表格 ${binding.file.name} 失败。`);
  }
}

function retireCsvBinding(context: CsvSyncContext, binding: CsvBinding) {
  if (!binding.pending && binding.desiredText === binding.savedText) return;
  context.retiredRef.current.add(binding);
  if (!binding.pending && !binding.blocked) void startCsvFlush(context, "", binding);
}

function isTrackedBinding(context: CsvSyncContext, nodeId: string, binding: CsvBinding) {
  return context.bindingsRef.current.get(nodeId) === binding || context.retiredRef.current.has(binding);
}

function runtimeFile(file: ProjectFileEntry): RuntimeFileRef {
  return { name: file.name, path: file.path };
}

function detectCsvFormat(source: string): CsvFormat {
  return {
    bom: source.startsWith("\ufeff"),
    lineEnding: source.includes("\r\n") ? "\r\n" : "\n"
  };
}

function serializeWithFormat(content: CanvasTableContent, format: CsvFormat) {
  return serializeCanvasTableCsv(content, format);
}
