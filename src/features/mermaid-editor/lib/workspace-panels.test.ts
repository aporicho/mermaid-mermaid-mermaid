import { describe, expect, it } from "vitest";

import { htmlWindowPanelId, MARKDOWN_WINDOW_A4_SIZE, WORKSPACE_PANEL_DEFAULT_SIZES } from "@/features/mermaid-editor/lib/workspace-panels";

describe("workspace panel defaults", () => {
  it("opens detached Markdown documents at the portrait A4 aspect ratio", () => {
    expect(WORKSPACE_PANEL_DEFAULT_SIZES.markdown).toBe(MARKDOWN_WINDOW_A4_SIZE);
    expect(MARKDOWN_WINDOW_A4_SIZE).toEqual({ width: 1050, height: 1485 });
    expect(MARKDOWN_WINDOW_A4_SIZE.width / MARKDOWN_WINDOW_A4_SIZE.height).toBe(210 / 297);
  });

  it("gives HTML previews a stable panel identity and browser-sized frame", () => {
    expect(htmlWindowPanelId({ name: "index.html", path: "/project/index.html" })).toBe("html:/project/index.html");
    expect(WORKSPACE_PANEL_DEFAULT_SIZES.html).toEqual(WORKSPACE_PANEL_DEFAULT_SIZES.browser);
  });
});
