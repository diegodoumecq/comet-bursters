import { SHIELD_HIT_COOLDOWN, SHIELD_RADIUS, type Player } from '@/constants';
import { asteroids, bullets, getGameHeight, getGameWidth, player } from '@/state';

export function checkCircleCollision(
  a: { x: number; y: number; getRadius: () => number },
  b: { x: number; y: number; getRadius: () => number },
): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < a.getRadius() + b.getRadius();
}

function getCollisionPositions(x: number, y: number, radius: number): { x: number; y: number }[] {
  const width = getGameWidth();
  const height = getGameHeight();
  const positions = [{ x, y }];

  if (x < 0) positions.push({ x: x + width, y });
  if (x > width) positions.push({ x: x - width, y });
  if (y < 0) positions.push({ x, y: y + height });
  if (y > height) positions.push({ x, y: y - height });

  if (x < 0 && y < 0) positions.push({ x: x + width, y: y + height });
  if (x > width && y < 0) positions.push({ x: x - width, y: y + height });
  if (x < 0 && y > height) positions.push({ x: x + width, y: y - height });
  if (x > width && y > height) positions.push({ x: x - width, y: y - height });

  if (x < radius) positions.push({ x: x + width, y });
  if (x > width - radius) positions.push({ x: x - width, y });
  if (y < radius) positions.push({ x, y: y + height });
  if (y > height - radius) positions.push({ x, y: y - height });

  if (x < radius && y < radius) positions.push({ x: x + width, y: y + height });
  if (x > width - radius && y < radius) positions.push({ x: x - width, y: y + height });
  if (x < radius && y > height - radius) positions.push({ x: x + width, y: y - height });
  if (x > width - radius && y > height - radius) positions.push({ x: x - width, y: y - height });

  return positions;
}

function checkWrappedCollision(
  ax: number,
  ay: number,
  aRadius: number,
  bx: number,
  by: number,
  bRadius: number,
): boolean {
  const aPositions = getCollisionPositions(ax, ay, aRadius);
  const bPositions = getCollisionPositions(bx, by, bRadius);

  for (const posA of aPositions) {
    for (const posB of bPositions) {
      const dx = posA.x - posB.x;
      const dy = posA.y - posB.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < aRadius + bRadius) {
        return true;
      }
    }
  }
  return false;
}

export function processBulletAsteroidCollisions(): {
  bulletIndex: number;
  asteroidIndex: number;
}[] {
  const hits: { bulletIndex: number; asteroidIndex: number }[] = [];

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const bulletRadius = 15;

    for (let j = asteroids.length - 1; j >= 0; j--) {
      const asteroid = asteroids[j];

      if (
        checkWrappedCollision(
          bullet.x,
          bullet.y,
          bulletRadius,
          asteroid.x,
          asteroid.y,
          asteroid.getRadius(),
        )
      ) {
        hits.push({ bulletIndex: i, asteroidIndex: j });
        break;
      }
    }
  }

  return hits;
}

export function processPlayerAsteroidCollisions(onHit: (player: Player) => void): void {
  const currentPlayer = player;
  if (!currentPlayer) {
    return;
  }

  for (const asteroid of asteroids) {
    if (currentPlayer.invulnerable || currentPlayer.lives <= 0) continue;

    const asteroidRadius = asteroid.getRadius();
    const shieldCollisionDist = SHIELD_RADIUS + asteroidRadius;
    const shipCollisionDist = currentPlayer.getRadius() + asteroidRadius;

    const playerPositions = getCollisionPositions(
      currentPlayer.x,
      currentPlayer.y,
      currentPlayer.getRadius(),
    );

    let collisionDetected = false;
    let actualDx = 0;
    let actualDy = 0;
    let actualDist = 0;

    for (const pos of playerPositions) {
      const dx = pos.x - asteroid.x;
      const dy = pos.y - asteroid.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < shieldCollisionDist || dist < shipCollisionDist) {
        collisionDetected = true;
        actualDx = currentPlayer.x - asteroid.x;
        actualDy = currentPlayer.y - asteroid.y;
        actualDist = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
        break;
      }
    }

    if (!collisionDetected) continue;

    if (currentPlayer.shieldActive && actualDist < shieldCollisionDist) {
      const now = Date.now();
      if (now < currentPlayer.shieldHitUntil) continue;

      currentPlayer.shieldHitUntil = now + SHIELD_HIT_COOLDOWN;

      const nx = actualDx / actualDist;
      const ny = actualDy / actualDist;

      const bounceForce = 8;
      const shipInfluence = asteroid.mass / (1 + asteroid.mass);

      asteroid.vx -= nx * bounceForce * (1 - shipInfluence);
      asteroid.vy -= ny * bounceForce * (1 - shipInfluence);
      currentPlayer.vx += nx * bounceForce * shipInfluence;
      currentPlayer.vy += ny * bounceForce * shipInfluence;

      const overlap = shieldCollisionDist - actualDist;
      asteroid.x -= nx * overlap;
      asteroid.y -= ny * overlap;

      currentPlayer.shieldHits--;
      if (currentPlayer.shieldHits <= 0) {
        currentPlayer.shieldActive = false;
      }
    } else if (!currentPlayer.shieldActive && actualDist < shipCollisionDist) {
      const massMultiplier =
        asteroid.size === 'mega'
          ? 0.1
          : asteroid.size === 'big'
            ? 0.2
            : asteroid.size === 'medium'
              ? 0.5
              : 1.0;
      asteroid.vx += currentPlayer.vx * massMultiplier;
      asteroid.vy += currentPlayer.vy * massMultiplier;
      asteroid.hits -= 10;
      onHit(currentPlayer);
    }
  }
}

export function processBulletPlayerCollisions(): number[] {
  const hitIndices: number[] = [];
  if (!player) {
    return hitIndices;
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const bulletRadius = 15;

    if (player.invulnerable || player.lives <= 0) continue;

    if (
      checkWrappedCollision(
        bullet.x,
        bullet.y,
        bulletRadius,
        player.x,
        player.y,
        player.getRadius(),
      )
    ) {
      hitIndices.push(i);
    }
  }

  return hitIndices;
}
