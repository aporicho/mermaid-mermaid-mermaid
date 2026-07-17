import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { MarkdownHeadingTokens, MarkdownThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";

const headingLevels = [
  ["h1", "一级标题"],
  ["h2", "二级标题"],
  ["h3", "三级标题"],
  ["h4", "四级标题"],
  ["h5", "五级标题"],
  ["h6", "六级标题"]
] as const satisfies readonly (readonly [keyof MarkdownThemeTokens["heading"], string])[];

export function MarkdownThemeSettings({
  markdown,
  onChange,
  onReset
}: {
  markdown: MarkdownThemeTokens;
  onChange: (markdown: MarkdownThemeTokens) => void;
  onReset: () => void;
}) {
  function set(path: readonly string[], value: string | number) {
    onChange(updateMarkdownPath(markdown, path, value));
  }

  return (
    <div data-markdown-theme-settings className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Markdown 排版</h3>
          <p className="text-xs text-muted-foreground">阅读、编辑和浮动窗口使用同一套样式。</p>
        </div>
        <Button variant="ghost" className="h-8 px-2" onClick={onReset}>
          重置 Markdown
        </Button>
      </div>

      <MarkdownThemePreview markdown={markdown} />

      <MarkdownSettingsGroup title="正文与字体" open>
        <MarkdownTextField label="正文字体" value={markdown.font.familyBody} onChange={(value) => set(["font", "familyBody"], value)} />
        <MarkdownTextField label="标题字体" value={markdown.font.familyHeading} onChange={(value) => set(["font", "familyHeading"], value)} />
        <MarkdownTextField label="代码字体" value={markdown.font.familyCode} onChange={(value) => set(["font", "familyCode"], value)} />
        <MarkdownColorField label="正文颜色" value={markdown.body.color} onChange={(value) => set(["body", "color"], value)} />
        <MarkdownNumberField label="正文字号" value={markdown.body.fontSize} min={10} max={32} step={1} onChange={(value) => set(["body", "fontSize"], value)} />
        <MarkdownNumberField label="正文行高" value={markdown.body.lineHeight} min={12} max={52} step={1} onChange={(value) => set(["body", "lineHeight"], value)} />
        <MarkdownNumberField label="正文字重" value={markdown.body.fontWeight} min={300} max={900} step={50} onChange={(value) => set(["body", "fontWeight"], value)} />
        <MarkdownNumberField label="正文字距" value={markdown.body.letterSpacing} min={-2} max={4} step={0.1} onChange={(value) => set(["body", "letterSpacing"], value)} />
        <MarkdownNumberField label="段落间距" value={markdown.body.paragraphSpacing} min={0} max={48} step={1} onChange={(value) => set(["body", "paragraphSpacing"], value)} />
      </MarkdownSettingsGroup>

      {headingLevels.map(([level, label]) => (
        <HeadingSettings
          key={level}
          label={label}
          heading={markdown.heading[level]}
          onChange={(key, value) => set(["heading", level, key], value)}
        />
      ))}

      <MarkdownSettingsGroup title="链接、强调与列表">
        <MarkdownColorField label="链接颜色" value={markdown.link.color} onChange={(value) => set(["link", "color"], value)} />
        <MarkdownColorField label="悬停颜色" value={markdown.link.hoverColor} onChange={(value) => set(["link", "hoverColor"], value)} />
        <MarkdownNumberField label="下划线宽" value={markdown.link.underlineThickness} min={0} max={6} step={0.5} onChange={(value) => set(["link", "underlineThickness"], value)} />
        <MarkdownNumberField label="下划线距" value={markdown.link.underlineOffset} min={0} max={12} step={1} onChange={(value) => set(["link", "underlineOffset"], value)} />
        <MarkdownColorField label="强调颜色" value={markdown.emphasis.color} onChange={(value) => set(["emphasis", "color"], value)} />
        <MarkdownNumberField label="粗体字重" value={markdown.emphasis.strongWeight} min={300} max={900} step={50} onChange={(value) => set(["emphasis", "strongWeight"], value)} />
        <MarkdownColorField label="列表标记" value={markdown.list.markerColor} onChange={(value) => set(["list", "markerColor"], value)} />
        <MarkdownNumberField label="列表缩进" value={markdown.list.indent} min={12} max={80} step={1} onChange={(value) => set(["list", "indent"], value)} />
        <MarkdownNumberField label="列表项距" value={markdown.list.itemSpacing} min={0} max={32} step={1} onChange={(value) => set(["list", "itemSpacing"], value)} />
        <MarkdownNumberField label="列表块距" value={markdown.list.blockSpacing} min={0} max={48} step={1} onChange={(value) => set(["list", "blockSpacing"], value)} />
      </MarkdownSettingsGroup>

      <MarkdownSettingsGroup title="引用">
        <MarkdownColorField label="引用文字" value={markdown.quote.textColor} onChange={(value) => set(["quote", "textColor"], value)} />
        <MarkdownColorField label="引用边线" value={markdown.quote.borderColor} onChange={(value) => set(["quote", "borderColor"], value)} />
        <MarkdownColorField label="引用背景" value={markdown.quote.background} onChange={(value) => set(["quote", "background"], value)} />
        <MarkdownNumberField label="横向内边距" value={markdown.quote.paddingX} min={0} max={64} step={1} onChange={(value) => set(["quote", "paddingX"], value)} />
        <MarkdownNumberField label="纵向内边距" value={markdown.quote.paddingY} min={0} max={48} step={1} onChange={(value) => set(["quote", "paddingY"], value)} />
        <MarkdownNumberField label="上下间距" value={markdown.quote.marginY} min={0} max={48} step={1} onChange={(value) => set(["quote", "marginY"], value)} />
        <MarkdownNumberField label="边线宽度" value={markdown.quote.borderWidth} min={0} max={12} step={1} onChange={(value) => set(["quote", "borderWidth"], value)} />
        <MarkdownNumberField label="引用圆角" value={markdown.quote.radius} min={0} max={32} step={1} onChange={(value) => set(["quote", "radius"], value)} />
      </MarkdownSettingsGroup>

      <MarkdownSettingsGroup title="行内代码">
        <MarkdownColorField label="代码文字" value={markdown.inlineCode.textColor} onChange={(value) => set(["inlineCode", "textColor"], value)} />
        <MarkdownColorField label="代码背景" value={markdown.inlineCode.background} onChange={(value) => set(["inlineCode", "background"], value)} />
        <MarkdownNumberField label="代码字号" value={markdown.inlineCode.fontSize} min={8} max={28} step={1} onChange={(value) => set(["inlineCode", "fontSize"], value)} />
        <MarkdownNumberField label="代码行高" value={markdown.inlineCode.lineHeight} min={10} max={40} step={1} onChange={(value) => set(["inlineCode", "lineHeight"], value)} />
        <MarkdownNumberField label="横向内边距" value={markdown.inlineCode.paddingX} min={0} max={16} step={1} onChange={(value) => set(["inlineCode", "paddingX"], value)} />
        <MarkdownNumberField label="纵向内边距" value={markdown.inlineCode.paddingY} min={0} max={12} step={1} onChange={(value) => set(["inlineCode", "paddingY"], value)} />
        <MarkdownNumberField label="代码圆角" value={markdown.inlineCode.radius} min={0} max={20} step={1} onChange={(value) => set(["inlineCode", "radius"], value)} />
      </MarkdownSettingsGroup>

      <MarkdownSettingsGroup title="代码块">
        <MarkdownColorField label="代码文字" value={markdown.codeBlock.textColor} onChange={(value) => set(["codeBlock", "textColor"], value)} />
        <MarkdownColorField label="代码背景" value={markdown.codeBlock.background} onChange={(value) => set(["codeBlock", "background"], value)} />
        <MarkdownNumberField label="代码字号" value={markdown.codeBlock.fontSize} min={8} max={28} step={1} onChange={(value) => set(["codeBlock", "fontSize"], value)} />
        <MarkdownNumberField label="代码行高" value={markdown.codeBlock.lineHeight} min={10} max={44} step={1} onChange={(value) => set(["codeBlock", "lineHeight"], value)} />
        <MarkdownNumberField label="横向内边距" value={markdown.codeBlock.paddingX} min={0} max={64} step={1} onChange={(value) => set(["codeBlock", "paddingX"], value)} />
        <MarkdownNumberField label="纵向内边距" value={markdown.codeBlock.paddingY} min={0} max={64} step={1} onChange={(value) => set(["codeBlock", "paddingY"], value)} />
        <MarkdownNumberField label="上下间距" value={markdown.codeBlock.marginY} min={0} max={48} step={1} onChange={(value) => set(["codeBlock", "marginY"], value)} />
        <MarkdownNumberField label="代码圆角" value={markdown.codeBlock.radius} min={0} max={32} step={1} onChange={(value) => set(["codeBlock", "radius"], value)} />
      </MarkdownSettingsGroup>

      <MarkdownSettingsGroup title="表格">
        <MarkdownColorField label="表格文字" value={markdown.table.textColor} onChange={(value) => set(["table", "textColor"], value)} />
        <MarkdownColorField label="表格边框" value={markdown.table.borderColor} onChange={(value) => set(["table", "borderColor"], value)} />
        <MarkdownColorField label="表头背景" value={markdown.table.headerBackground} onChange={(value) => set(["table", "headerBackground"], value)} />
        <MarkdownColorField label="交替行背景" value={markdown.table.alternateBackground} onChange={(value) => set(["table", "alternateBackground"], value)} />
        <MarkdownNumberField label="单元格横距" value={markdown.table.cellPaddingX} min={0} max={48} step={1} onChange={(value) => set(["table", "cellPaddingX"], value)} />
        <MarkdownNumberField label="单元格纵距" value={markdown.table.cellPaddingY} min={0} max={32} step={1} onChange={(value) => set(["table", "cellPaddingY"], value)} />
        <MarkdownNumberField label="边框宽度" value={markdown.table.borderWidth} min={0} max={6} step={0.5} onChange={(value) => set(["table", "borderWidth"], value)} />
        <MarkdownNumberField label="表格圆角" value={markdown.table.radius} min={0} max={32} step={1} onChange={(value) => set(["table", "radius"], value)} />
        <MarkdownNumberField label="上下间距" value={markdown.table.marginY} min={0} max={48} step={1} onChange={(value) => set(["table", "marginY"], value)} />
      </MarkdownSettingsGroup>

      <MarkdownSettingsGroup title="分隔线与图片">
        <MarkdownColorField label="分隔线颜色" value={markdown.divider.color} onChange={(value) => set(["divider", "color"], value)} />
        <MarkdownNumberField label="分隔线宽" value={markdown.divider.thickness} min={0} max={8} step={0.5} onChange={(value) => set(["divider", "thickness"], value)} />
        <MarkdownNumberField label="分隔线上下距" value={markdown.divider.marginY} min={0} max={64} step={1} onChange={(value) => set(["divider", "marginY"], value)} />
        <MarkdownColorField label="图片边框" value={markdown.image.borderColor} onChange={(value) => set(["image", "borderColor"], value)} />
        <MarkdownNumberField label="图片边框宽" value={markdown.image.borderWidth} min={0} max={12} step={1} onChange={(value) => set(["image", "borderWidth"], value)} />
        <MarkdownNumberField label="图片圆角" value={markdown.image.radius} min={0} max={48} step={1} onChange={(value) => set(["image", "radius"], value)} />
        <MarkdownNumberField label="图片上下距" value={markdown.image.marginY} min={0} max={64} step={1} onChange={(value) => set(["image", "marginY"], value)} />
      </MarkdownSettingsGroup>
    </div>
  );
}

function HeadingSettings({
  label,
  heading,
  onChange
}: {
  label: string;
  heading: MarkdownHeadingTokens;
  onChange: (key: keyof MarkdownHeadingTokens, value: string | number) => void;
}) {
  return (
    <MarkdownSettingsGroup title={label}>
      <MarkdownColorField label="标题颜色" value={heading.color} onChange={(value) => onChange("color", value)} />
      <MarkdownNumberField label="标题字号" value={heading.fontSize} min={10} max={72} step={1} onChange={(value) => onChange("fontSize", value)} />
      <MarkdownNumberField label="标题行高" value={heading.lineHeight} min={12} max={88} step={1} onChange={(value) => onChange("lineHeight", value)} />
      <MarkdownNumberField label="标题字重" value={heading.fontWeight} min={300} max={900} step={50} onChange={(value) => onChange("fontWeight", value)} />
      <MarkdownNumberField label="标题字距" value={heading.letterSpacing} min={-3} max={6} step={0.1} onChange={(value) => onChange("letterSpacing", value)} />
      <MarkdownNumberField label="标题上距" value={heading.marginTop} min={0} max={96} step={1} onChange={(value) => onChange("marginTop", value)} />
      <MarkdownNumberField label="标题下距" value={heading.marginBottom} min={0} max={64} step={1} onChange={(value) => onChange("marginBottom", value)} />
    </MarkdownSettingsGroup>
  );
}

function MarkdownSettingsGroup({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(open);

  return (
    <details open={isOpen} className="rounded-md border bg-background/50" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">{title}</summary>
      <div className="grid gap-3 border-t p-3">{children}</div>
    </details>
  );
}

function MarkdownTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        key={value}
        type="text"
        defaultValue={value}
        className="h-8 min-w-0 rounded-md border bg-background px-2 font-mono text-xs text-foreground"
        onBlur={(event) => {
          const nextValue = event.target.value.trim();
          if (nextValue) onChange(nextValue);
        }}
      />
    </label>
  );
}

function MarkdownColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid grid-cols-[96px_minmax(0,1fr)_84px] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type="color" value={value} className="h-8 w-full cursor-pointer rounded-md border bg-background p-1" onChange={(event) => onChange(event.target.value)} />
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}

function MarkdownNumberField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type="range" value={value} min={min} max={max} step={step} className="h-8 w-full accent-primary" onChange={(event) => onChange(Number(event.target.value))} />
      <input
        type="number"
        value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
        min={min}
        max={max}
        step={step}
        className="h-8 min-w-0 rounded-md border bg-background px-2 font-mono text-xs text-foreground"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function MarkdownThemePreview({ markdown }: { markdown: MarkdownThemeTokens }) {
  return (
    <div className="grid gap-3 overflow-hidden rounded-md border p-4" style={{ backgroundColor: markdown.quote.background, color: markdown.body.color, fontFamily: markdown.font.familyBody }}>
      <div
        style={{
          color: markdown.heading.h2.color,
          fontFamily: markdown.font.familyHeading,
          fontSize: Math.min(markdown.heading.h2.fontSize, 30),
          fontWeight: markdown.heading.h2.fontWeight,
          lineHeight: `${Math.min(markdown.heading.h2.lineHeight, 38)}px`,
          letterSpacing: markdown.heading.h2.letterSpacing
        }}
      >
        Markdown 样式预览
      </div>
      <p style={{ margin: 0, fontSize: markdown.body.fontSize, fontWeight: markdown.body.fontWeight, lineHeight: `${markdown.body.lineHeight}px`, letterSpacing: markdown.body.letterSpacing }}>
        正文支持 <strong style={{ color: markdown.emphasis.color, fontWeight: markdown.emphasis.strongWeight }}>强调文字</strong>、
        <span style={{ color: markdown.link.color, textDecoration: "underline", textUnderlineOffset: markdown.link.underlineOffset }}>链接</span> 和{" "}
        <code
          style={{
            borderRadius: markdown.inlineCode.radius,
            background: markdown.inlineCode.background,
            color: markdown.inlineCode.textColor,
            fontFamily: markdown.font.familyCode,
            fontSize: markdown.inlineCode.fontSize,
            padding: `${markdown.inlineCode.paddingY}px ${markdown.inlineCode.paddingX}px`
          }}
        >
          inline code
        </code>
        。
      </p>
      <div
        style={{
          borderLeft: `${markdown.quote.borderWidth}px solid ${markdown.quote.borderColor}`,
          borderRadius: markdown.quote.radius,
          background: markdown.quote.background,
          color: markdown.quote.textColor,
          padding: `${markdown.quote.paddingY}px ${markdown.quote.paddingX}px`
        }}
      >
        引用、列表、代码块和表格都会跟随当前主题。
      </div>
      <pre
        className="overflow-hidden"
        style={{
          margin: 0,
          borderRadius: markdown.codeBlock.radius,
          background: markdown.codeBlock.background,
          color: markdown.codeBlock.textColor,
          fontFamily: markdown.font.familyCode,
          fontSize: markdown.codeBlock.fontSize,
          lineHeight: `${markdown.codeBlock.lineHeight}px`,
          padding: `${Math.min(markdown.codeBlock.paddingY, 16)}px ${Math.min(markdown.codeBlock.paddingX, 20)}px`
        }}
      >
        <code>const theme = "markdown";</code>
      </pre>
    </div>
  );
}

function updateMarkdownPath(markdown: MarkdownThemeTokens, path: readonly string[], value: string | number): MarkdownThemeTokens {
  function update(current: unknown, depth: number): unknown {
    if (depth === path.length) return value;
    const record = current as Record<string, unknown>;
    const key = path[depth];
    return { ...record, [key]: update(record[key], depth + 1) };
  }

  return update(markdown, 0) as MarkdownThemeTokens;
}
