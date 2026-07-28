const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const chokidar = require("chokidar");
const { diffArrays } = require("diff");
const { mergeMermaidDocument, normalizeMermaidLayoutDocument } = require("./mermaid-document-merge.cjs");

const MAX_HISTORY = 80;
const TEXT_EXTENSIONS = new Set(["mmd", "mermaid", "md", "markdown", "csv", "html", "htm", "txt"]);

function createDocumentHub({ readDocument, writeDocument, send, watch = chokidar.watch } = {}) {
  if (typeof readDocument !== "function" || typeof writeDocument !== "function") {
    throw new Error("Document Hub requires document read and write operations.");
  }
  const documentsByPath = new Map();
  const documentsById = new Map();
  const operationQueues = new Map();

  async function open(webContents, requestedPath) {
    assertTextPath(requestedPath);
    const canonical = await canonicalDocumentPath(requestedPath);
    return enqueue(canonical, async () => {
      const disk = await readDocument(canonical).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
      let document = documentsByPath.get(comparablePath(canonical));
      if (!document) {
        if (!disk) {
          const error = new Error(`Document not found: ${canonical}`);
          error.code = "ENOENT";
          error.path = canonical;
          throw error;
        }
        document = createDocumentRecord(canonical, disk);
        documentsByPath.set(comparablePath(canonical), document);
        documentsById.set(document.documentId, document);
        attachWatcher(document);
      } else if (disk) {
        await integrateDiskSnapshot(document, disk, { reason: "open" });
      } else if (document.exists) {
        document.exists = false;
        document.diskRevision = null;
        document.syncState = "deleted";
        broadcast(document, undefined, "deleted");
      }
      subscribe(document, webContents);
      return snapshot(document);
    });
  }

  async function syncWorkingCopy(webContents, request) {
    let document = resolveDocument(request);
    if (!document && typeof request?.path === "string") {
      try {
        await open(webContents, request.path);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        const canonical = await canonicalDocumentPath(request.path, { allowMissing: true });
        document = createDocumentRecord(canonical, null, typeof request?.content === "string" ? request.content : "");
        document.baseContent = typeof request?.baseContent === "string" ? request.baseContent : "";
        document.baseRevision = cleanRevision(request?.baseRevision) || null;
        document.syncState = "deleted";
        documentsByPath.set(comparablePath(canonical), document);
        documentsById.set(document.documentId, document);
        attachWatcher(document);
        subscribe(document, webContents);
      }
      document = document || resolveDocument(request);
    }
    if (!document) return { status: "missing" };
    return enqueue(document.path, async () => {
      subscribe(document, webContents);
      const expected = cleanRevision(request?.expectedWorkingRevision);
      let content = typeof request?.content === "string" ? request.content : document.workingContent;
      if (expected && expected !== document.workingRevision) {
        if (content === document.workingContent) return { status: "unchanged", snapshot: snapshot(document) };
        if (typeof request?.baseContent !== "string") return { status: "stale", snapshot: snapshot(document) };
        const staleMerge = mergeDocumentText(document.kind, request.baseContent, content, document.workingContent);
        if (staleMerge.conflicts.length) {
          document.conflict = {
            baseContent: request.baseContent,
            localContent: content,
            diskContent: document.workingContent,
            diskRevision: document.diskRevision,
            conflicts: staleMerge.conflicts,
            resolutionTemplate: staleMerge.resolutionTemplate
          };
          document.syncState = "conflict";
          broadcast(document, undefined, "conflict");
          return { status: "stale", snapshot: snapshot(document) };
        }
        content = staleMerge.text;
      }
      const ownerId = webContents?.id;
      if (!expected && document.workingContent !== document.baseContent && document.leaseOwnerId && document.leaseOwnerId !== ownerId && content !== document.workingContent) {
        if (typeof request?.baseContent !== "string") return { status: "stale", snapshot: snapshot(document) };
        const sharedMerge = mergeDocumentText(document.kind, request.baseContent, content, document.workingContent);
        if (sharedMerge.conflicts.length) {
          document.conflict = {
            baseContent: request.baseContent,
            localContent: content,
            diskContent: document.workingContent,
            diskRevision: document.diskRevision,
            conflicts: sharedMerge.conflicts,
            resolutionTemplate: sharedMerge.resolutionTemplate
          };
          document.syncState = "conflict";
          broadcast(document, undefined, "conflict");
          return { status: "stale", snapshot: snapshot(document) };
        }
        content = sharedMerge.text;
      }
      if (!expected && typeof request?.baseContent === "string" && content !== request.baseContent && document.workingContent === document.baseContent) {
        const restored = mergeDocumentText(document.kind, request.baseContent, content, document.baseContent);
        if (restored.conflicts.length) {
          document.conflict = {
            baseContent: request.baseContent,
            localContent: content,
            diskContent: document.baseContent,
            diskRevision: document.diskRevision,
            conflicts: restored.conflicts,
            resolutionTemplate: restored.resolutionTemplate
          };
          document.syncState = "conflict";
          broadcast(document, undefined, "conflict");
          return { status: "stale", snapshot: snapshot(document) };
        }
        content = restored.text;
      }
      if (ownerId) document.leaseOwnerId = ownerId;
      if (content === document.workingContent) return { status: "unchanged", snapshot: snapshot(document) };
      pushHistory(document, request?.label || "编辑文档", request?.origin || "view");
      document.workingContent = content;
      bumpWorkingVersion(document);
      document.conflict = null;
      updateDerivedState(document);
      broadcast(document, ownerId, "working-copy");
      return { status: "updated", snapshot: snapshot(document) };
    });
  }

  async function acquireLease(webContents, request) {
    const document = resolveDocument(request);
    if (!document || !webContents?.id) return { status: "missing" };
    const previousOwnerId = document.leaseOwnerId;
    document.leaseOwnerId = webContents.id;
    if (previousOwnerId && previousOwnerId !== webContents.id) broadcast(document, undefined, "lease");
    return { status: "acquired", documentId: document.documentId, leaseOwnerId: webContents.id };
  }

  async function save(webContents, request) {
    assertTextPath(request?.path);
    const canonical = await canonicalDocumentPath(request.path);
    return enqueue(canonical, async () => {
      let document = documentsByPath.get(comparablePath(canonical));
      if (!document) {
        const disk = await readDocument(canonical).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
        document = createDocumentRecord(canonical, disk, typeof request?.text === "string" ? request.text : "");
        documentsByPath.set(comparablePath(canonical), document);
        documentsById.set(document.documentId, document);
        attachWatcher(document);
      }
      subscribe(document, webContents);
      const expectedWorkingRevision = cleanRevision(request?.expectedWorkingRevision);
      if (
        request?.overwrite !== true &&
        expectedWorkingRevision &&
        expectedWorkingRevision !== document.workingRevision &&
        request?.text !== document.workingContent
      ) {
        return {
          status: "conflict",
          file: { name: document.name, path: document.path },
          revision: document.diskRevision || document.baseRevision || revisionForText(document.baseContent),
          modifiedAt: document.modifiedAt,
          snapshot: snapshot(document)
        };
      }
      if (typeof request?.text === "string" && request.text !== document.workingContent) {
        pushHistory(document, "保存前同步", "view");
        document.workingContent = request.text;
        bumpWorkingVersion(document);
      }
      document.saveState = "saving";
      broadcast(document, webContents?.id, "saving");
      const expectedRevision = request?.overwrite === true
        ? undefined
        : cleanRevision(request?.expectedRevision) || document.diskRevision || undefined;
      try {
        const result = await writeDocument(canonical, document.workingContent, {
          expectedRevision,
          overwrite: request?.overwrite === true,
          format: request?.format || document.format
        });
        if (result.status === "conflict") {
          document.saveState = "idle";
          const disk = await readDocument(canonical).catch(() => null);
          if (disk) await integrateDiskSnapshot(document, disk, { reason: "save-conflict" });
          return { ...result, snapshot: snapshot(document) };
        }
        applySavedResult(document, result);
        broadcast(document, webContents?.id, "saved");
        return { ...result, snapshot: snapshot(document) };
      } catch (error) {
        document.saveState = "error";
        document.error = error instanceof Error ? error.message : String(error);
        broadcast(document, webContents?.id, "save-error");
        throw error;
      }
    });
  }

  async function resolveConflict(webContents, request) {
    const document = resolveDocument(request);
    if (!document?.conflict) return { status: "missing" };
    return enqueue(document.path, async () => {
      if (request?.diskRevision && request.diskRevision !== document.conflict.diskRevision) {
        return { status: "stale", snapshot: snapshot(document) };
      }
      pushHistory(document, "解决外部修改冲突", "merge");
      const resolvedContent = typeof request?.content === "string" ? request.content : document.workingContent;
      document.workingContent = document.kind === "mermaid" ? normalizeMermaidLayoutDocument(resolvedContent) : resolvedContent;
      document.baseContent = document.conflict.diskContent;
      document.baseRevision = document.conflict.diskRevision;
      document.diskRevision = document.conflict.diskRevision;
      document.conflict = null;
      document.exists = true;
      bumpWorkingVersion(document);
      updateDerivedState(document);
      document.saveState = "saving";
      broadcast(document, webContents?.id, "saving");
      const result = await writeDocument(document.path, document.workingContent, { expectedRevision: document.diskRevision });
      if (result.status === "conflict") {
        document.saveState = "idle";
        const latest = await readDocument(document.path).catch(() => null);
        if (latest) await integrateDiskSnapshot(document, latest, { reason: "conflict-retry" });
        return { ...result, snapshot: snapshot(document) };
      }
      applySavedResult(document, result);
      broadcast(document, webContents?.id, "saved");
      return { ...result, snapshot: snapshot(document) };
    });
  }

  async function recreate(webContents, request) {
    const document = resolveDocument(request);
    if (!document) return { status: "missing" };
    return save(webContents, { path: document.path, text: document.workingContent, overwrite: true });
  }

  async function discard(webContents, request) {
    const document = resolveDocument(request);
    if (!document) return { status: "missing" };
    return enqueue(document.path, async () => {
      const disk = await readDocument(document.path).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
      pushHistory(document, "丢弃未保存修改", "discard");
      document.workingContent = disk?.text ?? document.baseContent;
      document.baseContent = disk?.text ?? document.baseContent;
      document.baseRevision = disk?.revision ?? document.baseRevision;
      document.diskRevision = disk?.revision ?? null;
      document.modifiedAt = disk?.modifiedAt ?? document.modifiedAt;
      document.format = disk?.format || document.format;
      document.exists = Boolean(disk);
      document.conflict = null;
      document.error = null;
      document.saveState = "idle";
      bumpWorkingVersion(document);
      updateDerivedState(document);
      broadcast(document, webContents?.id, "discarded");
      return { status: "discarded", snapshot: snapshot(document) };
    });
  }

  function get(request) {
    const document = resolveDocument(request);
    return document ? snapshot(document) : null;
  }

  function undo(webContents, request) {
    const document = resolveDocument(request);
    if (!document || !document.undoStack.length) return { status: "empty", snapshot: document ? snapshot(document) : null };
    const previous = document.undoStack.pop();
    document.redoStack.push(historyEntry(document, previous.label, previous.origin));
    document.workingContent = previous.content;
    document.conflict = null;
    bumpWorkingVersion(document);
    updateDerivedState(document);
    broadcast(document, webContents?.id, "undo");
    return { status: "updated", snapshot: snapshot(document) };
  }

  function redo(webContents, request) {
    const document = resolveDocument(request);
    if (!document || !document.redoStack.length) return { status: "empty", snapshot: document ? snapshot(document) : null };
    const next = document.redoStack.pop();
    document.undoStack.push(historyEntry(document, next.label, next.origin));
    document.workingContent = next.content;
    document.conflict = null;
    bumpWorkingVersion(document);
    updateDerivedState(document);
    broadcast(document, webContents?.id, "redo");
    return { status: "updated", snapshot: snapshot(document) };
  }

  async function refreshPath(requestedPath, reason = "watch") {
    const canonical = await canonicalDocumentPath(requestedPath, { allowMissing: true });
    const document = documentsByPath.get(comparablePath(canonical));
    if (!document) return null;
    return enqueue(document.path, async () => {
      const disk = await readDocument(document.path).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
      if (!disk) {
        if (document.exists) {
          document.exists = false;
          document.syncState = "deleted";
          document.diskRevision = null;
          broadcast(document, undefined, "deleted");
        }
        return snapshot(document);
      }
      await integrateDiskSnapshot(document, disk, { reason });
      return snapshot(document);
    });
  }

  async function releaseSubscriber(webContentsId) {
    for (const document of documentsById.values()) {
      document.subscribers.delete(webContentsId);
      if (document.leaseOwnerId === webContentsId) document.leaseOwnerId = null;
      if (!document.subscribers.size && document.syncState === "clean") await closeWatcher(document);
    }
  }

  async function refreshSubscriber(webContentsId) {
    const paths = [...documentsById.values()]
      .filter((document) => document.subscribers.has(webContentsId))
      .map((document) => document.path);
    return Promise.all(paths.map((filePath) => refreshPath(filePath, "focus").catch(() => null)));
  }

  async function movePath(sourcePath, targetPath) {
    const source = path.resolve(sourcePath);
    const target = path.resolve(targetPath);
    const affected = [...documentsById.values()].filter((document) => {
      const relative = path.relative(source, document.path);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
    for (const document of affected) {
      await enqueue(document.path, async () => {
        const previousKey = comparablePath(document.path);
        const relative = path.relative(source, document.path);
        const nextPath = relative ? path.join(target, relative) : target;
        await closeWatcher(document);
        documentsByPath.delete(previousKey);
        document.path = nextPath;
        document.name = path.basename(nextPath);
        document.kind = documentKind(nextPath);
        documentsByPath.set(comparablePath(nextPath), document);
        const disk = await readDocument(nextPath).catch(() => null);
        if (disk) {
          document.exists = true;
          document.diskRevision = disk.revision;
          document.baseRevision = disk.revision;
          document.baseContent = disk.text;
          document.modifiedAt = disk.modifiedAt || Date.now();
          updateDerivedState(document);
        }
        attachWatcher(document);
        broadcast(document, undefined, "moved");
      });
    }
    return affected.map(snapshot);
  }

  async function markDeletedPath(sourcePath) {
    const source = path.resolve(sourcePath);
    const affected = [...documentsById.values()].filter((document) => {
      const relative = path.relative(source, document.path);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
    for (const document of affected) {
      document.exists = false;
      document.diskRevision = null;
      document.syncState = "deleted";
      broadcast(document, undefined, "deleted");
    }
    return affected.map(snapshot);
  }

  async function closeAll() {
    await Promise.all([...documentsById.values()].map(closeWatcher));
    documentsByPath.clear();
    documentsById.clear();
    operationQueues.clear();
  }

  async function integrateDiskSnapshot(document, disk, { reason } = {}) {
    if (disk.revision === document.diskRevision && document.exists) return "unchanged";
    const previouslyExisted = document.exists;
    const previousDiskRevision = document.diskRevision;
    document.exists = true;
      document.diskRevision = disk.revision;
      document.modifiedAt = disk.modifiedAt || Date.now();
      document.format = disk.format || document.format;
    if (document.workingContent === document.baseContent) {
      pushHistory(document, "从磁盘刷新", "disk");
      document.baseContent = disk.text;
      document.baseRevision = disk.revision;
      document.workingContent = disk.text;
      document.conflict = null;
      bumpWorkingVersion(document);
      updateDerivedState(document);
      if (previousDiskRevision || !previouslyExisted) broadcast(document, undefined, reason || "disk");
      return "reloaded";
    }
    const merge = mergeDocumentText(document.kind, document.baseContent, document.workingContent, disk.text);
    if (!merge.conflicts.length) {
      pushHistory(document, "自动合并磁盘修改", "disk-merge");
      document.baseContent = disk.text;
      document.baseRevision = disk.revision;
      document.workingContent = merge.text;
      document.conflict = null;
      bumpWorkingVersion(document);
      updateDerivedState(document);
      broadcast(document, undefined, "merged");
      const result = await writeDocument(document.path, document.workingContent, { expectedRevision: disk.revision });
      if (result.status === "saved") {
        applySavedResult(document, result);
        broadcast(document, undefined, "saved");
      } else {
        const latest = await readDocument(document.path).catch(() => null);
        if (latest && latest.revision !== disk.revision) await integrateDiskSnapshot(document, latest, { reason: "merge-retry" });
      }
      return "merged";
    }
    document.conflict = {
      baseContent: document.baseContent,
      localContent: document.workingContent,
      diskContent: disk.text,
      diskRevision: disk.revision,
      conflicts: merge.conflicts,
      resolutionTemplate: merge.resolutionTemplate
    };
    document.syncState = "conflict";
    broadcast(document, undefined, "conflict");
    return "conflict";
  }

  function attachWatcher(document) {
    if (document.watcher) return;
    const watcher = watch(document.path, {
      atomic: true,
      awaitWriteFinish: { stabilityThreshold: 140, pollInterval: 25 },
      ignoreInitial: true,
      persistent: true
    });
    const refresh = () => void refreshPath(document.path).catch(() => undefined);
    watcher.on("add", refresh);
    watcher.on("change", refresh);
    watcher.on("unlink", refresh);
    document.watcher = watcher;
  }

  async function closeWatcher(document) {
    const watcher = document.watcher;
    document.watcher = null;
    await watcher?.close?.();
  }

  function subscribe(document, webContents) {
    if (webContents?.id && !webContents.isDestroyed?.()) {
      document.subscribers.set(webContents.id, webContents);
      attachWatcher(document);
    }
  }

  function broadcast(document, sourceId, reason) {
    const payload = { reason, sourceId, snapshot: snapshot(document) };
    for (const [id, webContents] of document.subscribers) {
      if (webContents.isDestroyed?.()) {
        document.subscribers.delete(id);
        continue;
      }
      if (id !== sourceId) send?.(webContents, payload);
    }
  }

  function resolveDocument(request) {
    if (typeof request?.documentId === "string") {
      const byId = documentsById.get(request.documentId);
      if (byId) return byId;
    }
    if (typeof request?.path === "string") return documentsByPath.get(comparablePath(path.resolve(request.path))) || null;
    return null;
  }

  function enqueue(key, task) {
    const normalized = comparablePath(key);
    const previous = operationQueues.get(normalized) || Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    operationQueues.set(normalized, current);
    return current.finally(() => {
      if (operationQueues.get(normalized) === current) operationQueues.delete(normalized);
    });
  }

  return {
    acquireLease,
    closeAll,
    discard,
    get,
    markDeletedPath,
    movePath,
    open,
    recreate,
    refreshSubscriber,
    redo,
    refreshPath,
    releaseSubscriber,
    resolveConflict,
    save,
    syncWorkingCopy,
    undo
  };
}

function createDocumentRecord(filePath, disk, initialContent = "") {
  const content = disk?.text ?? initialContent;
  const revision = disk?.revision || null;
  return {
    documentId: crypto.randomUUID(),
    path: filePath,
    name: path.basename(filePath),
    kind: documentKind(filePath),
    exists: Boolean(disk),
    workingContent: content,
    workingVersion: 1,
    workingRevision: revisionForText(content),
    baseContent: disk?.text ?? "",
    baseRevision: revision,
    diskRevision: revision,
    modifiedAt: disk?.modifiedAt || 0,
    format: disk?.format || { encoding: "utf8", bom: false, lineEnding: "lf" },
    syncState: disk ? "clean" : "deleted",
    saveState: "idle",
    error: null,
    conflict: null,
    leaseOwnerId: null,
    undoStack: [],
    redoStack: [],
    subscribers: new Map(),
    watcher: null
  };
}

function snapshot(document) {
  return {
    documentId: document.documentId,
    file: {
      name: document.name,
      path: document.path,
      revision: document.diskRevision || undefined,
      documentId: document.documentId,
      workingRevision: document.workingRevision
    },
    kind: document.kind,
    content: document.workingContent,
    savedContent: document.baseContent,
    workingVersion: document.workingVersion,
    workingRevision: document.workingRevision,
    baseRevision: document.baseRevision,
    diskRevision: document.diskRevision,
    modifiedAt: document.modifiedAt,
    format: document.format,
    exists: document.exists,
    syncState: document.syncState,
    saveState: document.saveState,
    dirty: document.workingContent !== document.baseContent,
    leaseOwnerId: document.leaseOwnerId,
    canUndo: document.undoStack.length > 0,
    canRedo: document.redoStack.length > 0,
    error: document.error,
    conflict: document.conflict ? {
      baseContent: document.conflict.baseContent,
      localContent: document.conflict.localContent,
      diskContent: document.conflict.diskContent,
      diskRevision: document.conflict.diskRevision,
      conflicts: document.conflict.conflicts,
      resolutionTemplate: document.conflict.resolutionTemplate
    } : null
  };
}

function applySavedResult(document, result) {
  document.baseContent = document.workingContent;
  document.baseRevision = result.revision;
  document.diskRevision = result.revision;
  document.modifiedAt = result.modifiedAt || Date.now();
  document.format = result.format || document.format;
  document.exists = true;
  document.saveState = "idle";
  document.error = null;
  document.conflict = null;
  updateDerivedState(document);
}

function updateDerivedState(document) {
  if (!document.exists) document.syncState = "deleted";
  else if (document.conflict) document.syncState = "conflict";
  else document.syncState = document.workingContent === document.baseContent ? "clean" : "dirty";
}

function bumpWorkingVersion(document) {
  document.workingVersion += 1;
  document.workingRevision = revisionForText(document.workingContent);
}

function pushHistory(document, label, origin) {
  document.undoStack.push(historyEntry(document, label, origin));
  document.undoStack = document.undoStack.slice(-MAX_HISTORY);
  document.redoStack = [];
}

function historyEntry(document, label, origin) {
  return { content: document.workingContent, label, origin, at: Date.now() };
}

function mergeDocumentText(kind, baseText, localText, diskText) {
  if (kind === "mermaid") {
    const structured = mergeMermaidDocument(
      baseText,
      localText,
      diskText,
      (baseBody, localBody, diskBody) => mergeText(baseBody, localBody, diskBody, { tokenNamespace: "MMM_TEXT_CONFLICT" })
    );
    if (structured) return structured;
  }
  return mergeText(baseText, localText, diskText);
}

function mergeText(baseText, localText, diskText, options = {}) {
  if (localText === diskText) return { text: localText, conflicts: [], resolutionTemplate: localText };
  if (localText === baseText) return { text: diskText, conflicts: [], resolutionTemplate: diskText };
  if (diskText === baseText) return { text: localText, conflicts: [], resolutionTemplate: localText };
  const base = splitLines(baseText);
  const localEdits = diffEdits(base, splitLines(localText), "local");
  const diskEdits = diffEdits(base, splitLines(diskText), "disk");
  const conflicts = [];
  const consumedLocal = new Set();
  const consumedDisk = new Set();
  for (const [localIndex, local] of localEdits.entries()) {
    const diskIndex = diskEdits.findIndex((disk, index) => !consumedDisk.has(index) && editsOverlap(local, disk) && !sameEdit(local, disk));
    if (diskIndex < 0) continue;
    const disk = diskEdits[diskIndex];
    consumedLocal.add(localIndex);
    consumedDisk.add(diskIndex);
    const start = Math.min(local.start, disk.start);
    const end = Math.max(local.end, disk.end);
    const token = `\uE000${options.tokenNamespace || "MMM_CONFLICT"}_${conflicts.length}\uE001`;
    conflicts.push({
      start,
      end,
      base: base.slice(start, end).join(""),
      local: replacementForUnion(base, local, start, end),
      disk: replacementForUnion(base, disk, start, end),
      token,
      kind: "text",
      label: `文本冲突 ${conflicts.length + 1}`
    });
  }
  const unique = [];
  for (const [index, edit] of localEdits.entries()) if (!consumedLocal.has(index)) unique.push(edit);
  for (const [index, edit] of diskEdits.entries()) {
    if (consumedDisk.has(index) || unique.some((candidate) => sameEdit(candidate, edit))) continue;
    unique.push(edit);
  }
  const combined = [
    ...unique,
    ...conflicts.map((conflict) => ({ start: conflict.start, end: conflict.end, replacement: [conflict.token], origin: "conflict" }))
  ];
  const merged = [...base];
  for (const edit of combined.sort((left, right) => right.start - left.start || right.end - left.end)) {
    merged.splice(edit.start, edit.end - edit.start, ...edit.replacement);
  }
  const resolutionTemplate = merged.join("");
  return { text: conflicts.length ? localText : resolutionTemplate, conflicts, resolutionTemplate };
}

function replacementForUnion(base, edit, start, end) {
  const value = base.slice(start, end);
  value.splice(edit.start - start, edit.end - edit.start, ...edit.replacement);
  return value.join("");
}

function diffEdits(base, next, origin) {
  const changes = diffArrays(base, next);
  const edits = [];
  let baseIndex = 0;
  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];
    if (!change.added && !change.removed) {
      baseIndex += change.value.length;
      continue;
    }
    const start = baseIndex;
    let end = start;
    const replacement = [];
    while (index < changes.length && (changes[index].added || changes[index].removed)) {
      const current = changes[index];
      if (current.removed) {
        end += current.value.length;
        baseIndex += current.value.length;
      } else if (current.added) replacement.push(...current.value);
      index += 1;
    }
    index -= 1;
    edits.push({ start, end, replacement, origin });
  }
  return edits;
}

function editsOverlap(left, right) {
  if (left.start === left.end && right.start === right.end) return left.start === right.start;
  if (left.start === left.end) return left.start > right.start && left.start < right.end;
  if (right.start === right.end) return right.start > left.start && right.start < left.end;
  return left.start < right.end && right.start < left.end;
}

function sameEdit(left, right) {
  return left.start === right.start && left.end === right.end && left.replacement.join("") === right.replacement.join("");
}

function splitLines(text) {
  return text.match(/[^\n]*\n|[^\n]+$/g) || [];
}

async function canonicalDocumentPath(value, { allowMissing = false } = {}) {
  const resolved = path.resolve(String(value || ""));
  try {
    return await fsp.realpath(resolved);
  } catch (error) {
    if (!allowMissing && error?.code !== "ENOENT") throw error;
    const parent = await fsp.realpath(path.dirname(resolved)).catch(() => path.dirname(resolved));
    return path.join(parent, path.basename(resolved));
  }
}

function comparablePath(value) {
  const normalized = path.resolve(value).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function documentKind(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "csv") return "csv";
  if (extension === "html" || extension === "htm") return "html";
  if (extension === "txt") return "text";
  return "mermaid";
}

function assertTextPath(filePath) {
  const extension = path.extname(String(filePath || "")).slice(1).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) {
    const error = new Error("Only Mermaid, Markdown, CSV, HTML, and plain-text documents are managed by the Document Hub.");
    error.code = "unsupported_type";
    error.path = filePath;
    throw error;
  }
}

function revisionForText(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function cleanRevision(value) {
  return typeof value === "string" && value.trim() && value !== "missing" ? value : undefined;
}

module.exports = {
  MAX_HISTORY,
  createDocumentHub,
  mergeText
};
