export const FLOATING_CHROME_HIDE_DELAY_MS = 500;

export type FloatingChromeVisibilityInput = {
  hovered?: boolean;
  focusWithin?: boolean;
  pinned?: boolean;
};

export function shouldRevealFloatingGroup(input: FloatingChromeVisibilityInput) {
  return Boolean(input.hovered || input.focusWithin || input.pinned);
}
