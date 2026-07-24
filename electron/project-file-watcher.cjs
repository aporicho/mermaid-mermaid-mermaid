const fsp = require("node:fs/promises");
const path = require("node:path");
const chokidar = require("chokidar");

const WATCH_BATCH_DELAY_MS = 120;
const SKIPPED_PROJECT_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".mermaid-canvas-editor",
  "node_modules",
  "dist",
  "build",
  ".vite",
  ".next",
  "target",
  "dist-electron"
]);

function createProjectFileWatcher({ send, watch = chokidar.watch, batchDelayMs = WATCH_BATCH_DELAY_MS } = {}) {
  if (typeof send !== "function") throw new Error("Project file watcher requires an event sender.");
  const entries = new Map();
  const subscriptions = new Map();
  const targetUpdates = new Map();

  function setTargets(webContents, request) {
    if (!webContents || webContents.isDestroyed?.()) return { status: "closed" };
    const previous = targetUpdates.get(webContents.id) || Promise.resolve();
    const update = previous.catch(() => undefined).then(() => applyTargets(webContents, request));
    targetUpdates.set(webContents.id, update);
    return update.finally(() => {
      if (targetUpdates.get(webContents.id) === update) targetUpdates.delete(webContents.id);
    });
  }

  async function applyTargets(webContents, request) {
    await removeSubscriberNow(webContents.id);
    const targets = await normalizeWatchTargets(request);
    const keys = [];

    if (targets.rootPath) {
      const key = `root:${targets.rootPath}`;
      const entry = ensureEntry(key, targets.rootPath, targets.rootPath);
      entry.subscribers.set(webContents.id, webContents);
      keys.push(key);
    }
    for (const filePath of targets.extraPaths) {
      if (targets.rootPath && isPathInside(filePath, targets.rootPath)) continue;
      const key = `file:${filePath}`;
      const entry = ensureEntry(key, filePath, undefined);
      entry.subscribers.set(webContents.id, webContents);
      keys.push(key);
    }

    subscriptions.set(webContents.id, keys);
    return { status: "watching", rootPath: targets.rootPath, extraPaths: targets.extraPaths };
  }

  function ensureEntry(key, targetPath, rootPath) {
    const existing = entries.get(key);
    if (existing) return existing;
    const pending = new Map();
    const watcher = watch(targetPath, {
      atomic: true,
      awaitWriteFinish: { stabilityThreshold: 140, pollInterval: 25 },
      ignoreInitial: true,
      ignored: rootPath ? (candidate) => ignoredProjectPath(rootPath, candidate) : undefined,
      persistent: true
    });
    const entry = { key, rootPath, targetPath, watcher, subscribers: new Map(), pending, timer: undefined };
    const queue = (kind, changedPath, directory = false) => queueChange(entry, kind, changedPath, directory);
    watcher.on("add", (changedPath) => queue("added", changedPath));
    watcher.on("change", (changedPath) => queue("changed", changedPath));
    watcher.on("unlink", (changedPath) => queue("removed", changedPath));
    watcher.on("addDir", (changedPath) => queue("added", changedPath, true));
    watcher.on("unlinkDir", (changedPath) => queue("removed", changedPath, true));
    entries.set(key, entry);
    return entry;
  }

  function queueChange(entry, kind, changedPath, directory) {
    const normalizedPath = path.resolve(changedPath);
    const previous = entry.pending.get(normalizedPath);
    entry.pending.set(normalizedPath, {
      directory: Boolean(directory),
      kind: mergeChangeKind(previous?.kind, kind),
      path: normalizedPath
    });
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => flushEntry(entry), batchDelayMs);
  }

  function flushEntry(entry) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    const changes = [...entry.pending.values()];
    entry.pending.clear();
    if (!changes.length) return;
    const payload = {
      rootPath: entry.rootPath,
      changes,
      observedAt: Date.now()
    };
    for (const webContents of entry.subscribers.values()) {
      if (!webContents.isDestroyed?.()) send(webContents, payload);
    }
  }

  async function removeSubscriber(webContentsId) {
    await targetUpdates.get(webContentsId)?.catch(() => undefined);
    await removeSubscriberNow(webContentsId);
  }

  async function removeSubscriberNow(webContentsId) {
    const keys = subscriptions.get(webContentsId) || [];
    subscriptions.delete(webContentsId);
    await Promise.all(keys.map(async (key) => {
      const entry = entries.get(key);
      if (!entry) return;
      entry.subscribers.delete(webContentsId);
      if (entry.subscribers.size > 0) return;
      if (entry.timer) clearTimeout(entry.timer);
      entries.delete(key);
      await entry.watcher.close();
    }));
  }

  async function closeAll() {
    await Promise.allSettled(targetUpdates.values());
    targetUpdates.clear();
    subscriptions.clear();
    const active = [...entries.values()];
    entries.clear();
    await Promise.all(active.map(async (entry) => {
      if (entry.timer) clearTimeout(entry.timer);
      await entry.watcher.close();
    }));
  }

  return { closeAll, removeSubscriber, setTargets };
}

async function normalizeWatchTargets(request) {
  let rootPath;
  const requestedRoot = cleanPath(request?.rootPath);
  if (requestedRoot) {
    const realRoot = await fsp.realpath(requestedRoot);
    const stats = await fsp.stat(realRoot);
    if (!stats.isDirectory()) throw watchError("unsupported_type", "Project watch root must be a directory.", realRoot);
    rootPath = realRoot;
  }

  const extraPaths = [];
  for (const value of Array.isArray(request?.extraPaths) ? request.extraPaths : []) {
    const candidate = cleanPath(value);
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (!extraPaths.includes(resolved)) extraPaths.push(resolved);
  }
  return { rootPath, extraPaths };
}

function cleanPath(value) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) return "";
  return path.resolve(value);
}

function ignoredProjectPath(rootPath, candidate) {
  const relative = path.relative(rootPath, path.resolve(candidate));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return false;
  return relative.split(path.sep).some((segment) => SKIPPED_PROJECT_DIRECTORIES.has(segment.toLowerCase()));
}

function isPathInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return !relative || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function mergeChangeKind(previous, next) {
  if (!previous || previous === next) return next;
  if (previous === "removed" && next === "added") return "changed";
  if (next === "removed") return "removed";
  if (previous === "added") return "added";
  return next;
}

function watchError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  error.path = filePath;
  return error;
}

module.exports = {
  SKIPPED_PROJECT_DIRECTORIES,
  WATCH_BATCH_DELAY_MS,
  createProjectFileWatcher,
  ignoredProjectPath,
  mergeChangeKind
};
