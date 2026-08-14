import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";

export function useFloatingPanelClickSuppression() {
  const armedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const clear = useCallback(() => {
    armedRef.current = false;
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  const arm = useCallback(() => {
    armedRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      armedRef.current = false;
      timerRef.current = null;
    }, 0);
  }, []);
  const capture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!armedRef.current) return;
    clear();
    event.preventDefault();
    event.stopPropagation();
  }, [clear]);
  useEffect(() => clear, [clear]);
  return { arm, capture, clear };
}

export function blurAllowedFloatingPanelDragControl(control: HTMLElement | null) {
  const activeElement = document.activeElement;
  if (control && activeElement instanceof HTMLElement && control.contains(activeElement)) activeElement.blur();
}
