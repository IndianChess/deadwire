import * as THREE from 'three';
import { CONST } from '../core/Constants';
import { GeneratorState } from '../types/enums';

export class Generator {
  mesh: THREE.Group;
  fuel = CONST.GENERATOR_FUEL_MAX;
  state = GeneratorState.Running;
  position: THREE.Vector3;
  interactionRadius = CONST.INTERACTION_RANGE;
  breakdownTimer = 0;
  nextBreakdownTime: number;

  private fuelGaugeMesh: THREE.Mesh;
  private fuelGaugeMat: THREE.MeshStandardMaterial;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
    this.mesh = new THREE.Group();

    // Main body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.6,
      metalness: 0.5,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.3;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // Exhaust pipe
    const pipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, metalness: 0.6 });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.set(0.3, 0.7, 0);
    pipe.castShadow = true;
    this.mesh.add(pipe);

    // Fuel gauge (bar on side)
    this.fuelGaugeMat = new THREE.MeshStandardMaterial({
      color: 0x00ff44,
      emissive: 0x00ff44,
      emissiveIntensity: 0.3,
    });
    const gaugeGeo = new THREE.BoxGeometry(0.05, 0.4, 0.3);
    this.fuelGaugeMesh = new THREE.Mesh(gaugeGeo, this.fuelGaugeMat);
    this.fuelGaugeMesh.position.set(-0.43, 0.3, 0);
    this.mesh.add(this.fuelGaugeMesh);

    this.mesh.position.copy(this.position);

    // Random first breakdown time
    this.nextBreakdownTime = CONST.GENERATOR_BREAKDOWN_MIN +
      Math.random() * (CONST.GENERATOR_BREAKDOWN_MAX - CONST.GENERATOR_BREAKDOWN_MIN);
  }

  updateVisuals(): void {
    const fuelFraction = this.fuel / CONST.GENERATOR_FUEL_MAX;

    // Scale gauge
    this.fuelGaugeMesh.scale.y = Math.max(0.01, fuelFraction);
    this.fuelGaugeMesh.position.y = 0.1 + fuelFraction * 0.2;

    // Color: green -> yellow -> red
    if (fuelFraction > 0.5) {
      this.fuelGaugeMat.color.setHex(0x00ff44);
      this.fuelGaugeMat.emissive.setHex(0x00ff44);
    } else if (fuelFraction > 0.2) {
      this.fuelGaugeMat.color.setHex(0xffaa00);
      this.fuelGaugeMat.emissive.setHex(0xffaa00);
    } else {
      this.fuelGaugeMat.color.setHex(0xff2200);
      this.fuelGaugeMat.emissive.setHex(0xff2200);
    }

    if (this.state !== GeneratorState.Running) {
      this.fuelGaugeMat.emissiveIntensity = 0.1;
    } else {
      this.fuelGaugeMat.emissiveIntensity = 0.3;
    }
  }

  getPrompt(hasCanister: boolean): string | null {
    switch (this.state) {
      case GeneratorState.Running:
        return hasCanister ? '[E] Refuel Generator' : null;
      case GeneratorState.Off:
        if (hasCanister) return '[E] Refuel Generator';
        return this.fuel > 0 ? '[E] Start Generator' : null;
      case GeneratorState.Broken:
        return '[E] Repair Generator';
      default:
        return null;
    }
  }
}
