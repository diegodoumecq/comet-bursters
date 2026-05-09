import { SIZE } from './constants';
import { joymap } from './joymap';
import { sceneManager } from './sceneManager';
import { ATMTermsScene } from './scenes/ATMTermsScene/ATMTermsScene';
import { DemoScene } from './scenes/DemoScene/DemoScene';
import { GameOverScene } from './scenes/GameOverScene/GameOverScene';
import { GameScene } from './scenes/GameScene/GameScene';
import { LoadingScene } from './scenes/LoadingScene/LoadingScene';
import { SandboxScene } from './scenes/SandboxScene/SandboxScene';
import { ShipInteriorScene } from './scenes/ShipInteriorScene/ShipInteriorScene';
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
const startingWaveParam = Number.parseInt(new URLSearchParams(window.location.search).get('startingWave') ?? '', 10);
if (Number.isFinite(startingWaveParam)) {
  gameState.startingWave = Math.max(1, Math.min(50, startingWaveParam));
}

canvas.width = SIZE.width;
canvas.height = SIZE.height;

const resizeBtn = document.getElementById('resize-btn') as HTMLButtonElement;
const fpsCounter = document.createElement('div');
fpsCounter.textContent = '0 FPS';
fpsCounter.style.position = 'fixed';
fpsCounter.style.top = '12px';
fpsCounter.style.right = '12px';
fpsCounter.style.zIndex = '2147483647';
fpsCounter.style.pointerEvents = 'none';
fpsCounter.style.minWidth = '54px';
fpsCounter.style.padding = '3px 7px';
fpsCounter.style.borderRadius = '4px';
fpsCounter.style.background = 'rgba(0, 0, 0, 0.72)';
fpsCounter.style.color = '#a7f3d0';
fpsCounter.style.font = '14px monospace';
fpsCounter.style.textAlign = 'right';
fpsCounter.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.18)';
document.body.appendChild(fpsCounter);

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
const shipInteriorScene = new ShipInteriorScene();
const demoScene = new DemoScene();
const gameOverScene = new GameOverScene();
const atmTermsScene = new ATMTermsScene();

gameScene.setCanvas(canvas);
sandboxScene.setCanvas(canvas);
demoScene.setCanvas(canvas);

sceneManager.register('loading', loadingScene);
sceneManager.register('title', titleScene);
sceneManager.register('game', gameScene);
sceneManager.register('sandbox', sandboxScene);
sceneManager.register('shipinterior', shipInteriorScene);
sceneManager.register('demo', demoScene);
sceneManager.register('gameover', gameOverScene);
sceneManager.register('atmterms', atmTermsScene);

let lastFrameTime = performance.now();
let fpsSampleStartedAt = lastFrameTime;
let fpsFrameCount = 0;
let displayedFps = 0;

function updateFps(now: number): number {
  const deltaTime = Math.max(1, now - lastFrameTime);
  lastFrameTime = now;
  fpsFrameCount++;

  const sampleDuration = now - fpsSampleStartedAt;
  if (sampleDuration >= 500) {
    displayedFps = Math.round((fpsFrameCount * 1000) / sampleDuration);
    fpsFrameCount = 0;
    fpsSampleStartedAt = now;
  }

  return deltaTime;
}

function updateFpsCounter(fps: number): void {
  fpsCounter.textContent = `${fps} FPS`;
  fpsCounter.style.color = fps >= 50 ? '#a7f3d0' : fps >= 30 ? '#fde68a' : '#fecaca';
}

joymap.setOnPoll(() => {
  const now = performance.now();
  const deltaTime = updateFps(now);

  if (gameState.needsResize) {
    resizeBtn.style.display = 'block';
  }

  const width = gameState.gameSize?.width ?? SIZE.width;
  const height = gameState.gameSize?.height ?? SIZE.height;

  sceneManager.update(deltaTime);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  sceneManager.draw(ctx);
  updateFpsCounter(displayedFps);
});

joymap.start();
