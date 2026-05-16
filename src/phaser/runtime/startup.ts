export function getStartingWave(): number {
  const raw = new URLSearchParams(window.location.search).get('startingWave');
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 1;
}
