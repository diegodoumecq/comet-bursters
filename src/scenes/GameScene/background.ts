import {
  BACKGROUND_SPEED,
  DRIFT_CHANGE_MAX,
  DRIFT_CHANGE_MIN,
  GRID_COLOR,
  GRID_SPACING,
  STAR_BASE_ALPHA,
  STAR_COUNT,
  STAR_MAX_SIZE,
  STAR_MIN_SIZE,
  STAR_TWINKLE_AMOUNT,
} from '@/constants';
import { backgroundOffset, backgroundState, getGameHeight, getGameWidth, stars } from '@/state';

export function initBackground() {
  stars.length = 0;
  const buffer = GRID_SPACING * 2;
  const width = getGameWidth() + buffer;
  const height = getGameHeight() + buffer;

  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: STAR_MIN_SIZE + Math.random() * (STAR_MAX_SIZE - STAR_MIN_SIZE),
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 2,
      parallaxLayer: 0.2 + Math.random() * 0.8,
    });
  }
}

export function updateBackground(deltaTime: number) {
  const now = Date.now();

  if (now >= backgroundState.nextDriftChange) {
    backgroundState.driftAngle += (Math.random() - 0.5) * 0.3;
    backgroundState.nextDriftChange =
      now + DRIFT_CHANGE_MIN + Math.random() * (DRIFT_CHANGE_MAX - DRIFT_CHANGE_MIN);
  }

  backgroundOffset.x += Math.cos(backgroundState.driftAngle) * BACKGROUND_SPEED;
  backgroundOffset.y += Math.sin(backgroundState.driftAngle) * BACKGROUND_SPEED;

  for (const star of stars) {
    star.twinklePhase += star.twinkleSpeed * deltaTime * 0.001;
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D) {
  const width = getGameWidth();
  const height = getGameHeight();

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  const offsetX = backgroundOffset.x % GRID_SPACING;
  const offsetY = backgroundOffset.y % GRID_SPACING;

  for (let x = offsetX; x < width; x += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = offsetY; y < height; y += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (const star of stars) {
    const parallaxOffsetX = (backgroundOffset.x * star.parallaxLayer) % (width + GRID_SPACING * 2);
    const parallaxOffsetY = (backgroundOffset.y * star.parallaxLayer) % (height + GRID_SPACING * 2);

    let x = star.x - parallaxOffsetX;
    let y = star.y - parallaxOffsetY;

    if (x < -GRID_SPACING) x += width + GRID_SPACING * 2;
    if (x > width + GRID_SPACING) x -= width + GRID_SPACING * 2;
    if (y < -GRID_SPACING) y += height + GRID_SPACING * 2;
    if (y > height + GRID_SPACING) y -= height + GRID_SPACING * 2;

    if (x < 0 || x > width || y < 0 || y > height) continue;

    const alpha = STAR_BASE_ALPHA + Math.sin(star.twinklePhase) * STAR_TWINKLE_AMOUNT;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
