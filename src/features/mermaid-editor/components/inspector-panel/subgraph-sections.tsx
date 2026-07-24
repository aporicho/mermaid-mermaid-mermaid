import { useId } from "react";
import { Trash as Trash2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { INHERIT_VALUE, MIXED_VALUE, ROOT_VALUE, directionOptions } from "@/features/mermaid-editor/components/inspector-panel/constants";
import type { SharedSelectionValue } from "@/features/mermaid-editor/components/inspector-panel/model";
import { MixedSelectItem } from "@/features/mermaid-editor/components/inspector-panel/shared-ui";
import type { CanvasSubgraph, CanvasSubgraphBatchPatch, GraphDirection } from "@/features/mermaid-editor/lib/editor-types";

type SubgraphInspectorSectionProps = {
  subgraph: CanvasSubgraph;
  parentOptions: CanvasSubgraph[];
  onRenameSubgraph: (subgraph: CanvasSubgraph, value: string) => void;
  onUpdateSubgraph: (id: string, patch: Partial<CanvasSubgraph>) => void;
  onDeleteSelection: () => void;
};

type MultiSubgraphInspectorSectionProps = {
  batchSubgraphDirection: SharedSelectionValue<GraphDirection | typeof INHERIT_VALUE>;
  batchSubgraphParent: SharedSelectionValue<string>;
  parentOptions: CanvasSubgraph[];
  onUpdateSelectedSubgraphs: (patch: CanvasSubgraphBatchPatch) => void;
  onDeleteSelection: () => void;
};

export function SubgraphInspectorSection({
  subgraph,
  parentOptions,
  onRenameSubgraph,
  onUpdateSubgraph,
  onDeleteSelection
}: SubgraphInspectorSectionProps) {
  return (
    <FieldGroup className="gap-4">
      <Field className="gap-2">
        <FieldLabel htmlFor="subgraph-id">组 ID</FieldLabel>
        <Input id="subgraph-id" value={subgraph.id} onChange={(event) => onRenameSubgraph(subgraph, event.target.value)} />
      </Field>
      <Field className="gap-2">
        <FieldLabel htmlFor="subgraph-title">组标题</FieldLabel>
        <Input id="subgraph-title" value={subgraph.title} onChange={(event) => onUpdateSubgraph(subgraph.id, { title: event.target.value })} />
      </Field>
      <SubgraphDirectionSelect
        value={subgraph.direction || INHERIT_VALUE}
        onChange={(value) => onUpdateSubgraph(subgraph.id, { direction: value === INHERIT_VALUE ? undefined : value })}
      />
      <SubgraphParentSelect
        value={subgraph.parentId || ROOT_VALUE}
        parentOptions={parentOptions}
        onChange={(value) => onUpdateSubgraph(subgraph.id, { parentId: value === ROOT_VALUE ? undefined : value })}
      />
      <Separator />
      <Button variant="destructive" size="sm" className="justify-start" onClick={onDeleteSelection}>
        <Trash2 data-icon="inline-start" />
        解散组
      </Button>
    </FieldGroup>
  );
}

export function MultiSubgraphInspectorSection({
  batchSubgraphDirection,
  batchSubgraphParent,
  parentOptions,
  onUpdateSelectedSubgraphs,
  onDeleteSelection
}: MultiSubgraphInspectorSectionProps) {
  return (
    <FieldGroup className="gap-4">
      <SubgraphDirectionSelect
        value={batchSubgraphDirection.mixed ? MIXED_VALUE : batchSubgraphDirection.value}
        mixed={batchSubgraphDirection.mixed}
        onChange={(value) => onUpdateSelectedSubgraphs({ direction: value === INHERIT_VALUE ? undefined : value })}
      />
      <SubgraphParentSelect
        value={batchSubgraphParent.mixed ? MIXED_VALUE : batchSubgraphParent.value}
        mixed={batchSubgraphParent.mixed}
        parentOptions={parentOptions}
        onChange={(value) => onUpdateSelectedSubgraphs({ parentId: value === ROOT_VALUE ? undefined : value })}
      />
      <Separator />
      <Button variant="destructive" size="sm" className="justify-start" onClick={onDeleteSelection}>
        <Trash2 data-icon="inline-start" />
        解散选中组
      </Button>
    </FieldGroup>
  );
}

function SubgraphDirectionSelect({
  value,
  mixed = false,
  onChange
}: {
  value: GraphDirection | typeof INHERIT_VALUE | typeof MIXED_VALUE;
  mixed?: boolean;
  onChange: (value: GraphDirection | typeof INHERIT_VALUE) => void;
}) {
  const controlId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={controlId}>组方向</FieldLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue as GraphDirection | typeof INHERIT_VALUE);
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
            <SelectItem value={INHERIT_VALUE}>继承全局方向</SelectItem>
            {directionOptions.map((option) => (
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

function SubgraphParentSelect({
  value,
  mixed = false,
  parentOptions,
  onChange
}: {
  value: string;
  mixed?: boolean;
  parentOptions: CanvasSubgraph[];
  onChange: (value: string) => void;
}) {
  const controlId = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={controlId}>父组</FieldLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === MIXED_VALUE) return;
          onChange(nextValue);
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
            <SelectItem value={ROOT_VALUE}>根层</SelectItem>
            {parentOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.title || option.id}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
