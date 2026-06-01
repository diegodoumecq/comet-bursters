import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity, AsteroidTier } from '../asteroids/types';
import { addVector, getPortalTangent, scaleVector } from './portalGeometry';
import type { PortalDirectorPlan } from './types';

let nextPortalAsteroidId = 1_000_000;

export function createPortalAsteroidSpawn(input: {
  burstIndex: number;
  plan: PortalDirectorPlan;
}): AsteroidEntity[] {
  const asteroids: AsteroidEntity[] = [];
  const portal = input.plan.portal;
  const tangent = getPortalTangent(portal);
  const spawnCenter = addVector(
    portal.position,
    scaleVector(portal.normal, -input.plan.spawn.spawnDistance),
  );

  for (let index = 0; index < input.plan.spawn.asteroidCount; index += 1) {
    const tier = chooseBurstTier(input.burstIndex);
    const spread =
      input.plan.spawn.asteroidCount <= 1
        ? 0
        : ((index / (input.plan.spawn.asteroidCount - 1)) * 2 - 1) * input.plan.spawn.spreadRadius;
    const position = addVector(spawnCenter, scaleVector(tangent, spread));
    const speed = input.plan.spawn.asteroidSpeed * randomBetween(0.88, 1.12);
    const velocity = scaleVector(portal.normal, speed);
    asteroids.push({
      angularVelocity: randomBetween(-0.025, 0.025),
      id: nextPortalAsteroidId++,
      hits: ASTEROIDS[tier].hits,
      membership: { space: 'rift' },
      position,
      rotation: randomBetween(0, Math.PI * 2),
      tier,
      velocity,
      visualVariant: randomInt(0, 1),
    });
  }
  return asteroids;
}

function chooseBurstTier(burstIndex: number): AsteroidTier {
  const roll = Math.random();
  const megaChance = Math.min(0.13, burstIndex * 0.012);
  const bigChance = Math.min(0.34, burstIndex * 0.032);
  const mediumChance = Math.min(0.38, burstIndex * 0.045);
  if (burstIndex >= 12 && roll < megaChance) return 'mega';
  if (burstIndex >= 6 && roll < megaChance + bigChance) return 'big';
  if (burstIndex >= 3 && roll < megaChance + bigChance + mediumChance) return 'medium';
  return 'small';
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}
