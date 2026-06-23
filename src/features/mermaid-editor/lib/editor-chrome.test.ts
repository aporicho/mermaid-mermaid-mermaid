import { describe, expect, it } from "vitest";

import { EDITOR_CHROME_TOKENS, FLOATING_CHROME_PLACEMENTS } from "@/features/mermaid-editor/lib/editor-chrome";

describe("editor chrome tokens", () => {
  it("defines stable semantic control sizes", () => {
    expect(EDITOR_CHROME_TOKENS.layoutGridPx).toBe(8);
    expect(EDITOR_CHROME_TOKENS.floatingButtonPx).toBe(48);
    expect(EDITOR_CHROME_TOKENS.panelIconButtonPx).toBe(32);
    expect(EDITOR_CHROME_TOKENS.menuRowHeightPx).toBe(32);
    expect(EDITOR_CHROME_TOKENS.treeRowHeightPx).toBe(32);
  });

  it("keeps floating slots on explicit edge placements", () => {
    expect(FLOATING_CHROME_PLACEMENTS.topLeft.rootClassName).toContain("left-0");
    expect(FLOATING_CHROME_PLACEMENTS.topRight.rootClassName).toContain("right-0");
    expect(FLOATING_CHROME_PLACEMENTS.rightBottom.hotZoneClassName).toContain("w-36");
  });
});
