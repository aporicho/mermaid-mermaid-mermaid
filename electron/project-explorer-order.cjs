const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const PROJECT_EXPLORER_ORDER_DIRECTORY = ".mermaid-canvas-editor";
const PROJECT_EXPLORER_ORDER_FILE = "explorer-order.json";
const PROJECT_EXPLORER_ORDER_VERSION = 1;
const MAX_PROJECT_EXPLORER_ORDER_BYTES = 2 * 1024 * 1024;
const projectQueues = new Map();

async function readProjectExplorerOrderState(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  return withProjectQueue(rootContext.root, async () => readStore(storePathForRoot(rootContext.root)));
}

async function readProjectExplorerOrderForRoot(root) {
  return readStore(storePathForRoot(root));
}

async function reorderProjectResources(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const parentDirectoryPath = normalizeRelativePath(request?.parentDirectoryPath);
  const kind = normalizeResourceKind(request?.kind);
  await resolveProjectDirectory(rootContext, parentDirectoryPath);
  const orderedRelativePaths = await normalizeExistingImmediateChildren(rootContext, request?.orderedRelativePaths, parentDirectoryPath, kind);

  return withProjectQueue(rootContext.root, async () => {
    const storePath = storePathForRoot(rootContext.root);
    const store = await readStore(storePath);
    writeGroupOrder(store, parentDirectoryPath, kind, orderedRelativePaths);
    pruneEmptyGroups(store);
    await writeStore({ root: rootContext.root, storePath }, store);
    return { status: "saved" };
  });
}

async function appendProjectExplorerOrderResources(root, resources) {
  if (!resources.length) return;
  await updateProjectExplorerOrderStore(root, (store) => {
    for (const resource of resources) appendResource(store, resource);
  });
}

async function renameProjectExplorerOrderResource(root, sourceResource, targetResource) {
  await updateProjectExplorerOrderStore(root, (store) => {
    replacePathEverywhere(store, sourceResource.relativePath, targetResource.relativePath);
    pruneEmptyGroups(store);
  });
}

async function moveProjectExplorerOrderResources(root, moves, placement) {
  if (!moves.length) return;
  await updateProjectExplorerOrderStore(root, (store) => {
    for (const move of moves) {
      replacePathEverywhere(store, move.source.relativePath, move.target.relativePath);
      removeResourceFromGroups(store, move.target);
    }
    for (const move of moves) insertResource(store, move.target, placement);
    pruneEmptyGroups(store);
  });
}

async function deleteProjectExplorerOrderResources(root, resources) {
  if (!resources.length) return;
  await updateProjectExplorerOrderStore(root, (store) => {
    for (const resource of resources) removeResourceAndDescendants(store, resource.relativePath);
    pruneEmptyGroups(store);
  });
}

async function updateProjectExplorerOrderStore(root, mutate) {
  return withProjectQueue(root, async () => {
    const storePath = storePathForRoot(root);
    const store = await readStore(storePath);
    mutate(store);
    await writeStore({ root, storePath }, store);
  });
}

function sortProjectResourcesWithExplorerOrder(resources, order) {
  const normalizedOrder = normalizeStore(order, { allowEmpty: true });
  return [...resources].sort((left, right) => compareProjectResources(left, right, normalizedOrder));
}

function compareProjectResources(left, right, order) {
  const leftDepth = pathSegments(left.relativePath).length;
  const rightDepth = pathSegments(right.relativePath).length;
  if (leftDepth !== rightDepth) return leftDepth - rightDepth;
  const leftParent = parentRelativePath(left.relativePath);
  const rightParent = parentRelativePath(right.relativePath);
  if (leftParent === rightParent) {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    const group = order.directories[leftParent];
    const orderedPaths = left.kind === "directory" ? group?.directories : group?.files;
    const orderComparison = compareOrderedPaths(left.relativePath, right.relativePath, orderedPaths || []);
    if (orderComparison !== 0) return orderComparison;
  }
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
  return left.relativePath.toLowerCase().localeCompare(right.relativePath.toLowerCase());
}

