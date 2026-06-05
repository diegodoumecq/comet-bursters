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

type PerformanceFrame = {
  end: () => void;
  startSection: (name: string) => void;
};

declare global {
  interface Window {
    __cometBurstersPerf?: SandboxPerformanceProfiler;
  }
}

export function withPerformanceMeasure<T>(name: string, enabled: boolean, callback: () => T): T {
  if (!enabled || typeof performance === 'undefined') return callback();

  const start = performance.now();
  try {
    return callback();
  } finally {
    getSandboxPerformanceProfiler().record(name, performance.now() - start);
  }
}

export function startPerformanceFrame(totalName: string, enabled: boolean): PerformanceFrame {
  if (!enabled || typeof performance === 'undefined') return noopPerformanceFrame;

  const profiler = getSandboxPerformanceProfiler();
  const totalStart = performance.now();
  let sectionName: string | null = null;
  let sectionStart = totalStart;
  let ended = false;

  const finishSection = (now: number) => {
    if (sectionName) profiler.record(sectionName, now - sectionStart);
    sectionName = null;
  };

  return {
    end: () => {
      if (!ended) {
        const now = performance.now();
        finishSection(now);
        profiler.record(totalName, now - totalStart);
        ended = true;
      }
    },
    startSection: (name: string) => {
      if (!ended) {
        const now = performance.now();
        finishSection(now);
        sectionName = name;
        sectionStart = now;
      }
    },
  };
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

const noopPerformanceFrame: PerformanceFrame = {
  end: () => undefined,
  startSection: () => undefined,
};
