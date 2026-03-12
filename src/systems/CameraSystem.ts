import * as THREE from 'three';
import { GameSystem } from '../core/Engine';
import { CONST } from '../core/Constants';
import { SecurityCamera } from '../entities/SecurityCamera';
import { Monster } from '../entities/Monster';
import { eventBus } from '../core/EventBus';

export class CameraSystem implements GameSystem {
  cameras: SecurityCamera[] = [];
  monitorMesh: THREE.Mesh | null = null;
  isViewingCameras = false;
  selectedCamera = 0;

  private monster: Monster;
  private playerCamera: THREE.Camera;
  private monitorPosition: THREE.Vector3;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private frameCounter = 0;
  private isPowerOn = true;
  private monitorMaterials: THREE.ShaderMaterial[] = [];

  // Fullscreen night vision rendering
  private fullscreenTarget: THREE.WebGLRenderTarget;
  private fullscreenMaterial: THREE.ShaderMaterial;
  private fullscreenScene: THREE.Scene;
  private fullscreenCamera: THREE.OrthographicCamera;
  private nightVisionLight: THREE.AmbientLight;

  static readonly CAMERA_LABELS = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

  private static CRT_VERTEX = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  private static CRT_FRAGMENT = `
    uniform sampler2D tDiffuse;
    uniform float staticLevel;
    uniform float time;
    uniform float powerOn;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      if (powerOn < 0.5) {
        gl_FragColor = vec4(0.02, 0.02, 0.02, 1.0);
        return;
      }

      // Barrel distortion
      vec2 uv = vUv - 0.5;
      float dist = dot(uv, uv);
      uv *= 1.0 + dist * 0.15;
      uv += 0.5;

      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec4 color = texture2D(tDiffuse, uv);

      // Green tint
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = vec3(lum * 0.3, lum * 1.0, lum * 0.3);

      // Scanlines
      float scanline = sin(uv.y * 300.0 + time * 2.0) * 0.08;
      color.rgb -= scanline;

      // Static noise based on monster proximity
      float noise = random(uv * time) * staticLevel;
      color.rgb = mix(color.rgb, vec3(random(uv + time)), noise);

      // Slight flickering
      float flicker = 0.97 + random(vec2(time * 0.1, 0.0)) * 0.03;
      color.rgb *= flicker;

      // Vignette
      float vig = 1.0 - dist * 2.0;
      color.rgb *= vig;

      // Brightness
      color.rgb *= 1.2;

      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `;

