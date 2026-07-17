import { describe, expect, it } from "vitest";

import {
  DEFAULT_EDITOR_PREFERENCES,
  MARKDOWN_CONTENT_WIDTH_MAX,
  MARKDOWN_CONTENT_WIDTH_MIN,
  normalizeMarkdownContentWidth,
  normalizeEditorPreferences
} from "@/features/mermaid-editor/lib/editor-preferences";

describe("editor preferences", () => {
  it("disables Markdown spellcheck by default", () => {
    expect(DEFAULT_EDITOR_PREFERENCES.markdownSpellcheckEnabled).toBe(false);
    expect(normalizeEditorPreferences(undefined).markdownSpellcheckEnabled).toBe(false);
  });

  it("uses the disabled default for stored preferences created before the setting existed", () => {
    expect(normalizeEditorPreferences({ restoreLastFile: false }).markdownSpellcheckEnabled).toBe(false);
  });

  it("preserves an explicitly enabled Markdown spellcheck preference", () => {
    expect(normalizeEditorPreferences({ markdownSpellcheckEnabled: true }).markdownSpellcheckEnabled).toBe(true);
  });

  it("defaults the Markdown content width for older stored preferences", () => {
    expect(normalizeEditorPreferences({ restoreLastFile: false }).markdownContentWidth).toBe(880);
  });

  it("preserves and clamps the configured Markdown content width", () => {
    expect(normalizeEditorPreferences({ markdownContentWidth: 1120 }).markdownContentWidth).toBe(1120);
    expect(normalizeMarkdownContentWidth(200)).toBe(MARKDOWN_CONTENT_WIDTH_MIN);
    expect(normalizeMarkdownContentWidth(2400)).toBe(MARKDOWN_CONTENT_WIDTH_MAX);
  });
});
