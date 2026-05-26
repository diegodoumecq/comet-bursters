import type { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import { circlesOverlap } from '../core/collision';
import type { Vector } from '../core/types';
import { SHIELD_HIT_COOLDOWN_MS, spendShieldFuel } from '../fuel/rules';
import type { ProjectileEntity } from '../projectiles/types';
import { PROJECTILES } from '../weapons/config';

export function applyProjectileImpulse(
  projectile: ProjectileEntity,
  asteroid: AsteroidEntity,
  runtime: AsteroidBodies,
): void {
  const asteroidVelocity = asteroid.velocity;
  const config = ASTEROIDS[asteroid.tier];
  const projectileSpeed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (projectileSpeed === 0) return;
  const normalX = projectile.velocity.x / projectileSpeed;
  const normalY = projectile.velocity.y / projectileSpeed;
  const impulse = PROJECTILES[projectile.kind].impact * 1.5 * (1 / config.mass);
  asteroidVelocity.x += normalX * impulse;
  asteroidVelocity.y += normalY * impulse;
  asteroid.velocity = asteroidVelocity;
  runtime.get(asteroid).setVelocity(asteroidVelocity.x, asteroidVelocity.y);
}

export function damageAsteroid(projectile: ProjectileEntity, asteroid: AsteroidEntity): boolean {
  asteroid.hits = (asteroid.hits ?? 1) - PROJECTILES[projectile.kind].damage;
  return (asteroid.hits ?? 0) <= 0;
}

export type ProjectileCombatEvent =
  | { asteroid: AsteroidEntity; projectile: ProjectileEntity; type: 'projectileHitAsteroid' }
  | { asteroid: AsteroidEntity; projectile: ProjectileEntity; type: 'asteroidDestroyed' };

export function resolveProjectileContactCombat(
  contacts: Array<{ asteroid: AsteroidEntity; projectile: ProjectileEntity }>,
  runtime: AsteroidBodies,
): ProjectileCombatEvent[] {
  const events: ProjectileCombatEvent[] = [];
  const destroyed = new Set<AsteroidEntity>();
  const handledProjectiles = new Set<ProjectileEntity>();
  for (const { asteroid, projectile } of contacts) {
    if (
      projectile.kind !== 'blackHole' &&
      projectile.kind !== 'inspectionProbe' &&
      !destroyed.has(asteroid) &&
      !handledProjectiles.has(projectile)
    ) {
      handledProjectiles.add(projectile);
      applyProjectileImpulse(projectile, asteroid, runtime);
      events.push({ asteroid, projectile, type: 'projectileHitAsteroid' });
      if (damageAsteroid(projectile, asteroid)) {
        destroyed.add(asteroid);
        events.push({ asteroid, projectile, type: 'asteroidDestroyed' });
      }
    }
  }
  return events;
}

export function resolvePlayerAsteroidCollision(input: {
  asteroid: AsteroidEntity;
  fuel: number;
  getDelta?: (from: Vector, to: Vector) => Vector;
  now: number;
  playerPosition: Vector;
  playerRadius: number;
  playerVelocity: Vector;
  shieldActive: boolean;
  shieldRadius: number;
  shieldHitUntil: number;
}): {
  asteroidPosition?: Vector;
  asteroidVelocity?: Vector;
  fuel: number;
  hitPlayer: boolean;
  playerVelocity: Vector;
  shieldHitUntil: number;
} {
  const asteroidRadius = ASTEROIDS[input.asteroid.tier].collisionRadius;
  const delta = input.getDelta
    ? input.getDelta(input.asteroid.position, input.playerPosition)
    : {
        x: input.playerPosition.x - input.asteroid.position.x,
        y: input.playerPosition.y - input.asteroid.position.y,
      };
  const dx = delta.x;
  const dy = delta.y;
  const distance = Math.hypot(dx, dy);
  const shieldCollisionDistance = input.shieldRadius + asteroidRadius;
  if (
    input.shieldActive &&
    input.fuel > 0 &&
    distance <= shieldCollisionDistance &&
    input.now >= input.shieldHitUntil
  ) {
    return getShieldBounce(input, dx, dy, distance, shieldCollisionDistance);
  }
  return {
    fuel: input.fuel,
    hitPlayer: !input.shieldActive && circlesOverlap(distance, input.playerRadius, asteroidRadius),
    playerVelocity: input.playerVelocity,
    shieldHitUntil: input.shieldHitUntil,
  };
}

export type PlayerCombatResult = {
  asteroidMutations: Array<{ asteroid: AsteroidEntity; position?: Vector; velocity?: Vector }>;
  fuel: number;
  playerDestroyed: boolean;
  playerVelocity: Vector;
  shieldHitUntil: number;
};

export function resolvePlayerCombat(input: {
  asteroids: AsteroidEntity[];
  fuel: number;
  getDelta?: (from: Vector, to: Vector) => Vector;
  invulnerable: boolean;
  now: number;
  playerAlive: boolean;
  playerPosition: Vector;
  playerRadius: number;
  playerVelocity: Vector;
  shieldActive: boolean;
  shieldRadius: number;
  shieldHitUntil: number;
}): PlayerCombatResult {
  if (!input.playerAlive || input.invulnerable) {
    return {
      asteroidMutations: [],
      fuel: input.fuel,
      playerDestroyed: false,
      playerVelocity: input.playerVelocity,
      shieldHitUntil: input.shieldHitUntil,
    };
  }

  const asteroidMutations: PlayerCombatResult['asteroidMutations'] = [];
  let fuel = input.fuel;
  let playerVelocity = input.playerVelocity;
  let shieldHitUntil = input.shieldHitUntil;
  for (const asteroid of input.asteroids) {
    const result = resolvePlayerAsteroidCollision({
      asteroid,
      fuel,
      getDelta: input.getDelta,
      now: input.now,
      playerPosition: input.playerPosition,
      playerRadius: input.playerRadius,
      playerVelocity,
      shieldActive: input.shieldActive,
      shieldRadius: input.shieldRadius,
      shieldHitUntil,
    });
    fuel = result.fuel;
    playerVelocity = result.playerVelocity;
    shieldHitUntil = result.shieldHitUntil;
    if (result.asteroidPosition || result.asteroidVelocity) {
      asteroidMutations.push({
        asteroid,
        position: result.asteroidPosition,
        velocity: result.asteroidVelocity,
      });
    }
    if (result.hitPlayer) {
      return {
        asteroidMutations,
        fuel,
        playerDestroyed: true,
        playerVelocity: { x: 0, y: 0 },
        shieldHitUntil,
      };
    }
  }
  return { asteroidMutations, fuel, playerDestroyed: false, playerVelocity, shieldHitUntil };
}

function getShieldBounce(
  input: Parameters<typeof resolvePlayerAsteroidCollision>[0],
  dx: number,
  dy: number,
  distance: number,
  shieldCollisionDistance: number,
) {
  const safeDistance = distance || 1;
  const normal = { x: dx / safeDistance, y: dy / safeDistance };
  const asteroidConfig = ASTEROIDS[input.asteroid.tier];
  const asteroidVelocity = input.asteroid.velocity ?? { x: 0, y: 0 };
  const bounceForce = 8;
  const shipInfluence = asteroidConfig.mass / (1 + asteroidConfig.mass);
  const overlap = shieldCollisionDistance - distance;
  return {
    asteroidPosition: {
      x: input.asteroid.position.x - normal.x * overlap,
      y: input.asteroid.position.y - normal.y * overlap,
    },
    asteroidVelocity: {
      x: asteroidVelocity.x - normal.x * bounceForce * (1 - shipInfluence),
      y: asteroidVelocity.y - normal.y * bounceForce * (1 - shipInfluence),
    },
    fuel: spendShieldFuel(input.fuel, input.asteroid.tier),
    hitPlayer: false,
    playerVelocity: {
      x: input.playerVelocity.x + normal.x * bounceForce * shipInfluence,
      y: input.playerVelocity.y + normal.y * bounceForce * shipInfluence,
    },
    shieldHitUntil: input.now + SHIELD_HIT_COOLDOWN_MS,
  };
}
