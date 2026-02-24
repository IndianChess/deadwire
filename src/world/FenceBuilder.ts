import * as THREE from 'three';
import { CONST } from '../core/Constants';

export interface FenceSegmentData {
  group: THREE.Group;
  posts: THREE.Mesh[];
  wires: THREE.LineSegments;
  collisionBox: THREE.Box3;
  midpoint: THREE.Vector3;
  normal: THREE.Vector3; // outward-facing normal
}

export interface FenceResult {
  group: THREE.Group;
  segments: FenceSegmentData[];
  collisionBoxes: THREE.Box3[];
  gatePosition: THREE.Vector3;
}

export function buildFence(): FenceResult {
  const group = new THREE.Group();
  const H = CONST.FENCE_PERIMETER_HALF;
  const FH = CONST.FENCE_HEIGHT;
  const spacing = CONST.FENCE_POST_SPACING;
  const segments: FenceSegmentData[] = [];
  const allBoxes: THREE.Box3[] = [];

  const postMat = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.6,
    metalness: 0.5,
  });

  const wireMat = new THREE.LineBasicMaterial({ color: 0x88aaff });

  // 4 segments: North, East, South, West
  const segmentDefs: Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    normal: THREE.Vector3;
    hasGate: boolean;
  }> = [
    { start: new THREE.Vector3(-H, 0, -H), end: new THREE.Vector3(H, 0, -H), normal: new THREE.Vector3(0, 0, -1), hasGate: false },
    { start: new THREE.Vector3(H, 0, -H), end: new THREE.Vector3(H, 0, H), normal: new THREE.Vector3(1, 0, 0), hasGate: false },
    { start: new THREE.Vector3(H, 0, H), end: new THREE.Vector3(-H, 0, H), normal: new THREE.Vector3(0, 0, 1), hasGate: true },
    { start: new THREE.Vector3(-H, 0, H), end: new THREE.Vector3(-H, 0, -H), normal: new THREE.Vector3(-1, 0, 0), hasGate: false },
  ];

  let gatePos = new THREE.Vector3(0, 0, H);

  for (const def of segmentDefs) {
    const segGroup = new THREE.Group();
    const dir = def.end.clone().sub(def.start);
    const length = dir.length();
    dir.normalize();
    const numPosts = Math.floor(length / spacing) + 1;
    const posts: THREE.Mesh[] = [];
    const wirePositions: number[] = [];

    for (let i = 0; i < numPosts; i++) {
      const t = i / (numPosts - 1);
      const pos = def.start.clone().lerp(def.end, t);

      // Skip middle posts for gate
      if (def.hasGate) {
        const mid = 0.5;
        const gateHalfWidth = 1.5 / length;
        if (Math.abs(t - mid) < gateHalfWidth) continue;
      }

      const postGeo = new THREE.CylinderGeometry(0.05, 0.05, FH, 4);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, FH / 2, pos.z);
      post.castShadow = true;
      segGroup.add(post);
      posts.push(post);
    }

    // Wires between consecutive posts
    const wireRows = 5;
    for (let p = 0; p < posts.length - 1; p++) {
      const p1 = posts[p].position;
      const p2 = posts[p + 1].position;
      for (let row = 0; row < wireRows; row++) {
        const y = 0.3 + (row / (wireRows - 1)) * (FH - 0.6);
        wirePositions.push(p1.x, y, p1.z, p2.x, y, p2.z);
      }
    }

    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));
    const wires = new THREE.LineSegments(wireGeo, wireMat.clone());
    segGroup.add(wires);

    // Collision box for the segment
    const midpoint = def.start.clone().add(def.end).multiplyScalar(0.5);
    midpoint.y = FH / 2;

    const boxMin = new THREE.Vector3(
      Math.min(def.start.x, def.end.x) - 0.3,
      0,
      Math.min(def.start.z, def.end.z) - 0.3
    );
    const boxMax = new THREE.Vector3(
      Math.max(def.start.x, def.end.x) + 0.3,
      FH,
      Math.max(def.start.z, def.end.z) + 0.3
    );

    // Gate gap in collision
    if (def.hasGate) {
      // Create two collision boxes with gap
      const gapMin = -1.5;
      const gapMax = 1.5;
      const leftBox = new THREE.Box3(
        boxMin.clone(),
        new THREE.Vector3(gapMin, FH, boxMax.z)
      );
      const rightBox = new THREE.Box3(
        new THREE.Vector3(gapMax, 0, boxMin.z),
        boxMax.clone()
      );
      allBoxes.push(leftBox, rightBox);
    } else {
      const box = new THREE.Box3(boxMin, boxMax);
      allBoxes.push(box);
    }

    group.add(segGroup);

    segments.push({
      group: segGroup,
      posts,
      wires,
      collisionBox: new THREE.Box3(boxMin, boxMax),
      midpoint: midpoint.clone(),
      normal: def.normal,
    });
  }

  return {
    group,
    segments,
    collisionBoxes: allBoxes,
    gatePosition: gatePos,
  };
}
