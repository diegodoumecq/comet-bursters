import { sceneManager, type SceneName } from '@/sceneManager';
import { gameState, getGameCenterX, getGameCenterY, getGameHeight, getGameWidth } from '@/state';
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
    label: 'Ship Interior',
    description: 'Navigate corridors, avoid patrol vision, and silence alarms.',
    scene: 'shipinterior',
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

  private getLayoutMetrics(): {
    centerX: number;
    centerY: number;
    gameWidth: number;
    gameHeight: number;
    titleY: number;
    titleFontSize: number;
    promptY: number;
    menuLeft: number;
    menuTop: number;
    menuWidth: number;
    menuHeight: number;
    menuGap: number;
    optionTitleFontSize: number;
    optionDescriptionFontSize: number;
    controlsHeaderY: number;
    controlsStartY: number;
    controlsStep: number;
    controlsFontSize: number;
    controlsHeaderFontSize: number;
  } {
    const centerX = getGameCenterX();
    const centerY = getGameCenterY();
    const gameWidth = getGameWidth();
    const gameHeight = getGameHeight();
    const compact = gameHeight < 860;
    const veryCompact = gameHeight < 740;

    const menuWidth = Math.min(520, Math.max(320, gameWidth - 64));
    const menuHeight = veryCompact ? 58 : compact ? 64 : 72;
    const menuGap = veryCompact ? 10 : compact ? 12 : 16;
    const titleFontSize = veryCompact ? 54 : compact ? 62 : 72;
    const titleY = Math.max(88, gameHeight * (veryCompact ? 0.14 : compact ? 0.16 : 0.18));
    const promptY = titleY + (veryCompact ? 62 : compact ? 70 : 84);
    const menuTop = promptY + (veryCompact ? 30 : compact ? 36 : 50);
    const controlsHeaderY =
      menuTop + TITLE_MENU_OPTIONS.length * menuHeight + (TITLE_MENU_OPTIONS.length - 1) * menuGap + (veryCompact ? 26 : 34);
    const controlsStartY = controlsHeaderY + (veryCompact ? 22 : 28);

    return {
      centerX,
      centerY,
      gameWidth,
      gameHeight,
      titleY,
      titleFontSize,
      promptY,
      menuLeft: centerX - menuWidth / 2,
      menuTop,
      menuWidth,
      menuHeight,
      menuGap,
      optionTitleFontSize: veryCompact ? 19 : compact ? 21 : 24,
      optionDescriptionFontSize: veryCompact ? 12 : 14,
      controlsHeaderY,
      controlsStartY,
      controlsStep: veryCompact ? 19 : compact ? 22 : 24,
      controlsFontSize: veryCompact ? 13 : 16,
      controlsHeaderFontSize: veryCompact ? 14 : 16,
    };
  }

  private getHoveredMenuIndex(): number | null {
    const { menuLeft, menuTop, menuWidth, menuHeight, menuGap } = this.getLayoutMetrics();

    for (let i = 0; i < TITLE_MENU_OPTIONS.length; i++) {
      const itemTop = menuTop + i * (menuHeight + menuGap);
      const withinX =
        this.mousePosition.x >= menuLeft && this.mousePosition.x <= menuLeft + menuWidth;
      const withinY =
        this.mousePosition.y >= itemTop &&
        this.mousePosition.y <= itemTop + menuHeight;

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
    const layout = this.getLayoutMetrics();

    ctx.font = `${layout.titleFontSize}px Monoton, sans-serif`;
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
    const { centerX } = layout;
    let x = centerX - totalWidth / 2;
    const titleY = layout.titleY;

    const gradient = createRotatedGradient(
      ctx,
      x,
      titleY - layout.titleFontSize * 0.5,
      totalWidth,
      layout.titleFontSize,
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

    ctx.font = `${Math.max(14, layout.optionDescriptionFontSize + 4)}px Audiowide, sans-serif`;
    ctx.fillStyle = '#a7a7a7';
    ctx.fillText('Use W/S, Arrow Keys, or D-Pad, then press Enter / A', centerX, layout.promptY);

    const hoveredIndex = this.getHoveredMenuIndex();
    const { menuLeft, menuTop, menuWidth, menuHeight, menuGap } = layout;

    for (let i = 0; i < TITLE_MENU_OPTIONS.length; i++) {
      const option = TITLE_MENU_OPTIONS[i];
      const isSelected = i === this.selectedIndex;
      const isHovered = i === hoveredIndex;
      const boxX = menuLeft;
      const boxY = menuTop + i * (menuHeight + menuGap);

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
      ctx.roundRect(boxX, boxY, menuWidth, menuHeight, 14);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = `${isSelected ? layout.optionTitleFontSize : layout.optionTitleFontSize - 2}px Audiowide, sans-serif`;
      ctx.fillStyle = isSelected ? '#f4fbff' : '#d2d7e6';
      ctx.fillText(option.label, boxX + 20, boxY + menuHeight * 0.34);

      ctx.font = `${layout.optionDescriptionFontSize}px Audiowide, sans-serif`;
      ctx.fillStyle = isSelected ? '#92dff0' : '#7e879a';
      ctx.fillText(option.description, boxX + 20, boxY + menuHeight * 0.7);

    }

    ctx.textAlign = 'center';
    ctx.font = `${layout.controlsHeaderFontSize}px Audiowide, sans-serif`;
    ctx.fillStyle = '#8a8f9b';
    ctx.fillText('Controls', centerX, layout.controlsHeaderY);

    const controls = [
      'L Stick / WASD: Move',
      'R Stick / Mouse: Aim',
      'R1 / Left Click: Shoot',
      'R2 / Q: Black Hole',
      'L1 / Right Click: Pusher',
      'L2 / E: Shotgun',
      'A / Shift: Shield',
    ];

    ctx.font = `${layout.controlsFontSize}px Audiowide, sans-serif`;
    ctx.fillStyle = '#727784';
    for (let i = 0; i < controls.length; i++) {
      const y = layout.controlsStartY + i * layout.controlsStep;
      if (y > layout.gameHeight - 18) {
        break;
      }
      ctx.fillText(controls[i], centerX, y);
    }
  }

  exit(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
  }
}
