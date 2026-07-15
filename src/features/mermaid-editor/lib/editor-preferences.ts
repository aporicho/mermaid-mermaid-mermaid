import { DEFAULT_APP_LOGO_ID, normalizeAppLogoId, type AppLogoId } from "@/features/mermaid-editor/lib/app-logo";

export type PanelOpenButtonMode = "hover" | "always";

export type EditorPreferences = {
  startWithPanelsCollapsed: boolean;
  panelOpenButtonMode: PanelOpenButtonMode;
  statusMessages: boolean;
  desktopTitlebarAutoHide: boolean;
  restoreLastFile: boolean;
  markdownSpellcheckEnabled: boolean;
  appLogo: AppLogoId;
};

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  startWithPanelsCollapsed: true,
  panelOpenButtonMode: "hover",
  statusMessages: false,
  desktopTitlebarAutoHide: true,
  restoreLastFile: true,
  markdownSpellcheckEnabled: false,
  appLogo: DEFAULT_APP_LOGO_ID
};

export function normalizeEditorPreferences(value: Partial<EditorPreferences> | undefined): EditorPreferences {
  return {
    startWithPanelsCollapsed: value?.startWithPanelsCollapsed ?? DEFAULT_EDITOR_PREFERENCES.startWithPanelsCollapsed,
    panelOpenButtonMode: value?.panelOpenButtonMode === "always" ? "always" : DEFAULT_EDITOR_PREFERENCES.panelOpenButtonMode,
    statusMessages: value?.statusMessages ?? DEFAULT_EDITOR_PREFERENCES.statusMessages,
    desktopTitlebarAutoHide: value?.desktopTitlebarAutoHide ?? DEFAULT_EDITOR_PREFERENCES.desktopTitlebarAutoHide,
    restoreLastFile: value?.restoreLastFile ?? DEFAULT_EDITOR_PREFERENCES.restoreLastFile,
    markdownSpellcheckEnabled: value?.markdownSpellcheckEnabled ?? DEFAULT_EDITOR_PREFERENCES.markdownSpellcheckEnabled,
    appLogo: normalizeAppLogoId(value?.appLogo)
  };
}
