import {
  ARCADE_RIFT_ASTEROIDS_PER_BURST,
  ARCADE_RIFT_BASE_ASTEROIDS,
  ARCADE_RIFT_EMPTY_ARENA_DELAY_MS,
  ARCADE_RIFT_INITIAL_INTERVAL_MS,
  ARCADE_RIFT_INTERVAL_DECAY_PER_BURST_MS,
  ARCADE_RIFT_MAX_ASTEROIDS,
  ARCADE_RIFT_MIN_INTERVAL_MS,
} from './config';

export class ArcadeRiftDirector {
  burstCount = 0;
  private nextBurstAt = 0;
  private emptySince = 0;

  constructor(initialIntensity = 1) {
    this.burstCount = Math.max(0, Math.floor(initialIntensity) - 1);
  }

  shouldOpenBurst(input: {
    activeAsteroids: number;
    now: number;
    openRifts?: number;
    stagedAsteroids: number;
  }): boolean {
    if ((input.openRifts ?? 0) > 0) return false;
    const hasAsteroids = input.activeAsteroids + input.stagedAsteroids > 0;
    if (this.nextBurstAt === 0) return true;
    if (input.now >= this.nextBurstAt) return true;
    if (hasAsteroids) {
      this.emptySince = 0;
      return false;
    }
    if (this.emptySince === 0) {
      this.emptySince = input.now;
      return false;
    }
    return input.now - this.emptySince >= ARCADE_RIFT_EMPTY_ARENA_DELAY_MS;
  }

  recordBurst(now: number): number {
    this.burstCount += 1;
    this.emptySince = 0;
    this.nextBurstAt = now + this.getIntervalMs();
    return this.getAsteroidCount();
  }

  private getIntervalMs(): number {
    return Math.max(
      ARCADE_RIFT_MIN_INTERVAL_MS,
      ARCADE_RIFT_INITIAL_INTERVAL_MS - this.burstCount * ARCADE_RIFT_INTERVAL_DECAY_PER_BURST_MS,
    );
  }

  private getAsteroidCount(): number {
    return Math.min(
      ARCADE_RIFT_MAX_ASTEROIDS,
      Math.floor(ARCADE_RIFT_BASE_ASTEROIDS + this.burstCount * ARCADE_RIFT_ASTEROIDS_PER_BURST),
    );
  }
}
