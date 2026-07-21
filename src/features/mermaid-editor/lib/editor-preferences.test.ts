import { describe, expect, it } from "vitest";

import {
  DEFAULT_EDITOR_PREFERENCES,
  MARKDOWN_CONTENT_WIDTH_MAX,
  MARKDOWN_CONTENT_WIDTH_MIN,
  normalizeMarkdownContentWidth,
  normalizeEditorPreferences,
  normalizeMarkdownTextScale
} from "@/features/mermaid-editor/lib/editor-preferences";
import { MARKDOWN_TEXT_SCALE_MAX, MARKDOWN_TEXT_SCALE_MIN, MARKDOWN_TEXT_SCALE_STEP } from "@/features/mermaid-editor/lib/markdown-text-scale";

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

  it("defaults workspace titlebar auto-hide on and migrates its desktop-era key", () => {
    expect(DEFAULT_EDITOR_PREFERENCES.workspaceTitlebarAutoHide).toBe(true);
    expect(normalizeEditorPreferences(undefined).workspaceTitlebarAutoHide).toBe(true);
    expect(normalizeEditorPreferences({ desktopTitlebarAutoHide: false }).workspaceTitlebarAutoHide).toBe(false);
  });

  it("gives the new workspace titlebar key precedence over its legacy alias", () => {
    expect(normalizeEditorPreferences({ workspaceTitlebarAutoHide: true, desktopTitlebarAutoHide: false }).workspaceTitlebarAutoHide).toBe(true);
    expect(normalizeEditorPreferences({ workspaceTitlebarAutoHide: false, desktopTitlebarAutoHide: true }).workspaceTitlebarAutoHide).toBe(false);
  });

  it("defaults, clamps and snaps the Markdown text scale", () => {
    expect(DEFAULT_EDITOR_PREFERENCES.markdownTextScale).toBe(1);
    expect(MARKDOWN_TEXT_SCALE_STEP).toBe(0.1);
    expect(normalizeEditorPreferences({ restoreLastFile: false }).markdownTextScale).toBe(1);
    expect(normalizeMarkdownTextScale(0.2)).toBe(MARKDOWN_TEXT_SCALE_MIN);
    expect(normalizeMarkdownTextScale(4)).toBe(MARKDOWN_TEXT_SCALE_MAX);
    expect(normalizeMarkdownTextScale(1.26)).toBe(1.3);
    expect(normalizeMarkdownTextScale("1.14")).toBe(1.1);
    expect(normalizeMarkdownTextScale(Number.NaN)).toBe(1);
  });
});
