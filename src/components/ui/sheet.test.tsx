// @vitest-environment jsdom

import { useRef, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

describe("Sheet", () => {
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
  });

  it("keeps its semantic layer when a caller supplies inline styles", () => {
    act(() => {
      root.render(
        <Sheet open>
          <SheetContent style={{ top: 12, zIndex: 999 }}>
            <SheetTitle>会话</SheetTitle>
            <SheetDescription>选择 Agent 会话。</SheetDescription>
          </SheetContent>
        </Sheet>
      );
    });

    const content = document.body.querySelector<HTMLElement>('[data-overlay-layer="sheet"]');
    expect(content?.style.top).toBe("12px");
    expect(content?.style.zIndex).toBe(String(OVERLAY_Z_INDEX.modal + 1));
  });

  it("closes with Escape and restores focus", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      function updateOpen(nextOpen: boolean) {
        setOpen(nextOpen);
        if (nextOpen) return;
        window.setTimeout(() => triggerRef.current?.focus({ preventScroll: true }), 0);
      }
      return (
        <Sheet open={open} onOpenChange={updateOpen}>
          <SheetTrigger asChild>
            <button ref={triggerRef} type="button">打开会话</button>
          </SheetTrigger>
            <SheetContent
              side="left"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                triggerRef.current?.focus({ preventScroll: true });
              }}
            >
              <SheetTitle>Agent 会话</SheetTitle>
              <SheetDescription>浏览并切换 Agent 会话。</SheetDescription>
              <button type="button">新会话</button>
            </SheetContent>
        </Sheet>
      );
    }

    act(() => root.render(<Harness />));
    const trigger = container.querySelector<HTMLButtonElement>("button");
    act(() => trigger?.focus());
    act(() => trigger?.click());
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      document.body.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
