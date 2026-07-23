/* global process, setImmediate */

import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import lockfile from "proper-lockfile";
import { Type } from "typebox";
import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  DefaultPackageManager,
  getAgentDir,
  hasTrustRequiringProjectResources,
  ModelRuntime,
  ProjectTrustStore,
  runRpcMode,
  SessionManager,
  SettingsManager
} from "@earendil-works/pi-coding-agent";
import { createPiAgentModelController } from "./pi-agent-models.mjs";

const pendingHostRequests = new Map();
const pendingTurnContexts = [];
let runtime = null;
let bootstrap = null;
let controlQueue = Promise.resolve();
let projectTrustByCwd = new Map();
let builtinProviderIds = new Set();
let agentModels = null;

process.on("message", (message) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "initialize") {
    void initialize(message.bootstrap).catch((error) => fatal(error));
    return;
  }
  if (message.type === "host_response") {
    const pending = pendingHostRequests.get(message.id);
    if (!pending) return;
    pendingHostRequests.delete(message.id);
    pending.cleanup?.();
    if (message.error) pending.reject(new Error(String(message.error)));
    else pending.resolve(message.result);
    return;
  }
  if (message.type === "control") {
    if (message.command?.type === "cancel_login") {
      const cancelled = agentModels?.cancelLogin(message.command.providerId) ?? false;
      send({ type: "control_response", id: message.id, ok: true, result: { cancelled } });
      return;
    }
    controlQueue = controlQueue
      .then(() => handleControl(message.command))
      .then(
        (result) => send({ type: "control_response", id: message.id, ok: true, result }),
        (error) => send({ type: "control_response", id: message.id, ok: false, error: readableError(error) })
      );
  }
});

async function initialize(input) {
  if (runtime) return;
  bootstrap = normalizeBootstrap(input);
  const agentDir = getAgentDir();
  const startupSettings = SettingsManager.create(bootstrap.cwd, agentDir, { projectTrusted: false });
  const trustStore = new ProjectTrustStore(agentDir);
  projectTrustByCwd = new Map();

  const createRuntime = async ({ cwd, sessionManager, sessionStartEvent }) => {
    const projectTrusted = await resolveProjectTrust({
      cwd,
      agentDir,
      scratch: bootstrap.scratch,
      trustStore,
      startupSettings,
      cached: projectTrustByCwd.get(cwd)
    });
    projectTrustByCwd.set(cwd, projectTrusted);
    const settingsManager = SettingsManager.create(cwd, agentDir, { projectTrusted });
    const documentExtension = { name: "mmm-documents", hidden: true, factory: createDocumentExtension() };
    const gateExtension = { name: "mmm-safety-gate", hidden: true, factory: createSafetyGate({ cwd, scratch: bootstrap.scratch }) };
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      settingsManager,
      resourceLoaderOptions: {
        extensionFactories: [documentExtension, gateExtension],
        extensionsOverride(base) {
          const document = base.extensions.find((extension) => extension.path === "<inline:mmm-documents>");
          const gate = base.extensions.find((extension) => extension.path === "<inline:mmm-safety-gate>");
          const user = base.extensions.filter((extension) => extension !== document && extension !== gate);
          return { ...base, extensions: [...(document ? [document] : []), ...user, ...(gate ? [gate] : [])] };
        },
        appendSystemPromptOverride(base) {
          return [...base, workspaceSystemPrompt(bootstrap.scratch)];
        }
      }
    });
    const result = await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
      ...(bootstrap.scratch ? { noTools: "builtin" } : {})
    });
    ensureCoreToolsActive(result.session);
    return {
      ...result,
      services,
      diagnostics: services.diagnostics
    };
  };

  const sessionManager = initialSessionManager(bootstrap);
  runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: bootstrap.cwd,
    agentDir,
    sessionManager
  });
  const builtinRuntime = await ModelRuntime.create({
    modelsPath: null,
    authPath: join(agentDir, ".builtin-provider-probe-auth.json"),
    allowModelNetwork: false
  });
  builtinProviderIds = new Set(builtinRuntime.getProviders().map((provider) => provider.id));
  agentModels = createPiAgentModelController({
    getRuntime: () => runtime,
    builtinProviderIds,
    requestHost,
    send,
    readableError
  });
  send({
    type: "ready",
    state: {
      cwd: runtime.cwd,
      scratch: bootstrap.scratch,
      sessionFile: runtime.session.sessionFile,
      sessionId: runtime.session.sessionId,
      diagnostics: runtime.diagnostics
    }
  });
  await runRpcMode(runtime);
}

