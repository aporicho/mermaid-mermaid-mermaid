import { useCallback, useEffect, useRef } from "react";

import { recordPerformanceMetric } from "@/features/mermaid-editor/lib/editor-performance";

export type ViewportSchedulerOptions<T> = {
  initialValue: T;
  metricName: string;
  commitDelayMs?: number;
  applyVisual: (value: T) => void;
  commit: (value: T) => void;
  onSchedule?: () => void;
};

export function useViewportScheduler<T>({
  initialValue,
  metricName,
  commitDelayMs = 80,
  applyVisual,
  commit,
  onSchedule
}: ViewportSchedulerOptions<T>) {
  const pendingRef = useRef<T | null>(null);
  const visualRef = useRef<T>(initialValue);
  const rafRef = useRef<number | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const commitValueRef = useRef<T | null>(null);
  const applyVisualRef = useRef(applyVisual);
  const commitRef = useRef(commit);
  const onScheduleRef = useRef(onSchedule);

  useEffect(() => {
    applyVisualRef.current = applyVisual;
  }, [applyVisual]);

  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  useEffect(() => {
    onScheduleRef.current = onSchedule;
  }, [onSchedule]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    };
  }, []);

  const current = useCallback(() => pendingRef.current || visualRef.current, []);

  const sync = useCallback((value: T, options: { applyVisual?: boolean } = {}) => {
    pendingRef.current = null;
    visualRef.current = value;
    commitValueRef.current = null;

    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    if (options.applyVisual) {
      applyVisualRef.current(value);
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = value;
      visualRef.current = value;
      commitValueRef.current = value;
      onScheduleRef.current?.();

      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = window.setTimeout(() => {
        const valueToCommit = commitValueRef.current;
        commitValueRef.current = null;
        commitTimerRef.current = null;
        if (valueToCommit !== null) commitRef.current(valueToCommit);
      }, commitDelayMs);

      if (rafRef.current !== null) return;
      const scheduledAt = performance.now();
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending !== null) {
          applyVisualRef.current(pending);
          recordPerformanceMetric(metricName, performance.now() - scheduledAt);
        }
      });
    },
    [commitDelayMs, metricName]
  );

  return {
    current,
    schedule,
    sync,
    visualRef
  };
}
