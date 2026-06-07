import Phaser from 'phaser';

import type { Vector } from '../core/types';
import { getWeaponIconSprite } from '../weapons/icons';
import type { WeaponKind } from '../weapons/types';

const RADIAL_MENU_INNER_RADIUS = 34;
const RADIAL_MENU_OUTER_RADIUS = 116;
const ICON_RADIUS = (RADIAL_MENU_INNER_RADIUS + RADIAL_MENU_OUTER_RADIUS) * 0.5;
const PRIMARY_SLOT_COLOR = 0x38bdf8;
const SECONDARY_SLOT_COLOR = 0xfb7185;

export class WeaponMenu {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly icons: Phaser.GameObjects.Image[];
  private readonly slotLabels: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    private readonly weapons: readonly WeaponKind[],
  ) {
    this.graphics = scene.add.graphics().setName('weapon-menu').setDepth(90);
    this.icons = weapons.map((weapon) =>
      scene.add.image(0, 0, getWeaponIconTexture(scene, weapon, false)).setDepth(91),
    );
    this.slotLabels = weapons.map(() =>
      scene.add
        .text(0, 0, '', {
          color: '#06111f',
          fontFamily: 'monospace',
          fontSize: '10px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(92),
    );
  }

  getSelected(aim: Vector): WeaponKind {
    const angle = Math.atan2(aim.y, aim.x);
    const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
    const segment = (Math.PI * 2) / this.weapons.length;
    return this.weapons[Math.floor(((normalized + segment * 0.5) % (Math.PI * 2)) / segment)];
  }

  draw(
    center: Vector,
    aim: Vector,
    primary: WeaponKind,
    secondary: WeaponKind,
    visible: boolean,
  ): void {
    this.graphics.clear();
    for (const icon of this.icons) icon.setVisible(visible);
    for (const label of this.slotLabels) label.setVisible(false);
    if (!visible) return;
    const selected = this.getSelected(aim);
    const segment = (Math.PI * 2) / this.weapons.length;
    for (let i = 0; i < this.weapons.length; i += 1) {
      const weapon = this.weapons[i];
      const centerAngle = i * segment;
      const startAngle = centerAngle - segment * 0.5;
      const endAngle = centerAngle + segment * 0.5;
      const isSelected = weapon === selected;
      this.drawWedge(center, startAngle, endAngle, isSelected);
      this.icons[i]
        .setTexture(getWeaponIconTexture(this.icons[i].scene, weapon, isSelected))
        .setPosition(
          center.x + Math.cos(centerAngle) * ICON_RADIUS,
          center.y + Math.sin(centerAngle) * ICON_RADIUS,
        );
      const markerX = center.x + Math.cos(centerAngle) * 46;
      const markerY = center.y + Math.sin(centerAngle) * 46;
      if (weapon === primary || weapon === secondary) {
        this.drawSlotMarker(
          markerX,
          markerY,
          weapon === primary,
          weapon === secondary,
          this.slotLabels[i],
        );
      }
    }
    this.graphics.fillStyle(0x05070d, 1);
    this.graphics.fillCircle(center.x, center.y, RADIAL_MENU_INNER_RADIUS);
  }

  private drawWedge(center: Vector, startAngle: number, endAngle: number, selected: boolean): void {
    if (selected) {
      const bands = 8;
      const bandSize = (RADIAL_MENU_OUTER_RADIUS - RADIAL_MENU_INNER_RADIUS) / bands;
      for (let band = 0; band < bands; band += 1) {
        const progress = band / Math.max(1, bands - 1);
        this.graphics.fillStyle(
          interpolateColor(0x0e7490, 0x67e8f9, progress),
          0.18 + progress * 0.2,
        );
        this.graphics.slice(
          center.x,
          center.y,
          RADIAL_MENU_INNER_RADIUS + bandSize * (band + 1),
          startAngle,
          endAngle,
          false,
        );
        this.graphics.fillPath();
      }
    } else {
      this.graphics.fillStyle(0x081420, 0.72);
      this.graphics.slice(
        center.x,
        center.y,
        RADIAL_MENU_OUTER_RADIUS,
        startAngle,
        endAngle,
        false,
      );
      this.graphics.fillPath();
    }
    this.graphics.fillStyle(0x05070d, 1);
    this.graphics.fillCircle(center.x, center.y, RADIAL_MENU_INNER_RADIUS);
    this.graphics.lineStyle(
      selected ? 2 : 1,
      selected ? 0xd2ffff : 0x94a3b8,
      selected ? 0.88 : 0.42,
    );
    this.graphics.slice(center.x, center.y, RADIAL_MENU_OUTER_RADIUS, startAngle, endAngle, false);
    this.graphics.strokePath();
  }

  private drawSlotMarker(
    x: number,
    y: number,
    primary: boolean,
    secondary: boolean,
    label: Phaser.GameObjects.Text,
  ): void {
    if (primary && secondary) {
      this.graphics.fillStyle(PRIMARY_SLOT_COLOR, 1);
      this.graphics.slice(x, y, 12, Math.PI * 0.5, Math.PI * 1.5, false);
      this.graphics.fillPath();
      this.graphics.fillStyle(SECONDARY_SLOT_COLOR, 1);
      this.graphics.slice(x, y, 12, Math.PI * 1.5, Math.PI * 0.5, false);
      this.graphics.fillPath();
      label.setText('L/R');
    } else {
      this.graphics.fillStyle(primary ? PRIMARY_SLOT_COLOR : SECONDARY_SLOT_COLOR, 1);
      this.graphics.fillCircle(x, y, 11);
      label.setText(primary ? 'L' : 'R');
    }
    this.graphics.lineStyle(1.5, 0xffffff, 0.86);
    this.graphics.strokeCircle(x, y, primary && secondary ? 12 : 11);
    label.setPosition(x, y).setVisible(true);
  }
}

function getWeaponIconTexture(scene: Phaser.Scene, weapon: WeaponKind, selected: boolean): string {
  const key = `phaser-weapon-icon-${weapon}-${selected ? 'selected' : 'normal'}`;
  if (!scene.textures.exists(key)) {
    scene.textures.addCanvas(key, getWeaponIconSprite(weapon, selected));
  }
  return key;
}

function interpolateColor(from: number, to: number, progress: number): number {
  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;
  const r = Math.round(Phaser.Math.Linear(fromR, toR, progress));
  const g = Math.round(Phaser.Math.Linear(fromG, toG, progress));
  const b = Math.round(Phaser.Math.Linear(fromB, toB, progress));
  return (r << 16) | (g << 8) | b;
}
