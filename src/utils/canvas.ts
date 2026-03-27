export function createRotatedGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  color1: string,
  color2: string,
): CanvasGradient {
  const cx = x + width / 2;
  const cy = y + height / 2;

  const distance = Math.sqrt(width * width + height * height) / 2;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const x1 = cx - cos * distance;
  const y1 = cy - sin * distance;
  const x2 = cx + cos * distance;
  const y2 = cy + sin * distance;

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);

  return gradient;
}

export function createRadialGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  color1: string,
  color2: string,
): CanvasGradient {
  const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, outerRadius);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

export function withTransform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  fn: () => void,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  fn();
  ctx.restore();
}

export function drawCenteredArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  startAngle: number = 0,
  endAngle: number = Math.PI * 2,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, startAngle, endAngle);
}

export function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  const metrics = ctx.measureText(text);
  ctx.fillText(text, x - metrics.width / 2, y);
}