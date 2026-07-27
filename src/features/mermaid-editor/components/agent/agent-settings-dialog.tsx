"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle,
  Copy,
  Download,
  EditPencil,
  Key,
  LogOut,
  NavArrowLeft,
  Package,
  Plus,
  Refresh,
  Search,
  Settings,
  Tools,
  Trash,
  User,
  WarningTriangle
} from "iconoir-react/regular";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  EditorConfirmDialog,
  EditorIconButton,
  SettingsAccordion,
  SettingsAccordionCard,
  SettingsTabs,
  SettingsTabsBody,
  SettingsTabsContent,
  SettingsTabsList
} from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import { cn } from "@/lib/utils";

import type { AgentController } from "./use-agent-session";

export function AgentSettingsPanel({ controller, onBack }: { controller: AgentController; onBack: () => void }) {
  const [page, setPage] = useState("models");
  const loadOverview = controller.loadOverview;
  const setControllerError = controller.setError;

  useEffect(() => {
    if (controller.status !== "ready") return;
    void loadOverview().catch((error) => setControllerError(readableError(error)));
  }, [controller.status, loadOverview, setControllerError]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <WorkspaceWindowHeader
        leadingActions={<EditorIconButton context="panel" label="返回聊天" onClick={onBack}><NavArrowLeft data-icon="inline-start" /></EditorIconButton>}
        icon={<Settings className="size-4 shrink-0" />}
        title="Agent 设置"
        status={controller.busyAction ? <span className="type-interface-status flex items-center gap-2 text-muted-foreground"><Spinner />正在处理</span> : null}
      />

      {!controller.overview ? (
          <Empty className="min-h-0 flex-1">
            <EmptyMedia>{controller.overviewBusy || controller.status === "starting" ? <Spinner /> : <Settings />}</EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>{controller.status === "starting" ? "正在启动 Agent" : controller.overviewBusy ? "正在读取设置" : "设置尚未载入"}</EmptyTitle>
            </EmptyHeader>
            {!controller.overviewBusy && controller.status === "ready" ? <Button onClick={() => void controller.loadOverview(true)}>重新载入</Button> : null}
          </Empty>
      ) : (
          <SettingsTabs value={page} onValueChange={setPage}>
            <SettingsTabsList aria-label="Agent 设置分类">
              <SettingsTab value="models" icon={<User data-icon="inline-start" />} label="模型与账户" />
              <SettingsTab value="tools" icon={<Tools data-icon="inline-start" />} label="工具与命令" />
              <SettingsTab value="resources" icon={<Package data-icon="inline-start" />} label="资源与包" />
              <SettingsTab value="settings" icon={<Settings data-icon="inline-start" />} label="设置" />
              <SettingsTab value="trust" icon={<Key data-icon="inline-start" />} label="信任与诊断" />
            </SettingsTabsList>
            <SettingsTabsBody>
              <SettingsPage value="models" error={controller.error}><ModelsPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="tools" error={controller.error}><ToolsPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="resources" error={controller.error}><ResourcesPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="settings" error={controller.error}><PiSettingsPage controller={controller} overview={controller.overview} /></SettingsPage>
              <SettingsPage value="trust" error={controller.error}><TrustPage controller={controller} overview={controller.overview} /></SettingsPage>
            </SettingsTabsBody>
          </SettingsTabs>
      )}
    </div>
  );
}

function SettingsTab({ value, icon, label }: { value: string; icon: ReactNode; label: string }) {
  return <TabsTrigger value={value} aria-label={label} className="w-full flex-none justify-start">{icon}<span>{label}</span></TabsTrigger>;
}

function SettingsPage({ value, error, children }: { value: string; error?: string | null; children: ReactNode }) {
  return <SettingsTabsContent value={value} contentClassName="grid gap-4 p-5">{error ? <Notice tone="danger" icon={<WarningTriangle />} text={error} /> : null}{children}</SettingsTabsContent>;
}

