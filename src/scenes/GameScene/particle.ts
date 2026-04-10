import {
  ASTEROID_COLORS,
  PARTICLE_COUNT,
  PARTICLE_LIFETIME,
  SCREEN_SHAKE_DURATION,
  THRUSTER_COLORS,
  THRUSTER_PARTICLE_LIFETIME,
  type Particle,
  type ThrusterParticle,
} from '@/constants';
import { getGameHeight, getGameWidth, particles, screenShake, thrusterParticles } from '@/state';

type ExplosionKind = 'asteroid' | 'ship';

const EXPLOSION_BURST_LIFETIME = 600;
const SHIP_DEBRIS_LIFETIME = 1800;

export function createShipDebris(
  x: number,
  y: number,
  intensity: number,
  inheritVx = 0,
  inheritVy = 0,
  baseColor = '#debbad',
) {
  const debrisCount = Math.floor(PARTICLE_COUNT * 0.875);
  const shipAngle = Math.atan2(inheritVy, inheritVx);
  const hasShipVelocity = Math.abs(inheritVx) > 0.1 || Math.abs(inheritVy) > 0.1;
  for (let i = 0; i < debrisCount; i++) {
    const spread = (Math.random() - 0.5) * Math.PI * 0.75;
    const angle = hasShipVelocity ? shipAngle + spread : Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 3 * intensity;
    const shape = i % 3 === 0 ? (i % 2 === 0 ? 'wing' : 'panel') : 'shard';
    const size =
      shape === 'wing'
        ? 8 + Math.random() * 6 * intensity
        : shape === 'panel'
          ? 6 + Math.random() * 5 * intensity
          : 5 + Math.random() * 5 * intensity;
    const color = i % 3 === 0 ? (i % 2 === 0 ? '#1a202c' : '#f2f6ff') : baseColor;
    const color2 = i % 3 === 0 ? (i % 2 === 0 ? '#1a202c' : '#9ca3af') : undefined;
    const glowColor = 'rgba(226,232,240,0.22)';
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed + inheritVx,
      vy: Math.sin(angle) * speed + inheritVy,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.35,
      size,
      color,
      color2,
      glowColor,
      shape,
      lifetime: SHIP_DEBRIS_LIFETIME,
      maxLifetime: SHIP_DEBRIS_LIFETIME,
    });
  }
}

export function createExplosionBurst(
  x: number,
  y: number,
  intensity: number,
  inheritVx = 0,
  inheritVy = 0,
) {
  const palette = Object.values(ASTEROID_COLORS).flat();
  const explosionCount = Math.floor(PARTICLE_COUNT * 0.875);
  for (let i = 0; i < explosionCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 2 * intensity;
    const shape = i % 4 === 0 ? 'smoke' : i % 2 === 0 ? 'shard' : 'spark';
    const size =
      shape === 'smoke'
        ? 18 + Math.random() * 18 * intensity
        : shape === 'shard'
          ? 5 + Math.random() * 5 * intensity
          : 3 + Math.random() * 4 * intensity;
    const color =
      i % 5 === 0
        ? i % 2 === 0
          ? '#fbbf24'
          : '#f97316'
        : i % 4 === 0
          ? '#dc2626'
          : i % 3 === 0
            ? '#94a3b8'
            : palette[(i + Math.floor(intensity * 3)) % palette.length];
    const color2 =
      shape === 'smoke'
        ? undefined
        : i % 5 === 0
          ? i % 2 === 0
            ? '#f97316'
            : '#dc2626'
          : i % 4 === 0
            ? '#7f1d1d'
            : undefined;
    const glowColor =
      shape === 'smoke'
        ? 'rgba(255,255,255,0.08)'
        : i % 5 === 0
          ? 'rgba(251,191,36,0.5)'
          : i % 4 === 0
            ? 'rgba(220,38,38,0.4)'
            : 'rgba(255,200,120,0.35)';
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed + inheritVx,
      vy: Math.sin(angle) * speed + inheritVy,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      size,
      color,
      color2,
      glowColor,
      shape,
      lifetime: EXPLOSION_BURST_LIFETIME,
      maxLifetime: EXPLOSION_BURST_LIFETIME,
    });
  }

  screenShake.intensity = intensity * 8;
  screenShake.startTime = Date.now();
  screenShake.duration = SCREEN_SHAKE_DURATION;
}

