const fsp = require("node:fs/promises");
const { writeJsonAtomically } = require("./atomic-json-file.cjs");

function createEditorSessionStore(filePath) {
  let writeQueue = Promise.resolve();

  async function readAll() {
    try {
      const parsed = JSON.parse(await fsp.readFile(filePath, "utf8"));
      return normalizeStore(parsed);
    } catch (error) {
      if (error?.code === "ENOENT") return emptyStore();
      throw error;
    }
  }

  async function claim(excludedIds = new Set()) {
    const store = await readAll();
    const record = Object.values(store.sessions)
      .filter((candidate) => !excludedIds.has(candidate.session.windowId))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0];
    return record?.session || null;
  }

  function write(session) {
    writeQueue = writeQueue.catch(() => undefined).then(async () => {
      const store = await readAll();
      const windowId = String(session?.windowId || "").trim();
      if (!windowId) throw new Error("Editor session windowId is required.");
      store.sessions[windowId] = { updatedAt: Date.now(), session };
      await writeJsonAtomically(filePath, store);
    });
    return writeQueue;
  }

  function remove(windowId) {
    writeQueue = writeQueue.catch(() => undefined).then(async () => {
      const store = await readAll();
      delete store.sessions[String(windowId || "")];
      await writeJsonAtomically(filePath, store);
    });
    return writeQueue;
  }

  return { claim, readAll, remove, write };
}

function normalizeStore(value) {
  if (!value || typeof value !== "object" || !value.sessions || typeof value.sessions !== "object") return emptyStore();
  const sessions = {};
  for (const [id, record] of Object.entries(value.sessions)) {
    if (!record || typeof record !== "object" || !record.session || typeof record.session !== "object") continue;
    if (String(record.session.windowId || "") !== id) continue;
    sessions[id] = {
      updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : 0,
      session: record.session
    };
  }
  return { version: 1, sessions };
}

function emptyStore() {
  return { version: 1, sessions: {} };
}

module.exports = { createEditorSessionStore };
