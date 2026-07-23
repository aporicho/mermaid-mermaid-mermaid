import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  EditorRuntime,
  RuntimeAgentDocumentBridge,
  RuntimeAgentDocumentSummary,
  RuntimeAgentEvent,
  RuntimeAgentReference,
  RuntimeAgentRpcCommand,
  RuntimeAgentState
} from "@/features/mermaid-editor/lib/editor-runtime";

export type AgentTranscriptMode = "normal" | "verbose" | "summary";

export type AgentChatMessage = {
  kind: "message";
  id: string;
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  error?: boolean;
  streaming?: boolean;
};

export type AgentToolActivity = {
  kind: "tool";
  id: string;
  toolCallId: string;
  name: string;
  args?: unknown;
  result?: unknown;
  status: "running" | "complete" | "error";
};

export type AgentTranscriptNotice = {
  kind: "notice";
  id: string;
  text: string;
  tone: "neutral" | "danger";
};

export type AgentTranscriptItem = AgentChatMessage | AgentToolActivity | AgentTranscriptNotice;

export type AgentInteractionRequest = {
  id: string;
  source: "host" | "extension";
  method: string;
  title: string;
  message?: string;
  placeholder?: string;
  secret?: boolean;
  options?: Array<{ id: string; label: string; description?: string }>;
  raw: Record<string, unknown>;
};

export type AgentController = ReturnType<typeof useAgentSession>;

type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type AgentUiPreferences = {
  sidebarOpen: boolean;
  transcriptMode: AgentTranscriptMode;
  drafts: Record<string, string>;
  references: Record<string, RuntimeAgentReference[]>;
};

const DEFAULT_UI_PREFERENCES: AgentUiPreferences = {
  sidebarOpen: true,
  transcriptMode: "normal",
  drafts: {},
  references: {}
};
const DEFAULT_RPC_TIMEOUT_MS = 30_000;
const LONG_RPC_TIMEOUT_MS = 30 * 60_000;

