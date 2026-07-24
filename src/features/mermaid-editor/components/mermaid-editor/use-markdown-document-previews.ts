import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import {
  extractMarkdownDocumentPreview,
  markdownDocumentAction,
  markdownDocumentReferenceKey,
  resolveMarkdownDocumentFile,
  type MarkdownDocumentPreview
} from "@/features/mermaid-editor/lib/markdown-document";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

type PreviewCacheEntry = {
  signature: string;
  preview: MarkdownDocumentPreview;
};

export function useMarkdownDocumentPreviews({
  runtime,
  fileRef,
  projectWorkspace
}: {
  runtime: EditorRuntime;
  fileRef: RuntimeFileRef | null;
  projectWorkspace: ProjectWorkspace | null;
}) {
  const [previewByNodeId, setPreviewByNodeId] = useState<Record<string, MarkdownDocumentPreview>>({});
  const cacheRef = useRef(new Map<string, PreviewCacheEntry>());
  const nodePathKeyRef = useRef(new Map<string, string>());
  const nodeSignatureRef = useRef(new Map<string, string>());
  const inFlightRef = useRef(new Map<string, Promise<MarkdownDocumentPreview>>());
  const queueRef = useRef(createPromiseQueue(4));

  const requestPreview = useCallback((node: CanvasNode) => {
    const action = markdownDocumentAction(node.action);
    if (!action) return;

    const file = resolveMarkdownDocumentFile(action.path, fileRef?.path, projectWorkspace);
    const pathKey = markdownDocumentReferenceKey(file.path);
    const modifiedAt = projectWorkspace?.files.find((item) => markdownDocumentReferenceKey(item.path) === pathKey)?.modifiedAt || 0;
    const signature = `${pathKey}:${modifiedAt}`;
    nodePathKeyRef.current.set(node.id, pathKey);
    nodeSignatureRef.current.set(node.id, signature);

    const cached = cacheRef.current.get(pathKey);
    if (cached?.signature === signature) {
      setNodePreview(setPreviewByNodeId, node.id, cached.preview);
      return;
    }

    setNodePreview(setPreviewByNodeId, node.id, {
      status: "loading",
      path: file.relativePath || action.path,
      excerpt: ""
    });

    let request = inFlightRef.current.get(signature);
    if (!request) {
      request = queueRef.current(async () => {
        try {
          const result = await runtime.openFilePath(file.path);
          if (result.status !== "opened") {
            return {
              status: "unsupported",
              path: file.relativePath || action.path,
              excerpt: "",
              message: "当前运行环境无法读取此 Markdown 文档。"
            } satisfies MarkdownDocumentPreview;
          }
          return previewFromText(file.relativePath || action.path, result.text);
        } catch (error) {
          const message = errorMessage(error);
          return {
            status: /(?:enoent|not found|找不到|不存在)/i.test(message) ? "missing" : "error",
            path: file.relativePath || action.path,
            excerpt: "",
            message: message || "无法读取 Markdown 文档。"
          } satisfies MarkdownDocumentPreview;
        }
      });
      inFlightRef.current.set(signature, request);
      void request.finally(() => inFlightRef.current.delete(signature));
    }

    void request.then((preview) => {
      cacheRef.current.set(pathKey, { signature, preview });
      if (nodeSignatureRef.current.get(node.id) === signature) {
        setNodePreview(setPreviewByNodeId, node.id, preview);
      }
    });
  }, [fileRef?.path, projectWorkspace, runtime]);

  const updatePreviewFromText = useCallback((path: string, text: string) => {
    const pathKey = markdownDocumentReferenceKey(path);
    const preview = previewFromText(path, text);
    cacheRef.current.set(pathKey, { signature: `${pathKey}:saved`, preview });
    setPreviewByNodeId((current) => {
      const next = { ...current };
      for (const [nodeId, nodePathKey] of nodePathKeyRef.current) {
        if (nodePathKey === pathKey) next[nodeId] = preview;
      }
      return next;
    });
  }, []);

  const markPreviewMissing = useCallback((path: string) => {
    const pathKey = markdownDocumentReferenceKey(path);
    const preview = {
      status: "missing",
      path,
      excerpt: "",
      message: "Markdown 文档已从磁盘移除。"
    } satisfies MarkdownDocumentPreview;
    cacheRef.current.set(pathKey, { signature: `${pathKey}:missing`, preview });
    setPreviewByNodeId((current) => {
      const next = { ...current };
      for (const [nodeId, nodePathKey] of nodePathKeyRef.current) {
        if (nodePathKey === pathKey) next[nodeId] = preview;
      }
      return next;
    });
  }, []);

  return {
    previewByNodeId,
    requestPreview,
    updatePreviewFromText,
    markPreviewMissing
  };
}

function previewFromText(path: string, text: string): MarkdownDocumentPreview {
  const { title, excerpt } = extractMarkdownDocumentPreview(text);
  return {
    status: excerpt ? "ready" : "empty",
    path,
    excerpt,
    title: title || undefined
  };
}

function setNodePreview(
  setter: Dispatch<SetStateAction<Record<string, MarkdownDocumentPreview>>>,
  nodeId: string,
  preview: MarkdownDocumentPreview
) {
  setter((current) => (samePreview(current[nodeId], preview) ? current : { ...current, [nodeId]: preview }));
}

function samePreview(left: MarkdownDocumentPreview | undefined, right: MarkdownDocumentPreview) {
  return left?.status === right.status && left.path === right.path && left.excerpt === right.excerpt && left.title === right.title && left.message === right.message;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

function createPromiseQueue(limit: number) {
  const waiting: { task: () => Promise<MarkdownDocumentPreview>; resolve: (value: MarkdownDocumentPreview) => void }[] = [];
  let active = 0;

  function drain() {
    while (active < limit && waiting.length) {
      const item = waiting.shift();
      if (!item) return;
      active += 1;
      void item.task().then(item.resolve).finally(() => {
        active -= 1;
        drain();
      });
    }
  }

  return (task: () => Promise<MarkdownDocumentPreview>) => new Promise<MarkdownDocumentPreview>((resolve) => {
    waiting.push({ task, resolve });
    drain();
  });
}
