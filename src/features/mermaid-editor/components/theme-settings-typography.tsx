import { useMemo, useState } from "react";
import { Check, NavArrowDown, Refresh } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditorIconButton, EditorSearchField } from "@/features/mermaid-editor/components/editor-ui";
import type { RuntimeSystemFont } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  type EditorTypographyTokens,
  type TypographyRoleTokens
} from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";
import { ThemeSettingsCollapsible } from "./theme-settings-collapsible";

type TypographyGroupKey = keyof EditorTypographyTokens;

const TYPOGRAPHY_GROUPS: readonly { key: TypographyGroupKey; title: string; description: string }[] = [
  { key: "interface", title: "界面基础", description: "应用正文、控件、导航、菜单和技术信息。" },
  { key: "canvas", title: "Mermaid 编辑画布", description: "节点、连线标签、组标题、操作徽标和编辑态。" },
  { key: "linkCard", title: "链接预览卡片", description: "品牌占位、平台名称、帖子标题和编辑态。" },
  { key: "markdownCard", title: "Markdown 文档卡片", description: "徽标、标题、路径、摘要和编辑态。" },
  { key: "tableNode", title: "表格节点", description: "表格单元格及其编辑态。" },
  { key: "mermaid", title: "Mermaid SVG 渲染", description: "图表标题、节点、关系、分组和注释。" },
  { key: "canvasDocument", title: "独立画布文档", description: "形状、卡片、自由文本、连接线及其编辑态。" },
  { key: "source", title: "源码与诊断", description: "源码编辑器和两级诊断信息。" },
  { key: "terminal", title: "终端", description: "终端内容、标题和工作目录。" }
];

const ROLE_LABELS: Record<string, string> = {
  body: "正文", heading: "标题", control: "按钮与表单", navigation: "导航", menu: "菜单", tooltip: "提示浮层",
  metadata: "辅助说明", status: "状态信息", technical: "技术数据与路径", node: "普通节点", nodeEditor: "节点编辑态",
  edgeLabel: "连线标签", edgeEditor: "连线标签编辑态", subgraphTitle: "组标题", actionBadge: "节点操作徽标",
  brand: "品牌占位文字", provider: "平台名称", title: "标题", titleEditor: "标题编辑态", badge: "类型徽标", path: "文件路径",
  excerpt: "内容摘要", general: "通用文字", diagramTitle: "图表标题", primaryLabel: "节点与参与者", relationLabel: "关系与消息标签",
  groupTitle: "组与分区标题", note: "注释文字", shape: "形状文字", shapeEditor: "形状编辑态", card: "卡片正文",
  cardEditor: "卡片编辑态", freeText: "自由文本", freeTextEditor: "自由文本编辑态", connector: "连接线标签",
  connectorEditor: "连接线编辑态", editor: "源码编辑器", diagnosticSummary: "诊断摘要", diagnosticRaw: "诊断原始信息",
  content: "终端内容", h1: "一级标题", h2: "二级标题", h3: "三级标题", h4: "四级标题", h5: "五级标题", h6: "六级标题",
  cell: "单元格", cellEditor: "单元格编辑态",
  link: "链接", emphasis: "强调", strong: "加粗", list: "列表", quote: "引用", inlineCode: "行内代码", codeBlock: "代码块", table: "表格"
};

const BUILTIN_FONTS: RuntimeSystemFont[] = [
  { family: "Noto Sans SC Variable", monospace: false },
  { family: "Maple Mono", monospace: true },
  { family: "上图东观体", monospace: false },
  { family: "方正屏显雅宋简体", monospace: false }
];

export function ThemeSettingsTypography({
  value,
  visibleGroups,
  systemFonts,
  loading,
  error,
  resetDisabled,
  onChangeRole,
  onResetRole,
  onResetGroup
}: {
  value: EditorTypographyTokens;
  visibleGroups?: readonly TypographyGroupKey[];
  systemFonts: RuntimeSystemFont[];
  loading: boolean;
  error: string | null;
  resetDisabled: boolean;
  onChangeRole: (group: TypographyGroupKey, role: string, value: TypographyRoleTokens) => void;
  onResetRole: (group: TypographyGroupKey, role: string) => void;
  onResetGroup: (group: TypographyGroupKey) => void;
}) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<TypographyGroupKey>>(() => new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return (
    <div className="grid gap-4">
      <EditorSearchField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索排版…"
        aria-label="搜索排版角色"
      />
      {TYPOGRAPHY_GROUPS.filter((definition) => !visibleGroups || visibleGroups.includes(definition.key)).map((definition) => {
        const roles = Object.entries(value[definition.key]) as [string, TypographyRoleTokens][];
        const visibleRoles = normalizedQuery ? roles.filter(([key]) => `${ROLE_LABELS[key] || key} ${definition.title}`.toLocaleLowerCase().includes(normalizedQuery)) : roles;
        if (!visibleRoles.length) return null;
        const open = normalizedQuery ? true : openGroups.has(definition.key);
        return (
          <ThemeSettingsCollapsible
            key={definition.key}
            open={open}
            onOpenChange={() => setOpenGroups((current) => toggleSetValue(current, definition.key))}
            title={definition.title}
            description={definition.description}
            resetLabel={`重置${definition.title}`}
            resetDisabled={resetDisabled}
            onReset={() => onResetGroup(definition.key)}
            typographyGroup={definition.key}
          >
              <div className="editor-ui-panel-body grid gap-3">
                {visibleRoles.map(([roleKey, role]) => (
                  <TypographyRoleEditor
                    key={roleKey}
                    roleKey={roleKey}
                    label={ROLE_LABELS[roleKey] || roleKey}
                    value={role}
                    fonts={systemFonts}
                    loading={loading}
                    error={error}
                    monospacePreferred={isMonospaceRole(definition.key, roleKey)}
                    resetDisabled={resetDisabled}
                    onChange={(next) => onChangeRole(definition.key, roleKey, next)}
                    onReset={() => onResetRole(definition.key, roleKey)}
                  />
                ))}
              </div>
          </ThemeSettingsCollapsible>
        );
      })}
    </div>
  );
}

