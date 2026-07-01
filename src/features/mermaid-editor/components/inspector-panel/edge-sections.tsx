import { PathArrow, Trash as Trash2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_CURVE_VALUE,
  MIXED_VALUE,
  edgeAnimationOptions,
  edgeCurveOptions,
  edgeMarkerOptions,
  edgeStyleOptions
} from "@/features/mermaid-editor/components/inspector-panel/constants";
import {
  edgeAnchorSelectValue,
  edgeClassesInput,
  edgeEndMarker,
  normalizeMermaidEdgeId,
  parseEdgeClasses,
  updateBatchEdgeNumber,
  updateSelectedEdgeNumber,
  type SharedSelectionValue
} from "@/features/mermaid-editor/components/inspector-panel/model";
import { MixedSelectItem } from "@/features/mermaid-editor/components/inspector-panel/shared-ui";
import type {
  CanvasEdge,
  CanvasEdgeBatchPatch,
  EdgeAnimation,
  EdgeMarker,
  EdgeStyle,
  MermaidCurve
} from "@/features/mermaid-editor/lib/editor-types";

type EdgeInspectorSectionProps = {
  edge: CanvasEdge;
  endpointOptions: { id: string; label: string }[];
  fromAnchorOptions: { value: string; label: string }[];
  toAnchorOptions: { value: string; label: string }[];
  hasFromNode: boolean;
  hasToNode: boolean;
  onUpdateEdge: (id: string, patch: Partial<CanvasEdge>) => void;
  onSelectEdge: (edgeId: string) => void;
  onDeleteSelection: () => void;
};

type MultiEdgeInspectorSectionProps = {
  selectedEdges: CanvasEdge[];
  batchEdgeStyle: SharedSelectionValue<EdgeStyle>;
  batchEdgeMarkerStart: SharedSelectionValue<EdgeMarker>;
  batchEdgeMarkerEnd: SharedSelectionValue<EdgeMarker>;
  batchEdgeMinLength: SharedSelectionValue<number>;
  batchEdgeAnimation: SharedSelectionValue<EdgeAnimation>;
  batchEdgeCurve: SharedSelectionValue<MermaidCurve | typeof DEFAULT_CURVE_VALUE>;
  batchEdgeClasses: SharedSelectionValue<string>;
  batchEdgeStyleText: SharedSelectionValue<string>;
  onUpdateSelectedEdges: (patch: CanvasEdgeBatchPatch) => void;
  onDeleteSelection: () => void;
};

