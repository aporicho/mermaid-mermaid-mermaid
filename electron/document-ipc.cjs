const path = require("node:path");
const { createDocumentHub } = require("./document-hub.cjs");
const { readDocumentFile, writeDocumentFile } = require("./document-files.cjs");
const { readProjectCsvFile } = require("./project-csv.cjs");

const DOCUMENT_FILTERS = [{
  name: "Project Documents",
  extensions: ["mmd", "mermaid", "md", "markdown"]
}];

function createDocumentIpc({ ipcMain, dialog, BrowserWindow }) {
  const documentHub = createDocumentHub({
    readDocument: readDocumentFile,
    writeDocument: writeDocumentFile,
    send(webContents, payload) {
      webContents.send("mmm:document-hub:changed", payload);
    }
  });

  function register() {
    ipcMain.handle("mmm:file:open", (event) => openFileDialog(BrowserWindow.fromWebContents(event.sender), event.sender));
    ipcMain.handle("mmm:file:open-path", (event, filePath) => openFilePath(filePath, event.sender));
    ipcMain.handle("mmm:file:save", (event, request) => saveFilePath(request?.path, request?.text, {
      expectedRevision: request?.expectedRevision,
      expectedWorkingRevision: request?.expectedWorkingRevision,
      documentId: request?.documentId,
      overwrite: request?.overwrite === true
    }, event.sender));
    ipcMain.handle("mmm:file:save-as", (event, request) => saveFileDialog(
      BrowserWindow.fromWebContents(event.sender),
      request?.suggestedName,
      request?.text,
      event.sender
    ));
    ipcMain.handle("mmm:document-hub:get", (_event, request) => documentHub.get(request));
    ipcMain.handle("mmm:document-hub:open", (event, request) => documentHub.open(event.sender, request?.path));
    ipcMain.handle("mmm:document-hub:sync", (event, request) => documentHub.syncWorkingCopy(event.sender, request));
    ipcMain.handle("mmm:document-hub:lease", (event, request) => documentHub.acquireLease(event.sender, request));
    ipcMain.handle("mmm:document-hub:resolve-conflict", (event, request) => documentHub.resolveConflict(event.sender, request));
    ipcMain.handle("mmm:document-hub:recreate", (event, request) => documentHub.recreate(event.sender, request));
    ipcMain.handle("mmm:document-hub:undo", (event, request) => documentHub.undo(event.sender, request));
    ipcMain.handle("mmm:document-hub:redo", (event, request) => documentHub.redo(event.sender, request));
    ipcMain.handle("mmm:csv:read", readCsv);
    ipcMain.handle("mmm:csv:write", writeCsv);
  }

  async function openFileDialog(owner, webContents) {
    const result = await dialog.showOpenDialog(owner ?? undefined, {
      properties: ["openFile"],
      filters: DOCUMENT_FILTERS
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return openFilePath(result.filePaths[0], webContents);
  }

  async function openFilePath(filePath, webContents) {
    assertSupportedDocumentPath(filePath);
    return snapshotAsOpenedFile(await documentHub.open(webContents, filePath));
  }

  async function saveFilePath(filePath, text, options = {}, webContents) {
    assertSupportedDocumentPath(filePath);
    return documentHub.save(webContents, { path: filePath, text, ...options });
  }

  async function saveFileDialog(owner, suggestedName, text, webContents) {
    const result = await dialog.showSaveDialog(owner ?? undefined, {
      defaultPath: typeof suggestedName === "string" ? suggestedName : "diagram.mmd",
      filters: DOCUMENT_FILTERS
    });
    if (result.canceled || !result.filePath) return null;
    return saveFilePath(result.filePath, text, { overwrite: true }, webContents);
  }

  async function readCsv(event, request) {
    const validated = await readProjectCsvFile(request);
    const opened = await documentHub.open(event.sender, validated.file.path);
    return {
      file: opened.file,
      text: opened.content,
      revision: opened.diskRevision || validated.revision,
      workingRevision: opened.workingRevision,
      documentId: opened.documentId,
      modifiedAt: opened.modifiedAt
    };
  }

  async function writeCsv(event, request) {
    const validated = await readProjectCsvFile(request);
    if (Buffer.byteLength(typeof request?.text === "string" ? request.text : "", "utf8") > 1_048_576) {
      const error = new Error("CSV file exceeds 1048576 bytes.");
      error.code = "write_failed";
      error.path = validated.file.path;
      throw error;
    }
    const result = await documentHub.save(event.sender, {
      path: validated.file.path,
      text: request?.text,
      expectedRevision: request?.expectedRevision
    });
    if (result.status === "conflict") {
      return { status: "conflict", revision: result.revision, modifiedAt: result.modifiedAt };
    }
    return { status: "saved", file: result.file, revision: result.revision, modifiedAt: result.modifiedAt };
  }

  return { documentHub, register };
}

function snapshotAsOpenedFile(snapshot) {
  return {
    name: snapshot.file.name,
    path: snapshot.file.path,
    text: snapshot.content,
    revision: snapshot.diskRevision || snapshot.file.revision,
    workingRevision: snapshot.workingRevision,
    documentId: snapshot.documentId,
    modifiedAt: snapshot.modifiedAt,
    syncState: snapshot.syncState,
    saveState: snapshot.saveState
  };
}

function assertSupportedDocumentPath(filePath) {
  if (typeof filePath !== "string" || !filePath) throw unsupportedDocumentError(filePath);
  const extension = path.extname(path.basename(filePath).toLowerCase()).replace(/^\./, "");
  if (!["mmd", "mermaid", "md", "markdown"].includes(extension)) throw unsupportedDocumentError(filePath);
}

function unsupportedDocumentError(filePath) {
  const error = new Error("Only .mmd, .mermaid, .md, or .markdown files are supported.");
  error.code = "unsupported_type";
  error.path = filePath;
  return error;
}

module.exports = { createDocumentIpc };
