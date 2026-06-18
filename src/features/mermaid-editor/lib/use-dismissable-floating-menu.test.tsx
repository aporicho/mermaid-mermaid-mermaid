// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FLOATING_MENU_IGNORE_SELECTOR, useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";

function Harness({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ref = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });

  return (
    <div>
      {open ? (
        <div ref={ref} data-testid="menu">
          <button data-testid="inside">inside</button>
        </div>
      ) : null}
    </div>
  );
}

function dispatchPointerDown(target: EventTarget) {
  target.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
}

function dispatchEscape(target: EventTarget) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

describe("useDismissableFloatingMenu", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    document.querySelectorAll(FLOATING_MENU_IGNORE_SELECTOR).forEach((element) => element.remove());
    vi.restoreAllMocks();
  });

  function renderHarness(onOpenChange = vi.fn()) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(createElement(Harness, { open: true, onOpenChange }));
    });

    return onOpenChange;
  }

  it("closes when pointer interaction starts outside the menu", () => {
    const onOpenChange = renderHarness();

    act(() => dispatchPointerDown(document.body));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the menu open when interacting inside the menu", () => {
    const onOpenChange = renderHarness();
    const inside = container?.querySelector("[data-testid='inside']");
    if (!inside) throw new Error("Expected inside button.");

    act(() => dispatchPointerDown(inside));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("ignores portaled select content", () => {
    const onOpenChange = renderHarness();
    const ignored = document.createElement("div");
    ignored.setAttribute("data-editor-floating-menu-ignore", "");
    document.body.appendChild(ignored);

    act(() => dispatchPointerDown(ignored));
    act(() => dispatchEscape(ignored));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on Escape when focus is not inside ignored content", () => {
    const onOpenChange = renderHarness();

    act(() => dispatchEscape(document.body));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