export function useAgentSession({
  runtime,
  enabled,
  cwd,
  projectRoot,
  documentBridge
}: {
  runtime: EditorRuntime;
  enabled: boolean;
  cwd?: string;
  projectRoot?: string;
  documentBridge: RuntimeAgentDocumentBridge;
}) {
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [workerState, setWorkerState] = useState<RuntimeAgentState | null>(null);
  const [sessionState, setSessionState] = useState<Record<string, unknown> | null>(null);
  const [transcript, setTranscript] = useState<AgentTranscriptItem[]>([]);
  const [commands, setCommands] = useState<Array<{ name: string; description?: string; source: string }>>([]);
  const [availableModels, setAvailableModels] = useState<Array<Record<string, unknown>>>([]);
  const [availableThinkingLevels, setAvailableThinkingLevels] = useState<string[]>(["off"]);
  const [overview, setOverview] = useState<Record<string, any> | null>(null);
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<AgentInteractionRequest | null>(null);
  const [documents, setDocuments] = useState<RuntimeAgentDocumentSummary[]>([]);
  const [composerRequest, setComposerRequest] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const preferenceKey = useMemo(() => `mmm:agent-ui:v1:${projectRoot || cwd || "scratch"}`, [cwd, projectRoot]);
  const [preferenceState, setPreferenceState] = useState(() => ({ key: preferenceKey, value: readUiPreferences(preferenceKey) }));
  const pendingRpcRef = useRef(new Map<string, PendingRpc>());
  const rpcCounterRef = useRef(0);
  const optimisticMessageCounterRef = useRef(0);
  const streamingTextRef = useRef("");
  const streamingThinkingRef = useRef("");
  const streamingFrameRef = useRef<number | null>(null);
  const documentBridgeRef = useRef(documentBridge);
  const overviewPromiseRef = useRef<Promise<Record<string, any>> | null>(null);

  const sessionKey = String(sessionState?.sessionId || workerState?.sessionId || "pending");
  const preferences = preferenceState.key === preferenceKey ? preferenceState.value : DEFAULT_UI_PREFERENCES;
  const draft = preferences.drafts[sessionKey] || "";
  const explicitReferences = preferences.references[sessionKey] || [];

  useEffect(() => {
    documentBridgeRef.current = documentBridge;
  }, [documentBridge]);

  useEffect(() => {
    setPreferenceState({ key: preferenceKey, value: readUiPreferences(preferenceKey) });
  }, [preferenceKey]);

  useEffect(() => {
    if (preferenceState.key !== preferenceKey) return;
    writeUiPreferences(preferenceKey, preferenceState.value);
  }, [preferenceKey, preferenceState]);

  const updatePreferences = useCallback((update: (current: AgentUiPreferences) => AgentUiPreferences) => {
    setPreferenceState((current) => current.key === preferenceKey
      ? { ...current, value: update(current.value) }
      : { key: preferenceKey, value: update(readUiPreferences(preferenceKey)) });
  }, [preferenceKey]);

  const setDraft = useCallback((value: string) => {
    updatePreferences((current) => ({ ...current, drafts: { ...current.drafts, [sessionKey]: value } }));
  }, [sessionKey, updatePreferences]);

  const setExplicitReferences = useCallback((value: RuntimeAgentReference[]) => {
    updatePreferences((current) => ({ ...current, references: { ...current.references, [sessionKey]: value } }));
  }, [sessionKey, updatePreferences]);

  const setSidebarOpen = useCallback((open: boolean) => {
    updatePreferences((current) => ({ ...current, sidebarOpen: open }));
  }, [updatePreferences]);

  const setTranscriptMode = useCallback((mode: AgentTranscriptMode) => {
    updatePreferences((current) => ({ ...current, transcriptMode: mode }));
  }, [updatePreferences]);

  const rejectPendingRpcs = useCallback((reason: string) => {
    const pending = Array.from(pendingRpcRef.current.values());
    pendingRpcRef.current.clear();
    for (const item of pending) {
      clearTimeout(item.timeout);
      item.reject(new Error(reason));
    }
  }, []);

  const sendRpc = useCallback(async <T,>(command: RuntimeAgentRpcCommand): Promise<T> => {
    rpcCounterRef.current += 1;
    const id = command.id || `ui_rpc_${Date.now().toString(36)}_${rpcCounterRef.current}`;
    const timeoutMs = command.type === "prompt" || command.type === "compact" ? LONG_RPC_TIMEOUT_MS : DEFAULT_RPC_TIMEOUT_MS;
    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRpcRef.current.delete(id);
        reject(new Error(`Pi RPC ${command.type} timed out.`));
      }, timeoutMs);
      pendingRpcRef.current.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
    });
    try {
      const accepted = await runtime.sendAgentRpc({ ...command, id });
      if (!accepted.accepted) {
        const pending = pendingRpcRef.current.get(id);
        pendingRpcRef.current.delete(id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Pi RPC command was rejected."));
        }
      }
    } catch (sendError) {
      const pending = pendingRpcRef.current.get(id);
      pendingRpcRef.current.delete(id);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.reject(sendError instanceof Error ? sendError : new Error(String(sendError)));
      }
    }
    return promise;
  }, [runtime]);

  const refreshTranscript = useCallback(async () => {
    const response = await sendRpc<{ messages?: unknown[] }>({ type: "get_messages" });
    setTranscript(normalizeAgentTranscript(response?.messages || []));
  }, [sendRpc]);

  const refreshAvailableThinkingLevels = useCallback(async () => {
    const response = await sendRpc<{ levels?: string[] }>({ type: "get_available_thinking_levels" });
    const levels = Array.isArray(response?.levels) ? response.levels.map(String) : [];
    setAvailableThinkingLevels(levels.length ? levels : ["off"]);
    return levels;
  }, [sendRpc]);

  const refreshSessionState = useCallback(async () => {
    const state = await sendRpc<Record<string, unknown>>({ type: "get_state" });
    const normalized = normalizeAgentSessionState(state);
    setSessionState(normalized);
    return normalized;
  }, [sendRpc]);

  const refreshDocuments = useCallback(async () => {
    try {
      const snapshot = await documentBridgeRef.current.list();
      setDocuments(snapshot.documents);
      return snapshot;
    } catch {
      return { documents: [] as RuntimeAgentDocumentSummary[] };
    }
  }, []);

  const scheduleStreamingRender = useCallback(() => {
    if (streamingFrameRef.current !== null) return;
    const render = () => {
      streamingFrameRef.current = null;
      const text = streamingTextRef.current;
      const thinking = streamingThinkingRef.current;
      setTranscript((current) => upsertStreamingAssistant(current, text, thinking));
    };
    if (typeof requestAnimationFrame === "function") streamingFrameRef.current = requestAnimationFrame(render);
    else streamingFrameRef.current = Number(setTimeout(render, 32));
  }, []);

  const handleAgentEvent = useCallback((event: RuntimeAgentEvent) => {
    if (event.lane === "diagnostic") {
      if (event.payload.level === "error") setError(event.payload.message);
      return;
    }
    if (event.lane === "host") {
      const request = event.payload;
      if (request.method.startsWith("document.")) {
        void handleDocumentHostRequest(documentBridgeRef.current, request.method, request.params || {})
          .then((result) => runtime.respondAgentHost({ id: request.id, result }))
          .catch((requestError) => runtime.respondAgentHost({ id: request.id, error: readableError(requestError) }));
        return;
      }
      setInteraction(hostInteraction(request.id, request.method, request.params || {}));
      return;
    }
    if (event.lane === "control") {
      const payload = event.payload;
      if (payload.type === "ready") {
        setWorkerState((payload.state || null) as RuntimeAgentState | null);
        setStatus("ready");
      }
      if (payload.type === "stopped") {
        setStatus("idle");
        setActivity(null);
        rejectPendingRpcs("Pi Agent stopped before the command completed.");
      }
      if (payload.type === "package_progress") {
        const progress = payload.event as Record<string, unknown> | undefined;
        setActivity(String(progress?.message || progress?.action || "正在处理包"));
      }
      if (payload.type === "auth") {
        const authEvent = payload.event as Record<string, unknown> | undefined;
        if (authEvent?.type === "progress" || authEvent?.type === "info") setActivity(String(authEvent.message || "正在登录"));
        if (authEvent?.type === "auth_url") {
          setActivity(String(authEvent.instructions || "请在浏览器中完成登录"));
          const url = typeof authEvent.url === "string" ? authEvent.url : typeof authEvent.authUrl === "string" ? authEvent.authUrl : "";
          if (url) runtime.openExternalUrl(url);
        }
        if (authEvent?.type === "device_code") setActivity(`设备代码：${String(authEvent.userCode || "")}`);
      }
      return;
    }

    const payload = event.payload;
    if (payload.type === "response") {
      const id = typeof payload.id === "string" ? payload.id : "";
      const pending = pendingRpcRef.current.get(id);
      if (pending) {
        pendingRpcRef.current.delete(id);
        clearTimeout(pending.timeout);
        if (payload.success === false) pending.reject(new Error(String(payload.error || "Pi command failed.")));
        else pending.resolve(payload.data);
      }
      return;
    }
    if (payload.type === "extension_ui_request") {
      const method = String(payload.method || "");
      if (method === "notify" || method === "setStatus" || method === "setWidget" || method === "setTitle") {
        const message = payload.message || payload.statusText || payload.title;
        if (message) setActivity(String(message));
        return;
      }
      if (method === "set_editor_text") {
        setComposerRequest(String(payload.text || ""));
        return;
      }
      setInteraction(extensionInteraction(payload));
      return;
    }
    if (payload.type === "message_update") {
      const assistantEvent = payload.assistantMessageEvent as Record<string, unknown> | undefined;
      if (assistantEvent?.type === "text_delta") streamingTextRef.current += String(assistantEvent.delta || "");
      if (assistantEvent?.type === "thinking_delta") streamingThinkingRef.current += String(assistantEvent.delta || "");
      scheduleStreamingRender();
      return;
    }
    if (payload.type === "tool_execution_start") {
      const id = String(payload.toolCallId || `tool_${Date.now()}`);
      setTranscript((current) => upsertTool(current, {
        kind: "tool",
        id: `tool-${id}`,
        toolCallId: id,
        name: String(payload.toolName || "tool"),
        args: payload.args,
        status: "running"
      }));
      return;
    }
    if (payload.type === "tool_execution_update") {
      const id = String(payload.toolCallId || "");
      setTranscript((current) => current.map((item) => item.kind === "tool" && item.toolCallId === id ? { ...item, result: payload.partialResult } : item));
      return;
    }
    if (payload.type === "tool_execution_end") {
      const id = String(payload.toolCallId || "");
      setTranscript((current) => current.map((item) => item.kind === "tool" && item.toolCallId === id ? {
        ...item,
        result: payload.result,
        status: payload.isError ? "error" : "complete"
      } : item));
      return;
    }
    if (payload.type === "agent_settled") {
      streamingTextRef.current = "";
      streamingThinkingRef.current = "";
      setActivity(null);
      void Promise.all([refreshTranscript(), refreshSessionState(), refreshAvailableThinkingLevels()]).catch((refreshError) => setError(readableError(refreshError)));
    }
    if (payload.type === "model_select" || payload.type === "thinking_level_select" || payload.type === "session_info_changed") {
      void Promise.all([refreshSessionState(), refreshAvailableThinkingLevels()]).catch(() => undefined);
    }
  }, [refreshAvailableThinkingLevels, refreshSessionState, refreshTranscript, rejectPendingRpcs, runtime, scheduleStreamingRender]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void runtime.listenForAgentEvents((event) => {
      if (!disposed) handleAgentEvent(event);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleAgentEvent, runtime]);

  useEffect(() => () => {
    rejectPendingRpcs("Pi Agent view was disposed.");
    if (streamingFrameRef.current !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(streamingFrameRef.current);
  }, [rejectPendingRpcs]);

  useEffect(() => {
    if (!enabled) return;
    if (runtime.host !== "electron") {
      setStatus("error");
      setError("Pi Agent 仅在桌面版中可用。");
      return;
    }
    let disposed = false;
    setStatus("starting");
    setError(null);
    void runtime.startAgent({ cwd, projectRoot }).then(async (result) => {
      if (disposed) return;
      if (result.status === "unsupported") {
        setStatus("error");
        setError(result.message || "Pi Agent is unavailable.");
        return;
      }
      if (result.state) setWorkerState(result.state);
      setStatus("ready");
      const [state, messageData, commandData, modelData, thinkingData] = await Promise.all([
        sendRpc<Record<string, unknown>>({ type: "get_state" }),
        sendRpc<{ messages?: unknown[] }>({ type: "get_messages" }),
        sendRpc<{ commands?: Array<{ name: string; description?: string; source: string }> }>({ type: "get_commands" }),
        sendRpc<{ models?: Array<Record<string, unknown>> }>({ type: "get_available_models" }),
        sendRpc<{ levels?: string[] }>({ type: "get_available_thinking_levels" })
      ]);
      if (disposed) return;
      setSessionState(normalizeAgentSessionState(state));
      setTranscript(normalizeAgentTranscript(messageData.messages || []));
      setCommands(commandData.commands || []);
      setAvailableModels(modelData.models || []);
      setAvailableThinkingLevels(thinkingData.levels?.length ? thinkingData.levels.map(String) : ["off"]);
      await refreshDocuments();
    }).catch((startError) => {
      if (!disposed) {
        setStatus("error");
        setError(readableError(startError));
      }
    });
    return () => {
      disposed = true;
    };
  }, [cwd, enabled, projectRoot, refreshDocuments, runtime, sendRpc, startupAttempt]);

  const retryAgent = useCallback(async () => {
    setError(null);
    setStatus("starting");
    rejectPendingRpcs("Pi Agent is restarting.");
    try {
      await runtime.stopAgent();
    } finally {
      setStartupAttempt((current) => current + 1);
    }
  }, [rejectPendingRpcs, runtime]);

  const sendPrompt = useCallback(async (text: string, explicit: RuntimeAgentReference[] = []) => {
    const prompt = text.trim();
    if (!prompt) return;
    if (!sessionState?.model) throw new Error("请先连接并选择一个可用模型。");
    const workspace = await refreshDocuments();
    const active = workspace.documents.find((document) => document.active);
    const implicitReference = active?.selection && active.selection.text ? selectionReference(active) : null;
    const references = dedupeReferences([...(implicitReference ? [implicitReference] : []), ...explicit]);
    await runtime.runAgentControl({
      type: "set_turn_context",
      context: {
        sentAt: new Date().toISOString(),
        activeDocumentId: workspace.activeDocumentId,
        documents: workspace.documents,
        references
      }
    });
    optimisticMessageCounterRef.current += 1;
    const optimisticId = `optimistic-user-${optimisticMessageCounterRef.current}`;
    setTranscript((current) => [...current.filter((item) => item.id !== "streaming-assistant"), {
      kind: "message",
      id: optimisticId,
      role: "user",
      text: prompt
    }]);
    streamingTextRef.current = "";
    streamingThinkingRef.current = "";
    try {
      await sendRpc({
        type: "prompt",
        message: prompt,
        ...(sessionState?.isStreaming ? { streamingBehavior: "followUp" } : {})
      });
    } catch (promptError) {
      setTranscript((current) => current.filter((item) => item.id !== optimisticId));
      throw promptError;
    }
  }, [refreshDocuments, runtime, sendRpc, sessionState?.isStreaming, sessionState?.model]);

  const resolveInteraction = useCallback(async (result: { value?: string; confirmed?: boolean; index?: number; cancelled?: boolean }) => {
    const current = interaction;
    if (!current) return;
    setInteraction(null);
    if (current.source === "extension") await runtime.respondAgentExtensionUi({ id: current.id, ...result });
    else await runtime.respondAgentHost({ id: current.id, result });
  }, [interaction, runtime]);

  const loadOverview = useCallback(async (force = false) => {
    if (overview && !force) return overview;
    if (overviewPromiseRef.current) return overviewPromiseRef.current;
    setOverviewBusy(true);
    const request = runtime.runAgentControl<Record<string, any>>({ type: "overview" });
    overviewPromiseRef.current = request;
    try {
      const next = await request;
      setOverview(next);
      const overviewModels = Array.isArray(next.models?.models) ? next.models.models : [];
      setAvailableModels(overviewModels.filter((model: Record<string, unknown>) => model.available));
      if (Array.isArray(next.commands)) setCommands(next.commands);
      return next;
    } finally {
      if (overviewPromiseRef.current === request) overviewPromiseRef.current = null;
      setOverviewBusy(false);
    }
  }, [overview, runtime]);

  const runControl = useCallback(async <T,>(command: Record<string, unknown>) => {
    setBusyAction(String(command.type || "control"));
    setError(null);
    try {
      const result = await runtime.runAgentControl<T>(command as { type: string; [key: string]: unknown });
      if (command.type !== "set_turn_context" && command.type !== "prepare_migration") await loadOverview(true);
      return result;
    } finally {
      setBusyAction(null);
    }
  }, [loadOverview, runtime]);

  const refreshConversation = useCallback(async () => {
    await Promise.all([refreshTranscript(), refreshSessionState(), refreshDocuments(), refreshAvailableThinkingLevels()]);
  }, [refreshAvailableThinkingLevels, refreshDocuments, refreshSessionState, refreshTranscript]);

  const createSession = useCallback(async () => {
    await sendRpc({ type: "new_session" });
    streamingTextRef.current = "";
    streamingThinkingRef.current = "";
    setTranscript([]);
    await Promise.all([refreshConversation(), loadOverview(true)]);
  }, [loadOverview, refreshConversation, sendRpc]);

  const switchSession = useCallback(async (sessionPath: string) => {
    await sendRpc({ type: "switch_session", sessionPath });
    streamingTextRef.current = "";
    streamingThinkingRef.current = "";
    setTranscript([]);
    await Promise.all([refreshConversation(), loadOverview(true)]);
  }, [loadOverview, refreshConversation, sendRpc]);

  const references = useMemo(() => documents.flatMap((document) => document.references || []), [documents]);

  return {
    status,
    error,
    workerState,
    sessionState,
    transcript,
    commands,
    availableModels,
    availableThinkingLevels,
    overview,
    overviewBusy,
    busyAction,
    interaction,
    documents,
    references,
    composerRequest,
    activity,
    draft,
    explicitReferences,
    sidebarOpen: preferences.sidebarOpen,
    transcriptMode: preferences.transcriptMode,
    setDraft,
    setExplicitReferences,
    setSidebarOpen,
    setTranscriptMode,
    setComposerRequest,
    setError,
    sendRpc,
    sendPrompt,
    createSession,
    switchSession,
    refreshDocuments,
    refreshSessionState,
    refreshTranscript,
    refreshAvailableThinkingLevels,
    refreshConversation,
    retryAgent,
    loadOverview,
    runControl,
    resolveInteraction
  };
}

export function normalizeAgentTranscript(input: unknown[]): AgentTranscriptItem[] {
  const result: AgentTranscriptItem[] = [];
  const toolIndexes = new Map<string, number>();
  input.forEach((message, index) => {
    if (!message || typeof message !== "object") return;
    const item = message as Record<string, unknown>;
    const baseId = stableMessageId(item, index);
    if (item.role === "toolResult") {
      const toolCallId = String(item.toolCallId || baseId);
      const existingIndex = toolIndexes.get(toolCallId);
      const existing = existingIndex === undefined ? undefined : result[existingIndex] as AgentToolActivity;
      const tool: AgentToolActivity = {
        kind: "tool",
        id: `tool-${toolCallId}`,
        toolCallId,
        name: String(item.toolName || existing?.name || "tool"),
        args: existing?.args,
        result: toolResultValue(item),
        status: item.isError ? "error" : "complete"
      };
      if (existingIndex === undefined) {
        toolIndexes.set(toolCallId, result.length);
        result.push(tool);
      } else result[existingIndex] = { ...(result[existingIndex] as AgentToolActivity), ...tool };
      return;
    }
    if (item.role === "assistant") {
      const { text, thinking, tools } = extractAssistantContent(item.content);
      if (text || thinking) result.push({
        kind: "message",
        id: baseId,
        role: "assistant",
        text,
        thinking,
        error: item.stopReason === "error"
      });
      for (const [toolIndex, tool] of tools.entries()) {
        const toolCallId = String(tool.id || `${baseId}-${toolIndex}`);
        toolIndexes.set(toolCallId, result.length);
        result.push({
          kind: "tool",
          id: `tool-${toolCallId}`,
          toolCallId,
          name: String(tool.name || "tool"),
          args: tool.arguments,
          status: "running"
        });
      }
      return;
    }
    if (item.role === "user") {
      const text = extractTextContent(item.content);
      if (text) result.push({ kind: "message", id: baseId, role: "user", text });
      return;
    }
    const noticeText = extractTextContent(item.content) || (typeof item.message === "string" ? item.message : "");
    if (noticeText) result.push({ kind: "notice", id: baseId, text: noticeText, tone: item.error ? "danger" : "neutral" });
  });
  return result;
}

export function normalizeAgentSessionState(state: Record<string, unknown>): Record<string, unknown> {
  const model = state.model;
  if (!model || typeof model !== "object" || Array.isArray(model)) return { ...state, model: null };
  const candidate = model as Record<string, unknown>;
  const id = String(candidate.id || "").trim();
  const provider = String(candidate.provider || "").trim();
  const placeholder = !id || !provider || id.toLowerCase() === "unknown" || provider.toLowerCase() === "unknown";
  return placeholder ? { ...state, model: null } : state;
}

async function handleDocumentHostRequest(bridge: RuntimeAgentDocumentBridge, method: string, params: Record<string, unknown>) {
  if (method === "document.list") return bridge.list();
  if (method === "document.read") return bridge.read(String(params.documentId || ""));
  if (method === "document.apply") return bridge.apply(params);
  if (method === "document.reveal") return bridge.reveal(params);
  throw new Error(`Unsupported document host request: ${method}`);
}

function hostInteraction(id: string, method: string, params: Record<string, unknown>): AgentInteractionRequest {
  if (method === "trust") {
    const options = Array.isArray(params.options) ? params.options as Array<Record<string, unknown>> : [];
    return {
      id,
      source: "host",
      method,
      title: "信任项目资源？",
      message: `信任后，Pi 可以加载项目内的 .pi 设置、扩展、Skills 和 Packages。\n${String(params.cwd || "")}`,
      options: options.map((option) => ({ id: String(option.index), label: String(option.label) })),
      raw: params
    };
  }
  if (method === "auth_prompt") {
    const prompt = (params.prompt || {}) as Record<string, unknown>;
    const options = Array.isArray(prompt.options) ? prompt.options as Array<Record<string, unknown>> : undefined;
    return {
      id,
      source: "host",
      method,
      title: String(prompt.message || "登录 Pi Provider"),
      placeholder: typeof prompt.placeholder === "string" ? prompt.placeholder : undefined,
      secret: prompt.type === "secret",
      options: options?.map((option) => ({ id: String(option.id), label: String(option.label), description: typeof option.description === "string" ? option.description : undefined })),
      raw: params
    };
  }
  return {
    id,
    source: "host",
    method,
    title: String(params.title || "确认操作"),
    message: typeof params.message === "string" ? params.message : undefined,
    raw: params
  };
}

function extensionInteraction(payload: Record<string, unknown>): AgentInteractionRequest {
  const method = String(payload.method || "confirm");
  const options = Array.isArray(payload.options) ? payload.options.map((label) => ({ id: String(label), label: String(label) })) : undefined;
  return {
    id: String(payload.id || ""),
    source: "extension",
    method,
    title: String(payload.title || "Pi 扩展请求"),
    message: typeof payload.message === "string" ? payload.message : undefined,
    placeholder: typeof payload.placeholder === "string" ? payload.placeholder : undefined,
    secret: false,
    options,
    raw: payload
  };
}

function extractAssistantContent(content: unknown) {
  if (typeof content === "string") return { text: content, thinking: "", tools: [] as Record<string, unknown>[] };
  if (!Array.isArray(content)) return { text: "", thinking: "", tools: [] as Record<string, unknown>[] };
  const text: string[] = [];
  const thinking: string[] = [];
  const tools: Record<string, unknown>[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const item = part as Record<string, unknown>;
    if (item.type === "text") text.push(String(item.text || ""));
    if (item.type === "thinking") thinking.push(String(item.thinking || item.text || ""));
    if (item.type === "toolCall") tools.push(item);
  }
  return { text: text.join("\n"), thinking: thinking.join("\n"), tools };
}

function extractTextContent(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part && typeof part === "object" && (part as Record<string, unknown>).type === "text"
    ? [String((part as Record<string, unknown>).text || "")]
    : []).join("\n");
}

