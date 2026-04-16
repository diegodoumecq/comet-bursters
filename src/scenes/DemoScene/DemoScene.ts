import { getAsteroidMask } from '@/assets';
import {
  ASTEROID_CONFIGS,
  GRID_COLOR,
  GRID_SPACING,
  PLANET_CONFIG,
  PLAYER_ACCELERATION,
  PLAYER_MAX_SPEED,
  STAR_BASE_ALPHA,
  STAR_TWINKLE_AMOUNT,
  type Asteroid,
  type Planet,
  type PlanetKind,
  type Player,
} from '@/constants';
import { InputManager } from '@/input';
import { joymap } from '@/joymap';
import {
  backgroundOffset,
  gameState,
  getGameHeight,
  getGameWidth,
  player,
  resetState,
  setPlayer,
  stars,
} from '@/state';
import { updateBackground } from '../GameScene/background';
import { createPlayer, drawPlayer } from '../GameScene/player';
import { drawPlanet } from '../SandboxScene/planets';
import { clearFlatPlanetTextureCache } from '../SandboxScene/planetTextureEngine';
import type { Scene } from '../scene';

const DEMO_WORLD_WIDTH = 4600;
const DEMO_WORLD_HEIGHT = 3400;
const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 220;
const MINIMAP_PADDING = 20;
const DEMO_PLAYER_ACCELERATION = PLAYER_ACCELERATION * 6.8;
const DEMO_PLAYER_MAX_SPEED = PLAYER_MAX_SPEED * 6.2;
const DEMO_PLAYER_FRICTION = 0.96;

type Camera = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isVisible(
  x: number,
  y: number,
  radius: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  return !(
    x + radius < camera.x ||
    x - radius > camera.x + viewportWidth ||
    y + radius < camera.y ||
    y - radius > camera.y + viewportHeight
  );
}

function createDemoPlanet(kind: PlanetKind, x: number, y: number, colorIndex: number): Planet {
  const palette = PLANET_CONFIG.palettes[kind];
  const altitudeVariations: number[] = [];

  for (let i = 0; i < 32; i++) {
    altitudeVariations.push(0.9 + Math.sin(i * 1.7 + colorIndex) * 0.03 + (i % 3) * 0.01);
  }

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    kind,
    color: palette[colorIndex % palette.length],
    altitudeVariations,
    rotation: colorIndex * 0.7,
    getRadius: () => PLANET_CONFIG.radius,
    mask: null,
  };
}

function createDemoAsteroid(
  size: 'mega' | 'big' | 'medium' | 'small',
  color: string,
  x: number,
  y: number,
): Asteroid {
  const config = ASTEROID_CONFIGS[size];
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    rotation: 0.35,
    rotationSpeed: 0,
    size,
    color,
    hits: config.hits,
    splitCount: config.splitCount,
    mass: config.mass,
    mask: getAsteroidMask(size),
    getRadius: () => config.radius,
  };
}

function drawDemoAsteroid(asteroid: Asteroid, ctx: CanvasRenderingContext2D): void {
  const config = ASTEROID_CONFIGS[asteroid.size];
  const sprite = gameState.asteroidSprites[asteroid.size][asteroid.color];
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);
  ctx.drawImage(sprite, -config.radius, -config.radius, config.radius * 2, config.radius * 2);
  ctx.restore();
}

