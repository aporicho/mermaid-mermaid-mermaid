import { describe, expect, it } from "vitest";

import { FLOATING_CHROME_HIDE_DELAY_MS, shouldRevealFloatingGroup } from "@/features/mermaid-editor/lib/floating-chrome";

describe("floating chrome", () => {
  it("reveals a group while hovered, focused, or pinned", () => {
    expect(shouldRevealFloatingGroup({ hovered: true })).toBe(true);
    expect(shouldRevealFloatingGroup({ focusWithin: true })).toBe(true);
    expect(shouldRevealFloatingGroup({ pinned: true })).toBe(true);
    expect(shouldRevealFloatingGroup({})).toBe(false);
  });

  it("uses a short delayed hide interval", () => {
    expect(FLOATING_CHROME_HIDE_DELAY_MS).toBe(500);
  });
});
