import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { appLogoById } from "@/features/mermaid-editor/lib/app-logo";
import { layoutThemeFromState, loadInitialState } from "@/features/mermaid-editor/lib/editor-state";
import type { CanvasLayoutTheme } from "@/features/mermaid-editor/lib/editor-types";
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
  setFileTheme: Dispatch<SetStateAction<CanvasLayoutTheme | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useEditorThemeModel({ initial, setFileTheme, setStatus }: UseEditorThemeModelArgs) {
  const themeEditBaseRef = useRef<{ themeId: EditorThemeId; customTheme: EditorTheme | null } | null>(null);
  const [themeId, setThemeId] = useState<EditorThemeId>(initial.themeId);
  const [customTheme, setCustomTheme] = useState<EditorTheme | null>(initial.customTheme);
  const [preferences, setPreferences] = useState<EditorPreferences>(initial.preferences);

  const activeTheme = useMemo(() => resolveEditorTheme(themeId, customTheme), [customTheme, themeId]);
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
    themeEditBaseRef.current = { themeId, customTheme };
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
    setThemeId(nextThemeId);
    setCustomTheme(nextCustomTheme);
  }

  function cancelThemeSettings() {
    const base = themeEditBaseRef.current;
    if (base) {
      setThemeId(base.themeId);
      setCustomTheme(base.customTheme);
    }
    themeEditBaseRef.current = null;
  }

  function saveThemeSettings() {
    setFileTheme(layoutThemeFromState(themeId, customTheme));
    themeEditBaseRef.current = null;
    setStatus("主题已保存。");
  }

  return {
    themeId,
    setThemeId,
    customTheme,
    setCustomTheme,
    preferences,
    setPreferences,
    activeTheme,
    compiledTheme,
    resolvedMotion,
    activeAppLogo,
    beginThemeSettings,
    updatePreferences,
    previewTheme,
    cancelThemeSettings,
    saveThemeSettings
  };
}
