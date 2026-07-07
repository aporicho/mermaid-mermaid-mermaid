#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const TARGET_DIR = path.join(PROJECT_DIR, "src-tauri", "target", "release");
const BUNDLE_DIR = path.join(TARGET_DIR, "bundle");
const APP_NAME = "Mermaid Canvas Editor";
const BIN_NAME = "mermaid-canvas-editor";
const WINDOWS_FILE_ASSOCIATION_EXTENSIONS = [".mmd", ".mermaid"];

const skipChecks = isEnabled("MMM_SHIP_SKIP_CHECKS");
const packageOnly = isEnabled("MMM_SHIP_PACKAGE_ONLY");
const noInstall = isEnabled("MMM_SHIP_NO_INSTALL") || packageOnly;
const noLaunch = isEnabled("MMM_SHIP_NO_LAUNCH") || packageOnly;

main();

function main() {
  log("Starting desktop package/install/launch flow.");
  warnIfWsl();
  preflightSystemDependencies();

  if (!skipChecks) {
    runNpm(["test"]);
    runNpm(["run", "typecheck"]);
  } else {
    log("Skipping tests and typecheck because MMM_SHIP_SKIP_CHECKS=1.");
  }

  runNpm(["run", "tauri:build"]);

  const artifacts = collectArtifacts();
  if (artifacts.length === 0) {
    fail(`No desktop artifacts were found under ${BUNDLE_DIR}.`);
  }

  log("Built artifacts:");
  for (const artifact of artifacts) {
    log(`  ${path.relative(PROJECT_DIR, artifact.path)}`);
  }

  if (packageOnly) {
    log("Package-only mode finished.");
    return;
  }

  const launchTarget = installOrSelectLaunchTarget();
  if (noLaunch) {
    log(`Launch skipped. Ready target: ${launchTarget}`);
    return;
  }

  launch(launchTarget);
}

function isEnabled(name) {
  const value = process.env[name];
  return value === "1" || value === "true" || value === "yes";
}

function log(message) {
  console.log(`[tauri:ship] ${message}`);
}

function warn(message) {
  console.warn(`[tauri:ship] ${message}`);
}

function fail(message) {
  console.error(`[tauri:ship] ${message}`);
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

function runNpm(args) {
  if (process.platform === "win32" && process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args]);
    return;
  }

  run("npm", args);
}

function commandStatus(command, args) {
  return spawnSync(command, args, {
    cwd: PROJECT_DIR,
    env: process.env,
    stdio: "ignore",
    shell: false
  }).status;
}

function hasCommand(command) {
  return commandStatus("bash", ["-lc", `command -v ${command}`]) === 0;
}

function preflightSystemDependencies() {
  if (process.platform !== "linux") {
    return;
  }

  configureLinuxPkgConfig();

  const missing = [];
  const pkgConfig = process.env.PKG_CONFIG ?? "pkg-config";
  if (!existsSync(pkgConfig) && !hasCommand(pkgConfig)) {
    missing.push("pkg-config");
  }

  const pkgConfigChecks = [
    ["wayland-client", "libwayland-dev"],
    ["webkit2gtk-4.1", "libwebkit2gtk-4.1-dev"],
    ["ayatana-appindicator3-0.1", "libayatana-appindicator3-dev"],
    ["librsvg-2.0", "librsvg2-dev"],
    ["openssl", "libssl-dev"]
  ];

  if (existsSync(pkgConfig) || hasCommand(pkgConfig)) {
    for (const [moduleName, packageName] of pkgConfigChecks) {
      if (commandStatus(pkgConfig, ["--exists", moduleName]) !== 0) {
        missing.push(packageName);
      }
    }
  } else {
    for (const [, packageName] of pkgConfigChecks) {
      missing.push(packageName);
    }
  }

  if (!existsSync("/usr/include/xdo.h")) {
    missing.push("libxdo-dev");
  }

  if (missing.length === 0) {
    return;
  }

  const packages = [
    "build-essential",
    "curl",
    "wget",
    "file",
    ...new Set(missing)
  ].join(" ");

  fail([
    "Missing Linux desktop build dependencies.",
    `Using pkg-config: ${pkgConfig}`,
    "Install them once, then rerun npm run tauri:ship:",
    `  sudo apt update`,
    `  sudo apt install -y ${packages}`
  ].join("\n"));
}

