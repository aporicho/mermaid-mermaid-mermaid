import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import { aiContextSchemaExample, type AiEditorContext } from "@/features/mermaid-editor/lib/ai-context";
import type { AiContextResponse } from "@/features/mermaid-editor/lib/ai-context-store";
import type { AiApplyCommandResponse, AiApplyResult, AiCommandResultResponse } from "@/features/mermaid-editor/lib/ai-command-types";
import type {
  EdgeRouting,
  LayoutMode,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import { normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { loadMermaidDocument, type MermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import {
  applyMermaidPatch,
  buildSourceFromDocument,
  diffDocuments,
  graphSummary,
  type DiffResult,
  type GraphSummary,
  type MermaidPatchResult,
  type PatchInput,
  type PatchOperation
} from "@/features/mermaid-editor/lib/mermaid-patch";

export type { DiffResult, GraphSummary, MermaidPatchResult, PatchInput, PatchOperation } from "@/features/mermaid-editor/lib/mermaid-patch";

export type CliEnvelope<T> = {
  ok: boolean;
  command: string;
  file?: string;
  server?: string;
  result?: T;
  diagnostics: EditorDiagnostic[];
};

export type CliLayoutOptions = {
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
};

export type CliContextOptions = {
  server?: string;
  timeoutMs?: number;
};

export type AiContextPingResult = {
  server: string;
  reachable: boolean;
  contextAvailable: boolean;
  stale: boolean;
  updatedAt?: string;
};

export type AiContextSchemaResult = {
  commands: Record<string, string>;
  endpoints: Record<string, string>;
  contextExample: AiEditorContext;
};

type ReadResult = {
  diagramType: MermaidDocument["diagramType"];
  editableKind: MermaidDocument["editableKind"];
  parseStatus: MermaidDocument["parseStatus"];
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  viewport?: ViewportState;
  source: string;
  graph: GraphSummary;
};

type WritePreviewResult = MermaidPatchResult;

export type CliApplyOptions = CliContextOptions & {
  targetFileName?: string;
  autoSave?: boolean;
};

const DEFAULT_VIEWPORT: ViewportState = { x: 160, y: 90, scale: 1 };
const VALID_EDGE_ROUTINGS = new Set<EdgeRouting>(["straight", "bezier", "orthogonal", "mermaid"]);
const VALID_LAYOUT_MODES = new Set<LayoutMode>(["manual", "auto"]);
const AI_BRIDGE_DISCOVERY_PATH = join(homedir(), ".mermaid-canvas-editor", "bridge.json");
const DEFAULT_AI_SERVER_LABEL = `desktop discovery (${AI_BRIDGE_DISCOVERY_PATH})`;
const DEFAULT_AI_CONTEXT_TIMEOUT_MS = 2000;
const DEFAULT_AI_APPLY_TIMEOUT_MS = 30_000;

type ResolvedAiBridge = {
  server: string;
  token?: string;
  diagnostics?: EditorDiagnostic[];
};

type MermaidApi = typeof import("mermaid").default;

let mermaidApi: MermaidApi | null = null;

export function readMermaidDocument(source: string, file?: string): CliEnvelope<ReadResult> {
  const document = loadMermaidDocument(source);

  return envelope("read", file, true, readResult(document), []);
}

export async function validateMermaidDocument(source: string, file?: string): Promise<CliEnvelope<ReadResult>> {
  const diagnostics = await validateSourceSyntax(source);
  const document = loadMermaidDocument(source);

  return envelope("validate", file, diagnostics.length === 0, readResult(document), diagnostics);
}

export function diffMermaidDocuments(beforeSource: string, afterSource: string, file?: string): CliEnvelope<DiffResult> {
  const before = loadMermaidDocument(beforeSource);
  const after = loadMermaidDocument(afterSource);
  const diff = diffDocuments(before, after);

  return envelope("diff", file, true, diff, []);
}

export async function patchMermaidDocument(source: string, input: PatchInput, options: { file?: string; write?: boolean } = {}): Promise<CliEnvelope<WritePreviewResult>> {
  const result = applyMermaidPatch(source, input, { write: Boolean(options.write) });
  if (!result.ok || !result.result) return envelope<WritePreviewResult>("patch", options.file, false, undefined, result.diagnostics);

  const diagnostics = await validateSourceSyntax(result.result.source);
  if (diagnostics.length) return envelope<WritePreviewResult>("patch", options.file, false, undefined, diagnostics);

  return envelope("patch", options.file, true, result.result, []);
}

export async function layoutMermaidDocument(source: string, options: CliLayoutOptions & { file?: string; write?: boolean } = {}): Promise<CliEnvelope<WritePreviewResult>> {
  const document = loadMermaidDocument(source);
  if (document.editableKind !== "flowchart") {
    return unsupportedEnvelope("layout", options.file, document);
  }

  const edgeRouting = options.edgeRouting ?? document.edgeRouting;
  const layoutMode = options.layoutMode ?? "auto";
  const nextGraph = applyDagreAutoLayout(document.graph);
  const nextSource = buildSourceFromDocument(document, nextGraph, document.viewport || DEFAULT_VIEWPORT, edgeRouting, layoutMode);
  const diagnostics = await validateSourceSyntax(nextSource);
  if (diagnostics.length) return envelope<WritePreviewResult>("layout", options.file, false, undefined, diagnostics);

  const nextDocument = loadMermaidDocument(nextSource);
  return envelope(
    "layout",
    options.file,
    true,
    {
      source: nextSource,
      changed: nextSource !== normalizeDocumentText(source),
      written: Boolean(options.write),
      diff: diffDocuments(document, nextDocument),
      graph: graphSummary(nextDocument.graph)
    },
    []
  );
}

export async function fetchAiEditorContext(options: CliContextOptions = {}): Promise<CliEnvelope<AiEditorContext>> {
  const bridge = resolveAiBridge(options.server);
  const server = bridge.server;

  if (bridge.diagnostics?.length) {
    return { ...envelope<AiEditorContext>("context", undefined, false, undefined, bridge.diagnostics), server };
  }

  try {
    const response = await fetchJson<AiContextResponse>(`${server}/api/ai/context`, options.timeoutMs, {}, bridge.token);
    return { ...envelope("context", undefined, Boolean(response.ok && response.context), response.context, response.diagnostics || []), server };
  } catch (error) {
    return {
      ...envelope<AiEditorContext>("context", undefined, false, undefined, [
        cliDiagnostic(
          "EDITOR_CONTEXT_UNAVAILABLE",
          `无法连接编辑器上下文服务：${errorMessage(error)}`,
          `确认桌面编辑器正在运行，或通过 --server 指定地址。默认来源：${DEFAULT_AI_SERVER_LABEL}`
        )
      ]),
      server
    };
  }
}

export async function submitAiApplyCommand(input: PatchInput, options: CliApplyOptions = {}): Promise<CliEnvelope<AiApplyResult>> {
  const bridge = resolveAiBridge(options.server);
  const server = bridge.server;
  const timeoutMs = options.timeoutMs ?? DEFAULT_AI_APPLY_TIMEOUT_MS;
  const ops = normalizePatchInputForCommand(input);
  if (bridge.diagnostics?.length) {
    return { ...envelope<AiApplyResult>("apply", options.targetFileName, false, undefined, bridge.diagnostics), server };
  }
  if (!ops) {
    return {
      ...envelope<AiApplyResult>("apply", options.targetFileName, false, undefined, [
        cliDiagnostic("INVALID_PATCH_INPUT", "Apply 输入必须是操作数组，或包含 ops 数组的对象。")
      ]),
      server
    };
  }

  try {
    const response = await fetchJson<AiApplyCommandResponse>(
      `${server}/api/ai/commands`,
      Math.min(timeoutMs, DEFAULT_AI_CONTEXT_TIMEOUT_MS),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "applyPatch",
          ops,
          targetFileName: options.targetFileName,
          autoSave: options.autoSave ?? true
        })
      },
      bridge.token
    );

    if (!response.ok || !response.command) {
      return { ...envelope<AiApplyResult>("apply", options.targetFileName, false, undefined, response.diagnostics || []), server };
    }

    const result = await waitForAiApplyResult(server, response.command.id, timeoutMs, bridge.token);
    const ok = Boolean(result.ok && result.result?.applied);
    return { ...envelope("apply", result.result?.fileName || options.targetFileName, ok, result.result, result.diagnostics || []), server };
  } catch (error) {
    return {
      ...envelope<AiApplyResult>("apply", options.targetFileName, false, undefined, [
        cliDiagnostic(
          "EDITOR_APPLY_UNAVAILABLE",
          `无法通过桌面编辑器实时应用修改：${errorMessage(error)}`,
          `确认桌面编辑器正在运行，并通过 --server 指定正确地址。默认来源：${DEFAULT_AI_SERVER_LABEL}`
        )
      ]),
      server
    };
  }
}

