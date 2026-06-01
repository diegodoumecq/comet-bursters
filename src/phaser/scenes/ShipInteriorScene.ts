import Phaser from 'phaser';

import { ActionReader, type ActionState } from '../input/actions';
import { PlayerBody } from '../player/body';
import { PLAYER_MASS } from '../player/config';
import { PlayerState } from '../player/state';
import { createPlayerTexture } from '../player/textures';
import { normalize } from '../world/geometry';
import { BaseGameScene } from './BaseGameScene';
import {
  buildShipInteriorCollision,
  renderShipInteriorLayers,
} from './shipInterior/interiorLevelView';
import { loadShipInteriorLevel } from './shipInterior/levelAdapter';

const PLAYER_SPEED = 4.5;
const FALLBACK_SPAWN = { x: 210, y: 210 };

export class PhaserShipInteriorScene extends BaseGameScene {
  private actions!: ActionReader;
  private loadStatus: 'loading' | 'ready' | 'error' = 'loading';
  private loadError = '';
  private playerBody: PlayerBody | null = null;
  private readonly player = new PlayerState();
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('ship-interior');
  }

  create(): void {
    this.actions = new ActionReader(this);
    createPlayerTexture(this);
    this.statusText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5, 'Loading ship interior...', {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '18px',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
    void this.loadLevel();
  }

  protected readFrameInput(): ActionState {
    return this.actions.read(this.player.position);
  }

  protected updateState(action: ActionState): void {
    if (this.loadStatus !== 'ready' || !this.playerBody) return;
    this.updatePlayer(action);
  }

  protected renderState(): void {
    if (this.loadStatus === 'error') {
      this.statusText.setText(`Failed to load ship interior\n${this.loadError}`);
    }
  }

  private async loadLevel(): Promise<void> {
    try {
      const level = await loadShipInteriorLevel();
      renderShipInteriorLayers(this, level, false, 0);
      this.playerBody = new PlayerBody(this, level.playerSpawn ?? FALLBACK_SPAWN, this.player);
      this.playerBody.body.setDepth(10);
      this.playerBody.body.setMass(PLAYER_MASS);
      this.playerBody.body.setFrictionAir(0.22);
      this.playerBody.body.setFixedRotation();
      buildShipInteriorCollision(this, level);
      renderShipInteriorLayers(this, level, true, 20);
      this.cameras.main.setBounds(0, 0, level.width, level.height);
      this.cameras.main.startFollow(this.playerBody.body, true, 0.18, 0.18);
      this.matter.world.setBounds(0, 0, level.width, level.height, 32, true, true, true, true);
      this.statusText.setVisible(false);
      this.loadStatus = 'ready';
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error);
      this.loadStatus = 'error';
    }
  }

  private updatePlayer(action: ActionState): void {
    if (!this.playerBody) return;
    const move = normalize(action.move);
    this.player.updateAim(normalize(action.aim));
    this.player.updateThrust(move, Math.hypot(move.x, move.y) > 0);
    this.playerBody.setVelocity({ x: move.x * PLAYER_SPEED, y: move.y * PLAYER_SPEED });
    if (Math.hypot(move.x, move.y) > 0) this.playerBody.setRotation(Math.atan2(move.y, move.x));
  }
}
