import type { Player, SelectableWeaponType } from '@/constants';
import type { InputState } from '@/input/types';
import { setSavedPrimaryWeapon, setSavedSecondaryWeapon } from '@/state';

export const SELECTABLE_WEAPONS: SelectableWeaponType[] = [
  'small',
  'pusher',
  'shotgun',
  'blackHole',
  'tractor',
  'inspectionProbe',
];

export const SELECTABLE_WEAPON_LABELS: Record<SelectableWeaponType, string> = {
  small: 'Blaster',
  pusher: 'Pusher',
  shotgun: 'Shotgun',
  blackHole: 'Black Hole',
  tractor: 'Tractor',
  inspectionProbe: 'Probe',
};

export const RADIAL_MENU_INNER_RADIUS = 34;
export const RADIAL_MENU_OUTER_RADIUS = 116;

export function getRadialMenuWeapon(currentPlayer: Player): SelectableWeaponType {
  const turretAngle = currentPlayer.turretAngle - Math.PI * 0.5;
  const normalizedAngle = (turretAngle + Math.PI * 2) % (Math.PI * 2);
  const segmentSize = (Math.PI * 2) / SELECTABLE_WEAPONS.length;
  const selectedIndex = Math.floor(((normalizedAngle + segmentSize * 0.5) % (Math.PI * 2)) / segmentSize);
  return SELECTABLE_WEAPONS[selectedIndex];
}

export function applyWeaponSelectionInput(currentPlayer: Player, input: InputState): void {
  if (input.timeDilation.pressed) {
    const selectedWeapon = getRadialMenuWeapon(currentPlayer);
    if (input.fire.justChanged) {
      currentPlayer.primaryWeapon = selectedWeapon;
      setSavedPrimaryWeapon(selectedWeapon);
    }
    if (input.fireSpecial.justChanged) {
      currentPlayer.secondaryWeapon = selectedWeapon;
      setSavedSecondaryWeapon(selectedWeapon);
    }
  }
}

export function drawWeaponSelectionMenuIfOpen(
  ctx: CanvasRenderingContext2D,
  currentPlayer: Player,
  input: InputState,
  center = { x: currentPlayer.x, y: currentPlayer.y },
): void {
  if (input.timeDilation.pressed) {
    drawWeaponSelectionMenu(ctx, currentPlayer, center);
  }
}

export function drawWeaponSelectionMenu(
  ctx: CanvasRenderingContext2D,
  currentPlayer: Player,
  center = { x: currentPlayer.x, y: currentPlayer.y },
): void {
  const selectedWeapon = getRadialMenuWeapon(currentPlayer);
  const segmentSize = (Math.PI * 2) / SELECTABLE_WEAPONS.length;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < SELECTABLE_WEAPONS.length; i++) {
    const weapon = SELECTABLE_WEAPONS[i];
    const centerAngle = i * segmentSize;
    const startAngle = centerAngle - segmentSize * 0.5;
    const endAngle = centerAngle + segmentSize * 0.5;
    const selected = weapon === selectedWeapon;

    ctx.beginPath();
    ctx.arc(0, 0, RADIAL_MENU_OUTER_RADIUS, startAngle, endAngle);
    ctx.arc(0, 0, RADIAL_MENU_INNER_RADIUS, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = selected ? 'rgba(100, 235, 255, 0.35)' : 'rgba(8, 20, 32, 0.72)';
    ctx.fill();
    ctx.strokeStyle = selected ? 'rgba(210, 255, 255, 0.88)' : 'rgba(148, 163, 184, 0.42)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();

    const labelRadius = (RADIAL_MENU_INNER_RADIUS + RADIAL_MENU_OUTER_RADIUS) * 0.5;
    const labelX = Math.cos(centerAngle) * labelRadius;
    const labelY = Math.sin(centerAngle) * labelRadius;
    ctx.fillStyle = selected ? '#ffffff' : '#cbd5e1';
    ctx.fillText(SELECTABLE_WEAPON_LABELS[weapon], labelX, labelY);

    if (currentPlayer.primaryWeapon === weapon || currentPlayer.secondaryWeapon === weapon) {
      const slotLabel =
        currentPlayer.primaryWeapon === weapon && currentPlayer.secondaryWeapon === weapon
          ? 'L/R'
          : currentPlayer.primaryWeapon === weapon
            ? 'L'
            : 'R';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.fillText(slotLabel, Math.cos(centerAngle) * 98, Math.sin(centerAngle) * 98);
    }
  }

  const aimAngle = currentPlayer.turretAngle - Math.PI * 0.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(aimAngle) * RADIAL_MENU_INNER_RADIUS, Math.sin(aimAngle) * RADIAL_MENU_INNER_RADIUS);
  ctx.lineTo(Math.cos(aimAngle) * (RADIAL_MENU_OUTER_RADIUS + 16), Math.sin(aimAngle) * (RADIAL_MENU_OUTER_RADIUS + 16));
  ctx.stroke();

  ctx.restore();
}
