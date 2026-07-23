"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle,
  Copy,
  Download,
  EditPencil,
  Key,
  LogOut,
  Package,
  Plus,
  Refresh,
  Settings,
  Tools,
  Trash,
  User,
  WarningTriangle,
  Xmark
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { AgentController } from "./use-agent-session";

export function AgentSettingsDialog({ controller, open, onOpenChange }: { controller: AgentController; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [page, setPage] = useState("models");
  const loadOverview = controller.loadOverview;
  const setControllerError = controller.setError;

  useEffect(() => {
    if (!open) return;
    void loadOverview().catch((error) => setControllerError(readableError(error)));
  }, [loadOverview, open, setControllerError]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(720px,calc(100vh-48px))] max-w-[min(920px,calc(100vw-48px))] grid-rows-[auto_minmax(0,1fr)] bg-card p-0">
        <div className="flex min-w-0 items-center gap-3 border-b px-5 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base font-semibold">Agent 设置</DialogTitle>
            <DialogDescription className="sr-only">管理 Pi 模型、工具、资源、设置与项目信任。</DialogDescription>
          </div>
          {controller.busyAction ? <span className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="size-3.5" />正在处理</span> : null}
          <DialogClose asChild><Button variant="ghost" size="icon" aria-label="关闭 Agent 设置"><Xmark /></Button></DialogClose>
        </div>

        {!controller.overview ? (
          <Empty>
            <EmptyMedia>{controller.overviewBusy ? <Spinner /> : <Settings />}</EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>{controller.overviewBusy ? "正在读取设置" : "设置尚未载入"}</EmptyTitle>
              {!controller.overviewBusy ? <EmptyDescription>重新读取 Pi 的模型与项目配置。</EmptyDescription> : null}
            </EmptyHeader>
            {!controller.overviewBusy ? <Button onClick={() => void controller.loadOverview(true)}>重新载入</Button> : null}
          </Empty>
        ) : (
          <Tabs orientation="vertical" value={page} onValueChange={setPage} className="grid min-h-0 grid-cols-[11.5rem_minmax(0,1fr)] max-[700px]:grid-cols-[3.5rem_minmax(0,1fr)]">
            <TabsList className="h-full flex-col items-stretch justify-start rounded-none border-r bg-muted/25 p-2">
              <SettingsTab value="models" icon={<User />} label="模型与账户" />
              <SettingsTab value="tools" icon={<Tools />} label="工具与命令" />
              <SettingsTab value="resources" icon={<Package />} label="资源与包" />
              <SettingsTab value="settings" icon={<Settings />} label="设置" />
              <SettingsTab value="trust" icon={<Key />} label="信任与诊断" />
            </TabsList>
            <ScrollArea className="min-h-0">
              {controller.error ? <div className="mx-5 mt-4"><Notice tone="danger" icon={<WarningTriangle />} text={controller.error} /></div> : null}
              <SettingsPage value="models"><ModelsPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="tools"><ToolsPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="resources"><ResourcesPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="settings"><PiSettingsPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="trust"><TrustPage controller={controller} overview={controller.overview} /></SettingsPage>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsTab({ value, icon, label }: { value: string; icon: ReactNode; label: string }) {
  return <TabsTrigger value={value} aria-label={label} className="w-full flex-none justify-start bg-transparent px-3 max-[700px]:justify-center max-[700px]:px-0 data-[state=active]:bg-card">{icon}<span className="max-[700px]:sr-only">{label}</span></TabsTrigger>;
}

function SettingsPage({ value, children }: { value: string; children: ReactNode }) {
  return <TabsContent value={value} className="m-0 p-5">{children}</TabsContent>;
}

function ModelsPage({ controller, overview }: ControlProps) {
  const [query, setQuery] = useState("");
  const [providerEditor, setProviderEditor] = useState<{ provider?: any; config?: any; custom: boolean } | null>(null);
  const providers = [...(overview.models?.providers || [])].sort((a: any, b: any) => Number(Boolean(b.configured)) - Number(Boolean(a.configured)));
  const providerConfigs = overview.models?.config?.providers || [];
  const providerConfigById = new Map(providerConfigs.map((config: any) => [config.id, config]));
  const models = overview.models?.models || [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProviders = providers.filter((provider: any) => `${provider.name || ""} ${provider.id || ""}`.toLowerCase().includes(normalizedQuery));
  const configured = visibleProviders.filter((provider: any) => provider.configured);
  const available = visibleProviders.filter((provider: any) => !provider.configured);
  const visibleModels = models.filter((model: any) => `${model.name || ""} ${model.id || ""} ${model.provider || ""}`.toLowerCase().includes(normalizedQuery));

  return <Section title="模型与账户" action={<div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setProviderEditor({ custom: true })}><Plus />自定义</Button><Button variant="ghost" size="icon" aria-label="刷新模型" onClick={() => void controller.loadOverview(true)}><Refresh /></Button></div>}>
    <AuthFlowPanel controller={controller} />
    {overview.models?.config?.error ? <Notice tone="danger" icon={<WarningTriangle />} text={`models.json：${overview.models.config.error}`} /> : null}
    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务商或模型" className="mb-4" />
    {configured.length ? <div className="grid gap-1">{configured.map((provider: any) => <ProviderItem key={provider.id} provider={provider} config={providerConfigById.get(provider.id)} controller={controller} onEdit={() => setProviderEditor({ provider, config: providerConfigById.get(provider.id), custom: provider.origin === "custom" })} />)}</div> : null}
    {available.length ? <Collapsible defaultOpen={!configured.length} className="mt-2">
      <CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between"><span>添加服务商</span><span className="text-xs text-muted-foreground">{available.length}</span></Button></CollapsibleTrigger>
      <CollapsibleContent className="mt-1 grid gap-1">{available.map((provider: any) => <ProviderItem key={provider.id} provider={provider} config={providerConfigById.get(provider.id)} controller={controller} onEdit={() => setProviderEditor({ provider, config: providerConfigById.get(provider.id), custom: provider.origin === "custom" })} />)}</CollapsibleContent>
    </Collapsible> : null}
    <Separator className="my-5" />
    <SectionLabel>可用模型</SectionLabel>
    {visibleModels.length ? <div className="grid gap-0.5 sm:grid-cols-2">{visibleModels.map((model: any) => <Item key={`${model.provider}:${model.id}`} className="py-1.5"><ItemContent><ItemTitle>{model.name || model.id}</ItemTitle><ItemDescription>{model.provider}</ItemDescription></ItemContent><span className={cn("size-1.5 rounded-full", model.available ? "bg-[hsl(var(--success))]" : "bg-muted-foreground/30")} /></Item>)}</div> : <InlineEmpty text="没有匹配的模型" />}
    <ProviderConfigDialog controller={controller} state={providerEditor} revision={overview.models?.config?.revision} onOpenChange={(open) => { if (!open) setProviderEditor(null); }} />
  </Section>;
}

function ProviderItem({ provider, config, controller, onEdit }: { provider: any; config?: any; controller: AgentController; onEdit: () => void }) {
  const interactiveAuth = (provider.authOptions || []).filter((auth: any) => auth.interactive);
  const ambientAuth = (provider.authOptions || []).filter((auth: any) => !auth.interactive);
  const status = provider.configured
    ? provider.status?.label || provider.status?.source || "已连接"
    : ambientAuth.length ? "等待环境凭据" : "未连接";
  return <Item className="hover:bg-muted/45">
    <ItemMedia><User /></ItemMedia>
    <ItemContent><ItemTitle>{provider.name || provider.id}</ItemTitle><ItemDescription>{status}{config ? " · 已覆盖配置" : ""}</ItemDescription></ItemContent>
    <ItemActions>
      <Button variant="ghost" size="icon" aria-label={`配置 ${provider.name || provider.id}`} onClick={onEdit}><EditPencil /></Button>
      {provider.configured
        ? <Button variant="ghost" size="sm" onClick={() => void controller.runControl({ type: "logout", providerId: provider.id }).catch((error) => handleControlError(controller, error))}><LogOut />退出</Button>
        : interactiveAuth.map((auth: any) => <Button key={auth.type} variant="secondary" size="sm" title={auth.label} onClick={() => void controller.runControl({ type: "login", providerId: provider.id, authType: auth.type }).catch((error) => handleControlError(controller, error))}><Key />{auth.label}</Button>)}
    </ItemActions>
  </Item>;
}

function AuthFlowPanel({ controller }: { controller: AgentController }) {
  const flow = controller.authFlow;
  if (!flow || flow.status === "success" || flow.status === "cancelled") return null;
  const url = flow.verificationUri || flow.url;
  const failed = flow.status === "error";
  return <div className="mb-4 rounded-[var(--theme-radius-control-md)] bg-muted/45 p-3 text-sm">
    <div className={cn("flex items-center gap-2", failed && "text-destructive")}>
      {failed ? <WarningTriangle className="size-3.5" /> : <Spinner className="size-3.5" />}
      <span className="min-w-0 flex-1">{flow.message || (failed ? "认证失败" : "正在认证")}</span>
      {!failed ? <Button variant="ghost" size="sm" onClick={() => void controller.runControl({ type: "cancel_login", providerId: flow.providerId })}>取消</Button> : null}
    </div>
    {flow.deviceCode ? <div className="mt-2 flex items-center gap-2"><code className="rounded bg-background px-2 py-1 font-mono text-base tracking-widest">{flow.deviceCode}</code><Button variant="ghost" size="icon" aria-label="复制设备代码" onClick={() => void navigator.clipboard?.writeText(flow.deviceCode || "")}><Copy /></Button></div> : null}
    {url ? <Button variant="link" className="mt-1 h-auto px-0" onClick={() => controller.openExternalUrl(url)}>在浏览器中继续</Button> : null}
    {flow.links?.map((link) => <Button key={link.url} variant="link" className="mt-1 h-auto px-2" onClick={() => controller.openExternalUrl(link.url)}>{link.label || "打开链接"}</Button>)}
  </div>;
}

type ProviderModelDraft = {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  contextWindow: number;
  maxTokens: number;
  api: string;
  baseUrl: string;
};

type ProviderDraft = {
  id: string;
  name: string;
  baseUrl: string;
  api: string;
  authMode: "stored" | "environment" | "local" | "radius" | "preserve";
  envName: string;
  authHeader: boolean;
  models: ProviderModelDraft[];
  headers: Array<{ name: string; value: string; preserve: boolean }>;
  compat: { supportsDeveloperRole: boolean; supportsReasoningEffort: boolean };
};

const MODEL_APIS = [
  ["openai-completions", "OpenAI Chat Completions"],
  ["openai-responses", "OpenAI Responses"],
  ["anthropic-messages", "Anthropic Messages"],
  ["google-generative-ai", "Google Generative AI"]
] as const;

function ProviderConfigDialog({
  controller,
  state,
  revision,
  onOpenChange
}: {
  controller: AgentController;
  state: { provider?: any; config?: any; custom: boolean } | null;
  revision?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<ProviderDraft>(() => providerDraft(state));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(providerDraft(state));
    setConfirmDelete(false);
  }, [state]);

  if (!state) return null;
  const activeState = state;
  const existing = Boolean(activeState.config);
  const newCustomProvider = !activeState.provider && !activeState.config;
  const providerId = activeState.config?.id || activeState.provider?.id;

  function updateModel(index: number, update: Partial<ProviderModelDraft>) {
    setDraft((current) => ({
      ...current,
      models: current.models.map((model, modelIndex) => modelIndex === index ? { ...model, ...update } : model)
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await controller.runControl({
        type: "upsert_provider_config",
        providerId: draft.id,
        custom: activeState.custom,
        expectedRevision: revision,
        provider: {
          name: draft.name,
          baseUrl: draft.baseUrl,
          api: draft.api,
          authMode: draft.authMode,
          envName: draft.envName,
          authHeader: draft.authHeader,
          headers: draft.headers,
          ...(activeState.custom ? { models: draft.models } : {}),
          compat: draft.compat
        }
      });
      onOpenChange(false);
      if (draft.authMode === "stored" && !activeState.provider?.configured) {
        await controller.runControl({ type: "login", providerId: draft.id, authType: "api_key" });
      }
    } catch (error) {
      handleControlError(controller, error);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await controller.runControl({ type: "delete_provider_config", providerId, expectedRevision: revision });
      onOpenChange(false);
    } catch (error) {
      handleControlError(controller, error);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent className="grid max-h-[min(760px,calc(100vh-40px))] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
      <div className="border-b px-5 py-4">
        <DialogTitle className="text-base">{newCustomProvider ? "添加自定义 Provider" : `配置 ${state.provider?.name || state.config?.name || providerId}`}</DialogTitle>
        <DialogDescription className="sr-only">配置连接、认证、模型和兼容性。</DialogDescription>
      </div>
      <ScrollArea className="min-h-0">
        <div className="grid gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider ID"><Input value={draft.id} disabled={!newCustomProvider} placeholder="my-provider" onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value.toLowerCase() }))} /></Field>
            <Field label="显示名称"><Input value={draft.name} placeholder="自定义服务商" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="Base URL" className="sm:col-span-2"><Input value={draft.baseUrl} placeholder={state.custom ? "http://localhost:11434/v1" : "留空以使用默认端点"} onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></Field>
            <Field label="API 协议">
              <Select value={draft.api || "inherit"} onValueChange={(value) => setDraft((current) => ({ ...current, api: value === "inherit" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{!state.custom ? <SelectItem value="inherit">跟随 Provider</SelectItem> : null}{MODEL_APIS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="认证方式">
              <Select value={draft.authMode} onValueChange={(value) => setDraft((current) => ({ ...current, authMode: value as ProviderDraft["authMode"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="stored">安全存储 API Key</SelectItem>
                <SelectItem value="environment">环境变量</SelectItem>
                <SelectItem value="local">本地免认证</SelectItem>
                <SelectItem value="radius">Radius OAuth</SelectItem>
                <SelectItem value="preserve">保持现有来源</SelectItem>
              </SelectContent></Select>
            </Field>
            {draft.authMode === "environment" ? <Field label="环境变量"><Input value={draft.envName} placeholder="OPENAI_API_KEY" onChange={(event) => setDraft((current) => ({ ...current, envName: event.target.value }))} /></Field> : null}
          </div>

          {state.custom ? <div>
            <div className="mb-2 flex items-center"><SectionLabel>模型</SectionLabel><Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDraft((current) => ({ ...current, models: [...current.models, blankProviderModel()] }))}><Plus />添加模型</Button></div>
            <div className="grid gap-2">{draft.models.map((model, index) => <div key={index} className="grid gap-2 rounded-[var(--theme-radius-control-md)] bg-muted/35 p-3 sm:grid-cols-2">
              <Field label="模型 ID"><Input value={model.id} placeholder="model-id" onChange={(event) => updateModel(index, { id: event.target.value })} /></Field>
              <Field label="显示名称"><Input value={model.name} placeholder="可选" onChange={(event) => updateModel(index, { name: event.target.value })} /></Field>
              <Field label="上下文长度"><Input type="number" min={1} value={model.contextWindow} onChange={(event) => updateModel(index, { contextWindow: Number(event.target.value) })} /></Field>
              <Field label="最大输出"><Input type="number" min={1} value={model.maxTokens} onChange={(event) => updateModel(index, { maxTokens: Number(event.target.value) })} /></Field>
              <Field label="模型 API 覆盖"><Select value={model.api || "inherit"} onValueChange={(value) => updateModel(index, { api: value === "inherit" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">跟随 Provider</SelectItem>{MODEL_APIS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="模型 Base URL"><Input value={model.baseUrl} placeholder="跟随 Provider" onChange={(event) => updateModel(index, { baseUrl: event.target.value })} /></Field>
              <SettingSwitch label="推理模型" checked={model.reasoning} onCheckedChange={(reasoning) => updateModel(index, { reasoning })} />
              <SettingSwitch label="支持图片" checked={model.input.includes("image")} onCheckedChange={(image) => updateModel(index, { input: image ? ["text", "image"] : ["text"] })} />
              {draft.models.length > 1 ? <Button variant="ghost" size="sm" className="sm:col-span-2 sm:justify-self-end" onClick={() => setDraft((current) => ({ ...current, models: current.models.filter((_, modelIndex) => modelIndex !== index) }))}><Trash />移除模型</Button> : null}
            </div>)}</div>
          </div> : null}

          <Collapsible>
            <CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between">高级兼容性<span className="text-xs text-muted-foreground">{state.config?.headerKeys?.length ? `${state.config.headerKeys.length} 个保留 Header` : ""}</span></Button></CollapsibleTrigger>
            <CollapsibleContent className="mt-2 grid gap-1">
              <SettingSwitch label="自动添加 Authorization Header" checked={draft.authHeader} onCheckedChange={(authHeader) => setDraft((current) => ({ ...current, authHeader }))} />
              <SettingSwitch label="支持 Developer Role" checked={draft.compat.supportsDeveloperRole} onCheckedChange={(value) => setDraft((current) => ({ ...current, compat: { ...current.compat, supportsDeveloperRole: value } }))} />
              <SettingSwitch label="支持 Reasoning Effort" checked={draft.compat.supportsReasoningEffort} onCheckedChange={(value) => setDraft((current) => ({ ...current, compat: { ...current.compat, supportsReasoningEffort: value } }))} />
              <div className="mt-3 flex items-center"><SectionLabel>自定义 Headers</SectionLabel><Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDraft((current) => ({ ...current, headers: [...current.headers, { name: "", value: "", preserve: false }] }))}><Plus />添加</Button></div>
              {draft.headers.map((header, index) => <div key={index} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] gap-2 px-2">
                <Input aria-label="Header 名称" value={header.name} placeholder="X-Custom-Header" onChange={(event) => setDraft((current) => ({ ...current, headers: current.headers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} />
                <Input aria-label={`${header.name || "Header"} 值`} type="password" value={header.value} placeholder={header.preserve ? "保持现有值" : "$ENV_OR_VALUE"} onChange={(event) => setDraft((current) => ({ ...current, headers: current.headers.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} />
                <Button variant="ghost" size="icon" aria-label={`移除 ${header.name || "Header"}`} onClick={() => setDraft((current) => ({ ...current, headers: current.headers.filter((_, itemIndex) => itemIndex !== index) }))}><Trash /></Button>
              </div>)}
            </CollapsibleContent>
          </Collapsible>

          {confirmDelete ? <Notice tone="danger" icon={<WarningTriangle />} text="只删除 models.json 中的配置；已安全存储的凭据需通过“退出”单独删除。" /> : null}
        </div>
      </ScrollArea>
      <div className="flex items-center gap-2 border-t px-5 py-3">
        {existing ? confirmDelete
          ? <><Button variant="destructive" disabled={saving} onClick={() => void remove()}>确认删除</Button><Button variant="ghost" onClick={() => setConfirmDelete(false)}>取消删除</Button></>
          : <Button variant="ghost" className="text-destructive" disabled={saving} onClick={() => setConfirmDelete(true)}><Trash />删除配置</Button>
          : null}
        <Button variant="ghost" className="ml-auto" onClick={() => onOpenChange(false)}>取消</Button>
        <Button disabled={saving || !draft.id.trim()} onClick={() => void save()}>{saving ? <Spinner className="size-3.5" /> : null}保存</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={cn("grid gap-1.5 text-xs text-muted-foreground", className)}><span>{label}</span>{children}</label>;
}

function providerDraft(state: { provider?: any; config?: any; custom: boolean } | null): ProviderDraft {
  const config = state?.config;
  const custom = state?.custom ?? true;
  return {
    id: config?.id || state?.provider?.id || "",
    name: config?.name === config?.id ? "" : config?.name || "",
    baseUrl: config?.baseUrl || "",
    api: config?.api || (custom ? "openai-completions" : ""),
    authMode: config?.credential?.mode || (custom ? "stored" : "preserve"),
    envName: config?.credential?.envName || "",
    authHeader: Boolean(config?.authHeader),
    models: config?.models?.length ? config.models : custom ? [blankProviderModel()] : [],
    headers: (config?.headerKeys || []).map((name: string) => ({ name, value: "", preserve: true })),
    compat: {
      supportsDeveloperRole: config?.compat?.supportsDeveloperRole !== false,
      supportsReasoningEffort: config?.compat?.supportsReasoningEffort !== false
    }
  };
}

function blankProviderModel(): ProviderModelDraft {
  return { id: "", name: "", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 32000, api: "", baseUrl: "" };
}

function ToolsPage({ controller, overview }: ControlProps) {
  const all = overview.tools?.all || [];
  const active = new Set<string>(overview.tools?.active || []);
  const core = all.filter((tool: any) => toolName(tool).startsWith("mmm_"));
  const project = all.filter((tool: any) => !toolName(tool).startsWith("mmm_"));
  return <Section title="工具与命令">
    <SectionLabel>编辑器上下文</SectionLabel>
    <div className="grid gap-0.5">{core.map((tool: any) => <ToolItem key={toolName(tool)} tool={tool} checked locked controller={controller} active={active} scratch={false} />)}</div>
    <Separator className="my-5" />
    <SectionLabel>项目工具</SectionLabel>
    {project.length ? <div className="grid gap-0.5">{project.map((tool: any) => <ToolItem key={toolName(tool)} tool={tool} checked={active.has(toolName(tool))} controller={controller} active={active} scratch={Boolean(overview.scratch)} />)}</div> : <InlineEmpty text="没有项目工具" />}
    <Separator className="my-5" />
    <SectionLabel>命令</SectionLabel>
    {(overview.commands || []).length ? <div className="grid gap-0.5">{(overview.commands || []).map((command: any) => <Item key={`${command.source}:${command.name}`}><ItemContent><ItemTitle className="font-mono">/{command.name}</ItemTitle><ItemDescription>{command.description || command.source}</ItemDescription></ItemContent></Item>)}</div> : <InlineEmpty text="没有可用命令" />}
  </Section>;
}

function ToolItem({ tool, checked, locked = false, controller, active, scratch }: { tool: any; checked: boolean; locked?: boolean; controller: AgentController; active: Set<string>; scratch: boolean }) {
  const name = toolName(tool);
  const disabled = locked || scratch;
  return <Item className={disabled ? "opacity-70" : "hover:bg-muted/45"}>
    <ItemMedia><Tools /></ItemMedia>
    <ItemContent><ItemTitle>{humanToolLabel(name, tool)}</ItemTitle><ItemDescription>{locked ? "始终启用" : scratch ? "打开项目后可用" : name}</ItemDescription></ItemContent>
    <Switch aria-label={`切换 ${name}`} checked={checked} disabled={disabled} onCheckedChange={(nextChecked) => {
      const next = new Set(active);
      if (nextChecked) next.add(name); else next.delete(name);
      void controller.runControl({ type: "set_active_tools", toolNames: Array.from(next) }).catch((error) => controller.setError(readableError(error)));
    }} />
  </Item>;
}

function ResourcesPage({ controller, overview }: ControlProps) {
  const resources = overview.resources || {};
  const [source, setSource] = useState("");
  const packages = overview.packages || [];
  return <Section title="资源与包" action={<Button variant="ghost" size="icon" aria-label="重新载入资源" onClick={() => void controller.runControl({ type: "reload" })}><Refresh /></Button>}>
    <ResourceGroup title="Skills" items={(resources.skills?.skills || []).map((item: any) => item.name || item.path)} />
    <ResourceGroup title="Extensions" items={(resources.extensions || []).filter((item: any) => !item.hidden).map((item: any) => item.path)} />
    <ResourceGroup title="Prompts" items={(resources.prompts?.prompts || []).map((item: any) => item.name || item.path)} />
    <Separator className="my-5" />
    <SectionLabel>Packages</SectionLabel>
    {packages.length ? <div className="grid gap-0.5">{packages.map((item: any, index: number) => {
      const packageSource = typeof item === "string" ? item : item.source || item.path || `package-${index}`;
      return <Item key={`${packageSource}-${index}`}><ItemMedia><Package /></ItemMedia><ItemContent><ItemTitle>{packageSource}</ItemTitle></ItemContent><ItemActions><Button variant="ghost" size="icon" aria-label={`更新 ${packageSource}`} onClick={() => void controller.runControl({ type: "package_update", source: packageSource })}><Refresh /></Button><Button variant="ghost" size="icon" aria-label={`移除 ${packageSource}`} onClick={() => void controller.runControl({ type: "package_remove", source: packageSource })}><Trash /></Button></ItemActions></Item>;
    })}</div> : <InlineEmpty text="没有安装包" />}
    <div className="mt-4 flex gap-2"><Input value={source} onChange={(event) => setSource(event.target.value)} placeholder="npm 包、Git URL 或本地路径" /><Button disabled={!source.trim()} onClick={() => void controller.runControl({ type: "package_install", source }).then(() => setSource("")).catch((error) => controller.setError(readableError(error)))}><Download />安装</Button></div>
  </Section>;
}

function ResourceGroup({ title, items }: { title: string; items: string[] }) {
  return <Collapsible className="mb-2"><CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between"><span>{title}</span><span className="text-xs text-muted-foreground">{items.length}</span></Button></CollapsibleTrigger><CollapsibleContent className="grid gap-0.5 pl-2">{items.length ? items.map((item, index) => <Item key={`${item}-${index}`} className="py-1.5"><ItemContent><ItemTitle>{item}</ItemTitle></ItemContent></Item>) : <InlineEmpty text="无" />}</CollapsibleContent></Collapsible>;
}

function PiSettingsPage({ controller, overview }: ControlProps) {
  const [scope, setScope] = useState<"global" | "project">("global");
  const sourceSettings = overview.settings?.[scope] || {};
  const [text, setText] = useState(() => JSON.stringify(sourceSettings, null, 2));
  const parsed = useMemo(() => safeParseObject(text), [text]);

  useEffect(() => setText(JSON.stringify(overview.settings?.[scope] || {}, null, 2)), [overview.settings, scope]);

  function updateSetting(key: string, value: unknown) {
    const next = { ...(parsed.value || sourceSettings), [key]: value };
    setText(JSON.stringify(next, null, 2));
  }

  return <Section title="设置">
    <div className="mb-4 flex gap-1"><Button size="sm" variant={scope === "global" ? "secondary" : "ghost"} onClick={() => setScope("global")}>全局</Button><Button size="sm" variant={scope === "project" ? "secondary" : "ghost"} onClick={() => setScope("project")}>项目</Button></div>
    <SettingSwitch label="隐藏思考过程" checked={Boolean(parsed.value?.hideThinkingBlock)} onCheckedChange={(value) => updateSetting("hideThinkingBlock", value)} />
    <SettingSwitch label="启用 Skill 命令" checked={parsed.value?.enableSkillCommands !== false} onCheckedChange={(value) => updateSetting("enableSkillCommands", value)} />
    <SettingSelect label="运行中消息" value={String(parsed.value?.steeringMode || "one-at-a-time")} values={["one-at-a-time", "all"]} onValueChange={(value) => updateSetting("steeringMode", value)} />
    <SettingSelect label="后续消息" value={String(parsed.value?.followUpMode || "one-at-a-time")} values={["one-at-a-time", "all"]} onValueChange={(value) => updateSetting("followUpMode", value)} />
    {scope === "global" ? <SettingSelect label="默认项目信任" value={String(parsed.value?.defaultProjectTrust || "ask")} values={["ask", "always", "never"]} onValueChange={(value) => updateSetting("defaultProjectTrust", value)} /> : null}
    <Separator className="my-5" />
    <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between">高级 JSON<span className="text-xs text-muted-foreground">{parsed.error ? "格式错误" : ""}</span></Button></CollapsibleTrigger><CollapsibleContent className="mt-2"><Textarea value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} className="min-h-72 font-mono text-xs" /></CollapsibleContent></Collapsible>
    {parsed.error ? <p className="mt-2 text-xs text-destructive">{parsed.error}</p> : null}
    <div className="mt-4 flex justify-end"><Button disabled={!parsed.value} onClick={() => void controller.runControl({ type: "replace_settings", scope, value: parsed.value, expectedRevision: overview.settings?.revisions?.[scope] }).catch((error) => controller.setError(readableError(error)))}>保存</Button></div>
  </Section>;
}

function SettingSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <Item><ItemContent><ItemTitle>{label}</ItemTitle></ItemContent><Switch aria-label={label} checked={checked} onCheckedChange={onCheckedChange} /></Item>;
}

function SettingSelect({ label, value, values, onValueChange }: { label: string; value: string; values: string[]; onValueChange: (value: string) => void }) {
  return <Item><ItemContent><ItemTitle>{label}</ItemTitle></ItemContent><Select value={value} onValueChange={onValueChange}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{settingValueLabel(item)}</SelectItem>)}</SelectContent></Select></Item>;
}

function TrustPage({ controller, overview }: ControlProps) {
  const trust = overview.trust || {};
  return <Section title="信任与诊断">
    <Item><ItemMedia><Key /></ItemMedia><ItemContent><ItemTitle>项目资源</ItemTitle><ItemDescription>{overview.scratch ? "临时画布不加载项目资源" : trust.trusted ? "已信任 .pi 资源" : "未信任项目资源"}</ItemDescription></ItemContent><Switch aria-label="信任项目资源" disabled={Boolean(overview.scratch)} checked={Boolean(trust.trusted)} onCheckedChange={(trusted) => void controller.runControl({ type: "trust_set", trusted }).catch((error) => controller.setError(readableError(error)))} /></Item>
    <Separator className="my-5" />
    <SectionLabel>诊断</SectionLabel>
    {(overview.diagnostics || []).length ? <div className="grid gap-2">{overview.diagnostics.map((item: any, index: number) => <Notice key={index} tone={item.type === "error" ? "danger" : "neutral"} icon={item.type === "error" ? <WarningTriangle /> : <CheckCircle />} text={item.message || String(item)} />)}</div> : <Notice tone="neutral" icon={<CheckCircle />} text="没有运行时诊断" />}
  </Section>;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section><div className="mb-5 flex items-center gap-3"><h2 className="text-base font-semibold">{title}</h2><div className="ml-auto">{action}</div></div>{children}</section>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 px-2 text-xs font-medium text-muted-foreground">{children}</h3>;
}

function InlineEmpty({ text }: { text: string }) {
  return <div className="px-3 py-4 text-center text-xs text-muted-foreground">{text}</div>;
}

function Notice({ tone, icon, text }: { tone: "neutral" | "danger"; icon: ReactNode; text: string }) {
  return <div className={cn("flex items-start gap-2 rounded-[var(--agent-message-notice-radius)] border-[length:var(--agent-message-notice-border-width)] border-[hsl(var(--agent-message-notice-border-color))] [border-style:var(--agent-message-notice-border-style)] bg-[hsl(var(--agent-message-notice-background))] px-[var(--agent-message-notice-padding-x)] py-[var(--agent-message-notice-padding-y)] text-sm", tone === "danger" ? "text-destructive" : "text-[hsl(var(--agent-message-notice-foreground))]")}>{icon}<span>{text}</span></div>;
}

function toolName(tool: any) {
  return String(tool?.name || tool || "tool");
}

function humanToolLabel(name: string, tool: any) {
  const core: Record<string, string> = {
    mmm_get_workspace_context: "读取编辑器上下文",
    mmm_read_open_document: "读取打开的文档",
    mmm_apply_open_document_patch: "修改打开的文档",
    mmm_reveal_reference: "定位编辑器引用"
  };
  return core[name] || String(tool?.label || name);
}

function safeParseObject(text: string): { value: Record<string, any> | null; error: string | null } {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { value: null, error: "设置必须是 JSON 对象" };
    return { value, error: null };
  } catch (error) {
    return { value: null, error: readableError(error) };
  }
}

function settingValueLabel(value: string) {
  return ({ "one-at-a-time": "逐条", all: "全部", ask: "每次询问", always: "始终信任", never: "从不信任" } as Record<string, string>)[value] || value;
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function handleControlError(controller: AgentController, error: unknown) {
  const message = readableError(error);
  if (message.includes("认证已取消")) return;
  controller.setError(message);
}

type ControlProps = { controller: AgentController; overview: Record<string, any> };
