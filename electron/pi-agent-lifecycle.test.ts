// @vitest-environment node

import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { DEFAULT_IDLE_TIMEOUT_MS, createPiAgentLifecycle } = require("./pi-agent-lifecycle.cjs") as {
  DEFAULT_IDLE_TIMEOUT_MS: number;
  createPiAgentLifecycle: (options: { onChange: (state: unknown) => void; onExpire: () => void; idleTimeoutMs?: number }) => {
    snapshot: () => { status: string; foreground: boolean };
    setStatus: (status: string) => void;
    setForeground: (foreground: boolean) => void;
    dispose: () => void;
  };
};

afterEach(() => vi.useRealTimers());

describe("Pi Agent instance lifecycle", () => {
  it("reclaims only background idle instances after fifteen minutes", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const lifecycle = createPiAgentLifecycle({ onChange: vi.fn(), onExpire: expire });

    lifecycle.setStatus("idle");
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 1);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledOnce();
  });

  it("never reclaims foreground, running, or waiting instances", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const lifecycle = createPiAgentLifecycle({ onChange: vi.fn(), onExpire: expire });

    lifecycle.setStatus("idle");
    lifecycle.setForeground(true);
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    lifecycle.setForeground(false);
    lifecycle.setStatus("running");
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    lifecycle.setStatus("waiting");
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    expect(expire).not.toHaveBeenCalled();
  });
});
