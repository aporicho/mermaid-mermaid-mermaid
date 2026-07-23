"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDown,
  Brain,
  CheckCircle,
  Code,
  Copy,
  Database,
  EditPencil,
  Key,
  MoreHoriz,
  NavArrowDown,
  Page,
  Plus,
  Refresh,
  Search,
  SendDiagonal,
  Settings,
  SidebarCollapse,
  SidebarExpand,
  Trash,
  WarningTriangle,
  Xmark
} from "iconoir-react/regular";

import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport
} from "@/components/ui/message-scroller";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import type { EditorRuntime, RuntimeAgentReference } from "@/features/mermaid-editor/lib/editor-runtime";
import { cn } from "@/lib/utils";

import { AgentSettingsPanel } from "./agent-settings-dialog";
import type { AgentController, AgentInteractionRequest, AgentToolActivity, AgentTranscriptItem } from "./use-agent-session";

type AgentPanelProps = {
  runtime: EditorRuntime;
  controller: AgentController;
};

export function AgentPanel({ runtime, controller }: AgentPanelProps) {
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wide = useWideAgentPanel(rootRef);
  const loadOverview = controller.loadOverview;
  const setControllerError = controller.setError;

  useEffect(() => {
    if (controller.status !== "ready") return;
    if ((wide && controller.sidebarOpen) || mobileSidebarOpen) {
      void loadOverview().catch((error) => setControllerError(readableError(error)));
    }
  }, [controller.sidebarOpen, controller.status, loadOverview, mobileSidebarOpen, setControllerError, wide]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileSidebarOpen]);

  function toggleSidebar() {
    if (wide) controller.setSidebarOpen(!controller.sidebarOpen);
    else setMobileSidebarOpen(true);
  }

  if (view === "settings") {
    return <TooltipProvider delayDuration={300}><AgentSettingsPanel controller={controller} onBack={() => setView("chat")} /></TooltipProvider>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={rootRef} className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-card font-[family-name:var(--agent-type-body-family)] text-[length:var(--agent-type-body-size)] font-[var(--agent-type-body-weight)] leading-[var(--agent-type-body-line-height)] [letter-spacing:var(--agent-type-body-letter-spacing)] text-card-foreground">
        <WorkspaceWindowHeader
          leadingActions={<IconButton label={wide && controller.sidebarOpen ? "收起会话侧栏" : "打开会话侧栏"} onClick={toggleSidebar}>{wide && controller.sidebarOpen ? <SidebarCollapse /> : <SidebarExpand />}</IconButton>}
          icon={<Brain className="size-4 shrink-0" />}
          title={sessionTitle(controller)}
          status={controller.workerState?.scratch ? <Badge tone="neutral" className="shrink-0">临时画布</Badge> : null}
          actions={<>
            <IconButton label="新会话" onClick={() => void controller.createSession().catch((error) => controller.setError(readableError(error)))}><Plus /></IconButton>
            <SessionActions controller={controller} onRename={() => setRenameOpen(true)} />
            <IconButton label="Agent 设置" onClick={() => setView("settings")}><Settings /></IconButton>
          </>}
        />

        <AgentStatus controller={controller} />

        <SidebarProvider open={wide && controller.sidebarOpen} onOpenChange={controller.setSidebarOpen} className="min-h-0 flex-1">
          {wide ? <Sidebar><AgentSessionSidebar controller={controller} onOpenSettings={() => setView("settings")} /></Sidebar> : null}
          <SidebarInset className="grid min-h-0 grid-rows-[minmax(0,1fr)]">
            <AgentConversation controller={controller} onOpenSettings={() => setView("settings")} onOpenLink={runtime.openExternalUrl} />
          </SidebarInset>
        </SidebarProvider>

        {!wide && mobileSidebarOpen ? <div className="absolute inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Agent 会话">
          <aside className="h-full w-[min(84%,320px)] border-r bg-card shadow-[var(--ui-shadow-panel)]">
            <AgentSessionSidebar controller={controller} onOpenSettings={() => { setMobileSidebarOpen(false); setView("settings"); }} onSelectSession={() => setMobileSidebarOpen(false)} />
          </aside>
          <Button type="button" variant="ghost" className="h-full min-w-0 flex-1 rounded-none bg-background/55 p-0 backdrop-blur-[2px] hover:bg-background/65" aria-label="关闭会话侧栏" onClick={() => setMobileSidebarOpen(false)} />
        </div> : null}

        <RenameSessionDialog controller={controller} open={renameOpen} onOpenChange={setRenameOpen} />
        <AgentInteractionDialog controller={controller} request={controller.interaction} />
      </div>
    </TooltipProvider>
  );
}

