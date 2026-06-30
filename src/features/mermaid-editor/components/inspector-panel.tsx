"use client";

import { ControlSlider as SlidersHorizontal, Link, OpenNewWindow, PathArrow, Trash as Trash2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type {
  CanvasEdge,
  CanvasEdgeBatchPatch,
  CanvasNode,
  CanvasNodeAction,
  CanvasNodeBatchPatch,
  CanvasSubgraph,
  CanvasSubgraphBatchPatch,
  EdgeAnimation,
  EdgeMarker,
  EdgeStyle,
  FlowchartNodeShape,
  GraphDirection,
  MermaidCurve,
  MermaidGraph,
  Selection
} from "@/features/mermaid-editor/lib/editor-types";
import { descendantSubgraphIds, selectOnlyEdge, selectOnlySubgraph } from "@/features/mermaid-editor/lib/editor-actions";
import { DEFAULT_FLOWCHART_NODE_SHAPE, FLOWCHART_SHAPE_GROUPS, FLOWCHART_SHAPES, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { palette } from "@/features/mermaid-editor/lib/mermaid-graph";
import { NODE_ACTION_NONE_VALUE, nodeActionLabel, nodeActionTarget } from "@/features/mermaid-editor/lib/node-actions";
import { createImageAsset, DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_WIDTH } from "@/features/mermaid-editor/lib/node-assets";
import { flowchartPortPoints, type ShapeGeometryPortKind } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { cn } from "@/lib/utils";

type InspectorPanelProps = {
  graph: MermaidGraph;
  selection: Selection;
  onEditorCommand: (command: EditorCommand) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onEditNodeAction?: (node: CanvasNode) => void;
};

const edgeStyleOptions: { value: EdgeStyle; label: string }[] = [
  { value: "solid", label: "实线" },
  { value: "thick", label: "粗线" },
  { value: "dotted", label: "点线" },
  { value: "invisible", label: "隐藏线" }
];

const edgeMarkerOptions: { value: EdgeMarker; label: string }[] = [
  { value: "arrow", label: "箭头" },
  { value: "none", label: "无端点" },
  { value: "circle", label: "圆点" },
  { value: "cross", label: "叉号" }
];

const edgeAnimationOptions: { value: EdgeAnimation; label: string }[] = [
  { value: "none", label: "不动画" },
  { value: "on", label: "开启" },
  { value: "fast", label: "快速" },
  { value: "slow", label: "慢速" }
];

const edgeCurveOptions: { value: MermaidCurve; label: string }[] = [
  { value: "basis", label: "basis" },
  { value: "bumpX", label: "bumpX" },
  { value: "bumpY", label: "bumpY" },
  { value: "cardinal", label: "cardinal" },
  { value: "catmullRom", label: "catmullRom" },
  { value: "linear", label: "linear" },
  { value: "monotoneX", label: "monotoneX" },
  { value: "monotoneY", label: "monotoneY" },
  { value: "natural", label: "natural" },
  { value: "step", label: "step" },
  { value: "stepAfter", label: "stepAfter" },
  { value: "stepBefore", label: "stepBefore" }
];

const directionOptions: { value: GraphDirection; label: string }[] = [
  { value: "LR", label: "LR" },
  { value: "TD", label: "TD" },
  { value: "TB", label: "TB" },
  { value: "RL", label: "RL" },
  { value: "BT", label: "BT" }
];

const MIXED_VALUE = "__mixed__";
const INHERIT_VALUE = "__inherit__";
const ROOT_VALUE = "__root__";
const DEFAULT_CURVE_VALUE = "__default_curve__";
const NODE_ACTION_URL_MODE_APP: Extract<CanvasNodeAction, { kind: "url" }>["openMode"] = "app-browser";
const NODE_ACTION_FILE_MODE_APP: Extract<CanvasNodeAction, { kind: "file" }>["openMode"] = "app-window";

const anchorKindLabels: Record<ShapeGeometryPortKind, string> = {
  "edge-midpoint": "边中点",
  corner: "角点",
  "polygon-edge": "边中点",
  "polygon-vertex": "顶点",
  "ellipse-cardinal": "主方向",
  "ellipse-diagonal": "斜向"
};

const anchorKeyLabels: Record<string, string> = {
  top: "上",
  "top-right": "右上",
  right: "右",
  "bottom-right": "右下",
  bottom: "下",
  "bottom-left": "左下",
  left: "左",
  "top-left": "左上"
};

export function InspectorPanel({ graph, selection, onEditorCommand, onOpenNodeAction, onEditNodeAction }: InspectorPanelProps) {
  const selectedNodes = graph.nodes.filter((node) => selection.nodeIds.includes(node.id));
  const selectedEdges = graph.edges.filter((edge) => selection.edgeIds.includes(edge.id));
  const selectedSubgraphs = (graph.subgraphs || []).filter((subgraph) => (selection.subgraphIds || []).includes(subgraph.id));
  const selectedNode = selectedNodes.length === 1 && selectedEdges.length === 0 && selectedSubgraphs.length === 0 ? selectedNodes[0] : undefined;
  const selectedEdge = selectedEdges.length === 1 && selectedNodes.length === 0 && selectedSubgraphs.length === 0 ? selectedEdges[0] : undefined;
  const selectedSubgraph = selectedSubgraphs.length === 1 && selectedNodes.length === 0 && selectedEdges.length === 0 ? selectedSubgraphs[0] : undefined;
  const multiNode = selectedNodes.length > 1 && selectedEdges.length === 0 && selectedSubgraphs.length === 0;
  const multiEdge = selectedEdges.length > 1 && selectedNodes.length === 0 && selectedSubgraphs.length === 0;
  const multiSubgraph = selectedSubgraphs.length > 1 && selectedNodes.length === 0 && selectedEdges.length === 0;
  const selectedEdgeFromNode = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.from) : undefined;
  const selectedEdgeToNode = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.to) : undefined;
  const selectedEdgeFromAnchorOptions = nodeAnchorOptions(selectedEdgeFromNode);
  const selectedEdgeToAnchorOptions = nodeAnchorOptions(selectedEdgeToNode);
  const batchNodeShape = sharedSelectionValue(selectedNodes, (node) => node.shape || DEFAULT_FLOWCHART_NODE_SHAPE, DEFAULT_FLOWCHART_NODE_SHAPE);
  const batchNodeFill = sharedSelectionValue(selectedNodes, (node) => node.fill, "");
  const canBatchNodeAsset = multiNode && selectedNodes.every((node) => node.asset);
  const batchAssetWidth = sharedSelectionValue(selectedNodes, (node) => node.asset?.width || DEFAULT_IMAGE_ASSET_WIDTH, DEFAULT_IMAGE_ASSET_WIDTH);
  const batchAssetHeight = sharedSelectionValue(selectedNodes, (node) => node.asset?.height || DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_HEIGHT);
  const batchAssetLabelPosition = sharedSelectionValue(selectedNodes, (node) => node.asset?.labelPosition || "bottom", "bottom");
  const batchAssetPreserveAspectRatio = sharedSelectionValue(selectedNodes, (node) => node.asset?.preserveAspectRatio ?? true, true);
  const batchEdgeStyle = sharedSelectionValue(selectedEdges, (edge) => edge.style || "solid", "solid");
  const batchEdgeMarkerStart = sharedSelectionValue(selectedEdges, (edge) => edge.markerStart || "none", "none");
  const batchEdgeMarkerEnd = sharedSelectionValue(selectedEdges, edgeEndMarker, "arrow");
  const batchEdgeMinLength = sharedSelectionValue(selectedEdges, (edge) => edge.minLength || 1, 1);
  const batchEdgeAnimation = sharedSelectionValue(selectedEdges, (edge) => edge.animation || "none", "none");
  const batchEdgeCurve = sharedSelectionValue(selectedEdges, (edge) => edge.curve || DEFAULT_CURVE_VALUE, DEFAULT_CURVE_VALUE);
  const batchEdgeClasses = sharedSelectionValue(selectedEdges, (edge) => edgeClassesInput(edge.classes), "");
  const batchEdgeStyleText = sharedSelectionValue(selectedEdges, (edge) => edge.styleText || "", "");
  const batchSubgraphDirection = sharedSelectionValue(selectedSubgraphs, (subgraph) => subgraph.direction || INHERIT_VALUE, INHERIT_VALUE);
  const batchSubgraphParent = sharedSelectionValue(selectedSubgraphs, (subgraph) => subgraph.parentId || ROOT_VALUE, ROOT_VALUE);
  const batchSubgraphParentOptions = subgraphParentOptionsForBatch(graph, selectedSubgraphs);
  const endpointOptions = [
    ...graph.nodes.map((node) => ({ id: node.id, label: `${node.id} · 节点` })),
    ...(graph.subgraphs || []).map((subgraph) => ({ id: subgraph.id, label: `${subgraph.id} · 组` }))
  ];

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

  function batchFill(fill: string) {
    updateSelectedNodes({ fill });
  }

  function copyNodeActionTarget(action: CanvasNodeAction) {
    void navigator.clipboard?.writeText(nodeActionTarget(action));
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)]">
      <header data-floating-panel-drag-handle className="flex cursor-grab items-center gap-2 border-b bg-card/95 px-3 pr-20 text-sm font-medium active:cursor-grabbing">
        <SlidersHorizontal className="size-4 text-icon" />
        检查器
      </header>
      <ScrollArea className="min-h-0">
        <div className="grid gap-4 p-4">
          {!selectedNode && !selectedEdge && !selectedSubgraph && !multiNode && !multiEdge && !multiSubgraph ? <EmptyInspector /> : null}

          {selectedNode ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="node-id">节点 ID</Label>
                <Input id="node-id" value={selectedNode.id} onChange={(event) => renameSelectedNode(selectedNode, event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="node-label">节点文本</Label>
                <Input
                  id="node-label"
                  value={selectedNode.label}
                  onChange={(event) => updateNode(selectedNode.id, { label: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>节点形状</Label>
                <Select
                  value={selectedNode.shape || "rect"}
                  onValueChange={(value) => updateNode(selectedNode.id, { shape: value as FlowchartNodeShape })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[360px]">
                    {FLOWCHART_SHAPE_GROUPS.map((group, groupIndex) => (
                      <SelectGroup key={group}>
                        {groupIndex > 0 ? <SelectSeparator /> : null}
                        <SelectLabel>{group}</SelectLabel>
                        {FLOWCHART_SHAPES.filter((shape) => shape.group === group).map((shape) => (
                          <SelectItem key={shape.id} value={shape.id}>
                            {shape.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ColorGrid activeFill={selectedNode.fill} onPick={(fill) => updateNode(selectedNode.id, { fill })} />
              <Separator />
              <div className="grid gap-2">
                <Label htmlFor="node-image-src">图片 URL / 路径</Label>
                <Input
                  id="node-image-src"
                  value={selectedNode.asset?.src || ""}
                  placeholder="https:// 或 assets/..."
                  onChange={(event) => updateNodeAsset(selectedNode, { src: event.target.value })}
                />
              </div>
              {selectedNode.asset ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                      <Label htmlFor="node-image-width">图片宽度</Label>
                      <Input
                        id="node-image-width"
                        type="number"
                        min={24}
                        value={selectedNode.asset.width}
                        onChange={(event) => updateNodeAsset(selectedNode, { width: Number(event.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="node-image-height">图片高度</Label>
                      <Input
                        id="node-image-height"
                        type="number"
                        min={24}
                        value={selectedNode.asset.height}
                        onChange={(event) => updateNodeAsset(selectedNode, { height: Number(event.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>标签位置</Label>
                    <Select value={selectedNode.asset.labelPosition} onValueChange={(value) => updateNodeAsset(selectedNode, { labelPosition: value as NonNullable<CanvasNode["asset"]>["labelPosition"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">图片下方</SelectItem>
                        <SelectItem value="top">图片上方</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    className="h-8 justify-start px-2"
                    onClick={() => updateNodeAsset(selectedNode, { preserveAspectRatio: !selectedNode.asset?.preserveAspectRatio })}
                  >
                    {selectedNode.asset.preserveAspectRatio ? "保持比例" : "不保持比例"}
                  </Button>
                </>
              ) : null}
              <Separator />
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>节点动作</Label>
                  {selectedNode.action ? (
                    <button
                      type="button"
                      className="min-w-0 max-w-[180px] truncate rounded px-1 text-right text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={`复制${nodeActionLabel(selectedNode.action)}目标：${nodeActionTarget(selectedNode.action)}`}
                      onClick={() => copyNodeActionTarget(selectedNode.action!)}
                    >
                      {nodeActionTarget(selectedNode.action)}
                    </button>
                  ) : null}
                </div>
                <Select value={selectedNode.action?.kind || NODE_ACTION_NONE_VALUE} onValueChange={(value) => updateNodeActionKind(selectedNode, value as CanvasNodeAction["kind"] | typeof NODE_ACTION_NONE_VALUE)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NODE_ACTION_NONE_VALUE}>无动作</SelectItem>
                    <SelectItem value="url">网页链接</SelectItem>
                    <SelectItem value="file">文件链接</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedNode.action?.kind === "url" ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="node-action-url">网页 URL</Label>
                    <Input
                      id="node-action-url"
                      value={selectedNode.action.url}
                      placeholder="https://example.com"
                      onChange={(event) => updateUrlNodeAction(selectedNode, { url: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>打开方式</Label>
                    <Select value={selectedNode.action.openMode} onValueChange={(value) => updateUrlNodeAction(selectedNode, { openMode: value as Extract<CanvasNodeAction, { kind: "url" }>["openMode"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="app-browser">应用内浏览器</SelectItem>
                        <SelectItem value="system">系统浏览器</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
              {selectedNode.action?.kind === "file" ? (
                <div className="grid gap-2">
                  <Label htmlFor="node-action-file">文件路径</Label>
                  <Input
                    id="node-action-file"
                    value={selectedNode.action.path}
                    placeholder="./docs/spec.md"
                    onChange={(event) => updateFileNodeAction(selectedNode, { path: event.target.value })}
                  />
                </div>
              ) : null}
              {selectedNode.action ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="node-action-tooltip">提示文本</Label>
                    <Input
                      id="node-action-tooltip"
                      value={selectedNode.action.tooltip || ""}
                      placeholder={selectedNode.action.kind === "url" ? "打开链接" : "打开文件"}
                      onChange={(event) =>
                        selectedNode.action?.kind === "url"
                          ? updateUrlNodeAction(selectedNode, { tooltip: event.target.value })
                          : updateFileNodeAction(selectedNode, { tooltip: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-8 justify-start px-2" onClick={() => onOpenNodeAction?.(selectedNode)}>
                      <OpenNewWindow className="size-4" />
                      测试打开
                    </Button>
                    <Button variant="outline" className="h-8 justify-start px-2" onClick={() => onEditNodeAction?.(selectedNode)}>
                      <Link className="size-4" />
                      链接编辑器
                    </Button>
                  </div>
                </>
              ) : null}
              <Separator />
              <Button variant="outline" className="h-8 justify-start px-2" onClick={() => addEdgeFrom(selectedNode)} disabled={graph.nodes.length < 2}>
                <PathArrow className="size-4" />
                从此节点连线
              </Button>
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "graph.deleteSelection", source: "menu" })}>
                <Trash2 className="size-4" />
                删除节点
              </Button>
            </>
          ) : null}

          {multiNode ? (
            <>
              <div className="rounded-md border bg-muted/35 p-3 text-sm">
                已选择 <strong>{selectedNodes.length}</strong> 个节点
              </div>
              <div className="grid gap-2">
                <Label>节点形状</Label>
                <Select
                  value={batchNodeShape.mixed ? MIXED_VALUE : batchNodeShape.value}
                  onValueChange={(value) => {
                    if (value === MIXED_VALUE) return;
                    updateSelectedNodes({ shape: value as FlowchartNodeShape });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[360px]">
                    <MixedSelectItem mixed={batchNodeShape.mixed} />
                    {FLOWCHART_SHAPE_GROUPS.map((group, groupIndex) => (
                      <SelectGroup key={group}>
                        {groupIndex > 0 || batchNodeShape.mixed ? <SelectSeparator /> : null}
                        <SelectLabel>{group}</SelectLabel>
                        {FLOWCHART_SHAPES.filter((shape) => shape.group === group).map((shape) => (
                          <SelectItem key={shape.id} value={shape.id}>
                            {shape.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ColorGrid activeFill={batchNodeFill.mixed ? "" : batchNodeFill.value} mixed={batchNodeFill.mixed} onPick={batchFill} />
              {canBatchNodeAsset ? (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                      <Label htmlFor="batch-node-image-width">图片宽度</Label>
                      <Input
                        id="batch-node-image-width"
                        type="number"
                        min={24}
                        value={batchAssetWidth.mixed ? "" : batchAssetWidth.value || ""}
                        placeholder={batchAssetWidth.mixed ? "混合" : undefined}
                        onChange={(event) => updateBatchNodeAssetNumber(updateSelectedNodes, "width", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="batch-node-image-height">图片高度</Label>
                      <Input
                        id="batch-node-image-height"
                        type="number"
                        min={24}
                        value={batchAssetHeight.mixed ? "" : batchAssetHeight.value || ""}
                        placeholder={batchAssetHeight.mixed ? "混合" : undefined}
                        onChange={(event) => updateBatchNodeAssetNumber(updateSelectedNodes, "height", event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>标签位置</Label>
                    <Select
                      value={batchAssetLabelPosition.mixed ? MIXED_VALUE : batchAssetLabelPosition.value}
                      onValueChange={(value) => {
                        if (value === MIXED_VALUE) return;
                        updateSelectedNodes({ asset: { labelPosition: value as NonNullable<CanvasNode["asset"]>["labelPosition"] } });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <MixedSelectItem mixed={batchAssetLabelPosition.mixed} />
                        {batchAssetLabelPosition.mixed ? <SelectSeparator /> : null}
                        <SelectItem value="bottom">图片下方</SelectItem>
                        <SelectItem value="top">图片上方</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>图片比例</Label>
                    <Select
                      value={batchAssetPreserveAspectRatio.mixed ? MIXED_VALUE : batchAssetPreserveAspectRatio.value ? "true" : "false"}
                      onValueChange={(value) => {
                        if (value === MIXED_VALUE) return;
                        updateSelectedNodes({ asset: { preserveAspectRatio: value === "true" } });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <MixedSelectItem mixed={batchAssetPreserveAspectRatio.mixed} />
                        {batchAssetPreserveAspectRatio.mixed ? <SelectSeparator /> : null}
                        <SelectItem value="true">保持比例</SelectItem>
                        <SelectItem value="false">不保持比例</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
              <Separator />
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "graph.deleteSelection", source: "menu" })}>
                <Trash2 className="size-4" />
                删除选中节点
              </Button>
            </>
          ) : null}

          {selectedSubgraph ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="subgraph-id">组 ID</Label>
                <Input id="subgraph-id" value={selectedSubgraph.id} onChange={(event) => renameSelectedSubgraph(selectedSubgraph, event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subgraph-title">组标题</Label>
                <Input
                  id="subgraph-title"
                  value={selectedSubgraph.title}
                  onChange={(event) => updateSelectedSubgraph(selectedSubgraph.id, { title: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>组方向</Label>
                <Select
                  value={selectedSubgraph.direction || "__inherit__"}
                  onValueChange={(value) =>
                    updateSelectedSubgraph(selectedSubgraph.id, { direction: value === "__inherit__" ? undefined : (value as GraphDirection) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__inherit__">继承全局方向</SelectItem>
                    {directionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>父组</Label>
                <Select
                  value={selectedSubgraph.parentId || "__root__"}
                  onValueChange={(value) => updateSelectedSubgraph(selectedSubgraph.id, { parentId: value === "__root__" ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">根层</SelectItem>
                    {(graph.subgraphs || [])
                      .filter((subgraph) => subgraph.id !== selectedSubgraph.id && !descendantSubgraphIds(graph, selectedSubgraph.id).includes(subgraph.id))
                      .map((subgraph) => (
                        <SelectItem key={subgraph.id} value={subgraph.id}>
                          {subgraph.title || subgraph.id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <Button variant="outline" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "selection.set", selection: selectOnlySubgraph(selectedSubgraph.id), source: "menu" })}>
                <PathArrow className="size-4" />
                选中组
              </Button>
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "graph.deleteSelection", source: "menu" })}>
                <Trash2 className="size-4" />
                解散组
              </Button>
            </>
          ) : null}

          {multiSubgraph ? (
            <>
              <div className="rounded-md border bg-muted/35 p-3 text-sm">
                已选择 <strong>{selectedSubgraphs.length}</strong> 个组
              </div>
              <div className="grid gap-2">
                <Label>组方向</Label>
                <Select
                  value={batchSubgraphDirection.mixed ? MIXED_VALUE : batchSubgraphDirection.value}
                  onValueChange={(value) => {
                    if (value === MIXED_VALUE) return;
                    updateSelectedSubgraphs({ direction: value === INHERIT_VALUE ? undefined : (value as GraphDirection) });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <MixedSelectItem mixed={batchSubgraphDirection.mixed} />
                    {batchSubgraphDirection.mixed ? <SelectSeparator /> : null}
                    <SelectItem value={INHERIT_VALUE}>继承全局方向</SelectItem>
                    {directionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>父组</Label>
                <Select
                  value={batchSubgraphParent.mixed ? MIXED_VALUE : batchSubgraphParent.value}
                  onValueChange={(value) => {
                    if (value === MIXED_VALUE) return;
                    updateSelectedSubgraphs({ parentId: value === ROOT_VALUE ? undefined : value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <MixedSelectItem mixed={batchSubgraphParent.mixed} />
                    {batchSubgraphParent.mixed ? <SelectSeparator /> : null}
                    <SelectItem value={ROOT_VALUE}>根层</SelectItem>
                    {batchSubgraphParentOptions.map((subgraph) => (
                      <SelectItem key={subgraph.id} value={subgraph.id}>
                        {subgraph.title || subgraph.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "graph.deleteSelection", source: "menu" })}>
                <Trash2 className="size-4" />
                解散选中组
              </Button>
            </>
          ) : null}

          {selectedEdge ? (
            <>
              <div className="grid gap-2">
                <Label>起点</Label>
                <Select value={selectedEdge.from} onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { from: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {endpointOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>终点</Label>
                <Select value={selectedEdge.to} onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { to: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {endpointOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>起点连接点</Label>
                <Select
                  value={edgeAnchorSelectValue(selectedEdge.fromAnchor, selectedEdgeFromAnchorOptions)}
                  onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { fromAnchor: value === "auto" ? undefined : value })}
                  disabled={!selectedEdgeFromNode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动选择</SelectItem>
                    {selectedEdgeFromAnchorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>终点连接点</Label>
                <Select
                  value={edgeAnchorSelectValue(selectedEdge.toAnchor, selectedEdgeToAnchorOptions)}
                  onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { toAnchor: value === "auto" ? undefined : value })}
                  disabled={!selectedEdgeToNode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动选择</SelectItem>
                    {selectedEdgeToAnchorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edge-label">连线文本</Label>
                <Input
                  id="edge-label"
                  value={selectedEdge.label}
                  onChange={(event) => updateSelectedEdge(selectedEdge.id, { label: event.target.value })}
                  placeholder="可留空"
                />
              </div>
              <div className="grid gap-2">
                <Label>连线样式</Label>
                <Select
                  value={selectedEdge.style || "solid"}
                  onValueChange={(value) => {
                    const style = value as EdgeStyle;
                    updateSelectedEdge(selectedEdge.id, {
                      style,
                      ...(style === "invisible" ? { markerStart: "none", markerEnd: "none", arrowType: "none" } : {})
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {edgeStyleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>起点端点</Label>
                  <Select
                    value={selectedEdge.markerStart || "none"}
                    onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { markerStart: value as EdgeMarker })}
                    disabled={selectedEdge.style === "invisible"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {edgeMarkerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>终点端点</Label>
                  <Select
                    value={edgeEndMarker(selectedEdge)}
                    onValueChange={(value) => {
                      const markerEnd = value as EdgeMarker;
                      updateSelectedEdge(selectedEdge.id, {
                        markerEnd,
                        arrowType: markerEnd,
                        ...(markerEnd === "none" ? { markerStart: "none" } : {})
                      });
                    }}
                    disabled={selectedEdge.style === "invisible"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {edgeMarkerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="edge-min-length">最小长度</Label>
                  <Input
                    id="edge-min-length"
                    type="number"
                    min={1}
                    value={selectedEdge.minLength || 1}
                    onChange={(event) => updateSelectedEdgeNumber(updateSelectedEdge, selectedEdge.id, "minLength", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edge-mermaid-id">边 ID</Label>
                  <Input
                    id="edge-mermaid-id"
                    value={selectedEdge.mermaidId || ""}
                    placeholder="e1"
                    onChange={(event) => updateSelectedEdge(selectedEdge.id, { mermaidId: normalizeMermaidEdgeId(event.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>动画</Label>
                  <Select value={selectedEdge.animation || "none"} onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { animation: value as EdgeAnimation })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {edgeAnimationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>曲线</Label>
                  <Select
                    value={selectedEdge.curve || DEFAULT_CURVE_VALUE}
                    onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { curve: value === DEFAULT_CURVE_VALUE ? undefined : (value as MermaidCurve) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_CURVE_VALUE}>默认</SelectItem>
                      {edgeCurveOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edge-classes">Class</Label>
                <Input
                  id="edge-classes"
                  value={edgeClassesInput(selectedEdge.classes)}
                  placeholder="animate, primary"
                  onChange={(event) => updateSelectedEdge(selectedEdge.id, { classes: parseEdgeClasses(event.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edge-style-text">linkStyle</Label>
                <Input
                  id="edge-style-text"
                  value={selectedEdge.styleText || ""}
                  placeholder="stroke:#f66,stroke-width:4px"
                  onChange={(event) => updateSelectedEdge(selectedEdge.id, { styleText: event.target.value.trim() || undefined })}
                />
              </div>
              <Separator />
              <Button variant="outline" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "selection.set", selection: selectOnlyEdge(selectedEdge.id), source: "menu" })}>
                <PathArrow className="size-4" />
                选中连线
              </Button>
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "graph.deleteSelection", source: "menu" })}>
                <Trash2 className="size-4" />
                删除连线
              </Button>
            </>
          ) : null}

          {multiEdge ? (
            <>
              <div className="rounded-md border bg-muted/35 p-3 text-sm">
                已选择 <strong>{selectedEdges.length}</strong> 条连线
              </div>
              <div className="grid gap-2">
                <Label>连线样式</Label>
                <Select
                  value={batchEdgeStyle.mixed ? MIXED_VALUE : batchEdgeStyle.value}
                  onValueChange={(value) => {
                    if (value === MIXED_VALUE) return;
                    const style = value as EdgeStyle;
                    updateSelectedEdges({
                      style,
                      ...(style === "invisible" ? { markerStart: "none", markerEnd: "none", arrowType: "none" } : {})
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <MixedSelectItem mixed={batchEdgeStyle.mixed} />
                    {batchEdgeStyle.mixed ? <SelectSeparator /> : null}
                    {edgeStyleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>起点端点</Label>
                  <Select
                    value={batchEdgeMarkerStart.mixed ? MIXED_VALUE : batchEdgeMarkerStart.value}
                    onValueChange={(value) => {
                      if (value === MIXED_VALUE) return;
                      updateSelectedEdges({ markerStart: value as EdgeMarker });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <MixedSelectItem mixed={batchEdgeMarkerStart.mixed} />
                      {batchEdgeMarkerStart.mixed ? <SelectSeparator /> : null}
                      {edgeMarkerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>终点端点</Label>
                  <Select
                    value={batchEdgeMarkerEnd.mixed ? MIXED_VALUE : batchEdgeMarkerEnd.value}
                    onValueChange={(value) => {
                      if (value === MIXED_VALUE) return;
                      const markerEnd = value as EdgeMarker;
                      updateSelectedEdges({
                        markerEnd,
                        arrowType: markerEnd,
                        ...(markerEnd === "none" ? { markerStart: "none" } : {})
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <MixedSelectItem mixed={batchEdgeMarkerEnd.mixed} />
                      {batchEdgeMarkerEnd.mixed ? <SelectSeparator /> : null}
                      {edgeMarkerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="batch-edge-min-length">最小长度</Label>
                  <Input
                    id="batch-edge-min-length"
                    type="number"
                    min={1}
                    value={batchEdgeMinLength.mixed ? "" : batchEdgeMinLength.value}
                    placeholder={batchEdgeMinLength.mixed ? "混合" : undefined}
                    onChange={(event) => updateBatchEdgeNumber(updateSelectedEdges, "minLength", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>动画</Label>
                  <Select
                    value={batchEdgeAnimation.mixed ? MIXED_VALUE : batchEdgeAnimation.value}
                    onValueChange={(value) => {
                      if (value === MIXED_VALUE) return;
                      updateSelectedEdges({ animation: value as EdgeAnimation });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <MixedSelectItem mixed={batchEdgeAnimation.mixed} />
                      {batchEdgeAnimation.mixed ? <SelectSeparator /> : null}
                      {edgeAnimationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>曲线</Label>
                <Select
                  value={batchEdgeCurve.mixed ? MIXED_VALUE : batchEdgeCurve.value}
                  onValueChange={(value) => {
                    if (value === MIXED_VALUE) return;
                    updateSelectedEdges({ curve: value === DEFAULT_CURVE_VALUE ? undefined : (value as MermaidCurve) });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <MixedSelectItem mixed={batchEdgeCurve.mixed} />
                    {batchEdgeCurve.mixed ? <SelectSeparator /> : null}
                    <SelectItem value={DEFAULT_CURVE_VALUE}>默认</SelectItem>
                    {edgeCurveOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="batch-edge-classes">Class</Label>
                <Input
                  id="batch-edge-classes"
                  value={batchEdgeClasses.mixed ? "" : batchEdgeClasses.value}
                  placeholder={batchEdgeClasses.mixed ? "混合" : "animate, primary"}
                  onChange={(event) => updateSelectedEdges({ classes: parseEdgeClasses(event.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="batch-edge-style-text">linkStyle</Label>
                <Input
                  id="batch-edge-style-text"
                  value={batchEdgeStyleText.mixed ? "" : batchEdgeStyleText.value}
                  placeholder={batchEdgeStyleText.mixed ? "混合" : "stroke:#f66"}
                  onChange={(event) => updateSelectedEdges({ styleText: event.target.value.trim() || undefined })}
                />
              </div>
              <Separator />
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={() => onEditorCommand({ type: "graph.deleteSelection", source: "menu" })}>
                <Trash2 className="size-4" />
                删除选中连线
              </Button>
            </>
          ) : null}
        </div>
      </ScrollArea>
    </section>
  );
}

function ColorGrid({ activeFill, mixed = false, onPick }: { activeFill: string; mixed?: boolean; onPick: (fill: string) => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>颜色</Label>
        {mixed ? <span className="text-xs text-muted-foreground">混合</span> : null}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`选择颜色 ${color}`}
            className={cn("h-8 rounded-md border-2", activeFill === color ? "border-foreground" : "border-border")}
            style={{ backgroundColor: color }}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyInspector() {
  return (
    <div className="text-sm leading-6 text-muted-foreground">
      <p>选择节点、组或连线后，可以编辑文本、颜色和连接关系。</p>
    </div>
  );
}

function MixedSelectItem({ mixed }: { mixed: boolean }) {
  return mixed ? (
    <SelectItem value={MIXED_VALUE} disabled>
      混合
    </SelectItem>
  ) : null;
}

function nodeAnchorOptions(node: CanvasNode | undefined) {
  if (!node) return [];
  const shape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  return flowchartPortPoints(shape, { x: 0, y: 0, width: 100, height: 100 }).map((port, index) => ({
    value: port.key,
    label: anchorLabel(port.key, port.kind, index)
  }));
}

function edgeAnchorSelectValue(value: string | undefined, options: { value: string }[]) {
  return value && options.some((option) => option.value === value) ? value : "auto";
}

function edgeEndMarker(edge: Pick<CanvasEdge, "markerEnd" | "arrowType">): EdgeMarker {
  return edge.markerEnd || edge.arrowType || "arrow";
}

function normalizeMermaidEdgeId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const safe = trimmed.replace(/[^\w-]/g, "_");
  return /^[A-Za-z]/.test(safe) ? safe : `e${safe}`;
}

function edgeClassesInput(classes: string[] | undefined) {
  return (classes || []).join(", ");
}

function parseEdgeClasses(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function anchorLabel(key: string, kind: ShapeGeometryPortKind, index: number) {
  const readableKey = anchorKeyLabels[key] || key.replace(/^edge-(\d+)$/, "边 $1").replace(/^vertex-(\d+)$/, "顶点 $1");
  return `${readableKey} · ${anchorKindLabels[kind] || `连接点 ${index + 1}`}`;
}

function normalizeNodePatch(patch: Partial<CanvasNode>) {
  return {
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
    ...(patch.shape !== undefined ? { shape: patch.shape } : {}),
    ...("asset" in patch ? { asset: patch.asset } : {}),
    ...("action" in patch ? { action: patch.action } : {})
  };
}

function normalizeEdgePatch(patch: Partial<CanvasEdge>) {
  return {
    ...(patch.from !== undefined ? { from: patch.from } : {}),
    ...(patch.to !== undefined ? { to: patch.to } : {}),
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.style !== undefined ? { style: patch.style } : {}),
    ...(patch.arrowType !== undefined ? { arrowType: patch.arrowType } : {}),
    ...(patch.markerStart !== undefined ? { markerStart: patch.markerStart } : {}),
    ...(patch.markerEnd !== undefined ? { markerEnd: patch.markerEnd } : {}),
    ...(patch.minLength !== undefined ? { minLength: patch.minLength } : {}),
    ...("mermaidId" in patch ? { mermaidId: patch.mermaidId } : {}),
    ...(patch.animation !== undefined ? { animation: patch.animation } : {}),
    ...("curve" in patch ? { curve: patch.curve } : {}),
    ...("classes" in patch ? { classes: patch.classes } : {}),
    ...("styleText" in patch ? { styleText: patch.styleText } : {}),
    ...("fromAnchor" in patch ? { fromAnchor: patch.fromAnchor } : {}),
    ...("toAnchor" in patch ? { toAnchor: patch.toAnchor } : {})
  };
}

function normalizeSubgraphPatch(patch: Partial<CanvasSubgraph>) {
  return {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...("parentId" in patch ? { parentId: patch.parentId } : {}),
    ...("direction" in patch ? { direction: patch.direction } : {})
  };
}

function sharedSelectionValue<T, V>(items: T[], read: (item: T) => V, fallback: V): { mixed: boolean; value: V } {
  const first = items[0] ? read(items[0]) : fallback;
  return {
    value: first,
    mixed: items.length > 1 && items.some((item) => !Object.is(read(item), first))
  };
}

function updateBatchNodeAssetNumber(updateSelectedNodes: (patch: CanvasNodeBatchPatch) => void, key: "width" | "height", value: string) {
  if (!value.trim()) return;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;

  updateSelectedNodes({ asset: key === "width" ? { width: parsed } : { height: parsed } });
}

function updateSelectedEdgeNumber(updateSelectedEdge: (id: string, patch: Partial<CanvasEdge>) => void, edgeId: string, key: "minLength", value: string) {
  if (!value.trim()) return;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;

  updateSelectedEdge(edgeId, { [key]: Math.max(1, Math.round(parsed)) });
}

function updateBatchEdgeNumber(updateSelectedEdges: (patch: CanvasEdgeBatchPatch) => void, key: "minLength", value: string) {
  if (!value.trim()) return;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;

  updateSelectedEdges({ [key]: Math.max(1, Math.round(parsed)) });
}

function subgraphParentOptionsForBatch(graph: MermaidGraph, selectedSubgraphs: CanvasSubgraph[]) {
  const blockedIds = new Set(selectedSubgraphs.map((subgraph) => subgraph.id));
  selectedSubgraphs.forEach((subgraph) => {
    descendantSubgraphIds(graph, subgraph.id).forEach((id) => blockedIds.add(id));
  });

  return (graph.subgraphs || []).filter((subgraph) => !blockedIds.has(subgraph.id));
}
