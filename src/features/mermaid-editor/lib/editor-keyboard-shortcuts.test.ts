import { describe, expect, it } from "vitest";

import { shouldCreateGroupFromShortcut, type CreateGroupShortcutInput } from "@/features/mermaid-editor/lib/editor-keyboard-shortcuts";

function shortcut(overrides: Partial<CreateGroupShortcutInput> = {}) {
  return shouldCreateGroupFromShortcut({
    key: "g",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    editable: true,
    hasSelection: true,
    ...overrides
  });
}

describe("editor keyboard shortcuts", () => {
  it("handles Ctrl+G and Meta+G as group shortcuts", () => {
    expect(shortcut({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(shortcut({ ctrlKey: false, metaKey: true })).toBe(true);
    expect(shortcut({ key: "G", ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("requires editable canvas state and a current selection", () => {
    expect(shortcut({ editable: false })).toBe(false);
    expect(shortcut({ hasSelection: false })).toBe(false);
  });

  it("does not handle alternate group key combinations", () => {
    expect(shortcut({ shiftKey: true })).toBe(false);
    expect(shortcut({ altKey: true })).toBe(false);
    expect(shortcut({ ctrlKey: false, metaKey: false })).toBe(false);
    expect(shortcut({ key: "k" })).toBe(false);
  });

  it("ignores repeated keydown events to avoid nested group creation", () => {
    expect(shortcut({ repeat: true })).toBe(false);
  });
});
