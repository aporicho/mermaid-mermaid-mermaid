// @vitest-environment jsdom

import { act, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCsvTableFileSync } from "@/features/mermaid-editor/components/mermaid-editor/use-csv-table-file-sync";
import { updateNode } from "@/features/mermaid-editor/lib/editor-actions";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { defaultNodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { updateTableCell } from "@/features/mermaid-editor/lib/table-node";

const initialGraph: MermaidGraph = {
  direction: "TD",
  nodes: [{
    id: "T",
    label: "people",
    x: 10,
    y: 20,
    fill: "#fff",
    action: { kind: "file", path: "data/people.csv", openMode: "app-window" }
  }],
  edges: [],
  subgraphs: []
};

const workspace: ProjectWorkspace = {
  rootName: "project",
  rootPath: "/project",
  files: [],
  resources: [{ kind: "file", name: "people.csv", path: "/project/data/people.csv", relativePath: "data/people.csv" }],
  scannedAt: 1
};

describe("useCsvTableFileSync", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let renderedGraph = initialGraph;
  let updateGraph: Dispatch<SetStateAction<MermaidGraph>> | null = null;
  let flushPendingWrites: ((options?: { overwriteConflicts?: boolean }) => Promise<boolean>) | null = null;
  let discardPendingWrites: (() => Promise<void>) | null = null;
  let reloadExternalFiles: ((paths: ReadonlySet<string> | readonly string[]) => Promise<void>) | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderedGraph = initialGraph;
    updateGraph = null;
    flushPendingWrites = null;
    discardPendingWrites = null;
    reloadExternalFiles = null;
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  it("loads CSV into transient graph content and writes direct cell edits back with CAS", async () => {
    const writeCsvFile = vi.fn(async () => ({
      status: "saved" as const,
      file: { name: "people.csv", path: "/project/data/people.csv" },
      revision: "revision-2",
      modifiedAt: 2
    }));
    const runtime = {
      readCsvFile: vi.fn(async () => ({
        status: "opened" as const,
        snapshot: {
          file: { name: "people.csv", path: "/project/data/people.csv" },
          text: "Name,Role\r\nAlice,Designer",
          revision: "revision-1",
          modifiedAt: 1
        }
      })),
      writeCsvFile
    } as unknown as EditorRuntime;
    const showFileWorkflowError = vi.fn();

    await act(async () => {
      root?.render(<Probe runtime={runtime} onGraph={(graph, setter) => {
        renderedGraph = graph;
        updateGraph = setter;
      }} onFlush={(flush) => { flushPendingWrites = flush; }} onDiscard={(discard) => { discardPendingWrites = discard; }} showFileWorkflowError={showFileWorkflowError} />);
      await settle();
    });

    expect(renderedGraph.nodes[0].content?.kind).toBe("table");
    expect(renderedGraph.nodes[0].content?.rows[0].cells["column-1"]).toBe("Alice");
    expect(writeCsvFile).not.toHaveBeenCalled();

    await act(async () => {
      updateGraph?.((current) => {
        const node = current.nodes[0];
        if (node.content?.kind !== "table") return current;
        return updateNode(current, node.id, { content: updateTableCell(node.content, "row-1", "column-1", "Alicia") });
      });
      await settle();
    });

    expect(writeCsvFile).toHaveBeenCalledTimes(1);
    expect(writeCsvFile).toHaveBeenCalledWith(expect.objectContaining({
      rootPath: "/project",
      expectedRevision: "revision-1",
      text: "Name,Role\r\nAlicia,Designer"
    }));
    expect(showFileWorkflowError).not.toHaveBeenCalled();
  });

  it("flushes the latest queued edit before a file switch or window close", async () => {
    let releaseFirstWrite: () => void = () => undefined;
    let writeIndex = 0;
    const firstWriteGate = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
    const writeCsvFile = vi.fn(async (request: { text: string }) => {
      writeIndex += 1;
      if (writeIndex === 1) await firstWriteGate;
      return {
        status: "saved" as const,
        file: { name: "people.csv", path: "/project/data/people.csv" },
        revision: `revision-${writeIndex + 1}`,
        modifiedAt: writeIndex + 1,
        text: request.text
      };
    });
    const runtime = {
      readCsvFile: vi.fn(async () => ({
        status: "opened" as const,
        snapshot: {
          file: { name: "people.csv", path: "/project/data/people.csv" },
          text: "Name\r\nAlice",
          revision: "revision-1",
          modifiedAt: 1
        }
      })),
      writeCsvFile
    } as unknown as EditorRuntime;

    await act(async () => {
      root?.render(<Probe runtime={runtime} onGraph={(graph, setter) => {
        renderedGraph = graph;
        updateGraph = setter;
      }} onFlush={(flush) => { flushPendingWrites = flush; }} onDiscard={(discard) => { discardPendingWrites = discard; }} onReload={(reload) => { reloadExternalFiles = reload; }} showFileWorkflowError={vi.fn()} />);
      await settle();
    });
    await act(async () => {
      updateFirstCell("Alicia");
      await settle();
    });
    await act(async () => {
      updateFirstCell("Alina");
      await settle();
    });
    await act(async () => {
      updateGraph?.((current) => ({ ...current, nodes: [] }));
      await settle();
    });

    let flushed = false;
    await act(async () => {
      const pendingFlush = flushPendingWrites?.() ?? Promise.resolve(false);
      releaseFirstWrite();
      flushed = await pendingFlush;
    });

    expect(flushed).toBe(true);
    expect(writeCsvFile).toHaveBeenCalledTimes(2);
    expect(writeCsvFile.mock.calls[1]?.[0]).toMatchObject({ expectedRevision: "revision-2", text: "Name\r\nAlina" });
  });

  it("only overwrites an external conflict after explicit retry", async () => {
    const readCsvFile = vi.fn()
      .mockResolvedValueOnce(openedCsv("Name\r\nAlice", "revision-1"))
      .mockResolvedValueOnce(openedCsv("Name\r\nBob", "revision-2"));
    const writeCsvFile = vi.fn()
      .mockResolvedValueOnce({ status: "conflict" as const, revision: "revision-2", modifiedAt: 2 })
      .mockResolvedValueOnce({ status: "saved" as const, file: { name: "people.csv", path: "/project/data/people.csv" }, revision: "revision-3", modifiedAt: 3 });

    await renderProbe({ readCsvFile, writeCsvFile } as unknown as EditorRuntime);
    await act(async () => { updateFirstCell("Alicia"); await settle(); });

    await expect(flushPendingWrites?.()).resolves.toBe(false);
    expect(readCsvFile).toHaveBeenCalledTimes(1);
    expect(writeCsvFile).toHaveBeenCalledTimes(1);

    await expect(flushPendingWrites?.({ overwriteConflicts: true })).resolves.toBe(true);
    expect(readCsvFile).toHaveBeenCalledTimes(2);
    expect(writeCsvFile).toHaveBeenLastCalledWith(expect.objectContaining({ expectedRevision: "revision-2", text: "Name\r\nAlicia" }));
  });

  it("discards the local conflict and reloads the external CSV", async () => {
    const readCsvFile = vi.fn()
      .mockResolvedValueOnce(openedCsv("Name\r\nAlice", "revision-1"))
      .mockResolvedValueOnce(openedCsv("Name\r\nBob", "revision-2"));
    const writeCsvFile = vi.fn(async () => ({ status: "conflict" as const, revision: "revision-2", modifiedAt: 2 }));

    await renderProbe({ readCsvFile, writeCsvFile } as unknown as EditorRuntime);
    await act(async () => { updateFirstCell("Alicia"); await settle(); });
    await act(async () => { await discardPendingWrites?.(); await settle(); });

    expect(renderedGraph.nodes[0].content?.rows[0].cells["column-1"]).toBe("Bob");
    expect(renderedGraph.nodes[0].csvStatus).toBeUndefined();
    expect(writeCsvFile).toHaveBeenCalledTimes(1);
  });

  it("replaces local table state when the linked CSV changes on disk", async () => {
    const readCsvFile = vi.fn()
      .mockResolvedValueOnce(openedCsv("Name\r\nAlice", "revision-1"))
      .mockResolvedValueOnce(openedCsv("Name\r\nBob", "revision-2"))
      .mockResolvedValueOnce(openedCsv("Name\r\nBob", "revision-2"));

    await renderProbe({ readCsvFile, writeCsvFile: vi.fn() } as unknown as EditorRuntime);
    await act(async () => {
      await reloadExternalFiles?.(new Set(["/project/data/people.csv"]));
      await settle();
    });

    expect(renderedGraph.nodes[0].content?.rows[0].cells["column-1"]).toBe("Bob");
    expect(readCsvFile).toHaveBeenCalledTimes(3);
  });

  it("reflows the expanded CSV table when the canvas uses auto layout", async () => {
    const graphWithNeighbor: MermaidGraph = {
      ...initialGraph,
      nodes: [...initialGraph.nodes, { id: "B", label: "Neighbor", x: 10, y: 20, fill: "#fff" }]
    };
    const runtime = {
      readCsvFile: vi.fn(async () => openedCsv("Name,Role\r\nAlice,Designer", "revision-1")),
      writeCsvFile: vi.fn()
    } as unknown as EditorRuntime;

    await act(async () => {
      root?.render(<Probe runtime={runtime} initialState={graphWithNeighbor} layoutMode="auto" nodeGeometrySpec={defaultNodeGeometrySpec(() => 80)} onGraph={(graph, setter) => {
        renderedGraph = graph;
        updateGraph = setter;
      }} onFlush={(flush) => { flushPendingWrites = flush; }} onDiscard={(discard) => { discardPendingWrites = discard; }} onReload={(reload) => { reloadExternalFiles = reload; }} showFileWorkflowError={vi.fn()} />);
      await settle();
    });

    expect(renderedGraph.nodes[0].content?.kind).toBe("table");
    expect([renderedGraph.nodes[0].x, renderedGraph.nodes[0].y]).not.toEqual([renderedGraph.nodes[1].x, renderedGraph.nodes[1].y]);
  });

  it("keeps an unsupported CSV source read-only in an error state", async () => {
    await renderProbe({
      readCsvFile: vi.fn(async () => ({ status: "unsupported" as const, message: "Unavailable" })),
      writeCsvFile: vi.fn()
    } as unknown as EditorRuntime);

    expect(renderedGraph.nodes[0].content).toBeUndefined();
    expect(renderedGraph.nodes[0].csvStatus).toBe("error");
  });

  it("does not let an old document load update the next document", async () => {
    let releaseOldRead: (value: ReturnType<typeof openedCsv>) => void = () => undefined;
    const oldRead = new Promise<ReturnType<typeof openedCsv>>((resolve) => { releaseOldRead = resolve; });
    const runtime = {
      readCsvFile: vi.fn()
        .mockImplementationOnce(async () => oldRead)
        .mockResolvedValueOnce(openedCsv("Name\r\nBob", "revision-2")),
      writeCsvFile: vi.fn()
    } as unknown as EditorRuntime;
    const sharedDocumentGeneration = { current: 0 };
    const renderGeneration = () => root?.render(<Probe runtime={runtime} documentGenerationRef={sharedDocumentGeneration} onGraph={(graph, setter) => {
      renderedGraph = graph;
      updateGraph = setter;
    }} onFlush={(flush) => { flushPendingWrites = flush; }} onDiscard={(discard) => { discardPendingWrites = discard; }} showFileWorkflowError={vi.fn()} />);

    await act(async () => { renderGeneration(); await settle(); });
    await act(async () => {
      sharedDocumentGeneration.current += 1;
      updateGraph?.((current) => ({ ...current, nodes: current.nodes.map((node) => ({ ...node, label: "next-document" })) }));
      releaseOldRead(openedCsv("Name\r\nAlice", "revision-1"));
      await settle();
    });
    expect(renderedGraph.nodes[0].content?.rows[0].cells["column-1"]).toBe("Bob");
    expect(renderedGraph.nodes[0].label).toBe("next-document");
  });

  it("uses the latest layout mode when an in-flight CSV load completes", async () => {
    let releaseRead: (value: ReturnType<typeof openedCsv>) => void = () => undefined;
    const pendingRead = new Promise<ReturnType<typeof openedCsv>>((resolve) => { releaseRead = resolve; });
    const graphWithNeighbor: MermaidGraph = {
      ...initialGraph,
      nodes: [...initialGraph.nodes, { id: "B", label: "Neighbor", x: 10, y: 20, fill: "#fff" }]
    };
    const runtime = { readCsvFile: vi.fn(async () => pendingRead), writeCsvFile: vi.fn() } as unknown as EditorRuntime;
    const renderMode = (layoutMode: "manual" | "auto") => root?.render(<Probe runtime={runtime} initialState={graphWithNeighbor} layoutMode={layoutMode} nodeGeometrySpec={defaultNodeGeometrySpec(() => 80)} onGraph={(graph, setter) => {
      renderedGraph = graph;
      updateGraph = setter;
    }} onFlush={(flush) => { flushPendingWrites = flush; }} onDiscard={(discard) => { discardPendingWrites = discard; }} showFileWorkflowError={vi.fn()} />);

    await act(async () => { renderMode("auto"); await settle(); });
    await act(async () => { renderMode("manual"); await settle(); });
    await act(async () => { releaseRead(openedCsv("Name,Role\r\nAlice,Designer", "revision-1")); await settle(); });

    expect(renderedGraph.nodes[0].content?.kind).toBe("table");
    expect([renderedGraph.nodes[0].x, renderedGraph.nodes[0].y]).toEqual([renderedGraph.nodes[1].x, renderedGraph.nodes[1].y]);
  });

  async function renderProbe(runtime: EditorRuntime) {
    await act(async () => {
      root?.render(<Probe runtime={runtime} onGraph={(graph, setter) => {
        renderedGraph = graph;
        updateGraph = setter;
      }} onFlush={(flush) => { flushPendingWrites = flush; }} onDiscard={(discard) => { discardPendingWrites = discard; }} onReload={(reload) => { reloadExternalFiles = reload; }} showFileWorkflowError={vi.fn()} />);
      await settle();
    });
  }

  function updateFirstCell(value: string) {
    updateGraph?.((current) => {
      const node = current.nodes[0];
      if (node.content?.kind !== "table") return current;
      return updateNode(current, node.id, { content: updateTableCell(node.content, "row-1", "column-1", value) });
    });
  }
});

