import { useCallback, useEffect, useRef, useState } from "react";

export function useWorkspacePanelHeaderHeight() {
  const [headerHeightPx, setHeaderHeightPx] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const setHeaderElement = useCallback((element: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element) return;
    const measure = () => {
      const height = Math.max(0, Math.ceil(element.getBoundingClientRect().height));
      if (height > 0) setHeaderHeightPx((current) => current === height ? current : height);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);
  return { headerHeightPx, setHeaderElement };
}
