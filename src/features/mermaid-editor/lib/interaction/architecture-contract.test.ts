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

    expect(canvasDocumentEditor).toContain("Textarea");
    expect(canvasDocumentEditor).toContain("Input");
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
      { path: "src/features/mermaid-editor/components/mermaid-editor.tsx", maxLines: 2800 },
      { path: "src/features/mermaid-editor/components/konva-canvas.tsx", maxLines: 1800 },
      { path: "src/features/mermaid-editor/components/canvas-document-editor.tsx", maxLines: 1300 },
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
    expect(editor).not.toContain("function loadInitialState(");
    expect(editor).not.toContain("function buildFallbackCleanDocument(");
    expect(editor).not.toContain("function createEmptyDocumentGraph(");
    expect(editor).not.toContain("function normalizeStoredDocumentKind(");
    expect(editor).not.toContain("const DEFAULT_WORKSPACE_PANEL_STACK");
    expect(editor).not.toContain("const openWorkspacePanelIds");
    expect(editor).not.toContain("function workspacePanelWindowState(");
  });

  it("keeps Konva render helpers outside the KonvaCanvas shell file", () => {
    const canvas = readProjectFile("src/features/mermaid-editor/components/konva-canvas.tsx");

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
    expect(canvas).toContain("useKonvaRenderModel");
    expect(canvas).toContain("useKonvaMotion");
    expect(canvas).toContain("useKonvaViewport");
    expect(canvas).toContain("useKonvaHoverState");
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

  it("keeps newly oversized frontend files out of the codebase", () => {
    const knownLargeFiles = new Set([
      "src/features/mermaid-editor/components/mermaid-editor.tsx",
      "src/features/mermaid-editor/components/konva-canvas.tsx",
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
