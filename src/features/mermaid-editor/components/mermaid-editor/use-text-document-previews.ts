import { useCallback, useEffect, useRef, useState } from "react";

import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { resolveTextDocumentFile, textDocumentExcerpt, textDocumentNodeAction, textDocumentReferenceKey, type TextDocumentPreview } from "@/features/mermaid-editor/lib/text-document";

export function useTextDocumentPreviews({ runtime, fileRef, projectWorkspace }: { runtime: EditorRuntime; fileRef: RuntimeFileRef | null; projectWorkspace: ProjectWorkspace | null }) {
  const [previewByNodeId, setPreviewByNodeId] = useState<Record<string, TextDocumentPreview>>({});
  const nodePathsRef = useRef(new Map<string, string>());

  const updatePath = useCallback((path: string, source: string, status: TextDocumentPreview["status"] = "ready") => {
    const key = textDocumentReferenceKey(path);
    const preview: TextDocumentPreview = { status: source.trim() ? status : "empty", path, excerpt: textDocumentExcerpt(source) };
    setPreviewByNodeId((current) => {
      const next = { ...current };
      for (const [nodeId, nodePath] of nodePathsRef.current) if (nodePath === key) next[nodeId] = preview;
      return next;
    });
  }, []);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void runtime.listenForDocumentHubEvents((event) => {
      if (event.snapshot.kind !== "text") return;
      if (event.snapshot.syncState === "deleted") {
        const key = textDocumentReferenceKey(event.snapshot.file.path || event.snapshot.file.name);
        setPreviewByNodeId((current) => Object.fromEntries(Object.entries(current).map(([nodeId, preview]) => nodePathsRef.current.get(nodeId) === key ? [nodeId, { ...preview, status: "missing", excerpt: "" }] : [nodeId, preview])));
      } else updatePath(event.snapshot.file.path || event.snapshot.file.name, event.snapshot.content);
    }).then((listener) => { dispose = listener; });
    return () => dispose?.();
  }, [runtime, updatePath]);

  const requestPreview = useCallback((node: CanvasNode) => {
    const action = textDocumentNodeAction(node.action);
    if (!action) return;
    const file = resolveTextDocumentFile(action.path, fileRef?.path, projectWorkspace);
    const key = textDocumentReferenceKey(file.path);
    nodePathsRef.current.set(node.id, key);
    setPreviewByNodeId((current) => ({ ...current, [node.id]: { status: "loading", path: file.relativePath, excerpt: "" } }));
    void runtime.openDocumentSnapshot(file.path).then((snapshot) => {
      if (!snapshot) return;
      updatePath(file.path, snapshot.content);
    }).catch((error) => {
      setPreviewByNodeId((current) => ({ ...current, [node.id]: { status: "error", path: file.relativePath, excerpt: "", message: error instanceof Error ? error.message : "读取文本文件失败。" } }));
    });
  }, [fileRef?.path, projectWorkspace, runtime, updatePath]);

  return { previewByNodeId, requestPreview, updatePreviewFromText: updatePath };
}
