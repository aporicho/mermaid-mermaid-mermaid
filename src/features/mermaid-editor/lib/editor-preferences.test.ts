import { describe, expect, it } from "vitest";

import {
  DEFAULT_EDITOR_PREFERENCES,
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
});
