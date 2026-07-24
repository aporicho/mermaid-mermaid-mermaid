import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import {
  activateEditorDocumentBuffer,
  createEditorDocumentBuffer,
  createEmptyEditorDocumentSession,
  createFileDocumentIdentity,
  createUntitledDocumentIdentity,
  editorDocumentBufferId,
  editorDocumentBufferIsDirty,
  normalizeEditorDocumentSession,
  upsertEditorDocumentBuffer,
  type EditorDocumentBuffer,
  type EditorDocumentBufferStatus,
  type EditorDocumentSession
} from "@/features/mermaid-editor/lib/editor-document-session";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

type ActiveDocumentSnapshot = {
  documentKind: DocumentKind;
  fileName: string;
  fileRef: RuntimeFileRef | null;
  content: string;
  savedContent: string;
};

type ActivateDocumentInput = ActiveDocumentSnapshot & {
  status?: EditorDocumentBufferStatus;
  bufferId?: string;
};

export function useEditorDocumentSession({
  initialSession,
  activeDocument
}: {
  initialSession: EditorDocumentSession | null | undefined;
  activeDocument: ActiveDocumentSnapshot;
}) {
  const initialActiveDocumentRef = useRef(activeDocument);
  const [session, setSession] = useState<EditorDocumentSession>(() => createInitialSession(initialSession, initialActiveDocumentRef.current));
  const sessionRef = useRef(session);
  const activeBufferIdRef = useRef(session.activeBufferId);

  const commit = useCallback((next: EditorDocumentSession) => {
    sessionRef.current = next;
    activeBufferIdRef.current = next.activeBufferId;
    setSession(next);
    return next;
  }, []);

  const captureActiveDocument = useCallback(() => {
    const activeBufferId = activeBufferIdRef.current;
    if (!activeBufferId) return sessionRef.current;
    const previous = sessionRef.current.buffers.find((buffer) => buffer.id === activeBufferId);
    if (!previous) return sessionRef.current;
    const content = activeDocument.content;
    const savedContent = activeDocument.savedContent;
    const status = previous.status === "conflict" && content !== savedContent
      ? "conflict"
      : content === savedContent ? "clean" : "dirty";
    const nextRevision = activeDocument.fileRef?.revision || previous.revision;
    if (
      previous.documentKind === activeDocument.documentKind &&
      previous.fileName === activeDocument.fileName &&
      previous.content === content &&
      previous.savedContent === savedContent &&
      previous.status === status &&
      previous.revision === nextRevision &&
      previous.fileRef?.name === activeDocument.fileRef?.name &&
      previous.fileRef?.path === activeDocument.fileRef?.path
    ) return sessionRef.current;
    const buffer = createEditorDocumentBuffer({
      ...previous,
      documentKind: activeDocument.documentKind,
      fileName: activeDocument.fileName,
      fileRef: serializableFileRef(activeDocument.fileRef),
      content,
      savedContent,
      revision: nextRevision,
      status,
      updatedAt: Date.now()
    });
    return commit(upsertEditorDocumentBuffer(sessionRef.current, buffer, { activate: true }));
  }, [activeDocument, commit]);

  useEffect(() => {
    captureActiveDocument();
  }, [captureActiveDocument]);

  const activateDocument = useCallback((input: ActivateDocumentInput) => {
    const existing = input.bufferId
      ? sessionRef.current.buffers.find((buffer) => buffer.id === input.bufferId)
      : bufferForRuntimeFile(sessionRef.current, input.fileRef);
    const identity = existing?.identity || identityForDocument(input.fileRef);
    const buffer = createEditorDocumentBuffer({
      identity,
      documentKind: input.documentKind,
      fileName: input.fileName,
      fileRef: serializableFileRef(input.fileRef),
      content: input.content,
      savedContent: input.savedContent,
      revision: input.fileRef?.revision || existing?.revision || null,
      status: input.status,
      updatedAt: Date.now()
    });
    return commit(upsertEditorDocumentBuffer(sessionRef.current, buffer, { activate: true })).buffers.find((item) => item.id === buffer.id)!;
  }, [commit]);

  const registerDocument = useCallback((input: ActivateDocumentInput) => {
    const existing = input.bufferId
      ? sessionRef.current.buffers.find((buffer) => buffer.id === input.bufferId)
      : bufferForRuntimeFile(sessionRef.current, input.fileRef);
    const buffer = createEditorDocumentBuffer({
      identity: existing?.identity || identityForDocument(input.fileRef),
      documentKind: input.documentKind,
      fileName: input.fileName,
      fileRef: serializableFileRef(input.fileRef),
      content: input.content,
      savedContent: input.savedContent,
      revision: input.fileRef?.revision || existing?.revision || null,
      status: input.status,
      updatedAt: Date.now()
    });
    commit(upsertEditorDocumentBuffer(sessionRef.current, buffer));
    return buffer;
  }, [commit]);

  const beginUntitledDocument = useCallback((input: Omit<ActivateDocumentInput, "fileRef" | "bufferId">) => {
    const identity = createUntitledDocumentIdentity(createSessionId("document"));
    const buffer = createEditorDocumentBuffer({
      identity,
      documentKind: input.documentKind,
      fileName: input.fileName,
      fileRef: null,
      content: input.content,
      savedContent: input.savedContent,
      status: input.status,
      updatedAt: Date.now()
    });
    commit(upsertEditorDocumentBuffer(sessionRef.current, buffer, { activate: true }));
    return buffer;
  }, [commit]);

  const findFileBuffer = useCallback((file: RuntimeFileRef | null | undefined) => bufferForRuntimeFile(sessionRef.current, file), []);

  const activateBuffer = useCallback((bufferId: string) => {
    const buffer = sessionRef.current.buffers.find((candidate) => candidate.id === bufferId);
    if (!buffer) return null;
    commit(activateEditorDocumentBuffer(sessionRef.current, buffer.id));
    return buffer;
  }, [commit]);

  const markBufferSaved = useCallback((bufferId: string, file: RuntimeFileRef, content: string) => {
    const currentSession = sessionRef.current;
    const previousId = bufferId;
    const previous = currentSession.buffers.find((buffer) => buffer.id === previousId);
    if (!previous) return currentSession;
    const wasActive = activeBufferIdRef.current === previousId;
    const identity = identityForDocument(file);
    const savedBuffer = createEditorDocumentBuffer({
      identity,
      documentKind: previous.documentKind,
      fileName: file.name || previous.fileName,
      fileRef: serializableFileRef(file),
      content,
      savedContent: content,
      revision: file.revision || null,
      status: "clean",
      updatedAt: Date.now()
    });
    const withoutPrevious = previousId && previousId !== savedBuffer.id
      ? {
          ...currentSession,
          buffers: currentSession.buffers.filter((buffer) => buffer.id !== previousId),
          openOrder: currentSession.openOrder.filter((id) => id !== previousId),
          activeBufferId: wasActive ? null : currentSession.activeBufferId
        }
      : currentSession;
    return commit(upsertEditorDocumentBuffer(withoutPrevious, savedBuffer, { activate: wasActive }));
  }, [commit]);

  const markActiveBufferSaved = useCallback((file: RuntimeFileRef, content: string) => {
    const activeId = activeBufferIdRef.current;
    return activeId ? markBufferSaved(activeId, file, content) : sessionRef.current;
  }, [markBufferSaved]);

  const updateBuffer = useCallback((bufferId: string, updates: Partial<Pick<EditorDocumentBuffer, "content" | "savedContent" | "revision" | "status" | "fileName" | "fileRef">>) => {
    const previous = sessionRef.current.buffers.find((buffer) => buffer.id === bufferId);
    if (!previous) return sessionRef.current;
    const buffer = createEditorDocumentBuffer({
      ...previous,
      ...updates,
      updatedAt: Date.now()
    });
    return commit(upsertEditorDocumentBuffer(sessionRef.current, buffer, { activate: activeBufferIdRef.current === bufferId }));
  }, [commit]);

  const replaceSession = useCallback((nextSession: EditorDocumentSession) => commit(normalizeEditorDocumentSession(nextSession) || sessionRef.current), [commit]);

  const discardAllChanges = useCallback(() => {
    const captured = captureActiveDocument();
    const buffers = captured.buffers
      .filter((buffer) => buffer.identity.kind === "file" || Boolean(buffer.savedContent))
      .map((buffer) => createEditorDocumentBuffer({
        ...buffer,
        content: buffer.savedContent,
        status: "clean",
        updatedAt: Date.now()
      }));
    const ids = new Set(buffers.map((buffer) => buffer.id));
    const openOrder = captured.openOrder.filter((id) => ids.has(id));
    return commit({
      ...captured,
      buffers,
      openOrder,
      activeBufferId: captured.activeBufferId && ids.has(captured.activeBufferId)
        ? captured.activeBufferId
        : openOrder[0] || null
    });
  }, [captureActiveDocument, commit]);

  const dirtyBuffers = useMemo(() => session.buffers.filter(editorDocumentBufferIsDirty), [session.buffers]);

  return {
    session,
    sessionRef,
    dirtyBuffers,
    captureActiveDocument,
    activateDocument,
    registerDocument,
    beginUntitledDocument,
    findFileBuffer,
    activateBuffer,
    markActiveBufferSaved,
    markBufferSaved,
    updateBuffer,
    replaceSession,
    discardAllChanges
  };
}