function configureLinuxPkgConfig() {
  if (existsSync("/usr/bin/pkg-config")) {
    process.env.PKG_CONFIG = "/usr/bin/pkg-config";
  }

  const systemPaths = [
    "/usr/lib/x86_64-linux-gnu/pkgconfig",
    "/usr/lib/pkgconfig",
    "/usr/share/pkgconfig"
  ];
  const currentPaths = (process.env.PKG_CONFIG_PATH ?? "")
    .split(":")
    .filter(Boolean);
  process.env.PKG_CONFIG_PATH = [...systemPaths, ...currentPaths].join(":");
}

function warnIfWsl() {
  if (process.platform !== "linux") {
    return;
  }

  const release = os.release().toLowerCase();
  const procVersion = safeRead("/proc/version").toLowerCase();
  if (!release.includes("microsoft") && !procVersion.includes("microsoft")) {
    return;
  }

  warn("Running inside WSL. Tauri fallback will build and install a Linux artifact, not a Windows installer.");
  warn("Use npm run windows:run if you need the Windows Electron installer from WSL.");
}

function safeRead(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function collectArtifacts() {
  return walk(BUNDLE_DIR)
    .filter((entry) => isDesktopArtifact(entry.path))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function walk(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const entries = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const names = readdirSync(current, { withFileTypes: true });

    for (const name of names) {
      const fullPath = path.join(current, name.name);
      const stat = statSync(fullPath);
      if (name.isDirectory()) {
        if (name.name.endsWith(".app")) {
          entries.push({ path: fullPath, mtimeMs: stat.mtimeMs });
        } else {
          stack.push(fullPath);
        }
        continue;
      }
      entries.push({ path: fullPath, mtimeMs: stat.mtimeMs });
    }
  }

  return entries;
}

function isDesktopArtifact(filePath) {
  if (filePath.endsWith(".app")) {
    return true;
  }

  const extension = path.extname(filePath).toLowerCase();
  return extension === ".exe"
    || extension === ".msi"
    || extension === ".dmg"
    || extension === ".deb"
    || extension === ".rpm"
    || filePath.endsWith(".AppImage");
}

function installOrSelectLaunchTarget() {
  if (noInstall) {
    const target = bestRunnableArtifact();
    if (!target) {
      fail("No runnable artifact was found for launch.");
    }
    return target;
  }

  if (process.platform === "darwin") {
    return installMacApp();
  }

  if (process.platform === "win32") {
    return installWindowsApp();
  }

  if (process.platform === "linux") {
    return installLinuxApp();
  }

  const target = bestRunnableArtifact();
  if (!target) {
    fail(`Unsupported platform for install: ${process.platform}.`);
  }
  return target;
}

function latestArtifact(predicate) {
  return collectArtifacts().find((entry) => predicate(entry.path))?.path;
}

function bestRunnableArtifact() {
  if (process.platform === "darwin") {
    return latestArtifact((entry) => entry.endsWith(".app")) ?? releaseBinary();
  }
  if (process.platform === "win32") {
    return releaseBinary() ?? latestArtifact((entry) => entry.endsWith(".exe"));
  }
  if (process.platform === "linux") {
    return latestArtifact((entry) => entry.endsWith(".AppImage")) ?? releaseBinary();
  }
  return releaseBinary();
}

function releaseBinary() {
  const executable = process.platform === "win32" ? `${BIN_NAME}.exe` : BIN_NAME;
  const fullPath = path.join(TARGET_DIR, executable);
  return existsSync(fullPath) ? fullPath : null;
}

function installMacApp() {
  const appBundle = latestArtifact((entry) => entry.endsWith(".app"));
  if (!appBundle) {
    fail("No macOS .app bundle was found.");
  }

  const installDir = process.env.MMM_SHIP_MAC_INSTALL_DIR
    ? path.resolve(process.env.MMM_SHIP_MAC_INSTALL_DIR)
    : path.join(os.homedir(), "Applications");
  const destination = path.join(installDir, path.basename(appBundle));

  mkdirSync(installDir, { recursive: true });
  rmSync(destination, { recursive: true, force: true });
  cpSync(appBundle, destination, { recursive: true });
  log(`Installed macOS app to ${destination}.`);
  return destination;
}

function installWindowsApp() {
  const installer = latestArtifact((entry) => {
    const normalized = entry.replaceAll(path.sep, "/").toLowerCase();
    return normalized.includes("/nsis/") && normalized.endsWith(".exe");
  }) ?? latestArtifact((entry) => entry.toLowerCase().endsWith(".exe"));

  if (!installer) {
    const fallback = releaseBinary();
    if (!fallback) {
      fail("No Windows installer or release executable was found.");
    }
    warn("No Windows installer was found; launching the release executable instead.");
    return fallback;
  }

  if (process.env.MMM_SHIP_WINDOWS_INSTALL_MODE === "interactive") {
    log(`Opening installer: ${installer}`);
    launchWithCommand("cmd.exe", ["/c", "start", "", installer]);
  } else {
    log(`Installing silently with NSIS: ${installer}`);
    run(installer, ["/S"], { cwd: path.dirname(installer) });
  }

  const launchTarget = findInstalledWindowsApp() ?? releaseBinary() ?? installer;
  refreshWindowsAppIcons(launchTarget);
  return launchTarget;
}

function findInstalledWindowsApp() {
  const exeNames = [`${APP_NAME}.exe`, `${BIN_NAME}.exe`];
  const installRoots = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, APP_NAME),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", APP_NAME),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, APP_NAME),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], APP_NAME)
  ].filter(Boolean);

  for (const root of installRoots) {
    for (const exeName of exeNames) {
      const candidate = path.join(root, exeName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function refreshWindowsAppIcons(launchTarget) {
  if (process.platform !== "win32" || !launchTarget.toLowerCase().endsWith(".exe")) {
    return;
  }

  const sourceIcon = path.join(PROJECT_DIR, "src-tauri", "icons", "icon.ico");
  if (!existsSync(sourceIcon)) {
    warn(`Windows icon refresh skipped because ${sourceIcon} was not found.`);
    return;
  }

  const iconHash = createHash("sha256").update(readFileSync(sourceIcon)).digest("hex").slice(0, 10);
  const installedIcon = path.join(path.dirname(launchTarget), `app-icon-${iconHash}.ico`);
  copyFileSync(sourceIcon, installedIcon);

  const shortcutRoots = [
    path.join(os.homedir(), "Desktop"),
    process.env.OneDrive && path.join(process.env.OneDrive, "Desktop"),
    process.env.APPDATA && path.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs"),
    process.env.ProgramData && path.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")
  ].filter(Boolean);
  const shellNotifySignature = [
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class ShellIconRefresh {",
    "  [DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);",
    "}"
  ].join(" ");

  run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    [
      "$ErrorActionPreference = 'Stop'",
      "[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8",
      `$iconLocation = ${psQuote(`${installedIcon},0`)}`,
      `$fileExtensions = @(${WINDOWS_FILE_ASSOCIATION_EXTENSIONS.map(psQuote).join(", ")})`,
      `$shortcutRoots = @(${shortcutRoots.map(psQuote).join(", ")})`,
      "$shell = New-Object -ComObject WScript.Shell",
      "$shortcuts = foreach ($root in $shortcutRoots) { if (Test-Path -LiteralPath $root) { Get-ChildItem -LiteralPath $root -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue } }",
      `$shortcuts | Where-Object { $_.BaseName -like ${psQuote(`${APP_NAME}*`)} -or $_.BaseName -like ${psQuote(`${BIN_NAME}*`)} } | ForEach-Object { $shortcut = $shell.CreateShortcut($_.FullName); $shortcut.IconLocation = $iconLocation; $shortcut.Save() }`,
      "$classesRoot = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Software\\Classes')",
      "$updatedProgIds = @{}",
      "foreach ($extension in $fileExtensions) { $extensionKey = $classesRoot.OpenSubKey($extension); if (!$extensionKey) { continue }; $progId = [string]$extensionKey.GetValue(''); $extensionKey.Close(); if ([string]::IsNullOrWhiteSpace($progId) -or $updatedProgIds.ContainsKey($progId)) { continue }; $updatedProgIds[$progId] = $true; $iconKey = $classesRoot.CreateSubKey($progId + '\\DefaultIcon'); $iconKey.SetValue('', $iconLocation, [Microsoft.Win32.RegistryValueKind]::String); $iconKey.Close() }",
      "$classesRoot.Close()",
      "if (Get-Command ie4uinit.exe -ErrorAction SilentlyContinue) { & ie4uinit.exe -show }",
      `$signature = ${psQuote(shellNotifySignature)}`,
      "Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue",
      "[ShellIconRefresh]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)"
    ].join("; ")
  ]);

  log(`Refreshed Windows shortcuts and file association icons with: ${installedIcon}`);
}

function installLinuxApp() {
  const source = latestArtifact((entry) => entry.endsWith(".AppImage")) ?? releaseBinary();
  if (!source) {
    fail("No Linux AppImage or release executable was found.");
  }

  const installDir = process.env.MMM_SHIP_LINUX_INSTALL_DIR
    ? path.resolve(process.env.MMM_SHIP_LINUX_INSTALL_DIR)
    : path.join(os.homedir(), ".local", "bin");
  const destination = path.join(
    installDir,
    source.endsWith(".AppImage") ? `${BIN_NAME}.AppImage` : BIN_NAME
  );

  mkdirSync(installDir, { recursive: true });
  copyFileSync(source, destination);
  chmodSync(destination, 0o755);
  writeLinuxDesktopFile(destination);
  log(`Installed Linux executable to ${destination}.`);
  return destination;
}

function writeLinuxDesktopFile(executablePath) {
  const applicationsDir = path.join(os.homedir(), ".local", "share", "applications");
  const desktopFile = path.join(applicationsDir, `${BIN_NAME}.desktop`);

  mkdirSync(applicationsDir, { recursive: true });
  writeFileSync(
    desktopFile,
    [
      "[Desktop Entry]",
      "Type=Application",
      `Name=${APP_NAME}`,
      `Exec=${executablePath}`,
      "Terminal=false",
      "Categories=Development;Utility;",
      ""
    ].join("\n")
  );
}

function launch(target) {
  if (process.platform === "darwin") {
    launchWithCommand("open", ["-n", target]);
    return;
  }

  if (process.platform === "win32") {
    launchWithCommand("cmd.exe", ["/c", "start", "", target]);
    return;
  }

  if (process.platform === "linux") {
    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      warn("No Linux GUI session was detected, so launch was skipped.");
      warn(`Run manually when a desktop session is available: ${target}`);
      return;
    }
    launchWithCommand(target, []);
    return;
  }

  launchWithCommand(target, []);
}

function launchWithCommand(command, args) {
  log(`Launching: ${[command, ...args].join(" ")}`);
  const child = spawn(command, args, {
    cwd: PROJECT_DIR,
    detached: true,
    stdio: "ignore",
    shell: false
  });
  child.unref();
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
