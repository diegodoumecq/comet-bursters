import type { Vector } from '../core/types';
import { FUEL_BLOB_CHAIN_REACTION_RADIUS } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import type { ProjectileEntity } from '../projectiles/types';

export type ProjectileFuelBlobContact = {
  blob: FuelBlobEntity;
  projectile: ProjectileEntity;
};

export type ProjectileFuelBlobCombatEvent = {
  blobs: FuelBlobEntity[];
  projectile: ProjectileEntity;
};

export function resolveProjectileFuelBlobCombatEvents(input: {
  contacts: ProjectileFuelBlobContact[];
  fuelBlobs: FuelBlobEntity[];
  getDistance: (from: Vector, to: Vector) => number;
  projectiles: ProjectileEntity[];
}): ProjectileFuelBlobCombatEvent[] {
  const activeProjectiles = new Set(input.projectiles);
  const activeFuelBlobs = new Set(input.fuelBlobs);
  const handledBlobIds = new Set<number>();
  const events: ProjectileFuelBlobCombatEvent[] = [];
  const activeContacts = input.contacts.filter(
    (contact) => activeProjectiles.has(contact.projectile) && activeFuelBlobs.has(contact.blob),
  );
  for (const contact of resolveProjectileFuelBlobContacts(activeContacts)) {
    if (!handledBlobIds.has(contact.blob.id)) {
      const blobs = getFuelBlobCombatChain({
        blobs: input.fuelBlobs,
        getDistance: input.getDistance,
        origin: contact.blob,
      }).filter((blob) => activeFuelBlobs.has(blob));
      for (const blob of blobs) handledBlobIds.add(blob.id);
      events.push({ blobs, projectile: contact.projectile });
    }
  }
  return events;
}

function getFuelBlobCombatChain(input: {
  blobs: FuelBlobEntity[];
  getDistance: (from: Vector, to: Vector) => number;
  origin: FuelBlobEntity;
}): FuelBlobEntity[] {
  const exploded: FuelBlobEntity[] = [];
  const explodedIds = new Set<number>();
  const pending = [input.origin];
  for (let pendingIndex = 0; pendingIndex < pending.length; pendingIndex += 1) {
    const current = pending[pendingIndex];
    if (!explodedIds.has(current.id)) {
      explodedIds.add(current.id);
      exploded.push(current);
      for (const candidate of input.blobs) {
        if (
          !explodedIds.has(candidate.id) &&
          input.getDistance(current.position, candidate.position) <= FUEL_BLOB_CHAIN_REACTION_RADIUS
        ) {
          pending.push(candidate);
        }
      }
    }
  }
  return exploded;
}

export function resolveProjectileFuelBlobContacts(
  contacts: ProjectileFuelBlobContact[],
): ProjectileFuelBlobContact[] {
  const handledProjectiles = new Set<ProjectileEntity>();
  const handledBlobs = new Set<FuelBlobEntity>();
  const events: ProjectileFuelBlobContact[] = [];
  for (const contact of contacts) {
    if (
      canProjectileDetonateFuelBlob(contact.projectile) &&
      !handledProjectiles.has(contact.projectile) &&
      !handledBlobs.has(contact.blob)
    ) {
      handledProjectiles.add(contact.projectile);
      handledBlobs.add(contact.blob);
      events.push(contact);
    }
  }
  return events;
}

function canProjectileDetonateFuelBlob(projectile: ProjectileEntity): boolean {
  return projectile.kind !== 'blackHole' && projectile.kind !== 'inspectionProbe';
}
