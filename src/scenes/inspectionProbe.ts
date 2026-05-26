import {
  INSPECTION_PROBE_LIFETIME_MS,
  INSPECTION_PROBE_RADIUS,
  INSPECTION_PROBE_SPEED,
  PLAYER_SIZE,
  type Player,
} from '@/constants';

export type InspectionProbe = Partial<import('./entities').SceneEntity> & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spawnTime: number;
};

type UpdateInspectionProbesOptions = {
  deltaScale?: number;
  wrapProbe?: (probe: InspectionProbe) => void;
  handleProbe?: (probe: InspectionProbe) => boolean;
  onRemove?: (probe: InspectionProbe) => void;
};

export function fireInspectionProbe(
  currentPlayer: Player,
  inspectionProbes: InspectionProbe[],
  now = Date.now(),
  onCreate?: (probe: InspectionProbe) => void,
): boolean {
  if (currentPlayer.inspectionProbes <= 0) {
    return false;
  }

  currentPlayer.inspectionProbes--;
  const angle = currentPlayer.turretAngle - Math.PI * 0.5;
  const probe: InspectionProbe = {
    x: currentPlayer.x + Math.cos(angle) * PLAYER_SIZE,
    y: currentPlayer.y + Math.sin(angle) * PLAYER_SIZE,
    vx: currentPlayer.vx + Math.cos(angle) * INSPECTION_PROBE_SPEED,
    vy: currentPlayer.vy + Math.sin(angle) * INSPECTION_PROBE_SPEED,
    angle,
    spawnTime: now,
  };
  onCreate?.(probe);
  inspectionProbes.push(probe);
  return true;
}

export function updateInspectionProbes(
  inspectionProbes: InspectionProbe[],
  now: number,
  options: UpdateInspectionProbesOptions = {},
): void {
  const deltaScale = options.deltaScale ?? 1;
  for (let i = inspectionProbes.length - 1; i >= 0; i--) {
    const probe = inspectionProbes[i];
    probe.x += probe.vx * deltaScale;
    probe.y += probe.vy * deltaScale;
    options.wrapProbe?.(probe);

    const expired = now - probe.spawnTime >= INSPECTION_PROBE_LIFETIME_MS;
    const handled = !expired && Boolean(options.handleProbe?.(probe));
    if (expired || handled) {
      options.onRemove?.(probe);
      inspectionProbes.splice(i, 1);
    }
  }
}

export function drawInspectionProbe(probe: InspectionProbe, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(probe.x, probe.y);
  ctx.rotate(probe.angle);
  ctx.fillStyle = '#67e8f9';
  ctx.strokeStyle = '#ecfeff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -4);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export { INSPECTION_PROBE_RADIUS };
