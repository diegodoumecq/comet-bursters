import type { SelectableWeaponType } from './constants';

export interface WeaponIconSprites {
  normal: HTMLCanvasElement;
  selected: HTMLCanvasElement;
}

const WEAPON_ICON_SIZE = 48;

export function createWeaponIconSprites(weapon: SelectableWeaponType): WeaponIconSprites {
  return {
    normal: renderWeaponIconSprite(weapon, false),
    selected: renderWeaponIconSprite(weapon, true),
  };
}

function renderWeaponIconSprite(
  weapon: SelectableWeaponType,
  selected: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WEAPON_ICON_SIZE;
  canvas.height = WEAPON_ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  const center = WEAPON_ICON_SIZE / 2;
  const stroke = selected ? '#ffffff' : '#d8e7f6';
  const accent = selected ? '#67e8f9' : '#8ba4bc';
  const glow = selected ? 'rgba(103, 232, 249, 0.36)' : 'rgba(148, 163, 184, 0.22)';

  ctx.save();
  ctx.translate(center, center);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = selected ? 7 : 3;
  ctx.shadowColor = glow;

  if (weapon === 'small') {
    drawBlasterIcon(ctx, stroke, accent);
  } else if (weapon === 'pusher') {
    drawPusherIcon(ctx, stroke, accent);
  } else if (weapon === 'shotgun') {
    drawShotgunIcon(ctx, stroke, accent);
  } else if (weapon === 'blackHole') {
    drawBlackHoleIcon(ctx, stroke, accent);
  } else if (weapon === 'tractor') {
    drawTractorIcon(ctx, stroke, accent);
  } else {
    drawProbeIcon(ctx, stroke, accent);
  }

  ctx.restore();
  return canvas;
}

function drawBlasterIcon(ctx: CanvasRenderingContext2D, stroke: string, accent: string): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, 2);
  ctx.lineTo(8, 2);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(15, 2, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -7);
  ctx.lineTo(3, -7);
  ctx.stroke();
}

function drawPusherIcon(ctx: CanvasRenderingContext2D, stroke: string, accent: string): void {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const offset = i * 8 - 10;
    ctx.beginPath();
    ctx.moveTo(offset - 8, -11);
    ctx.lineTo(offset + 4, 0);
    ctx.lineTo(offset - 8, 11);
    ctx.stroke();
  }

  ctx.fillStyle = stroke;
  ctx.beginPath();
  ctx.arc(16, 0, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawShotgunIcon(ctx: CanvasRenderingContext2D, stroke: string, accent: string): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    ctx.save();
    ctx.rotate(i * 0.18);
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(-16, 0, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBlackHoleIcon(ctx: CanvasRenderingContext2D, stroke: string, accent: string): void {
  const gradient = ctx.createRadialGradient(-5, -6, 2, 0, 0, 16);
  gradient.addColorStop(0, '#334155');
  gradient.addColorStop(0.42, '#020617');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 7, -0.35, Math.PI * 0.08, Math.PI * 1.35);
  ctx.stroke();
}

function drawTractorIcon(ctx: CanvasRenderingContext2D, stroke: string, accent: string): void {
  const gradient = ctx.createLinearGradient(-18, 0, 18, 0);
  gradient.addColorStop(0, 'rgba(103, 232, 249, 0.04)');
  gradient.addColorStop(1, 'rgba(103, 232, 249, 0.55)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-17, -13);
  ctx.lineTo(17, 0);
  ctx.lineTo(-17, 13);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = stroke;
  ctx.beginPath();
  ctx.arc(17, 0, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawProbeIcon(ctx: CanvasRenderingContext2D, stroke: string, accent: string): void {
  ctx.fillStyle = accent;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.moveTo(-12, -11);
  ctx.lineTo(-18, -16);
  ctx.moveTo(-12, 11);
  ctx.lineTo(-18, 16);
  ctx.stroke();
}
