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
    const viewport = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-viewport.ts");

    expect(canvas).toContain("useKonvaViewport");
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

    expect(canvasDocumentEditor).toContain("dispatchStandardCanvasPointerDown");
    expect(canvasDocumentEditor).toContain("dispatchStandardCanvasPointerMove");
    expect(canvasDocumentEditor).toContain("dispatchStandardCanvasPointerUp");
    expect(canvasDocumentEditor).toContain("createStandardWheelInput");
    expect(canvasDocumentEditor).toContain("resolveInteractionIntent");
    expect(canvasDocumentEditor).toContain("commandFromInteractionIntent");
    expect(canvasDocumentEditor).not.toContain("resolveWheelNavigation");
    expect(canvasDocumentEditor).not.toContain("zoomViewportAtPoint");
  });

  it("keeps canvas document text editing inline instead of prompt-based", () => {
    const canvasDocumentEditor = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor.tsx");
    const inlineEditOverlays = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor/inline-edit-overlays.tsx");

    expect(canvasDocumentEditor).toContain("CanvasDocumentInlineEditOverlays");
    expect(inlineEditOverlays).toContain("Textarea");
    expect(inlineEditOverlays).toContain("Input");
    expect(canvasDocumentEditor).toContain("commitInlineEdit");
    expect(canvasDocumentEditor).toContain("editingItemText");
    expect(canvasDocumentEditor).toContain("editingConnectionText");
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

  it("keeps known oversized files on a no-growth budget", () => {
    const budgets = [
      { path: "src/features/mermaid-editor/components/mermaid-editor.tsx", maxLines: 1000 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows.tsx", maxLines: 180 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-floating-chrome.tsx", maxLines: 320 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-overlays.tsx", maxLines: 120 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-shell-utils.ts", maxLines: 140 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-workspace-surface.tsx", maxLines: 240 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels.tsx", maxLines: 280 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-draft-autosave.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-draft-persistence.ts", maxLines: 250 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-keyboard-shortcuts.ts", maxLines: 260 },
      { path: "src/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow.ts", maxLines: 900 },
      { path: "src/features/mermaid-editor/components/inspector-panel.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/node-sections.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/edge-sections.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/subgraph-sections.tsx", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/inspector-panel/model.ts", maxLines: 500 },
      { path: "src/features/mermaid-editor/components/konva-canvas.tsx", maxLines: 760 },
      { path: "src/features/mermaid-editor/components/konva-canvas/konva-canvas-stage.tsx", maxLines: 380 },
      { path: "src/features/mermaid-editor/components/konva-canvas/types.ts", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/konva-canvas/use-konva-drag-membership.ts", maxLines: 280 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor.tsx", maxLines: 850 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/canvas-document-animation.ts", maxLines: 80 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/image-url-dialog.tsx", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/inline-edit-overlays.tsx", maxLines: 220 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/inline-edit-style.ts", maxLines: 160 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/interaction-context.ts", maxLines: 40 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-image-sources.ts", maxLines: 100 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-keyboard-shortcuts.ts", maxLines: 100 },
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
      { path: "src/features/mermaid-editor/lib/editor-theme/types.ts", maxLines: 340 },
      { path: "src-tauri/src/main.rs", maxLines: 1450 }
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

  it("keeps window and node action logic outside the MermaidEditor composition file", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");

    expect(editor).toContain("useEditorWindowActions");
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
    expect(canvas).toContain("useKonvaRenderModel");
    expect(canvas).toContain("useKonvaMotion");
    expect(canvas).toContain("useKonvaViewport");
    expect(canvas).toContain("useKonvaHoverState");
    expect(canvas).not.toContain("[...scopedSubgraphGeometries]");
    expect(canvas).not.toContain("scopedVisibleEdges.map");
    expect(canvas).not.toContain("scopedRenderedNodes.map");
    expect(canvas).not.toContain("exitingNodes.map");
  });

  it("keeps Konva runtime controllers outside the KonvaCanvas shell file", () => {
    const canvas = readProjectFile("src/features/mermaid-editor/components/konva-canvas.tsx");
    const dragMembership = readProjectFile("src/features/mermaid-editor/components/konva-canvas/use-konva-drag-membership.ts");

    expect(canvas).toContain("useKonvaDragDraft");
    expect(canvas).toContain("useKonvaDragMembership");
    expect(canvas).toContain("useKonvaNodeProximity");
    expect(canvas).toContain("useKonvaInlineEditSession");
    expect(canvas).toContain("useKonvaNodeEditorLayout");
    expect(dragMembership).toContain("moveSelectedNodes");
    expect(dragMembership).toContain("finishDragWithMembership");
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

    expect(canvasDocumentEditor).toContain("useCanvasDocumentImageSources");
    expect(canvasDocumentEditor).toContain("useCanvasDocumentKeyboardShortcuts");
    expect(canvasDocumentEditor).toContain("CanvasDocumentImageUrlDialog");
    expect(canvasDocumentEditor).toContain("CanvasDocumentInlineEditOverlays");
    expect(canvasDocumentEditor).toContain("resolveCanvasDocumentInlineEditStyle");
    expect(keyboard).toContain("window.addEventListener(\"keydown\"");
    expect(canvasDocumentEditor).not.toContain("window.addEventListener(\"keydown\"");
    expect(canvasDocumentEditor).not.toContain("imageUrlDialogOpen ? (");
    expect(canvasDocumentEditor).not.toContain("<Textarea");
    expect(canvasDocumentEditor).not.toContain("<Input");
    expect(canvasDocumentEditor).not.toContain("function inlineEditStyle(");
    expect(canvasDocumentEditor).not.toContain("useLayoutEffect");
    expect(canvasDocumentEditor).not.toContain("const CANVAS_DOCUMENT_INTERACTION_GRAPH");
    expect(canvasDocumentEditor).not.toContain("gsap.to(view.container");
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
    const color = readProjectFile("src/features/mermaid-editor/lib/editor-theme/color.ts");

    expect(barrel).toContain("export * from \"./editor-theme/types\"");
    expect(barrel).toContain("export * from \"./editor-theme/presets\"");
    expect(barrel).toContain("export * from \"./editor-theme/normalize\"");
    expect(barrel).toContain("export * from \"./editor-theme/compile\"");
    expect(presets).toContain("DEFAULT_EDITOR_THEME");
    expect(normalize).toContain("normalizeEditorTheme");
    expect(compile).toContain("themeToCssVariables");
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

    expect(editor).toContain("useEditorDocumentCommands");
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

  it("keeps AI, desktop, and clipboard controllers outside the MermaidEditor composition file", () => {
    const editor = readProjectFile("src/features/mermaid-editor/components/mermaid-editor.tsx");

    expect(editor).toContain("useEditorAiCommands");
    expect(editor).toContain("useEditorDesktopEvents");
    expect(editor).toContain("useEditorClipboardActions");
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
