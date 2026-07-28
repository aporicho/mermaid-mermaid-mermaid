"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Xmark } from "iconoir-react/regular";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EditorRuntime, RuntimeAgentDocumentBridge } from "@/features/mermaid-editor/lib/editor-runtime";
import { cn } from "@/lib/utils";

import { AgentPanel } from "./agent-panel";
import { useAgentSession, type AgentController } from "./use-agent-session";

type AgentInstance = { id: string; title: string; createNewSession: boolean };
type AgentInstanceMeta = { status: AgentController["status"]; streaming: boolean; title: string };

const PRIMARY_AGENT: AgentInstance = { id: "primary", title: "主会话", createNewSession: false };

export function ParallelAgentPanel({ runtime, enabled, cwd, projectRoot, documentBridge }: {
  runtime: EditorRuntime;
  enabled: boolean;
  cwd?: string;
  projectRoot?: string;
  documentBridge: RuntimeAgentDocumentBridge;
}) {
  const [instances, setInstances] = useState<AgentInstance[]>([PRIMARY_AGENT]);
  const [activeId, setActiveId] = useState(PRIMARY_AGENT.id);
  const [metadata, setMetadata] = useState<Record<string, AgentInstanceMeta>>({});
  const nextOrdinalRef = useRef(2);

  function addInstance() {
    const ordinal = nextOrdinalRef.current++;
    const id = `parallel-${crypto.randomUUID()}`;
    setInstances((current) => [...current, { id, title: `会话 ${ordinal}`, createNewSession: true }]);
    setActiveId(id);
  }

  const updateMetadata = useCallback((instanceId: string, meta: AgentInstanceMeta) => {
    setMetadata((current) => sameMeta(current[instanceId], meta) ? current : { ...current, [instanceId]: meta });
  }, []);

  async function closeInstance(instanceId: string) {
    await runtime.stopAgent(instanceId);
    setInstances((current) => {
      if (current.length === 1) return current;
      const index = current.findIndex((item) => item.id === instanceId);
      const next = current.filter((item) => item.id !== instanceId);
      if (activeId === instanceId) setActiveId(next[Math.max(0, index - 1)]?.id || PRIMARY_AGENT.id);
      return next;
    });
    setMetadata((current) => {
      const next = { ...current };
      delete next[instanceId];
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tabs value={activeId} onValueChange={setActiveId} className="h-full min-h-0 gap-0">
        <div className="flex min-w-0 items-center gap-2 border-b bg-muted/35 px-2 py-1.5">
          <TabsList variant="line" className="min-w-0 max-w-full flex-1 justify-start overflow-x-auto">
            {instances.map((instance) => {
              const meta = metadata[instance.id];
              return (
                <div key={instance.id} className="group/session relative min-w-28 max-w-52 flex-none">
                  <TabsTrigger value={instance.id} className={cn("w-full justify-start", instances.length > 1 && "pr-8")}>
                    <span className={cn("size-1.5 shrink-0 rounded-full bg-muted-foreground/45", meta?.streaming && "animate-pulse bg-primary", meta?.status === "error" && "bg-destructive", meta?.status === "ready" && !meta.streaming && "bg-primary")} />
                    <span className="min-w-0 flex-1 truncate">{meta?.title || instance.title}</span>
                  </TabsTrigger>
                  {instances.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`关闭 ${meta?.title || instance.title}`}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/session:opacity-100 group-focus-within/session:opacity-100"
                      onClick={() => void closeInstance(instance.id)}
                    ><Xmark data-icon="inline-start" /></Button>
                  ) : null}
                </div>
              );
            })}
          </TabsList>
          <ButtonGroup>
            <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="新建并行 Agent 会话" onClick={addInstance}><Plus data-icon="inline-start" /></Button></TooltipTrigger><TooltipContent>新建并行会话</TooltipContent></Tooltip>
          </ButtonGroup>
          {instances.length > 1 ? <Badge tone="neutral">{instances.length} 个并行</Badge> : null}
        </div>
        {instances.map((instance) => (
          <TabsContent key={instance.id} value={instance.id} forceMount className="min-h-0 data-[state=inactive]:hidden">
            <AgentInstancePane
              runtime={runtime}
              enabled={enabled}
              instance={instance}
              cwd={cwd}
              projectRoot={projectRoot}
              documentBridge={documentBridge}
              onMeta={updateMetadata}
            />
          </TabsContent>
        ))}
      </Tabs>
    </TooltipProvider>
  );
}

function AgentInstancePane({ runtime, enabled, instance, cwd, projectRoot, documentBridge, onMeta }: {
  runtime: EditorRuntime;
  enabled: boolean;
  instance: AgentInstance;
  cwd?: string;
  projectRoot?: string;
  documentBridge: RuntimeAgentDocumentBridge;
  onMeta: (instanceId: string, meta: AgentInstanceMeta) => void;
}) {
  const controller = useAgentSession({
    runtime,
    enabled,
    agentInstanceId: instance.id,
    createNewSession: instance.createNewSession,
    cwd,
    projectRoot,
    documentBridge
  });
  const title = useMemo(() => {
    const state = controller.sessionState;
    return String(state?.sessionName || state?.name || "").trim() || instance.title;
  }, [controller.sessionState, instance.title]);
  const streaming = Boolean(controller.sessionState?.isStreaming);
  useEffect(() => onMeta(instance.id, { status: controller.status, streaming, title }), [controller.status, instance.id, onMeta, streaming, title]);
  return <AgentPanel runtime={runtime} controller={controller} />;
}

function sameMeta(left: AgentInstanceMeta | undefined, right: AgentInstanceMeta) {
  return left?.status === right.status && left.streaming === right.streaming && left.title === right.title;
}
