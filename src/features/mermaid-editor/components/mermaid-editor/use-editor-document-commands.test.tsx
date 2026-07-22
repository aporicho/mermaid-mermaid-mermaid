// @vitest-environment jsdom

import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useEditorDocumentCommands } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-commands";
import {
  createCanvasImageElement,
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import { createHistory } from "@/features/mermaid-editor/lib/editor-history";
import { createEmptyDocumentGraph } from "@/features/mermaid-editor/lib/editor-state";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import {
  DEFAULT_EDGE_ROUTING,
  DEFAULT_LAYOUT_MODE,
  type ClipboardPayload,
  type DiagramType,
  type EditableKind,
  type EditorMode,
  type EditorSnapshot,
  type Selection
} from "@/features/mermaid-editor/lib/editor-types";
import { defaultNodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";

const originalCanvas: CanvasDocument = {
  schema: "mmm.canvas",
  version: 1,
  viewport: { x: 160, y: 90, scale: 1 },
  elements: []
};

const firstImage = createCanvasImageElement(originalCanvas.elements, 100, 120, "assets/one.png", 240, 160);
const secondImage = createCanvasImageElement([firstImage], 372, 120, "assets/two.png", 180, 160);
const batchCanvas: CanvasDocument = {
  ...originalCanvas,
  elements: [firstImage, secondImage]
};

type ProbeState = {
  commands: ReturnType<typeof useEditorDocumentCommands>;
  canvasDocument: CanvasDocument;
  documentKind: "canvas" | "markdown" | "mermaid";
  history: ReturnType<typeof createHistory>;
  source: string;
};

describe("useEditorDocumentCommands Canvas history", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let state: ProbeState | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<Probe onState={(nextState) => { state = nextState; }} />));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
    state = null;
  });

  it("captures one snapshot for a batch Canvas update and restores the original document on undo", () => {
    act(() => state?.commands.applyCanvasDocument(batchCanvas, "已添加 2 张图片。"));

    expect(state?.canvasDocument).toEqual(batchCanvas);
    expect(state?.history.undoStack).toHaveLength(1);
    expect(state?.history.undoStack[0]).toMatchObject({
      documentKind: "canvas",
      source: serializeCanvasDocument(originalCanvas)
    });

    act(() => state?.commands.applyEditorCommand({ type: "history.undo", source: "api" }));

    expect(state?.documentKind).toBe("canvas");
    expect(state?.canvasDocument).toEqual(originalCanvas);
    expect(state?.source).toBe(serializeCanvasDocument(originalCanvas));
    expect(state?.history.undoStack).toHaveLength(0);
    expect(state?.history.redoStack).toHaveLength(1);
  });
});

function Probe({ onState }: { onState: (state: ProbeState) => void }) {
  const [documentKind, setDocumentKind] = useState<ProbeState["documentKind"]>("canvas");
  const [source, setSource] = useState(serializeCanvasDocument(originalCanvas));
  const [canvasDocument, setCanvasDocument] = useState(originalCanvas);
  const [graph, setGraph] = useState(createEmptyDocumentGraph());
  const [history, setHistory] = useState(createHistory());
  const [selection, setSelection] = useState<Selection>({ nodeIds: [], edgeIds: [], subgraphIds: [] });
  const [viewport, setViewport] = useState(originalCanvas.viewport);
  const [edgeRouting, setEdgeRouting] = useState(DEFAULT_EDGE_ROUTING);
  const [layoutMode, setLayoutMode] = useState(DEFAULT_LAYOUT_MODE);
  const [workspaceView, setWorkspaceView] = useState<"canvas" | "render" | "source" | "markdown">("canvas");
  const [viewFilters, setViewFilters] = useState(DEFAULT_VIEW_FILTERS);
  const [, setDiagramType] = useState<DiagramType>("unknown");
  const [, setEditableKind] = useState<EditableKind>("render-only");
  const [, setMode] = useState<EditorMode>("select");
  const [, setClipboard] = useState<ClipboardPayload | null>(null);
  const [, setDiagnostics] = useState<EditorDiagnostic[]>([]);
  const [, setStatus] = useState("");
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);

  const commands = useEditorDocumentCommands({
    documentKind,
    source,
    graph,
    history,
    selection,
    viewport,
    edgeRouting,
    layoutMode,
    workspaceView,
    viewFilters,
    isCanvasEditable: false,
    nodeGeometrySpec: defaultNodeGeometrySpec(),
    sourceEditBaseRef,
    sourceEditTimerRef,
    setDocumentKind,
    setSource,
    setCanvasDocument,
    setGraph,
    setDiagramType,
    setEditableKind,
    setMode,
    setClipboard,
    setHistory,
    setSelection,
    setViewport,
    setEdgeRouting,
    setLayoutMode,
    setWorkspaceView,
    setViewFilters,
    setDiagnostics,
    setStatus,
    recordRecentAction: () => undefined
  });

  onState({ commands, canvasDocument, documentKind, history, source });
  return null;
}
