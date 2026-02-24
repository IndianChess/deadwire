import * as THREE from 'three';
import { CONST } from '../core/Constants';

export class SecurityCamera {
  camera: THREE.PerspectiveCamera;
  renderTarget: THREE.WebGLRenderTarget;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  staticLevel = 0;
  mesh: THREE.Group;

  constructor(position: THREE.Vector3, lookDirection: THREE.Vector3, id: number) {
    this.position = position.clone();
    this.lookAt = position.clone().add(lookDirection);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.5, 80);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookAt);

    this.renderTarget = new THREE.WebGLRenderTarget(
      CONST.CAMERA_RESOLUTION,
      CONST.CAMERA_RESOLUTION,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }
    );

    // Camera mesh (small box on fence post)
    this.mesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.6,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.2), bodyMat);
    this.mesh.add(body);

    // Lens
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.8,
    });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 6), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.12;
    this.mesh.add(lens);

    // LED indicator
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), ledMat);
    led.position.set(0.06, 0.04, 0);
    this.mesh.add(led);

    this.mesh.position.copy(this.position);
    this.mesh.lookAt(this.lookAt);
  }
}
