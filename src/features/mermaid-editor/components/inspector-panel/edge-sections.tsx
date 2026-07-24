import { useId } from "react";
import { Trash as Trash2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  onDeleteSelection: () => void;
};

type MultiEdgeInspectorSectionProps = {
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
  onDeleteSelection
}: EdgeInspectorSectionProps) {
  return (
    <FieldGroup className="gap-4">
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
      <Field className="gap-2">
        <FieldLabel htmlFor="edge-label">连线文本</FieldLabel>
        <Input id="edge-label" value={edge.label} onChange={(event) => onUpdateEdge(edge.id, { label: event.target.value })} placeholder="可留空" />
      </Field>
      <EdgeStyleSelect
        value={edge.style || "solid"}
        onChange={(style) =>
          onUpdateEdge(edge.id, {
            style,
            ...(style === "invisible" ? { markerStart: "none", markerEnd: "none", arrowType: "none" } : {})
          })
        }
      />
      <FieldGroup className="grid grid-cols-2 gap-2">
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
      </FieldGroup>
      <FieldGroup className="grid grid-cols-2 gap-2">
        <Field className="gap-2">
          <FieldLabel htmlFor="edge-min-length">最小长度</FieldLabel>
          <Input id="edge-min-length" type="number" min={1} value={edge.minLength || 1} onChange={(event) => updateSelectedEdgeNumber(onUpdateEdge, edge.id, "minLength", event.target.value)} />
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor="edge-mermaid-id">边 ID</FieldLabel>
          <Input id="edge-mermaid-id" value={edge.mermaidId || ""} placeholder="e1" onChange={(event) => onUpdateEdge(edge.id, { mermaidId: normalizeMermaidEdgeId(event.target.value) })} />
        </Field>
      </FieldGroup>
      <FieldGroup className="grid grid-cols-2 gap-2">
        <EdgeAnimationSelect value={edge.animation || "none"} onChange={(animation) => onUpdateEdge(edge.id, { animation })} />
        <EdgeCurveSelect value={edge.curve || DEFAULT_CURVE_VALUE} onChange={(curve) => onUpdateEdge(edge.id, { curve: curve === DEFAULT_CURVE_VALUE ? undefined : curve })} />
      </FieldGroup>
      <Field className="gap-2">
        <FieldLabel htmlFor="edge-classes">Class</FieldLabel>
        <Input id="edge-classes" value={edgeClassesInput(edge.classes)} placeholder="animate, primary" onChange={(event) => onUpdateEdge(edge.id, { classes: parseEdgeClasses(event.target.value) })} />
      </Field>
      <Field className="gap-2">
        <FieldLabel htmlFor="edge-style-text">linkStyle</FieldLabel>
        <Input id="edge-style-text" value={edge.styleText || ""} placeholder="stroke:#f66,stroke-width:4px" onChange={(event) => onUpdateEdge(edge.id, { styleText: event.target.value.trim() || undefined })} />
      </Field>
      <Separator />
      <Button variant="destructive" size="sm" className="justify-start" onClick={onDeleteSelection}>
        <Trash2 data-icon="inline-start" />
        删除连线
      </Button>
    </FieldGroup>
  );
}

