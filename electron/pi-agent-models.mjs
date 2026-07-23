/* global AbortController, process */

import crypto from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ModelRuntime } from "@earendil-works/pi-coding-agent";

import {
  mutateModelConfigLocked,
  parseModelConfigText,
  providerConfigFromInput,
  readModelConfigSnapshot,
  updateProviderConfigText,
  validateProviderConfig
} from "./pi-model-config.mjs";

export function createPiAgentModelController({ getRuntime, builtinProviderIds, requestHost, send, readableError }) {
  let activeLogin = null;

  function runtime() {
    const value = getRuntime();
    if (!value) throw new Error("Pi Agent is not ready.");
    return value;
  }

  async function overview() {
    const activeRuntime = runtime();
    const modelRuntime = activeRuntime.session.modelRuntime;
    const credentials = await modelRuntime.listCredentials();
    const available = await modelRuntime.getAvailable().catch(() => []);
    const availableKeys = new Set(available.map((model) => `${model.provider}:${model.id}`));
    const config = readModelConfigSnapshot(modelConfigPath(activeRuntime));
    const configuredProviderIds = new Set(config.providers.map((provider) => provider.id));
    const registeredProviderIds = new Set(modelRuntime.getRegisteredProviderIds());
    return {
      providers: modelRuntime.getProviders().map((provider) => {
        const origin = builtinProviderIds.has(provider.id) ? "built-in" : registeredProviderIds.has(provider.id) ? "extension" : "custom";
        const status = modelRuntime.getProviderAuthStatus(provider.id);
        return {
          id: provider.id,
          name: provider.name,
          authOptions: [
            provider.auth.oauth ? {
              type: "oauth",
              label: provider.auth.oauth.loginLabel || provider.auth.oauth.name,
              interactive: true
            } : null,
            provider.auth.apiKey ? {
              type: "api_key",
              label: provider.auth.apiKey.name,
              interactive: typeof provider.auth.apiKey.login === "function" || origin === "custom"
            } : null
          ].filter(Boolean),
          configured: status.configured,
          status,
          configurable: true,
          configPresent: configuredProviderIds.has(provider.id),
          origin
        };
      }),
      credentials,
      config,
      models: modelRuntime.getModels().map((model) => ({
        ...sanitizeModel(model),
        available: availableKeys.has(`${model.provider}:${model.id}`)
      }))
    };
  }

  async function login(command) {
    const providerId = String(command.providerId || "");
    const authType = command.authType === "oauth" ? "oauth" : "api_key";
    if (activeLogin) throw new Error(`正在配置 ${activeLogin.providerId}，请先完成或取消当前认证。`);
    const controller = new AbortController();
    activeLogin = { providerId, controller };
    try {
      const modelRuntime = runtime().session.modelRuntime;
      const provider = modelRuntime.getProvider(providerId);
      if (!provider) throw new Error(`未知 Provider：${providerId}`);
      const interaction = {
        signal: controller.signal,
        async prompt(prompt) {
          const result = await requestHost(
            "auth_prompt",
            { providerId, prompt: sanitizeAuthPrompt(prompt) },
            [controller.signal, prompt.signal].filter(Boolean)
          );
          if (typeof result?.value !== "string") throw abortError("认证已取消。");
          return result.value;
        },
        notify(event) {
          send({ type: "control_event", event: { type: "auth", providerId, event } });
        }
      };
      if (authType === "api_key" && provider.auth.apiKey && typeof provider.auth.apiKey.login !== "function" && !builtinProviderIds.has(providerId)) {
        const key = await interaction.prompt({ type: "secret", message: `${provider.name} API Key`, placeholder: "输入后将安全保存到 auth.json" });
        await modelRuntime.credentials.modify(providerId, async () => ({ type: "api_key", key }));
      } else {
        await modelRuntime.login(providerId, authType, interaction);
      }
      await modelRuntime.refresh({ allowNetwork: true }).catch(() => undefined);
      send({ type: "control_event", event: { type: "auth_result", providerId, status: "success" } });
      return overview();
    } catch (error) {
      const cancelled = controller.signal.aborted || error?.name === "AbortError";
      send({ type: "control_event", event: { type: "auth_result", providerId, status: cancelled ? "cancelled" : "error", message: readableError(error) } });
      if (cancelled) throw new Error("认证已取消。");
      throw error;
    } finally {
      if (activeLogin?.controller === controller) activeLogin = null;
    }
  }

  async function logout(command) {
    await runtime().session.modelRuntime.logout(String(command.providerId));
    return overview();
  }

  async function validateConfig(command) {
    const providerId = String(command.providerId || "").trim();
    const { current, builtIn } = currentProviderConfig(runtime(), builtinProviderIds, providerId, command);
    const provider = providerConfigFromInput(current, command.provider || {});
    validateProviderConfig(providerId, provider, { builtIn });
    const text = updateProviderConfigText(readModelConfigText(runtime()), providerId, provider);
    await validateModelConfigCandidate(runtime(), text);
    return { valid: true };
  }

  async function upsertConfig(command) {
    const activeRuntime = runtime();
    const providerId = String(command.providerId || "").trim();
    const path = modelConfigPath(activeRuntime);
    const mutation = await mutateModelConfigLocked(path, command.expectedRevision, async (text) => {
      const parsed = parseModelConfigText(text);
      if (parsed.error) throw new Error(parsed.error);
      const current = parsed.value.providers?.[providerId];
      const builtIn = providerConfigIsBuiltIn(activeRuntime, builtinProviderIds, providerId, command);
      const provider = providerConfigFromInput(current, command.provider || {});
      validateProviderConfig(providerId, provider, { builtIn });
      const next = updateProviderConfigText(text, providerId, provider);
      await validateModelConfigCandidate(activeRuntime, next);
      return next;
    });
    await reloadOrRollback(activeRuntime, path, mutation, "模型配置未能载入");
    return overview();
  }

  async function deleteConfig(command) {
    const activeRuntime = runtime();
    const providerId = String(command.providerId || "").trim();
    const path = modelConfigPath(activeRuntime);
    const mutation = await mutateModelConfigLocked(path, command.expectedRevision, async (text) => {
      const parsed = parseModelConfigText(text);
      if (parsed.error) throw new Error(parsed.error);
      if (!Object.prototype.hasOwnProperty.call(parsed.value.providers || {}, providerId)) throw new Error("该 Provider 没有 models.json 配置。");
      const next = updateProviderConfigText(text, providerId, undefined);
      await validateModelConfigCandidate(activeRuntime, next);
      return next;
    });
    await reloadOrRollback(activeRuntime, path, mutation, "删除后的模型配置未能载入");
    return overview();
  }

  function cancelLogin(providerId) {
    if (!activeLogin) return false;
    if (providerId && String(providerId) !== activeLogin.providerId) return false;
    activeLogin.controller.abort();
    return true;
  }

  return { overview, login, logout, validateConfig, upsertConfig, deleteConfig, cancelLogin };

  async function reloadOrRollback(activeRuntime, path, mutation, failureLabel) {
    try {
      await activeRuntime.session.modelRuntime.reloadConfig();
    } catch (error) {
      await mutateModelConfigLocked(path, mutation.revision, async () => mutation.original);
      await activeRuntime.session.modelRuntime.reloadConfig().catch(() => undefined);
      throw new Error(`${failureLabel}，已恢复原文件：${readableError(error)}`);
    }
  }
}

