const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const documentFileLocks = new Map();

async function readDocumentFile(filePath) {
  const bytes = await fsp.readFile(filePath);
  const stats = await fsp.stat(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    text: bytes.toString("utf8"),
    revision: revisionForBytes(bytes),
    modifiedAt: stats.mtimeMs
  };
}

async function writeDocumentFile(filePath, text, options = {}) {
  return withDocumentFileLock(filePath, async () => {
    const expectedRevision = typeof options.expectedRevision === "string" ? options.expectedRevision : undefined;
    const overwrite = options.overwrite === true;
    const current = await readDocumentFile(filePath).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });

    if (!overwrite && expectedRevision && current?.revision !== expectedRevision) {
      return {
        status: "conflict",
        file: current ? { name: current.name, path: current.path } : { name: path.basename(filePath), path: filePath },
        revision: current?.revision || "missing",
        modifiedAt: current?.modifiedAt || 0
      };
    }

    const bytes = Buffer.from(typeof text === "string" ? text : "", "utf8");
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const originalMode = current ? (await fsp.stat(filePath)).mode & 0o777 : 0o644;
    const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
    let handle;
    try {
      handle = await fsp.open(temporaryPath, "wx", originalMode);
      await handle.chmod(originalMode);
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;

      if (!overwrite && expectedRevision) {
        const beforeReplace = await readDocumentFile(filePath).catch((error) => {
          if (error?.code === "ENOENT") return null;
          throw error;
        });
        if (beforeReplace?.revision !== expectedRevision) {
          await fsp.unlink(temporaryPath);
          return {
            status: "conflict",
            file: beforeReplace
              ? { name: beforeReplace.name, path: beforeReplace.path }
              : { name: path.basename(filePath), path: filePath },
            revision: beforeReplace?.revision || "missing",
            modifiedAt: beforeReplace?.modifiedAt || 0
          };
        }
      }

      await fsp.rename(temporaryPath, filePath);
      await syncDirectory(path.dirname(filePath));
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await fsp.unlink(temporaryPath).catch(() => undefined);
      throw error;
    }

    const saved = await readDocumentFile(filePath);
    return {
      status: "saved",
      file: { name: saved.name, path: saved.path },
      revision: saved.revision,
      modifiedAt: saved.modifiedAt
    };
  });
}

function revisionForBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function withDocumentFileLock(filePath, task) {
  const previous = documentFileLocks.get(filePath) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  documentFileLocks.set(filePath, current);
  return current.finally(() => {
    if (documentFileLocks.get(filePath) === current) documentFileLocks.delete(filePath);
  });
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await fsp.open(directory, "r");
    await handle.sync();
  } catch {
    // Atomic rename is still useful on platforms that do not allow syncing directories.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

module.exports = {
  readDocumentFile,
  revisionForBytes,
  writeDocumentFile
};
