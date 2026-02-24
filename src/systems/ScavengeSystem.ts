import * as THREE from 'three';
import { FuelCanister } from '../entities/FuelCanister';
import { CONST } from '../core/Constants';

export class ScavengeSystem {
  canisters: FuelCanister[] = [];

  constructor(scene: THREE.Scene, spawnPoints: THREE.Vector3[]) {
    // Randomly select which spawn points have canisters
    const indices = Array.from({ length: spawnPoints.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const activeIndices = indices.slice(0, CONST.FUEL_CANISTER_ACTIVE);

    for (const idx of activeIndices) {
      const canister = new FuelCanister(spawnPoints[idx]);
      this.canisters.push(canister);
      scene.add(canister.mesh);
    }
  }

  getActiveCanisters(): FuelCanister[] {
    return this.canisters.filter(c => !c.collected);
  }
}