function AgentStatus({ controller }: { controller: AgentController }) {
  if (controller.status === "starting") return <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground"><Spinner className="size-3.5" />正在启动 Pi Agent</div>;
  if (controller.error) return <div className="flex items-center gap-2 border-b bg-destructive/8 px-3 py-1.5 text-xs text-destructive"><WarningTriangle className="size-3.5" /><span className="min-w-0 flex-1 truncate">{controller.error}</span><Button variant="ghost" size="icon" className="size-6" aria-label="关闭错误" onClick={() => controller.setError(null)}><Xmark className="size-3.5" /></Button></div>;
  if (controller.activity || controller.busyAction) return <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground"><Spinner className="size-3.5" /><span className="truncate">{controller.activity || "正在处理"}</span></div>;
  return null;
}

function AgentSessionSidebar({ controller, onOpenSettings, onSelectSession }: { controller: AgentController; onOpenSettings: () => void; onSelectSession?: () => void }) {
  const [query, setQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Record<string, any> | null>(null);
  const overviewSessions = controller.overview?.sessions;
  const currentPath = String(controller.sessionState?.sessionFile || "");
  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (overviewSessions || []).filter((session: any) => sessionLabel(session).toLowerCase().includes(needle));
  }, [overviewSessions, query]);
  const grouped = useMemo(() => groupSessions(visibleSessions), [visibleSessions]);

  return <div className="flex h-full min-h-0 flex-col">
    <SidebarHeader>
      <Button className="flex-1 justify-start" onClick={() => void controller.createSession().then(() => onSelectSession?.()).catch((error) => controller.setError(readableError(error)))}><Plus />新会话</Button>
      <IconButton label="刷新会话" onClick={() => void Promise.all([controller.refreshConversation(), controller.loadOverview(true)]).catch((error) => controller.setError(readableError(error)))}><Refresh /></IconButton>
    </SidebarHeader>
    <div className="px-2 pt-2"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索会话" className="pl-8" /></div></div>
    <SidebarContent>
      {controller.overviewBusy && !controller.overview ? <div className="grid place-items-center py-10"><Spinner className="text-muted-foreground" /></div> : null}
      {!controller.overviewBusy && !visibleSessions.length ? <Empty className="min-h-48 px-3 py-8"><EmptyMedia><Database /></EmptyMedia><EmptyHeader><EmptyTitle>没有会话</EmptyTitle><EmptyDescription>{query ? "没有匹配结果" : "新建一次对话开始工作"}</EmptyDescription></EmptyHeader></Empty> : null}
      {grouped.map((group) => <SidebarGroup key={group.label}><SidebarGroupLabel>{group.label}</SidebarGroupLabel><SidebarMenu>{group.sessions.map((session: any) => {
        const path = String(session.path || "");
        const active = path === currentPath;
        return <Item key={path || session.id} className={cn("cursor-default px-2 py-1.5", active ? "bg-accent text-accent-foreground" : "hover:bg-muted/55")}>
          <ItemMedia><Page /></ItemMedia>
          <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start rounded-none p-0 text-left hover:bg-transparent" onClick={() => { if (!active) void controller.switchSession(path).then(() => onSelectSession?.()).catch((error) => controller.setError(readableError(error))); else onSelectSession?.(); }}><ItemContent><ItemTitle>{sessionLabel(session)}</ItemTitle><ItemDescription>{relativeTime(session.modified)}</ItemDescription></ItemContent></Button>
          {!active ? <ItemActions><IconButton label={`删除 ${sessionLabel(session)}`} className="size-7 opacity-0 group-hover/item:opacity-100 focus:opacity-100" onClick={() => setDeleteCandidate(session)}><Trash className="size-3.5" /></IconButton></ItemActions> : null}
        </Item>;
      })}</SidebarMenu></SidebarGroup>)}
    </SidebarContent>
    <SidebarFooter><Button variant="ghost" className="w-full justify-start" onClick={onOpenSettings}><Settings />设置</Button></SidebarFooter>
    <DeleteSessionDialog controller={controller} session={deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }} />
  </div>;
}

