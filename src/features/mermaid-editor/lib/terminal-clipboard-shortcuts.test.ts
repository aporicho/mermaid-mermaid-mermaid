// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { createTerminalClipboardKeyHandler } from "@/features/mermaid-editor/lib/terminal-clipboard-shortcuts";

describe("terminal clipboard shortcuts", () => {
  it("copies only the selected terminal text with Ctrl+Shift+C", async () => {
    const target = terminalTarget();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const handler = createTerminalClipboardKeyHandler({ terminal: target, readText: async () => "", writeText, isMac: false });

    expect(handler(keyboard("c", { ctrlKey: true, shiftKey: true }))).toBe(false);
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("selected output");
    expect(handler(keyboard("c", { ctrlKey: true }))).toBe(true);
  });

  it("pastes through xterm while preserving ordinary Ctrl+V input", async () => {
    const target = terminalTarget();
    const handler = createTerminalClipboardKeyHandler({ terminal: target, readText: async () => "line one\nline two", writeText: async () => undefined, isMac: false });

    expect(handler(keyboard("v", { ctrlKey: true, shiftKey: true }))).toBe(false);
    await Promise.resolve();
    expect(target.paste).toHaveBeenCalledWith("line one\nline two");
    expect(target.focus).toHaveBeenCalledOnce();
    expect(handler(keyboard("v", { ctrlKey: true }))).toBe(true);
  });

  it("supports macOS Command shortcuts and Shift+Insert", async () => {
    const target = terminalTarget();
    const readText = vi.fn().mockResolvedValue("clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    const macHandler = createTerminalClipboardKeyHandler({ terminal: target, readText, writeText, isMac: true });

    expect(macHandler(keyboard("c", { metaKey: true }))).toBe(false);
    expect(macHandler(keyboard("v", { metaKey: true }))).toBe(false);
    const linuxHandler = createTerminalClipboardKeyHandler({ terminal: target, readText, writeText, isMac: false });
    expect(linuxHandler(keyboard("Insert", { shiftKey: true }))).toBe(false);
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("selected output");
    expect(readText).toHaveBeenCalledTimes(2);
  });
});

function terminalTarget() {
  return {
    hasSelection: vi.fn(() => true),
    getSelection: vi.fn(() => "selected output"),
    paste: vi.fn(),
    focus: vi.fn()
  };
}

function keyboard(key: string, modifiers: KeyboardEventInit = {}) {
  return new KeyboardEvent("keydown", { key, ...modifiers });
}
