import * as THREE from 'three';
import { GameSystem } from '../core/Engine';
import { CONST } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { MonsterState } from '../types/enums';

interface WaypointNode {
  position: THREE.Vector3;
  neighbors: number[];
}

export class MonsterAI implements GameSystem {
  monster: Monster;
  private player: Player;
  private waypoints: WaypointNode[] = [];
  private currentWaypointIdx = 0;
  private targetPosition = new THREE.Vector3();
  private lastKnownPlayerPos = new THREE.Vector3();
  private aggressionTimer = 0;
  private treePositions: THREE.Vector3[];
  private fuelSpawnPoints: THREE.Vector3[];
  private gatePosition: THREE.Vector3;
  private giveUpTimer = 0;

  // Pre-allocated temporaries for hot-path methods (zero allocations per frame)
  private _tmpDir = new THREE.Vector3();
  private _tmpToTree = new THREE.Vector3();
  private _tmpAvoid = new THREE.Vector3();
  private _tmpPlayerPos = new THREE.Vector3();
  private _tmpFenceTarget = new THREE.Vector3();
  private _tmpGateOutside = new THREE.Vector3();

  constructor(
    monster: Monster,
    player: Player,
    waypointPositions: THREE.Vector3[],
    treePositions: THREE.Vector3[],
    fuelSpawnPoints: THREE.Vector3[],
    gatePosition: THREE.Vector3,
  ) {
    this.monster = monster;
    this.player = player;
    this.treePositions = treePositions;
    this.fuelSpawnPoints = fuelSpawnPoints;
    this.gatePosition = gatePosition;

    // Build waypoint graph
    this.buildWaypointGraph(waypointPositions);

    // Start at a random far waypoint
    const farWaypoints = this.waypoints.filter(
      w => w.position.length() > 30
    );
    if (farWaypoints.length > 0) {
      const start = farWaypoints[Math.floor(Math.random() * farWaypoints.length)];
      this.monster.position.copy(start.position);
      this.monster.updateMeshPosition();
    }
    this.pickRandomWaypoint();

    // Listen for noise
    eventBus.on('player:noise', ({ level, position }) => {
      this.onPlayerNoise(level, position);
    });
  }

  private buildWaypointGraph(positions: THREE.Vector3[]): void {
    this.waypoints = positions.map(p => ({
      position: p.clone(),
      neighbors: [],
    }));

    // Connect nearby waypoints (within 25 units)
    const maxDist = 25;
    for (let i = 0; i < this.waypoints.length; i++) {
      const distances: Array<{ idx: number; dist: number }> = [];
      for (let j = 0; j < this.waypoints.length; j++) {
        if (i === j) continue;
        const d = this.waypoints[i].position.distanceTo(this.waypoints[j].position);
        if (d < maxDist) {
          distances.push({ idx: j, dist: d });
        }
      }
      distances.sort((a, b) => a.dist - b.dist);
      this.waypoints[i].neighbors = distances.slice(0, 5).map(d => d.idx);
    }

    // Ensure graph is connected
    for (let i = 0; i < this.waypoints.length; i++) {
      if (this.waypoints[i].neighbors.length === 0) {
        let minDist = Infinity;
        let nearest = 0;
        for (let j = 0; j < this.waypoints.length; j++) {
          if (i === j) continue;
          const d = this.waypoints[i].position.distanceTo(this.waypoints[j].position);
          if (d < minDist) {
            minDist = d;
            nearest = j;
          }
        }
        this.waypoints[i].neighbors.push(nearest);
        this.waypoints[nearest].neighbors.push(i);
      }
    }
  }

  private isInsidePerimeter(pos: THREE.Vector3): boolean {
    return Math.abs(pos.x) < CONST.FENCE_PERIMETER_HALF &&
      Math.abs(pos.z) < CONST.FENCE_PERIMETER_HALF;
  }

