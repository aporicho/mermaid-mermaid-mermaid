const fsp = require("node:fs/promises");
const path = require("node:path");

const MAX_CSV_FILE_BYTES = 1_048_576;
const MAX_PROJECT_FILE_BYTES = 16 * 1_048_576;
const PROJECT_FILE_EXTENSIONS = {
  mermaid: [".mmd", ".mermaid"],
  markdown: [".md", ".markdown"],
  canvas: [".canvas.json"],
  csv: [".csv"]
};

async function createProjectFile(request) {
  const root = await resolveProjectRoot(request?.rootPath);
  const directory = await resolveProjectDirectory(root, request?.directoryPath);
  const kind = normalizeProjectFileKind(request?.kind);
  const fileName = normalizeProjectFileName(request?.fileName, kind);
  const filePath = path.join(directory, fileName);
  if (!isPathInside(root, filePath)) {
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
  const root = await resolveProjectRoot(request?.rootPath);
  const sourcePath = await resolveProjectRegularFile(root, request?.sourcePath);
  const targetDirectory = await resolveProjectDirectory(root, request?.targetDirectoryPath);
  const targetPath = path.join(targetDirectory, path.basename(sourcePath));
  const targetFile = { name: path.basename(targetPath), path: targetPath };

  if (!isPathInside(root, targetPath)) {
    throw projectFileError("permission_denied", "Project file path must stay inside the project root.", targetPath);
  }
  if (samePath(sourcePath, targetPath)) return { status: "noop", file: targetFile };

  const sourceIdentity = await fsp.stat(sourcePath);
  try {
    await fsp.link(sourcePath, targetPath);
  } catch (error) {
    if (error?.code === "EEXIST") return { status: "exists", file: targetFile };
    if (error?.code === "EXDEV") {
      throw projectFileError("write_failed", "Project files cannot be moved across filesystem boundaries.", sourcePath);
    }
    throw error;
  }

  const currentSourceIdentity = await fsp.lstat(sourcePath).catch(async (error) => {
    await removeFailedMutationTarget(targetPath, error);
    throw error;
  });
  if (!sameFileIdentity(sourceIdentity, currentSourceIdentity)) {
    const error = projectFileError("write_failed", "Project source file changed while it was being moved. Try again.", sourcePath);
    await removeFailedMutationTarget(targetPath, error);
    throw error;
  }

  try {
    await fsp.unlink(sourcePath);
  } catch (error) {
    await removeFailedMutationTarget(targetPath, error);
    throw error;
  }
  return { status: "moved", file: targetFile, sourcePath };
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
  const root = await fsp.realpath(value);
  const stats = await fsp.stat(root);
  if (!stats.isDirectory()) throw projectFileError("unsupported_type", "Project root must be a directory.", root);
  return root;
}

async function resolveProjectDirectory(root, directoryPath) {
  const input = typeof directoryPath === "string" ? directoryPath : "";
  if (input.includes("\0")) throw projectFileError("permission_denied", "Project directory path is invalid.", input);
  const candidate = input ? resolveProjectCandidate(root, input) : root;
  if (!isPathInside(root, candidate)) {
    throw projectFileError("permission_denied", "Project directory must stay inside the project root.", candidate);
  }
  await assertNoSymbolicLinkComponents(root, candidate);
  const realPath = await fsp.realpath(candidate).catch((error) => {
    throw projectFileError("file_not_found", error instanceof Error ? error.message : "Project directory was not found.", candidate);
  });
  if (!isPathInside(root, realPath)) {
    throw projectFileError("permission_denied", "Project directory must stay inside the project root.", candidate);
  }
  const stats = await fsp.stat(realPath);
  if (!stats.isDirectory()) throw projectFileError("unsupported_type", "Project target must be a directory.", realPath);
  return realPath;
}

async function resolveProjectRegularFile(root, sourcePath) {
  const input = String(sourcePath || "");
  if (!input || input.includes("\0")) throw projectFileError("file_not_found", "Project source file path is required.");
  const candidate = resolveProjectCandidate(root, input);
  if (!isPathInside(root, candidate)) {
    throw projectFileError("permission_denied", "Project source file must stay inside the project root.", candidate);
  }
  await assertNoSymbolicLinkComponents(root, candidate);
  const realPath = await fsp.realpath(candidate).catch((error) => {
    throw projectFileError("file_not_found", error instanceof Error ? error.message : "Project source file was not found.", candidate);
  });
  if (!isPathInside(root, realPath)) {
    throw projectFileError("permission_denied", "Project source file must stay inside the project root.", candidate);
  }
  const stats = await fsp.stat(realPath);
  if (!stats.isFile()) throw projectFileError("unsupported_type", "Only regular project files can be moved.", realPath);
  return realPath;
}

function resolveProjectCandidate(root, input) {
  return path.resolve(path.isAbsolute(input) ? input : path.join(root, input));
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
    throw projectFileError("unsupported_type", "Project file kind must be mermaid, markdown, canvas, or csv.");
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

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function samePath(left, right) {
  return path.relative(left, right) === "";
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
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

function projectFileError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  if (filePath) error.path = filePath;
  return error;
}

module.exports = {
  MAX_CSV_FILE_BYTES,
  MAX_PROJECT_FILE_BYTES,
  createProjectDocument,
  createProjectFile,
  createProjectTextFile,
  moveProjectFile
};
