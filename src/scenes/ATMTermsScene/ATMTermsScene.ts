import { InputManager } from '@/input';
import { sceneManager } from '@/sceneManager';
import { getGameCenterX, getGameCenterY, getGameHeight, getGameWidth } from '@/state';
import type { Scene } from '../scene';

type DocumentLineType = 'header' | 'body' | 'warning' | 'footer' | 'blank';

type DocumentLine = {
  type: DocumentLineType;
  text: string;
};

type SceneState = 'reading' | 'signaturePrompt' | 'signing' | 'printing' | 'declined';

type ButtonAction = 'pageDown' | 'pageUp' | 'accept' | 'decline';

type SignatureStroke = {
  points: Array<{ x: number; y: number }>;
};

type Scratch = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
};

class InverseKinematicsArm {
  private readonly base = { x: 0, y: 0 };
  private readonly upperLength = 500;
  private readonly lowerLength = 420;
  private shoulderAngle = -Math.PI * 0.7;
  private elbowAngle = Math.PI * 0.55;

  setBase(x: number, y: number): void {
    this.base.x = x;
    this.base.y = y;
  }

  solve(targetX: number, targetY: number): void {
    const dx = targetX - this.base.x;
    const dy = targetY - this.base.y;
    const distance = Math.hypot(dx, dy);
    const maxReach = this.upperLength + this.lowerLength - 10;
    const minReach = Math.abs(this.upperLength - this.lowerLength) + 8;
    const reach = Math.max(minReach, Math.min(maxReach, distance || minReach));
    const baseAngle = Math.atan2(dy, dx);

    const shoulderOffset = Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (this.upperLength * this.upperLength +
            reach * reach -
            this.lowerLength * this.lowerLength) /
            (2 * this.upperLength * reach),
        ),
      ),
    );
    const elbowInterior = Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (this.upperLength * this.upperLength +
            this.lowerLength * this.lowerLength -
            reach * reach) /
            (2 * this.upperLength * this.lowerLength),
        ),
      ),
    );

    this.shoulderAngle = baseAngle - shoulderOffset;
    this.elbowAngle = Math.PI - elbowInterior;
  }

  getTip(): { x: number; y: number } {
    const elbow = this.getElbow();
    return {
      x: elbow.x + Math.cos(this.shoulderAngle + this.elbowAngle) * this.lowerLength,
      y: elbow.y + Math.sin(this.shoulderAngle + this.elbowAngle) * this.lowerLength,
    };
  }

  getForwardAngle(): number {
    return this.shoulderAngle + this.elbowAngle;
  }

  private getElbow(): { x: number; y: number } {
    return {
      x: this.base.x + Math.cos(this.shoulderAngle) * this.upperLength,
      y: this.base.y + Math.sin(this.shoulderAngle) * this.upperLength,
    };
  }

  draw(ctx: CanvasRenderingContext2D, tapExtension: number): void {
    const elbow = this.getElbow();
    const tip = this.getTip();
    const forwardAngle = this.getForwardAngle();

    ctx.save();

    ctx.strokeStyle = '#66747e';
    ctx.lineCap = 'round';

    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(this.base.x, this.base.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.stroke();

    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(elbow.x, elbow.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.strokeStyle = '#3d4a53';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(this.base.x - 5, this.base.y + 12);
    ctx.lineTo(elbow.x - 5, elbow.y + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(elbow.x - 4, elbow.y + 10);
    ctx.lineTo(tip.x - 4, tip.y + 10);
    ctx.stroke();

    ctx.strokeStyle = '#adb8bf';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(this.base.x + 10, this.base.y - 12);
    ctx.lineTo(elbow.x + 10, elbow.y - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(elbow.x + 7, elbow.y - 9);
    ctx.lineTo(tip.x + 7, tip.y - 9);
    ctx.stroke();

    ctx.fillStyle = '#253139';
    ctx.beginPath();
    ctx.arc(this.base.x, this.base.y, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(elbow.x, elbow.y, 23, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#50606a';
    ctx.beginPath();
    ctx.arc(this.base.x, this.base.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(elbow.x, elbow.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(tip.x, tip.y);
    ctx.rotate(forwardAngle);

    const press = tapExtension * 0.24;
    const handGradient = ctx.createLinearGradient(-58, -18, 8, 18);
    handGradient.addColorStop(0, '#51606a');
    handGradient.addColorStop(0.5, '#c4d0d6');
    handGradient.addColorStop(1, '#f2f6f8');
    ctx.fillStyle = handGradient;
    ctx.strokeStyle = '#263139';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.roundRect(-62 + press, -19, 34, 38, 11);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-30 + press, -13);
    ctx.quadraticCurveTo(-9 + press, -12, 2 + press, -4);
    ctx.quadraticCurveTo(9 + press, 0, 2 + press, 4);
    ctx.quadraticCurveTo(-9 + press, 12, -30 + press, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const y = -12 + i * 12;
      ctx.fillStyle = '#9eacb4';
      ctx.beginPath();
      ctx.roundRect(-55 + press, y, 25, 7, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#f8fbfc';
    ctx.beginPath();
    ctx.arc(4 + press, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

const STORAGE_KEY = 'tormentCorpAtmSignature';
const PAGE_RENDER_MS = 1000;
const PRINTING_DURATION_MS = 2000;
const LINE_HEIGHT = 19;
const MAX_TEXT_COLUMNS = 38;
const OPTION_LABELS: Record<ButtonAction, string> = {
  pageDown: 'v',
  pageUp: '^',
  accept: '✓',
  decline: 'X',
};

export class ATMTermsScene implements Scene {
  private readonly arm = new InverseKinematicsArm();
  private readonly documentLines: DocumentLine[] = [
    { type: 'header', text: '═══════════════════════════════════════════════' },
    { type: 'header', text: '                  TORMENT CORP' },
    { type: 'header', text: '         SPACETIME ACCESS AGREEMENT' },
    { type: 'header', text: '═══════════════════════════════════════════════' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'BY PROCEEDING, YOU ACKNOWLEDGE THAT YOUR VESSEL IS NOW' },
    { type: 'body', text: 'ENTERING RESTRICTED SPACETIME CONTROLLED BY TORMENT CORP.' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'THIS SPACETIME IS PROVISIONED TO YOU ON A TEMPORARY,' },
    { type: 'body', text: 'REVOKABLE BASIS. TORMENT CORP RESERVES THE RIGHT TO' },
    { type: 'body', text: 'REVOKE YOUR ACCESS AT ANY TIME, WITHOUT WARNING, AND' },
    { type: 'body', text: 'FOR ANY REASON OR NO REASON.' },
    { type: 'blank', text: '' },
    { type: 'warning', text: 'WARNING: UNAUTHORIZED PRESENCE IN RESTRICTED SPACETIME' },
    { type: 'warning', text: 'MAY RESULT IN IMMEDIATE TERMINATION OF YOUR VESSEL.' },
    { type: 'warning', text: '' },
    { type: 'warning', text: 'REVOCATION OF ACCESS MAY RESULT IN RAPID UNSCHEDULED' },
    { type: 'warning', text: 'DISASSEMBLY OF YOUR SHIP AND ALL CREW. TORMENT CORP' },
    { type: 'warning', text: 'ASSUMES NO LIABILITY FOR ANY LOSS OF PROPERTY, LIFE, OR' },
    { type: 'warning', text: 'OTHERWISE RESULTING FROM SUCH DISASSEMBLY.' },
    { type: 'blank', text: '' },
    { type: 'body', text: "YOUR VESSEL'S TELEMETRY DATA IS CONTINUOUSLY MONITORED BY" },
    { type: 'body', text: 'TORMENT CORP. ANY SUSPICIOUS ACTIVITY, INCLUDING BUT NOT' },
    { type: 'body', text: 'LIMITED TO: UNLICENSED WEAPONRY USE, ATTEMPTS TO LEAVE THE' },
    { type: 'body', text: 'DESIGNATED SPACETIME REGION, OR DISRUPTION OF TORMENT CORP' },
    { type: 'body', text: 'INFRASTRUCTURE, WILL RESULT IN IMMEDIATE ACCESS REVOCATION.' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'BY ACCEPTING THIS AGREEMENT, YOU WAIVE ALL RIGHTS TO' },
    { type: 'body', text: 'LITIGATION AGAINST TORMENT CORP, ITS AFFILIATES, EMPLOYEES,' },
    { type: 'body', text: 'AND CONTRACTORS. YOU ALSO ACKNOWLEDGE THAT TORMENT CORP' },
    { type: 'body', text: 'IS NOT RESPONSIBLE FOR ANY PHANTOM PAIN YOU MAY EXPERIENCE' },
    { type: 'body', text: 'AS A RESULT OF SPACETIME DISTORTIONS.' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'THIS AGREEMENT IS GOVERNED BY THE LAWS OF THE TORMENT' },
    { type: 'body', text: 'CORP JURISDICTION, WHICH IS LOCATED IN A REGION OF SPACETIME' },
    { type: 'body', text: 'NOT ACCESSIBLE BY YOUR CURRENT VESSEL.' },
    { type: 'blank', text: '' },
    { type: 'footer', text: '═══════════════════════════════════════════════' },
    { type: 'footer', text: 'SCROLL DOWN FOR TERMS CONTINUED...' },
    { type: 'blank', text: '' },
    { type: 'warning', text: '[ADDENDUM A: EXPANSION OF TERMS]' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'NOTE: TORMENT CORP RESERVES THE RIGHT TO CHANGE THESE' },
    { type: 'body', text: 'TERMS AT ANY TIME. YOUR CONTINUED USE OF RESTRICTED' },
    { type: 'body', text: 'SPACETIME AFTER ANY SUCH CHANGES CONSTITUTES ACCEPTANCE' },
    { type: 'body', text: 'OF THE NEW TERMS, EVEN IF YOU DID NOT READ THEM.' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'FURTHERMORE, TORMENT CORP MAY, AT ITS SOLE DISCRETION,' },
    { type: 'body', text: 'TRANSFER YOUR VESSEL TO A DIFFERENT SPACETIME REGION' },
    { type: 'body', text: 'WITHOUT YOUR CONSENT. COMFORTABLE SEATING IS NOT' },
    { type: 'body', text: 'GUARANTEED.' },
    { type: 'blank', text: '' },
    { type: 'warning', text: '[ADDENDUM B: LIABILITY WAIVER]' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'YOU EXPRESSLY AGREE THAT ANY EXISTENTIAL DREAD, COSMIC' },
    { type: 'body', text: 'ANXIETY, OR UNRESOLVED GRIEF RESULTING FROM YOUR TIME' },
    { type: 'body', text: 'IN RESTRICTED SPACETIME IS SOLELY YOUR OWN RESPONSIBILITY.' },
    { type: 'body', text: 'TORMENT CORP DOES NOT PROVIDE THERAPEUTIC SERVICES.' },
    { type: 'blank', text: '' },
    { type: 'body', text: 'IF YOUR VESSEL EXPERIENCES SPONTANEOUS COMBUSTION, WEIRD' },
    { type: 'body', text: 'TIME LOOP PHENOMENA, OR UNPLANNED QUANTUM TUNNELING, TORMENT' },
    { type: 'body', text: 'CORP CANNOT BE HELD LIABLE. THIS IS NOT A DRILL.' },
    { type: 'blank', text: '' },
    { type: 'footer', text: '═══════════════════════════════════════════════' },
    { type: 'footer', text: 'END OF DOCUMENT' },
    { type: 'footer', text: '═══════════════════════════════════════════════' },
  ];

  private readonly scratches: Scratch[] = [];
  private readonly signature: SignatureStroke[] = [];
  private state: SceneState = 'reading';
  private pageIndex = 0;
  private pageCount = 1;
  private linesPerPage = 1;
  private renderElapsed = PAGE_RENDER_MS;
  private tapAnimation = 0;
  private stateTimer = 0;
  private currentTapHeld = false;
  private previousTapHeld = false;
  private isSigningStrokeActive = false;
  private activeSignaturePoints = 0;
  private displayedLines: DocumentLine[] = [];
  private lastTouchPoint: { x: number; y: number } | null = null;

  private getWrappedDocumentLines(): DocumentLine[] {
    const wrapped: DocumentLine[] = [];

    for (const line of this.documentLines) {
      if (line.type !== 'body' && line.type !== 'warning') {
        wrapped.push(line);
        continue;
      }

      if (!line.text.trim()) {
        wrapped.push(line);
        continue;
      }

      const words = line.text.split(' ');
      let current = '';

      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > MAX_TEXT_COLUMNS) {
          if (current) {
            wrapped.push({ type: line.type, text: current });
          }
          current = word;
        } else {
          current = next;
        }
      }

      if (current) {
        wrapped.push({ type: line.type, text: current });
      }
    }

    return wrapped;
  }

  private getArmBase(): { x: number; y: number } {
    const frame = this.getMonitorFrameRect();
    return {
      x: frame.x + frame.width,
      y: getGameHeight(),
    };
  }

  enter(): void {
    this.state = 'reading';
    this.pageIndex = 0;
    this.renderElapsed = PAGE_RENDER_MS;
    this.tapAnimation = 0;
    this.stateTimer = 0;
    this.currentTapHeld = false;
    this.previousTapHeld = false;
    this.scratches.length = 0;
    this.signature.length = 0;
    this.lastTouchPoint = null;
    this.isSigningStrokeActive = false;
    this.activeSignaturePoints = 0;
    const armBase = this.getArmBase();
    this.arm.setBase(armBase.x, armBase.y);
    this.refreshPageMetrics();
    this.queueReadingRender();
  }

  update(deltaTime: number): void {
    this.stateTimer += deltaTime;
    this.renderElapsed = Math.min(PAGE_RENDER_MS, this.renderElapsed + deltaTime);

    const input = InputManager.getInputState();
    const mousePos = InputManager.getMousePosition();
    const screen = this.getScreenRect();
    const armBase = this.getArmBase();
    this.arm.setBase(armBase.x, armBase.y);

    let targetX = mousePos.x;
    let targetY = mousePos.y;
    if (InputManager.isAnyGamepadConnected() && input.aim.pressed) {
      targetX = getGameCenterX() + input.aim.value[0];
      targetY = getGameCenterY() + input.aim.value[1];
    }

    this.arm.solve(targetX, targetY);
    const tapHeld = input.fire.pressed || input.shield.pressed;
    const justPressed = tapHeld && !this.previousTapHeld;
    const justReleased = !tapHeld && this.previousTapHeld;
    this.currentTapHeld = tapHeld;
    this.tapAnimation = tapHeld
      ? Math.min(1, this.tapAnimation + deltaTime / 80)
      : Math.max(0, this.tapAnimation - deltaTime / 140);

    if (justPressed) {
      this.handleTap();
    }

    if (this.currentTapHeld && this.isHandOnScreen()) {
      this.applyScreenContact();
    } else {
      this.lastTouchPoint = null;
    }

    if (this.state === 'signing') {
      this.updateSignature(justPressed, justReleased);
    }

    if (this.state === 'printing' && this.stateTimer >= PRINTING_DURATION_MS) {
      sceneManager.transitionTo('sandbox');
    }

    if (this.state === 'declined' && this.stateTimer >= 1200) {
      sceneManager.transitionTo('title');
    }

    for (let i = this.scratches.length - 1; i >= 0; i -= 1) {
      this.scratches[i].life = Math.max(0.18, this.scratches[i].life - deltaTime / 45000);
    }

    if (
      !this.currentTapHeld &&
      (targetX < screen.x ||
        targetX > screen.x + screen.width ||
        targetY < screen.y ||
        targetY > screen.y + screen.height)
    ) {
      this.lastTouchPoint = null;
    }

    this.previousTapHeld = tapHeld;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const width = getGameWidth();
    const height = getGameHeight();

    this.drawRoom(ctx, width, height);
    this.drawAtm(ctx);
    this.arm.draw(ctx, this.tapAnimation * 14);
  }

  exit(): void {}

  private refreshPageMetrics(): void {
    const viewportHeight = this.getScreenRect().height - 92;
    const wrappedLines = this.getWrappedDocumentLines();
    this.linesPerPage = Math.max(10, Math.floor(viewportHeight / LINE_HEIGHT) - 1);
    this.pageCount = Math.max(1, Math.ceil(wrappedLines.length / this.linesPerPage));
    this.pageIndex = Math.min(this.pageIndex, this.pageCount - 1);
  }

  private handleTap(): void {
    if (this.renderElapsed < PAGE_RENDER_MS) {
      return;
    }

    const contact = this.getContactPoint();
    const buttonAction = this.getTappedButton(contact.x, contact.y);
    if (buttonAction) {
      this.activateButton(buttonAction);
      return;
    }

    if (this.state === 'signaturePrompt') {
      const signatureBox = this.getSignatureBox();
      if (this.pointInRect(contact.x, contact.y, signatureBox)) {
        this.state = 'signing';
      }
    }
  }

  private activateButton(action: ButtonAction): void {
    if (this.state === 'signaturePrompt' || this.state === 'signing') {
      if (action === 'accept' && this.hasValidSignature()) {
        this.completeSignature();
        return;
      }

      if (action === 'decline') {
        this.returnToTerms();
      }
      return;
    }

    if (this.state !== 'reading') {
      return;
    }

    if (action === 'pageDown' && this.pageIndex < this.pageCount - 1) {
      this.pageIndex += 1;
      this.queueReadingRender();
      return;
    }

    if (action === 'pageUp' && this.pageIndex > 0) {
      this.pageIndex -= 1;
      this.queueReadingRender();
      return;
    }

    if (action === 'accept') {
      this.state = 'signaturePrompt';
      this.stateTimer = 0;
      this.renderElapsed = PAGE_RENDER_MS;
      return;
    }

    if (action === 'decline') {
      this.decline();
    }
  }

  private decline(): void {
    this.state = 'declined';
    this.stateTimer = 0;
    this.renderElapsed = PAGE_RENDER_MS;
  }

  private returnToTerms(): void {
    this.state = 'reading';
    this.stateTimer = 0;
    this.isSigningStrokeActive = false;
    this.lastTouchPoint = null;
    this.queueReadingRender();
  }

  private queueReadingRender(): void {
    this.refreshPageMetrics();
    const wrappedLines = this.getWrappedDocumentLines();
    const start = this.pageIndex * this.linesPerPage;
    this.displayedLines = wrappedLines.slice(start, start + this.linesPerPage);
    this.renderElapsed = 0;
    this.stateTimer = 0;
  }

  private updateSignature(justPressed: boolean, justReleased: boolean): void {
    const contact = this.getContactPoint();
    const box = this.getSignatureBox();
    const inBox = this.pointInRect(contact.x, contact.y, box);

    if (justPressed && inBox) {
      this.isSigningStrokeActive = true;
      this.signature.push({ points: [contact] });
      this.activeSignaturePoints = 1;
    }

    if (this.currentTapHeld && this.isSigningStrokeActive && inBox) {
      const activeStroke = this.signature[this.signature.length - 1];
      const previous = activeStroke.points[activeStroke.points.length - 1];
      if (!previous || Math.hypot(contact.x - previous.x, contact.y - previous.y) > 3) {
        activeStroke.points.push(contact);
        this.activeSignaturePoints += 1;
      }
    }

    if (justReleased && this.isSigningStrokeActive) {
      this.isSigningStrokeActive = false;
    }
  }

  private hasValidSignature(): boolean {
    return this.signature.some((stroke) => stroke.points.length >= 16);
  }

  private completeSignature(): void {
    const payload = JSON.stringify(this.signature);
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      console.warn('Failed to save ATM signature', error);
    }

    this.state = 'printing';
    this.stateTimer = 0;
    this.renderElapsed = 0;
    this.playReceiptSound();
  }

  private playReceiptSound(): void {
    const AudioCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      return;
    }

    const context = new AudioCtor();
    void context.resume();

    const master = context.createGain();
    master.gain.value = 0.08;
    master.connect(context.destination);

    let start = context.currentTime;
    for (let i = 0; i < 18; i += 1) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = i % 3 === 0 ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(900 + (i % 4) * 120, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.04, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.06);
      start += 0.055;
    }

    const tailStart = start + 0.04;
    const tail = context.createOscillator();
    const tailGain = context.createGain();
    tail.type = 'triangle';
    tail.frequency.setValueAtTime(420, tailStart);
    tailGain.gain.setValueAtTime(0.0001, tailStart);
    tailGain.gain.exponentialRampToValueAtTime(0.035, tailStart + 0.01);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, tailStart + 0.35);
    tail.connect(tailGain);
    tailGain.connect(master);
    tail.start(tailStart);
    tail.stop(tailStart + 0.4);

    window.setTimeout(() => {
      void context.close();
    }, 2500);
  }

  private applyScreenContact(): void {
    const point = this.getContactPoint();
    if (!this.pointInRect(point.x, point.y, this.getScreenRect())) {
      this.lastTouchPoint = null;
      return;
    }

    if (!this.lastTouchPoint) {
      this.addScratch(point.x - 5, point.y - 4, point.x + 6, point.y + 3);
      this.lastTouchPoint = point;
      return;
    }

    if (Math.hypot(point.x - this.lastTouchPoint.x, point.y - this.lastTouchPoint.y) > 2) {
      this.addScratch(this.lastTouchPoint.x, this.lastTouchPoint.y, point.x, point.y);
      this.lastTouchPoint = point;
    }
  }

  private addScratch(x1: number, y1: number, x2: number, y2: number): void {
    this.scratches.push({ x1, y1, x2, y2, life: 0.75 });
    if (this.scratches.length > 2000) {
      this.scratches.shift();
    }
  }

  private isHandOnScreen(): boolean {
    const point = this.getContactPoint();
    return this.pointInRect(point.x, point.y, this.getScreenRect());
  }

  private getContactPoint(): { x: number; y: number } {
    return this.arm.getTip();
  }

  private getScreenRect(): { x: number; y: number; width: number; height: number } {
    const maxWidth = getGameWidth() * 0.78;
    const maxHeight = getGameHeight() * 0.72;
    let width = maxWidth;
    let height = width * 0.75;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * (4 / 3);
    }
    return {
      x: getGameCenterX() - width / 2,
      y: getGameCenterY() - height / 2 - getGameHeight() * 0.03,
      width,
      height,
    };
  }

  private getMonitorFrameRect(): { x: number; y: number; width: number; height: number } {
    const screen = this.getScreenRect();
    return {
      x: screen.x - 38,
      y: screen.y - 42,
      width: screen.width + 120,
      height: screen.height + 92,
    };
  }

  private getButtons(): Array<{
    action: ButtonAction;
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    const frame = this.getMonitorFrameRect();
    const scale = Math.max(0.72, Math.min(1.35, frame.height / 560));
    const buttonWidth = 58 * scale;
    const buttonHeight = 48 * scale;
    const startY = frame.y + 76 * scale;
    const spacing = 80 * scale;
    const x = frame.x + frame.width - 70 * scale;

    return [
      { action: 'pageDown', x, y: startY + spacing * 0, width: buttonWidth, height: buttonHeight },
      { action: 'pageUp', x, y: startY + spacing * 1, width: buttonWidth, height: buttonHeight },
      { action: 'accept', x, y: startY + spacing * 2, width: buttonWidth, height: buttonHeight },
      { action: 'decline', x, y: startY + spacing * 3, width: buttonWidth, height: buttonHeight },
    ];
  }

  private getTappedButton(x: number, y: number): ButtonAction | null {
    for (const button of this.getButtons()) {
      if (this.pointInRect(x, y, button)) {
        return button.action;
      }
    }
    return null;
  }

  private getSignatureBox(): { x: number; y: number; width: number; height: number } {
    const screen = this.getScreenRect();
    const boxWidth = Math.min(screen.width - 80, screen.width * 0.72);
    const boxHeight = Math.min(150, screen.height * 0.28);
    return {
      x: screen.x + (screen.width - boxWidth) / 2,
      y: screen.y + screen.height * 0.42,
      width: boxWidth,
      height: boxHeight,
    };
  }

  private pointInRect(
    x: number,
    y: number,
    rect: { x: number; y: number; width: number; height: number },
  ): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  private drawRoom(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#1d1710');
    bg.addColorStop(0.55, '#2e2419');
    bg.addColorStop(1, '#140f0b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#2a2117';
    ctx.fillRect(0, height - 110, width, 110);

    ctx.strokeStyle = 'rgba(255, 208, 112, 0.05)';
    ctx.lineWidth = 1;
    for (let i = -height; i < width; i += 38) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
  }

  private drawAtm(ctx: CanvasRenderingContext2D): void {
    const frame = this.getMonitorFrameRect();
    const screen = this.getScreenRect();

    ctx.save();

    const shell = ctx.createLinearGradient(
      frame.x,
      frame.y,
      frame.x + frame.width,
      frame.y + frame.height,
    );
    shell.addColorStop(0, '#6a5a44');
    shell.addColorStop(0.5, '#817054');
    shell.addColorStop(1, '#4d4132');
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.roundRect(frame.x, frame.y, frame.width, frame.height, 26);
    ctx.fill();

    ctx.fillStyle = '#3a3024';
    ctx.beginPath();
    ctx.roundRect(frame.x + 18, frame.y + 18, frame.width - 36, frame.height - 36, 18);
    ctx.fill();

    this.drawCrtScreen(ctx, screen);
    this.drawButtons(ctx);

    ctx.fillStyle = '#574937';
    ctx.beginPath();
    ctx.roundRect(frame.x + 110, frame.y + frame.height + 12, frame.width - 210, 26, 10);
    ctx.fill();

    ctx.fillStyle = '#31271d';
    ctx.beginPath();
    ctx.roundRect(frame.x + 155, frame.y + frame.height + 38, frame.width - 300, 78, 12);
    ctx.fill();

    ctx.restore();
  }

  private drawCrtScreen(
    ctx: CanvasRenderingContext2D,
    screen: { x: number; y: number; width: number; height: number },
  ): void {
    ctx.save();

    const glass = ctx.createLinearGradient(screen.x, screen.y, screen.x, screen.y + screen.height);
    glass.addColorStop(0, '#031223');
    glass.addColorStop(1, '#02101c');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.roundRect(screen.x, screen.y, screen.width, screen.height, 18);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(screen.x + 4, screen.y + 4, screen.width - 8, screen.height - 8, 16);
    ctx.clip();

    ctx.fillStyle = '#01131f';
    ctx.fillRect(screen.x, screen.y, screen.width, screen.height);

    const visibleHeight = Math.floor(screen.height * (this.renderElapsed / PAGE_RENDER_MS));
    if (visibleHeight > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(screen.x, screen.y, screen.width, visibleHeight);
      ctx.clip();
      this.drawScreenContent(ctx, screen);
      ctx.restore();
    }

    this.drawScratches(ctx);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(screen.x + 24, screen.y + 16);
    ctx.lineTo(screen.x + screen.width * 0.6, screen.y + 16);
    ctx.lineTo(screen.x + screen.width * 0.48, screen.y + 52);
    ctx.lineTo(screen.x + 12, screen.y + 52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 220, 130, 0.06)';
    for (let y = screen.y; y < screen.y + screen.height; y += 4) {
      ctx.fillRect(screen.x, y, screen.width, 1);
    }

    ctx.restore();
  }

  private drawScreenContent(
    ctx: CanvasRenderingContext2D,
    screen: { x: number; y: number; width: number; height: number },
  ): void {
    const textColor = '#ffdd5e';
    ctx.fillStyle = '#083e67';
    ctx.fillRect(screen.x, screen.y, screen.width, screen.height);

    ctx.fillStyle = textColor;
    ctx.font = `${Math.max(14, Math.min(22, screen.width / 42))}px "Courier New", monospace`;
    ctx.textBaseline = 'top';

    if (this.state === 'reading') {
      const left = screen.x + 26;
      let y = screen.y + 26;

      for (const line of this.displayedLines) {
        switch (line.type) {
          case 'header':
            ctx.fillStyle = '#fff087';
            break;
          case 'warning':
            ctx.fillStyle = '#ffd24f';
            break;
          case 'footer':
            ctx.fillStyle = '#c5b451';
            break;
          case 'body':
            ctx.fillStyle = textColor;
            break;
          default:
            ctx.fillStyle = 'rgba(0,0,0,0)';
        }

        ctx.fillText(line.text, left, y);
        y += LINE_HEIGHT;
      }

      ctx.fillStyle = '#fff087';
      ctx.fillText(
        `PAGE ${this.pageIndex + 1}/${this.pageCount}`,
        left,
        screen.y + screen.height - 34,
      );
      this.drawOptionLabels(ctx, screen);
      return;
    }

    if (this.state === 'signaturePrompt' || this.state === 'signing') {
      ctx.fillStyle = '#fff087';
      ctx.fillText('TORMENT CORP TOUCH AUTHORIZATION', screen.x + 24, screen.y + 24);
      ctx.fillText('PLACE LEGIBLE SIGNATURE INSIDE BOX', screen.x + 24, screen.y + 52);
      ctx.fillStyle = '#ffdd5e';
      ctx.fillText('DRAG CLAW ON CRT GLASS TO SIGN', screen.x + 24, screen.y + 96);
      ctx.fillText('PRESS ✓ TO CONFIRM SIGNATURE', screen.x + 24, screen.y + 122);
      ctx.fillText('PRESS X TO RETURN TO TERMS', screen.x + 24, screen.y + 148);

      const box = this.getSignatureBox();
      ctx.strokeStyle = '#ffdd5e';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(box.x + 10, box.y + 10, box.width - 20, box.height - 20);
      ctx.setLineDash([]);

      this.drawSignature(ctx);
      this.drawSignatureOptionLabels(ctx, screen);
      return;
    }

    if (this.state === 'printing') {
      ctx.fillStyle = '#fff087';
      ctx.fillText('SIGNATURE VERIFIED', screen.x + 24, screen.y + 40);
      ctx.fillText('PRINTING ENTRY RECEIPT...', screen.x + 24, screen.y + 72);
      ctx.fillStyle = '#ffdd5e';
      ctx.fillText('PLEASE WAIT', screen.x + 24, screen.y + 120);

      const bars = 18;
      const activeBars = Math.min(
        bars,
        Math.floor((this.stateTimer / PRINTING_DURATION_MS) * bars),
      );
      for (let i = 0; i < bars; i += 1) {
        ctx.fillStyle = i < activeBars ? '#ffdd5e' : 'rgba(255, 221, 94, 0.18)';
        ctx.fillRect(screen.x + 24 + i * 26, screen.y + 168, 18, 26);
      }
      return;
    }

    if (this.state === 'declined') {
      ctx.fillStyle = '#ffd24f';
      ctx.fillText('AGREEMENT DECLINED', screen.x + 24, screen.y + 40);
      ctx.fillText('RETURNING TO TITLE', screen.x + 24, screen.y + 72);
    }
  }

  private drawOptionLabels(
    ctx: CanvasRenderingContext2D,
    screen: { x: number; y: number; width: number; height: number },
  ): void {
    const buttons = this.getButtons();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff087';
    for (const button of buttons) {
      const labelY = button.y + button.height / 2 - 8;
      ctx.fillText(OPTION_LABELS[button.action], screen.x + screen.width - 20, labelY);
    }
    ctx.textAlign = 'left';
  }

  private drawSignatureOptionLabels(
    ctx: CanvasRenderingContext2D,
    screen: { x: number; y: number; width: number; height: number },
  ): void {
    const buttons = this.getButtons().filter(
      (button) => button.action === 'accept' || button.action === 'decline',
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff087';
    for (const button of buttons) {
      const labelY = button.y + button.height / 2 - 8;
      ctx.fillText(OPTION_LABELS[button.action], screen.x + screen.width - 20, labelY);
    }
    ctx.textAlign = 'left';
  }

  private drawButtons(ctx: CanvasRenderingContext2D): void {
    for (const button of this.getButtons()) {
      ctx.save();
      ctx.fillStyle = '#8d7861';
      ctx.beginPath();
      ctx.roundRect(button.x, button.y, button.width, button.height, 10);
      ctx.fill();

      ctx.fillStyle = '#504333';
      ctx.beginPath();
      ctx.roundRect(button.x + 4, button.y + 4, button.width - 8, button.height - 8, 8);
      ctx.fill();

      ctx.strokeStyle = '#c7b08e';
      ctx.lineWidth = 2;
      ctx.strokeRect(button.x + 7, button.y + 7, button.width - 14, button.height - 14);

      ctx.restore();
    }
  }

  private drawScratches(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = '#9ec2d9';
    ctx.lineWidth = 1;
    for (const scratch of this.scratches) {
      ctx.globalAlpha = scratch.life * 0.8;
      ctx.beginPath();
      ctx.moveTo(scratch.x1, scratch.y1);
      ctx.lineTo(scratch.x2, scratch.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSignature(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = '#ffef97';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of this.signature) {
      if (stroke.points.length < 2) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

}
