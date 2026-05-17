import type { AsteroidEntity, ProjectileEntity, Vector } from '../../model';
import { ASTEROIDS } from '../../services/asteroids';
import { SHIELD_HIT_COOLDOWN_MS, SHIELD_RADIUS, spendShieldFuel } from '../../services/fuel';
import { PROJECTILES } from '../../services/weapons';

export function applyProjectileImpulse(projectile: ProjectileEntity, asteroid: AsteroidEntity): void {
  const asteroidVelocity = asteroid.velocity ?? { x: 0, y: 0 };
  const config = ASTEROIDS[asteroid.tier];
  const projectileSpeed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (projectileSpeed === 0) return;
  const normalX = projectile.velocity.x / projectileSpeed;
  const normalY = projectile.velocity.y / projectileSpeed;
  const impulse = PROJECTILES[projectile.kind].impact * 1.5 * (1 / config.mass);
  asteroidVelocity.x += normalX * impulse;
  asteroidVelocity.y += normalY * impulse;
  asteroid.velocity = asteroidVelocity;
  asteroid.body.setVelocity(asteroidVelocity.x, asteroidVelocity.y);
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
): ProjectileCombatEvent[] {
  const events: ProjectileCombatEvent[] = [];
  const destroyed = new Set<AsteroidEntity>();
  const handledProjectiles = new Set<ProjectileEntity>();
  for (const { asteroid, projectile } of contacts) {
    if (projectile.kind !== 'blackHole' && !destroyed.has(asteroid) && !handledProjectiles.has(projectile)) {
      handledProjectiles.add(projectile);
      applyProjectileImpulse(projectile, asteroid);
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
  now: number;
  playerPosition: Vector;
  playerVelocity: Vector;
  shieldActive: boolean;
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
  const dx = input.playerPosition.x - input.asteroid.body.x;
  const dy = input.playerPosition.y - input.asteroid.body.y;
  const distance = Math.hypot(dx, dy);
  const shieldCollisionDistance = SHIELD_RADIUS + asteroidRadius;
  if (input.shieldActive && input.fuel > 0 && distance <= shieldCollisionDistance && input.now >= input.shieldHitUntil) {
    return getShieldBounce(input, dx, dy, distance, shieldCollisionDistance);
  }
  return {
    fuel: input.fuel,
    hitPlayer: !input.shieldActive && distance <= 18 + asteroidRadius,
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
  invulnerable: boolean;
  now: number;
  playerAlive: boolean;
  playerPosition: Vector;
  playerVelocity: Vector;
  shieldActive: boolean;
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
      now: input.now,
      playerPosition: input.playerPosition,
      playerVelocity,
      shieldActive: input.shieldActive,
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
      x: input.asteroid.body.x - normal.x * overlap,
      y: input.asteroid.body.y - normal.y * overlap,
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
