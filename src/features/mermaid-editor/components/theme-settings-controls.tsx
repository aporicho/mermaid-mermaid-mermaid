import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { isHexColor, MERMAID_FONT_FAMILY, MONO_FONT_FAMILY } from "@/features/mermaid-editor/lib/editor-theme";

import {
  appearanceTokenDefinition,
  themeTokenLabel,
  themeTokenNumberSpec,
  type AppearanceTokenControlKind,
  type ThemeTokenGroupDefinition
} from "./theme-settings-schema";
import { ThemeSettingsCollapsible } from "./theme-settings-collapsible";

type ThemeTokenValue = boolean | string | number | readonly number[];
type ThemeTokenTree = ThemeTokenValue | { readonly [key: string]: ThemeTokenTree };

export function ThemeSettingsGroup({
  definition,
  value,
  onChange,
  onReset,
  query = "",
  resetDisabled = false
}: {
  definition: ThemeTokenGroupDefinition;
  value: Record<string, ThemeTokenTree>;
  onChange: (path: readonly string[], value: ThemeTokenValue) => void;
  onReset: () => void;
  query?: string;
  resetDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const entries = useMemo(() => flattenFields(value).filter(({ path }) => {
    if (definition.includeKeys && !definition.includeKeys.includes(path[0] || "")) return false;
    if (definition.hiddenKeys?.includes(path[0] || "")) return false;
    if (path.at(-1) === "customDash" && customDashStyle(value, path) !== "custom") return false;
    if (!normalizedQuery) return true;
    const fullPath = [...definition.path, ...path];
    const metadata = appearanceTokenDefinition(fullPath);
    return `${metadata?.label ?? themeTokenLabel(path.at(-1) || "")} ${fullPath.join(".")}`.toLocaleLowerCase().includes(normalizedQuery);
  }), [definition.hiddenKeys, definition.includeKeys, definition.path, normalizedQuery, value]);
  const commonEntries = entries.filter(({ path }) => appearanceTokenDefinition([...definition.path, ...path])?.level !== "advanced");
  const advancedEntries = entries.filter(({ path }) => appearanceTokenDefinition([...definition.path, ...path])?.level === "advanced");

  if (!entries.length) return null;

  return (
    <ThemeSettingsCollapsible
      open={normalizedQuery ? true : open}
      onOpenChange={normalizedQuery ? () => {} : setOpen}
      title={definition.title}
      description={definition.description}
      resetLabel={`重置${definition.title}`}
      resetDisabled={resetDisabled}
      onReset={onReset}
      groupId={definition.id}
    >
      <div className="editor-ui-panel-body grid gap-3">
        {commonEntries.map(({ path, value: fieldValue }) => (
          <ThemeSettingsField key={path.join(".")} path={[...definition.path, ...path]} value={fieldValue} onChange={(nextValue) => onChange(path, nextValue)} />
        ))}
        {advancedEntries.length ? (
          <Accordion
            type="multiple"
            value={normalizedQuery || advancedOpen ? [ADVANCED_ITEM_VALUE] : []}
            onValueChange={(items) => {
              if (!normalizedQuery) setAdvancedOpen(items.includes(ADVANCED_ITEM_VALUE));
            }}
            className="border-t pt-2"
            data-theme-settings-accordion
            data-accordion-type="multiple"
          >
            <AccordionItem value={ADVANCED_ITEM_VALUE} className="border-0">
              <AccordionTrigger className="text-muted-foreground" aria-label={`${advancedOpen ? "收起" : "展开"}${definition.title}高级选项`}>
                高级
              </AccordionTrigger>
              <AccordionContent>
              <div className="grid gap-3 pt-2">
                {advancedEntries.map(({ path, value: fieldValue }) => (
                  <ThemeSettingsField key={path.join(".")} path={[...definition.path, ...path]} value={fieldValue} onChange={(nextValue) => onChange(path, nextValue)} />
                ))}
              </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </div>
    </ThemeSettingsCollapsible>
  );
}

const ADVANCED_ITEM_VALUE = "advanced";

function ThemeSettingsField({ path, value, onChange }: { path: readonly string[]; value: ThemeTokenValue; onChange: (value: ThemeTokenValue) => void }) {
  const key = path.at(-1) || "";
  const definition = appearanceTokenDefinition(path);
  const label = definition?.label ?? themeTokenLabel(key);
  const fieldPath = path.join(".");
  const control = definition?.control.kind ?? inferredStringControl(path, value);

  if (typeof value === "boolean") {
    return <BooleanField label={label} path={fieldPath} value={value} onChange={onChange} />;
  }
  if (control === "font-style") {
    return <FontStyleField label={label} path={fieldPath} value={String(value)} onChange={onChange} />;
  }
  if (control === "css-border-style" || control === "canvas-stroke-style" || control === "tree-connector-style") {
    return <BorderStyleField label={label} path={fieldPath} value={String(value)} kind={control} onChange={onChange} />;
  }
  if (typeof value === "string" && (control === "color" || isHexColor(value))) {
    return <ColorField label={label} path={fieldPath} value={value} onChange={onChange} />;
  }
  if (typeof value === "string" && (control === "font" || isFontFamilyKey(key))) {
    return <FontFamilyField label={label} path={fieldPath} fontKey={key} value={value} onChange={onChange} />;
  }
  if (typeof value === "string") {
    return <TextField label={label} path={fieldPath} value={value} onChange={onChange} />;
  }
  if (typeof value === "number") {
    return <NumberField label={label} path={path} value={value} onChange={onChange} />;
  }
  return <DashField label={label} path={fieldPath} value={value} onChange={onChange} />;
}

function inferredStringControl(path: readonly string[], value: ThemeTokenValue): AppearanceTokenControlKind | undefined {
  if (typeof value !== "string") return undefined;
  const key = path.at(-1) || "";
  if (key === "fontStyle") return "font-style";
  if (key === "borderStyle" || key === "style" || key.endsWith("Style")) return path[0] === "interface" ? "css-border-style" : "canvas-stroke-style";
  return undefined;
}

function FontStyleField({ label, path, value, onChange }: { label: string; path: string; value: string; onChange: (value: string) => void }) {
  return (
    <FieldFrame label={label} path={path}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="normal">常规</SelectItem>
            <SelectItem value="italic">斜体</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}

function FieldFrame({ label, path, children }: { label: string; path: string; children: ReactNode }) {
  return (
    <Field className="gap-1.5" data-theme-token-path={path}>
      <FieldLabel className="type-interface-metadata text-muted-foreground">{label}</FieldLabel>
      {children}
    </Field>
  );
}

function BooleanField({ label, path, value, onChange }: { label: string; path: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Field orientation="horizontal" className="justify-between" data-theme-token-path={path}>
      <FieldLabel className="type-interface-metadata text-muted-foreground">{label}</FieldLabel>
      <Switch checked={value} onCheckedChange={onChange} aria-label={label} />
    </Field>
  );
}

function FontFamilyField({
  label,
  path,
  fontKey,
  value,
  onChange
}: {
  label: string;
  path: string;
  fontKey: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = fontOptionsForKey(fontKey);
  const knownOption = options.find((option) => option.value === value);
  const [customOpen, setCustomOpen] = useState(!knownOption);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
    setCustomOpen(!options.some((option) => option.value === value));
  }, [options, value]);

  function commitCustom() {
    const normalized = draft.trim();
    if (!normalized) {
      setDraft(value);
      return;
    }
    onChange(normalized);
  }

  return (
    <FieldFrame label={label} path={path}>
      <div className="grid gap-2">
        <Select
          value={customOpen ? CUSTOM_FONT_OPTION_VALUE : knownOption?.value ?? CUSTOM_FONT_OPTION_VALUE}
          onValueChange={(nextValue) => {
            if (nextValue === CUSTOM_FONT_OPTION_VALUE) {
              setCustomOpen(true);
              return;
            }
            setCustomOpen(false);
            onChange(nextValue);
          }}
        >
          <SelectTrigger className="h-8 px-2 text-xs" style={{ fontFamily: value }} aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} style={{ fontFamily: option.value }}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectItem value={CUSTOM_FONT_OPTION_VALUE}>
                {knownOption ? "自定义字体…" : `自定义 · ${primaryFontName(value)}`}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {customOpen ? (
          <Input
            type="text"
            value={draft}
            spellCheck={false}
            className="type-interface-technical min-w-0"
            style={{ fontFamily: value }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitCustom}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label={`自定义${label}`}
            placeholder="输入 CSS 字体栈"
          />
        ) : null}
      </div>
    </FieldFrame>
  );
}

function ColorField({ label, path, value, onChange }: { label: string; path: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit(nextValue: string) {
    const normalized = nextValue.trim().toLowerCase();
    if (!isHexColor(normalized)) {
      setDraft(value);
      return;
    }
    setDraft(normalized);
    onChange(normalized);
  }

  return (
    <FieldFrame label={label} path={path}>
      <InputGroup>
        <InputGroupAddon className="p-1" aria-label={`${label}颜色选择器`}>
          <input
            type="color"
            value={value}
            className="size-6 cursor-pointer border-0 bg-transparent p-0"
            onChange={(event) => commit(event.target.value)}
            aria-label={`${label}色板`}
          />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          value={draft}
          spellCheck={false}
          className="type-interface-technical min-w-0"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-label={label}
        />
      </InputGroup>
    </FieldFrame>
  );
}

function TextField({ label, path, value, onChange }: { label: string; path: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    const normalized = draft.trim();
    if (!normalized) {
      setDraft(value);
      return;
    }
    onChange(normalized);
  }

  return (
    <FieldFrame label={label} path={path}>
      <Input
        type="text"
        value={draft}
        spellCheck={false}
        className="type-interface-technical min-w-0"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        aria-label={label}
      />
    </FieldFrame>
  );
}

function BorderStyleField({
  label,
  path,
  value,
  kind,
  onChange
}: {
  label: string;
  path: string;
  value: string;
  kind: Extract<AppearanceTokenControlKind, "css-border-style" | "canvas-stroke-style" | "tree-connector-style">;
  onChange: (value: string) => void;
}) {
  const options = kind === "css-border-style"
    ? [["none", "无"], ["solid", "实线"], ["dashed", "虚线"], ["dotted", "点线"], ["double", "双线"]]
    : kind === "tree-connector-style"
      ? [["none", "隐藏"], ["solid", "实线"], ["dashed", "虚线"], ["dotted", "点线"]]
      : [["none", "无"], ["solid", "实线"], ["dashed", "虚线"], ["dotted", "点线"], ["dash-dot", "点划线"], ["custom", "自定义"]];
  return (
    <FieldFrame label={label} path={path}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}

function NumberField({ label, path, value, onChange }: { label: string; path: readonly string[]; value: number; onChange: (value: number) => void }) {
  const spec = themeTokenNumberSpec(path, value);
  const displayValue = Number.isInteger(value) ? value : Number(value.toFixed(3));

  function update(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onChange(Math.min(spec.max, Math.max(spec.min, nextValue)));
  }

  return (
    <FieldFrame label={label} path={path.join(".")}>
      <div className="grid grid-cols-[minmax(72px,1fr)_82px] items-center gap-2">
        <Slider
          value={[value]}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          className="h-8 min-w-0"
          onValueChange={([nextValue]) => update(nextValue)}
          aria-label={`${label}滑杆`}
        />
        <InputGroup>
          <InputGroupInput
            type="number"
            value={displayValue}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            className="type-interface-technical w-full"
            onChange={(event) => update(Number(event.target.value))}
            aria-label={label}
          />
          {spec.unit ? (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{spec.unit}</InputGroupText>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>
    </FieldFrame>
  );
}

function DashField({ label, path, value, onChange }: { label: string; path: string; value: readonly number[]; onChange: (value: readonly number[]) => void }) {
  const serialized = value.join(", ");
  const [draft, setDraft] = useState(serialized);
  useEffect(() => setDraft(serialized), [serialized]);

  function commit() {
    if (!draft.trim()) {
      onChange([]);
      return;
    }
    const values = draft.split(",").map((part) => Number(part.trim()));
    if (values.length > 6 || values.length < 2 || values.some((item) => !Number.isFinite(item) || item < 0 || item > 48)) {
      setDraft(serialized);
      return;
    }
    onChange(values);
  }

  return (
    <FieldFrame label={label} path={path}>
      <Input
        type="text"
        value={draft}
        placeholder="留空为实线；例如 4, 3"
        spellCheck={false}
        className="type-interface-technical min-w-0"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        aria-label={label}
      />
    </FieldFrame>
  );
}

function isThemeTokenValue(value: unknown): value is ThemeTokenValue {
  return typeof value === "boolean" || typeof value === "string" || typeof value === "number" || (Array.isArray(value) && value.every((item) => typeof item === "number"));
}

function flattenFields(value: Record<string, ThemeTokenTree>, prefix: readonly string[] = []): { path: readonly string[]; value: ThemeTokenValue }[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = [...prefix, key];
    return isThemeTokenValue(child) ? [{ path, value: child }] : flattenFields(child, path);
  });
}

function customDashStyle(value: Record<string, ThemeTokenTree>, path: readonly string[]) {
  const parent = path.slice(0, -1).reduce<ThemeTokenTree>((current, key) => {
    return isThemeTokenObject(current) ? current[key] : {};
  }, value);
  if (!isThemeTokenObject(parent)) return undefined;
  for (const key of ["borderStyle", "style", "strokeStyle", "centerStyle"]) {
    if (typeof parent[key] === "string") return parent[key];
  }
  return undefined;
}

function isThemeTokenObject(value: ThemeTokenTree): value is { readonly [key: string]: ThemeTokenTree } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type FontOption = { label: string; value: string };

const CUSTOM_FONT_OPTION_VALUE = "__custom_font_family__";
const SYSTEM_SANS_FONT = "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
const CJK_SANS_FONT = "PingFang SC, Microsoft YaHei UI, Microsoft YaHei, Noto Sans CJK SC, sans-serif";
const SOURCE_HAN_SANS_FONT = "Source Han Sans SC, Noto Sans CJK SC, Noto Sans SC, sans-serif";
const CJK_SERIF_FONT = "Noto Serif SC, Source Han Serif SC, Songti SC, STSong, SimSun, serif";
const SYSTEM_SERIF_FONT = "Iowan Old Style, Palatino Linotype, Georgia, Noto Serif SC, serif";
const SYSTEM_MONO_FONT = "ui-monospace, SFMono-Regular, Cascadia Code, Roboto Mono, Consolas, monospace";
const JETBRAINS_MONO_FONT = "JetBrains Mono, Maple Mono, Noto Sans SC Variable, ui-monospace, monospace";
const CASCADIA_MONO_FONT = "Cascadia Code, Maple Mono, Noto Sans SC Variable, ui-monospace, monospace";
const FIRA_MONO_FONT = "Fira Code, Maple Mono, Noto Sans SC Variable, ui-monospace, monospace";
const SOURCE_CODE_MONO_FONT = "Source Code Pro, Maple Mono, Noto Sans SC Variable, ui-monospace, monospace";

const SANS_FONT_OPTIONS: readonly FontOption[] = [
  { label: "Noto Sans SC · 内置", value: MERMAID_FONT_FAMILY },
  { label: "系统无衬线", value: SYSTEM_SANS_FONT },
  { label: "中文无衬线", value: CJK_SANS_FONT },
  { label: "思源黑体", value: SOURCE_HAN_SANS_FONT }
];

const SERIF_FONT_OPTIONS: readonly FontOption[] = [
  { label: "中文宋体", value: CJK_SERIF_FONT },
  { label: "系统衬线", value: SYSTEM_SERIF_FONT }
];

const MONO_FONT_OPTIONS: readonly FontOption[] = [
  { label: "Maple Mono · 内置", value: MONO_FONT_FAMILY },
  { label: "系统等宽", value: SYSTEM_MONO_FONT },
  { label: "JetBrains Mono", value: JETBRAINS_MONO_FONT },
  { label: "Cascadia Code", value: CASCADIA_MONO_FONT },
  { label: "Fira Code", value: FIRA_MONO_FONT },
  { label: "Source Code Pro", value: SOURCE_CODE_MONO_FONT }
];

const MARKDOWN_TEXT_FONT_OPTIONS: readonly FontOption[] = [...SANS_FONT_OPTIONS, ...SERIF_FONT_OPTIONS];

function isFontFamilyKey(key: string) {
  return key === "fontFamily" || key === "familySans" || key === "familyMono" || key === "familyBody" || key === "familyHeading" || key === "familyCode";
}

function fontOptionsForKey(key: string) {
  if (key === "familyMono" || key === "familyCode") return MONO_FONT_OPTIONS;
  if (key === "familyBody" || key === "familyHeading") return MARKDOWN_TEXT_FONT_OPTIONS;
  return SANS_FONT_OPTIONS;
}

function primaryFontName(value: string) {
  return value.split(",", 1)[0]?.trim().replace(/^['"]|['"]$/g, "") || "未命名字体";
}
