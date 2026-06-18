import Phaser from 'phaser';

import { getGameAudio } from '../../audio/AudioManager';
import type { SceneAudioDirector } from '../../audio/SceneAudioDirector';

const MENU_ITEMS = [
  { key: 'demo', label: 'Demo Scene' },
  { key: 'math-galaxy', label: 'Math Galaxy' },
  { key: 'spiral-galaxy', label: 'Spiral Galaxy' },
  { key: 'arcade', label: 'Arcade Scene' },
  { key: 'sandbox', label: 'Sandbox Scene' },
  { key: 'ship-interior', label: 'Ship Interior' },
] as const satisfies readonly { key: string; label: string }[];

type MenuItem = (typeof MENU_ITEMS)[number];

export class SceneMenuScene extends Phaser.Scene {
  private audioDirector!: SceneAudioDirector;
  private buttons: Phaser.GameObjects.Text[] = [];
  private loadingScene = false;
  private statusLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('scene-menu');
  }

  create(): void {
    this.buttons = [];
    this.loadingScene = false;
    this.audioDirector = getGameAudio(this).createSceneDirector(this, 'scene-menu');
    this.audioDirector.enter();
    this.events.once('shutdown', () => this.audioDirector.exit());
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;
    this.add
      .text(centerX, centerY - 140, 'Comet Bursters Phaser', {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '34px',
      })
      .setOrigin(0.5);

    MENU_ITEMS.forEach((item, index) => {
      const button = this.add
        .text(centerX, centerY - 20 + index * 72, item.label, {
          backgroundColor: '#111827',
          color: '#bae6fd',
          fontFamily: 'monospace',
          fontSize: '24px',
          padding: { x: 20, y: 14 },
        })
        .setOrigin(0.5);
      button.setInteractive({ useHandCursor: true });
      button.on('pointerover', () =>
        button.setStyle({ backgroundColor: '#1f2937', color: '#ffffff' }),
      );
      button.on('pointerout', () =>
        button.setStyle({ backgroundColor: '#111827', color: '#bae6fd' }),
      );
      button.on('pointerdown', () => {
        void this.startScene(item);
      });
      this.buttons.push(button);
    });

    this.statusLabel = this.add
      .text(centerX, centerY + 286, '', {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '15px',
      })
      .setOrigin(0.5);
  }

  private async startScene(item: MenuItem): Promise<void> {
    if (this.loadingScene) return;

    this.loadingScene = true;
    this.buttons.forEach((button) => button.disableInteractive());
    this.statusLabel.setText(`Preparing ${item.label}`);
    this.audioDirector.emit({ type: 'uiSelect' });
    this.scene.start(item.key);
  }
}
