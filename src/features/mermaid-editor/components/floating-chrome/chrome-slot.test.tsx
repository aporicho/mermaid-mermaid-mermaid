// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FloatingChromeSlot } from "@/features/mermaid-editor/components/floating-chrome/chrome-slot";

describe("floating chrome slot", () => {
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
    container.remove();
  });

  it("clears stale focus visibility when a focused launcher is removed", () => {
    renderLaunchers(true);
    expect(slotState()).toBe("hidden");

    act(() => button("Agent").focus());
    expect(slotState()).toBe("visible");

    renderLaunchers(false);
    expect(document.activeElement).toBe(document.body);
    expect(slotState()).toBe("hidden");
  });

  it("stays visible while a remaining launcher has real keyboard focus", () => {
    renderLaunchers(true);
    act(() => button("终端").focus());
    expect(slotState()).toBe("visible");

    renderLaunchers(false);
    expect(document.activeElement).toBe(button("终端"));
    expect(slotState()).toBe("visible");
  });

  function renderLaunchers(showAgent: boolean) {
    act(() => {
      root.render(
        <FloatingChromeSlot placement="rightBottom">
          <div>
            {showAgent ? <button type="button">Agent</button> : null}
            <button type="button">终端</button>
          </div>
        </FloatingChromeSlot>
      );
    });
  }

  function button(label: string) {
    const match = [...container.querySelectorAll<HTMLButtonElement>("button")].find((entry) => entry.textContent === label);
    if (!match) throw new Error(`Expected ${label} button.`);
    return match;
  }

  function slotState() {
    return container.querySelector<HTMLElement>("[data-floating-chrome-state]")?.dataset.floatingChromeState;
  }
});