function AgentConversation({ controller, onOpenSettings, onOpenLink }: { controller: AgentController; onOpenSettings: () => void; onOpenLink: (url: string) => void }) {
  const state = controller.sessionState || {};
  const model = state.model as Record<string, unknown> | null | undefined;
  const isStreaming = Boolean(state.isStreaming);
  const hasConversation = controller.transcript.length > 0;
  const hiddenThinking = Boolean(controller.overview?.settings?.global?.hideThinkingBlock || controller.overview?.settings?.project?.hideThinkingBlock);
  const visibleTranscript = controller.transcriptMode === "summary"
    ? controller.transcript.filter((item) => item.kind !== "tool")
    : controller.transcript;

  if (controller.status === "starting" && !hasConversation) return <AgentStarting />;
  if (controller.status === "error" && !hasConversation) return <AgentUnavailable error={controller.error} onRetry={controller.retryAgent} />;
  if (!model && !hasConversation) return <AgentNoModel onOpenSettings={onOpenSettings} composer={<AgentComposer controller={controller} />} />;
  if (!hasConversation) return <AgentWelcome controller={controller} />;

  return <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor" scrollEdgeThreshold={80} scrollPreviousItemPeek={72}>
      <MessageScroller aria-busy={isStreaming}>
        <MessageScrollerViewport aria-label="Agent 对话记录" preserveScrollOnPrepend>
          <MessageScrollerContent className="max-w-[var(--agent-transcript-max-width)] gap-[var(--agent-turn-gap)] px-[var(--agent-content-padding-x)] py-[var(--agent-content-padding-y)]">
            {visibleTranscript.map((item) => <TranscriptItem key={item.id} item={item} mode={controller.transcriptMode} hiddenThinking={hiddenThinking} onOpenLink={onOpenLink} />)}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" behavior="smooth" aria-label="滚动到最新消息"><ArrowDown /></MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
    <AgentComposer controller={controller} />
  </div>;
}

function TranscriptItem({ item, mode, hiddenThinking, onOpenLink }: { item: AgentTranscriptItem; mode: AgentController["transcriptMode"]; hiddenThinking: boolean; onOpenLink: (url: string) => void }) {
  if (item.kind === "tool") return <MessageScrollerItem messageId={item.id}><ToolBlock tool={item} defaultOpen={mode === "verbose"} /></MessageScrollerItem>;
  if (item.kind === "notice") return <MessageScrollerItem messageId={item.id}><AgentNotice tone={item.tone} icon={item.tone === "danger" ? <WarningTriangle /> : <CheckCircle />} text={item.text} /></MessageScrollerItem>;
  const isUser = item.role === "user";
  return <MessageScrollerItem messageId={item.id} scrollAnchor={isUser}>
    <Message align={isUser ? "end" : "start"} className="group">
      <MessageContent className={cn("gap-[var(--agent-part-gap)]", isUser ? "items-end" : "w-full")}>
        {!hiddenThinking && item.thinking ? <ThinkingBlock text={item.thinking} /> : null}
        <Bubble variant={isUser ? "tinted" : item.error ? "destructive" : "ghost"} className={isUser
          ? "rounded-[var(--agent-message-user-radius)] border-[length:var(--agent-message-user-border-width)] border-[hsl(var(--agent-message-user-border-color))] [border-style:var(--agent-message-user-border-style)] bg-[hsl(var(--agent-message-user-background))] px-[var(--agent-message-user-padding-x)] py-[var(--agent-message-user-padding-y)] text-[hsl(var(--agent-message-user-foreground))] shadow-[var(--agent-message-user-shadow)]"
          : "rounded-[var(--agent-message-assistant-radius)] border-[length:var(--agent-message-assistant-border-width)] border-[hsl(var(--agent-message-assistant-border-color))] [border-style:var(--agent-message-assistant-border-style)] bg-[hsl(var(--agent-message-assistant-background))] px-[var(--agent-message-assistant-padding-x)] py-[var(--agent-message-assistant-padding-y)] text-[hsl(var(--agent-message-assistant-foreground))] shadow-[var(--agent-message-assistant-shadow)]"}>
          <BubbleContent data-selectable-text className="agent-markdown"><MarkdownContent text={item.text} onOpenLink={onOpenLink} /></BubbleContent>
        </Bubble>
        {!isUser && item.text ? <MessageFooter className="font-[family-name:var(--agent-type-metadata-family)] text-[length:var(--agent-type-metadata-size)] font-[var(--agent-type-metadata-weight)] leading-[var(--agent-type-metadata-line-height)] [letter-spacing:var(--agent-type-metadata-letter-spacing)] text-[hsl(var(--agent-message-metadata-foreground))] opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"><IconButton label="复制回复" className="size-7" onClick={() => void copyText(item.text)}><Copy className="size-3.5" /></IconButton>{item.streaming ? <span>正在生成</span> : null}</MessageFooter> : null}
      </MessageContent>
    </Message>
  </MessageScrollerItem>;
}

