import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function projectFilesUnder(path: string, extensionPattern: RegExp) {
  const root = join(process.cwd(), path);
  const files: string[] = [];

  function visit(absolutePath: string, relativePath: string) {
    for (const entry of readdirSync(absolutePath)) {
      const absoluteEntryPath = join(absolutePath, entry);
      const relativeEntryPath = `${relativePath}/${entry}`;
      const stats = statSync(absoluteEntryPath);
      if (stats.isDirectory()) {
        visit(absoluteEntryPath, relativeEntryPath);
        continue;
      }
      if (extensionPattern.test(entry)) files.push(relativeEntryPath);
    }
  }

  visit(root, path);
  return files;
}

function lineCount(value: string) {
  return value.split(/\r?\n/).length;
}

describe("interaction architecture contract", () => {
  it("keeps canvas viewport navigation behind standard input and intent resolution", () => {
    const canvas = readProjectFile("src/features/mermaid-editor/components/konva-canvas.tsx");
    const model = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-canvas-model.ts");
    const viewport = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-viewport.ts");

    expect(canvas).toContain("useKonvaCanvasModel");
    expect(model).toContain("useKonvaViewport");
    expect(viewport).toContain("createStandardWheelInput");
    expect(viewport).toContain("createStandardGestureInput");
    expect(viewport).toContain("resolveInteractionIntent");
    expect(viewport).toContain("commandFromInteractionIntent");
    expect(canvas).not.toContain("resolveWheelNavigation");
    expect(canvas).not.toContain("zoomViewportAtPoint");
    expect(canvas).not.toContain("onViewportChange");
    expect(viewport).not.toContain("resolveWheelNavigation");
    expect(viewport).not.toContain("zoomViewportAtPoint");
    expect(viewport).not.toContain("onViewportChange");
  });

  it("keeps render-view navigation on the same standard intent path", () => {
    const preview = readProjectFile("src/features/mermaid-editor/components/preview-panel.tsx");

    expect(preview).toContain("createStandardWheelInput");
    expect(preview).toContain("createStandardGestureInput");
    expect(preview).toContain("resolveInteractionIntent");
    expect(preview).toContain("commandFromInteractionIntent");
    expect(preview).not.toContain("resolveWheelNavigation");
    expect(preview).not.toContain("zoomViewportAtPoint");
  });

  it("keeps canvas document interactions on the standard canvas path", () => {
    const canvasDocumentEditor = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor.tsx");
    const pointer = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-pointer-interaction.ts");

    expect(canvasDocumentEditor).toContain("useCanvasDocumentPointerInteraction");
    expect(pointer).toContain("dispatchStandardCanvasPointerDown");
    expect(pointer).toContain("dispatchStandardCanvasPointerMove");
    expect(pointer).toContain("dispatchStandardCanvasPointerUp");
    expect(pointer).toContain("createStandardWheelInput");
    expect(pointer).toContain("resolveInteractionIntent");
    expect(pointer).toContain("commandFromInteractionIntent");
    expect(canvasDocumentEditor).not.toContain("resolveWheelNavigation");
    expect(canvasDocumentEditor).not.toContain("zoomViewportAtPoint");
  });

  it("keeps canvas document text editing inline instead of prompt-based", () => {
    const canvasDocumentEditor = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor.tsx");
    const actions = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-actions.ts");
    const inlineEditOverlays = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/inline-edit-overlays.tsx");

    expect(canvasDocumentEditor).toContain("CanvasDocumentInlineEditOverlays");
    expect(inlineEditOverlays).toContain("Textarea");
    expect(inlineEditOverlays).toContain("Input");
    expect(actions).toContain("commitInlineEdit");
    expect(actions).toContain("editingItemText");
    expect(actions).toContain("editingConnectionText");
    expect(canvasDocumentEditor).not.toContain("window.prompt(");
  });

  it("keeps Mermaid canvas interaction as a standard adapter", () => {
    const canvasInteraction = readProjectFile("src/features/mermaid-editor/lib/canvas-interaction.ts");

    expect(canvasInteraction).toContain("beginStandardCanvasPointer");
    expect(canvasInteraction).toContain("dispatchStandardCanvasPointerDown");
    expect(canvasInteraction).toContain("toStandardHitTarget");
    expect(canvasInteraction).toContain("fromStandardCommand");
  });

  it("keeps frontend components behind the editor runtime platform adapter", () => {
    const componentFiles = projectFilesUnder("src/features/mermaid-editor/components", /\.[tj]sx?$/);

    for (const file of componentFiles) {
      const source = readProjectFile(file);
      expect(source, file).not.toContain("@tauri-apps/api");
    }
  });

  it("prevents new component prompt flows from bypassing app chrome", () => {
    const componentFiles = projectFilesUnder("src/features/mermaid-editor/components", /\.[tj]sx?$/);

    for (const file of componentFiles) {
      const source = readProjectFile(file);
      expect(source, file).not.toContain("window.prompt(");
    }
  });

  it("keeps Agent controls on shared shadcn component boundaries", () => {
    const panel = readProjectFile("src/features/mermaid-editor/components/agent/agent-panel.tsx");
    const settings = readProjectFile("src/features/mermaid-editor/components/agent/agent-settings-dialog.tsx");
    const scroller = readProjectFile("src/components/ui/message-scroller.tsx");

    for (const source of [panel, settings]) {
      expect(source).toContain('from "@/components/ui/button"');
      expect(source).toContain('from "@/components/ui/dialog"');
      expect(source).not.toMatch(/<(button|input|select|textarea)\b/);
      expect(source).not.toContain('role="button"');
    }
    expect(panel).toContain('from "@/components/ui/sidebar"');
    expect(panel).toContain('from "@/components/ui/message-scroller"');
    expect(panel).toContain("<AgentSettingsPanel");
    expect(panel).not.toContain('from "@/components/ui/sheet"');
    expect(scroller).toContain('from "@shadcn/react/message-scroller"');
  });

  it("keeps Agent and browser bodies filling the shared floating window", () => {
    const agent = readProjectFile("src/features/mermaid-editor/components/agent/agent-panel.tsx");
    const settings = readProjectFile("src/features/mermaid-editor/components/agent/agent-settings-dialog.tsx");
    const browser = readProjectFile("src/features/mermaid-editor/components/browser-window-panel.tsx");
    const surface = readProjectFile("src/features/mermaid-editor/components/embedded-browser-surface.tsx");
    const nativeFrame = readProjectFile("src/features/mermaid-editor/components/floating-chrome/workspace-native-surface-frame.tsx");

    expect(agent).toContain("flex h-full min-h-0 flex-col");
    expect(agent).toContain('className="min-h-0 flex-1"');
    expect(agent).toContain('controller.status !== "ready"');
    expect(settings).toContain("flex h-full min-h-0 flex-col");
    expect(settings).toContain('controller.status !== "ready"');
    expect(browser).toContain("WorkspaceNativeSurfaceFrame");
    expect(surface).toContain("isEmbeddedBrowserSurfaceOccluded");
    expect(surface).not.toContain("activeRef");
    expect(nativeFrame).toContain("WORKSPACE_PANEL_HEADER_HOT_ZONE_PX");
  });

  it("keeps known oversized files on a no-growth budget", () => {
    const budgets = [
      { path: "src/features/mermaid-editor/components/mermaid-editor.tsx", maxLines: 700 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows.tsx", maxLines: 180 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-floating-chrome.tsx", maxLines: 320 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-overlays.tsx", maxLines: 120 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-shell-utils.ts", maxLines: 140 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-workspace-surface.tsx", maxLines: 240 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels.tsx", maxLines: 280 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-command-actions.ts", maxLines: 400 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-clipboard-actions.ts", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-clipboard-image-paste.ts", maxLines: 120 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-embedded-browser-handles.ts", maxLines: 70 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-document-model.ts", maxLines: 220 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-draft-autosave.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-draft-persistence.ts", maxLines: 250 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-keyboard-shortcuts.ts", maxLines: 260 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-overlay-state.ts", maxLines: 160 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-theme-model.ts", maxLines: 120 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-workspace-panel-actions.ts", maxLines: 60 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow.ts", maxLines: 160 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/types.ts", maxLines: 160 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-file-drop-workflow.ts", maxLines: 240 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-file-open-workflow.ts", maxLines: 120 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-file-save-workflow.ts", maxLines: 140 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-image-import-workflow.ts", maxLines: 190 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-project-workspace-workflow.ts", maxLines: 170 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-unsaved-file-switch.ts", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/file-workflow/utils.ts", maxLines: 70 },
      { path: "src/features/mermaid-editor/components/floating-chrome.tsx", maxLines: 20 },
      { path: "src/features/mermaid-editor/components/floating-chrome/chrome-slot.tsx", maxLines: 180 },
      { path: "src/features/mermaid-editor/components/floating-chrome/floating-buttons.tsx", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/floating-chrome/floating-panel.tsx", maxLines: 170 },
      { path: "src/features/mermaid-editor/components/floating-chrome/floating-popover.tsx", maxLines: 20 },
      { path: "src/features/mermaid-editor/components/floating-chrome/floating-panel-frame.ts", maxLines: 90 },
      { path: "src/features/mermaid-editor/components/floating-chrome/motion-presence.tsx", maxLines: 120 },
      { path: "src/features/mermaid-editor/components/floating-chrome/shared.ts", maxLines: 70 },
      { path: "src/features/mermaid-editor/components/floating-chrome/use-floating-panel-controller.ts", maxLines: 350 },
      { path: "src/features/mermaid-editor/components/floating-chrome/use-floating-panel-frame-state.ts", maxLines: 130 },
      { path: "src/features/mermaid-editor/components/floating-chrome/use-floating-panel-motion.ts", maxLines: 130 },
      { path: "src/features/mermaid-editor/components/floating-chrome/workspace-floating-window.tsx", maxLines: 200 },
      { path: "src/features/mermaid-editor/components/floating-chrome/workspace-panel-header-context.tsx", maxLines: 180 },
      { path: "src/features/mermaid-editor/components/editor-ui/window-titlebar.tsx", maxLines: 70 },
      { path: "src/features/mermaid-editor/components/editor-menus.tsx", maxLines: 20 },
      { path: "src/features/mermaid-editor/components/editor-menus/file-menu.tsx", maxLines: 150 },
      { path: "src/features/mermaid-editor/components/editor-menus/view-filter-menu.tsx", maxLines: 180 },
      { path: "src/features/mermaid-editor/components/editor-menus/secondary-actions-menu.tsx", maxLines: 330 },
      { path: "src/features/mermaid-editor/components/editor-menus/shared.tsx", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/inspector-panel.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/node-sections.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/edge-sections.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/subgraph-sections.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/model.ts", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/konva-canvas.tsx", maxLines: 80 },
      { path: "src/features/mermaid-editor/components/konva-canvas/konva-canvas-stage.tsx", maxLines: 380 },
      { path: "src/features/mermaid-editor/components/konva-canvas/types.ts", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/konva-canvas/use-konva-canvas-model.ts", maxLines: 420 },
      { path: "src/features/mermaid-editor/components/konva-canvas/use-konva-canvas-pointer-interaction.ts", maxLines: 480 },
      { path: "src/features/mermaid-editor/components/konva-canvas/use-konva-drag-membership.ts", maxLines: 280 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor.tsx", maxLines: 120 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/canvas-document-animation.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/image-url-dialog.tsx", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/inline-edit-overlays.tsx", maxLines: 220 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/inline-edit-style.ts", maxLines: 160 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/interaction-context.ts", maxLines: 40 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-actions.ts", maxLines: 240 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-image-sources.ts", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-keyboard-shortcuts.ts", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-model.ts", maxLines: 300 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-pointer-interaction.ts", maxLines: 220 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-scene.ts", maxLines: 130 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-standard-commands.ts", maxLines: 180 },
      { path: "src/features/mermaid-editor/lib/edge-geometry.ts", maxLines: 60 },
      { path: "src/features/mermaid-editor/lib/edge-geometry/types.ts", maxLines: 130 },
      { path: "src/features/mermaid-editor/lib/edge-geometry/vector.ts", maxLines: 140 },
      { path: "src/features/mermaid-editor/lib/edge-geometry/shape-boundary.ts", maxLines: 190 },
      { path: "src/features/mermaid-editor/lib/edge-geometry/lanes.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/lib/edge-geometry/routing.ts", maxLines: 430 },
      { path: "src/features/mermaid-editor/lib/edge-geometry/resolve.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/lib/editor-runtime.ts", maxLines: 60 },
      { path: "src/features/mermaid-editor/lib/editor-runtime/types.ts", maxLines: 230 },
      { path: "src/features/mermaid-editor/lib/editor-runtime/shared.ts", maxLines: 40 },
      { path: "src/features/mermaid-editor/lib/editor-runtime/browser-file.ts", maxLines: 60 },
      { path: "src/features/mermaid-editor/lib/editor-runtime/web-runtime.ts", maxLines: 220 },
      { path: "src/features/mermaid-editor/lib/editor-runtime/electron-runtime.ts", maxLines: 230 },
      { path: "src/features/mermaid-editor/lib/editor-runtime/electron-bridge.ts", maxLines: 140 },
      { path: "electron/main.cjs", maxLines: 650 },
      { path: "electron/preload.cjs", maxLines: 220 },
      { path: "electron/terminal.cjs", maxLines: 260 },
      { path: "electron/pi-agent-manager.cjs", maxLines: 320 },
      { path: "electron/pi-agent-worker.mjs", maxLines: 700 },
      { path: "src/features/mermaid-editor/lib/clipboard-image.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/lib/mermaid-patch.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/lib/mermaid-patch/apply.ts", maxLines: 90 },
      { path: "src/features/mermaid-editor/lib/mermaid-patch/diagnostics.ts", maxLines: 60 },
      { path: "src/features/mermaid-editor/lib/mermaid-patch/diff.ts", maxLines: 160 },
      { path: "src/features/mermaid-editor/lib/mermaid-patch/operations.ts", maxLines: 520 },
      { path: "src/features/mermaid-editor/lib/mermaid-patch/types.ts", maxLines: 190 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph.ts", maxLines: 20 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/constants.ts", maxLines: 40 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/edge-token.ts", maxLines: 390 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/node-action-token.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/node-id.ts", maxLines: 60 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/node-token.ts", maxLines: 140 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/parser.ts", maxLines: 360 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/serializer.ts", maxLines: 130 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/subgraph.ts", maxLines: 110 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/syntax.ts", maxLines: 70 },
      { path: "src/features/mermaid-editor/lib/mermaid-graph/types.ts", maxLines: 90 },
      { path: "src/features/mermaid-editor/lib/editor-theme.ts", maxLines: 120 },
      { path: "src/features/mermaid-editor/lib/editor-theme/color.ts", maxLines: 120 },
      { path: "src/features/mermaid-editor/lib/editor-theme/compile.ts", maxLines: 340 },
      { path: "src/features/mermaid-editor/lib/editor-theme/normalize.ts", maxLines: 340 },
      { path: "src/features/mermaid-editor/lib/editor-theme/presets.ts", maxLines: 420 },
      { path: "src/features/mermaid-editor/lib/editor-theme/types.ts", maxLines: 340 }
    ];

    for (const budget of budgets) {
      expect(lineCount(readProjectFile(budget.path)), budget.path).toBeLessThanOrEqual(budget.maxLines);
    }
  });

  it("keeps large editor panels outside the MermaidEditor composition file", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");

    expect(editor).not.toContain("function ThemeSettingsPanel(");
    expect(editor).not.toContain("function FileMenu(");
    expect(editor).not.toContain("function ViewFilterMenu(");
    expect(editor).not.toContain("function ExplorerPanel(");
    expect(editor).not.toContain("function SecondaryActionsMenu(");
    expect(editor).not.toContain("function WorkspacePanelControls(");
    expect(editor).not.toContain("function NodeActionEditorDialog(");
    expect(editor).not.toContain("function WorkspaceViewCluster(");
    expect(editor).not.toContain("function ToolModeCluster(");
    expect(editor).not.toContain("function DesktopWindowControls(");
    expect(editor).not.toContain("function MarkdownWindowPanel(");
    expect(editor).not.toContain("function BrowserWindowPanel(");
    expect(editor).not.toContain("function FileDropFeedbackBadge(");
    expect(editor).not.toContain("function FileWorkflowErrorBanner(");
    expect(editor).not.toContain("function UnsavedFilePrompt(");
    expect(editor).toContain("EditorWorkspaceSurface");
    expect(editor).toContain("EditorWorkspacePanels");
    expect(editor).toContain("EditorFloatingChrome");
    expect(editor).toContain("EditorOverlays");
    expect(editor).not.toContain("DetachedWorkspaceWindows");
    expect(editor).not.toContain("<CanvasDocumentEditor");
    expect(editor).not.toContain("<KonvaCanvas");
    expect(editor).not.toContain("<MarkdownPanel");
    expect(editor).not.toContain("<SourcePanel");
    expect(editor).not.toContain("<PreviewPanel");
    expect(editor).not.toContain("<FloatingPanel");
    expect(editor).not.toContain("<FloatingChromeLayer");
    expect(editor).not.toContain("<FileMenu");
    expect(editor).not.toContain("<ViewFilterMenu");
    expect(editor).not.toContain("<SecondaryActionsMenu");
    expect(editor).not.toContain("<InspectorPanel");
    expect(editor).not.toContain("<ExplorerPanel");
    expect(editor).not.toContain("<TerminalPanel");
    expect(editor).not.toContain("<NodeActionEditorDialog");
    expect(editor).not.toContain("<ThemeSettingsPanel");
    expect(editor).not.toContain("detachedMarkdownWindows.map");
    expect(editor).not.toContain("detachedBrowserWindows.map");
    expect(editor).not.toContain("function loadInitialState(");
    expect(editor).not.toContain("function buildFallbackCleanDocument(");
    expect(editor).not.toContain("function createEmptyDocumentGraph(");
    expect(editor).not.toContain("function normalizeStoredDocumentKind(");
    expect(editor).not.toContain("const DEFAULT_WORKSPACE_PANEL_STACK");
    expect(editor).not.toContain("const openWorkspacePanelIds");
    expect(editor).not.toContain("function workspacePanelWindowState(");
  });

  it("keeps editor menus behind focused menu modules", () => {
    const facade = readProjectFile("src/features/mermaid-editor/components/editor-menus.tsx");
    const fileMenu = readProjectFile("src/features/mermaid-editor/components/editor-menus/file-menu.tsx");
    const viewFilter = readProjectFile("src/features/mermaid-editor/components/editor-menus/view-filter-menu.tsx");
    const secondary = readProjectFile("src/features/mermaid-editor/components/editor-menus/secondary-actions-menu.tsx");
    const shared = readProjectFile("src/features/mermaid-editor/components/editor-menus/shared.tsx");

    expect(facade).toContain("FileMenu");
    expect(facade).toContain("ViewFilterMenu");
    expect(facade).toContain("SecondaryActionsMenu");
    expect(fileMenu).toContain("export function FileMenu");
    expect(viewFilter).toContain("export function ViewFilterMenu");
    expect(secondary).toContain("export function SecondaryActionsMenu");
    expect(secondary).toContain('label="自动隐藏浮窗标题栏"');
    expect(secondary).toContain("preferences.workspaceTitlebarAutoHide");
    expect(shared).toContain("edgeRoutingOptions");
    expect(shared).toContain("FilterToggle");
    expect(facade).not.toContain("function FileMenu(");
    expect(facade).not.toContain("function ViewFilterMenu(");
    expect(facade).not.toContain("function SecondaryActionsMenu(");
    expect(facade).not.toContain("<FloatingPanel");
  });

  it("threads workspace titlebar and Markdown scale preferences through focused panel modules", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");
    const surface = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/editor-workspace-surface.tsx");
    const panels = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels.tsx");
    const detached = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows.tsx");

    expect(editor).toContain("markdownTextScale={preferences.markdownTextScale}");
    expect(editor).toContain("workspaceTitlebarAutoHide={preferences.workspaceTitlebarAutoHide}");
    expect(surface).toContain("textScale={markdownTextScale}");
    expect(panels).toContain("workspaceTitlebarAutoHide={workspaceTitlebarAutoHide}");
    expect(detached).toContain("textScale={markdownTextScale}");
    expect(detached).toContain("onTextScaleChange={onMarkdownTextScaleChange}");
  });

  it("keeps edge geometry behind a small public facade", () => {
    const facade = readProjectFile("src/features/mermaid-editor/lib/edge-geometry.ts");
    const routing = readProjectFile("src/features/mermaid-editor/lib/edge-geometry/routing.ts");
    const boundary = readProjectFile("src/features/mermaid-editor/lib/edge-geometry/shape-boundary.ts");
    const lanes = readProjectFile("src/features/mermaid-editor/lib/edge-geometry/lanes.ts");
    const resolve = readProjectFile("src/features/mermaid-editor/lib/edge-geometry/resolve.ts");

    expect(facade).toContain("computeEdgePath");
    expect(facade).toContain("RoutedNodeRect");
    expect(routing).toContain("function routeBetweenRects(");
    expect(boundary).toContain("function intersectShapeBoundary(");
    expect(lanes).toContain("resolveParallelEdgeLanes");
    expect(resolve).toContain("resolveFinalEdgeGeometryMap");
    expect(facade).not.toContain("function routeBetweenRects(");
    expect(facade).not.toContain("function intersectShapeBoundary(");
    expect(facade).not.toContain("function sampleCubic(");
    expect(facade).not.toContain("routingPresets");
  });

  it("keeps editor runtime behind focused runtime modules", () => {
    const facade = readProjectFile("src/features/mermaid-editor/lib/editor-runtime.ts");
    const types = readProjectFile("src/features/mermaid-editor/lib/editor-runtime/types.ts");
    const web = readProjectFile("src/features/mermaid-editor/lib/editor-runtime/web-runtime.ts");
    const electronRuntime = readProjectFile("src/features/mermaid-editor/lib/editor-runtime/electron-runtime.ts");
    const electronBridge = readProjectFile("src/features/mermaid-editor/lib/editor-runtime/electron-bridge.ts");
    const electronMain = readProjectFile("electron/main.cjs");
    const browserFile = readProjectFile("src/features/mermaid-editor/lib/editor-runtime/browser-file.ts");

    expect(facade).toContain("createEditorRuntime");
    expect(facade).toContain("createWebRuntime");
    expect(facade).toContain("createElectronRuntime");
    expect(types).toContain("export type EditorRuntime");
    expect(web).toContain("export function createWebRuntime");
    expect(electronRuntime).toContain("export function createElectronRuntime");
    expect(electronBridge).toContain("export function getElectronBridge");
    expect(electronMain).toContain("createPiAgentManager");
    expect(electronMain).not.toContain("createAiBridge");
    expect(electronMain).toContain("createTerminalManager");
    expect(browserFile).toContain("FILE_PICKER_TYPES");
    expect(types).toContain('export type EditorRuntimeHost = "web" | "electron"');
    expect(facade).not.toContain("showOpenFilePicker");
    expect(facade).not.toContain("terminal_open");
    expect(facade).not.toContain("new Webview");
    expect(facade).not.toContain("localStorage");
    expect(facade).not.toContain("open_mermaid_file");
  });

  it("keeps desktop release automation on Electron", () => {
    const release = readProjectFile(".github/workflows/release.yml");
    const ci = readProjectFile(".github/workflows/ci.yml");
    const windowsRun = readProjectFile("scripts/run-on-windows.mjs");
    const electronBuild = readProjectFile("scripts/electron-build.mjs");
    const electronMain = readProjectFile("electron/main.cjs");
    const electronPreload = readProjectFile("electron/preload.cjs");
    const electronShip = readProjectFile("scripts/electron-ship.mjs");
    const packageJson = readProjectFile("package.json");
    const viteConfig = readProjectFile("vite.config.ts");
    const macEntitlements = readProjectFile("build/entitlements.mac.plist");
    const macInheritedEntitlements = readProjectFile("build/entitlements.mac.inherit.plist");

    expect(release).toContain("build-electron");
    expect(release).toContain("npm run electron:build");
    expect(release).not.toContain("npm run electron:ship");
    expect(release).toContain("dist-electron/*.dmg");
    expect(release).toContain("dist-electron/*.exe");
    expect(release).toContain("dist-electron/*.AppImage");
    expect(release).toContain("GH_REPO: ${{ github.repository }}");
    expect(release).toContain("gh release delete-asset");
    expect(release).not.toContain("tauri-apps/tauri-action");
    expect(release).not.toContain("rust-toolchain");
    expect(ci).toContain("npm run electron:build -- --dir");
    expect(windowsRun).toContain("npm run electron:build");
    expect(windowsRun).toContain("--config.npmRebuild=false");
    expect(windowsRun).not.toContain("npm run electron:ship");
    expect(windowsRun).not.toContain("src-tauri\\\\target\\\\release");
    expect(packageJson).toContain('"electron:ship": "node scripts/electron-ship.mjs"');
    expect(packageJson).not.toContain("tauri");
    expect(viteConfig).not.toContain("TAURI_");
    expect(electronShip).toContain('"electron:build"');
    expect(electronBuild).toContain("--publish");
    expect(electronBuild).toContain("never");
    expect(viteConfig).toContain('base: "./"');
    expect(electronMain).toContain("CLOSE_REQUEST_TIMEOUT_MS");
    expect(electronPreload).toContain("mmm:window:close-request-received");
    expect(packageJson).toContain('"hardenedRuntime": true');
    expect(packageJson).toContain('"notarize": true');
    expect(packageJson).toContain('"entitlements": "build/entitlements.mac.plist"');
    expect(release).toContain("APPLE_API_KEY");
    expect(macEntitlements).toContain("com.apple.security.cs.allow-jit");
    expect(macInheritedEntitlements).toContain("com.apple.security.cs.disable-library-validation");
  });

  it("keeps Mermaid patch behind a small public facade", () => {
    const facade = readProjectFile("src/features/mermaid-editor/lib/mermaid-patch.ts");
    const apply = readProjectFile("src/features/mermaid-editor/lib/mermaid-patch/apply.ts");
    const operations = readProjectFile("src/features/mermaid-editor/lib/mermaid-patch/operations.ts");
    const diff = readProjectFile("src/features/mermaid-editor/lib/mermaid-patch/diff.ts");
    const diagnostics = readProjectFile("src/features/mermaid-editor/lib/mermaid-patch/diagnostics.ts");

    expect(facade).toContain("applyMermaidPatch");
    expect(facade).toContain("PatchOperation");
    expect(apply).toContain("applyPatchOperations");
    expect(operations).toContain("function addNodeOp(");
    expect(operations).toContain("function updateEdgeOp(");
    expect(operations).toContain("function createSubgraphOp(");
    expect(diff).toContain("function diffById");
    expect(diagnostics).toContain("patchDiagnostic");
    expect(facade).not.toContain("function addNodeOp(");
    expect(facade).not.toContain("function updateEdgeOp(");
    expect(facade).not.toContain("function diffById(");
    expect(facade).not.toContain("VALID_EDGE_STYLES");
  });

  it("keeps window and node action logic outside the MermaidEditor composition file", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");
    const actions = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-window-actions.ts");
    const desktopEvents = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-desktop-events.ts");
    const browserSurface = readProjectFile("src/features/mermaid-editor/components/embedded-browser-surface.tsx");

    expect(editor).toContain("useEditorWindowActions");
    expect(editor).not.toContain("useEditorEmbeddedBrowserHandles");
    expect(actions).toContain("openBrowserWorkspaceWindow");
    expect(actions).not.toContain("closeEmbeddedBrowser(panelId)");
    expect(desktopEvents).not.toContain("canCloseWindowRef.current || !isDirtyRef.current");
    expect(browserSurface).toContain("disposeRuntimeEmbeddedBrowserHandle");
    expect(editor).not.toContain("function openProjectMarkdownWindow(");
    expect(editor).not.toContain("function openBrowserWindow(");
    expect(editor).not.toContain("function updateDetachedBrowserWindow(");
    expect(editor).not.toContain("function closeDetachedBrowserWindow(");
    expect(editor).not.toContain("function executeCanvasNodeAction(");
    expect(editor).not.toContain("function executeNodeActionDraft(");
    expect(editor).not.toContain("function openFileNodeAction(");
    expect(editor).not.toContain("function resolveNodeActionFilePath(");
    expect(editor).not.toContain("function saveDetachedMarkdownWindow(");
  });

  it("keeps inspector sections and selection helpers outside the InspectorPanel shell file", () => {
    const inspector = readProjectFile("src/features/mermaid-editor/components/inspector-panel.tsx");

    expect(inspector).toContain("NodeInspectorSection");
    expect(inspector).toContain("MultiNodeInspectorSection");
    expect(inspector).toContain("SubgraphInspectorSection");
    expect(inspector).toContain("MultiSubgraphInspectorSection");
    expect(inspector).toContain("EdgeInspectorSection");
    expect(inspector).toContain("MultiEdgeInspectorSection");
    expect(inspector).toContain("createInspectorSelectionModel");
    expect(inspector).not.toContain("function ColorGrid(");
    expect(inspector).not.toContain("function EmptyInspector(");
    expect(inspector).not.toContain("function nodeAnchorOptions(");
    expect(inspector).not.toContain("function normalizeNodePatch(");
    expect(inspector).not.toContain("function normalizeEdgePatch(");
    expect(inspector).not.toContain("function normalizeSubgraphPatch(");
    expect(inspector).not.toContain("FLOWCHART_SHAPES.filter");
  });

  it("keeps Konva render helpers outside the KonvaCanvas shell file", () => {
    const canvas = readProjectFile("src/features/mermaid-editor/components/konva-canvas.tsx");
    const model = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-canvas-model.ts");
    const stage = readProjectFile("src/features/mermaid-editor/components/konva-canvas/konva-canvas-stage.tsx");

    expect(canvas).not.toContain("function CanvasNodeShape(");
    expect(canvas).not.toContain("function CanvasNodeImage(");
    expect(canvas).not.toContain("function EdgeMarkers(");
    expect(canvas).not.toContain("function CanvasGrid(");
    expect(canvas).not.toContain("function AlignmentGuideOverlay(");
    expect(canvas).not.toContain("function CanvasNodeActionBadge(");
    expect(canvas).not.toContain("function NodeActionTooltip(");
    expect(canvas).not.toContain("function NodeContextMenu(");
    expect(canvas).not.toContain("function useContainerSize(");
    expect(canvas).not.toContain("function measureTextWidth(");
    expect(canvas).toContain("KonvaCanvasStage");
    expect(canvas).not.toContain("<Stage");
    expect(canvas).not.toContain("<Layer");
    expect(canvas).not.toContain("<KonvaSubgraphLayer");
    expect(canvas).not.toContain("<KonvaEdgeLayer");
    expect(canvas).not.toContain("<KonvaEdgeOverlayLayer");
    expect(canvas).not.toContain("<KonvaNodeLayer");
    expect(stage).toContain("<Stage");
    expect(stage).toContain("KonvaSubgraphLayer");
    expect(stage).toContain("KonvaEdgeLayer");
    expect(stage).toContain("KonvaEdgeOverlayLayer");
    expect(stage).toContain("KonvaNodeLayer");
    expect(canvas).toContain("useKonvaCanvasModel");
    expect(canvas).toContain("useKonvaCanvasPointerInteraction");
    expect(model).toContain("useKonvaRenderModel");
    expect(model).toContain("useKonvaMotion");
    expect(model).toContain("useKonvaViewport");
    expect(model).toContain("useKonvaHoverState");
    expect(canvas).not.toContain("[...scopedSubgraphGeometries]");
    expect(canvas).not.toContain("scopedVisibleEdges.map");
    expect(canvas).not.toContain("scopedRenderedNodes.map");
    expect(canvas).not.toContain("exitingNodes.map");
  });

  it("keeps Mermaid image nodes rendered as token-driven image surfaces", () => {
    const nodeLayer = readProjectFile("src/features/mermaid-editor/components/konva-canvas/node-layer.tsx");
    const nodeImage = readProjectFile("src/features/mermaid-editor/components/konva-canvas/node-image.tsx");
    const nodeImageSurface = readProjectFile("src/features/mermaid-editor/components/konva-canvas/node-image-surface.tsx");
    const markdownCard = readProjectFile("src/features/mermaid-editor/components/konva-canvas/markdown-document-card.tsx");
    const nodeGeometry = readProjectFile("src/features/mermaid-editor/lib/node-geometry.ts");

    expect(nodeGeometry).toContain("if (asset) return buildImageNodeGeometry(node, asset);");
    expect(nodeGeometry).toContain("width: asset.width");
    expect(nodeGeometry).toContain("height: asset.height");
    expect(nodeGeometry).toContain("width: 0");
    expect(nodeGeometry).toContain("height: 0");
    expect(nodeImage).toContain("<KonvaImage");
    expect(nodeImage).toContain("return null;");
    expect(nodeImage).not.toContain("<Rect");
    expect(nodeImage).not.toContain("<Line");
    expect(nodeImage).not.toContain("cornerRadius");
    expect(nodeImage).not.toContain("dash=");
    expect(nodeImage).not.toContain("stroke");
    expect(nodeLayer).toContain("isStandardNode ? (");
    expect(nodeLayer).toContain("isTableNode && geometry.table ? (");
    expect(nodeLayer).toContain("<CanvasNodeLinkCard");
    expect(nodeLayer).toContain("fill=\"rgba(0,0,0,0.001)\"");
    expect(nodeLayer).toContain("strokeEnabled={false}");
    expect(nodeLayer).toContain("<CanvasNodeImageSurface");
    expect(nodeImageSurface).toContain("cornerRadius={surface.radius}");
    expect(nodeImageSurface).toContain("roundedRectClip");
    expect(nodeLayer).toContain("imageInteractionFrameVisible");
    expect(nodeLayer).toContain("isStandardNode && normalizeNodeAction");
    expect(markdownCard).not.toContain("<Group listening={false}>");
  });

  it("keeps Konva runtime controllers outside the KonvaCanvas shell file", () => {
    const canvas = readProjectFile("src/features/mermaid-editor/components/konva-canvas.tsx");
    const model = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-canvas-model.ts");
    const pointer = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-canvas-pointer-interaction.ts");
    const dragMembership = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-drag-membership.ts");

    expect(model).toContain("useKonvaDragDraft");
    expect(model).toContain("useKonvaDragMembership");
    expect(model).toContain("useKonvaNodeProximity");
    expect(model).toContain("useKonvaInlineEditSession");
    expect(model).toContain("useKonvaNodeEditorLayout");
    expect(pointer).toContain("function handleCanvasPointerDown(");
    expect(pointer).toContain("function applyCanvasPointerLocalEffect(");
    expect(pointer).toContain("resolveCanvasPointerDown");
    expect(pointer).toContain("resolveCanvasPointerMove");
    expect(pointer).toContain("resolveCanvasPointerUp");
    expect(dragMembership).toContain("moveSelectedNodes");
    expect(dragMembership).toContain("finishDragWithMembership");
    expect(canvas).not.toContain("function handleCanvasPointerDown(");
    expect(canvas).not.toContain("function applyCanvasPointerLocalEffect(");
    expect(canvas).not.toContain("resolveCanvasPointerDown");
    expect(canvas).not.toContain("function startNodeDrag(");
    expect(canvas).not.toContain("function startSubgraphDrag(");
    expect(canvas).not.toContain("function moveSelectedNodes(");
    expect(canvas).not.toContain("function moveSelectedSubgraphs(");
    expect(canvas).not.toContain("function finishDragWithMembership(");
    expect(canvas).not.toContain("function scheduleDragDraftCommand(");
    expect(canvas).not.toContain("function flushDragDraftCommand(");
    expect(canvas).not.toContain("function clearDragRuntimeState(");
    expect(canvas).not.toContain("function stopNodeProximityAnimation(");
    expect(canvas).not.toContain("function resolveNodeProximityTargetScales(");
    expect(canvas).not.toContain("function stepNodeProximityAnimation(");
    expect(canvas).not.toContain("function commitInlineEdit(");
    expect(canvas).not.toContain("function inlineEditStyle(");
  });

  it("keeps Pixi canvas document rendering outside the CanvasDocumentEditor shell file", () => {
    const canvasDocumentEditor = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor.tsx");
    const scene = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-scene.ts");

    expect(canvasDocumentEditor).toContain("useCanvasDocumentModel");
    expect(canvasDocumentEditor).toContain("useCanvasDocumentActions");
    expect(canvasDocumentEditor).toContain("useCanvasDocumentPointerInteraction");
    expect(scene).toContain("useCanvasDocumentImageSources");
    expect(scene).toContain("createPixiCanvasRuntime");
    expect(canvasDocumentEditor).not.toContain("function syncPixiScene(");
    expect(canvasDocumentEditor).not.toContain("function getPixiElementView(");
    expect(canvasDocumentEditor).not.toContain("function syncElementView(");
    expect(canvasDocumentEditor).not.toContain("function drawShape(");
    expect(canvasDocumentEditor).not.toContain("function drawCard(");
    expect(canvasDocumentEditor).not.toContain("function drawConnector(");
    expect(canvasDocumentEditor).not.toContain("function drawSelectionOverlay(");
    expect(canvasDocumentEditor).not.toContain("function drawGrid(");
    expect(canvasDocumentEditor).not.toContain("function ToolbarButton(");
    expect(canvasDocumentEditor).not.toContain("function useContainerSize(");
    expect(canvasDocumentEditor).not.toContain("function loadImageDimensions(");
  });

  it("keeps Pixi canvas document overlays and side effects outside the shell file", () => {
    const canvasDocumentEditor = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor.tsx");
    const keyboard = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-keyboard-shortcuts.ts");
    const model = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-model.ts");
    const actions = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-actions.ts");
    const pointer = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-pointer-interaction.ts");

    expect(canvasDocumentEditor).toContain("useCanvasDocumentKeyboardShortcuts");
    expect(canvasDocumentEditor).toContain("CanvasDocumentImageUrlDialog");
    expect(canvasDocumentEditor).toContain("CanvasDocumentInlineEditOverlays");
    expect(model).toContain("resolveCanvasDocumentInlineEditStyle");
    expect(actions).toContain("function commitInlineEdit(");
    expect(pointer).toContain("function handlePointerDown(");
    expect(keyboard).toContain("window.addEventListener(\"keydown\"");
    expect(canvasDocumentEditor).not.toContain("window.addEventListener(\"keydown\"");
    expect(canvasDocumentEditor).not.toContain("useCanvasDocumentImageSources");
    expect(canvasDocumentEditor).not.toContain("resolveCanvasDocumentInlineEditStyle");
    expect(canvasDocumentEditor).not.toContain("function handlePointerDown(");
    expect(canvasDocumentEditor).not.toContain("function commitInlineEdit(");
    expect(canvasDocumentEditor).not.toContain("imageUrlDialogOpen ? (");
    expect(canvasDocumentEditor).not.toContain("<Textarea");
    expect(canvasDocumentEditor).not.toContain("<Input");
    expect(canvasDocumentEditor).not.toContain("function inlineEditStyle(");
    expect(canvasDocumentEditor).not.toContain("useLayoutEffect");
    expect(canvasDocumentEditor).not.toContain("const CANVAS_DOCUMENT_INTERACTION_GRAPH");
    expect(canvasDocumentEditor).not.toContain("gsap.to(view.container");
  });

  it("keeps floating chrome components behind focused modules", () => {
    const barrel = readProjectFile("src/features/mermaid-editor/components/floating-chrome.tsx");
    const slot = readProjectFile("src/features/mermaid-editor/components/floating-chrome/chrome-slot.tsx");
    const panel = readProjectFile("src/features/mermaid-editor/components/floating-chrome/floating-panel.tsx");
    const popover = readProjectFile("src/features/mermaid-editor/components/floating-chrome/floating-popover.tsx");
    const workspaceWindow = readProjectFile("src/features/mermaid-editor/components/floating-chrome/workspace-floating-window.tsx");
    const controller = readProjectFile("src/features/mermaid-editor/components/floating-chrome/use-floating-panel-controller.ts");
    const frame = readProjectFile("src/features/mermaid-editor/components/floating-chrome/use-floating-panel-frame-state.ts");
    const motion = readProjectFile("src/features/mermaid-editor/components/floating-chrome/use-floating-panel-motion.ts");
    const buttons = readProjectFile("src/features/mermaid-editor/components/floating-chrome/floating-buttons.tsx");

    expect(barrel).toContain("export * from \"./floating-chrome/chrome-slot\"");
    expect(barrel).toContain("export * from \"./floating-chrome/floating-buttons\"");
    expect(barrel).toContain("export * from \"./floating-chrome/floating-popover\"");
    expect(barrel).toContain("export * from \"./floating-chrome/workspace-floating-window\"");
    expect(barrel).toContain("export * from \"./floating-chrome/motion-presence\"");
    expect(slot).toContain("export function FloatingChromeSlot");
    expect(panel).toContain("useFloatingPanelController");
    expect(controller).toContain("export function useFloatingPanelController");
    expect(controller).toContain("useFloatingPanelFrameState");
    expect(controller).toContain("useFloatingPanelMotion");
    expect(frame).toContain("export function useFloatingPanelFrameState");
    expect(motion).toContain("export function useFloatingPanelMotion");
    expect(buttons).toContain("export function FloatingIconButton");
    expect(popover).toContain("export function FloatingPopover");
    expect(workspaceWindow).toContain("export function WorkspaceFloatingWindow");
    expect(workspaceWindow).toContain("export function WorkspaceWindowHeader");
    expect(barrel).not.toContain("./floating-chrome/floating-panel\"");
    expect(barrel).not.toContain("function FloatingPanel");
    expect(barrel).not.toContain("function FloatingChromeSlot");
    expect(barrel).not.toContain("function MotionPresence");
    expect(barrel).not.toContain("function FloatingIconButton");
  });

  it("routes every persistent workspace window through the shared window shell", () => {
    const app = readProjectFile("src/App.tsx");
    const electronMain = readProjectFile("electron/main.cjs");
    const agentWindows = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/agent-terminal-workspace-panels.tsx");
    const titlebarLayout = readProjectFile("src/features/mermaid-editor/components/editor-ui/window-titlebar.tsx");
    const workspaceHosts = [
      "src/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels.tsx",
      "src/features/mermaid-editor/components/mermaid-editor/agent-terminal-workspace-panels.tsx",
      "src/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows.tsx",
      "src/features/mermaid-editor/components/mermaid-editor/browser-workspace-windows.tsx",
      "src/features/mermaid-editor/components/mermaid-editor/html-workspace-windows.tsx"
    ].map(readProjectFile);
    const windowContents = [
      "src/features/mermaid-editor/components/explorer-panel.tsx",
      "src/features/mermaid-editor/components/inspector-panel.tsx",
      "src/features/mermaid-editor/components/theme-settings-panel.tsx",
      "src/features/mermaid-editor/components/terminal-panel.tsx",
      "src/features/mermaid-editor/components/agent/agent-panel.tsx",
      "src/features/mermaid-editor/components/agent/agent-settings-dialog.tsx",
      "src/features/mermaid-editor/components/browser-window-panel.tsx",
      "src/features/mermaid-editor/components/html-window-panel.tsx",
      "src/features/mermaid-editor/components/detached-window-panels.tsx"
    ].map(readProjectFile);

    for (const host of workspaceHosts) {
      expect(host).toContain("WorkspaceFloatingWindow");
      expect(host).not.toContain("<FloatingPanel");
    }
    for (const content of windowContents) {
      expect(content).toContain("WorkspaceWindowHeader");
      expect(content).not.toContain("WorkspacePanelControls");
      expect(content).not.toContain("data-window-drag-handle");
    }
    expect(titlebarLayout).toContain("data-window-titlebar-drag-exclude");
    expect(agentWindows).not.toContain("agent-settings");
    expect(app).not.toContain("BrowserToolWindow");
    expect(electronMain).not.toContain("mmm:browser-tool:open");
  });

  it("keeps application chrome behind the editor UI semantic layer", () => {
    const barrel = readProjectFile("src/features/mermaid-editor/components/editor-ui/index.ts");
    const styles = readProjectFile("src/styles/globals.css");
    const floatingButtons = readProjectFile("src/features/mermaid-editor/components/floating-chrome/floating-buttons.tsx");
    const arrangementToolbar = readProjectFile("src/features/mermaid-editor/components/konva-canvas/selection-arrangement-toolbar.tsx");
    const nodeDialog = readProjectFile("src/features/mermaid-editor/components/node-action-editor-dialog.tsx");
    const markdownDialog = readProjectFile("src/features/mermaid-editor/components/markdown-document-dialog.tsx");
    const csvDialog = readProjectFile("src/features/mermaid-editor/components/csv-table-dialog.tsx");
    const htmlDialog = readProjectFile("src/features/mermaid-editor/components/html-document-dialog.tsx");
    const projectDocumentDialog = readProjectFile("src/features/mermaid-editor/components/project-document-node-dialog.tsx");
    const imageDialog = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/image-url-dialog.tsx");
    const unsavedDialog = readProjectFile("src/features/mermaid-editor/components/file-workflow-feedback.tsx");

    for (const moduleName of ["dialog", "feedback", "field", "icon-button", "list", "menu", "panel", "toolbar", "window-titlebar"]) {
      expect(barrel).toContain(`export * from "./${moduleName}"`);
    }
    for (const className of ["editor-ui-control", "editor-ui-popover", "editor-ui-panel", "editor-ui-dialog", "editor-ui-toolbar"]) {
      expect(styles).toContain(`.${className}`);
    }
    expect(floatingButtons).toContain("EditorIconButton");
    expect(arrangementToolbar).toContain("EditorToolbar");
    for (const dialog of [nodeDialog, projectDocumentDialog, imageDialog, unsavedDialog]) {
      expect(dialog).toContain("EditorDialog");
      expect(dialog).not.toContain('className="fixed inset-0');
    }
    for (const dialog of [markdownDialog, htmlDialog, csvDialog]) {
      expect(dialog).toContain("ProjectDocumentNodeDialog");
      expect(dialog).not.toContain('className="fixed inset-0');
    }
  });

  it("keeps Mermaid graph parsing behind focused graph modules", () => {
    const barrel = readProjectFile("src/features/mermaid-editor/lib/mermaid-graph.ts");
    const parser = readProjectFile("src/features/mermaid-editor/lib/mermaid-graph/parser.ts");
    const serializer = readProjectFile("src/features/mermaid-editor/lib/mermaid-graph/serializer.ts");
    const edgeToken = readProjectFile("src/features/mermaid-editor/lib/mermaid-graph/edge-token.ts");
    const nodeToken = readProjectFile("src/features/mermaid-editor/lib/mermaid-graph/node-token.ts");
    const nodeActionToken = readProjectFile("src/features/mermaid-editor/lib/mermaid-graph/node-action-token.ts");
    const subgraph = readProjectFile("src/features/mermaid-editor/lib/mermaid-graph/subgraph.ts");

    expect(barrel).toContain("export { initialMermaidSource, palette } from \"./mermaid-graph/constants\"");
    expect(barrel).toContain("export * from \"./mermaid-graph/node-id\"");
    expect(barrel).toContain("export * from \"./mermaid-graph/parser\"");
    expect(barrel).toContain("export * from \"./mermaid-graph/serializer\"");
    expect(parser).toContain("export function parseMermaid");
    expect(serializer).toContain("export function serializeMermaid");
    expect(edgeToken).toContain("export function parseEdgeStatements");
    expect(edgeToken).toContain("export function parseEdgeOperator");
    expect(nodeToken).toContain("export function parseNodeToken");
    expect(nodeActionToken).toContain("export function parseNodeActionStatement");
    expect(subgraph).toContain("export function parseSubgraphHeader");
    expect(barrel).not.toContain("function parseMermaid");
    expect(barrel).not.toContain("function serializeMermaid");
    expect(barrel).not.toContain("function parseEdgeOperator");
    expect(barrel).not.toContain("function parseNodeToken");
  });

  it("keeps editor theme implementation behind focused theme modules", () => {
    const barrel = readProjectFile("src/features/mermaid-editor/lib/editor-theme.ts");
    const presets = readProjectFile("src/features/mermaid-editor/lib/editor-theme/presets.ts");
    const normalize = readProjectFile("src/features/mermaid-editor/lib/editor-theme/normalize.ts");
    const compile = readProjectFile("src/features/mermaid-editor/lib/editor-theme/compile.ts");
    const markdown = readProjectFile("src/features/mermaid-editor/lib/editor-theme/markdown-theme.ts");
    const color = readProjectFile("src/features/mermaid-editor/lib/editor-theme/color.ts");
    const styles = readProjectFile("src/styles/globals.css");

    expect(barrel).toContain("export * from \"./editor-theme/types\"");
    expect(barrel).toContain("export * from \"./editor-theme/markdown-theme\"");
    expect(barrel).toContain("export * from \"./editor-theme/presets\"");
    expect(barrel).toContain("export * from \"./editor-theme/normalize\"");
    expect(barrel).toContain("export * from \"./editor-theme/compile\"");
    expect(presets).toContain("DEFAULT_EDITOR_THEME");
    expect(normalize).toContain("normalizeEditorTheme");
    expect(compile).toContain("themeToCssVariables");
    expect(compile).toContain("markdownToCssVariables");
    expect(markdown).toContain("createDefaultMarkdownTheme");
    expect(markdown).toContain("normalizeMarkdownTheme");
    expect(styles).toContain("--markdown-h1-font-size");
    expect(styles).toContain(".markdown-editor-panel .milkdown .milkdown-table-block");
    expect(styles).toContain(".markdown-editor-panel .milkdown .milkdown-code-block");
    expect(color).toContain("function hexToRgb");
    expect(barrel).not.toContain("DEFAULT_EDITOR_THEME: EditorTheme");
    expect(barrel).not.toContain("function normalizeEditorTheme");
    expect(barrel).not.toContain("function themeToCssVariables");
    expect(barrel).not.toContain("function hexToRgb");
  });

  it("keeps file workflow logic outside the MermaidEditor composition file", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");

    expect(editor).toContain("useEditorFileWorkflow");
    expect(editor).not.toContain("function buildStoredEditorDraft(");
    expect(editor).not.toContain("function persistStoredEditorDraft(");
    expect(editor).not.toContain("function applyLoadedDocument(");
    expect(editor).not.toContain("function applyStoredEditorState(");
    expect(editor).not.toContain("function openRuntimeFileRequest(");
    expect(editor).not.toContain("function updateBrowserFileDragFeedback(");
    expect(editor).not.toContain("function handleRuntimeFileDropRequest(");
    expect(editor).not.toContain("function saveMermaidFile(");
    expect(editor).not.toContain("function saveMermaidFileAsResult(");
  });

  it("keeps file workflow implementation behind focused workflow modules", () => {
    const workflow = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow.ts");
    const open = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-file-open-workflow.ts");
    const save = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-file-save-workflow.ts");
    const drop = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-file-drop-workflow.ts");
    const image = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-image-import-workflow.ts");
    const project = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-project-workspace-workflow.ts");
    const unsaved = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/file-workflow/use-unsaved-file-switch.ts");

    expect(workflow).toContain("useFileOpenWorkflow");
    expect(workflow).toContain("useFileSaveWorkflow");
    expect(workflow).toContain("useFileDropWorkflow");
    expect(workflow).toContain("useProjectWorkspaceWorkflow");
    expect(workflow).toContain("useUnsavedFileSwitch");
    expect(open).toContain("export function useFileOpenWorkflow");
    expect(save).toContain("export function useFileSaveWorkflow");
    expect(drop).toContain("export function useFileDropWorkflow");
    expect(image).toContain("export function useImageImportWorkflow");
    expect(project).toContain("export function useProjectWorkspaceWorkflow");
    expect(unsaved).toContain("export function useUnsavedFileSwitch");
    expect(workflow).not.toContain("function openRuntimeFileRequest(");
    expect(workflow).not.toContain("function handleBrowserFileDrop(");
    expect(workflow).not.toContain("function saveMermaidFile(");
    expect(workflow).not.toContain("function syncWorkspaceForOpenedFile(");
  });

  it("keeps MermaidEditor shell helpers and side effects in focused modules", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");
    const keyboard = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-keyboard-shortcuts.ts");
    const autosave = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-draft-autosave.ts");

    expect(editor).toContain("useEditorKeyboardShortcuts");
    expect(editor).toContain("useEditorDraftAutosave");
    expect(keyboard).toContain("window.addEventListener(\"keydown\"");
    expect(keyboard).toContain("shouldCreateGroupFromShortcut");
    expect(autosave).toContain("persistStoredEditorDraft");
    expect(autosave).toContain("incrementPerformanceCounter(\"local-storage-write\")");
    expect(editor).not.toContain("shouldCreateGroupFromShortcut");
    expect(editor).not.toContain("storageWriteTimerRef");
    expect(editor).not.toContain("runtime.saveDraft({");
    expect(editor).not.toContain("function loadImageDimensions(");
    expect(editor).not.toContain("function diagramTypeLabel(");
  });

  it("keeps MermaidEditor state models and command actions in focused hooks", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");
    const actions = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-command-actions.ts");
    const clipboardImagePaste = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-clipboard-image-paste.ts");
    const documentModel = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-document-model.ts");
    const themeModel = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-theme-model.ts");
    const overlayState = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-overlay-state.ts");
    const panelActions = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-workspace-panel-actions.ts");

    expect(editor).toContain("useEditorDocumentModel");
    expect(editor).toContain("useEditorCommandActions");
    expect(editor).toContain("useEditorThemeModel");
    expect(editor).toContain("useEditorOverlayState");
    expect(editor).toContain("useEditorWorkspacePanelActions");
    expect(actions).toContain("useEditorDocumentCommands");
    expect(actions).toContain("useEditorClipboardActions");
    expect(actions).toContain("useEditorClipboardImagePaste");
    expect(clipboardImagePaste).toContain("pasteClipboardImageNode");
    expect(documentModel).toContain("currentDocument");
    expect(themeModel).toContain("useResolvedEditorMotion");
    expect(overlayState).not.toContain("browserDomOverlayActive");
    expect(panelActions).toContain("openWorkspacePanel");
    expect(editor).not.toContain("function addImageNode(");
    expect(editor).not.toContain("function updateViewport(");
    expect(editor).not.toContain("function updateFileMenuOpen(");
    expect(editor).not.toContain("const [documentKind, setDocumentKind]");
    expect(actions).not.toContain("runtime.importImageAssetFile");
  });

  it("keeps document lifecycle and draft persistence outside the file workflow shell", () => {
    const workflow = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow.ts");

    expect(workflow).toContain("useEditorDocumentLifecycle");
    expect(workflow).toContain("useEditorDraftPersistence");
    expect(workflow).not.toContain("function buildStoredEditorDraft(");
    expect(workflow).not.toContain("function applyLoadedDocument(");
    expect(workflow).not.toContain("function applyStoredEditorState(");
    expect(workflow).not.toContain("async function newMermaidFile(");
    expect(workflow).not.toContain("async function newMarkdownFile(");
    expect(workflow).not.toContain("async function newCanvasFile(");
  });

  it("keeps document command logic outside the MermaidEditor composition file", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");
    const actions = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-command-actions.ts");

    expect(editor).toContain("useEditorCommandActions");
    expect(actions).toContain("useEditorDocumentCommands");
    expect(editor).not.toContain("function updateSelection(");
    expect(editor).not.toContain("function applyEditorCommand(");
    expect(editor).not.toContain("function restoreSnapshot(");
    expect(editor).not.toContain("function applyAutoLayoutIfNeeded(");
    expect(editor).not.toContain("function commitGraph(");
    expect(editor).not.toContain("function draftGraph(");
    expect(editor).not.toContain("function captureHistory(");
    expect(editor).not.toContain("function applySource(");
    expect(editor).not.toContain("function applyMarkdownSource(");
    expect(editor).not.toContain("function applyCanvasDocument(");
    expect(editor).not.toContain("function syncCanvasFromAutoLayout(");
  });

  it("keeps Agent, desktop, and clipboard controllers outside the MermaidEditor composition file", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");
    const actions = readProjectFile("src/features/mermaid-editor/components/mermaid-editor/use-editor-command-actions.ts");

    expect(editor).toContain("useAgentSession");
    expect(editor).toContain("useEditorAgentDocuments");
    expect(editor).toContain("useEditorDesktopEvents");
    expect(actions).toContain("useEditorClipboardActions");
    expect(editor).not.toContain("function editorCommandDiagnostic(");
    expect(editor).not.toContain("pollAiCommand");
    expect(editor).not.toContain("finishAiCommand");
    expect(editor).not.toContain("listenForExternalFileOpen");
    expect(editor).not.toContain("listenForFileDrops");
    expect(editor).not.toContain("listenForDesktopWindowCloseRequest");
    expect(editor).not.toContain("function readSystemClipboardText(");
    expect(editor).not.toContain("extractNodeActionsFromClipboardText");
  });

  it("keeps newly oversized frontend files out of the codebase", () => {
    const knownLargeFiles = new Set([
      "src/features/mermaid-editor/components/mermaid-editor.tsx",
      "src/features/mermaid-editor/components/canvas-document-editor.tsx"
    ]);
    const frontendFiles = projectFilesUnder("src/features/mermaid-editor", /\.[tj]sx?$/);

    for (const file of frontendFiles) {
      const lines = lineCount(readProjectFile(file));
      if (lines <= 1500) continue;
      expect(knownLargeFiles.has(file), `${file} has ${lines} lines`).toBe(true);
    }
  });
});
