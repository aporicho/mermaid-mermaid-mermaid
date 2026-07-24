import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  createEmbeddedBrowserTitlebarHotZone,
  mouseInsideTitlebarHotZone,
  normalizeTitlebarHotZoneHeight
} = require("./embedded-browser-titlebar-hot-zone.cjs") as {
  createEmbeddedBrowserTitlebarHotZone: (options: {
    webContents: EventEmitter;
    initialHeight?: number;
    send: (inside: boolean) => void;
  }) => { setHeight: (height: number) => void; reset: () => void; dispose: () => void };
  mouseInsideTitlebarHotZone: (mouse: { type: string; y: number }, height: number) => boolean;
  normalizeTitlebarHotZoneHeight: (value: number) => number;
};

describe("embedded browser titlebar hot zone", () => {
  it("uses the complete measured titlebar height", () => {
    expect(mouseInsideTitlebarHotZone({ type: "mouseMove", y: 39 }, 40)).toBe(true);
    expect(mouseInsideTitlebarHotZone({ type: "mouseMove", y: 40 }, 40)).toBe(false);
    expect(mouseInsideTitlebarHotZone({ type: "mouseLeave", y: 1 }, 40)).toBe(false);
    expect(normalizeTitlebarHotZoneHeight(39.2)).toBe(40);
  });

  it("deduplicates transitions and releases the page when disabled", () => {
    const webContents = new EventEmitter();
    const send = vi.fn();
    const hotZone = createEmbeddedBrowserTitlebarHotZone({ webContents, initialHeight: 40, send });
    const prevented = vi.fn();

    webContents.emit("before-mouse-event", { preventDefault: prevented }, { type: "mouseMove", y: 20 });
    webContents.emit("before-mouse-event", { preventDefault: prevented }, { type: "mouseMove", y: 18 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith(true);
    expect(prevented).toHaveBeenCalledTimes(2);

    hotZone.setHeight(0);
    expect(send).toHaveBeenLastCalledWith(false);
    hotZone.dispose();
    expect(webContents.listenerCount("before-mouse-event")).toBe(0);
  });
});
