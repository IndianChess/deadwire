import * as THREE from 'three';
import { CONST } from '../core/Constants';
import { InputManager } from '../core/InputManager';
import { eventBus } from '../core/EventBus';
import { GameSystem } from '../core/Engine';

export class Player implements GameSystem {
  camera: THREE.PerspectiveCamera;
  flashlight: THREE.SpotLight;
  flashlightOn = true;
  flashlightBattery = CONST.FLASHLIGHT_MAX;
  stamina = CONST.STAMINA_MAX;
  hp = CONST.PLAYER_HP;
  noiseLevel = 0;
  inventory = new Set<string>();
  inputEnabled = true;

  private input: InputManager;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private collisionBoxes: THREE.Box3[] = [];
  private treePositions: THREE.Vector3[] = [];
  private _isSprinting = false;
  private mouseSensitivity = 0.002;
  private damageFlashTime = 0;
  private position = new THREE.Vector3(0, CONST.PLAYER_HEIGHT, 0);

  // Pre-allocated temporaries for hot-path methods (zero per-frame allocations)
  private _tmpNewPos = new THREE.Vector3();
  private _tmpSlide = new THREE.Vector3();
  private _tmpCameraDir = new THREE.Vector3();
  private _tmpRight = new THREE.Vector3();
  private _tmpUp = new THREE.Vector3(0, 1, 0);
  private _playerBox = new THREE.Box3();
  private _playerBoxMin = new THREE.Vector3();
  private _playerBoxMax = new THREE.Vector3();

  // Pre-computed collision threshold (squared)
  private _collisionRadiusSq = (CONST.PLAYER_RADIUS + 0.35) * (CONST.PLAYER_RADIUS + 0.35);
  private _collisionRadius = CONST.PLAYER_RADIUS + 0.35;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;

    this.flashlight = new THREE.SpotLight(0xfff5e0, 15, 60, 0.7, 0.3, 0.8);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(256, 256);
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 50;
    this.flashlight.target = new THREE.Object3D();

