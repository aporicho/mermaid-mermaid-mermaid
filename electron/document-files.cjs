const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const iconv = require("iconv-lite");

const documentFileLocks = new Map();

async function readDocumentFile(filePath) {
  const bytes = await fsp.readFile(filePath);
  const stats = await fsp.stat(filePath);
  const format = detectDocumentFormat(bytes);
  return {
    name: path.basename(filePath),
    path: filePath,
    text: decodeDocumentBytes(bytes, format),
    format,
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

    const format = normalizeDocumentFormat(options.format || current?.format);
    const bytes = encodeDocumentText(typeof text === "string" ? text : "", format);
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
      modifiedAt: saved.modifiedAt,
      format: saved.format
    };
  });
}

function detectDocumentFormat(bytes) {
  let encoding = "utf8";
  let bom = false;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bom = true;
  } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf16le";
    bom = true;
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf16be";
    bom = true;
  } else {
    const utf16Encoding = detectBomlessUtf16Encoding(bytes);
    if (utf16Encoding) encoding = utf16Encoding;
    else {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        encoding = "gb18030";
      }
    }
  }
  const decoded = decodeDocumentBytes(bytes, { encoding, bom, lineEnding: "lf" });
  const crlfCount = (decoded.match(/\r\n/g) || []).length;
  const lfCount = (decoded.match(/(?<!\r)\n/g) || []).length;
  return { encoding, bom, lineEnding: crlfCount > lfCount ? "crlf" : "lf" };
}

function detectBomlessUtf16Encoding(bytes) {
  if (bytes.length < 4 || bytes.length % 2) return null;
  const pairs = Math.min(bytes.length / 2, 1024);
  let evenNulls = 0;
  let oddNulls = 0;
  for (let index = 0; index < pairs * 2; index += 2) {
    if (bytes[index] === 0) evenNulls += 1;
    if (bytes[index + 1] === 0) oddNulls += 1;
  }
  if (oddNulls / pairs >= 0.3 && evenNulls / pairs <= 0.05) return "utf16le";
  if (evenNulls / pairs >= 0.3 && oddNulls / pairs <= 0.05) return "utf16be";
  return null;
}

function decodeDocumentBytes(bytes, format) {
  const normalized = normalizeDocumentFormat(format);
  let offset = 0;
  if (normalized.bom) {
    if (normalized.encoding === "utf8") offset = 3;
    else if (normalized.encoding === "utf16le" || normalized.encoding === "utf16be") offset = 2;
  }
  let source = bytes.subarray(offset);
  if (normalized.encoding === "utf16be") {
    source = Buffer.from(source);
    for (let index = 0; index + 1 < source.length; index += 2) {
      const first = source[index];
      source[index] = source[index + 1];
      source[index + 1] = first;
    }
    return iconv.decode(source, "utf16le");
  }
  return iconv.decode(source, normalized.encoding);
}

function encodeDocumentText(text, format) {
  const normalized = normalizeDocumentFormat(format);
  const content = normalized.lineEnding === "crlf" ? text.replace(/\r?\n/g, "\r\n") : text.replace(/\r\n/g, "\n");
  let bytes;
  if (normalized.encoding === "utf16be") {
    bytes = iconv.encode(content, "utf16le");
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      const first = bytes[index];
      bytes[index] = bytes[index + 1];
      bytes[index + 1] = first;
    }
  } else bytes = iconv.encode(content, normalized.encoding);
  if (!normalized.bom) return bytes;
  if (normalized.encoding === "utf8") return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]);
  if (normalized.encoding === "utf16le") return Buffer.concat([Buffer.from([0xff, 0xfe]), bytes]);
  if (normalized.encoding === "utf16be") return Buffer.concat([Buffer.from([0xfe, 0xff]), bytes]);
  return bytes;
}

function normalizeDocumentFormat(format) {
  const supported = new Set(["utf8", "utf16le", "utf16be", "gb18030"]);
  const encoding = supported.has(format?.encoding) ? format.encoding : "utf8";
  return {
    encoding,
    bom: format?.bom === true && encoding !== "gb18030",
    lineEnding: format?.lineEnding === "crlf" ? "crlf" : "lf"
  };
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
  decodeDocumentBytes,
  detectDocumentFormat,
  encodeDocumentText,
  readDocumentFile,
  revisionForBytes,
  writeDocumentFile
};
