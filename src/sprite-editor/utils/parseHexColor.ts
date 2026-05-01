import type { RgbaColor } from '../state/spriteEditorStore';

export function parseHexColor(value: string): RgbaColor {
  const normalized = value.replace('#', '');
  const safeValue = normalized.length === 6 ? normalized : 'ffffff';
  return {
    r: Number.parseInt(safeValue.slice(0, 2), 16),
    g: Number.parseInt(safeValue.slice(2, 4), 16),
    b: Number.parseInt(safeValue.slice(4, 6), 16),
    a: 255,
  };
}
