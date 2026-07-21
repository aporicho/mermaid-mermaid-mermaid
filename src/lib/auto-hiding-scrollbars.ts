export const SCROLLBAR_ACTIVE_CLASS = "scrollbar-active";
export const SCROLLBAR_HIDE_DELAY_MS = 700;

export function installAutoHidingScrollbars(
  ownerDocument: Document = document,
  hideDelay = SCROLLBAR_HIDE_DELAY_MS
) {
  const defaultView = ownerDocument.defaultView;
  if (!defaultView) return () => undefined;
  const view = defaultView;

  const hideTimers = new Map<Element, number>();

  function resolveScrollElement(target: EventTarget | null) {
    if (target === ownerDocument) {
      return ownerDocument.scrollingElement ?? ownerDocument.documentElement;
    }
    return target instanceof view.Element ? target : null;
  }

  function handleScroll(event: Event) {
    const element = resolveScrollElement(event.target);
    if (!element || element.classList.contains("scrollbar-hidden")) return;

    const previousTimer = hideTimers.get(element);
    if (previousTimer !== undefined) view.clearTimeout(previousTimer);

    element.classList.add(SCROLLBAR_ACTIVE_CLASS);
    const hideTimer = view.setTimeout(() => {
      element.classList.remove(SCROLLBAR_ACTIVE_CLASS);
      hideTimers.delete(element);
    }, hideDelay);
    hideTimers.set(element, hideTimer);
  }

  ownerDocument.addEventListener("scroll", handleScroll, true);

  return () => {
    ownerDocument.removeEventListener("scroll", handleScroll, true);
    for (const [element, hideTimer] of hideTimers) {
      view.clearTimeout(hideTimer);
      element.classList.remove(SCROLLBAR_ACTIVE_CLASS);
    }
    hideTimers.clear();
  };
}
