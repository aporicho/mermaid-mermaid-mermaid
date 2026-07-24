// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMarkdownFoldPersistence } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-fold-persistence";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

const rootPath = "/project";
const sourceFile = { name: "notes.md", path: `${rootPath}/notes.md` };
const savedSnapshot: MarkdownFoldSnapshot = {
  version: 1,
  documentFingerprint: "saved",
  folds: [{ kind: "heading", outline: [{ level: 1, label: "Notes", occurrence: 0 }] }]
};
const changedSnapshot: MarkdownFoldSnapshot = {
  version: 1,
  documentFingerprint: "changed",
  folds: [{ kind: "heading", outline: [{ level: 1, label: "Changed", occurrence: 0 }] }]
};

type HookResult = ReturnType<typeof useMarkdownFoldPersistence>;

describe("useMarkdownFoldPersistence", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: HookResult | null;
  let runtime: EditorRuntime;
  let workspace: ProjectWorkspace;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    runtime = {
      host: "electron",
      readMarkdownFoldState: vi.fn(() => Promise.resolve({ status: "loaded" as const, snapshot: savedSnapshot })),
      writeMarkdownFoldState: vi.fn(() => Promise.resolve({ status: "saved" as const })),
      moveMarkdownFoldState: vi.fn(() => Promise.resolve({ status: "moved" as const }))
    } as unknown as EditorRuntime;
    workspace = { rootName: "project", rootPath, files: [], scannedAt: 1 };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function render(files: RuntimeFileRef[] = [sourceFile]) {
    function Harness() {
      latest = useMarkdownFoldPersistence({ runtime, projectWorkspace: workspace, files, onStatus: vi.fn() });
      return null;
    }

    act(() => root.render(createElement(Harness)));
  }

  async function finishLoad() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("loads a saved snapshot and coalesces rapid editor updates", async () => {
    render();
    await finishLoad();

    expect(latest?.bindingFor(sourceFile).foldState).toEqual(savedSnapshot);
    act(() => {
      latest?.bindingFor(sourceFile).onFoldStateChange?.(savedSnapshot);
      latest?.bindingFor(sourceFile).onFoldStateChange?.(changedSnapshot);
      vi.advanceTimersByTime(299);
    });
    expect(runtime.writeMarkdownFoldState).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(runtime.writeMarkdownFoldState).toHaveBeenCalledTimes(1);
    expect(runtime.writeMarkdownFoldState).toHaveBeenCalledWith({
      rootPath,
      documentPath: sourceFile.path,
      snapshot: changedSnapshot
    });
  });

  it("keeps a local fold change when an older async read finishes later", async () => {
    let resolveRead: ((value: { status: "loaded"; snapshot: MarkdownFoldSnapshot }) => void) | undefined;
    vi.mocked(runtime.readMarkdownFoldState).mockImplementationOnce(() => new Promise((resolve) => {
      resolveRead = resolve;
    }));
    render();
    expect(latest?.bindingFor(sourceFile).foldState).toBeUndefined();

    act(() => latest?.bindingFor(sourceFile).onFoldStateChange?.(changedSnapshot));
    await act(async () => {
      resolveRead?.({ status: "loaded", snapshot: savedSnapshot });
      await Promise.resolve();
    });

    expect(latest?.bindingFor(sourceFile).foldState).toEqual(changedSnapshot);
    await act(async () => {
      await latest?.flushMarkdownFoldWrites();
    });
  });

  it("flushes pending state before migrating a moved Markdown file", async () => {
    render();
    await finishLoad();
    const targetPath = `${rootPath}/archive/notes.md`;
    act(() => latest?.bindingFor(sourceFile).onFoldStateChange?.(changedSnapshot));

    await act(async () => {
      await latest?.migrateMarkdownFoldState(sourceFile.path!, targetPath);
    });

    expect(runtime.writeMarkdownFoldState).toHaveBeenCalledWith({
      rootPath,
      documentPath: sourceFile.path,
      snapshot: changedSnapshot
    });
    expect(runtime.moveMarkdownFoldState).toHaveBeenCalledWith({ rootPath, sourcePath: sourceFile.path, targetPath });
    expect(vi.mocked(runtime.writeMarkdownFoldState).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(runtime.moveMarkdownFoldState).mock.invocationCallOrder[0]!);
    expect(latest?.bindingFor({ name: "notes.md", path: targetPath }).foldState).toEqual(changedSnapshot);
  });

  it("does not expose project persistence for unsaved or non-Electron documents", async () => {
    render([{ name: "untitled.md" }]);
    await finishLoad();
    expect(latest?.bindingFor({ name: "untitled.md" })).toEqual({ foldState: null });
    expect(runtime.readMarkdownFoldState).not.toHaveBeenCalled();

    act(() => root.unmount());
    root = createRoot(container);
    runtime = { ...runtime, host: "web" };
    render();
    await finishLoad();
    expect(latest?.bindingFor(sourceFile)).toEqual({ foldState: null });
    expect(runtime.readMarkdownFoldState).not.toHaveBeenCalled();
  });
});
