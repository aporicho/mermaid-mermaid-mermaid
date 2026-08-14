import { describe, expect, it } from "vitest";

import { workspaceNativeSurfaceTopInset } from "@/features/mermaid-editor/components/floating-chrome/workspace-native-surface-frame";

describe("workspace native surface frame", () => {
  it("reserves no visible strip while the native titlebar is hidden", () => {
    expect(workspaceNativeSurfaceTopInset(false, false)).toBe("0px");
    expect(workspaceNativeSurfaceTopInset(true, true)).toBe("var(--theme-panel-header-height)");
    expect(workspaceNativeSurfaceTopInset(true, true, 42)).toBe("42px");
    expect(workspaceNativeSurfaceTopInset(true, false, 42)).toBe("0px");
  });
});
