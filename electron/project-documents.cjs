const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const MAX_CSV_FILE_BYTES = 1_048_576;
const MAX_PROJECT_FILE_BYTES = 16 * 1_048_576;
const SKIPPED_PROJECT_DIRECTORIES = new Set([".git", ".hg", ".svn", ".mermaid-canvas-editor", "node_modules", "dist", "build", ".vite", ".next", "target", "dist-electron"]);
const PROJECT_FILE_EXTENSIONS = {
  mermaid: [".mmd", ".mermaid"],
  markdown: [".md", ".markdown"],
  csv: [".csv"],
  html: [".html", ".htm"]
};

async function createProjectFile(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const directory = await resolveProjectDirectory(rootContext, request?.directoryPath);
  const kind = normalizeProjectFileKind(request?.kind);
  const fileName = normalizeProjectFileName(request?.fileName, kind);
  const filePath = path.join(directory, fileName);
  if (!isPathInside(rootContext.root, filePath)) {
    throw projectFileError("permission_denied", "Project file path must stay inside the project root.", filePath);
  }

  const text = typeof request?.text === "string" ? request.text : "";
  const textBytes = Buffer.byteLength(text, "utf8");
  const maximumBytes = kind === "csv" ? MAX_CSV_FILE_BYTES : MAX_PROJECT_FILE_BYTES;
  if (textBytes > maximumBytes) {
    throw projectFileError("write_failed", `Project ${kind} file cannot exceed ${maximumBytes} bytes.`, filePath);
  }

  const file = { name: fileName, path: filePath };
  let handle;
  let created = false;
  try {
    handle = await fsp.open(filePath, "wx");
    created = true;
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    return { status: "created", file, text };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (!created && error?.code === "EEXIST") return { status: "exists", file };
    if (created) await removeFailedMutationTarget(filePath, error);
    throw error;
  }
}

async function moveProjectFile(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  await resolveProjectRegularFile(rootContext, request?.sourcePath);
  const result = await moveProjectResources({
    rootPath: request?.rootPath,
    sourcePaths: [request?.sourcePath],
    targetDirectoryPath: request?.targetDirectoryPath
  });
  const first = result.results[0];
  if (!first) throw projectFileError("file_not_found", "Project source file path is required.");
  if (first.resource.kind !== "file") throw projectFileError("unsupported_type", "Only regular project files can be moved.", first.resource.path);
  return {
    status: first.status,
    file: resourceFileRef(first.resource),
    ...(first.sourcePath ? { sourcePath: first.sourcePath } : {})
  };
}

async function createProjectDirectory(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const directory = await resolveProjectDirectory(rootContext, request?.directoryPath);
  const directoryName = normalizeProjectResourceName(request?.directoryName ?? request?.name);
  const directoryPath = path.join(directory, directoryName);
  if (!isPathInside(rootContext.root, directoryPath)) {
    throw projectFileError("permission_denied", "Project directory path must stay inside the project root.", directoryPath);
  }
  const resource = projectResourceFromPath(rootContext.root, directoryPath, "directory");
  try {
    await fsp.mkdir(directoryPath);
    return { status: "created", resource };
  } catch (error) {
    if (error?.code === "EEXIST") return { status: "exists", resource };
    throw error;
  }
}

async function renameProjectResource(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const source = await resolveProjectResource(rootContext, request?.sourcePath);
  assertMutableProjectResource(rootContext, source);
  const name = normalizeProjectResourceName(request?.name);
  const targetPath = path.join(path.dirname(source.path), name);
  if (!isPathInside(rootContext.root, targetPath)) {
    throw projectFileError("permission_denied", "Project resource path must stay inside the project root.", targetPath);
  }
  const targetResource = projectResourceFromPath(rootContext.root, targetPath, source.kind);
  if (samePath(source.path, targetPath)) return { status: "noop", resource: targetResource, sourcePath: source.path };
  if (await pathExists(targetPath)) return { status: "exists", resource: targetResource, sourcePath: source.path };
  try {
    await fsp.rename(source.path, targetPath);
    return { status: "renamed", resource: targetResource, sourcePath: source.path };
  } catch (error) {
    if (error?.code === "EEXIST" || error?.code === "ENOTEMPTY") {
      return { status: "exists", resource: targetResource, sourcePath: source.path };
    }
    if (error?.code === "EXDEV") {
      throw projectFileError("write_failed", "Project resources cannot be renamed across filesystem boundaries.", source.path);
    }
    throw error;
  }
}

