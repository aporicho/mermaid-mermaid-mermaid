import { useEffect, useRef, type RefObject } from "react";

export const FLOATING_MENU_IGNORE_SELECTOR = "[data-editor-floating-menu-ignore]";

type DismissableFloatingMenuOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ignoreSelector?: string;
};

export function useDismissableFloatingMenu<T extends HTMLElement = HTMLDivElement>({
  open,
  onOpenChange,
  ignoreSelector = FLOATING_MENU_IGNORE_SELECTOR
}: DismissableFloatingMenuOptions): RefObject<T | null> {
  const rootRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    const ownerDocument = rootRef.current?.ownerDocument ?? document;

    function isInsideRoot(event: Event) {
      const root = rootRef.current;
      if (!root) return false;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      return path.includes(root) || (event.target instanceof Node && root.contains(event.target));
    }

    function isIgnoredTarget(target: EventTarget | null) {
      if (!(target instanceof Node)) return false;
      const element = target instanceof Element ? target : target.parentElement;
      return Boolean(element?.closest(ignoreSelector));
    }

    function onPointerDown(event: PointerEvent) {
      if (isInsideRoot(event) || isIgnoredTarget(event.target)) return;
      onOpenChange(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isIgnoredTarget(event.target)) return;
      onOpenChange(false);
    }

    ownerDocument.addEventListener("pointerdown", onPointerDown, true);
    ownerDocument.addEventListener("keydown", onKeyDown);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
      ownerDocument.removeEventListener("keydown", onKeyDown);
    };
  }, [ignoreSelector, onOpenChange, open]);

  return rootRef;
}
