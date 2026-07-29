import { MarkdownWindowPanel } from "@/features/mermaid-editor/components/detached-window-panels";
import { CsvEditorPanel } from "@/features/mermaid-editor/components/csv-editor-panel";
import { TextEditorPanel } from "@/features/mermaid-editor/components/text-editor-panel";
import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import type { RuntimeAgentTextSelection, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";
import type { WorkspaceWindowPlacementAnchor } from "@/features/mermaid-editor/lib/project-resource-open";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type DetachedMarkdownWindow,
  type DetachedCsvWindow,
  type DetachedTextWindow,
  type CsvWindowPanelId,
  type TextWindowPanelId,
  type MarkdownWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

type DetachedWorkspaceWindowsProps = {
  markdownWindows: DetachedMarkdownWindow[]; textWindows: DetachedTextWindow[]; csvWindows: DetachedCsvWindow[];
  markdownSpellcheckEnabled: boolean;
  markdownContentWidth: number;
  markdownTextScale: number;
  workspaceTitlebarAutoHide: boolean;
  onMarkdownTextScaleChange: (value: number) => void;
  activePanel: WorkspaceFloatingPanelId | null;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  panelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  panelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeMarkdownWindow: (panelId: MarkdownWindowPanelId) => void;
  saveMarkdownWindow: (panelId: MarkdownWindowPanelId) => void | Promise<unknown>;
  updateMarkdownWindow: (panelId: MarkdownWindowPanelId, value: string) => void;
  openMarkdownFileLink: (href: string, sourceFilePath: string | undefined, context: WorkspaceWindowPlacementAnchor) => boolean;
  onMarkdownSelectionChange?: (panelId: MarkdownWindowPanelId, selection: RuntimeAgentTextSelection | null) => void;
  markdownFoldBindingFor: (file: RuntimeFileRef) => {
    foldState: MarkdownFoldSnapshot | null | undefined;
    onFoldStateChange?: (snapshot: MarkdownFoldSnapshot) => void;
  };
  closeTextWindow: (panelId: TextWindowPanelId) => void;
  closeCsvWindow: (panelId: CsvWindowPanelId) => void;
  saveTextWindow: (panelId: TextWindowPanelId) => void | Promise<unknown>;
  saveCsvWindow: (panelId: CsvWindowPanelId) => void | Promise<unknown>;
  updateTextWindow: (panelId: TextWindowPanelId, value: string) => void;
  updateCsvWindow: (panelId: CsvWindowPanelId, value: string) => void;
  undoCsvWindow: (panelId: CsvWindowPanelId) => void | Promise<unknown>;
  redoCsvWindow: (panelId: CsvWindowPanelId) => void | Promise<unknown>;
  setCsvHeaderMode: (panelId: CsvWindowPanelId, mode: DetachedCsvWindow["headerMode"]) => void;
};

export function DetachedWorkspaceWindows({
  markdownWindows,
  textWindows,
  csvWindows,
  markdownSpellcheckEnabled,
  markdownContentWidth,
  markdownTextScale,
  workspaceTitlebarAutoHide,
  onMarkdownTextScaleChange,
  activePanel,
  bringPanelToFront,
  panelStackPosition,
  panelWindowState,
  setPanelWindowState,
  closeMarkdownWindow,
  saveMarkdownWindow,
  updateMarkdownWindow,
  openMarkdownFileLink,
  onMarkdownSelectionChange,
  markdownFoldBindingFor,
  closeTextWindow,
  closeCsvWindow,
  saveTextWindow,
  saveCsvWindow,
  updateTextWindow,
  updateCsvWindow,
  undoCsvWindow,
  redoCsvWindow,
  setCsvHeaderMode
}: DetachedWorkspaceWindowsProps) {
  return (
    <>
      {markdownWindows.map((markdownWindow) => {
        const foldBinding = markdownFoldBindingFor(markdownWindow.file);
        return <WorkspaceFloatingWindow
          key={markdownWindow.id}
          open
          placement="center-panel"
          panelId={markdownWindow.id}
          titlebarAutoHide={workspaceTitlebarAutoHide}
          active={activePanel === markdownWindow.id}
          stackIndex={panelStackPosition(markdownWindow.id)}
          onFocusPanel={() => bringPanelToFront(markdownWindow.id)}
          defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.markdown} minSize={WORKSPACE_PANEL_MIN_SIZES.markdown}
          initialFrame={markdownWindow.openRequest?.initialFrame} initialFrameKey={markdownWindow.openRequest?.initialFrameKey} activationKey={markdownWindow.openRequest?.activationKey}
          windowState={panelWindowState(markdownWindow.id)}
          onWindowStateChange={(state) => setPanelWindowState(markdownWindow.id, state)}
          onClose={() => closeMarkdownWindow(markdownWindow.id)}
          closeLabel="关闭 Markdown 窗口"
          tooltipSide="top"
        >
          <MarkdownWindowPanel
            title={markdownWindow.title}
            path={markdownWindow.file.path}
            value={markdownWindow.value}
            dirty={markdownWindow.value !== markdownWindow.savedValue}
            spellCheck={markdownSpellcheckEnabled}
            contentWidth={markdownContentWidth}
            textScale={markdownTextScale}
            onSave={() => void saveMarkdownWindow(markdownWindow.id)}
            onTextScaleChange={onMarkdownTextScaleChange}
            foldState={foldBinding.foldState}
            onFoldStateChange={foldBinding.onFoldStateChange}
            onChange={(value) => updateMarkdownWindow(markdownWindow.id, value)}
            onOpenFileLink={(href, context) => openMarkdownFileLink(href, markdownWindow.file.path, context)}
            onSelectionChange={(selection) => onMarkdownSelectionChange?.(markdownWindow.id, selection)}
          />
        </WorkspaceFloatingWindow>;
      })}
      {textWindows.filter((textWindow) => textWindow.open !== false).map((textWindow) => (
        <WorkspaceFloatingWindow
          key={textWindow.id}
          open
          placement="center-panel"
          panelId={textWindow.id}
          titlebarAutoHide={workspaceTitlebarAutoHide}
          active={activePanel === textWindow.id}
          stackIndex={panelStackPosition(textWindow.id)}
          onFocusPanel={() => bringPanelToFront(textWindow.id)}
          defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.text} minSize={WORKSPACE_PANEL_MIN_SIZES.text}
          initialFrame={textWindow.openRequest?.initialFrame} initialFrameKey={textWindow.openRequest?.initialFrameKey} activationKey={textWindow.openRequest?.activationKey}
          windowState={panelWindowState(textWindow.id)}
          onWindowStateChange={(state) => setPanelWindowState(textWindow.id, state)}
          onClose={() => closeTextWindow(textWindow.id)}
          closeLabel="关闭文本编辑器"
          tooltipSide="top"
        >
          <TextEditorPanel title={textWindow.title} path={textWindow.file.path} value={textWindow.value} dirty={textWindow.value !== textWindow.savedValue} onSave={() => void saveTextWindow(textWindow.id)} onChange={(value) => updateTextWindow(textWindow.id, value)} />
        </WorkspaceFloatingWindow>
      ))}
      {csvWindows.filter((csvWindow) => csvWindow.open !== false).map((csvWindow) => (
        <WorkspaceFloatingWindow
          key={csvWindow.id}
          open
          placement="center-panel"
          panelId={csvWindow.id}
          titlebarAutoHide={workspaceTitlebarAutoHide}
          active={activePanel === csvWindow.id}
          stackIndex={panelStackPosition(csvWindow.id)}
          onFocusPanel={() => bringPanelToFront(csvWindow.id)}
          defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.csv} minSize={WORKSPACE_PANEL_MIN_SIZES.csv}
          initialFrame={csvWindow.openRequest?.initialFrame} initialFrameKey={csvWindow.openRequest?.initialFrameKey} activationKey={csvWindow.openRequest?.activationKey}
          windowState={panelWindowState(csvWindow.id)}
          onWindowStateChange={(state) => setPanelWindowState(csvWindow.id, state)}
          onClose={() => closeCsvWindow(csvWindow.id)}
          closeLabel="关闭 CSV 编辑器"
          tooltipSide="top"
        >
          <CsvEditorPanel
            title={csvWindow.title}
            path={csvWindow.file.path}
            value={csvWindow.value}
            dirty={csvWindow.value !== csvWindow.savedValue}
            headerMode={csvWindow.headerMode}
            canUndo={csvWindow.canUndo}
            canRedo={csvWindow.canRedo}
            onHeaderModeChange={(mode) => setCsvHeaderMode(csvWindow.id, mode)}
            onSave={() => void saveCsvWindow(csvWindow.id)}
            onUndo={() => void undoCsvWindow(csvWindow.id)}
            onRedo={() => void redoCsvWindow(csvWindow.id)}
            onChange={(value) => updateCsvWindow(csvWindow.id, value)}
          />
        </WorkspaceFloatingWindow>
      ))}
    </>
  );
}