async function moveProjectResources(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const targetDirectory = await resolveProjectDirectory(rootContext, request?.targetDirectoryPath);
  const sources = await resolveProjectResourceSelection(rootContext, request?.sourcePaths ?? request?.sourcePath);
  const results = [];
  for (const source of dedupeNestedResources(sources)) {
    assertMutableProjectResource(rootContext, source);
    if (source.kind === "directory" && isPathInside(source.path, targetDirectory)) {
      throw projectFileError("unsupported_type", "Project directories cannot be moved into themselves.", source.path);
    }
    const targetPath = path.join(targetDirectory, source.name);
    if (!isPathInside(rootContext.root, targetPath)) {
      throw projectFileError("permission_denied", "Project target path must stay inside the project root.", targetPath);
    }
    const targetResource = projectResourceFromPath(rootContext.root, targetPath, source.kind);
    if (samePath(source.path, targetPath)) {
      results.push({ status: "noop", resource: targetResource, sourcePath: source.path });
      continue;
    }
    if (await pathExists(targetPath)) {
      results.push({ status: "exists", resource: targetResource, sourcePath: source.path });
      continue;
    }
    try {
      await fsp.rename(source.path, targetPath);
      results.push({ status: "moved", resource: targetResource, sourcePath: source.path });
    } catch (error) {
      if (error?.code === "EEXIST" || error?.code === "ENOTEMPTY") {
        results.push({ status: "exists", resource: targetResource, sourcePath: source.path });
        continue;
      }
      if (error?.code === "EXDEV") {
        throw projectFileError("write_failed", "Project resources cannot be moved across filesystem boundaries.", source.path);
      }
      throw error;
    }
  }
  return { status: "completed", results };
}

async function copyProjectResources(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const targetDirectory = await resolveProjectDirectory(rootContext, request?.targetDirectoryPath);
  const sources = await resolveProjectResourceSelection(rootContext, request?.sourcePaths ?? request?.sourcePath);
  const results = [];
  for (const source of dedupeNestedResources(sources)) {
    assertMutableProjectResource(rootContext, source);
    if (source.kind === "directory" && isPathInside(source.path, targetDirectory)) {
      throw projectFileError("unsupported_type", "Project directories cannot be copied into themselves.", source.path);
    }
    const targetPath = path.join(targetDirectory, source.name);
    const targetResource = projectResourceFromPath(rootContext.root, targetPath, source.kind);
    if (samePath(source.path, targetPath) || await pathExists(targetPath)) {
      results.push({ status: "exists", resource: targetResource, sourcePath: source.path });
      continue;
    }
    await copyResourcePath(source.path, targetPath, { skipProjectDirectories: true });
    results.push({ status: "copied", resource: targetResource, sourcePath: source.path });
  }
  return { status: "completed", results };
}

async function importProjectResources(request) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const targetDirectory = await resolveProjectDirectory(rootContext, request?.targetDirectoryPath);
  const sources = await resolveExternalResourceSelection(request?.externalPaths ?? request?.sourcePaths ?? request?.sourcePath);
  const results = [];
  for (const source of dedupeExternalResources(sources)) {
    const targetPath = path.join(targetDirectory, source.name);
    const targetResource = projectResourceFromPath(rootContext.root, targetPath, source.kind);
    if (await pathExists(targetPath)) {
      results.push({ status: "exists", resource: targetResource, sourcePath: source.path });
      continue;
    }
    await copyResourcePath(source.path, targetPath, { skipProjectDirectories: true });
    results.push({ status: "imported", resource: targetResource, sourcePath: source.path });
  }
  return { status: "completed", results };
}

