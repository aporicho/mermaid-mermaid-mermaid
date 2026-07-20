import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavArrowDown, Refresh } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { isHexColor } from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";

import { themeTokenLabel, themeTokenNumberSpec, type ThemeTokenGroupDefinition } from "./theme-settings-schema";

type ThemeTokenValue = string | number | readonly number[];

export function ThemeSettingsGroup({
  definition,
  value,
  onChange,
  onReset,
  resetDisabled = false
}: {
  definition: ThemeTokenGroupDefinition;
  value: Record<string, ThemeTokenValue>;
  onChange: (key: string, value: ThemeTokenValue) => void;
  onReset: () => void;
  resetDisabled?: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const entries = useMemo(
    () => Object.entries(value).filter(([key, fieldValue]) => !definition.hiddenKeys?.includes(key) && isThemeTokenValue(fieldValue)),
    [definition.hiddenKeys, value]
  );
  const commonEntries = definition.commonKeys ? entries.filter(([key]) => definition.commonKeys?.includes(key)) : entries;
  const advancedEntries = definition.commonKeys ? entries.filter(([key]) => !definition.commonKeys?.includes(key)) : [];

  return (
    <section className="overflow-hidden rounded-md border bg-background/45" data-theme-settings-group={definition.id}>
      <header className="flex items-start justify-between gap-3 border-b px-3 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{definition.title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{definition.description}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0 text-icon hover:text-icon"
          onClick={onReset}
          disabled={resetDisabled}
          aria-label={`重置${definition.title}`}
          title={`重置${definition.title}`}
        >
          <Refresh className="size-3.5" />
        </Button>
      </header>
      <div className="grid gap-3 p-3">
        {commonEntries.map(([key, fieldValue]) => (
          <ThemeSettingsField key={key} path={[...definition.path, key]} value={fieldValue} onChange={(nextValue) => onChange(key, nextValue)} />
        ))}
        {advancedEntries.length ? (
          <div className="border-t pt-2">
            <button
              type="button"
              className="flex h-8 w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
            >
              <span>高级选项 · {advancedEntries.length}</span>
              <NavArrowDown className={cn("size-3.5 transition-transform", advancedOpen && "rotate-180")} />
            </button>
            {advancedOpen ? (
              <div className="grid gap-3 pt-2">
                {advancedEntries.map(([key, fieldValue]) => (
                  <ThemeSettingsField key={key} path={[...definition.path, key]} value={fieldValue} onChange={(nextValue) => onChange(key, nextValue)} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ThemeSettingsField({ path, value, onChange }: { path: readonly string[]; value: ThemeTokenValue; onChange: (value: ThemeTokenValue) => void }) {
  const key = path.at(-1) || "";
  const label = themeTokenLabel(key);
  const fieldPath = path.join(".");

  if (typeof value === "string" && isHexColor(value)) {
    return <ColorField label={label} path={fieldPath} value={value} onChange={onChange} />;
  }
  if (typeof value === "string") {
    return <TextField label={label} path={fieldPath} value={value} onChange={onChange} />;
  }
  if (typeof value === "number") {
    return <NumberField label={label} path={path} value={value} onChange={onChange} />;
  }
  return <DashField label={label} path={fieldPath} value={value} onChange={onChange} />;
}

function FieldFrame({ label, path, children }: { label: string; path: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 text-sm" data-theme-token-path={path}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
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
          className="h-8 w-8 cursor-pointer rounded-sm border bg-background p-1"
          onChange={(event) => commit(event.target.value)}
          aria-label={`${label}色板`}
        />
        <input
          type="text"
          value={draft}
          spellCheck={false}
          className="h-8 min-w-0 rounded-md border bg-background px-2 font-mono text-xs text-foreground"
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
      <input
        type="text"
        value={draft}
        spellCheck={false}
        className="h-8 min-w-0 rounded-md border bg-background px-2 font-mono text-xs text-foreground"
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
          <input
            type="number"
            value={displayValue}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            className={cn("h-8 w-full rounded-md border bg-background px-2 font-mono text-xs text-foreground", spec.unit && "pr-7")}
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
      <input
        type="text"
        value={draft}
        placeholder="留空为实线；例如 4, 3"
        spellCheck={false}
        className="h-8 min-w-0 rounded-md border bg-background px-2 font-mono text-xs text-foreground"
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
  return typeof value === "string" || typeof value === "number" || (Array.isArray(value) && value.every((item) => typeof item === "number"));
}
