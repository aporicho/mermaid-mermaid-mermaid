// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MainPlainDocumentPanel } from "@/features/mermaid-editor/components/main-plain-document-panel";

describe("MainPlainDocumentPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("embeds TXT without floating-window chrome and keeps Ctrl+S", () => {
    const onSave = vi.fn();
    render({ documentKind: "text", value: "Notes", onSave });

    const editor = container.querySelector<HTMLTextAreaElement>('[aria-label="notes.txt 文本编辑器"]');
    expect(editor).not.toBeNull();
    expect(container.querySelector('[aria-label="保存文本文件"]')).toBeNull();
    act(() => editor?.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true })));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("embeds the CSV table editor and keeps its source value", () => {
    render({ documentKind: "csv", value: "Name,Age\nAlice,30\n" });

    expect(container.querySelector('[aria-label="CSV 表头模式"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="保存 CSV"]')).toBeNull();
    expect(container.textContent).toContain("2 行 × 2 列");
  });

  function render({ documentKind, value, onSave = vi.fn() }: {
    documentKind: "text" | "csv";
    value: string;
    onSave?: () => void;
  }) {
    act(() => root.render(
      <MainPlainDocumentPanel
        documentKind={documentKind}
        title={documentKind === "text" ? "notes.txt" : "people.csv"}
        path={`/project/${documentKind === "text" ? "notes.txt" : "people.csv"}`}
        value={value}
        dirty={false}
        canUndo={false}
        canRedo={false}
        onChange={vi.fn()}
        onSave={onSave}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />
    ));
  }
});
