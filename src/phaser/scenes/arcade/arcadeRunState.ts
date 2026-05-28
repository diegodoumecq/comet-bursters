import { ShipState } from '../../player/shipState';
import { PlayerState } from '../../player/state';
import { GameWorld } from '../../world/state';
import { RESPAWN_DELAY_MS } from './runFlow';

export class ArcadeRunState {
  readonly world = new GameWorld();
  readonly ship = new ShipState();
  readonly player = new PlayerState();
  burstCount: number;
  score = 0;
  lives = 3;
  nextProjectileId = 1;

  constructor(startingIntensity: number) {
    this.burstCount = Math.max(0, Math.floor(startingIntensity) - 1);
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
}
