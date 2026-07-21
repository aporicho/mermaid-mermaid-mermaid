import { DEFAULT_APP_LOGO_ID, normalizeAppLogoId, type AppLogoId } from "@/features/mermaid-editor/lib/app-logo";
import { clampMarkdownTextScale, DEFAULT_MARKDOWN_TEXT_SCALE } from "@/features/mermaid-editor/lib/markdown-text-scale";

export type PanelOpenButtonMode = "hover" | "always";

export type EditorPreferences = {
  startWithPanelsCollapsed: boolean;
  panelOpenButtonMode: PanelOpenButtonMode;
  statusMessages: boolean;
  workspaceTitlebarAutoHide: boolean;
  restoreLastFile: boolean;
  markdownSpellcheckEnabled: boolean;
  markdownContentWidth: number;
  markdownTextScale: number;
  appLogo: AppLogoId;
};

type StoredEditorPreferences = Partial<EditorPreferences> & {
  /** @deprecated Renamed to workspaceTitlebarAutoHide. */
  desktopTitlebarAutoHide?: boolean;
};

export const MARKDOWN_CONTENT_WIDTH_MIN = 480;
export const MARKDOWN_CONTENT_WIDTH_MAX = 1600;
export const MARKDOWN_CONTENT_WIDTH_STEP = 40;

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  startWithPanelsCollapsed: true,
  panelOpenButtonMode: "hover",
  statusMessages: false,
  workspaceTitlebarAutoHide: true,
  restoreLastFile: true,
  markdownSpellcheckEnabled: false,
  markdownContentWidth: 880,
  markdownTextScale: DEFAULT_MARKDOWN_TEXT_SCALE,
  appLogo: DEFAULT_APP_LOGO_ID
};

export function normalizeEditorPreferences(value: StoredEditorPreferences | undefined): EditorPreferences {
  return {
    startWithPanelsCollapsed: value?.startWithPanelsCollapsed ?? DEFAULT_EDITOR_PREFERENCES.startWithPanelsCollapsed,
    panelOpenButtonMode: value?.panelOpenButtonMode === "always" ? "always" : DEFAULT_EDITOR_PREFERENCES.panelOpenButtonMode,
    statusMessages: value?.statusMessages ?? DEFAULT_EDITOR_PREFERENCES.statusMessages,
    workspaceTitlebarAutoHide: value?.workspaceTitlebarAutoHide ?? value?.desktopTitlebarAutoHide ?? DEFAULT_EDITOR_PREFERENCES.workspaceTitlebarAutoHide,
    restoreLastFile: value?.restoreLastFile ?? DEFAULT_EDITOR_PREFERENCES.restoreLastFile,
    markdownSpellcheckEnabled: value?.markdownSpellcheckEnabled ?? DEFAULT_EDITOR_PREFERENCES.markdownSpellcheckEnabled,
    markdownContentWidth: normalizeMarkdownContentWidth(value?.markdownContentWidth),
    markdownTextScale: normalizeMarkdownTextScale(value?.markdownTextScale),
    appLogo: normalizeAppLogoId(value?.appLogo)
  };
}

export function normalizeMarkdownContentWidth(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_EDITOR_PREFERENCES.markdownContentWidth;
  return Math.min(MARKDOWN_CONTENT_WIDTH_MAX, Math.max(MARKDOWN_CONTENT_WIDTH_MIN, Math.round(parsed)));
}

export function normalizeMarkdownTextScale(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return clampMarkdownTextScale(parsed);
}
