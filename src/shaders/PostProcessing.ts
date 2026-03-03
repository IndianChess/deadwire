import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const HorrorShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0.0 },
    vignetteStrength: { value: 0.8 },
    grainStrength: { value: 0.06 },
    damageFlash: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignetteStrength;
    uniform float grainStrength;
    uniform float damageFlash;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Film grain
      float grain = random(vUv * time) * grainStrength;
      color.rgb += grain - grainStrength * 0.5;

      // Vignette
      vec2 uv = vUv - 0.5;
      float dist = dot(uv, uv);
      float vig = 1.0 - dist * vignetteStrength * 2.0;
      color.rgb *= vig;

      // Color grading - push shadows to blue, desaturate slightly
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(color.rgb, vec3(lum), 0.15); // desaturate
      color.rgb += vec3(-0.01, -0.005, 0.02) * (1.0 - lum); // blue shadows

      // Damage flash (red overlay)
      color.rgb = mix(color.rgb, vec3(0.6, 0.0, 0.0), damageFlash * 0.4);

      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `,
};

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): { composer: EffectComposer; horrorPass: ShaderPass } {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
    0.3,  // strength
    0.5,  // radius
    0.85  // threshold
  );
  composer.addPass(bloomPass);

  const horrorPass = new ShaderPass(HorrorShader);
  composer.addPass(horrorPass);

  const onResize = () => {
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth / 2, window.innerHeight / 2);
  };
  window.addEventListener('resize', onResize);

  return { composer, horrorPass };
}