async function resolveProjectRoot(rootPath) {
  const value = String(rootPath || "");
  if (!value || value.includes("\0")) throw orderStoreError("permission_denied", "Project root path is required.");
  const requestedRoot = path.resolve(value);
  const root = await fsp.realpath(requestedRoot);
  const stats = await fsp.stat(root);
  if (!stats.isDirectory()) throw orderStoreError("unsupported_type", "Project root must be a directory.", root);
  return { root, requestedRoot };
}

async function resolveProjectDirectory(rootContext, directoryPath) {
  const candidate = directoryPath ? resolveProjectCandidate(rootContext, directoryPath) : rootContext.root;
  if (!isPathInside(rootContext.root, candidate)) {
    throw orderStoreError("permission_denied", "Project directory must stay inside the project root.", candidate);
  }
  const realPath = await fsp.realpath(candidate).catch((error) => {
    throw orderStoreError("file_not_found", readableError(error), candidate);
  });
  if (!isPathInside(rootContext.root, realPath)) {
    throw orderStoreError("permission_denied", "Project directory must stay inside the project root.", candidate);
  }
  const stats = await fsp.stat(realPath);
  if (!stats.isDirectory()) throw orderStoreError("unsupported_type", "Project target must be a directory.", realPath);
  return realPath;
}

async function normalizeExistingImmediateChildren(rootContext, value, parentPath, kind) {
  if (!Array.isArray(value)) throw orderStoreError("unsupported_type", "Project resource order must be an array.");
  const normalized = [];
  const seen = new Set();
  for (const item of value) {
    const relativePath = normalizeRelativePath(item);
    if (!relativePath || seen.has(relativePath) || parentRelativePath(relativePath) !== parentPath) continue;
    const candidate = resolveProjectCandidate(rootContext, relativePath);
    if (!isPathInside(rootContext.root, candidate)) {
      throw orderStoreError("permission_denied", "Project resource order path must stay inside the project root.", candidate);
    }
    const stats = await fsp.lstat(candidate).catch((error) => {
      throw orderStoreError("file_not_found", readableError(error), candidate);
    });
    if (stats.isSymbolicLink()) throw orderStoreError("permission_denied", "Project symbolic links are not supported.", candidate);
    if (kind === "directory" && !stats.isDirectory()) continue;
    if (kind === "file" && !stats.isFile()) continue;
    seen.add(relativePath);
    normalized.push(relativePath);
  }
  return normalized;
}

function resolveProjectCandidate(rootContext, input) {
  const value = String(input || "");
  if (value.includes("\0")) throw orderStoreError("permission_denied", "Project resource path is invalid.", value);
  if (!path.isAbsolute(value)) return path.resolve(path.join(rootContext.root, value));
  const resolvedInput = path.resolve(value);
  if (isPathInside(rootContext.requestedRoot, resolvedInput)) {
    return path.join(rootContext.root, path.relative(rootContext.requestedRoot, resolvedInput));
  }
  return resolvedInput;
}

