import type { Planet } from '@/constants';

const tintedColorCache = new Map<string, string>();
const alphaColorCache = new Map<string, string>();

export function polarPoint(radius: number, angle: number): { x: number; y: number } {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const normalized = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const int = Number.parseInt(normalized, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToString(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function tintColor(hex: string, amount: number): string {
  const key = `${hex}|${amount}`;
  const cached = tintedColorCache.get(key);
  if (cached) {
    return cached;
  }

  const base = hexToRgb(hex);
  const target: [number, number, number] = amount >= 0 ? [255, 255, 255] : [10, 14, 26];
  const t = Math.abs(amount);
  const color = rgbToString([
    mixChannel(base[0], target[0], t),
    mixChannel(base[1], target[1], t),
    mixChannel(base[2], target[2], t),
  ]);
  tintedColorCache.set(key, color);
  return color;
}

export function alphaColor(hex: string, alpha: number): string {
  const key = `${hex}|${alpha}`;
  const cached = alphaColorCache.get(key);
  if (cached) {
    return cached;
  }

  const [r, g, b] = hexToRgb(hex);
  const color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  alphaColorCache.set(key, color);
  return color;
}

export interface CraterExclusionZone {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  padding?: number;
}

function intersectsExclusionZone(
  x: number,
  y: number,
  craterRadius: number,
  exclusionZones: CraterExclusionZone[],
): boolean {
  for (const zone of exclusionZones) {
    const padding = zone.padding ?? 0;
    const radiusX = zone.radiusX + craterRadius + padding;
    const radiusY = zone.radiusY + craterRadius + padding;
    const dx = x - zone.x;
    const dy = y - zone.y;
    const distance = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
    if (distance <= 1) {
      return true;
    }
  }

  return false;
}

export function drawCraters(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
  count: number,
  shadow = 'rgba(18, 24, 38, 0.2)',
  exclusionZones: CraterExclusionZone[] = [],
): void {
  for (let i = 0; i < count; i++) {
    const craterAngle = planet.rotation * 0.55 + i * 1.07;
    const craterDistance = radius * (0.18 + (i % 3) * 0.16);
    const crater = polarPoint(craterDistance, craterAngle);
    const craterRadius = radius * (0.055 + (i % 2) * 0.018);

    if (intersectsExclusionZone(crater.x, crater.y, craterRadius, exclusionZones)) {
      continue;
    }

    const squash = 0.76 + (i % 3) * 0.06;
    const rotation = craterAngle + 0.35;

    ctx.save();
    ctx.translate(crater.x, crater.y);
    ctx.rotate(rotation);

    const basinGradient = ctx.createRadialGradient(
      -craterRadius * 0.1,
      -craterRadius * 0.12,
      craterRadius * 0.08,
      0,
      0,
      craterRadius * 1.02,
    );
    basinGradient.addColorStop(0, 'rgba(255, 255, 255, 0.018)');
    basinGradient.addColorStop(0.22, 'rgba(255, 255, 255, 0.008)');
    basinGradient.addColorStop(0.72, shadow.replace(/[\d.]+\)$/, '0.09)'));
    basinGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = basinGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, craterRadius, craterRadius * squash, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = Math.max(0.6, radius * 0.0045);
    ctx.beginPath();
    ctx.ellipse(
      -craterRadius * 0.02,
      -craterRadius * 0.02,
      craterRadius * 1.01,
      craterRadius * (squash * 0.98),
      0,
      Math.PI * 1.12,
      Math.PI * 1.66,
    );
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = Math.max(0.6, radius * 0.0045);
    ctx.beginPath();
    ctx.ellipse(
      craterRadius * 0.02,
      craterRadius * 0.03,
      craterRadius * 0.98,
      craterRadius * (squash * 0.94),
      0,
      Math.PI * 0.12,
      Math.PI * 0.86,
    );
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.beginPath();
    ctx.ellipse(
      craterRadius * 0.1,
      craterRadius * 0.08,
      craterRadius * 0.5,
      craterRadius * (squash * 0.34),
      0.15,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.restore();
  }
}