function AgentComposer({ controller }: { controller: AgentController }) {
  const isStreaming = Boolean(controller.sessionState?.isStreaming);
  const hasModel = Boolean(controller.sessionState?.model);
  const canSend = controller.status === "ready" && hasModel && Boolean(controller.draft.trim());
  const activeDocument = controller.documents.find((document) => document.active);
  const composerRequest = controller.composerRequest;
  const setComposerRequest = controller.setComposerRequest;
  const setDraft = controller.setDraft;

  useEffect(() => {
    if (composerRequest == null) return;
    setDraft(composerRequest);
    setComposerRequest(null);
  }, [composerRequest, setComposerRequest, setDraft]);

  async function send() {
    const text = controller.draft.trim();
    if (!text || !hasModel) return;
    const previousReferences = controller.explicitReferences;
    controller.setDraft("");
    try {
      await controller.sendPrompt(text, previousReferences);
      controller.setExplicitReferences([]);
    } catch (error) {
      controller.setDraft(text);
      controller.setExplicitReferences(previousReferences);
      controller.setError(readableError(error));
    }
  }

  return <div className="px-[var(--agent-content-padding-x)] pb-[var(--agent-content-padding-y)] pt-2">
    <div className="mx-auto max-w-[var(--agent-composer-max-width)] rounded-[var(--agent-composer-radius)] border-[length:var(--agent-composer-border-width)] border-[hsl(var(--agent-composer-border-color))] [border-style:var(--agent-composer-border-style)] bg-[hsl(var(--agent-composer-background))] px-[var(--agent-composer-padding-x)] py-[var(--agent-composer-padding-y)] text-[hsl(var(--agent-composer-foreground))] shadow-[var(--agent-composer-shadow)]">
      {controller.explicitReferences.length ? <div className="mb-2 flex flex-wrap gap-1">{controller.explicitReferences.map((reference, index) => <Badge key={`${reference.kind}-${index}`} tone="neutral" className="gap-1"><span className="max-w-56 truncate">{referenceLabel(reference)}</span><Button type="button" variant="ghost" size="icon" className="size-4" aria-label="移除引用" onClick={() => controller.setExplicitReferences(controller.explicitReferences.filter((_, itemIndex) => itemIndex !== index))}><Xmark className="size-3" /></Button></Badge>)}</div> : null}
      <Textarea
        aria-label="发送给 Pi Agent"
        value={controller.draft}
        onChange={(event) => controller.setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void send();
          }
        }}
        placeholder={isStreaming ? "继续输入可在当前任务后发送…" : hasModel ? "描述任务，输入 @ 引用内容，输入 / 使用命令" : "请先连接一个模型"}
        disabled={controller.status !== "ready"}
        rows={2}
        className="min-h-[var(--agent-composer-min-height)] max-h-[var(--agent-composer-max-height)] resize-none overflow-y-auto border-0 bg-transparent p-0 text-[length:var(--agent-type-body-size)] leading-[var(--agent-type-body-line-height)] shadow-none [field-sizing:content] placeholder:text-[hsl(var(--agent-composer-placeholder))] focus-visible:ring-0"
      />
      <div className="mt-2 flex min-w-0 items-center gap-1">
        <ReferencePicker controller={controller} onPick={(reference) => controller.setExplicitReferences(dedupeRefs([...controller.explicitReferences, reference]))} />
        <CommandPicker controller={controller} onPick={(command) => controller.setDraft(`${controller.draft}${controller.draft && !controller.draft.endsWith(" ") ? " " : ""}/${command} `)} />
        {activeDocument ? <span className="ml-1 min-w-0 truncate text-xs text-muted-foreground">{activeDocument.title}</span> : null}
        <span className="ml-auto" />
        <ModelCombobox controller={controller} />
        <ThinkingSelect controller={controller} />
        <TranscriptModeSelect controller={controller} />
        {isStreaming ? <IconButton label="停止生成" onClick={() => void controller.sendRpc({ type: "abort" }).catch((error) => controller.setError(readableError(error)))}><Xmark /></IconButton> : null}
        <IconButton label="发送" variant="default" disabled={!canSend} onClick={() => void send()}><SendDiagonal /></IconButton>
      </div>
    </div>
  </div>;
}

