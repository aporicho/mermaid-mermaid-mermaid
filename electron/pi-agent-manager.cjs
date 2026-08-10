const crypto = require("node:crypto");
const path = require("node:path");
const { fork } = require("node:child_process");
const { createPiAgentLifecycle } = require("./pi-agent-lifecycle.cjs");
const { createPiAgentSessionRegistry } = require("./pi-agent-session-registry.cjs");
const { createPiAgentScratchRegistry } = require("./pi-agent-scratch-registry.cjs");
const { broadcastAgentConfiguration, isInteractiveAgentRequest, shouldBroadcastAgentConfiguration } = require("./pi-agent-config-events.cjs");

const WORKER_PATH = path.join(__dirname, "pi-agent-worker.mjs");
const START_TIMEOUT_MS = 45_000;
function createPiAgentManager({ shell, forkWorker = fork, lifecycleFactory = createPiAgentLifecycle }) {
  const records = new Map();
  const sessions = createPiAgentSessionRegistry({ shell });
  const scratches = createPiAgentScratchRegistry();
  async function start(webContents, request = {}) {
    const ownerId = webContents.id;
    const target = sessions.normalizeTarget(request.target, normalizeAgentInstanceId);
    const agentInstanceId = normalizeAgentInstanceId(request.agentInstanceId);
    if (target.sessionId !== agentInstanceId) throw new Error("Agent instance id must match its session id.");
    const key = recordKey(ownerId, agentInstanceId);
    const requestedCwd = typeof request.cwd === "string" && request.cwd ? path.resolve(request.cwd) : null;
    const scratch = !requestedCwd;
    const current = records.get(key);
    if (current && current.bootstrap.scratch === scratch && (scratch || current.bootstrap.cwd === requestedCwd)) {
      return { status: current.ready ? "ready" : "starting", instanceStatus: current.lifecycle.snapshot().status, state: current.state };
    }
    let migrationSource;
    let migratedScratchDir;
    if (current?.bootstrap.scratch && !scratch) {
      try {
        const migration = await control(webContents, { type: "prepare_migration", agentInstanceId });
        migrationSource = migration?.sessionFile;
        migratedScratchDir = current.bootstrap.scratchDir;
      } catch {
        // A scratch transcript without a persisted turn can safely start a fresh project session.
      }
    }
    if (current) await stop(ownerId, agentInstanceId, { preserveScratch: Boolean(migratedScratchDir) });
    if (target.kind === "existing") {
      sessions.ensureAvailable(key, target.sessionPath);
    }
    const preparedScratch = scratches.prepare(ownerId, requestedCwd, target);
    const { scratchDir, cwd, sessionDir } = preparedScratch;
    const bootstrap = {
      cwd,
      projectRoot: request.projectRoot ? path.resolve(request.projectRoot) : requestedCwd,
      scratch,
      scratchDir,
      sessionDir,
      migrationSource,
      target
    };
    const child = forkWorker(WORKER_PATH, [], {
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PI_CODING_AGENT: "true" },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      serialization: "advanced"
    });
    const record = {
      ownerId,
      key,
      agentInstanceId,
      webContents,
      child,
      bootstrap,
      ready: false,
      state: null,
      stdoutBuffer: "",
      pendingControls: new Map(),
      startResolve: null,
      startReject: null,
      startTimer: null,
      sessionFile: target.kind === "existing" ? target.sessionPath : null,
      lifecycle: null
    };
    sessions.reserve(record, record.sessionFile);
    record.lifecycle = lifecycleFactory({
      onChange: (state) => emit(record, { lane: "lifecycle", payload: { ...state, sessionId: record.agentInstanceId, ...(record.sessionFile ? { sessionFile: record.sessionFile } : {}) } }),
      onExpire: () => void stop(ownerId, agentInstanceId, { preserveScratch: true, reason: "idle-timeout" })
    });
    records.set(key, record);
    attachRecord(record);
    child.send({ type: "initialize", bootstrap });
    return new Promise((resolvePromise, reject) => {
      record.startResolve = resolvePromise;
      record.startReject = reject;
      record.startTimer = setTimeout(() => {
        record.startTimer = null;
        reject(new Error("Pi Agent startup timed out."));
        void stop(ownerId, agentInstanceId);
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
      const wasCurrent = records.get(record.key) === record;
      record.lifecycle.dispose();
      sessions.release(record);
      rejectPending(record, new Error(`Pi Agent exited${code === null ? "" : ` with code ${code}`}${signal ? ` (${signal})` : ""}.`));
      if (wasCurrent) {
        records.delete(record.key);
        emit(record, { lane: "lifecycle", payload: { status: "dormant", sessionId: record.agentInstanceId, reason: "process-exit" } });
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
      if (payload.type === "agent_settled") record.lifecycle.setStatus("idle");
      if (payload.type === "extension_ui_request" && isInteractiveAgentRequest(payload.method)) record.lifecycle.setStatus("waiting");
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
      if (message.state?.sessionId !== record.agentInstanceId) {
        failRecord(record, new Error("Pi Agent worker opened a different session than requested."));
        void stop(record.ownerId, record.agentInstanceId);
        return;
      }
      sessions.claim(record, message.state?.sessionFile);
      record.lifecycle.setStatus("idle");
      if (record.startTimer) clearTimeout(record.startTimer);
      record.startTimer = null;
      record.startResolve?.({ status: "ready", instanceStatus: record.lifecycle.snapshot().status, state: record.state });
      record.startResolve = null;
      record.startReject = null;
      emit(record, { lane: "control", payload: { type: "ready", state: record.state } });
      if (record.migratedScratchDir) {
        const directory = record.migratedScratchDir;
        record.migratedScratchDir = null;
        void scratches.discard(directory);
      }
      return;
    }
    if (message.type === "control_response") {
      const pending = record.pendingControls.get(message.id);
      if (!pending) return;
      record.pendingControls.delete(message.id);
      if (message.ok) {
        pending.resolve(message.result);
        if (shouldBroadcastAgentConfiguration(pending.commandType)) broadcastAgentConfiguration(records, record, pending.commandType, emit);
      }
      else pending.reject(new Error(message.error || "Pi Agent control command failed."));
      return;
    }
    if (message.type === "host_request") {
      if (!String(message.method || "").startsWith("document.")) record.lifecycle.setStatus("waiting");
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
    const record = requireRecord(webContents.id, command?.agentInstanceId);
    if (!command || typeof command !== "object" || typeof command.type !== "string") throw new Error("Invalid Pi RPC command.");
    if (command.type === "new_session" || command.type === "switch_session") {
      throw new Error("Create and switch sessions through the Agent workspace.");
    }
    const normalized = { ...command, id: typeof command.id === "string" && command.id ? command.id : `rpc_${crypto.randomUUID()}` };
    if (normalized.type === "prompt") record.lifecycle.setStatus("running");
    record.child.stdin.write(`${JSON.stringify(normalized)}\n`);
    return { accepted: true, id: normalized.id };
  }

  function extensionUiResponse(webContents, response) {
    const record = requireRecord(webContents.id, response?.agentInstanceId);
    record.lifecycle.setStatus("running");
    record.child.stdin.write(`${JSON.stringify({ ...response, type: "extension_ui_response" })}\n`);
  }

  function control(webContents, command) {
    const record = requireRecord(webContents.id, command?.agentInstanceId);
    const id = `control_${crypto.randomUUID()}`;
    return new Promise((resolvePromise, reject) => {
      record.pendingControls.set(id, { resolve: resolvePromise, reject, commandType: command?.type });
      record.child.send({ type: "control", id, command });
    });
  }

  function respondHost(webContents, response) {
    const record = requireRecord(webContents.id, response?.agentInstanceId);
    record.lifecycle.setStatus("running");
    record.child.send({ type: "host_response", id: response?.id, result: response?.result, error: response?.error });
  }
  async function stop(ownerId, agentInstanceId, options = {}) {
    const key = recordKey(ownerId, normalizeAgentInstanceId(agentInstanceId));
    const record = records.get(key);
    if (!record) return;
    emit(record, { lane: "lifecycle", payload: { status: "dormant", sessionId: record.agentInstanceId, ...(record.sessionFile ? { sessionFile: record.sessionFile } : {}), ...(options.reason ? { reason: options.reason } : {}) } });
    record.lifecycle.dispose();
    records.delete(key);
    sessions.release(record);
    rejectPending(record, new Error("Pi Agent stopped."));
    if (record.startTimer) clearTimeout(record.startTimer);
    record.child.stdin.end();
    if (!record.child.killed) record.child.kill("SIGTERM");
    await scratches.release(ownerId, record.bootstrap.scratchDir, options.preserveScratch);
  }

  async function closeAll() {
    await Promise.all(Array.from(records.values(), (record) => stop(record.ownerId, record.agentInstanceId)));
    await scratches.closeAll();
  }

  async function stopOwner(ownerId) {
    await Promise.all(Array.from(records.values())
      .filter((record) => record.ownerId === ownerId)
      .map((record) => stop(record.ownerId, record.agentInstanceId)));
    await scratches.closeOwner(ownerId);
  }

  function listInstances(ownerId) {
    return Array.from(records.values())
      .filter((record) => record.ownerId === ownerId)
      .map((record) => ({
        agentInstanceId: record.agentInstanceId, sessionId: record.agentInstanceId,
        ...(record.sessionFile ? { sessionFile: record.sessionFile } : {}),
        cwd: record.bootstrap.cwd, ...(record.bootstrap.projectRoot ? { projectRoot: record.bootstrap.projectRoot } : {}),
        ...record.lifecycle.snapshot()
      }));
  }

  function setForeground(ownerId, agentInstanceId, foreground) {
    requireRecord(ownerId, agentInstanceId).lifecycle.setForeground(foreground);
  }

  function updateState(record, state) {
    if (state?.sessionId && state.sessionId !== record.agentInstanceId) { failRecord(record, new Error("A session-bound Agent cannot switch session identity.")); void stop(record.ownerId, record.agentInstanceId); return; }
    record.state = { ...(record.state || {}), ...(state || {}) };
    if (state?.sessionFile) sessions.claim(record, state.sessionFile);
  }

  function emit(record, event) {
    if (!record.webContents.isDestroyed()) record.webContents.send("mmm:agent:event", { ...event, agentInstanceId: record.agentInstanceId });
  }

  function requireRecord(ownerId, agentInstanceId) {
    const record = records.get(recordKey(ownerId, normalizeAgentInstanceId(agentInstanceId)));
    if (!record) throw new Error("Pi Agent instance is not running for this window.");
    return record;
  }

  function failRecord(record, error) {
    if (record.startTimer) clearTimeout(record.startTimer);
    record.startTimer = null;
    record.startReject?.(error);
    record.startResolve = null;
    record.startReject = null;
    record.lifecycle?.setStatus("error");
    emit(record, { lane: "diagnostic", payload: { level: "error", message: error.message } });
  }

  function rejectPending(record, error) {
    for (const pending of record.pendingControls.values()) pending.reject(error);
    record.pendingControls.clear();
  }

  return {
    start,
    listSessions: (_ownerId, request) => sessions.listSessions(request?.cwd),
    listInstances,
    setForeground,
    deleteSession: (_ownerId, request) => sessions.deleteSession(request, normalizeAgentInstanceId),
    rpc,
    control,
    extensionUiResponse,
    respondHost,
    stop,
    stopOwner,
    closeAll
  };
}

function normalizeAgentInstanceId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized && /^[A-Za-z0-9._:-]{1,128}$/.test(normalized) ? normalized : "primary";
}

function recordKey(ownerId, agentInstanceId) {
  return `${ownerId}:${agentInstanceId}`;
}

module.exports = { createPiAgentManager };
