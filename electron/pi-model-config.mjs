/* global URL, process, structuredClone */

import crypto from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";
import lockfile from "proper-lockfile";

export const SUPPORTED_MODEL_APIS = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai"
];

const DEFAULT_MODELS_TEXT = "{\n  \"providers\": {}\n}\n";
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function readModelConfigSnapshot(path) {
  const text = existsSync(path) ? readFileSync(path, "utf8") : DEFAULT_MODELS_TEXT;
  const parsed = parseModelConfigText(text);
  return {
    path,
    revision: textRevision(text),
    error: parsed.error,
    providers: parsed.error ? [] : Object.entries(parsed.value.providers || {}).map(([id, provider]) => sanitizeProvider(id, provider))
  };
}

export function parseModelConfigText(text) {
  const errors = [];
  const value = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) {
    const first = errors[0];
    return { value: { providers: {} }, error: `${printParseErrorCode(first.error)}（位置 ${first.offset}）` };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { value: { providers: {} }, error: "models.json 必须是 JSON 对象。" };
  const providers = value.providers;
  if (providers !== undefined && (!providers || typeof providers !== "object" || Array.isArray(providers))) {
    return { value: { providers: {} }, error: "models.json.providers 必须是对象。" };
  }
  return { value: { ...value, providers: providers || {} }, error: null };
}

export function updateProviderConfigText(text, providerId, provider) {
  const parsed = parseModelConfigText(text);
  if (parsed.error) throw new Error(parsed.error);
  const edits = modify(text, ["providers", providerId], provider, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" }
  });
  return ensureTrailingNewline(applyEdits(text, edits));
}

export function providerConfigFromInput(current, input) {
  const next = current && typeof current === "object" && !Array.isArray(current) ? structuredClone(current) : {};
  assignOptionalString(next, "name", input.name);
  assignOptionalString(next, "baseUrl", input.baseUrl);
  assignOptionalString(next, "api", input.api);
  if (typeof input.authHeader === "boolean") next.authHeader = input.authHeader;

  const authMode = String(input.authMode || "preserve");
  if (authMode === "stored") {
    delete next.apiKey;
    if (next.oauth === "radius") delete next.oauth;
  } else if (authMode === "environment") {
    const envName = String(input.envName || "").trim();
    next.apiKey = `$${envName}`;
    if (next.oauth === "radius") delete next.oauth;
  } else if (authMode === "local") {
    next.apiKey = "local";
    if (next.oauth === "radius") delete next.oauth;
  } else if (authMode === "radius") {
    next.oauth = "radius";
    delete next.apiKey;
  }

  if (Array.isArray(input.models)) {
    next.models = input.models.map((model) => cleanModelInput(model));
  }
  if (input.compat && typeof input.compat === "object" && !Array.isArray(input.compat)) {
    const compat = { ...(next.compat && typeof next.compat === "object" ? next.compat : {}) };
    for (const key of ["supportsDeveloperRole", "supportsReasoningEffort"]) {
      if (typeof input.compat[key] === "boolean") compat[key] = input.compat[key];
    }
    if (Object.keys(compat).length) next.compat = compat;
  }
  if (Array.isArray(input.headers)) {
    const currentHeaders = next.headers && typeof next.headers === "object" && !Array.isArray(next.headers) ? next.headers : {};
    const headers = {};
    for (const row of input.headers) {
      const name = String(row?.name || "").trim();
      if (!name) continue;
      if (Object.prototype.hasOwnProperty.call(headers, name)) throw new Error(`Header 名称重复：${name}`);
      const value = typeof row?.value === "string" ? row.value : "";
      if (value) headers[name] = value;
      else if (row?.preserve && typeof currentHeaders[name] === "string") headers[name] = currentHeaders[name];
      else throw new Error(`Header ${name} 缺少值。`);
    }
    if (Object.keys(headers).length) next.headers = headers;
    else delete next.headers;
  }
  return next;
}

export function validateProviderConfig(providerId, provider, { builtIn = false } = {}) {
  const id = String(providerId || "").trim();
  if (!PROVIDER_ID_PATTERN.test(id)) throw new Error("Provider ID 只能使用小写字母、数字、点、下划线和短横线，且必须以字母或数字开头。");
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) throw new Error("Provider 配置无效。");
  if (provider.baseUrl !== undefined) validateHttpUrl(provider.baseUrl, "Base URL");
  if (provider.api !== undefined && !SUPPORTED_MODEL_APIS.includes(provider.api)) throw new Error(`不支持的 API 协议：${provider.api}`);
  if (provider.oauth !== undefined && provider.oauth !== "radius") throw new Error("自定义 OAuth 目前仅支持 Radius。");
  if (provider.oauth === "radius" && !provider.baseUrl) throw new Error("Radius OAuth 必须提供 Base URL。");
  if (typeof provider.apiKey === "string" && /^\$/.test(provider.apiKey) && !/^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(provider.apiKey)) {
    throw new Error("环境变量名格式无效。");
  }
  if (provider.headers !== undefined) {
    if (!provider.headers || typeof provider.headers !== "object" || Array.isArray(provider.headers)) throw new Error("Headers 必须是键值对象。");
    for (const [name, value] of Object.entries(provider.headers)) {
      if (!name.trim() || typeof value !== "string" || !value) throw new Error("Header 名称和值不能为空。");
    }
  }

  const models = Array.isArray(provider.models) ? provider.models : [];
  if (!builtIn && !provider.baseUrl) throw new Error("自定义 Provider 必须提供 Base URL。");
  if (!builtIn && !provider.api && !models.every((model) => SUPPORTED_MODEL_APIS.includes(model?.api))) {
    throw new Error("自定义 Provider 必须在 Provider 或每个模型上指定 API 协议。");
  }
  if (!builtIn && !models.length) throw new Error("自定义 Provider 至少需要一个模型。");

  const modelIds = new Set();
  for (const model of models) {
    const modelId = String(model?.id || "").trim();
    if (!modelId) throw new Error("模型 ID 不能为空。");
    if (modelIds.has(modelId)) throw new Error(`模型 ID 重复：${modelId}`);
    modelIds.add(modelId);
    if (model.api !== undefined && !SUPPORTED_MODEL_APIS.includes(model.api)) throw new Error(`模型 ${modelId} 使用了不支持的 API 协议。`);
    if (model.baseUrl !== undefined) validateHttpUrl(model.baseUrl, `模型 ${modelId} Base URL`);
    if (model.contextWindow !== undefined && (!Number.isFinite(model.contextWindow) || model.contextWindow <= 0)) throw new Error(`模型 ${modelId} 的上下文长度必须大于 0。`);
    if (model.maxTokens !== undefined && (!Number.isFinite(model.maxTokens) || model.maxTokens <= 0)) throw new Error(`模型 ${modelId} 的最大输出必须大于 0。`);
    if (model.contextWindow && model.maxTokens && model.maxTokens > model.contextWindow) throw new Error(`模型 ${modelId} 的最大输出不能超过上下文长度。`);
  }
  return provider;
}