async function deleteProjectResources(request, options = {}) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const sources = await resolveProjectResourceSelection(rootContext, request?.sourcePaths ?? request?.sourcePath);
  const resources = dedupeNestedResources(sources);
  for (const resource of resources) assertMutableProjectResource(rootContext, resource);
  const deleted = [];
  for (const resource of resources.sort((left, right) => right.path.length - left.path.length)) {
    if (options.trashItem) await options.trashItem(resource.path);
    else await fsp.rm(resource.path, { recursive: true, force: false });
    deleted.push(resource);
  }
  return { status: "deleted", resources: deleted };
}

async function showProjectResourceInFileManager(request, options = {}) {
  const rootContext = await resolveProjectRoot(request?.rootPath);
  const resource = await resolveProjectResource(rootContext, request?.path ?? request?.sourcePath);
  if (options.showItemInFolder) options.showItemInFolder(resource.path);
  return { status: "shown", resource };
}

async function createProjectDocument(request) {
  if (request?.documentKind !== "markdown") {
    throw projectFileError("unsupported_type", "Only Markdown project documents can be created from the canvas.");
  }
  return createProjectFile({
    rootPath: request?.rootPath,
    directoryPath: "",
    fileName: request?.fileName,
    kind: "markdown",
    text: request?.text
  });
}

async function createProjectTextFile(request) {
  if (request?.kind !== "csv") {
    throw projectFileError("unsupported_type", "Only CSV project text files are supported.");
  }
  return createProjectFile({
    rootPath: request?.rootPath,
    directoryPath: "",
    fileName: request?.fileName,
    kind: "csv",
    text: request?.text
  });
}

async function resolveProjectRoot(rootPath) {
  const value = String(rootPath || "");
  if (!value || value.includes("\0")) throw projectFileError("permission_denied", "Project root path is required.");
  const requestedRoot = path.resolve(value);
  const root = await fsp.realpath(requestedRoot);
  const stats = await fsp.stat(root);
  if (!stats.isDirectory()) throw projectFileError("unsupported_type", "Project root must be a directory.", root);
  return { root, requestedRoot };
}

async function resolveProjectDirectory(rootContext, directoryPath) {
  const input = typeof directoryPath === "string" ? directoryPath : "";
  if (input.includes("\0")) throw projectFileError("permission_denied", "Project directory path is invalid.", input);
  const candidate = input ? resolveProjectCandidate(rootContext, input) : rootContext.root;
  if (!isPathInside(rootContext.root, candidate)) {
    throw projectFileError("permission_denied", "Project directory must stay inside the project root.", candidate);
  }
  await assertNoSymbolicLinkComponents(rootContext.root, candidate);
  const realPath = await fsp.realpath(candidate).catch((error) => {
    throw projectFileError("file_not_found", error instanceof Error ? error.message : "Project directory was not found.", candidate);
  });
  if (!isPathInside(rootContext.root, realPath)) {
    throw projectFileError("permission_denied", "Project directory must stay inside the project root.", candidate);
  }
  const stats = await fsp.stat(realPath);
  if (!stats.isDirectory()) throw projectFileError("unsupported_type", "Project target must be a directory.", realPath);
  return realPath;
}

async function resolveProjectRegularFile(rootContext, sourcePath) {
  const resource = await resolveProjectResource(rootContext, sourcePath);
  if (resource.kind !== "file") throw projectFileError("unsupported_type", "Only regular project files can be moved.", resource.path);
  return resource.path;
}

async function resolveProjectResource(rootContext, sourcePath) {
  const input = String(sourcePath || "");
  if (!input || input.includes("\0")) throw projectFileError("file_not_found", "Project source path is required.");
  const candidate = resolveProjectCandidate(rootContext, input);
  if (!isPathInside(rootContext.root, candidate)) {
    throw projectFileError("permission_denied", "Project source must stay inside the project root.", candidate);
  }
  await assertNoSymbolicLinkComponents(rootContext.root, candidate);
  const realPath = await fsp.realpath(candidate).catch((error) => {
    throw projectFileError("file_not_found", error instanceof Error ? error.message : "Project source was not found.", candidate);
  });
  if (!isPathInside(rootContext.root, realPath)) {
    throw projectFileError("permission_denied", "Project source must stay inside the project root.", candidate);
  }
  const stats = await fsp.stat(realPath);
  if (!stats.isFile() && !stats.isDirectory()) {
    throw projectFileError("unsupported_type", "Only project files and directories can be changed.", realPath);
  }
  return projectResourceFromPath(rootContext.root, realPath, stats.isDirectory() ? "directory" : "file");
}

