// @vitest-environment jsdom

import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal as XtermTerminal } from "@xterm/xterm";
import { describe, expect, it, vi } from "vitest";

import { fitTerminalWithoutNativeScrollbar } from "@/features/mermaid-editor/lib/terminal-fit";

describe("fitTerminalWithoutNativeScrollbar", () => {
  it("uses the full terminal width instead of reserving xterm's native scrollbar gutter", () => {
    const parent = document.createElement("div");
    parent.style.width = "200px";
    const element = document.createElement("div");
    element.style.padding = "4px";
    parent.appendChild(element);
    document.body.appendChild(parent);

    const clear = vi.fn();
    const resize = vi.fn();
    const terminal = {
      cols: 17,
      rows: 5,
      element,
      resize,
      _core: {
        _renderService: {
          clear,
          dimensions: { css: { cell: { width: 10 } } }
        }
      }
    } as unknown as XtermTerminal;
    const fitAddon = {
      proposeDimensions: vi.fn(() => ({ cols: 17, rows: 5 })),
      fit: vi.fn()
    } as unknown as FitAddon;

    fitTerminalWithoutNativeScrollbar(terminal, fitAddon);

    expect(resize).toHaveBeenCalledWith(19, 5);
    expect(clear).toHaveBeenCalledOnce();
    expect(fitAddon.fit).not.toHaveBeenCalled();
    parent.remove();
  });
});
