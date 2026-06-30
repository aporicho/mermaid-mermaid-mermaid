// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { OVERLAY_ACTIVITY_EVENT, OVERLAY_Z_INDEX, setGlobalOverlayActivity } from "@/lib/overlay-layers";

describe("overlay layers", () => {
  afterEach(() => {
    setGlobalOverlayActivity("test-a", false);
    setGlobalOverlayActivity("test-b", false);
    vi.restoreAllMocks();
  });

  it("keeps dropdowns above app chrome and context menus", () => {
    expect(OVERLAY_Z_INDEX.floatingPopover).toBeGreaterThan(OVERLAY_Z_INDEX.workspaceBase);
    expect(OVERLAY_Z_INDEX.contextMenu).toBeGreaterThan(OVERLAY_Z_INDEX.floatingPopover);
    expect(OVERLAY_Z_INDEX.dropdown).toBeGreaterThan(OVERLAY_Z_INDEX.contextMenu);
    expect(OVERLAY_Z_INDEX.tooltip).toBeGreaterThan(OVERLAY_Z_INDEX.dropdown);
  });

  it("dispatches overlay activity when the first overlay opens and the last one closes", () => {
    const listener = vi.fn();
    window.addEventListener(OVERLAY_ACTIVITY_EVENT, listener);

    setGlobalOverlayActivity("test-a", true);
    setGlobalOverlayActivity("test-b", true);
    setGlobalOverlayActivity("test-a", false);
    setGlobalOverlayActivity("test-b", false);

    window.removeEventListener(OVERLAY_ACTIVITY_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ detail: { active: true } });
    expect(listener.mock.calls[1]?.[0]).toMatchObject({ detail: { active: false } });
  });
});
