export class InputManager {
  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private keysReleased = new Set<string>();
  // Accumulates key presses across frames so fixedUpdate (which may not run
  // every frame) never misses a press.  Cleared via consumeFixedPresses().
  private fixedKeysPressed = new Set<string>();
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  isPointerLocked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  exitPointerLock(): void {
    document.exitPointerLock();
  }

  isDown(key: string): boolean {
    return this.keysDown.has(key.toLowerCase());
  }

  wasPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  /** Like wasPressed but safe for fixedUpdate – survives across frames. */
  wasFixedPressed(key: string): boolean {
    return this.fixedKeysPressed.has(key.toLowerCase());
  }

  /** Call once per frame AFTER all fixedUpdate iterations have run. */
  consumeFixedPresses(): void {
    this.fixedKeysPressed.clear();
  }

  wasReleased(key: string): boolean {
    return this.keysReleased.has(key.toLowerCase());
  }

  endFrame(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (key === 'tab') {
      e.preventDefault();
    }
    if (!this.keysDown.has(key)) {
      this.keysPressed.add(key);
      this.fixedKeysPressed.add(key);
    }
    this.keysDown.add(key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keysDown.delete(key);
    this.keysReleased.add(key);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.isPointerLocked) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  };

  private onPointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
  };
}
