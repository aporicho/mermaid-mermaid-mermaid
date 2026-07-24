import { describe, expect, it } from "vitest";

import { workspacePanelHeaderCssHeight } from "@/features/mermaid-editor/components/floating-chrome/floating-panel-contents";
import { workspaceNativeSurfaceTopInset } from "@/features/mermaid-editor/components/floating-chrome/workspace-native-surface-frame";

describe("workspace native surface frame", () => {
  it("reserves no visible strip while the native titlebar is hidden", () => {
    expect(workspaceNativeSurfaceTopInset(false, false)).toBe("0px");
    expect(workspaceNativeSurfaceTopInset(true, true)).toBe("var(--theme-panel-header-height)");
    expect(workspaceNativeSurfaceTopInset(true, true, 42)).toBe("42px");
    expect(workspaceNativeSurfaceTopInset(true, false, 42)).toBe("0px");
  });

  it("sizes the shared reveal zone from the measured titlebar", () => {
    expect(workspacePanelHeaderCssHeight(0)).toBe("var(--theme-panel-header-height)");
    expect(workspacePanelHeaderCssHeight(42)).toBe("42px");
  });
});
