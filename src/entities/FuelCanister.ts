import * as THREE from 'three';

export class FuelCanister {
  mesh: THREE.Group;
  position: THREE.Vector3;
  collected = false;
  interactionRadius = 2;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
    this.mesh = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcc2200,
      roughness: 0.5,
      metalness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.2;
    body.castShadow = true;
    this.mesh.add(body);

    // Cap
    const capGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.08, 6);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.4,
      metalness: 0.6,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.44;
    this.mesh.add(cap);

    this.mesh.position.copy(this.position);

    // Subtle glow for visibility
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.15,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), glowMat);
    glow.position.y = 0.25;
    this.mesh.add(glow);
  }

  collect(): void {
    this.collected = true;
    this.mesh.visible = false;
  }
}
