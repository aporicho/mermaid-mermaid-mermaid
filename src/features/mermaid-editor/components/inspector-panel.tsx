"use client";

import { ControlSlider as SlidersHorizontal, PathArrow, Trash as Trash2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CanvasEdge, CanvasNode, EdgeStyle, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { createEdge, renameNode, selectOnlyEdge, updateEdge, updateNodeFill, updateNodeLabel } from "@/features/mermaid-editor/lib/editor-actions";
import { palette } from "@/features/mermaid-editor/lib/mermaid-graph";
import { cn } from "@/lib/utils";

type InspectorPanelProps = {
  graph: MermaidGraph;
  selection: Selection;
  onGraphChange: (graph: MermaidGraph, selection?: Selection, message?: string) => void;
  onSelectionChange: (selection: Selection) => void;
  onDelete: () => void;
};

const edgeStyleOptions: { value: EdgeStyle; label: string }[] = [
  { value: "solid", label: "实线" },
  { value: "thick", label: "粗线" },
  { value: "dotted", label: "点线" }
];

export function InspectorPanel({ graph, selection, onGraphChange, onSelectionChange, onDelete }: InspectorPanelProps) {
  const selectedNodes = graph.nodes.filter((node) => selection.nodeIds.includes(node.id));
  const selectedEdges = graph.edges.filter((edge) => selection.edgeIds.includes(edge.id));
  const selectedNode = selectedNodes.length === 1 && selectedEdges.length === 0 ? selectedNodes[0] : undefined;
  const selectedEdge = selectedEdges.length === 1 && selectedNodes.length === 0 ? selectedEdges[0] : undefined;
  const multiNode = selectedNodes.length > 1 && selectedEdges.length === 0;

  function updateNode(id: string, patch: Partial<CanvasNode>) {
    const nextGraph =
      patch.label !== undefined
        ? updateNodeLabel(graph, id, patch.label)
        : {
            ...graph,
            nodes: graph.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
          };
    onGraphChange(nextGraph, selection, "已更新节点。");
  }

  function updateSelectedEdge(id: string, patch: Partial<CanvasEdge>) {
    onGraphChange(updateEdge(graph, id, patch), selection, "已更新连线。");
  }

  function renameSelectedNode(node: CanvasNode, value: string) {
    const result = renameNode(graph, node.id, value);
    onGraphChange(result.graph, result.selection, "已重命名节点。");
  }

  function addEdgeFrom(node: CanvasNode) {
    const target = graph.nodes.find((item) => item.id !== node.id);
    if (!target) return;
    const result = createEdge(graph, node.id, target.id);
    onGraphChange(result.graph, result.selection, "已创建连线。");
  }

  function batchFill(fill: string) {
    onGraphChange(updateNodeFill(graph, selectedNodes.map((node) => node.id), fill), selection, "已批量修改颜色。");
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)]">
      <header className="flex items-center gap-2 border-b bg-card/95 px-3 pr-12 text-sm font-medium">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        检查器
      </header>
      <ScrollArea className="min-h-0">
        <div className="grid gap-4 p-4">
          {!selectedNode && !selectedEdge && !multiNode ? <EmptyInspector /> : null}

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
              <ColorGrid activeFill={selectedNode.fill} onPick={(fill) => updateNode(selectedNode.id, { fill })} />
              <Separator />
              <Button variant="outline" className="h-8 justify-start px-2" onClick={() => addEdgeFrom(selectedNode)} disabled={graph.nodes.length < 2}>
                <PathArrow className="size-4" />
                从此节点连线
              </Button>
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={onDelete}>
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
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={onDelete}>
                <Trash2 className="size-4" />
                删除选中节点
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
                    {graph.nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.id}
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
                    {graph.nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.id}
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
              <Separator />
              <Button variant="outline" className="h-8 justify-start px-2" onClick={() => onSelectionChange(selectOnlyEdge(selectedEdge.id))}>
                <PathArrow className="size-4" />
                选中连线
              </Button>
              <Button variant="destructive" className="h-8 justify-start px-2" onClick={onDelete}>
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
      <p>选择节点或连线后，可以编辑文本、颜色和连接关系。</p>
    </div>
  );
}

function allSameFill(nodes: CanvasNode[]) {
  return nodes.length > 0 && nodes.every((node) => node.fill === nodes[0].fill);
}
