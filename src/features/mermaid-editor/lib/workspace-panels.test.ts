import { describe, expect, it } from "vitest";

import { MARKDOWN_WINDOW_A4_SIZE, WORKSPACE_PANEL_DEFAULT_SIZES } from "@/features/mermaid-editor/lib/workspace-panels";

describe("workspace panel defaults", () => {
  it("opens detached Markdown documents at the portrait A4 aspect ratio", () => {
    expect(WORKSPACE_PANEL_DEFAULT_SIZES.markdown).toBe(MARKDOWN_WINDOW_A4_SIZE);
    expect(MARKDOWN_WINDOW_A4_SIZE.width / MARKDOWN_WINDOW_A4_SIZE.height).toBe(210 / 297);
  });
});
