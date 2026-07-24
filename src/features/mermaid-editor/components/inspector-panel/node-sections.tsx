import { Link, OpenNewWindow, PathArrow, Trash as Trash2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MIXED_VALUE } from "@/features/mermaid-editor/components/inspector-panel/constants";
import { updateBatchNodeAssetNumber, type SharedSelectionValue } from "@/features/mermaid-editor/components/inspector-panel/model";
import { ColorGrid, MixedSelectItem } from "@/features/mermaid-editor/components/inspector-panel/shared-ui";
import type { CanvasNode, CanvasNodeAction, CanvasNodeBatchPatch, FlowchartNodeShape } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_FLOWCHART_NODE_SHAPE, FLOWCHART_SHAPE_GROUPS, FLOWCHART_SHAPES } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { NODE_ACTION_NONE_VALUE, nodeActionLabel, nodeActionTarget } from "@/features/mermaid-editor/lib/node-actions";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";

type NodeInspectorSectionProps = {
  node: CanvasNode;
  graphNodeCount: number;
  onRenameNode: (node: CanvasNode, value: string) => void;
  onUpdateNode: (id: string, patch: Partial<CanvasNode>) => void;
  onUpdateNodeAsset: (node: CanvasNode, patch: Partial<NonNullable<CanvasNode["asset"]>>) => void;
  onUpdateNodeActionKind: (node: CanvasNode, kind: CanvasNodeAction["kind"] | typeof NODE_ACTION_NONE_VALUE) => void;
  onUpdateUrlNodeAction: (node: CanvasNode, patch: Partial<Extract<CanvasNodeAction, { kind: "url" }>>) => void;
  onUpdateFileNodeAction: (node: CanvasNode, patch: Partial<Extract<CanvasNodeAction, { kind: "file" }>>) => void;
  onAddEdgeFrom: (node: CanvasNode) => void;
  onDeleteSelection: () => void;
  onCopyNodeActionTarget: (action: CanvasNodeAction) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onEditNodeAction?: (node: CanvasNode) => void;
};

type MultiNodeInspectorSectionProps = {
  batchNodeShape: SharedSelectionValue<FlowchartNodeShape>;
  batchNodeFill: SharedSelectionValue<string>;
  canBatchNodeAsset: boolean;
  batchAssetWidth: SharedSelectionValue<number>;
  batchAssetHeight: SharedSelectionValue<number>;
  batchAssetLabelPosition: SharedSelectionValue<NonNullable<CanvasNode["asset"]>["labelPosition"]>;
  batchAssetPreserveAspectRatio: SharedSelectionValue<boolean>;
  onUpdateSelectedNodes: (patch: CanvasNodeBatchPatch) => void;
  onBatchFill: (fill: string) => void;
  onDeleteSelection: () => void;
};

