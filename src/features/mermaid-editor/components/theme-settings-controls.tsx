import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavArrowDown } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { isHexColor, MERMAID_FONT_FAMILY, MONO_FONT_FAMILY } from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";

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
      onOpenChange={setOpen}
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
          <Collapsible open={normalizedQuery ? true : advancedOpen} onOpenChange={setAdvancedOpen} className="border-t pt-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground" aria-label={`${advancedOpen ? "收起" : "展开"}${definition.title}高级选项`}>
                <span>高级</span>
                <NavArrowDown className={cn("transition-transform", advancedOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-3 pt-2">
                {advancedEntries.map(({ path, value: fieldValue }) => (
                  <ThemeSettingsField key={path.join(".")} path={[...definition.path, ...path]} value={fieldValue} onChange={(nextValue) => onChange(path, nextValue)} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </ThemeSettingsCollapsible>
  );
}

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
          <SelectItem value="normal">常规</SelectItem>
          <SelectItem value="italic">斜体</SelectItem>
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}

function FieldFrame({ label, path, children }: { label: string; path: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 text-sm" data-theme-token-path={path}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function BooleanField({ label, path, value, onChange }: { label: string; path: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm" data-theme-token-path={path}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} aria-label={label} />
    </div>
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
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} style={{ fontFamily: option.value }}>
                {option.label}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={CUSTOM_FONT_OPTION_VALUE}>
              {knownOption ? "自定义字体…" : `自定义 · ${primaryFontName(value)}`}
            </SelectItem>
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
      <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
        <input
          type="color"
          value={value}
          className="h-8 w-8 cursor-pointer rounded-[var(--theme-radius-control-sm)] border bg-background p-1"
          onChange={(event) => commit(event.target.value)}
          aria-label={`${label}色板`}
        />
        <Input
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
      </div>
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
        <SelectContent>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent>
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
        <input
          type="range"
          value={value}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          className="h-8 min-w-0 accent-primary"
          onChange={(event) => update(Number(event.target.value))}
          aria-label={`${label}滑杆`}
        />
        <label className="relative">
          <Input
            type="number"
            value={displayValue}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            className={cn("type-interface-technical w-full", spec.unit && "pr-7")}
            onChange={(event) => update(Number(event.target.value))}
            aria-label={label}
          />
          {spec.unit ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{spec.unit}</span> : null}
        </label>
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
