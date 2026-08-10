"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import type { EditorRuntime, RuntimeAgentEvent } from "@/features/mermaid-editor/lib/editor-runtime";

type AgentEventHandler = (event: RuntimeAgentEvent) => void;
type AgentEventRouter = { subscribe: (agentInstanceId: string, handler: AgentEventHandler) => () => void };

const AgentEventRouterContext = createContext<AgentEventRouter | null>(null);

export function AgentEventRouterProvider({ runtime, children }: { runtime: EditorRuntime; children: ReactNode }) {
  const handlersRef = useRef(new Map<string, Set<AgentEventHandler>>());

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void runtime.listenForAgentEvents((event) => {
      if (disposed) return;
      const id = event.agentInstanceId || "primary";
      for (const handler of handlersRef.current.get(id) || []) handler(event);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [runtime]);

  const subscribe = useCallback((agentInstanceId: string, handler: AgentEventHandler) => {
    const handlers = handlersRef.current.get(agentInstanceId) || new Set<AgentEventHandler>();
    handlers.add(handler);
    handlersRef.current.set(agentInstanceId, handlers);
    return () => {
      handlers.delete(handler);
      if (!handlers.size) handlersRef.current.delete(agentInstanceId);
    };
  }, []);
  const value = useMemo(() => ({ subscribe }), [subscribe]);
  return <AgentEventRouterContext.Provider value={value}>{children}</AgentEventRouterContext.Provider>;
}

export function useAgentInstanceEvents(runtime: EditorRuntime, agentInstanceId: string, handler: AgentEventHandler) {
  const router = useContext(AgentEventRouterContext);
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; }, [handler]);

  useEffect(() => {
    const receive = (event: RuntimeAgentEvent) => handlerRef.current(event);
    if (router) return router.subscribe(agentInstanceId, receive);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void runtime.listenForAgentEvents((event) => {
      if (!disposed && (event.agentInstanceId || "primary") === agentInstanceId) receive(event);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [agentInstanceId, router, runtime]);
}