function updateDemoPlayer(currentPlayer: Player, camera: Camera): void {
  const screenPlayerX = currentPlayer.x - camera.x;
  const screenPlayerY = currentPlayer.y - camera.y;
  const input = InputManager.getInputState(currentPlayer.module, screenPlayerX, screenPlayerY);

  if (input.move.value[0] !== 0 || input.move.value[1] !== 0) {
    currentPlayer.angle = Math.atan2(input.move.value[1], input.move.value[0]) + Math.PI * 0.5;
    currentPlayer.vx += input.move.value[0] * DEMO_PLAYER_ACCELERATION;
    currentPlayer.vy += input.move.value[1] * DEMO_PLAYER_ACCELERATION;
  }

  currentPlayer.vx *= DEMO_PLAYER_FRICTION;
  currentPlayer.vy *= DEMO_PLAYER_FRICTION;

  const speed = Math.sqrt(
    currentPlayer.vx * currentPlayer.vx + currentPlayer.vy * currentPlayer.vy,
  );
  if (speed > DEMO_PLAYER_MAX_SPEED) {
    const scale = DEMO_PLAYER_MAX_SPEED / speed;
    currentPlayer.vx *= scale;
    currentPlayer.vy *= scale;
  }

  if (input.aim.pressed) {
    const [aimX, aimY] = input.aim.value;
    const aimMagnitude = Math.sqrt(aimX * aimX + aimY * aimY);
    if (aimMagnitude > 0) {
      currentPlayer.turretAngle = Math.atan2(aimY, aimX) + Math.PI * 0.5;
    }
  }

  currentPlayer.x = clamp(currentPlayer.x + currentPlayer.vx, 0, DEMO_WORLD_WIDTH);
  currentPlayer.y = clamp(currentPlayer.y + currentPlayer.vy, 0, DEMO_WORLD_HEIGHT);
  currentPlayer.isThrusting = false;
  currentPlayer.shieldActive = false;
}

function drawDemoBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): void {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  const offsetX = (((-camera.x + backgroundOffset.x) % GRID_SPACING) + GRID_SPACING) % GRID_SPACING;
  const offsetY = (((-camera.y + backgroundOffset.y) % GRID_SPACING) + GRID_SPACING) % GRID_SPACING;

  for (let x = offsetX; x < viewportWidth; x += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewportHeight);
    ctx.stroke();
  }

  for (let y = offsetY; y < viewportHeight; y += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewportWidth, y);
    ctx.stroke();
  }

  for (const star of stars) {
    const width = viewportWidth + GRID_SPACING * 2;
    const height = viewportHeight + GRID_SPACING * 2;
    let x = star.x - (camera.x + backgroundOffset.x) * star.parallaxLayer;
    let y = star.y - (camera.y + backgroundOffset.y) * star.parallaxLayer;

    x = (((x % width) + width) % width) - GRID_SPACING;
    y = (((y % height) + height) % height) - GRID_SPACING;

    if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) {
      continue;
    }

    ctx.globalAlpha = STAR_BASE_ALPHA + Math.sin(star.twinklePhase) * STAR_TWINKLE_AMOUNT;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export class DemoScene implements Scene {
  private camera: Camera = { x: 0, y: 0 };
  private planets: Planet[] = [];
  private asteroids: Asteroid[] = [];

  setCanvas(_canvas: HTMLCanvasElement): void {}

  private updateCamera(): void {
    const currentPlayer = player;
    const viewportWidth = getGameWidth();
    const viewportHeight = getGameHeight();

    if (!currentPlayer) {
      return;
    }

    this.camera.x = clamp(currentPlayer.x - viewportWidth / 2, 0, DEMO_WORLD_WIDTH - viewportWidth);
    this.camera.y = clamp(
      currentPlayer.y - viewportHeight / 2,
      0,
      DEMO_WORLD_HEIGHT - viewportHeight,
    );
  }

  private buildLayout(): void {
    this.planets = [
      createDemoPlanet('lush', 980, 980, 0),
      createDemoPlanet('desert', 1660, 930, 1),
      createDemoPlanet('ice', 2320, 1130, 2),
      createDemoPlanet('lava', 1280, 1750, 3),
      createDemoPlanet('gas', 2140, 1880, 4),
      createDemoPlanet('toxic', 2940, 1560, 5),
      createDemoPlanet('crystal', 3600, 1080, 6),
    ];

    this.asteroids = [
      createDemoAsteroid('mega', '#ff6b6b', 1100, 2620),
      createDemoAsteroid('big', '#ffd93d', 1940, 2740),
      createDemoAsteroid('medium', '#6bcb77', 2820, 2650),
      createDemoAsteroid('small', '#4d96ff', 3660, 2480),
    ];
  }

  enter(): void {
    resetState();
    clearFlatPlanetTextureCache();
    this.buildLayout();

    if (!player) {
      const padId = joymap.getUnusedPadIds()[0] ?? 'keyboard';
      const createdPlayer = createPlayer(padId);
      setPlayer(createdPlayer);
      joymap.addModule(createdPlayer.module);
    }

    const currentPlayer = player;
    if (!currentPlayer) {
      return;
    }

    currentPlayer.x = 620;
    currentPlayer.y = 760;
    currentPlayer.vx = 0;
    currentPlayer.vy = 0;
    currentPlayer.angle = 0;
    currentPlayer.turretAngle = 0;
    currentPlayer.invulnerable = false;
    currentPlayer.waitingToRespawn = false;
    currentPlayer.shieldActive = false;
    this.updateCamera();
  }

  update(_deltaTime: number): void {
    updateBackground(16);
    const currentPlayer = player;
    if (!currentPlayer) {
      return;
    }

    updateDemoPlayer(currentPlayer, this.camera);
    this.updateCamera();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const viewportWidth = getGameWidth();
    const viewportHeight = getGameHeight();
    drawDemoBackground(ctx, this.camera, viewportWidth, viewportHeight);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    for (const planet of this.planets) {
      if (
        isVisible(
          planet.x,
          planet.y,
          planet.getRadius(),
          this.camera,
          viewportWidth,
          viewportHeight,
        )
      ) {
        drawPlanet(planet, ctx);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.font = '26px Audiowide, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          planet.kind,
          planet.x,
          planet.y + planet.getRadius() + 70,
        );
      }
    }

    for (const asteroid of this.asteroids) {
      if (
        isVisible(
          asteroid.x,
          asteroid.y,
          asteroid.getRadius(),
          this.camera,
          viewportWidth,
          viewportHeight,
        )
      ) {
        drawDemoAsteroid(asteroid, ctx);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.font = '26px Audiowide, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(asteroid.size, asteroid.x, asteroid.y + asteroid.getRadius() + 70);
      }
    }

    if (player) {
      drawPlayer(player, ctx);
    }

    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = '28px Audiowide, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Demo Scene', 20, 34);
    ctx.font = '18px Audiowide, sans-serif';
    ctx.fillStyle = '#a8b0c0';
    ctx.fillText('Sandbox camera/navigation, no gravity, no collisions, static layout', 20, 64);

    this.drawMinimap(ctx, viewportWidth, viewportHeight);
  }

  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    const minimapX = viewportWidth - MINIMAP_WIDTH - MINIMAP_PADDING;
    const minimapY = MINIMAP_PADDING;
    const scaleX = MINIMAP_WIDTH / DEMO_WORLD_WIDTH;
    const scaleY = MINIMAP_HEIGHT / DEMO_WORLD_HEIGHT;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 10, 20, 0.41)';
    ctx.fillRect(minimapX, minimapY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(minimapX, minimapY, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    for (const planet of this.planets) {
      ctx.beginPath();
      ctx.arc(minimapX + planet.x * scaleX, minimapY + planet.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fillStyle = planet.color;
      ctx.fill();
    }

    for (const asteroid of this.asteroids) {
      ctx.beginPath();
      ctx.arc(minimapX + asteroid.x * scaleX, minimapY + asteroid.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fillStyle = asteroid.color;
      ctx.fill();
    }

    const viewportBoxX = minimapX + this.camera.x * scaleX;
    const viewportBoxY = minimapY + this.camera.y * scaleY;
    const viewportBoxWidth = viewportWidth * scaleX;
    const viewportBoxHeight = viewportHeight * scaleY;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewportBoxX, viewportBoxY, viewportBoxWidth, viewportBoxHeight);
    ctx.restore();
  }

  exit(): void {}
}
