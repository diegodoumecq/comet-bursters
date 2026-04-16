import { type Bullet } from '@/constants';
import { bullets, getGameHeight, getGameWidth } from '@/state';
import { areShadersSupported } from './shader';

export function updateBullet(bullet: Bullet) {
  bullet.prevX = bullet.x;
  bullet.prevY = bullet.y;
  bullet.x += bullet.vx;
  bullet.y += bullet.vy;

  const width = getGameWidth();
  const height = getGameHeight();
  if (bullet.x < 0) bullet.x = width;
  if (bullet.x > width) bullet.x = 0;
  if (bullet.y < 0) bullet.y = height;
  if (bullet.y > height) bullet.y = 0;
}

export function isBulletExpired(bullet: Bullet): boolean {
  return Date.now() - bullet.spawnTime >= bullet.lifetime;
}

function drawOneBullet(bullet: Bullet, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);

  switch (bullet.type) {
    case 'small': {
      const length = 15;
      ctx.rotate(bullet.angle);
      ctx.beginPath();
      ctx.moveTo(-length / 2, 0);
      ctx.lineTo(length / 2, 0);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'blackHole': {
      if (!areShadersSupported()) {
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case 'pusher': {
      const screenDx = bullet.x - bullet.prevX;
      const screenDy = bullet.y - bullet.prevY;
      const speed = Math.sqrt(screenDx * screenDx + screenDy * screenDy);
      const minSpeed = 2;
      const maxSpeed = 15;
      const minLength = 10;
      const maxLength = 50;
      const normalizedSpeed = Math.max(0, Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed)));
      const length = minLength + normalizedSpeed * (maxLength - minLength);
      if (speed > 0.1) {
        const angle = Math.atan2(screenDy, screenDx) + Math.PI;
        ctx.rotate(angle);
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(-length / 2, -2.5, length, 5);
      break;
    }
    case 'shotgun': {
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

export function drawBullet(bullet: Bullet, ctx: CanvasRenderingContext2D) {
  const width = getGameWidth();
  const height = getGameHeight();

  drawOneBullet(bullet, ctx);

  const nearLeft = bullet.x < 15;
  const nearRight = bullet.x > width - 15;
  const nearTop = bullet.y < 15;
  const nearBottom = bullet.y > height - 15;

  if (nearLeft) {
    drawOneBullet({ ...bullet, x: bullet.x + width }, ctx);
  }
  if (nearRight) {
    drawOneBullet({ ...bullet, x: bullet.x - width }, ctx);
  }
  if (nearTop) {
    drawOneBullet({ ...bullet, y: bullet.y + height }, ctx);
  }
  if (nearBottom) {
    drawOneBullet({ ...bullet, y: bullet.y - height }, ctx);
  }
  if (nearLeft && nearTop) {
    drawOneBullet({ ...bullet, x: bullet.x + width, y: bullet.y + height }, ctx);
  }
  if (nearRight && nearTop) {
    drawOneBullet({ ...bullet, x: bullet.x - width, y: bullet.y + height }, ctx);
  }
  if (nearLeft && nearBottom) {
    drawOneBullet({ ...bullet, x: bullet.x + width, y: bullet.y - height }, ctx);
  }
  if (nearRight && nearBottom) {
    drawOneBullet({ ...bullet, x: bullet.x - width, y: bullet.y - height }, ctx);
  }
}

export function removeBullet(index: number) {
  bullets.splice(index, 1);
}
