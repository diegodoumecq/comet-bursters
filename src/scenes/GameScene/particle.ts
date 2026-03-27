import { getParticleSprite, getRandomThrusterSprite } from '@/assets';
import {
  PARTICLE_COUNT,
  PARTICLE_LIFETIME,
  SCREEN_SHAKE_DURATION,
  THRUSTER_PARTICLE_LIFETIME,
  type Particle,
  type ThrusterParticle,
} from '@/constants';
import { getGameHeight, getGameWidth, particles, screenShake, thrusterParticles } from '@/state';

export function createExplosion(
  x: number,
  y: number,
  intensity: number,
  inheritVx = 0,
  inheritVy = 0,
) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4 * intensity;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed + inheritVx,
      vy: Math.sin(angle) * speed + inheritVy,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      sprite: getParticleSprite(i),
      lifetime: PARTICLE_LIFETIME,
      maxLifetime: PARTICLE_LIFETIME,
    });
  }

  screenShake.intensity = intensity * 8;
  screenShake.startTime = Date.now();
  screenShake.duration = SCREEN_SHAKE_DURATION;
}

export function updateParticle(particle: Particle, deltaTime: number) {
  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.vx *= 0.98;
  particle.vy *= 0.98;
  particle.rotation += particle.rotationSpeed;
  particle.lifetime -= deltaTime;
  particle.alpha = Math.max(0, particle.lifetime / particle.maxLifetime);

  const width = getGameWidth();
  const height = getGameHeight();
  if (particle.x < 0) particle.x = width;
  if (particle.x > width) particle.x = 0;
  if (particle.y < 0) particle.y = height;
  if (particle.y > height) particle.y = 0;
}

function drawOneParticle(particle: Particle, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.globalAlpha = particle.alpha;
  ctx.drawImage(particle.sprite, -particle.sprite.width / 2, -particle.sprite.height / 2);
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawParticle(particle: Particle, ctx: CanvasRenderingContext2D) {
  const width = getGameWidth();
  const height = getGameHeight();
  const radius = particle.sprite ? Math.max(particle.sprite.width, particle.sprite.height) / 2 : 10;

  drawOneParticle(particle, ctx);

  const nearLeft = particle.x < radius;
  const nearRight = particle.x > width - radius;
  const nearTop = particle.y < radius;
  const nearBottom = particle.y > height - radius;

  if (nearLeft) {
    drawOneParticle({ ...particle, x: particle.x + width }, ctx);
  }
  if (nearRight) {
    drawOneParticle({ ...particle, x: particle.x - width }, ctx);
  }
  if (nearTop) {
    drawOneParticle({ ...particle, y: particle.y + height }, ctx);
  }
  if (nearBottom) {
    drawOneParticle({ ...particle, y: particle.y - height }, ctx);
  }
  if (nearLeft && nearTop) {
    drawOneParticle({ ...particle, x: particle.x + width, y: particle.y + height }, ctx);
  }
  if (nearRight && nearTop) {
    drawOneParticle({ ...particle, x: particle.x - width, y: particle.y + height }, ctx);
  }
  if (nearLeft && nearBottom) {
    drawOneParticle({ ...particle, x: particle.x + width, y: particle.y - height }, ctx);
  }
  if (nearRight && nearBottom) {
    drawOneParticle({ ...particle, x: particle.x - width, y: particle.y - height }, ctx);
  }
}

export function removeParticle(index: number) {
  particles.splice(index, 1);
}

export function createThrusterParticle(x: number, y: number, dirX: number, dirY: number) {
  if (Math.abs(dirX) < 0.01 && Math.abs(dirY) < 0.01) return;

  const spread = 0.5;
  const randomAngle = Math.random() * spread - spread / 2;
  const cos = Math.cos(randomAngle);
  const sin = Math.sin(randomAngle);

  const particleSpeed = 4 + Math.random() * 6;
  const particleVx = dirX * cos - dirY * sin;
  const particleVy = dirX * sin + dirY * cos;

  thrusterParticles.push({
    x,
    y,
    vx: particleVx * particleSpeed,
    vy: particleVy * particleSpeed,
    alpha: 1,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.1,
    sprite: getRandomThrusterSprite(),
    lifetime: THRUSTER_PARTICLE_LIFETIME * (0.5 + Math.random() * 0.5),
    maxLifetime: THRUSTER_PARTICLE_LIFETIME,
    scale: 1.2,
  });
}

export function updateThrusterParticle(particle: ThrusterParticle, deltaTime: number) {
  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.vx *= 0.95;
  particle.vy *= 0.95;
  particle.rotation += particle.rotationSpeed;
  particle.lifetime -= deltaTime;
  particle.alpha = Math.max(0, particle.lifetime / particle.maxLifetime);
  particle.scale = (particle.lifetime / particle.maxLifetime) * 2;
}

export function drawThrusterParticle(particle: ThrusterParticle, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.scale(particle.scale, particle.scale);
  ctx.globalAlpha = particle.alpha;
  ctx.drawImage(particle.sprite, -particle.sprite.width / 2, -particle.sprite.height / 2);
  ctx.restore();
  ctx.globalAlpha = 1;
}
