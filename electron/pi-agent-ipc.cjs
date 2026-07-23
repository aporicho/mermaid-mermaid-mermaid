const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function registerPiAgentIpc({ ipcMain, manager }) {
  ipcMain.handle("mmm:agent:start", (event, request) => manager.start(event.sender, request));
  ipcMain.handle("mmm:agent:rpc", (event, command) => manager.rpc(event.sender, command));
  ipcMain.handle("mmm:agent:control", (event, command) => manager.control(event.sender, command));
  ipcMain.handle("mmm:agent:extension-ui-response", (event, response) => manager.extensionUiResponse(event.sender, response));
  ipcMain.handle("mmm:agent:host-response", (event, response) => manager.respondHost(event.sender, response));
  ipcMain.handle("mmm:agent:stop", (event) => manager.stop(event.sender.id));
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
