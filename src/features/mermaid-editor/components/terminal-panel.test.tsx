// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import type { EditorRuntime, RuntimeTerminalExitEvent } from "@/features/mermaid-editor/lib/editor-runtime";
import { resolveEditorTheme, themeToTerminalTheme } from "@/features/mermaid-editor/lib/editor-theme";

const xtermMock = vi.hoisted(() => {
  const instances: TerminalMock[] = [];

  class TerminalMock {
    options: Record<string, unknown>;
    cols = 80;
    rows = 24;
    buffer = { active: { baseY: 0, viewportY: 0, length: 24 } };
    reset = vi.fn();
    write = vi.fn();
    clear = vi.fn();
    refresh = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    open = vi.fn();
    scrollToLine = vi.fn((line: number) => {
      this.buffer.active.viewportY = line;
    });
    onData = vi.fn(() => disposable());
    onScroll = vi.fn(() => disposable());
    onWriteParsed = vi.fn(() => disposable());
    onResize = vi.fn(() => disposable());
    onRender = vi.fn(() => disposable());

    constructor(options: Record<string, unknown>) {
      this.options = { ...options };
      instances.push(this);
    }
  }

  class FitAddon {
    fit = vi.fn();
  }

  return { TerminalMock, FitAddon, instances };
});

vi.mock("@xterm/xterm", () => ({ Terminal: xtermMock.TerminalMock }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: xtermMock.FitAddon }));
vi.mock("@/features/mermaid-editor/components/floating-chrome", () => ({
  WorkspaceWindowHeader: ({ title, center, actions, overflowActions }: {
    title: React.ReactNode;
    center?: React.ReactNode;
    actions?: React.ReactNode;
    overflowActions?: Array<{ id: string; label: string; onSelect: () => void }>;
  }) => (
    <header>
      {title}{center}{actions}
      {overflowActions?.map((action) => <button key={action.id} type="button" onClick={action.onSelect}>{action.label}</button>)}
    </header>
  )
}));
vi.mock("@/features/mermaid-editor/components/editor-ui", () => ({
  EditorIconButton: ({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
    <button type="button" aria-label={label} {...props}>{children}</button>
  )
}));

describe("TerminalPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let frameId: number;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    xtermMock.instances.length = 0;
    frameId = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++frameId;
      queueMicrotask(() => callback(0));
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("opens independent terminal tabs and only terminates a session when its tab closes", async () => {
    const harness = createRuntimeHarness([
      createSession("session-one", "/project"),
      createSession("session-two", "/project")
    ]);
    const render = createRenderer(harness.runtime);

    await render(true, "project:/project", "/project");
    expect(harness.openTerminal).toHaveBeenCalledTimes(1);

    await click("新建终端");
    expect(harness.openTerminal).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll("[role='tab']")).toHaveLength(2);

    await render(false, "project:/project", "/project");
    await render(true, "project:/project", "/project");
    expect(harness.closeTerminal).not.toHaveBeenCalled();

    await click("关闭 终端 2");
    expect(harness.closeTerminal).toHaveBeenCalledWith("session-two");
    expect(harness.closeTerminal).not.toHaveBeenCalledWith("session-one");
    expect(container.querySelectorAll("[role='tab']")).toHaveLength(1);

    await act(async () => root.unmount());
    expect(harness.closeTerminal).toHaveBeenCalledWith("session-one");
    root = createRoot(container);
  });

  it("replaces every tab when the terminal context changes and waits for a hidden panel to reopen", async () => {
    const harness = createRuntimeHarness([
      createSession("session-one", "/project-one"),
      createSession("session-two", "/project-one"),
      createSession("session-three", "/project-two")
    ]);
    const render = createRenderer(harness.runtime);

    await render(true, "project:/project-one", "/project-one");
    await click("新建终端");
    expect(harness.openTerminal).toHaveBeenCalledTimes(2);

    await render(false, "project:/project-two", "/project-two");
    expect(harness.closeTerminal).toHaveBeenCalledWith("session-one");
    expect(harness.closeTerminal).toHaveBeenCalledWith("session-two");
    expect(harness.openTerminal).toHaveBeenCalledTimes(2);

    await render(true, "project:/project-two", "/project-two");
    expect(harness.openTerminal).toHaveBeenCalledTimes(3);
    expect(harness.openTerminal).toHaveBeenLastCalledWith(expect.objectContaining({ cwd: "/project-two" }));
    expect(container.querySelectorAll("[role='tab']")).toHaveLength(1);
  });

  it("routes an exit event to the matching tab and can restart only that terminal", async () => {
    const harness = createRuntimeHarness([
      createSession("session-one", "/project"),
      createSession("session-two", "/project"),
      createSession("session-three", "/project")
    ]);
    const render = createRenderer(harness.runtime);

    await render(true, "project:/project", "/project");
    await click("新建终端");
    await click("终端 1");
    await act(async () => {
      harness.emitExit({ sessionId: "session-one", exitCode: 0 });
      await flushPromises();
    });

    expect(button("终端 1").getAttribute("aria-label")).toContain("已退出");
    await click("重启当前终端");
    expect(harness.openTerminal).toHaveBeenCalledTimes(3);
    expect(harness.closeTerminal).not.toHaveBeenCalledWith("session-two");
  });

  it("exposes independent terminal-window creation and hidden-window recovery from the titlebar", async () => {
    const harness = createRuntimeHarness([createSession("session-one", "/project")]);
    const theme = resolveEditorTheme("warm-paper", null);
    const onNewWindow = vi.fn();
    const onOpenWindow = vi.fn();

    await act(async () => {
      root.render(
        <TerminalPanel
          runtime={harness.runtime}
          cwd="/project"
          contextKey="project:/project"
          visible
          theme={theme}
          terminalTheme={themeToTerminalTheme(theme)}
          windowOrdinal={3}
          onNewWindow={onNewWindow}
          hiddenWindows={[{ id: "terminal:two", label: "终端窗口 2" }]}
          onOpenWindow={onOpenWindow}
          onStatus={() => undefined}
        />
      );
      await flushPromises();
    });

    expect(container.querySelector(".terminal-heading")?.textContent).toBe("终端 3");
    await click("新建终端窗口");
    await click("打开终端窗口 2");
    expect(onNewWindow).toHaveBeenCalledOnce();
    expect(onOpenWindow).toHaveBeenCalledWith("terminal:two");
  });

  function createRenderer(runtime: EditorRuntime) {
    const theme = resolveEditorTheme("warm-paper", null);
    const terminalTheme = themeToTerminalTheme(theme);
    return async (visible: boolean, contextKey: string, cwd: string) => {
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
        await flushPromises();
      });
    };
  }

  async function click(label: string) {
    await act(async () => {
      const element = button(label);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      element.click();
      await flushPromises();
    });
  }

  function button(label: string) {
    const element = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) =>
      candidate.getAttribute("aria-label") === label || candidate.textContent?.trim() === label
    );
    if (!element) throw new Error(`Missing button: ${label}`);
    return element;
  }
});

