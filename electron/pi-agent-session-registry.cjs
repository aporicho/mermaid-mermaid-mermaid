const path = require("node:path");

const { listPiAgentSessions } = require("./pi-agent-session-catalog.cjs");

function createPiAgentSessionRegistry({ shell }) {
  const owners = new Map();

  function normalizeTarget(value, normalizeSessionId) {
    if (!value || typeof value !== "object") throw new Error("Missing Agent session target.");
    const sessionId = normalizeSessionId(value.sessionId);
    if (value.kind === "new") return { kind: "new", sessionId };
    if (value.kind === "existing" && typeof value.sessionPath === "string" && value.sessionPath.trim()) {
      const sessionPath = path.resolve(value.sessionPath);
      if (!sessionPath.endsWith(".jsonl")) throw new Error("Agent sessions must be JSONL files.");
      return { kind: "existing", sessionId, sessionPath };
    }
    throw new Error("Invalid Agent session target.");
  }

  function ensureAvailable(recordKey, sessionFile) {
    if (!sessionFile) return;
    const owner = owners.get(path.resolve(sessionFile));
    if (owner && owner !== recordKey) throw new Error("This session is already running in another Agent instance.");
  }

  function reserve(record, sessionFile) {
    if (!sessionFile) return;
    const target = path.resolve(sessionFile);
    ensureAvailable(record.key, target);
    record.sessionFile = target;
    owners.set(target, record.key);
  }

  function claim(record, sessionFile) {
    if (!sessionFile) return;
    release(record);
    reserve(record, sessionFile);
  }

  function release(record) {
    if (record.sessionFile && owners.get(record.sessionFile) === record.key) owners.delete(record.sessionFile);
    record.sessionFile = null;
  }

  async function deleteSession(request, normalizeSessionId) {
    const sessionId = normalizeSessionId(request?.sessionId);
    const target = path.resolve(String(request?.sessionPath || ""));
    if (!target.endsWith(".jsonl")) throw new Error("Only Pi JSONL session files can be removed.");
    if (owners.has(target)) throw new Error("Stop the Agent session before removing it.");
    await shell.trashItem(target);
    return { trashed: true, sessionId, path: target };
  }

  return { normalizeTarget, ensureAvailable, reserve, claim, release, deleteSession, listSessions: listPiAgentSessions };
}

module.exports = { createPiAgentSessionRegistry };