export function NodeInspectorSection({
  node,
  graphNodeCount,
  onRenameNode,
  onUpdateNode,
  onUpdateNodeAsset,
  onUpdateNodeActionKind,
  onUpdateUrlNodeAction,
  onUpdateFileNodeAction,
  onAddEdgeFrom,
  onDeleteSelection,
  onCopyNodeActionTarget,
  onOpenNodeAction,
  onEditNodeAction
}: NodeInspectorSectionProps) {
  if (resolveCanvasNodeKind(node) === "table") {
    return (
      <>
        <div className="grid gap-2">
          <Label htmlFor="node-id">节点 ID</Label>
          <Input id="node-id" value={node.id} onChange={(event) => onRenameNode(node, event.target.value)} />
        </div>
        <div className="text-sm text-muted-foreground">{node.content?.kind === "table" ? `${node.content.columns.length} 列 · ${node.content.rows.length} 行` : node.csvStatus === "error" ? "CSV 读取失败" : "正在加载 CSV…"}</div>
        <Separator />
        <Button variant="outline" size="sm" className="justify-start" onClick={() => onAddEdgeFrom(node)} disabled={graphNodeCount < 2}>
          <PathArrow className="size-4" />
          从此表格连线
        </Button>
        <Button variant="destructive" size="sm" className="justify-start" onClick={onDeleteSelection}>
          <Trash2 className="size-4" />
          删除表格
        </Button>
      </>
    );
  }
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="node-id">节点 ID</Label>
        <Input id="node-id" value={node.id} onChange={(event) => onRenameNode(node, event.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="node-label">节点文本</Label>
        <Input id="node-label" value={node.label} onChange={(event) => onUpdateNode(node.id, { label: event.target.value })} />
      </div>
      <NodeShapeSelect value={node.shape || DEFAULT_FLOWCHART_NODE_SHAPE} onChange={(shape) => onUpdateNode(node.id, { shape })} />
      <ColorGrid activeFill={node.fill} onPick={(fill) => onUpdateNode(node.id, { fill })} />
      <Separator />
      <NodeImageFields node={node} onUpdateNodeAsset={onUpdateNodeAsset} />
      <Separator />
      <NodeActionFields
        node={node}
        onUpdateNodeActionKind={onUpdateNodeActionKind}
        onUpdateUrlNodeAction={onUpdateUrlNodeAction}
        onUpdateFileNodeAction={onUpdateFileNodeAction}
        onCopyNodeActionTarget={onCopyNodeActionTarget}
        onOpenNodeAction={onOpenNodeAction}
        onEditNodeAction={onEditNodeAction}
      />
      <Separator />
      <Button variant="outline" size="sm" className="justify-start" onClick={() => onAddEdgeFrom(node)} disabled={graphNodeCount < 2}>
        <PathArrow className="size-4" />
        从此节点连线
      </Button>
      <Button variant="destructive" size="sm" className="justify-start" onClick={onDeleteSelection}>
        <Trash2 className="size-4" />
        删除节点
      </Button>
    </>
  );
}

export function MultiNodeInspectorSection({
  batchNodeShape,
  batchNodeFill,
  canBatchNodeAsset,
  batchAssetWidth,
  batchAssetHeight,
  batchAssetLabelPosition,
  batchAssetPreserveAspectRatio,
  onUpdateSelectedNodes,
  onBatchFill,
  onDeleteSelection
}: MultiNodeInspectorSectionProps) {
  return (
    <>
      <NodeShapeSelect
        value={batchNodeShape.mixed ? MIXED_VALUE : batchNodeShape.value}
        mixed={batchNodeShape.mixed}
        onChange={(shape) => onUpdateSelectedNodes({ shape })}
      />
      <ColorGrid activeFill={batchNodeFill.mixed ? "" : batchNodeFill.value} mixed={batchNodeFill.mixed} onPick={onBatchFill} />
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
                onChange={(event) => updateBatchNodeAssetNumber(onUpdateSelectedNodes, "width", event.target.value)}
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
                onChange={(event) => updateBatchNodeAssetNumber(onUpdateSelectedNodes, "height", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>标签位置</Label>
            <Select
              value={batchAssetLabelPosition.mixed ? MIXED_VALUE : batchAssetLabelPosition.value}
              onValueChange={(value) => {
                if (value === MIXED_VALUE) return;
                onUpdateSelectedNodes({ asset: { labelPosition: value as NonNullable<CanvasNode["asset"]>["labelPosition"] } });
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
                onUpdateSelectedNodes({ asset: { preserveAspectRatio: value === "true" } });
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
      <Button variant="destructive" size="sm" className="justify-start" onClick={onDeleteSelection}>
        <Trash2 className="size-4" />
        删除选中节点
      </Button>
    </>
  );
}

function NodeShapeSelect({
  value,
  mixed = false,
  onChange
}: {
  value: FlowchartNodeShape | typeof MIXED_VALUE;
  mixed?: boolean;
  onChange: (shape: FlowchartNodeShape) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>节点形状</Label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as FlowchartNodeShape);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[360px]">
          <MixedSelectItem mixed={mixed} />
          {FLOWCHART_SHAPE_GROUPS.map((group, groupIndex) => (
            <SelectGroup key={group}>
              {groupIndex > 0 || mixed ? <SelectSeparator /> : null}
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
  );
}

function NodeImageFields({ node, onUpdateNodeAsset }: { node: CanvasNode; onUpdateNodeAsset: NodeInspectorSectionProps["onUpdateNodeAsset"] }) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="node-image-src">图片 URL / 路径</Label>
        <Input id="node-image-src" value={node.asset?.src || ""} placeholder="https:// 或 assets/..." onChange={(event) => onUpdateNodeAsset(node, { src: event.target.value })} />
      </div>
      {node.asset ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="node-image-width">图片宽度</Label>
              <Input id="node-image-width" type="number" min={24} value={node.asset.width} onChange={(event) => onUpdateNodeAsset(node, { width: Number(event.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="node-image-height">图片高度</Label>
              <Input id="node-image-height" type="number" min={24} value={node.asset.height} onChange={(event) => onUpdateNodeAsset(node, { height: Number(event.target.value) })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>标签位置</Label>
            <Select value={node.asset.labelPosition} onValueChange={(value) => onUpdateNodeAsset(node, { labelPosition: value as NonNullable<CanvasNode["asset"]>["labelPosition"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom">图片下方</SelectItem>
                <SelectItem value="top">图片上方</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="justify-start" onClick={() => onUpdateNodeAsset(node, { preserveAspectRatio: !node.asset?.preserveAspectRatio })}>
            {node.asset.preserveAspectRatio ? "保持比例" : "不保持比例"}
          </Button>
        </>
      ) : null}
    </>
  );
}

function NodeActionFields({
  node,
  onUpdateNodeActionKind,
  onUpdateUrlNodeAction,
  onUpdateFileNodeAction,
  onCopyNodeActionTarget,
  onOpenNodeAction,
  onEditNodeAction
}: Pick<
  NodeInspectorSectionProps,
  "node" | "onUpdateNodeActionKind" | "onUpdateUrlNodeAction" | "onUpdateFileNodeAction" | "onCopyNodeActionTarget" | "onOpenNodeAction" | "onEditNodeAction"
>) {
  return (
    <>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>节点动作</Label>
          {node.action ? (
            <button
              type="button"
              className="min-w-0 max-w-[180px] truncate rounded px-1 text-right text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title={`复制${nodeActionLabel(node.action)}目标：${nodeActionTarget(node.action)}`}
              onClick={() => onCopyNodeActionTarget(node.action!)}
            >
              {nodeActionTarget(node.action)}
            </button>
          ) : null}
        </div>
        <Select value={node.action?.kind || NODE_ACTION_NONE_VALUE} onValueChange={(value) => onUpdateNodeActionKind(node, value as CanvasNodeAction["kind"] | typeof NODE_ACTION_NONE_VALUE)}>
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
      {node.action?.kind === "url" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="node-action-url">网页 URL</Label>
            <Input id="node-action-url" value={node.action.url} placeholder="https://example.com" onChange={(event) => onUpdateUrlNodeAction(node, { url: event.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>打开方式</Label>
            <Select value={node.action.openMode} onValueChange={(value) => onUpdateUrlNodeAction(node, { openMode: value as Extract<CanvasNodeAction, { kind: "url" }>["openMode"] })}>
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
      {node.action?.kind === "file" ? (
        <div className="grid gap-2">
          <Label htmlFor="node-action-file">文件路径</Label>
          <Input id="node-action-file" value={node.action.path} placeholder="./docs/spec.md" onChange={(event) => onUpdateFileNodeAction(node, { path: event.target.value })} />
        </div>
      ) : null}
      {node.action ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="node-action-tooltip">提示文本</Label>
            <Input
              id="node-action-tooltip"
              value={node.action.tooltip || ""}
              placeholder={node.action.kind === "url" ? "打开链接" : "打开文件"}
              onChange={(event) =>
                node.action?.kind === "url"
                  ? onUpdateUrlNodeAction(node, { tooltip: event.target.value })
                  : onUpdateFileNodeAction(node, { tooltip: event.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="justify-start" onClick={() => onOpenNodeAction?.(node)}>
              <OpenNewWindow className="size-4" />
              测试打开
            </Button>
            <Button variant="outline" size="sm" className="justify-start" onClick={() => onEditNodeAction?.(node)}>
              <Link className="size-4" />
              链接编辑器
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
