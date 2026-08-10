// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentWorkspacePanel } from "./agent-workspace-panel";

const sessionHookCalls = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./agent-event-router", () => ({ AgentEventRouterProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("./use-agent-session", () => ({
  useAgentSession: (options: any) => {
    sessionHookCalls(options);
    const { agentInstanceId, target } = options;
    return ({
    agentInstanceId,
    instanceStatus: "idle",
    sessionState: { sessionId: agentInstanceId, sessionName: agentInstanceId, sessionFile: target.kind === "existing" ? target.sessionPath : `/sessions/${agentInstanceId}.jsonl` },
    workerState: null,
    overview: null,
    error: null
    });
  }
}));
vi.mock("./agent-panel", () => ({
  AgentPanel: ({ controller, workspace }: any) => <div>
    <output data-active-session>{controller.agentInstanceId}</output>
    <button type="button" data-new-session onClick={workspace.createSession}>新会话</button>
    {workspace.sessions.map((session: any) => <button type="button" key={session.id} data-session-id={session.id} onClick={() => workspace.activateSession(session)}>{session.id}</button>)}
  </div>
}));

const sessions = [
  { id: "alpha", path: "/sessions/alpha.jsonl", cwd: "/project", created: "2026-01-01T00:00:00.000Z", modified: "2026-01-02T00:00:00.000Z", messageCount: 1, firstMessage: "Alpha" },
  { id: "beta", path: "/sessions/beta.jsonl", cwd: "/project", created: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", messageCount: 1, firstMessage: "Beta" }
];

describe("AgentWorkspacePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    sessionHookCalls.mockClear();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("uses the session list as the only switcher while keeping independent instances mounted", async () => {
    const runtime = runtimeHarness();
    await act(async () => {
      root.render(<AgentWorkspacePanel runtime={runtime as never} enabled cwd="/project" documentBridge={{} as never} />);
      await Promise.resolve();
    });
    expect(activeSession()).toBe("alpha");
    expect(container.querySelector("[role='tablist']")).toBeNull();

    await act(async () => {
      root.render(<AgentWorkspacePanel runtime={runtime as never} enabled cwd="/another-project" documentBridge={{} as never} />);
      await Promise.resolve();
    });
    expect(sessionHookCalls.mock.calls.filter(([options]) => options.agentInstanceId === "alpha").at(-1)?.[0].cwd).toBe("/project");

    await act(async () => container.querySelector<HTMLButtonElement>("[data-session-id='beta']")!.click());
    expect(activeSession()).toBe("beta");

    await act(async () => container.querySelector<HTMLButtonElement>("[data-new-session]")!.click());
    expect(activeSession()).not.toBe("alpha");
    expect(activeSession()).not.toBe("beta");
    expect(runtime.setAgentInstanceForeground).toHaveBeenCalledWith("alpha", false);
    expect(runtime.setAgentInstanceForeground).toHaveBeenCalledWith("beta", false);
  });

  function activeSession() {
    return container.querySelector("[data-active-session]")?.textContent;
  }
});

function runtimeHarness() {
  return {
    listAgentSessions: vi.fn().mockResolvedValue(sessions),
    listAgentInstances: vi.fn().mockResolvedValue([]),
    setAgentInstanceForeground: vi.fn().mockResolvedValue(undefined),
    deleteAgentSession: vi.fn().mockResolvedValue(undefined),
    stopAgent: vi.fn().mockResolvedValue(undefined)
  };
}