function normalizeBootstrap(input) {
  if (!input || typeof input !== "object") throw new Error("Missing Pi Agent bootstrap data.");
  const cwd = resolve(String(input.cwd || process.cwd()));
  return {
    cwd,
    projectRoot: input.projectRoot ? resolve(String(input.projectRoot)) : null,
    scratch: Boolean(input.scratch),
    sessionDir: input.sessionDir ? resolve(String(input.sessionDir)) : undefined,
    migrationSource: input.migrationSource ? resolve(String(input.migrationSource)) : undefined
  };
}

function initialSessionManager(input) {
  if (input.migrationSource && existsSync(input.migrationSource)) {
    return SessionManager.forkFrom(input.migrationSource, input.cwd, input.sessionDir);
  }
  if (input.scratch) return SessionManager.continueRecent(input.cwd, input.sessionDir);
  return SessionManager.continueRecent(input.cwd, input.sessionDir);
}

async function resolveProjectTrust({ cwd, scratch, trustStore, startupSettings, cached }) {
  if (scratch || !hasTrustRequiringProjectResources(cwd)) return !scratch;
  if (typeof cached === "boolean") return cached;
  const saved = trustStore.get(cwd);
  if (saved !== null) return saved;
  const fallback = startupSettings.getDefaultProjectTrust();
  if (fallback === "always") return true;
  if (fallback === "never") return false;
  const options = projectTrustOptions(cwd);
  const result = await requestHost("trust", {
    cwd,
    options: options.map((option, index) => ({ index, label: option.label, trusted: option.trusted }))
  });
  const selected = options[Number(result?.index)];
  if (!selected) return false;
  if (selected.updates.length) trustStore.setMany(selected.updates);
  return selected.trusted;
}

function createDocumentExtension() {
  return (pi) => {
    pi.on("before_agent_start", () => {
      const context = pendingTurnContexts.shift();
      if (!context) return undefined;
      return {
        message: {
          customType: "mmm-live-context",
          content: `Live editor context for this turn:\n${JSON.stringify(context)}`,
          details: { version: 1 },
          display: false
        }
      };
    });

    pi.registerTool({
      name: "mmm_get_workspace_context",
      label: "Workspace context",
      description: "List live documents and the current editor selection. Use this before editing an open document.",
      promptSnippet: "Read live Mermaid, Markdown, and Canvas editor state.",
      parameters: Type.Object({}),
      async execute() {
        return toolResult(await requestHost("document.list", {}));
      }
    });

    pi.registerTool({
      name: "mmm_read_open_document",
      label: "Read open document",
      description: "Read the current in-memory content of an open editor document, not the potentially stale disk copy.",
      promptSnippet: "Read an open document by stable documentId.",
      parameters: Type.Object({
        documentId: Type.String({ description: "Stable document id from mmm_get_workspace_context" })
      }),
      async execute(_toolCallId, params) {
        return toolResult(await requestHost("document.read", params));
      }
    });

    pi.registerTool({
      name: "mmm_apply_open_document_patch",
      label: "Edit open document",
      description: "Atomically edit a live document. Provide expectedRevision and either replacement, UTF-16 text edits, Mermaid operations, or Canvas operations. One call is one undo transaction and auto-saves by default.",
      promptSnippet: "Apply a revision-checked semantic patch to an open editor document.",
      promptGuidelines: [
        "Always reread the live document before applying a patch.",
        "Prefer the smallest non-overlapping text edits; use Mermaid operations when modifying graph structure."
      ],
      parameters: Type.Object({
        documentId: Type.String(),
        expectedRevision: Type.String(),
        replacement: Type.Optional(Type.String()),
        edits: Type.Optional(Type.Array(Type.Object({ start: Type.Number(), end: Type.Number(), text: Type.String() }))),
        mermaidOperations: Type.Optional(Type.Array(Type.Any())),
        canvasOperations: Type.Optional(Type.Array(Type.Any())),
        autoSave: Type.Optional(Type.Boolean({ default: true }))
      }),
      async execute(_toolCallId, params) {
        return toolResult(await requestHost("document.apply", params));
      }
    });

    pi.registerTool({
      name: "mmm_reveal_reference",
      label: "Reveal reference",
      description: "Focus and reveal a document, Mermaid entity, Markdown range, or Canvas element in the editor.",
      parameters: Type.Object({
        documentId: Type.String(),
        reference: Type.Optional(Type.Any())
      }),
      async execute(_toolCallId, params) {
        return toolResult(await requestHost("document.reveal", params));
      }
    });
  };
}

