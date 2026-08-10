"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  EditorRuntime,
  RuntimeAgentDocumentBridge,
  RuntimeAgentSessionSummary,
  RuntimeAgentSessionTarget
} from "@/features/mermaid-editor/lib/editor-runtime";

import { AgentEventRouterProvider } from "./agent-event-router";
import { AgentPanel } from "./agent-panel";
import { useAgentSession, type AgentController } from "./use-agent-session";
import type { AgentWorkspaceActivity, AgentWorkspaceController, AgentWorkspaceSession, AgentWorkspaceSessionStatus } from "./agent-workspace-types";

type AgentInstanceDescriptor = {
  id: string;
  target: RuntimeAgentSessionTarget;
  generation: number;
  title: string;
  sessionFile?: string;
  status: AgentWorkspaceSessionStatus;
  error?: string;
  unread: boolean;
  cwd?: string;
  projectRoot?: string;
};

type AgentInstanceMeta = {
  id: string;
  title: string;
  sessionFile?: string;
  status: AgentWorkspaceSessionStatus;
  error?: string;
};

export function AgentWorkspacePanel({ runtime, enabled, cwd, projectRoot, documentBridge, onActivityChange }: {
  runtime: EditorRuntime;
  enabled: boolean;
  cwd?: string;
  projectRoot?: string;
  documentBridge: RuntimeAgentDocumentBridge;
  onActivityChange?: (activity: AgentWorkspaceActivity) => void;
}) {
  const [catalog, setCatalog] = useState<RuntimeAgentSessionSummary[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [instances, setInstances] = useState<AgentInstanceDescriptor[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const bootstrappedRef = useRef(false);
  const catalogCwdRef = useRef<string | null>(null);
  const foregroundRef = useRef(new Map<string, boolean>());

  const refreshSessions = useCallback(async () => {
    setCatalogBusy(true);
    try {
      setCatalog(await runtime.listAgentSessions({ cwd }));
    } finally {
      setCatalogBusy(false);
    }
  }, [cwd, runtime]);

  const createSession = useCallback(() => {
    const id = crypto.randomUUID();
    setInstances((current) => [...current, {
      id,
      target: { kind: "new", sessionId: id },
      generation: 0,
      title: "新会话",
      status: "starting",
      unread: false,
      cwd,
      projectRoot
    }]);
    setActiveSessionId(id);
  }, [cwd, projectRoot]);

  useEffect(() => {
    if (!enabled || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    catalogCwdRef.current = cwd || "";
    let disposed = false;
    let completed = false;
    setCatalogBusy(true);
    void Promise.all([runtime.listAgentSessions({ cwd }), runtime.listAgentInstances()]).then(([sessions, live]) => {
      if (disposed) return;
      setCatalog(sessions);
      const restored = live.map<AgentInstanceDescriptor>((instance) => {
        const summary = sessions.find((session) => session.id === instance.sessionId);
        const target: RuntimeAgentSessionTarget = instance.sessionFile
          ? { kind: "existing", sessionId: instance.sessionId, sessionPath: instance.sessionFile }
          : { kind: "new", sessionId: instance.sessionId };
        return {
          id: instance.sessionId,
          target,
          generation: 0,
          title: sessionLabel(summary),
          sessionFile: instance.sessionFile,
          status: instance.status,
          unread: false,
          cwd: instance.cwd,
          projectRoot: instance.projectRoot
        };
      });
      if (restored.length) {
        const foreground = live.find((instance) => instance.foreground)?.sessionId;
        setInstances(restored);
        setActiveSessionId(foreground || restored[0].id);
      } else if (sessions.length) {
        const session = sessions[0];
        setInstances([descriptorForSession(session)]);
        setActiveSessionId(session.id);
      } else {
        const id = crypto.randomUUID();
        setInstances([{ id, target: { kind: "new", sessionId: id }, generation: 0, title: "新会话", status: "starting", unread: false, cwd, projectRoot }]);
        setActiveSessionId(id);
      }
    }).catch((error) => {
      if (!disposed) toast.error(readableError(error));
    }).finally(() => {
      if (!disposed) { completed = true; setCatalogBusy(false); }
    });
    return () => { disposed = true; if (!completed) bootstrappedRef.current = false; };
  }, [cwd, enabled, projectRoot, runtime]);

  useEffect(() => {
    if (!enabled || !bootstrappedRef.current || catalogCwdRef.current === (cwd || "")) return;
    catalogCwdRef.current = cwd || "";
    void refreshSessions().catch((error) => toast.error(readableError(error)));
  }, [cwd, enabled, refreshSessions]);

  const updateInstance = useCallback((meta: AgentInstanceMeta) => {
    setInstances((current) => current.map((instance) => {
      if (instance.id !== meta.id) return instance;
      const completedInBackground = (instance.status === "running" || instance.status === "waiting") && meta.status === "idle" && activeSessionId !== meta.id;
      if (completedInBackground) toast.success(`${meta.title || instance.title} 已完成`);
      const sessionFile = meta.sessionFile || instance.sessionFile;
      const target: RuntimeAgentSessionTarget = sessionFile && (instance.target.kind !== "existing" || instance.target.sessionPath !== sessionFile)
        ? { kind: "existing", sessionId: instance.id, sessionPath: sessionFile }
        : instance.target;
      if (target === instance.target && instance.title === (meta.title || instance.title) && instance.sessionFile === sessionFile && instance.status === meta.status && instance.error === meta.error && !completedInBackground) return instance;
      return {
        ...instance,
        target,
        title: meta.title || instance.title,
        sessionFile,
        status: meta.status,
        error: meta.error,
        unread: instance.unread || completedInBackground
      };
    }));
    if (meta.status === "idle" && meta.sessionFile) void refreshSessions().catch(() => undefined);
  }, [activeSessionId, refreshSessions]);

  const sessions = useMemo(() => mergeSessions(catalog, instances), [catalog, instances]);

  useEffect(() => {
    onActivityChange?.({
      running: instances.filter((instance) => instance.status === "running" || instance.status === "starting").length,
      waiting: instances.filter((instance) => instance.status === "waiting").length,
      errors: instances.filter((instance) => instance.status === "error").length,
      unread: instances.filter((instance) => instance.unread).length
    });
  }, [instances, onActivityChange]);

  const activateSession = useCallback((session: AgentWorkspaceSession) => {
    setInstances((current) => {
      const existing = current.find((instance) => instance.id === session.id);
      if (!existing) return [...current, descriptorForSession(session)];
      return current.map((instance) => instance.id !== session.id ? instance : {
        ...instance,
        unread: false,
        ...(instance.status === "dormant" || instance.status === "error"
          ? { generation: instance.generation + 1, status: "starting" as const, error: undefined }
          : {})
      });
    });
    setActiveSessionId(session.id);
  }, []);

  const deleteSession = useCallback(async (session: AgentWorkspaceSession) => {
    const fallback = sessions.find((candidate) => candidate.id !== session.id);
    const instance = instances.find((candidate) => candidate.id === session.id);
    if (instance && instance.status !== "dormant") await runtime.stopAgent(instance.id);
    setInstances((current) => current.filter((candidate) => candidate.id !== session.id));
    if (session.path) await runtime.deleteAgentSession({ sessionId: session.id, sessionPath: session.path });
    await refreshSessions();
    if (activeSessionId === session.id) {
      if (fallback) activateSession(fallback);
      else createSession();
    }
  }, [activateSession, activeSessionId, createSession, instances, refreshSessions, runtime, sessions]);

  useEffect(() => {
    for (const instance of instances) {
      if (instance.status === "dormant" || instance.status === "error") continue;
      const foreground = enabled && instance.id === activeSessionId;
      if (foregroundRef.current.get(instance.id) === foreground) continue;
      foregroundRef.current.set(instance.id, foreground);
      void runtime.setAgentInstanceForeground(instance.id, foreground).catch(() => undefined);
    }
  }, [activeSessionId, enabled, instances, runtime]);

  useEffect(() => {
    if (!enabled || !activeSessionId) return;
    setInstances((current) => current.map((instance) => instance.id === activeSessionId && instance.status === "dormant"
      ? { ...instance, generation: instance.generation + 1, status: "starting", error: undefined }
      : instance));
  }, [activeSessionId, enabled]);

  const workspace = useMemo<AgentWorkspaceController>(() => ({
    sessions,
    activeSessionId,
    catalogBusy,
    createSession,
    activateSession,
    refreshSessions,
    deleteSession
  }), [activateSession, activeSessionId, catalogBusy, createSession, deleteSession, refreshSessions, sessions]);

  return (
    <AgentEventRouterProvider runtime={runtime}>
      <div className="h-full min-h-0">
        {instances.map((instance) => (
          <AgentInstance
            key={`${instance.id}:${instance.generation}`}
            runtime={runtime}
            instance={instance}
            active={instance.id === activeSessionId}
            cwd={instance.cwd}
            projectRoot={instance.projectRoot}
            documentBridge={documentBridge}
            workspace={workspace}
            onMeta={updateInstance}
          />
        ))}
      </div>
    </AgentEventRouterProvider>
  );
}

function AgentInstance({ runtime, instance, active, cwd, projectRoot, documentBridge, workspace, onMeta }: {
  runtime: EditorRuntime;
  instance: AgentInstanceDescriptor;
  active: boolean;
  cwd?: string;
  projectRoot?: string;
  documentBridge: RuntimeAgentDocumentBridge;
  workspace: AgentWorkspaceController;
  onMeta: (meta: AgentInstanceMeta) => void;
}) {
  const controller = useAgentSession({
    runtime,
    enabled: true,
    agentInstanceId: instance.id,
    target: instance.target,
    cwd,
    projectRoot,
    documentBridge
  });
  const meta = useControllerMeta(controller);
  useEffect(() => onMeta(meta), [meta, onMeta]);
  return active ? <AgentPanel runtime={runtime} controller={controller} workspace={workspace} /> : null;
}

function useControllerMeta(controller: AgentController): AgentInstanceMeta {
  return useMemo(() => ({
    id: controller.agentInstanceId,
    title: String(controller.sessionState?.sessionName || controller.overview?.session?.name || "新会话"),
    sessionFile: String(controller.sessionState?.sessionFile || controller.workerState?.sessionFile || "") || undefined,
    status: controller.instanceStatus,
    error: controller.error || undefined
  }), [controller.agentInstanceId, controller.error, controller.instanceStatus, controller.overview?.session?.name, controller.sessionState?.sessionFile, controller.sessionState?.sessionName, controller.workerState?.sessionFile]);
}

function descriptorForSession(session: Pick<RuntimeAgentSessionSummary, "id" | "path" | "cwd" | "name" | "firstMessage">): AgentInstanceDescriptor {
  return {
    id: session.id,
    target: { kind: "existing", sessionId: session.id, sessionPath: session.path },
    generation: 0,
    title: sessionLabel(session),
    sessionFile: session.path,
    status: "starting",
    unread: false,
    cwd: session.cwd,
    projectRoot: session.cwd
  };
}

function mergeSessions(catalog: RuntimeAgentSessionSummary[], instances: AgentInstanceDescriptor[]): AgentWorkspaceSession[] {
  const byId = new Map<string, AgentWorkspaceSession>();
  for (const session of catalog) byId.set(session.id, { ...session, status: "dormant", live: false, unread: false });
  for (const instance of instances) {
    const saved = byId.get(instance.id);
    byId.set(instance.id, {
      path: instance.sessionFile || saved?.path || "",
      id: instance.id,
      cwd: saved?.cwd || "",
      name: instance.title || saved?.name,
      parentSessionPath: saved?.parentSessionPath,
      created: saved?.created || new Date().toISOString(),
      modified: saved?.modified || new Date().toISOString(),
      messageCount: saved?.messageCount || 0,
      firstMessage: saved?.firstMessage || "",
      status: instance.status,
      live: instance.status !== "dormant",
      unread: instance.unread,
      error: instance.error
    });
  }
  return Array.from(byId.values()).sort((left, right) => statusRank(left.status) - statusRank(right.status) || Date.parse(right.modified) - Date.parse(left.modified));
}

function statusRank(status: AgentWorkspaceSessionStatus) {
  if (status === "waiting") return 0;
  if (status === "running" || status === "starting") return 1;
  if (status === "error") return 2;
  return 3;
}

function sessionLabel(session?: Pick<RuntimeAgentSessionSummary, "name" | "firstMessage">) {
  return String(session?.name || session?.firstMessage || "新会话");
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
