import { useEffect, useState } from "react";
import { Refresh } from "iconoir-react/regular";

import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { EditorIconButton, EditorSearchField } from "@/features/mermaid-editor/components/editor-ui";
import { FontFamilyCombobox } from "@/features/mermaid-editor/components/theme-settings-typography";
import type { RuntimeSystemFont } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  MARKDOWN_ELEMENT_CATEGORIES,
  MARKDOWN_ELEMENT_DEFINITIONS,
  MARKDOWN_TOKEN_DEFINITIONS,
  type MarkdownElementCategory,
  type MarkdownTokenDefinition,
  type MarkdownThemeTokens
} from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";
import { ThemeSettingsCollapsible } from "./theme-settings-collapsible";

type MarkdownTokenValue = string | number;

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
          <Refresh data-icon />
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
              onOpenChange={() => {
                if (!normalizedQuery) setOpenCategories((current) => toggleSetValue(current, category.id));
              }}
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
                      onOpenChange={() => {
                        if (!normalizedQuery) setOpenElements((current) => toggleSetValue(current, element.id));
                      }}
                      title={element.title}
                      description={element.description}
                      resetLabel={`重置${element.title}`}
                      resetDisabled={resetDisabled}
                      onReset={() => onResetPath(element.path)}
                      markdownElement={element.id}
                    >
                      <div className="editor-ui-panel-body grid gap-3 sm:grid-cols-2">
                        {fields.map((definition) => (
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
    <Field className={cn("content-start gap-1.5", definition.kind === "font" && "sm:col-span-2")} data-theme-token-path={path}>
      <FieldLabel className="type-interface-metadata text-muted-foreground">{definition.label}</FieldLabel>
      {definition.kind === "font" ? (
        <FontFamilyCombobox value={String(value)} fonts={fonts} loading={loading} error={error} monospacePreferred={monospacePreferred} onChange={onChange} />
      ) : definition.kind === "css-border-style" ? (
        definition.path.join(".") === "blockquote.borderStyle"
          ? <BlockquoteBorderStyleField value={String(value)} onChange={onChange} />
          : <CssBorderStyleField label={definition.label} value={String(value)} onChange={onChange} />
      ) : definition.kind === "color" ? (
        <MarkdownColorField label={definition.label} value={String(value)} onChange={onChange} />
      ) : (
        <MarkdownNumberField definition={definition} value={Number(value)} onChange={onChange} />
      )}
    </Field>
  );
}

function BlockquoteBorderStyleField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [lastStyle, setLastStyle] = useState(value === "none" ? "solid" : value);
  const enabled = value !== "none";
  useEffect(() => {
    if (enabled) setLastStyle(value);
  }, [enabled, value]);

  return (
    <div className="grid gap-2">
      <Field orientation="horizontal" className="h-8 justify-between">
        <FieldLabel className="type-interface-metadata text-muted-foreground">显示引用边线</FieldLabel>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onChange(checked ? lastStyle : "none")}
          aria-label="显示引用边线"
        />
      </Field>
      <Select
        value={enabled ? value : lastStyle}
        onValueChange={(next) => {
          setLastStyle(next);
          onChange(next);
        }}
        disabled={!enabled}
      >
        <SelectTrigger size="sm" aria-label="引用边线样式"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="solid">实线</SelectItem>
            <SelectItem value="dashed">虚线</SelectItem>
            <SelectItem value="dotted">点线</SelectItem>
            <SelectItem value="double">双线</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function CssBorderStyleField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="none">无</SelectItem>
          <SelectItem value="solid">实线</SelectItem>
          <SelectItem value="dashed">虚线</SelectItem>
          <SelectItem value="dotted">点线</SelectItem>
          <SelectItem value="double">双线</SelectItem>
        </SelectGroup>
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
    <InputGroup>
      <InputGroupAddon className="p-1" aria-label={`${label}颜色选择器`}>
        <input type="color" value={value} className="size-6 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => commit(event.target.value)} aria-label={`${label}色板`} />
      </InputGroupAddon>
      <InputGroupInput value={draft} spellCheck={false} className="type-interface-technical min-w-0" onChange={(event) => setDraft(event.target.value)} onBlur={(event) => commit(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={label} />
    </InputGroup>
  );
}

function MarkdownNumberField({ definition, value, onChange }: { definition: MarkdownTokenDefinition; value: number; onChange: (value: number) => void }) {
  const min = definition.min ?? 0;
  const max = definition.max ?? Math.max(10, value * 2);
  const step = definition.step ?? 1;
  const update = (next: number) => Number.isFinite(next) && onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="grid grid-cols-[minmax(60px,1fr)_82px] items-center gap-2">
      <Slider value={[value]} min={min} max={max} step={step} className="h-8 min-w-0" onValueChange={([nextValue]) => update(nextValue)} aria-label={`${definition.label}滑杆`} />
      <InputGroup>
        <InputGroupInput type="number" value={Number.isInteger(value) ? value : Number(value.toFixed(3))} min={min} max={max} step={step} className="type-interface-technical w-full" onChange={(event) => update(Number(event.target.value))} aria-label={definition.label} />
        {definition.unit ? (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{definition.unit}</InputGroupText>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  );
}

function fieldsForElement(path: readonly string[], query: string, title: string) {
  const fields = MARKDOWN_TOKEN_DEFINITIONS.filter((definition) => path.every((part, index) => definition.path[index] === part) && definition.path.length === path.length + 1);
  if (!query) return fields;
  return fields.filter((definition) => `${title} ${definition.label} markdown.${definition.path.join(".")} ${definition.defaultSource}`.toLocaleLowerCase().includes(query));
}

function valueAtPath(value: unknown, path: readonly string[]) {
  return path.reduce<unknown>((current, key) => (current as Record<string, unknown>)?.[key], value);
}

function toggleSetValue<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}
