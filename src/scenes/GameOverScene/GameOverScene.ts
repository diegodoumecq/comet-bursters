import { InputManager } from '@/input';
import { sceneManager } from '@/sceneManager';
import {
  gameState,
  getGameCenterX,
  getGameCenterY,
  getGameHeight,
  getGameWidth,
  player,
} from '@/state';
import type { Scene } from '../scene';

const RESTART_COOLDOWN = 1000;

export class GameOverScene implements Scene {
  enter(): void {}

  update(_deltaTime: number): void {
    const now = Date.now();
    const currentPlayer = player;

    if (currentPlayer) {
      if (now - gameState.gameOverTime < RESTART_COOLDOWN) {
        return;
      }

      const anyInputJustPressed = InputManager.isAnyInputJustPressed(currentPlayer.module);

      if (anyInputJustPressed) {
        sceneManager.transitionTo(gameState.restartScene);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const width = getGameWidth();
    const height = getGameHeight();
    const centerX = getGameCenterX();
    const centerY = getGameCenterY();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ff4444';
    ctx.font = '64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', centerX, centerY - 80);

    const currentPlayer = player;
    if (currentPlayer) {
      ctx.font = '24px monospace';
      ctx.fillStyle = currentPlayer.color;
      ctx.fillText(`Score: ${currentPlayer.score} points`, centerX, centerY);
    }

    ctx.fillStyle = '#888';
    ctx.font = '18px monospace';
    ctx.fillText('Press any button or key to restart', centerX, centerY + 150);
  }

  exit(): void {}
}
