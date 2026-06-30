#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const STAGING_NAME = "mermaid-canvas-editor-win-ship";
const APP_NAME = "Mermaid Canvas Editor";
const BIN_NAME = "mermaid-canvas-editor";

const args = new Set(process.argv.slice(2));
const launchOnly = isEnabled("MMM_WINDOWS_RUN_LAUNCH_ONLY") || args.has("--launch-only");
const installOnly = isEnabled("MMM_WINDOWS_RUN_INSTALL_ONLY") || args.has("--install-only");
const fullChecks = isEnabled("MMM_WINDOWS_RUN_FULL_CHECKS");

main();

function main() {
  log("Starting Windows desktop run flow.");

  const powershell = findPowerShell();

  if (launchOnly) {
    log("Launch-only mode enabled.");
    launchInstalledWindowsApp(powershell);
    return;
  }

  if (process.platform === "win32") {
    runWindowsDesktopFlow(powershell, PROJECT_DIR);
    launchAfterInstall(powershell);
    return;
  }

  if (!isWsl()) {
    fail("This command is intended for Windows or WSL. Use npm run desktop:ship on this platform instead.");
  }

  const tempWindowsPath = powershellOutput(powershell, "[System.IO.Path]::GetTempPath().TrimEnd('\\')");
  const stagingWindowsPath = `${tempWindowsPath}\\${STAGING_NAME}`;
  const stagingWslPath = windowsPathToWsl(stagingWindowsPath);

  log(`Syncing workspace to Windows staging: ${stagingWindowsPath}`);
  syncProject(PROJECT_DIR, stagingWslPath);
  runWindowsDesktopFlow(powershell, stagingWindowsPath);
  launchAfterInstall(powershell);
}

function isEnabled(name) {
  const value = process.env[name];
  return value === "1" || value === "true" || value === "yes";
}

function log(message) {
  console.log(`[windows:run] ${message}`);
}

function warn(message) {
  console.warn(`[windows:run] ${message}`);
}