function createRuntimeHarness(sessions: Array<ReturnType<typeof createSession>>) {
  const openTerminal = vi.fn();
  for (const session of sessions) openTerminal.mockResolvedValueOnce({ status: "opened", session });
  const closeTerminal = vi.fn().mockResolvedValue(undefined);
  const exitHandlers: Array<(event: RuntimeTerminalExitEvent) => void> = [];
  const runtime = {
    kind: "desktop",
    listTerminalShells: vi.fn().mockResolvedValue([{ id: "default", label: "默认", command: "bash", available: true }]),
    openTerminal,
    closeTerminal,
    resizeTerminal: vi.fn().mockResolvedValue(undefined),
    writeTerminal: vi.fn().mockResolvedValue(undefined),
    listenForTerminalData: vi.fn().mockResolvedValue(() => undefined),
    listenForTerminalExit: vi.fn((handler: (event: RuntimeTerminalExitEvent) => void) => {
      exitHandlers.push(handler);
      return Promise.resolve(() => undefined);
    })
  } as unknown as EditorRuntime;
  return {
    runtime,
    openTerminal,
    closeTerminal,
    emitExit(event: RuntimeTerminalExitEvent) {
      for (const handler of exitHandlers) handler(event);
    }
  };
}

function createSession(sessionId: string, cwd: string) {
  return { sessionId, cwd, shellId: "default", shellLabel: "默认", shell: "bash" };
}

function disposable() {
  return { dispose: vi.fn() };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
