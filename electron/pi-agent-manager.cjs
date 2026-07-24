const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { fork } = require("node:child_process");

const WORKER_PATH = path.join(__dirname, "pi-agent-worker.mjs");
const START_TIMEOUT_MS = 45_000;

function createPiAgentManager({ shell }) {
  const records = new Map();
  const sessionOwners = new Map();

  async function start(webContents, request = {}) {
    const ownerId = webContents.id;
    const requestedCwd = typeof request.cwd === "string" && request.cwd ? path.resolve(request.cwd) : null;
    const scratch = !requestedCwd;
    const current = records.get(ownerId);
    if (current && current.bootstrap.scratch === scratch && (scratch || current.bootstrap.cwd === requestedCwd)) {
      return { status: current.ready ? "ready" : "starting", state: current.state };
    }

    let migrationSource;
    let migratedScratchDir;
    if (current?.bootstrap.scratch && !scratch) {
      try {
        const migration = await control(webContents, { type: "prepare_migration" });
        migrationSource = migration?.sessionFile;
        migratedScratchDir = current.bootstrap.scratchDir;
      } catch {
        // A scratch transcript without a persisted turn can safely start a fresh project session.
      }
    }
    if (current) await stop(ownerId, { preserveScratch: Boolean(migratedScratchDir) });

    const scratchDir = scratch ? fs.mkdtempSync(path.join(os.tmpdir(), "mmm-pi-agent-")) : null;
    const cwd = requestedCwd || scratchDir;
    const bootstrap = {
      cwd,
      projectRoot: request.projectRoot ? path.resolve(request.projectRoot) : requestedCwd,
      scratch,
      scratchDir,
      sessionDir: scratchDir ? path.join(scratchDir, "sessions") : undefined,
      migrationSource
    };
    const child = fork(WORKER_PATH, [], {
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PI_CODING_AGENT: "true" },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      serialization: "advanced"
    });
    const record = {
      ownerId,
      webContents,
      child,
      bootstrap,
      ready: false,
      state: null,
      stdoutBuffer: "",
      pendingControls: new Map(),
      pendingSwitches: new Map(),
      startResolve: null,
      startReject: null,
      startTimer: null,
      sessionFile: null
    };
    records.set(ownerId, record);
    attachRecord(record);
    child.send({ type: "initialize", bootstrap });

    return new Promise((resolvePromise, reject) => {
      record.startResolve = resolvePromise;
      record.startReject = reject;
      record.startTimer = setTimeout(() => {
        record.startTimer = null;
        reject(new Error("Pi Agent startup timed out."));
        void stop(ownerId);
      }, START_TIMEOUT_MS);
      record.startTimer.unref?.();
      record.migratedScratchDir = migratedScratchDir;
    });
  }

  function attachRecord(record) {
    const { child } = record;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => consumeRpcOutput(record, chunk));
    child.stderr.on("data", (chunk) => {
      emit(record, { lane: "diagnostic", payload: { level: "warning", message: String(chunk).slice(-12_000) } });
    });
    child.on("message", (message) => handleWorkerMessage(record, message));
    child.on("error", (error) => failRecord(record, error));
    child.on("exit", (code, signal) => {
      const wasCurrent = records.get(record.ownerId) === record;
      releaseSession(record);
      rejectPending(record, new Error(`Pi Agent exited${code === null ? "" : ` with code ${code}`}${signal ? ` (${signal})` : ""}.`));
      if (wasCurrent) {
        records.delete(record.ownerId);
        emit(record, { lane: "control", payload: { type: "stopped", code, signal } });
      }
    });
  }

  function consumeRpcOutput(record, chunk) {
    record.stdoutBuffer += chunk;
    while (true) {
      const newline = record.stdoutBuffer.indexOf("\n");
      if (newline < 0) break;
      const line = record.stdoutBuffer.slice(0, newline).trim();
      record.stdoutBuffer = record.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      let payload;
      try {
        payload = JSON.parse(line);
      } catch {
        emit(record, { lane: "diagnostic", payload: { level: "warning", message: `Invalid Pi RPC output: ${line.slice(0, 500)}` } });
        continue;
      }
      if (payload.type === "response" && payload.id && record.pendingSwitches.has(payload.id)) {
        const target = record.pendingSwitches.get(payload.id);
        record.pendingSwitches.delete(payload.id);
        if (payload.success) claimSession(record, target);
      }
      if (payload.type === "response" && payload.command === "get_state" && payload.success) {
        updateState(record, payload.data);
      }
      emit(record, { lane: "rpc", payload });
    }
  }

  function handleWorkerMessage(record, message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "ready") {
      record.ready = true;
      record.state = message.state || null;
      claimSession(record, message.state?.sessionFile);
      if (record.startTimer) clearTimeout(record.startTimer);
      record.startTimer = null;
      record.startResolve?.({ status: "ready", state: record.state });
      record.startResolve = null;
      record.startReject = null;
      emit(record, { lane: "control", payload: { type: "ready", state: record.state } });
      if (record.migratedScratchDir) {
        const directory = record.migratedScratchDir;
        record.migratedScratchDir = null;
        void fsp.rm(directory, { recursive: true, force: true }).catch(() => undefined);
      }
      return;
    }
    if (message.type === "control_response") {
      const pending = record.pendingControls.get(message.id);
      if (!pending) return;
      record.pendingControls.delete(message.id);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error(message.error || "Pi Agent control command failed."));
      return;
    }
    if (message.type === "host_request") {
      emit(record, { lane: "host", payload: { id: message.id, method: message.method, params: message.params } });
      return;
    }
    if (message.type === "control_event") {
      emit(record, { lane: "control", payload: message.event });
      return;
    }
    if (message.type === "fatal") failRecord(record, new Error(message.error || "Pi Agent failed to start."));
  }

  function rpc(webContents, command) {
    const record = requireRecord(webContents.id);
    if (!command || typeof command !== "object" || typeof command.type !== "string") throw new Error("Invalid Pi RPC command.");
    const normalized = { ...command, id: typeof command.id === "string" && command.id ? command.id : `rpc_${crypto.randomUUID()}` };
    if (normalized.type === "switch_session") {
      const target = path.resolve(String(normalized.sessionPath || ""));
      const owner = sessionOwners.get(target);
      if (owner && owner !== record.ownerId) {
        emit(record, { lane: "rpc", payload: { id: normalized.id, type: "response", command: "switch_session", success: false, error: "This session is already open in another window." } });
        return { accepted: false, id: normalized.id };
      }
      record.pendingSwitches.set(normalized.id, target);
    }
    record.child.stdin.write(`${JSON.stringify(normalized)}\n`);
    return { accepted: true, id: normalized.id };
  }

  function extensionUiResponse(webContents, response) {
    const record = requireRecord(webContents.id);
    record.child.stdin.write(`${JSON.stringify({ ...response, type: "extension_ui_response" })}\n`);
  }

  function control(webContents, command) {
    const record = requireRecord(webContents.id);
    if (command?.type === "delete_session") return trashSession(record, command.path);
    const id = `control_${crypto.randomUUID()}`;
    return new Promise((resolvePromise, reject) => {
      record.pendingControls.set(id, { resolve: resolvePromise, reject });
      record.child.send({ type: "control", id, command });
    });
  }

  function respondHost(webContents, response) {
    const record = requireRecord(webContents.id);
    record.child.send({ type: "host_response", id: response?.id, result: response?.result, error: response?.error });
  }

  async function trashSession(record, sessionPath) {
    const target = path.resolve(String(sessionPath || ""));
    if (!target.endsWith(".jsonl")) throw new Error("Only Pi JSONL session files can be removed.");
    const owner = sessionOwners.get(target);
    if (owner) throw new Error(owner === record.ownerId ? "Switch away from the active session before removing it." : "This session is open in another window.");
    await shell.trashItem(target);
    return { trashed: true, path: target };
  }

  async function stop(ownerId, options = {}) {
    const record = records.get(ownerId);
    if (!record) return;
    records.delete(ownerId);
    releaseSession(record);
    rejectPending(record, new Error("Pi Agent stopped."));
    if (record.startTimer) clearTimeout(record.startTimer);
    record.child.stdin.end();
    if (!record.child.killed) record.child.kill("SIGTERM");
    if (record.bootstrap.scratchDir && !options.preserveScratch) {
      await fsp.rm(record.bootstrap.scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async function closeAll() {
    await Promise.all(Array.from(records.keys(), (ownerId) => stop(ownerId)));
  }

  function updateState(record, state) {
    record.state = { ...(record.state || {}), ...(state || {}) };
    if (state?.sessionFile) claimSession(record, state.sessionFile);
  }

  function claimSession(record, sessionFile) {
    if (!sessionFile) return;
    const target = path.resolve(sessionFile);
    const owner = sessionOwners.get(target);
    if (owner && owner !== record.ownerId) return;
    releaseSession(record);
    record.sessionFile = target;
    sessionOwners.set(target, record.ownerId);
  }

  function releaseSession(record) {
    if (record.sessionFile && sessionOwners.get(record.sessionFile) === record.ownerId) sessionOwners.delete(record.sessionFile);
    record.sessionFile = null;
  }

  function emit(record, event) {
    if (!record.webContents.isDestroyed()) record.webContents.send("mmm:agent:event", event);
  }

  function requireRecord(ownerId) {
    const record = records.get(ownerId);
    if (!record) throw new Error("Pi Agent is not running for this window.");
    return record;
  }

  function failRecord(record, error) {
    if (record.startTimer) clearTimeout(record.startTimer);
    record.startTimer = null;
    record.startReject?.(error);
    record.startResolve = null;
    record.startReject = null;
    emit(record, { lane: "diagnostic", payload: { level: "error", message: error.message } });
  }

  function rejectPending(record, error) {
    for (const pending of record.pendingControls.values()) pending.reject(error);
    record.pendingControls.clear();
  }

  return { start, rpc, control, extensionUiResponse, respondHost, stop, closeAll };
}

module.exports = { createPiAgentManager };