function TypographyRoleEditor({ roleKey, label, value, fonts, loading, error, monospacePreferred, resetDisabled, onChange, onReset }: {
  roleKey: string;
  label: string;
  value: TypographyRoleTokens;
  fonts: RuntimeSystemFont[];
  loading: boolean;
  error: string | null;
  monospacePreferred: boolean;
  resetDisabled: boolean;
  onChange: (value: TypographyRoleTokens) => void;
  onReset: () => void;
}) {
  return (
    <article className="grid gap-2 border-l-2 border-border bg-card/45 p-3" data-typography-role={roleKey}>
      <div className="flex items-center justify-between gap-3">
        <div className="type-interface-heading min-w-0 truncate" style={{ fontFamily: value.family }}>{label}</div>
        <EditorIconButton context="inline" label={`重置${label}`} onClick={onReset} disabled={resetDisabled}>
          <Refresh />
        </EditorIconButton>
      </div>
      <FontFamilyCombobox value={value.family} fonts={fonts} loading={loading} error={error} monospacePreferred={monospacePreferred} onChange={(family) => onChange({ ...value, family })} />
      <div className="grid grid-cols-4 gap-2">
        <TypographyNumber label="字号" value={value.fontSize} min={8} max={96} step={1} onChange={(fontSize) => onChange({ ...value, fontSize })} />
        <TypographyNumber label="字重" value={value.fontWeight} min={100} max={900} step={100} onChange={(fontWeight) => onChange({ ...value, fontWeight })} />
        <TypographyNumber label="行高" value={value.lineHeight} min={8} max={128} step={1} onChange={(lineHeight) => onChange({ ...value, lineHeight })} />
        <TypographyNumber label="字距" value={value.letterSpacing} min={-4} max={12} step={0.1} onChange={(letterSpacing) => onChange({ ...value, letterSpacing })} />
      </div>
    </article>
  );
}

export function FontFamilyCombobox({ value, fonts, loading, error, monospacePreferred, onChange }: {
  value: string;
  fonts: RuntimeSystemFont[];
  loading: boolean;
  error: string | null;
  monospacePreferred: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(value);
  const familyName = primaryFontName(value);
  const catalog = useMemo(() => dedupeFonts([...BUILTIN_FONTS, ...fonts]), [fonts]);

  function selectFont(family: string) {
    onChange(cssFontStack(family, monospacePreferred));
    setCustom(false);
    setOpen(false);
  }

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between text-left" style={{ fontFamily: value }}>
            <span className="truncate">{familyName}</span>
            <NavArrowDown className="size-3.5 shrink-0 text-icon" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-[280px]">
          <Command>
            <CommandInput placeholder="搜索全部系统字体…" />
            <CommandList>
              <CommandEmpty>{loading ? "正在读取系统字体…" : error || "没有匹配的字体"}</CommandEmpty>
              <CommandGroup heading="字体">
                {catalog.map((font) => (
                  <CommandItem key={font.family} value={font.family} onSelect={() => selectFont(font.family)} style={{ fontFamily: quoteCssFamily(font.family) }}>
                    <Check className={cn("mr-2 size-3.5", sameFamily(font.family, familyName) ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{font.family}</span>
                    {font.monospace ? <span className="ml-2 text-[9px] text-muted-foreground">等宽</span> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="自定义 CSS 字体栈" onSelect={() => { setDraft(value); setCustom(true); setOpen(false); }}>自定义 CSS 字体栈…</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {custom ? (
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { const next = draft.trim(); if (next) onChange(next); else setDraft(value); }}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setCustom(false); }}
          className="type-interface-technical"
          aria-label="自定义 CSS 字体栈"
        />
      ) : null}
      {error ? <span className="type-interface-metadata text-muted-foreground">{error}</span> : null}
    </div>
  );
}

function TypographyNumber({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="type-interface-metadata grid gap-1 text-muted-foreground">
      <span>{label}</span>
      <Input type="number" value={value} min={min} max={max} step={step} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next))); }} className="type-interface-technical min-w-0" />
    </label>
  );
}

function dedupeFonts(fonts: RuntimeSystemFont[]) {
  const seen = new Set<string>();
  return fonts.filter((font) => {
    const key = font.family.normalize("NFKC").toLocaleLowerCase();
    if (!font.family.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cssFontStack(family: string, monospace: boolean) {
  const fallback = monospace ? "ui-monospace, monospace" : "system-ui, sans-serif";
  return `${quoteCssFamily(family)}, ${fallback}`;
}

function quoteCssFamily(family: string) {
  return `"${family.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\f]/g, " ")}"`;
}

function primaryFontName(value: string) {
  const match = value.trim().match(/^(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^,]+))/);
  return (match?.[1] || match?.[2] || match?.[3] || value).replace(/\\([\\"])/g, "$1").trim();
}

function sameFamily(left: string, right: string) {
  return left.normalize("NFKC").toLocaleLowerCase() === right.normalize("NFKC").toLocaleLowerCase();
}

function isMonospaceRole(group: TypographyGroupKey, role: string) {
  return group === "source" || group === "terminal" && role !== "heading" || group === "interface" && role === "technical" || group === "markdownCard" && role === "path";
}

function toggleSetValue<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

export { TYPOGRAPHY_GROUPS };
