import { useCallback, useEffect, useMemo, useState } from "react";

import { KonvaCanvas } from "@/features/mermaid-editor/components/konva-canvas";
import { emptySelection } from "@/features/mermaid-editor/lib/editor-actions";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { applyEditorCommandTransaction, type EditorTransactionState } from "@/features/mermaid-editor/lib/interaction/transaction";
import type { MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import { createMixedPerformanceFixtureGraph } from "@/features/mermaid-editor/lib/performance-fixtures";
import { resolveRuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";

declare global {
  interface Window {
    __MMM_CANVAS_PERF_E2E__?: {
      reset: () => void;
      state: () => EditorTransactionState;
    };
  }
}

const INITIAL_VIEWPORT = { x: 80, y: 60, scale: 0.14 };

export function CanvasPerformanceE2EHarness() {
  const [state, setState] = useState(createHarnessState);
  const previews = useMemo(() => mixedMarkdownPreviews(state), [state]);
  const motion = useMemo(() => resolveRuntimeEditorMotion(undefined, true), []);
  const onEditorCommand = useCallback((command: EditorCommand) => {
    setState((current) => applyEditorCommandTransaction(current, command).state);
  }, []);

  useEffect(() => {
    window.__MMM_CANVAS_PERF_E2E__ = {
      reset: () => setState(createHarnessState()),
      state: () => state
    };
    return () => { delete window.__MMM_CANVAS_PERF_E2E__; };
  }, [state]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-background" data-testid="canvas-performance-e2e-root">
      <KonvaCanvas
        graph={state.graph}
        selection={state.selection}
        viewport={state.viewport}
        mode="select"
        panningRequested={false}
        viewFilters={state.viewFilters}
        edgeRouting="bezier"
        layoutMode="manual"
        markdownDocumentPreviewByNodeId={previews}
        motion={motion}
        onEditorCommand={onEditorCommand}
      />
    </main>
  );
}

function createHarnessState(): EditorTransactionState {
  return {
    graph: createMixedPerformanceFixtureGraph(),
    selection: emptySelection,
    viewport: INITIAL_VIEWPORT,
    viewFilters: { ...DEFAULT_VIEW_FILTERS, grid: false }
  };
}

function mixedMarkdownPreviews(state: EditorTransactionState) {
  return Object.fromEntries(state.graph.nodes.flatMap((node) => {
    if (node.action?.kind !== "file" || !node.action.path.endsWith(".md")) return [];
    const source = [
      `# ${node.label}`,
      "",
      "这是用于验证 Markdown 节点静态纹理缓存的正文。",
      "",
      "- 第一项包含 **加粗内容**",
      "- 第二项包含较长的文本，用于触发布局和裁剪",
      "",
      "> 引用外框保持原有布局，不参与动态命中。",
      "",
      "## 二级标题",
      "",
      "最后一段正文。"
    ].join("\n");
    const preview: MarkdownDocumentPreview = {
      status: "ready",
      path: node.action.path,
      title: node.label,
      excerpt: "Markdown 缓存性能测试",
      source
    };
    return [[node.id, preview] as const];
  }));
}
