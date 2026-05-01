import type React from 'react';

export function getPixelCoordinates(
  canvas: HTMLCanvasElement,
  event: React.PointerEvent<HTMLElement>,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return null;
  }

  return { x, y };
}
