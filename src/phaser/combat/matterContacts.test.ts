import { describe, expect, it } from 'vitest';

import type { AsteroidBodies } from '../asteroids/bodies';
import type { AsteroidEntity } from '../asteroids/types';
import type { FuelBodies } from '../fuel/bodies';
import type { FuelBlobEntity } from '../fuel/types';
import type { ProjectileBodies } from '../projectiles/bodies';
import type { ProjectileEntity } from '../projectiles/types';
import type { EntityBodies } from '../entities/bodies';
import type { GameEntity } from '../entities/types';
import { MatterContacts } from './matterContacts';

type CollisionHandler = (event: {
  pairs: Array<{ bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }>;
}) => void;

function body(id: number): MatterJS.BodyType {
  return { id } as MatterJS.BodyType;
}

function asteroid(): AsteroidEntity {
  return {
    angularVelocity: 0,
    id: 1,
    position: { x: 0, y: 0 },
    rotation: 0,
    tier: 'small',
    velocity: { x: 3, y: -2 },
    visualVariant: 0,
  };
}

function fuelBlob(): FuelBlobEntity {
  return {
    id: 1,
    airResistance: 0.015,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    wobbleSeed: 0,
  };
}

function entity(): GameEntity {
  return {
    angularVelocity: 0,
    id: 1,
    kind: 'monolith',
    position: { x: 0, y: 0 },
    rotation: 0,
    velocity: { x: 0, y: 0 },
  };
}

function projectile(): ProjectileEntity {
  return {
    absorbedFuel: 0,
    ageMs: 0,
    angle: 0,
    airResistance: 0.01,
    baseSpeed: 20,
    blackHoleMass: 0,
    collapseStartedAt: null,
    createdAt: 0,
    damage: 1,
    id: 1,
    impact: 0.2,
    kind: 'small',
    lifetimeMs: 1000,
    position: { x: 0, y: 0 },
    radius: 2,
    velocity: { x: 0, y: 0 },
  };
}

function runtimeWithBodyIds(bodyIds: number[]): AsteroidBodies {
  return {
    getBodyIds: () => bodyIds,
  } as unknown as AsteroidBodies;
}

function entityRuntimeWithBodyIds(bodyIds: number[]): EntityBodies {
  return {
    getBodyIds: () => bodyIds,
  } as unknown as EntityBodies;
}

function fuelRuntimeWithBodyId(bodyId: number): FuelBodies {
  return {
    getBodyId: () => bodyId,
  } as unknown as FuelBodies;
}

function projectileRuntimeWithBodyId(bodyId: number): ProjectileBodies {
  return {
    get: () => ({ body: body(bodyId) }),
  } as unknown as ProjectileBodies;
}

function createContacts(): {
  contacts: MatterContacts;
  emitActiveCollision: CollisionHandler;
  emitBeforeUpdate: () => void;
  emitCollision: CollisionHandler;
} {
  let beforeUpdateHandler: (() => void) | null = null;
  let activeCollisionHandler: CollisionHandler | null = null;
  let collisionHandler: CollisionHandler | null = null;
  const scene = {
    matter: {
      world: {
        on: (event: string, handler: CollisionHandler | (() => void)) => {
          if (event === 'beforeupdate') {
            beforeUpdateHandler = handler as () => void;
          }
          if (event === 'collisionstart') {
            collisionHandler = handler as CollisionHandler;
          }
          if (event === 'collisionactive') {
            activeCollisionHandler = handler as CollisionHandler;
          }
        },
      },
    },
  };
  const contacts = new MatterContacts(scene as Phaser.Scene);
  if (!beforeUpdateHandler) throw new Error('Matter beforeupdate handler was not registered');
  if (!collisionHandler) throw new Error('Matter collision handler was not registered');
  if (!activeCollisionHandler) throw new Error('Matter collisionactive handler was not registered');
  return {
    contacts,
    emitActiveCollision: activeCollisionHandler,
    emitBeforeUpdate: beforeUpdateHandler,
    emitCollision: collisionHandler,
  };
}

describe('MatterContacts', () => {
  it('uses the latest registered player body for asteroid contacts', () => {
    const { contacts, emitCollision } = createContacts();
    const target = asteroid();
    contacts.addAsteroid(target, runtimeWithBodyIds([30]));
    contacts.setPlayer(body(10));
    contacts.setPlayer(body(20));

    emitCollision({ pairs: [{ bodyA: body(10), bodyB: body(30) }] });
    expect(contacts.consumePlayerAsteroids()).toEqual([]);

    emitCollision({ pairs: [{ bodyA: body(20), bodyB: body(30) }] });
    expect(contacts.consumePlayerAsteroids()).toEqual([target]);
  });

  it('captures the asteroid velocity from before scene sync for player contacts', () => {
    const { contacts, emitBeforeUpdate, emitCollision } = createContacts();
    const target = asteroid();
    contacts.addAsteroid(target, runtimeWithBodyIds([30]));
    contacts.setPlayer(body(10));

    emitBeforeUpdate();
    target.velocity = { x: 8, y: 1 };
    emitCollision({ pairs: [{ bodyA: body(10), bodyB: body(30) }] });

    expect(contacts.consumePlayerAsteroidContacts()).toEqual([
      {
        asteroid: target,
        asteroidVelocityBefore: { x: 3, y: -2 },
      },
    ]);
  });

  it('uses the latest registered shield body for asteroid contacts', () => {
    const { contacts, emitCollision } = createContacts();
    const target = asteroid();
    contacts.addAsteroid(target, runtimeWithBodyIds([30]));
    contacts.setShield(body(10));
    contacts.setShield(body(20));

    emitCollision({ pairs: [{ bodyA: body(10), bodyB: body(30) }] });
    expect(contacts.consumeShieldAsteroids()).toEqual([]);

    emitCollision({ pairs: [{ bodyA: body(20), bodyB: body(30) }] });
    expect(contacts.consumeShieldAsteroids()).toEqual([target]);
  });

  it('captures active player fuel blob contacts for absorption', () => {
    const { contacts, emitActiveCollision } = createContacts();
    const target = fuelBlob();
    contacts.addFuelBlob(target, fuelRuntimeWithBodyId(30));
    contacts.setPlayer(body(10));

    emitActiveCollision({ pairs: [{ bodyA: body(10), bodyB: body(30) }] });

    expect(contacts.consumePlayerFuelBlobs()).toEqual([target]);
  });

  it('captures projectile fuel blob contacts for detonation', () => {
    const { contacts, emitCollision } = createContacts();
    const target = fuelBlob();
    const shot = projectile();
    contacts.addFuelBlob(target, fuelRuntimeWithBodyId(30));
    contacts.addProjectile(shot, projectileRuntimeWithBodyId(40));

    emitCollision({ pairs: [{ bodyA: body(40), bodyB: body(30) }] });

    expect(contacts.consumeProjectileFuelBlobs()).toEqual([{ blob: target, projectile: shot }]);
  });

  it('captures projectile entity contacts independently from asteroids', () => {
    const { contacts, emitCollision } = createContacts();
    const target = entity();
    const shot = projectile();
    contacts.addEntity(target, entityRuntimeWithBodyIds([30]));
    contacts.addProjectile(shot, projectileRuntimeWithBodyId(40));

    emitCollision({ pairs: [{ bodyA: body(40), bodyB: body(30) }] });

    expect(contacts.consumeProjectileGameEntities()).toEqual([{ projectile: shot, entity: target }]);
    expect(contacts.consumeProjectileAsteroids()).toEqual([]);
  });
});
