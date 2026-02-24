import * as THREE from 'three';
import { FenceSegmentData } from '../world/FenceBuilder';

export class FenceSegment {
  isElectrified = true;
  segmentIndex: number;
  data: FenceSegmentData;

  private electrifiedColor = new THREE.Color(0x88aaff);
  private offColor = new THREE.Color(0x444444);

  constructor(segmentIndex: number, data: FenceSegmentData) {
    this.segmentIndex = segmentIndex;
    this.data = data;
  }

  setElectrified(on: boolean): void {
    this.isElectrified = on;
    this.updateVisuals();
  }

  updateVisuals(): void {
    const mat = this.data.wires.material as THREE.LineBasicMaterial;
    if (this.isElectrified) {
      mat.color.copy(this.electrifiedColor);
      mat.opacity = 1;
    } else {
      mat.color.copy(this.offColor);
      mat.opacity = 0.6;
    }
  }
}
