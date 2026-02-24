import * as THREE from 'three';
import { CONST } from '../core/Constants';
import { FenceSegmentData } from '../world/FenceBuilder';

export class FenceSegment {
  hp = CONST.FENCE_HP_MAX;
  isElectrified = true;
  segmentIndex: number;
  data: FenceSegmentData;

  private electrifiedColor = new THREE.Color(0x88aaff);
  private offColor = new THREE.Color(0x444444);
  private damagedColor = new THREE.Color(0xff4400);

  constructor(segmentIndex: number, data: FenceSegmentData) {
    this.segmentIndex = segmentIndex;
    this.data = data;
  }

  setElectrified(on: boolean): void {
    this.isElectrified = on && this.hp > 0;
    this.updateVisuals();
  }

  damage(): number {
    this.hp = Math.max(0, this.hp - 1);
    this.updateVisuals();
    if (this.hp === 0) {
      this.destroyVisuals();
    }
    return this.hp;
  }

  repair(): void {
    this.hp = CONST.FENCE_HP_MAX;
    this.restoreVisuals();
    this.updateVisuals();
  }

  updateVisuals(): void {
    const mat = this.data.wires.material as THREE.LineBasicMaterial;
    if (this.hp === 0) {
      mat.color.copy(this.damagedColor);
      mat.opacity = 0.3;
      return;
    }
    if (this.isElectrified) {
      mat.color.copy(this.electrifiedColor);
      mat.opacity = 1;
    } else {
      mat.color.copy(this.offColor);
      mat.opacity = 0.6;
    }

    // Damage visual
    if (this.hp === 1) {
      mat.color.lerp(this.damagedColor, 0.4);
    }
  }

  private destroyVisuals(): void {
    this.data.wires.visible = false;
    // Keep posts but tilt them
    for (const post of this.data.posts) {
      post.rotation.x = (Math.random() - 0.5) * 0.3;
      post.rotation.z = (Math.random() - 0.5) * 0.3;
    }
  }

  private restoreVisuals(): void {
    this.data.wires.visible = true;
    for (const post of this.data.posts) {
      post.rotation.x = 0;
      post.rotation.z = 0;
    }
  }
}
