import { useEffect, useRef } from "react";

import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";

export function useEditorAutoSave({
  preferences,
  dirty,
  fileBacked,
  documentRevisionKey,
  save
}: {
  preferences: Pick<EditorPreferences, "autoSave" | "autoSaveDelay">;
  dirty: boolean;
  fileBacked: boolean;
  documentRevisionKey: string;
  save: () => Promise<boolean>;
}) {
  const saveRef = useRef(save);
  const savingRef = useRef(false);
  const eligibleRef = useRef(dirty && fileBacked);

  useEffect(() => {
    saveRef.current = save;
    eligibleRef.current = dirty && fileBacked;
  }, [dirty, fileBacked, save]);

  useEffect(() => {
    if (preferences.autoSave !== "afterDelay" || !dirty || !fileBacked) return;
    const timer = window.setTimeout(() => void runAutoSave(saveRef, savingRef, eligibleRef), preferences.autoSaveDelay);
    return () => window.clearTimeout(timer);
  }, [dirty, documentRevisionKey, fileBacked, preferences.autoSave, preferences.autoSaveDelay]);

  useEffect(() => {
    if (preferences.autoSave !== "onFocusChange") return;
    function onFocusOut(event: FocusEvent) {
      if (!isEditingTarget(event.target)) return;
      if (event.relatedTarget && isEditingTarget(event.relatedTarget)) return;
      void runAutoSave(saveRef, savingRef, eligibleRef);
    }
    document.addEventListener("focusout", onFocusOut);
    return () => document.removeEventListener("focusout", onFocusOut);
  }, [preferences.autoSave]);

  useEffect(() => {
    if (preferences.autoSave !== "onWindowChange") return;
    const onBlur = () => void runAutoSave(saveRef, savingRef, eligibleRef);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [preferences.autoSave]);
}

async function runAutoSave(
  saveRef: { current: () => Promise<boolean> },
  savingRef: { current: boolean },
  eligibleRef: { current: boolean }
) {
  if (!eligibleRef.current || savingRef.current) return;
  savingRef.current = true;
  try {
    await saveRef.current();
  } finally {
    savingRef.current = false;
  }
}

function isEditingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.matches("textarea, input, [contenteditable='true'], .milkdown, .cm-editor") ||
    Boolean(target.closest("[contenteditable='true'], .milkdown, .cm-editor"))
  );
}
