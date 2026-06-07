import Phaser from 'phaser';

let activeCanvasOverscan = 0;

type ParentStyleSnapshot = {
  height: string;
  left: string;
  overflow: string;
  position: string;
  top: string;
  width: string;
};

export function getActiveCanvasOverscan(): number {
  return activeCanvasOverscan;
}

// Moving-camera scenes need a small real render margin outside the visible viewport.
// Post-process effects such as black-hole lensing can then sample offscreen world pixels
// instead of stretching the last visible edge texel from the source canvas.
export function enableCanvasOverscan(game: Phaser.Game, overscan: number): () => void {
  const parent = game.canvas.parentElement;
  if (!parent || overscan <= 0) return () => undefined;

  const previousScaleMode = game.scale.scaleMode;
  const previousStyle: ParentStyleSnapshot = {
    height: parent.style.height,
    left: parent.style.left,
    overflow: parent.style.overflow,
    position: parent.style.position,
    top: parent.style.top,
    width: parent.style.width,
  };
  const previousOverscan = activeCanvasOverscan;
  activeCanvasOverscan = overscan;

  const resize = () => {
    const width = window.innerWidth + overscan * 2;
    const height = window.innerHeight + overscan * 2;
    parent.style.position = 'fixed';
    parent.style.left = `${-overscan}px`;
    parent.style.top = `${-overscan}px`;
    parent.style.width = `${width}px`;
    parent.style.height = `${height}px`;
    parent.style.overflow = 'visible';
    game.scale.scaleMode = Phaser.Scale.NONE;
    game.scale.resize(width, height);
  };

  resize();
  window.addEventListener('resize', resize);

  return () => {
    window.removeEventListener('resize', resize);
    activeCanvasOverscan = previousOverscan;
    parent.style.position = previousStyle.position;
    parent.style.left = previousStyle.left;
    parent.style.top = previousStyle.top;
    parent.style.width = previousStyle.width;
    parent.style.height = previousStyle.height;
    parent.style.overflow = previousStyle.overflow;
    game.scale.scaleMode = previousScaleMode;
    game.scale.resize(
      window.innerWidth + previousOverscan * 2,
      window.innerHeight + previousOverscan * 2,
    );
  };
}
