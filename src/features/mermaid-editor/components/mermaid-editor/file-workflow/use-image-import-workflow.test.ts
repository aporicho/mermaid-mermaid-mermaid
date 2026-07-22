import { describe, expect, it, vi } from "vitest";

import { createBlankCanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import type {
  EditorRuntime,
  RuntimeFileOpenRequest,
  RuntimeImageAssetResult
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";

import type { BrowserDroppedFile } from "../use-editor-drop-import";
import { useImageImportWorkflow } from "./use-image-import-workflow";
import type { UseEditorFileWorkflowArgs } from "./types";

describe("useImageImportWorkflow", () => {
  it("imports dropped image paths in order and adds them in one graph command", async () => {
    const harness = createHarness();
    const workflow = useImageImportWorkflow(harness.args, harness.dependencies);

    await workflow.importImageAssetRequests(imageRequests("one.png", "two.jpg", "three.webp"), {
      x: 320,
      y: 240
    });

    expect(harness.importImageAssetPath.mock.calls.map((call) => call[1])).toEqual([
      "/images/one.png",
      "/images/two.jpg",
      "/images/three.webp"
    ]);
    expect(harness.saveMermaidFileAsResult).not.toHaveBeenCalled();
    expect(harness.applyEditorCommand).toHaveBeenCalledTimes(1);
    expect(harness.applyEditorCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "graph.addNodesAt",
      source: "api",
      message: "已复制并添加 3 张图片节点。",
      nodes: [
        expect.objectContaining({ point: { x: 4, y: 14 }, label: "one" }),
        expect.objectContaining({ point: { x: 196, y: 14 }, label: "two" }),
        expect.objectContaining({ point: { x: 100, y: 166 }, label: "three" })
      ]
    }));
    const command = harness.applyEditorCommand.mock.calls[0][0];
    expect(command.type === "graph.addNodesAt" && command.nodes.map((node) => node.asset?.src)).toEqual([
      "./assets/one.png",
      "./assets/two.jpg",
      "./assets/three.webp"
    ]);
  });

  it("saves an unsaved document only once before importing the batch", async () => {
    const harness = createHarness({ fileRef: null });
    harness.saveMermaidFileAsResult.mockResolvedValue({ name: "saved.mmd", path: "/project/saved.mmd" });
    const workflow = useImageImportWorkflow(harness.args, harness.dependencies);

    await workflow.importImageAssetRequests(imageRequests("one.png", "two.png", "three.png"));

    expect(harness.saveMermaidFileAsResult).toHaveBeenCalledTimes(1);
    expect(harness.importImageAssetPath.mock.calls.map((call) => call[0])).toEqual([
      { name: "saved.mmd", path: "/project/saved.mmd" },
      { name: "saved.mmd", path: "/project/saved.mmd" },
      { name: "saved.mmd", path: "/project/saved.mmd" }
    ]);
    expect(harness.applyEditorCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps successful images and reports partial failures once", async () => {
    const harness = createHarness({
      importResult: (path) => path.includes("broken")
        ? { status: "unsupported", message: "broken" }
        : readyAsset(path)
    });
    const workflow = useImageImportWorkflow(harness.args, harness.dependencies);

    await workflow.importImageAssetRequests(imageRequests("one.png", "broken.png", "three.png"));

    expect(harness.applyEditorCommand).toHaveBeenCalledTimes(1);
    expect(harness.applyEditorCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "graph.addNodesAt",
      message: "已复制并添加 2 张图片节点，1 张导入失败。"
    }));
    const command = harness.applyEditorCommand.mock.calls[0][0];
    expect(command.type === "graph.addNodesAt" && command.nodes.map((node) => node.label)).toEqual([
      "one",
      "three"
    ]);
    expect(harness.showFileWorkflowError).not.toHaveBeenCalled();
  });

  it("reports one aggregate error and does not mutate the graph when every import fails", async () => {
    const harness = createHarness({
      importResult: () => ({ status: "unsupported", message: "broken" })
    });
    const workflow = useImageImportWorkflow(harness.args, harness.dependencies);

    await workflow.importImageAssetRequests(imageRequests("one.png", "two.png"));

    expect(harness.applyEditorCommand).not.toHaveBeenCalled();
    expect(harness.showFileWorkflowError).toHaveBeenCalledTimes(1);
    expect(harness.showFileWorkflowError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "2 张图片导入失败：one、two。" }),
      "导入图片失败。"
    );
  });

  it("adds every image to a Canvas document in one document apply", async () => {
    const canvasDocument = createBlankCanvasDocument();
    const harness = createHarness({ documentKind: "canvas", canvasDocument, isCanvasEditable: false });
    const workflow = useImageImportWorkflow(harness.args, harness.dependencies);

    await workflow.importImageAssetRequests(imageRequests("one.png", "two.png", "three.png"), {
      x: 320,
      y: 240
    });

    expect(harness.applyEditorCommand).not.toHaveBeenCalled();
    expect(harness.applyCanvasDocument).toHaveBeenCalledTimes(1);
    const [nextDocument, message] = harness.applyCanvasDocument.mock.calls[0];
    const images = nextDocument.elements.filter((element) => element.type === "image");
    expect(images).toEqual([
      expect.objectContaining({ id: "C3", x: -76, y: -46, src: "./assets/one.png" }),
      expect.objectContaining({ id: "C4", x: 116, y: -46, src: "./assets/two.png" }),
      expect.objectContaining({ id: "C5", x: 20, y: 106, src: "./assets/three.png" })
    ]);
    expect(message).toBe("已复制并添加 3 张图片。");
  });

  it("imports every browser File when desktop paths are unavailable", async () => {
    const harness = createHarness();
    const workflow = useImageImportWorkflow(harness.args, harness.dependencies);
    const files = ["one.png", "two.jpg"].map((name) => ({
      name,
      file: { name } as File
    })) satisfies BrowserDroppedFile[];

    await workflow.importBrowserDroppedImageAssets(files);

    expect(harness.importImageAssetPath).not.toHaveBeenCalled();
    expect(harness.importImageAssetFile.mock.calls.map((call) => call[1])).toEqual(files.map((file) => file.file));
    expect(harness.applyEditorCommand).toHaveBeenCalledTimes(1);
  });
});

