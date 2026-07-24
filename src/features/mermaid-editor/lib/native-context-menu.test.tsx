// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { preventNativeContextMenu } from "@/features/mermaid-editor/lib/native-context-menu";

function Harness() {
  return (
    <>
      <input aria-label="可编辑文本" />
      <div data-testid="custom-surface" onContextMenu={preventNativeContextMenu}>自定义表面</div>
    </>
  );
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
      root?.render(<Harness />);
    });
  }

  it("prevents the browser context menu", () => {
    const event = new MouseEvent("contextmenu", { cancelable: true });

    preventNativeContextMenu(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the native menu available outside an explicitly scoped custom surface", () => {
    renderHarness();

    const input = container?.querySelector('input[aria-label="可编辑文本"]');
    expect(dispatchContextMenu(input ?? undefined).defaultPrevented).toBe(false);
    expect(dispatchContextMenu(document.body).defaultPrevented).toBe(false);
  });

  it("prevents the native menu only on an explicitly scoped custom surface", () => {
    renderHarness();

    const customSurface = container?.querySelector('[data-testid="custom-surface"]');
    expect(dispatchContextMenu(customSurface ?? undefined).defaultPrevented).toBe(true);
  });
});
