import { documentKindFromPath, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";

export const EDITOR_DOCUMENT_SESSION_VERSION = 1 as const;

export type EditorDocumentBufferStatus = "clean" | "dirty" | "saving" | "conflict" | "error";

export type EditorDocumentIdentity =
  | { kind: "file"; path: string }
  | { kind: "untitled"; id: string };

export type EditorDocumentFileRef = {
  name: string;
  path?: string;
};

export type EditorDocumentBuffer = {
  id: string;
  identity: EditorDocumentIdentity;
  documentKind: DocumentKind;
  fileName: string;
  fileRef: EditorDocumentFileRef | null;
  content: string;
  savedContent: string;
  revision: string | null;
  status: EditorDocumentBufferStatus;
  updatedAt: number;
};

export type EditorDocumentSession = {
  version: typeof EDITOR_DOCUMENT_SESSION_VERSION;
  windowId: string;
  buffers: EditorDocumentBuffer[];
  openOrder: string[];
  activeBufferId: string | null;
};

export type CreateEditorDocumentBufferInput = {
  identity: EditorDocumentIdentity;
  documentKind: DocumentKind;
  fileName: string;
  fileRef?: EditorDocumentFileRef | null;
  content?: string;
  savedContent?: string;
  revision?: string | null;
  status?: EditorDocumentBufferStatus;
  updatedAt?: number;
};

export type LegacySingleDocumentDraft = {
  documentKind?: unknown;
  source?: unknown;
  fileName?: unknown;
  fileRef?: unknown;
  lastSavedDocument?: unknown;
  revision?: unknown;
};

export function createEmptyEditorDocumentSession(windowId: string): EditorDocumentSession {
  return {
    version: EDITOR_DOCUMENT_SESSION_VERSION,
    windowId: normalizeRequiredId(windowId, "window"),
    buffers: [],
    openOrder: [],
    activeBufferId: null
  };
}

export function createFileDocumentIdentity(path: string): EditorDocumentIdentity {
  return { kind: "file", path: normalizeFileIdentityPath(path) };
}

export function createUntitledDocumentIdentity(id: string): EditorDocumentIdentity {
  return { kind: "untitled", id: normalizeRequiredId(id, "document") };
}

export function editorDocumentBufferId(identity: EditorDocumentIdentity) {
  return identity.kind === "file" ? `file:${normalizeFileIdentityPath(identity.path)}` : `untitled:${normalizeRequiredId(identity.id, "document")}`;
}

export function createEditorDocumentBuffer(input: CreateEditorDocumentBufferInput): EditorDocumentBuffer {
  const identity = normalizeEditorDocumentIdentity(input.identity);
  if (!identity) throw new Error("Invalid editor document identity");
  const content = input.content ?? "";
  const savedContent = input.savedContent ?? "";
  return {
    id: editorDocumentBufferId(identity),
    identity,
    documentKind: input.documentKind,
    fileName: normalizeFileName(input.fileName, input.documentKind),
    fileRef: normalizeDocumentFileRef(input.fileRef),
    content,
    savedContent,
    revision: normalizeRevision(input.revision),
    status: normalizeBufferStatus(input.status, content, savedContent),
    updatedAt: normalizeTimestamp(input.updatedAt)
  };
}

export function editorDocumentBufferIsDirty(buffer: Pick<EditorDocumentBuffer, "content" | "savedContent">) {
  return buffer.content !== buffer.savedContent;
}

export function normalizeEditorDocumentSession(value: unknown): EditorDocumentSession | null {
  if (!isRecord(value)) return null;
  const windowId = normalizeOptionalId(value.windowId);
  if (!windowId || !Array.isArray(value.buffers)) return null;

  const buffers: EditorDocumentBuffer[] = [];
  const ids = new Set<string>();
  const aliases = new Map<string, string>();
  for (const rawBuffer of value.buffers) {
    const buffer = normalizeEditorDocumentBuffer(rawBuffer);
    if (!buffer || ids.has(buffer.id)) continue;
    buffers.push(buffer);
    ids.add(buffer.id);
    if (isRecord(rawBuffer) && typeof rawBuffer.id === "string") aliases.set(rawBuffer.id, buffer.id);
  }

  const requestedOrder = Array.isArray(value.openOrder) ? value.openOrder : [];
  const openOrder: string[] = [];
  const orderedIds = new Set<string>();
  for (const rawId of requestedOrder) {
    if (typeof rawId !== "string") continue;
    const id = aliases.get(rawId) || rawId;
    if (!ids.has(id) || orderedIds.has(id)) continue;
    orderedIds.add(id);
    openOrder.push(id);
  }
  for (const buffer of buffers) {
    if (orderedIds.has(buffer.id)) continue;
    openOrder.push(buffer.id);
  }

  const requestedActiveId = typeof value.activeBufferId === "string"
    ? aliases.get(value.activeBufferId) || value.activeBufferId
    : null;
  const activeBufferId = requestedActiveId && ids.has(requestedActiveId) ? requestedActiveId : openOrder[0] || null;

  return {
    version: EDITOR_DOCUMENT_SESSION_VERSION,
    windowId,
    buffers,
    openOrder,
    activeBufferId
  };
}

export function migrateLegacySingleDocumentDraft(
  stored: LegacySingleDocumentDraft,
  options: { windowId: string; untitledId?: string }
): EditorDocumentSession {
  const fileRef = normalizeDocumentFileRef(stored.fileRef);
  const rawFileName = typeof stored.fileName === "string" ? stored.fileName : fileRef?.name || "diagram.mmd";
  const documentKind = normalizeDocumentKind(stored.documentKind, fileRef?.path || rawFileName);
  const fileName = normalizeFileName(rawFileName, documentKind);
  const identity = fileRef
    ? createFileDocumentIdentity(fileRef.path || fileRef.name)
    : createUntitledDocumentIdentity(options.untitledId || "legacy");
  const buffer = createEditorDocumentBuffer({
    identity,
    documentKind,
    fileName,
    fileRef,
    content: typeof stored.source === "string" ? stored.source : "",
    savedContent: typeof stored.lastSavedDocument === "string" ? stored.lastSavedDocument : "",
    revision: normalizeRevision(stored.revision)
  });

  return {
    version: EDITOR_DOCUMENT_SESSION_VERSION,
    windowId: normalizeRequiredId(options.windowId, "window"),
    buffers: [buffer],
    openOrder: [buffer.id],
    activeBufferId: buffer.id
  };
}

export function upsertEditorDocumentBuffer(
  session: EditorDocumentSession,
  buffer: EditorDocumentBuffer,
  options: { activate?: boolean } = {}
): EditorDocumentSession {
  const normalizedBuffer = createEditorDocumentBuffer(buffer);
  const index = session.buffers.findIndex((item) => item.id === normalizedBuffer.id);
  const buffers = index < 0
    ? [...session.buffers, normalizedBuffer]
    : session.buffers.map((item, itemIndex) => itemIndex === index ? normalizedBuffer : item);
  const openOrder = session.openOrder.includes(normalizedBuffer.id)
    ? session.openOrder
    : [...session.openOrder, normalizedBuffer.id];
  return {
    ...session,
    buffers,
    openOrder,
    activeBufferId: options.activate || !session.activeBufferId ? normalizedBuffer.id : session.activeBufferId
  };
}

export function activateEditorDocumentBuffer(session: EditorDocumentSession, bufferId: string): EditorDocumentSession {
  return session.openOrder.includes(bufferId) ? { ...session, activeBufferId: bufferId } : session;
}

export function closeEditorDocumentBuffer(session: EditorDocumentSession, bufferId: string): EditorDocumentSession {
  const closedIndex = session.openOrder.indexOf(bufferId);
  if (closedIndex < 0) return session;
  const buffers = session.buffers.filter((buffer) => buffer.id !== bufferId);
  const openOrder = session.openOrder.filter((id) => id !== bufferId);
  const activeBufferId = session.activeBufferId === bufferId
    ? openOrder[Math.min(closedIndex, openOrder.length - 1)] || null
    : session.activeBufferId;
  return { ...session, buffers, openOrder, activeBufferId };
}

function normalizeEditorDocumentBuffer(value: unknown): EditorDocumentBuffer | null {
  if (!isRecord(value)) return null;
  const identity = normalizeEditorDocumentIdentity(value.identity);
  if (!identity) return null;
  const fileRef = normalizeDocumentFileRef(value.fileRef);
  const documentKind = normalizeDocumentKind(value.documentKind, fileRef?.path || (typeof value.fileName === "string" ? value.fileName : identity.kind === "file" ? identity.path : undefined));
  return createEditorDocumentBuffer({
    identity,
    documentKind,
    fileName: typeof value.fileName === "string" ? value.fileName : fileRef?.name || defaultFileName(documentKind),
    fileRef,
    content: typeof value.content === "string" ? value.content : "",
    savedContent: typeof value.savedContent === "string" ? value.savedContent : "",
    revision: normalizeRevision(value.revision),
    status: normalizeBufferStatusValue(value.status),
    updatedAt: normalizeTimestamp(value.updatedAt)
  });
}

function normalizeEditorDocumentIdentity(value: unknown): EditorDocumentIdentity | null {
  if (isRecord(value) && value.kind === "file" && typeof value.path === "string" && value.path.trim()) {
    return createFileDocumentIdentity(value.path);
  }
  if (isRecord(value) && value.kind === "untitled" && typeof value.id === "string" && value.id.trim()) {
    return createUntitledDocumentIdentity(value.id);
  }
  return null;
}

function normalizeDocumentFileRef(value: unknown): EditorDocumentFileRef | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  const path = typeof value.path === "string" && value.path.trim() ? value.path : undefined;
  return { name: value.name.trim(), ...(path ? { path } : {}) };
}

