// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkspacePanels } from "@/features/mermaid-editor/lib/workspace-panels";

describe("workspace panel fullscreen state", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("brings a fullscreen panel to the front and permits only one fullscreen window", () => {
    act(() => button("fullscreen-terminal").click());
    expect(state().dataset.fullscreen).toBe("terminal");
    expect(Number(state().dataset.terminalStack)).toBeGreaterThan(Number(state().dataset.agentStack));

    act(() => button("fullscreen-agent").click());
    expect(state().dataset.fullscreen).toBe("agent");
    expect(state().dataset.terminalState).toBe("normal");
    expect(state().dataset.agentState).toBe("fullscreen");
  });

  function button(testId: string) {
    const element = container.querySelector<HTMLButtonElement>(`[data-testid='${testId}']`);
    if (!element) throw new Error(`Expected ${testId}`);
    return element;
  }

  function state() {
    const element = container.querySelector<HTMLElement>("[data-testid='state']");
    if (!element) throw new Error("Expected state");
    return element;
  }
});

function Harness() {
  const panels = useWorkspacePanels({
    leftCollapsed: true,
    rightCollapsed: true,
    agentOpen: true,
    terminalOpen: true,
    themeSettingsOpen: false,
    documentKind: "mermaid",
    detachedMarkdownWindows: [],
    detachedBrowserWindows: [],
    detachedHtmlWindows: [],
    detachedImageWindows: []
  });
  return <>
    <button data-testid="fullscreen-terminal" onClick={() => panels.setWorkspacePanelWindowState("terminal", "fullscreen")} />
    <button data-testid="fullscreen-agent" onClick={() => panels.setWorkspacePanelWindowState("agent", "fullscreen")} />
    <div
      data-testid="state"
      data-fullscreen={panels.fullscreenWorkspacePanel || ""}
      data-terminal-stack={panels.workspacePanelStackPosition("terminal")}
      data-agent-stack={panels.workspacePanelStackPosition("agent")}
      data-terminal-state={panels.workspacePanelWindowState("terminal")}
      data-agent-state={panels.workspacePanelWindowState("agent")}
    />
  </>;
}
