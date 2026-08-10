const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function registerPiAgentIpc({ ipcMain, manager }) {
  ipcMain.handle("mmm:agent:start", (event, request) => manager.start(event.sender, request));
  ipcMain.handle("mmm:agent:list-sessions", (event, request) => manager.listSessions(event.sender.id, request));
  ipcMain.handle("mmm:agent:list-instances", (event) => manager.listInstances(event.sender.id));
  ipcMain.handle("mmm:agent:set-foreground", (event, request) => manager.setForeground(event.sender.id, request?.agentInstanceId, request?.foreground));
  ipcMain.handle("mmm:agent:delete-session", (event, request) => manager.deleteSession(event.sender.id, request));
  ipcMain.handle("mmm:agent:rpc", (event, command) => manager.rpc(event.sender, command));
  ipcMain.handle("mmm:agent:control", (event, command) => manager.control(event.sender, command));
  ipcMain.handle("mmm:agent:extension-ui-response", (event, response) => manager.extensionUiResponse(event.sender, response));
  ipcMain.handle("mmm:agent:host-response", (event, response) => manager.respondHost(event.sender, response));
  ipcMain.handle("mmm:agent:stop", (event, request) => manager.stop(event.sender.id, request?.agentInstanceId));
}

async function cleanupLegacyAiBridgeDiscovery() {
  const discoveryPath = path.join(os.homedir(), ".mermaid-canvas-editor", "bridge.json");
  try {
    await fsp.unlink(discoveryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn(`Could not remove legacy AI bridge discovery file: ${error.message}`);
  }
}

module.exports = { cleanupLegacyAiBridgeDiscovery, registerPiAgentIpc };
