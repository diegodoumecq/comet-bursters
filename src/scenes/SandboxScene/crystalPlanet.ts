import { PLANET_CONFIG, type Planet } from '@/constants';

import { tracePlanetShape } from './planetShapes';
import { PLANET_SHELL_STYLES } from './planetStyles';
import { drawCrystalCrescent, drawCrystalSurface } from './planetSurfaces/crystal';
import { polarPoint, tintColor } from './planetSurfaces/shared';

function withAlpha(color: string, alpha: number): string {
  return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
}

export function drawCrystalPlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const radius = PLANET_CONFIG.radius;
  const style = PLANET_SHELL_STYLES.crystal;
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

  ctx.save();
  tracePlanetShape(ctx, planet, radius);
  ctx.clip();

  const shellLightOverlay = ctx.createRadialGradient(
    lightOffset.x,
    lightOffset.y,
    radius * 0.12,
    0,
    0,
    radius * 1.08,
  );
  shellLightOverlay.addColorStop(0, withAlpha(tintColor(planet.color, style.shellInnerTint), 0.18));
  shellLightOverlay.addColorStop(
    Math.max(0.18, style.shellMidStop - 0.08),
    withAlpha(tintColor(planet.color, style.shellMidTint), 0.08),
  );
  shellLightOverlay.addColorStop(style.shellBaseStop, withAlpha(planet.color, 0.02));
  shellLightOverlay.addColorStop(1, withAlpha(tintColor(planet.color, style.shellOuterTint), 0.04));
  ctx.fillStyle = shellLightOverlay;
  ctx.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);

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

  drawCrystalSurface(planet, ctx, radius);
  drawCrystalCrescent(ctx, radius);
  ctx.restore();

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

  ctx.save();
  tracePlanetShape(ctx, planet, radius);
  ctx.clip();
  drawCrystalCrescent(ctx, radius);
  ctx.restore();

  ctx.strokeStyle = tintColor(planet.color, style.outlineTint);
  ctx.lineWidth = style.outlineWidth;
  tracePlanetShape(ctx, planet, radius);
  ctx.stroke();

  ctx.restore();
}