function ModelsPage({ controller, overview }: ControlProps) {
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState<string[]>([]);
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

  return <div className="grid gap-4">
    <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setProviderEditor({ custom: true })}><Plus data-icon="inline-start" />自定义</Button><Button variant="ghost" size="icon" aria-label="刷新模型" onClick={() => void controller.loadOverview(true)}><Refresh data-icon="inline-start" /></Button></div>
    <AuthFlowPanel controller={controller} />
    {overview.models?.config?.error ? <Notice tone="danger" icon={<WarningTriangle />} text={`models.json：${overview.models.config.error}`} /> : null}
    <InputGroup>
      <InputGroupAddon><Search /></InputGroupAddon>
      <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务商或模型" aria-label="搜索服务商或模型" />
    </InputGroup>
    <SettingsAccordion value={openSections} onValueChange={setOpenSections}>
      {configured.length ? <SettingsAccordionCard value="configured" title="已连接服务商" action={<Badge>{configured.length}</Badge>}>
        <div className="grid gap-1">{configured.map((provider: any) => <ProviderItem key={provider.id} provider={provider} config={providerConfigById.get(provider.id)} controller={controller} onEdit={() => setProviderEditor({ provider, config: providerConfigById.get(provider.id), custom: provider.origin === "custom" })} />)}</div>
      </SettingsAccordionCard> : null}
      {available.length ? <SettingsAccordionCard value="available" title="添加服务商" action={<Badge>{available.length}</Badge>}>
        <div className="grid gap-1">{available.map((provider: any) => <ProviderItem key={provider.id} provider={provider} config={providerConfigById.get(provider.id)} controller={controller} onEdit={() => setProviderEditor({ provider, config: providerConfigById.get(provider.id), custom: provider.origin === "custom" })} />)}</div>
      </SettingsAccordionCard> : null}
      <SettingsAccordionCard value="models" title="可用模型" action={<Badge>{visibleModels.length}</Badge>}>
        {visibleModels.length ? <div className="grid gap-0.5 sm:grid-cols-2">{visibleModels.map((model: any) => <Item key={`${model.provider}:${model.id}`}><ItemContent><ItemTitle>{model.name || model.id}</ItemTitle><ItemDescription>{providerDisplayName(providers, model.provider)}</ItemDescription></ItemContent><Badge tone={model.available ? "accent" : "neutral"}>{model.available ? "可用" : "不可用"}</Badge></Item>)}</div> : <InlineEmpty text="没有匹配的模型" />}
      </SettingsAccordionCard>
    </SettingsAccordion>
    <ProviderConfigDialog controller={controller} state={providerEditor} revision={overview.models?.config?.revision} onOpenChange={(open) => { if (!open) setProviderEditor(null); }} />
  </div>;
}

