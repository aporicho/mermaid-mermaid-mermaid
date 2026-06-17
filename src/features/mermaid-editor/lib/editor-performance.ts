export type PerformanceMetric = {
  name: string;
  value: number;
  at: number;
  detail?: Record<string, number | string | boolean>;
};

export type PerformanceStore = {
  metrics: PerformanceMetric[];
  counters: Record<string, number>;
};

export type PerformanceSummary = {
  count: number;
  p50: number;
  p95: number;
  max: number;
};

declare global {
  interface Window {
    __MERMAID_EDITOR_PERF__?: PerformanceStore;
  }
}

const MAX_METRICS = 240;

export function recordPerformanceMetric(name: string, value: number, detail?: PerformanceMetric["detail"]) {
  if (!isPerformanceEnabled()) return;

  const store = performanceStore();
  store.metrics.push({ name, value, at: performance.now(), detail });
  if (store.metrics.length > MAX_METRICS) store.metrics.splice(0, store.metrics.length - MAX_METRICS);
}

export function incrementPerformanceCounter(name: string, amount = 1) {
  if (!isPerformanceEnabled()) return;

  const store = performanceStore();
  store.counters[name] = (store.counters[name] || 0) + amount;
}

export function measurePerformance<T>(name: string, run: () => T, detail?: PerformanceMetric["detail"]): T {
  if (!isPerformanceEnabled()) return run();

  const start = performance.now();
  try {
    return run();
  } finally {
    recordPerformanceMetric(name, performance.now() - start, detail);
  }
}

export async function measureAsyncPerformance<T>(name: string, run: () => Promise<T>, detail?: PerformanceMetric["detail"]): Promise<T> {
  if (!isPerformanceEnabled()) return run();

  const start = performance.now();
  try {
    return await run();
  } finally {
    recordPerformanceMetric(name, performance.now() - start, detail);
  }
}

export function summarizePerformanceMetrics(store: PerformanceStore | undefined, metricName: string): PerformanceSummary | null {
  const values = (store?.metrics || [])
    .filter((metric) => metric.name === metricName)
    .map((metric) => metric.value)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!values.length) return null;

  return {
    count: values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: values[values.length - 1]
  };
}

function performanceStore(): PerformanceStore {
  window.__MERMAID_EDITOR_PERF__ ??= { metrics: [], counters: {} };
  return window.__MERMAID_EDITOR_PERF__;
}

function isPerformanceEnabled() {
  return typeof window !== "undefined" && process.env.NODE_ENV !== "production";
}

function percentile(sortedValues: number[], ratio: number) {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index];
}