export function createExplosion(
  x: number,
  y: number,
  intensity: number,
  inheritVx = 0,
  inheritVy = 0,
  kind: ExplosionKind = 'asteroid',
  baseColor = '#debbad',
) {
  const palette = Object.values(ASTEROID_COLORS).flat();
  const particleCount = kind === 'ship' ? Math.floor(PARTICLE_COUNT * 1.75) : PARTICLE_COUNT;
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4 * intensity;
    const shape =
      kind === 'ship'
        ? i % 7 === 0
          ? 'spark'
          : i % 3 === 0
            ? 'wing'
            : i % 2 === 0
              ? 'panel'
              : 'shard'
        : i % 5 === 0
          ? 'smoke'
          : i % 2 === 0
            ? 'shard'
            : 'spark';
    const size =
      shape === 'smoke'
        ? 18 + Math.random() * 18 * intensity
        : shape === 'wing'
          ? 8 + Math.random() * 6 * intensity
          : shape === 'panel'
            ? 6 + Math.random() * 5 * intensity
            : shape === 'shard'
              ? 5 + Math.random() * 5 * intensity
              : 3 + Math.random() * 4 * intensity;
    const color =
      shape === 'smoke'
        ? '#94a3b8'
        : kind === 'ship'
          ? i % 5 === 0
            ? i % 2 === 0
              ? '#fbbf24'
              : '#f97316'
            : i % 4 === 0
              ? '#dc2626'
              : i % 3 === 0
                ? '#1a202c'
                : i % 2 === 0
                  ? '#f2f6ff'
                  : baseColor
          : palette[(i + Math.floor(intensity * 3)) % palette.length];
    const color2 =
      shape === 'smoke'
        ? undefined
        : kind === 'ship'
          ? i % 5 === 0
            ? i % 2 === 0
              ? '#f97316'
              : '#dc2626'
            : i % 4 === 0
              ? '#7f1d1d'
              : i % 3 === 0
                ? '#1a202c'
                : i % 2 === 0
                  ? '#9ca3af'
                  : undefined
          : undefined;
    const glowColor =
      shape === 'smoke'
        ? 'rgba(255,255,255,0.08)'
        : kind === 'ship'
          ? i % 5 === 0
            ? 'rgba(251,191,36,0.5)'
            : i % 4 === 0
              ? 'rgba(220,38,38,0.4)'
              : 'rgba(226,232,240,0.22)'
          : 'rgba(255,200,120,0.35)';
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed + inheritVx,
      vy: Math.sin(angle) * speed + inheritVy,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      size,
      color,
      color2,
      glowColor,
      shape,
      lifetime: PARTICLE_LIFETIME,
      maxLifetime: PARTICLE_LIFETIME,
    });
  }

  screenShake.intensity = intensity * 8;
  screenShake.startTime = Date.now();
  screenShake.duration = SCREEN_SHAKE_DURATION;
}

