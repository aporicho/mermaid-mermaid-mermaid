import { describe, expect, it } from "vitest";

import { nextWorkspaceView, workspaceViewForDocument } from "@/features/mermaid-editor/lib/workspace-view";

describe("workspace view", () => {
  it("cycles all three views for editable flowcharts", () => {
    expect(nextWorkspaceView("canvas", "flowchart")).toBe("render");
    expect(nextWorkspaceView("render", "flowchart")).toBe("source");
    expect(nextWorkspaceView("source", "flowchart")).toBe("canvas");
  });

  it("skips canvas for render-only documents", () => {
    expect(nextWorkspaceView("render", "render-only")).toBe("source");
    expect(nextWorkspaceView("source", "render-only")).toBe("render");
    expect(workspaceViewForDocument("render-only", "canvas")).toBe("render");
  });

  it("uses markdown and source views for Markdown documents", () => {
    expect(nextWorkspaceView("markdown", "render-only", "markdown")).toBe("source");
    expect(nextWorkspaceView("source", "render-only", "markdown")).toBe("markdown");
    expect(workspaceViewForDocument("flowchart", "canvas", "markdown")).toBe("markdown");
    expect(workspaceViewForDocument("flowchart", "source", "markdown")).toBe("source");
  });
});
