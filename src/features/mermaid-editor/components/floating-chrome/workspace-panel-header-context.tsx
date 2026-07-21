import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode
} from "react";

export const WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS = 800;
export const WORKSPACE_PANEL_HEADER_HOT_ZONE_PX = 8;

type WorkspacePanelHeaderContextValue = {
  visible: boolean;
  autoHide: boolean;
  overridden: boolean;
  toggleAutoHideOverride: () => void;
  onHeaderPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onHeaderPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onHeaderFocusCapture: (event: FocusEvent<HTMLElement>) => void;
  onHeaderBlurCapture: (event: FocusEvent<HTMLElement>) => void;
  showFromHotZone: () => void;
  leaveHotZone: () => void;
};

const WorkspacePanelHeaderContext = createContext<WorkspacePanelHeaderContextValue | null>(null);

export function WorkspacePanelHeaderProvider({ value, children }: { value: WorkspacePanelHeaderContextValue | null; children: ReactNode }) {
  return <WorkspacePanelHeaderContext.Provider value={value}>{children}</WorkspacePanelHeaderContext.Provider>;
}

export function useWorkspacePanelHeader() {
  return useContext(WorkspacePanelHeaderContext);
}

export function useWorkspacePanelHeaderAutoHide({
  enabled,
  open,
  dragging,
  autoHide
}: {
  enabled: boolean;
  open: boolean;
  dragging: boolean;
  autoHide: boolean;
}) {
  const [visible, setVisible] = useState(enabled && open);
  const [autoHideOverride, setAutoHideOverride] = useState<boolean | null>(null);
  const resolvedAutoHide = autoHideOverride ?? autoHide;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInsideRef = useRef(false);
  const focusInsideRef = useRef(false);
  const hotZoneInsideRef = useRef(false);
  const openRef = useRef(open);
  const autoHideRef = useRef(resolvedAutoHide);
  const draggingRef = useRef(dragging);

  openRef.current = open;
  autoHideRef.current = resolvedAutoHide;
  draggingRef.current = dragging;

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const show = useCallback(() => {
    if (!enabled || !openRef.current) return;
    clearHideTimer();
    setVisible(true);
  }, [clearHideTimer, enabled]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (
      !enabled ||
      !openRef.current ||
      !autoHideRef.current ||
      draggingRef.current ||
      pointerInsideRef.current ||
      focusInsideRef.current ||
      hotZoneInsideRef.current
    ) {
      return;
    }
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (
        openRef.current &&
        autoHideRef.current &&
        !draggingRef.current &&
        !pointerInsideRef.current &&
        !focusInsideRef.current &&
        !hotZoneInsideRef.current
      ) {
        setVisible(false);
      }
    }, WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS);
  }, [clearHideTimer, enabled]);

  useEffect(() => {
    if (!enabled || !open) {
      clearHideTimer();
      pointerInsideRef.current = false;
      focusInsideRef.current = false;
      hotZoneInsideRef.current = false;
      setAutoHideOverride(null);
      setVisible(false);
      return;
    }

    setVisible(true);
    if (resolvedAutoHide) scheduleHide();
    else clearHideTimer();
  }, [clearHideTimer, enabled, open, resolvedAutoHide, scheduleHide]);

  useEffect(() => {
    if (!enabled || !open || !resolvedAutoHide) return;
    if (dragging) show();
    else scheduleHide();
  }, [dragging, enabled, open, resolvedAutoHide, scheduleHide, show]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const toggleAutoHideOverride = useCallback(() => {
    setAutoHideOverride((current) => !(current ?? autoHide));
  }, [autoHide]);

  return useMemo<WorkspacePanelHeaderContextValue | null>(() => {
    if (!enabled) return null;
    return {
      visible,
      autoHide: resolvedAutoHide,
      overridden: autoHideOverride !== null,
      toggleAutoHideOverride,
      onHeaderPointerEnter: () => {
        pointerInsideRef.current = true;
        show();
      },
      onHeaderPointerLeave: () => {
        pointerInsideRef.current = false;
        scheduleHide();
      },
      onHeaderFocusCapture: () => {
        focusInsideRef.current = true;
        show();
      },
      onHeaderBlurCapture: (event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        focusInsideRef.current = false;
        scheduleHide();
      },
      showFromHotZone: () => {
        hotZoneInsideRef.current = true;
        show();
      },
      leaveHotZone: () => {
        hotZoneInsideRef.current = false;
        scheduleHide();
      }
    };
  }, [autoHideOverride, enabled, resolvedAutoHide, scheduleHide, show, toggleAutoHideOverride, visible]);
}