export function EdgeInspectorSection({
  edge,
  endpointOptions,
  fromAnchorOptions,
  toAnchorOptions,
  hasFromNode,
  hasToNode,
  onUpdateEdge,
  onSelectEdge,
  onDeleteSelection
}: EdgeInspectorSectionProps) {
  return (
    <>
      <EndpointSelect label="起点" value={edge.from} endpointOptions={endpointOptions} onChange={(value) => onUpdateEdge(edge.id, { from: value })} />
      <EndpointSelect label="终点" value={edge.to} endpointOptions={endpointOptions} onChange={(value) => onUpdateEdge(edge.id, { to: value })} />
      <EdgeAnchorSelect
        label="起点连接点"
        value={edgeAnchorSelectValue(edge.fromAnchor, fromAnchorOptions)}
        options={fromAnchorOptions}
        disabled={!hasFromNode}
        onChange={(value) => onUpdateEdge(edge.id, { fromAnchor: value === "auto" ? undefined : value })}
      />
      <EdgeAnchorSelect
        label="终点连接点"
        value={edgeAnchorSelectValue(edge.toAnchor, toAnchorOptions)}
        options={toAnchorOptions}
        disabled={!hasToNode}
        onChange={(value) => onUpdateEdge(edge.id, { toAnchor: value === "auto" ? undefined : value })}
      />
      <div className="grid gap-2">
        <Label htmlFor="edge-label">连线文本</Label>
        <Input id="edge-label" value={edge.label} onChange={(event) => onUpdateEdge(edge.id, { label: event.target.value })} placeholder="可留空" />
      </div>
      <EdgeStyleSelect
        value={edge.style || "solid"}
        onChange={(style) =>
          onUpdateEdge(edge.id, {
            style,
            ...(style === "invisible" ? { markerStart: "none", markerEnd: "none", arrowType: "none" } : {})
          })
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <EdgeMarkerSelect label="起点端点" value={edge.markerStart || "none"} disabled={edge.style === "invisible"} onChange={(markerStart) => onUpdateEdge(edge.id, { markerStart })} />
        <EdgeMarkerSelect
          label="终点端点"
          value={edgeEndMarker(edge)}
          disabled={edge.style === "invisible"}
          onChange={(markerEnd) =>
            onUpdateEdge(edge.id, {
              markerEnd,
              arrowType: markerEnd,
              ...(markerEnd === "none" ? { markerStart: "none" } : {})
            })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label htmlFor="edge-min-length">最小长度</Label>
          <Input id="edge-min-length" type="number" min={1} value={edge.minLength || 1} onChange={(event) => updateSelectedEdgeNumber(onUpdateEdge, edge.id, "minLength", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edge-mermaid-id">边 ID</Label>
          <Input id="edge-mermaid-id" value={edge.mermaidId || ""} placeholder="e1" onChange={(event) => onUpdateEdge(edge.id, { mermaidId: normalizeMermaidEdgeId(event.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <EdgeAnimationSelect value={edge.animation || "none"} onChange={(animation) => onUpdateEdge(edge.id, { animation })} />
        <EdgeCurveSelect value={edge.curve || DEFAULT_CURVE_VALUE} onChange={(curve) => onUpdateEdge(edge.id, { curve: curve === DEFAULT_CURVE_VALUE ? undefined : curve })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edge-classes">Class</Label>
        <Input id="edge-classes" value={edgeClassesInput(edge.classes)} placeholder="animate, primary" onChange={(event) => onUpdateEdge(edge.id, { classes: parseEdgeClasses(event.target.value) })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edge-style-text">linkStyle</Label>
        <Input id="edge-style-text" value={edge.styleText || ""} placeholder="stroke:#f66,stroke-width:4px" onChange={(event) => onUpdateEdge(edge.id, { styleText: event.target.value.trim() || undefined })} />
      </div>
      <Separator />
      <Button variant="outline" className="h-8 justify-start px-2" onClick={() => onSelectEdge(edge.id)}>
        <PathArrow className="size-4" />
        选中连线
      </Button>
      <Button variant="destructive" className="h-8 justify-start px-2" onClick={onDeleteSelection}>
        <Trash2 className="size-4" />
        删除连线
      </Button>
    </>
  );
}

export function MultiEdgeInspectorSection({
  selectedEdges,
  batchEdgeStyle,
  batchEdgeMarkerStart,
  batchEdgeMarkerEnd,
  batchEdgeMinLength,
  batchEdgeAnimation,
  batchEdgeCurve,
  batchEdgeClasses,
  batchEdgeStyleText,
  onUpdateSelectedEdges,
  onDeleteSelection
}: MultiEdgeInspectorSectionProps) {
  return (
    <>
      <div className="rounded-md border bg-muted/35 p-3 text-sm">
        已选择 <strong>{selectedEdges.length}</strong> 条连线
      </div>
      <EdgeStyleSelect
        value={batchEdgeStyle.mixed ? MIXED_VALUE : batchEdgeStyle.value}
        mixed={batchEdgeStyle.mixed}
        onChange={(style) =>
          onUpdateSelectedEdges({
            style,
            ...(style === "invisible" ? { markerStart: "none", markerEnd: "none", arrowType: "none" } : {})
          })
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <EdgeMarkerSelect
          label="起点端点"
          value={batchEdgeMarkerStart.mixed ? MIXED_VALUE : batchEdgeMarkerStart.value}
          mixed={batchEdgeMarkerStart.mixed}
          onChange={(markerStart) => onUpdateSelectedEdges({ markerStart })}
        />
        <EdgeMarkerSelect
          label="终点端点"
          value={batchEdgeMarkerEnd.mixed ? MIXED_VALUE : batchEdgeMarkerEnd.value}
          mixed={batchEdgeMarkerEnd.mixed}
          onChange={(markerEnd) =>
            onUpdateSelectedEdges({
              markerEnd,
              arrowType: markerEnd,
              ...(markerEnd === "none" ? { markerStart: "none" } : {})
            })
          }
        />
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
            onChange={(event) => updateBatchEdgeNumber(onUpdateSelectedEdges, "minLength", event.target.value)}
          />
        </div>
        <EdgeAnimationSelect
          value={batchEdgeAnimation.mixed ? MIXED_VALUE : batchEdgeAnimation.value}
          mixed={batchEdgeAnimation.mixed}
          onChange={(animation) => onUpdateSelectedEdges({ animation })}
        />
      </div>
      <EdgeCurveSelect
        value={batchEdgeCurve.mixed ? MIXED_VALUE : batchEdgeCurve.value}
        mixed={batchEdgeCurve.mixed}
        onChange={(curve) => onUpdateSelectedEdges({ curve: curve === DEFAULT_CURVE_VALUE ? undefined : curve })}
      />
      <div className="grid gap-2">
        <Label htmlFor="batch-edge-classes">Class</Label>
        <Input id="batch-edge-classes" value={batchEdgeClasses.mixed ? "" : batchEdgeClasses.value} placeholder={batchEdgeClasses.mixed ? "混合" : "animate, primary"} onChange={(event) => onUpdateSelectedEdges({ classes: parseEdgeClasses(event.target.value) })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="batch-edge-style-text">linkStyle</Label>
        <Input id="batch-edge-style-text" value={batchEdgeStyleText.mixed ? "" : batchEdgeStyleText.value} placeholder={batchEdgeStyleText.mixed ? "混合" : "stroke:#f66"} onChange={(event) => onUpdateSelectedEdges({ styleText: event.target.value.trim() || undefined })} />
      </div>
      <Separator />
      <Button variant="destructive" className="h-8 justify-start px-2" onClick={onDeleteSelection}>
        <Trash2 className="size-4" />
        删除选中连线
      </Button>
    </>
  );
}

function EndpointSelect({ label, value, endpointOptions, onChange }: { label: string; value: string; endpointOptions: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
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
  );
}

function EdgeAnchorSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: { value: string; label: string }[]; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">自动选择</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EdgeStyleSelect({ value, mixed = false, onChange }: { value: EdgeStyle | typeof MIXED_VALUE; mixed?: boolean; onChange: (style: EdgeStyle) => void }) {
  return (
    <div className="grid gap-2">
      <Label>连线样式</Label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as EdgeStyle);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <MixedSelectItem mixed={mixed} />
          {mixed ? <SelectSeparator /> : null}
          {edgeStyleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EdgeMarkerSelect({ label, value, mixed = false, disabled = false, onChange }: { label: string; value: EdgeMarker | typeof MIXED_VALUE; mixed?: boolean; disabled?: boolean; onChange: (marker: EdgeMarker) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as EdgeMarker);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <MixedSelectItem mixed={mixed} />
          {mixed ? <SelectSeparator /> : null}
          {edgeMarkerOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EdgeAnimationSelect({ value, mixed = false, onChange }: { value: EdgeAnimation | typeof MIXED_VALUE; mixed?: boolean; onChange: (animation: EdgeAnimation) => void }) {
  return (
    <div className="grid gap-2">
      <Label>动画</Label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as EdgeAnimation);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <MixedSelectItem mixed={mixed} />
          {mixed ? <SelectSeparator /> : null}
          {edgeAnimationOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EdgeCurveSelect({ value, mixed = false, onChange }: { value: MermaidCurve | typeof DEFAULT_CURVE_VALUE | typeof MIXED_VALUE; mixed?: boolean; onChange: (curve: MermaidCurve | typeof DEFAULT_CURVE_VALUE) => void }) {
  return (
    <div className="grid gap-2">
      <Label>曲线</Label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as MermaidCurve | typeof DEFAULT_CURVE_VALUE);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <MixedSelectItem mixed={mixed} />
          {mixed ? <SelectSeparator /> : null}
          <SelectItem value={DEFAULT_CURVE_VALUE}>默认</SelectItem>
          {edgeCurveOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
