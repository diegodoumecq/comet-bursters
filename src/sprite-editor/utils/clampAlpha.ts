export function clampAlpha(alpha: number): number {
  return Math.max(0, Math.min(255, alpha));
}
