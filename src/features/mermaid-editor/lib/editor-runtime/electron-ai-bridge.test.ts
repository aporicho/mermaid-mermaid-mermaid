import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createAiBridge } = require("../../../../../electron/ai-bridge.cjs") as {
  createAiBridge: (appVersion: string, options?: { discoveryDir?: string }) => {
    start: () => Promise<{ serverUrl: string; token: string }>;
    close: () => Promise<void>;
    publishContext: (context: unknown) => void;
    takeNextCommand: () => unknown;
    finishCommand: (result: unknown) => void;
  };
};

const bridges: Array<{ close: () => Promise<void> }> = [];

describe("Electron AI bridge", () => {
  afterEach(async () => {
    await Promise.all(bridges.splice(0).map((bridge) => bridge.close()));
  });

  it("serves context and command results through the CLI-compatible HTTP bridge", async () => {
    const discoveryDir = await mkdtemp(join(tmpdir(), "mmm-ai-bridge-"));
    const bridge = createAiBridge("0.1.0-test", { discoveryDir });
    bridges.push(bridge);
    const { serverUrl, token } = await bridge.start();

    bridge.publishContext({ updatedAt: "2026-07-03T10:00:00.000Z", activeFile: { name: "demo.mmd" } });

    const context = await fetchJson(`${serverUrl}/api/ai/context`, token);
    expect(context).toMatchObject({ ok: true, context: { activeFile: { name: "demo.mmd" } } });

    const submitted = await fetchJson(`${serverUrl}/api/ai/commands`, token, {
      method: "POST",
      body: JSON.stringify({ type: "applyPatch", targetFileName: "demo.mmd", ops: [{ op: "noop" }] })
    });
    expect(submitted).toMatchObject({ ok: true, command: { type: "applyPatch", targetFileName: "demo.mmd" } });
    expect(bridge.takeNextCommand()).toMatchObject({ id: submitted.command.id, ops: [{ op: "noop" }] });

    bridge.finishCommand({ commandId: submitted.command.id, applied: true, diagnostics: [] });
    const result = await fetchJson(`${serverUrl}/api/ai/commands/${submitted.command.id}`, token);
    expect(result).toMatchObject({ ok: true, status: "complete", result: { applied: true } });

    const discovery = JSON.parse(await readFile(join(discoveryDir, "bridge.json"), "utf8"));
    expect(discovery).toMatchObject({ token, appVersion: "0.1.0-test" });
    expect(discovery.port).toBeGreaterThan(0);
  });

  it("rejects requests without the discovery token", async () => {
    const bridge = createAiBridge("0.1.0-test", { discoveryDir: await mkdtemp(join(tmpdir(), "mmm-ai-bridge-")) });
    bridges.push(bridge);
    const { serverUrl } = await bridge.start();

    const response = await fetch(`${serverUrl}/api/ai/ping`);

    expect(response.status).toBe(401);
  });
});

async function fetchJson(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });
  return response.json();
}
