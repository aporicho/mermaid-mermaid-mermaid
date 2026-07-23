import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPiAgentModelController } from "./pi-agent-models.mjs";

type ProviderOverview = {
  id: string;
  configurable: boolean;
  configured: boolean;
  origin: string;
  authOptions: Array<{ type: string; label: string; interactive: boolean }>;
};

describe("Pi Agent model controller", () => {
  const tempDirectories: string[] = [];
  const originalOffline = process.env.PI_OFFLINE;

  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
    if (originalOffline === undefined) delete process.env.PI_OFFLINE;
    else process.env.PI_OFFLINE = originalOffline;
  });

  async function setup(requestHost = vi.fn().mockResolvedValue({ value: "test-secret" })) {
    process.env.PI_OFFLINE = "1";
    const agentDir = mkdtempSync(join(tmpdir(), "mmm-agent-models-"));
    tempDirectories.push(agentDir);
    const modelRuntime = await ModelRuntime.create({
      modelsPath: join(agentDir, "models.json"),
      authPath: join(agentDir, "auth.json"),
      allowModelNetwork: false
    });
    const builtinProviderIds = new Set(modelRuntime.getProviders().map((provider) => provider.id));
    const runtime = { session: { modelRuntime }, services: { agentDir } };
    const events: unknown[] = [];
    const controller = createPiAgentModelController({
      getRuntime: () => runtime,
      builtinProviderIds,
      requestHost,
      send: (event: unknown) => events.push(event),
      readableError: (error: unknown) => error instanceof Error ? error.message : String(error)
    });
    return { agentDir, controller, events, modelRuntime };
  }

  it("derives authentication choices for every runtime provider, including both OpenAI paths", async () => {
    const { controller, modelRuntime } = await setup();
    const overview = await controller.overview();
    const providers = overview.providers as ProviderOverview[];

    expect(providers).toHaveLength(modelRuntime.getProviders().length);
    expect(providers.every((provider) => provider.configurable)).toBe(true);
    expect(providers.find((provider) => provider.id === "openai")?.authOptions).toEqual([
      expect.objectContaining({ type: "api_key", label: "OpenAI API key", interactive: true })
    ]);
    expect(providers.find((provider) => provider.id === "openai-codex")?.authOptions).toEqual([
      expect.objectContaining({ type: "oauth", interactive: true })
    ]);
  });

  it("persists a custom provider atomically, keeps its key out of models.json, and can remove the override", async () => {
    const { agentDir, controller, modelRuntime } = await setup();
    const initial = await controller.overview();

    await controller.upsertConfig({
      providerId: "local-compatible",
      custom: true,
      expectedRevision: initial.config.revision,
      provider: {
        name: "Local Compatible",
        baseUrl: "http://127.0.0.1:11434/v1",
        api: "openai-completions",
        authMode: "stored",
        models: [{
          id: "local-model",
          name: "Local Model",
          reasoning: false,
          input: ["text"],
          contextWindow: 32768,
          maxTokens: 4096
        }]
      }
    });
    await controller.login({ providerId: "local-compatible", authType: "api_key" });

    const configured = await controller.overview();
    const configuredProviders = configured.providers as ProviderOverview[];
    const modelsText = readFileSync(join(agentDir, "models.json"), "utf8");
    expect(configuredProviders.find((provider) => provider.id === "local-compatible")).toMatchObject({ origin: "custom", configured: true });
    expect(configured.models).toEqual(expect.arrayContaining([expect.objectContaining({ provider: "local-compatible", id: "local-model" })]));
    expect(modelsText).not.toContain("test-secret");
    expect(statSync(join(agentDir, "models.json")).mode & 0o777).toBe(0o600);
    expect(await modelRuntime.listCredentials()).toEqual(expect.arrayContaining([expect.objectContaining({ providerId: "local-compatible", type: "api_key" })]));

    await controller.deleteConfig({ providerId: "local-compatible", expectedRevision: configured.config.revision });
    const removed = await controller.overview();
    expect((removed.providers as ProviderOverview[]).some((provider) => provider.id === "local-compatible")).toBe(false);
  });

  it("cancels an in-flight provider prompt without waiting for the control queue", async () => {
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const requestHost = vi.fn((_method: string, _params: unknown, signals: AbortSignal[]) => new Promise((_resolve, reject) => {
      markStarted?.();
      signals[0].addEventListener("abort", () => {
        const error = new Error("cancelled");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }));
    const { controller, events } = await setup(requestHost);

    const login = controller.login({ providerId: "openai", authType: "api_key" });
    await started;
    expect(controller.cancelLogin("openai")).toBe(true);
    await expect(login).rejects.toThrow("认证已取消");
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: expect.objectContaining({ type: "auth_result", status: "cancelled" }) })
    ]));
  });
});
