import { describe, expect, it } from "vitest";

import type { CanvasThemeTokens, InterfaceThemeTokens } from "./appearance-types";
import { cloneSpecialNodeTheme, createDefaultSpecialNodeTheme, normalizeSpecialNodeTheme, resolveSpecialNodeBorder, specialNodeBorderDash } from "./special-node-theme";

const source = {
  interface: {
    colors: {
      card: "#fcf8f2",
      foreground: "#18130f",
      mutedForeground: "#6b625a",
      primary: "#ff4050",
      destructive: "#b91f31",
      border: "#b8ada0",
      muted: "#f0ebe4",
      accent: "#ffe7ea",
      secondary: "#eee8df"
    },
    radius: { controlSm: 4 }
  } as unknown as InterfaceThemeTokens,
  canvas: {
    ordinaryNode: {
      textColor: "#18130f",
      borderColor: "#2a251f",
      hoverBorderColor: "#6f6257",
      selectedBorderColor: "#ff4050",
      invalidBorderColor: "#9b5a50",
      borderWidth: 1,
      emphasizedBorderWidth: 2,
      borderStyle: "solid",
      customDash: [],
      roundedRadius: 8,
      shadow: { color: "#2a251f", blur: 10, opacity: 0.16, offsetX: 0, offsetY: 4 }
    }
  } as unknown as CanvasThemeTokens
};

