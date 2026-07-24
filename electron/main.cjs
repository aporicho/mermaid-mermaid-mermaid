const { app, BrowserWindow, Menu, WebContentsView, dialog, ipcMain, net, protocol, shell } = require("electron");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  ASSET_PROTOCOL,
  assetUrlToFilePath,
  filePathToAssetUrl,
  importImageAssetBytes,
  importImageAssetPath,
  isSupportedImagePath,
  resolveImageAssetPath
} = require("./image-assets.cjs");
const { resolveLinkPreview } = require("./link-preview.cjs");
const { createProjectDocument, createProjectFile, createProjectTextFile, moveProjectFile } = require("./project-documents.cjs");
const { readProjectCsvFile, writeProjectCsvFile } = require("./project-csv.cjs");
const {
  moveProjectMarkdownFoldState,
  readProjectMarkdownFoldState,
  writeProjectMarkdownFoldState
} = require("./markdown-fold-store.cjs");
const { createTerminalManager } = require("./terminal.cjs");
const { createPiAgentManager } = require("./pi-agent-manager.cjs");
const { cleanupLegacyAiBridgeDiscovery, registerPiAgentIpc } = require("./pi-agent-ipc.cjs");
const { listSystemFonts } = require("./system-fonts.cjs");
const { createProjectFileWatcher } = require("./project-file-watcher.cjs");
const { readDocumentFile, writeDocumentFile } = require("./document-files.cjs");
const { createEditorSessionStore } = require("./editor-sessions.cjs");
const { writeJsonAtomically } = require("./atomic-json-file.cjs");
const { scanProjectFolder: scanProjectFolderSnapshot } = require("./project-workspace.cjs");
const { createWindowFileRouter } = require("./window-file-router.cjs");
const { attachWindowFullscreenEvents, registerWindowFullscreenIpc } = require("./window-fullscreen.cjs");
const { normalizeEmbeddedBrowserUrl, normalizeHttpUrl } = require("./embedded-browser-url.cjs");
const { createEmbeddedBrowserTitlebarHotZone } = require("./embedded-browser-titlebar-hot-zone.cjs");
const DEV_SERVER_URL = process.env.MMM_ELECTRON_DEV_SERVER_URL || "";
const PROJECT_DIR = path.resolve(__dirname, "..");
const DIST_INDEX = path.join(PROJECT_DIR, "dist", "index.html");
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");
const CLOSE_REQUEST_TIMEOUT_MS = 3000;
const DOCUMENT_FILTERS = [
  {
    name: "Project Documents",
    extensions: ["mmd", "mermaid", "md", "markdown", "json"]
  }
];
const IMAGE_FILTERS = [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "ico"] }];
const embeddedBrowsers = new Map();
const forceCloseWindowIds = new Set();
const pendingCloseWindowIds = new Set(), pendingCloseTimers = new Map();
const mainWindows = new Set();
const claimedEditorSessionIds = new Map();
let editorSessionStoreInstance = null;
let appStateWriteQueue = Promise.resolve();
const windowFileRouter = createWindowFileRouter();