  private pickRandomWaypoint(): void {
    const aggBias = this.monster.aggressionLevel / 100;

    // Heavily bias toward fuel canister locations (makes venturing out dangerous)
    if (Math.random() < 0.5 + aggBias * 0.2) {
      const fuelWaypoints = this.waypoints.filter(w => {
        for (const sp of this.fuelSpawnPoints) {
          if (w.position.distanceTo(sp) < 12) return true;
        }
        return false;
      });
      if (fuelWaypoints.length > 0) {
        const wp = fuelWaypoints[Math.floor(Math.random() * fuelWaypoints.length)];
        this.targetPosition.copy(wp.position);
        return;
      }
    }

    // Otherwise pick any waypoint outside the fence
    const outsideWaypoints = this.waypoints.filter(
      w => !this.isInsidePerimeter(w.position)
    );
    if (outsideWaypoints.length > 0) {
      const wp = outsideWaypoints[Math.floor(Math.random() * outsideWaypoints.length)];
      this.currentWaypointIdx = this.waypoints.indexOf(wp);
      this.targetPosition.copy(wp.position);
    } else {
      const idx = Math.floor(Math.random() * this.waypoints.length);
      this.currentWaypointIdx = idx;
      this.targetPosition.copy(this.waypoints[idx].position);
    }
  }

  private onPlayerNoise(level: number, position: THREE.Vector3): void {
    // Only react if player is outside the fence
    if (this.isInsidePerimeter(position)) return;

    const distance = this.monster.position.distanceTo(position);
    const effectiveNoise = level / (1 + distance * 0.08);
    const threshold = CONST.MONSTER_NOISE_THRESHOLD_BASE -
      (this.monster.aggressionLevel * 0.1);

    if (effectiveNoise > Math.max(2, threshold)) {
      this.lastKnownPlayerPos.copy(position);

      if (this.monster.state === MonsterState.Roaming ||
        this.monster.state === MonsterState.Pacing ||
        this.monster.state === MonsterState.Stalking) {
        this.changeState(MonsterState.Investigating);
      } else if (this.monster.state === MonsterState.Investigating) {
        if (effectiveNoise > threshold * 2) {
          this.changeState(MonsterState.Hunting);
        }
      }
    }
  }

  private changeState(newState: MonsterState): void {
    const oldState = this.monster.state;
    if (oldState === newState) return;

    eventBus.emit('monster:state-changed', { from: oldState, to: newState });
    this.monster.state = newState;
    this.monster.stateTimer = 0;
  }

  private clampOutsidePerimeter(pos: THREE.Vector3): void {
    const H = CONST.FENCE_PERIMETER_HALF;
    const buffer = 2; // Stay at least 2 units outside the fence
    if (Math.abs(pos.x) < H + buffer && Math.abs(pos.z) < H + buffer) {
      // Push to nearest fence edge + buffer
      const distToXEdge = (H + buffer) - Math.abs(pos.x);
      const distToZEdge = (H + buffer) - Math.abs(pos.z);
      if (distToXEdge < distToZEdge) {
        pos.x = pos.x >= 0 ? H + buffer : -(H + buffer);
      } else {
        pos.z = pos.z >= 0 ? H + buffer : -(H + buffer);
      }
    }
  }

  /** Read player position into reusable temp vector (avoids clone allocation) */
  private readPlayerPos(): THREE.Vector3 {
    const pp = this.player.getPosition();
    this._tmpPlayerPos.copy(pp);
    return this._tmpPlayerPos;
  }

  fixedUpdate(dt: number): void {
    this.monster.stateTimer += dt;

    // Aggression escalation
    this.aggressionTimer += dt;
    if (this.aggressionTimer >= 10) {
      this.aggressionTimer -= 10;
      this.monster.aggressionLevel = Math.min(100, this.monster.aggressionLevel + CONST.MONSTER_AGGRESSION_RATE);
    }

    // Check if player is outside the fence
    const playerPos = this.readPlayerPos();
    const playerOutside = !this.isInsidePerimeter(playerPos);

    switch (this.monster.state) {
      case MonsterState.Roaming:
        this.updateRoaming(dt, playerOutside, playerPos);
        break;
      case MonsterState.Investigating:
        this.updateInvestigating(dt, playerOutside, playerPos);
        break;
      case MonsterState.Hunting:
        this.updateHunting(dt, playerOutside, playerPos);
        break;
      case MonsterState.Stalking:
        this.updateStalking(dt, playerOutside, playerPos);
        break;
      case MonsterState.Pacing:
        this.updatePacing(dt, playerOutside, playerPos);
        break;
    }

    // Always enforce: monster stays outside perimeter
    this.clampOutsidePerimeter(this.monster.position);

    this.monster.updateMeshPosition();
    this.monster.updateVisuals(dt);
  }

