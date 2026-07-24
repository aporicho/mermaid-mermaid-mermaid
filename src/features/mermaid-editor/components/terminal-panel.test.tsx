// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import { resolveEditorTheme, themeToTerminalTheme } from "@/features/mermaid-editor/lib/editor-theme";

const xtermMock = vi.hoisted(() => {
  const instances: Array<{
    options: Record<string, unknown>;
    cols: number;
    rows: number;
    reset: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];

  class Terminal {
    options: Record<string, unknown>;
    cols = 80;
    rows = 24;
    reset = vi.fn();
    write = vi.fn();
    clear = vi.fn();
    refresh = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    open = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));

    constructor(options: Record<string, unknown>) {
      this.options = { ...options };
      instances.push(this);
    }
  }

  class FitAddon {
    fit = vi.fn();
  }

  return { Terminal, FitAddon, instances };
});

vi.mock("@xterm/xterm", () => ({ Terminal: xtermMock.Terminal }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: xtermMock.FitAddon }));
vi.mock("@/features/mermaid-editor/components/floating-chrome", () => ({
  WorkspaceWindowHeader: ({ title }: { title: React.ReactNode }) => <header>{title}</header>
}));
vi.mock("@/features/mermaid-editor/components/editor-ui", () => ({
  EditorIconButton: ({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
    <button type="button" aria-label={label} {...props}>{children}</button>
  )
}));

describe("TerminalPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    xtermMock.instances.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("keeps the session while hidden and replaces it only when the terminal context changes", async () => {
    const openTerminal = vi.fn()
      .mockResolvedValueOnce({ status: "opened", session: createSession("session-one", "/project-one") })
      .mockResolvedValueOnce({ status: "opened", session: createSession("session-two", "/project-two") });
    const closeTerminal = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      kind: "desktop",
      listTerminalShells: vi.fn().mockResolvedValue([{ id: "default", label: "默认", command: "bash", available: true }]),
      openTerminal,
      closeTerminal,
      resizeTerminal: vi.fn().mockResolvedValue(undefined),
      writeTerminal: vi.fn().mockResolvedValue(undefined),
      listenForTerminalData: vi.fn().mockResolvedValue(() => undefined),
      listenForTerminalExit: vi.fn().mockResolvedValue(() => undefined)
    } as unknown as EditorRuntime;
    const theme = resolveEditorTheme("warm-paper", null);
    const terminalTheme = themeToTerminalTheme(theme);

    async function render(visible: boolean, contextKey: string, cwd: string) {
      await act(async () => {
        root.render(
          <TerminalPanel
            runtime={runtime}
            cwd={cwd}
            contextKey={contextKey}
            visible={visible}
            theme={theme}
            terminalTheme={terminalTheme}
            onStatus={() => undefined}
          />
        );
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    await render(true, "project:/project-one", "/project-one");
    expect(openTerminal).toHaveBeenCalledTimes(1);
    expect(closeTerminal).not.toHaveBeenCalled();

    await render(false, "project:/project-one", "/project-one");
    await render(true, "project:/project-one", "/project-one");
    expect(openTerminal).toHaveBeenCalledTimes(1);
    expect(closeTerminal).not.toHaveBeenCalled();

    await render(false, "project:/project-two", "/project-two");
    expect(closeTerminal).toHaveBeenCalledWith("session-one");
    expect(openTerminal).toHaveBeenCalledTimes(1);

    await render(true, "project:/project-two", "/project-two");
    expect(openTerminal).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
    expect(closeTerminal).toHaveBeenCalledWith("session-two");
    root = createRoot(container);
  });
});

function createSession(sessionId: string, cwd: string) {
  return { sessionId, cwd, shellId: "default", shellLabel: "默认", shell: "bash" };
}
