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
    writeAppState: vi.fn(() => Promise.resolve()),
    openFile: vi.fn(() => Promise.resolve(null)),
    openFilePath: vi.fn(() => Promise.resolve({ name: "diagram.mmd", path: "/tmp/diagram.mmd", text: "flowchart TD" })),
    saveFile: vi.fn(() => Promise.resolve({ name: "diagram.mmd", path: "/tmp/diagram.mmd" })),
    saveFileAs: vi.fn(() => Promise.resolve({ name: "diagram.mmd", path: "/tmp/diagram.mmd" })),
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
});
