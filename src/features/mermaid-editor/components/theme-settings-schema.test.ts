import { describe, expect, it } from "vitest";

import { THEME_TOKEN_GROUPS } from "@/features/mermaid-editor/components/theme-settings-schema";
import { themeValueAtPath } from "@/features/mermaid-editor/components/theme-settings-utils";
import {
  createDefaultMarkdownTokens,
  DEFAULT_EDITOR_THEME,
  MARKDOWN_ELEMENT_DEFINITIONS,
  MARKDOWN_TOKEN_DEFINITIONS
} from "@/features/mermaid-editor/lib/editor-theme";

describe("theme settings schema", () => {
  it("exposes every editable visual and interaction token", () => {
    const exposed = new Set(
      THEME_TOKEN_GROUPS.flatMap((group) => {
        const value = themeValueAtPath(DEFAULT_EDITOR_THEME, group.path) as Record<string, unknown>;
        return Object.keys(value)
          .filter((key) => !group.hiddenKeys?.includes(key))
          .map((key) => [...group.path, key].join("."));
      })
    );
    for (const path of flattenLeafPaths(DEFAULT_EDITOR_THEME.typography, ["typography"])) exposed.add(path);
    for (const definition of MARKDOWN_TOKEN_DEFINITIONS) exposed.add(["markdown", ...definition.path].join("."));
    const excluded = new Set(["version", "id", "name", "description", "baseThemeId", "icon.family"]);
    const expected = flattenLeafPaths(DEFAULT_EDITOR_THEME).filter((path) => !excluded.has(path) && !isLegacyTypographyPath(path));

    expect([...exposed].sort()).toEqual(expected.sort());
  });

  it("defines every canonical Markdown token exactly once under its element", () => {
    const paths = MARKDOWN_TOKEN_DEFINITIONS.map((definition) => definition.path.join("."));
    const textFields = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color"];

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.sort()).toEqual(flattenLeafPaths(DEFAULT_EDITOR_THEME.markdown).sort());
    for (const element of MARKDOWN_ELEMENT_DEFINITIONS) {
      const elementPath = element.path.join(".");
      if (element.id === "divider" || element.id === "image") continue;
      for (const field of textFields) expect(paths).toContain(`${elementPath}.${field}`);
    }
    expect(MARKDOWN_TOKEN_DEFINITIONS.every((definition) => definition.defaultSource.length > 0)).toBe(true);
    expect(createDefaultMarkdownTokens(DEFAULT_EDITOR_THEME)).toEqual(DEFAULT_EDITOR_THEME.markdown);
  });

  it("does not expose legacy Markdown typography containers", () => {
    const theme = DEFAULT_EDITOR_THEME as unknown as {
      markdown: Record<string, unknown>;
      typography: Record<string, unknown>;
    };

    expect(DEFAULT_EDITOR_THEME.version).toBe(8);
    expect(theme.markdown).not.toHaveProperty("typography");
    expect(theme.markdown).not.toHaveProperty("font");
    expect(theme.markdown).not.toHaveProperty("quote");
    expect(theme.typography).not.toHaveProperty("markdown");
  });
});

function isLegacyTypographyPath(path: string) {
  if (path.startsWith("font.")) return true;
  return path === "subgraph.titleFontSize" || path === "subgraph.titleFontWeight" || path === "edgeLabel.fontSize" || path === "edgeLabel.lineHeight";
}

function flattenLeafPaths(value: unknown, prefix: readonly string[] = []): string[] {
  if (Array.isArray(value) || !value || typeof value !== "object") return [prefix.join(".")];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => flattenLeafPaths(entry, [...prefix, key]));
}
