export const ASTEROID_COLLISION_CATEGORY = 0x0002;
export const ALL_COLLISION_CATEGORIES = 0xffffffff;

export function getAsteroidCollisionMask(enabled: boolean): number {
  return enabled
    ? ALL_COLLISION_CATEGORIES
    : ALL_COLLISION_CATEGORIES & ~ASTEROID_COLLISION_CATEGORY;
}
