const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const MARKDOWN_FOLD_DIRECTORY = ".mermaid-canvas-editor";
const MARKDOWN_FOLD_FILE = "markdown-folds.json";
const MARKDOWN_FOLD_STORE_VERSION = 1;
const MAX_MARKDOWN_FOLD_STORE_BYTES = 2 * 1024 * 1024;
const MAX_MARKDOWN_FOLDS_PER_DOCUMENT = 5_000;
const projectQueues = new Map();

async function readProjectMarkdownFoldState(request) {
  const context = await resolveRequest(request);
  return withProjectQueue(context.root, async () => {
    const store = await readStore(context.storePath);
    return store.documents[context.relativePath] || null;
  });
}

async function writeProjectMarkdownFoldState(request) {
  const context = await resolveRequest(request);
  const snapshot = normalizeSnapshot(request?.snapshot);
  if (!snapshot) throw foldStoreError("write_failed", "Markdown fold state is invalid.", context.storePath);

  return withProjectQueue(context.root, async () => {
    const store = await readStore(context.storePath);
    if (snapshot.folds.length > 0) store.documents[context.relativePath] = snapshot;
    else delete store.documents[context.relativePath];
    await writeStore(context, store);
    return { status: "saved" };
  });
}

async function moveProjectMarkdownFoldState(request) {
  const root = await resolveProjectRoot(request?.rootPath);
  const source = projectRelativePath(root, request?.sourcePath);
  const target = projectRelativePath(root, request?.targetPath);
  const context = { root, storePath: path.join(root, MARKDOWN_FOLD_DIRECTORY, MARKDOWN_FOLD_FILE) };

  return withProjectQueue(root, async () => {
    const store = await readStore(context.storePath);
    const snapshot = store.documents[source];
    if (!snapshot || source === target) return { status: "noop" };
    store.documents[target] = snapshot;
    delete store.documents[source];
    await writeStore(context, store);
    return { status: "moved" };
  });
}

async function resolveRequest(request) {
  const root = await resolveProjectRoot(request?.rootPath);
  const relativePath = projectRelativePath(root, request?.documentPath);
  if (!/\.(?:md|markdown)$/i.test(relativePath)) {
    throw foldStoreError("unsupported_type", "Markdown fold state requires a Markdown document.", request?.documentPath);
  }
  return {
    root,
    relativePath,
    storePath: path.join(root, MARKDOWN_FOLD_DIRECTORY, MARKDOWN_FOLD_FILE)
  };
}

async function resolveProjectRoot(rootPath) {
  const value = String(rootPath || "");
  if (!value || value.includes("\0")) throw foldStoreError("permission_denied", "Project root path is required.");
  const root = await fsp.realpath(value);
  const stats = await fsp.stat(root);
  if (!stats.isDirectory()) throw foldStoreError("unsupported_type", "Project root must be a directory.", root);
  return root;
}

function projectRelativePath(root, documentPath) {
  const value = String(documentPath || "");
  if (!value || value.includes("\0")) throw foldStoreError("permission_denied", "Markdown document path is required.");
  const candidate = path.resolve(value);
  const relative = path.relative(root, candidate);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw foldStoreError("permission_denied", "Markdown document must stay inside the project root.", candidate);
  }
  return relative.split(path.sep).join("/");
}

async function readStore(storePath) {
  let text;
  try {
    text = await fsp.readFile(storePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return emptyStore();
    throw foldStoreError("read_failed", readableError(error), storePath);
  }
  if (Buffer.byteLength(text, "utf8") > MAX_MARKDOWN_FOLD_STORE_BYTES) {
    throw foldStoreError("read_failed", "Markdown fold metadata is too large.", storePath);
  }

  try {
    const parsed = JSON.parse(text);
    return normalizeStore(parsed);
  } catch (error) {
    throw foldStoreError("read_failed", `Markdown fold metadata is invalid: ${readableError(error)}`, storePath);
  }
}

async function writeStore(context, store) {
  const directory = path.dirname(context.storePath);
  const existing = await fsp.lstat(directory).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) {
    throw foldStoreError("permission_denied", "Markdown fold metadata directory must be a regular directory.", directory);
  }
  await fsp.mkdir(directory, { recursive: true });

  const temporaryPath = path.join(directory, `.${MARKDOWN_FOLD_FILE}.${crypto.randomUUID()}.tmp`);
  try {
    await fsp.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fsp.rename(temporaryPath, context.storePath);
  } catch (error) {
    await fsp.unlink(temporaryPath).catch(() => undefined);
    throw foldStoreError("write_failed", readableError(error), context.storePath);
  }
}

function normalizeStore(value) {
  if (!value || typeof value !== "object" || value.version !== MARKDOWN_FOLD_STORE_VERSION || !value.documents || typeof value.documents !== "object" || Array.isArray(value.documents)) {
    throw new Error("Expected a version 1 Markdown fold store.");
  }
  const documents = {};
  for (const [relativePath, snapshot] of Object.entries(value.documents)) {
    const normalized = normalizeSnapshot(snapshot);
    if (typeof relativePath === "string" && relativePath && normalized) documents[relativePath] = normalized;
  }
  return { version: MARKDOWN_FOLD_STORE_VERSION, documents };
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== "object" || value.version !== 1 || typeof value.documentFingerprint !== "string" || !Array.isArray(value.folds)) return null;
  if (value.folds.length > MAX_MARKDOWN_FOLDS_PER_DOCUMENT) return null;
  return JSON.parse(JSON.stringify({
    version: 1,
    documentFingerprint: value.documentFingerprint.slice(0, 128),
    folds: value.folds
  }));
}

function emptyStore() {
  return { version: MARKDOWN_FOLD_STORE_VERSION, documents: {} };
}

function withProjectQueue(root, task) {
  const previous = projectQueues.get(root) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  projectQueues.set(root, current);
  return current.finally(() => {
    if (projectQueues.get(root) === current) projectQueues.delete(root);
  });
}

function foldStoreError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  if (filePath) error.path = filePath;
  return error;
}

function readableError(error) {
  return error instanceof Error ? error.message : String(error || "Unknown Markdown fold metadata error.");
}

module.exports = {
  MARKDOWN_FOLD_DIRECTORY,
  MARKDOWN_FOLD_FILE,
  moveProjectMarkdownFoldState,
  readProjectMarkdownFoldState,
  writeProjectMarkdownFoldState
};