async function readStore(storePath) {
  let text;
  try {
    const stats = await fsp.lstat(storePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw orderStoreError("permission_denied", "Project Explorer order metadata must be a regular file.", storePath);
    }
    if (stats.size > MAX_PROJECT_EXPLORER_ORDER_BYTES) {
      throw orderStoreError("read_failed", "Project Explorer order metadata is too large.", storePath);
    }
    text = await fsp.readFile(storePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return emptyStore();
    if (error?.code) throw error;
    throw orderStoreError("read_failed", readableError(error), storePath);
  }

  try {
    return normalizeStore(JSON.parse(text));
  } catch (error) {
    throw orderStoreError("read_failed", `Project Explorer order metadata is invalid: ${readableError(error)}`, storePath);
  }
}

async function writeStore(context, store) {
  const directory = path.dirname(context.storePath);
  const existing = await fsp.lstat(directory).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) {
    throw orderStoreError("permission_denied", "Project Explorer metadata directory must be a regular directory.", directory);
  }
  await fsp.mkdir(directory, { recursive: true });

  const temporaryPath = path.join(directory, `.${PROJECT_EXPLORER_ORDER_FILE}.${crypto.randomUUID()}.tmp`);
  try {
    await fsp.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fsp.rename(temporaryPath, context.storePath);
  } catch (error) {
    await fsp.unlink(temporaryPath).catch(() => undefined);
    throw orderStoreError("write_failed", readableError(error), context.storePath);
  }
}

function normalizeStore(value, options = {}) {
  if (!value || typeof value !== "object" || value.version !== PROJECT_EXPLORER_ORDER_VERSION || !value.directories || typeof value.directories !== "object" || Array.isArray(value.directories)) {
    if (options.allowEmpty) return emptyStore();
    throw new Error("Expected a version 1 Project Explorer order store.");
  }
  const directories = {};
  for (const [rawParentPath, rawGroup] of Object.entries(value.directories)) {
    const parentPath = normalizeRelativePath(rawParentPath);
    if (!rawGroup || typeof rawGroup !== "object") continue;
    const group = {
      directories: normalizeOrderedPaths(rawGroup.directories, parentPath),
      files: normalizeOrderedPaths(rawGroup.files, parentPath)
    };
    if (group.directories.length || group.files.length) directories[parentPath] = group;
  }
  return { version: PROJECT_EXPLORER_ORDER_VERSION, directories };
}

function normalizeOrderedPaths(value, parentPath) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const seen = new Set();
  for (const item of value) {
    const relativePath = normalizeRelativePath(item);
    if (!relativePath || seen.has(relativePath) || parentRelativePath(relativePath) !== parentPath) continue;
    seen.add(relativePath);
    normalized.push(relativePath);
  }
  return normalized;
}

function emptyStore() {
  return { version: PROJECT_EXPLORER_ORDER_VERSION, directories: {} };
}

function writeGroupOrder(store, parentPath, kind, orderedRelativePaths) {
  const group = ensureGroup(store, parentPath);
  group[kind === "directory" ? "directories" : "files"] = [...orderedRelativePaths];
}

function appendResource(store, resource) {
  insertResource(store, resource, undefined);
}

function insertResource(store, resource, placement) {
  const parentPath = parentRelativePath(resource.relativePath);
  const group = ensureGroup(store, parentPath);
  const key = resource.kind === "directory" ? "directories" : "files";
  const paths = group[key].filter((path) => path !== resource.relativePath);
  const beforePath = placement?.kind === resource.kind && parentPath === normalizeRelativePath(placement.parentDirectoryPath)
    ? normalizeRelativePath(placement.beforeRelativePath)
    : "";
  const insertIndex = beforePath ? paths.indexOf(beforePath) : -1;
  if (insertIndex >= 0) paths.splice(insertIndex, 0, resource.relativePath);
  else paths.push(resource.relativePath);
  group[key] = paths;
}

function removeResourceFromGroups(store, resource) {
  for (const group of Object.values(store.directories)) {
    group.directories = group.directories.filter((relativePath) => relativePath !== resource.relativePath);
    group.files = group.files.filter((relativePath) => relativePath !== resource.relativePath);
  }
}

function removeResourceAndDescendants(store, relativePath) {
  const source = normalizeRelativePath(relativePath);
  for (const [parentPath, group] of Object.entries(store.directories)) {
    if (parentPath === source || parentPath.startsWith(`${source}/`)) delete store.directories[parentPath];
    else {
      group.directories = group.directories.filter((item) => !pathInsideOrSame(item, source));
      group.files = group.files.filter((item) => !pathInsideOrSame(item, source));
    }
  }
}

