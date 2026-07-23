import { describe, expect, it } from "vitest";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

describe("overlay layers", () => {
  it("uses small values that are local to isolated layer scopes", () => {
    expect(OVERLAY_Z_INDEX.workspaceBase).toBe(1);
    expect(OVERLAY_Z_INDEX.floatingPopover).toBe(1);
    expect(OVERLAY_Z_INDEX.contextMenu).toBe(1);
    expect(OVERLAY_Z_INDEX.dropdown).toBeGreaterThan(OVERLAY_Z_INDEX.contextMenu);
    expect(OVERLAY_Z_INDEX.tooltip).toBeGreaterThan(OVERLAY_Z_INDEX.dropdown);
    expect(Math.max(...Object.values(OVERLAY_Z_INDEX))).toBeLessThanOrEqual(4);
  });
});
