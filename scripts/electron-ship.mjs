#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const DIST_DIR = path.join(PROJECT_DIR, "dist-electron");
const APP_NAME = "Mermaid Canvas Editor";
const APP_DESCRIPTION = "Mermaid, Markdown, and canvas desktop editor.";
const APP_SLUG = "mermaid-canvas-editor";
const LINUX_DESKTOP_ID = `${APP_SLUG}.desktop`;
const LINUX_ICON_SOURCE = path.join(PROJECT_DIR, "electron", "icons", "icon.png");

const packageOnly = isEnabled("MMM_SHIP_PACKAGE_ONLY");
const noInstall = isEnabled("MMM_SHIP_NO_INSTALL") || packageOnly;
const noLaunch = isEnabled("MMM_SHIP_NO_LAUNCH") || packageOnly;
const skipBuild = isEnabled("MMM_SHIP_SKIP_BUILD");

main();

function main() {
  log("Starting Electron package/install/launch flow.");
  warnIfWsl();

  if (skipBuild) {
    log("Skipping Electron build because MMM_SHIP_SKIP_BUILD=1.");
  } else {
    runNpm(["run", "electron:build", "--", ...process.argv.slice(2)]);
  }

  const artifacts = collectArtifacts();
  if (artifacts.length === 0) {
    fail(`No Electron desktop artifacts were found under ${DIST_DIR}.`);
  }

  log("Built artifacts:");
  for (const artifact of artifacts) {
    log(`  ${path.relative(PROJECT_DIR, artifact.path)}`);
  }

  if (packageOnly) {
    log("Package-only mode finished.");
    return;
  }

  const launchTarget = noInstall ? selectLaunchTarget(artifacts) : installOrSelectLaunchTarget(artifacts);
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
  console.log(`[electron:ship] ${message}`);
}

function warn(message) {
  console.warn(`[electron:ship] ${message}`);
}