function replacePathEverywhere(store, sourcePath, targetPath) {
  const source = normalizeRelativePath(sourcePath);
  const target = normalizeRelativePath(targetPath);
  const nextDirectories = {};
  for (const [parentPath, group] of Object.entries(store.directories)) {
    nextDirectories[replaceRelativePath(parentPath, source, target)] = {
      directories: group.directories.map((item) => replaceRelativePath(item, source, target)),
      files: group.files.map((item) => replaceRelativePath(item, source, target))
    };
  }
  store.directories = nextDirectories;
}

function ensureGroup(store, parentPath) {
  const normalizedParent = normalizeRelativePath(parentPath);
  const group = store.directories[normalizedParent] || { directories: [], files: [] };
  store.directories[normalizedParent] = group;
  return group;
}

function pruneEmptyGroups(store) {
  for (const [parentPath, group] of Object.entries(store.directories)) {
    group.directories = uniqueImmediateChildPaths(group.directories, parentPath);
    group.files = uniqueImmediateChildPaths(group.files, parentPath);
    if (!group.directories.length && !group.files.length) delete store.directories[parentPath];
  }
}

function uniqueImmediateChildPaths(paths, parentPath) {
  const seen = new Set();
  const next = [];
  for (const item of paths) {
    const relativePath = normalizeRelativePath(item);
    if (!relativePath || seen.has(relativePath) || parentRelativePath(relativePath) !== parentPath) continue;
    seen.add(relativePath);
    next.push(relativePath);
  }
  return next;
}

function compareOrderedPaths(leftPath, rightPath, orderedPaths) {
  const leftIndex = orderedPaths.indexOf(normalizeRelativePath(leftPath));
  const rightIndex = orderedPaths.indexOf(normalizeRelativePath(rightPath));
  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;
  return 0;
}

function replaceRelativePath(relativePath, source, target) {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized === source) return target;
  if (normalized.startsWith(`${source}/`)) return `${target}${normalized.slice(source.length)}`;
  return normalized;
}

function pathInsideOrSame(relativePath, rootPath) {
  const relative = normalizeRelativePath(relativePath);
  const root = normalizeRelativePath(rootPath);
  return relative === root || relative.startsWith(`${root}/`);
}

function pathSegments(value) {
  return normalizeRelativePath(value).split("/").filter(Boolean);
}

function parentRelativePath(relativePath) {
  const segments = pathSegments(relativePath);
  segments.pop();
  return segments.join("/");
}

function normalizeRelativePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}

function normalizeResourceKind(value) {
  if (value !== "file" && value !== "directory") throw orderStoreError("unsupported_type", "Project resource kind must be file or directory.");
  return value;
}

function storePathForRoot(root) {
  return path.join(root, PROJECT_EXPLORER_ORDER_DIRECTORY, PROJECT_EXPLORER_ORDER_FILE);
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function withProjectQueue(root, task) {
  const previous = projectQueues.get(root) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  projectQueues.set(root, current);
  return current.finally(() => {
    if (projectQueues.get(root) === current) projectQueues.delete(root);
  });
}

function orderStoreError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  if (filePath) error.path = filePath;
  return error;
}

function readableError(error) {
  return error instanceof Error ? error.message : String(error || "Unknown Project Explorer order metadata error.");
}

module.exports = {
  PROJECT_EXPLORER_ORDER_DIRECTORY,
  PROJECT_EXPLORER_ORDER_FILE,
  PROJECT_EXPLORER_ORDER_VERSION,
  appendProjectExplorerOrderResources,
  deleteProjectExplorerOrderResources,
  moveProjectExplorerOrderResources,
  readProjectExplorerOrderForRoot,
  readProjectExplorerOrderState,
  renameProjectExplorerOrderResource,
  reorderProjectResources,
  sortProjectResourcesWithExplorerOrder
};
