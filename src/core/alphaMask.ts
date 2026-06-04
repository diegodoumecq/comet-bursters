export interface AlphaMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export function computeAlphaMask(
  image: CanvasImageSource & { width: number; height: number },
): AlphaMask {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = imageData.data[i * 4 + 3] > 50 ? 1 : 0;
  }

  return { width: canvas.width, height: canvas.height, data: mask };
}
