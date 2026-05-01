export function clampZoom(value: number): number {
  return Math.max(2, Math.min(48, Math.round(value)));
}