function resolveProjectCandidate(rootContext, input) {
  if (!path.isAbsolute(input)) return path.resolve(path.join(rootContext.root, input));
  const resolvedInput = path.resolve(input);
  if (isPathInside(rootContext.requestedRoot, resolvedInput)) {
    return path.join(rootContext.root, path.relative(rootContext.requestedRoot, resolvedInput));
  }
  return resolvedInput;
}

async function assertNoSymbolicLinkComponents(root, candidate) {
  const relative = path.relative(root, candidate);
  if (!relative) return;
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stats = await fsp.lstat(current).catch((error) => {
      throw projectFileError("file_not_found", error instanceof Error ? error.message : "Project path was not found.", current);
    });
    if (stats.isSymbolicLink()) {
      throw projectFileError("permission_denied", "Project symbolic links are not supported.", current);
    }
  }
}

function normalizeProjectFileKind(kind) {
  const value = String(kind || "");
  if (!Object.hasOwn(PROJECT_FILE_EXTENSIONS, value)) {
    throw projectFileError("unsupported_type", "Project file kind must be mermaid, markdown, csv, or html.");
  }
  return value;
}

function normalizeProjectFileName(fileName, kind) {
  const value = String(fileName || "").trim();
  if (
    !value ||
    value === "." ||
    value === ".." ||
    [...value].some((character) => character.charCodeAt(0) < 32) ||
    /[<>:"|?*\\/]/.test(value) ||
    /[.\s]$/.test(value) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value) ||
    value !== path.basename(value)
  ) {
    throw projectFileError("unsupported_type", "Project file name must be a plain file name.", value || undefined);
  }
  const lowerName = value.toLowerCase();
  if (!PROJECT_FILE_EXTENSIONS[kind].some((extension) => lowerName.endsWith(extension))) {
    throw projectFileError("unsupported_type", `Project ${kind} file name has an unsupported extension.`, value);
  }
  return value;
}

function normalizeProjectResourceName(name) {
  const value = String(name || "").trim();
  if (
    !value ||
    value === "." ||
    value === ".." ||
    [...value].some((character) => character.charCodeAt(0) < 32) ||
    /[<>:"|?*\\/]/.test(value) ||
    /[.\s]$/.test(value) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value) ||
    value !== path.basename(value)
  ) {
    throw projectFileError("unsupported_type", "Project resource name must be a plain file or directory name.", value || undefined);
  }
  return value;
}

async function resolveProjectResourceSelection(rootContext, sourcePaths) {
  const paths = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
  const resources = [];
  const seen = new Set();
  for (const sourcePath of paths) {
    const resource = await resolveProjectResource(rootContext, sourcePath);
    const key = comparablePath(resource.path);
    if (seen.has(key)) continue;
    seen.add(key);
    resources.push(resource);
  }
  if (!resources.length) throw projectFileError("file_not_found", "Project source path is required.");
  return resources;
}

async function resolveExternalResourceSelection(sourcePaths) {
  const paths = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
  const resources = [];
  const seen = new Set();
  for (const sourcePath of paths) {
    const resource = await resolveExternalResource(sourcePath);
    const key = comparablePath(resource.path);
    if (seen.has(key)) continue;
    seen.add(key);
    resources.push(resource);
  }
  if (!resources.length) throw projectFileError("file_not_found", "External source path is required.");
  return resources;
}

async function resolveExternalResource(sourcePath) {
  const input = String(sourcePath || "");
  if (!input || input.includes("\0")) throw projectFileError("file_not_found", "External source path is required.");
  const candidate = path.resolve(input);
  const linkStats = await fsp.lstat(candidate).catch((error) => {
    throw projectFileError("file_not_found", error instanceof Error ? error.message : "External source was not found.", candidate);
  });
  if (linkStats.isSymbolicLink()) {
    throw projectFileError("permission_denied", "External symbolic links are not supported.", candidate);
  }
  const realPath = await fsp.realpath(candidate);
  const stats = await fsp.stat(realPath);
  if (!stats.isFile() && !stats.isDirectory()) {
    throw projectFileError("unsupported_type", "Only external files and directories can be imported.", realPath);
  }
  return projectResourceFromPath(path.dirname(realPath), realPath, stats.isDirectory() ? "directory" : "file");
}

