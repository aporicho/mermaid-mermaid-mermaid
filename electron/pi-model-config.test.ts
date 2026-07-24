import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  mutateModelConfigLocked,
  parseModelConfigText,
  providerConfigFromInput,
  readModelConfigSnapshot,
  textRevision,
  updateProviderConfigText,
  validateProviderConfig
} from "./pi-model-config.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Pi model config", () => {
  it("updates one provider while preserving comments and unrelated fields", () => {
    const original = `{
  // keep this comment
  "customTopLevel": true,
  "providers": {
    "existing": { "baseUrl": "https://old.example/v1", "api": "openai-completions", "models": [{ "id": "old" }] }
  }
}\n`;
    const next = updateProviderConfigText(original, "new-provider", {
      baseUrl: "https://new.example/v1",
      api: "openai-responses",
      models: [{ id: "new" }]
    });
    const parsed = parseModelConfigText(next);

    expect(next).toContain("// keep this comment");
    expect(parsed.error).toBeNull();
    expect(parsed.value.customTopLevel).toBe(true);
    expect(parsed.value.providers.existing.models[0].id).toBe("old");
    expect(parsed.value.providers["new-provider"].api).toBe("openai-responses");
  });

  it("never exposes literal credentials or header values in snapshots", () => {
    const directory = createTemporaryDirectory();
    const path = join(directory, "models.json");
    writeFileSync(path, JSON.stringify({ providers: {
      secret: {
        baseUrl: "https://example.com/v1",
        api: "openai-completions",
        apiKey: "top-secret-key",
        headers: { "X-Secret": "secret-header" },
        models: [{ id: "model" }]
      }
    } }));

    const snapshot = readModelConfigSnapshot(path);
    expect(JSON.stringify(snapshot)).not.toContain("top-secret-key");
    expect(JSON.stringify(snapshot)).not.toContain("secret-header");
    expect(snapshot.providers[0].credential.source).toContain("已隐藏");
    expect(snapshot.providers[0].headerKeys).toEqual(["X-Secret"]);
  });

  it("validates provider identifiers, endpoints and model limits", () => {
    expect(() => validateProviderConfig("Bad Provider", {}, { builtIn: false })).toThrow(/Provider ID/);
    expect(() => validateProviderConfig("local", {
      baseUrl: "file:///tmp/model",
      api: "openai-completions",
      models: [{ id: "model" }]
    })).toThrow(/HTTP/);
    expect(() => validateProviderConfig("local", {
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      models: [{ id: "model", contextWindow: 1000, maxTokens: 2000 }]
    })).toThrow(/不能超过/);
  });

  it("preserves hidden credential sources unless the user explicitly replaces them", () => {
    const current = {
      baseUrl: "https://example.com/v1",
      api: "openai-completions",
      apiKey: "!security read secret",
      headers: { Authorization: "$CUSTOM_HEADER" },
      unknown: { keep: true },
      models: [{ id: "old" }]
    };
    const next = providerConfigFromInput(current, {
      name: "Updated",
      authMode: "preserve",
      models: [{ id: "new", contextWindow: 128000, maxTokens: 32000 }]
    });

    expect(next.apiKey).toBe("!security read secret");
    expect(next.headers).toEqual(current.headers);
    expect(next.unknown).toEqual({ keep: true });
    expect(next.models[0].id).toBe("new");
  });

  it("uses revision checks and writes the resulting file privately", async () => {
    const directory = createTemporaryDirectory();
    const path = join(directory, "models.json");
    const original = "{\n  \"providers\": {}\n}\n";
    writeFileSync(path, original);

    const mutation = await mutateModelConfigLocked(path, textRevision(original), async (text) => updateProviderConfigText(text, "local", {
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      apiKey: "local",
      models: [{ id: "qwen" }]
    }));

    expect(readFileSync(path, "utf8")).toContain('"local"');
    expect(mutation.revision).toBe(textRevision(mutation.next));
    await expect(mutateModelConfigLocked(path, textRevision(original), async (text) => text)).rejects.toThrow(/其他窗口/);
  });
});

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "mmm-pi-model-config-"));
  temporaryDirectories.push(directory);
  return directory;
}
