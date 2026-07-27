import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";

import { useEditorAutoSave } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-auto-save";
import type { useEditorDocumentSession } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-session";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";
import type { EditorRuntime, RuntimeDocumentSnapshot, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

type DocumentSessionController = ReturnType<typeof useEditorDocumentSession>;

export function useEditorSessionWorkspace({
  documentSession,
  runtime,
  preferences,
  saveAutoSaveEligibleDocuments,
  setDetachedMarkdownWindows,
  applyRemoteDocument,
  onStatus,
  onDocumentConflict,
  onActiveFileMetadata
}: {
  documentSession: DocumentSessionController;
  runtime: EditorRuntime;
  preferences: EditorPreferences;
  saveAutoSaveEligibleDocuments: () => Promise<boolean>;
  setDetachedMarkdownWindows: Dispatch<SetStateAction<DetachedMarkdownWindow[]>>;
  applyRemoteDocument: (text: string, file: RuntimeFileRef, savedContent: string, status: "clean" | "dirty" | "conflict") => void;
  onStatus: (message: string) => void;
  onDocumentConflict: (snapshot: RuntimeDocumentSnapshot) => void;
  onActiveFileMetadata: (file: RuntimeFileRef) => void;
}) {
  const pushedContentRef = useRef(new Map<string, string>());
  const validatedPathRef = useRef(new Set<string>());
  const syncQueueRef = useRef(new Map<string, Promise<void>>());
  const controllerRef = useRef(documentSession);
  const applyRemoteDocumentRef = useRef(applyRemoteDocument);
  const onStatusRef = useRef(onStatus);
  const onDocumentConflictRef = useRef(onDocumentConflict);
  const onActiveFileMetadataRef = useRef(onActiveFileMetadata);
  controllerRef.current = documentSession;
  applyRemoteDocumentRef.current = applyRemoteDocument;
  onStatusRef.current = onStatus;
  onDocumentConflictRef.current = onDocumentConflict;
  onActiveFileMetadataRef.current = onActiveFileMetadata;
  const autoSaveState = useMemo(() => {
    const eligible = documentSession.session.buffers.filter((buffer) => buffer.content !== buffer.savedContent && Boolean(buffer.fileRef));
    return {
      dirty: eligible.length > 0,
      revisionKey: eligible.map((buffer) => `${buffer.id}:${buffer.updatedAt}`).join("|")
    };
  }, [documentSession.session.buffers]);
  useEditorAutoSave({
    preferences,
    dirty: autoSaveState.dirty,
    fileBacked: autoSaveState.dirty,
    documentRevisionKey: autoSaveState.revisionKey,
    save: saveAutoSaveEligibleDocuments
  });

  const findDocumentBuffer = documentSession.findFileBuffer;
  useEffect(() => {
    setDetachedMarkdownWindows((current) => {
      let changed = false;
      const next = current.map((window) => {
        const buffer = findDocumentBuffer(window.file);
        if (!buffer || (
          buffer.content === window.value &&
          buffer.savedContent === window.savedValue &&
          (buffer.revision || undefined) === window.file.revision &&
          buffer.fileRef?.documentId === window.file.documentId &&
          buffer.fileRef?.workingRevision === window.file.workingRevision
        )) return window;
        changed = true;
        return {
          ...window,
          title: buffer.fileName,
          file: {
            ...window.file,
            revision: buffer.revision || undefined,
            documentId: buffer.fileRef?.documentId,
            workingRevision: buffer.fileRef?.workingRevision
          },
          value: buffer.content,
          savedValue: buffer.savedContent
        };
      });
      return changed ? next : current;
    });
  }, [documentSession.session, findDocumentBuffer, setDetachedMarkdownWindows]);

  const currentSession = documentSession.session;
  useEffect(() => {
    if (runtime.kind !== "desktop") return;
    const controller = controllerRef.current;
    for (const buffer of currentSession.buffers) {
      const path = buffer.fileRef?.path;
      if (!path || buffer.content !== buffer.savedContent || validatedPathRef.current.has(path)) continue;
      validatedPathRef.current.add(path);
      void runtime.openDocumentSnapshot(path).catch(() => runtime.syncDocumentWorkingCopy({
        documentId: buffer.fileRef?.documentId,
        path,
        content: buffer.content,
        baseContent: buffer.savedContent,
        baseRevision: buffer.revision || undefined,
        expectedWorkingRevision: buffer.fileRef?.workingRevision,
        label: "恢复文档状态",
        origin: "view"
      }).then((result) => result.snapshot || null)).then((snapshot) => {
        if (!snapshot) return;
        const latest = controller.sessionRef.current.buffers.find((candidate) => candidate.id === buffer.id);
        if (!latest || latest.content !== latest.savedContent) return;
        controller.updateBuffer(buffer.id, {
          content: snapshot.content,
          savedContent: snapshot.savedContent,
          revision: snapshot.diskRevision,
          status: snapshot.syncState === "deleted" ? "deleted" : snapshot.syncState === "conflict" ? "conflict" : snapshot.dirty ? "dirty" : "clean",
          fileRef: snapshot.file
        });
        pushedContentRef.current.set(path, snapshot.content);
        if (controller.sessionRef.current.activeBufferId === buffer.id) {
          if (snapshot.syncState !== "deleted") applyRemoteDocumentRef.current(snapshot.content, snapshot.file, snapshot.savedContent, snapshot.syncState === "conflict" ? "conflict" : snapshot.dirty ? "dirty" : "clean");
          onActiveFileMetadataRef.current(snapshot.file);
        }
      }).catch(() => validatedPathRef.current.delete(path));
    }
  }, [currentSession, runtime]);

  useEffect(() => {
    if (runtime.kind !== "desktop") return;
    const controller = controllerRef.current;
    const dirtyBuffers = currentSession.buffers.filter((buffer) => buffer.fileRef?.path && buffer.content !== buffer.savedContent);
    for (const buffer of dirtyBuffers) {
      const path = buffer.fileRef!.path!;
      if (pushedContentRef.current.get(path) === buffer.content) continue;
      pushedContentRef.current.set(path, buffer.content);
      const previous = syncQueueRef.current.get(path) || Promise.resolve();
      const next = previous.catch(() => undefined).then(async () => {
        const latest = controller.sessionRef.current.buffers.find((candidate) => candidate.id === buffer.id);
        if (!latest?.fileRef?.path || latest.content === latest.savedContent) return;
        const result = await runtime.syncDocumentWorkingCopy({
          documentId: latest.fileRef.documentId,
          path: latest.fileRef.path,
          content: latest.content,
          baseContent: latest.savedContent,
          baseRevision: latest.revision || undefined,
          expectedWorkingRevision: latest.fileRef.workingRevision,
          label: "编辑文档",
          origin: latest.documentKind === "mermaid" ? "canvas" : "view"
        });
        if (!result.snapshot) return;
        if (result.status === "stale") {
          controller.updateBuffer(latest.id, { status: "conflict" });
          onStatusRef.current(`${latest.fileName} 在另一个窗口中已有更新，已停止覆盖并标记为冲突。`);
          if (result.snapshot.conflict) onDocumentConflictRef.current(result.snapshot);
          return;
        }
        if (result.snapshot.content !== latest.content) {
          controller.updateBuffer(latest.id, {
            content: result.snapshot.content,
            savedContent: result.snapshot.savedContent,
            revision: result.snapshot.diskRevision,
            status: result.snapshot.dirty ? "dirty" : "clean",
            fileRef: result.snapshot.file
          });
          if (controller.sessionRef.current.activeBufferId === latest.id) {
            applyRemoteDocumentRef.current(result.snapshot.content, result.snapshot.file, result.snapshot.savedContent, result.snapshot.dirty ? "dirty" : "clean");
          }
        }
        updateBufferHubMetadata(controller, latest.id, result.snapshot);
        if (controller.sessionRef.current.activeBufferId === latest.id) onActiveFileMetadataRef.current(result.snapshot.file);
      }).catch(() => {
        pushedContentRef.current.delete(path);
      }).finally(() => {
        if (syncQueueRef.current.get(path) === next) syncQueueRef.current.delete(path);
      });
      syncQueueRef.current.set(path, next);
    }
  }, [currentSession, runtime]);

  useEffect(() => {
    if (runtime.kind !== "desktop") return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void runtime.listenForDocumentHubEvents((event) => {
      if (disposed) return;
      const controller = controllerRef.current;
      const buffer = controller.findFileBuffer(event.snapshot.file);
      if (!buffer) return;
      if (event.snapshot.conflict) onDocumentConflictRef.current(event.snapshot);
      const active = controller.sessionRef.current.activeBufferId === buffer.id;
      if (event.snapshot.syncState === "deleted") {
        controller.updateBuffer(buffer.id, {
          revision: event.snapshot.diskRevision,
          status: "deleted",
          fileRef: event.snapshot.file
        });
        onStatusRef.current(`${buffer.fileName} 已从磁盘移除；当前内容和原路径均已保留。`);
        return;
      }
      if (buffer.content === event.snapshot.content) {
        updateBufferHubMetadata(controller, buffer.id, event.snapshot);
        if (active) onActiveFileMetadataRef.current(event.snapshot.file);
        return;
      }
      if (buffer.content !== buffer.savedContent) {
        controller.updateBuffer(buffer.id, { status: "conflict" });
        onStatusRef.current(`${buffer.fileName} 在另一个位置被修改，已保留当前内容并标记冲突。`);
        return;
      }
      controller.updateBuffer(buffer.id, {
        content: event.snapshot.content,
        savedContent: event.snapshot.dirty ? buffer.savedContent : event.snapshot.content,
        revision: event.snapshot.diskRevision,
        status: event.snapshot.syncState === "conflict" ? "conflict" : event.snapshot.dirty ? "dirty" : "clean",
        fileRef: event.snapshot.file
      });
      pushedContentRef.current.set(event.snapshot.file.path || "", event.snapshot.content);
      if (active) applyRemoteDocumentRef.current(
        event.snapshot.content,
        event.snapshot.file,
        event.snapshot.savedContent,
        event.snapshot.syncState === "conflict" ? "conflict" : event.snapshot.dirty ? "dirty" : "clean"
      );
    }).then((stop) => {
      if (disposed) stop();
      else cleanup = stop;
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [runtime]);

}

function updateBufferHubMetadata(
  documentSession: DocumentSessionController,
  bufferId: string,
  snapshot: RuntimeDocumentSnapshot
) {
  const buffer = documentSession.sessionRef.current.buffers.find((candidate) => candidate.id === bufferId);
  if (!buffer) return;
  const fileRef = {
    ...snapshot.file,
    revision: snapshot.diskRevision || undefined,
    documentId: snapshot.documentId,
    workingRevision: snapshot.workingRevision
  };
  if (
    buffer.fileRef?.name === fileRef.name &&
    buffer.fileRef?.path === fileRef.path &&
    buffer.fileRef?.revision === fileRef.revision &&
    buffer.fileRef?.documentId === fileRef.documentId &&
    buffer.fileRef?.workingRevision === fileRef.workingRevision
  ) return;
  documentSession.updateBuffer(bufferId, {
    fileRef,
    fileName: fileRef.name,
    revision: snapshot.diskRevision,
    status: snapshot.syncState === "deleted"
      ? "deleted"
      : snapshot.syncState === "conflict"
        ? "conflict"
        : snapshot.dirty ? "dirty" : "clean"
  });
}
