function createProjectPreloadBridge(ipcRenderer) {
  return {
    createProjectDocument(request) {
      return ipcRenderer.invoke("mmm:project:create-document", request);
    },
    createProjectTextFile(request) {
      return ipcRenderer.invoke("mmm:project:create-text-file", request);
    },
    createProjectFile(request) {
      return ipcRenderer.invoke("mmm:project:create-file", request);
    },
    moveProjectFile(request) {
      return ipcRenderer.invoke("mmm:project:move-file", request);
    },
    readMarkdownFoldState(request) {
      return ipcRenderer.invoke("mmm:markdown-folds:read", request);
    },
    writeMarkdownFoldState(request) {
      return ipcRenderer.invoke("mmm:markdown-folds:write", request);
    },
    moveMarkdownFoldState(request) {
      return ipcRenderer.invoke("mmm:markdown-folds:move", request);
    }
  };
}

module.exports = { createProjectPreloadBridge };
