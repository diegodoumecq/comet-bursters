import { initAssets } from '@/assets';
import { SIZE } from '@/constants';
import { sceneManager } from '@/sceneManager';
import { initBackground } from '@/scenes/GameScene/background';
import { setColorGradePreset } from '@/scenes/GameScene/shader';
import { gameState } from '@/state';
import type { Scene } from '../scene';

export class LoadingScene implements Scene {
  enter(): void {
    gameState.gameSize = {
      width: SIZE.width,
      height: SIZE.height,
    };

    initAssets();
    initBackground();
    setColorGradePreset('cinematic');
    gameState.assetsLoaded = true;
  }

  update(_deltaTime: number): void {
    if (gameState.assetsLoaded && gameState.gameSize) {
      sceneManager.transitionTo('title');
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#4a4a6a';
    ctx.font = '32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Loading...', SIZE.centerX, SIZE.centerY);
  }

  exit(): void {}
}
