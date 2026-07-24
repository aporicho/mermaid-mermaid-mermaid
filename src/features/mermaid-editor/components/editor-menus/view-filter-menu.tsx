import { useEffect } from "react";
import {
  DotsGrid3x3 as Grid3X3,
  Eye,
  FilterAlt,
  Group as GroupIcon,
  Link,
  SquareCursor as SquareDashedMousePointer,
  Text
} from "iconoir-react/regular";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { EditorMenuItem, EditorMenuSurface } from "@/features/mermaid-editor/components/editor-ui";
import {
  FilterToggle,
  LabelIcon,
  arrowTypeFilterLabels,
  edgeStyleFilterLabels
} from "@/features/mermaid-editor/components/editor-menus/shared";
import { FloatingIconButton } from "@/features/mermaid-editor/components/floating-chrome";
import type { EdgeStyle, FlowchartArrowType } from "@/features/mermaid-editor/lib/editor-types";
import { ARROW_TYPE_FILTERS, DEFAULT_VIEW_FILTERS, EDGE_STYLE_FILTERS, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";

export function ViewFilterMenu({
  open,
  filters,
  hiddenCount,
  editable,
  onOpenChange,
  onChange,
  onReset
}: {
  open: boolean;
  filters: ViewFilters;
  hiddenCount: number;
  editable: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (filters: ViewFilters, message: string) => void;
  onReset: () => void;
}) {
  useEffect(() => {
    if (open && !editable) onOpenChange(false);
  }, [editable, onOpenChange, open]);

  function toggleTopLevel(key: keyof Pick<ViewFilters, "nodes" | "subgraphs" | "edges" | "nodeLabels" | "edgeLabels" | "grid">, label: string) {
    const nextVisible = !filters[key];
    onChange({ ...filters, [key]: nextVisible }, `${nextVisible ? "显示" : "隐藏"}${label}。`);
  }

  function toggleEdgeStyle(style: EdgeStyle) {
    const nextVisible = !filters.edgeStyles[style];
    onChange(
      { ...filters, edgeStyles: { ...filters.edgeStyles, [style]: nextVisible } },
      `${nextVisible ? "显示" : "隐藏"}${edgeStyleFilterLabels[style]}连线。`
    );
  }

  function toggleArrowType(arrowType: FlowchartArrowType) {
    const nextVisible = !filters.arrowTypes[arrowType];
    onChange(
      { ...filters, arrowTypes: { ...filters.arrowTypes, [arrowType]: nextVisible } },
      `${nextVisible ? "显示" : "隐藏"}${arrowTypeFilterLabels[arrowType]}连线。`
    );
  }

  function showNodesOnly() {
    onChange(
      {
        ...DEFAULT_VIEW_FILTERS,
        subgraphs: false,
        edges: false,
        edgeLabels: false,
        grid: false
      },
      "已切换为仅显示节点。"
    );
  }

  function hideLabels() {
    onChange({ ...filters, nodeLabels: false, edgeLabels: false }, "已隐藏全部标签。");
  }

  function hideEdges() {
    onChange({ ...filters, edges: false }, "已隐藏所有连线。");
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <FloatingIconButton
          label={hiddenCount > 0 ? `视图过滤器：已隐藏 ${hiddenCount} 项` : "视图过滤器"}
          tooltipSide="left"
          active={hiddenCount > 0}
          badgeCount={hiddenCount}
          disabled={!editable}
          aria-expanded={open}
        >
          <FilterAlt data-icon />
        </FloatingIconButton>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-72">
        <EditorMenuSurface>
          <div className="grid grid-cols-2 gap-1">
            <EditorMenuItem data-floating-action-item icon={<Eye />} label="全部显示" onClick={onReset} />
            <EditorMenuItem data-floating-action-item icon={<Link />} label="隐藏连线" onClick={hideEdges} />
            <EditorMenuItem data-floating-action-item icon={<SquareDashedMousePointer />} label="仅节点" onClick={showNodesOnly} />
            <EditorMenuItem data-floating-action-item icon={<Text />} label="隐藏标签" onClick={hideLabels} />
          </div>
          <Separator className="my-2" />
          <ToggleGroup
            type="multiple"
            aria-label="画布元素显示"
            value={[
              filters.nodes && "节点",
              filters.subgraphs && "分组",
              filters.edges && "连线",
              filters.nodeLabels && "节点标签",
              filters.edgeLabels && "连线标签",
              filters.grid && "网格"
            ].filter((value): value is string => Boolean(value))}
            className="grid gap-0.5 py-1"
            onValueChange={() => undefined}
          >
            <FilterToggle active={filters.nodes} icon={<SquareDashedMousePointer data-icon />} label="节点" onClick={() => toggleTopLevel("nodes", "节点")} />
            <FilterToggle active={filters.subgraphs} icon={<GroupIcon data-icon />} label="分组" onClick={() => toggleTopLevel("subgraphs", "分组")} />
            <FilterToggle active={filters.edges} icon={<Link data-icon />} label="连线" onClick={() => toggleTopLevel("edges", "连线")} />
            <FilterToggle active={filters.nodeLabels} icon={<Text data-icon />} label="节点标签" onClick={() => toggleTopLevel("nodeLabels", "节点标签")} />
            <FilterToggle active={filters.edgeLabels} icon={<LabelIcon />} label="连线标签" onClick={() => toggleTopLevel("edgeLabels", "连线标签")} />
            <FilterToggle active={filters.grid} icon={<Grid3X3 data-icon />} label="网格" onClick={() => toggleTopLevel("grid", "网格")} />
          </ToggleGroup>
          <Separator className="my-2" />
          <div className="grid gap-1 px-1">
            <span className="text-xs text-muted-foreground">连线类型</span>
            <ToggleGroup
              type="multiple"
              aria-label="连线类型"
              value={EDGE_STYLE_FILTERS.filter((style) => filters.edgeStyles[style]).map((style) => edgeStyleFilterLabels[style])}
              className="grid grid-cols-3 gap-1"
              onValueChange={() => undefined}
            >
              {EDGE_STYLE_FILTERS.map((style) => (
                <FilterToggle key={style} compact active={filters.edgeStyles[style]} label={edgeStyleFilterLabels[style]} onClick={() => toggleEdgeStyle(style)} />
              ))}
            </ToggleGroup>
          </div>
          <Separator className="my-2" />
          <div className="grid gap-1 px-1">
            <span className="text-xs text-muted-foreground">箭头类型</span>
            <ToggleGroup
              type="multiple"
              aria-label="箭头类型"
              value={ARROW_TYPE_FILTERS.filter((arrowType) => filters.arrowTypes[arrowType]).map((arrowType) => arrowTypeFilterLabels[arrowType])}
              className="grid grid-cols-2 gap-1"
              onValueChange={() => undefined}
            >
              {ARROW_TYPE_FILTERS.map((arrowType) => (
                <FilterToggle key={arrowType} compact active={filters.arrowTypes[arrowType]} label={arrowTypeFilterLabels[arrowType]} onClick={() => toggleArrowType(arrowType)} />
              ))}
            </ToggleGroup>
          </div>
        </EditorMenuSurface>
      </PopoverContent>
    </Popover>
  );
}
