function createMarkdownExportPreloadBridge(ipcRenderer) {
  return {
    exportMarkdownFolder(request) {
      return ipcRenderer.invoke("mmm:markdown:export-folder", request);
    }
  };
}

module.exports = { createMarkdownExportPreloadBridge };