function createSafetyGate({ cwd, scratch }) {
  return (pi) => {
    pi.on("tool_call", async (event, ctx) => {
      if (event.toolName.startsWith("mmm_")) return undefined;
      if (scratch) return { block: true, reason: "No-project mode only allows live-document tools." };

      const pathValue = toolPath(event.input);
      if (pathValue && ["read", "edit", "write"].includes(event.toolName)) {
        const documents = await requestHost("document.list", {});
        const target = resolve(cwd, pathValue);
        const isOpen = Array.isArray(documents?.documents)
          && documents.documents.some((document) => document.path && resolve(document.path) === target);
        if (isOpen) {
          return { block: true, reason: "This file is open in the editor. Use mmm_read_open_document and mmm_apply_open_document_patch." };
        }
      }

      const sensitive = pathValue && isSensitivePath(resolve(cwd, pathValue));
      const outsideWrite = pathValue && ["edit", "write"].includes(event.toolName) && !isInside(cwd, resolve(cwd, pathValue));
      const command = event.toolName === "bash" ? String(event.input.command || "") : "";
      const dangerous = command && isDangerousCommand(command);
      const sensitiveCommand = command && referencesSensitivePath(command);
      const outsideMutation = command && likelyOutsideMutation(command, cwd);
      if (!sensitive && !outsideWrite && !dangerous && !sensitiveCommand && !outsideMutation) return undefined;

      const reason = sensitive || sensitiveCommand
        ? "This operation accesses a sensitive path."
        : outsideWrite || outsideMutation
          ? "This operation may modify files outside the current project."
          : "This shell command can be destructive.";
      const allowed = await ctx.ui.confirm("Allow risky operation?", `${reason}\n\n${command || pathValue}`);
      return allowed ? undefined : { block: true, reason: "Blocked by user." };
    });
  };
}

