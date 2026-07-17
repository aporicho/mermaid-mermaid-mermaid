import { useMemo, useState } from "react";
import { ColorWheel, Terminal } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownThemeSettings } from "@/features/mermaid-editor/components/markdown-theme-settings";
import {
  BUILT_IN_EDITOR_THEME_CATALOG,
  BUILT_IN_EDITOR_THEMES,
  compileEditorTheme,
  createDefaultMarkdownTheme,
  DEFAULT_EDITOR_THEME,
  type EditorTheme,
  type EditorThemeId,
  isBuiltInThemeId,
  isHexColor,
  mergeMarkdownTheme,
  normalizeMarkdownTheme,
  themeModeLabel
} from "@/features/mermaid-editor/lib/editor-theme";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

type ThemeSettingsSection = "overview" | "markdown" | "canvas" | "terminal" | "advanced";

const themeSettingsSections = [
  ["overview", "概览"],
  ["markdown", "Markdown"],
  ["canvas", "画布"],
  ["terminal", "终端"],
  ["advanced", "高级"]
] as const satisfies readonly (readonly [ThemeSettingsSection, string])[];

const ansiColorRows = [
  ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"],
  ["brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite"]
] as const satisfies readonly (readonly (keyof EditorTheme["ansi"])[])[];
const ansiColorLabels: Record<keyof EditorTheme["ansi"], string> = {
  black: "黑",
  red: "红",
  green: "绿",
  yellow: "黄",
  blue: "蓝",
  magenta: "品红",
  cyan: "青",
  white: "白",
  brightBlack: "亮黑",
  brightRed: "亮红",
  brightGreen: "亮绿",
  brightYellow: "亮黄",
  brightBlue: "亮蓝",
  brightMagenta: "亮品红",
  brightCyan: "亮青",
  brightWhite: "亮白"
};

function normalizeThemeId(value: unknown): EditorThemeId {
  return isBuiltInThemeId(value) || value === "custom" ? (value as EditorThemeId) : DEFAULT_EDITOR_THEME.id;
}

