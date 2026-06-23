import { useEffect } from "react";

export function preventNativeContextMenu(event: Event) {
  event.preventDefault();
}

export function useDisableNativeContextMenu() {
  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      preventNativeContextMenu(event);
    }

    document.addEventListener("contextmenu", onContextMenu, true);
    return () => document.removeEventListener("contextmenu", onContextMenu, true);
  }, []);
}