async function handleControl(command) {
  if (!runtime) throw new Error("Pi Agent is not ready.");
  const type = String(command?.type || "");
  if (type === "set_turn_context") {
    pendingTurnContexts.push(command.context || {});
    while (pendingTurnContexts.length > 4) pendingTurnContexts.shift();
    return { queued: true };
  }
  if (type === "prepare_migration") {
    await runtime.session.waitForIdle();
    return { sessionFile: runtime.session.sessionFile };
  }
  if (type === "overview") return buildOverview();
  if (type === "list_sessions") return listSessions();
  if (type === "navigate_tree") {
    return runtime.session.navigateTree(String(command.entryId), {
      summarize: Boolean(command.summarize),
      label: typeof command.label === "string" ? command.label : undefined
    });
  }
  if (type === "export_jsonl") return { path: runtime.session.exportToJsonl(command.outputPath) };
  if (type === "export_html") return { path: await runtime.session.exportToHtml(command.outputPath) };
  if (type === "reload") {
    await runtime.session.reload();
    ensureCoreToolsActive(runtime.session);
    return buildOverview();
  }
  if (type === "set_active_tools") {
    const required = runtime.session.getAllTools()
      .map((tool) => String(tool?.name || tool))
      .filter((name) => name.startsWith("mmm_"));
    const requested = Array.isArray(command.toolNames) ? command.toolNames.map(String) : [];
    runtime.session.setActiveToolsByName([...new Set([...required, ...requested])]);
    return { all: runtime.session.getAllTools(), active: runtime.session.getActiveToolNames() };
  }
  if (type === "login") return agentModels.login(command);
  if (type === "logout") return agentModels.logout(command);
  if (type === "validate_provider_config") return agentModels.validateConfig(command);
  if (type === "upsert_provider_config") return agentModels.upsertConfig(command);
  if (type === "delete_provider_config") return agentModels.deleteConfig(command);
  if (type === "replace_settings") return replaceSettings(command);
  if (type === "package_install") return packageInstall(command);
  if (type === "package_remove") return packageRemove(command);
  if (type === "package_update") return packageUpdate(command);
  if (type === "trust_set") {
    const store = new ProjectTrustStore(getAgentDir());
    const trusted = Boolean(command.trusted);
    store.set(runtime.cwd, trusted);
    projectTrustByCwd.set(runtime.cwd, trusted);
    if (runtime.session.sessionFile) {
      await runtime.switchSession(runtime.session.sessionFile, { cwdOverride: runtime.cwd });
    }
    return buildOverview();
  }
  throw new Error(`Unknown Pi Agent control command: ${type}`);
}

async function buildOverview() {
  const session = runtime.session;
  const loader = runtime.services.resourceLoader;
  const settings = settingsSnapshot();
  const packages = new DefaultPackageManager({
    cwd: runtime.cwd,
    agentDir: runtime.services.agentDir,
    settingsManager: runtime.services.settingsManager
  });
  const resolved = await packages.resolve(async () => "skip");
  return {
    cwd: runtime.cwd,
    scratch: bootstrap.scratch,
    session: {
      id: session.sessionId,
      file: session.sessionFile,
      name: session.sessionName,
      thinkingLevel: session.thinkingLevel,
      model: sanitizeModel(session.model),
      streaming: session.isStreaming,
      stats: session.getSessionStats()
    },
    models: await agentModels.overview(),
    sessions: await listSessions(),
    tools: { all: session.getAllTools(), active: session.getActiveToolNames() },
    commands: [
      ...session.extensionRunner.getRegisteredCommands().map((item) => ({ name: item.invocationName, description: item.description, source: "extension" })),
      ...session.promptTemplates.map((item) => ({ name: item.name, description: item.description, source: "prompt" })),
      ...loader.getSkills().skills.map((item) => ({ name: `skill:${item.name}`, description: item.description, source: "skill" }))
    ],
    resources: {
      extensions: loader.getExtensions().extensions.map((item) => ({ path: item.path, hidden: item.hidden, sourceInfo: item.sourceInfo })),
      extensionErrors: loader.getExtensions().errors,
      skills: loader.getSkills(),
      prompts: loader.getPrompts(),
      themes: loader.getThemes(),
      resolved
    },
    packages: packages.listConfiguredPackages(),
    settings,
    trust: {
      required: hasTrustRequiringProjectResources(runtime.cwd),
      trusted: runtime.services.settingsManager.isProjectTrusted(),
      saved: new ProjectTrustStore(runtime.services.agentDir).get(runtime.cwd)
    },
    diagnostics: runtime.diagnostics
  };
}

async function listSessions() {
  const sessions = await SessionManager.list(runtime.cwd, runtime.services.settingsManager.getSessionDir());
  return sessions.map((session) => ({
    ...session,
    created: session.created.toISOString(),
    modified: session.modified.toISOString()
  }));
}

