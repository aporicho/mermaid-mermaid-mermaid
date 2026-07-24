const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "ico"]);
const ASSET_PROTOCOL = "mmm-asset";

async function importImageAssetPath(documentPath, imagePath) {
  assertSupportedImageDocumentPath(documentPath);
  if (!isSupportedImagePath(imagePath)) {
    throw fileWorkflowError("unsupported_type", "只支持 png、jpg、jpeg、webp、gif、svg、avif 或 ico 图片。", imagePath);
  }

  const documentDir = path.dirname(documentPath);
  const imageAbsolute = await fsp.realpath(imagePath).catch((error) => {
    throw fileWorkflowError("read_failed", error.message, imagePath);
  });
  const documentAbsoluteDir = await fsp.realpath(documentDir).catch(() => documentDir);

  let assetPath = imageAbsolute;
  let copied = false;
  if (!isPathInside(imageAbsolute, documentAbsoluteDir)) {
    const destinationDir = path.join(documentDir, "assets", documentStem(documentPath));
    await fsp.mkdir(destinationDir, { recursive: true });
    assetPath = path.join(destinationDir, copiedImageFileName(imageAbsolute));
    await fsp.copyFile(imageAbsolute, assetPath);
    copied = true;
  }

  return imageAssetResult(documentDir, assetPath, copied);
}

async function importImageAssetBytes(documentPath, fileName, bytes) {
  assertSupportedImageDocumentPath(documentPath);
  if (!isSupportedImagePath(fileName)) {
    throw fileWorkflowError("unsupported_type", "只支持 png、jpg、jpeg、webp、gif、svg、avif 或 ico 图片。", fileName);
  }

  const documentDir = path.dirname(documentPath);
  const destinationDir = path.join(documentDir, "assets", documentStem(documentPath));
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  await fsp.mkdir(destinationDir, { recursive: true });
  const destination = uniqueAssetDestination(destinationDir, fileName, buffer);
  await fsp.writeFile(destination, buffer);
  return imageAssetResult(documentDir, destination, true);
}

function resolveImageAssetPath(documentPath, src) {
  if (!src || isExternalAssetSrc(src)) return null;
  if (!documentPath && !path.isAbsolute(src)) return null;
  const candidate = path.resolve(documentPath ? path.dirname(documentPath) : process.cwd(), src);
  if (!isSupportedImagePath(candidate)) return null;
  return candidate;
}

function filePathToAssetUrl(filePath) {
  return `${ASSET_PROTOCOL}://local/?path=${encodeURIComponent(filePath)}`;
}

function assetUrlToFilePath(value) {
  const url = new URL(value);
  if (url.protocol !== `${ASSET_PROTOCOL}:` || url.hostname !== "local") return "";
  return url.searchParams.get("path") || "";
}

async function writePreviewAssetOrCache(documentPath, fileName, bytes, cacheDir) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (documentPath && isSupportedImageDocumentPath(documentPath)) {
    const documentDir = path.dirname(documentPath);
    const destinationDir = path.join(documentDir, "assets", documentStem(documentPath), "link-previews");
    const destination = path.join(destinationDir, fileName);
    await fsp.mkdir(destinationDir, { recursive: true });
    await fsp.writeFile(destination, buffer);
    return {
      src: relativeAssetSrc(documentDir, destination),
      path: destination,
      persistent: true,
      displaySrc: filePathToAssetUrl(destination)
    };
  }

  const destinationDir = cacheDir || path.join(process.env.HOME || process.env.USERPROFILE || process.cwd(), ".mermaid-canvas-editor", "link-previews");
  const destination = path.join(destinationDir, fileName);
  await fsp.mkdir(destinationDir, { recursive: true });
  await fsp.writeFile(destination, buffer);
  return {
    src: destination,
    path: destination,
    persistent: false,
    displaySrc: filePathToAssetUrl(destination)
  };
}

function imageAssetResult(documentDir, assetPath, copied) {
  return {
    src: relativeAssetSrc(documentDir, assetPath),
    path: assetPath,
    copied,
    displaySrc: filePathToAssetUrl(assetPath)
  };
}

function assertSupportedImageDocumentPath(documentPath) {
  if (!isSupportedImageDocumentPath(documentPath)) {
    throw fileWorkflowError("unsupported_type", "请先保存为 .mmd、.mermaid 或 .canvas.json 文件，再插入本地图片。", documentPath);
  }
}

function isSupportedImageDocumentPath(filePath) {
  if (typeof filePath !== "string" || !filePath) return false;
  const lowerName = path.basename(filePath).toLowerCase();
  if (lowerName.endsWith(".canvas.json")) return true;
  const extension = path.extname(lowerName).replace(/^\./, "").toLowerCase();
  return extension === "mmd" || extension === "mermaid";
}

function isSupportedImagePath(filePath) {
  if (typeof filePath !== "string" || !filePath) return false;
  const extension = path.extname(filePath).replace(/^\./, "").toLowerCase();
  return IMAGE_EXTENSIONS.has(extension);
}

function isExternalAssetSrc(src) {
  const lower = String(src || "").toLowerCase();
  return ["http://", "https://", "data:", "blob:", `${ASSET_PROTOCOL}:`].some((prefix) => lower.startsWith(prefix));
}

function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return !relative || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function documentStem(filePath) {
  return (path.basename(filePath, path.extname(filePath)) || "diagram")
    .split("")
    .map((character) => (/^[A-Za-z0-9_-]$/.test(character) ? character : "-"))
    .join("");
}

function copiedImageFileName(filePath) {
  const extension = path.extname(filePath).replace(/^\./, "") || "png";
  const stem = path.basename(filePath, path.extname(filePath)) || "image";
  return `${stem}-${shortPathHash(filePath)}.${extension}`;
}

function uniqueAssetDestination(destinationDir, sourceName, bytes) {
  const extension = path.extname(sourceName).replace(/^\./, "") || "png";
  const stem = path.basename(sourceName, path.extname(sourceName)) || "image";
  const hash = crypto.createHash("sha256").update(String(sourceName)).update(String(bytes.length)).update(bytes.subarray(0, 4096)).digest("hex").slice(0, 8);
  return path.join(destinationDir, `${stem}-${hash}.${extension}`);
}

function shortPathHash(filePath) {
  return crypto.createHash("sha256").update(String(filePath)).digest("hex").slice(0, 8);
}

function relativeAssetSrc(baseDir, assetPath) {
  const relative = path.relative(baseDir, assetPath);
  return (relative && !relative.startsWith("..") ? relative : assetPath).split(path.sep).join("/");
}

function fileWorkflowError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  error.path = filePath;
  return error;
}

module.exports = {
  ASSET_PROTOCOL,
  assetUrlToFilePath,
  filePathToAssetUrl,
  importImageAssetBytes,
  importImageAssetPath,
  isExternalAssetSrc,
  isSupportedImagePath,
  resolveImageAssetPath,
  writePreviewAssetOrCache
};
