import { useCallback, useRef, useState } from "react";

import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import type {
  DetachedTerminalWindow,
  TerminalWindowPanelId,
  WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

export function useTerminalWorkspaceWindowState() {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [detachedTerminalWindows, setDetachedTerminalWindows] = useState<DetachedTerminalWindow[]>([]);
  const nextTerminalWindowOrdinalRef = useRef(2);
  return { terminalOpen, setTerminalOpen, detachedTerminalWindows, setDetachedTerminalWindows, nextTerminalWindowOrdinalRef };
}

export function useTerminalWorkspaceWindowActions({
  state,
  bringToFront,
  setWindowState
}: {
  state: ReturnType<typeof useTerminalWorkspaceWindowState>;
  bringToFront: (panelId: WorkspaceFloatingPanelId) => void;
  setWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
}) {
  const { detachedTerminalWindows, nextTerminalWindowOrdinalRef, setDetachedTerminalWindows, setTerminalOpen, terminalOpen } = state;

  const newTerminalWindow = useCallback(() => {
    const ordinal = nextTerminalWindowOrdinalRef.current++;
    const id = `terminal:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${ordinal}`}` as TerminalWindowPanelId;
    setDetachedTerminalWindows((current) => [...current, { id, ordinal, open: true }]);
    setWindowState(id, "normal");
    bringToFront(id);
  }, [bringToFront, nextTerminalWindowOrdinalRef, setDetachedTerminalWindows, setWindowState]);

  const openTerminalWindow = useCallback((panelId: "terminal" | TerminalWindowPanelId) => {
    if (panelId === "terminal") setTerminalOpen(true);
    else setDetachedTerminalWindows((current) => current.map((window) => window.id === panelId ? { ...window, open: true } : window));
    bringToFront(panelId);
  }, [bringToFront, setDetachedTerminalWindows, setTerminalOpen]);

  const closeTerminalWindow = useCallback((panelId: TerminalWindowPanelId) => {
    setWindowState(panelId, "normal");
    setDetachedTerminalWindows((current) => current.map((window) => window.id === panelId ? { ...window, open: false } : window));
  }, [setDetachedTerminalWindows, setWindowState]);

  return {
    anyTerminalWindowOpen: terminalOpen || detachedTerminalWindows.some((window) => window.open),
    closeTerminalWindow,
    newTerminalWindow,
    openTerminalWindow
  };
}
