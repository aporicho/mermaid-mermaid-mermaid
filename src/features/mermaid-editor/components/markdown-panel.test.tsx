// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";

type MockEditorView = {
  dom: HTMLElement;
  state: {
    selection: { from: number };
    doc: {
      content: { size: number };
      resolve: (position: number) => unknown;
    };
    tr: {
      setSelection: (selection: unknown) => unknown;
    };
  };
  dispatch: (transaction: unknown) => void;
  focus: () => void;
  posAtCoords: (coords: { left: number; top: number }) => { inside: number; pos: number } | null;
};

const milkdownMock = vi.hoisted(() => ({
  crepeConfig: undefined as unknown,
  create: vi.fn(() => Promise.resolve()),
  destroy: vi.fn(() => Promise.resolve()),
  dispatch: vi.fn(),
  use: vi.fn(),
  setReadonly: vi.fn(),
  setSelection: vi.fn((selection: unknown) => ({ selection })),
  view: undefined as MockEditorView | undefined
}));

const markdownBlockStyleMock = vi.hoisted(() => ({
  convert: vi.fn(() => true),
  get: vi.fn(() => "paragraph")
}));

const markdownFoldingMock = vi.hoisted(() => ({
  find: vi.fn(() => null as { collapsed: boolean; kind: "heading" | "list-item"; label: string; position: number } | null),
  plugin: Symbol("markdownFolding"),
  toggle: vi.fn(() => true)
}));

vi.mock("@milkdown/crepe", () => ({
  Crepe: vi.fn(function Crepe(config: unknown) {
    milkdownMock.crepeConfig = config;
    return {
      editor: {
        status: "Created",
        use: milkdownMock.use,
        action: <T,>(callback: (ctx: { get: () => MockEditorView }) => T) => {
          if (!milkdownMock.view) throw new Error("Mock editor view is not configured.");
          return callback({ get: () => milkdownMock.view! });
        }
      },
      create: milkdownMock.create,
      destroy: milkdownMock.destroy,
      on: vi.fn(),
      setReadonly: milkdownMock.setReadonly
    };
  }),
  CrepeFeature: { BlockEdit: "block-edit" }
}));

vi.mock("@milkdown/kit/core", () => ({
  EditorStatus: { Created: "Created" },
  editorViewCtx: Symbol("editorViewCtx")
}));

vi.mock("@milkdown/kit/prose/state", () => {
  class TextSelection {
    static near() {
      return new TextSelection();
    }
  }

  return { TextSelection };
});

vi.mock("@/features/mermaid-editor/lib/markdown-block-style", () => ({
  convertMarkdownBlock: markdownBlockStyleMock.convert,
  getMarkdownBlockStyle: markdownBlockStyleMock.get
}));

vi.mock("@/features/mermaid-editor/lib/markdown-folding", () => ({
  findMarkdownFoldTarget: markdownFoldingMock.find,
  markdownFolding: markdownFoldingMock.plugin,
  toggleMarkdownFold: markdownFoldingMock.toggle
}));

