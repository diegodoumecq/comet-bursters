import { SIZE } from './constants';
import { joymap } from './joymap';
import { sceneManager } from './sceneManager';
import { GameOverScene } from './scenes/GameOverScene/GameOverScene';
import { GameScene } from './scenes/GameScene/GameScene';
import { LoadingScene } from './scenes/LoadingScene/LoadingScene';
import { SandboxScene } from './scenes/SandboxScene/SandboxScene';
import { TitleScene } from './scenes/TitleScene/TitleScene';
import { gameState } from './state';

const app = document.getElementById('app') as HTMLElement;
app.innerHTML = `
  <article style="text-align: center;">
    <button
      id="resize-btn"
      style="display: none; position: absolute; top: 20px; right: 20px; z-index: 100; padding: 10px 20px; font-size: 16px; cursor: pointer;"
    >
      Resize Game
    </button>
    <canvas
      id="canvas"
      style="position: absolute; left: 0; right: 0; bottom: 0; top: 0;"
      width="${SIZE.width}"
      height="${SIZE.height}"
    />
  </article>
`;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

canvas.width = SIZE.width;
canvas.height = SIZE.height;

const resizeBtn = document.getElementById('resize-btn') as HTMLButtonElement;

resizeBtn.addEventListener('click', () => {
  if (gameState.gameSize) {
    gameState.gameSize.width = window.innerWidth;
    gameState.gameSize.height = window.innerHeight;
    gameState.needsResize = false;
    resizeBtn.style.display = 'none';

    canvas.width = gameState.gameSize.width;
    canvas.height = gameState.gameSize.height;

    gameScene.resize();
  }
});

const loadingScene = new LoadingScene();
const titleScene = new TitleScene();
const gameScene = new GameScene();
const sandboxScene = new SandboxScene();
const gameOverScene = new GameOverScene();

gameScene.setCanvas(canvas);
sandboxScene.setCanvas(canvas);

sceneManager.register('loading', loadingScene);
sceneManager.register('title', titleScene);
sceneManager.register('game', gameScene);
sceneManager.register('sandbox', sandboxScene);
sceneManager.register('gameover', gameOverScene);

joymap.setOnPoll(() => {
  const deltaTime = 16;

  if (gameState.needsResize) {
    resizeBtn.style.display = 'block';
  }

  const width = gameState.gameSize?.width ?? SIZE.width;
  const height = gameState.gameSize?.height ?? SIZE.height;

  sceneManager.update(deltaTime);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  sceneManager.draw(ctx);
});

joymap.start();
