import { useCallback, useEffect, useState } from "react";

import type { FileDropFeedback } from "@/features/mermaid-editor/components/file-workflow-feedback";
import type { FileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";

import type { UnsavedPromptState } from "./use-editor-file-workflow";

export function useEditorOverlayState() {
  const [status, setStatus] = useState("");
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fileWorkflowError, setFileWorkflowError] = useState<FileWorkflowError | null>(null);
  const [unsavedPrompt, setUnsavedPrompt] = useState<UnsavedPromptState | null>(null);
  const [secondaryActionsOpen, setSecondaryActionsOpen] = useState(false);
  const [viewFiltersOpen, setViewFiltersOpen] = useState(false);
  const [nodeActionEditor, setNodeActionEditor] = useState<{ nodeId: string } | null>(null);
  const [fileDropFeedback, setFileDropFeedback] = useState<FileDropFeedback | null>(null);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);

  const updateFileMenuOpen = useCallback((open: boolean) => {
    setFileMenuOpen(open);
    if (!open) return;
    setViewFiltersOpen(false);
    setSecondaryActionsOpen(false);
  }, []);

  const updateViewFiltersOpen = useCallback((open: boolean) => {
    setViewFiltersOpen(open);
    if (!open) return;
    setFileMenuOpen(false);
    setSecondaryActionsOpen(false);
  }, []);

  const updateSecondaryActionsOpen = useCallback((open: boolean) => {
    setSecondaryActionsOpen(open);
    if (!open) return;
    setFileMenuOpen(false);
    setViewFiltersOpen(false);
  }, []);

  const closeFloatingOverlays = useCallback(() => {
    let closed = false;
    if (fileMenuOpen) {
      setFileMenuOpen(false);
      closed = true;
    }
    if (viewFiltersOpen) {
      setViewFiltersOpen(false);
      closed = true;
    }
    if (secondaryActionsOpen) {
      setSecondaryActionsOpen(false);
      closed = true;
    }
    return closed;
  }, [fileMenuOpen, secondaryActionsOpen, viewFiltersOpen]);

  return {
    status,
    setStatus,
    fileMenuOpen,
    setFileMenuOpen,
    fileWorkflowError,
    setFileWorkflowError,
    unsavedPrompt,
    setUnsavedPrompt,
    secondaryActionsOpen,
    viewFiltersOpen,
    nodeActionEditor,
    setNodeActionEditor,
    fileDropFeedback,
    setFileDropFeedback,
    updateFileMenuOpen,
    updateViewFiltersOpen,
    updateSecondaryActionsOpen,
    closeFloatingOverlays
  };
}

export function useUnsavedPromptEscape(
  unsavedPrompt: UnsavedPromptState | null,
  resolveUnsavedPrompt: (choice: "cancel") => void
) {
  useEffect(() => {
    if (!unsavedPrompt) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") resolveUnsavedPrompt("cancel");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resolveUnsavedPrompt, unsavedPrompt]);
}