function normalizeDocumentKind(value: unknown, filePath?: string): DocumentKind {
  if (value === "markdown" || value === "canvas" || value === "mermaid") return value;
  return documentKindFromPath(filePath) || "mermaid";
}

function normalizeBufferStatus(value: unknown, content: string, savedContent: string): EditorDocumentBufferStatus {
  if (content === savedContent) return "clean";
  if (value === "conflict" || value === "error") return value;
  return value === "saving" ? "saving" : "dirty";
}

function normalizeBufferStatusValue(value: unknown): EditorDocumentBufferStatus | undefined {
  return value === "clean" || value === "dirty" || value === "saving" || value === "conflict" || value === "error" ? value : undefined;
}

function normalizeRevision(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeTimestamp(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function normalizeFileName(value: string, documentKind: DocumentKind) {
  return value.trim() || defaultFileName(documentKind);
}

function defaultFileName(documentKind: DocumentKind) {
  if (documentKind === "markdown") return "document.md";
  if (documentKind === "canvas") return "board.canvas.json";
  return "diagram.mmd";
}

function normalizeFileIdentityPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("File identity requires a path or browser file name");
  const usedWindowsSeparators = trimmed.includes("\\");
  let normalized = trimmed.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, "");
  if (usedWindowsSeparators || /^[a-z]:\//i.test(normalized)) normalized = normalized.toLowerCase();
  return normalized;
}

function normalizeOptionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeRequiredId(value: string, label: string) {
  const normalized = normalizeOptionalId(value);
  if (!normalized) throw new Error(`Editor ${label} id is required`);
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