export function updateParticle(particle: Particle, deltaTime: number) {
  particle.x += particle.vx * 0.6;
  particle.y += particle.vy * 0.6;
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

export function drawOneParticle(particle: Particle, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.globalAlpha = particle.alpha;

  const createGradientFill = (particle: Particle) => {
    if (!particle.color2) return particle.color;
    const gradient = ctx.createLinearGradient(
      -particle.size * 0.5,
      -particle.size * 0.5,
      particle.size * 0.5,
      particle.size * 0.5,
    );
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(1, particle.color2);
    return gradient;
  };

  if (particle.shape === 'smoke') {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
    glow.addColorStop(0, particle.glowColor);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (particle.shape === 'shard') {
    ctx.shadowColor = particle.glowColor;
    ctx.shadowBlur = particle.size * 0.6;
    ctx.fillStyle = createGradientFill(particle);
    ctx.beginPath();
    ctx.moveTo(particle.size * 0.7, 0);
    ctx.lineTo(-particle.size * 0.45, -particle.size * 0.35);
    ctx.lineTo(-particle.size * 0.7, 0);
    ctx.lineTo(-particle.size * 0.45, particle.size * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (particle.shape === 'panel') {
    ctx.shadowColor = particle.glowColor;
    ctx.shadowBlur = particle.size * 0.45;
    ctx.fillStyle = createGradientFill(particle);
    ctx.beginPath();
    ctx.moveTo(particle.size * 0.62, 0);
    ctx.lineTo(particle.size * 0.08, -particle.size * 0.34);
    ctx.lineTo(-particle.size * 0.56, -particle.size * 0.22);
    ctx.lineTo(-particle.size * 0.44, particle.size * 0.24);
    ctx.lineTo(particle.size * 0.12, particle.size * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1.5, particle.size * 0.08);
    ctx.stroke();
  } else if (particle.shape === 'wing') {
    ctx.shadowColor = particle.glowColor;
    ctx.shadowBlur = particle.size * 0.55;
    ctx.fillStyle = createGradientFill(particle);
    ctx.beginPath();
    ctx.moveTo(particle.size * 0.82, 0);
    ctx.lineTo(-particle.size * 0.14, -particle.size * 0.52);
    ctx.lineTo(-particle.size * 0.68, -particle.size * 0.18);
    ctx.lineTo(-particle.size * 0.46, particle.size * 0.12);
    ctx.lineTo(-particle.size * 0.12, particle.size * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(particle.size * 0.34, 0);
    ctx.lineTo(-particle.size * 0.12, -particle.size * 0.16);
    ctx.lineTo(-particle.size * 0.2, particle.size * 0.08);
    ctx.closePath();
    ctx.fill();
  } else if (particle.shape === 'core') {
    ctx.shadowColor = particle.glowColor;
    ctx.shadowBlur = particle.size;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.35, particle.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowColor = particle.glowColor;
    ctx.shadowBlur = particle.size;
    const gradient = ctx.createLinearGradient(-particle.size * 0.5, 0, particle.size * 0.5, 0);
    gradient.addColorStop(0, particle.color2 || particle.color);
    gradient.addColorStop(1, particle.color);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(2, particle.size * 0.18);
    ctx.beginPath();
    ctx.moveTo(-particle.size * 0.5, 0);
    ctx.lineTo(particle.size * 0.5, 0);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawParticle(particle: Particle, ctx: CanvasRenderingContext2D) {
  const width = getGameWidth();
  const height = getGameHeight();
  const radius = particle.size;

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
    size: 8 + Math.random() * 8,
    color: THRUSTER_COLORS[Math.floor(Math.random() * THRUSTER_COLORS.length)],
    glowColor: 'rgba(255, 180, 80, 0.3)',
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

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
  glow.addColorStop(0, particle.glowColor);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
  ctx.fill();

  const flameGradient = ctx.createLinearGradient(-particle.size * 0.9, 0, particle.size * 0.9, 0);
  flameGradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  flameGradient.addColorStop(0.25, '#ffe38a');
  flameGradient.addColorStop(0.65, particle.color);
  flameGradient.addColorStop(1, 'rgba(255, 90, 0, 0)');
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(-particle.size * 0.8, 0);
  ctx.quadraticCurveTo(-particle.size * 0.15, -particle.size * 0.42, particle.size * 0.95, 0);
  ctx.quadraticCurveTo(-particle.size * 0.15, particle.size * 0.42, -particle.size * 0.8, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(-particle.size * 0.45, 0);
  ctx.quadraticCurveTo(0, -particle.size * 0.14, particle.size * 0.35, 0);
  ctx.quadraticCurveTo(0, particle.size * 0.14, -particle.size * 0.45, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}
