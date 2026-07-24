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
    createProjectDirectory(request) {
      return ipcRenderer.invoke("mmm:project:create-directory", request);
    },
    renameProjectResource(request) {
      return ipcRenderer.invoke("mmm:project:rename-resource", request);
    },
    moveProjectResources(request) {
      return ipcRenderer.invoke("mmm:project:move-resources", request);
    },
    copyProjectResources(request) {
      return ipcRenderer.invoke("mmm:project:copy-resources", request);
    },
    importProjectResources(request) {
      return ipcRenderer.invoke("mmm:project:import-resources", request);
    },
    deleteProjectResources(request) {
      return ipcRenderer.invoke("mmm:project:delete-resources", request);
    },
    showProjectResourceInFileManager(request) {
      return ipcRenderer.invoke("mmm:project:show-resource", request);
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
