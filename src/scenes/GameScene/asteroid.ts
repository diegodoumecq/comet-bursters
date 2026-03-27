import { getRandomAsteroidColor, scaleMask } from '@/assets';
import { ASTEROID_CONFIGS, PLANET_CONFIG, type Asteroid } from '@/constants';
import {
  asteroids,
  gameState,
  getGameCenterX,
  getGameCenterY,
  getGameHeight,
  getGameWidth,
  planets,
} from '@/state';
import { createPlanet } from './planets';

export function createAsteroid(
  x: number,
  y: number,
  size: 'mega' | 'big' | 'medium' | 'small',
  fromSplit = false,
): Asteroid {
  const config = ASTEROID_CONFIGS[size];
  const width = getGameWidth();
  const height = getGameHeight();
  const centerX = getGameCenterX();
  const centerY = getGameCenterY();
  let angle: number;

  if (fromSplit) {
    angle = Math.random() * Math.PI * 2;
    x = x || Math.random() * width;
    y = y || Math.random() * height;
  } else {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0:
        x = -config.radius;
        y = Math.random() * height;
        break;
      case 1:
        x = width + config.radius;
        y = Math.random() * height;
        break;
      case 2:
        x = Math.random() * width;
        y = -config.radius;
        break;
      case 3:
        x = Math.random() * width;
        y = height + config.radius;
        break;
    }
    angle = Math.atan2(centerY - y, centerX - x) + (Math.random() - 0.5) * Math.PI;
  }

  const speed = config.speed * (0.8 + Math.random() * 0.4);

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.05,
    size,
    color: getRandomAsteroidColor(size),
    hits: config.hits,
    splitCount: config.splitCount,
    mass: config.mass,
    mask: scaleMask(gameState.baseAlphaMask!, (config.radius * 2) / 150),
    getRadius: () => config.radius,
  };
}

export function updateAsteroid(asteroid: Asteroid) {
  asteroid.x += asteroid.vx;
  asteroid.y += asteroid.vy;
  asteroid.rotation += asteroid.rotationSpeed;

  const width = getGameWidth();
  const height = getGameHeight();

  if (asteroid.x < 0) asteroid.x = width;
  if (asteroid.x > width) asteroid.x = 0;
  if (asteroid.y < 0) asteroid.y = height;
  if (asteroid.y > height) asteroid.y = 0;
}

function drawOneAsteroid(asteroid: Asteroid, ctx: CanvasRenderingContext2D) {
  const config = ASTEROID_CONFIGS[asteroid.size];
  const sprite = gameState.asteroidSprites[asteroid.size][asteroid.color];

  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);

  ctx.drawImage(sprite, -config.radius, -config.radius, config.radius * 2, config.radius * 2);

  ctx.restore();
}

export function drawAsteroid(asteroid: Asteroid, ctx: CanvasRenderingContext2D) {
  const width = getGameWidth();
  const height = getGameHeight();
  const config = ASTEROID_CONFIGS[asteroid.size];

  drawOneAsteroid(asteroid, ctx);

  const nearLeft = asteroid.x < config.radius;
  const nearRight = asteroid.x > width - config.radius;
  const nearTop = asteroid.y < config.radius;
  const nearBottom = asteroid.y > height - config.radius;

  if (nearLeft) {
    drawOneAsteroid({ ...asteroid, x: asteroid.x + width }, ctx);
  }
  if (nearRight) {
    drawOneAsteroid({ ...asteroid, x: asteroid.x - width }, ctx);
  }
  if (nearTop) {
    drawOneAsteroid({ ...asteroid, y: asteroid.y + height }, ctx);
  }
  if (nearBottom) {
    drawOneAsteroid({ ...asteroid, y: asteroid.y - height }, ctx);
  }
  if (nearLeft && nearTop) {
    drawOneAsteroid({ ...asteroid, x: asteroid.x + width, y: asteroid.y + height }, ctx);
  }
  if (nearRight && nearTop) {
    drawOneAsteroid({ ...asteroid, x: asteroid.x - width, y: asteroid.y + height }, ctx);
  }
  if (nearLeft && nearBottom) {
    drawOneAsteroid({ ...asteroid, x: asteroid.x + width, y: asteroid.y - height }, ctx);
  }
  if (nearRight && nearBottom) {
    drawOneAsteroid({ ...asteroid, x: asteroid.x - width, y: asteroid.y - height }, ctx);
  }
}

export function spawnWave(wave: number) {
  const count = 2 + wave;
  const megaChance = Math.min(0.15, wave * 0.02);
  const bigChance = Math.min(0.4, wave * 0.05);

  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let size: 'mega' | 'big' | 'medium' | 'small';
    if (wave >= 10 && rand < megaChance) {
      size = 'mega';
    } else if (wave >= 5 && rand < megaChance + bigChance) {
      size = 'big';
    } else if (wave >= 3 && rand < megaChance + bigChance + 0.3) {
      size = 'medium';
    } else {
      size = 'small';
    }
    asteroids.push(createAsteroid(0, 0, size));
  }

  if (planets.length === 0) {
    const width = getGameWidth();
    const height = getGameHeight();
    const planetX = PLANET_CONFIG.radius + Math.random() * (width - PLANET_CONFIG.radius * 2);
    const planetY = PLANET_CONFIG.radius + Math.random() * (height - PLANET_CONFIG.radius * 2);
    planets.push(createPlanet(planetX, planetY));
  }
}

export function splitAsteroid(asteroid: Asteroid): Asteroid[] {
  const childSize = ASTEROID_CONFIGS[asteroid.size].childSize;
  if (!childSize) return [];

  const children: Asteroid[] = [];
  const childConfig = ASTEROID_CONFIGS[childSize];

  for (let i = 0; i < asteroid.splitCount; i++) {
    const child = createAsteroid(
      asteroid.x + (Math.random() - 0.5) * 20,
      asteroid.y + (Math.random() - 0.5) * 20,
      childSize,
      true,
    );

    const explosionAngle = Math.random() * Math.PI * 2;
    const explosionSpeed = childConfig.speed * (0.8 + Math.random() * 0.4);

    child.vx = asteroid.vx + Math.cos(explosionAngle) * explosionSpeed;
    child.vy = asteroid.vy + Math.sin(explosionAngle) * explosionSpeed;

    children.push(child);
  }
  return children;
}
