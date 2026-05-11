import type { AlphaMask, Collidable } from './constants';

type RotatedMaskedBody = Collidable & {
  rotation: number;
};

export function circleIntersectsRotatedMask(
  circleX: number,
  circleY: number,
  circleRadius: number,
  body: RotatedMaskedBody,
): boolean {
  const broadDx = circleX - body.x;
  const broadDy = circleY - body.y;
  if (Math.hypot(broadDx, broadDy) > circleRadius + body.getRadius()) {
    return false;
  }

  const mask = body.mask;
  const centerX = mask.width * 0.5;
  const centerY = mask.height * 0.5;
  const cos = Math.cos(-body.rotation);
  const sin = Math.sin(-body.rotation);
  const localCircleX = broadDx * cos - broadDy * sin + centerX;
  const localCircleY = broadDx * sin + broadDy * cos + centerY;
  const radiusSq = circleRadius * circleRadius;

  const minX = Math.max(0, Math.floor(localCircleX - circleRadius));
  const maxX = Math.min(mask.width - 1, Math.ceil(localCircleX + circleRadius));
  const minY = Math.max(0, Math.floor(localCircleY - circleRadius));
  const maxY = Math.min(mask.height - 1, Math.ceil(localCircleY + circleRadius));

  for (let y = minY; y <= maxY; y += 1) {
    const dy = y + 0.5 - localCircleY;
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - localCircleX;
      if (dx * dx + dy * dy <= radiusSq && mask.data[y * mask.width + x]) {
        return true;
      }
    }
  }

  return false;
}

export function getAlphaMaskRadius(mask: AlphaMask): number {
  const centerX = mask.width * 0.5;
  const centerY = mask.height * 0.5;
  let radiusSq = 0;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]) {
        const dx = x + 0.5 - centerX;
        const dy = y + 0.5 - centerY;
        radiusSq = Math.max(radiusSq, dx * dx + dy * dy);
      }
    }
  }

  return Math.sqrt(radiusSq);
}
