// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";

describe("FloatingPanel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
  });

  function renderWorkspacePanel() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        createElement(
          FloatingPanel,
          {
            open: true,
            placement: "center-panel",
            kind: "workspace",
            panelId: "markdown-window",
            defaultSize: { width: 640, height: 480 },
            children: createElement("div", { "data-testid": "workspace-content" })
          }
        )
      );
    });

    const content = container.querySelector("[data-testid='workspace-content']");
    if (!(content instanceof HTMLElement)) throw new Error("Expected workspace panel content.");
    const surface = content.parentElement;
    if (!(surface instanceof HTMLElement)) throw new Error("Expected workspace panel surface.");
    const panel = content.closest("[data-floating-panel-kind='workspace']");
    if (!(panel instanceof HTMLElement)) throw new Error("Expected workspace panel root.");

    return { panel, surface };
  }

  it("does not wrap workspace content in fixed-position containing block classes", () => {
    const { panel, surface } = renderWorkspacePanel();

    expect(panel.className).not.toContain("will-change-transform");
    expect(surface.className).not.toContain("will-change-transform");
    expect(surface.className).not.toContain("backdrop-blur");
  });
});
