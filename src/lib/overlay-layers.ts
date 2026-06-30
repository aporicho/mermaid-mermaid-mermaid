import { useEffect, useState } from "react";

export const OVERLAY_Z_INDEX = {
  workspaceBase: 50,
  floatingPopover: 180,
  statusToast: 200,
  contextMenu: 220,
  banner: 240,
  modal: 260,
  dropdown: 320,
  tooltip: 340
} as const;

export const OVERLAY_ACTIVITY_EVENT = "mermaid-canvas-editor:overlay-activity";
const activeOverlayTokens = new Set<string>();

export function setGlobalOverlayActivity(token: string, active: boolean) {
  const previousActive = activeOverlayTokens.size > 0;
  if (active) activeOverlayTokens.add(token);
  else activeOverlayTokens.delete(token);

  const nextActive = activeOverlayTokens.size > 0;
  if (previousActive === nextActive) return;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OVERLAY_ACTIVITY_EVENT, { detail: { active: nextActive } }));
}

export function useGlobalOverlayActivity() {
  const [active, setActive] = useState(() => activeOverlayTokens.size > 0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function update(event: Event) {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setActive(Boolean(detail?.active));
    }

    window.addEventListener(OVERLAY_ACTIVITY_EVENT, update);
    return () => window.removeEventListener(OVERLAY_ACTIVITY_EVENT, update);
  }, []);

  return active;
}
