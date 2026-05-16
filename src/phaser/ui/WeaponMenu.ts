import Phaser from 'phaser';

import type { Vector, WeaponKind } from '../model';

export const WEAPONS: WeaponKind[] = ['small', 'pusher', 'shotgun', 'blackHole', 'tractor'];

export class WeaponMenu {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(90);
    this.labels = WEAPONS.map((weapon) =>
      scene.add.text(0, 0, weapon, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '12px',
      }).setOrigin(0.5).setDepth(91),
    );
  }

  getSelected(aim: Vector): WeaponKind {
    const angle = Math.atan2(aim.y, aim.x);
    const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
    const segment = (Math.PI * 2) / WEAPONS.length;
    return WEAPONS[Math.floor(((normalized + segment * 0.5) % (Math.PI * 2)) / segment)];
  }

  draw(center: Vector, aim: Vector, primary: WeaponKind, secondary: WeaponKind, visible: boolean): void {
    this.graphics.clear();
    for (const label of this.labels) label.setVisible(visible);
    if (!visible) return;
    const selected = this.getSelected(aim);
    const segment = (Math.PI * 2) / WEAPONS.length;
    for (let i = 0; i < WEAPONS.length; i += 1) {
      const weapon = WEAPONS[i];
      const centerAngle = i * segment;
      this.graphics.fillStyle(weapon === selected ? 0x67e8f9 : 0x081420, weapon === selected ? 0.35 : 0.72);
      this.graphics.slice(center.x, center.y, 116, centerAngle - segment * 0.5, centerAngle + segment * 0.5, false);
      this.graphics.fillPath();
      this.graphics.lineStyle(weapon === selected ? 2 : 1, weapon === selected ? 0xd2ffff : 0x94a3b8, weapon === selected ? 0.88 : 0.42);
      this.graphics.strokePath();
      const labelX = center.x + Math.cos(centerAngle) * 76;
      const labelY = center.y + Math.sin(centerAngle) * 76;
      this.labels[i].setPosition(labelX, labelY);
      const markerX = center.x + Math.cos(centerAngle) * 46;
      const markerY = center.y + Math.sin(centerAngle) * 46;
      if (weapon === primary || weapon === secondary) {
        this.graphics.fillStyle(weapon === primary ? 0x38bdf8 : 0xfb7185, 1);
        this.graphics.fillCircle(markerX, markerY, 8);
      }
    }
    this.graphics.fillStyle(0x05070d, 1);
    this.graphics.fillCircle(center.x, center.y, 34);
  }
}
