import { describe, expect, it } from "vitest";

import { THEME_TOKEN_GROUPS } from "@/features/mermaid-editor/components/theme-settings-schema";
import { themeValueAtPath } from "@/features/mermaid-editor/components/theme-settings-utils";
import { DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";

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
    const excluded = new Set(["version", "id", "name", "description", "baseThemeId", "icon.family"]);
    const expected = flattenLeafPaths(DEFAULT_EDITOR_THEME).filter((path) => !excluded.has(path));

    expect([...exposed].sort()).toEqual(expected.sort());
  });
});

function flattenLeafPaths(value: unknown, prefix: readonly string[] = []): string[] {
  if (Array.isArray(value) || !value || typeof value !== "object") return [prefix.join(".")];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => flattenLeafPaths(entry, [...prefix, key]));
}
