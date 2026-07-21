import { useEffect, useState } from "react";
import { Refresh } from "iconoir-react/regular";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditorIconButton, EditorSearchField } from "@/features/mermaid-editor/components/editor-ui";
import { FontFamilyCombobox } from "@/features/mermaid-editor/components/theme-settings-typography";
import type { RuntimeSystemFont } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  MARKDOWN_ELEMENT_CATEGORIES,
  MARKDOWN_ELEMENT_DEFINITIONS,
  MARKDOWN_TOKEN_DEFINITIONS,
  type MarkdownElementCategory,
  type MarkdownTokenDefinition,
  type MarkdownTokenFieldSection,
  type MarkdownThemeTokens
} from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";
import { ThemeSettingsCollapsible } from "./theme-settings-collapsible";

type MarkdownTokenValue = string | number;

const SECTION_LABELS: Record<MarkdownTokenFieldSection, string> = {
  typography: "排版",
  color: "色彩",
  layout: "布局与间距",
  border: "边框与几何",
  state: "状态"
};

export function ThemeSettingsMarkdown({
  value,
  systemFonts,
  loading,
  error,
  resetDisabled,
  onChange,
  onResetPath,
  onResetCategory,
  onResetAll
}: {
  value: MarkdownThemeTokens;
  systemFonts: RuntimeSystemFont[];
  loading: boolean;
  error: string | null;
  resetDisabled: boolean;
  onChange: (path: readonly string[], value: MarkdownTokenValue) => void;
  onResetPath: (path: readonly string[]) => void;
  onResetCategory: (category: MarkdownElementCategory) => void;
  onResetAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<MarkdownElementCategory>>(() => new Set());
  const [openElements, setOpenElements] = useState<Set<string>>(() => new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return (
    <div className="grid gap-4" data-markdown-theme-settings>
      <div className="flex items-center gap-2">
        <EditorSearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索 Markdown…"
          aria-label="搜索 Markdown 外观 token"
          className="min-w-0 flex-1"
        />
        <EditorIconButton context="inline" label="重置全部 Markdown 外观" disabled={resetDisabled} onClick={onResetAll}>
          <Refresh />
        </EditorIconButton>
      </div>

      {MARKDOWN_ELEMENT_CATEGORIES.map((category) => {
        const elements = MARKDOWN_ELEMENT_DEFINITIONS.filter((element) => element.category === category.id)
          .map((element) => ({ element, fields: fieldsForElement(element.path, normalizedQuery, element.title) }))
          .filter(({ fields }) => fields.length > 0);
        if (!elements.length) return null;
        const categoryOpen = normalizedQuery ? true : openCategories.has(category.id);
        return (
          <div key={category.id} data-markdown-category={category.id} aria-label={`${category.title}：${category.description}`}>
            <ThemeSettingsCollapsible
              open={categoryOpen}
              onOpenChange={() => setOpenCategories((current) => toggleSetValue(current, category.id))}
              title={category.title}
              description={category.description}
              resetLabel={`重置${category.title}`}
              resetDisabled={resetDisabled}
              onReset={() => onResetCategory(category.id)}
            >
              <div className="grid gap-3 p-3 pt-0">
            {elements.map(({ element, fields }) => {
              const open = normalizedQuery ? true : openElements.has(element.id);
              return (
                <ThemeSettingsCollapsible
                  key={element.id}
                  open={open}
                  onOpenChange={() => setOpenElements((current) => toggleSetValue(current, element.id))}
                  title={element.title}
                  description={element.description}
                  resetLabel={`重置${element.title}`}
                  resetDisabled={resetDisabled}
                  onReset={() => onResetPath(element.path)}
                  markdownElement={element.id}
                >
                      <div className="editor-ui-panel-body grid gap-4">
                        {sectionEntries(fields).map(([section, sectionFields]) => (
                          <section key={section} className="grid gap-2">
                            <h4 className="type-interface-metadata text-muted-foreground">{SECTION_LABELS[section]}</h4>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {sectionFields.map((definition) => (
                                <MarkdownTokenField
                                  key={definition.path.join(".")}
                                  definition={definition}
                                  value={valueAtPath(value, definition.path) as MarkdownTokenValue}
                                  fonts={systemFonts}
                                  loading={loading}
                                  error={error}
                                  monospacePreferred={Boolean(element.monospace)}
                                  onChange={(nextValue) => onChange(definition.path, nextValue)}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                </ThemeSettingsCollapsible>
              );
            })}
              </div>
            </ThemeSettingsCollapsible>
          </div>
        );
      })}
    </div>
  );
}

function MarkdownTokenField({ definition, value, fonts, loading, error, monospacePreferred, onChange }: {
  definition: MarkdownTokenDefinition;
  value: MarkdownTokenValue;
  fonts: RuntimeSystemFont[];
  loading: boolean;
  error: string | null;
  monospacePreferred: boolean;
  onChange: (value: MarkdownTokenValue) => void;
}) {
  const path = `markdown.${definition.path.join(".")}`;
  return (
    <div className={cn("grid content-start gap-1.5", definition.kind === "font" && "sm:col-span-2")} data-theme-token-path={path}>
      <span className="type-interface-metadata text-muted-foreground">{definition.label}</span>
      {definition.kind === "font" ? (
        <FontFamilyCombobox value={String(value)} fonts={fonts} loading={loading} error={error} monospacePreferred={monospacePreferred} onChange={onChange} />
      ) : definition.kind === "css-border-style" ? (
        <CssBorderStyleField label={definition.label} value={String(value)} onChange={onChange} />
      ) : definition.kind === "color" ? (
        <MarkdownColorField label={definition.label} value={String(value)} onChange={onChange} />
      ) : (
        <MarkdownNumberField definition={definition} value={Number(value)} onChange={onChange} />
      )}
    </div>
  );
}

function CssBorderStyleField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">无</SelectItem>
        <SelectItem value="solid">实线</SelectItem>
        <SelectItem value="dashed">虚线</SelectItem>
        <SelectItem value="dotted">点线</SelectItem>
        <SelectItem value="double">双线</SelectItem>
      </SelectContent>
    </Select>
  );
}

function MarkdownColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  function commit(next: string) {
    const normalized = next.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return setDraft(value);
    setDraft(normalized);
    onChange(normalized);
  }
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
      <input type="color" value={value} className="h-8 w-8 cursor-pointer rounded-[var(--theme-radius-control-sm)] border bg-background p-1" onChange={(event) => commit(event.target.value)} aria-label={`${label}色板`} />
      <Input value={draft} spellCheck={false} className="type-interface-technical min-w-0" onChange={(event) => setDraft(event.target.value)} onBlur={(event) => commit(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={label} />
    </div>
  );
}

function MarkdownNumberField({ definition, value, onChange }: { definition: MarkdownTokenDefinition; value: number; onChange: (value: number) => void }) {
  const min = definition.min ?? 0;
  const max = definition.max ?? Math.max(10, value * 2);
  const step = definition.step ?? 1;
  const update = (next: number) => Number.isFinite(next) && onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="grid grid-cols-[minmax(60px,1fr)_82px] items-center gap-2">
      <input type="range" value={value} min={min} max={max} step={step} className="h-8 min-w-0 accent-primary" onChange={(event) => update(Number(event.target.value))} aria-label={`${definition.label}滑杆`} />
      <label className="relative">
        <Input type="number" value={Number.isInteger(value) ? value : Number(value.toFixed(3))} min={min} max={max} step={step} className={cn("type-interface-technical w-full", definition.unit && "pr-7")} onChange={(event) => update(Number(event.target.value))} aria-label={definition.label} />
        {definition.unit ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{definition.unit}</span> : null}
      </label>
    </div>
  );
}

function fieldsForElement(path: readonly string[], query: string, title: string) {
  const fields = MARKDOWN_TOKEN_DEFINITIONS.filter((definition) => path.every((part, index) => definition.path[index] === part) && definition.path.length === path.length + 1);
  if (!query) return fields;
  return fields.filter((definition) => `${title} ${definition.label} markdown.${definition.path.join(".")} ${definition.defaultSource}`.toLocaleLowerCase().includes(query));
}

function sectionEntries(fields: readonly MarkdownTokenDefinition[]) {
  return (["typography", "color", "layout", "border", "state"] as const)
    .map((section) => [section, fields.filter((field) => field.section === section)] as const)
    .filter(([, entries]) => entries.length > 0);
}

function valueAtPath(value: unknown, path: readonly string[]) {
  return path.reduce<unknown>((current, key) => (current as Record<string, unknown>)?.[key], value);
}

function toggleSetValue<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}
