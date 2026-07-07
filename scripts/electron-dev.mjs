#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEV_SERVER_URL = process.env.MMM_ELECTRON_DEV_SERVER_URL || "http://127.0.0.1:5173";

let viteProcess = null;
let electronProcess = null;
let shuttingDown = false;

main().catch((error) => {
  console.error(`[electron:dev] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});

async function main() {
  rebuildNativeModulesForElectron();

  console.log("[electron:dev] Starting Vite dev server.");
  viteProcess = spawn(npmCommand(), ["run", "dev"], {
    cwd: PROJECT_DIR,
    env: process.env,
    stdio: "inherit",
    shell: false
  });

  viteProcess.on("exit", (code) => {
    if (!shuttingDown && code !== 0) shutdown(code ?? 1);
  });

  await waitForServer(DEV_SERVER_URL);

  console.log("[electron:dev] Starting Electron.");
  electronProcess = spawn(electronBin(), [PROJECT_DIR], {
    cwd: PROJECT_DIR,
    env: {
      ...process.env,
      MMM_ELECTRON_DEV_SERVER_URL: DEV_SERVER_URL
    },
    stdio: "inherit",
    shell: false
  });

  electronProcess.on("exit", (code) => shutdown(code ?? 0));

  process.on("SIGINT", () => shutdown(130));
  process.on("SIGTERM", () => shutdown(143));
}

function rebuildNativeModulesForElectron() {
  if (process.env.MMM_ELECTRON_SKIP_REBUILD === "1") {
    console.log("[electron:dev] Skipping Electron native module rebuild.");
    return;
  }
  run(electronRebuildBin(), ["-f", "-w", "node-pty"]);
}

function run(command, args) {
  console.log(`[electron:dev] $ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: PROJECT_DIR,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed with exit code ${result.status}: ${command} ${args.join(" ")}`);
}

async function waitForServer(url) {
  const startedAt = Date.now();
  const timeoutMs = 30000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok || response.status === 404) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Vite did not respond within ${timeoutMs}ms: ${url}`);
}

function electronBin() {
  const command = process.platform === "win32" ? "electron.cmd" : "electron";
  const local = path.join(PROJECT_DIR, "node_modules", ".bin", command);
  return existsSync(local) ? local : command;
}

function electronRebuildBin() {
  const command = process.platform === "win32" ? "electron-rebuild.cmd" : "electron-rebuild";
  const local = path.join(PROJECT_DIR, "node_modules", ".bin", command);
  return existsSync(local) ? local : command;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electronProcess && !electronProcess.killed) electronProcess.kill();
  if (viteProcess && !viteProcess.killed) viteProcess.kill();
  process.exit(code);
}