  private updateRoaming(dt: number, playerOutside: boolean, playerPos: THREE.Vector3): void {
    const arrived = this.moveToward(this.targetPosition, CONST.MONSTER_ROAM_SPEED, dt);
    if (arrived) {
      this.pickRandomWaypoint();
    }

    // If player is outside, detect and hunt
    if (playerOutside) {
      const distToPlayer = this.monster.position.distanceTo(playerPos);
      if (distToPlayer < 25) {
        this.lastKnownPlayerPos.copy(playerPos);
        this.changeState(MonsterState.Hunting);
        return;
      }
    }

    // Transition to stalking or pacing as aggression rises
    if (this.monster.aggressionLevel > 30 && this.monster.stateTimer > 15) {
      if (Math.random() < 0.02) {
        if (this.monster.aggressionLevel > 50 && Math.random() < 0.5) {
          this.changeState(MonsterState.Stalking);
        } else {
          this.changeState(MonsterState.Pacing);
        }
      }
    }
  }

  private updateInvestigating(dt: number, playerOutside: boolean, playerPos: THREE.Vector3): void {
    this.moveToward(this.lastKnownPlayerPos, CONST.MONSTER_INVESTIGATE_SPEED, dt);

    // Check line of sight to player (increased detection range)
    if (playerOutside) {
      const distToPlayer = this.monster.position.distanceTo(playerPos);
      if (distToPlayer < 25) {
        this.changeState(MonsterState.Hunting);
        this.lastKnownPlayerPos.copy(playerPos);
        return;
      }
    }

    if (this.monster.stateTimer > CONST.MONSTER_INVESTIGATE_TIMEOUT) {
      this.changeState(MonsterState.Roaming);
      this.pickRandomWaypoint();
    }
  }

  private updateHunting(dt: number, playerOutside: boolean, playerPos: THREE.Vector3): void {
    // If player made it back inside the fence, give up
    if (!playerOutside) {
      this.giveUpTimer += dt;
      if (this.giveUpTimer > 3) {
        // Frustrated delay, then back off
        this.giveUpTimer = 0;
        this.changeState(MonsterState.Pacing);
        return;
      }
      // Pace near the fence edge while waiting (reuse temp vector)
      const H = CONST.FENCE_PERIMETER_HALF;
      this._tmpFenceTarget.copy(this.lastKnownPlayerPos);
      // Clamp target to outside the fence
      if (Math.abs(this._tmpFenceTarget.x) < H + 3) {
        this._tmpFenceTarget.x = this._tmpFenceTarget.x >= 0 ? H + 3 : -(H + 3);
      }
      if (Math.abs(this._tmpFenceTarget.z) < H + 3) {
        this._tmpFenceTarget.z = this._tmpFenceTarget.z >= 0 ? H + 3 : -(H + 3);
      }
      this.moveToward(this._tmpFenceTarget, CONST.MONSTER_ROAM_SPEED, dt);
      return;
    }

    this.giveUpTimer = 0;

    // Track player position more frequently (every 0.5s instead of 2s)
    if (this.monster.stateTimer % 0.5 < dt) {
      this.lastKnownPlayerPos.copy(playerPos);
    }

    const speed = CONST.MONSTER_HUNT_SPEED *
      (1 + this.monster.aggressionLevel * 0.005);

    this.moveToward(this.lastKnownPlayerPos, speed, dt);

    // Attack player if close enough
    const distToPlayer = this.monster.position.distanceTo(playerPos);
    if (distToPlayer < CONST.MONSTER_PLAYER_ATTACK_RANGE) {
      this.attackPlayer();
    }

    // If lost the player for too long, go back to roaming
    if (this.monster.stateTimer > 30) {
      if (distToPlayer > 35) {
        this.changeState(MonsterState.Roaming);
        this.pickRandomWaypoint();
      }
    }
  }

