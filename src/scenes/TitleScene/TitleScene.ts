import { sceneManager, type SceneName } from '@/sceneManager';
import { gameState, getGameCenterX, getGameCenterY } from '@/state';
import { createRotatedGradient } from '@/utils/canvas';
import type { Scene } from '../scene';

type MenuOption = {
  label: string;
  description: string;
  scene: SceneName;
};

const TITLE_MENU_OPTIONS: readonly MenuOption[] = [
  {
    label: 'Start Game',
    description: 'Jump straight into the main run.',
    scene: 'game',
  },
  {
    label: 'Sandbox',
    description: 'Inspect planets and systems in the sandbox scene.',
    scene: 'sandbox',
  },
  {
    label: 'Demo Scene',
    description: 'Launch the standalone demo presentation.',
    scene: 'demo',
  },
  {
    label: 'ATM Terms',
    description: 'Read the Torment Corp terms of service.',
    scene: 'atmterms',
  },
] as const;

export class TitleScene implements Scene {
  private static readonly menuWidth = 520;
  private static readonly menuHeight = 72;
  private static readonly menuGap = 16;

  private selectedIndex = 0;
  private pendingScene: SceneName | null = null;
  private keyboardMove = 0;
  private previousGamepadUp = false;
  private previousGamepadDown = false;
  private previousGamepadConfirm = false;
  private mousePosition = { x: 0, y: 0 };

  private handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();

    if (key === 'arrowup' || key === 'w') {
      this.keyboardMove = -1;
      event.preventDefault();
      return;
    }

    if (key === 'arrowdown' || key === 's') {
      this.keyboardMove = 1;
      event.preventDefault();
      return;
    }

