import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import {
  addNode,
  addImageNodeAt,
  addNodeAt,
  addNodesAt,
  applyNodeLabelPatch,
  createEdge,
  createSubgraphFromSelection,
  deleteSelection,
  pasteClipboard,
  renameNode,
  renameSubgraph,
  selectOnlyEdge,
  selectOnlyNode,
  setNodeParent,
  setNodePositions,
  updateEdge,
  updateEdges,
  updateNodeFill,
  updateNodeLabel,
  updateNodes,
  updateSubgraph,
  updateSubgraphs
} from "@/features/mermaid-editor/lib/editor-actions";
import {
  DEFAULT_VIEW_FILTERS,
  normalizeViewFilters,
  selectionWithoutHidden,
  type ViewFilters
} from "@/features/mermaid-editor/lib/view-filters";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";

export type EditorTransactionState = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  viewFilters: ViewFilters;
  diagnostics?: EditorDiagnostic[];
};

export type EditorTransactionEffect = {
  history: "none" | "push";
  sourceSync: "none" | "draft" | "commit";
  syncSource?: boolean;
  status?: string;
  recentAction?: {
    type: string;
    target: "canvas";
    summary: string;
  };
  highFrequency?: boolean;
};

export type EditorTransactionResult = {
  state: EditorTransactionState;
  effect: EditorTransactionEffect;
};

