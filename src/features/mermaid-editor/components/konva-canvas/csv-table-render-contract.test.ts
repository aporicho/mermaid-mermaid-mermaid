import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("CSV table Konva integration", () => {
  it("renders a non-interactive loading placeholder until transient content arrives", () => {
    const layer = source("src/features/mermaid-editor/components/konva-canvas/node-layer.tsx");
    const table = source("src/features/mermaid-editor/components/konva-canvas/table-node.tsx");

    expect(layer).toContain("isTableNode && !geometry.table");
    expect(layer).toContain("<CanvasTableNodePlaceholder");
    expect(table).toContain('status?: "loading" | "empty" | "error"');
    expect(table).toContain("正在加载 CSV");
    expect(table).toContain("<Group listening={false}>");
  });

  it("keeps all loaded-table edit paths on graph.updateNode content patches", () => {
    const interaction = source("src/features/mermaid-editor/components/konva-canvas/use-konva-table-interaction.ts");
    const inline = source("src/features/mermaid-editor/components/konva-canvas/use-konva-inline-edit-session.ts");

    expect(interaction).toContain("resizeTableColumn");
    expect(interaction).toContain("insertTableRow");
    expect(interaction).toContain("insertTableColumn");
    expect(interaction).toContain("setTableColumnAlign");
    expect(interaction).toContain('type: "graph.updateNode"');
    expect(inline).toContain("updateTableCell");
    expect(inline).toContain("updateTableHeader");
    expect(inline).toContain("applyTableTsv");
    expect(inline).toContain('patch: { content: nextContent }');
  });
});