async function replaceSettings(command) {
  const scope = command.scope === "project" ? "project" : "global";
  if (scope === "project" && !runtime.services.settingsManager.isProjectTrusted()) {
    throw new Error("Project settings cannot be changed until this project is trusted.");
  }
  const value = command.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Settings must be a JSON object.");
  const path = scope === "global"
    ? join(runtime.services.agentDir, "settings.json")
    : join(runtime.cwd, ".pi", "settings.json");
  const current = readJsonObject(path);
  const currentHash = jsonHash(current);
  if (command.expectedRevision && command.expectedRevision !== currentHash) {
    throw new Error("Settings changed in another window. Reload before saving.");
  }
  await writeJsonLocked(path, value);
  await runtime.services.settingsManager.reload();
  await runtime.session.reload();
  ensureCoreToolsActive(runtime.session);
  return settingsSnapshot();
}

function settingsSnapshot() {
  const manager = runtime.services.settingsManager;
  const global = readJsonObject(join(runtime.services.agentDir, "settings.json"));
  const project = readJsonObject(join(runtime.cwd, ".pi", "settings.json"));
  return {
    global,
    project,
    revisions: { global: jsonHash(global), project: jsonHash(project) },
    errors: manager.drainErrors().map((item) => ({ scope: item.scope, error: readableError(item.error) }))
  };
}

async function packageInstall(command) {
  const source = String(command.source || "").trim();
  if (!source) throw new Error("Package source is required.");
  const confirmed = await requestHost("confirm", {
    title: "Install Pi package?",
    message: `Packages can execute code with your user privileges.\n\n${source}`,
    destructive: true
  });
  if (!confirmed?.confirmed) throw new Error("Package installation cancelled.");
  const manager = packageManagerWithProgress();
  await manager.installAndPersist(source, { local: Boolean(command.local) });
  await runtime.services.settingsManager.flush();
  await runtime.session.reload();
  ensureCoreToolsActive(runtime.session);
  return buildOverview();
}

async function packageRemove(command) {
  const source = String(command.source || "").trim();
  if (!source) throw new Error("Package source is required.");
  const manager = packageManagerWithProgress();
  await manager.removeAndPersist(source, { local: Boolean(command.local) });
  await runtime.services.settingsManager.flush();
  await runtime.session.reload();
  ensureCoreToolsActive(runtime.session);
  return buildOverview();
}

async function packageUpdate(command) {
  const manager = packageManagerWithProgress();
  await manager.update(command.source ? String(command.source) : undefined);
  await runtime.session.reload();
  ensureCoreToolsActive(runtime.session);
  return buildOverview();
}

function ensureCoreToolsActive(session) {
  const active = session.getActiveToolNames().map(String);
  const required = session.getAllTools()
    .map((tool) => String(tool?.name || tool))
    .filter((name) => name.startsWith("mmm_"));
  session.setActiveToolsByName([...new Set([...required, ...active])]);
}

function packageManagerWithProgress() {
  const manager = new DefaultPackageManager({
    cwd: runtime.cwd,
    agentDir: runtime.services.agentDir,
    settingsManager: runtime.services.settingsManager
  });
  manager.setProgressCallback((event) => send({ type: "control_event", event: { type: "package_progress", event } }));
  return manager;
}

function requestHost(method, params, signals = []) {
  const id = `host_${crypto.randomUUID()}`;
  return new Promise((resolvePromise, reject) => {
    const activeSignals = signals.filter(Boolean);
    let settled = false;
    const cleanup = () => activeSignals.forEach((signal) => signal.removeEventListener("abort", abort));
    const abort = () => {
      if (settled) return;
      settled = true;
      pendingHostRequests.delete(id);
      cleanup();
      send({ type: "control_event", event: { type: "host_request_cancelled", id } });
      reject(abortError("认证提示已取消。"));
    };
    if (activeSignals.some((signal) => signal.aborted)) {
      abort();
      return;
    }
    activeSignals.forEach((signal) => signal.addEventListener("abort", abort, { once: true }));
    pendingHostRequests.set(id, {
      cleanup,
      resolve(value) {
        if (settled) return;
        settled = true;
        cleanup();
        resolvePromise(value);
      },
      reject(error) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      }
    });
    send({ type: "host_request", id, method, params });
  });
}