function ModelCombobox({ controller }: { controller: AgentController }) {
  const [open, setOpen] = useState(false);
  const model = controller.sessionState?.model as Record<string, unknown> | null | undefined;
  const value = model ? `${String(model.provider)}::${String(model.id)}` : "";
  const label = model ? String(model.name || model.id || "模型") : "选择模型";
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="sm" className="max-w-40 px-2"><span className="truncate">{label}</span><NavArrowDown /></Button></PopoverTrigger><PopoverContent align="end" className="w-80 p-0"><Command><CommandInput placeholder="搜索模型" /><CommandList><CommandEmpty>没有可用模型</CommandEmpty><CommandGroup>{controller.availableModels.map((item) => {
    const itemValue = `${String(item.provider)}::${String(item.id)}`;
    return <CommandItem key={itemValue} value={`${String(item.name || item.id)} ${String(item.provider)}`} onSelect={() => {
      const [provider, modelId] = itemValue.split("::");
      setOpen(false);
      void controller.sendRpc({ type: "set_model", provider, modelId }).then(() => Promise.all([controller.refreshSessionState(), controller.refreshAvailableThinkingLevels()])).catch((error) => controller.setError(readableError(error)));
    }}><span className="min-w-0 flex-1 truncate">{String(item.name || item.id)}</span><span className="text-xs text-muted-foreground">{String(item.provider)}</span>{value === itemValue ? <CheckCircle className="size-4" /> : null}</CommandItem>;
  })}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}

function ThinkingSelect({ controller }: { controller: AgentController }) {
  if (controller.availableThinkingLevels.length <= 1 && controller.availableThinkingLevels[0] === "off") return null;
  const value = String(controller.sessionState?.thinkingLevel || controller.availableThinkingLevels[0] || "off");
  return <Select value={value} onValueChange={(level) => void controller.sendRpc({ type: "set_thinking_level", level }).then(controller.refreshSessionState).catch((error) => controller.setError(readableError(error)))}><SelectTrigger aria-label="思考等级" className="h-8 w-24 border-0 bg-transparent px-2"><SelectValue /></SelectTrigger><SelectContent>{controller.availableThinkingLevels.map((level) => <SelectItem key={level} value={level}>{thinkingLabel(level)}</SelectItem>)}</SelectContent></Select>;
}

function TranscriptModeSelect({ controller }: { controller: AgentController }) {
  return <Select value={controller.transcriptMode} onValueChange={(value) => controller.setTranscriptMode(value as AgentController["transcriptMode"])}><SelectTrigger aria-label="对话详细程度" className="h-8 w-20 border-0 bg-transparent px-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">普通</SelectItem><SelectItem value="verbose">详细</SelectItem><SelectItem value="summary">摘要</SelectItem></SelectContent></Select>;
}

function ReferencePicker({ controller, onPick }: { controller: AgentController; onPick: (reference: RuntimeAgentReference) => void }) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupReferences(controller.references), [controller.references]);
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) void controller.refreshDocuments(); }}><PopoverTrigger asChild><Button variant="ghost" size="sm" className="px-2" aria-label="引用文件、节点或选区">@</Button></PopoverTrigger><PopoverContent align="start" className="w-80 p-0"><Command><CommandInput placeholder="查找文件、节点或选区" /><CommandList><CommandEmpty>没有可引用内容</CommandEmpty>{groups.map((group) => <CommandGroup key={group.label} heading={group.label}>{group.references.map((reference, index) => <CommandItem key={`${reference.kind}-${index}-${referenceLabel(reference)}`} value={referenceLabel(reference)} onSelect={() => { onPick(reference); setOpen(false); }}>{referenceLabel(reference)}</CommandItem>)}</CommandGroup>)}</CommandList></Command></PopoverContent></Popover>;
}

