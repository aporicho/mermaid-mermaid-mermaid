"use client";

import { ControlSlider as SlidersHorizontal } from "iconoir-react/regular";

import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorPanelHeader, EditorStatusBadge } from "@/features/mermaid-editor/components/editor-ui";
import { EdgeInspectorSection, MultiEdgeInspectorSection } from "@/features/mermaid-editor/components/inspector-panel/edge-sections";
import {
  NODE_ACTION_FILE_MODE_APP,
  NODE_ACTION_URL_MODE_APP
} from "@/features/mermaid-editor/components/inspector-panel/constants";
import {
  createInspectorSelectionModel,
  normalizeEdgePatch,
  normalizeNodePatch,
  normalizeSubgraphPatch
} from "@/features/mermaid-editor/components/inspector-panel/model";
import { MultiNodeInspectorSection, NodeInspectorSection } from "@/features/mermaid-editor/components/inspector-panel/node-sections";
import { EmptyInspector } from "@/features/mermaid-editor/components/inspector-panel/shared-ui";
import { MultiSubgraphInspectorSection, SubgraphInspectorSection } from "@/features/mermaid-editor/components/inspector-panel/subgraph-sections";
import type {
  CanvasEdge,
  CanvasEdgeBatchPatch,
  CanvasNode,
  CanvasNodeAction,
  CanvasNodeBatchPatch,
  CanvasSubgraph,
  CanvasSubgraphBatchPatch,
  MermaidGraph,
  Selection
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { NODE_ACTION_NONE_VALUE, nodeActionTarget } from "@/features/mermaid-editor/lib/node-actions";
import { createImageAsset, DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_WIDTH } from "@/features/mermaid-editor/lib/node-assets";

type InspectorPanelProps = {
  graph: MermaidGraph;
  selection: Selection;
  onEditorCommand: (command: EditorCommand) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onEditNodeAction?: (node: CanvasNode) => void;
};

export function InspectorPanel({ graph, selection, onEditorCommand, onOpenNodeAction, onEditNodeAction }: InspectorPanelProps) {
  const model = createInspectorSelectionModel(graph, selection);
  const {
    selectedNodes,
    selectedEdges,
    selectedSubgraphs,
    selectedNode,
    selectedEdge,
    selectedSubgraph,
    multiNode,
    multiEdge,
    multiSubgraph
  } = model;
  const hasInspectableSelection = Boolean(selectedNode || selectedEdge || selectedSubgraph || multiNode || multiEdge || multiSubgraph);
  const selectionSummary = multiNode
    ? `${selectedNodes.length} 节点`
    : multiEdge
      ? `${selectedEdges.length} 连线`
      : multiSubgraph
        ? `${selectedSubgraphs.length} 组`
        : null;

  function updateNode(id: string, patch: Partial<CanvasNode>) {
    onEditorCommand({ type: "graph.updateNode", nodeId: id, patch: normalizeNodePatch(patch), source: "menu" });
  }

  function updateNodeAsset(node: CanvasNode, patch: Partial<NonNullable<CanvasNode["asset"]>>) {
    const current = node.asset;
    const src = patch.src ?? current?.src ?? "";
    updateNode(node.id, {
      asset: src.trim()
        ? createImageAsset({
            src,
            width: patch.width ?? current?.width ?? DEFAULT_IMAGE_ASSET_WIDTH,
            height: patch.height ?? current?.height ?? DEFAULT_IMAGE_ASSET_HEIGHT,
            preserveAspectRatio: patch.preserveAspectRatio ?? current?.preserveAspectRatio ?? true,
            labelPosition: patch.labelPosition ?? current?.labelPosition ?? "bottom"
          })
        : undefined
    });
  }

  function updateNodeActionKind(node: CanvasNode, kind: CanvasNodeAction["kind"] | typeof NODE_ACTION_NONE_VALUE) {
    if (kind === NODE_ACTION_NONE_VALUE) {
      updateNode(node.id, { action: undefined });
      return;
    }

    updateNode(node.id, {
      action:
        kind === "url"
          ? { kind: "url", url: "", openMode: NODE_ACTION_URL_MODE_APP }
          : { kind: "file", path: "", openMode: NODE_ACTION_FILE_MODE_APP }
    });
  }

  function updateUrlNodeAction(node: CanvasNode, patch: Partial<Extract<CanvasNodeAction, { kind: "url" }>>) {
    const current = node.action?.kind === "url" ? node.action : { kind: "url" as const, url: "", openMode: NODE_ACTION_URL_MODE_APP };
    updateNode(node.id, { action: { ...current, ...patch } });
  }

  function updateFileNodeAction(node: CanvasNode, patch: Partial<Extract<CanvasNodeAction, { kind: "file" }>>) {
    const current = node.action?.kind === "file" ? node.action : { kind: "file" as const, path: "", openMode: NODE_ACTION_FILE_MODE_APP };
    updateNode(node.id, { action: { ...current, ...patch } });
  }

  function updateSelectedEdge(id: string, patch: Partial<CanvasEdge>) {
    onEditorCommand({ type: "graph.updateEdge", edgeId: id, patch: normalizeEdgePatch(patch), source: "menu" });
  }

  function renameSelectedNode(node: CanvasNode, value: string) {
    onEditorCommand({ type: "graph.renameNode", nodeId: node.id, value, source: "menu" });
  }

  function renameSelectedSubgraph(subgraph: CanvasSubgraph, value: string) {
    onEditorCommand({ type: "graph.renameSubgraph", subgraphId: subgraph.id, value, source: "menu" });
  }

  function updateSelectedSubgraph(id: string, patch: Partial<CanvasSubgraph>) {
    onEditorCommand({ type: "graph.updateSubgraph", subgraphId: id, patch: normalizeSubgraphPatch(patch), source: "menu" });
  }

  function updateSelectedNodes(patch: CanvasNodeBatchPatch) {
    onEditorCommand({ type: "graph.updateNodes", nodeIds: selectedNodes.map((node) => node.id), patch, source: "menu" });
  }

  function updateSelectedEdges(patch: CanvasEdgeBatchPatch) {
    onEditorCommand({ type: "graph.updateEdges", edgeIds: selectedEdges.map((edge) => edge.id), patch, source: "menu" });
  }

  function updateSelectedSubgraphs(patch: CanvasSubgraphBatchPatch) {
    onEditorCommand({ type: "graph.updateSubgraphs", subgraphIds: selectedSubgraphs.map((subgraph) => subgraph.id), patch, source: "menu" });
  }

  function addEdgeFrom(node: CanvasNode) {
    const target = graph.nodes.find((item) => item.id !== node.id);
    if (!target) return;
    onEditorCommand({ type: "graph.createEdge", fromId: node.id, toId: target.id, source: "menu" });
  }

  function deleteSelection() {
    onEditorCommand({ type: "graph.deleteSelection", source: "menu" });
  }

  function copyNodeActionTarget(action: CanvasNodeAction) {
    void navigator.clipboard?.writeText(nodeActionTarget(action));
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <EditorPanelHeader
        icon={<SlidersHorizontal className="editor-ui-icon text-icon" />}
        title={<span className="flex items-center gap-2">检查器{selectionSummary ? <EditorStatusBadge>{selectionSummary}</EditorStatusBadge> : null}</span>}
        className="cursor-grab pr-20 active:cursor-grabbing"
      />
      <ScrollArea className="min-h-0">
        <div className="grid gap-4 p-4">
          {!hasInspectableSelection ? <EmptyInspector /> : null}

          {selectedNode ? (
            <NodeInspectorSection
              node={selectedNode}
              graphNodeCount={graph.nodes.length}
              onRenameNode={renameSelectedNode}
              onUpdateNode={updateNode}
              onUpdateNodeAsset={updateNodeAsset}
              onUpdateNodeActionKind={updateNodeActionKind}
              onUpdateUrlNodeAction={updateUrlNodeAction}
              onUpdateFileNodeAction={updateFileNodeAction}
              onAddEdgeFrom={addEdgeFrom}
              onDeleteSelection={deleteSelection}
              onCopyNodeActionTarget={copyNodeActionTarget}
              onOpenNodeAction={onOpenNodeAction}
              onEditNodeAction={onEditNodeAction}
            />
          ) : null}

          {multiNode ? (
            <MultiNodeInspectorSection
              batchNodeShape={model.batchNodeShape}
              batchNodeFill={model.batchNodeFill}
              canBatchNodeAsset={model.canBatchNodeAsset}
              batchAssetWidth={model.batchAssetWidth}
              batchAssetHeight={model.batchAssetHeight}
              batchAssetLabelPosition={model.batchAssetLabelPosition}
              batchAssetPreserveAspectRatio={model.batchAssetPreserveAspectRatio}
              onUpdateSelectedNodes={updateSelectedNodes}
              onBatchFill={(fill) => updateSelectedNodes({ fill })}
              onDeleteSelection={deleteSelection}
            />
          ) : null}

          {selectedSubgraph ? (
            <SubgraphInspectorSection
              subgraph={selectedSubgraph}
              parentOptions={model.selectedSubgraphParentOptions}
              onRenameSubgraph={renameSelectedSubgraph}
              onUpdateSubgraph={updateSelectedSubgraph}
              onDeleteSelection={deleteSelection}
            />
          ) : null}

          {multiSubgraph ? (
            <MultiSubgraphInspectorSection
              batchSubgraphDirection={model.batchSubgraphDirection}
              batchSubgraphParent={model.batchSubgraphParent}
              parentOptions={model.batchSubgraphParentOptions}
              onUpdateSelectedSubgraphs={updateSelectedSubgraphs}
              onDeleteSelection={deleteSelection}
            />
          ) : null}

          {selectedEdge ? (
            <EdgeInspectorSection
              edge={selectedEdge}
              endpointOptions={model.endpointOptions}
              fromAnchorOptions={model.selectedEdgeFromAnchorOptions}
              toAnchorOptions={model.selectedEdgeToAnchorOptions}
              hasFromNode={Boolean(model.selectedEdgeFromNode)}
              hasToNode={Boolean(model.selectedEdgeToNode)}
              onUpdateEdge={updateSelectedEdge}
              onDeleteSelection={deleteSelection}
            />
          ) : null}

          {multiEdge ? (
            <MultiEdgeInspectorSection
              batchEdgeStyle={model.batchEdgeStyle}
              batchEdgeMarkerStart={model.batchEdgeMarkerStart}
              batchEdgeMarkerEnd={model.batchEdgeMarkerEnd}
              batchEdgeMinLength={model.batchEdgeMinLength}
              batchEdgeAnimation={model.batchEdgeAnimation}
              batchEdgeCurve={model.batchEdgeCurve}
              batchEdgeClasses={model.batchEdgeClasses}
              batchEdgeStyleText={model.batchEdgeStyleText}
              onUpdateSelectedEdges={updateSelectedEdges}
              onDeleteSelection={deleteSelection}
            />
          ) : null}
        </div>
      </ScrollArea>
    </section>
  );
}
