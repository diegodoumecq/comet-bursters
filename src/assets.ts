import {
  ASTEROID_COLORS,
  PLAYER_COLORS,
  THRUSTER_COLORS,
  THRUSTER_SPRITE_SIZE,
  type AlphaMask,
  type PlayerColor,
} from './constants';
import { gameState } from './state';

export function computeAlphaMask(image: HTMLImageElement): AlphaMask {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const cctx = canvas.getContext('2d')!;
  cctx.drawImage(image, 0, 0);
  const imageData = cctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0; i < mask.length; i++) {
    const alpha = imageData.data[i * 4 + 3];
    mask[i] = alpha > 50 ? 1 : 0;
  }

  return { width: canvas.width, height: canvas.height, data: mask };
}

export function createTintedSprite(image: HTMLImageElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const cctx = canvas.getContext('2d')!;
  cctx.drawImage(image, 0, 0);
  cctx.globalCompositeOperation = 'multiply';
  cctx.fillStyle = color;
  cctx.fillRect(0, 0, canvas.width, canvas.height);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(image, 0, 0);
  cctx.globalCompositeOperation = 'source-over';
  return canvas;
}

export function createParticleSprite(
  image: HTMLImageElement,
  color: string,
  size: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const cctx = canvas.getContext('2d')!;
  cctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, size, size);
  cctx.globalCompositeOperation = 'multiply';
  cctx.fillStyle = color;
  cctx.fillRect(0, 0, size, size);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, size, size);
  cctx.globalCompositeOperation = 'source-over';
  return canvas;
}

export function scaleMask(mask: AlphaMask, scale: number): AlphaMask {
  const newWidth = Math.floor(mask.width * scale);
  const newHeight = Math.floor(mask.height * scale);
  const newData = new Uint8Array(newWidth * newHeight);

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      if (srcX < mask.width && srcY < mask.height) {
        newData[y * newWidth + x] = mask.data[srcY * mask.width + srcX];
      }
    }
  }

  return { width: newWidth, height: newHeight, data: newData };
}

export function initAssets() {
  gameState.colorSprites = {};
  gameState.asteroidSprites = {
    mega: {},
    big: {},
    medium: {},
    small: {},
  };
  gameState.particleSprites = [];
  gameState.thrusterSprites = [];

  const img = gameState.gamepadImage!;

  for (const color of PLAYER_COLORS) {
    gameState.colorSprites[color] = createTintedSprite(img, color);
  }

  for (const size of ['mega', 'big', 'medium', 'small'] as const) {
    for (const color of ASTEROID_COLORS[size]) {
      gameState.asteroidSprites[size][color] = createTintedSprite(img, color);
    }
  }

  const allColors = Object.values(ASTEROID_COLORS).flat();
  for (let i = 0; i < 10; i++) {
    const size = 8 + Math.random() * 12;
    gameState.particleSprites.push(
      createParticleSprite(img, allColors[i % allColors.length], size),
    );
  }

  for (const color of THRUSTER_COLORS) {
    gameState.thrusterSprites.push(createParticleSprite(img, color, THRUSTER_SPRITE_SIZE));
  }
}

export function loadAssets(src: string, onLoad: () => void) {
  gameState.gamepadImage = new Image();
  gameState.gamepadImage.onload = onLoad;
  gameState.gamepadImage.src = src;
}

export function getColorSprite(color: PlayerColor): HTMLCanvasElement | undefined {
  return gameState.colorSprites[color];
}

export function getAsteroidSprite(
  size: 'mega' | 'big' | 'medium' | 'small',
  colorIndex: number,
): HTMLCanvasElement | undefined {
  const colors = ASTEROID_COLORS[size];
  const color = colors[colorIndex % colors.length];
  return gameState.asteroidSprites[size][color];
}

export function getRandomAsteroidColor(size: 'mega' | 'big' | 'medium' | 'small'): string {
  const colors = ASTEROID_COLORS[size];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function getParticleSprite(index: number): HTMLCanvasElement {
  return gameState.particleSprites[index % gameState.particleSprites.length];
}

export function getRandomThrusterSprite(): HTMLCanvasElement {
  return gameState.thrusterSprites[Math.floor(Math.random() * gameState.thrusterSprites.length)];
}
