export function clampBrushSize(size: number): number {
  return Math.max(1, Math.min(12, Math.round(size)));
}