function Probe({
  runtime,
  initialState = initialGraph,
  documentGeneration = 0,
  documentGenerationRef,
  layoutMode,
  nodeGeometrySpec,
  onGraph,
  onFlush,
  onDiscard,
  onReload,
  showFileWorkflowError
}: {
  runtime: EditorRuntime;
  initialState?: MermaidGraph;
  documentGeneration?: number;
  documentGenerationRef?: MutableRefObject<number>;
  layoutMode?: "manual" | "auto";
  nodeGeometrySpec?: ReturnType<typeof defaultNodeGeometrySpec>;
  onGraph: (graph: MermaidGraph, setter: Dispatch<SetStateAction<MermaidGraph>>) => void;
  onFlush: (flush: (options?: { overwriteConflicts?: boolean }) => Promise<boolean>) => void;
  onDiscard: (discard: () => Promise<void>) => void;
  onReload?: (reload: (paths: ReadonlySet<string> | readonly string[]) => Promise<void>) => void;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
}) {
  const [graph, setGraph] = useState(initialState);
  const fallbackDocumentGenerationRef = useRef(documentGeneration);
  fallbackDocumentGenerationRef.current = documentGeneration;
  const { flushPendingWrites, discardPendingWrites, reloadExternalFiles: reloadFiles } = useCsvTableFileSync({
    runtime,
    graph,
    setGraph,
    fileRef: { name: "diagram.mmd", path: "/project/diagram.mmd" },
    projectWorkspace: workspace,
    documentGenerationRef: documentGenerationRef || fallbackDocumentGenerationRef,
    layoutMode,
    nodeGeometrySpec,
    showFileWorkflowError
  });
  onGraph(graph, setGraph);
  onFlush(flushPendingWrites);
  onDiscard(discardPendingWrites);
  onReload?.(reloadFiles);
  return null;
}

function openedCsv(text: string, revision: string) {
  return {
    status: "opened" as const,
    snapshot: {
      file: { name: "people.csv", path: "/project/data/people.csv" },
      text,
      revision,
      modifiedAt: 1
    }
  };
}

async function settle() {
  await Promise.resolve();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}
