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
const { createAiBridge } = require("./ai-bridge.cjs");
const { resolveLinkPreview } = require("./link-preview.cjs");
const { createProjectDocument } = require("./project-documents.cjs");
const { createTerminalManager } = require("./terminal.cjs");
const BROWSER_TOOL_WINDOW_KIND = "browser-tool";
const BROWSER_TOOL_WINDOW_PARAM = "mmmWindow";
const DEV_SERVER_URL = process.env.MMM_ELECTRON_DEV_SERVER_URL || "";
const PROJECT_DIR = path.resolve(__dirname, "..");
const DIST_INDEX = path.join(PROJECT_DIR, "dist", "index.html");
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");
const CLOSE_REQUEST_TIMEOUT_MS = 3000;
const PROJECT_FILE_LIMIT = 500;

const DOCUMENT_FILTERS = [
  {
    name: "Project Documents",
    extensions: ["mmd", "mermaid", "md", "markdown", "json"]
  }
];
const IMAGE_FILTERS = [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }];

const embeddedBrowsers = new Map();
const forceCloseWindowIds = new Set();
const pendingCloseWindowIds = new Set(), pendingCloseTimers = new Map();
const browserToolWindows = new Map();
const pendingOpenFiles = [];

const aiBridge = createAiBridge(app.getVersion());
const terminalManager = createTerminalManager({
  send(channel, payload) {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(`mmm:${channel}`, payload);
    }
  }
});
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let mainWindow = null;
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
  queuePendingFileOpens(collectDocumentFileArgs(process.argv.slice(1)), false);

  app.on("second-instance", (_event, argv) => {
    queuePendingFileOpens(collectDocumentFileArgs(argv.slice(1)), true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    queuePendingFileOpens(collectDocumentFileArgs([filePath]), true);
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    registerAssetProtocol();
    registerIpc();
    await aiBridge.start();
    mainWindow = createMainWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  terminalManager.closeAll();
  void aiBridge.close();
});

function createMainWindow() {
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

  attachWindowCloseGuard(window);
  attachWindowCleanup(window);
  loadAppUrl(window, appUrl());

  window.once("ready-to-show", () => window.show());
  return window;
}

function createBrowserToolWindow(owner, request) {
  const label = browserToolWindowLabel(request.url);
  const existing = browserToolWindows.get(label);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return { status: "opened", reused: true };
  }

  const window = new BrowserWindow({
    title: `MMM Browser - ${browserToolWindowTitle(request.url, request.title)}`,
    width: 1040,
    height: 720,
    minWidth: 640,
    minHeight: 420,
    show: false,
    frame: false,
    parent: owner ?? mainWindow ?? undefined,
    modal: false,
    skipTaskbar: true,
    backgroundColor: "#ffffff",
    webPreferences: secureWebPreferences()
  });

  browserToolWindows.set(label, window);
  attachWindowCleanup(window);
  window.on("closed", () => browserToolWindows.delete(label));
  loadAppUrl(window, browserToolShellUrl(request, appUrl()));
  window.once("ready-to-show", () => window.show());
  return { status: "opened" };
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
  ipcMain.handle("mmm:app-state:write", (_event, state) => writeAppState(state));
  ipcMain.handle("mmm:file:open", (event) => openFileDialog(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("mmm:file:open-path", (_event, filePath) => openFilePath(filePath));
  ipcMain.handle("mmm:file:save", (_event, request) => saveFilePath(request?.path, request?.text));
  ipcMain.handle("mmm:file:save-as", (event, request) => saveFileDialog(BrowserWindow.fromWebContents(event.sender), request?.suggestedName, request?.text));
  ipcMain.handle("mmm:project:create-document", (_event, request) => createProjectDocument(request));
  ipcMain.handle("mmm:image:pick", (event, documentPath) => pickImageAssetDialog(BrowserWindow.fromWebContents(event.sender), documentPath));
  ipcMain.handle("mmm:image:import-path", (_event, request) => importImageAssetPath(request?.documentPath, request?.imagePath));
  ipcMain.handle("mmm:image:import-bytes", (_event, request) => importImageAssetBytes(request?.documentPath, request?.fileName, request?.bytes));
  ipcMain.handle("mmm:image:resolve-src", (_event, request) => resolveImageAssetSrc(request?.documentPath, request?.src));
  ipcMain.handle("mmm:link-preview:resolve", (_event, request) => resolveLinkPreview(request));
  ipcMain.handle("mmm:pending-files:take", takePendingOpenFiles);
  ipcMain.handle("mmm:ai:publish-context", (_event, context) => aiBridge.publishContext(context));
  ipcMain.handle("mmm:ai:take-next-command", () => ({
    ok: true,
    command: aiBridge.takeNextCommand(),
    diagnostics: []
  }));
  ipcMain.handle("mmm:ai:finish-command", (_event, result) => aiBridge.finishCommand(result));
  ipcMain.handle("mmm:terminal:list-shells", () => terminalManager.listShells());
  ipcMain.handle("mmm:terminal:open", (_event, request) => terminalManager.open(request));
  ipcMain.handle("mmm:terminal:write", (_event, request) => terminalManager.write(request?.sessionId, request?.data));
  ipcMain.handle("mmm:terminal:resize", (_event, request) => terminalManager.resize(request?.sessionId, request?.cols, request?.rows));
  ipcMain.handle("mmm:terminal:close", (_event, sessionId) => terminalManager.close(sessionId));
  ipcMain.handle("mmm:project:open-folder", (event) => openProjectFolderDialog(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("mmm:project:read-folder", (_event, rootPath) => scanProjectFolder(rootPath));
  ipcMain.handle("mmm:browser:create", (event, request) => createEmbeddedBrowser(event.sender, request));
  ipcMain.handle("mmm:browser:close", (_event, label) => closeEmbeddedBrowser(label));
  ipcMain.handle("mmm:browser:hide", (_event, label) => setEmbeddedBrowserVisible(label, false));
  ipcMain.handle("mmm:browser:show", (_event, label) => setEmbeddedBrowserVisible(label, true));
  ipcMain.handle("mmm:browser:focus", (_event, label) => focusEmbeddedBrowser(label));
  ipcMain.handle("mmm:browser:set-rect", (_event, label, rect) => setEmbeddedBrowserRect(label, rect));
  ipcMain.handle("mmm:browser-tool:open", (event, request) => createBrowserToolWindow(BrowserWindow.fromWebContents(event.sender), request));
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
  const statePath = appStatePath();
  await fsp.mkdir(path.dirname(statePath), { recursive: true });
  await fsp.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

function appStatePath() {
  return path.join(app.getPath("userData"), "app-state.json");
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
  const text = await fsp.readFile(filePath, "utf8");
  return {
    name: path.basename(filePath),
    path: filePath,
    text
  };
}

async function saveFilePath(filePath, text) {
  assertSupportedDocumentPath(filePath);
  await fsp.writeFile(filePath, typeof text === "string" ? text : "", "utf8");
  return {
    name: path.basename(filePath),
    path: filePath
  };
}

async function saveFileDialog(owner, suggestedName, text) {
  const result = await dialog.showSaveDialog(owner ?? undefined, {
    defaultPath: typeof suggestedName === "string" ? suggestedName : "diagram.mmd",
    filters: DOCUMENT_FILTERS
  });
  if (result.canceled || !result.filePath) return null;
  return saveFilePath(result.filePath, text);
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

function takePendingOpenFiles() {
  return pendingOpenFiles.splice(0, pendingOpenFiles.length);
}

function queuePendingFileOpens(files, emit) {
  for (const file of files) {
    if (!pendingOpenFiles.some((item) => item.path === file.path)) pendingOpenFiles.push(file);
  }
  if (emit && files.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("mmm:file:external-open", files);
  }
}

async function openProjectFolderDialog(owner) {
  const result = await dialog.showOpenDialog(owner ?? undefined, {
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return scanProjectFolder(result.filePaths[0]);
}

async function scanProjectFolder(rootPath) {
  const root = await fsp.realpath(rootPath);
  const files = [];
  const state = { truncated: false };
  await collectProjectFiles(root, root, files, state);
  files.sort((left, right) => left.relativePath.toLowerCase().localeCompare(right.relativePath.toLowerCase()));
  return {
    rootName: path.basename(root) || root,
    rootPath: root,
    files,
    scannedAt: Date.now(),
    truncated: state.truncated
  };
}

async function collectProjectFiles(root, directory, files, state) {
  if (files.length >= PROJECT_FILE_LIMIT) {
    state.truncated = true;
    return;
  }

  let entries = [];
  try {
    entries = await fsp.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (directory === root) throw readableError(error);
    return;
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (files.length >= PROJECT_FILE_LIMIT) {
      state.truncated = true;
      return;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipProjectDirectory(entry.name)) await collectProjectFiles(root, fullPath, files, state);
      continue;
    }
    if (!entry.isFile() || !isSupportedDocumentPath(fullPath)) continue;

    let modifiedAt;
    try {
      modifiedAt = (await fsp.stat(fullPath)).mtimeMs;
    } catch {
      modifiedAt = undefined;
    }
    files.push({
      name: path.basename(fullPath),
      path: fullPath,
      relativePath: path.relative(root, fullPath).split(path.sep).join("/"),
      modifiedAt
    });
  }
}

function shouldSkipProjectDirectory(name) {
  return new Set([".git", ".hg", ".svn", "node_modules", "dist", "build", ".vite", ".next", "target", "dist-electron"]).has(name.toLowerCase());
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
  window.on("closed", () => {
    clearPendingClose(window.id);
    for (const [label, record] of embeddedBrowsers) {
      if (record.ownerId === window.id) closeEmbeddedBrowser(label);
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
  const url = normalizeHttpUrl(request?.url);
  if (!label || !url) return { status: "error", message: "Invalid embedded browser request." };

  closeEmbeddedBrowser(label);

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
  view.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return;
    sender.send("mmm:browser:error", {
      label,
      message: errorDescription || `Failed to load ${validatedURL || url}`
    });
  });
  view.webContents.on("render-process-gone", (_event, details) => {
    sender.send("mmm:browser:error", {
      label,
      message: details.reason || "Embedded browser renderer exited."
    });
  });

  owner.contentView.addChildView(view);
  view.setBounds(normalizeBounds(request.rect));
  view.webContents.loadURL(url);

  embeddedBrowsers.set(label, {
    label,
    owner,
    ownerId: owner.id,
    view,
    visible: true
  });

  return { status: "created", label };
}

function closeEmbeddedBrowser(label) {
  const record = embeddedBrowsers.get(label);
  if (!record) return;
  embeddedBrowsers.delete(label);
  try {
    record.owner.contentView.removeChildView(record.view);
  } catch {
    // The owner may already be closing.
  }
  if (!record.view.webContents.isDestroyed()) {
    record.view.webContents.close({ waitForBeforeUnload: false });
  }
}

function setEmbeddedBrowserVisible(label, visible) {
  const record = embeddedBrowsers.get(label);
  if (!record) return;
  record.visible = visible;
  record.view.setVisible(visible);
}

function focusEmbeddedBrowser(label) {
  const record = embeddedBrowsers.get(label);
  if (!record) return;
  record.view.webContents.focus();
}

function setEmbeddedBrowserRect(label, rect) {
  const record = embeddedBrowsers.get(label);
  if (!record) return;
  record.view.setBounds(normalizeBounds(rect));
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

function normalizeHttpUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function browserToolWindowTitle(url, fallback) {
  const normalizedFallback = typeof fallback === "string" ? fallback.trim() : "";
  if (normalizedFallback) return normalizedFallback;
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function browserToolWindowLabel(url) {
  return `browser-tool-${hashText(url)}`;
}

function browserToolShellUrl(request, baseHref) {
  const url = new URL(baseHref);
  url.search = "";
  url.hash = "";
  url.searchParams.set(BROWSER_TOOL_WINDOW_PARAM, BROWSER_TOOL_WINDOW_KIND);
  url.searchParams.set("url", request.url);
  if (request.title) url.searchParams.set("title", request.title);
  if (request.sourceNodeId) url.searchParams.set("sourceNodeId", request.sourceNodeId);
  if (request.sourceLabel) url.searchParams.set("sourceLabel", request.sourceLabel);
  return url.toString();
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
