// @vitest-environment node

import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createPiAgentManager } = require("./pi-agent-manager.cjs") as {
  createPiAgentManager: (options: Record<string, unknown>) => PiAgentManager;
};

type WebContentsStub = { id: number; isDestroyed: () => boolean; send: ReturnType<typeof vi.fn> };
type AgentInstanceSummary = { sessionId: string; status: string; cwd: string };
type PiAgentManager = {
  start: (webContents: WebContentsStub, request: ReturnType<typeof target>) => Promise<{ status: string; instanceStatus: string }>;
  listInstances: (ownerId: number) => AgentInstanceSummary[];
  rpc: (webContents: WebContentsStub, command: Record<string, unknown>) => unknown;
  stopOwner: (ownerId: number) => Promise<void>;
  closeAll: () => Promise<void>;
  stop: (ownerId: number, agentInstanceId: string) => Promise<void>;
  deleteSession: (ownerId: number, request: { sessionId: string; sessionPath: string }) => Promise<unknown>;
};

class FakeStream extends EventEmitter {
  setEncoding() {}
}

class FakeChild extends EventEmitter {
  stdout = new FakeStream();
  stderr = new FakeStream();
  stdin = { write: vi.fn(), end: vi.fn() };
  killed = false;
  kill = vi.fn(() => { this.killed = true; });
  send = vi.fn((message: { type: string; bootstrap: { cwd: string; scratch: boolean; target: { kind: string; sessionId: string; sessionPath?: string } } }) => {
    if (message.type !== "initialize") return;
    const target = message.bootstrap.target;
    queueMicrotask(() => this.emit("message", {
      type: "ready",
      state: {
        cwd: message.bootstrap.cwd,
        scratch: message.bootstrap.scratch,
        sessionId: target.sessionId,
        sessionFile: target.kind === "existing" ? target.sessionPath : `/sessions/${target.sessionId}.jsonl`
      }
    }));
  });
}

function target(id: string) {
  return { agentInstanceId: id, target: { kind: "existing", sessionId: id, sessionPath: `/sessions/${id}.jsonl` }, cwd: "/project" };
}

describe("Pi Agent manager", () => {
  it("runs one independently routed worker per session and stops every worker owned by a window", async () => {
    const children: FakeChild[] = [];
    const manager = createPiAgentManager({
      shell: { trashItem: vi.fn() },
      forkWorker: vi.fn(() => { const child = new FakeChild(); children.push(child); return child; })
    });
    const webContents = { id: 7, isDestroyed: () => false, send: vi.fn() };

    await Promise.all([manager.start(webContents, target("one")), manager.start(webContents, target("two"))]);
    expect(manager.listInstances(7)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: "one", status: "idle", cwd: "/project" }),
      expect.objectContaining({ sessionId: "two", status: "idle" })
    ]));

    manager.rpc(webContents, { agentInstanceId: "one", type: "prompt", message: "first" });
    expect(manager.listInstances(7).find((item) => item.sessionId === "one")?.status).toBe("running");
    expect(manager.listInstances(7).find((item) => item.sessionId === "two")?.status).toBe("idle");
    await expect(manager.start(webContents, target("one"))).resolves.toMatchObject({ status: "ready", instanceStatus: "running" });

    await manager.stopOwner(7);
    expect(manager.listInstances(7)).toEqual([]);
    expect(children.every((child) => child.killed)).toBe(true);
  });

  it("does not impose an artificial worker concurrency cap", async () => {
    const manager = createPiAgentManager({ shell: { trashItem: vi.fn() }, forkWorker: () => new FakeChild() });
    const webContents = { id: 8, isDestroyed: () => false, send: vi.fn() };
    await Promise.all(Array.from({ length: 12 }, (_, index) => manager.start(webContents, target(`parallel-${index}`))));
    expect(manager.listInstances(8)).toHaveLength(12);
    await manager.closeAll();
  });

  it("rejects duplicate session ownership across windows", async () => {
    const manager = createPiAgentManager({ shell: { trashItem: vi.fn() }, forkWorker: () => new FakeChild() });
    await manager.start({ id: 1, isDestroyed: () => false, send: vi.fn() }, target("shared"));

    await expect(manager.start({ id: 2, isDestroyed: () => false, send: vi.fn() }, target("shared"))).rejects.toThrow("already running");
    await manager.closeAll();
  });

  it("requires stopping a live instance before deleting its session", async () => {
    const trashItem = vi.fn();
    const manager = createPiAgentManager({ shell: { trashItem }, forkWorker: () => new FakeChild() });
    const webContents = { id: 3, isDestroyed: () => false, send: vi.fn() };
    await manager.start(webContents, target("delete-me"));

    await expect(manager.deleteSession(3, { sessionId: "delete-me", sessionPath: "/sessions/delete-me.jsonl" })).rejects.toThrow("Stop the Agent session");
    await manager.stop(3, "delete-me");
    await manager.deleteSession(3, { sessionId: "delete-me", sessionPath: "/sessions/delete-me.jsonl" });
    expect(trashItem).toHaveBeenCalledWith("/sessions/delete-me.jsonl");
  });
});
