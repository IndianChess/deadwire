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

  damageSegment(segmentIndex: number): void {
    const seg = this.segments[segmentIndex];
    if (!seg || seg.hp === 0) return;

    const remaining = seg.damage();
    eventBus.emit('fence:damaged', { segment: segmentIndex, hpRemaining: remaining });

    if (remaining === 0) {
      eventBus.emit('fence:destroyed', { segment: segmentIndex });
    }
  }

  isSegmentElectrified(segmentIndex: number): boolean {
    const seg = this.segments[segmentIndex];
    return seg ? seg.isElectrified : false;
  }

  isAnySegmentDestroyed(): boolean {
    return this.segments.some(s => s.hp === 0);
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
        if (seg.hp > 0 && seg.isElectrified) {
          const mat = seg.data.wires.material as THREE.LineBasicMaterial;
          mat.opacity = pulse;
        }
      }
    }
  }
}

import * as THREE from 'three';