export async function pingAiEditorContext(options: CliContextOptions = {}): Promise<CliEnvelope<AiContextPingResult>> {
  const bridge = resolveAiBridge(options.server);
  const server = bridge.server;

  if (bridge.diagnostics?.length) {
    return {
      ...envelope(
        "ping",
        undefined,
        false,
        {
          server,
          reachable: false,
          contextAvailable: false,
          stale: true
        },
        bridge.diagnostics
      ),
      server
    };
  }

  try {
    const response = await fetchJson<{
      ok: boolean;
      editorContext?: { available?: boolean; stale?: boolean; updatedAt?: string };
      diagnostics?: EditorDiagnostic[];
    }>(`${server}/api/ai/ping`, options.timeoutMs, {}, bridge.token);

    return {
      ...envelope(
        "ping",
        undefined,
        true,
        {
          server,
          reachable: true,
          contextAvailable: Boolean(response.editorContext?.available),
          stale: response.editorContext?.stale ?? true,
          updatedAt: response.editorContext?.updatedAt
        },
        response.diagnostics || []
      ),
      server
    };
  } catch (error) {
    return {
      ...envelope(
        "ping",
        undefined,
        false,
        {
          server,
          reachable: false,
          contextAvailable: false,
          stale: true
        },
        [
          cliDiagnostic(
            "EDITOR_SERVICE_UNREACHABLE",
            `无法连接编辑器服务：${errorMessage(error)}`,
            `先启动桌面编辑器，或通过 --server 指定地址。默认来源：${DEFAULT_AI_SERVER_LABEL}`
          )
        ]
      ),
      server
    };
  }
}

