import {
  ClockRotateRight,
  ColorWheel,
  Expand as Maximize2,
  Eye,
  EmptyPage,
  FloppyDiskArrowOut,
  FrameSimple,
  MoreHoriz,
  PathArrow,
  Plus,
  PositionAlign,
  Refresh as RefreshCw,
  SidebarExpand as PanelLeftOpen,
  SquareCursor as SquareDashedMousePointer,
  Text,
  Translate
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  PreferenceToggle,
  directions,
  edgeRoutingOptions,
  layoutModeOptions
} from "@/features/mermaid-editor/components/editor-menus/shared";
import { FloatingIconButton, FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { APP_LOGOS, appLogoById, normalizeAppLogoId } from "@/features/mermaid-editor/lib/app-logo";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EdgeRouting, GraphDirection, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { cn } from "@/lib/utils";

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
  onAddMarkdownDocument,
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
  onAddMarkdownDocument: () => void;
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
            onClick={() => runAndClose(onAddMarkdownDocument)}
            disabled={!editable}
          >
            <EmptyPage className="size-4" />
            添加 Markdown 文档
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
            <PreferenceToggle
              active={preferences.markdownSpellcheckEnabled}
              icon={<Translate className="size-4" />}
              label="Markdown 拼写检查"
              onClick={() =>
                updatePreference(
                  { ...preferences, markdownSpellcheckEnabled: !preferences.markdownSpellcheckEnabled },
                  preferences.markdownSpellcheckEnabled ? "Markdown 拼写检查已关闭。" : "Markdown 拼写检查已开启。"
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
