import {
  ClockRotateRight,
  CodeBrackets,
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
  Table,
  Text,
  Translate
} from "iconoir-react/regular";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EditorMenuItem, EditorMenuSurface } from "@/features/mermaid-editor/components/editor-ui";
import { PreferenceToggle, directions, edgeRoutingOptions, layoutModeOptions } from "@/features/mermaid-editor/components/editor-menus/shared";
import { MarkdownContentWidthPreference } from "@/features/mermaid-editor/components/editor-menus/markdown-content-width-preference";
import { AutoSavePreference } from "@/features/mermaid-editor/components/editor-menus/auto-save-preference";
import { FloatingIconButton, FloatingPopover } from "@/features/mermaid-editor/components/floating-chrome";
import { APP_LOGOS, appLogoById, normalizeAppLogoId } from "@/features/mermaid-editor/lib/app-logo";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { EdgeRouting, GraphDirection, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";

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
  onAddTableNode,
  onAddImageNode,
  onAddMarkdownDocument,
  onAddHtmlDocument,
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
  onAddTableNode: () => void;
  onAddImageNode: () => void;
  onAddMarkdownDocument: () => void;
  onAddHtmlDocument: () => void;
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

      <FloatingPopover
        open={open}
        placement="bottom-left"
        dismissMode="outside"
        className="max-h-[min(720px,calc(100vh-112px))] w-64 overflow-y-auto"
      >
        <EditorMenuSurface>
          <EditorMenuItem
            data-floating-action-item
            icon={<Plus />}
            label="添加节点"
            onClick={() => runAndClose(onAddNode)}
            disabled={!editable}
          />
          <EditorMenuItem
            data-floating-action-item
            icon={<CodeBrackets />}
            label="添加 HTML"
            onClick={() => runAndClose(onAddHtmlDocument)}
            disabled={!editable}
          />
          <EditorMenuItem
            data-floating-action-item
            icon={<Table />}
            label="添加 CSV 表格"
            onClick={() => runAndClose(onAddTableNode)}
            disabled={!editable || documentKind !== "mermaid"}
          />
          <EditorMenuItem
            data-floating-action-item
            icon={<FrameSimple />}
            label="添加图片"
            onClick={() => runAndClose(onAddImageNode)}
            disabled={!editable}
          />
          <EditorMenuItem
            data-floating-action-item
            icon={<EmptyPage />}
            label="添加 Markdown"
            onClick={() => runAndClose(onAddMarkdownDocument)}
            disabled={!editable}
          />
          <EditorMenuItem
            data-floating-action-item
            icon={<SquareDashedMousePointer />}
            label="成组"
            onClick={() => runAndClose(onCreateGroup)}
            disabled={!editable}
          />
          <EditorMenuItem data-floating-action-item icon={<FloppyDiskArrowOut />} label="另存为" onClick={() => runAndClose(onSaveAs)} />
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
              <SelectTrigger>
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
              <SelectTrigger>
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
              <SelectTrigger>
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
              设置
            </span>
            <div className="grid gap-2 px-1 py-1">
              <span className="text-xs text-muted-foreground">图标</span>
              <Select
                value={preferences.appLogo}
                onValueChange={(value) => {
                  updatePreference({ ...preferences, appLogo: normalizeAppLogoId(value) }, "应用 LOGO 已切换。");
                }}
              >
                <SelectTrigger className="gap-2">
                  <img className="size-4 shrink-0 rounded-sm object-cover" src={appLogoById(preferences.appLogo).href} alt="" aria-hidden />
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
              label="启动收起侧栏"
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
              label="操作消息"
              onClick={() =>
                updatePreference(
                  { ...preferences, statusMessages: !preferences.statusMessages },
                  preferences.statusMessages ? "底部操作消息已隐藏。" : "底部操作消息已显示。"
                )
              }
            />
            <PreferenceToggle
              active={preferences.workspaceTitlebarAutoHide}
              icon={<Eye className="size-4" />}
              label="自动隐藏浮窗标题栏"
              onClick={() =>
                updatePreference(
                  { ...preferences, workspaceTitlebarAutoHide: !preferences.workspaceTitlebarAutoHide },
                  preferences.workspaceTitlebarAutoHide ? "浮窗标题栏将保持显示。" : "浮窗标题栏将自动隐藏。"
                )
              }
            />
            <PreferenceToggle
              active={preferences.restoreLastFile}
              icon={<ClockRotateRight className="size-4" />}
              label="恢复上次文件"
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
              label="拼写检查"
              onClick={() =>
                updatePreference(
                  { ...preferences, markdownSpellcheckEnabled: !preferences.markdownSpellcheckEnabled },
                  preferences.markdownSpellcheckEnabled ? "Markdown 拼写检查已关闭。" : "Markdown 拼写检查已开启。"
                )
              }
            />
            <AutoSavePreference preferences={preferences} onChange={updatePreference} />
            <MarkdownContentWidthPreference preferences={preferences} onChange={updatePreference} />
          </div>
          <EditorMenuItem data-floating-action-item icon={<ColorWheel />} label="主题" onClick={() => runAndClose(onOpenThemeSettings)} />
          <EditorMenuItem data-floating-action-item icon={<RefreshCw />} label="刷新画布" disabled={documentKind !== "mermaid"} onClick={() => runAndClose(onRefreshSource)} />
          <EditorMenuItem
            data-floating-action-item
            icon={<PositionAlign />}
            label="自动布局"
            onClick={() => runAndClose(onSyncAutoLayout)}
            disabled={!editable}
          />
          <EditorMenuItem
            data-floating-action-item
            icon={<Maximize2 />}
            label="重置视图"
            onClick={() => runAndClose(onResetView)}
            disabled={!editable && !isCanvasDocument}
          />
        </EditorMenuSurface>
      </FloatingPopover>
    </div>
  );
}
