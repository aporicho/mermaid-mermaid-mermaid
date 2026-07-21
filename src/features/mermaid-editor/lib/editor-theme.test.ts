import { describe, expect, it } from "vitest";

import {
  BUILT_IN_EDITOR_THEME_CATALOG,
  BUILT_IN_EDITOR_THEMES,
  compileEditorTheme,
  createDefaultMarkdownTheme,
  DEFAULT_EDITOR_THEME,
  isBuiltInThemeId,
  normalizeEditorTheme,
  resolveEditorTheme,
  themeToCanvasVisualTokens,
  themeToCssVariables,
  themeToMermaidThemeVariables,
  themeToTerminalTheme
} from "@/features/mermaid-editor/lib/editor-theme";

describe("editor theme", () => {
  it("loads built-in themes from theme files", () => {
    const ids = BUILT_IN_EDITOR_THEME_CATALOG.map((entry) => entry.id);

    expect(ids).toContain("warm-paper");
    expect(ids).toContain("minimal-mono");
    expect(ids).toContain("rational-minimal");
    expect(ids).toContain("claude-cream");
    expect(ids).toContain("kitty-dexpota-dracula");
    expect(ids).toContain("kitty-kovidgoyal-dracula");
    expect(new Set(ids).size).toBe(ids.length);
    expect(BUILT_IN_EDITOR_THEMES).toHaveLength(BUILT_IN_EDITOR_THEME_CATALOG.length);
    expect(isBuiltInThemeId("kitty-kovidgoyal-dracula")).toBe(true);
    expect(isBuiltInThemeId("custom")).toBe(false);
  });

  it("loads the Claude Cream Chinese adaptation with sans body, serif headings and restrained chrome", () => {
    const entry = BUILT_IN_EDITOR_THEME_CATALOG.find((candidate) => candidate.id === "claude-cream");
    const theme = resolveEditorTheme("claude-cream", null);
    const compiled = compileEditorTheme(theme);

    expect(entry).toMatchObject({
      name: "Claude 奶油纸",
      mode: "light",
      source: {
        id: "tttnny",
        license: "MIT",
        commit: "1d0a01625994174691f2cb69d0b28d0faf75f8d2"
      }
    });
    expect(theme.interface.colors).toMatchObject({
      background: "#faf9f5",
      foreground: "#141413",
      primary: "#a94f2d",
      border: "#e4e3df"
    });
    expect(theme.interface.surface).toMatchObject({ borderWidth: 0.5, dividerWidth: 0.5 });
    expect(theme.interface.shadow.panel.opacity).toBe(0.08);
    expect(theme.markdown.body).toMatchObject({
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 26.4,
      paragraphSpacing: 12,
      color: "#141413"
    });
    expect(theme.markdown.body.fontFamily).toContain("Noto Sans SC Variable");
    expect(theme.markdown.body.fontFamily).not.toContain("方正屏显雅宋简体");
    expect(theme.markdown.heading.h1).toMatchObject({ fontSize: 24, lineHeight: 27.2, marginTop: 32, marginBottom: 12 });
    expect(theme.markdown.heading.h6).toMatchObject({ fontSize: 14, lineHeight: 20, fontWeight: 600 });
    expect(theme.markdown.layout.headingStackSpacing).toBe(8);
    expect(theme.markdown.list.unordered).toMatchObject({ marginTop: 12, marginBottom: 16, itemSpacing: 4, nestedSpacing: 8 });
    expect(theme.markdown.blockquote).toMatchObject({ marginTop: 16, marginBottom: 16 });
    expect(theme.markdown.codeBlock).toMatchObject({ marginTop: 16, marginBottom: 16 });
    expect(theme.markdown.table).toMatchObject({ marginTop: 16, marginBottom: 24 });
    expect(theme.markdown.divider).toMatchObject({ marginTop: 32, marginBottom: 32 });
    expect(theme.markdown.image).toMatchObject({ marginTop: 16, marginBottom: 16 });
    expect(theme.markdown.link).toMatchObject({ color: "#d97757", hoverColor: "#a94f2d", underlineOffset: 4 });
    expect(theme.markdown.list.task).toMatchObject({ indent: 16, checkboxSize: 13, checkboxRadius: 2 });
    expect(theme.markdown.codeBlock).toMatchObject({ background: "#f1f0ec", paddingX: 16, paddingY: 16, radius: 8 });
    expect(theme.markdown.codeBlock.fontFamily).toContain("Maple Mono");
    expect(theme.typography.interface.body.family).toContain("Noto Sans SC Variable");
    expect(theme.typography.interface.body.family).not.toContain("上图东观体");
    expect(theme.markdown.heading.h1.fontFamily).toContain("方正屏显雅宋简体");
    expect(theme.markdown.heading.h1.fontFamily).not.toContain("上图东观体");
    expect(theme.typography.markdownCard.title.family).toContain("方正屏显雅宋简体");
    expect(theme.typography.markdownCard.excerpt.family).toContain("Noto Sans SC Variable");
    expect(theme.typography.source.editor.family).toContain("Maple Mono");
    expect(theme.typography.terminal.heading.family).toContain("Noto Sans SC Variable");
    expect(compiled.cssVariables["--markdown-body-line-height"]).toBe("26.4px");
    expect(compiled.cssVariables["--markdown-link-color"]).toBe("#d97757");
    expect(compiled.cssVariables["--markdown-table-body-background"]).toBe("#faf9f5");
    expect(compiled.cssVariables["--markdown-table-alternate-background"]).toBeUndefined();
    expect(compiled.cssVariables["--markdown-task-list-marker-color"]).toBeUndefined();
    expect(compiled.diagnostics).toEqual([]);
  });

  it("loads the persisted Warm Paper v11 appearance snapshot", () => {
    const theme = resolveEditorTheme("warm-paper", null);
    const compiled = compileEditorTheme(theme);

    expect(theme.interface.colors).toMatchObject({
      background: "#f8f3ec",
      foreground: "#18130f",
      primary: "#ff4050"
    });
    expect(theme.typography.interface.body.family).toContain("Noto Sans SC Variable");
    expect(theme.typography.canvas.node).toMatchObject({ fontWeight: 500 });
    expect(theme.typography.canvas.node.family).toContain("方正屏显雅宋简体");
    expect(theme.typography.linkCard.title.family).toContain("Noto Sans SC Variable");
    expect(theme.markdown.body.fontFamily).toContain("方正屏显雅宋简体");
    expect(theme.markdown.heading.h1.fontFamily).toContain("方正屏显雅宋简体");
    expect(theme.canvas.ordinaryNode).toMatchObject({ borderWidth: 0, radius: 0, forkRadius: 4 });
    expect(theme.canvas.edge).toMatchObject({ width: 1, pointerLength: 6, pointerWidth: 6, curveSegments: 120 });
    expect(theme.canvas.group).toMatchObject({ borderStyle: "solid", borderWidth: 1, radius: 0 });
    expect(theme.specialNode.linkCard.surface.radius).toBe(0);
    expect(theme.specialNode.markdownDocument.surface).toMatchObject({ radius: 0, border: { width: 0 } });
    expect(theme.markdown.list.unordered.indent).toBe(16);
    expect(theme.markdown.list.ordered.indent).toBe(16);
    expect(theme.markdown.list.task.indent).toBe(16);
    expect(theme.markdown.codeBlock.fontFamily).toContain("Maple Mono");
    expect(theme.typography.markdownCard.title.family).toContain("方正屏显雅宋简体");
    expect(theme.typography.markdownCard.excerpt.family).toContain("Noto Sans SC Variable");
    expect(theme.typography.canvasDocument.card.family).toContain("方正屏显雅宋简体");
    expect(theme.typography.canvasDocument.shape.family).toContain("Noto Sans SC Variable");
    expect(theme.motion.canvas.proximityMaxScale).toBe(1);
    expect(compiled.cssVariables["--markdown-body-line-height"]).toBe("26.4px");
    expect(compiled.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "ANSI_WHITE_CONTRAST",
      "ANSI_BRIGHTWHITE_CONTRAST"
    ]);
  });

  it("migrates saved v9 Warm Paper font roles without overwriting unrelated custom settings", () => {
    const legacy = structuredClone(resolveEditorTheme("warm-paper", null)) as unknown as {
      version: number;
      id: string;
      baseThemeId: string;
      markdown: { body: { fontFamily: string }; heading: Record<string, { fontFamily: string }> };
      typography: { markdownCard: { excerpt: { family: string } } };
    };
    const legacySans =
      '"Noto Sans SC Variable", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    const founderSerif = '"方正屏显雅宋简体", "Songti SC", "Noto Serif SC", serif';

    legacy.version = 9;
    legacy.id = "custom";
    legacy.baseThemeId = "warm-paper";
    legacy.markdown.body.fontFamily = legacySans;
    for (const heading of Object.values(legacy.markdown.heading)) heading.fontFamily = legacySans;
    legacy.typography.markdownCard.excerpt.family = founderSerif;

    const theme = normalizeEditorTheme(legacy);

    expect(theme.version).toBe(11);
    expect(theme.id).toBe("custom");
    expect(theme.markdown.body.fontFamily).toBe(legacySans);
    expect(theme.markdown.heading.h1.fontFamily).toBe(founderSerif);
    expect(theme.typography.markdownCard.excerpt.family).toBe(legacySans);
  });

  it("migrates saved v9 Claude serif roles from Shangtu to Founder serif", () => {
    const legacy = structuredClone(resolveEditorTheme("claude-cream", null)) as unknown as {
      version: number;
      id: string;
      baseThemeId: string;
      markdown: { heading: Record<string, { fontFamily: string }> };
      typography: {
        markdownCard: { title: { family: string }; titleEditor: { family: string } };
        canvasDocument: { card: { family: string }; cardEditor: { family: string } };
      };
    };
    const shangtu = '"上图东观体", "Noto Sans SC Variable", "Noto Sans SC", system-ui, sans-serif';
    const founderSerif = '"方正屏显雅宋简体", "Songti SC", "Noto Serif SC", serif';

    legacy.version = 9;
    legacy.id = "custom";
    legacy.baseThemeId = "claude-cream";
    for (const heading of Object.values(legacy.markdown.heading)) heading.fontFamily = shangtu;
    legacy.typography.markdownCard.title.family = shangtu;
    legacy.typography.markdownCard.titleEditor.family = shangtu;
    legacy.typography.canvasDocument.card.family = shangtu;
    legacy.typography.canvasDocument.cardEditor.family = shangtu;

    const theme = normalizeEditorTheme(legacy);

    expect(theme.version).toBe(11);
    expect(theme.markdown.heading.h1.fontFamily).toBe(founderSerif);
    expect(theme.typography.markdownCard.title.family).toBe(founderSerif);
    expect(theme.typography.canvasDocument.card.family).toBe(founderSerif);
  });

  it("loads minimal monochrome theme with grayscale application colors", () => {
    const theme = resolveEditorTheme("minimal-mono", null);
    const compiled = compileEditorTheme(theme);
    const appGrayscaleColors = collectHexColors({ interface: theme.interface, canvas: theme.canvas, source: theme.source });
    const terminalPaletteColors = [...Object.values(theme.terminal), ...Object.values(theme.ansi)];

    expect(theme.name).toBe("极简黑白");
    expect(theme.interface.colors.primary).toBe("#111111");
    expect(theme.interface.colors.accent).toBe("#eeeeee");
    expect(appGrayscaleColors.filter((color) => !isGrayscaleHexColor(color))).toEqual([]);
    expect(terminalPaletteColors.some((color) => !isGrayscaleHexColor(color))).toBe(true);
    expect(compiled.diagnostics).toEqual([]);
  });

  it("loads rational minimal theme with strict grayscale and square geometry", () => {
    const theme = resolveEditorTheme("rational-minimal", null);
    const compiled = compileEditorTheme(theme);
    const markdownRadii = [
      theme.markdown.blockquote.radius,
      theme.markdown.inlineCode.radius,
      theme.markdown.codeBlock.radius,
      theme.markdown.table.radius,
      theme.markdown.image.radius,
      theme.markdown.list.task.checkboxRadius
    ];

    expect(theme.name).toBe("理性极简");
    expect(collectHexColors({ interface: theme.interface, canvas: theme.canvas, specialNode: theme.specialNode, source: theme.source, markdown: theme.markdown, ansi: theme.ansi, terminal: theme.terminal }).filter((color) => !isGrayscaleHexColor(color))).toEqual([]);
    expect(theme.canvas.ordinaryNode).toMatchObject({ fillSaturation: 0, fillLuminanceSteps: 2, dragShadow: { opacity: 0 } });
    expect(Object.values(theme.interface.radius)).toEqual([0, 0, 0, 0]);
    expect([
      theme.canvas.ordinaryNode.radius,
      theme.canvas.ordinaryNode.roundedRadius,
      theme.canvas.ordinaryNode.polygonRadius,
      theme.canvas.ordinaryNode.forkRadius,
      theme.canvas.edgeLabel.radius,
      theme.canvas.group.radius,
      theme.canvas.group.title.radius
    ]).toEqual(Array(7).fill(0));
    expect(markdownRadii).toEqual([0, 0, 0, 0, 0, 0]);
    expect(theme.canvas.ordinaryNode.borderWidth).toBe(0);
    expect(theme.canvas.ordinaryNode.emphasizedBorderWidth).toBe(1);
    expect(theme.canvas.edge.width).toBe(1);
    expect(theme.canvas.edge.thickWidth).toBe(2);
    expect(theme.canvas.overlay.selection.strokeWidth).toBe(0.5);
    expect(theme.canvas.group.customDash).toEqual([]);
    expect(theme.interface.surface).toEqual({
      borderWidth: 0.5,
      borderStyle: "solid",
      dividerWidth: 0.5,
      focusRingWidth: 1,
      opacity: 1,
      backdropBlur: 0
    });
    expect(theme.interface.shadow.panel.opacity).toBe(0);
    expect(compiled.cssVariables["--radius"]).toBe("0px");
    expect(compiled.cssVariables["--theme-canvas-node-fill-saturation"]).toBe("0");
    expect(compiled.cssVariables["--theme-canvas-node-fill-luminance-steps"]).toBe("2");
    expect(compiled.cssVariables["--theme-canvas-preview-shadow-opacity"]).toBe("0");
    expect(compiled.cssVariables["--ui-border-width"]).toBe("0.5px");
    expect(compiled.cssVariables["--ui-backdrop-blur"]).toBe("0px");
    expect(compiled.cssVariables["--ui-shadow-opacity"]).toBe("0");
    expect([
      compiled.cssVariables["--theme-radius-app"],
      compiled.cssVariables["--theme-radius-control-sm"],
      compiled.cssVariables["--theme-radius-control-md"],
      compiled.cssVariables["--theme-radius-control-lg"],
      compiled.cssVariables["--theme-radius-canvas-node"],
      compiled.cssVariables["--theme-radius-edge-label"],
      compiled.cssVariables["--theme-radius-polygon-corner"],
      compiled.cssVariables["--theme-radius-subgraph-title"]
    ]).toEqual(Array(8).fill("0px"));
    expect(compiled.canvasVisualTokens.ordinaryNode.roundedRadius).toBe(0);
    expect(compiled.canvasVisualTokens.ordinaryNode.borderWidth).toBe(0);
    expect(compiled.canvasVisualTokens.ordinaryNode.emphasizedBorderWidth).toBe(1);
    expect(compiled.canvasVisualTokens.ordinaryNode.fillSaturation).toBe(0);
    expect(compiled.canvasVisualTokens.ordinaryNode.fillLuminanceSteps).toBe(2);
    expect(compiled.canvasVisualTokens.ordinaryNode.dragShadow.opacity).toBe(0);
    expect(compiled.canvasVisualTokens.edge.width).toBe(1);
    expect(compiled.canvasVisualTokens.edge.thickWidth).toBe(2);
    expect(compiled.canvasVisualTokens.edge.pointerLength).toBe(8);
    expect(compiled.canvasVisualTokens.edge.pointerWidth).toBe(7);
    expect(compiled.canvasVisualTokens.edge.curveSegments).toBe(120);
    expect(compiled.canvasVisualTokens.overlay.selection.strokeWidth).toBe(0.5);
    expect(compiled.canvasVisualTokens.group.customDash).toEqual([]);
    expect(compiled.canvasVisualTokens.edgeLabel.radius).toBe(0);
    expect(compiled.canvasVisualTokens.ordinaryNode.polygonRadius).toBe(0);
    expect(compiled.canvasVisualTokens.group.title.radius).toBe(0);
    expect(compiled.diagnostics).toEqual([]);
  });

  it("resolves built-in themes and normalizes custom colors", () => {
    expect(resolveEditorTheme("warm-paper", null)).toBe(DEFAULT_EDITOR_THEME);

    const customTheme = resolveEditorTheme("custom", {
      name: "自定义",
      interface: {
        colors: {
          primary: "#123456",
          icon: "bad-color"
        }
      },
      canvas: {
        surface: {},
        edge: { color: "#abcdef" }
      },
      source: {
        line: "#111111"
      },
      ansi: {
        red: "#cc0000"
      },
      terminal: {
        background: "#ffffff"
      }
    });

    expect(customTheme).toMatchObject({
      id: "custom",
      name: "自定义",
      interface: {
        colors: {
          primary: "#123456",
          icon: DEFAULT_EDITOR_THEME.interface.colors.icon
        }
      },
      canvas: {
        edge: { color: "#abcdef" }
      },
      source: {
        line: "#111111"
      },
      ansi: {
        red: "#cc0000"
      },
      terminal: {
        background: "#ffffff"
      }
    });
  });

  it("converts kitty theme files to complete editor themes", () => {
    const dracula = resolveEditorTheme("kitty-kovidgoyal-dracula", null);
    const terminalTheme = themeToTerminalTheme(dracula);

    expect(dracula.name).toBe("Dracula");
    expect(dracula.terminal.background).toBe("#282a36");
    expect(dracula.terminal.foreground).toBe("#f8f8f2");
    expect(dracula.ansi.black).toBe("#21222c");
    expect(dracula.ansi.brightBlue).toBe("#d6acff");
    expect(terminalTheme.selectionBackground).toContain("rgba");
    expect(compileEditorTheme(dracula).mermaidThemeVariables.primaryColor).toBe(dracula.canvas.mermaidSvg.primaryColor);
  });

  it("maps theme colors to shadcn css variables", () => {
    const variables = themeToCssVariables(DEFAULT_EDITOR_THEME);

    expect(variables["--background"]).toBeDefined();
    expect(variables["--icon"]).toBeDefined();
    expect(variables["--primary"]).toBeDefined();
    expect(variables["--source-line"]).toBeDefined();
    expect(variables["--terminal-background"]).toBeDefined();
    expect(variables["--ansi-bright-red"]).toBeDefined();
    expect(variables["--markdown-body-color"]).toBe(DEFAULT_EDITOR_THEME.markdown.body.color);
    expect(variables["--markdown-heading-stack-spacing"]).toBe("8px");
    expect(variables["--markdown-h1-font-size"]).toBe(`${DEFAULT_EDITOR_THEME.markdown.heading.h1.fontSize}px`);
    expect(variables["--markdown-code-block-background"]).toBe(DEFAULT_EDITOR_THEME.markdown.codeBlock.background);
    expect(variables["--markdown-code-block-margin-top"]).toBe("16px");
    expect(variables["--markdown-code-block-margin-bottom"]).toBe("16px");
    expect(variables["--markdown-table-border-color"]).toBe(DEFAULT_EDITOR_THEME.markdown.table.borderColor);
    expect(variables["--markdown-table-body-background"]).toBe(DEFAULT_EDITOR_THEME.markdown.table.bodyBackground);
    expect(variables["--markdown-unordered-list-nested-spacing"]).toBe("8px");
    expect(variables["--markdown-code-block-margin-y"]).toBeUndefined();
    expect(variables["--markdown-unordered-list-block-spacing"]).toBeUndefined();
    expect(variables["--primary-foreground"]).toBe(variables["--background"]);
    expect(variables["--ui-border-width"]).toBe(`${DEFAULT_EDITOR_THEME.interface.surface.borderWidth}px`);
    expect(variables["--ui-control-height-md"]).toBe(`${DEFAULT_EDITOR_THEME.interface.icon.buttonHeightMd}px`);
  });

  it("defines a complete default Markdown vertical rhythm", () => {
    const markdown = createDefaultMarkdownTheme({
      interface: DEFAULT_EDITOR_THEME.interface,
      typography: DEFAULT_EDITOR_THEME.typography
    });

    expect(markdown.layout.headingStackSpacing).toBe(8);
    expect(markdown.body.paragraphSpacing).toBe(16);
    expect(Object.fromEntries(Object.entries(markdown.heading).map(([level, heading]) => [
      level,
      [heading.marginTop, heading.marginBottom]
    ]))).toEqual({
      h1: [32, 12],
      h2: [28, 10],
      h3: [24, 8],
      h4: [20, 6],
      h5: [16, 4],
      h6: [16, 4]
    });
    expect(markdown.list.unordered).toMatchObject({ marginTop: 12, marginBottom: 16, itemSpacing: 4, nestedSpacing: 8 });
    expect(markdown.list.ordered).toMatchObject({ marginTop: 12, marginBottom: 16, itemSpacing: 4, nestedSpacing: 8 });
    expect(markdown.list.task).toMatchObject({ marginTop: 12, marginBottom: 16, itemSpacing: 4, nestedSpacing: 8 });
    expect(markdown.blockquote).toMatchObject({ marginTop: 16, marginBottom: 16 });
    expect(markdown.codeBlock).toMatchObject({ marginTop: 16, marginBottom: 16 });
    expect(markdown.table).toMatchObject({ marginTop: 16, marginBottom: 16 });
    expect(markdown.divider).toMatchObject({ marginTop: 32, marginBottom: 32 });
    expect(markdown.image).toMatchObject({ marginTop: 16, marginBottom: 16 });
  });

  it("derives Markdown defaults from each built-in theme palette", () => {
    const dracula = resolveEditorTheme("kitty-kovidgoyal-dracula", null);

    expect(dracula.version).toBe(11);
    expect(dracula.markdown.body.color).toBe(dracula.interface.colors.foreground);
    expect(dracula.markdown.heading.h1.color).toBe(dracula.interface.colors.foreground);
    expect(dracula.markdown.link.color).toBe(dracula.interface.colors.primary);
    expect(dracula.markdown.codeBlock.background).toBe(dracula.interface.colors.card);
    expect(dracula.markdown.codeBlock.fontFamily).toBe(dracula.typography.source.editor.family);
    expect(dracula.markdown.body.color).not.toBe(DEFAULT_EDITOR_THEME.markdown.body.color);
    expectNoLegacyMarkdownFields(dracula);
  });

  it.each([4, 5, 6, 7, 8, 9, 10])("migrates v%s themes into a clean v11 Markdown shape", (version) => {
    const theme = normalizeEditorTheme({
      version,
      ui: {
        foreground: "#f0f0f0",
        primary: "#44aaff",
        card: "#202020",
        muted: "#303030",
        mutedForeground: "#aaaaaa",
        accentForeground: "#88ccff",
        destructive: "#ff6677",
        border: "#505050"
      },
      font: {
        familySans: "Example Sans",
        familyMono: "Example Mono"
      }
    });

    expect(theme.version).toBe(11);
    expect(theme.markdown.body).toMatchObject({ color: "#f0f0f0", fontFamily: "Example Sans" });
    expect(theme.markdown.link.color).toBe("#44aaff");
    expect(theme.markdown.codeBlock).toMatchObject({ background: "#202020", fontFamily: "Example Mono" });
    expect(theme.markdown.inlineCode).toMatchObject({ background: "#303030", fontFamily: "Example Mono" });
    expect(theme.markdown.heading.h1.fontFamily).toBe("Example Sans");
    expectNoLegacyMarkdownFields(theme);
  });

  it("migrates v5 typography into independent v6 roles", () => {
    const theme = normalizeEditorTheme({
      version: 5,
      font: {
        familySans: "Legacy Sans, sans-serif",
        familyMono: "Legacy Mono, monospace",
        sizeNode: 19,
        sizeSource: 15,
        lineHeightSource: 32
      }
    });

    expect(theme.version).toBe(11);
    expect(theme.typography.canvas.node).toMatchObject({ family: "Legacy Sans, sans-serif", fontSize: 19 });
    expect(theme.typography.source.editor).toMatchObject({ family: "Legacy Mono, monospace", fontSize: 15, lineHeight: 32 });
    expect(theme.typography.terminal.content.family).toBe("Legacy Mono, monospace");
    expect(theme.typography.linkCard.title.family).toBe("Legacy Sans, sans-serif");
  });

  it("migrates v8 special nodes and table rows into the canonical v11 shape", () => {
    const theme = normalizeEditorTheme({
      version: 8,
      ui: {
        card: "#102030",
        primary: "#405060",
        accent: "#506070",
        muted: "#203040",
        mutedForeground: "#a0a0a0",
        border: "#607080"
      },
      canvas: {
        nodeStroke: "#708090",
        nodeText: "#f0f0f0",
        labelStroke: "#8090a0",
        connectionInvalid: "#aa3344"
      },
      markdown: {
        table: {
          alternateBackground: "#112233"
        }
      }
    });

    expect(theme.version).toBe(11);
    expect(theme.markdown.table.bodyBackground).toBe("#112233");
    expect(theme.markdown.list.unordered.indent).toBe(16);
    expect(theme.specialNode.shared).toMatchObject({
      textColor: "#f0f0f0",
      accentColor: "#405060"
    });
    expect(theme.specialNode.linkCard.surface).toMatchObject({
      background: "#102030",
      border: { color: "#708090" }
    });
    expect(theme.specialNode.table).toMatchObject({
      surface: { background: "#102030", border: { color: "#607080" } },
      selectedCellBackground: "#506070",
      selectedCellBorder: { color: "#405060" }
    });
    expect(theme.typography.tableNode.cell).toMatchObject({ fontSize: 13, fontWeight: 400, lineHeight: 18, letterSpacing: 0 });
    expect(theme.typography.tableNode.cell.family).toContain("Noto Sans SC Variable");
    expect(compileEditorTheme(theme).specialNode).toEqual(theme.specialNode);
  });

  it("normalizes independently editable special-node and table typography tokens", () => {
    const theme = normalizeEditorTheme({
      specialNode: {
        linkCard: { surface: { shadow: { opacity: 2 }, radius: -4 } },
        table: { selectedCellBackground: "#123456", minColumnWidth: 10, resizeHandleWidth: 80 }
      },
      typography: {
        tableNode: {
          cell: { family: '"Example Sans", sans-serif', fontSize: 15, fontWeight: 500, lineHeight: 21, letterSpacing: 0.2 }
        }
      }
    });

    expect(theme.specialNode.linkCard.surface.shadow.opacity).toBe(1);
    expect(theme.specialNode.linkCard.surface.radius).toBe(0);
    expect(theme.specialNode.table).toMatchObject({ selectedCellBackground: "#123456", minColumnWidth: 24, resizeHandleWidth: 32 });
    expect(theme.typography.tableNode.cell).toEqual({
      family: '"Example Sans", sans-serif',
      fontSize: 15,
      fontWeight: 500,
      lineHeight: 21,
      letterSpacing: 0.2
    });
  });

  it("updates one typography role without coupling its neighbors", () => {
    const theme = normalizeEditorTheme({
      typography: {
        linkCard: {
          title: {
            family: '"Example Display", sans-serif',
            fontSize: 17,
            fontWeight: 600,
            lineHeight: 23,
            letterSpacing: 0.4
          }
        }
      }
    });
    const compiled = compileEditorTheme(theme);

    expect(theme.typography.linkCard.title).toEqual({
      family: '"Example Display", sans-serif',
      fontSize: 17,
      fontWeight: 600,
      lineHeight: 23,
      letterSpacing: 0.4
    });
    expect(theme.typography.linkCard.titleEditor).toEqual(DEFAULT_EDITOR_THEME.typography.linkCard.titleEditor);
    expect(theme.typography.canvas.node).toEqual(DEFAULT_EDITOR_THEME.typography.canvas.node);
    expect(compiled.cssVariables["--type-link-card-title-family"]).toBe('"Example Display", sans-serif');
    expect(compiled.cssVariables["--type-link-card-title-size"]).toBe("17px");
  });

  it("gives v8 element tokens precedence and never emits compatibility copies", () => {
    const theme = normalizeEditorTheme({
      version: 8,
      markdown: {
        body: {
          fontFamily: '"Editorial Sans", sans-serif',
          fontSize: 18,
          fontWeight: 450,
          lineHeight: 29,
          letterSpacing: 0.2,
          color: "#123456"
        },
        typography: {
          body: {
            family: "Embedded Legacy Sans",
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 19,
            letterSpacing: 0
          }
        }
      },
      typography: {
        markdown: {
          body: {
            family: "Legacy Markdown Sans",
            fontSize: 12,
            fontWeight: 300,
            lineHeight: 18,
            letterSpacing: 0
          }
        }
      }
    });
    const variables = themeToCssVariables(theme);

    expect(theme.markdown.body).toMatchObject({
      fontFamily: '"Editorial Sans", sans-serif',
      fontSize: 18,
      fontWeight: 450,
      lineHeight: 29,
      letterSpacing: 0.2,
      color: "#123456"
    });
    expect(variables["--markdown-body-font-size"]).toBe("18px");
    expect(variables["--markdown-font-body"]).toBe('"Editorial Sans", sans-serif');
    expectNoLegacyMarkdownFields(theme);
  });

  it("migrates v7 typography with embedded Markdown roles taking precedence", () => {
    const theme = normalizeEditorTheme({
      version: 7,
      markdown: {
        font: { familyCode: '"Oldest Code", monospace' },
        codeBlock: { fontSize: 13, lineHeight: 19 },
        typography: {
          codeBlock: {
            family: '"Embedded Code", monospace',
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 25,
            letterSpacing: 0.2
          }
        }
      },
      typography: {
        markdown: {
          codeBlock: {
            family: '"Global Legacy Code", monospace',
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 24,
            letterSpacing: 0.1
          }
        }
      }
    });

    expect(theme.markdown.codeBlock).toMatchObject({
      fontFamily: '"Embedded Code", monospace',
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 25,
      letterSpacing: 0.2
    });
    expectNoLegacyMarkdownFields(theme);
  });

  it.each([4, 5, 6, 7])("applies v8 precedence per Markdown element when migrating mixed v%s fields", (version) => {
    const theme = normalizeEditorTheme({
      version,
      markdown: {
        body: {
          fontFamily: '"Canonical Body", sans-serif',
          fontSize: 21,
          color: "#123456"
        },
        heading: {
          h1: {
            fontSize: 63,
            color: "#654321"
          }
        },
        typography: {
          body: {
            family: '"Embedded Body", sans-serif',
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 19,
            letterSpacing: 0
          },
          h1: {
            family: '"Embedded Heading", serif',
            fontSize: 35,
            fontWeight: 600,
            lineHeight: 43,
            letterSpacing: 0.4
          }
        }
      }
    });

    expect(theme.markdown.body).toMatchObject({
      fontFamily: '"Canonical Body", sans-serif',
      fontSize: 21,
      color: "#123456"
    });
    expect(theme.markdown.heading.h1).toMatchObject({
      fontFamily: '"Embedded Heading", serif',
      fontSize: 35,
      fontWeight: 600,
      lineHeight: 43,
      letterSpacing: 0.4,
      color: "#654321"
    });
    expectNoLegacyMarkdownFields(theme);
  });

  it("normalizes complete Markdown style tokens", () => {
    const theme = normalizeEditorTheme({
      version: 8,
      markdown: {
        layout: {
          headingStackSpacing: 80
        },
        body: {
          color: "#123456",
          fontSize: 99,
          lineHeight: 36,
          paragraphSpacing: -4
        },
        heading: {
          h1: {
            color: "#654321",
            fontSize: 64,
            fontWeight: 875,
            marginTop: 120
          }
        },
        blockquote: {
          borderWidth: 20,
          marginTop: 80,
          marginBottom: -4,
          radius: 12
        },
        strikethrough: {
          decorationThickness: 99
        },
        list: {
          unordered: {
            marginTop: -2,
            marginBottom: 80,
            nestedSpacing: 80
          },
          task: {
            checkboxSize: 99,
            checkboxBorderWidth: -2,
            checkboxRadius: 99
          }
        },
        table: {
          borderColor: "#abcdef",
          cellPaddingX: 24
        },
        image: {
          borderWidth: 3,
          radius: 18
        }
      }
    });

    expect(theme.markdown.body.color).toBe("#123456");
    expect(theme.markdown.layout.headingStackSpacing).toBe(48);
    expect(theme.markdown.body.fontSize).toBe(96);
    expect(theme.markdown.body.lineHeight).toBe(36);
    expect(theme.markdown.body.paragraphSpacing).toBe(0);
    expect(theme.markdown.heading.h1.color).toBe("#654321");
    expect(theme.markdown.heading.h1.fontSize).toBe(64);
    expect(theme.markdown.heading.h1.fontWeight).toBe(875);
    expect(theme.markdown.heading.h1.marginTop).toBe(96);
    expect(theme.markdown.heading.h2).toEqual(createDefaultMarkdownTheme({ interface: theme.interface, typography: theme.typography }).heading.h2);
    expect(theme.markdown.blockquote.borderWidth).toBe(12);
    expect(theme.markdown.blockquote.marginTop).toBe(48);
    expect(theme.markdown.blockquote.marginBottom).toBe(0);
    expect(theme.markdown.blockquote.radius).toBe(12);
    expect(theme.markdown.strikethrough.decorationThickness).toBe(6);
    expect(theme.markdown.list.task.checkboxSize).toBe(32);
    expect(theme.markdown.list.task.checkboxBorderWidth).toBe(0);
    expect(theme.markdown.list.task.checkboxRadius).toBe(12);
    expect(theme.markdown.list.unordered).toMatchObject({ marginTop: 0, marginBottom: 48, nestedSpacing: 32 });
    expect(theme.markdown.table.borderColor).toBe("#abcdef");
    expect(theme.markdown.table.cellPaddingX).toBe(24);
    expect(theme.markdown.image.borderWidth).toBe(3);
    expect(theme.markdown.image.radius).toBe(18);
  });

  it("migrates legacy v11 Markdown vertical spacing aliases without losing asymmetric canonical values", () => {
    const theme = normalizeEditorTheme({
      version: 11,
      markdown: {
        list: {
          unordered: { blockSpacing: 9 },
          ordered: { blockSpacing: 7, marginTop: 5 },
          task: { blockSpacing: 11, marginBottom: 13 }
        },
        blockquote: { marginY: 6 },
        codeBlock: { marginY: 10, marginBottom: 14 },
        table: { marginY: 12 },
        divider: { marginY: 20 },
        image: { marginY: 15 }
      }
    });

    expect(theme.markdown.list.unordered).toMatchObject({ marginTop: 9, marginBottom: 9, nestedSpacing: 8 });
    expect(theme.markdown.list.ordered).toMatchObject({ marginTop: 5, marginBottom: 7, nestedSpacing: 8 });
    expect(theme.markdown.list.task).toMatchObject({ marginTop: 11, marginBottom: 13, nestedSpacing: 8 });
    expect(theme.markdown.blockquote).toMatchObject({ marginTop: 6, marginBottom: 6 });
    expect(theme.markdown.codeBlock).toMatchObject({ marginTop: 10, marginBottom: 14 });
    expect(theme.markdown.table).toMatchObject({ marginTop: 12, marginBottom: 12 });
    expect(theme.markdown.divider).toMatchObject({ marginTop: 20, marginBottom: 20 });
    expect(theme.markdown.image).toMatchObject({ marginTop: 15, marginBottom: 15 });
    expect(theme.markdown.list.unordered).not.toHaveProperty("blockSpacing");
    expect(theme.markdown.blockquote).not.toHaveProperty("marginY");
  });

  it("migrates pre-v8 flat list and quote spacing aliases into the canonical model", () => {
    const theme = normalizeEditorTheme({
      version: 7,
      markdown: {
        list: { blockSpacing: 7 },
        quote: { marginY: 9 },
        codeBlock: { marginY: 11 }
      }
    });

    expect(theme.markdown.list.unordered).toMatchObject({ marginTop: 7, marginBottom: 7, nestedSpacing: 8 });
    expect(theme.markdown.list.ordered).toMatchObject({ marginTop: 7, marginBottom: 7, nestedSpacing: 8 });
    expect(theme.markdown.list.task).toMatchObject({ marginTop: 7, marginBottom: 7, nestedSpacing: 8 });
    expect(theme.markdown.blockquote).toMatchObject({ marginTop: 9, marginBottom: 9 });
    expect(theme.markdown.codeBlock).toMatchObject({ marginTop: 11, marginBottom: 11 });
  });

  it("maps custom colors to canvas and Mermaid render tokens", () => {
    const theme = normalizeEditorTheme({
      interface: {
        colors: {
          primary: "#112233"
        }
      },
      canvas: {
        surface: { background: "#fefefe", renderBackground: "#fefefe" },
        grid: { color: "#010203" },
        edge: { color: "#010203" },
        ordinaryNode: { borderColor: "#040506", textColor: "#070809", selectedBorderColor: "#112233" },
        mermaidSvg: { primaryColor: "#fefefe", lineColor: "#010203" }
      },
      source: {
        line: "#101112"
      }
    });

    const canvasTokens = themeToCanvasVisualTokens(theme);
    const mermaidVariables = themeToMermaidThemeVariables(theme);

    expect(canvasTokens.ordinaryNode.selectedBorderColor).toBe("#112233");
    expect(canvasTokens.surface.background).toBe("#fefefe");
    expect(canvasTokens.grid.color).toBe("#010203");
    expect(mermaidVariables.primaryColor).toBe("#fefefe");
    expect(mermaidVariables.lineColor).toBe("#010203");
    expect(mermaidVariables.fontFamily).toContain("Noto Sans SC");
  });

  it("normalizes v11 geometry tokens and falls back invalid numbers", () => {
    const theme = normalizeEditorTheme({
      typography: {
        canvas: {
          node: { fontSize: 18, lineHeight: 24 },
          edgeLabel: { fontSize: 15 }
        }
      },
      canvas: {
        surface: {},
        ordinaryNode: { paddingX: 22, paddingY: 18, maxChars: Number.NaN, roundedRadius: 20 },
        edgeLabel: { radius: 10 },
        grid: { minorStep: 32, maxDots: 9000 },
        edge: { hitStrokeWidth: 24, parallelSpacing: 26 }
      }
    });

    const compiled = compileEditorTheme(theme);

    expect(compiled.geometry.node.fontSize).toBe(18);
    expect(compiled.geometry.node.paddingX).toBe(22);
    expect(compiled.geometry.node.maxChars).toBe(DEFAULT_EDITOR_THEME.canvas.ordinaryNode.maxChars);
    expect(compiled.geometry.edgeLabel.fontSize).toBe(15);
    expect(compiled.geometry.grid.minorStep).toBe(32);
    expect(compiled.geometry.grid.maxDots).toBe(9000);
    expect(compiled.canvasVisualTokens.ordinaryNode.roundedRadius).toBe(20);
    expect(compiled.canvasVisualTokens.edge.hitStrokeWidth).toBe(24);
    expect(compiled.canvasVisualTokens.edge.parallelSpacing).toBe(26);
    expect(compiled.canvasVisualTokens.edgeLabel.radius).toBe(10);
  });

  it("normalizes terminal and ANSI theme tokens", () => {
    const theme = normalizeEditorTheme({
      version: 2,
      ansi: {
        green: "#00aa66",
        brightGreen: "bad-color"
      },
      terminal: {
        background: "#101010",
        foreground: "#f5f5f5",
        cursor: "#ff5500"
      },
      typography: {
        terminal: {
          content: { fontSize: 15, lineHeight: 22 }
        }
      }
    });

    const terminalTheme = themeToTerminalTheme(theme);

    expect(theme.version).toBe(11);
    expect(theme.ansi.green).toBe("#00aa66");
    expect(theme.ansi.brightGreen).toBe(DEFAULT_EDITOR_THEME.ansi.brightGreen);
    expect(theme.terminal.background).toBe("#101010");
    expect(theme.terminal.foreground).toBe("#f5f5f5");
    expect(theme.typography.terminal.content.fontSize).toBe(15);
    expect(theme.typography.terminal.content.lineHeight).toBe(22);
    expect(terminalTheme.green).toBe("#00aa66");
    expect(terminalTheme.background).toBe("#101010");
    expect(terminalTheme.selectionInactiveBackground).toContain("rgba");
  });

  it("normalizes motion tokens and exports motion css variables", () => {
    const theme = normalizeEditorTheme({
      version: 3,
      motion: {
        duration: {
          fast: 0.12,
          layout: 9
        },
        ease: {
          standard: "power1.out",
          exit: "bad value ;"
        },
        distance: {
          panel: 48
        },
        stagger: {
          button: 0.04
        },
        canvas: {
          maxAnimatedItems: 120,
          selectedScale: 1.04,
          proximityRadiusPx: 900,
          proximityMaxScale: 1.32,
          proximityDuration: 0.24
        }
      }
    });
    const compiled = compileEditorTheme(theme);

    expect(theme.version).toBe(11);
    expect(theme.motion.duration.fast).toBe(0.12);
    expect(theme.motion.duration.layout).toBe(1.6);
    expect(theme.motion.ease.standard).toBe("power1.out");
    expect(theme.motion.ease.exit).toBe(DEFAULT_EDITOR_THEME.motion.ease.exit);
    expect(theme.motion.distance.panel).toBe(48);
    expect(theme.motion.stagger.button).toBe(0.04);
    expect(theme.motion.canvas.maxAnimatedItems).toBe(120);
    expect(theme.motion.canvas.selectedScale).toBe(1.04);
    expect(theme.motion.canvas.proximityRadiusPx).toBe(600);
    expect(theme.motion.canvas.proximityMaxScale).toBe(1.32);
    expect(theme.motion.canvas.proximityDuration).toBe(0.24);
    expect(compiled.cssVariables["--motion-duration-fast"]).toBe("120ms");
    expect(compiled.cssVariables["--motion-canvas-proximity-radius"]).toBe("600px");
    expect(compiled.cssVariables["--motion-canvas-proximity-scale"]).toBe("1.32");
    expect(compiled.motion.duration.base).toBe(DEFAULT_EDITOR_THEME.motion.duration.base);
  });

  it("normalizes application interface tokens into v11", () => {
    const theme = normalizeEditorTheme({
      interface: {
        surface: {
          borderWidth: 2,
          borderStyle: "dashed",
          dividerWidth: 0,
          focusRingWidth: 2,
          opacity: 0.2,
          backdropBlur: 18
        },
        state: { disabledOpacity: 2 },
        shadow: { panel: { opacity: 0.8 } }
      }
    });

    expect(theme.version).toBe(11);
    expect(theme.interface.surface).toEqual({
      borderWidth: 2,
      borderStyle: "dashed",
      dividerWidth: 0,
      focusRingWidth: 2,
      opacity: 0.2,
      backdropBlur: 18
    });
    expect(theme.interface.state.disabledOpacity).toBe(1);
    expect(theme.interface.shadow.panel.opacity).toBe(0.8);
  });

  it("compiles every runtime adapter from one theme snapshot", () => {
    const compiled = compileEditorTheme(DEFAULT_EDITOR_THEME);

    expect(compiled.cssVariables["--render-background"]).toBeDefined();
    expect(compiled.cssVariables["--theme-source-line-height"]).toBe(`${DEFAULT_EDITOR_THEME.typography.source.editor.lineHeight}px`);
    expect(compiled.canvasVisualTokens.group.customDash).toEqual([...DEFAULT_EDITOR_THEME.canvas.group.customDash]);
    expect(compiled.geometry.subgraph.paddingTop).toBe(DEFAULT_EDITOR_THEME.canvas.group.paddingTop);
    expect(compiled.mermaidThemeVariables.background).toBe(DEFAULT_EDITOR_THEME.canvas.surface.renderBackground);
    expect(compiled.terminalTheme.brightRed).toBe(DEFAULT_EDITOR_THEME.ansi.brightRed);
    expect(compiled.cssVariables["--theme-terminal-line-height"]).toBe(`${DEFAULT_EDITOR_THEME.typography.terminal.content.lineHeight}px`);
    expect(compiled.motion.duration.layout).toBe(DEFAULT_EDITOR_THEME.motion.duration.layout);
    expect(compiled.diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);
  });

  it("compiles every built-in theme without breaking core contrast", () => {
    const blockingDiagnostics = new Set(["APP_TEXT_CONTRAST", "CANVAS_NODE_TEXT_CONTRAST", "TERMINAL_TEXT_CONTRAST"]);

    for (const theme of BUILT_IN_EDITOR_THEMES) {
      const compiled = compileEditorTheme(theme);

      expect(compiled.cssVariables["--background"], theme.id).toBeDefined();
      expect(compiled.terminalTheme.background, theme.id).toBe(theme.terminal.background);
      expect(compiled.diagnostics.filter((diagnostic) => blockingDiagnostics.has(diagnostic.code)), theme.id).toEqual([]);
    }
  });
});

function isGrayscaleHexColor(value: string) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  return !!match && match[1].toLowerCase() === match[2].toLowerCase() && match[2].toLowerCase() === match[3].toLowerCase();
}

function collectHexColors(value: unknown): string[] {
  if (typeof value === "string") return /^#[0-9a-f]{6}$/i.test(value) ? [value] : [];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectHexColors);
}

function expectNoLegacyMarkdownFields(theme: unknown) {
  const source = theme as {
    markdown: Record<string, unknown>;
    typography: Record<string, unknown>;
  };

  expect(source.markdown).not.toHaveProperty("typography");
  expect(source.markdown).not.toHaveProperty("font");
  expect(source.markdown).not.toHaveProperty("quote");
  expect(source.typography).not.toHaveProperty("markdown");
}
