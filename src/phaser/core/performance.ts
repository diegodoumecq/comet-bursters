export function withPerformanceMeasure<T>(name: string, enabled: boolean, callback: () => T): T {
  if (!enabled || typeof performance === 'undefined') return callback();

  const start = `${name}:start`;
  const end = `${name}:end`;
  performance.mark(start);
  try {
    return callback();
  } finally {
    performance.mark(end);
    performance.measure(name, start, end);
    performance.clearMarks(start);
    performance.clearMarks(end);
    performance.clearMeasures(name);
  }
}