function createInitialSession(initialSession: EditorDocumentSession | null | undefined, activeDocument: ActiveDocumentSnapshot) {
  const normalized = normalizeEditorDocumentSession(initialSession);
  if (normalized?.buffers.length) return normalized;
  const session = createEmptyEditorDocumentSession(createSessionId("window"));
  const buffer = createEditorDocumentBuffer({
    identity: identityForDocument(activeDocument.fileRef),
    documentKind: activeDocument.documentKind,
    fileName: activeDocument.fileName,
    fileRef: serializableFileRef(activeDocument.fileRef),
    content: activeDocument.content,
    savedContent: activeDocument.savedContent,
    revision: activeDocument.fileRef?.revision || null,
    updatedAt: Date.now()
  });
  return upsertEditorDocumentBuffer(session, buffer, { activate: true });
}

function bufferForRuntimeFile(session: EditorDocumentSession, file: RuntimeFileRef | null | undefined) {
  if (!file) return null;
  const id = editorDocumentBufferId(identityForDocument(file));
  return session.buffers.find((buffer) => buffer.id === id) || null;
}

function identityForDocument(file: RuntimeFileRef | null | undefined) {
  if (file) return createFileDocumentIdentity(file.path || `browser:${file.name}`);
  return createUntitledDocumentIdentity(createSessionId("document"));
}

function serializableFileRef(file: RuntimeFileRef | null | undefined) {
  if (!file) return null;
  return { name: file.name, ...(file.path ? { path: file.path } : {}) };
}

function createSessionId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}
