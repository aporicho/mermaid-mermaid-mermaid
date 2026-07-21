import type { ReactNode } from "react";
import { Eye, EyeClosed, Text } from "iconoir-react/regular";

import { EditorMenuItem } from "@/features/mermaid-editor/components/editor-ui";
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
    <EditorMenuItem
      data-floating-action-item
      type="button"
      className={cn(compact && "type-interface-status", !active && "text-muted-foreground")}
      icon={<><span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-icon" : "text-muted-foreground")}>{active ? <Eye /> : <EyeClosed />}</span>{icon}</>}
      label={label}
      aria-pressed={active}
      onClick={onClick}
    />
  );
}

export function LabelIcon() {
  return <Text className="size-4" />;
}

export function PreferenceToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <EditorMenuItem
      data-floating-action-item
      type="button"
      className={cn(!active && "text-muted-foreground")}
      icon={<><span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-icon" : "text-muted-foreground")}>{active ? <Eye /> : <EyeClosed />}</span>{icon}</>}
      label={label}
      aria-pressed={active}
      onClick={onClick}
    />
  );
}
