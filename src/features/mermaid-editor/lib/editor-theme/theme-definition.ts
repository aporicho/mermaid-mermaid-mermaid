import type { EditorTheme } from "./types";

export type ThemeMode = "light" | "dark";

export type ThemeSourceInfo = {
  id: string;
  name: string;
  repository?: string;
  path?: string;
  url?: string;
  commit?: string;
  license?: string;
  author?: string;
  upstream?: string;
};

export type EditorThemeFileDefinition = {
  kind: "editor";
  id: string;
  name: string;
  description: string;
  mode?: ThemeMode;
  order?: number;
  source?: ThemeSourceInfo;
  theme?: Partial<Omit<EditorTheme, "version" | "id" | "name" | "description">>;
};

export type KittyThemePalette = {
  background: string;
  foreground: string;
  cursor?: string;
  cursorText?: string;
  selectionBackground?: string;
  selectionForeground?: string;
  color0: string;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  color5: string;
  color6: string;
  color7: string;
  color8: string;
  color9: string;
  color10: string;
  color11: string;
  color12: string;
  color13: string;
  color14: string;
  color15: string;
};

export type KittyThemeFileDefinition = {
  kind: "kitty";
  id: string;
  name: string;
  description: string;
  mode?: ThemeMode;
  order?: number;
  source: ThemeSourceInfo;
  palette: KittyThemePalette;
};

export type EditorThemeDefinition = EditorThemeFileDefinition | KittyThemeFileDefinition;

export type EditorThemeCatalogEntry = {
  id: string;
  name: string;
  description: string;
  mode: ThemeMode;
  source: ThemeSourceInfo;
  order: number;
  swatches: readonly [string, string, string];
  theme: EditorTheme;
};
