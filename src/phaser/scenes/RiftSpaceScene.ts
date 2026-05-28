import Phaser from 'phaser';

import { RiftWorldRuntime } from '../rifts/RiftWorldRuntime';
import type { RiftPortal, RiftSourceSpace } from '../rifts/types';

export class PhaserRiftSpaceScene extends Phaser.Scene {
  private readonly runtime = new RiftWorldRuntime(this);

  constructor() {
    super('rift-space');
  }

  create(): void {
    this.runtime.resize({ width: this.scale.width, height: this.scale.height });
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  update(time: number): void {
    this.runtime.update(time);
  }

  getRenderCanvas(): HTMLCanvasElement {
    return this.runtime.getRenderCanvas();
  }

  setPortals(portals: RiftPortal[]): void {
    this.runtime.setPortals(portals);
  }

  setSourceSpaces(sourceSpaces: RiftSourceSpace[]): void {
    this.runtime.setSourceSpaces(sourceSpaces);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.runtime.resize({ width: gameSize.width, height: gameSize.height });
  }

  private handleShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.runtime.destroy();
  }
}
