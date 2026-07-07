#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");

main();

function main() {
  run(npmCommand(), ["run", "build"]);
  run(electronBuilderBin(), withDefaultPublishMode(process.argv.slice(2)));
}

function run(command, args) {
  console.log(`[electron:build] $ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: PROJECT_DIR,
    env: process.env,
    stdio: "inherit",
    shell: shouldUseShell(command)
  });

  if (result.error) {
    console.error(`[electron:build] ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function electronBuilderBin() {
  const command = process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";
  const local = path.join(PROJECT_DIR, "node_modules", ".bin", command);
  return existsSync(local) ? local : command;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function shouldUseShell(command) {
  return process.platform === "win32" && /\.cmd$/i.test(path.basename(command));
}

function withDefaultPublishMode(args) {
  if (args.some((arg) => arg === "--publish" || arg.startsWith("--publish="))) {
    return args;
  }
  return [...args, "--publish", "never"];
}
