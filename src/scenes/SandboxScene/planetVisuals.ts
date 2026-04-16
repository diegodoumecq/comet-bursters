import { PLANET_CONFIG, type Planet } from '@/constants';

import { tracePlanetShape } from './planetShapes';
import { PLANET_SHELL_STYLES } from './planetStyles';
import { drawPlanetSurface } from './planetSurfaces';
import { polarPoint, tintColor } from './planetSurfaces/shared';

const PLANET_CACHE_PADDING = 40;
const PLANET_ROTATION_BUCKETS = 24;
const PLANET_RENDER_VERSION = 'v2';
const planetSpriteCache = new Map<string, HTMLCanvasElement>();

function withAlpha(color: string, alpha: number): string {
  return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
}

function drawDesertBaseGradient(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
  lightOffset: { x: number; y: number },
): void {
  if (planet.kind !== 'desert') {
    return;
  }

  const baseGradient = ctx.createLinearGradient(
    lightOffset.x * 1.05,
    lightOffset.y * 1.05,
    -lightOffset.x * 1.45,
    -lightOffset.y * 1.45,
  );
  baseGradient.addColorStop(0, 'rgba(255, 222, 118, 0.03)');
  baseGradient.addColorStop(0.28, 'rgba(212, 154, 72, 0.11)');
  baseGradient.addColorStop(1, 'rgba(110, 34, 18, 0.54)');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);
}

function drawStyledPlanetToContext(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const radius = PLANET_CONFIG.radius;
  const style = PLANET_SHELL_STYLES[planet.kind];
  const isToxic = planet.kind === 'toxic';
  const lightAngle = -Math.PI / 3;
  const lightOffset = polarPoint(radius * 0.45, lightAngle);

  ctx.save();
  ctx.translate(planet.x, planet.y);

  ctx.shadowColor = tintColor(planet.color, style.glowTint);
  ctx.shadowBlur = style.glowBlur;
  ctx.strokeStyle = `rgba(255, 255, 255, ${style.glowStrokeAlpha})`;
  ctx.lineWidth = style.glowLineWidth;
  tracePlanetShape(ctx, planet, radius, style.glowScale);
  ctx.stroke();
  ctx.shadowBlur = 0;

  tracePlanetShape(ctx, planet, radius);
  const shellGradient = ctx.createRadialGradient(
    lightOffset.x,
    lightOffset.y,
    radius * 0.12,
    0,
    0,
    radius * 1.08,
  );
  shellGradient.addColorStop(0, tintColor(planet.color, style.shellInnerTint));
  shellGradient.addColorStop(style.shellMidStop, tintColor(planet.color, style.shellMidTint));
  shellGradient.addColorStop(style.shellBaseStop, planet.color);
  shellGradient.addColorStop(1, tintColor(planet.color, style.shellOuterTint));
  ctx.fillStyle = shellGradient;
  ctx.fill();

  const baseOverlayGradient = ctx.createLinearGradient(
    radius * style.baseOverlayStartX,
    radius * style.baseOverlayStartY,
    radius * style.baseOverlayEndX,
    radius * style.baseOverlayEndY,
  );
  baseOverlayGradient.addColorStop(0, style.baseOverlayStart);
  baseOverlayGradient.addColorStop(0.48, style.baseOverlayMid);
  baseOverlayGradient.addColorStop(1, style.baseOverlayEnd);
  ctx.fillStyle = baseOverlayGradient;
  tracePlanetShape(ctx, planet, radius);
  ctx.fill();

  ctx.save();
  tracePlanetShape(ctx, planet, radius);
  ctx.clip();

  drawDesertBaseGradient(planet, ctx, radius, lightOffset);
  drawPlanetSurface(planet, ctx, radius);

  if (!isToxic) {
    const shellLightOverlay = ctx.createRadialGradient(
      lightOffset.x,
      lightOffset.y,
      radius * 0.12,
      0,
      0,
      radius * 1.08,
    );
    shellLightOverlay.addColorStop(0, withAlpha(tintColor(planet.color, style.shellInnerTint), 0.06));
    shellLightOverlay.addColorStop(
      Math.max(0.18, style.shellMidStop - 0.08),
      withAlpha(tintColor(planet.color, style.shellMidTint), 0.025),
    );
    shellLightOverlay.addColorStop(style.shellBaseStop, withAlpha(planet.color, 0.008));
    shellLightOverlay.addColorStop(1, withAlpha(tintColor(planet.color, style.shellOuterTint), 0.015));
    ctx.fillStyle = shellLightOverlay;
    ctx.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);
  }

  const shadeGradient = ctx.createLinearGradient(
    radius * style.shadeStartX,
    radius * style.shadeStartY,
    radius * style.shadeEndX,
    radius * style.shadeEndY,
  );
  shadeGradient.addColorStop(0, style.shadeStart);
  shadeGradient.addColorStop(0.45, style.shadeMid);
  shadeGradient.addColorStop(1, style.shadeEnd);
  ctx.fillStyle = shadeGradient;
  ctx.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);

  if (!isToxic) {
    const rimGradient = ctx.createLinearGradient(
      -radius * 0.6,
      -radius * 0.7,
      radius * 0.55,
      radius * 0.45,
    );
    rimGradient.addColorStop(0, `rgba(255, 255, 255, ${style.rimStartAlpha})`);
    rimGradient.addColorStop(0.28, `rgba(255, 255, 255, ${style.rimMidAlpha})`);
    rimGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = rimGradient;
    ctx.lineWidth = style.rimLineWidth;
    tracePlanetShape(ctx, planet, radius * 0.98);
    ctx.stroke();
  }
  ctx.restore();

  if (!isToxic) {
    const atmosphereGradient = ctx.createRadialGradient(
      lightOffset.x * 0.2,
      lightOffset.y * 0.2,
      radius * style.atmosphereInnerRadius,
      0,
      0,
      radius * style.atmosphereOuterRadius,
    );
    atmosphereGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    atmosphereGradient.addColorStop(
      style.atmosphereStart,
      `${tintColor(planet.color, 0.35).replace('rgb', 'rgba').replace(')', `, ${style.atmosphereAlpha})`)}`,
    );
    atmosphereGradient.addColorStop(
      1,
      `${tintColor(planet.color, 0.15).replace('rgb', 'rgba').replace(')', ', 0)')}`,
    );
    ctx.fillStyle = atmosphereGradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius * style.atmosphereOuterRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = tintColor(planet.color, style.outlineTint);
  ctx.lineWidth = style.outlineWidth;
  tracePlanetShape(ctx, planet, radius);
  ctx.stroke();

  ctx.restore();
}

