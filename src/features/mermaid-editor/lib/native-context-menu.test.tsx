// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { preventNativeContextMenu, useDisableNativeContextMenu } from "@/features/mermaid-editor/lib/native-context-menu";

function Harness() {
  useDisableNativeContextMenu();
  return createElement("div");
}

function dispatchContextMenu(target: EventTarget = document.body) {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("native context menu", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
  });

  function renderHarness() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(createElement(Harness));
    });
  }

  it("prevents the browser context menu", () => {
    const event = new MouseEvent("contextmenu", { cancelable: true });

    preventNativeContextMenu(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("disables context menu events while mounted", () => {
    renderHarness();

    expect(dispatchContextMenu().defaultPrevented).toBe(true);
  });

  it("removes the context menu listener when unmounted", () => {
    renderHarness();

    act(() => root?.unmount());
    root = null;

    expect(dispatchContextMenu().defaultPrevented).toBe(false);
  });
});
