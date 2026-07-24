// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  installAutoHidingScrollbars,
  SCROLLBAR_ACTIVE_CLASS
} from "@/lib/auto-hiding-scrollbars";

describe("auto-hiding scrollbars", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("shows a scrollbar while its element is scrolling and hides it after the delay", () => {
    vi.useFakeTimers();
    const scrollElement = document.createElement("div");
    document.body.appendChild(scrollElement);
    const uninstall = installAutoHidingScrollbars(document, 700);

    scrollElement.dispatchEvent(new Event("scroll"));
    expect(scrollElement.classList.contains(SCROLLBAR_ACTIVE_CLASS)).toBe(true);

    vi.advanceTimersByTime(699);
    expect(scrollElement.classList.contains(SCROLLBAR_ACTIVE_CLASS)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(scrollElement.classList.contains(SCROLLBAR_ACTIVE_CLASS)).toBe(false);
    uninstall();
  });

  it("restarts the hide delay on continued scrolling and cleans up active elements", () => {
    vi.useFakeTimers();
    const scrollElement = document.createElement("div");
    document.body.appendChild(scrollElement);
    const uninstall = installAutoHidingScrollbars(document, 700);

    scrollElement.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(600);
    scrollElement.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(600);
    expect(scrollElement.classList.contains(SCROLLBAR_ACTIVE_CLASS)).toBe(true);

    uninstall();
    expect(scrollElement.classList.contains(SCROLLBAR_ACTIVE_CLASS)).toBe(false);
  });
});
