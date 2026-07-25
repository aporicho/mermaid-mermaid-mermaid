const {
  copyProjectResources,
  createProjectDirectory,
  createProjectDocument,
  createProjectFile,
  createProjectTextFile,
  deleteProjectResources,
  importProjectResources,
  moveProjectFile,
  moveProjectResources,
  renameProjectResource,
  showProjectResourceInFileManager
} = require("./project-documents.cjs");
const { reorderProjectResources } = require("./project-explorer-order.cjs");

function registerProjectDocumentIpc({ ipcMain, shell }) {
  ipcMain.handle("mmm:project:create-document", (_event, request) => createProjectDocument(request));
  ipcMain.handle("mmm:project:create-text-file", (_event, request) => createProjectTextFile(request));
  ipcMain.handle("mmm:project:create-file", (_event, request) => createProjectFile(request));
  ipcMain.handle("mmm:project:move-file", (_event, request) => moveProjectFile(request));
  ipcMain.handle("mmm:project:create-directory", (_event, request) => createProjectDirectory(request));
  ipcMain.handle("mmm:project:rename-resource", (_event, request) => renameProjectResource(request));
  ipcMain.handle("mmm:project:move-resources", (_event, request) => moveProjectResources(request));
  ipcMain.handle("mmm:project:reorder-resources", (_event, request) => reorderProjectResources(request));
  ipcMain.handle("mmm:project:copy-resources", (_event, request) => copyProjectResources(request));
  ipcMain.handle("mmm:project:import-resources", (_event, request) => importProjectResources(request));
  ipcMain.handle("mmm:project:delete-resources", (_event, request) => deleteProjectResources(request, { trashItem: (target) => shell.trashItem(target) }));
  ipcMain.handle("mmm:project:show-resource", (_event, request) => showProjectResourceInFileManager(request, { showItemInFolder: (target) => shell.showItemInFolder(target) }));
}

module.exports = { registerProjectDocumentIpc };