export function ThemeSettingsPanel({
  themeId,
  customTheme,
  activeTheme,
  onPreview,
  onCancel,
  onSave
}: {
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  activeTheme: EditorTheme;
  onPreview: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [themeQuery, setThemeQuery] = useState("");
  const [activeSection, setActiveSection] = useState<ThemeSettingsSection>("overview");

  function selectTheme(value: string) {
    const nextThemeId = normalizeThemeId(value);
    if (nextThemeId === "custom") {
      onPreview("custom", customTheme || toCustomTheme(activeTheme));
      return;
    }
    onPreview(nextThemeId, customTheme);
  }

  function updateCustomTheme(updater: (theme: EditorTheme) => EditorTheme) {
    onPreview("custom", updater(toCustomTheme(activeTheme)));
  }

  function updateUiColor(key: keyof EditorTheme["ui"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, ui: { ...theme.ui, [key]: value } }));
  }

  function updateCanvasColor(key: keyof EditorTheme["canvas"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, canvas: { ...theme.canvas, [key]: value } }));
  }

  function updateSourceColor(key: keyof EditorTheme["source"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, source: { ...theme.source, [key]: value } }));
  }

  function updateRenderColor(key: keyof EditorTheme["render"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, render: { ...theme.render, [key]: value } }));
  }

  function updateTerminalColor(key: keyof EditorTheme["terminal"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, terminal: { ...theme.terminal, [key]: value } }));
  }

  function updateAnsiColor(key: keyof EditorTheme["ansi"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, ansi: { ...theme.ansi, [key]: value } }));
  }

  function updateMarkdown(markdown: EditorTheme["markdown"]) {
    updateCustomTheme((theme) => ({ ...theme, markdown: normalizeMarkdownTheme(markdown, theme.markdown) }));
  }

  function resetMarkdown() {
    updateCustomTheme((theme) => ({ ...theme, markdown: createDefaultMarkdownTheme(theme) }));
  }

  function resetTerminalColors() {
    updateCustomTheme((theme) => ({ ...theme, terminal: { ...DEFAULT_EDITOR_THEME.terminal } }));
  }

  function resetAnsiColors() {
    updateCustomTheme((theme) => ({ ...theme, ansi: { ...DEFAULT_EDITOR_THEME.ansi } }));
  }

  function updateFontNumber(key: NumberKeys<EditorTheme["font"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, font: { ...theme.font, [key]: value } }));
  }

  function updateSpaceNumber(key: NumberKeys<EditorTheme["space"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, space: { ...theme.space, [key]: value } }));
  }

  function updateRadiusNumber(key: NumberKeys<EditorTheme["radius"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, radius: { ...theme.radius, [key]: value } }));
  }

  function updateStrokeNumber(key: NumberKeys<EditorTheme["stroke"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, stroke: { ...theme.stroke, [key]: value } }));
  }

  function updateCanvasInteractionNumber(key: NumberKeys<EditorTheme["canvasInteraction"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, canvasInteraction: { ...theme.canvasInteraction, [key]: value } }));
  }

  function updateSubgraphNumber(key: NumberKeys<EditorTheme["subgraph"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, subgraph: { ...theme.subgraph, [key]: value } }));
  }

  function updateEdgeLabelNumber(key: NumberKeys<EditorTheme["edgeLabel"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, edgeLabel: { ...theme.edgeLabel, [key]: value } }));
  }

  function updateMotionDurationNumber(key: keyof EditorTheme["motion"]["duration"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, duration: { ...theme.motion.duration, [key]: value } } }));
  }

  function updateMotionDistanceNumber(key: keyof EditorTheme["motion"]["distance"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, distance: { ...theme.motion.distance, [key]: value } } }));
  }

  function updateMotionStaggerNumber(key: keyof EditorTheme["motion"]["stagger"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, stagger: { ...theme.motion.stagger, [key]: value } } }));
  }

  function updateMotionCanvasNumber(key: keyof EditorTheme["motion"]["canvas"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, canvas: { ...theme.motion.canvas, [key]: value } } }));
  }

  function resetMotion() {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...DEFAULT_EDITOR_THEME.motion } }));
  }

  const visibleThemeEntries = useMemo(() => {
    const query = themeQuery.trim().toLowerCase();
    if (!query) return BUILT_IN_EDITOR_THEME_CATALOG;
    return BUILT_IN_EDITOR_THEME_CATALOG.filter((entry) =>
      [entry.name, entry.id, entry.description, entry.source.name].some((value) => value.toLowerCase().includes(query))
    );
  }, [themeQuery]);
  const themeDiagnostics = useMemo(() => compileEditorTheme(activeTheme).diagnostics, [activeTheme]);

  return (
    <div className="fixed inset-0 bg-foreground/10" style={{ zIndex: OVERLAY_Z_INDEX.modal }}>
      <section className="absolute inset-y-0 right-0 grid w-[min(460px,100vw)] grid-rows-[52px_minmax(0,1fr)_56px] border-l bg-card">
        <header className="flex items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <ColorWheel className="size-4 text-icon" />
            <h2 className="text-sm font-medium">主题</h2>
          </div>
          <Button size="sm" variant="ghost" className="text-icon hover:text-icon" onClick={onCancel}>
            取消
          </Button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4">
          <nav className="sticky -top-4 z-10 mb-4 grid grid-cols-5 gap-1 border-b bg-card py-3" aria-label="主题设置分类">
            {themeSettingsSections.map(([section, label]) => (
              <button
                key={section}
                type="button"
                className={`h-8 rounded-md px-1 text-xs transition-colors ${
                  activeSection === section ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setActiveSection(section)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="grid gap-5">
            <div className={activeSection === "overview" ? "grid gap-2" : "hidden"}>
              <Label>预设</Label>
              <Input value={themeQuery} placeholder={`搜索 ${BUILT_IN_EDITOR_THEMES.length} 个主题`} onChange={(event) => setThemeQuery(event.target.value)} />
              <div className="max-h-72 overflow-y-auto rounded-md border bg-background">
                {visibleThemeEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 ${
                      entry.id === themeId ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                    }`}
                    onClick={() => selectTheme(entry.id)}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded-sm border">
                      {entry.swatches.map((color, index) => (
                        <span key={`${color}-${index}`} className="h-6 w-5" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.name}</span>
                      <span className="block truncate text-xs opacity-70">
                        {entry.source.name} · {themeModeLabel(entry.mode)}
                      </span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                    themeId === "custom" ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => selectTheme("custom")}
                >
                  <span className="size-6 rounded-sm border" style={{ backgroundColor: activeTheme.ui.primary }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">自定义主题</span>
                    <span className="block truncate text-xs opacity-70">当前编辑</span>
                  </span>
                </button>
                {visibleThemeEntries.length === 0 ? <div className="px-3 py-6 text-center text-xs text-muted-foreground">没有匹配主题</div> : null}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="h-8 px-2" onClick={() => onPreview("custom", toCustomTheme(activeTheme))}>
                  复制当前
                </Button>
                <Button variant="ghost" className="h-8 px-2" onClick={() => onPreview(DEFAULT_EDITOR_THEME.id, null)}>
                  恢复默认
                </Button>
              </div>
            </div>

            {activeSection === "overview" ? <ThemePreview theme={activeTheme} /> : null}

            <div className={activeSection === "advanced" ? "grid gap-3" : "hidden"}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-muted-foreground">动效</h3>
                <Button variant="ghost" className="h-8 px-2" onClick={resetMotion}>
                  重置动效
                </Button>
              </div>
              <ThemeMotionPreview theme={activeTheme} />
              <ThemeNumberField label="快速时长" value={activeTheme.motion.duration.fast} min={0} max={0.4} step={0.01} onChange={(value) => updateMotionDurationNumber("fast", value)} />
              <ThemeNumberField label="基础时长" value={activeTheme.motion.duration.base} min={0} max={0.8} step={0.01} onChange={(value) => updateMotionDurationNumber("base", value)} />
              <ThemeNumberField label="面板时长" value={activeTheme.motion.duration.slow} min={0} max={1.2} step={0.01} onChange={(value) => updateMotionDurationNumber("slow", value)} />
              <ThemeNumberField label="布局时长" value={activeTheme.motion.duration.layout} min={0} max={1.6} step={0.01} onChange={(value) => updateMotionDurationNumber("layout", value)} />
              <ThemeNumberField label="控件距离" value={activeTheme.motion.distance.chrome} min={0} max={32} step={1} onChange={(value) => updateMotionDistanceNumber("chrome", value)} />
              <ThemeNumberField label="面板距离" value={activeTheme.motion.distance.panel} min={0} max={96} step={1} onChange={(value) => updateMotionDistanceNumber("panel", value)} />
              <ThemeNumberField label="视图距离" value={activeTheme.motion.distance.viewport} min={0} max={320} step={4} onChange={(value) => updateMotionDistanceNumber("viewport", value)} />
              <ThemeNumberField label="按钮错峰" value={activeTheme.motion.stagger.button} min={0} max={0.16} step={0.005} onChange={(value) => updateMotionStaggerNumber("button", value)} />
              <ThemeNumberField label="列表错峰" value={activeTheme.motion.stagger.list} min={0} max={0.16} step={0.005} onChange={(value) => updateMotionStaggerNumber("list", value)} />
              <ThemeNumberField label="新建缩放" value={activeTheme.motion.canvas.createScale} min={0.7} max={1} step={0.01} onChange={(value) => updateMotionCanvasNumber("createScale", value)} />
              <ThemeNumberField label="选中缩放" value={activeTheme.motion.canvas.selectedScale} min={1} max={1.08} step={0.005} onChange={(value) => updateMotionCanvasNumber("selectedScale", value)} />
              <ThemeNumberField label="高亮时长" value={activeTheme.motion.canvas.highlightDuration} min={0} max={1.8} step={0.01} onChange={(value) => updateMotionCanvasNumber("highlightDuration", value)} />
              <ThemeNumberField label="动画上限" value={activeTheme.motion.canvas.maxAnimatedItems} min={0} max={400} step={10} onChange={(value) => updateMotionCanvasNumber("maxAnimatedItems", value)} />
              <ThemeNumberField label="靠近半径" value={activeTheme.motion.canvas.proximityRadiusPx} min={0} max={600} step={10} onChange={(value) => updateMotionCanvasNumber("proximityRadiusPx", value)} />
              <ThemeNumberField label="靠近缩放" value={activeTheme.motion.canvas.proximityMaxScale} min={1} max={3} step={0.01} onChange={(value) => updateMotionCanvasNumber("proximityMaxScale", value)} />
              <ThemeNumberField label="靠近时长" value={activeTheme.motion.canvas.proximityDuration} min={0} max={0.8} step={0.01} onChange={(value) => updateMotionCanvasNumber("proximityDuration", value)} />
            </div>

            <div className={activeSection === "overview" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">界面</h3>
              <ThemeColorField label="背景" value={activeTheme.ui.background} onChange={(value) => updateUiColor("background", value)} />
              <ThemeColorField label="文字" value={activeTheme.ui.foreground} onChange={(value) => updateUiColor("foreground", value)} />
              <ThemeColorField label="图标" value={activeTheme.ui.icon} onChange={(value) => updateUiColor("icon", value)} />
              <ThemeColorField label="面板" value={activeTheme.ui.card} onChange={(value) => updateUiColor("card", value)} />
              <ThemeColorField label="浮层" value={activeTheme.ui.popover} onChange={(value) => updateUiColor("popover", value)} />
              <ThemeColorField label="边框" value={activeTheme.ui.border} onChange={(value) => updateUiColor("border", value)} />
              <ThemeColorField label="强调" value={activeTheme.ui.primary} onChange={(value) => updateUiColor("primary", value)} />
              <ThemeColorField label="次级" value={activeTheme.ui.secondary} onChange={(value) => updateUiColor("secondary", value)} />
              <ThemeColorField label="弱背景" value={activeTheme.ui.muted} onChange={(value) => updateUiColor("muted", value)} />
              <ThemeColorField label="弱文字" value={activeTheme.ui.mutedForeground} onChange={(value) => updateUiColor("mutedForeground", value)} />
              <ThemeColorField label="轻强调" value={activeTheme.ui.accent} onChange={(value) => updateUiColor("accent", value)} />
              <ThemeColorField label="强调文字" value={activeTheme.ui.accentForeground} onChange={(value) => updateUiColor("accentForeground", value)} />
              <ThemeColorField label="危险" value={activeTheme.ui.destructive} onChange={(value) => updateUiColor("destructive", value)} />
            </div>

            {activeSection === "markdown" ? (
              <MarkdownThemeSettings markdown={activeTheme.markdown} onChange={updateMarkdown} onReset={resetMarkdown} />
            ) : null}

            <div className={activeSection === "canvas" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">画布颜色</h3>
              <ThemeColorField label="表面" value={activeTheme.canvas.surface} onChange={(value) => updateCanvasColor("surface", value)} />
              <ThemeColorField label="节点描边" value={activeTheme.canvas.nodeStroke} onChange={(value) => updateCanvasColor("nodeStroke", value)} />
              <ThemeColorField label="节点文字" value={activeTheme.canvas.nodeText} onChange={(value) => updateCanvasColor("nodeText", value)} />
              <ThemeColorField label="连线" value={activeTheme.canvas.edge} onChange={(value) => updateCanvasColor("edge", value)} />
              <ThemeColorField label="连线文字" value={activeTheme.canvas.edgeText} onChange={(value) => updateCanvasColor("edgeText", value)} />
              <ThemeColorField label="标签描边" value={activeTheme.canvas.labelStroke} onChange={(value) => updateCanvasColor("labelStroke", value)} />
              <ThemeColorField label="非法连接" value={activeTheme.canvas.connectionInvalid} onChange={(value) => updateCanvasColor("connectionInvalid", value)} />
              <ThemeColorField label="无效预览" value={activeTheme.canvas.previewInvalid} onChange={(value) => updateCanvasColor("previewInvalid", value)} />
            </div>

            <div className={activeSection === "advanced" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">源码与渲染</h3>
              <ThemeColorField label="行分隔" value={activeTheme.source.line} onChange={(value) => updateSourceColor("line", value)} />
              <ThemeColorField label="渲染背景" value={activeTheme.render.background} onChange={(value) => updateRenderColor("background", value)} />
              <ThemeColorField label="渲染网格" value={activeTheme.render.gridDot} onChange={(value) => updateRenderColor("gridDot", value)} />
            </div>

            <div className={activeSection === "terminal" ? "grid gap-3" : "hidden"}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-muted-foreground">终端</h3>
                <Button variant="ghost" className="h-8 px-2" onClick={resetTerminalColors}>
                  重置终端
                </Button>
              </div>
              <ThemeTerminalPreview theme={activeTheme} />
              <ThemeColorField label="背景" value={activeTheme.terminal.background} onChange={(value) => updateTerminalColor("background", value)} />
              <ThemeColorField label="文字" value={activeTheme.terminal.foreground} onChange={(value) => updateTerminalColor("foreground", value)} />
              <ThemeColorField label="光标" value={activeTheme.terminal.cursor} onChange={(value) => updateTerminalColor("cursor", value)} />
              <ThemeColorField label="光标文字" value={activeTheme.terminal.cursorAccent} onChange={(value) => updateTerminalColor("cursorAccent", value)} />
              <ThemeColorField label="选区" value={activeTheme.terminal.selectionBackground} onChange={(value) => updateTerminalColor("selectionBackground", value)} />
              <ThemeColorField label="选区文字" value={activeTheme.terminal.selectionForeground} onChange={(value) => updateTerminalColor("selectionForeground", value)} />
              <ThemeNumberField label="字号" value={activeTheme.font.sizeTerminal} min={10} max={22} step={1} onChange={(value) => updateFontNumber("sizeTerminal", value)} />
              <ThemeNumberField label="行高" value={activeTheme.font.lineHeightTerminal} min={14} max={32} step={1} onChange={(value) => updateFontNumber("lineHeightTerminal", value)} />
            </div>

            <div className={activeSection === "terminal" ? "grid gap-3" : "hidden"}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-muted-foreground">ANSI 16 色</h3>
                <Button variant="ghost" className="h-8 px-2" onClick={resetAnsiColors}>
                  重置 ANSI
                </Button>
              </div>
              <div className="grid gap-2">
                {ansiColorRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-4 gap-2">
                    {row.map((key) => (
                      <ThemeAnsiColorField key={key} label={ansiColorLabels[key]} value={activeTheme.ansi[key]} onChange={(value) => updateAnsiColor(key, value)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className={activeSection === "canvas" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">节点</h3>
              <ThemeNumberField label="字号" value={activeTheme.font.sizeNode} min={10} max={28} step={1} onChange={(value) => updateFontNumber("sizeNode", value)} />
              <ThemeNumberField label="行高" value={activeTheme.font.lineHeightNode} min={12} max={42} step={1} onChange={(value) => updateFontNumber("lineHeightNode", value)} />
              <ThemeNumberField label="横向内边距" value={activeTheme.space.nodePaddingX} min={4} max={40} step={1} onChange={(value) => updateSpaceNumber("nodePaddingX", value)} />
              <ThemeNumberField label="纵向内边距" value={activeTheme.space.nodePaddingY} min={4} max={40} step={1} onChange={(value) => updateSpaceNumber("nodePaddingY", value)} />
              <ThemeNumberField label="最小字符" value={activeTheme.space.nodeMinChars} min={2} max={24} step={1} onChange={(value) => updateSpaceNumber("nodeMinChars", value)} />
              <ThemeNumberField label="最大字符" value={activeTheme.space.nodeMaxChars} min={8} max={60} step={1} onChange={(value) => updateSpaceNumber("nodeMaxChars", value)} />
              <ThemeNumberField label="最大行数" value={activeTheme.space.nodeMaxLines} min={2} max={30} step={1} onChange={(value) => updateSpaceNumber("nodeMaxLines", value)} />
              <ThemeNumberField label="节点圆角" value={activeTheme.radius.canvasNode} min={0} max={48} step={1} onChange={(value) => updateRadiusNumber("canvasNode", value)} />
              <ThemeNumberField label="多边形圆角" value={activeTheme.radius.polygonCorner} min={0} max={24} step={1} onChange={(value) => updateRadiusNumber("polygonCorner", value)} />
            </div>

            <div className={activeSection === "canvas" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">连线标签</h3>
              <ThemeNumberField label="字号" value={activeTheme.edgeLabel.fontSize} min={9} max={24} step={1} onChange={(value) => updateEdgeLabelNumber("fontSize", value)} />
              <ThemeNumberField label="行高" value={activeTheme.edgeLabel.lineHeight} min={10} max={36} step={1} onChange={(value) => updateEdgeLabelNumber("lineHeight", value)} />
              <ThemeNumberField label="高度" value={activeTheme.edgeLabel.height} min={18} max={64} step={1} onChange={(value) => updateEdgeLabelNumber("height", value)} />
              <ThemeNumberField label="横向内边距" value={activeTheme.edgeLabel.paddingX} min={2} max={32} step={1} onChange={(value) => updateEdgeLabelNumber("paddingX", value)} />
              <ThemeNumberField label="最小字符" value={activeTheme.edgeLabel.minChars} min={1} max={20} step={1} onChange={(value) => updateEdgeLabelNumber("minChars", value)} />
              <ThemeNumberField label="最大字符" value={activeTheme.edgeLabel.maxChars} min={4} max={60} step={1} onChange={(value) => updateEdgeLabelNumber("maxChars", value)} />
              <ThemeNumberField label="标签圆角" value={activeTheme.radius.edgeLabel} min={0} max={24} step={1} onChange={(value) => updateRadiusNumber("edgeLabel", value)} />
            </div>

            <div className={activeSection === "canvas" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">分组</h3>
              <ThemeNumberField label="标题字号" value={activeTheme.subgraph.titleFontSize} min={9} max={24} step={1} onChange={(value) => updateSubgraphNumber("titleFontSize", value)} />
              <ThemeNumberField label="标题高度" value={activeTheme.subgraph.titleHeight} min={18} max={56} step={1} onChange={(value) => updateSubgraphNumber("titleHeight", value)} />
              <ThemeNumberField label="横向内边距" value={activeTheme.subgraph.paddingX} min={8} max={96} step={1} onChange={(value) => updateSubgraphNumber("paddingX", value)} />
              <ThemeNumberField label="顶部内边距" value={activeTheme.subgraph.paddingTop} min={24} max={120} step={1} onChange={(value) => updateSubgraphNumber("paddingTop", value)} />
              <ThemeNumberField label="底部内边距" value={activeTheme.subgraph.paddingBottom} min={8} max={96} step={1} onChange={(value) => updateSubgraphNumber("paddingBottom", value)} />
              <ThemeNumberField label="最小宽度" value={activeTheme.subgraph.minWidth} min={80} max={520} step={4} onChange={(value) => updateSubgraphNumber("minWidth", value)} />
              <ThemeNumberField label="最小高度" value={activeTheme.subgraph.minHeight} min={60} max={360} step={4} onChange={(value) => updateSubgraphNumber("minHeight", value)} />
              <ThemeNumberField label="填充透明" value={activeTheme.subgraph.fillOpacity} min={0} max={1} step={0.01} onChange={(value) => updateSubgraphNumber("fillOpacity", value)} />
            </div>

            <div className={activeSection === "canvas" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">线与交互</h3>
              <ThemeNumberField label="节点线宽" value={activeTheme.stroke.node} min={0.5} max={8} step={0.5} onChange={(value) => updateStrokeNumber("node", value)} />
              <ThemeNumberField label="节点强调" value={activeTheme.stroke.nodeEmphasized} min={0.5} max={10} step={0.5} onChange={(value) => updateStrokeNumber("nodeEmphasized", value)} />
              <ThemeNumberField label="连线线宽" value={activeTheme.stroke.edge} min={0.5} max={10} step={0.5} onChange={(value) => updateStrokeNumber("edge", value)} />
              <ThemeNumberField label="粗连线" value={activeTheme.stroke.edgeThick} min={1} max={14} step={0.5} onChange={(value) => updateStrokeNumber("edgeThick", value)} />
              <ThemeNumberField label="覆盖线宽" value={activeTheme.stroke.overlay} min={0.5} max={6} step={0.5} onChange={(value) => updateStrokeNumber("overlay", value)} />
              <ThemeNumberField label="锚点线宽" value={activeTheme.stroke.anchor} min={0.5} max={8} step={0.5} onChange={(value) => updateStrokeNumber("anchor", value)} />
              <ThemeNumberField label="锚点半径" value={activeTheme.canvasInteraction.anchorRadius} min={3} max={16} step={0.5} onChange={(value) => updateCanvasInteractionNumber("anchorRadius", value)} />
              <ThemeNumberField label="端点半径" value={activeTheme.canvasInteraction.endpointRadius} min={3} max={18} step={0.5} onChange={(value) => updateCanvasInteractionNumber("endpointRadius", value)} />
              <ThemeNumberField label="命中宽度" value={activeTheme.canvasInteraction.edgeHitStrokeWidth} min={8} max={40} step={1} onChange={(value) => updateCanvasInteractionNumber("edgeHitStrokeWidth", value)} />
              <ThemeNumberField label="箭头长度" value={activeTheme.canvasInteraction.pointerLength} min={0} max={32} step={1} onChange={(value) => updateCanvasInteractionNumber("pointerLength", value)} />
              <ThemeNumberField label="箭头宽度" value={activeTheme.canvasInteraction.pointerWidth} min={0} max={32} step={1} onChange={(value) => updateCanvasInteractionNumber("pointerWidth", value)} />
            </div>

            <div className={activeSection === "canvas" ? "grid gap-3" : "hidden"}>
              <h3 className="text-xs font-medium text-muted-foreground">网格</h3>
              <ThemeNumberField label="小格步长" value={activeTheme.space.gridMinorStep} min={8} max={80} step={1} onChange={(value) => updateSpaceNumber("gridMinorStep", value)} />
              <ThemeNumberField label="主格倍率" value={activeTheme.space.gridMajorEvery} min={2} max={12} step={1} onChange={(value) => updateSpaceNumber("gridMajorEvery", value)} />
              <ThemeNumberField label="小格透明" value={activeTheme.canvasInteraction.gridMinorAlpha} min={0} max={1} step={0.01} onChange={(value) => updateCanvasInteractionNumber("gridMinorAlpha", value)} />
              <ThemeNumberField label="主格透明" value={activeTheme.canvasInteraction.gridMajorAlpha} min={0} max={1} step={0.01} onChange={(value) => updateCanvasInteractionNumber("gridMajorAlpha", value)} />
              <ThemeNumberField label="远景透明" value={activeTheme.canvasInteraction.gridSuperAlpha} min={0} max={1} step={0.01} onChange={(value) => updateCanvasInteractionNumber("gridSuperAlpha", value)} />
              <ThemeNumberField label="点数上限" value={activeTheme.canvasInteraction.gridMaxDots} min={800} max={20000} step={100} onChange={(value) => updateCanvasInteractionNumber("gridMaxDots", value)} />
            </div>

            {activeSection === "advanced" && themeDiagnostics.length ? (
              <div className="grid gap-2 rounded-md border border-destructive/30 bg-background/60 p-3">
                <h3 className="text-xs font-medium text-destructive">主题诊断</h3>
                {themeDiagnostics.map((diagnostic) => (
                  <p key={diagnostic.code} className="text-xs text-muted-foreground">
                    {diagnostic.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t px-4">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onSave}>应用</Button>
        </footer>
      </section>
    </div>
  );
}

function ThemeColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid grid-cols-[96px_minmax(0,1fr)_84px] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="color"
        value={isHexColor(value) ? value : "#000000"}
        className="h-8 w-full cursor-pointer rounded-md border bg-background p-1"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}

function ThemeNumberField({
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
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        className="h-8 w-full accent-primary"
        onChange={(event) => onChange(Number(event.target.value))}
      />
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

function ThemeAnsiColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type="color"
        value={isHexColor(value) ? value : "#000000"}
        className="h-8 w-full cursor-pointer rounded-md border bg-background p-1"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="truncate font-mono text-[10px] leading-4">{value}</span>
    </label>
  );
}

function ThemeTerminalPreview({ theme }: { theme: EditorTheme }) {
  return (
    <div
      className="grid gap-2 rounded-md border p-3 font-mono text-xs"
      style={{
        borderColor: theme.ui.border,
        backgroundColor: theme.terminal.background,
        color: theme.terminal.foreground,
        fontSize: theme.font.sizeTerminal,
        lineHeight: `${theme.font.lineHeightTerminal}px`
      }}
    >
      <div className="flex items-center gap-2">
        <Terminal className="size-4" style={{ color: theme.ui.icon }} />
        <span style={{ color: theme.ansi.green }}>project</span>
        <span style={{ color: theme.ansi.blue }}>main</span>
        <span style={{ color: theme.terminal.cursor }}>$</span>
        <span>npm run build</span>
      </div>
      <div className="grid gap-1">
        <span style={{ color: theme.ansi.green }}>✓ 类型检查通过</span>
        <span style={{ color: theme.ansi.yellow }}>! 发现 1 条主题诊断</span>
        <span style={{ color: theme.ansi.red }}>x 终端输出错误示例</span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {ansiColorRows.flat().map((key) => (
          <span key={key} className="h-5 rounded-sm border" style={{ borderColor: theme.ui.border, backgroundColor: theme.ansi[key] }} title={ansiColorLabels[key]} />
        ))}
      </div>
    </div>
  );
}

function ThemeMotionPreview({ theme }: { theme: EditorTheme }) {
  return (
    <div className="grid gap-2 rounded-md border p-3" style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.background }}>
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ backgroundColor: theme.ui.primary }} />
        <span className="size-3 rounded-full opacity-80" style={{ backgroundColor: theme.ui.icon }} />
        <span className="size-3 rounded-full opacity-60" style={{ backgroundColor: theme.ui.border }} />
      </div>
      <div className="text-xs text-muted-foreground">
        {`快速 ${Math.round(theme.motion.duration.fast * 1000)}ms · 基础 ${Math.round(theme.motion.duration.base * 1000)}ms · 布局 ${Math.round(theme.motion.duration.layout * 1000)}ms`}
      </div>
    </div>
  );
}

function ThemePreview({ theme }: { theme: EditorTheme }) {
  return (
    <div className="grid gap-2 rounded-md border p-3" style={{ backgroundColor: theme.ui.background, color: theme.ui.foreground }}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-md border" style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.card }}>
          <ColorWheel className="m-2 size-4" style={{ color: theme.ui.icon }} />
        </div>
        <div className="h-8 rounded-md px-3 py-1 text-sm" style={{ backgroundColor: theme.ui.primary, color: theme.ui.background }}>
          高亮
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <div className="rounded-md border px-4 py-3 text-sm font-bold" style={{ borderColor: theme.canvas.nodeStroke, backgroundColor: theme.canvas.surface, color: theme.canvas.nodeText }}>
          节点
        </div>
        <div className="h-px flex-1" style={{ backgroundColor: theme.canvas.edge }} />
        <div className="rounded-md border px-2 py-1 font-mono text-xs" style={{ borderColor: theme.source.line, backgroundColor: theme.ui.card }}>
          Mermaid
        </div>
      </div>
      <div className="rounded-md border px-2 py-1 font-mono text-xs" style={{ borderColor: theme.ui.border, backgroundColor: theme.terminal.background, color: theme.terminal.foreground }}>
        <span style={{ color: theme.ansi.green }}>project</span> <span style={{ color: theme.terminal.cursor }}>$</span> terminal
      </div>
    </div>
  );
}

function toCustomTheme(theme: EditorTheme): EditorTheme {
  return {
    version: 5,
    id: "custom",
    name: theme.id === "custom" ? theme.name : "自定义主题",
    description: theme.description,
    baseThemeId: theme.id === "custom" ? theme.baseThemeId : theme.id,
    ui: { ...theme.ui },
    canvas: { ...theme.canvas },
    source: { ...theme.source },
    render: { ...theme.render },
    markdown: mergeMarkdownTheme(theme.markdown, theme.markdown),
    ansi: { ...theme.ansi },
    terminal: { ...theme.terminal },
    font: { ...theme.font },
    space: { ...theme.space },
    radius: { ...theme.radius },
    stroke: {
      ...theme.stroke,
      edgeDotted: [...theme.stroke.edgeDotted],
      selectionDash: [...theme.stroke.selectionDash],
      connectionDraftDash: [...theme.stroke.connectionDraftDash],
      centerGuideDash: [...theme.stroke.centerGuideDash],
      subgraphDash: [...theme.stroke.subgraphDash]
    },
    icon: { ...theme.icon },
    canvasInteraction: { ...theme.canvasInteraction },
    subgraph: { ...theme.subgraph },
    edgeLabel: { ...theme.edgeLabel },
    motion: {
      duration: { ...theme.motion.duration },
      ease: { ...theme.motion.ease },
      distance: { ...theme.motion.distance },
      stagger: { ...theme.motion.stagger },
      canvas: { ...theme.motion.canvas }
    },
    diagnostics: { ...theme.diagnostics }
  };
}
