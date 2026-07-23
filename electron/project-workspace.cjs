const fsp = require("node:fs/promises");
const path = require("node:path");

const PROJECT_FILE_LIMIT = 500;
const PROJECT_RESOURCE_LIMIT = 10_000;
const SKIPPED_PROJECT_DIRECTORIES = new Set([".git", ".hg", ".svn", ".mermaid-canvas-editor", "node_modules", "dist", "build", ".vite", ".next", "target", "dist-electron"]);

async function scanProjectFolder(rootPath) {
  const root = await fsp.realpath(rootPath);
  const files = [];
  const resources = [];
  const state = { truncated: false, resourcesTruncated: false };
  await collectProjectFiles(root, root, files, resources, state);
  files.sort((left, right) => left.relativePath.toLowerCase().localeCompare(right.relativePath.toLowerCase()));
  resources.sort(compareProjectResources);
  return {
    rootName: path.basename(root) || root,
    rootPath: root,
    files,
    resources,
    scannedAt: Date.now(),
    truncated: state.truncated,
    resourcesTruncated: state.resourcesTruncated
  };
}

async function collectProjectFiles(root, directory, files, resources, state) {
  if (files.length >= PROJECT_FILE_LIMIT && resources.length >= PROJECT_RESOURCE_LIMIT) {
    state.truncated = true;
    state.resourcesTruncated = true;
    return;
  }

  let entries = [];
  try {
    entries = await fsp.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (directory === root) throw error;
    return;
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (files.length >= PROJECT_FILE_LIMIT && resources.length >= PROJECT_RESOURCE_LIMIT) {
      state.truncated = true;
      state.resourcesTruncated = true;
      return;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipProjectDirectory(entry.name)) continue;
      appendProjectResource(resources, state, {
        kind: "directory",
        name: entry.name,
        path: fullPath,
        relativePath: projectRelativePath(root, fullPath)
      });
      await collectProjectFiles(root, fullPath, files, resources, state);
      continue;
    }
    if (!entry.isFile()) continue;

    const supportedDocument = isSupportedDocumentPath(fullPath);
    let modifiedAt;
    if (supportedDocument || /\.(?:csv|html?)$/i.test(fullPath)) {
      try {
        modifiedAt = (await fsp.stat(fullPath)).mtimeMs;
      } catch {
        modifiedAt = undefined;
      }
    }
    const resource = {
      kind: "file",
      name: path.basename(fullPath),
      path: fullPath,
      relativePath: projectRelativePath(root, fullPath),
      ...(modifiedAt ? { modifiedAt } : {})
    };
    appendProjectResource(resources, state, resource);
    if (!supportedDocument) continue;
    if (files.length >= PROJECT_FILE_LIMIT) {
      state.truncated = true;
      continue;
    }
    files.push(resource);
  }
}

function appendProjectResource(resources, state, resource) {
  if (resources.length >= PROJECT_RESOURCE_LIMIT) {
    state.resourcesTruncated = true;
    return;
  }
  resources.push(resource);
}

function projectRelativePath(root, entryPath) {
  return path.relative(root, entryPath).split(path.sep).join("/");
}

function compareProjectResources(left, right) {
  const leftDepth = left.relativePath.split("/").length;
  const rightDepth = right.relativePath.split("/").length;
  if (leftDepth !== rightDepth) return leftDepth - rightDepth;
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
  return left.relativePath.toLowerCase().localeCompare(right.relativePath.toLowerCase());
}

function shouldSkipProjectDirectory(name) {
  return SKIPPED_PROJECT_DIRECTORIES.has(name.toLowerCase());
}

function isSupportedDocumentPath(filePath) {
  if (typeof filePath !== "string" || !filePath) return false;
  const lowerName = path.basename(filePath).toLowerCase();
  if (lowerName.endsWith(".canvas.json")) return true;
  const extension = path.extname(lowerName).replace(/^\./, "");
  return ["mmd", "mermaid", "md", "markdown"].includes(extension);
}

module.exports = {
  PROJECT_FILE_LIMIT,
  PROJECT_RESOURCE_LIMIT,
  scanProjectFolder
};
