import { describe, expect, it } from "vitest";

import { summarizePerformanceMetrics, type PerformanceStore } from "@/features/mermaid-editor/lib/editor-performance";

describe("editor performance helpers", () => {
  it("summarizes performance metrics with nearest-rank percentiles", () => {
    const store: PerformanceStore = {
      counters: {},
      metrics: [
        { name: "canvas-viewport-visual-latency", value: 8, at: 1 },
        { name: "canvas-viewport-visual-latency", value: 16, at: 2 },
        { name: "canvas-viewport-visual-latency", value: 4, at: 3 },
        { name: "canvas-viewport-visual-latency", value: 32, at: 4 },
        { name: "mermaid-render", value: 120, at: 5 }
      ]
    };

    expect(summarizePerformanceMetrics(store, "canvas-viewport-visual-latency")).toEqual({
      count: 4,
      p50: 8,
      p95: 32,
      max: 32
    });
  });

  it("returns null when a metric has no samples", () => {
    expect(summarizePerformanceMetrics({ counters: {}, metrics: [] }, "missing")).toBeNull();
  });
});
