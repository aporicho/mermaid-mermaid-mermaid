import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { EdgeRouting, LayoutMode, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
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
  type PatchInput
} from "@/features/mermaid-editor/lib/mermaid-patch";

export type { DiffResult, GraphSummary, MermaidPatchResult, PatchInput, PatchOperation } from "@/features/mermaid-editor/lib/mermaid-patch";

export type CliEnvelope<T> = {
  ok: boolean;
  command: string;
  file?: string;
  result?: T;
  diagnostics: EditorDiagnostic[];
};

export type CliLayoutOptions = {
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
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

const DEFAULT_VIEWPORT: ViewportState = { x: 160, y: 90, scale: 1 };
const VALID_EDGE_ROUTINGS = new Set<EdgeRouting>(["straight", "bezier", "orthogonal", "mermaid"]);
const VALID_LAYOUT_MODES = new Set<LayoutMode>(["manual", "auto"]);

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
  return envelope("diff", file, true, diffDocuments(before, after), []);
}

export async function patchMermaidDocument(
  source: string,
  input: PatchInput,
  options: { file?: string; write?: boolean } = {}
): Promise<CliEnvelope<WritePreviewResult>> {
  const result = applyMermaidPatch(source, input, { write: Boolean(options.write) });
  if (!result.ok || !result.result) return envelope<WritePreviewResult>("patch", options.file, false, undefined, result.diagnostics);
  const diagnostics = await validateSourceSyntax(result.result.source);
  if (diagnostics.length) return envelope<WritePreviewResult>("patch", options.file, false, undefined, diagnostics);
  return envelope("patch", options.file, true, result.result, []);
}

export async function layoutMermaidDocument(
  source: string,
  options: CliLayoutOptions & { file?: string; write?: boolean } = {}
): Promise<CliEnvelope<WritePreviewResult>> {
  const document = loadMermaidDocument(source);
  if (document.editableKind !== "flowchart") return unsupportedEnvelope("layout", options.file, document);

  const edgeRouting = options.edgeRouting ?? document.edgeRouting;
  const layoutMode = options.layoutMode ?? "auto";
  const nextGraph = applyDagreAutoLayout(document.graph);
  const nextSource = buildSourceFromDocument(document, nextGraph, document.viewport || DEFAULT_VIEWPORT, edgeRouting, layoutMode);
  const diagnostics = await validateSourceSyntax(nextSource);
  if (diagnostics.length) return envelope<WritePreviewResult>("layout", options.file, false, undefined, diagnostics);

  const nextDocument = loadMermaidDocument(nextSource);
  return envelope("layout", options.file, true, {
    source: nextSource,
    changed: nextSource !== normalizeDocumentText(source),
    written: Boolean(options.write),
    diff: diffDocuments(document, nextDocument),
    graph: graphSummary(nextDocument.graph)
  }, []);
}

export function parseEdgeRouting(value: string | undefined): EdgeRouting | undefined {
  return VALID_EDGE_ROUTINGS.has(value as EdgeRouting) ? value as EdgeRouting : undefined;
}

export function parseLayoutMode(value: string | undefined): LayoutMode | undefined {
  return VALID_LAYOUT_MODES.has(value as LayoutMode) ? value as LayoutMode : undefined;
}

function envelope<T>(command: string, file: string | undefined, ok: boolean, result: T | undefined, diagnostics: EditorDiagnostic[]): CliEnvelope<T> {
  return { ok, command, file, ...(result === undefined ? {} : { result }), diagnostics };
}

function unsupportedEnvelope<T>(command: string, file: string | undefined, document: MermaidDocument): CliEnvelope<T> {
  return envelope<T>(command, file, false, undefined, [cliDiagnostic(
    "UNSUPPORTED_DIAGRAM_TYPE",
    `当前命令只支持 flowchart，可读取但不能结构化修改 ${document.diagramType} 图。`,
    "对非 flowchart 图先使用 read/validate，或在源码层手动修改。"
  )]);
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
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
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

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}
