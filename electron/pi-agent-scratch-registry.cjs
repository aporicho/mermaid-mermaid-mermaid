const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function createPiAgentScratchRegistry() {
  const retained = new Map();

  function prepare(ownerId, requestedCwd, target) {
    if (requestedCwd) return { scratch: false, scratchDir: null, cwd: requestedCwd, sessionDir: undefined };
    const restored = target.kind === "existing" ? path.dirname(path.dirname(target.sessionPath)) : null;
    const scratchDir = restored || fs.mkdtempSync(path.join(os.tmpdir(), "mmm-pi-agent-"));
    if (restored) retained.get(ownerId)?.delete(restored);
    return { scratch: true, scratchDir, cwd: scratchDir, sessionDir: path.join(scratchDir, "sessions") };
  }

  async function release(ownerId, directory, preserve) {
    if (!directory) return;
    if (!preserve) return discard(directory);
    const directories = retained.get(ownerId) || new Set();
    directories.add(directory);
    retained.set(ownerId, directories);
  }

  async function closeOwner(ownerId) {
    const directories = retained.get(ownerId);
    retained.delete(ownerId);
    await Promise.all(Array.from(directories || [], discard));
  }

  async function closeAll() {
    await Promise.all(Array.from(retained.values()).flatMap((directories) => Array.from(directories, discard)));
    retained.clear();
  }

  function discard(directory) {
    return fsp.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }

  return { prepare, release, closeOwner, closeAll, discard };
}

module.exports = { createPiAgentScratchRegistry };
