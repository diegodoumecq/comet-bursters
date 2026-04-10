import {
  ASTEROID_CONFIGS,
  ASTEROID_COLORS,
  PLAYER_COLORS,
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

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mixHexColor(hex: string, targetHex: string, t: number): string {
  const normalize = (value: string): number[] => {
    const clean = value.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const int = Number.parseInt(full, 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  };

  const a = normalize(hex);
  const b = normalize(targetHex);
  const mixed = a.map((channel, index) => Math.round(channel + (b[index] - channel) * t));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function traceRockShape(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  radius: number,
  pointCount: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const jag = 0.72 + rand() * 0.38;
    const r = radius * jag;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

function createAsteroidSprite(
  size: 'mega' | 'big' | 'medium' | 'small',
  color: string,
): HTMLCanvasElement {
  const radius = ASTEROID_CONFIGS[size].radius;
  const diameter = radius * 2;
  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const cctx = canvas.getContext('2d')!;
  const rand = createSeededRandom(hashString(`${size}:${color}`));
  const pointCount =
    size === 'mega' ? 14 : size === 'big' ? 12 : size === 'medium' ? 10 : 8;

  cctx.save();
  cctx.translate(radius, radius);
  cctx.rotate(rand() * Math.PI * 2);

  traceRockShape(cctx, rand, radius * 0.94, pointCount);
  const shellGradient = cctx.createRadialGradient(
    -radius * 0.28,
    -radius * 0.34,
    radius * 0.16,
    0,
    0,
    radius,
  );
  shellGradient.addColorStop(0, mixHexColor(color, '#ffffff', 0.28));
  shellGradient.addColorStop(0.45, color);
  shellGradient.addColorStop(1, mixHexColor(color, '#101622', 0.45));
  cctx.fillStyle = shellGradient;
  cctx.fill();

  cctx.strokeStyle = mixHexColor(color, '#101622', 0.62);
  cctx.lineWidth = Math.max(2, radius * 0.06);
  cctx.stroke();

  cctx.save();
  traceRockShape(cctx, rand, radius * 0.92, pointCount);
  cctx.clip();

  for (let i = 0; i < 4; i++) {
    const ridgeY = (-0.45 + i * 0.28) * radius + (rand() - 0.5) * radius * 0.12;
    cctx.strokeStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(10,14,26,0.12)';
    cctx.lineWidth = Math.max(2, radius * 0.05);
    cctx.beginPath();
    cctx.moveTo(-radius * 0.82, ridgeY);
    cctx.quadraticCurveTo(0, ridgeY + (rand() - 0.5) * radius * 0.26, radius * 0.82, ridgeY);
    cctx.stroke();
  }

  for (let i = 0; i < 3; i++) {
    const craterX = (rand() - 0.5) * radius * 0.9;
    const craterY = (rand() - 0.5) * radius * 0.9;
    const craterR = radius * (0.12 + rand() * 0.08);

    cctx.fillStyle = 'rgba(12, 16, 28, 0.18)';
    cctx.beginPath();
    cctx.arc(craterX + radius * 0.03, craterY + radius * 0.03, craterR, 0, Math.PI * 2);
    cctx.fill();

    cctx.fillStyle = 'rgba(255,255,255,0.08)';
    cctx.beginPath();
    cctx.arc(craterX - radius * 0.015, craterY - radius * 0.015, craterR * 0.78, 0, Math.PI * 2);
    cctx.fill();
  }

  cctx.fillStyle = 'rgba(255,255,255,0.08)';
  cctx.beginPath();
  cctx.moveTo(-radius * 0.08, -radius * 0.58);
  cctx.lineTo(radius * 0.44, -radius * 0.26);
  cctx.lineTo(radius * 0.06, -radius * 0.14);
  cctx.lineTo(-radius * 0.24, -radius * 0.34);
  cctx.closePath();
  cctx.fill();

  cctx.restore();
  cctx.restore();

  return canvas;
}

function createCircularMask(diameter: number): AlphaMask {
  const data = new Uint8Array(diameter * diameter);
  const radius = diameter / 2;
  for (let y = 0; y < diameter; y++) {
    for (let x = 0; x < diameter; x++) {
      const dx = x + 0.5 - radius;
      const dy = y + 0.5 - radius;
      if (dx * dx + dy * dy <= radius * radius) {
        data[y * diameter + x] = 1;
      }
    }
  }
  return { width: diameter, height: diameter, data };
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

  const img = gameState.gamepadImage!;

  for (const color of PLAYER_COLORS) {
    gameState.colorSprites[color] = createTintedSprite(img, color);
  }

  for (const size of ['mega', 'big', 'medium', 'small'] as const) {
    for (const color of ASTEROID_COLORS[size]) {
      gameState.asteroidSprites[size][color] = createAsteroidSprite(size, color);
    }
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

export function getAsteroidMask(size: 'mega' | 'big' | 'medium' | 'small'): AlphaMask {
  const diameter = ASTEROID_CONFIGS[size].radius * 2;
  return createCircularMask(diameter);
}

