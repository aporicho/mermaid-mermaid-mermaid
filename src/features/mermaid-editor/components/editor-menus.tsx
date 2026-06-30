import { useEffect, type ReactNode } from "react";
import {
  ClockRotateRight,
  ColorWheel,
  DotsGrid3x3 as Grid3X3,
  Eye,
  EyeClosed,
  Expand as Maximize2,
  FilterAlt,
  FloppyDisk,
  FloppyDiskArrowOut,
  Folder,
  FrameSimple,
  Group as GroupIcon,
  GitBranch as Workflow,
  Link,
  MoreHoriz,
  PathArrow,
  Plus,
  PositionAlign,
  Refresh as RefreshCw,
  SidebarExpand as PanelLeftOpen,
  SquareCursor as SquareDashedMousePointer,
  Text
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FloatingIconButton, FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { APP_LOGOS, appLogoById, normalizeAppLogoId } from "@/features/mermaid-editor/lib/app-logo";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EdgeRouting, EdgeStyle, FlowchartArrowType, GraphDirection, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { ARROW_TYPE_FILTERS, DEFAULT_VIEW_FILTERS, EDGE_STYLE_FILTERS, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { cn } from "@/lib/utils";

const directions: GraphDirection[] = ["LR", "TD", "TB", "RL", "BT"];
export const edgeRoutingOptions: { value: EdgeRouting; label: string }[] = [
  { value: "straight", label: "直线" },
  { value: "bezier", label: "曲线" },
  { value: "orthogonal", label: "圆角折线" },
  { value: "mermaid", label: "Mermaid 曲线" }
];
const layoutModeOptions: { value: LayoutMode; label: string }[] = [
  { value: "manual", label: "手动布局" },
  { value: "auto", label: "自动布局" }
];

const edgeStyleFilterLabels: Record<EdgeStyle, string> = {
  solid: "实线",
  thick: "粗线",
  dotted: "虚线",
  invisible: "隐藏线"
};
const arrowTypeFilterLabels: Record<FlowchartArrowType, string> = {
  arrow: "箭头",
  none: "无箭头",
  circle: "圆点",
  cross: "叉号"
};

export function FileMenu({
  open,
  recentFiles,
  runtimeKind,
  projectBusy,
  isDirty,
  onOpenChange,
  onNewMermaidFile,
  onNewMarkdownFile,
  onNewCanvasFile,
  onOpenFile,
  onOpenRecent,
  onOpenProject,
  onSaveFile,
  onSaveAs
}: {
  open: boolean;
  recentFiles: RecentFileEntry[];
  runtimeKind: "web" | "desktop";
  projectBusy: boolean;
  isDirty: boolean;
  onOpenChange: (open: boolean) => void;
  onNewMermaidFile: () => void;
  onNewMarkdownFile: () => void;
  onNewCanvasFile: () => void;
  onOpenFile: () => void;
  onOpenRecent: (file: RecentFileEntry) => void;
  onOpenProject: () => void;
  onSaveFile: () => void;
  onSaveAs: () => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });
  const projectAvailable = runtimeKind === "desktop";

  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <FloatingIconButton label="文件" dirty={isDirty} onClick={() => onOpenChange(!open)} aria-expanded={open}>
        <Folder />
      </FloatingIconButton>

      <FloatingPanel open={open} placement="top-left" kind="popover" dismissMode="outside" className="w-72">
        <div className="grid gap-0.5">
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewMermaidFile)}>
            <Plus className="size-4" />
            新建 Mermaid
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewMarkdownFile)}>
            <Text className="size-4" />
            新建 Markdown
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewCanvasFile)}>
            <FrameSimple className="size-4" />
            新建无限画布
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onOpenFile)}>
            <Folder className="size-4" />
            打开文件
          </Button>
          {projectAvailable ? (
            <Button
              data-floating-action-item
              variant="ghost"
              className={EDITOR_CHROME_CLASSES.menuRow}
              disabled={projectBusy}
              onClick={() => runAndClose(onOpenProject)}
            >
              <Workflow className="size-4" />
              打开文件夹
            </Button>
          ) : null}
          <Separator className="my-1" />
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveFile)}>
            <FloppyDisk className="size-4" />
            保存
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveAs)}>
            <FloppyDiskArrowOut className="size-4" />
            另存为
          </Button>
          <Separator className="my-1" />
          <div data-floating-action-item className="px-2 py-1 text-xs text-muted-foreground">最近打开</div>
          {recentFiles.length ? (
            recentFiles.map((file) => (
              <Button
                key={file.path}
                data-floating-action-item
                variant="ghost"
                className={cn(EDITOR_CHROME_CLASSES.menuRow, "w-full min-w-0 gap-2 overflow-hidden text-left")}
                title={file.path}
                onClick={() => runAndClose(() => onOpenRecent(file))}
              >
                <ClockRotateRight className="size-4 shrink-0" />
                <span className="block min-w-0 flex-1 overflow-hidden truncate">{file.name}</span>
              </Button>
            ))
          ) : (
            <div data-floating-action-item className="px-2 py-2 text-xs text-muted-foreground">暂无最近文件</div>
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}

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

function FilterToggle({ active, label, icon, compact = false, onClick }: { active: boolean; label: string; icon?: ReactNode; compact?: boolean; onClick: () => void }) {
  return (
    <Button
      data-floating-action-item
      type="button"
      variant="ghost"
      className={cn(
        EDITOR_CHROME_CLASSES.menuRow,
        compact ? "gap-2 text-xs" : "",
        !active ? "text-muted-foreground" : ""
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-icon" : "text-muted-foreground")}>
        {active ? <Eye className="size-4" /> : <EyeClosed className="size-4" />}
      </span>
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}


function LabelIcon() {
  return <Text className="size-4" />;
}

function PreferenceToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <Button
      data-floating-action-item
      type="button"
      variant="ghost"
      className={cn(EDITOR_CHROME_CLASSES.menuRow, "gap-2", !active && "text-muted-foreground")}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-icon" : "text-muted-foreground")}>
        {active ? <Eye className="size-4" /> : <EyeClosed className="size-4" />}
      </span>
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

export function SecondaryActionsMenu({
  open,
  direction,
  edgeRouting,
  layoutMode,
  preferences,
  editable,
  documentKind,
  onOpenChange,
  onAddNode,
  onAddImageNode,
  onCreateGroup,
  onSaveAs,
  onDirectionChange,
  onEdgeRoutingChange,
  onLayoutModeChange,
  onPreferencesChange,
  onRefreshSource,
  onSyncAutoLayout,
  onResetView,
  onOpenThemeSettings
}: {
  open: boolean;
  direction: GraphDirection;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  preferences: EditorPreferences;
  editable: boolean;
  documentKind: DocumentKind;
  onOpenChange: (open: boolean) => void;
  onAddNode: () => void;
  onAddImageNode: () => void;
  onCreateGroup: () => void;
  onSaveAs: () => void;
  onDirectionChange: (direction: GraphDirection) => void;
  onEdgeRoutingChange: (edgeRouting: EdgeRouting) => void;
  onLayoutModeChange: (layoutMode: LayoutMode) => void;
  onPreferencesChange: (preferences: EditorPreferences, message?: string) => void;
  onRefreshSource: () => void;
  onSyncAutoLayout: () => void;
  onResetView: () => void;
  onOpenThemeSettings: () => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });
  const isCanvasDocument = documentKind === "canvas";

  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  function updatePreference(nextPreferences: EditorPreferences, message: string) {
    onPreferencesChange(nextPreferences, message);
  }

  return (
    <div ref={menuRef} className="relative">
      <FloatingIconButton label="更多操作" tooltipSide="top" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        <MoreHoriz />
      </FloatingIconButton>

      <FloatingPanel
        open={open}
        placement="bottom-left"
        kind="popover"
        dismissMode="outside"
        className="max-h-[min(720px,calc(100vh-112px))] w-64 overflow-y-auto"
      >
        <div className="grid gap-0.5">
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onAddNode)}
              disabled={!editable}
            >
              <Plus className="size-4" />
              新增节点
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onAddImageNode)}
              disabled={!editable}
            >
              <FrameSimple className="size-4" />
              添加图片节点
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onCreateGroup)}
              disabled={!editable}
            >
              <SquareDashedMousePointer className="size-4" />
              选中内容成组
            </Button>
            <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveAs)}>
              <FloppyDiskArrowOut className="size-4" />
              另存为
            </Button>
            <Separator className="my-1" />
            <div data-floating-action-item className="grid gap-2 px-2 py-2">
              <span className="text-xs text-muted-foreground">方向</span>
              <Select
                value={direction}
                onValueChange={(value) => {
                  onDirectionChange(value as GraphDirection);
                }}
                disabled={!editable}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {directions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator className="my-1" />
            <div data-floating-action-item className="grid gap-2 px-2 py-2">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <PositionAlign className="size-4 text-icon" />
                布局模式
              </span>
              <Select
                value={layoutMode}
                onValueChange={(value) => {
                  onLayoutModeChange(value as LayoutMode);
                }}
                disabled={!editable}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {layoutModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator className="my-1" />
            <div data-floating-action-item className="grid gap-2 px-2 py-2">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <PathArrow className="size-4 text-icon" />
                连线形状
              </span>
              <Select
                value={edgeRouting}
                onValueChange={(value) => {
                  onEdgeRoutingChange(value as EdgeRouting);
                }}
                disabled={!editable}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {edgeRoutingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator className="my-1" />
            <div data-floating-action-item className="grid gap-0.5 px-1 py-1">
              <span className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
                <Eye className="size-4 text-icon" />
                应用设置
              </span>
              <div className="grid gap-2 px-1 py-1">
                <span className="text-xs text-muted-foreground">应用 LOGO</span>
                <Select
                  value={preferences.appLogo}
                  onValueChange={(value) => {
                    updatePreference({ ...preferences, appLogo: normalizeAppLogoId(value) }, "应用 LOGO 已切换。");
                  }}
                >
                  <SelectTrigger className="h-8 gap-2">
                    <img className="size-4 shrink-0 rounded-[4px] object-cover" src={appLogoById(preferences.appLogo).href} alt="" aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_LOGOS.map((logo) => (
                      <SelectItem key={logo.id} value={logo.id}>
                        {logo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PreferenceToggle
                active={preferences.startWithPanelsCollapsed}
                icon={<PanelLeftOpen className="size-4" />}
                label="启动时收起侧栏"
                onClick={() =>
                  updatePreference(
                    { ...preferences, startWithPanelsCollapsed: !preferences.startWithPanelsCollapsed },
                    preferences.startWithPanelsCollapsed ? "启动时将恢复侧栏状态。" : "启动时将收起两侧栏。"
                  )
                }
              />
              <PreferenceToggle
                active={preferences.statusMessages}
                icon={<Text className="size-4" />}
                label="底部操作消息"
                onClick={() =>
                  updatePreference(
                    { ...preferences, statusMessages: !preferences.statusMessages },
                    preferences.statusMessages ? "底部操作消息已隐藏。" : "底部操作消息已显示。"
                  )
                }
              />
              <PreferenceToggle
                active={preferences.restoreLastFile}
                icon={<ClockRotateRight className="size-4" />}
                label="启动时恢复上次文件"
                onClick={() =>
                  updatePreference(
                    { ...preferences, restoreLastFile: !preferences.restoreLastFile },
                    preferences.restoreLastFile ? "启动时将打开默认空白文件。" : "启动时将恢复上次文件。"
                  )
                }
              />
            </div>
            <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onOpenThemeSettings)}>
              <ColorWheel className="size-4" />
              主题
            </Button>
            <Button data-floating-action-item variant="ghost" className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")} disabled={documentKind !== "mermaid"} onClick={() => runAndClose(onRefreshSource)}>
              <RefreshCw className="size-4" />
              从源码刷新
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onSyncAutoLayout)}
              disabled={!editable}
            >
              <PositionAlign className="size-4" />
              立即自动布局
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onResetView)}
              disabled={!editable && !isCanvasDocument}
            >
              <Maximize2 className="size-4" />
              重置画布视图
            </Button>
        </div>
      </FloatingPanel>
    </div>
  );
}
