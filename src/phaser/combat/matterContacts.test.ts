import { describe, expect, it } from 'vitest';

import type { AsteroidBodies } from '../asteroids/bodies';
import type { AsteroidEntity } from '../asteroids/types';
import { MatterContacts } from './matterContacts';

type CollisionHandler = (event: { pairs: Array<{ bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }> }) => void;

function body(id: number): MatterJS.BodyType {
  return { id } as MatterJS.BodyType;
}

function asteroid(): AsteroidEntity {
  return {
    id: 1,
    position: { x: 0, y: 0 },
    tier: 'small',
    velocity: { x: 0, y: 0 },
    visualVariant: 0,
  };
}

function runtimeWithBodyIds(bodyIds: number[]): AsteroidBodies {
  return {
    getBodyIds: () => bodyIds,
  } as unknown as AsteroidBodies;
}

function createContacts(): { contacts: MatterContacts; emitCollision: CollisionHandler } {
  let collisionHandler: CollisionHandler | null = null;
  const scene = {
    matter: {
      world: {
        on: (_event: string, handler: CollisionHandler) => {
          collisionHandler = handler;
        },
      },
    },
  };
  const contacts = new MatterContacts(scene as Phaser.Scene);
  if (!collisionHandler) throw new Error('Matter collision handler was not registered');
  return { contacts, emitCollision: collisionHandler };
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
});
