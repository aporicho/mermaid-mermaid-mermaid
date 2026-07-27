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

function registerProjectDocumentIpc({ ipcMain, shell, onMove, onDelete }) {
  ipcMain.handle("mmm:project:create-document", (_event, request) => createProjectDocument(request));
  ipcMain.handle("mmm:project:create-text-file", (_event, request) => createProjectTextFile(request));
  ipcMain.handle("mmm:project:create-file", (_event, request) => createProjectFile(request));
  ipcMain.handle("mmm:project:move-file", async (_event, request) => {
    const result = await moveProjectFile(request);
    if (result?.status === "moved") await onMove?.(result.sourcePath, result.file.path);
    return result;
  });
  ipcMain.handle("mmm:project:create-directory", (_event, request) => createProjectDirectory(request));
  ipcMain.handle("mmm:project:rename-resource", async (_event, request) => {
    const result = await renameProjectResource(request);
    if (result?.status === "renamed") await onMove?.(result.sourcePath, result.resource.path);
    return result;
  });
  ipcMain.handle("mmm:project:move-resources", async (_event, request) => {
    const result = await moveProjectResources(request);
    for (const item of result?.results || []) if (item?.status === "moved") await onMove?.(item.sourcePath, item.resource.path);
    return result;
  });
  ipcMain.handle("mmm:project:reorder-resources", (_event, request) => reorderProjectResources(request));
  ipcMain.handle("mmm:project:copy-resources", (_event, request) => copyProjectResources(request));
  ipcMain.handle("mmm:project:import-resources", (_event, request) => importProjectResources(request));
  ipcMain.handle("mmm:project:delete-resources", async (_event, request) => {
    const result = await deleteProjectResources(request, { trashItem: (target) => shell.trashItem(target) });
    for (const resource of result?.resources || []) await onDelete?.(resource.path);
    return result;
  });
  ipcMain.handle("mmm:project:show-resource", (_event, request) => showProjectResourceInFileManager(request, { showItemInFolder: (target) => shell.showItemInFolder(target) }));
}

module.exports = { registerProjectDocumentIpc };
