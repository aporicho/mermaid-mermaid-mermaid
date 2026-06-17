// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useViewportScheduler } from "@/features/mermaid-editor/lib/interaction/viewport-scheduler";

type SchedulerApi<T> = ReturnType<typeof useViewportScheduler<T>>;

type HarnessProps<T> = {
  initialValue: T;
  applyVisual: (value: T) => void;
  commit: (value: T) => void;
  onScheduler: (scheduler: SchedulerApi<T>) => void;
};

function Harness<T>({ initialValue, applyVisual, commit, onScheduler }: HarnessProps<T>) {
  const scheduler = useViewportScheduler<T>({
    initialValue,
    metricName: "viewport-scheduler-test",
    commitDelayMs: 25,
    applyVisual,
    commit
  });

  useEffect(() => {
    onScheduler(scheduler);
  }, [onScheduler, scheduler]);

  return null;
}

describe("useViewportScheduler", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("applies and commits falsy scheduled values", () => {
    vi.useFakeTimers();

    let animationFrame: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const applyVisual = vi.fn();
    const commit = vi.fn();
    const schedulerRef: { current: SchedulerApi<number> | null } = { current: null };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        createElement(Harness<number>, {
          initialValue: 10,
          applyVisual,
          commit,
          onScheduler: (value) => {
            schedulerRef.current = value;
          }
        })
      );
    });

    if (!schedulerRef.current) {
      throw new Error("Expected scheduler to be mounted.");
    }
    const activeScheduler = schedulerRef.current;

    act(() => {
      activeScheduler.schedule(0);
    });

    expect(activeScheduler.current()).toBe(0);

    act(() => {
      animationFrame?.(performance.now());
    });

    expect(applyVisual).toHaveBeenCalledWith(0);

    act(() => {
      vi.advanceTimersByTime(25);
    });

    expect(commit).toHaveBeenCalledWith(0);
  });
});