    if (key === 'enter' || key === ' ') {
      this.activateSelectedOption();
      event.preventDefault();
      return;
    }

  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (
      (this.keyboardMove < 0 && (key === 'arrowup' || key === 'w')) ||
      (this.keyboardMove > 0 && (key === 'arrowdown' || key === 's'))
    ) {
      this.keyboardMove = 0;
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    this.mousePosition = { x: event.clientX, y: event.clientY };
    const hoveredIndex = this.getHoveredMenuIndex();
    if (hoveredIndex !== null) {
      this.selectedIndex = hoveredIndex;
    }
  };

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }

    this.mousePosition = { x: event.clientX, y: event.clientY };
    const hoveredIndex = this.getHoveredMenuIndex();
    if (hoveredIndex === null) {
      return;
    }

    this.selectedIndex = hoveredIndex;
    this.activateSelectedOption();
    event.preventDefault();
  };

  enter(): void {
    this.selectedIndex = 0;
    this.pendingScene = null;
    this.keyboardMove = 0;
    this.previousGamepadUp = false;
    this.previousGamepadDown = false;
    this.previousGamepadConfirm = false;
    this.mousePosition = { x: 0, y: 0 };
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
  }

  private moveSelection(direction: -1 | 1): void {
    const optionCount = TITLE_MENU_OPTIONS.length;
    this.selectedIndex = (this.selectedIndex + direction + optionCount) % optionCount;
  }

  private activateSelectedOption(): void {
    this.pendingScene = TITLE_MENU_OPTIONS[this.selectedIndex].scene;
  }

  private getMenuLayout(): { left: number; top: number } {
    return {
      left: getGameCenterX() - TitleScene.menuWidth / 2,
      top: getGameCenterY() + 8,
    };
  }

  private getHoveredMenuIndex(): number | null {
    const { left, top } = this.getMenuLayout();

    for (let i = 0; i < TITLE_MENU_OPTIONS.length; i++) {
      const itemTop = top + i * (TitleScene.menuHeight + TitleScene.menuGap);
      const withinX =
        this.mousePosition.x >= left && this.mousePosition.x <= left + TitleScene.menuWidth;
      const withinY =
        this.mousePosition.y >= itemTop &&
        this.mousePosition.y <= itemTop + TitleScene.menuHeight;

      if (withinX && withinY) {
        return i;
      }
    }

    return null;
  }

  private updateGamepadMenuInput(): void {
    const gamepads = navigator.getGamepads?.() ?? [];
    const activeGamepad = gamepads.find((gamepad) => gamepad?.connected);

    if (!activeGamepad) {
      this.previousGamepadUp = false;
      this.previousGamepadDown = false;
      this.previousGamepadConfirm = false;
      return;
    }

    const axisY = activeGamepad.axes[1] ?? 0;
    const upPressed = (activeGamepad.buttons[12]?.pressed ?? false) || axisY <= -0.55;
    const downPressed = (activeGamepad.buttons[13]?.pressed ?? false) || axisY >= 0.55;
    const confirmPressed =
      (activeGamepad.buttons[0]?.pressed ?? false) || (activeGamepad.buttons[9]?.pressed ?? false);

    if (upPressed && !this.previousGamepadUp) {
      this.moveSelection(-1);
    }

    if (downPressed && !this.previousGamepadDown) {
      this.moveSelection(1);
    }

    if (confirmPressed && !this.previousGamepadConfirm) {
      this.activateSelectedOption();
    }

    this.previousGamepadUp = upPressed;
    this.previousGamepadDown = downPressed;
    this.previousGamepadConfirm = confirmPressed;
  }

  update(_deltaTime: number): void {
    if (!gameState.assetsLoaded) {
      return;
    }

    this.updateGamepadMenuInput();

    if (this.keyboardMove !== 0) {
      this.moveSelection(this.keyboardMove < 0 ? -1 : 1);
      this.keyboardMove = 0;
    }

    if (this.pendingScene) {
      sceneManager.transitionTo(this.pendingScene);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.font = '72px Monoton, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = 'Comet Bursters';
    const firstRIndex = text.indexOf('r');
    const part1 = text.slice(0, firstRIndex);
    const part2 = text.slice(firstRIndex, firstRIndex + 1);
    const part3 = text.slice(firstRIndex + 1);

    const metrics1 = ctx.measureText(part1);
    const metrics2 = ctx.measureText(part2);
    const metrics3 = ctx.measureText(part3);

    const totalWidth = metrics1.width + metrics2.width + metrics3.width;
    const centerX = getGameCenterX();
    const centerY = getGameCenterY();
    let x = centerX - totalWidth / 2;
    const titleY = centerY - 150;

    const gradient = createRotatedGradient(
      ctx,
      x,
      titleY - 36,
      totalWidth,
      72,
      Math.PI / 2,
      '#7f00ff',
      '#00ffff',
    );

    ctx.shadowColor = '#7f00ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    ctx.fillText(part1, x + metrics1.width / 2, titleY);
    x += metrics1.width;

    ctx.save();
    ctx.translate(x + metrics2.width / 2, titleY);
    ctx.rotate(0.15);
    ctx.fillText(part2, 0, 0);
    ctx.restore();
    x += metrics2.width;

    ctx.fillText(part3, x + metrics3.width / 2, titleY);
    ctx.shadowBlur = 0;

    ctx.font = '18px Audiowide, sans-serif';
    ctx.fillStyle = '#a7a7a7';
    ctx.fillText('Use W/S, Arrow Keys, or D-Pad, then press Enter / A', centerX, centerY - 42);

    const hoveredIndex = this.getHoveredMenuIndex();
    const { left: menuLeft, top: menuTop } = this.getMenuLayout();

    for (let i = 0; i < TITLE_MENU_OPTIONS.length; i++) {
      const option = TITLE_MENU_OPTIONS[i];
      const isSelected = i === this.selectedIndex;
      const isHovered = i === hoveredIndex;
      const boxX = menuLeft;
      const boxY = menuTop + i * (TitleScene.menuHeight + TitleScene.menuGap);

      ctx.fillStyle = isSelected
        ? 'rgba(28, 36, 62, 0.92)'
        : isHovered
          ? 'rgba(18, 24, 40, 0.82)'
          : 'rgba(10, 14, 24, 0.7)';
      ctx.strokeStyle = isSelected
        ? 'rgba(94, 230, 255, 0.95)'
        : isHovered
          ? 'rgba(94, 230, 255, 0.48)'
          : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = isSelected ? 2.5 : isHovered ? 1.6 : 1;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, TitleScene.menuWidth, TitleScene.menuHeight, 14);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = isSelected ? '24px Audiowide, sans-serif' : '22px Audiowide, sans-serif';
      ctx.fillStyle = isSelected ? '#f4fbff' : '#d2d7e6';
      ctx.fillText(option.label, boxX + 24, boxY + 24);

      ctx.font = '14px Audiowide, sans-serif';
      ctx.fillStyle = isSelected ? '#92dff0' : '#7e879a';
      ctx.fillText(option.description, boxX + 24, boxY + 50);

    }

    ctx.textAlign = 'center';
    ctx.font = '16px Audiowide, sans-serif';
    ctx.fillStyle = '#8a8f9b';
    ctx.fillText('Controls', centerX, centerY + 356);

    ctx.fillStyle = '#727784';
    ctx.fillText('L Stick / WASD: Move', centerX, centerY + 382);
    ctx.fillText('R Stick / Mouse: Aim', centerX, centerY + 406);
    ctx.fillText('R1 / Left Click: Shoot', centerX, centerY + 430);
    ctx.fillText('R2 / Q: Black Hole', centerX, centerY + 454);
    ctx.fillText('L1 / Right Click: Pusher', centerX, centerY + 478);
    ctx.fillText('L2 / E: Shotgun', centerX, centerY + 502);
    ctx.fillText('A / Shift: Shield', centerX, centerY + 526);
  }

  exit(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
  }
}
