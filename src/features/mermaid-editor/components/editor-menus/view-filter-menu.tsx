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

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FilterToggle,
  LabelIcon,
  arrowTypeFilterLabels,
  edgeStyleFilterLabels
} from "@/features/mermaid-editor/components/editor-menus/shared";
import { FloatingIconButton, FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EdgeStyle, FlowchartArrowType } from "@/features/mermaid-editor/lib/editor-types";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
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
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });

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
    <div ref={menuRef} className="relative">
      <FloatingIconButton
        label={hiddenCount > 0 ? `视图过滤器：已隐藏 ${hiddenCount} 项` : "视图过滤器"}
        tooltipSide="left"
        active={hiddenCount > 0}
        badgeCount={hiddenCount}
        onClick={() => onOpenChange(!open)}
        disabled={!editable}
        aria-expanded={open}
      >
        <FilterAlt />
      </FloatingIconButton>

      <FloatingPanel open={open} placement="right" kind="popover" dismissMode="outside" className="w-72">
        <div data-floating-action-item className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs font-medium text-foreground">视图过滤器</span>
          <span className="text-xs text-muted-foreground">{hiddenCount > 0 ? `隐藏 ${hiddenCount} 项` : "全部显示"}</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={onReset}>
            <Eye className="size-4" />
            全部显示
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={hideEdges}>
            <Link className="size-4" />
            隐藏连线
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={showNodesOnly}>
            <SquareDashedMousePointer className="size-4" />
            仅节点
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={hideLabels}>
            <Text className="size-4" />
            隐藏标签
          </Button>
        </div>
        <Separator className="my-2" />
        <div className="grid gap-1">
          <FilterToggle active={filters.nodes} icon={<SquareDashedMousePointer className="size-4" />} label="节点" onClick={() => toggleTopLevel("nodes", "节点")} />
          <FilterToggle active={filters.subgraphs} icon={<GroupIcon className="size-4" />} label="分组" onClick={() => toggleTopLevel("subgraphs", "分组")} />
          <FilterToggle active={filters.edges} icon={<Link className="size-4" />} label="连线" onClick={() => toggleTopLevel("edges", "连线")} />
          <FilterToggle active={filters.nodeLabels} icon={<Text className="size-4" />} label="节点标签" onClick={() => toggleTopLevel("nodeLabels", "节点标签")} />
          <FilterToggle active={filters.edgeLabels} icon={<LabelIcon />} label="连线标签" onClick={() => toggleTopLevel("edgeLabels", "连线标签")} />
          <FilterToggle active={filters.grid} icon={<Grid3X3 className="size-4" />} label="网格" onClick={() => toggleTopLevel("grid", "网格")} />
        </div>
        <Separator className="my-2" />
        <div className="grid gap-1 px-1">
          <span className="text-xs text-muted-foreground">连线类型</span>
          <div className="grid grid-cols-3 gap-1">
            {EDGE_STYLE_FILTERS.map((style) => (
              <FilterToggle key={style} compact active={filters.edgeStyles[style]} label={edgeStyleFilterLabels[style]} onClick={() => toggleEdgeStyle(style)} />
            ))}
          </div>
        </div>
        <Separator className="my-2" />
        <div className="grid gap-1 px-1">
          <span className="text-xs text-muted-foreground">箭头类型</span>
          <div className="grid grid-cols-2 gap-1">
            {ARROW_TYPE_FILTERS.map((arrowType) => (
              <FilterToggle key={arrowType} compact active={filters.arrowTypes[arrowType]} label={arrowTypeFilterLabels[arrowType]} onClick={() => toggleArrowType(arrowType)} />
            ))}
          </div>
        </div>
      </FloatingPanel>
    </div>
  );
}
