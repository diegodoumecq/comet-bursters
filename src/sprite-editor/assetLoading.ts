import type { SpriteAssetEntry } from './assetCatalog';

export function loadSpriteAssetImage({
  asset,
  canvas,
  onError,
  onLoaded,
  onStart,
}: {
  asset: SpriteAssetEntry;
  canvas: HTMLCanvasElement | null;
  onError: (message: string) => void;
  onLoaded: (ctx: CanvasRenderingContext2D) => void;
  onStart: () => void;
}) {
  if (!canvas) {
    return () => undefined;
  }

  let cancelled = false;
  const image = new Image();
  onStart();
  image.onload = () => {
    if (cancelled || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    onLoaded(ctx);
  };
  image.onerror = () => {
    if (cancelled) {
      return;
    }
    onError(`Failed to load ${asset.fileName}.`);
  };
  image.src = asset.url;

  return () => {
    cancelled = true;
  };
}