describe("MarkdownPanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    milkdownMock.view = {
      dom: document.createElement("div"),
      state: {
        selection: { from: 5 },
        doc: {
          content: { size: 20 },
          resolve: vi.fn((position: number) => ({ position }))
        },
        tr: {
          setSelection: milkdownMock.setSelection
        }
      },
      dispatch: milkdownMock.dispatch,
      focus: vi.fn(),
      posAtCoords: vi.fn(() => ({ inside: 5, pos: 6 }))
    };
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    milkdownMock.create.mockClear();
    milkdownMock.destroy.mockClear();
    milkdownMock.dispatch.mockClear();
    milkdownMock.use.mockClear();
    milkdownMock.setReadonly.mockClear();
    milkdownMock.setSelection.mockClear();
    milkdownMock.crepeConfig = undefined;
    markdownBlockStyleMock.convert.mockClear();
    markdownBlockStyleMock.get.mockClear();
    markdownFoldingMock.find.mockClear();
    markdownFoldingMock.toggle.mockClear();
    milkdownMock.view = undefined;
    vi.useRealTimers();
  });

  function renderPanel(spellCheck = false, contentWidth = 880, textScale = 1, className?: string) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(createElement(MarkdownPanel, { value: "# Hello", spellCheck, contentWidth, textScale, className, onChange: vi.fn() }));
    });

    const panel = container.querySelector(".markdown-editor-panel");
    if (!(panel instanceof HTMLElement)) throw new Error("Expected markdown panel.");

    return panel;
  }

  it("applies and updates the native spellcheck setting without recreating Milkdown", () => {
    renderPanel(false);

    expect(milkdownMock.view?.dom.getAttribute("spellcheck")).toBe("false");
    expect(milkdownMock.use).toHaveBeenCalledTimes(1);
    expect(milkdownMock.create).toHaveBeenCalledTimes(1);

    act(() => {
      root?.render(createElement(MarkdownPanel, { value: "# Hello", spellCheck: true, contentWidth: 880, textScale: 1, onChange: vi.fn() }));
    });

    expect(milkdownMock.view?.dom.getAttribute("spellcheck")).toBe("true");
    expect(milkdownMock.create).toHaveBeenCalledTimes(1);
  });

  it("applies and updates the configured content width without recreating Milkdown", () => {
    const panel = renderPanel(false, 960);

    expect(panel.style.getPropertyValue("--markdown-content-width")).toBe("960px");
    expect(milkdownMock.create).toHaveBeenCalledTimes(1);

    act(() => {
      root?.render(createElement(MarkdownPanel, { value: "# Hello", spellCheck: false, contentWidth: 1280, textScale: 1, onChange: vi.fn() }));
    });

    expect(panel.style.getPropertyValue("--markdown-content-width")).toBe("1280px");
    expect(milkdownMock.create).toHaveBeenCalledTimes(1);
  });

  it("applies and updates the text scale without recreating Milkdown", () => {
    const panel = renderPanel(false, 880, 1.26);

    expect(panel.style.getPropertyValue("--markdown-text-scale")).toBe("1.3");
    expect(milkdownMock.create).toHaveBeenCalledTimes(1);

    act(() => {
      root?.render(createElement(MarkdownPanel, { value: "# Hello", spellCheck: false, contentWidth: 880, textScale: 0.65, onChange: vi.fn() }));
    });

    expect(panel.style.getPropertyValue("--markdown-text-scale")).toBe("0.7");
    expect(milkdownMock.create).toHaveBeenCalledTimes(1);
  });

  it("places detached-window block handles close to their active block", () => {
    renderPanel(false, 880, 1, "markdown-editor-panel--window");

    const config = milkdownMock.crepeConfig as {
      featureConfigs: Record<string, { blockHandle: { getOffset: () => number } }>;
    };
    expect(config.featureConfigs["block-edit"]?.blockHandle.getOffset()).toBe(6);
  });

  function appendBlockHandle(panel: HTMLElement) {
    const handle = document.createElement("div");
    handle.className = "milkdown-block-handle";
    panel.appendChild(handle);

    return handle;
  }

  function appendInteractiveBlockHandle(panel: HTMLElement, visible = true) {
    const handle = appendBlockHandle(panel);
    handle.dataset.show = visible ? "true" : "false";
    const addButton = document.createElement("div");
    const dragButton = document.createElement("div");
    addButton.className = "operation-item";
    dragButton.className = "operation-item";
    handle.append(addButton, dragButton);
    vi.spyOn(handle, "getBoundingClientRect").mockReturnValue({
      bottom: 124,
      height: 24,
      left: 40,
      right: 64,
      top: 100,
      width: 24,
      x: 40,
      y: 100,
      toJSON: () => ({})
    });
    return { addButton, dragButton, handle };
  }

  function eventWithDataTransfer(type: string, dataTransfer: Partial<DataTransfer>) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: dataTransfer
    });

    return event;
  }

  function getBlockStyleMenu() {
    return document.querySelector('[role="menu"][aria-label="块样式"]');
  }

  it("clears Milkdown block drag state and selected node after drag end", () => {
    const panel = renderPanel();
    const handle = appendBlockHandle(panel);

    const selectedNode = document.createElement("div");
    selectedNode.className = "ProseMirror-selectednode";
    panel.appendChild(selectedNode);

    act(() => {
      handle.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
    });

    expect(panel.getAttribute("data-md-block-dragging")).toBe("true");

    act(() => {
      handle.dispatchEvent(new Event("dragend", { bubbles: true, cancelable: true }));
      vi.runAllTimers();
    });

    expect(panel.hasAttribute("data-md-block-dragging")).toBe(false);
    expect(selectedNode.classList.contains("ProseMirror-selectednode")).toBe(false);
    expect(milkdownMock.setSelection).toHaveBeenCalledTimes(1);
    expect(milkdownMock.dispatch).toHaveBeenCalledWith(expect.objectContaining({ selection: expect.any(Object) }));
  });

  it("does not override Milkdown dragstart data transfer settings", () => {
    const panel = renderPanel();
    const handle = appendBlockHandle(panel);
    const dataTransfer = { effectAllowed: "copyMove" as DataTransfer["effectAllowed"] };

    act(() => {
      handle.dispatchEvent(eventWithDataTransfer("dragstart", dataTransfer));
    });

    expect(panel.getAttribute("data-md-block-dragging")).toBe("true");
    expect(dataTransfer.effectAllowed).toBe("copyMove");
  });

  it("marks dragover on the active block handle as a move target", () => {
    const panel = renderPanel();
    const handle = appendBlockHandle(panel);
    const dataTransfer = { dropEffect: "none" as DataTransfer["dropEffect"] };

    act(() => {
      handle.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
    });

    const dragOver = eventWithDataTransfer("dragover", dataTransfer);

    act(() => {
      handle.dispatchEvent(dragOver);
    });

    expect(dragOver.defaultPrevented).toBe(true);
    expect(dataTransfer.dropEffect).toBe("move");
  });

  it("opens a compact block style menu only from a click on the drag handle", () => {
    const panel = renderPanel();
    const { addButton, dragButton } = appendInteractiveBlockHandle(panel);

    act(() => {
      addButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(getBlockStyleMenu()).toBeNull();

    act(() => {
      dragButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      dragButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const menu = getBlockStyleMenu();
    expect(menu).not.toBeNull();
    expect(menu?.classList.contains("select-none")).toBe(true);
    expect(menu?.textContent).toContain("正文");
    expect(menu?.textContent).toContain("H6");
    expect(menu?.textContent).toContain("无序列表");
    expect(menu?.textContent).toContain("有序列表");
    expect(menu?.textContent).toContain("任务项");
    expect(menu?.textContent).toContain("引用");
    expect(menu?.textContent).toContain("代码块");
    expect(markdownBlockStyleMock.get).toHaveBeenCalledWith(milkdownMock.view?.state, 5);
  });

  it("removes add and places folding after the drag action for a foldable block", async () => {
    markdownFoldingMock.find.mockReturnValue({
      collapsed: false,
      kind: "heading",
      label: "Section",
      position: 5
    });
    const panel = renderPanel();
    const { addButton, dragButton, handle } = appendInteractiveBlockHandle(panel);

    await act(async () => {
      await Promise.resolve();
    });

    const foldButton = handle.querySelector<HTMLButtonElement>(":scope > .markdown-fold-handle-button");
    expect(foldButton).not.toBeNull();
    expect(Array.from(handle.children)).toEqual([addButton, dragButton, foldButton]);
    expect(addButton.hidden).toBe(true);
    expect(addButton.getAttribute("aria-hidden")).toBe("true");
    expect(Array.from(handle.children).filter((item) => !(item as HTMLElement).hidden)).toEqual([dragButton, foldButton]);
    expect(foldButton?.hidden).toBe(false);
    expect(foldButton?.getAttribute("aria-label")).toBe("折叠章节“Section”");
    expect(foldButton?.getAttribute("aria-expanded")).toBe("true");
    expect(foldButton?.tabIndex).toBe(0);

    act(() => {
      foldButton?.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
      foldButton?.click();
    });

    expect(markdownFoldingMock.find).toHaveBeenCalledWith(milkdownMock.view?.state, 5);
    expect(markdownFoldingMock.toggle).toHaveBeenCalledWith(milkdownMock.view, {
      kind: "heading",
      position: 5
    });
    expect(getBlockStyleMenu()).toBeNull();
    expect(panel.hasAttribute("data-md-block-dragging")).toBe(false);
  });

  it("only exposes a visible style handle as a keyboard-accessible menu entry", async () => {
    const panel = renderPanel();
    const { dragButton, handle } = appendInteractiveBlockHandle(panel, false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(dragButton.getAttribute("role")).toBe("button");
    expect(dragButton.getAttribute("aria-label")).toBe("块样式");
    expect(dragButton.getAttribute("aria-hidden")).toBe("true");
    expect(dragButton.tabIndex).toBe(-1);

    act(() => {
      dragButton.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
    });
    expect(getBlockStyleMenu()).toBeNull();

    await act(async () => {
      handle.dataset.show = "true";
      await Promise.resolve();
    });

    expect(dragButton.hasAttribute("aria-hidden")).toBe(false);
    expect(dragButton.tabIndex).toBe(0);

    act(() => {
      dragButton.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
    });

    expect(getBlockStyleMenu()).not.toBeNull();
  });

  it("keeps the style menu open and announces a rejected conversion", () => {
    const panel = renderPanel();
    const { dragButton } = appendInteractiveBlockHandle(panel);
    markdownBlockStyleMock.convert.mockReturnValueOnce(false);

    act(() => {
      dragButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      dragButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const headingTwo = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.includes("H2"));
    act(() => {
      headingTwo?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBlockStyleMenu()).not.toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("未能应用，请重试");
  });

  it("keeps the style menu open and announces a conversion exception", () => {
    const panel = renderPanel();
    const { dragButton } = appendInteractiveBlockHandle(panel);
    markdownBlockStyleMock.convert.mockImplementationOnce(() => {
      throw new Error("conversion failed");
    });

    act(() => {
      dragButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      dragButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const headingTwo = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.includes("H2"));
    act(() => {
      headingTwo?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBlockStyleMenu()).not.toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("未能应用，请重试");
  });

  it("runs the selected block style command at the block position", () => {
    const panel = renderPanel();
    const { dragButton } = appendInteractiveBlockHandle(panel);

    act(() => {
      dragButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      dragButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const headingTwo = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.includes("H2"));
    expect(headingTwo).toBeDefined();

    act(() => {
      headingTwo?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(markdownBlockStyleMock.convert).toHaveBeenCalledWith(milkdownMock.view, 5, "heading-2");
  });

  it("resolves the clicked handle block even when the text cursor is in another block", () => {
    const panel = renderPanel();
    const { dragButton } = appendInteractiveBlockHandle(panel);
    if (!milkdownMock.view) throw new Error("Expected editor view.");
    milkdownMock.view.state.selection.from = 18;
    milkdownMock.view.posAtCoords = vi.fn(() => ({ inside: 0, pos: 1 }));

    act(() => {
      dragButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      dragButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const quote = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.includes("引用"));
    act(() => {
      quote?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(markdownBlockStyleMock.get).toHaveBeenCalledWith(milkdownMock.view.state, 0);
    expect(markdownBlockStyleMock.convert).toHaveBeenCalledWith(milkdownMock.view, 0, "blockquote");
  });

  it("does not open the style menu after the same handle gesture becomes a drag", () => {
    const panel = renderPanel();
    const { dragButton } = appendInteractiveBlockHandle(panel);

    act(() => {
      dragButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      dragButton.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
      dragButton.dispatchEvent(new Event("dragend", { bubbles: true, cancelable: true }));
      dragButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBlockStyleMenu()).toBeNull();
  });
});
