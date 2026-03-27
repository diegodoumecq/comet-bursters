import { PLANET_CONFIG, type Planet } from '@/constants';
import { asteroids, bullets, getGameHeight, getGameWidth, planets, players } from '@/state';

export function createPlanet(x: number, y: number): Planet {
  const color =
    PLANET_CONFIG.colorPalette[Math.floor(Math.random() * PLANET_CONFIG.colorPalette.length)];
  const variations: number[] = [];
  const numPoints = 32;
  for (let i = 0; i < numPoints; i++) {
    variations.push(0.9 + Math.random() * 0.2);
  }

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    color,
    altitudeVariations: variations,
    rotation: Math.random() * Math.PI * 2,
    getRadius: () => PLANET_CONFIG.radius,
    mask: null,
  };
}

export function updatePlanet(planet: Planet): void {
  const width = getGameWidth();
  const height = getGameHeight();

  planet.x += planet.vx;
  planet.y += planet.vy;

  if (planet.x < 0) planet.x = width;
  if (planet.x > width) planet.x = 0;
  if (planet.y < 0) planet.y = height;
  if (planet.y > height) planet.y = 0;
}

function getNearestPlanetPosition(
  entityX: number,
  entityY: number,
  planetX: number,
  planetY: number,
): { x: number; y: number; dx: number; dy: number } {
  const width = getGameWidth();
  const height = getGameHeight();

  if (width === 0 || height === 0) {
    return { x: planetX, y: planetY, dx: planetX - entityX, dy: planetY - entityY };
  }

  const positions = [
    { x: planetX, y: planetY },
    { x: planetX + width, y: planetY },
    { x: planetX - width, y: planetY },
    { x: planetX, y: planetY + height },
    { x: planetX, y: planetY - height },
    { x: planetX + width, y: planetY + height },
    { x: planetX - width, y: planetY + height },
    { x: planetX + width, y: planetY - height },
    { x: planetX - width, y: planetY - height },
  ];

  let nearest = positions[0];
  let minDistSq = (nearest.x - entityX) ** 2 + (nearest.y - entityY) ** 2;

  for (let i = 1; i < positions.length; i++) {
    const dx = positions[i].x - entityX;
    const dy = positions[i].y - entityY;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      nearest = positions[i];
    }
  }

  return { x: nearest.x, y: nearest.y, dx: nearest.x - entityX, dy: nearest.y - entityY };
}

export function applyGravity(
  entity: { x: number; y: number; vx: number; vy: number },
  planet: Planet,
): void {
  const { dx, dy } = getNearestPlanetPosition(entity.x, entity.y, planet.x, planet.y);
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  if (dist < PLANET_CONFIG.radius * 3 && dist > 0) {
    const force =
      (PLANET_CONFIG.gravityStrength * PLANET_CONFIG.radius * PLANET_CONFIG.radius) / distSq;
    const nx = dx / dist;
    const ny = dy / dist;
    entity.vx += nx * force;
    entity.vy += ny * force;
  }
}

export function updatePlanets(): void {
  for (const planet of planets) {
    updatePlanet(planet);

    for (const player of players) {
      if (player.lives > 0 && !player.waitingToRespawn) {
        applyGravity(player, planet);
      }
    }

    for (const asteroid of asteroids) {
      applyGravity(asteroid, planet);
    }

    for (const bullet of bullets) {
      applyGravity(bullet, planet);
    }
  }
}

export function drawOnePlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const radius = PLANET_CONFIG.radius;
  const numPoints = planet.altitudeVariations.length;

  ctx.save();
  ctx.translate(planet.x, planet.y);

  ctx.beginPath();
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const variation = planet.altitudeVariations[i % numPoints];
    const r = radius * variation;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = planet.color;
  ctx.fill();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

export function drawPlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const width = getGameWidth();
  const height = getGameHeight();

  drawOnePlanet(planet, ctx);

  const nearLeft = planet.x < PLANET_CONFIG.radius;
  const nearRight = planet.x > width - PLANET_CONFIG.radius;
  const nearTop = planet.y < PLANET_CONFIG.radius;
  const nearBottom = planet.y > height - PLANET_CONFIG.radius;

  if (nearLeft) {
    drawOnePlanet({ ...planet, x: planet.x + width }, ctx);
  }
  if (nearRight) {
    drawOnePlanet({ ...planet, x: planet.x - width }, ctx);
  }
  if (nearTop) {
    drawOnePlanet({ ...planet, y: planet.y + height }, ctx);
  }
  if (nearBottom) {
    drawOnePlanet({ ...planet, y: planet.y - height }, ctx);
  }
  if (nearLeft && nearTop) {
    drawOnePlanet({ ...planet, x: planet.x + width, y: planet.y + height }, ctx);
  }
  if (nearRight && nearTop) {
    drawOnePlanet({ ...planet, x: planet.x - width, y: planet.y + height }, ctx);
  }
  if (nearLeft && nearBottom) {
    drawOnePlanet({ ...planet, x: planet.x + width, y: planet.y - height }, ctx);
  }
  if (nearRight && nearBottom) {
    drawOnePlanet({ ...planet, x: planet.x - width, y: planet.y - height }, ctx);
  }
}
