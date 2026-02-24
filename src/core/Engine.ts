import * as THREE from 'three';
import { CONST } from './Constants';
import { InputManager } from './InputManager';

export interface GameSystem {
  fixedUpdate?(dt: number): void;
  update?(dt: number, alpha: number): void;
}

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  input: InputManager;

  private systems: GameSystem[] = [];
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private onRenderCallbacks: Array<() => void> = [];

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.setClearColor(0x0a0a0a);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010208, 0.04);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    this.input = new InputManager(this.renderer.domElement);

    window.addEventListener('resize', this.onResize);
  }

  addSystem(system: GameSystem): void {
    this.systems.push(system);
  }

  clearSystems(): void {
    this.systems = [];
    this.onRenderCallbacks = [];
  }

  onRender(cb: () => void): void {
    this.onRenderCallbacks.push(cb);
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    let frameDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameDelta > 0.25) frameDelta = 0.25;

    this.accumulator += frameDelta;

    while (this.accumulator >= CONST.FIXED_DT) {
      for (const sys of this.systems) {
        sys.fixedUpdate?.(CONST.FIXED_DT);
      }
      this.accumulator -= CONST.FIXED_DT;
    }

    const alpha = this.accumulator / CONST.FIXED_DT;
    for (const sys of this.systems) {
      sys.update?.(frameDelta, alpha);
    }

    for (const cb of this.onRenderCallbacks) cb();

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  dispose(): void {
    this.running = false;
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    this.renderer.dispose();
  }
}
