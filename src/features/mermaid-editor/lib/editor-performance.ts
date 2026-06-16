type PerformanceMetric = {
  name: string;
  value: number;
  at: number;
  detail?: Record<string, number | string | boolean>;
};

type PerformanceStore = {
  metrics: PerformanceMetric[];
  counters: Record<string, number>;
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

function performanceStore(): PerformanceStore {
  window.__MERMAID_EDITOR_PERF__ ??= { metrics: [], counters: {} };
  return window.__MERMAID_EDITOR_PERF__;
}

function isPerformanceEnabled() {
  return typeof window !== "undefined" && process.env.NODE_ENV !== "production";
}
