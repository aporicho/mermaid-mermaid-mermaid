import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent
} from "react";

import { useWorkspacePanelHeaderHeight } from "./use-workspace-panel-header-height";

export const WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS = 0;
export const WORKSPACE_PANEL_HEADER_REVEAL_HOT_ZONE_PX = 8;
export type WorkspaceTitlebarAutoHideLayout = "overlay" | "flow";

export type WorkspacePanelHeaderContextValue = {
  visible: boolean; autoHide: boolean; overridden: boolean;
  autoHideLayout: WorkspaceTitlebarAutoHideLayout;
  headerHeightPx: number;
  setHeaderElement: (element: HTMLElement | null) => void;
  toggleAutoHideOverride: () => void;
  onHeaderPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onHeaderPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void;
  onHeaderFocusCapture: (event: FocusEvent<HTMLElement>) => void;
  onHeaderBlurCapture: (event: FocusEvent<HTMLElement>) => void;
  showFromHotZone: () => void;
  leaveHotZone: () => void;
};

export function useWorkspacePanelHeaderAutoHide({
  enabled, open, dragging, autoHide, autoHideLayout
}: { enabled: boolean; open: boolean; dragging: boolean; autoHide: boolean; autoHideLayout: WorkspaceTitlebarAutoHideLayout }) {
  const [visible, setVisible] = useState(enabled && open && !autoHide);
  const [autoHideOverride, setAutoHideOverride] = useState<boolean | null>(null);
  const { headerHeightPx, setHeaderElement: setMeasuredHeaderElement } = useWorkspacePanelHeaderHeight();
  const resolvedAutoHide = autoHideOverride ?? autoHide;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerElementRef = useRef<HTMLElement | null>(null);
  const visibleRef = useRef(visible);
  const pointerInsideRef = useRef(false);
  const focusInsideRef = useRef(false);
  const hotZoneInsideRef = useRef(false);
  const wasOpenRef = useRef(false);
  const openRef = useRef(open);
  const autoHideRef = useRef(resolvedAutoHide);
  const draggingRef = useRef(dragging);

  openRef.current = open;
  autoHideRef.current = resolvedAutoHide;
  draggingRef.current = dragging;
  visibleRef.current = visible;

  const updateVisible = useCallback((nextVisible: boolean) => {
    visibleRef.current = nextVisible;
    setVisible(nextVisible);
  }, []);
  const setHeaderElement = useCallback((element: HTMLElement | null) => {
    headerElementRef.current = element;
    setMeasuredHeaderElement(element);
  }, [setMeasuredHeaderElement]);
  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);
  const show = useCallback(() => {
    if (!enabled || !openRef.current) return;
    clearHideTimer();
    updateVisible(true);
  }, [clearHideTimer, enabled, updateVisible]);
  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!enabled || !openRef.current || !autoHideRef.current || draggingRef.current || pointerInsideRef.current || focusInsideRef.current || hotZoneInsideRef.current) return;
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (openRef.current && autoHideRef.current && !draggingRef.current && !pointerInsideRef.current && !focusInsideRef.current && !hotZoneInsideRef.current) {
        updateVisible(false);
      }
    }, WORKSPACE_PANEL_HEADER_HIDE_DELAY_MS);
  }, [clearHideTimer, enabled, updateVisible]);

  useEffect(() => {
    const opening = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!enabled || !open) {
      clearHideTimer();
      pointerInsideRef.current = false;
      focusInsideRef.current = false;
      hotZoneInsideRef.current = false;
      setAutoHideOverride(null);
      updateVisible(false);
      return;
    }
    if (!resolvedAutoHide) {
      clearHideTimer();
      updateVisible(true);
      return;
    }
    if (opening) {
      clearHideTimer();
      updateVisible(false);
    } else scheduleHide();
  }, [clearHideTimer, enabled, open, resolvedAutoHide, scheduleHide, updateVisible]);

  useEffect(() => {
    if (!enabled || !open || !resolvedAutoHide) return;
    if (dragging) show();
    else scheduleHide();
  }, [dragging, enabled, open, resolvedAutoHide, scheduleHide, show]);

  useEffect(() => {
    if (!enabled || !open || !resolvedAutoHide || !visible) return;
    const trackPointer = (event: globalThis.PointerEvent) => {
      const header = headerElementRef.current;
      if (!header) return;
      const rect = header.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom;
      hotZoneInsideRef.current = false;
      pointerInsideRef.current = inside;
      if (inside) clearHideTimer();
      else scheduleHide();
    };
    window.addEventListener("pointermove", trackPointer, true);
    return () => window.removeEventListener("pointermove", trackPointer, true);
  }, [clearHideTimer, enabled, open, resolvedAutoHide, scheduleHide, visible]);

  useEffect(() => clearHideTimer, [clearHideTimer]);
  const toggleAutoHideOverride = useCallback(() => {
    setAutoHideOverride((current) => !(current ?? autoHide));
  }, [autoHide]);

  return useMemo<WorkspacePanelHeaderContextValue | null>(() => {
    if (!enabled) return null;
    return {
      visible, autoHide: resolvedAutoHide, overridden: autoHideOverride !== null,
      autoHideLayout, headerHeightPx, setHeaderElement, toggleAutoHideOverride,
      onHeaderPointerEnter: () => {
        hotZoneInsideRef.current = false;
        pointerInsideRef.current = true;
        show();
      },
      onHeaderPointerLeave: () => {
        hotZoneInsideRef.current = false;
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
        if (visibleRef.current) return;
        hotZoneInsideRef.current = false;
        scheduleHide();
      }
    };
  }, [autoHideLayout, autoHideOverride, enabled, headerHeightPx, resolvedAutoHide, scheduleHide, setHeaderElement, show, toggleAutoHideOverride, visible]);
}
