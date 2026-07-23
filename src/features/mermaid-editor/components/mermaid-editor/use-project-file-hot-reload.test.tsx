// @vitest-environment jsdom

import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectFileHotReload } from "@/features/mermaid-editor/components/mermaid-editor/use-project-file-hot-reload";
import type { FileOpenSource } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import type { EditorRuntime, RuntimeFileRef, RuntimeProjectFileChangeBatch } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DetachedHtmlWindow, DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

const workspace = {
  rootName: "project",
  rootPath: "/project",
  files: [],
  resources: [],
  scannedAt: 1
};

describe("useProjectFileHotReload", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChanges: ((batch: RuntimeProjectFileChangeBatch) => void) | undefined;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onChanges = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("replaces dirty document and detached Markdown state with the latest disk versions", async () => {
    const applyLoadedDocument = vi.fn<(text: string, name: string, file: RuntimeFileRef | null, source?: FileOpenSource) => void>();
    const discardLinkedFileWrites = vi.fn(async () => undefined);
    const updateMarkdownPreviewFromText = vi.fn();
    const runtime = createRuntime(async (path) => ({
      status: "opened" as const,
      file: { name: path.endsWith("floating.md") ? "floating.md" : "notes.md", path },
      text: path.endsWith("floating.md") ? "# Floating disk" : "# Current disk"
    }));

    await act(async () => {
      root.render(<Probe
        runtime={runtime}
        currentDocument="# Unsaved local"
        applyLoadedDocument={applyLoadedDocument}
        discardLinkedFileWrites={discardLinkedFileWrites}
        updateMarkdownPreviewFromText={updateMarkdownPreviewFromText}
      />);
      await settle();
    });

    await act(async () => {
      onChanges?.({
        rootPath: "/project",
        observedAt: 2,
        changes: [
          { directory: false, kind: "changed", path: "/project/notes.md" },
          { directory: false, kind: "changed", path: "/project/floating.md" },
          { directory: false, kind: "changed", path: "/project/index.html" }
        ]
      });
      await settle();
    });

    expect(discardLinkedFileWrites).toHaveBeenCalledTimes(1);
    expect(applyLoadedDocument).toHaveBeenCalledWith("# Current disk", "notes.md", { name: "notes.md", path: "/project/notes.md" }, "watch");
    expect(updateMarkdownPreviewFromText).toHaveBeenCalledWith("/project/notes.md", "# Current disk");
    expect(updateMarkdownPreviewFromText).toHaveBeenCalledWith("/project/floating.md", "# Floating disk");
    expect(container.querySelector("[data-window-value]")?.getAttribute("data-window-value")).toBe("# Floating disk");
    expect(container.querySelector("[data-html-revision]")?.getAttribute("data-html-revision")).toBe("1");
    expect(runtime.setProjectFileWatchTargets).toHaveBeenCalledWith(expect.objectContaining({
      rootPath: "/project",
      extraPaths: expect.arrayContaining(["/project/notes.md", "/project/floating.md", "/project/index.html"])
    }));
  });

  it("marks removed files missing and routes CSV/image changes to their consumers", async () => {
    const markMarkdownPreviewMissing = vi.fn();
    const reloadExternalCsvFiles = vi.fn(async () => undefined);
    const refreshImageAssets = vi.fn();
    const runtime = createRuntime(async () => ({ status: "cancelled" as const }));

    await act(async () => {
      root.render(<Probe
        runtime={runtime}
        currentDocument="# Current"
        markMarkdownPreviewMissing={markMarkdownPreviewMissing}
        reloadExternalCsvFiles={reloadExternalCsvFiles}
        refreshImageAssets={refreshImageAssets}
      />);
      await settle();
    });

    await act(async () => {
      onChanges?.({
        rootPath: "/project",
        observedAt: 3,
        changes: [
          { directory: false, kind: "removed", path: "/project/notes.md" },
          { directory: false, kind: "removed", path: "/project/floating.md" },
          { directory: false, kind: "changed", path: "/project/table.csv" },
          { directory: false, kind: "changed", path: "/project/image.png" }
        ]
      });
      await settle();
    });

    expect(markMarkdownPreviewMissing).toHaveBeenCalledWith("/project/notes.md");
    expect(markMarkdownPreviewMissing).toHaveBeenCalledWith("/project/floating.md");
    expect(reloadExternalCsvFiles).toHaveBeenCalledWith(new Set(["/project/table.csv"]));
    expect(refreshImageAssets).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-current-path]")?.getAttribute("data-current-path")).toBe("");
    expect(container.querySelector("[data-window-missing]")?.getAttribute("data-window-missing")).toBe("true");
  });

  function createRuntime(openFilePath: EditorRuntime["openFilePath"]) {
    return {
      kind: "desktop",
      openFilePath: vi.fn(openFilePath),
      setProjectFileWatchTargets: vi.fn(async () => undefined),
      listenForProjectFileChanges: vi.fn(async (handler: (batch: RuntimeProjectFileChangeBatch) => void) => {
        onChanges = handler;
        return () => undefined;
      })
    } as unknown as EditorRuntime;
  }
});

