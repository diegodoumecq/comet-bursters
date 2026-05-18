import type Phaser from 'phaser';

export type MatterImage = Omit<Phaser.Physics.Matter.Image, 'body'> & {
  body: MatterJS.BodyType;
};

export type MatterArc = Phaser.GameObjects.Arc &
  Phaser.Physics.Matter.Components.Velocity & {
    body: MatterJS.BodyType;
  };

export type WorldSize = {
  width: number;
  height: number;
};

export type Vector = {
  x: number;
  y: number;
};
