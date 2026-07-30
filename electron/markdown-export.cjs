const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { findMarkdownFileReferences } = require("./markdown-export-links.cjs");

async function exportMarkdownFolder({ sourcePath, documentText, projectRoot, parentDirectory }) {
  assertMarkdownSource(sourcePath);
  const sourceAbsolute = path.resolve(sourcePath);
  const sourceStat = await fsp.stat(sourceAbsolute);
  if (!sourceStat.isFile()) throw new Error("Markdown 导出源不是文件。");
  const parentAbsolute = path.resolve(parentDirectory);
  const parentStat = await fsp.stat(parentAbsolute);
  if (!parentStat.isDirectory()) throw new Error("请选择有效的导出目录。");

  const source = typeof documentText === "string" ? documentText : await fsp.readFile(sourceAbsolute, "utf8");
  const outputPath = await uniqueExportDirectory(parentAbsolute, path.basename(sourceAbsolute, path.extname(sourceAbsolute)) || "document");
  const temporaryPath = path.join(parentAbsolute, `.${path.basename(outputPath)}.tmp-${crypto.randomUUID()}`);
  await fsp.mkdir(temporaryPath);

  try {
    const result = await copyReferencedFiles({
      source,
      sourcePath: sourceAbsolute,
      projectRoot: typeof projectRoot === "string" && projectRoot ? path.resolve(projectRoot) : null,
      outputDirectory: temporaryPath
    });
    await fsp.writeFile(path.join(temporaryPath, path.basename(sourceAbsolute)), result.markdown, "utf8");
    await fsp.rename(temporaryPath, outputPath);
    return {
      status: "exported",
      directoryPath: outputPath,
      copiedFiles: result.copiedFiles,
      warnings: result.warnings
    };
  } catch (error) {
    await fsp.rm(temporaryPath, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function copyReferencedFiles({ source, sourcePath, projectRoot, outputDirectory }) {
  const references = await findMarkdownFileReferences(source);
  const assetsDirectory = path.join(outputDirectory, "assets");
  const copiedBySource = new Map();
  const reservedNames = new Set();
  const edits = [];
  const warnings = [];
  let copiedFiles = 0;

  for (const reference of references) {
    const target = await resolveLocalReference(reference.href, reference.mode, sourcePath, projectRoot);
    if (target.status === "ignored") continue;
    if (target.status === "warning") {
      warnings.push({ reference: reference.href, reason: target.reason });
      continue;
    }

    let copied = copiedBySource.get(target.path);
    if (!copied) {
      const fileName = uniqueAssetName(path.basename(target.path), reservedNames);
      try {
        await fsp.mkdir(assetsDirectory, { recursive: true });
        await fsp.copyFile(target.path, path.join(assetsDirectory, fileName));
      } catch (error) {
        warnings.push({ reference: reference.href, reason: readableCopyFailure(error) });
        continue;
      }
      copied = `assets/${encodeURIComponent(fileName)}`;
      copiedBySource.set(target.path, copied);
      copiedFiles += 1;
    }
    edits.push({ start: reference.start, end: reference.end, replacement: `${copied}${target.suffix}` });
  }

  return { markdown: applyEdits(source, edits), copiedFiles, warnings };
}

async function resolveLocalReference(href, mode, sourcePath, projectRoot) {
  const parsed = localReferencePath(href);
  if (!parsed) return { status: "ignored" };
  const candidates = referenceCandidates(parsed.path, mode, path.dirname(sourcePath), projectRoot);
  let nonFile = false;
  for (const candidate of candidates) {
    try {
      const stat = await fsp.stat(candidate);
      if (!stat.isFile()) { nonFile = true; continue; }
      return { status: "ready", path: await fsp.realpath(candidate).catch(() => candidate), suffix: parsed.suffix };
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
        return { status: "warning", reason: `无法读取：${error.message || error}` };
      }
    }
  }
  return { status: "warning", reason: nonFile ? "链接目标不是文件" : "找不到文件" };
}

function localReferencePath(href) {
  const value = String(href || "").trim();
  if (!value || value.startsWith("#") || value.startsWith("//")) return null;
  if (/^file:/i.test(value)) {
    try {
      const url = new URL(value);
      return { path: fileURLToPath(url), suffix: `${url.search}${url.hash}` };
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  const suffixIndex = firstSuffixIndex(value);
  const encodedPath = value.slice(0, suffixIndex);
  if (!encodedPath) return null;
  return {
    path: decodePath(encodedPath.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1")),
    suffix: value.slice(suffixIndex)
  };
}

function referenceCandidates(targetPath, mode, documentDirectory, projectRoot) {
  if (path.isAbsolute(targetPath)) return [path.normalize(targetPath)];
  if (/^\.\.?([\\/]|$)/.test(targetPath)) return [path.resolve(documentDirectory, targetPath)];
  const documentCandidate = path.resolve(documentDirectory, targetPath);
  const projectCandidate = projectRoot ? path.resolve(projectRoot, targetPath) : null;
  const ordered = mode === "link" ? [projectCandidate, documentCandidate] : [documentCandidate, projectCandidate];
  return [...new Set(ordered.filter(Boolean))];
}

function uniqueAssetName(sourceName, reservedNames) {
  const extension = path.extname(sourceName);
  const stem = path.basename(sourceName, extension) || "resource";
  let candidate = sourceName || `resource${extension}`;
  let index = 2;
  while (reservedNames.has(candidate.toLocaleLowerCase())) candidate = `${stem}-${index++}${extension}`;
  reservedNames.add(candidate.toLocaleLowerCase());
  return candidate;
}

async function uniqueExportDirectory(parentDirectory, sourceStem) {
  let index = 1;
  while (true) {
    const suffix = index === 1 ? "" : `-${index}`;
    const candidate = path.join(parentDirectory, `${sourceStem}-export${suffix}`);
    try {
      await fsp.access(candidate);
      index += 1;
    } catch (error) {
      if (error?.code === "ENOENT") return candidate;
      throw error;
    }
  }
}

function applyEdits(source, edits) {
  let output = source;
  for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
  }
  return output;
}

function firstSuffixIndex(value) {
  const indexes = [value.indexOf("?"), value.indexOf("#")].filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : value.length;
}

function decodePath(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function readableCopyFailure(error) {
  return `复制失败：${error instanceof Error ? error.message : String(error)}`;
}

function assertMarkdownSource(sourcePath) {
  if (typeof sourcePath !== "string" || !/\.(?:md|markdown)$/i.test(sourcePath)) {
    throw new Error("只能导出 Markdown 文件。");
  }
}

module.exports = {
  applyEdits,
  copyReferencedFiles,
  exportMarkdownFolder,
  localReferencePath,
  referenceCandidates,
  uniqueAssetName
};
