import * as THREE from 'three';
import { GameSystem } from '../core/Engine';
import { eventBus } from '../core/EventBus';
import { FenceSegment } from '../entities/Fence';

export class FenceSystem implements GameSystem {
  segments: FenceSegment[];
  private isElectrified = true;

  constructor(segments: FenceSegment[]) {
    this.segments = segments;

    eventBus.on('fence:electrified-changed', ({ isElectrified }) => {
      this.isElectrified = isElectrified;
      for (const seg of this.segments) {
        seg.setElectrified(isElectrified);
      }
    });
  }

  isSegmentElectrified(segmentIndex: number): boolean {
    const seg = this.segments[segmentIndex];
    return seg ? seg.isElectrified : false;
  }

  getClosestSegmentIndex(x: number, z: number): number {
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < this.segments.length; i++) {
      const mid = this.segments[i].data.midpoint;
      const dx = x - mid.x;
      const dz = z - mid.z;
      const dist = dx * dx + dz * dz;
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  }

  fixedUpdate(_dt: number): void {
    // Visual update pulse for electrified wires
    if (this.isElectrified) {
      const pulse = 0.8 + Math.sin(performance.now() * 0.005) * 0.2;
      for (const seg of this.segments) {
        if (seg.isElectrified) {
          const mat = seg.data.wires.material as THREE.LineBasicMaterial;
          mat.opacity = pulse;
        }
      }
    }
  }
}
