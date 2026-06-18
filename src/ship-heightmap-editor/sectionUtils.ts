import type { PlayerShipHeightmapConfig } from '../phaser/player/shipHeightmapConfig';
import { PLAYER_SHIP_MATERIAL_DEBUG_COLORS, type PlayerShipMaterial } from '../phaser/player/shipHeightmapMaterials';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatNumber(value: number): string {
  return value.toFixed(3);
}

export function getMaterialColor(material: PlayerShipMaterial): string {
  const [red, green, blue] = PLAYER_SHIP_MATERIAL_DEBUG_COLORS[material];
  return `rgb(${red}, ${green}, ${blue})`;
}

export function readFiniteInput(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

export function getConfigNumber(config: PlayerShipHeightmapConfig, path: readonly string[]): number {
  let current: unknown = config;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return 0;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'number' ? current : 0;
}

export function getControlInputId(sectionTitle: string, controlLabel: string): string {
  return `heightmap-${sectionTitle}-${controlLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
