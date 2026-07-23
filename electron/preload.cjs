const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { createProjectPreloadBridge } = require("./project-preload.cjs");

contextBridge.exposeInMainWorld("mmmElectron", {
  host: "electron",
  ...createProjectPreloadBridge(ipcRenderer),
  openExternalUrl(url) {
    return ipcRenderer.invoke("mmm:open-external-url", url);
  },
  startWindowDrag() {
    return ipcRenderer.invoke("mmm:window:start-drag");
  },
  toggleWindowMaximize() {
    return ipcRenderer.invoke("mmm:window:toggle-maximize");
  },
  runWindowAction(action) {
    return ipcRenderer.invoke("mmm:window:action", action);
  },
  onDesktopWindowCloseRequest(handler) {
    const listener = async () => {
      ipcRenderer.send("mmm:window:close-request-received");
      let accepted = false;
      try {
        accepted = Boolean(await handler());
      } catch {
        accepted = false;
      }
      ipcRenderer.send("mmm:window:close-response", { accepted });
    };
    ipcRenderer.on("mmm:window:close-request", listener);
    return () => ipcRenderer.removeListener("mmm:window:close-request", listener);
  },
  readAppState() {
    return ipcRenderer.invoke("mmm:app-state:read");
  },
  listSystemFonts() {
    return ipcRenderer.invoke("mmm:fonts:list");
  },
  writeAppState(state) {
    return ipcRenderer.invoke("mmm:app-state:write", state);
  },
  openFile() {
    return ipcRenderer.invoke("mmm:file:open");
  },
  openFilePath(path) {
    return ipcRenderer.invoke("mmm:file:open-path", path);
  },
  saveFile(path, text) {
    return ipcRenderer.invoke("mmm:file:save", { path, text });
  },
  saveFileAs(suggestedName, text) {
    return ipcRenderer.invoke("mmm:file:save-as", { suggestedName, text });
  },
  readCsvFile(request) {
    return ipcRenderer.invoke("mmm:csv:read", request);
  },
  writeCsvFile(request) {
    return ipcRenderer.invoke("mmm:csv:write", request);
  },
  pickImageAsset(documentPath) {
    return ipcRenderer.invoke("mmm:image:pick", documentPath);
  },
  importImageAssetPath(documentPath, imagePath) {
    return ipcRenderer.invoke("mmm:image:import-path", { documentPath, imagePath });
  },
  importImageAssetBytes(documentPath, fileName, bytes) {
    return ipcRenderer.invoke("mmm:image:import-bytes", { documentPath, fileName, bytes });
  },
  resolveImageAssetSrc(documentPath, src) {
    return ipcRenderer.invoke("mmm:image:resolve-src", { documentPath, src });
  },
  resolveLinkPreview(request) {
    return ipcRenderer.invoke("mmm:link-preview:resolve", request);
  },
  takePendingOpenFiles() {
    return ipcRenderer.invoke("mmm:pending-files:take");
  },
  onExternalFileOpen(handler) {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("mmm:file:external-open", listener);
    return () => ipcRenderer.removeListener("mmm:file:external-open", listener);
  },
  onFileDrops(handler) {
    return listenForFileDrops(handler);
  },
  publishAiContext(context) {
    return ipcRenderer.invoke("mmm:ai:publish-context", context);
  },
  pollAiCommand() {
    return ipcRenderer.invoke("mmm:ai:take-next-command");
  },
  finishAiCommand(result) {
    return ipcRenderer.invoke("mmm:ai:finish-command", result);
  },
  listTerminalShells() {
    return ipcRenderer.invoke("mmm:terminal:list-shells");
  },
  openTerminal(request) {
    return ipcRenderer.invoke("mmm:terminal:open", request);
  },
  writeTerminal(sessionId, data) {
    return ipcRenderer.invoke("mmm:terminal:write", { sessionId, data });
  },
  resizeTerminal(sessionId, cols, rows) {
    return ipcRenderer.invoke("mmm:terminal:resize", { sessionId, cols, rows });
  },
  closeTerminal(sessionId) {
    return ipcRenderer.invoke("mmm:terminal:close", sessionId);
  },
  onTerminalData(handler) {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("mmm:terminal:data", listener);
    return () => ipcRenderer.removeListener("mmm:terminal:data", listener);
  },
  onTerminalExit(handler) {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("mmm:terminal:exit", listener);
    return () => ipcRenderer.removeListener("mmm:terminal:exit", listener);
  },
  openProjectFolder() {
    return ipcRenderer.invoke("mmm:project:open-folder");
  },
  readProjectFolder(rootPath) {
    return ipcRenderer.invoke("mmm:project:read-folder", rootPath);
  },
  createEmbeddedBrowser(request) {
    return ipcRenderer.invoke("mmm:browser:create", request);
  },
  closeEmbeddedBrowser(label) {
    return ipcRenderer.invoke("mmm:browser:close", label);
  },
  hideEmbeddedBrowser(label) {
    return ipcRenderer.invoke("mmm:browser:hide", label);
  },
  showEmbeddedBrowser(label) {
    return ipcRenderer.invoke("mmm:browser:show", label);
  },
  focusEmbeddedBrowser(label) {
    return ipcRenderer.invoke("mmm:browser:focus", label);
  },
  setEmbeddedBrowserRect(label, rect) {
    return ipcRenderer.invoke("mmm:browser:set-rect", label, rect);
  },
  onEmbeddedBrowserError(handler) {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("mmm:browser:error", listener);
    return () => ipcRenderer.removeListener("mmm:browser:error", listener);
  },
  openBrowserToolWindow(request) {
    return ipcRenderer.invoke("mmm:browser-tool:open", request);
  }
});

function listenForFileDrops(handler) {
  const onDragEnter = (event) => {
    const files = droppedFiles(event);
    if (files.length) handler({ type: "enter", files, position: eventPosition(event) });
  };
  const onDragOver = (event) => {
    event.preventDefault();
    const files = droppedFiles(event);
    if (files.length) handler({ type: "over", files, position: eventPosition(event) });
  };
  const onDrop = (event) => {
    event.preventDefault();
    const files = droppedFiles(event);
    if (files.length) handler({ type: "drop", files, position: eventPosition(event) });
  };
  const onDragLeave = (event) => {
    const files = droppedFiles(event);
    handler({ type: "leave", files, position: eventPosition(event) });
  };

  window.addEventListener("dragenter", onDragEnter);
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("drop", onDrop);
  window.addEventListener("dragleave", onDragLeave);

  return () => {
    window.removeEventListener("dragenter", onDragEnter);
    window.removeEventListener("dragover", onDragOver);
    window.removeEventListener("drop", onDrop);
    window.removeEventListener("dragleave", onDragLeave);
  };
}

function droppedFiles(event) {
  return Array.from(event.dataTransfer?.files || [])
    .map((file) => {
      const filePath = filePathFromFile(file);
      return filePath ? { name: file.name, path: filePath } : null;
    })
    .filter(Boolean);
}

function filePathFromFile(file) {
  try {
    return webUtils?.getPathForFile?.(file) || file.path || "";
  } catch {
    return file.path || "";
  }
}

function eventPosition(event) {
  return {
    x: event.clientX,
    y: event.clientY
  };
}