function assertMutableProjectResource(rootContext, resource) {
  if (samePath(rootContext.root, resource.path)) {
    throw projectFileError("unsupported_type", "The project root cannot be changed from the Explorer.", resource.path);
  }
}

function projectResourceFromPath(root, resourcePath, kind) {
  const name = path.basename(resourcePath) || path.basename(root) || resourcePath;
  return {
    kind,
    name,
    path: resourcePath,
    relativePath: path.relative(root, resourcePath).split(path.sep).join("/")
  };
}

function resourceFileRef(resource) {
  return { name: resource.name, path: resource.path };
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function samePath(left, right) {
  return path.relative(left, right) === "";
}

function comparablePath(value) {
  return path.resolve(String(value || "")).replaceAll("\\", "/").toLocaleLowerCase();
}

async function pathExists(filePath) {
  return fsp.lstat(filePath).then(() => true, (error) => {
    if (error?.code === "ENOENT") return false;
    throw error;
  });
}

function dedupeNestedResources(resources) {
  const sorted = [...resources].sort((left, right) => left.path.length - right.path.length);
  const kept = [];
  for (const resource of sorted) {
    if (kept.some((parent) => parent.kind === "directory" && isPathInside(parent.path, resource.path))) continue;
    kept.push(resource);
  }
  return kept;
}

function dedupeExternalResources(resources) {
  const sorted = [...resources].sort((left, right) => left.path.length - right.path.length);
  const kept = [];
  for (const resource of sorted) {
    if (kept.some((parent) => parent.kind === "directory" && isPathInside(parent.path, resource.path))) continue;
    kept.push(resource);
  }
  return kept;
}

async function copyResourcePath(sourcePath, targetPath, options = {}) {
  const stats = await fsp.lstat(sourcePath);
  if (stats.isSymbolicLink()) {
    throw projectFileError("permission_denied", "Project symbolic links are not supported.", sourcePath);
  }
  if (stats.isFile()) {
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
    return;
  }
  if (!stats.isDirectory()) {
    throw projectFileError("unsupported_type", "Only files and directories can be copied.", sourcePath);
  }
  await fsp.mkdir(targetPath);
  try {
    const entries = await fsp.readdir(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && options.skipProjectDirectories && SKIPPED_PROJECT_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      await copyResourcePath(path.join(sourcePath, entry.name), path.join(targetPath, entry.name), options);
    }
  } catch (error) {
    await removeFailedDirectoryTarget(targetPath, error);
  }
}

async function removeFailedMutationTarget(filePath, originalError) {
  try {
    await fsp.unlink(filePath);
  } catch (cleanupError) {
    const error = projectFileError(
      "write_failed",
      `${originalError instanceof Error ? originalError.message : "Project file operation failed."} Cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : "unknown error"}`,
      filePath
    );
    error.cause = originalError;
    error.cleanupError = cleanupError;
    throw error;
  }
}

async function removeFailedDirectoryTarget(directoryPath, originalError) {
  try {
    await fsp.rm(directoryPath, { recursive: true, force: true });
  } catch (cleanupError) {
    const error = projectFileError(
      "write_failed",
      `${originalError instanceof Error ? originalError.message : "Project directory operation failed."} Cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : "unknown error"}`,
      directoryPath
    );
    error.cause = originalError;
    error.cleanupError = cleanupError;
    throw error;
  }
  throw originalError;
}

function projectFileError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  if (filePath) error.path = filePath;
  return error;
}

module.exports = {
  MAX_CSV_FILE_BYTES,
  MAX_PROJECT_FILE_BYTES,
  copyProjectResources,
  createProjectDirectory,
  createProjectDocument,
  createProjectFile,
  createProjectTextFile,
  deleteProjectResources,
  importProjectResources,
  moveProjectFile,
  moveProjectResources,
  renameProjectResource,
  showProjectResourceInFileManager
};
