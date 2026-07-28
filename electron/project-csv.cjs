const fsp = require("node:fs/promises");
const path = require("node:path");
const { readDocumentFile, writeDocumentFile } = require("./document-files.cjs");

const MAX_CSV_FILE_BYTES = Number.POSITIVE_INFINITY;
const fileLocks = new Map();

async function readProjectCsvFile(request) {
  const target = await resolveCsvTarget(request, true);
  return csvSnapshot(target);
}

async function writeProjectCsvFile(request) {
  const target = await resolveCsvTarget(request, true);
  return withFileLock(target.path, async () => {
    const current = await csvSnapshot(target);
    if (typeof request?.expectedRevision !== "string" || request.expectedRevision !== current.revision) {
      return { status: "conflict", revision: current.revision, modifiedAt: current.modifiedAt };
    }

    const saved = await writeDocumentFile(target.path, typeof request?.text === "string" ? request.text : "", {
      expectedRevision: current.revision,
      format: request?.format
    });
    return saved.status === "conflict"
      ? { status: "conflict", revision: saved.revision, modifiedAt: saved.modifiedAt }
      : { status: "saved", file: saved.file, revision: saved.revision, modifiedAt: saved.modifiedAt, format: saved.format };
  });
}

async function csvSnapshot(target) {
  const document = await readDocumentFile(target.path);
  return {
    file: { name: path.basename(target.path), path: target.path },
    text: document.text,
    revision: document.revision,
    modifiedAt: document.modifiedAt,
    format: document.format
  };
}

async function resolveCsvTarget(request, mustExist) {
  const rootInput = String(request?.rootPath || "");
  const fileInput = String(request?.path || "");
  if (!rootInput || !fileInput) throw csvError("unsupported_type", "CSV root and file paths are required.", fileInput || undefined);
  const requestedRoot = path.resolve(rootInput);
  const root = await fsp.realpath(requestedRoot);
  const candidate = resolveProjectCandidate({ root, requestedRoot }, fileInput);
  if (!/\.csv$/i.test(path.basename(candidate))) throw csvError("unsupported_type", "Only .csv files are supported.", candidate);
  if (!isPathInside(root, candidate)) throw csvError("permission_denied", "CSV path must stay inside the project root.", candidate);
  if (!mustExist) return { root, path: candidate };

  const linkStats = await fsp.lstat(candidate).catch((error) => {
    throw csvError("file_not_found", error instanceof Error ? error.message : "CSV file not found.", candidate);
  });
  if (linkStats.isSymbolicLink()) throw csvError("permission_denied", "CSV symbolic links are not supported.", candidate);
  const realPath = await fsp.realpath(candidate);
  if (!isPathInside(root, realPath)) throw csvError("permission_denied", "CSV path must stay inside the project root.", candidate);
  const stats = await fsp.stat(realPath);
  if (!stats.isFile()) throw csvError("unsupported_type", "CSV target must be a regular file.", realPath);
  return { root, path: realPath };
}

function resolveProjectCandidate(rootContext, input) {
  if (!path.isAbsolute(input)) return path.resolve(path.join(rootContext.root, input));
  const resolvedInput = path.resolve(input);
  if (isPathInside(rootContext.requestedRoot, resolvedInput)) {
    return path.join(rootContext.root, path.relative(rootContext.requestedRoot, resolvedInput));
  }
  return resolvedInput;
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function withFileLock(filePath, task) {
  const previous = fileLocks.get(filePath) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  fileLocks.set(filePath, current);
  return current.finally(() => {
    if (fileLocks.get(filePath) === current) fileLocks.delete(filePath);
  });
}

function csvError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  if (filePath) error.path = filePath;
  return error;
}

module.exports = {
  MAX_CSV_FILE_BYTES,
  readProjectCsvFile,
  writeProjectCsvFile
};
