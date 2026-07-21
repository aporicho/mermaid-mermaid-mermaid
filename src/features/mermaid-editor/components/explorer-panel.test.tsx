// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ExplorerPanel } from "@/features/mermaid-editor/components/explorer-panel";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

const markdownFile: ProjectFileEntry = {
  name: "note.md",
  path: "/project/docs/note.md",
  relativePath: "docs/note.md"
};

const workspace: ProjectWorkspace = {
  rootName: "project",
  rootPath: "/project",
  files: [markdownFile],
  resources: [
    { kind: "directory", name: "docs", path: "/project/docs", relativePath: "docs" },
    { kind: "directory", name: "empty", path: "/project/empty", relativePath: "empty" },
    { kind: "file", name: "note.md", path: "/project/docs/note.md", relativePath: "docs/note.md", documentKind: "markdown" },
    { kind: "file", name: "cover.png", path: "/project/docs/cover.png", relativePath: "docs/cover.png" },
    { kind: "file", name: "README.txt", path: "/project/README.txt", relativePath: "README.txt" }
  ],
  scannedAt: 1
};

describe("ExplorerPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders a rooted full resource tree and keeps unsupported files read-only", () => {
    const onStatus = vi.fn();
    const onOpenProjectFile = vi.fn();
    renderExplorer({ onStatus, onOpenProjectFile });

    expect(container.querySelector('[role="tree"]')?.getAttribute("aria-label")).toContain("project");
    expect(buttonNamed("project")?.getAttribute("aria-level")).toBe("1");
    expect(buttonNamed("project")?.textContent).toBe("project");
    expect(buttonNamed("docs")?.getAttribute("aria-expanded")).toBe("true");
    expect(buttonNamed("docs")?.textContent).toBe("docs");
    expect(buttonNamed("empty")).not.toBeNull();
    expect(buttonNamed("cover.png")?.dataset.resourceSupported).toBe("false");

    act(() => buttonNamed("cover.png")?.click());
    expect(onStatus).toHaveBeenCalledWith("暂不支持打开 cover.png。");
    expect(onOpenProjectFile).not.toHaveBeenCalled();

    act(() => buttonNamed("note.md")?.click());
    expect(onOpenProjectFile).toHaveBeenCalledWith(markdownFile);
  });

  it("supports roving keyboard focus and automatically reveals the active file", async () => {
    renderExplorer({ currentFileRef: { name: "note.md", path: markdownFile.path }, initialExpandedPaths: [] });
    await act(async () => Promise.resolve());

    expect(buttonNamed("docs")?.getAttribute("aria-expanded")).toBe("true");
    const rootItem = buttonNamed("project");
    act(() => {
      rootItem?.focus();
      rootItem?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(document.activeElement).toBe(buttonNamed("docs"));
  });

  function renderExplorer({
    onStatus = vi.fn(),
    onOpenProjectFile = vi.fn(),
    currentFileRef = null,
    initialExpandedPaths = ["docs"]
  }: {
    onStatus?: (message: string) => void;
    onOpenProjectFile?: (file: ProjectFileEntry) => void;
    currentFileRef?: { name: string; path: string } | null;
    initialExpandedPaths?: string[];
  } = {}) {
    function Harness() {
      const [treeState, setTreeState] = useState<ExplorerWorkspaceTreeState>({
        rootPath: workspace.rootPath,
        rootExpanded: true,
        expandedDirectoryPaths: initialExpandedPaths,
        updatedAt: 1
      });
      return (
        <TooltipProvider delayDuration={0}>
          <ExplorerPanel
            runtimeKind="desktop"
            projectWorkspace={workspace}
            projectFiles={workspace.files}
            currentFileRef={currentFileRef}
            projectBusy={false}
            treeState={treeState}
            onTreeStateChange={(state) => setTreeState((current) => ({ ...current, ...state }))}
            onOpenProject={vi.fn()}
            onRefreshProject={vi.fn()}
            onCloseProject={vi.fn()}
            onOpenProjectFile={onOpenProjectFile}
            onOpenProjectMarkdownWindow={vi.fn()}
            onMarkdownDocumentPointerDrag={vi.fn()}
            onStatus={onStatus}
            windowState="normal"
            onWindowStateChange={vi.fn()}
            onCollapse={vi.fn()}
          />
        </TooltipProvider>
      );
    }
    act(() => root.render(<Harness />));
  }

  function buttonNamed(label: string) {
    return [...container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]')]
      .find((button) => button.textContent?.includes(label)) ?? null;
  }
});
