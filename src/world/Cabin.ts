import * as THREE from 'three';
import { CONST } from '../core/Constants';

export interface CabinResult {
  group: THREE.Group;
  collisionBoxes: THREE.Box3[];
  cabinLight: THREE.PointLight;
  monitorPosition: THREE.Vector3;
  generatorPosition: THREE.Vector3;
}

export function buildCabin(): CabinResult {
  const group = new THREE.Group();
  const boxes: THREE.Box3[] = [];
  const W = CONST.CABIN_WIDTH;
  const D = CONST.CABIN_DEPTH;
  const H = CONST.CABIN_HEIGHT;
  const T = CONST.CABIN_WALL_THICKNESS;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3d2b1f,
    roughness: 0.85,
    metalness: 0.05,
  });

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2a1f14,
    roughness: 0.9,
    metalness: 0.0,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x4a3828,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), floorMat);
  floor.position.set(0, -T / 2, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), ceilingMat);
  ceiling.position.set(0, H + T / 2, 0);
  group.add(ceiling);

  // Back wall (North)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), wallMat);
  backWall.position.set(0, H / 2, -D / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);
  boxes.push(new THREE.Box3().setFromObject(backWall));

  // Left wall (West)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(T, H, D), wallMat);
  leftWall.position.set(-W / 2, H / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);
  boxes.push(new THREE.Box3().setFromObject(leftWall));

  // Right wall (East)
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(T, H, D), wallMat);
  rightWall.position.set(W / 2, H / 2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);
  boxes.push(new THREE.Box3().setFromObject(rightWall));

  // Front wall with door gap (South) - two sections
  const doorWidth = 1.2;
  const sideWidth = (W - doorWidth) / 2;

  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, H, T), wallMat);
  frontLeft.position.set(-doorWidth / 2 - sideWidth / 2, H / 2, D / 2);
  frontLeft.castShadow = true;
  frontLeft.receiveShadow = true;
  group.add(frontLeft);
  boxes.push(new THREE.Box3().setFromObject(frontLeft));

  const frontRight = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, H, T), wallMat);
  frontRight.position.set(doorWidth / 2 + sideWidth / 2, H / 2, D / 2);
  frontRight.castShadow = true;
  frontRight.receiveShadow = true;
  group.add(frontRight);
  boxes.push(new THREE.Box3().setFromObject(frontRight));

  // Door header
  const headerHeight = 0.8;
  const header = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, headerHeight, T), wallMat);
  header.position.set(0, H - headerHeight / 2, D / 2);
  group.add(header);

  // Window on back wall (just a visual cut - lighter panel)
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x112233,
    roughness: 0.3,
    metalness: 0.7,
    transparent: true,
    opacity: 0.4,
  });
  const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), windowMat);
  windowPane.position.set(2, 1.6, -D / 2 + T / 2 + 0.01);
  group.add(windowPane);

  // Table for monitor
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.8 });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.8), tableMat);
  tableTop.position.set(-2.5, 0.75, -D / 2 + 0.6);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  group.add(tableTop);

  // Table legs
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 4);
  for (const [lx, lz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) {
    const leg = new THREE.Mesh(legGeo, tableMat);
    leg.position.set(-2.5 + lx, 0.375, -D / 2 + 0.6 + lz);
    group.add(leg);
  }

  // Cabin interior light
  const cabinLight = new THREE.PointLight(0xffaa55, 1.5, 12, 2);
  cabinLight.position.set(0, H - 0.3, 0);
  cabinLight.castShadow = true;
  cabinLight.shadow.mapSize.set(256, 256);
  group.add(cabinLight);

  // Monitor position (on table)
  const monitorPosition = new THREE.Vector3(-2.5, 0.75 + 0.2, -D / 2 + 0.6);

  // Generator position (right side of back wall)
  const generatorPosition = new THREE.Vector3(2.5, 0, -D / 2 + 0.8);

  return { group, collisionBoxes: boxes, cabinLight, monitorPosition, generatorPosition };
}
