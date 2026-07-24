import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { attachWindowFullscreenEvents, registerWindowFullscreenIpc } = require("./window-fullscreen.cjs") as {
  attachWindowFullscreenEvents: (window: FakeWindow) => void;
  registerWindowFullscreenIpc: (input: { ipcMain: { handle: (channel: string, handler: (event: { sender: unknown }) => unknown) => void }; BrowserWindow: { fromWebContents: (sender: unknown) => FakeWindow } }) => void;
};

class FakeWindow extends EventEmitter {
  fullscreen = false;
  webContents = { send: vi.fn() };
  isDestroyed = () => false;
  isFullScreen = () => this.fullscreen;
  setFullScreen = vi.fn((fullscreen: boolean) => { this.fullscreen = fullscreen; });
}

describe("Electron window fullscreen bridge", () => {
  it("toggles native fullscreen and broadcasts native state changes", () => {
    const handlers = new Map<string, (event: { sender: unknown }) => unknown>();
    const window = new FakeWindow();
    registerWindowFullscreenIpc({
      ipcMain: { handle: (channel, handler) => { handlers.set(channel, handler); } },
      BrowserWindow: { fromWebContents: () => window }
    });

    expect(handlers.get("mmm:window:is-fullscreen")?.({ sender: {} })).toBe(false);
    expect(handlers.get("mmm:window:toggle-fullscreen")?.({ sender: {} })).toBe(true);
    expect(window.setFullScreen).toHaveBeenCalledWith(true);

    attachWindowFullscreenEvents(window);
    window.emit("enter-full-screen");
    expect(window.webContents.send).toHaveBeenCalledWith("mmm:window:fullscreen-changed", true);
  });
});
