import Phaser from 'phaser';

const FPS_SAMPLE_INTERVAL_MS = 500;

export function createFpsOverlay(game: Phaser.Game): void {
  const overlay = document.createElement('div');
  overlay.textContent = '0 FPS';
  overlay.style.position = 'fixed';
  overlay.style.top = '12px';
  overlay.style.right = '12px';
  overlay.style.zIndex = '2147483647';
  overlay.style.pointerEvents = 'none';
  overlay.style.minWidth = '54px';
  overlay.style.padding = '3px 7px';
  overlay.style.borderRadius = '4px';
  overlay.style.background = 'rgba(0, 0, 0, 0.72)';
  overlay.style.color = '#a7f3d0';
  overlay.style.font = '14px monospace';
  overlay.style.textAlign = 'right';
  overlay.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.18)';
  document.body.appendChild(overlay);

  let framesSinceSample = 0;
  let lastSampleTimeMs = performance.now();

  const updateOverlay = (): void => {
    framesSinceSample += 1;
    const now = performance.now();
    const sampleDurationMs = now - lastSampleTimeMs;
    if (sampleDurationMs < FPS_SAMPLE_INTERVAL_MS) return;

    const fps = Math.round((framesSinceSample * 1000) / sampleDurationMs);
    framesSinceSample = 0;
    lastSampleTimeMs = now;
    overlay.textContent = `${fps} FPS`;
    overlay.style.color = fps >= 50 ? '#a7f3d0' : fps >= 30 ? '#fde68a' : '#fecaca';
  };

  const destroyOverlay = (): void => {
    game.events.off(Phaser.Core.Events.POST_STEP, updateOverlay);
    overlay.remove();
  };

  game.events.on(Phaser.Core.Events.POST_STEP, updateOverlay);
  game.events.once(Phaser.Core.Events.DESTROY, destroyOverlay);
}
