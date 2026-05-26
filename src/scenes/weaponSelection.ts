import { getWeaponIconSprite, type Player, type SelectableWeaponType } from '@/constants';
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

export const RADIAL_MENU_INNER_RADIUS = 34;
export const RADIAL_MENU_OUTER_RADIUS = 116;
const SLOT_MARKER_RADIUS = RADIAL_MENU_INNER_RADIUS + 16;
const ICON_RADIUS = (RADIAL_MENU_INNER_RADIUS + RADIAL_MENU_OUTER_RADIUS) * 0.5;
const PRIMARY_SLOT_COLOR = '#38bdf8';
const SECONDARY_SLOT_COLOR = '#fb7185';

export function getRadialMenuWeapon(currentPlayer: Player): SelectableWeaponType {
  const turretAngle = currentPlayer.turretAngle - Math.PI * 0.5;
  const normalizedAngle = (turretAngle + Math.PI * 2) % (Math.PI * 2);
  const segmentSize = (Math.PI * 2) / SELECTABLE_WEAPONS.length;
  const selectedIndex = Math.floor(
    ((normalizedAngle + segmentSize * 0.5) % (Math.PI * 2)) / segmentSize,
  );
  return SELECTABLE_WEAPONS[selectedIndex];
}

export function applyWeaponSelectionInput(currentPlayer: Player, input: InputState): void {
  if (input.timeDilation.pressed) {
    const selectedWeapon = getRadialMenuWeapon(currentPlayer);
    if (input.fire.pressed) {
      currentPlayer.primaryWeapon = selectedWeapon;
      setSavedPrimaryWeapon(selectedWeapon);
    }
    if (input.fireSpecial.pressed) {
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

    ctx.save();
    ctx.translate(Math.cos(centerAngle) * ICON_RADIUS, Math.sin(centerAngle) * ICON_RADIUS);
    const icon = getWeaponIconSprite(weapon, selected);
    ctx.drawImage(icon, -icon.width / 2, -icon.height / 2);
    ctx.restore();

    const hasPrimarySlot = currentPlayer.primaryWeapon === weapon;
    const hasSecondarySlot = currentPlayer.secondaryWeapon === weapon;
    if (hasPrimarySlot || hasSecondarySlot) {
      const slotLabel = hasPrimarySlot && hasSecondarySlot ? 'L/R' : hasPrimarySlot ? 'L' : 'R';
      const slotX = Math.cos(centerAngle) * SLOT_MARKER_RADIUS;
      const slotY = Math.sin(centerAngle) * SLOT_MARKER_RADIUS;

      ctx.save();
      ctx.translate(slotX, slotY);
      if (hasPrimarySlot && hasSecondarySlot) {
        ctx.beginPath();
        ctx.arc(0, 0, 12, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = PRIMARY_SLOT_COLOR;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 12, Math.PI * 1.5, Math.PI * 0.5);
        ctx.fillStyle = SECONDARY_SLOT_COLOR;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fillStyle = hasPrimarySlot ? PRIMARY_SLOT_COLOR : SECONDARY_SLOT_COLOR;
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#06111f';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(slotLabel, 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
}
