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
  it("intercepts only coordinates inside the configured top-edge strip", () => {
    expect(mouseInsideTitlebarHotZone({ type: "mouseMove", y: 7 }, 8)).toBe(true);
    expect(mouseInsideTitlebarHotZone({ type: "mouseMove", y: 8 }, 8)).toBe(false);
    expect(mouseInsideTitlebarHotZone({ type: "mouseLeave", y: 1 }, 8)).toBe(false);
    expect(normalizeTitlebarHotZoneHeight(7.2)).toBe(8);
  });

  it("deduplicates transitions and releases the page when disabled", () => {
    const webContents = new EventEmitter();
    const send = vi.fn();
    const hotZone = createEmbeddedBrowserTitlebarHotZone({ webContents, initialHeight: 8, send });
    const prevented = vi.fn();

    webContents.emit("before-mouse-event", { preventDefault: prevented }, { type: "mouseMove", y: 2 });
    webContents.emit("before-mouse-event", { preventDefault: prevented }, { type: "mouseMove", y: 6 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith(true);
    expect(prevented).toHaveBeenCalledTimes(2);

    hotZone.setHeight(0);
    expect(send).toHaveBeenLastCalledWith(false);
    hotZone.dispose();
    expect(webContents.listenerCount("before-mouse-event")).toBe(0);
  });
});