    camera.add(this.flashlight);
    camera.add(this.flashlight.target);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);

    this.camera.position.copy(this.position);
  }

  get isSprinting(): boolean {
    return this._isSprinting;
  }

  setCollisionGeometry(boxes: THREE.Box3[], trees: THREE.Vector3[]): void {
    this.collisionBoxes = boxes;
    this.treePositions = trees;
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.damageFlashTime = 0.3;
    eventBus.emit('player:damaged', { amount, hpRemaining: this.hp });
    if (this.hp <= 0) {
      eventBus.emit('player:died', {});
    }
  }

  fixedUpdate(dt: number): void {
    if (!this.inputEnabled) return;

    // Mouse look
    if (this.input.isPointerLocked) {
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= this.input.mouseDeltaX * this.mouseSensitivity;
      this.euler.x -= this.input.mouseDeltaY * this.mouseSensitivity;
      this.euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    }

    // Movement
    this.direction.set(0, 0, 0);
    if (this.input.isDown('w') || this.input.isDown('arrowup')) this.direction.z -= 1;
    if (this.input.isDown('s') || this.input.isDown('arrowdown')) this.direction.z += 1;
    if (this.input.isDown('a') || this.input.isDown('arrowleft')) this.direction.x -= 1;
    if (this.input.isDown('d') || this.input.isDown('arrowright')) this.direction.x += 1;
    this.direction.normalize();

    // Sprint
    this._isSprinting = this.input.isDown('shift') && this.stamina > 0 && this.direction.length() > 0;
    const speed = this._isSprinting ? CONST.PLAYER_SPRINT_SPEED : CONST.PLAYER_SPEED;

    if (this._isSprinting) {
      this.stamina = Math.max(0, this.stamina - CONST.STAMINA_DRAIN * dt);
    } else {
      this.stamina = Math.min(CONST.STAMINA_MAX, this.stamina + CONST.STAMINA_REGEN * dt);
    }

    // Apply movement in camera direction (yaw only) — reuse pre-allocated vectors
    this.camera.getWorldDirection(this._tmpCameraDir);
    this._tmpCameraDir.y = 0;
    this._tmpCameraDir.normalize();

    this._tmpRight.crossVectors(this._tmpCameraDir, this._tmpUp).normalize();

    this.velocity.set(0, 0, 0);
    this.velocity.addScaledVector(this._tmpCameraDir, -this.direction.z);
    this.velocity.addScaledVector(this._tmpRight, this.direction.x);
    if (this.velocity.length() > 0) this.velocity.normalize();
    this.velocity.multiplyScalar(speed * dt);

    // Apply and collide — reuse pre-allocated temp vectors
    this._tmpNewPos.copy(this.position).add(this.velocity);
    this._tmpNewPos.y = CONST.PLAYER_HEIGHT;

    if (!this.checkCollision(this._tmpNewPos)) {
      this.position.copy(this._tmpNewPos);
    } else {
      // Try sliding along axes
      this._tmpSlide.copy(this.position);
      this._tmpSlide.x += this.velocity.x;
      if (!this.checkCollision(this._tmpSlide)) {
        this.position.x = this._tmpSlide.x;
      }
      this._tmpSlide.copy(this.position);
      this._tmpSlide.z += this.velocity.z;
      if (!this.checkCollision(this._tmpSlide)) {
        this.position.z = this._tmpSlide.z;
      }
    }

    this.camera.position.copy(this.position);

    // Flashlight toggle
    if (this.input.wasPressed('f')) {
      this.flashlightOn = !this.flashlightOn;
      this.flashlight.visible = this.flashlightOn;
      eventBus.emit('player:flashlight-toggle', { isOn: this.flashlightOn });
    }

    // Flashlight battery
    if (this.flashlightOn) {
      this.flashlightBattery = Math.max(0, this.flashlightBattery - CONST.FLASHLIGHT_DRAIN * dt);
      if (this.flashlightBattery <= 0) {
        this.flashlightOn = false;
        this.flashlight.visible = false;
        eventBus.emit('player:flashlight-toggle', { isOn: false });
      }
      this.flashlight.intensity = 15 * Math.min(1, this.flashlightBattery / 20);
    } else {
      this.flashlightBattery = Math.min(
        CONST.FLASHLIGHT_MAX,
        this.flashlightBattery + CONST.FLASHLIGHT_RECHARGE * dt
      );
    }

    // Noise
    if (this.direction.length() > 0) {
      this.noiseLevel = this._isSprinting ? CONST.NOISE_SPRINT : CONST.NOISE_WALK;
    } else {
      this.noiseLevel = CONST.NOISE_IDLE;
    }
  }

  update(dt: number): void {
    if (this.damageFlashTime > 0) {
      this.damageFlashTime -= dt;
    }
  }

  getDamageFlashIntensity(): number {
    return Math.max(0, this.damageFlashTime / 0.3);
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  private checkCollision(pos: THREE.Vector3): boolean {
    // Reuse pre-allocated Box3 instead of creating new one each call
    this._playerBoxMin.set(
      pos.x - CONST.PLAYER_RADIUS,
      0,
      pos.z - CONST.PLAYER_RADIUS
    );
    this._playerBoxMax.set(
      pos.x + CONST.PLAYER_RADIUS,
      CONST.PLAYER_HEIGHT + 0.3,
      pos.z + CONST.PLAYER_RADIUS
    );
    this._playerBox.set(this._playerBoxMin, this._playerBoxMax);

    for (const box of this.collisionBoxes) {
      if (this._playerBox.intersectsBox(box)) return true;
    }

    // Fast AABB rejection + squared-distance check (avoids Math.sqrt entirely)
    const px = pos.x;
    const pz = pos.z;
    const threshold = this._collisionRadius;
    const thresholdSq = this._collisionRadiusSq;
    for (let i = 0, len = this.treePositions.length; i < len; i++) {
      const tree = this.treePositions[i];
      const dx = px - tree.x;
      // Fast rejection on X axis
      if (dx > threshold || dx < -threshold) continue;
      const dz = pz - tree.z;
      // Fast rejection on Z axis
      if (dz > threshold || dz < -threshold) continue;
      // Squared distance check (no sqrt)
      if (dx * dx + dz * dz < thresholdSq) return true;
    }

    return false;
  }
}
