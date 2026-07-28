function createDocumentPreloadBridge(ipcRenderer) {
  return {
    openFile() {
      return ipcRenderer.invoke("mmm:file:open");
    },
    openFilePath(path) {
      return ipcRenderer.invoke("mmm:file:open-path", path);
    },
    saveFile(path, text, options) {
      return ipcRenderer.invoke("mmm:file:save", { path, text, ...options });
    },
    saveFileAs(suggestedName, text) {
      return ipcRenderer.invoke("mmm:file:save-as", { suggestedName, text });
    },
    getDocumentSnapshot(request) {
      return ipcRenderer.invoke("mmm:document-hub:get", request);
    },
    openDocumentSnapshot(request) {
      return ipcRenderer.invoke("mmm:document-hub:open", request);
    },
    syncDocumentWorkingCopy(request) {
      return ipcRenderer.invoke("mmm:document-hub:sync", request);
    },
    acquireDocumentEditLease(request) {
      return ipcRenderer.invoke("mmm:document-hub:lease", request);
    },
    resolveDocumentConflict(request) {
      return ipcRenderer.invoke("mmm:document-hub:resolve-conflict", request);
    },
    recreateDocument(request) {
      return ipcRenderer.invoke("mmm:document-hub:recreate", request);
    },
    undoDocumentTransaction(request) {
      return ipcRenderer.invoke("mmm:document-hub:undo", request);
    },
    redoDocumentTransaction(request) {
      return ipcRenderer.invoke("mmm:document-hub:redo", request);
    },
    saveDocumentWorkingCopy(request) {
      return ipcRenderer.invoke("mmm:document-hub:save", request);
    },
    discardDocumentWorkingCopy(request) {
      return ipcRenderer.invoke("mmm:document-hub:discard", request);
    },
    onDocumentHubEvent(handler) {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on("mmm:document-hub:changed", listener);
      return () => ipcRenderer.removeListener("mmm:document-hub:changed", listener);
    }
  };
}

module.exports = { createDocumentPreloadBridge };
