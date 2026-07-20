import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { appLogoById } from "@/features/mermaid-editor/lib/app-logo";
import { loadInitialState } from "@/features/mermaid-editor/lib/editor-state";
import {
  applyEditorThemeToDocument,
  compileEditorTheme,
  type EditorTheme,
  type EditorThemeId,
  resolveEditorTheme
} from "@/features/mermaid-editor/lib/editor-theme";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { useResolvedEditorMotion } from "@/features/mermaid-editor/lib/use-gsap-motion";

type InitialEditorState = ReturnType<typeof loadInitialState>;

type UseEditorThemeModelArgs = {
  initial: InitialEditorState;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useEditorThemeModel({ initial, setStatus }: UseEditorThemeModelArgs) {
  const [themeId, setThemeId] = useState<EditorThemeId>(initial.themeId);
  const [customTheme, setCustomTheme] = useState<EditorTheme | null>(initial.customTheme);
  const [themeDraft, setThemeDraft] = useState<{ themeId: EditorThemeId; customTheme: EditorTheme | null } | null>(null);
  const [preferences, setPreferences] = useState<EditorPreferences>(initial.preferences);

  const editingThemeId = themeDraft?.themeId ?? themeId;
  const editingCustomTheme = themeDraft?.customTheme ?? customTheme;
  const themeDraftDirty = Boolean(themeDraft && (themeDraft.themeId !== themeId || !sameCustomTheme(themeDraft.customTheme, customTheme)));
  const activeTheme = useMemo(() => resolveEditorTheme(editingThemeId, editingCustomTheme), [editingCustomTheme, editingThemeId]);
  const compiledTheme = useMemo(() => compileEditorTheme(activeTheme), [activeTheme]);
  const resolvedMotion = useResolvedEditorMotion(compiledTheme.motion);
  const activeAppLogo = useMemo(() => appLogoById(preferences.appLogo), [preferences.appLogo]);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.append(link);
    }
    link.type = "image/svg+xml";
    link.href = activeAppLogo.href;
  }, [activeAppLogo.href]);

  useEffect(() => {
    applyEditorThemeToDocument(activeTheme);
  }, [activeTheme]);

  function beginThemeSettings() {
    setThemeDraft((current) => current ?? { themeId, customTheme });
  }

  function updatePreferences(nextPreferences: EditorPreferences, message?: string) {
    setPreferences(nextPreferences);
    if (!nextPreferences.statusMessages) {
      setStatus("");
      return;
    }
    if (message) setStatus(message);
  }

  function previewTheme(nextThemeId: EditorThemeId, nextCustomTheme: EditorTheme | null) {
    setThemeDraft({ themeId: nextThemeId, customTheme: nextCustomTheme });
  }

  function discardThemeSettings() {
    setThemeDraft(null);
  }

  function saveThemeSettings() {
    if (!themeDraftDirty || !themeDraft) return;
    setThemeId(themeDraft.themeId);
    setCustomTheme(themeDraft.customTheme);
    setThemeDraft(null);
    setStatus("主题偏好已保存。");
  }

  return {
    themeId,
    setThemeId,
    customTheme,
    setCustomTheme,
    editingThemeId,
    editingCustomTheme,
    themeDraftDirty,
    preferences,
    setPreferences,
    activeTheme,
    compiledTheme,
    resolvedMotion,
    activeAppLogo,
    beginThemeSettings,
    updatePreferences,
    previewTheme,
    discardThemeSettings,
    saveThemeSettings
  };
}

function sameCustomTheme(left: EditorTheme | null, right: EditorTheme | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}
