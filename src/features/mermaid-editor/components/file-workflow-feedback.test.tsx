// @vitest-environment jsdom

import { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnsavedFilePrompt } from "@/features/mermaid-editor/components/file-workflow-feedback";
import type { UnsavedPromptChoice } from "@/features/mermaid-editor/lib/desktop-close-workflow";

describe("UnsavedFilePrompt", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("cancels on Escape and restores focus to the control that opened it", async () => {
    const onResolve = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      function resolve(choice: UnsavedPromptChoice) {
        onResolve(choice);
        setOpen(false);
      }

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>切换文件</button>
          {open ? (
            <UnsavedFilePrompt
              prompt={{ title: "保存修改？", description: "当前文件有未保存修改。", targetName: "notes.md" }}
              onResolve={resolve}
            />
          ) : null}
        </>
      );
    }

    act(() => root.render(<Harness />));
    const trigger = container.querySelector<HTMLButtonElement>("button");
    act(() => trigger?.focus());
    act(() => trigger?.click());

    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(dialog).not.toBeNull();

    await act(async () => {
      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith("cancel");
    expect(document.activeElement).toBe(trigger);
  });
});