export function MultiEdgeInspectorSection({
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
    <FieldGroup className="gap-4">
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
      <FieldGroup className="grid grid-cols-2 gap-2">
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
      </FieldGroup>
      <FieldGroup className="grid grid-cols-2 gap-2">
        <Field className="gap-2">
          <FieldLabel htmlFor="batch-edge-min-length">最小长度</FieldLabel>
          <Input
            id="batch-edge-min-length"
            type="number"
            min={1}
            value={batchEdgeMinLength.mixed ? "" : batchEdgeMinLength.value}
            placeholder={batchEdgeMinLength.mixed ? "混合" : undefined}
            onChange={(event) => updateBatchEdgeNumber(onUpdateSelectedEdges, "minLength", event.target.value)}
          />
        </Field>
        <EdgeAnimationSelect
          value={batchEdgeAnimation.mixed ? MIXED_VALUE : batchEdgeAnimation.value}
          mixed={batchEdgeAnimation.mixed}
          onChange={(animation) => onUpdateSelectedEdges({ animation })}
        />
      </FieldGroup>
      <EdgeCurveSelect
        value={batchEdgeCurve.mixed ? MIXED_VALUE : batchEdgeCurve.value}
        mixed={batchEdgeCurve.mixed}
        onChange={(curve) => onUpdateSelectedEdges({ curve: curve === DEFAULT_CURVE_VALUE ? undefined : curve })}
      />
      <Field className="gap-2">
        <FieldLabel htmlFor="batch-edge-classes">Class</FieldLabel>
        <Input id="batch-edge-classes" value={batchEdgeClasses.mixed ? "" : batchEdgeClasses.value} placeholder={batchEdgeClasses.mixed ? "混合" : "animate, primary"} onChange={(event) => onUpdateSelectedEdges({ classes: parseEdgeClasses(event.target.value) })} />
      </Field>
      <Field className="gap-2">
        <FieldLabel htmlFor="batch-edge-style-text">linkStyle</FieldLabel>
        <Input id="batch-edge-style-text" value={batchEdgeStyleText.mixed ? "" : batchEdgeStyleText.value} placeholder={batchEdgeStyleText.mixed ? "混合" : "stroke:#f66"} onChange={(event) => onUpdateSelectedEdges({ styleText: event.target.value.trim() || undefined })} />
      </Field>
      <Separator />
      <Button variant="destructive" size="sm" className="justify-start" onClick={onDeleteSelection}>
        <Trash2 data-icon="inline-start" />
        删除选中连线
      </Button>
    </FieldGroup>
  );
}

function EndpointSelect({ label, value, endpointOptions, onChange }: { label: string; value: string; endpointOptions: { id: string; label: string }[]; onChange: (value: string) => void }) {
  const controlId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={controlId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {endpointOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function EdgeAnchorSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: { value: string; label: string }[]; disabled: boolean; onChange: (value: string) => void }) {
  const controlId = useId();

  return (
    <Field className="gap-2" data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={controlId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="auto">自动选择</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function EdgeStyleSelect({ value, mixed = false, onChange }: { value: EdgeStyle | typeof MIXED_VALUE; mixed?: boolean; onChange: (style: EdgeStyle) => void }) {
  const controlId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={controlId}>连线样式</FieldLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as EdgeStyle);
        }}
      >
        <SelectTrigger id={controlId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mixed ? (
            <SelectGroup>
              <MixedSelectItem mixed />
            </SelectGroup>
          ) : null}
          {mixed ? <SelectSeparator /> : null}
          <SelectGroup>
            {edgeStyleOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function EdgeMarkerSelect({ label, value, mixed = false, disabled = false, onChange }: { label: string; value: EdgeMarker | typeof MIXED_VALUE; mixed?: boolean; disabled?: boolean; onChange: (marker: EdgeMarker) => void }) {
  const controlId = useId();

  return (
    <Field className="gap-2" data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as EdgeMarker);
        }}
      >
        <SelectTrigger id={controlId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mixed ? (
            <SelectGroup>
              <MixedSelectItem mixed />
            </SelectGroup>
          ) : null}
          {mixed ? <SelectSeparator /> : null}
          <SelectGroup>
            {edgeMarkerOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function EdgeAnimationSelect({ value, mixed = false, onChange }: { value: EdgeAnimation | typeof MIXED_VALUE; mixed?: boolean; onChange: (animation: EdgeAnimation) => void }) {
  const controlId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={controlId}>动画</FieldLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as EdgeAnimation);
        }}
      >
        <SelectTrigger id={controlId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mixed ? (
            <SelectGroup>
              <MixedSelectItem mixed />
            </SelectGroup>
          ) : null}
          {mixed ? <SelectSeparator /> : null}
          <SelectGroup>
            {edgeAnimationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function EdgeCurveSelect({ value, mixed = false, onChange }: { value: MermaidCurve | typeof DEFAULT_CURVE_VALUE | typeof MIXED_VALUE; mixed?: boolean; onChange: (curve: MermaidCurve | typeof DEFAULT_CURVE_VALUE) => void }) {
  const controlId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={controlId}>曲线</FieldLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as MermaidCurve | typeof DEFAULT_CURVE_VALUE);
        }}
      >
        <SelectTrigger id={controlId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mixed ? (
            <SelectGroup>
              <MixedSelectItem mixed />
            </SelectGroup>
          ) : null}
          {mixed ? <SelectSeparator /> : null}
          <SelectGroup>
            <SelectItem value={DEFAULT_CURVE_VALUE}>默认</SelectItem>
            {edgeCurveOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