function abortError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    details: value
  };
}

function sanitizeModel(model) {
  if (!model) return null;
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    api: model.api,
    reasoning: Boolean(model.reasoning),
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens
  };
}

function workspaceSystemPrompt(scratch) {
  return `You are the built-in agent for Mermaid Canvas Editor.
The live editor is the source of truth for every open document. Always use mmm_get_workspace_context and mmm_read_open_document before editing an open document, then use mmm_apply_open_document_patch with its current revision. Never use ordinary file tools on an open document.
References contain stable document/entity IDs. Do not guess a target from a duplicate label.
${scratch ? "This workspace has no project. Only the current live document is available; filesystem and shell tools are disabled." : "For unopened project files, use Pi's normal project tools. Keep edits scoped to the current project unless the user explicitly approves otherwise."}`;
}

function toolPath(input) {
  if (!input || typeof input !== "object") return "";
  return typeof input.path === "string" ? input.path : typeof input.filePath === "string" ? input.filePath : "";
}

function isInside(root, target) {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function projectTrustOptions(cwd) {
  const target = resolve(cwd);
  const parent = dirname(target);
  const options = [
    { label: "Trust", trusted: true, updates: [{ path: target, decision: true }] }
  ];
  if (parent !== target) {
    options.push({
      label: `Trust parent folder (${parent})`,
      trusted: true,
      updates: [{ path: parent, decision: true }, { path: target, decision: null }]
    });
  }
  options.push(
    { label: "Trust (this session only)", trusted: true, updates: [] },
    { label: "Do not trust", trusted: false, updates: [{ path: target, decision: false }] },
    { label: "Do not trust (this session only)", trusted: false, updates: [] }
  );
  return options;
}

function isSensitivePath(target) {
  const normalized = target.replaceAll("\\", "/").toLowerCase();
  return ["/.ssh", "/.aws", "/.gnupg", "/.config/gcloud", "/.kube", "/keychains", "/login data", "/credentials", "/auth.json", "/etc/"].some((part) => normalized.includes(part));
}

function referencesSensitivePath(command) {
  const normalized = command.replaceAll("\\", "/").toLowerCase();
  return ["~/.ssh", "$home/.ssh", "~/.aws", "$home/.aws", "/etc/", "auth.json", "credentials", "login data"].some((part) => normalized.includes(part));
}

function isDangerousCommand(command) {
  return [
    /\brm\s+(?:-[a-z]*r[a-z]*f|--recursive\b)/i,
    /\bgit\s+reset\s+--hard\b/i,
    /\bgit\s+clean\s+-[^\s]*[dxf][^\s]*/i,
    /\bgit\s+push\b[^\n]*(?:--force|-f\b)/i,
    /\bsudo\b/i,
    /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sh|bash|zsh)\b/i,
    /\b(?:chmod|chown)\b[^\n]*(?:-R|--recursive)/i,
    /\b(?:mkfs|fdisk|shutdown|reboot|systemctl)\b/i
  ].some((pattern) => pattern.test(command));
}

function likelyOutsideMutation(command, cwd) {
  if (!/\b(?:rm|mv|cp|mkdir|touch|tee|sed\s+-i|git\s+-C)\b/i.test(command)) return false;
  const absolutePaths = command.match(/(?:^|\s)(\/(?:[^\s'";|])+)/g) || [];
  return absolutePaths.some((item) => !isInside(cwd, item.trim()));
}

function readJsonObject(path) {
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Invalid JSON object: ${path}`);
  return parsed;
}

function jsonHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function writeJsonLocked(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const release = await lockfile.lock(dirname(path), { realpath: false, lockfilePath: `${path}.lock` });
  try {
    const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporary, path);
  } finally {
    await release();
  }
}

function send(message) {
  if (typeof process.send === "function") process.send(message);
}

function fatal(error) {
  send({ type: "fatal", error: readableError(error) });
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
}

function readableError(error) {
  return error instanceof Error ? error.message : String(error);
}