function ProviderItem({ provider, config, controller, onEdit }: { provider: any; config?: any; controller: AgentController; onEdit: () => void }) {
  const interactiveAuth = (provider.authOptions || []).filter((auth: any) => auth.interactive);
  const ambientAuth = (provider.authOptions || []).filter((auth: any) => !auth.interactive);
  const status = provider.configured
    ? provider.status?.label || provider.status?.source || "已连接"
    : ambientAuth.length ? "等待环境凭据" : "未连接";
  function login(auth: any) {
    void controller.runControl({ type: "login", providerId: provider.id, authType: auth.type }).catch((error) => handleControlError(controller, error));
  }

  return <Item>
    <ItemMedia><User /></ItemMedia>
    <ItemContent><ItemTitle>{provider.name || provider.id}</ItemTitle><ItemDescription>{status}{config ? " · 已覆盖配置" : ""}</ItemDescription></ItemContent>
    <ItemActions>
      <ProviderAction label={`配置 ${provider.name || provider.id}`} onClick={onEdit}><EditPencil data-icon="inline-start" /></ProviderAction>
      {provider.configured
        ? <ProviderAction label={`退出 ${provider.name || provider.id}`} onClick={() => void controller.runControl({ type: "logout", providerId: provider.id }).catch((error) => handleControlError(controller, error))}><LogOut data-icon="inline-start" /></ProviderAction>
        : interactiveAuth.length === 1
          ? <ProviderConnectButton label={`连接 ${provider.name || provider.id}：${interactiveAuth[0].label}`} onClick={() => login(interactiveAuth[0])} />
          : interactiveAuth.length > 1
            ? <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" aria-label={`连接 ${provider.name || provider.id}`}><Key data-icon="inline-start" /></Button></DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>连接 {provider.name || provider.id}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end"><DropdownMenuGroup>{interactiveAuth.map((auth: any) => <DropdownMenuItem key={auth.type} onSelect={() => login(auth)}><Key data-icon />{auth.label}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent>
              </DropdownMenu>
            : null}
    </ItemActions>
  </Item>;
}

function ProviderConnectButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="secondary" size="icon" aria-label={label} onClick={onClick}><Key data-icon="inline-start" /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function ProviderAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function AuthFlowPanel({ controller }: { controller: AgentController }) {
  const flow = controller.authFlow;
  if (!flow || flow.status === "success" || flow.status === "cancelled") return null;
  const url = flow.verificationUri || flow.url;
  const failed = flow.status === "error";
  return <Alert role={failed ? "alert" : "status"} variant={failed ? "destructive" : "default"} className="mb-4">
    {failed ? <WarningTriangle data-icon /> : <Spinner />}
    <AlertDescription>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1">{flow.message || (failed ? "认证失败" : "正在认证")}</span>
        {!failed ? <Button variant="ghost" size="sm" onClick={() => void controller.runControl({ type: "cancel_login", providerId: flow.providerId })}>取消</Button> : null}
      </div>
      {flow.deviceCode ? <div className="mt-2 flex items-center gap-2"><code className="rounded bg-background px-2 py-1 font-mono text-base tracking-widest">{flow.deviceCode}</code><Button variant="ghost" size="icon" aria-label="复制设备代码" onClick={() => void navigator.clipboard?.writeText(flow.deviceCode || "")}><Copy data-icon="inline-start" /></Button></div> : null}
      {url ? <Button variant="link" className="mt-1" onClick={() => controller.openExternalUrl(url)}>在浏览器中继续</Button> : null}
      {flow.links?.map((link) => <Button key={link.url} variant="link" className="mt-1" onClick={() => controller.openExternalUrl(link.url)}>{link.label || "打开链接"}</Button>)}
    </AlertDescription>
  </Alert>;
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
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [openCompatibilitySections, setOpenCompatibilitySections] = useState<string[]>([]);

  useEffect(() => {
    setDraft(providerDraft(state));
    setConfirmDelete(false);
    setOpenSections([]);
    setOpenCompatibilitySections([]);
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

  return <>
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(760px,calc(100vh-40px))] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{newCustomProvider ? "添加自定义 Provider" : `配置 ${state.provider?.name || state.config?.name || providerId}`}</DialogTitle>
        <DialogDescription className="sr-only">配置连接、认证、模型和兼容性。</DialogDescription>
      </DialogHeader>
      <ScrollArea className="min-h-0">
        <div className="pr-3">
          <SettingsAccordion value={openSections} onValueChange={setOpenSections}>
            <SettingsAccordionCard value="connection" title="连接与认证">
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                {newCustomProvider ? <Field>
                  <FieldLabel htmlFor="agent-provider-id">Provider ID</FieldLabel>
                  <Input id="agent-provider-id" value={draft.id} placeholder="my-provider" onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value.toLowerCase() }))} />
                </Field> : null}
                <Field>
                  <FieldLabel htmlFor="agent-provider-name">显示名称</FieldLabel>
                  <Input id="agent-provider-name" value={draft.name} placeholder="自定义服务商" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="agent-provider-base-url">Base URL</FieldLabel>
                  <Input id="agent-provider-base-url" value={draft.baseUrl} placeholder={state.custom ? "http://localhost:11434/v1" : "留空以使用默认端点"} onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent-provider-api">API 协议</FieldLabel>
                  <Select value={draft.api || "inherit"} onValueChange={(value) => setDraft((current) => ({ ...current, api: value === "inherit" ? "" : value }))}><SelectTrigger id="agent-provider-api"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{!state.custom ? <SelectItem value="inherit">跟随 Provider</SelectItem> : null}{MODEL_APIS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent-provider-auth-mode">认证方式</FieldLabel>
                  <Select value={draft.authMode} onValueChange={(value) => setDraft((current) => ({ ...current, authMode: value as ProviderDraft["authMode"] }))}><SelectTrigger id="agent-provider-auth-mode"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
                    <SelectItem value="stored">安全存储 API Key</SelectItem>
                    <SelectItem value="environment">环境变量</SelectItem>
                    <SelectItem value="local">本地免认证</SelectItem>
                    <SelectItem value="radius">Radius OAuth</SelectItem>
                    <SelectItem value="preserve">保持现有来源</SelectItem>
                  </SelectGroup></SelectContent></Select>
                </Field>
                {draft.authMode === "environment" ? <Field>
                  <FieldLabel htmlFor="agent-provider-env-name">环境变量</FieldLabel>
                  <Input id="agent-provider-env-name" value={draft.envName} placeholder="OPENAI_API_KEY" onChange={(event) => setDraft((current) => ({ ...current, envName: event.target.value }))} />
                </Field> : null}
              </FieldGroup>
            </SettingsAccordionCard>

            {state.custom ? <SettingsAccordionCard
              value="models"
              title="模型"
              action={<Button variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, models: [...current.models, blankProviderModel()] }))}><Plus data-icon="inline-start" />添加模型</Button>}
            >
              <FieldGroup className="gap-4">{draft.models.map((model, index) => <FieldSet key={index}>
                <FieldLegend variant="label">模型 {index + 1}</FieldLegend>
                <FieldGroup className="grid gap-2 sm:grid-cols-2">
                <Field><FieldLabel htmlFor={`agent-provider-model-${index}-id`}>模型 ID</FieldLabel><Input id={`agent-provider-model-${index}-id`} value={model.id} placeholder="model-id" onChange={(event) => updateModel(index, { id: event.target.value })} /></Field>
                <Field><FieldLabel htmlFor={`agent-provider-model-${index}-name`}>显示名称</FieldLabel><Input id={`agent-provider-model-${index}-name`} value={model.name} placeholder="可选" onChange={(event) => updateModel(index, { name: event.target.value })} /></Field>
                <Field><FieldLabel htmlFor={`agent-provider-model-${index}-context`}>上下文长度</FieldLabel><Input id={`agent-provider-model-${index}-context`} type="number" min={1} value={model.contextWindow} onChange={(event) => updateModel(index, { contextWindow: Number(event.target.value) })} /></Field>
                <Field><FieldLabel htmlFor={`agent-provider-model-${index}-max-output`}>最大输出</FieldLabel><Input id={`agent-provider-model-${index}-max-output`} type="number" min={1} value={model.maxTokens} onChange={(event) => updateModel(index, { maxTokens: Number(event.target.value) })} /></Field>
                <Field><FieldLabel htmlFor={`agent-provider-model-${index}-api`}>模型 API 覆盖</FieldLabel><Select value={model.api || "inherit"} onValueChange={(value) => updateModel(index, { api: value === "inherit" ? "" : value })}><SelectTrigger id={`agent-provider-model-${index}-api`}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="inherit">跟随 Provider</SelectItem>{MODEL_APIS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                <Field><FieldLabel htmlFor={`agent-provider-model-${index}-base-url`}>模型 Base URL</FieldLabel><Input id={`agent-provider-model-${index}-base-url`} value={model.baseUrl} placeholder="跟随 Provider" onChange={(event) => updateModel(index, { baseUrl: event.target.value })} /></Field>
                <SettingSwitch label="推理模型" checked={model.reasoning} onCheckedChange={(reasoning) => updateModel(index, { reasoning })} />
                <SettingSwitch label="支持图片" checked={model.input.includes("image")} onCheckedChange={(image) => updateModel(index, { input: image ? ["text", "image"] : ["text"] })} />
                {draft.models.length > 1 ? <Button variant="ghost" size="sm" className="sm:col-span-2 sm:justify-self-end" onClick={() => setDraft((current) => ({ ...current, models: current.models.filter((_, modelIndex) => modelIndex !== index) }))}><Trash data-icon="inline-start" />移除模型</Button> : null}
                </FieldGroup>
              </FieldSet>)}</FieldGroup>
            </SettingsAccordionCard> : null}

            <SettingsAccordionCard
              value="compatibility"
              title="高级兼容性"
              action={state.config?.headerKeys?.length ? <Badge>{state.config.headerKeys.length} Headers</Badge> : null}
            >
              <FieldGroup className="gap-1">
              <SettingSwitch label="自动添加 Authorization Header" checked={draft.authHeader} onCheckedChange={(authHeader) => setDraft((current) => ({ ...current, authHeader }))} />
              <SettingSwitch label="支持 Developer Role" checked={draft.compat.supportsDeveloperRole} onCheckedChange={(value) => setDraft((current) => ({ ...current, compat: { ...current.compat, supportsDeveloperRole: value } }))} />
              <SettingSwitch label="支持 Reasoning Effort" checked={draft.compat.supportsReasoningEffort} onCheckedChange={(value) => setDraft((current) => ({ ...current, compat: { ...current.compat, supportsReasoningEffort: value } }))} />
              </FieldGroup>
              <SettingsAccordion className="mt-3" value={openCompatibilitySections} onValueChange={setOpenCompatibilitySections}>
                <SettingsAccordionCard
                  value="headers"
                  title="自定义 Headers"
                  action={<Button variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, headers: [...current.headers, { name: "", value: "", preserve: false }] }))}><Plus data-icon="inline-start" />添加</Button>}
                >
                  <FieldGroup className="gap-2">{draft.headers.map((header, index) => <FieldGroup key={index} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] gap-2 px-2">
                    <Field><FieldLabel className="sr-only" htmlFor={`agent-provider-header-${index}-name`}>Header 名称</FieldLabel><Input id={`agent-provider-header-${index}-name`} value={header.name} placeholder="X-Custom-Header" onChange={(event) => setDraft((current) => ({ ...current, headers: current.headers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} /></Field>
                    <Field><FieldLabel className="sr-only" htmlFor={`agent-provider-header-${index}-value`}>{header.name || "Header"} 值</FieldLabel><Input id={`agent-provider-header-${index}-value`} type="password" value={header.value} placeholder={header.preserve ? "保持现有值" : "$ENV_OR_VALUE"} onChange={(event) => setDraft((current) => ({ ...current, headers: current.headers.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} /></Field>
                    <Button variant="ghost" size="icon" aria-label={`移除 ${header.name || "Header"}`} onClick={() => setDraft((current) => ({ ...current, headers: current.headers.filter((_, itemIndex) => itemIndex !== index) }))}><Trash data-icon="inline-start" /></Button>
                  </FieldGroup>)}</FieldGroup>
                </SettingsAccordionCard>
              </SettingsAccordion>
            </SettingsAccordionCard>
          </SettingsAccordion>
        </div>
      </ScrollArea>
      <DialogFooter>
        {existing ? <Button variant="destructive" disabled={saving} onClick={() => setConfirmDelete(true)}><Trash data-icon="inline-start" />删除配置</Button> : null}
        <Button variant="outline" className="ml-auto" onClick={() => onOpenChange(false)}>取消</Button>
        <Button disabled={saving || !draft.id.trim()} onClick={() => void save()}>{saving ? <Spinner data-icon="inline-start" /> : null}保存</Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>
    <EditorConfirmDialog
      open={confirmDelete}
      title="删除 Provider 配置？"
      description={<>只删除 {draft.name || draft.id || "当前 Provider"} 的 models.json 配置；安全存储的凭据需通过“退出”单独删除。</>}
      actions={[
        { id: "delete", label: "删除配置", tone: "danger", disabled: saving },
        { id: "cancel", label: "取消" }
      ]}
      primaryActionId="delete"
      cancelActionId="cancel"
      onAction={(action) => {
        setConfirmDelete(false);
        if (action === "delete") void remove();
      }}
    />
  </>;
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

function providerDisplayName(providers: any[], providerId: unknown) {
  return String(providers.find((provider) => provider.id === providerId)?.name || "服务商");
}

function blankProviderModel(): ProviderModelDraft {
  return { id: "", name: "", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 32000, api: "", baseUrl: "" };
}

function ToolsPage({ controller, overview }: ControlProps) {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const all = overview.tools?.all || [];
  const active = new Set<string>(overview.tools?.active || []);
  const core = all.filter((tool: any) => toolName(tool).startsWith("mmm_"));
  const project = all.filter((tool: any) => !toolName(tool).startsWith("mmm_"));
  return <SettingsAccordion value={openSections} onValueChange={setOpenSections}>
    <SettingsAccordionCard value="context" title="编辑器上下文" action={<Badge>{core.length}</Badge>}>
      {core.length ? <div className="grid gap-0.5">{core.map((tool: any) => <ToolItem key={toolName(tool)} tool={tool} checked locked controller={controller} active={active} scratch={false} />)}</div> : <InlineEmpty text="没有编辑器上下文工具" />}
    </SettingsAccordionCard>
    <SettingsAccordionCard value="project" title="项目工具" action={<Badge>{project.length}</Badge>}>
      {project.length ? <div className="grid gap-0.5">{project.map((tool: any) => <ToolItem key={toolName(tool)} tool={tool} checked={active.has(toolName(tool))} controller={controller} active={active} scratch={Boolean(overview.scratch)} />)}</div> : <InlineEmpty text="没有项目工具" />}
    </SettingsAccordionCard>
    <SettingsAccordionCard value="commands" title="命令" action={<Badge>{(overview.commands || []).length}</Badge>}>
      {(overview.commands || []).length ? <div className="grid gap-0.5">{(overview.commands || []).map((command: any) => <Item key={`${command.source}:${command.name}`}><ItemContent><ItemTitle className="font-mono">/{command.name}</ItemTitle>{command.description ? <ItemDescription>{command.description}</ItemDescription> : null}</ItemContent></Item>)}</div> : <InlineEmpty text="没有可用命令" />}
    </SettingsAccordionCard>
  </SettingsAccordion>;
}

function ToolItem({ tool, checked, locked = false, controller, active, scratch }: { tool: any; checked: boolean; locked?: boolean; controller: AgentController; active: Set<string>; scratch: boolean }) {
  const id = useId();
  const name = toolName(tool);
  const disabled = locked || scratch;
  return <Field orientation="horizontal" data-disabled={disabled}>
    <FieldLabel htmlFor={id}><Item><ItemMedia><Tools /></ItemMedia><ItemContent><ItemTitle>{humanToolLabel(name, tool)}</ItemTitle>{locked || scratch ? <ItemDescription>{locked ? "始终启用" : "打开项目后可用"}</ItemDescription> : null}</ItemContent></Item></FieldLabel>
    <Switch id={id} aria-label={`切换 ${name}`} checked={checked} disabled={disabled} onCheckedChange={(nextChecked) => {
      const next = new Set(active);
      if (nextChecked) next.add(name); else next.delete(name);
      void controller.runControl({ type: "set_active_tools", toolNames: Array.from(next) }).catch((error) => controller.setError(readableError(error)));
    }} />
  </Field>;
}

function ResourcesPage({ controller, overview }: ControlProps) {
  const resources = overview.resources || {};
  const [source, setSource] = useState("");
  const [openSections, setOpenSections] = useState<string[]>([]);
  const packages = overview.packages || [];
  return <div className="grid gap-4">
    <div className="flex justify-end"><Button variant="ghost" size="icon" aria-label="重新载入资源" onClick={() => void controller.runControl({ type: "reload" })}><Refresh data-icon="inline-start" /></Button></div>
    <SettingsAccordion value={openSections} onValueChange={setOpenSections}>
      <ResourceGroup value="skills" title="Skills" items={(resources.skills?.skills || []).map((item: any) => item.name || item.path)} />
      <ResourceGroup value="extensions" title="Extensions" items={(resources.extensions || []).filter((item: any) => !item.hidden).map((item: any) => item.path)} />
      <ResourceGroup value="prompts" title="Prompts" items={(resources.prompts?.prompts || []).map((item: any) => item.name || item.path)} />
      <SettingsAccordionCard value="packages" title="Packages" action={<Badge>{packages.length}</Badge>}>
        {packages.length ? <div className="grid gap-0.5">{packages.map((item: any, index: number) => {
          const packageSource = typeof item === "string" ? item : item.source || item.path || `package-${index}`;
          return <Item key={`${packageSource}-${index}`}><ItemMedia><Package /></ItemMedia><ItemContent><ItemTitle>{packageSource}</ItemTitle></ItemContent><ItemActions><Button variant="ghost" size="icon" aria-label={`更新 ${packageSource}`} onClick={() => void controller.runControl({ type: "package_update", source: packageSource })}><Refresh data-icon="inline-start" /></Button><Button variant="ghost" size="icon" aria-label={`移除 ${packageSource}`} onClick={() => void controller.runControl({ type: "package_remove", source: packageSource })}><Trash data-icon="inline-start" /></Button></ItemActions></Item>;
        })}</div> : <InlineEmpty text="没有安装包" />}
        <Field className="mt-4">
          <FieldLabel className="sr-only" htmlFor="agent-package-source">安装包来源</FieldLabel>
          <InputGroup>
            <InputGroupInput id="agent-package-source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="npm 包、Git URL 或本地路径" />
            <InputGroupAddon align="inline-end"><InputGroupButton disabled={!source.trim()} onClick={() => void controller.runControl({ type: "package_install", source }).then(() => setSource("")).catch((error) => controller.setError(readableError(error)))}><Download data-icon="inline-start" />安装</InputGroupButton></InputGroupAddon>
          </InputGroup>
        </Field>
      </SettingsAccordionCard>
    </SettingsAccordion>
  </div>;
}

function ResourceGroup({ value, title, items }: { value: string; title: string; items: string[] }) {
  return <SettingsAccordionCard value={value} title={title} action={<Badge>{items.length}</Badge>}>{items.length ? <div className="grid gap-0.5">{items.map((item, index) => <Item key={`${item}-${index}`} className="py-1.5"><ItemContent><ItemTitle>{item}</ItemTitle></ItemContent></Item>)}</div> : <InlineEmpty text="无" />}</SettingsAccordionCard>;
}

function PiSettingsPage({ controller, overview }: ControlProps) {
  const [scope, setScope] = useState<"global" | "project">("global");
  const [openSections, setOpenSections] = useState<string[]>([]);
  const sourceSettings = overview.settings?.[scope] || {};
  const [text, setText] = useState(() => JSON.stringify(sourceSettings, null, 2));
  const parsed = useMemo(() => safeParseObject(text), [text]);

  useEffect(() => setText(JSON.stringify(overview.settings?.[scope] || {}, null, 2)), [overview.settings, scope]);

  function updateSetting(key: string, value: unknown) {
    const next = { ...(parsed.value || sourceSettings), [key]: value };
    setText(JSON.stringify(next, null, 2));
  }

  return <div className="grid gap-4">
    <ToggleGroup type="single" value={scope} variant="outline" size="sm" className="mb-4 w-fit" onValueChange={(value) => { if (value === "global" || value === "project") setScope(value); }} aria-label="设置范围">
      <ToggleGroupItem value="global">全局</ToggleGroupItem>
      <ToggleGroupItem value="project">项目</ToggleGroupItem>
    </ToggleGroup>
    <SettingsAccordion value={openSections} onValueChange={setOpenSections}>
      <SettingsAccordionCard value="common" title="常用设置">
        <FieldGroup className="gap-1">
          <SettingSwitch label="隐藏思考过程" checked={Boolean(parsed.value?.hideThinkingBlock)} onCheckedChange={(value) => updateSetting("hideThinkingBlock", value)} />
          <SettingSwitch label="启用 Skill 命令" checked={parsed.value?.enableSkillCommands !== false} onCheckedChange={(value) => updateSetting("enableSkillCommands", value)} />
          <SettingToggle label="运行中消息" value={String(parsed.value?.steeringMode || "one-at-a-time")} values={["one-at-a-time", "all"]} onValueChange={(value) => updateSetting("steeringMode", value)} />
          <SettingToggle label="后续消息" value={String(parsed.value?.followUpMode || "one-at-a-time")} values={["one-at-a-time", "all"]} onValueChange={(value) => updateSetting("followUpMode", value)} />
          {scope === "global" ? <SettingToggle label="默认项目信任" value={String(parsed.value?.defaultProjectTrust || "ask")} values={["ask", "always", "never"]} onValueChange={(value) => updateSetting("defaultProjectTrust", value)} /> : null}
        </FieldGroup>
      </SettingsAccordionCard>
      <SettingsAccordionCard value="advanced" title="高级 JSON" action={parsed.error ? <Badge tone="danger">格式错误</Badge> : null}>
        <Field data-invalid={Boolean(parsed.error)}><FieldLabel className="sr-only" htmlFor="agent-settings-json">高级 JSON</FieldLabel><Textarea id="agent-settings-json" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} className="min-h-72 font-mono text-xs" aria-invalid={Boolean(parsed.error)} />{parsed.error ? <FieldError>{parsed.error}</FieldError> : null}</Field>
      </SettingsAccordionCard>
    </SettingsAccordion>
    <div className="mt-4 flex justify-end"><Button disabled={!parsed.value} onClick={() => void controller.runControl({ type: "replace_settings", scope, value: parsed.value, expectedRevision: overview.settings?.revisions?.[scope] }).catch((error) => controller.setError(readableError(error)))}>保存</Button></div>
  </div>;
}

function SettingSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  const id = useId();
  return <Field orientation="horizontal"><FieldLabel htmlFor={id}>{label}</FieldLabel><Switch id={id} checked={checked} onCheckedChange={onCheckedChange} /></Field>;
}

function SettingToggle({ label, value, values, onValueChange }: { label: string; value: string; values: string[]; onValueChange: (value: string) => void }) {
  const id = useId();
  return <Field orientation="horizontal"><FieldLabel id={id}>{label}</FieldLabel><ToggleGroup type="single" value={value} variant="outline" size="sm" aria-labelledby={id} onValueChange={(nextValue) => { if (nextValue) onValueChange(nextValue); }}>{values.map((item) => <ToggleGroupItem key={item} value={item}>{settingValueLabel(item)}</ToggleGroupItem>)}</ToggleGroup></Field>;
}

function TrustPage({ controller, overview }: ControlProps) {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const trustId = useId();
  const trust = overview.trust || {};
  return <SettingsAccordion value={openSections} onValueChange={setOpenSections}>
    <SettingsAccordionCard value="trust" title="项目资源">
      <Field orientation="horizontal" data-disabled={Boolean(overview.scratch)}><FieldLabel htmlFor={trustId}><Item><ItemMedia><Key /></ItemMedia><ItemContent><ItemTitle>项目资源</ItemTitle><ItemDescription>{overview.scratch ? "临时画布不加载项目资源" : trust.trusted ? "已信任 .pi 资源" : "未信任项目资源"}</ItemDescription></ItemContent></Item></FieldLabel><Switch id={trustId} aria-label="信任项目资源" disabled={Boolean(overview.scratch)} checked={Boolean(trust.trusted)} onCheckedChange={(trusted) => void controller.runControl({ type: "trust_set", trusted }).catch((error) => controller.setError(readableError(error)))} /></Field>
    </SettingsAccordionCard>
    <SettingsAccordionCard value="diagnostics" title="诊断" action={<Badge>{(overview.diagnostics || []).length}</Badge>}>
      {(overview.diagnostics || []).length ? <div className="grid gap-2">{overview.diagnostics.map((item: any, index: number) => <Notice key={index} tone={item.type === "error" ? "danger" : "neutral"} icon={item.type === "error" ? <WarningTriangle /> : <CheckCircle />} text={item.message || String(item)} />)}</div> : <Notice tone="neutral" icon={<CheckCircle />} text="没有运行时诊断" />}
    </SettingsAccordionCard>
  </SettingsAccordion>;
}

function InlineEmpty({ text }: { text: string }) {
  return <Empty className="min-h-0 flex-none px-3 py-4"><EmptyHeader><EmptyTitle>{text}</EmptyTitle></EmptyHeader></Empty>;
}

function Notice({ tone, icon, text }: { tone: "neutral" | "danger"; icon: ReactNode; text: string }) {
  return <Alert variant={tone === "danger" ? "destructive" : "default"} className={cn("rounded-[var(--agent-message-notice-radius)] border-[length:var(--agent-message-notice-border-width)] border-[hsl(var(--agent-message-notice-border-color))] [border-style:var(--agent-message-notice-border-style)] bg-[hsl(var(--agent-message-notice-background))] px-[var(--agent-message-notice-padding-x)] py-[var(--agent-message-notice-padding-y)]", tone === "danger" ? "text-destructive" : "text-[hsl(var(--agent-message-notice-foreground))]")}>{icon}<AlertDescription>{text}</AlertDescription></Alert>;
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