const piAgentManager = createPiAgentManager({ shell });
const terminalManager = createTerminalManager({
  send(channel, payload) {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(`mmm:${channel}`, payload);
    }
  }
});
const projectFileWatcher = createProjectFileWatcher({
  send(webContents, payload) {
    webContents.send("mmm:project-files:changed", payload);
  }
});
// Keep one Electron main process for shared services, but allow every launch request to create its own editor window.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let mainWindow = null;
let startupOpenFiles = collectDocumentFileArgs(process.argv.slice(1));
let mainWindowsReady = false;
const deferredMainWindowRequests = [];
protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    requestMainWindow(collectDocumentFileArgs(argv.slice(1)));
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    const files = collectDocumentFileArgs([filePath]);
    if (mainWindowsReady) createMainWindow(files);
    else startupOpenFiles = mergeDocumentFiles(startupOpenFiles, files);
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    registerAssetProtocol();
    registerIpc();
    await cleanupLegacyAiBridgeDiscovery();
    mainWindowsReady = true;
    createMainWindow(startupOpenFiles);
    startupOpenFiles = [];
    for (const files of deferredMainWindowRequests.splice(0)) createMainWindow(files);
    app.on("activate", () => {
      if (mainWindows.size === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  terminalManager.closeAll();
  void piAgentManager.closeAll();
  void projectFileWatcher.closeAll();
});

function createMainWindow(openFiles = []) {
  const window = new BrowserWindow({
    title: "Mermaid Canvas Editor",
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: true,
    backgroundColor: "#f7f7f5",
    webPreferences: secureWebPreferences()
  });

  mainWindows.add(window);
  mainWindow = window;
  queuePendingFileOpens(window.webContents.id, openFiles);
  attachWindowCloseGuard(window);
  attachWindowCleanup(window);
  window.on("focus", () => {
    mainWindow = window;
  });
  loadAppUrl(window, appUrl());

  window.once("ready-to-show", () => window.show());
  return window;
}

function requestMainWindow(openFiles = []) {
  if (!mainWindowsReady) {
    deferredMainWindowRequests.push(openFiles);
    return null;
  }
  return createMainWindow(openFiles);
}

function secureWebPreferences() {
  return {
    preload: PRELOAD_PATH,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false
  };
}

function appUrl() {
  if (DEV_SERVER_URL) return DEV_SERVER_URL;
  return pathToFileURL(DIST_INDEX).toString();
}

function loadAppUrl(window, url) {
  if (DEV_SERVER_URL) {
    window.loadURL(url);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }
  window.loadURL(url);
}

function registerIpc() {
  ipcMain.handle("mmm:open-external-url", async (_event, url) => {
    const normalized = normalizeHttpUrl(url);
    if (!normalized) throw new Error("Only http/https URLs can be opened externally.");
    await shell.openExternal(normalized);
  });

  ipcMain.handle("mmm:window:start-drag", () => {
    // Electron uses CSS -webkit-app-region for frameless dragging.
  });

  ipcMain.handle("mmm:window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });

  registerWindowFullscreenIpc({ ipcMain, BrowserWindow });

  ipcMain.handle("mmm:window:action", (event, action) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (action === "minimize") window.minimize();
    if (action === "toggleMaximize") {
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    }
    if (action === "close") window.close();
  });

  ipcMain.on("mmm:window:close-response", (event, payload) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    clearPendingClose(window.id);
    if (!payload?.accepted) return;
    forceCloseWindowIds.add(window.id);
    window.close();
  });

  ipcMain.on("mmm:window:close-request-received", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    clearPendingCloseTimer(window.id);
  });

  ipcMain.handle("mmm:app-state:read", readAppState);
  ipcMain.handle("mmm:fonts:list", listSystemFonts);
  ipcMain.handle("mmm:app-state:write", (_event, state) => writeAppState(state));
  ipcMain.handle("mmm:editor-session:read", async (event) => {
    const existingId = claimedEditorSessionIds.get(event.sender.id);
    const all = await editorSessions().readAll();
    if (existingId && all.sessions[existingId]) return all.sessions[existingId].session;
    const session = await editorSessions().claim(new Set(claimedEditorSessionIds.values()));
    if (session?.windowId) claimedEditorSessionIds.set(event.sender.id, session.windowId);
    return session;
  });
  ipcMain.handle("mmm:editor-session:write", async (event, session) => {
    await editorSessions().write(session); claimedEditorSessionIds.set(event.sender.id, session.windowId);
  });
  ipcMain.handle("mmm:file:open", (event) => openFileDialog(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("mmm:file:open-path", (_event, filePath) => openFilePath(filePath));
  ipcMain.handle("mmm:file:save", (_event, request) => saveFilePath(request?.path, request?.text, { expectedRevision: request?.expectedRevision, overwrite: request?.overwrite === true }));
  ipcMain.handle("mmm:file:save-as", (event, request) => saveFileDialog(BrowserWindow.fromWebContents(event.sender), request?.suggestedName, request?.text));
  ipcMain.handle("mmm:project:create-document", (_event, request) => createProjectDocument(request));
  ipcMain.handle("mmm:project:create-text-file", (_event, request) => createProjectTextFile(request));
  ipcMain.handle("mmm:project:create-file", (_event, request) => createProjectFile(request));
  ipcMain.handle("mmm:project:move-file", (_event, request) => moveProjectFile(request));
  ipcMain.handle("mmm:markdown-folds:read", (_event, request) => readProjectMarkdownFoldState(request));
  ipcMain.handle("mmm:markdown-folds:write", (_event, request) => writeProjectMarkdownFoldState(request));
  ipcMain.handle("mmm:markdown-folds:move", (_event, request) => moveProjectMarkdownFoldState(request));
  ipcMain.handle("mmm:csv:read", (_event, request) => readProjectCsvFile(request));
  ipcMain.handle("mmm:csv:write", (_event, request) => writeProjectCsvFile(request));
  ipcMain.handle("mmm:image:pick", (event, documentPath) => pickImageAssetDialog(BrowserWindow.fromWebContents(event.sender), documentPath));
  ipcMain.handle("mmm:image:import-path", (_event, request) => importImageAssetPath(request?.documentPath, request?.imagePath));
  ipcMain.handle("mmm:image:import-bytes", (_event, request) => importImageAssetBytes(request?.documentPath, request?.fileName, request?.bytes));
  ipcMain.handle("mmm:image:resolve-src", (_event, request) => resolveImageAssetSrc(request?.documentPath, request?.src));
  ipcMain.handle("mmm:link-preview:resolve", (_event, request) => resolveLinkPreview(request));
  ipcMain.handle("mmm:pending-files:take", (event) => takePendingOpenFiles(event.sender.id));
  registerPiAgentIpc({ ipcMain, manager: piAgentManager });
  ipcMain.handle("mmm:terminal:list-shells", () => terminalManager.listShells());
  ipcMain.handle("mmm:terminal:open", (_event, request) => terminalManager.open(request));
  ipcMain.handle("mmm:terminal:write", (_event, request) => terminalManager.write(request?.sessionId, request?.data));
  ipcMain.handle("mmm:terminal:resize", (_event, request) => terminalManager.resize(request?.sessionId, request?.cols, request?.rows));
  ipcMain.handle("mmm:terminal:close", (_event, sessionId) => terminalManager.close(sessionId));
  ipcMain.handle("mmm:project:open-folder", (event) => openProjectFolderDialog(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("mmm:project:read-folder", (_event, rootPath) => scanProjectFolder(rootPath));
  ipcMain.handle("mmm:project-watch:set", (event, request) => projectFileWatcher.setTargets(event.sender, request));
  ipcMain.handle("mmm:browser:create", (event, request) => createEmbeddedBrowser(event.sender, request));
  ipcMain.handle("mmm:browser:close", (event, label) => closeEmbeddedBrowser(event.sender, label));
  ipcMain.handle("mmm:browser:hide", (event, label) => setEmbeddedBrowserVisible(event.sender, label, false));
  ipcMain.handle("mmm:browser:show", (event, label) => setEmbeddedBrowserVisible(event.sender, label, true));
  ipcMain.handle("mmm:browser:focus", (event, label) => focusEmbeddedBrowser(event.sender, label));
  ipcMain.handle("mmm:browser:navigate", (event, label, url) => navigateEmbeddedBrowser(event.sender, label, url));
  ipcMain.handle("mmm:browser:reload", (event, label) => reloadEmbeddedBrowser(event.sender, label));
  ipcMain.handle("mmm:browser:set-rect", (event, label, rect) => setEmbeddedBrowserRect(event.sender, label, rect));
}

function registerAssetProtocol() {
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    const filePath = assetUrlToFilePath(request.url);
    if (!filePath || !isSupportedImagePath(filePath)) {
      return new Response("Unsupported asset.", { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response("Asset not found.", { status: 404 });
    }
  });
}

async function readAppState() {
  const statePath = appStatePath();
  try {
    const text = await fsp.readFile(statePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw readableError(error);
  }
}

async function writeAppState(state) {
  appStateWriteQueue = appStateWriteQueue.catch(() => undefined).then(() => writeJsonAtomically(appStatePath(), state));
  return appStateWriteQueue;
}

function appStatePath() { return path.join(app.getPath("userData"), "app-state.json"); }

function editorSessions() {
  if (!editorSessionStoreInstance) editorSessionStoreInstance = createEditorSessionStore(path.join(app.getPath("userData"), "editor-sessions.json"));
  return editorSessionStoreInstance;
}

async function openFileDialog(owner) {
  const result = await dialog.showOpenDialog(owner ?? undefined, {
    properties: ["openFile"],
    filters: DOCUMENT_FILTERS
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return openFilePath(result.filePaths[0]);
}

async function openFilePath(filePath) {
  assertSupportedDocumentPath(filePath);
  return readDocumentFile(filePath);
}

async function saveFilePath(filePath, text, options = {}) {
  assertSupportedDocumentPath(filePath);
  return writeDocumentFile(filePath, text, options);
}

async function saveFileDialog(owner, suggestedName, text) {
  const result = await dialog.showSaveDialog(owner ?? undefined, {
    defaultPath: typeof suggestedName === "string" ? suggestedName : "diagram.mmd",
    filters: DOCUMENT_FILTERS
  });
  if (result.canceled || !result.filePath) return null;
  return saveFilePath(result.filePath, text, { overwrite: true });
}

async function pickImageAssetDialog(owner, documentPath) {
  const result = await dialog.showOpenDialog(owner ?? undefined, {
    properties: ["openFile"],
    filters: IMAGE_FILTERS
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return importImageAssetPath(documentPath, result.filePaths[0]);
}

function resolveImageAssetSrc(documentPath, src) {
  const assetPath = resolveImageAssetPath(documentPath, src);
  return assetPath ? filePathToAssetUrl(assetPath) : src;
}

function takePendingOpenFiles(webContentsId) {
  return windowFileRouter.take(webContentsId);
}

function queuePendingFileOpens(webContentsId, files) {
  windowFileRouter.enqueue(webContentsId, files);
}

async function openProjectFolderDialog(owner) {
  const result = await dialog.showOpenDialog(owner ?? undefined, {
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return scanProjectFolder(result.filePaths[0]);
}

async function scanProjectFolder(rootPath) {
  return scanProjectFolderSnapshot(rootPath);
}

function attachWindowCloseGuard(window) {
  window.on("close", (event) => {
    if (forceCloseWindowIds.has(window.id)) {
      forceCloseWindowIds.delete(window.id);
      clearPendingClose(window.id);
      return;
    }
    if (pendingCloseWindowIds.has(window.id)) {
      event.preventDefault();
      return;
    }
    if (window.webContents.isDestroyed()) return;
    event.preventDefault();
    pendingCloseWindowIds.add(window.id);
    const timer = setTimeout(() => {
      if (window.isDestroyed()) return;
      clearPendingClose(window.id);
      forceCloseWindowIds.add(window.id);
      window.close();
    }, CLOSE_REQUEST_TIMEOUT_MS);
    timer.unref?.();
    pendingCloseTimers.set(window.id, timer);
    window.webContents.send("mmm:window:close-request");
  });
}

function attachWindowCleanup(window) {
  const webContentsId = window.webContents.id;
  attachWindowFullscreenEvents(window);
  window.on("closed", () => {
    clearPendingClose(window.id);
    windowFileRouter.clear(webContentsId);
    claimedEditorSessionIds.delete(webContentsId);
    void projectFileWatcher.removeSubscriber(webContentsId);
    void piAgentManager.stop(webContentsId);
    if (mainWindows.delete(window) && mainWindow === window) {
      mainWindow = [...mainWindows].at(-1) || null;
    }
    for (const [key, record] of embeddedBrowsers) {
      if (record.ownerId === window.id) closeEmbeddedBrowserByKey(key);
    }
  });
}

function clearPendingClose(windowId) {
  pendingCloseWindowIds.delete(windowId); clearPendingCloseTimer(windowId);
}
function clearPendingCloseTimer(windowId) {
  const timer = pendingCloseTimers.get(windowId); if (!timer) return;
  clearTimeout(timer); pendingCloseTimers.delete(windowId);
}

function assertSupportedDocumentPath(filePath) {
  if (!isSupportedDocumentPath(filePath)) {
    throw fileWorkflowError("unsupported_type", "Only .mmd, .mermaid, .md, .markdown, or .canvas.json files are supported.", filePath);
  }
}

function isSupportedDocumentPath(filePath) {
  if (typeof filePath !== "string" || !filePath) return false;
  const lowerName = path.basename(filePath).toLowerCase();
  if (lowerName.endsWith(".canvas.json")) return true;
  const extension = path.extname(lowerName).replace(/^\./, "");
  return ["mmd", "mermaid", "md", "markdown"].includes(extension);
}

function collectDocumentFileArgs(args) {
  return args
    .filter((arg) => typeof arg === "string" && !arg.startsWith("-") && isSupportedDocumentPath(arg))
    .map((filePath) => path.resolve(filePath))
    .map((filePath) => ({
      name: path.basename(filePath),
      path: filePath
    }));
}

function mergeDocumentFiles(current, incoming) {
  const merged = [...current];
  for (const file of incoming) {
    if (!merged.some((item) => item.path === file.path)) merged.push(file);
  }
  return merged;
}

function fileWorkflowError(code, message, filePath) {
  const error = new Error(message);
  error.code = code;
  error.path = filePath;
  return error;
}

function readableError(error) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function createEmbeddedBrowser(sender, request) {
  const owner = BrowserWindow.fromWebContents(sender);
  if (!owner) return { status: "error", message: "No owning Electron window was found." };
  if (!owner.contentView?.addChildView) return { status: "unsupported", message: "Electron WebContentsView is unavailable in this runtime." };

  const label = typeof request?.label === "string" ? request.label : "";
  const url = normalizeEmbeddedBrowserUrl(request?.url);
  if (!label || !url) return { status: "error", message: "Invalid embedded browser request." };

  closeEmbeddedBrowser(sender, label);

  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      partition: "persist:mmm-browser-tool"
    }
  });

  view.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (normalizeHttpUrl(nextUrl)) shell.openExternal(nextUrl);
    return { action: "deny" };
  });
  const sendState = () => sendEmbeddedBrowserEvent(sender, "mmm:browser:state", embeddedBrowserState(label, view, url));
  const titlebarHotZone = createEmbeddedBrowserTitlebarHotZone({
    webContents: view.webContents,
    initialHeight: request.rect?.titlebarHotZoneHeight,
    send: (inside) => sendEmbeddedBrowserEvent(sender, "mmm:browser:titlebar-hot-zone", { label, inside })
  });
  view.webContents.on("did-start-loading", sendState);
  view.webContents.on("did-stop-loading", sendState);
  view.webContents.on("did-navigate", sendState);
  view.webContents.on("did-navigate-in-page", sendState);
  view.webContents.on("page-title-updated", sendState);
  view.webContents.on("focus", () => {
    try {
      owner.contentView.addChildView(view);
    } catch {
      // The owner may already be closing.
    }
    sendEmbeddedBrowserEvent(sender, "mmm:browser:focus", { label });
  });
  view.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return;
    sendEmbeddedBrowserEvent(sender, "mmm:browser:error", {
      label,
      message: errorDescription || `Failed to load ${validatedURL || url}`
    });
  });
  view.webContents.on("render-process-gone", (_event, details) => {
    sendEmbeddedBrowserEvent(sender, "mmm:browser:error", {
      label,
      message: details.reason || "Embedded browser renderer exited."
    });
  });

  owner.contentView.addChildView(view);
  view.setBounds(normalizeBounds(request.rect));
  view.setBorderRadius(normalizeBorderRadius(request.rect?.borderRadius));
  view.setVisible(false);

  const key = embeddedBrowserKey(sender, label);
  embeddedBrowsers.set(key, {
    label,
    owner,
    ownerId: owner.id,
    view,
    titlebarHotZone,
    visible: false
  });
  void view.webContents.loadURL(url).catch((error) => {
    sendEmbeddedBrowserEvent(sender, "mmm:browser:error", { label, message: readableError(error).message });
  });

  return { status: "created", label };
}

function embeddedBrowserState(label, view, fallbackUrl) {
  const contents = view.webContents;
  return {
    label,
    url: contents.getURL() || fallbackUrl,
    title: contents.getTitle() || "",
    loading: contents.isLoading()
  };
}

function sendEmbeddedBrowserEvent(sender, channel, payload) {
  if (sender.isDestroyed()) return;
  sender.send(channel, payload);
}

function embeddedBrowserKey(sender, label) {
  return `${sender.id}:${label}`;
}

function closeEmbeddedBrowser(sender, label) {
  closeEmbeddedBrowserByKey(embeddedBrowserKey(sender, label));
}

function closeEmbeddedBrowserByKey(key) {
  const record = embeddedBrowsers.get(key);
  if (!record) return;
  embeddedBrowsers.delete(key);
  record.titlebarHotZone.dispose();
  try {
    record.owner.contentView.removeChildView(record.view);
  } catch {
    // The owner may already be closing.
  }
  if (!record.view.webContents.isDestroyed()) {
    record.view.webContents.close({ waitForBeforeUnload: false });
  }
}

function setEmbeddedBrowserVisible(sender, label, visible) {
  const record = embeddedBrowsers.get(embeddedBrowserKey(sender, label));
  if (!record) return;
  record.visible = visible;
  if (!visible) record.titlebarHotZone.reset();
  record.view.setVisible(visible);
}

function focusEmbeddedBrowser(sender, label) {
  const record = embeddedBrowsers.get(embeddedBrowserKey(sender, label));
  if (!record) return;
  record.owner.contentView.addChildView(record.view);
  record.view.webContents.focus();
}

function navigateEmbeddedBrowser(sender, label, value) {
  const record = embeddedBrowsers.get(embeddedBrowserKey(sender, label));
  if (!record) return;
  const url = normalizeEmbeddedBrowserUrl(value);
  if (!url) throw new Error("Invalid embedded browser URL.");
  return record.view.webContents.loadURL(url);
}

function reloadEmbeddedBrowser(sender, label) {
  const record = embeddedBrowsers.get(embeddedBrowserKey(sender, label));
  if (!record) return;
  record.view.webContents.reload();
}

function setEmbeddedBrowserRect(sender, label, rect) {
  const record = embeddedBrowsers.get(embeddedBrowserKey(sender, label));
  if (!record) return;
  record.view.setBounds(normalizeBounds(rect));
  record.view.setBorderRadius(normalizeBorderRadius(rect?.borderRadius));
  record.titlebarHotZone.setHeight(rect?.titlebarHotZoneHeight);
}

function normalizeBorderRadius(value) {
  return Math.max(0, finiteNumber(value, 0));
}

function normalizeBounds(rect) {
  return {
    x: Math.max(0, finiteNumber(rect?.x, 0)),
    y: Math.max(0, finiteNumber(rect?.y, 0)),
    width: Math.max(1, finiteNumber(rect?.width, 1)),
    height: Math.max(1, finiteNumber(rect?.height, 1))
  };
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}
