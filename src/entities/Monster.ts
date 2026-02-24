import * as THREE from 'three';
import { MonsterState } from '../types/enums';

export class Monster {
  mesh: THREE.Group;
  state = MonsterState.Roaming;
  position = new THREE.Vector3(40, 0, 40);
  aggressionLevel = 0;
  stateTimer = 0;

  private eyeLeft: THREE.Mesh;
  private eyeRight: THREE.Mesh;
  private eyeGlowIntensity = 0;

  constructor() {
    this.mesh = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 1.0,
      metalness: 0.0,
    });

    // Torso - tall and thin
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 1.2, 4, 8),
      bodyMat
    );
    torso.position.y = 1.6;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 6),
      bodyMat
    );
    head.position.y = 2.4;
    head.scale.set(1, 1.3, 0.9);
    head.castShadow = true;
    this.mesh.add(head);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xff1100,
      transparent: true,
      opacity: 0.9,
    });
    this.eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat.clone());
    this.eyeLeft.position.set(-0.08, 2.45, 0.15);
    this.mesh.add(this.eyeLeft);

    this.eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat.clone());
    this.eyeRight.position.set(0.08, 2.45, 0.15);
    this.mesh.add(this.eyeRight);

    // Arms - long and thin
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.03, 1.2, 4),
        bodyMat
      );
      arm.position.set(side * 0.3, 1.3, 0);
      arm.rotation.z = side * 0.15;
      arm.castShadow = true;
      this.mesh.add(arm);

      // Forearm
      const forearm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.02, 1.0, 4),
        bodyMat
      );
      forearm.position.set(side * 0.35, 0.6, 0.1);
      forearm.rotation.z = side * 0.1;
      forearm.rotation.x = -0.2;
      forearm.castShadow = true;
      this.mesh.add(forearm);
    }

    // Legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.04, 1.0, 4),
        bodyMat
      );
      leg.position.set(side * 0.12, 0.5, 0);
      leg.castShadow = true;
      this.mesh.add(leg);
    }

    this.mesh.position.copy(this.position);
  }

  updateMeshPosition(): void {
    this.mesh.position.set(this.position.x, 0, this.position.z);
  }

  faceDirection(dir: THREE.Vector3): void {
    if (dir.length() > 0.001) {
      const angle = Math.atan2(dir.x, dir.z);
      this.mesh.rotation.y = angle;
    }
  }

  updateVisuals(dt: number): void {
    // Eye glow pulsing
    this.eyeGlowIntensity += dt * 3;
    const pulse = 0.7 + Math.sin(this.eyeGlowIntensity) * 0.3;
    (this.eyeLeft.material as THREE.MeshBasicMaterial).opacity = pulse;
    (this.eyeRight.material as THREE.MeshBasicMaterial).opacity = pulse;

    // Bob slightly when moving
    if (this.state === MonsterState.Roaming ||
        this.state === MonsterState.Investigating ||
        this.state === MonsterState.Hunting) {
      const bob = Math.sin(performance.now() * 0.006) * 0.05;
      this.mesh.position.y = bob;
    }
  }
}
