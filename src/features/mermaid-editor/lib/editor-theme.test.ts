import { describe, expect, it } from "vitest";

import {
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
});
