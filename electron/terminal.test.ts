// @vitest-environment node

import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { resolveTerminalCwd } = require("./terminal.cjs") as {
  resolveTerminalCwd: (cwd?: string) => string;
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "mermaid-terminal-cwd-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("terminal working directory", () => {
  it("uses an explicitly requested directory", () => {
    const directory = temporaryDirectory();

    expect(resolveTerminalCwd(directory)).toBe(realpathSync(directory));
  });

  it("uses the app launch directory when no valid directory is requested", () => {
    const previousDirectory = process.cwd();
    const directory = temporaryDirectory();

    try {
      process.chdir(directory);
      expect(resolveTerminalCwd()).toBe(realpathSync(directory));
      expect(resolveTerminalCwd(join(directory, "missing"))).toBe(realpathSync(directory));
    } finally {
      process.chdir(previousDirectory);
    }
  });
});
