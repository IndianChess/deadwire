import * as THREE from 'three';
import { buildCabin, CabinResult } from './Cabin';
import { buildFence, FenceResult } from './FenceBuilder';
import { buildWoods, WoodsResult } from './Woods';

export interface LevelData {
  cabin: CabinResult;
  fence: FenceResult;
  woods: WoodsResult;
  collisionBoxes: THREE.Box3[];
  ambientLight: THREE.AmbientLight;
  moonLight: THREE.DirectionalLight;
}

export function buildLevel(scene: THREE.Scene): LevelData {
  const cabin = buildCabin();
  const fence = buildFence();
  const woods = buildWoods();

  scene.add(cabin.group);
  scene.add(fence.group);
  scene.add(woods.group);

  // Ambient light (very dim moonlight)
  const ambientLight = new THREE.AmbientLight(0x111122, 0.55);
  scene.add(ambientLight);

  // Moonlight
  const moonLight = new THREE.DirectionalLight(0x4466aa, 0.8);
  moonLight.position.set(-20, 40, -10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(512, 512);
  moonLight.shadow.camera.left = -50;
  moonLight.shadow.camera.right = 50;
  moonLight.shadow.camera.top = 50;
  moonLight.shadow.camera.bottom = -50;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 100;
  scene.add(moonLight);

  // Combine collision boxes
  const collisionBoxes = [
    ...cabin.collisionBoxes,
    ...fence.collisionBoxes,
  ];

  return {
    cabin,
    fence,
    woods,
    collisionBoxes,
    ambientLight,
    moonLight,
  };
}
