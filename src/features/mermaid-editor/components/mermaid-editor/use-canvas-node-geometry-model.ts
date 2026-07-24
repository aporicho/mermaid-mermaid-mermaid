import { useMemo } from "react";

import { deriveDagreAutoLayoutResult } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import type { CompiledEditorTheme } from "@/features/mermaid-editor/lib/editor-theme";
import type { EdgeRouting, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { themedNodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";

export function useCanvasNodeGeometryModel(input: {
  compiledTheme: CompiledEditorTheme;
  fontRevision: number;
  edgeRouting: EdgeRouting;
  graph: MermaidGraph;
}) {
  const spec = useMemo(() => {
    void input.fontRevision;
    return themedNodeGeometrySpec(input.compiledTheme.geometry.node, input.compiledTheme.specialNode, input.compiledTheme.typography.tableNode.cell);
  }, [input.compiledTheme.geometry.node, input.compiledTheme.specialNode, input.compiledTheme.typography.tableNode.cell, input.fontRevision]);
  const routes = useMemo(
    () => input.edgeRouting === "mermaid" ? deriveDagreAutoLayoutResult(input.graph, { spec }).edgeRoutes : [],
    [input.edgeRouting, input.graph, spec]
  );
  return { spec, routes };
}
