import type { Asteroid } from './constants';

const ASTEROID_COLLISION_RESTITUTION = 1.05;
const MIN_COLLISION_DISTANCE = 0.001;

export function resolveAsteroidCollisions(asteroids: Asteroid[]): void {
  for (let i = 0; i < asteroids.length; i += 1) {
    for (let j = i + 1; j < asteroids.length; j += 1) {
      resolveAsteroidPairCollision(asteroids[i], asteroids[j]);
    }
  }
}

function resolveAsteroidPairCollision(a: Asteroid, b: Asteroid): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.max(MIN_COLLISION_DISTANCE, Math.hypot(dx, dy));
  const minDist = a.getRadius() + b.getRadius();
  if (dist >= minDist) {
    return;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  const totalMass = a.mass + b.mass;
  a.x -= nx * overlap * (b.mass / totalMass);
  a.y -= ny * overlap * (b.mass / totalMass);
  b.x += nx * overlap * (a.mass / totalMass);
  b.y += ny * overlap * (a.mass / totalMass);

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velocityAlongNormal = rvx * nx + rvy * ny;
  if (velocityAlongNormal <= 0) {
    const impulse =
      (-ASTEROID_COLLISION_RESTITUTION * velocityAlongNormal) / (1 / a.mass + 1 / b.mass);
    a.vx -= (impulse / a.mass) * nx;
    a.vy -= (impulse / a.mass) * ny;
    b.vx += (impulse / b.mass) * nx;
    b.vy += (impulse / b.mass) * ny;
  }
}
