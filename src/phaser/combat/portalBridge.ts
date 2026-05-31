import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import { circlesOverlap } from '../core/collision';
import type { Vector } from '../core/types';
import { portalApertureContainsCenter } from '../dimensions/portalGeometry';
import type { PortalEntity } from '../dimensions/types';
import type { ProjectileEntity } from '../projectiles/types';
import { PROJECTILES } from '../weapons/config';

export type PortalBridgeAsteroidMutation = {
  asteroid: AsteroidEntity;
  position: Vector;
  velocity: Vector;
};

export function resolvePortalBridgeAsteroidCollisions(input: {
  arcadeAsteroids: AsteroidEntity[];
  getDelta: (from: Vector, to: Vector) => Vector;
  portal: PortalEntity | null;
  riftAsteroids: AsteroidEntity[];
}): PortalBridgeAsteroidMutation[] {
  const { portal } = input;
  if (!portal || portal.lifecycle !== 'active') return [];

  const arcadeAsteroids = input.arcadeAsteroids.filter((asteroid) =>
    portalApertureContainsCenter(portal, asteroid.position),
  );
  const riftAsteroids = input.riftAsteroids.filter((asteroid) =>
    portalApertureContainsCenter(portal, asteroid.position),
  );
  const mutations: PortalBridgeAsteroidMutation[] = [];
  const nextVelocities = new Map<AsteroidEntity, Vector>();
  const nextPositions = new Map<AsteroidEntity, Vector>();

  for (const arcade of arcadeAsteroids) {
    for (const rift of riftAsteroids) {
      const result = resolveAsteroidPair({
        getDelta: input.getDelta,
        left: arcade,
        right: rift,
      });
      if (result) {
        nextVelocities.set(arcade, result.left.velocity);
        nextPositions.set(arcade, result.left.position);
        nextVelocities.set(rift, result.right.velocity);
        nextPositions.set(rift, result.right.position);
      }
    }
  }

  for (const [asteroid, velocity] of nextVelocities) {
    mutations.push({
      asteroid,
      position: nextPositions.get(asteroid) ?? asteroid.position,
      velocity,
    });
  }
  return mutations;
}

export function getPortalBridgeProjectileAsteroidContacts(input: {
  arcadeAsteroids: AsteroidEntity[];
  arcadeProjectiles: ProjectileEntity[];
  getDelta: (from: Vector, to: Vector) => Vector;
  portal: PortalEntity | null;
  riftAsteroids: AsteroidEntity[];
  riftProjectiles: ProjectileEntity[];
}): Array<{ asteroid: AsteroidEntity; projectile: ProjectileEntity }> {
  const { portal } = input;
  if (!portal || portal.lifecycle !== 'active') return [];

  return [
    ...getProjectileAsteroidContacts({
      asteroids: input.riftAsteroids,
      getDelta: input.getDelta,
      portal,
      projectiles: input.arcadeProjectiles,
    }),
    ...getProjectileAsteroidContacts({
      asteroids: input.arcadeAsteroids,
      getDelta: input.getDelta,
      portal,
      projectiles: input.riftProjectiles,
    }),
  ];
}

function resolveAsteroidPair(input: {
  getDelta: (from: Vector, to: Vector) => Vector;
  left: AsteroidEntity;
  right: AsteroidEntity;
}): {
  left: { position: Vector; velocity: Vector };
  right: { position: Vector; velocity: Vector };
} | null {
  const leftConfig = ASTEROIDS[input.left.tier];
  const rightConfig = ASTEROIDS[input.right.tier];
  const delta = input.getDelta(input.left.position, input.right.position);
  const distance = Math.hypot(delta.x, delta.y);
  const collisionDistance = leftConfig.collisionRadius + rightConfig.collisionRadius;
  if (!circlesOverlap(distance, leftConfig.collisionRadius, rightConfig.collisionRadius)) {
    return null;
  }

  const safeDistance = distance || 1;
  const normal = { x: delta.x / safeDistance, y: delta.y / safeDistance };
  const invLeftMass = 1 / leftConfig.mass;
  const invRightMass = 1 / rightConfig.mass;
  const relativeVelocity = {
    x: input.right.velocity.x - input.left.velocity.x,
    y: input.right.velocity.y - input.left.velocity.y,
  };
  const separatingSpeed = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
  const impulse = separatingSpeed < 0 ? (-2 * separatingSpeed) / (invLeftMass + invRightMass) : 0;
  const overlap = Math.max(0, collisionDistance - safeDistance);
  const correctionScale = overlap / (invLeftMass + invRightMass);

  return {
    left: {
      position: {
        x: input.left.position.x - normal.x * correctionScale * invLeftMass,
        y: input.left.position.y - normal.y * correctionScale * invLeftMass,
      },
      velocity: {
        x: input.left.velocity.x - impulse * invLeftMass * normal.x,
        y: input.left.velocity.y - impulse * invLeftMass * normal.y,
      },
    },
    right: {
      position: {
        x: input.right.position.x + normal.x * correctionScale * invRightMass,
        y: input.right.position.y + normal.y * correctionScale * invRightMass,
      },
      velocity: {
        x: input.right.velocity.x + impulse * invRightMass * normal.x,
        y: input.right.velocity.y + impulse * invRightMass * normal.y,
      },
    },
  };
}

function getProjectileAsteroidContacts(input: {
  asteroids: AsteroidEntity[];
  getDelta: (from: Vector, to: Vector) => Vector;
  portal: PortalEntity;
  projectiles: ProjectileEntity[];
}): Array<{ asteroid: AsteroidEntity; projectile: ProjectileEntity }> {
  const contacts: Array<{ asteroid: AsteroidEntity; projectile: ProjectileEntity }> = [];
  const projectiles = input.projectiles.filter((projectile) =>
    portalApertureContainsCenter(input.portal, projectile.position),
  );
  const asteroids = input.asteroids.filter((asteroid) =>
    portalApertureContainsCenter(input.portal, asteroid.position),
  );

  for (const projectile of projectiles) {
    for (const asteroid of asteroids) {
      const delta = input.getDelta(projectile.position, asteroid.position);
      const distance = Math.hypot(delta.x, delta.y);
      if (
        circlesOverlap(
          distance,
          PROJECTILES[projectile.kind].radius,
          ASTEROIDS[asteroid.tier].collisionRadius,
        )
      ) {
        contacts.push({ asteroid, projectile });
      }
    }
  }
  return contacts;
}