function fail(message) {
  console.error(`[windows:run] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  log(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT_DIR,
    env: process.env,
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(`Command failed with exit code ${result.status}: ${command} ${args.join(" ")}`);
  }
}

function commandOk(command, args) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_DIR,
    env: process.env,
    stdio: "ignore",
    shell: false
  });
  return !result.error && result.status === 0;
}

function findPowerShell() {
  const candidates = process.platform === "win32"
    ? ["powershell.exe"]
    : [
        "powershell.exe",
        "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
        "/mnt/c/Windows/SysWOW64/WindowsPowerShell/v1.0/powershell.exe"
      ];

  for (const candidate of candidates) {
    if (commandOk(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"])) {
      return candidate;
    }
  }

  fail("Windows PowerShell was not found. Run this from Windows, WSL, or install PowerShell in PATH.");
}

function powershellOutput(powershell, command) {
  const result = spawnSync(powershell, ["-NoProfile", "-Command", command], {
    cwd: PROJECT_DIR,
    env: process.env,
    encoding: "utf8",
    shell: false
  });

  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(result.stderr.trim() || `PowerShell command failed: ${command}`);
  return result.stdout.trim();
}

function isWsl() {
  if (process.platform !== "linux") return false;
  const release = os.release().toLowerCase();
  const procVersion = safeRead("/proc/version").toLowerCase();
  return release.includes("microsoft") || procVersion.includes("microsoft");
}

function safeRead(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function windowsPathToWsl(windowsPath) {
  const converted = spawnSync("wslpath", ["-u", windowsPath], {
    cwd: PROJECT_DIR,
    encoding: "utf8",
    shell: false
  });
  if (!converted.error && converted.status === 0) {
    return converted.stdout.trim();
  }

  const match = /^([a-zA-Z]):\\?(.*)$/.exec(windowsPath);
  if (!match) fail(`Could not convert Windows path to WSL path: ${windowsPath}`);
  const drive = match[1].toLowerCase();
  const rest = match[2].replaceAll("\\", "/").replace(/^\/+/, "");
  return `/mnt/${drive}/${rest}`;
}

function syncProject(sourceDir, destinationDir) {
  mkdirSync(destinationDir, { recursive: true });

  if (commandOk("rsync", ["--version"])) {
    run("rsync", [
      "-a",
      "--delete",
      "--exclude", ".git/",
      "--exclude", "node_modules/",
      "--exclude", "dist/",
      "--exclude", "src-tauri/target/",
      "--exclude", ".next/",
      "--exclude", ".vite/",
      "--exclude", "*.log",
      "--exclude", "*:Zone.Identifier",
      `${sourceDir}/`,
      `${destinationDir}/`
    ]);
    return;
  }

  warn("rsync was not found; using the slower Node.js sync fallback.");
  syncDirectory(sourceDir, destinationDir, "");
}

function syncDirectory(sourceDir, destinationDir, relativeDir) {
  mkdirSync(destinationDir, { recursive: true });

  const sourceNames = new Set();
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (shouldSkip(relativePath, entry.name)) continue;

    sourceNames.add(entry.name);
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      syncDirectory(sourcePath, destinationPath, relativePath);
      continue;
    }

    if (!entry.isFile()) continue;
    copyIfChanged(sourcePath, destinationPath);
  }

  for (const entry of readdirSync(destinationDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (shouldSkip(relativePath, entry.name) || sourceNames.has(entry.name)) continue;
    rmSync(path.join(destinationDir, entry.name), { recursive: true, force: true });
  }
}

function shouldSkip(relativePath, name) {
  if (name.includes(":")) return true;
  return relativePath === ".git"
    || relativePath === "node_modules"
    || relativePath === "dist"
    || relativePath === ".next"
    || relativePath === ".vite"
    || relativePath === "src-tauri/target"
    || relativePath.startsWith("src-tauri/target/");
}

function copyIfChanged(sourcePath, destinationPath) {
  const sourceStat = statSync(sourcePath);
  let destinationStat = null;
  try {
    destinationStat = statSync(destinationPath);
  } catch {
    // Destination does not exist.
  }

  if (destinationStat && destinationStat.size === sourceStat.size && Math.trunc(destinationStat.mtimeMs) === Math.trunc(sourceStat.mtimeMs)) {
    return;
  }

  mkdirSync(path.dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
  utimesSync(destinationPath, sourceStat.atime, sourceStat.mtime);
}

function runWindowsDesktopFlow(powershell, projectWindowsPath) {
  const checksLine = fullChecks
    ? "$env:MMM_SHIP_SKIP_CHECKS = $null"
    : "$env:MMM_SHIP_SKIP_CHECKS = '1'";
  if (!fullChecks) {
    log("Skipping tests/typecheck in Windows packaging. Set MMM_WINDOWS_RUN_FULL_CHECKS=1 to include them.");
  }

  run(powershell, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8",
      `Set-Location -LiteralPath ${psQuote(projectWindowsPath)}`,
      "if (!(Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found in the Windows PATH.' }",
      "npm install",
      checksLine,
      "$env:MMM_SHIP_NO_LAUNCH = '1'",
      "npm run desktop:ship"
    ].join("; ")
  ]);
}

function launchAfterInstall(powershell) {
  if (installOnly) {
    log("Install-only mode enabled. Launch skipped.");
    return;
  }

  launchInstalledWindowsApp(powershell);
}

function launchInstalledWindowsApp(powershell) {
  run(powershell, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8",
      "$candidates = @()",
      `$candidates += (Join-Path $env:LOCALAPPDATA ${psQuote(`${APP_NAME}\\${BIN_NAME}.exe`)})`,
      `$candidates += (Join-Path $env:LOCALAPPDATA ${psQuote(`Programs\\${APP_NAME}\\${BIN_NAME}.exe`)})`,
      `$candidates += (Join-Path $env:LOCALAPPDATA ${psQuote(`Programs\\${APP_NAME}\\${APP_NAME}.exe`)})`,
      `$candidates += (Join-Path $env:TEMP ${psQuote(`${STAGING_NAME}\\src-tauri\\target\\release\\${BIN_NAME}.exe`)})`,
      `$candidates += (Join-Path $env:ProgramFiles ${psQuote(`${APP_NAME}\\${BIN_NAME}.exe`)})`,
      "$target = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1",
      "if (!$target) { throw 'Installed Mermaid Canvas Editor was not found. Run npm run windows:run without MMM_WINDOWS_RUN_LAUNCH_ONLY first.' }",
      "Write-Host \"Launching $target\"",
      "Start-Process -FilePath $target"
    ].join("; ")
  ]);
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
