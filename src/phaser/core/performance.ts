type PerformanceSample = {
  count: number;
  max: number;
  min: number;
  total: number;
};

type SandboxPerformanceProfiler = {
  clear: () => void;
  record: (name: string, duration: number) => void;
  snapshot: () => Record<string, PerformanceSample & { average: number }>;
};

declare global {
  interface Window {
    __cometBurstersPerf?: SandboxPerformanceProfiler;
  }
}

export function withPerformanceMeasure<T>(name: string, enabled: boolean, callback: () => T): T {
  if (!enabled || typeof performance === 'undefined') return callback();

  const start = `${name}:start`;
  const end = `${name}:end`;
  performance.mark(start);
  try {
    return callback();
  } finally {
    performance.mark(end);
    const measure = performance.measure(name, start, end);
    getSandboxPerformanceProfiler().record(name, measure.duration);
    performance.clearMarks(start);
    performance.clearMarks(end);
    performance.clearMeasures(name);
  }
}

function getSandboxPerformanceProfiler(): SandboxPerformanceProfiler {
  if (typeof window === 'undefined') return createSandboxPerformanceProfiler();

  const existing = window.__cometBurstersPerf;
  if (existing) return existing;

  const profiler = createSandboxPerformanceProfiler();
  window.__cometBurstersPerf = profiler;
  return profiler;
}

function createSandboxPerformanceProfiler(): SandboxPerformanceProfiler {
  const samples = new Map<string, PerformanceSample>();

  return {
    clear: () => samples.clear(),
    record: (name, duration) => {
      const sample = samples.get(name);
      if (sample) {
        sample.count += 1;
        sample.total += duration;
        sample.min = Math.min(sample.min, duration);
        sample.max = Math.max(sample.max, duration);
        return;
      }
      samples.set(name, {
        count: 1,
        max: duration,
        min: duration,
        total: duration,
      });
    },
    snapshot: () =>
      Object.fromEntries(
        [...samples.entries()].map(([name, sample]) => [
          name,
          {
            ...sample,
            average: sample.total / sample.count,
          },
        ]),
      ),
  };
}