describe("v11 special-node theme", () => {
  it("creates independent surfaces and keeps only semantic colors shared", () => {
    const theme = createDefaultSpecialNodeTheme(source);

    expect(theme.shared).toEqual({
      textColor: "#18130f",
      mutedTextColor: "#6b625a",
      accentColor: "#ff4050",
      errorColor: "#b91f31"
    });
    expect(theme).not.toHaveProperty("common");
    expect(theme.linkCard.surface).not.toBe(theme.markdownDocument.surface);
    expect(theme.htmlDocument.surface).not.toBe(theme.markdownDocument.surface);
    expect(theme.markdownDocument.surface).not.toBe(theme.image.surface);
    expect(theme.image.surface.shadow).not.toBe(theme.linkCard.surface.shadow);
    expect(theme.table.surface.shadow.opacity).toBe(0);
    expect(theme.table.headerBackground).toBe("#eee8df");
    expect(theme.markdownDocument.previewTypography).toEqual({ titleFontSize: 24, contentFontSize: 16 });
    expect(theme.markdownDocument).toMatchObject({
      contentPaddingTop: 12,
      contentPaddingRight: 12,
      contentPaddingBottom: 12,
      contentPaddingLeft: 12
    });
    expect(theme.markdownDocument.previewSpacing).toEqual({
      titleBottomGap: 18,
      sectionTopGap: 16,
      headingBottomGap: 6,
      blockGap: 10,
      listItemGap: 0
    });
  });

  it("migrates v10 common and flat subtype fields into independent v11 objects", () => {
    const fallback = createDefaultSpecialNodeTheme(source);
    const theme = normalizeSpecialNodeTheme({
      common: {
        background: "#112233",
        textColor: "#223344",
        mutedTextColor: "#334455",
        accentColor: "#445566",
        borderColor: "#556677",
        borderWidth: 3,
        radius: 13,
        shadowColor: "#667788",
        shadowBlur: 19,
        shadowOpacity: 0.4,
        shadowOffsetY: 7
      },
      linkCard: { coverBorderColor: "#778899", coverBorderWidth: 2 },
      image: { background: "#010203", borderColor: "#020304", borderWidth: 4, radius: 17, interactionBorderColor: "#030405", interactionBorderWidth: 5 },
      table: { background: "#101112", dividerColor: "#121314", dividerWidth: 2, selectedCellFill: "#141516", selectedCellStroke: "#161718", selectedCellStrokeWidth: 3 }
    }, fallback);

    expect(theme.shared).toMatchObject({ textColor: "#223344", mutedTextColor: "#334455", accentColor: "#445566" });
    expect(theme.linkCard.surface).toMatchObject({ background: "#112233", radius: 13, border: { color: "#556677", width: 3 }, shadow: { color: "#667788", blur: 19, opacity: 0.4, offsetY: 7 } });
    expect(theme.markdownDocument.surface).toMatchObject({ background: "#112233", radius: 13 });
    expect(theme.htmlDocument.surface).toMatchObject({ background: "#112233", radius: 13 });
    expect(theme.linkCard.coverBorder).toMatchObject({ color: "#778899", width: 2 });
    expect(theme.image.surface).toMatchObject({ background: "#010203", radius: 17, border: { color: "#020304", width: 4 }, shadow: { color: "#667788" } });
    expect(theme.image.state).toMatchObject({ selectedBorderColor: "#030405", emphasizedBorderWidth: 5 });
    expect(theme.table.surface).toMatchObject({ background: "#101112", radius: 0, shadow: { opacity: 0 } });
    expect(theme.table.grid).toMatchObject({ color: "#121314", width: 2 });
    expect(theme.table.selectedCellBackground).toBe("#141516");
    expect(theme.table.selectedCellBorder).toMatchObject({ color: "#161718", width: 3 });
  });

  it("normalizes border styles and custom dash arrays and resolves visual states", () => {
    const fallback = createDefaultSpecialNodeTheme(source);
    const normalized = normalizeSpecialNodeTheme({
      image: {
        surface: { border: { style: "custom", customDash: [12, 3, 2, 3] } },
        state: { hoverBorderColor: "#abcdef", emphasizedBorderWidth: 99 }
      }
    }, fallback);

    expect(normalized.image.surface.border).toMatchObject({ style: "custom", customDash: [12, 3, 2, 3] });
    expect(normalized.image.state.emphasizedBorderWidth).toBe(12);
    const hoverBorder = resolveSpecialNodeBorder(normalized.image.surface, normalized.image.state, "hovered");
    expect(hoverBorder).toMatchObject({ color: "#abcdef", width: 12 });
    expect(specialNodeBorderDash(hoverBorder)).toEqual([12, 3, 2, 3]);
  });

  it("deep-clones nested surfaces and dash arrays", () => {
    const theme = createDefaultSpecialNodeTheme(source);
    const clone = cloneSpecialNodeTheme(theme);
    (clone.linkCard.surface.border.customDash as number[]).push(7);
    clone.linkCard.surface.shadow.blur = 33;

    expect(theme.linkCard.surface.border.customDash).toEqual([]);
    expect(theme.linkCard.surface.shadow.blur).toBe(10);
  });

  it("normalizes Markdown preview typography and spacing tokens", () => {
    const fallback = createDefaultSpecialNodeTheme(source);
    const theme = normalizeSpecialNodeTheme({
      markdownDocument: {
        previewTypography: { titleFontSize: 120, contentFontSize: 6 },
        previewSpacing: { titleBottomGap: 70, sectionTopGap: 21, headingBottomGap: -1, blockGap: 13, listItemGap: 40 }
      }
    }, fallback);

    expect(theme.markdownDocument.previewTypography).toEqual({ titleFontSize: 96, contentFontSize: 8 });
    expect(theme.markdownDocument.previewSpacing).toEqual({
      titleBottomGap: 64,
      sectionTopGap: 21,
      headingBottomGap: 0,
      blockGap: 13,
      listItemGap: 32
    });

    const migrated = normalizeSpecialNodeTheme({
      markdownDocument: { contentPadding: 19, previewTypography: { titleFontSize: 28, bodyFontSize: 17 } }
    }, fallback);
    expect(migrated.markdownDocument.previewTypography).toEqual({ titleFontSize: 28, contentFontSize: 17 });
    expect(migrated.markdownDocument).toMatchObject({
      contentPaddingTop: 19,
      contentPaddingRight: 19,
      contentPaddingBottom: 19,
      contentPaddingLeft: 19
    });
  });
});
