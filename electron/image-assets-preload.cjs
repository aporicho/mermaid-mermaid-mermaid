function createImageAssetPreloadBridge(ipcRenderer, webUtils) {
  return {
    pickImageAsset(documentPath, context) {
      return ipcRenderer.invoke("mmm:image:pick", { documentPath, context });
    },
    importImageAssetPath(documentPath, imagePath, context) {
      return ipcRenderer.invoke("mmm:image:import-path", { documentPath, imagePath, context });
    },
    importImageAssetBytes(documentPath, fileName, bytes, context) {
      return ipcRenderer.invoke("mmm:image:import-bytes", { documentPath, fileName, bytes, context });
    },
    async importImageAssetFile(documentPath, file, context) {
      const imagePath = filePathFromFile(file, webUtils);
      if (imagePath) return ipcRenderer.invoke("mmm:image:import-path", { documentPath, imagePath, context });
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      return ipcRenderer.invoke("mmm:image:import-bytes", { documentPath, fileName: file.name, bytes, context });
    },
    resolveImageAssetSrc(documentPath, src, context) {
      return ipcRenderer.invoke("mmm:image:resolve-src", { documentPath, src, context });
    }
  };
}

function filePathFromFile(file, webUtils) {
  try {
    return webUtils?.getPathForFile?.(file) || file.path || "";
  } catch {
    return file.path || "";
  }
}

function isMarkdownImageFileDrop(event) {
  const target = event.target?.closest?.("[data-markdown-image-drop-target]");
  const files = Array.from(event.dataTransfer?.files || []);
  return Boolean(target && files.length && files.every((file) => /\.(?:png|jpe?g|webp|gif|svg|avif|ico)$/i.test(file.name)));
}

module.exports = { createImageAssetPreloadBridge, filePathFromFile, isMarkdownImageFileDrop };