function CommandPicker({ controller, onPick }: { controller: AgentController; onPick: (command: string) => void }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="sm" className="px-2" aria-label="插入 Pi 命令">/</Button></PopoverTrigger><PopoverContent align="start" className="w-80 p-0"><Command><CommandInput placeholder="查找 Pi 命令" /><CommandList><CommandEmpty>没有可用命令</CommandEmpty><CommandGroup>{controller.commands.map((command) => <CommandItem key={`${command.source}:${command.name}`} value={command.name} onSelect={() => { onPick(command.name); setOpen(false); }}><span className="font-mono">/{command.name}</span><span className="ml-2 truncate text-xs text-muted-foreground">{command.description}</span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}

function SessionActions({ controller, onRename }: { controller: AgentController; onRename: () => void }) {
  return <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="会话操作"><MoreHoriz /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>会话操作</TooltipContent></Tooltip><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onRename}><EditPencil />重命名</DropdownMenuItem><DropdownMenuItem onSelect={() => void controller.runControl<{ path: string }>({ type: "export_html" }).catch((error) => controller.setError(readableError(error)))}><Code />导出 HTML</DropdownMenuItem><DropdownMenuItem onSelect={() => void controller.runControl<{ path: string }>({ type: "export_jsonl" }).catch((error) => controller.setError(readableError(error)))}><Page />导出 JSONL</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void controller.refreshConversation().catch((error) => controller.setError(readableError(error)))}><Refresh />刷新会话</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function RenameSessionDialog({ controller, open, onOpenChange }: { controller: AgentController; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  useEffect(() => { if (open) setName(String(controller.sessionState?.sessionName || "")); }, [controller.sessionState?.sessionName, open]);
  async function save() {
    await controller.sendRpc({ type: "set_session_name", name: name.trim() });
    await Promise.all([controller.refreshSessionState(), controller.loadOverview(true)]);
    onOpenChange(false);
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-sm p-5"><DialogTitle>重命名会话</DialogTitle><DialogDescription className="sr-only">修改当前 Agent 会话名称。</DialogDescription><Input autoFocus className="mt-4" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) void save(); }} /><div className="mt-4 flex justify-end gap-2"><DialogClose asChild><Button variant="ghost">取消</Button></DialogClose><Button disabled={!name.trim()} onClick={() => void save().catch((error) => controller.setError(readableError(error)))}>保存</Button></div></DialogContent></Dialog>;
}

function DeleteSessionDialog({ controller, session, onOpenChange }: { controller: AgentController; session: Record<string, any> | null; onOpenChange: (open: boolean) => void }) {
  if (!session) return null;
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="max-w-sm p-5"><DialogTitle>删除会话？</DialogTitle><DialogDescription className="mt-2">“{sessionLabel(session)}”将移到系统回收站。</DialogDescription><div className="mt-5 flex justify-end gap-2"><DialogClose asChild><Button variant="ghost">取消</Button></DialogClose><Button variant="destructive" onClick={() => void controller.runControl({ type: "delete_session", path: session.path }).then(() => onOpenChange(false)).catch((error) => controller.setError(readableError(error)))}>删除</Button></div></DialogContent></Dialog>;
}

function AgentStarting() {
  return <Empty><EmptyMedia><Spinner /></EmptyMedia><EmptyHeader><EmptyTitle>正在启动 Pi Agent</EmptyTitle></EmptyHeader></Empty>;
}

function AgentUnavailable({ error, onRetry }: { error: string | null; onRetry: () => Promise<void> }) {
  return <Empty><EmptyMedia><WarningTriangle /></EmptyMedia><EmptyHeader><EmptyTitle>Agent 暂不可用</EmptyTitle><EmptyDescription>{error || "请在桌面版中重新打开 Agent。"}</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => void onRetry()}><Refresh />重新启动</Button></EmptyContent></Empty>;
}

function AgentNoModel({ onOpenSettings, composer }: { onOpenSettings: () => void; composer: ReactNode }) {
  return <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]"><Empty><EmptyMedia><Key /></EmptyMedia><EmptyHeader><EmptyTitle>连接一个模型</EmptyTitle><EmptyDescription>Pi 使用独立的服务商认证与模型配置。</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={onOpenSettings}>打开设置</Button></EmptyContent></Empty>{composer}</div>;
}

function AgentWelcome({ controller }: { controller: AgentController }) {
  const suggestions = ["梳理当前文档的结构", "检查选中的节点", "说明当前项目中可以改进的地方"];
  return <div className="flex h-full min-h-0 flex-col justify-center overflow-y-auto py-[var(--agent-content-padding-y)]"><div className="mb-5 text-center"><Brain className="mx-auto mb-3 size-7 text-primary" /><h2 className="font-[family-name:var(--agent-type-heading-family)] text-[length:var(--agent-type-heading-size)] font-[var(--agent-type-heading-weight)] leading-[var(--agent-type-heading-line-height)] [letter-spacing:var(--agent-type-heading-letter-spacing)]">从当前工作区开始</h2></div><AgentComposer controller={controller} /><div className="mx-auto grid w-full max-w-[var(--agent-composer-max-width)] gap-2 px-[var(--agent-content-padding-x)] sm:grid-cols-3">{suggestions.map((suggestion) => <Button key={suggestion} variant="outline" className="h-auto justify-start whitespace-normal px-3 py-2 text-left" onClick={() => controller.setDraft(suggestion)}>{suggestion}</Button>)}</div></div>;
}

function ThinkingBlock({ text }: { text: string }) {
  return <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="px-0 font-[family-name:var(--agent-type-metadata-family)] text-[length:var(--agent-type-metadata-size)] text-[hsl(var(--agent-thinking-foreground))]"><NavArrowDown />思考过程</Button></CollapsibleTrigger><CollapsibleContent><div data-selectable-text className="border-l border-[hsl(var(--agent-thinking-accent))] pl-3 font-[family-name:var(--agent-type-metadata-family)] text-[length:var(--agent-type-metadata-size)] font-[var(--agent-type-metadata-weight)] leading-[var(--agent-type-metadata-line-height)] [letter-spacing:var(--agent-type-metadata-letter-spacing)] text-[hsl(var(--agent-thinking-foreground))] opacity-[var(--agent-thinking-opacity)] whitespace-pre-wrap">{text}</div></CollapsibleContent></Collapsible>;
}

function ToolBlock({ tool, defaultOpen }: { tool: AgentToolActivity; defaultOpen: boolean }) {
  const details = printableToolValue(tool.result ?? tool.args);
  return <Collapsible defaultOpen={defaultOpen} className="rounded-[var(--agent-tool-radius)] border-[length:var(--agent-tool-border-width)] border-[hsl(var(--agent-tool-border-color))] [border-style:var(--agent-tool-border-style)] bg-[hsl(var(--agent-tool-background))] text-[hsl(var(--agent-tool-foreground))] shadow-[var(--agent-tool-shadow)]"><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="w-full justify-start rounded-[var(--agent-tool-radius)] px-[var(--agent-tool-padding-x)]"><Code /><span className="truncate font-[family-name:var(--agent-type-technical-family)] text-[length:var(--agent-type-technical-size)]">{humanToolName(tool.name)}</span><span className={cn("ml-auto font-[family-name:var(--agent-type-metadata-family)] text-[length:var(--agent-type-metadata-size)]", tool.status === "error" ? "text-[hsl(var(--agent-tool-error-foreground))]" : "text-[hsl(var(--agent-tool-muted-foreground))]")}>{toolStatusLabel(tool.status)}</span><NavArrowDown /></Button></CollapsibleTrigger><CollapsibleContent className="grid gap-[var(--agent-tool-row-gap)] px-[var(--agent-tool-padding-x)] pb-[var(--agent-tool-padding-y)]"><div className="flex justify-end"><IconButton label="复制工具输出" className="size-7" onClick={() => void copyText(details.full)}><Copy className="size-3.5" /></IconButton></div><pre data-selectable-text className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[calc(var(--agent-tool-radius)/2)] bg-card/55 p-3 font-[family-name:var(--agent-type-technical-family)] text-[length:var(--agent-type-technical-size)] font-[var(--agent-type-technical-weight)] leading-[var(--agent-type-technical-line-height)] [letter-spacing:var(--agent-type-technical-letter-spacing)]">{details.preview}</pre>{details.truncated ? <p className="font-[family-name:var(--agent-type-metadata-family)] text-[length:var(--agent-type-metadata-size)] text-[hsl(var(--agent-tool-muted-foreground))]">输出过长，仅显示前 20,000 个字符。</p> : null}</CollapsibleContent></Collapsible>;
}

function AgentNotice({ tone, icon, text }: { tone: "neutral" | "danger"; icon: ReactNode; text: string }) {
  return <div className={cn("flex items-start gap-2 rounded-[var(--agent-message-notice-radius)] border-[length:var(--agent-message-notice-border-width)] border-[hsl(var(--agent-message-notice-border-color))] [border-style:var(--agent-message-notice-border-style)] bg-[hsl(var(--agent-message-notice-background))] px-[var(--agent-message-notice-padding-x)] py-[var(--agent-message-notice-padding-y)] text-sm", tone === "danger" ? "text-destructive" : "text-[hsl(var(--agent-message-notice-foreground))]")}>{icon}<span data-selectable-text>{text}</span></div>;
}

function MarkdownContent({ text, onOpenLink }: { text: string; onOpenLink: (url: string) => void }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => <a href={href} onClick={(event) => { event.preventDefault(); if (href) onOpenLink(href); }}>{children}</a>
  }}>{text}</ReactMarkdown>;
}