export function applyEditorCommandTransaction(state: EditorTransactionState, command: EditorCommand): EditorTransactionResult {
  if (command.type === "mode.set") {
    return {
      state,
      effect: {
        history: "none",
        sourceSync: "none",
        status: `切换到 ${command.mode} 模式。`,
        recentAction: {
          type: "mode.change",
          target: "canvas",
          summary: `切换到 ${command.mode} 模式。`
        }
      }
    };
  }

  if (command.type === "history.capture") {
    return {
      state,
      effect: {
        history: "push",
        sourceSync: "none"
      }
    };
  }

  if (command.type === "history.undo" || command.type === "history.redo" || command.type === "clipboard.copy") {
    return {
      state,
      effect: {
        history: "none",
        sourceSync: "none"
      }
    };
  }

  if (command.type === "viewport.set") {
    return {
      state: { ...state, viewport: command.viewport },
      effect: {
        history: "none",
        sourceSync: "none",
        highFrequency: command.source === "pointer" || command.source === "wheel" || command.source === "gesture"
      }
    };
  }

  if (command.type === "selection.set") {
    return {
      state: { ...state, selection: command.selection },
      effect: {
        history: "none",
        sourceSync: "none"
      }
    };
  }

  if (command.type === "selection.clear") {
    return {
      state: { ...state, selection: { nodeIds: [], edgeIds: [], subgraphIds: [] } },
      effect: {
        history: "none",
        sourceSync: "none"
      }
    };
  }

  if (command.type === "graph.addNodeAt") {
    const result = addNodeAt(state.graph, command.point.x, command.point.y, { label: command.label, action: command.action });
    const graph = command.point.parentId ? setNodeParent(result.graph, result.selection.nodeIds[0], command.point.parentId) : result.graph;
    const message = command.message || "已在画布中新增节点。";
    return commitGraphState({ ...state, graph, selection: result.selection }, message);
  }

  if (command.type === "graph.addNodesAt") {
    const result = addNodesAt(
      state.graph,
      command.nodes.map((node) => ({
        x: node.point.x,
        y: node.point.y,
        label: node.label,
        action: node.action
      }))
    );
    const graph = command.nodes.reduce((currentGraph, node, index) => {
      const nodeId = result.selection.nodeIds[index];
      return node.point.parentId && nodeId ? setNodeParent(currentGraph, nodeId, node.point.parentId) : currentGraph;
    }, result.graph);
    return commitGraphState({ ...state, graph, selection: result.selection }, command.message || "已添加链接节点。");
  }

  if (command.type === "graph.addImageNodeAt") {
    const result = addImageNodeAt(state.graph, command.point.x, command.point.y, command.asset, command.label);
    const graph = command.point.parentId ? setNodeParent(result.graph, result.selection.nodeIds[0], command.point.parentId) : result.graph;
    return commitGraphState({ ...state, graph, selection: result.selection }, command.message || "已添加图片节点。");
  }

  if (command.type === "graph.addNodeAtViewportCenter") {
    const result = addNode(state.graph, state.viewport);
    return commitGraphState({ ...state, graph: result.graph, selection: result.selection }, command.message || "已新增节点。");
  }

  if (command.type === "graph.createSubgraphFromSelection") {
    const result = createSubgraphFromSelection(state.graph, state.selection);
    return commitGraphState({ ...state, graph: result.graph, selection: result.selection }, "已将选中内容成组。");
  }

  if (command.type === "graph.deleteSelection") {
    return commitGraphState(
      {
        ...state,
        graph: deleteSelection(state.graph, state.selection),
        selection: { nodeIds: [], edgeIds: [], subgraphIds: [] }
      },
      "已删除选中项。"
    );
  }

  if (command.type === "graph.pasteClipboard") {
    const result = pasteClipboard(state.graph, command.payload);
    return commitGraphState({ ...state, graph: result.graph, selection: result.selection }, "已粘贴节点。");
  }

  if (command.type === "graph.setDirection") {
    return commitGraphState({ ...state, graph: { ...state.graph, direction: command.direction } }, `方向已切换为 ${command.direction}。`);
  }

  if (command.type === "graph.createEdge") {
    const result = createEdge(state.graph, command.fromId, command.toId, "", {
      fromAnchor: command.fromAnchor,
      toAnchor: command.toAnchor
    });
    return commitGraphState({ ...state, graph: result.graph, selection: result.selection }, command.message || "已创建连线。");
  }

  if (command.type === "graph.retargetEdge") {
    const anchorKey = command.side === "from" ? "fromAnchor" : "toAnchor";
    return commitGraphState(
      {
        ...state,
        graph: updateEdge(state.graph, command.edgeId, {
          [command.side]: command.targetId,
          ...("anchor" in command ? { [anchorKey]: command.anchor || undefined } : {})
        }),
        selection: selectOnlyEdge(command.edgeId)
      },
      command.message || "已重连连线。"
    );
  }

  if (command.type === "graph.renameNode") {
    const result = renameNode(state.graph, command.nodeId, command.value);
    return commitGraphState({ ...state, graph: result.graph, selection: result.selection }, "已重命名节点。");
  }

  if (command.type === "graph.renameSubgraph") {
    const result = renameSubgraph(state.graph, command.subgraphId, command.value);
    return commitGraphState({ ...state, graph: result.graph, selection: result.selection }, "已重命名组。");
  }

  if (command.type === "graph.updateNode") {
    const graph = {
      ...state.graph,
      nodes: state.graph.nodes.map((node) => {
        if (node.id !== command.nodeId) return node;
        const nextNode = { ...node, ...command.patch };
        return "label" in command.patch && !("action" in command.patch) ? applyNodeLabelPatch(nextNode, command.patch.label ?? node.label) : nextNode;
      })
    };
    return commitGraphState({ ...state, graph }, command.message || "已更新节点。");
  }

  if (command.type === "graph.updateNodes") {
    return commitGraphState(
      {
        ...state,
        graph: updateNodes(state.graph, command.nodeIds, command.patch)
      },
      command.message || "已批量更新节点。"
    );
  }

  if (command.type === "graph.updateNodeFill") {
    return commitGraphState(
      {
        ...state,
        graph: updateNodeFill(state.graph, command.nodeIds, command.fill)
      },
      "已批量修改颜色。"
    );
  }

  if (command.type === "graph.updateEdge") {
    return commitGraphState(
      {
        ...state,
        graph: updateEdge(state.graph, command.edgeId, command.patch)
      },
      command.message || "已更新连线。"
    );
  }

  if (command.type === "graph.updateEdges") {
    return commitGraphState(
      {
        ...state,
        graph: updateEdges(state.graph, command.edgeIds, command.patch)
      },
      command.message || "已批量更新连线。"
    );
  }

  if (command.type === "graph.updateSubgraph") {
    return commitGraphState(
      {
        ...state,
        graph: updateSubgraph(state.graph, command.subgraphId, command.patch)
      },
      command.message || "已更新组。"
    );
  }

  if (command.type === "graph.updateSubgraphs") {
    return commitGraphState(
      {
        ...state,
        graph: updateSubgraphs(state.graph, command.subgraphIds, command.patch)
      },
      command.message || "已批量更新组。"
    );
  }

  if (command.type === "graph.updateNodeLabel") {
    return commitGraphState(
      {
        ...state,
        graph: updateNodeLabel(state.graph, command.nodeId, command.label),
        selection: selectOnlyNode(command.nodeId)
      },
      command.message || "已更新节点文本。"
    );
  }

  if (command.type === "graph.updateEdgeLabel") {
    return commitGraphState(
      {
        ...state,
        graph: updateEdge(state.graph, command.edgeId, { label: command.label }),
        selection: selectOnlyEdge(command.edgeId)
      },
      command.message || "已更新连线文本。"
    );
  }

  if (command.type === "graph.draftNodePositions") {
    const message = command.message || "正在移动节点。";
    return {
      state: { ...state, graph: setNodePositions(state.graph, command.positions) },
      effect: {
        history: "none",
        sourceSync: "draft",
        syncSource: Boolean(command.syncSource),
        status: message,
        highFrequency: !command.syncSource
      }
    };
  }

  if (command.type === "graph.commitDragMembership") {
    const message = command.message || "已移动并更新组成员。";
    return {
      state: { ...state, graph: command.graph },
      effect: {
        history: "none",
        sourceSync: "draft",
        syncSource: true,
        status: message,
        recentAction: {
          type: "graph.drag",
          target: "canvas",
          summary: message
        }
      }
    };
  }

  if (command.type === "viewFilters.set") {
    const viewFilters = normalizeViewFilters(command.filters);
    return {
      state: {
        ...state,
        viewFilters,
        selection: selectionWithoutHidden(state.selection, state.graph, viewFilters)
      },
      effect: {
        history: "none",
        sourceSync: "none",
        status: command.message,
        recentAction: {
          type: "view.filters",
          target: "canvas",
          summary: command.message
        }
      }
    };
  }

  if (command.type === "viewFilters.reset") {
    const message = command.message || "已显示全部视图元素。";
    return {
      state: {
        ...state,
        viewFilters: DEFAULT_VIEW_FILTERS,
        selection: selectionWithoutHidden(state.selection, state.graph, DEFAULT_VIEW_FILTERS)
      },
      effect: {
        history: "none",
        sourceSync: "none",
        status: message,
        recentAction: {
          type: "view.filters",
          target: "canvas",
          summary: message
        }
      }
    };
  }

  return {
    state,
    effect: {
      history: "none",
      sourceSync: "none"
    }
  };
}

function commitGraphState(state: EditorTransactionState, message: string): EditorTransactionResult {
  return {
    state,
    effect: {
      history: "push",
      sourceSync: "commit",
      status: message,
      recentAction: {
        type: "graph.commit",
        target: "canvas",
        summary: message
      }
    }
  };
}
