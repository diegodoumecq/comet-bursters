import mothershipBackUrl from '@/assets/mothership-back.png';
import mothershipDoorUrl from '@/assets/mothership-door.png';
import mothershipFrontUrl from '@/assets/mothership-front.png';

export const MOTHERSHIP_SPRITE_WIDTH = 980;
export const MOTHERSHIP_SPRITE_HEIGHT = 277;
export const MOTHERSHIP_DRAW_RADIUS =
  Math.max(MOTHERSHIP_SPRITE_WIDTH, MOTHERSHIP_SPRITE_HEIGHT) * 0.5;
export const MOTHERSHIP_DOOR_OPEN_DURATION_MS = 900;

const MOTHERSHIP_DOOR_SLIDE_DISTANCE = MOTHERSHIP_SPRITE_WIDTH * 0.162;

export type MothershipLayer = 'front' | 'door' | 'back';

interface MothershipImages {
  front: HTMLImageElement;
  door: HTMLImageElement;
  back: HTMLImageElement;
}

let mothershipImages: MothershipImages | null = null;

export function drawMothershipLayer(
  ctx: CanvasRenderingContext2D,
  layer: MothershipLayer,
  x: number,
  y: number,
  openProgress: number,
): void {
  const images = getMothershipImages();
  if (!areImagesReady(images)) {
    return;
  }

  const drawX = x - MOTHERSHIP_SPRITE_WIDTH / 2;
  const drawY = y - MOTHERSHIP_SPRITE_HEIGHT / 2;
  const clampedOpenProgress = Math.max(0, Math.min(1, openProgress));
  const doorOffsetX = clampedOpenProgress * MOTHERSHIP_DOOR_SLIDE_DISTANCE;

  if (layer === 'front') {
    ctx.drawImage(images.front, drawX, drawY, MOTHERSHIP_SPRITE_WIDTH, MOTHERSHIP_SPRITE_HEIGHT);
  } else if (layer === 'door') {
    ctx.drawImage(
      images.door,
      drawX + doorOffsetX,
      drawY,
      MOTHERSHIP_SPRITE_WIDTH,
      MOTHERSHIP_SPRITE_HEIGHT,
    );
  } else {
    ctx.drawImage(images.back, drawX, drawY, MOTHERSHIP_SPRITE_WIDTH, MOTHERSHIP_SPRITE_HEIGHT);
  }
}

function getMothershipImages(): MothershipImages {
  if (!mothershipImages) {
    mothershipImages = {
      front: createImage(mothershipFrontUrl),
      door: createImage(mothershipDoorUrl),
      back: createImage(mothershipBackUrl),
    };
  }
  return mothershipImages;
}

function createImage(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

function areImagesReady(images: MothershipImages): boolean {
  return Object.values(images).every((image) => image.complete && image.naturalWidth > 0);
}
