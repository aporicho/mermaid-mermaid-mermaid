import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aiContextSchema,
  diffMermaidDocuments,
  fetchAiEditorContext,
  layoutMermaidDocument,
  patchMermaidDocument,
  pingAiEditorContext,
  readMermaidDocument,
  submitAiApplyCommand,
  validateMermaidDocument
} from "@/cli/mermaid-cli-core";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mermaid CLI core", () => {
  it("reads Mermaid documents through the shared editor document model", () => {
    const result = readMermaidDocument(`%% canvas-layout: {"version":1,"edgeRouting":"mermaid","layoutMode":"manual","viewport":{"x":1,"y":2,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha] --> B[Beta]`);

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      diagramType: "flowchart",
      editableKind: "flowchart",
      edgeRouting: "mermaid",
      layoutMode: "manual"
    });
    expect(result.result?.graph.nodes.map((node) => node.id)).toEqual(["A", "B"]);
  });

  it("validates with the official Mermaid parser instead of only the editable subset parser", async () => {
    const result = await validateMermaidDocument(`flowchart LR
  A -.>|bad| B`);

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "MERMAID_PARSE_ERROR",
      severity: "error"
    });
  });

  it("patches nodes by stable ID instead of label text", async () => {
    const result = await patchMermaidDocument(
      `flowchart LR
  A[Same] --> B[Same]`,
      {
        ops: [{ type: "updateNode", id: "B", label: "Changed" }]
      }
    );

    expect(result.ok).toBe(true);
    expect(result.result?.written).toBe(false);
    expect(result.result?.source).toContain('A@{ shape: rect, label: "Same" }');
    expect(result.result?.source).toContain('B@{ shape: rect, label: "Changed" }');
    expect(result.result?.diff.semanticChanges.nodes).toEqual([
      {
        type: "updated",
        id: "B",
        before: { id: "B", label: "Same", shape: "rect" },
        after: { id: "B", label: "Changed", shape: "rect" }
      }
    ]);
  });

  it("keeps render-only Mermaid diagrams read/validate capable but blocks structural patching", async () => {
    const source = `sequenceDiagram
  participant User
  User->>AI: update`;

    expect((await validateMermaidDocument(source)).ok).toBe(true);
    const result = await patchMermaidDocument(source, [{ type: "addNode", id: "A", label: "Alpha" }]);

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "UNSUPPORTED_DIAGRAM_TYPE" });
  });

  it("diffs semantic changes separately from layout changes", () => {
    const before = `%% canvas-layout: {"version":1,"edgeRouting":"bezier","layoutMode":"manual","viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha]`;
    const after = `%% canvas-layout: {"version":1,"edgeRouting":"bezier","layoutMode":"manual","viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":40,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha]`;

    const result = diffMermaidDocuments(before, after);

    expect(result.ok).toBe(true);
    expect(result.result?.hasChanges).toBe(true);
    expect(result.result?.semanticChanges.nodes).toEqual([]);
    expect(result.result?.layoutChanges.nodes).toHaveLength(1);
  });

  it("applies Dagre layout and updates canvas layout metadata", async () => {
    const result = await layoutMermaidDocument(
      `flowchart LR
  A[Alpha] --> B[Beta] --> C[Gamma]`,
      { edgeRouting: "mermaid", layoutMode: "auto" }
    );

    expect(result.ok).toBe(true);
    expect(result.result?.source).toContain('"edgeRouting":"mermaid"');
    expect(result.result?.source).toContain('"layoutMode":"auto"');
    expect(result.result?.diff.layoutChanges.nodes.length).toBeGreaterThan(0);
  });

  it("prints the live editor context schema contract", () => {
    const result = aiContextSchema();

    expect(result.ok).toBe(true);
    expect(result.result?.commands.context).toContain("WebUI");
    expect(result.result?.contextExample.version).toBe(1);
  });

  it("fetches live WebUI editor context as a CLI envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            context: aiContextSchema().result?.contextExample,
            diagnostics: []
          })
      }))
    );

    const result = await fetchAiEditorContext({ server: "http://127.0.0.1:3000/" });

    expect(result.ok).toBe(true);
    expect(result.command).toBe("context");
    expect(result.server).toBe("http://127.0.0.1:3000");
    expect(result.file).toBeUndefined();
    expect(result.result?.selection.nodeIds).toEqual(["User"]);
  });

  it("returns a structured ping diagnostic when the editor service is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      })
    );

    const result = await pingAiEditorContext({ server: "http://127.0.0.1:3999" });

    expect(result.ok).toBe(false);
    expect(result.result).toMatchObject({ reachable: false, contextAvailable: false });
    expect(result.diagnostics[0]).toMatchObject({ code: "EDITOR_SERVICE_UNREACHABLE" });
  });

  it("submits live apply commands to WebUI and returns the editor result", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/api/ai/commands")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              ok: true,
              command: {
                id: "cmd_1",
                type: "applyPatch",
                createdAt: "2026-06-17T00:00:00.000Z",
                expiresAt: "2026-06-17T00:00:30.000Z",
                ops: [{ type: "updateNode", id: "A", label: "Alpha" }],
                autoSave: true
              },
              diagnostics: []
            })
        };
      }

      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            status: "completed",
            result: {
              commandId: "cmd_1",
              applied: true,
              saved: true,
              changed: true,
              fileName: "demo.mmd",
              diagnostics: []
            },
            diagnostics: []
          })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitAiApplyCommand(
      { ops: [{ type: "updateNode", id: "A", label: "Alpha" }] },
      { server: "http://127.0.0.1:3000/", targetFileName: "demo.mmd", timeoutMs: 1000 }
    );

    expect(result.ok).toBe(true);
    expect(result.command).toBe("apply");
    expect(result.server).toBe("http://127.0.0.1:3000");
    expect(result.result).toMatchObject({ applied: true, saved: true, fileName: "demo.mmd" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/ai/commands",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"targetFileName":"demo.mmd"')
      })
    );
  });
});
