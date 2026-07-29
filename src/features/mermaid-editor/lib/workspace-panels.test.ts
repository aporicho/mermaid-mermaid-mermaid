import { describe, expect, it } from "vitest";

import { htmlWindowPanelId, MARKDOWN_WINDOW_A4_SIZE, resolveFullscreenWorkspacePanel, WORKSPACE_PANEL_DEFAULT_SIZES } from "@/features/mermaid-editor/lib/workspace-panels";

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

  it("opens terminals in a large 4:3 working window", () => {
    expect(WORKSPACE_PANEL_DEFAULT_SIZES.terminal).toEqual({ width: 960, height: 720 });
    expect(WORKSPACE_PANEL_DEFAULT_SIZES.terminal.width / WORKSPACE_PANEL_DEFAULT_SIZES.terminal.height).toBe(4 / 3);
  });

  it("resolves only an open fullscreen panel from the top of the workspace stack", () => {
    expect(resolveFullscreenWorkspacePanel(
      ["terminal", "image:/project/cover.png", "agent"],
      ["terminal", "image:/project/cover.png"],
      { terminal: "normal", "image:/project/cover.png": "fullscreen", agent: "fullscreen" }
    )).toBe("image:/project/cover.png");
    expect(resolveFullscreenWorkspacePanel(["terminal"], [], { terminal: "fullscreen" })).toBeNull();
  });
});