export async function mutateModelConfigLocked(path, expectedRevision, mutate) {
  mkdirSync(dirname(path), { recursive: true });
  const release = await lockfile.lock(dirname(path), { realpath: false, lockfilePath: `${path}.lock` });
  try {
    const original = existsSync(path) ? readFileSync(path, "utf8") : DEFAULT_MODELS_TEXT;
    const revision = textRevision(original);
    if (expectedRevision && expectedRevision !== revision) throw new Error("模型配置已在其他窗口中改变，请重新载入后再保存。");
    const next = await mutate(original);
    atomicWritePrivate(path, next);
    return { original, next, revision: textRevision(next) };
  } finally {
    await release();
  }
}

export function atomicWritePrivate(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  writeFileSync(temporary, ensureTrailingNewline(text), { encoding: "utf8", mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
  chmodSync(path, 0o600);
}

export function textRevision(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sanitizeProvider(id, providerValue) {
  const provider = providerValue && typeof providerValue === "object" && !Array.isArray(providerValue) ? providerValue : {};
  return {
    id,
    name: typeof provider.name === "string" ? provider.name : id,
    baseUrl: typeof provider.baseUrl === "string" ? provider.baseUrl : "",
    api: typeof provider.api === "string" ? provider.api : "",
    oauth: provider.oauth === "radius" ? "radius" : null,
    authHeader: Boolean(provider.authHeader),
    credential: credentialSummary(provider.apiKey, provider.oauth),
    headerKeys: provider.headers && typeof provider.headers === "object" ? Object.keys(provider.headers) : [],
    compat: sanitizeCompat(provider.compat),
    models: Array.isArray(provider.models) ? provider.models.map(sanitizeModel) : [],
    hasModelOverrides: Boolean(provider.modelOverrides && typeof provider.modelOverrides === "object")
  };
}

function credentialSummary(apiKey, oauth) {
  if (oauth === "radius") return { mode: "radius", source: "Radius OAuth" };
  if (typeof apiKey !== "string") return { mode: "stored", source: "auth.json / ambient" };
  if (/^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(apiKey)) return { mode: "environment", source: apiKey, envName: apiKey.replace(/^\$\{?/, "").replace(/\}$/, "") };
  if (apiKey === "local") return { mode: "local", source: "本地免认证占位" };
  if (apiKey.startsWith("!")) return { mode: "preserve", source: "命令（已隐藏）" };
  return { mode: "preserve", source: "字面凭据（已隐藏）" };
}

function sanitizeCompat(value) {
  const compat = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    supportsDeveloperRole: compat.supportsDeveloperRole !== false,
    supportsReasoningEffort: compat.supportsReasoningEffort !== false
  };
}

function sanitizeModel(modelValue) {
  const model = modelValue && typeof modelValue === "object" && !Array.isArray(modelValue) ? modelValue : {};
  return {
    id: typeof model.id === "string" ? model.id : "",
    name: typeof model.name === "string" ? model.name : "",
    api: typeof model.api === "string" ? model.api : "",
    baseUrl: typeof model.baseUrl === "string" ? model.baseUrl : "",
    reasoning: Boolean(model.reasoning),
    input: Array.isArray(model.input) ? model.input.filter((value) => value === "text" || value === "image") : ["text"],
    contextWindow: Number.isFinite(model.contextWindow) ? model.contextWindow : 128000,
    maxTokens: Number.isFinite(model.maxTokens) ? model.maxTokens : 32000
  };
}

function cleanModelInput(modelValue) {
  const model = modelValue && typeof modelValue === "object" && !Array.isArray(modelValue) ? modelValue : {};
  const result = {
    id: String(model.id || "").trim(),
    reasoning: Boolean(model.reasoning),
    input: Array.isArray(model.input) && model.input.includes("image") ? ["text", "image"] : ["text"],
    contextWindow: Number(model.contextWindow),
    maxTokens: Number(model.maxTokens)
  };
  for (const key of ["name", "api", "baseUrl"]) {
    const value = String(model[key] || "").trim();
    if (value) result[key] = value;
  }
  return result;
}

function assignOptionalString(target, key, value) {
  if (value === undefined) return;
  const normalized = String(value || "").trim();
  if (normalized) target[key] = normalized;
  else delete target[key];
}

function validateHttpUrl(value, label) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error(`${label} 不是有效 URL。`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${label} 只支持 HTTP 或 HTTPS。`);
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
