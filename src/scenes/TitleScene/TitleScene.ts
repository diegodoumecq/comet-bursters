import { InputManager } from '@/input';
import { joymap } from '@/joymap';
import { sceneManager } from '@/sceneManager';
import { gameState, getGameCenterX, getGameCenterY } from '@/state';
import { createRotatedGradient } from '@/utils/canvas';
import type { Scene } from '../scene';

export class TitleScene implements Scene {
  enter(): void {}

  update(_deltaTime: number): void {
    InputManager.getInputState();

    const gamepadConnected = joymap.getUnusedPadIds().length > 0;
    const keyPressed = InputManager.wasAnyKeyJustPressed();

    if (gameState.assetsLoaded && (gamepadConnected || keyPressed)) {
      sceneManager.transitionTo('game');
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.font = '72px Monoton, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = 'Comet Bursters';
    const firstRIndex = text.indexOf('r');
    const part1 = text.slice(0, firstRIndex);
    const part2 = text.slice(firstRIndex, firstRIndex + 1);
    const part3 = text.slice(firstRIndex + 1);

    const metrics1 = ctx.measureText(part1);
    const metrics2 = ctx.measureText(part2);
    const metrics3 = ctx.measureText(part3);

    const totalWidth = metrics1.width + metrics2.width + metrics3.width;
    const centerX = getGameCenterX();
    const centerY = getGameCenterY();
    let x = centerX - totalWidth / 2;
    const y = centerY - 100;

    const gradient = createRotatedGradient(
      ctx,
      x,
      y - 36,
      totalWidth,
      72,
      Math.PI / 2,
      '#7f00ff',
      '#00ffff',
    );

    ctx.shadowColor = '#7f00ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    ctx.fillText(part1, x + metrics1.width / 2, y);
    x += metrics1.width;

    ctx.save();
    ctx.translate(x + metrics2.width / 2, y);
    ctx.rotate(0.15);
    ctx.fillText(part2, 0, 0);
    ctx.restore();
    x += metrics2.width;

    ctx.fillText(part3, x + metrics3.width / 2, y);
    ctx.shadowBlur = 0;

    ctx.font = '20px Audiowide, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Connect a gamepad or press Space/Enter to start!', centerX, centerY + 50);

    ctx.font = '16px Audiowide, sans-serif';
    ctx.fillText('L Stick: Move', centerX, centerY + 120);
    ctx.fillText('R Stick: Aim', centerX, centerY + 145);
    ctx.fillText('R1: Shoot', centerX, centerY + 170);
    ctx.fillText('R2: Black Hole', centerX, centerY + 195);
    ctx.fillText('L1: Pusher', centerX, centerY + 220);
    ctx.fillText('L2: Shotgun', centerX, centerY + 245);
    ctx.fillText('A: Shield', centerX, centerY + 270);
  }

  exit(): void {}
}
