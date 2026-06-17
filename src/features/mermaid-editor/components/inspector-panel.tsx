"use client";

import { ControlSlider as SlidersHorizontal, PathArrow, Trash as Trash2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type {
  CanvasEdge,
  CanvasNode,
  CanvasSubgraph,
  EdgeStyle,
  FlowchartArrowType,
  FlowchartNodeShape,
  GraphDirection,
  MermaidGraph,
  Selection
} from "@/features/mermaid-editor/lib/editor-types";
import { descendantSubgraphIds, selectOnlyEdge, selectOnlySubgraph } from "@/features/mermaid-editor/lib/editor-actions";
import { FLOWCHART_SHAPE_GROUPS, FLOWCHART_SHAPES } from "@/features/mermaid-editor/lib/flowchart-shapes";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { palette } from "@/features/mermaid-editor/lib/mermaid-graph";
import { cn } from "@/lib/utils";

type InspectorPanelProps = {
  graph: MermaidGraph;
  selection: Selection;
  onEditorCommand: (command: EditorCommand) => void;
};

const edgeStyleOptions: { value: EdgeStyle; label: string }[] = [
  { value: "solid", label: "实线" },
  { value: "thick", label: "粗线" },
  { value: "dotted", label: "点线" }
];

const edgeArrowOptions: { value: FlowchartArrowType; label: string }[] = [
  { value: "arrow", label: "箭头" },
  { value: "none", label: "无箭头" },
  { value: "circle", label: "圆点" },
  { value: "cross", label: "叉号" }
];

const directionOptions: { value: GraphDirection; label: string }[] = [
  { value: "LR", label: "LR" },
  { value: "TD", label: "TD" },
  { value: "TB", label: "TB" },
  { value: "RL", label: "RL" },
  { value: "BT", label: "BT" }
];

export function InspectorPanel({ graph, selection, onEditorCommand }: InspectorPanelProps) {
  const selectedNodes = graph.nodes.filter((node) => selection.nodeIds.includes(node.id));
  const selectedEdges = graph.edges.filter((edge) => selection.edgeIds.includes(edge.id));
  const selectedSubgraphs = (graph.subgraphs || []).filter((subgraph) => (selection.subgraphIds || []).includes(subgraph.id));
  const selectedNode = selectedNodes.length === 1 && selectedEdges.length === 0 && selectedSubgraphs.length === 0 ? selectedNodes[0] : undefined;
  const selectedEdge = selectedEdges.length === 1 && selectedNodes.length === 0 && selectedSubgraphs.length === 0 ? selectedEdges[0] : undefined;
  const selectedSubgraph = selectedSubgraphs.length === 1 && selectedNodes.length === 0 && selectedEdges.length === 0 ? selectedSubgraphs[0] : undefined;
  const multiNode = selectedNodes.length > 1 && selectedEdges.length === 0 && selectedSubgraphs.length === 0;
  const endpointOptions = [
    ...graph.nodes.map((node) => ({ id: node.id, label: `${node.id} · 节点` })),
    ...(graph.subgraphs || []).map((subgraph) => ({ id: subgraph.id, label: `${subgraph.id} · 组` }))
  ];

  function updateNode(id: string, patch: Partial<CanvasNode>) {
    onEditorCommand({ type: "graph.updateNode", nodeId: id, patch: normalizeNodePatch(patch), source: "menu" });
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

  function addEdgeFrom(node: CanvasNode) {
    const target = graph.nodes.find((item) => item.id !== node.id);
    if (!target) return;
    onEditorCommand({ type: "graph.createEdge", fromId: node.id, toId: target.id, source: "menu" });
  }

  function batchFill(fill: string) {
    onEditorCommand({ type: "graph.updateNodeFill", nodeIds: selectedNodes.map((node) => node.id), fill, source: "menu" });
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)]">
      <header className="flex items-center gap-2 border-b bg-card/95 px-3 pr-12 text-sm font-medium">
        <SlidersHorizontal className="size-4 text-icon" />
        检查器
      </header>
      <ScrollArea className="min-h-0">
        <div className="grid gap-4 p-4">
          {!selectedNode && !selectedEdge && !selectedSubgraph && !multiNode ? <EmptyInspector /> : null}

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
              <ColorGrid activeFill={allSameFill(selectedNodes) ? selectedNodes[0].fill : ""} onPick={batchFill} />
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
                <Select value={selectedEdge.style || "solid"} onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { style: value as EdgeStyle })}>
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
              <div className="grid gap-2">
                <Label>箭头类型</Label>
                <Select
                  value={selectedEdge.arrowType || "arrow"}
                  onValueChange={(value) => updateSelectedEdge(selectedEdge.id, { arrowType: value as FlowchartArrowType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {edgeArrowOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </div>
      </ScrollArea>
    </section>
  );
}

function ColorGrid({ activeFill, onPick }: { activeFill: string; onPick: (fill: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>颜色</Label>
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
function normalizeNodePatch(patch: Partial<CanvasNode>) {
  return {
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
    ...(patch.shape !== undefined ? { shape: patch.shape } : {})
  };
}

function normalizeEdgePatch(patch: Partial<CanvasEdge>) {
  return {
    ...(patch.from !== undefined ? { from: patch.from } : {}),
    ...(patch.to !== undefined ? { to: patch.to } : {}),
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.style !== undefined ? { style: patch.style } : {}),
    ...(patch.arrowType !== undefined ? { arrowType: patch.arrowType } : {})
  };
}

function normalizeSubgraphPatch(patch: Partial<CanvasSubgraph>) {
  return {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...("parentId" in patch ? { parentId: patch.parentId } : {}),
    ...("direction" in patch ? { direction: patch.direction } : {})
  };
}

function allSameFill(nodes: CanvasNode[]) {
  return nodes.length > 0 && nodes.every((node) => node.fill === nodes[0].fill);
}