function Probe({
  runtime,
  currentDocument,
  applyLoadedDocument = vi.fn<(text: string, name: string, file: RuntimeFileRef | null, source?: FileOpenSource) => void>(),
  discardLinkedFileWrites = vi.fn(async () => undefined),
  updateMarkdownPreviewFromText = vi.fn(),
  markMarkdownPreviewMissing = vi.fn(),
  reloadExternalCsvFiles = vi.fn(async () => undefined),
  refreshImageAssets = vi.fn()
}: {
  runtime: EditorRuntime;
  currentDocument: string;
  applyLoadedDocument?: (text: string, name: string, file: RuntimeFileRef | null, source?: FileOpenSource) => void;
  discardLinkedFileWrites?: () => Promise<void>;
  updateMarkdownPreviewFromText?: (path: string, text: string) => void;
  markMarkdownPreviewMissing?: (path: string) => void;
  reloadExternalCsvFiles?: (paths: ReadonlySet<string> | readonly string[]) => Promise<void>;
  refreshImageAssets?: () => void;
}) {
  const [fileRef, setFileRef] = useState<RuntimeFileRef | null>({ name: "notes.md", path: "/project/notes.md" });
  const [windows, setWindows] = useState<DetachedMarkdownWindow[]>([{
    id: "markdown:/project/floating.md",
    file: { name: "floating.md", path: "/project/floating.md" },
    title: "floating.md",
    value: "# Floating local",
    savedValue: "# Floating old"
  }]);
  const [htmlWindows, setHtmlWindows] = useState<DetachedHtmlWindow[]>([{
    id: "html:/project/index.html",
    file: { name: "index.html", path: "/project/index.html" },
    title: "index.html",
    url: "file:///project/index.html"
  }]);
  const currentDocumentRef = useRef(currentDocument);
  currentDocumentRef.current = currentDocument;
  useProjectFileHotReload({
    runtime,
    projectWorkspace: workspace,
    fileRef,
    currentDocumentRef,
    detachedMarkdownWindows: windows,
    setDetachedMarkdownWindows: setWindows,
    detachedHtmlWindows: htmlWindows,
    setDetachedHtmlWindows: setHtmlWindows,
    setFileRef,
    setStatus: vi.fn(),
    applyLoadedDocument,
    refreshProjectWorkspace: vi.fn(async () => undefined),
    discardLinkedFileWrites,
    reloadExternalCsvFiles,
    updateMarkdownPreviewFromText,
    markMarkdownPreviewMissing,
    refreshImageAssets,
    showFileWorkflowError: vi.fn()
  });

  return <div
    data-current-path={fileRef?.path || ""}
    data-window-value={windows[0]?.value || ""}
    data-window-missing={String(Boolean(windows[0]?.missing))}
    data-html-revision={String(htmlWindows[0]?.revision || 0)}
  />;
}

async function settle() {
  await Promise.resolve();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}
