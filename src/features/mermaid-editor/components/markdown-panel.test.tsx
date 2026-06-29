// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";

type MockEditorView = {
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
};

const milkdownMock = vi.hoisted(() => ({
  create: vi.fn(() => Promise.resolve()),
  destroy: vi.fn(() => Promise.resolve()),
  dispatch: vi.fn(),
  setReadonly: vi.fn(),
  setSelection: vi.fn((selection: unknown) => ({ selection })),
  view: undefined as MockEditorView | undefined
}));

vi.mock("@milkdown/crepe", () => ({
  Crepe: vi.fn(function Crepe() {
    return {
      editor: {
        status: "Created",
        action: (callback: (ctx: { get: () => MockEditorView }) => void) => {
          if (!milkdownMock.view) throw new Error("Mock editor view is not configured.");
          callback({ get: () => milkdownMock.view! });
        }
      },
      create: milkdownMock.create,
      destroy: milkdownMock.destroy,
      on: vi.fn(),
      setReadonly: milkdownMock.setReadonly
    };
  })
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

describe("MarkdownPanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    milkdownMock.view = {
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
      dispatch: milkdownMock.dispatch
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
    milkdownMock.setReadonly.mockClear();
    milkdownMock.setSelection.mockClear();
    milkdownMock.view = undefined;
    vi.useRealTimers();
  });

  function renderPanel() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(createElement(MarkdownPanel, { value: "# Hello", onChange: vi.fn() }));
    });

    const panel = container.querySelector(".markdown-editor-panel");
    if (!(panel instanceof HTMLElement)) throw new Error("Expected markdown panel.");

    return panel;
  }

  function appendBlockHandle(panel: HTMLElement) {
    const handle = document.createElement("div");
    handle.className = "milkdown-block-handle";
    panel.appendChild(handle);

    return handle;
  }

  function eventWithDataTransfer(type: string, dataTransfer: Partial<DataTransfer>) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: dataTransfer
    });

    return event;
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
});