export function aiContextSchema(): CliEnvelope<AiContextSchemaResult> {
  return envelope(
    "schema",
    undefined,
    true,
    {
      commands: {
        context: "读取桌面编辑器当前实时上下文：选中、编辑、可见区域、焦点排序、最近操作和诊断。",
        apply: "通过桌面编辑器当前会话实时应用结构化修改，并等待编辑器返回保存状态与 diff。",
        ping: "检查桌面编辑器 bridge 与上下文缓存是否可用。",
        schema: "输出 AI 上下文返回结构示例。",
        read: "读取 Mermaid 文件并返回结构化图模型。",
        patch: "对 Mermaid 文件应用结构化修改操作。",
        diff: "比较两个 Mermaid 文件的语义和布局变化。",
        validate: "使用官方 Mermaid parser 校验语法。",
        layout: "执行 Dagre 自动布局并更新 canvas-layout 元数据。"
      },
      endpoints: {
        "discovery": AI_BRIDGE_DISCOVERY_PATH,
        "GET /api/ai/context": "返回最新桌面编辑器上下文。CLI 自动携带 discovery token。",
        "POST /api/ai/commands": "CLI 提交需要桌面编辑器会话执行的命令。",
        "GET /api/ai/commands/:id": "CLI 等待命令执行结果。",
        "GET /api/ai/ping": "检查本地桌面编辑器 bridge 与上下文状态。"
      },
      contextExample: aiContextSchemaExample()
    },
    []
  );
}

export function parseEdgeRouting(value: string | undefined): EdgeRouting | undefined {
  return VALID_EDGE_ROUTINGS.has(value as EdgeRouting) ? (value as EdgeRouting) : undefined;
}

export function parseLayoutMode(value: string | undefined): LayoutMode | undefined {
  return VALID_LAYOUT_MODES.has(value as LayoutMode) ? (value as LayoutMode) : undefined;
}

export function defaultAiServerUrl() {
  return resolveAiBridge().server;
}

export function parseTimeoutMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeServerUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveAiBridge(serverOverride?: string): ResolvedAiBridge {
  const explicitServer = serverOverride || process.env.MMM_SERVER_URL;
  if (explicitServer) {
    return {
      server: normalizeServerUrl(explicitServer),
      token: process.env.MMM_BRIDGE_TOKEN
    };
  }

  const discovered = readAiBridgeDiscovery();
  if (discovered) return discovered;

  return {
    server: DEFAULT_AI_SERVER_LABEL,
    diagnostics: [
      cliDiagnostic(
        "EDITOR_BRIDGE_NOT_FOUND",
        "没有找到正在运行的桌面编辑器 AI bridge。",
        `先启动桌面编辑器，或通过 --server 和 MMM_BRIDGE_TOKEN 指定 bridge。默认发现文件：${AI_BRIDGE_DISCOVERY_PATH}`
      )
    ]
  };
}

