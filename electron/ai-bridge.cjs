const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const MAX_RESULTS = 40;

function createAiBridge(appVersion, options = {}) {
  const state = {
    context: null,
    commands: [],
    results: new Map()
  };
  const token = crypto.randomUUID();
  let serverUrl = "";
  let server = null;

  async function start() {
    if (server) return { serverUrl, token };
    server = http.createServer((request, response) => {
      void handleRequest(request, response, state, token, serverUrl);
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("AI bridge did not bind to a local TCP port.");
    serverUrl = `http://127.0.0.1:${address.port}`;
    await writeDiscovery(address.port, token, appVersion, options.discoveryDir);
    return { serverUrl, token };
  }

  async function close() {
    if (!server) return;
    const current = server;
    server = null;
    await new Promise((resolve) => current.close(() => resolve()));
  }

  return {
    start,
    close,
    publishContext(context) {
      state.context = context;
    },
    takeNextCommand() {
      const now = Date.now();
      state.commands = state.commands.filter((command) => Date.parse(command.expiresAt || "") > now);
      return state.commands.shift() || null;
    },
    finishCommand(result) {
      const commandId = result?.commandId;
      if (typeof commandId !== "string" || !commandId) throw new Error("AI command result is missing commandId.");
      state.results.set(commandId, result);
      while (state.results.size > MAX_RESULTS) {
        const [firstKey] = state.results.keys();
        state.results.delete(firstKey);
      }
    }
  };
}

async function handleRequest(request, response, state, token, serverUrl) {
  const url = new URL(request.url || "/", serverUrl || "http://127.0.0.1");
  if (!isAuthorized(request, token)) {
    respondJson(response, 401, {
      ok: false,
      diagnostics: [diagnostic("UNAUTHORIZED", "AI bridge token 无效。", "重新打开桌面应用后再执行 CLI 命令。")]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ai/ping") {
    respondJson(response, 200, pingResponse(state, serverUrl));
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/ai/context") {
    respondJson(response, 200, contextResponse(state));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/ai/commands") {
    respondJson(response, 200, submitCommand(state, await readRequestJson(request)));
    return;
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/ai/commands/")) {
    const commandId = decodeURIComponent(url.pathname.replace("/api/ai/commands/", "").replace(/\/result$/, ""));
    respondJson(response, 200, resultResponse(state, commandId));
    return;
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/ai/commands/") && url.pathname.endsWith("/result")) {
    const commandId = decodeURIComponent(url.pathname.replace("/api/ai/commands/", "").replace(/\/result$/, ""));
    state.results.set(commandId, await readRequestJson(request));
    respondJson(response, 200, { ok: true, diagnostics: [] });
    return;
  }

  respondJson(response, 200, {
    ok: false,
    diagnostics: [diagnostic("NOT_FOUND", "未知 AI bridge 路径。", null)]
  });
}

function contextResponse(state) {
  if (state.context) {
    return {
      ok: true,
      context: state.context,
      diagnostics: []
    };
  }
  return {
    ok: false,
    diagnostics: [diagnostic("NO_ACTIVE_EDITOR_CONTEXT", "当前没有可用的编辑器上下文。", "请先打开桌面编辑器，并保持窗口处于运行状态。")]
  };
}

function pingResponse(state, serverUrl) {
  const updatedAt = typeof state.context?.updatedAt === "string" ? state.context.updatedAt : undefined;
  return {
    ok: true,
    server: serverUrl,
    editorContext: {
      available: Boolean(state.context),
      stale: !state.context,
      updatedAt
    },
    diagnostics: []
  };
}

function submitCommand(state, body) {
  const now = new Date();
  const command = {
    id: `cmd_${crypto.randomUUID()}`,
    type: typeof body?.type === "string" ? body.type : "applyPatch",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30_000).toISOString(),
    targetFileName: body?.targetFileName ?? null,
    ops: Array.isArray(body?.ops) ? body.ops : [],
    autoSave: typeof body?.autoSave === "boolean" ? body.autoSave : true
  };
  state.commands.push(command);
  return {
    ok: true,
    command,
    diagnostics: []
  };
}

function resultResponse(state, commandId) {
  const result = state.results.get(commandId);
  if (result) {
    return {
      ok: Boolean(result.applied),
      status: "complete",
      result,
      diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : []
    };
  }
  return {
    ok: true,
    status: "pending",
    diagnostics: []
  };
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function isAuthorized(request, token) {
  return request.headers.authorization === `Bearer ${token}`;
}

function respondJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function diagnostic(code, message, suggestion) {
  return {
    id: `bridge:${code}`,
    severity: "error",
    source: "serializer",
    code,
    message,
    suggestion
  };
}

async function writeDiscovery(port, token, appVersion, discoveryDir) {
  const filePath = path.join(discoveryDir || path.join(os.homedir(), ".mermaid-canvas-editor"), "bridge.json");
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(
    filePath,
    JSON.stringify(
      {
        port,
        token,
        pid: process.pid,
        appVersion,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
}

module.exports = {
  createAiBridge
};
