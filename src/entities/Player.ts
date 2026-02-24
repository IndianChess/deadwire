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

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;

    this.flashlight = new THREE.SpotLight(0xfff5e0, 15, 60, 0.7, 0.3, 0.8);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(512, 512);
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

    // Apply movement in camera direction (yaw only)
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    cameraDir.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(cameraDir, new THREE.Vector3(0, 1, 0)).normalize();

    this.velocity.set(0, 0, 0);
    this.velocity.addScaledVector(cameraDir, -this.direction.z);
    this.velocity.addScaledVector(right, this.direction.x);
    if (this.velocity.length() > 0) this.velocity.normalize();
    this.velocity.multiplyScalar(speed * dt);

    // Apply and collide
    const newPos = this.position.clone().add(this.velocity);
    newPos.y = CONST.PLAYER_HEIGHT;

    if (!this.checkCollision(newPos)) {
      this.position.copy(newPos);
    } else {
      // Try sliding along axes
      const slideX = this.position.clone();
      slideX.x += this.velocity.x;
      if (!this.checkCollision(slideX)) {
        this.position.x = slideX.x;
      }
      const slideZ = this.position.clone();
      slideZ.z += this.velocity.z;
      if (!this.checkCollision(slideZ)) {
        this.position.z = slideZ.z;
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
    const playerMin = new THREE.Vector3(
      pos.x - CONST.PLAYER_RADIUS,
      0,
      pos.z - CONST.PLAYER_RADIUS
    );
    const playerMax = new THREE.Vector3(
      pos.x + CONST.PLAYER_RADIUS,
      CONST.PLAYER_HEIGHT + 0.3,
      pos.z + CONST.PLAYER_RADIUS
    );
    const playerBox = new THREE.Box3(playerMin, playerMax);

    for (const box of this.collisionBoxes) {
      if (playerBox.intersectsBox(box)) return true;
    }

    for (const tree of this.treePositions) {
      const dx = pos.x - tree.x;
      const dz = pos.z - tree.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < CONST.PLAYER_RADIUS + 0.35) return true;
    }

    return false;
  }
}