function toolResultValue(item: Record<string, unknown>) {
  if (item.details !== undefined) return item.details;
  return { content: item.content };
}

function stableMessageId(message: Record<string, unknown>, index: number) {
  return String(message.id || message.timestamp || `message-${index}`);
}

function upsertStreamingAssistant(items: AgentTranscriptItem[], text: string, thinking: string) {
  const withoutStreaming = items.filter((item) => item.id !== "streaming-assistant");
  if (!text && !thinking) return withoutStreaming;
  const streaming: AgentChatMessage = { kind: "message", id: "streaming-assistant", role: "assistant", text, thinking, streaming: true };
  const firstRunningToolIndex = withoutStreaming.findIndex((item) => item.kind === "tool" && item.status === "running");
  if (firstRunningToolIndex < 0) return [...withoutStreaming, streaming];
  return [...withoutStreaming.slice(0, firstRunningToolIndex), streaming, ...withoutStreaming.slice(firstRunningToolIndex)];
}

function upsertTool(items: AgentTranscriptItem[], tool: AgentToolActivity) {
  const index = items.findIndex((item) => item.kind === "tool" && item.toolCallId === tool.toolCallId);
  if (index < 0) return [...items, tool];
  return items.map((item, itemIndex) => itemIndex === index ? { ...(item as AgentToolActivity), ...tool } : item);
}

function selectionReference(document: RuntimeAgentDocumentSummary): RuntimeAgentReference {
  const selection = document.selection!;
  return {
    kind: selection.kind,
    documentId: document.documentId,
    start: selection.start,
    end: selection.end,
    text: selection.text,
    revision: document.revision
  };
}

function dedupeReferences(references: RuntimeAgentReference[]) {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = JSON.stringify(reference);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readUiPreferences(key: string): AgentUiPreferences {
  if (typeof window === "undefined") return DEFAULT_UI_PREFERENCES;
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) || "null") as Partial<AgentUiPreferences> | null;
    return {
      sidebarOpen: raw?.sidebarOpen !== false,
      transcriptMode: raw?.transcriptMode === "verbose" || raw?.transcriptMode === "summary" ? raw.transcriptMode : "normal",
      drafts: raw?.drafts && typeof raw.drafts === "object" ? raw.drafts : {},
      references: raw?.references && typeof raw.references === "object" ? raw.references : {}
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

function writeUiPreferences(key: string, value: AgentUiPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is optional when storage is unavailable.
  }
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
