const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const MAX_CSV_FILE_BYTES = 1_048_576;
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

    const text = typeof request?.text === "string" ? request.text : "";
    const bytes = Buffer.from(text, "utf8");
    if (bytes.byteLength > MAX_CSV_FILE_BYTES) throw csvError("write_failed", `CSV file exceeds ${MAX_CSV_FILE_BYTES} bytes.`, target.path);
    const originalMode = (await fsp.stat(target.path)).mode & 0o777;
    const temporaryPath = path.join(path.dirname(target.path), `.${path.basename(target.path)}.${crypto.randomUUID()}.tmp`);
    let handle;
    try {
      handle = await fsp.open(temporaryPath, "wx", originalMode);
      await handle.chmod(originalMode);
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      const beforeReplace = await csvSnapshot(target);
      if (beforeReplace.revision !== current.revision) {
        await fsp.unlink(temporaryPath);
        return { status: "conflict", revision: beforeReplace.revision, modifiedAt: beforeReplace.modifiedAt };
      }
      await fsp.rename(temporaryPath, target.path);
      await syncDirectory(path.dirname(target.path));
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await fsp.unlink(temporaryPath).catch(() => undefined);
      throw csvError("write_failed", error instanceof Error ? error.message : "CSV write failed.", target.path);
    }
    const saved = await csvSnapshot(target);
    return { status: "saved", file: saved.file, revision: saved.revision, modifiedAt: saved.modifiedAt };
  });
}

async function csvSnapshot(target) {
  const bytes = await fsp.readFile(target.path);
  if (bytes.byteLength > MAX_CSV_FILE_BYTES) throw csvError("read_failed", `CSV file exceeds ${MAX_CSV_FILE_BYTES} bytes.`, target.path);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw csvError("read_failed", "CSV file must be valid UTF-8.", target.path);
  }
  const stats = await fsp.stat(target.path);
  return {
    file: { name: path.basename(target.path), path: target.path },
    text,
    revision: crypto.createHash("sha256").update(bytes).digest("hex"),
    modifiedAt: stats.mtimeMs
  };
}

async function resolveCsvTarget(request, mustExist) {
  const rootInput = String(request?.rootPath || "");
  const fileInput = String(request?.path || "");
  if (!rootInput || !fileInput) throw csvError("unsupported_type", "CSV root and file paths are required.", fileInput || undefined);
  const root = await fsp.realpath(rootInput);
  const candidate = path.resolve(path.isAbsolute(fileInput) ? fileInput : path.join(root, fileInput));
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
  if (stats.size > MAX_CSV_FILE_BYTES) throw csvError("read_failed", `CSV file exceeds ${MAX_CSV_FILE_BYTES} bytes.`, realPath);
  return { root, path: realPath };
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

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await fsp.open(directory, "r");
    await handle.sync();
  } catch {
    // Some platforms do not permit opening directories; the file rename is still atomic.
  } finally {
    await handle?.close().catch(() => undefined);
  }
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
