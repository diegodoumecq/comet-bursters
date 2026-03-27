import { SHIELD_HIT_COOLDOWN, SHIELD_RADIUS, type Player } from '@/constants';
import { asteroids, bullets, getGameHeight, getGameWidth, planets, players } from '@/state';

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
  for (const asteroid of asteroids) {
    for (const player of players) {
      if (player.invulnerable || player.lives <= 0) continue;

      const asteroidRadius = asteroid.getRadius();
      const shieldCollisionDist = SHIELD_RADIUS + asteroidRadius;
      const shipCollisionDist = player.getRadius() + asteroidRadius;

      const playerPositions = getCollisionPositions(player.x, player.y, player.getRadius());

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
          actualDx = player.x - asteroid.x;
          actualDy = player.y - asteroid.y;
          actualDist = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
          break;
        }
      }

      if (!collisionDetected) continue;

      if (player.shieldActive && actualDist < shieldCollisionDist) {
        const now = Date.now();
        if (now < player.shieldHitUntil) continue;

        player.shieldHitUntil = now + SHIELD_HIT_COOLDOWN;

        const nx = actualDx / actualDist;
        const ny = actualDy / actualDist;

        const bounceForce = 8;
        const shipInfluence = asteroid.mass / (1 + asteroid.mass);

        asteroid.vx -= nx * bounceForce * (1 - shipInfluence);
        asteroid.vy -= ny * bounceForce * (1 - shipInfluence);
        player.vx += nx * bounceForce * shipInfluence;
        player.vy += ny * bounceForce * shipInfluence;

        const overlap = shieldCollisionDist - actualDist;
        asteroid.x -= nx * overlap;
        asteroid.y -= ny * overlap;

        player.shieldHits--;
        if (player.shieldHits <= 0) {
          player.shieldActive = false;
        }
      } else if (!player.shieldActive && actualDist < shipCollisionDist) {
        const massMultiplier =
          asteroid.size === 'mega'
            ? 0.1
            : asteroid.size === 'big'
              ? 0.2
              : asteroid.size === 'medium'
                ? 0.5
                : 1.0;
        asteroid.vx += player.vx * massMultiplier;
        asteroid.vy += player.vy * massMultiplier;
        asteroid.hits -= 10;
        onHit(player);
      }
    }
  }
}

export function processBulletPlayerCollisions(): number[] {
  const hitIndices: number[] = [];

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const bulletRadius = 15;

    for (const player of players) {
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
        break;
      }
    }
  }

  return hitIndices;
}

export function processPlanetPlayerCollisions(onHit: (player: Player) => void): void {
  for (const planet of planets) {
    for (const player of players) {
      if (player.invulnerable || player.lives <= 0 || player.waitingToRespawn) continue;

      const planetRadius = planet.getRadius();
      const playerRadius = player.getRadius();

      const playerPositions = getCollisionPositions(player.x, player.y, playerRadius);
      const planetPositions = getCollisionPositions(planet.x, planet.y, planetRadius);

      for (const pPos of playerPositions) {
        for (const plPos of planetPositions) {
          const dx = pPos.x - plPos.x;
          const dy = pPos.y - plPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < planetRadius + playerRadius) {
            onHit(player);
            break;
          }
        }
      }
    }
  }
}

export function processPlanetAsteroidCollisions(): number[] {
  const destroyedIndices: number[] = [];

  for (let i = asteroids.length - 1; i >= 0; i--) {
    const asteroid = asteroids[i];

    for (const planet of planets) {
      const planetRadius = planet.getRadius();
      const asteroidRadius = asteroid.getRadius();

      const asteroidPositions = getCollisionPositions(asteroid.x, asteroid.y, asteroidRadius);
      const planetPositions = getCollisionPositions(planet.x, planet.y, planetRadius);

      for (const aPos of asteroidPositions) {
        for (const plPos of planetPositions) {
          const dx = aPos.x - plPos.x;
          const dy = aPos.y - plPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < planetRadius + asteroidRadius) {
            destroyedIndices.push(i);
            break;
          }
        }
      }

      if (destroyedIndices.includes(i)) break;
    }
  }

  return destroyedIndices;
}

export function processPlanetBulletCollisions(): number[] {
  const hitIndices: number[] = [];

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const bulletRadius = 15;

    for (const planet of planets) {
      const planetRadius = planet.getRadius();

      const bulletPositions = getCollisionPositions(bullet.x, bullet.y, bulletRadius);
      const planetPositions = getCollisionPositions(planet.x, planet.y, planetRadius);

      for (const bPos of bulletPositions) {
        for (const plPos of planetPositions) {
          const dx = bPos.x - plPos.x;
          const dy = bPos.y - plPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < planetRadius + bulletRadius) {
            hitIndices.push(i);
            break;
          }
        }
      }

      if (hitIndices.includes(i)) break;
    }
  }

  return hitIndices;
}