function AgentInteractionDialog({ controller, request }: { controller: AgentController; request: AgentInteractionRequest | null }) {
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [request?.id]);
  if (!request) return null;
  const isConfirm = request.method === "confirm" || request.method === "trust";
  return <Dialog open onOpenChange={(open) => { if (!open) void controller.resolveInteraction({ cancelled: true, confirmed: false }); }}><DialogContent className="max-w-md p-5"><DialogTitle className="text-base font-semibold">{request.title}</DialogTitle>{request.message ? <DialogDescription className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{request.message}</DialogDescription> : null}{request.options?.length ? <div className="mt-4 grid gap-2">{request.options.map((option) => <Button key={option.id} variant="secondary" className="h-auto justify-start py-2 text-left" onClick={() => void controller.resolveInteraction(request.method === "trust" ? { index: Number(option.id) } : { value: option.id, confirmed: true })}><span><span className="block">{option.label}</span>{option.description ? <span className="block text-xs text-muted-foreground">{option.description}</span> : null}</span></Button>)}</div> : !isConfirm ? <Input className="mt-4" autoFocus type={request.secret ? "password" : "text"} value={value} placeholder={request.placeholder} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void controller.resolveInteraction({ value, confirmed: true }); }} /> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => void controller.resolveInteraction({ cancelled: true, confirmed: false })}>取消</Button>{!request.options?.length ? <Button onClick={() => void controller.resolveInteraction(isConfirm ? { confirmed: true } : { value, confirmed: true })}>确认</Button> : null}</div></DialogContent></Dialog>;
}

