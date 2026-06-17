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
const DEFAULT_AI_SERVER_URL = "http://127.0.0.1:3000";
const DEFAULT_AI_CONTEXT_TIMEOUT_MS = 2000;
const DEFAULT_AI_APPLY_TIMEOUT_MS = 30_000;

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
  const server = normalizeServerUrl(options.server);

  try {
    const response = await fetchJson<AiContextResponse>(`${server}/api/ai/context`, options.timeoutMs);
    return { ...envelope("context", undefined, Boolean(response.ok && response.context), response.context, response.diagnostics || []), server };
  } catch (error) {
    return {
      ...envelope<AiEditorContext>("context", undefined, false, undefined, [
        cliDiagnostic(
          "EDITOR_CONTEXT_UNAVAILABLE",
          `无法连接编辑器上下文服务：${errorMessage(error)}`,
          `确认 WebUI 正在运行，或通过 --server 指定地址。默认地址：${DEFAULT_AI_SERVER_URL}`
        )
      ]),
      server
    };
  }
}

export async function submitAiApplyCommand(input: PatchInput, options: CliApplyOptions = {}): Promise<CliEnvelope<AiApplyResult>> {
  const server = normalizeServerUrl(options.server);
  const timeoutMs = options.timeoutMs ?? DEFAULT_AI_APPLY_TIMEOUT_MS;
  const ops = normalizePatchInputForCommand(input);
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
      }
    );

    if (!response.ok || !response.command) {
      return { ...envelope<AiApplyResult>("apply", options.targetFileName, false, undefined, response.diagnostics || []), server };
    }

    const result = await waitForAiApplyResult(server, response.command.id, timeoutMs);
    const ok = Boolean(result.ok && result.result?.applied);
    return { ...envelope("apply", result.result?.fileName || options.targetFileName, ok, result.result, result.diagnostics || []), server };
  } catch (error) {
    return {
      ...envelope<AiApplyResult>("apply", options.targetFileName, false, undefined, [
        cliDiagnostic(
          "EDITOR_APPLY_UNAVAILABLE",
          `无法通过 WebUI 实时应用修改：${errorMessage(error)}`,
          `确认 WebUI 正在运行，并通过 --server 指定正确地址。默认地址：${DEFAULT_AI_SERVER_URL}`
        )
      ]),
      server
    };
  }
}

export async function pingAiEditorContext(options: CliContextOptions = {}): Promise<CliEnvelope<AiContextPingResult>> {
  const server = normalizeServerUrl(options.server);

  try {
    const response = await fetchJson<{
      ok: boolean;
      editorContext?: { available?: boolean; stale?: boolean; updatedAt?: string };
      diagnostics?: EditorDiagnostic[];
    }>(`${server}/api/ai/ping`, options.timeoutMs);

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
            `先启动 WebUI，或通过 --server 指定地址。默认地址：${DEFAULT_AI_SERVER_URL}`
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
        context: "读取 WebUI 当前实时上下文：选中、编辑、可见区域、焦点排序、最近操作和诊断。",
        apply: "通过 WebUI 当前会话实时应用结构化修改，并等待编辑器返回保存状态与 diff。",
        ping: "检查 WebUI 服务与上下文缓存是否可用。",
        schema: "输出 AI 上下文返回结构示例。",
        read: "读取 Mermaid 文件并返回结构化图模型。",
        patch: "对 Mermaid 文件应用结构化修改操作。",
        diff: "比较两个 Mermaid 文件的语义和布局变化。",
        validate: "使用官方 Mermaid parser 校验语法。",
        layout: "执行 Dagre 自动布局并更新 canvas-layout 元数据。"
      },
      endpoints: {
        "GET /api/ai/context": "返回最新 WebUI 上下文。上下文超过 ttlMs 会 stale=true。",
        "POST /api/ai/context": "WebUI 上报最新上下文。CLI 通常不需要直接调用。",
        "POST /api/ai/commands": "CLI 提交需要 WebUI 会话执行的命令。",
        "GET /api/ai/commands/next": "WebUI 领取下一条待执行命令。",
        "GET /api/ai/commands/:id": "CLI 等待命令执行结果。",
        "POST /api/ai/commands/:id/result": "WebUI 上报命令执行结果。",
        "GET /api/ai/ping": "检查本地编辑器服务与上下文状态。"
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
  return DEFAULT_AI_SERVER_URL;
}

export function parseTimeoutMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeServerUrl(value: string | undefined) {
  return (value || process.env.MMM_SERVER_URL || DEFAULT_AI_SERVER_URL).replace(/\/+$/, "");
}

function normalizePatchInputForCommand(input: PatchInput): PatchOperation[] | null {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray(input.ops)) return input.ops;
  return null;
}

async function waitForAiApplyResult(server: string, commandId: string, timeoutMs: number): Promise<AiCommandResultResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
    const response = await fetchJson<AiCommandResultResponse>(`${server}/api/ai/commands/${encodeURIComponent(commandId)}`, Math.min(remainingMs, DEFAULT_AI_CONTEXT_TIMEOUT_MS));
    if (response.result) return response;
    if (!response.ok && response.status !== "pending") return response;
    await sleep(350);
  }

  return {
    ok: false,
    status: "timeout",
    diagnostics: [cliDiagnostic("EDITOR_APPLY_TIMEOUT", `WebUI 在 ${timeoutMs}ms 内没有返回 apply 执行结果。`, "确认浏览器页面仍在运行，并且没有被断点或弹窗阻塞。")]
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, timeoutMs = DEFAULT_AI_CONTEXT_TIMEOUT_MS, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

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
