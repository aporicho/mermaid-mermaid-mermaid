// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ElectronBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";

function electronBridge(): ElectronBridge {
  return {
    host: "electron",
    openExternalUrl: vi.fn(() => Promise.resolve()),
    startWindowDrag: vi.fn(() => Promise.resolve()),
    toggleWindowMaximize: vi.fn(() => Promise.resolve()),
    runWindowAction: vi.fn(() => Promise.resolve()),
    onDesktopWindowCloseRequest: vi.fn(() => () => undefined),
    readAppState: vi.fn(() => Promise.resolve(null)),
    listSystemFonts: vi.fn(() => Promise.resolve([])),
    writeAppState: vi.fn(() => Promise.resolve()),
    openFile: vi.fn(() => Promise.resolve(null)),
    openFilePath: vi.fn(() => Promise.resolve({ name: "diagram.mmd", path: "/tmp/diagram.mmd", text: "flowchart TD" })),
    saveFile: vi.fn(() => Promise.resolve({ name: "diagram.mmd", path: "/tmp/diagram.mmd" })),
    saveFileAs: vi.fn(() => Promise.resolve({ name: "diagram.mmd", path: "/tmp/diagram.mmd" })),
    createProjectDocument: vi.fn(() => Promise.resolve({
      status: "created" as const,
      file: { name: "notes.md", path: "/tmp/notes.md" },
      text: "# notes\n"
    })),
    createProjectTextFile: vi.fn(() => Promise.resolve({
      status: "created" as const,
      file: { name: "table.csv", path: "/tmp/table.csv" },
      text: "A\r\n"
    })),
    createProjectFile: vi.fn(() => Promise.resolve({
      status: "created" as const,
      file: { name: "notes.md", path: "/tmp/docs/notes.md" },
      text: "# Notes\n"
    })),
    moveProjectFile: vi.fn(() => Promise.resolve({
      status: "moved" as const,
      file: { name: "notes.md", path: "/tmp/archive/notes.md" },
      sourcePath: "/tmp/docs/notes.md"
    })),
    readCsvFile: vi.fn(() => Promise.resolve({
      file: { name: "table.csv", path: "/tmp/table.csv" },
      text: "A\r\n1",
      revision: "abc",
      modifiedAt: 1
    })),
    writeCsvFile: vi.fn(() => Promise.resolve({
      status: "saved" as const,
      file: { name: "table.csv", path: "/tmp/table.csv" },
      revision: "def",
      modifiedAt: 2
    })),
    pickImageAsset: vi.fn(() => Promise.resolve(null)),
    importImageAssetPath: vi.fn(() => Promise.resolve({ src: "assets/demo.png", displaySrc: "mmm-asset://local/?path=%2Ftmp%2Fdemo.png", path: "/tmp/demo.png" })),
    importImageAssetBytes: vi.fn(() => Promise.resolve({ src: "assets/demo.png", displaySrc: "mmm-asset://local/?path=%2Ftmp%2Fdemo.png", path: "/tmp/demo.png" })),
    resolveImageAssetSrc: vi.fn((_documentPath, src) => Promise.resolve(src)),
    resolveLinkPreview: vi.fn(() => Promise.resolve({ status: "unsupported" as const, message: "unsupported" })),
    takePendingOpenFiles: vi.fn(() => Promise.resolve([])),
    onExternalFileOpen: vi.fn(() => () => undefined),
    onFileDrops: vi.fn(() => () => undefined),
    publishAiContext: vi.fn(() => Promise.resolve()),
    pollAiCommand: vi.fn(() => Promise.resolve({ ok: true, command: null })),
    finishAiCommand: vi.fn(() => Promise.resolve()),
    listTerminalShells: vi.fn(() => Promise.resolve([])),
    openTerminal: vi.fn(() => Promise.resolve({ status: "unsupported" as const, message: "unsupported" })),
    writeTerminal: vi.fn(() => Promise.resolve()),
    resizeTerminal: vi.fn(() => Promise.resolve()),
    closeTerminal: vi.fn(() => Promise.resolve()),
    onTerminalData: vi.fn(() => () => undefined),
    onTerminalExit: vi.fn(() => () => undefined),
    openProjectFolder: vi.fn(() => Promise.resolve(null)),
    readProjectFolder: vi.fn(() => Promise.resolve({ rootName: "tmp", rootPath: "/tmp", files: [], scannedAt: 0 })),
    createEmbeddedBrowser: vi.fn(() => Promise.resolve({ status: "created" as const, label: "browser-test" })),
    closeEmbeddedBrowser: vi.fn(() => Promise.resolve()),
    hideEmbeddedBrowser: vi.fn(() => Promise.resolve()),
    showEmbeddedBrowser: vi.fn(() => Promise.resolve()),
    focusEmbeddedBrowser: vi.fn(() => Promise.resolve()),
    setEmbeddedBrowserRect: vi.fn(() => Promise.resolve()),
    onEmbeddedBrowserError: vi.fn(() => () => undefined),
    openBrowserToolWindow: vi.fn(() => Promise.resolve({ status: "opened" as const }))
  };
}