function readAiBridgeDiscovery(): ResolvedAiBridge | null {
  if (!existsSync(AI_BRIDGE_DISCOVERY_PATH)) return null;

  try {
    const raw = JSON.parse(readFileSync(AI_BRIDGE_DISCOVERY_PATH, "utf8")) as {
      port?: unknown;
      token?: unknown;
    };
    if (typeof raw.port !== "number" || typeof raw.token !== "string" || !raw.token) return null;
    return {
      server: `http://127.0.0.1:${raw.port}`,
      token: raw.token
    };
  } catch {
    return null;
  }
}

function normalizePatchInputForCommand(input: PatchInput): PatchOperation[] | null {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray(input.ops)) return input.ops;
  return null;
}

async function waitForAiApplyResult(server: string, commandId: string, timeoutMs: number, token?: string): Promise<AiCommandResultResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
    const response = await fetchJson<AiCommandResultResponse>(`${server}/api/ai/commands/${encodeURIComponent(commandId)}`, Math.min(remainingMs, DEFAULT_AI_CONTEXT_TIMEOUT_MS), {}, token);
    if (response.result) return response;
    if (!response.ok && response.status !== "pending") return response;
    await sleep(350);
  }

  return {
    ok: false,
    status: "timeout",
    diagnostics: [cliDiagnostic("EDITOR_APPLY_TIMEOUT", `桌面编辑器在 ${timeoutMs}ms 内没有返回 apply 执行结果。`, "确认桌面编辑器窗口仍在运行，并且没有被断点或弹窗阻塞。")]
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, timeoutMs = DEFAULT_AI_CONTEXT_TIMEOUT_MS, init: RequestInit = {}, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : `HTTP ${response.status}`);
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

function envelope<T>(command: string, file: string | undefined, ok: boolean, result: T | undefined, diagnostics: EditorDiagnostic[]): CliEnvelope<T> {
  return {
    ok,
    command,
    file,
    ...(result === undefined ? {} : { result }),
    diagnostics
  };
}

function unsupportedEnvelope<T>(command: string, file: string | undefined, document: MermaidDocument): CliEnvelope<T> {
  return envelope<T>(command, file, false, undefined, [
    cliDiagnostic(
      "UNSUPPORTED_DIAGRAM_TYPE",
      `当前命令只支持 flowchart，可读取但不能结构化修改 ${document.diagramType} 图。`,
      "对非 flowchart 图先使用 read/validate，或在源码层手动修改。"
    )
  ]);
}

function readResult(document: MermaidDocument): ReadResult {
  return {
    diagramType: document.diagramType,
    editableKind: document.editableKind,
    parseStatus: document.parseStatus,
    edgeRouting: document.edgeRouting,
    layoutMode: document.layoutMode,
    viewport: document.viewport,
    source: document.source,
    graph: graphSummary(document.graph)
  };
}

function normalizeDocumentText(value: string) {
  return `${value.trim()}\n`;
}

async function validateSourceSyntax(source: string) {
  try {
    const mermaid = await getMermaidApi();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose"
    });
    await mermaid.parse(stripCanvasLayout(source).trim());
    return [];
  } catch (error) {
    return [normalizeMermaidError(error, stripCanvasLayout(source).trim(), "mermaid-parse")];
  }
}

async function getMermaidApi() {
  if (mermaidApi) return mermaidApi;
  await ensureMermaidDom();
  mermaidApi = (await import("mermaid")).default;
  return mermaidApi;
}

async function ensureMermaidDom() {
  if (typeof document !== "undefined") return;

  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const window = dom.window;
  const globals: Record<string, unknown> = {
    window,
    document: window.document,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    DOMParser: window.DOMParser,
    XMLSerializer: window.XMLSerializer,
    NodeFilter: window.NodeFilter
  };

  for (const [key, value] of Object.entries(globals)) {
    if (!(key in globalThis)) Object.defineProperty(globalThis, key, { value, configurable: true });
  }
}

function cliDiagnostic(code: string, message: string, suggestion?: string): EditorDiagnostic {
  return {
    id: `cli:${code}:${hashText(message)}`,
    severity: "error",
    source: "serializer",
    code,
    message,
    suggestion
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.name === "AbortError" ? "请求超时" : error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
