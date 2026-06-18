import { describe, expect, it } from "vitest";

import {
  compileEditorTheme,
  DEFAULT_EDITOR_THEME,
  normalizeEditorTheme,
  resolveEditorTheme,
  themeToCanvasVisualTokens,
  themeToCssVariables,
  themeToMermaidThemeVariables
} from "@/features/mermaid-editor/lib/editor-theme";

describe("editor theme", () => {
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
      }
    });
  });

  it("maps theme colors to shadcn css variables", () => {
    const variables = themeToCssVariables(DEFAULT_EDITOR_THEME);

    expect(variables["--background"]).toBeDefined();
    expect(variables["--icon"]).toBeDefined();
    expect(variables["--primary"]).toBeDefined();
    expect(variables["--source-line"]).toBeDefined();
    expect(variables["--primary-foreground"]).toBe(variables["--background"]);
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

  it("compiles every runtime adapter from one theme snapshot", () => {
    const compiled = compileEditorTheme(DEFAULT_EDITOR_THEME);

    expect(compiled.cssVariables["--render-background"]).toBeDefined();
    expect(compiled.cssVariables["--theme-source-line-height"]).toBe(`${DEFAULT_EDITOR_THEME.font.lineHeightSource}px`);
    expect(compiled.canvasVisualTokens.overlay.subgraphDash).toEqual([...DEFAULT_EDITOR_THEME.stroke.subgraphDash]);
    expect(compiled.geometry.subgraph.paddingTop).toBe(DEFAULT_EDITOR_THEME.subgraph.paddingTop);
    expect(compiled.mermaidThemeVariables.background).toBe(DEFAULT_EDITOR_THEME.render.background);
    expect(compiled.diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);
  });
});
