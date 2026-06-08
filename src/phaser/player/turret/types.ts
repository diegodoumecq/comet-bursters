export type TurretSpriteMetrics = {
  baseRadius: number;
  length: number;
  mountX: number;
  rearX: number;
};

export type TurretSpriteDrawer = (
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
) => void;
