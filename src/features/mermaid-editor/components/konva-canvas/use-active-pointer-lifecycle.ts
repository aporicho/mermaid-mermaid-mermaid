import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export function useActivePointerLifecycle(cancelInteraction: () => void) {
  const activePointerIdRef = useRef<number | null>(null);
  const cancelInteractionRef = useRef(cancelInteraction);
  cancelInteractionRef.current = cancelInteraction;

  function claimPointer(event: ReactPointerEvent<HTMLDivElement>) {
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function releasePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    function cancelOwnedPointer() {
      if (activePointerIdRef.current === null) return;
      activePointerIdRef.current = null;
      cancelInteractionRef.current();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") cancelOwnedPointer();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") cancelOwnedPointer();
    }
    window.addEventListener("blur", cancelOwnedPointer);
    window.addEventListener("keydown", handleEscape);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", cancelOwnedPointer);
      window.removeEventListener("keydown", handleEscape);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { activePointerIdRef, claimPointer, releasePointer };
}
