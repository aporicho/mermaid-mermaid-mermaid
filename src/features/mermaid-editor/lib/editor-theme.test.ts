import { describe, expect, it } from "vitest";

import {
  BUILT_IN_EDITOR_THEME_CATALOG,
  BUILT_IN_EDITOR_THEMES,
  compileEditorTheme,
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
    expect(ids).toContain("kitty-dexpota-dracula");
    expect(ids).toContain("kitty-kovidgoyal-dracula");
    expect(new Set(ids).size).toBe(ids.length);
    expect(BUILT_IN_EDITOR_THEMES).toHaveLength(BUILT_IN_EDITOR_THEME_CATALOG.length);
    expect(isBuiltInThemeId("kitty-kovidgoyal-dracula")).toBe(true);
    expect(isBuiltInThemeId("custom")).toBe(false);
  });

  it("loads minimal monochrome theme with grayscale application colors", () => {
    const theme = resolveEditorTheme("minimal-mono", null);
    const compiled = compileEditorTheme(theme);
    const appGrayscaleColors = [
      ...Object.values(theme.ui),
      ...Object.values(theme.canvas),
      ...Object.values(theme.source),
      ...Object.values(theme.render)
    ];
    const terminalPaletteColors = [...Object.values(theme.terminal), ...Object.values(theme.ansi)];

    expect(theme.name).toBe("极简黑白");
    expect(theme.ui.primary).toBe("#111111");
    expect(theme.ui.accent).toBe("#eeeeee");
    expect(appGrayscaleColors.every(isGrayscaleHexColor)).toBe(true);
    expect(terminalPaletteColors.some((color) => !isGrayscaleHexColor(color))).toBe(true);
    expect(compiled.diagnostics).toEqual([]);
  });

  it("loads rational minimal theme with strict grayscale and square geometry", () => {
    const theme = resolveEditorTheme("rational-minimal", null);
    const compiled = compileEditorTheme(theme);
    const markdownRadii = [
      theme.markdown.quote.radius,
      theme.markdown.inlineCode.radius,
      theme.markdown.codeBlock.radius,
      theme.markdown.table.radius,
      theme.markdown.image.radius
    ];

    expect(theme.name).toBe("理性极简");
    expect(collectHexColors(theme).every(isGrayscaleHexColor)).toBe(true);
    expect(theme.canvasAppearance).toEqual({ nodeFillSaturation: 0, nodeFillLuminanceSteps: 2, previewShadowOpacity: 0 });
    expect(Object.values(theme.radius)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(markdownRadii).toEqual([0, 0, 0, 0, 0]);
    expect(theme.stroke.node).toBe(0);
    expect(theme.stroke.nodeEmphasized).toBe(1);
    expect(theme.stroke.edge).toBe(1);
    expect(theme.stroke.edgeThick).toBe(2);
    expect(theme.stroke.overlay).toBe(0.5);
    expect(theme.stroke.subgraphDash).toEqual([]);
    expect(compiled.cssVariables["--radius"]).toBe("0px");
    expect(compiled.cssVariables["--theme-canvas-node-fill-saturation"]).toBe("0");
    expect(compiled.cssVariables["--theme-canvas-node-fill-luminance-steps"]).toBe("2");
    expect(compiled.cssVariables["--theme-canvas-preview-shadow-opacity"]).toBe("0");
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
    expect(compiled.canvasVisualTokens.node.cornerRadius).toBe(0);
    expect(compiled.canvasVisualTokens.node.strokeWidth).toBe(0);
    expect(compiled.canvasVisualTokens.node.emphasizedStrokeWidth).toBe(1);
    expect(compiled.canvasVisualTokens.node.fillSaturation).toBe(0);
    expect(compiled.canvasVisualTokens.node.fillLuminanceSteps).toBe(2);
    expect(compiled.canvasVisualTokens.node.previewShadowOpacity).toBe(0);
    expect(compiled.canvasVisualTokens.edge.strokeWidth).toBe(1);
    expect(compiled.canvasVisualTokens.edge.thickStrokeWidth).toBe(2);
    expect(compiled.canvasVisualTokens.edge.pointerLength).toBe(8);
    expect(compiled.canvasVisualTokens.edge.pointerWidth).toBe(7);
    expect(compiled.canvasVisualTokens.edge.curveSegments).toBe(120);
    expect(compiled.canvasVisualTokens.overlay.strokeWidth).toBe(0.5);
    expect(compiled.canvasVisualTokens.overlay.subgraphDash).toEqual([]);
    expect(compiled.canvasVisualTokens.edge.labelCornerRadius).toBe(0);
    expect(compiled.canvasVisualTokens.shape.polygonCornerRadius).toBe(0);
    expect(compiled.canvasVisualTokens.subgraph.titleCornerRadius).toBe(0);
    expect(compiled.diagnostics).toEqual([]);
  });

  it("resolves built-in themes and normalizes custom colors", () => {
    expect(resolveEditorTheme("warm-paper", null)).toBe(DEFAULT_EDITOR_THEME);

    const customTheme = resolveEditorTheme("custom", {
      name: "自定义",
      ui: {
        primary: "#123456",
        icon: "bad-color"
      },
      canvas: {
        edge: "#abcdef"
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
      ui: {
        primary: "#123456",
        icon: DEFAULT_EDITOR_THEME.ui.icon
      },
      canvas: {
        edge: "#abcdef"
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
    expect(compileEditorTheme(dracula).mermaidThemeVariables.primaryColor).toBe(dracula.canvas.surface);
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
    expect(variables["--markdown-h1-font-size"]).toBe(`${DEFAULT_EDITOR_THEME.markdown.heading.h1.fontSize}px`);
    expect(variables["--markdown-code-block-background"]).toBe(DEFAULT_EDITOR_THEME.markdown.codeBlock.background);
    expect(variables["--markdown-table-border"]).toBe(DEFAULT_EDITOR_THEME.markdown.table.borderColor);
    expect(variables["--primary-foreground"]).toBe(variables["--background"]);
  });

  it("derives Markdown defaults from each built-in theme palette", () => {
    const dracula = resolveEditorTheme("kitty-kovidgoyal-dracula", null);

    expect(dracula.version).toBe(5);
    expect(dracula.markdown.body.color).toBe(dracula.ui.foreground);
    expect(dracula.markdown.heading.h1.color).toBe(dracula.ui.foreground);
    expect(dracula.markdown.link.color).toBe(dracula.ui.primary);
    expect(dracula.markdown.codeBlock.background).toBe(dracula.ui.card);
    expect(dracula.markdown.font.familyCode).toBe(dracula.font.familyMono);
    expect(dracula.markdown.body.color).not.toBe(DEFAULT_EDITOR_THEME.markdown.body.color);
  });

  it("migrates old custom themes to Markdown tokens derived from their normalized colors and fonts", () => {
    const theme = normalizeEditorTheme({
      version: 4,
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

    expect(theme.version).toBe(5);
    expect(theme.markdown.body.color).toBe("#f0f0f0");
    expect(theme.markdown.link.color).toBe("#44aaff");
    expect(theme.markdown.codeBlock.background).toBe("#202020");
    expect(theme.markdown.inlineCode.background).toBe("#303030");
    expect(theme.markdown.font.familyBody).toBe("Example Sans");
    expect(theme.markdown.font.familyHeading).toBe("Example Sans");
    expect(theme.markdown.font.familyCode).toBe("Example Mono");
  });

  it("normalizes complete Markdown style tokens", () => {
    const theme = normalizeEditorTheme({
      markdown: {
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
        quote: {
          borderWidth: 20,
          radius: 12
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
    expect(theme.markdown.body.fontSize).toBe(32);
    expect(theme.markdown.body.lineHeight).toBe(36);
    expect(theme.markdown.body.paragraphSpacing).toBe(0);
    expect(theme.markdown.heading.h1.color).toBe("#654321");
    expect(theme.markdown.heading.h1.fontSize).toBe(64);
    expect(theme.markdown.heading.h1.fontWeight).toBe(875);
    expect(theme.markdown.heading.h1.marginTop).toBe(96);
    expect(theme.markdown.heading.h2).toEqual(DEFAULT_EDITOR_THEME.markdown.heading.h2);
    expect(theme.markdown.quote.borderWidth).toBe(12);
    expect(theme.markdown.quote.radius).toBe(12);
    expect(theme.markdown.table.borderColor).toBe("#abcdef");
    expect(theme.markdown.table.cellPaddingX).toBe(24);
    expect(theme.markdown.image.borderWidth).toBe(3);
    expect(theme.markdown.image.radius).toBe(18);
  });

  it("maps custom colors to canvas and Mermaid render tokens", () => {
    const theme = normalizeEditorTheme({
      ui: {
        primary: "#112233"
      },
      canvas: {
        surface: "#fefefe",
        edge: "#010203",
        nodeStroke: "#040506",
        nodeText: "#070809"
      },
      source: {
        line: "#101112"
      }
    });

    const canvasTokens = themeToCanvasVisualTokens(theme);
    const mermaidVariables = themeToMermaidThemeVariables(theme);

    expect(canvasTokens.colors.connection).toBe("#112233");
    expect(canvasTokens.colors.surface).toBe("#fefefe");
    expect(canvasTokens.colors.gridDotRgb).toBe("1, 2, 3");
    expect(mermaidVariables.primaryColor).toBe("#fefefe");
    expect(mermaidVariables.lineColor).toBe("#010203");
    expect(mermaidVariables.fontFamily).toContain("Noto Sans SC");
  });

  it("normalizes v2 geometry tokens and falls back invalid numbers", () => {
    const theme = normalizeEditorTheme({
      font: {
        sizeNode: 18,
        lineHeightNode: 24
      },
      edgeLabel: {
        fontSize: 15
      },
      space: {
        nodePaddingX: 22,
        nodePaddingY: 18,
        gridMinorStep: 32,
        nodeMaxChars: 999
      },
      radius: {
        canvasNode: 20,
        edgeLabel: 10
      },
      canvasInteraction: {
        edgeHitStrokeWidth: 24,
        parallelEdgeSpacing: 26,
        gridMaxDots: 9000
      }
    });

    const compiled = compileEditorTheme(theme);

    expect(compiled.geometry.node.fontSize).toBe(18);
    expect(compiled.geometry.node.paddingX).toBe(22);
    expect(compiled.geometry.node.maxChars).toBe(60);
    expect(compiled.geometry.edgeLabel.fontSize).toBe(15);
    expect(compiled.geometry.grid.minorStep).toBe(32);
    expect(compiled.geometry.grid.maxDots).toBe(9000);
    expect(compiled.canvasVisualTokens.node.cornerRadius).toBe(20);
    expect(compiled.canvasVisualTokens.edge.hitStrokeWidth).toBe(24);
    expect(compiled.canvasVisualTokens.edge.parallelSpacing).toBe(26);
    expect(compiled.canvasVisualTokens.edge.labelCornerRadius).toBe(10);
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
      font: {
        sizeTerminal: 15,
        lineHeightTerminal: 22
      }
    });

    const terminalTheme = themeToTerminalTheme(theme);

    expect(theme.version).toBe(5);
    expect(theme.ansi.green).toBe("#00aa66");
    expect(theme.ansi.brightGreen).toBe(DEFAULT_EDITOR_THEME.ansi.brightGreen);
    expect(theme.terminal.background).toBe("#101010");
    expect(theme.terminal.foreground).toBe("#f5f5f5");
    expect(theme.font.sizeTerminal).toBe(15);
    expect(theme.font.lineHeightTerminal).toBe(22);
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

    expect(theme.version).toBe(5);
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

  it("compiles every runtime adapter from one theme snapshot", () => {
    const compiled = compileEditorTheme(DEFAULT_EDITOR_THEME);

    expect(compiled.cssVariables["--render-background"]).toBeDefined();
    expect(compiled.cssVariables["--theme-source-line-height"]).toBe(`${DEFAULT_EDITOR_THEME.font.lineHeightSource}px`);
    expect(compiled.canvasVisualTokens.overlay.subgraphDash).toEqual([...DEFAULT_EDITOR_THEME.stroke.subgraphDash]);
    expect(compiled.geometry.subgraph.paddingTop).toBe(DEFAULT_EDITOR_THEME.subgraph.paddingTop);
    expect(compiled.mermaidThemeVariables.background).toBe(DEFAULT_EDITOR_THEME.render.background);
    expect(compiled.terminalTheme.brightRed).toBe(DEFAULT_EDITOR_THEME.ansi.brightRed);
    expect(compiled.cssVariables["--theme-terminal-line-height"]).toBe(`${DEFAULT_EDITOR_THEME.font.lineHeightTerminal}px`);
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
