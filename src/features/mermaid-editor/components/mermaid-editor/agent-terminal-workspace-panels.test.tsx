// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentTerminalWorkspacePanels } from "@/features/mermaid-editor/components/mermaid-editor/agent-terminal-workspace-panels";

vi.mock("@/features/mermaid-editor/components/floating-chrome", () => ({
  WorkspaceFloatingWindow: ({ open, panelId, onClose, children }: {
    open: boolean;
    panelId: string;
    onClose: () => void;
    children: React.ReactNode;
  }) => (
    <section data-panel-id={panelId} data-open={String(open)}>
      <button type="button" aria-label={`hide-${panelId}`} onClick={onClose}>隐藏</button>
      {children}
    </section>
  )
}));

vi.mock("@/features/mermaid-editor/components/terminal-panel", () => ({
  TerminalPanel: ({ windowOrdinal, visible, hiddenWindows, onNewWindow, onOpenWindow }: {
    windowOrdinal: number;
    visible: boolean;
    hiddenWindows: Array<{ id: string; label: string }>;
    onNewWindow: () => void;
    onOpenWindow: (id: string) => void;
  }) => (
    <div data-terminal-window={windowOrdinal} data-visible={String(visible)}>
      <button type="button" aria-label={`new-window-${windowOrdinal}`} onClick={onNewWindow}>新建窗口</button>
      {hiddenWindows.map((window) => (
        <button key={window.id} type="button" aria-label={`open-${window.id}`} onClick={() => onOpenWindow(window.id)}>{window.label}</button>
      ))}
    </div>
  )
}));

vi.mock("@/features/mermaid-editor/components/agent/agent-workspace-panel", () => ({
  AgentWorkspacePanel: () => <div />
}));

describe("AgentTerminalWorkspacePanels", () => {
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

  it("renders independent keep-alive terminal windows and wires hide, create, and reopen actions", () => {
    const newTerminalWindow = vi.fn();
    const openTerminalWindow = vi.fn();
    const closeTerminalWindow = vi.fn();
    const closePanel = vi.fn();

    act(() => {
      root.render(
        <AgentTerminalWorkspacePanels
          runtime={{} as never}
          agentOpen={false}
          terminalOpen
          detachedTerminalWindows={[
            { id: "terminal:two", ordinal: 2, open: true },
            { id: "terminal:three", ordinal: 3, open: false }
          ]}
          agentDocumentBridge={{} as never}
          terminalContextKey="project:/project"
          activeTheme={{} as never}
          terminalTheme={{} as never}
          titlebarAutoHide
          activePanel="terminal:two"
          stackPosition={() => 0}
          windowState={() => "normal"}
          setWindowState={() => undefined}
          bringToFront={() => undefined}
          closePanel={closePanel}
          newTerminalWindow={newTerminalWindow}
          openTerminalWindow={openTerminalWindow}
          closeTerminalWindow={closeTerminalWindow}
          onStatus={() => undefined}
          onAgentActivityChange={() => undefined}
        />
      );
    });

    expect(container.querySelector("[data-panel-id='terminal']")?.getAttribute("data-open")).toBe("true");
    expect(container.querySelector("[data-panel-id='terminal:two']")?.getAttribute("data-open")).toBe("true");
    expect(container.querySelector("[data-panel-id='terminal:three']")?.getAttribute("data-open")).toBe("false");

    click("new-window-2");
    click("open-terminal:three");
    click("hide-terminal:two");
    click("hide-terminal");

    expect(newTerminalWindow).toHaveBeenCalledOnce();
    expect(openTerminalWindow).toHaveBeenCalledWith("terminal:three");
    expect(closeTerminalWindow).toHaveBeenCalledWith("terminal:two");
    expect(closePanel).toHaveBeenCalledWith("terminal");
  });

  function click(label: string) {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`);
    if (!button) throw new Error(`Missing button: ${label}`);
    act(() => button.click());
  }
});
