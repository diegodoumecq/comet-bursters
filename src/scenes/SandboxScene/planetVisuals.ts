import { PLANET_CONFIG, type Planet } from '@/constants';

function polarPoint(radius: number, angle: number): { x: number; y: number } {
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

function tintColor(hex: string, amount: number): string {
  const base = hexToRgb(hex);
  const target: [number, number, number] = amount >= 0 ? [255, 255, 255] : [10, 14, 26];
  const t = Math.abs(amount);
  return rgbToString([
    mixChannel(base[0], target[0], t),
    mixChannel(base[1], target[1], t),
    mixChannel(base[2], target[2], t),
  ]);
}

function alphaColor(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tracePlanetShape(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  radius: number,
  scale = 1,
): void {
  const numPoints = planet.altitudeVariations.length;

  ctx.beginPath();
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const variation = planet.altitudeVariations[i % numPoints];
    const r = radius * variation * scale;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function drawCraters(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
  count: number,
  shadow = 'rgba(18, 24, 38, 0.2)',
  highlight = 'rgba(255, 255, 255, 0.12)',
): void {
  for (let i = 0; i < count; i++) {
    const craterAngle = planet.rotation * 0.55 + i * 1.07;
    const craterDistance = radius * (0.18 + (i % 3) * 0.16);
    const crater = polarPoint(craterDistance, craterAngle);
    const craterRadius = radius * (0.08 + (i % 2) * 0.03);

    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(crater.x + radius * 0.04, crater.y + radius * 0.04, craterRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(
      crater.x - radius * 0.015,
      crater.y - radius * 0.015,
      craterRadius * 0.82,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawLushSurface(planet: Planet, ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.rotate(planet.rotation * 0.16);
  for (let i = 0; i < 4; i++) {
    const angle = i * 1.54 + planet.rotation * 0.28;
    const pos = polarPoint(radius * (0.18 + (i % 2) * 0.16), angle);

    ctx.fillStyle = i % 2 === 0 ? alphaColor('#1f7a3f', 0.34) : alphaColor('#2d8f4b', 0.28);
    ctx.beginPath();
    ctx.moveTo(pos.x - radius * 0.16, pos.y - radius * 0.04);
    ctx.bezierCurveTo(
      pos.x - radius * 0.05,
      pos.y - radius * 0.16,
      pos.x + radius * 0.14,
      pos.y - radius * 0.12,
      pos.x + radius * 0.18,
      pos.y + radius * 0.02,
    );
    ctx.bezierCurveTo(
      pos.x + radius * 0.08,
      pos.y + radius * 0.14,
      pos.x - radius * 0.1,
      pos.y + radius * 0.15,
      pos.x - radius * 0.18,
      pos.y + radius * 0.04,
    );
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = alphaColor('#b8f596', 0.1);
    ctx.beginPath();
    ctx.moveTo(pos.x - radius * 0.08, pos.y - radius * 0.02);
    ctx.quadraticCurveTo(pos.x, pos.y - radius * 0.08, pos.x + radius * 0.08, pos.y);
    ctx.quadraticCurveTo(pos.x, pos.y + radius * 0.04, pos.x - radius * 0.08, pos.y - radius * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  drawCraters(planet, ctx, radius, 4, 'rgba(18, 24, 38, 0.12)', 'rgba(255,255,255,0.08)');
}

function drawDesertSurface(planet: Planet, ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.rotate(planet.rotation * 0.12);

  for (let i = 0; i < 5; i++) {
    const angle = planet.rotation * 0.32 + i * 1.18;
    const pos = polarPoint(radius * (0.14 + (i % 3) * 0.15), angle);
    const mesaRadius = radius * (0.14 + (i % 2) * 0.04);

    ctx.fillStyle = i % 2 === 0 ? alphaColor('#b87722', 0.2) : alphaColor('#8f5b1a', 0.16);
    ctx.beginPath();
    ctx.moveTo(pos.x + mesaRadius, pos.y - mesaRadius * 0.18);
    ctx.lineTo(pos.x + mesaRadius * 0.28, pos.y - mesaRadius * 0.9);
    ctx.lineTo(pos.x - mesaRadius * 0.64, pos.y - mesaRadius * 0.42);
    ctx.lineTo(pos.x - mesaRadius * 0.9, pos.y + mesaRadius * 0.16);
    ctx.lineTo(pos.x - mesaRadius * 0.2, pos.y + mesaRadius * 0.82);
    ctx.lineTo(pos.x + mesaRadius * 0.7, pos.y + mesaRadius * 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = alphaColor('#f3cf82', 0.12);
    ctx.beginPath();
    ctx.moveTo(pos.x + mesaRadius * 0.52, pos.y - mesaRadius * 0.1);
    ctx.lineTo(pos.x + mesaRadius * 0.12, pos.y - mesaRadius * 0.52);
    ctx.lineTo(pos.x - mesaRadius * 0.4, pos.y - mesaRadius * 0.2);
    ctx.lineTo(pos.x - mesaRadius * 0.12, pos.y + mesaRadius * 0.18);
    ctx.lineTo(pos.x + mesaRadius * 0.34, pos.y + mesaRadius * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 4; i++) {
    const angle = planet.rotation * 0.55 + i * 1.46;
    const pos = polarPoint(radius * (0.22 + i * 0.08), angle);
    ctx.fillStyle = alphaColor('#f8d27a', 0.08);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * (0.12 + (i % 2) * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 8; i++) {
    const angle = planet.rotation * 0.4 + i * 0.76;
    const pos = polarPoint(radius * (0.18 + (i % 4) * 0.11), angle);
    const rock = radius * (0.018 + (i % 3) * 0.008);
    ctx.fillStyle = alphaColor('#6b4423', 0.24);
    ctx.beginPath();
    ctx.moveTo(pos.x + rock, pos.y);
    ctx.lineTo(pos.x + rock * 0.2, pos.y - rock * 1.1);
    ctx.lineTo(pos.x - rock * 0.9, pos.y - rock * 0.2);
    ctx.lineTo(pos.x - rock * 0.55, pos.y + rock);
    ctx.closePath();
    ctx.fill();
  }
}

function drawIceSurface(planet: Planet, ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.rotate(planet.rotation * 0.2);
  for (let i = 0; i < 7; i++) {
    const angle = i * 0.85 + planet.rotation * 0.35;
    const pos = polarPoint(radius * (0.18 + (i % 4) * 0.12), angle);
    ctx.strokeStyle = alphaColor('#ffffff', 0.22);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pos.x - radius * 0.18, pos.y - radius * 0.03);
    ctx.lineTo(pos.x + radius * 0.18, pos.y + radius * 0.03);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const angle = i * 1.4 + planet.rotation * 0.5;
    const pos = polarPoint(radius * (0.16 + i * 0.1), angle);
    ctx.fillStyle = alphaColor('#ffffff', 0.18);
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, radius * 0.18, radius * 0.08, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLavaSurface(planet: Planet, ctx: CanvasRenderingContext2D, radius: number): void {
  drawCraters(planet, ctx, radius, 5, 'rgba(40, 6, 6, 0.3)', 'rgba(255, 180, 120, 0.08)');
  for (let i = 0; i < 6; i++) {
    const angle = planet.rotation * 0.75 + i * 1.01;
    const pos = polarPoint(radius * (0.16 + (i % 3) * 0.2), angle);
    ctx.fillStyle = alphaColor('#ffb347', 0.28);
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, radius * 0.14, radius * 0.06, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alphaColor('#ff5a36', 0.34);
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, radius * 0.08, radius * 0.035, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGasSurface(planet: Planet, ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.rotate(planet.rotation * 0.22);
  const bandColors = [
    alphaColor('#ffe3b3', 0.2),
    alphaColor('#ffd6ff', 0.18),
    alphaColor('#c6b3ff', 0.2),
    alphaColor('#8ec5ff', 0.16),
    alphaColor('#8b6cff', 0.2),
    alphaColor('#f4ddff', 0.16),
  ];

  for (let i = -4; i <= 4; i++) {
    const y = i * radius * 0.16 + Math.sin(planet.rotation * 0.8 + i) * radius * 0.04;
    ctx.strokeStyle = bandColors[(i + bandColors.length * 4) % bandColors.length];
    ctx.lineWidth = radius * (0.08 + ((i + 4) % 3) * 0.015);
    ctx.beginPath();
    ctx.moveTo(-radius * 1.02, y);
    ctx.bezierCurveTo(
      -radius * 0.35,
      y - radius * 0.08,
      radius * 0.2,
      y + radius * 0.07,
      radius,
      y - radius * 0.02,
    );
    ctx.stroke();
  }

  ctx.fillStyle = alphaColor('#fff6ff', 0.14);
  ctx.beginPath();
  ctx.arc(radius * 0.18, radius * 0.2, radius * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = alphaColor('#ffd6ff', 0.2);
  ctx.beginPath();
  ctx.arc(radius * 0.12, radius * 0.18, radius * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawToxicSurface(planet: Planet, ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.rotate(planet.rotation * 0.18);
  for (let i = 0; i < 3; i++) {
    const angle = planet.rotation * 0.25 + i * 2.05;
    const pos = polarPoint(radius * (0.24 + i * 0.12), angle);
    ctx.fillStyle = alphaColor('#0d3f2b', 0.14);
    ctx.beginPath();
    ctx.moveTo(pos.x - radius * 0.16, pos.y);
    ctx.quadraticCurveTo(
      pos.x - radius * 0.05,
      pos.y - radius * 0.09,
      pos.x + radius * 0.1,
      pos.y - radius * 0.04,
    );
    ctx.quadraticCurveTo(
      pos.x + radius * 0.18,
      pos.y + radius * 0.02,
      pos.x + radius * 0.04,
      pos.y + radius * 0.1,
    );
    ctx.quadraticCurveTo(
      pos.x - radius * 0.12,
      pos.y + radius * 0.08,
      pos.x - radius * 0.16,
      pos.y,
    );
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    const angle = planet.rotation * 0.65 + i * 1.22;
    const pos = polarPoint(radius * (0.15 + (i % 3) * 0.18), angle);
    ctx.fillStyle = alphaColor('#d9ff6f', 0.18);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alphaColor('#bbff33', 0.3);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlanetSurface(planet: Planet, ctx: CanvasRenderingContext2D, radius: number): void {
  switch (planet.kind) {
    case 'lush':
      drawLushSurface(planet, ctx, radius);
      return;
    case 'desert':
      drawDesertSurface(planet, ctx, radius);
      return;
    case 'ice':
      drawIceSurface(planet, ctx, radius);
      return;
    case 'lava':
      drawLavaSurface(planet, ctx, radius);
      return;
    case 'gas':
      drawGasSurface(planet, ctx, radius);
      return;
    case 'toxic':
      drawToxicSurface(planet, ctx, radius);
      return;
  }
}

export function drawStyledPlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const radius = PLANET_CONFIG.radius;
  const lightAngle = -Math.PI / 3;
  const lightOffset = polarPoint(radius * 0.45, lightAngle);

  ctx.save();
  ctx.translate(planet.x, planet.y);

  ctx.shadowColor = tintColor(planet.color, 0.15);
  ctx.shadowBlur = 24;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 10;
  tracePlanetShape(ctx, planet, radius, 1.06);
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
  shellGradient.addColorStop(0, tintColor(planet.color, 0.55));
  shellGradient.addColorStop(0.32, tintColor(planet.color, 0.2));
  shellGradient.addColorStop(0.7, planet.color);
  shellGradient.addColorStop(1, tintColor(planet.color, -0.4));
  ctx.fillStyle = shellGradient;
  ctx.fill();

  ctx.save();
  tracePlanetShape(ctx, planet, radius);
  ctx.clip();

  drawPlanetSurface(planet, ctx, radius);

  const shadeGradient = ctx.createLinearGradient(
    radius * 0.95,
    -radius * 0.25,
    -radius * 0.9,
    radius * 0.35,
  );
  shadeGradient.addColorStop(0, 'rgba(5, 8, 16, 0.05)');
  shadeGradient.addColorStop(0.45, 'rgba(5, 8, 16, 0.12)');
  shadeGradient.addColorStop(1, 'rgba(5, 8, 16, 0.45)');
  ctx.fillStyle = shadeGradient;
  ctx.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);

  const rimGradient = ctx.createLinearGradient(
    -radius * 0.6,
    -radius * 0.7,
    radius * 0.55,
    radius * 0.45,
  );
  rimGradient.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  rimGradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.1)');
  rimGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.strokeStyle = rimGradient;
  ctx.lineWidth = 8;
  tracePlanetShape(ctx, planet, radius * 0.98);
  ctx.stroke();
  ctx.restore();

  const atmosphereGradient = ctx.createRadialGradient(
    lightOffset.x * 0.2,
    lightOffset.y * 0.2,
    radius * 0.9,
    0,
    0,
    radius * 1.28,
  );
  atmosphereGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  atmosphereGradient.addColorStop(
    0.72,
    `${tintColor(planet.color, 0.35).replace('rgb', 'rgba').replace(')', ', 0.08)')}`,
  );
  atmosphereGradient.addColorStop(
    1,
    `${tintColor(planet.color, 0.15).replace('rgb', 'rgba').replace(')', ', 0)')}`,
  );
  ctx.fillStyle = atmosphereGradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = tintColor(planet.color, -0.48);
  ctx.lineWidth = 3;
  tracePlanetShape(ctx, planet, radius);
  ctx.stroke();

  ctx.restore();
}