function createHarness(options: {
  fileRef?: UseEditorFileWorkflowArgs["fileRef"];
  documentKind?: UseEditorFileWorkflowArgs["documentKind"];
  canvasDocument?: UseEditorFileWorkflowArgs["canvasDocument"];
  isCanvasEditable?: boolean;
  importResult?: (path: string) => RuntimeImageAssetResult;
} = {}) {
  const importResult = options.importResult ?? readyAsset;
  const importImageAssetPath = vi.fn(async (_file, path: string) => importResult(path));
  const importImageAssetFile = vi.fn(async (_file, file: File) => importResult(file.name));
  const applyEditorCommand = vi.fn<(command: EditorCommand) => void>();
  const applyCanvasDocument = vi.fn<UseEditorFileWorkflowArgs["applyCanvasDocument"]>();
  const saveMermaidFileAsResult = vi.fn(async () => null as UseEditorFileWorkflowArgs["fileRef"]);
  const showFileWorkflowError = vi.fn();
  const canvasDocument = options.canvasDocument ?? createBlankCanvasDocument();
  const runtime = {
    importImageAssetPath,
    importImageAssetFile
  } as unknown as EditorRuntime;
  const args = {
    runtime,
    workspaceSurfaceRef: {
      current: {
        getBoundingClientRect: () => ({ left: 100, top: 50 })
      }
    },
    documentKind: options.documentKind ?? "mermaid",
    canvasDocument,
    viewport: { x: 20, y: 10, scale: 2 },
    workspaceView: "canvas",
    fileRef: options.fileRef === undefined
      ? { name: "diagram.mmd", path: "/project/diagram.mmd" }
      : options.fileRef,
    canvasLiveState: { canvasSize: { width: 840, height: 520 } },
    isCanvasEditable: options.isCanvasEditable ?? true,
    setStatus: vi.fn(),
    applyCanvasDocument,
    applyEditorCommand
  } as unknown as UseEditorFileWorkflowArgs;

  return {
    args,
    dependencies: { saveMermaidFileAsResult, showFileWorkflowError },
    importImageAssetPath,
    importImageAssetFile,
    saveMermaidFileAsResult,
    showFileWorkflowError,
    applyEditorCommand,
    applyCanvasDocument
  };
}

function imageRequests(...names: string[]): RuntimeFileOpenRequest[] {
  return names.map((name) => ({ name, path: `/images/${name}` }));
}

function readyAsset(path: string): RuntimeImageAssetResult {
  const name = path.split("/").pop();
  return {
    status: "ready",
    src: `./assets/${name}`,
    displaySrc: path,
    copied: true
  };
}
