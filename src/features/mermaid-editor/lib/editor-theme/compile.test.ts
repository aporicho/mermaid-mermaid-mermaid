// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { BASE_INTERFACE } from "./base";
import { applyEditorThemeToDocument, themeToCssVariables } from "./compile";
import { DEFAULT_EDITOR_THEME } from "./presets";

describe("editor theme document application", () => {
  it("uses Nova geometry as the fallback without changing explicit themes", () => {
    expect(BASE_INTERFACE).toMatchObject({
      surface: { focusRingWidth: 3, opacity: 1, backdropBlur: 0 },
      radius: { app: 14, controlSm: 6, controlMd: 8, controlLg: 10 },
      spacing: { controlGap: 6, controlPaddingX: 10, controlPaddingY: 4, iconButtonSize: 32 },
      icon: { buttonHeightSm: 28, buttonHeightMd: 32 }
    });

    const variables = themeToCssVariables(DEFAULT_EDITOR_THEME);
    expect(variables["--radius"]).toBe(`${DEFAULT_EDITOR_THEME.interface.radius.controlLg}px`);
    expect(variables["--theme-radius-app"]).toBe(`${DEFAULT_EDITOR_THEME.interface.radius.app}px`);
  });

  it("derives the shadcn color scheme from the active theme background", () => {
    const target = document.createElement("div");
    const darkTheme = structuredClone(DEFAULT_EDITOR_THEME);
    darkTheme.interface.colors.background = "#101010";

    applyEditorThemeToDocument(darkTheme, target);
    expect(target.classList.contains("dark")).toBe(true);
    expect(target.style.colorScheme).toBe("dark");

    const lightTheme = structuredClone(DEFAULT_EDITOR_THEME);
    lightTheme.interface.colors.background = "#fafafa";
    applyEditorThemeToDocument(lightTheme, target);
    expect(target.classList.contains("dark")).toBe(false);
    expect(target.style.colorScheme).toBe("light");
  });
});