  private updateStalking(dt: number, playerOutside: boolean, playerPos: THREE.Vector3): void {
    // Lurk near the south gate, waiting for the player to exit (reuse temp vector)
    this._tmpGateOutside.copy(this.gatePosition);
    this._tmpGateOutside.z += 5; // Stay just outside the gate
    this.moveToward(this._tmpGateOutside, CONST.MONSTER_ROAM_SPEED, dt);

    if (playerOutside) {
      const distToPlayer = this.monster.position.distanceTo(playerPos);
      if (distToPlayer < 25) {
        this.lastKnownPlayerPos.copy(playerPos);
        this.changeState(MonsterState.Hunting);
        return;
      }
    }

    // After stalking for a while, go back to roaming or pacing
    if (this.monster.stateTimer > 20) {
      if (Math.random() < 0.5) {
        this.changeState(MonsterState.Pacing);
      } else {
        this.changeState(MonsterState.Roaming);
        this.pickRandomWaypoint();
      }
    }
  }

  private updatePacing(dt: number, playerOutside: boolean, playerPos: THREE.Vector3): void {
    // Pace around the fence perimeter at a distance, creating tension
    const H = CONST.FENCE_PERIMETER_HALF;
    const paceRadius = H + 5;

    // Orbit around the perimeter
    const angle = (this.monster.stateTimer * 0.15) + (this.currentWaypointIdx * Math.PI / 4);
    const paceTarget = this._tmpDir; // reuse temp
    paceTarget.set(
      Math.cos(angle) * paceRadius,
      0,
      Math.sin(angle) * paceRadius
    );

    this.moveToward(paceTarget, CONST.MONSTER_ROAM_SPEED * 0.8, dt);

    // If player ventures outside, hunt them
    if (playerOutside) {
      const distToPlayer = this.monster.position.distanceTo(playerPos);
      if (distToPlayer < 25) {
        this.lastKnownPlayerPos.copy(playerPos);
        this.changeState(MonsterState.Hunting);
        return;
      }
    }

    // After pacing for a while, transition to another state
    if (this.monster.stateTimer > 25) {
      const roll = Math.random();
      if (this.monster.aggressionLevel > 50 && roll < 0.4) {
        this.changeState(MonsterState.Stalking);
      } else {
        this.changeState(MonsterState.Roaming);
        this.pickRandomWaypoint();
      }
    }
  }

  private attackPlayer(): void {
    this.player.takeDamage(CONST.MONSTER_PLAYER_DAMAGE);
    // Knockback (reuse temp vector)
    this._tmpDir.copy(this.player.getPosition())
      .sub(this.monster.position).normalize();
    this.player.camera.position.add(this._tmpDir.multiplyScalar(2));
  }

  private moveToward(target: THREE.Vector3, speed: number, dt: number): boolean {
    // Use pre-allocated temp vector instead of target.clone()
    const dir = this._tmpDir;
    dir.x = target.x - this.monster.position.x;
    dir.y = 0;
    dir.z = target.z - this.monster.position.z;
    const dist = dir.length();

    if (dist < 1) return true;

    dir.normalize();

    // Simple obstacle avoidance for trees with fast AABB rejection
    const mx = this.monster.position.x;
    const mz = this.monster.position.z;
    for (let i = 0, len = this.treePositions.length; i < len; i++) {
      const tree = this.treePositions[i];
      // Fast AABB rejection: skip trees far away on either axis
      const dx = tree.x - mx;
      const dz = tree.z - mz;
      if (dx > 3 || dx < -3 || dz > 3 || dz < -3) continue;

      const treeDistSq = dx * dx + dz * dz;
      if (treeDistSq < 2.25) { // 1.5 * 1.5
        const treeDist = Math.sqrt(treeDistSq);
        // Compute avoidance direction without clone()
        this._tmpAvoid.x = -dx;
        this._tmpAvoid.y = 0;
        this._tmpAvoid.z = -dz;
        this._tmpAvoid.normalize();
        dir.addScaledVector(this._tmpAvoid, 1.5 / treeDist);
        dir.normalize();
      }
    }

    this.monster.position.addScaledVector(dir, speed * dt);
    this.monster.position.y = 0;
    this.monster.faceDirection(dir);

    return false;
  }
}