function IconButton({ label, children, className, ...props }: Omit<React.ComponentProps<typeof Button>, "size"> & { label: string }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className={className} aria-label={label} {...props}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function useWideAgentPanel(ref: React.RefObject<HTMLElement | null>) {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= 840));
    observer.observe(element);
    setWide(element.getBoundingClientRect().width >= 840);
    return () => observer.disconnect();
  }, [ref]);
  return wide;
}

function sessionTitle(controller: AgentController) {
  return String(controller.sessionState?.sessionName || controller.overview?.session?.name || "Pi Agent");
}

function sessionLabel(session: Record<string, any>) {
  return String(session.name || session.firstMessage || "未命名会话");
}

function groupSessions(sessions: Record<string, any>[]) {
  const today: Record<string, any>[] = [];
  const recent: Record<string, any>[] = [];
  const older: Record<string, any>[] = [];
  const now = Date.now();
  for (const session of sessions) {
    const age = now - new Date(session.modified || session.created || 0).getTime();
    if (age < 24 * 60 * 60_000) today.push(session);
    else if (age < 7 * 24 * 60 * 60_000) recent.push(session);
    else older.push(session);
  }
  return [{ label: "今天", sessions: today }, { label: "最近 7 天", sessions: recent }, { label: "更早", sessions: older }].filter((group) => group.sessions.length);
}

function relativeTime(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function groupReferences(references: RuntimeAgentReference[]) {
  const order = ["file", "text", "markdown", "mermaid-node", "mermaid-edge", "mermaid-subgraph", "canvas-element"];
  const labels: Record<string, string> = { file: "文件", text: "文本选区", markdown: "Markdown 选区", "mermaid-node": "节点", "mermaid-edge": "连线", "mermaid-subgraph": "组", "canvas-element": "画布元素" };
  return order.map((kind) => ({ label: labels[kind], references: references.filter((reference) => reference.kind === kind) })).filter((group) => group.references.length);
}

function referenceLabel(reference: RuntimeAgentReference) {
  if (reference.kind === "file") return reference.label;
  if ("text" in reference) return reference.text.slice(0, 64);
  return reference.label;
}

function dedupeRefs(references: RuntimeAgentReference[]) {
  const seen = new Set<string>();
  return references.filter((reference) => { const key = JSON.stringify(reference); if (seen.has(key)) return false; seen.add(key); return true; });
}

function thinkingLabel(level: string) {
  return ({ off: "关闭", minimal: "极少", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最大" } as Record<string, string>)[level] || level;
}

function toolStatusLabel(status: AgentToolActivity["status"]) {
  return status === "running" ? "运行中" : status === "error" ? "失败" : "完成";
}

function humanToolName(name: string) {
  return ({
    mmm_get_workspace_context: "读取编辑器上下文",
    mmm_read_open_document: "读取打开的文档",
    mmm_apply_open_document_patch: "修改打开的文档",
    mmm_reveal_reference: "定位编辑器引用",
    bash: "运行命令",
    read: "读取文件",
    write: "写入文件",
    edit: "编辑文件",
    grep: "搜索内容",
    find: "查找文件",
    ls: "列出目录"
  } as Record<string, string>)[name] || name;
}

function printableToolValue(value: unknown) {
  let full: string;
  try { full = typeof value === "string" ? value : JSON.stringify(value, null, 2); }
  catch { full = String(value); }
  const limit = 20_000;
  return { full, preview: full.length > limit ? `${full.slice(0, limit)}\n…` : full, truncated: full.length > limit };
}

async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(text);
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