function fail(message) {
  console.error(`[electron:ship] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  log(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT_DIR,
    env: process.env,
    stdio: "inherit",
    shell: shouldUseShell(command)
  });

  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(`Command failed with exit code ${result.status}: ${command} ${args.join(" ")}`);
  }
}

function runNpm(args) {
  run(npmCommand(), args);
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function shouldUseShell(command) {
  return process.platform === "win32" && /\.cmd$/i.test(path.basename(command));
}

function collectArtifacts() {
  const artifacts = walk(DIST_DIR)
    .filter((entry) => isDesktopArtifact(entry.path))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const target of unpackedLaunchTargets()) {
    if (existsSync(target) && !artifacts.some((artifact) => artifact.path === target)) {
      artifacts.push({ path: target, mtimeMs: statSync(target).mtimeMs });
    }
  }

  return artifacts.sort((a, b) => b.mtimeMs - a.mtimeMs);
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
      if (name.isFile()) {
        entries.push({ path: fullPath, mtimeMs: stat.mtimeMs });
      }
    }
  }

  return entries;
}

function isDesktopArtifact(filePath) {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".appimage")
    || lower.endsWith(".dmg")
    || lower.endsWith(".exe")
    || lower.endsWith(".app")
    || lower.endsWith(".deb")
    || lower.endsWith(".rpm");
}

function unpackedLaunchTargets() {
  return [
    path.join(DIST_DIR, "linux-unpacked", APP_SLUG),
    path.join(DIST_DIR, "win-unpacked", `${APP_SLUG}.exe`),
    path.join(DIST_DIR, "win-unpacked", `${APP_NAME}.exe`)
  ];
}

function installOrSelectLaunchTarget(artifacts) {
  if (process.platform === "linux") {
    return installLinux(artifacts);
  }
  if (process.platform === "darwin") {
    return installMac(artifacts);
  }
  if (process.platform === "win32") {
    return installWindows(artifacts);
  }
  return selectLaunchTarget(artifacts);
}

function selectLaunchTarget(artifacts) {
  if (process.platform === "linux") {
    const appImage = findArtifact(artifacts, ".appimage");
    if (appImage) return appImage.path;
    const unpacked = path.join(DIST_DIR, "linux-unpacked", APP_SLUG);
    if (existsSync(unpacked)) return unpacked;
  }

  if (process.platform === "darwin") {
    const app = findArtifact(artifacts, ".app");
    if (app) return app.path;
  }

  if (process.platform === "win32") {
    const installed = findInstalledWindowsApp();
    if (installed) return installed;
    const unpacked = path.join(DIST_DIR, "win-unpacked", `${APP_NAME}.exe`);
    if (existsSync(unpacked)) return unpacked;
  }

  return artifacts[0].path;
}

function findArtifact(artifacts, suffix) {
  const normalizedSuffix = suffix.toLowerCase();
  return artifacts.find((artifact) => artifact.path.toLowerCase().endsWith(normalizedSuffix)) ?? null;
}

function installLinux(artifacts) {
  const appImage = findArtifact(artifacts, ".appimage");
  if (appImage) {
    const appDir = path.join(homeDir(), ".local", "share", APP_SLUG);
    const installedAppImage = path.join(appDir, `${APP_SLUG}.AppImage`);
    const temporaryAppImage = `${installedAppImage}.tmp-${process.pid}`;
    mkdirSync(appDir, { recursive: true });
    try {
      copyFileSync(appImage.path, temporaryAppImage);
      chmodSync(temporaryAppImage, 0o755);
      renameSync(temporaryAppImage, installedAppImage);
    } finally {
      rmSync(temporaryAppImage, { force: true });
    }
    installLinuxDesktopEntry(installedAppImage);
    log(`Installed AppImage to ${installedAppImage}`);
    return installedAppImage;
  }

  const unpackedSource = path.join(DIST_DIR, "linux-unpacked");
  const unpackedBinary = path.join(unpackedSource, APP_SLUG);
  if (!existsSync(unpackedBinary)) {
    return selectLaunchTarget(artifacts);
  }

  const installDir = path.join(homeDir(), ".local", "share", APP_SLUG, "linux-unpacked");
  rmSync(installDir, { recursive: true, force: true });
  mkdirSync(path.dirname(installDir), { recursive: true });
  cpSync(unpackedSource, installDir, { recursive: true });
  const installedBinary = path.join(installDir, APP_SLUG);
  chmodSync(installedBinary, 0o755);
  installLinuxDesktopEntry(installedBinary);
  log(`Installed unpacked Linux app to ${installDir}`);
  return installedBinary;
}

function installLinuxDesktopEntry(executablePath) {
  const applicationsDir = path.join(homeDir(), ".local", "share", "applications");
  const iconDir = path.join(homeDir(), ".local", "share", "icons", "hicolor", "512x512", "apps");
  const desktopFile = path.join(applicationsDir, LINUX_DESKTOP_ID);
  const iconFile = path.join(iconDir, `${APP_SLUG}.png`);

  mkdirSync(applicationsDir, { recursive: true });
  mkdirSync(iconDir, { recursive: true });
  if (existsSync(LINUX_ICON_SOURCE)) {
    copyFileSync(LINUX_ICON_SOURCE, iconFile);
  }

  writeFileSync(desktopFile, linuxDesktopEntry(executablePath, iconFile), "utf8");
  chmodSync(desktopFile, 0o644);
  refreshLinuxDesktopIntegration(applicationsDir);
}

function linuxDesktopEntry(executablePath, iconPath) {
  return [
    "[Desktop Entry]",
    `Name=${desktopString(APP_NAME)}`,
    "Name[zh_CN]=Mermaid 画布编辑器",
    `Comment=${desktopString(APP_DESCRIPTION)}`,
    "Comment[zh_CN]=Mermaid、Markdown 和无限画布桌面编辑器。",
    `Exec=${desktopExecPath(executablePath)} %U`,
    "Terminal=false",
    "Type=Application",
    `Icon=${desktopString(iconPath)}`,
    "Categories=Development;",
    "Keywords=Mermaid;Markdown;Canvas;Diagram;画布;图表;",
    `StartupWMClass=${APP_SLUG}`,
    "StartupNotify=true",
    "MimeType=text/markdown;text/vnd.mermaid;",
    ""
  ].join("\n");
}

function desktopString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t");
}

function desktopExecPath(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function refreshLinuxDesktopIntegration(applicationsDir) {
  const iconThemeDir = path.join(homeDir(), ".local", "share", "icons", "hicolor");
  const refreshCommands = [
    ["update-desktop-database", [applicationsDir]],
    ["gtk-update-icon-cache", ["--force", "--ignore-theme-index", iconThemeDir]],
    ["xdg-desktop-menu", ["forceupdate", "--mode", "user"]]
  ];

  for (const [command, args] of refreshCommands) {
    const result = spawnSync(command, args, {
      cwd: PROJECT_DIR,
      env: process.env,
      stdio: "ignore"
    });

    if (result.error || result.status !== 0) {
      warn(`${command} was unavailable or failed; the application launcher may need to be reopened.`);
    }
  }
}

function installMac(artifacts) {
  const app = findArtifact(artifacts, ".app");
  if (!app) {
    const dmg = findArtifact(artifacts, ".dmg");
    if (dmg) {
      warn("No .app bundle was found to copy; use the generated .dmg installer manually.");
      return dmg.path;
    }
    return selectLaunchTarget(artifacts);
  }

  const applicationsDir = path.join(homeDir(), "Applications");
  const installedApp = path.join(applicationsDir, `${APP_NAME}.app`);
  mkdirSync(applicationsDir, { recursive: true });
  rmSync(installedApp, { recursive: true, force: true });
  cpSync(app.path, installedApp, { recursive: true });
  log(`Installed app bundle to ${installedApp}`);
  return installedApp;
}

function installWindows(artifacts) {
  const installer = findArtifact(artifacts, ".exe");
  if (installer) {
    run(installer.path, ["/S"]);
  }

  const installed = findInstalledWindowsApp();
  if (installed) {
    log(`Installed app found at ${installed}`);
    return installed;
  }

  return selectLaunchTarget(artifacts);
}

function findInstalledWindowsApp() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", APP_NAME, `${APP_SLUG}.exe`),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", APP_NAME, `${APP_NAME}.exe`),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, APP_NAME, `${APP_SLUG}.exe`),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, APP_NAME, `${APP_SLUG}.exe`),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, APP_NAME, `${APP_NAME}.exe`)
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function launch(target) {
  if (process.platform === "darwin") {
    spawnDetached("open", [target]);
    return;
  }

  spawnDetached(target, []);
}

function spawnDetached(command, args) {
  log(`Launching ${[command, ...args].join(" ")}`);
  const child = spawn(command, args, {
    cwd: PROJECT_DIR,
    env: process.env,
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

function homeDir() {
  return os.homedir();
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

  warn("Running inside WSL. This command builds and installs the Linux Electron artifact. Use npm run windows:run for the Windows installer.");
}

function safeRead(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
