import { ShipState } from '../../player/shipState';
import { PlayerState } from '../../player/state';
import { GameWorld } from '../../world/state';
import { getNextWaveState, RESPAWN_DELAY_MS } from './runFlow';

export class ArcadeRunState {
  readonly world = new GameWorld();
  readonly ship = new ShipState();
  readonly player = new PlayerState();
  wave: number;
  score = 0;
  lives = 3;
  waveClearAt = 0;
  nextProjectileId = 1;

  constructor(startingWave: number) {
    this.wave = startingWave;
  }

  get playerAlive(): boolean {
    return this.player.respawnAt === 0 && this.lives > 0;
  }

  awardAsteroidScore(points: number): void {
    this.score += points * this.lives;
  }

  destroyPlayer(now: number): void {
    this.lives -= 1;
    this.player.respawnAt = now + RESPAWN_DELAY_MS;
  }

  shouldRespawn(now: number): boolean {
    return this.lives > 0 && this.player.respawnAt !== 0 && now >= this.player.respawnAt;
  }

  respawn(now: number): void {
    this.player.respawnAt = 0;
    this.ship.resetFuel();
    this.player.invulnerableUntil = now + 2200;
  }

  advanceWave(now: number): boolean {
    const state = getNextWaveState(this.world.asteroids.length, this.wave, this.waveClearAt, now);
    this.wave = state.wave;
    this.waveClearAt = state.waveClearAt;
    return state.shouldSpawn;
  }
}
