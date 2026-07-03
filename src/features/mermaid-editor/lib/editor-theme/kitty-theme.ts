import { contrastRatio, isHexColor } from "./color";
import { createEditorTheme } from "./base";
import type { AnsiColorTokens, EditorTheme } from "./types";
import type { KittyThemeFileDefinition, KittyThemePalette, ThemeMode } from "./theme-definition";

const ANSI_KEYS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite"
] as const satisfies readonly (keyof AnsiColorTokens)[];

const KITTY_COLOR_KEYS = [
  "color0",
  "color1",
  "color2",
  "color3",
  "color4",
  "color5",
  "color6",
  "color7",
  "color8",
  "color9",
  "color10",
  "color11",
  "color12",
  "color13",
  "color14",
  "color15"
] as const satisfies readonly (keyof KittyThemePalette)[];

export function editorThemeFromKittyDefinition(definition: KittyThemeFileDefinition): EditorTheme {
  const palette = definition.palette;
  const mode = definition.mode ?? inferThemeMode(palette.background);
  const ansi = ansiFromKittyPalette(palette);
  const primary = pickReadable([palette.color4, palette.color6, palette.color5, palette.color2, palette.color1], palette.background, 3);
  const destructive = pickReadable([palette.color1, palette.color9, "#b91f31"], palette.background, 3);
  const foreground = pickReadable([palette.foreground, mode === "dark" ? "#f8f8f2" : "#18130f"], palette.background, 4.5);
  const surface = mode === "dark" ? mixHex(palette.background, palette.foreground, 0.045) : mixHex(palette.background, "#ffffff", 0.55);
  const card = mode === "dark" ? mixHex(palette.background, palette.foreground, 0.07) : mixHex(palette.background, "#ffffff", 0.72);
  const secondary = mixHex(palette.background, palette.foreground, mode === "dark" ? 0.12 : 0.08);
  const border = mixHex(palette.background, palette.foreground, mode === "dark" ? 0.24 : 0.2);
  const mutedForeground = pickReadable([mixHex(palette.background, palette.foreground, mode === "dark" ? 0.68 : 0.56), foreground], palette.background, 3);
  const accent = mixHex(palette.background, primary, mode === "dark" ? 0.22 : 0.13);
  const accentForeground = pickReadable([primary, foreground, palette.color12, palette.color14], accent, 4.5);
  const selectionBackground = palette.selectionBackground ?? accent;
  const selectionForeground = palette.selectionForeground ?? pickReadable([foreground, palette.background, "#ffffff", "#000000"], selectionBackground, 4.5);
  const cursor = palette.cursor ?? primary;

  return createEditorTheme({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    ui: {
      background: palette.background,
      foreground,
      icon: mutedForeground,
      card,
      popover: card,
      primary,
      secondary,
      muted: secondary,
      mutedForeground,
      accent,
      accentForeground,
      destructive,
      border
    },
    canvas: {
      surface,
      nodeStroke: pickReadable([palette.color8, foreground], surface, 3),
      nodeText: pickReadable([foreground, palette.color15, palette.color0], surface, 4.5),
      edge: pickReadable([palette.color8, foreground, primary], surface, 3),
      edgeText: pickReadable([foreground, palette.color7, palette.color0], surface, 4.5),
      labelStroke: border,
      connectionInvalid: destructive,
      previewInvalid: mutedForeground
    },
    source: {
      line: border
    },
    render: {
      background: palette.background,
      gridDot: pickReadable([mutedForeground, foreground], palette.background, 2)
    },
    ansi,
    terminal: {
      background: palette.background,
      foreground,
      cursor,
      cursorAccent: palette.cursorText && isHexColor(palette.cursorText) ? palette.cursorText : palette.background,
      selectionBackground,
      selectionForeground
    }
  });
}

export function ansiFromKittyPalette(palette: KittyThemePalette): AnsiColorTokens {
  return Object.fromEntries(ANSI_KEYS.map((ansiKey, index) => [ansiKey, palette[KITTY_COLOR_KEYS[index]]])) as AnsiColorTokens;
}

export function inferThemeMode(background: string): ThemeMode {
  return contrastRatio(background, "#000000") > contrastRatio(background, "#ffffff") ? "light" : "dark";
}

function pickReadable(candidates: readonly string[], background: string, minimum: number) {
  const valid = candidates.filter(isHexColor);
  const passing = valid.find((candidate) => contrastRatio(candidate, background) >= minimum);
  if (passing) return passing;
  return valid.sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0] ?? "#000000";
}

function mixHex(from: string, to: string, amount: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * amount),
    g: Math.round(a.g + (b.g - a.g) * amount),
    b: Math.round(a.b + (b.b - a.b) * amount)
  });
}

function hexToRgb(value: string) {
  const hex = isHexColor(value) ? value.slice(1) : "000000";
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}
