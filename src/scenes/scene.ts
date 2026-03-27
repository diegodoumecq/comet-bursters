export interface Scene {
  enter(): void;
  update(deltaTime: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  exit(): void;
}
