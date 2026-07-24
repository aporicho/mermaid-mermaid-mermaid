import { useId, type ReactNode } from "react";
import { Eye, EyeClosed, Text } from "iconoir-react/regular";

import { ToggleGroupItem } from "@/components/ui/toggle-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { EdgeRouting, EdgeStyle, FlowchartArrowType, GraphDirection, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";
import { cn } from "@/lib/utils";

export const directions: GraphDirection[] = ["LR", "TD", "TB", "RL", "BT"];

export const edgeRoutingOptions: { value: EdgeRouting; label: string }[] = [
  { value: "straight", label: "直线" },
  { value: "bezier", label: "曲线" },
  { value: "orthogonal", label: "圆角折线" },
  { value: "mermaid", label: "Mermaid 曲线" }
];

export const layoutModeOptions: { value: LayoutMode; label: string }[] = [
  { value: "manual", label: "手动布局" },
  { value: "auto", label: "自动布局" }
];

export const edgeStyleFilterLabels: Record<EdgeStyle, string> = {
  solid: "实线",
  thick: "粗线",
  dotted: "虚线",
  invisible: "隐藏线"
};

export const arrowTypeFilterLabels: Record<FlowchartArrowType, string> = {
  arrow: "箭头",
  none: "无箭头",
  circle: "圆点",
  cross: "叉号"
};

export function FilterToggle({ active, label, icon, compact = false, onClick }: { active: boolean; label: string; icon?: ReactNode; compact?: boolean; onClick: () => void }) {
  return (
    <ToggleGroupItem
      value={label}
      className={cn("w-full justify-start px-2", compact && "type-interface-status", !active && "text-muted-foreground")}
      onClick={onClick}
    >
      <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-icon" : "text-muted-foreground")}>{active ? <Eye data-icon /> : <EyeClosed data-icon />}</span>
      {icon}
      <span className="truncate">{label}</span>
    </ToggleGroupItem>
  );
}

export function LabelIcon() {
  return <Text data-icon />;
}

export function PreferenceToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  const id = useId();
  return (
    <Field
      data-floating-action-item
      orientation="horizontal"
      className={cn("min-h-[var(--ui-control-height-sm)] px-2", !active && "text-muted-foreground")}
    >
      <FieldLabel htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        {icon}
        <span className="truncate">{label}</span>
      </FieldLabel>
      <Switch id={id} checked={active} onCheckedChange={onClick} />
    </Field>
  );
}