function normalizeRotation(rotation: number): number {
  const fullTurn = Math.PI * 2;
  const normalized = rotation % fullTurn;
  return normalized < 0 ? normalized + fullTurn : normalized;
}

function getPlanetCacheKey(planet: Planet): string {
  const bucket = Math.round(
    (normalizeRotation(planet.rotation) / (Math.PI * 2)) * PLANET_ROTATION_BUCKETS,
  );
  return `${PLANET_RENDER_VERSION}|${planet.kind}|${planet.color}|${bucket % PLANET_ROTATION_BUCKETS}`;
}

function getPlanetSprite(planet: Planet): HTMLCanvasElement {
  const cacheKey = getPlanetCacheKey(planet);
  const cached = planetSpriteCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const radius = PLANET_CONFIG.radius;
  const extent = radius * 1.3 + PLANET_CACHE_PADDING;
  const size = Math.ceil(extent * 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const spriteCtx = canvas.getContext('2d');
  if (!spriteCtx) {
    return canvas;
  }

  spriteCtx.translate(size / 2, size / 2);
  drawStyledPlanetToContext({ ...planet, x: 0, y: 0 }, spriteCtx);

  planetSpriteCache.set(cacheKey, canvas);
  return canvas;
}

export function drawStyledPlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const sprite = getPlanetSprite(planet);
  ctx.drawImage(sprite, planet.x - sprite.width / 2, planet.y - sprite.height / 2);
}
