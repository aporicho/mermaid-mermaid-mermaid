// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ExplorerPanel } from "@/features/mermaid-editor/components/explorer-panel";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type { ProjectFileEntry, ProjectResourceEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

vi.mock("@/features/mermaid-editor/components/floating-chrome", async () => {
  const { createElement } = await import("react");
  return {
    WorkspaceWindowHeader: ({ actions }: { actions?: import("react").ReactNode }) => createElement("header", null, actions)
  };
});

const markdownFile: ProjectFileEntry = {
  name: "note.md",
  path: "/project/docs/note.md",
  relativePath: "docs/note.md"
};

const secondMarkdownFile: ProjectFileEntry = {
  name: "ideas.md",
  path: "/project/ideas.md",
  relativePath: "ideas.md"
};

const htmlFile: ProjectFileEntry = {
  name: "index.html",
  path: "/project/docs/index.html",
  relativePath: "docs/index.html"
};

const imageFile: ProjectFileEntry = {
  name: "cover.png",
  path: "/project/docs/cover.png",
  relativePath: "docs/cover.png"
};

const workspace: ProjectWorkspace = {
  rootName: "project",
  rootPath: "/project",
  files: [markdownFile, secondMarkdownFile],
  resources: [
    { kind: "directory", name: "docs", path: "/project/docs", relativePath: "docs" },
    { kind: "directory", name: "empty", path: "/project/empty", relativePath: "empty" },
    { kind: "file", name: "note.md", path: "/project/docs/note.md", relativePath: "docs/note.md", documentKind: "markdown" },
    { kind: "file", name: "ideas.md", path: "/project/ideas.md", relativePath: "ideas.md", documentKind: "markdown" },
    { kind: "file", name: "index.html", path: "/project/docs/index.html", relativePath: "docs/index.html" },
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
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => null) });
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
    expect(buttonNamed("cover.png")?.dataset.resourceSupported).toBe("true");
    expect(buttonNamed("README.txt")?.dataset.resourceSupported).toBe("false");

    act(() => buttonNamed("README.txt")?.click());
    expect(onStatus).toHaveBeenCalledWith("暂不支持打开 README.txt。");
    expect(onOpenProjectFile).not.toHaveBeenCalled();

    act(() => buttonNamed("note.md")?.click());
    expect(onOpenProjectFile).toHaveBeenCalledWith(markdownFile);
  });

  it("opens image resources in the image viewer from the tree or context menu", () => {
    const onOpenProjectImageWindow = vi.fn();
    renderExplorer({ onOpenProjectImageWindow });

    act(() => buttonNamed("cover.png")?.click());
    expect(onOpenProjectImageWindow).toHaveBeenCalledWith(imageFile);

    act(() => buttonNamed("cover.png")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })));
    const menu = document.body.querySelector('[aria-label="cover.png 操作"]');
    expect([...(menu?.querySelectorAll('[role="menuitem"]') ?? [])].map((item) => item.textContent)).toEqual([
      "在图片查看器中打开",
      "移动到…"
    ]);
    act(() => buttonWithText("在图片查看器中打开")?.click());
    expect(onOpenProjectImageWindow).toHaveBeenCalledTimes(2);
  });

  it("keeps project actions in the titlebar and removes the close-folder action", () => {
    const onOpenProject = vi.fn();
    const onRefreshProject = vi.fn();
    renderExplorer({ onOpenProject, onRefreshProject });

    const header = container.querySelector("header");
    const labels = [...(header?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
      .map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual(["打开文件夹", "新建文件", "刷新文件夹"]);
    expect(container.querySelector('button[aria-label="关闭文件夹"]')).toBeNull();

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="打开文件夹"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="刷新文件夹"]')?.click());
    expect(onOpenProject).toHaveBeenCalledTimes(1);
    expect(onRefreshProject).toHaveBeenCalledTimes(1);
  });

  it("opens HTML resources in their dedicated floating preview and drags them as HTML nodes", () => {
    const onOpenProjectHtmlWindow = vi.fn();
    const onProjectDocumentPointerDrag = vi.fn();
    renderExplorer({ onOpenProjectHtmlWindow, onProjectDocumentPointerDrag });
    const source = buttonNamed("index.html");

    act(() => source?.click());
    expect(onOpenProjectHtmlWindow).toHaveBeenCalledWith(htmlFile);

    vi.mocked(document.elementFromPoint).mockReturnValue(null);
    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0);
      dispatchPointer(source, "pointermove", 12, 0);
      dispatchPointer(source, "pointerup", 18, 0);
    });
    expect(onProjectDocumentPointerDrag).toHaveBeenNthCalledWith(1, htmlFile, "html", { x: 12, y: 0 }, "move");
    expect(onProjectDocumentPointerDrag).toHaveBeenNthCalledWith(2, htmlFile, "html", { x: 18, y: 0 }, "drop");

    act(() => source?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })));
    expect(document.body.querySelector('[aria-label="index.html 操作"]')?.textContent).toContain("在浮窗中预览");
  });

  it("creates typed project files from the titlebar and completes their extensions", () => {
    const onCreateProjectFile = vi.fn();
    renderExplorer({ onCreateProjectFile });

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="新建文件"]')?.click());
    expect(document.body.textContent).toContain("位置：project");

    act(() => buttonWithText("Mermaid")?.click());
    const input = document.body.querySelector<HTMLInputElement>("#explorer-new-file-name");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "flow");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => buttonWithText("新建")?.click());

    expect(onCreateProjectFile).toHaveBeenCalledWith({ directoryPath: "", fileName: "flow.mmd", kind: "mermaid" });
  });

  it("opens file creation for a directory from the tree context menu", () => {
    renderExplorer();

    act(() => buttonNamed("docs")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })));
    expect(document.body.querySelector('[aria-label="docs 操作"]')).not.toBeNull();
    act(() => buttonWithText("新建文件…")?.click());

    expect(document.body.textContent).toContain("位置：project/docs");
  });

  it("uses one compact semantic menu for file actions", () => {
    const onOpenProjectFile = vi.fn();
    const onOpenProjectMarkdownWindow = vi.fn();
    renderExplorer({ onOpenProjectFile, onOpenProjectMarkdownWindow });

    act(() => buttonNamed("note.md")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })));
    const menu = document.body.querySelector('[role="menu"][aria-label="note.md 操作"]');
    expect([...(menu?.querySelectorAll('[role="menuitem"]') ?? [])].map((item) => item.textContent)).toEqual([
      "打开",
      "在浮窗中打开",
      "移动到…"
    ]);
    expect(menu?.querySelectorAll('[role="separator"]')).toHaveLength(1);

    act(() => buttonWithText("打开")?.click());
    expect(onOpenProjectFile).toHaveBeenCalledWith(markdownFile);
    expect(document.body.querySelector('[role="menu"][aria-label="note.md 操作"]')).toBeNull();

    act(() => buttonNamed("note.md")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })));
    act(() => buttonWithText("在浮窗中打开")?.click());
    expect(onOpenProjectMarkdownWindow).toHaveBeenCalledWith(markdownFile);
  });

  it("opens a resource menu from the keyboard and restores tree focus on Escape", async () => {
    renderExplorer();
    const source = buttonNamed("note.md");

    await act(async () => {
      source?.focus();
      source?.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
      await Promise.resolve();
    });

    const menu = document.body.querySelector('[role="menu"][aria-label="note.md 操作"]');
    expect(menu).not.toBeNull();
    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await Promise.resolve();
    });
    expect(document.activeElement?.textContent).toBe("打开");

    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });
    expect(document.body.querySelector('[role="menu"][aria-label="note.md 操作"]')).toBeNull();
    expect(document.activeElement).toBe(source);
  });

  it("moves any resource file through the context menu", () => {
    const onMoveProjectFile = vi.fn();
    renderExplorer({ onMoveProjectFile });

    act(() => buttonNamed("cover.png")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })));
    const fileMenu = document.body.querySelector('[aria-label="cover.png 操作"]');
    expect(fileMenu?.textContent).toContain("移动到…");
    expect(fileMenu?.textContent).toContain("在图片查看器中打开");
    act(() => buttonWithText("移动到…")?.click());

    const destinationList = document.body.querySelector('[aria-label="目标文件夹"]');
    act(() => [...(destinationList?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) => button.textContent?.includes("empty"))?.click());
    act(() => buttonWithText("移动")?.click());
    expect(onMoveProjectFile).toHaveBeenCalledWith(workspace.resources?.find((resource) => resource.name === "cover.png"), "empty");
  });

  it("drags any project file onto a directory and highlights the valid target", () => {
    const onMoveProjectFile = vi.fn();
    renderExplorer({ onMoveProjectFile });
    const source = buttonNamed("cover.png");
    const target = buttonNamed("empty");
    vi.mocked(document.elementFromPoint).mockReturnValue(target);

    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0);
      dispatchPointer(source, "pointermove", 12, 0);
    });
    expect(source?.dataset.projectResourceDragging).toBe("true");
    expect(target?.dataset.projectDropTarget).toBe("true");

    act(() => dispatchPointer(source, "pointerup", 12, 0));
    expect(onMoveProjectFile).toHaveBeenCalledWith(workspace.resources?.find((resource) => resource.name === "cover.png"), "empty");
    expect(target?.hasAttribute("data-project-drop-target")).toBe(false);
  });

  it("moves Markdown to a tree directory but keeps its canvas drag outside the explorer", () => {
    const onMoveProjectFile = vi.fn();
    const onProjectDocumentPointerDrag = vi.fn();
    renderExplorer({ onMoveProjectFile, onProjectDocumentPointerDrag });
    const source = buttonNamed("note.md");
    const rootTarget = buttonNamed("project");
    vi.mocked(document.elementFromPoint).mockReturnValue(rootTarget);

    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0);
      dispatchPointer(source, "pointermove", 12, 0);
      dispatchPointer(source, "pointerup", 12, 0);
    });
    expect(onMoveProjectFile).toHaveBeenCalledWith(workspace.resources?.find((resource) => resource.name === "note.md"), "");
    expect(onProjectDocumentPointerDrag).not.toHaveBeenCalled();

    onMoveProjectFile.mockClear();
    vi.mocked(document.elementFromPoint).mockReturnValue(null);
    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0, 2);
      dispatchPointer(source, "pointermove", 12, 0, 2);
      vi.mocked(document.elementFromPoint).mockReturnValue(rootTarget);
      dispatchPointer(source, "pointermove", 18, 0, 2);
      dispatchPointer(source, "pointerup", 18, 0, 2);
    });
    expect(onProjectDocumentPointerDrag).toHaveBeenNthCalledWith(1, markdownFile, "markdown", { x: 12, y: 0 }, "move");
    expect(onProjectDocumentPointerDrag).toHaveBeenNthCalledWith(2, markdownFile, "markdown", { x: 18, y: 0 }, "cancel");
    expect(onMoveProjectFile).toHaveBeenCalledWith(workspace.resources?.find((resource) => resource.name === "note.md"), "");

    onProjectDocumentPointerDrag.mockClear();
    vi.mocked(document.elementFromPoint).mockReturnValue(null);
    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0, 3);
      dispatchPointer(source, "pointermove", 12, 0, 3);
      dispatchPointer(source, "pointerup", 18, 0, 3);
    });
    expect(onProjectDocumentPointerDrag).toHaveBeenNthCalledWith(1, markdownFile, "markdown", { x: 12, y: 0 }, "move");
    expect(onProjectDocumentPointerDrag).toHaveBeenNthCalledWith(2, markdownFile, "markdown", { x: 18, y: 0 }, "drop");
  });

  it("does nothing when a file is dropped in its current directory", () => {
    const onMoveProjectFile = vi.fn();
    const onProjectDocumentPointerDrag = vi.fn();
    renderExplorer({ onMoveProjectFile, onProjectDocumentPointerDrag });
    const source = buttonNamed("note.md");
    vi.mocked(document.elementFromPoint).mockReturnValue(buttonNamed("docs"));

    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0);
      dispatchPointer(source, "pointermove", 12, 0);
      dispatchPointer(source, "pointerup", 12, 0);
    });
    expect(onMoveProjectFile).not.toHaveBeenCalled();
    expect(onProjectDocumentPointerDrag).not.toHaveBeenCalled();
  });

  it("cleans up a highlighted drop target when the pointer is cancelled", () => {
    const onMoveProjectFile = vi.fn();
    renderExplorer({ onMoveProjectFile });
    const source = buttonNamed("cover.png");
    const target = buttonNamed("empty");
    vi.mocked(document.elementFromPoint).mockReturnValue(target);

    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0);
      dispatchPointer(source, "pointermove", 12, 0);
    });
    expect(target?.dataset.projectDropTarget).toBe("true");
    act(() => dispatchPointer(source, "pointercancel", 12, 0));
    expect(target?.hasAttribute("data-project-drop-target")).toBe(false);
    expect(source?.hasAttribute("data-project-resource-dragging")).toBe(false);
    expect(onMoveProjectFile).not.toHaveBeenCalled();
  });

  it("disables pointer-based file moves while the project is busy", () => {
    const onMoveProjectFile = vi.fn();
    renderExplorer({ onMoveProjectFile, projectBusy: true });
    const source = buttonNamed("cover.png");
    vi.mocked(document.elementFromPoint).mockReturnValue(buttonNamed("empty"));

    act(() => {
      dispatchPointer(source, "pointerdown", 0, 0);
      dispatchPointer(source, "pointermove", 12, 0);
      dispatchPointer(source, "pointerup", 12, 0);
    });
    expect(onMoveProjectFile).not.toHaveBeenCalled();
    expect(source?.hasAttribute("data-project-resource-dragging")).toBe(false);
  });

  it("shows refresh only for an open project and disables titlebar actions while busy", () => {
    renderExplorer({ projectBusy: true });
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="打开文件夹"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="刷新文件夹"]')?.disabled).toBe(true);
    expect(container.querySelector('button[aria-label="刷新文件夹"] svg')?.getAttribute("class")).toContain("animate-spin");

    act(() => root.unmount());
    root = createRoot(container);
    renderExplorer({ projectWorkspace: null });
    expect(container.querySelector('header button[aria-label="打开文件夹"]')).not.toBeNull();
    expect(container.querySelector('header button[aria-label="刷新文件夹"]')).toBeNull();
  });

  it("renders continuous tree items without separate disclosure arrows", () => {
    renderExplorer();

    const tree = container.querySelector('[role="tree"]');
    const rootItem = tree?.querySelector<HTMLElement>(':scope > [data-editor-tree-item][data-tree-root="true"]');
    expect(rootItem).not.toBeNull();
    expect(tree?.querySelector("[data-tree-disclosure]")).toBeNull();

    for (const group of tree?.querySelectorAll<HTMLElement>('[role="group"]') ?? []) {
      expect([...group.children].every((child) => child.hasAttribute("data-editor-tree-item"))).toBe(true);
      expect(group.lastElementChild?.className).toContain("last:before:h");
    }
    expect(buttonNamed("note.md")?.className).toContain("before:-left-[100vw]");
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

  it("does not jump back to the active file when an unrelated directory is toggled", async () => {
    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
    const harness = renderExplorer({ currentFileRef: { name: "note.md", path: markdownFile.path } });
    await act(async () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    act(() => buttonNamed("empty")?.click());
    await act(async () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    harness.setCurrentFileRef({ name: secondMarkdownFile.name, path: secondMarkdownFile.path });
    await act(async () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  function renderExplorer({
    onStatus = vi.fn(),
    onOpenProjectFile = vi.fn(),
    onOpenProject = vi.fn(),
    onRefreshProject = vi.fn(),
    onCreateProjectFile = vi.fn(),
    onMoveProjectFile = vi.fn(),
    onOpenProjectMarkdownWindow = vi.fn(),
    onOpenProjectHtmlWindow = vi.fn(),
    onOpenProjectImageWindow = vi.fn(),
    onProjectDocumentPointerDrag = vi.fn(),
    currentFileRef = null,
    initialExpandedPaths = ["docs"],
    projectBusy = false,
    projectWorkspace = workspace
  }: {
    onStatus?: (message: string) => void;
    onOpenProjectFile?: (file: ProjectFileEntry) => void;
    onOpenProject?: () => void;
    onRefreshProject?: () => void;
    onCreateProjectFile?: (request: { directoryPath: string; fileName: string; kind: "markdown" | "mermaid" | "canvas" | "csv" | "html" }) => void;
    onMoveProjectFile?: (file: ProjectResourceEntry, targetDirectoryPath: string) => void;
    onOpenProjectMarkdownWindow?: (file: ProjectFileEntry) => void;
    onOpenProjectHtmlWindow?: (file: ProjectFileEntry) => void;
    onOpenProjectImageWindow?: (file: ProjectFileEntry) => void;
    onProjectDocumentPointerDrag?: (file: ProjectFileEntry, kind: "markdown" | "html", point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
    currentFileRef?: { name: string; path: string } | null;
    initialExpandedPaths?: string[];
    projectBusy?: boolean;
    projectWorkspace?: ProjectWorkspace | null;
  } = {}) {
    let updateCurrentFileRef: (value: { name: string; path: string } | null) => void = () => undefined;
    function Harness() {
      const [activeFileRef, setActiveFileRef] = useState(currentFileRef);
      updateCurrentFileRef = setActiveFileRef;
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
            projectWorkspace={projectWorkspace}
            projectFiles={projectWorkspace?.files ?? []}
            currentFileRef={activeFileRef}
            projectBusy={projectBusy}
            treeState={treeState}
            onTreeStateChange={(state) => setTreeState((current) => ({ ...current, ...state }))}
            onOpenProject={onOpenProject}
            onRefreshProject={onRefreshProject}
            onOpenProjectFile={onOpenProjectFile}
            onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
            onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
            onOpenProjectImageWindow={onOpenProjectImageWindow}
            onCreateProjectFile={onCreateProjectFile}
            onMoveProjectFile={onMoveProjectFile}
            onProjectDocumentPointerDrag={onProjectDocumentPointerDrag}
            onStatus={onStatus}
          />
        </TooltipProvider>
      );
    }
    act(() => root.render(<Harness />));
    return {
      setCurrentFileRef(value: { name: string; path: string } | null) {
        act(() => updateCurrentFileRef(value));
      }
    };
  }

  function buttonNamed(label: string) {
    return [...container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]')]
      .find((button) => button.textContent?.includes(label)) ?? null;
  }

  function buttonWithText(label: string) {
    return [...document.body.querySelectorAll<HTMLElement>('button, [role="menuitem"]')]
      .find((element) => element.textContent?.trim() === label) ?? null;
  }

  function dispatchPointer(target: HTMLElement | null, type: string, clientX: number, clientY: number, pointerId = 1) {
    const event = new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      clientX,
      clientY
    });
    Object.defineProperty(event, "pointerId", { configurable: true, value: pointerId });
    target?.dispatchEvent(event);
  }
});