  private static NIGHTVISION_FRAGMENT = `
    uniform sampler2D tDiffuse;
    uniform float staticLevel;
    uniform float time;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      // Barrel distortion (subtle for fullscreen)
      vec2 uv = vUv - 0.5;
      float dist = dot(uv, uv);
      uv *= 1.0 + dist * 0.08;
      uv += 0.5;

      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec4 color = texture2D(tDiffuse, uv);

      // Night vision amplification: gamma boost + brightness multiply
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      lum = pow(max(lum, 0.0), 0.45) * 2.0;
      // Green phosphor night vision tint
      color.rgb = vec3(lum * 0.1, lum * 0.9, lum * 0.1);

      // Scanlines (finer for fullscreen)
      float scanline = sin(uv.y * 500.0 + time * 3.0) * 0.04;
      color.rgb -= scanline;

      // Horizontal line artifact
      float hLine = step(0.998, fract(uv.y * 200.0 + time * 0.5));
      color.rgb += hLine * 0.05;

      // Static noise from monster proximity
      float noise = random(uv + vec2(time * 0.7, time * 1.3)) * staticLevel * 0.8;
      color.rgb = mix(color.rgb, vec3(random(uv * 3.0 + time)), noise);

      // Flickering
      float flicker = 0.97 + random(vec2(time * 0.15, 0.0)) * 0.03;
      color.rgb *= flicker;

      // Vignette (softer for fullscreen)
      float vig = 1.0 - dist * 1.2;
      color.rgb *= vig;

      // Subtle grain
      float grain = (random(uv * time * 0.5) - 0.5) * 0.03;
      color.rgb += grain;

      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    monster: Monster,
    playerCamera: THREE.Camera,
    fenceData: Array<{ midpoint: THREE.Vector3; normal: THREE.Vector3 }>,
    monitorPosition: THREE.Vector3,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.monster = monster;
    this.playerCamera = playerCamera;
    this.monitorPosition = monitorPosition.clone();

    // Create 4 cameras on fence posts
    for (let i = 0; i < CONST.CAMERA_COUNT; i++) {
      const data = fenceData[i];
      const camPos = data.midpoint.clone();
      camPos.y = CONST.FENCE_HEIGHT - 0.2;
      const cam = new SecurityCamera(camPos, data.normal, i);
      this.cameras.push(cam);
      scene.add(cam.mesh);
    }

    // Create monitor display in cabin
    this.createMonitor(monitorPosition);

    // Setup fullscreen night vision rendering
    this.fullscreenTarget = new THREE.WebGLRenderTarget(
      window.innerWidth, window.innerHeight,
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
    );

    this.fullscreenMaterial = new THREE.ShaderMaterial({
      vertexShader: CameraSystem.CRT_VERTEX,
      fragmentShader: CameraSystem.NIGHTVISION_FRAGMENT,
      uniforms: {
        tDiffuse: { value: this.fullscreenTarget.texture },
        staticLevel: { value: 0.0 },
        time: { value: 0.0 },
      },
    });

    this.fullscreenScene = new THREE.Scene();
    this.fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.fullscreenMaterial
    );
    this.fullscreenScene.add(quad);

    // Night vision light (added to main scene, hidden by default)
    this.nightVisionLight = new THREE.AmbientLight(0xffffff, 2.0);
    this.nightVisionLight.visible = false;
    scene.add(this.nightVisionLight);

    // Resize handler for fullscreen target
    window.addEventListener('resize', () => {
      this.fullscreenTarget.setSize(window.innerWidth, window.innerHeight);
    });

    eventBus.on('generator:power-toggle', ({ isOn }) => {
      this.isPowerOn = isOn;
    });
  }

  private createMonitor(position: THREE.Vector3): void {
    const group = new THREE.Group();

    // Monitor frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.4,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.08), frameMat);
    group.add(frame);

    // 2x2 grid of screens
    const screenSize = 0.35;
    const gap = 0.02;
    const positions = [
      [-screenSize / 2 - gap / 2, screenSize / 2 + gap / 2],
      [screenSize / 2 + gap / 2, screenSize / 2 + gap / 2],
      [-screenSize / 2 - gap / 2, -screenSize / 2 - gap / 2],
      [screenSize / 2 + gap / 2, -screenSize / 2 - gap / 2],
    ];

    for (let i = 0; i < 4; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: CameraSystem.CRT_VERTEX,
        fragmentShader: CameraSystem.CRT_FRAGMENT,
        uniforms: {
          tDiffuse: { value: this.cameras[i]?.renderTarget.texture ?? null },
          staticLevel: { value: 0.0 },
          time: { value: 0.0 },
          powerOn: { value: 1.0 },
        },
      });
      this.monitorMaterials.push(mat);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(screenSize, screenSize),
        mat
      );
      screen.position.set(positions[i][0], positions[i][1], 0.041);
      group.add(screen);
    }

    group.position.copy(position);
    group.position.y += 0.3;
    this.scene.add(group);
    this.monitorMesh = frame;
  }

  renderFullscreenView(origRender: (scene: THREE.Scene, camera: THREE.Camera) => void): void {
    const cam = this.cameras[this.selectedCamera];
    if (!cam) return;

    const time = performance.now() * 0.001;

    // Boost scene lighting for night vision
    this.nightVisionLight.visible = true;
    const fog = this.scene.fog as THREE.FogExp2 | null;
    const savedDensity = fog?.density ?? 0.02;
    if (fog) fog.density = 0.004;

    // Increase camera far clip for fullscreen view
    const savedFar = cam.camera.far;
    cam.camera.far = 80;
    cam.camera.updateProjectionMatrix();

    // Hide monitor to avoid rendering it
    if (this.monitorMesh) this.monitorMesh.visible = false;

    // Render scene from security camera to fullscreen target
    this.renderer.setRenderTarget(this.fullscreenTarget);
    origRender(this.scene, cam.camera);
    this.renderer.setRenderTarget(null);

    // Restore scene state
    this.nightVisionLight.visible = false;
    if (fog) fog.density = savedDensity;
    cam.camera.far = savedFar;
    cam.camera.updateProjectionMatrix();
    if (this.monitorMesh) this.monitorMesh.visible = true;

    // Update fullscreen shader uniforms
    this.fullscreenMaterial.uniforms.tDiffuse.value = this.fullscreenTarget.texture;
    this.fullscreenMaterial.uniforms.staticLevel.value = cam.staticLevel;
    this.fullscreenMaterial.uniforms.time.value = time;

    // Render CRT quad to screen
    origRender(this.fullscreenScene, this.fullscreenCamera);
  }

  fixedUpdate(_dt: number): void {
    // Update static levels based on monster proximity
    for (let i = 0; i < this.cameras.length; i++) {
      const cam = this.cameras[i];
      const dist = this.monster.position.distanceTo(cam.position);
      // Static increases as monster gets closer
      cam.staticLevel = Math.max(0, Math.min(1, 1 - dist / 40));
      eventBus.emit('camera:static-level', { cameraId: i, level: cam.staticLevel });
    }
  }

  update(_dt: number): void {
    const time = performance.now() * 0.001;

    // Only render cameras if power is on and player is near the monitor
    const distToMonitor = this.playerCamera.position.distanceTo(this.monitorPosition);
    const shouldRender = this.isPowerOn && distToMonitor < 12;

    if (shouldRender) {
      // Round-robin rendering: render one camera per frame
      const camIdx = this.frameCounter % CONST.CAMERA_COUNT;
      this.frameCounter++;

      if (this.cameras[camIdx]) {
        const cam = this.cameras[camIdx];
        // Temporarily hide monitor to avoid recursion
        if (this.monitorMesh) this.monitorMesh.visible = false;
        this.renderer.setRenderTarget(cam.renderTarget);
        this.renderer.render(this.scene, cam.camera);
        this.renderer.setRenderTarget(null);
        if (this.monitorMesh) this.monitorMesh.visible = true;
      }
    }

    // Update shader uniforms
    for (let i = 0; i < this.monitorMaterials.length; i++) {
      const mat = this.monitorMaterials[i];
      mat.uniforms.time.value = time;
      mat.uniforms.staticLevel.value = this.cameras[i]?.staticLevel ?? 0;
      mat.uniforms.powerOn.value = this.isPowerOn ? 1.0 : 0.0;
    }
  }
}
