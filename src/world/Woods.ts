import * as THREE from 'three';
import { CONST } from '../core/Constants';

export interface WoodsResult {
  group: THREE.Group;
  treePositions: THREE.Vector3[];
  fuelSpawnPoints: THREE.Vector3[];
  monsterWaypoints: THREE.Vector3[];
}

function poissonDiskSample(
  radius: number,
  minDist: number,
  exclusionZones: Array<{ center: THREE.Vector2; radius: number }>,
  maxSamples: number,
  rng: () => number
): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil((radius * 2) / cellSize);
  const grid: (THREE.Vector2 | null)[][] = [];

  for (let i = 0; i < gridW; i++) {
    grid[i] = [];
    for (let j = 0; j < gridW; j++) {
      grid[i][j] = null;
    }
  }

  const toGrid = (p: THREE.Vector2) => ({
    x: Math.floor((p.x + radius) / cellSize),
    y: Math.floor((p.y + radius) / cellSize),
  });

  const isValid = (p: THREE.Vector2): boolean => {
    if (p.length() > radius) return false;
    for (const zone of exclusionZones) {
      if (p.distanceTo(zone.center) < zone.radius) return false;
    }
    const g = toGrid(p);
    if (g.x < 0 || g.x >= gridW || g.y < 0 || g.y >= gridW) return false;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const nx = g.x + dx;
        const ny = g.y + dy;
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridW && grid[nx][ny]) {
          if (p.distanceTo(grid[nx][ny]!) < minDist) return false;
        }
      }
    }
    return true;
  };

  // Seed point
  const initial = new THREE.Vector2(
    (rng() - 0.5) * radius,
    (rng() - 0.5) * radius
  );
  if (!isValid(initial)) return points;

  points.push(initial);
  const active = [initial];
  const ig = toGrid(initial);
  grid[ig.x][ig.y] = initial;

  while (active.length > 0 && points.length < maxSamples) {
    const idx = Math.floor(rng() * active.length);
    const point = active[idx];
    let found = false;

    for (let i = 0; i < 30; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = minDist + rng() * minDist;
      const newP = new THREE.Vector2(
        point.x + Math.cos(angle) * dist,
        point.y + Math.sin(angle) * dist
      );

      if (isValid(newP)) {
        points.push(newP);
        active.push(newP);
        const ng = toGrid(newP);
        grid[ng.x][ng.y] = newP;
        found = true;
        break;
      }
    }

    if (!found) active.splice(idx, 1);
  }

  return points;
}

export function buildWoods(): WoodsResult {
  const group = new THREE.Group();
  const rng = () => Math.random();

  // Ground plane
  const groundGeo = new THREE.CircleGeometry(CONST.WOODS_RADIUS, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1408,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Backyard ground (lighter, inside fence)
  const backyardGeo = new THREE.PlaneGeometry(
    CONST.FENCE_PERIMETER_HALF * 2,
    CONST.FENCE_PERIMETER_HALF * 2
  );
  const backyardMat = new THREE.MeshStandardMaterial({
    color: 0x1e2a10,
    roughness: 0.9,
    metalness: 0.0,
  });
  const backyard = new THREE.Mesh(backyardGeo, backyardMat);
  backyard.rotation.x = -Math.PI / 2;
  backyard.position.y = 0.01;
  backyard.receiveShadow = true;
  group.add(backyard);

  // Generate tree positions using Poisson disk sampling
  const fenceHalf = CONST.FENCE_PERIMETER_HALF;
  const exclusionZones = [
    { center: new THREE.Vector2(0, 0), radius: fenceHalf + 3 }, // fence area + buffer
  ];

  const treePoints = poissonDiskSample(
    CONST.WOODS_RADIUS - 5,
    CONST.TREE_MIN_RADIUS,
    exclusionZones,
    CONST.TREE_COUNT,
    rng
  );

  // Create instanced meshes for trees
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 4, 6);
  const canopyGeo = new THREE.ConeGeometry(2, 4, 6);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3d2a1a,
    roughness: 0.9,
    metalness: 0.0,
  });

  const canopyColors = [0x1a3a0a, 0x163008, 0x1e4210];

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treePoints.length);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;

  const canopyMeshes: THREE.InstancedMesh[] = [];
  for (const color of canopyColors) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.0,
    });
    const mesh = new THREE.InstancedMesh(canopyGeo, mat, Math.ceil(treePoints.length / canopyColors.length));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    canopyMeshes.push(mesh);
  }

  const treePositions: THREE.Vector3[] = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < treePoints.length; i++) {
    const p = treePoints[i];
    const trunkHeight = 3 + rng() * 3;
    const canopyRadius = 1.5 + rng() * 1.5;
    const canopyHeight = 3 + rng() * 2;

    // Trunk
    dummy.position.set(p.x, trunkHeight / 2, p.y);
    dummy.scale.set(1, trunkHeight / 4, 1);
    dummy.rotation.y = rng() * Math.PI;
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    // Canopy
    const canopyIdx = i % canopyColors.length;
    const mesh = canopyMeshes[canopyIdx];
    dummy.position.set(p.x, trunkHeight + canopyHeight / 2 - 0.5, p.y);
    dummy.scale.set(canopyRadius / 2, canopyHeight / 4, canopyRadius / 2);
    dummy.rotation.y = rng() * Math.PI;
    dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count, dummy.matrix);
    mesh.count++;

    treePositions.push(new THREE.Vector3(p.x, 0, p.y));
  }

  trunkMesh.instanceMatrix.needsUpdate = true;
  group.add(trunkMesh);
  for (const mesh of canopyMeshes) {
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  // Fuel canister spawn points (scattered in woods)
  const fuelSpawnPoints: THREE.Vector3[] = [
    new THREE.Vector3(35, 0, 0),
    new THREE.Vector3(-30, 0, 25),
    new THREE.Vector3(0, 0, -40),
    new THREE.Vector3(-35, 0, -20),
    new THREE.Vector3(25, 0, 35),
  ];

  // Monster waypoints
  const monsterWaypoints: THREE.Vector3[] = [];

  // Near fence perimeter (8 points)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = fenceHalf + 5;
    monsterWaypoints.push(new THREE.Vector3(
      Math.cos(angle) * r,
      0,
      Math.sin(angle) * r
    ));
  }

  // Mid-range woods (8 points)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = 35 + rng() * 15;
    monsterWaypoints.push(new THREE.Vector3(
      Math.cos(angle) * r,
      0,
      Math.sin(angle) * r
    ));
  }

  // Near fuel locations (5 points)
  for (const sp of fuelSpawnPoints) {
    monsterWaypoints.push(sp.clone().add(new THREE.Vector3(
      (rng() - 0.5) * 8,
      0,
      (rng() - 0.5) * 8
    )));
  }

  return { group, treePositions, fuelSpawnPoints, monsterWaypoints };
}
