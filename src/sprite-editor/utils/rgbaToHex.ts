import type { RgbaColor } from '../state/spriteEditorStore';
import { componentToHex } from './componentToHex';

export function rgbaToHex(color: RgbaColor): string {
  return `#${componentToHex(color.r)}${componentToHex(color.g)}${componentToHex(color.b)}`;
}