describe("createEditorRuntime", () => {
  afterEach(() => {
    delete window.mmmElectron;
  });

  it("uses the Electron host when the preload bridge is present", () => {
    window.mmmElectron = electronBridge();

    const runtime = createEditorRuntime();

    expect(runtime.kind).toBe("desktop");
    expect(runtime.host).toBe("electron");
  });

  it("keeps the browser runtime when no desktop bridge is present", () => {
    const runtime = createEditorRuntime();

    expect(runtime.kind).toBe("web");
    expect(runtime.host).toBe("web");
  });

  it("forwards project CSV reads, conflict-safe writes and creation to Electron", async () => {
    const bridge = electronBridge();
    window.mmmElectron = bridge;
    const runtime = createEditorRuntime();
    const file = { name: "table.csv", path: "/tmp/table.csv" };

    await expect(runtime.readCsvFile({ rootPath: "/tmp", file })).resolves.toMatchObject({ status: "opened", snapshot: { revision: "abc" } });
    await expect(runtime.writeCsvFile({ rootPath: "/tmp", file, text: "A\r\n2", expectedRevision: "abc" })).resolves.toMatchObject({ status: "saved", revision: "def" });
    await expect(runtime.createProjectTextFile({ rootPath: "/tmp", fileName: "table.csv", kind: "csv", text: "A\r\n" })).resolves.toMatchObject({ status: "created" });
    expect(bridge.readCsvFile).toHaveBeenCalledWith({ rootPath: "/tmp", path: "/tmp/table.csv" });
    expect(bridge.writeCsvFile).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: "abc" }));
  });

  it("keeps path-only CSV project access unsupported on the web", async () => {
    const runtime = createEditorRuntime();
    const file = { name: "table.csv", path: "/tmp/table.csv" };

    await expect(runtime.readCsvFile({ rootPath: "/tmp", file })).resolves.toMatchObject({ status: "unsupported" });
    await expect(runtime.writeCsvFile({ rootPath: "/tmp", file, text: "A", expectedRevision: "abc" })).resolves.toMatchObject({ status: "unsupported" });
    await expect(runtime.createProjectTextFile({ rootPath: "/tmp", fileName: "table.csv", kind: "csv", text: "A" })).resolves.toMatchObject({ status: "unsupported" });
  });

  it("forwards generic project file creation and movement to Electron", async () => {
    const bridge = electronBridge();
    window.mmmElectron = bridge;
    const runtime = createEditorRuntime();
    const createRequest = { rootPath: "/tmp", directoryPath: "/tmp/docs", fileName: "notes.md", kind: "markdown" as const, text: "# Notes\n" };
    const moveRequest = { rootPath: "/tmp", sourcePath: "/tmp/docs/notes.md", targetDirectoryPath: "/tmp/archive" };

    await expect(runtime.createProjectFile(createRequest)).resolves.toMatchObject({ status: "created" });
    await expect(runtime.moveProjectFile(moveRequest)).resolves.toMatchObject({ status: "moved" });
    expect(bridge.createProjectFile).toHaveBeenCalledWith(createRequest);
    expect(bridge.moveProjectFile).toHaveBeenCalledWith(moveRequest);
  });

  it("keeps generic project file mutation unsupported on the web", async () => {
    const runtime = createEditorRuntime();

    await expect(runtime.createProjectFile({ rootPath: "/tmp", directoryPath: "", fileName: "notes.md", kind: "markdown", text: "" })).resolves.toMatchObject({ status: "unsupported" });
    await expect(runtime.moveProjectFile({ rootPath: "/tmp", sourcePath: "notes.md", targetDirectoryPath: "archive" })).resolves.toMatchObject({ status: "unsupported" });
  });
});