function currentProviderConfig(runtime, builtinProviderIds, providerId, command) {
  const parsed = parseModelConfigText(readModelConfigText(runtime));
  if (parsed.error) throw new Error(parsed.error);
  return {
    current: parsed.value.providers?.[providerId],
    builtIn: providerConfigIsBuiltIn(runtime, builtinProviderIds, providerId, command)
  };
}

function providerConfigIsBuiltIn(runtime, builtinProviderIds, providerId, command) {
  if (command.custom === true) return false;
  return builtinProviderIds.has(providerId) || runtime.session.modelRuntime.getRegisteredProviderIds().includes(providerId);
}

async function validateModelConfigCandidate(runtime, text) {
  const path = join(runtime.services.agentDir, `.models.validate.${process.pid}.${crypto.randomUUID()}.json`);
  const authPath = `${path}.auth.json`;
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
  try {
    const candidate = await ModelRuntime.create({ modelsPath: path, authPath, allowModelNetwork: false });
    const error = candidate.getError();
    if (error) throw new Error(error);
  } finally {
    rmSync(path, { force: true });
    rmSync(authPath, { force: true });
  }
}

function modelConfigPath(runtime) {
  return join(runtime.services.agentDir, "models.json");
}

function readModelConfigText(runtime) {
  const path = modelConfigPath(runtime);
  return existsSync(path) ? readFileSync(path, "utf8") : "{\n  \"providers\": {}\n}\n";
}

function sanitizeModel(model) {
  if (!model) return null;
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    api: model.api,
    reasoning: Boolean(model.reasoning),
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens
  };
}

function sanitizeAuthPrompt(prompt) {
  return {
    type: prompt.type,
    message: prompt.message,
    placeholder: prompt.placeholder,
    options: prompt.type === "select" ? prompt.options : undefined
  };
}

function abortError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}
