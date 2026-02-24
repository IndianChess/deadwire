import * as THREE from 'three';
import { GameSystem } from '../core/Engine';
import { CONST } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { FenceSystem } from './FenceSystem';
import { MonsterState } from '../types/enums';

interface WaypointNode {
  position: THREE.Vector3;
  neighbors: number[];
}

export class MonsterAI implements GameSystem {
  monster: Monster;
  private player: Player;
  private fenceSystem: FenceSystem;
  private waypoints: WaypointNode[] = [];
  private currentWaypointIdx = 0;
  private targetPosition = new THREE.Vector3();
  private lastKnownPlayerPos = new THREE.Vector3();
  private attackCooldown = 0;
  private aggressionTimer = 0;
  private isInsidePerimeter = false;
  private treePositions: THREE.Vector3[];
  private isPowerOn = true;

  constructor(
    monster: Monster,
    player: Player,
    fenceSystem: FenceSystem,
    waypointPositions: THREE.Vector3[],
    treePositions: THREE.Vector3[],
  ) {
    this.monster = monster;
    this.player = player;
    this.fenceSystem = fenceSystem;
    this.treePositions = treePositions;

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

    eventBus.on('generator:power-toggle', ({ isOn }) => {
      this.isPowerOn = isOn;
    });
  }

  private buildWaypointGraph(positions: THREE.Vector3[]): void {
    // Create nodes
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
      // Sort by distance, connect to closest 3-5
      distances.sort((a, b) => a.dist - b.dist);
      this.waypoints[i].neighbors = distances.slice(0, 5).map(d => d.idx);
    }

    // Ensure graph is connected (connect isolated nodes to nearest)
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

  private pickRandomWaypoint(): void {
    const aggBias = this.monster.aggressionLevel / 100;
    // Bias toward fence waypoints as aggression increases
    if (Math.random() < aggBias * 0.6) {
      // Pick waypoint near fence
      const fenceWaypoints = this.waypoints.filter(
        w => {
          const d = Math.max(
            Math.abs(w.position.x) - CONST.FENCE_PERIMETER_HALF,
            Math.abs(w.position.z) - CONST.FENCE_PERIMETER_HALF
          );
          return d > -5 && d < 10;
        }
      );
      if (fenceWaypoints.length > 0) {
        const wp = fenceWaypoints[Math.floor(Math.random() * fenceWaypoints.length)];
        this.targetPosition.copy(wp.position);
        return;
      }
    }

    const idx = Math.floor(Math.random() * this.waypoints.length);
    this.currentWaypointIdx = idx;
    this.targetPosition.copy(this.waypoints[idx].position);
  }

  private findPathTo(target: THREE.Vector3): THREE.Vector3[] {
    // A* on waypoint graph
    const startIdx = this.findNearestWaypoint(this.monster.position);
    const endIdx = this.findNearestWaypoint(target);

    if (startIdx === endIdx) return [target];

    const openSet = new Set([startIdx]);
    const cameFrom = new Map<number, number>();
    const gScore = new Map<number, number>();
    const fScore = new Map<number, number>();

    gScore.set(startIdx, 0);
    fScore.set(startIdx, this.waypoints[startIdx].position.distanceTo(this.waypoints[endIdx].position));

    while (openSet.size > 0) {
      let current = -1;
      let minF = Infinity;
      for (const idx of openSet) {
        const f = fScore.get(idx) ?? Infinity;
        if (f < minF) {
          minF = f;
          current = idx;
        }
      }

      if (current === endIdx) {
        // Reconstruct path
        const path: THREE.Vector3[] = [target];
        let c = current;
        while (cameFrom.has(c)) {
          path.unshift(this.waypoints[c].position.clone());
          c = cameFrom.get(c)!;
        }
        return path;
      }

      openSet.delete(current);

      for (const neighbor of this.waypoints[current].neighbors) {
        const tentG = (gScore.get(current) ?? Infinity) +
          this.waypoints[current].position.distanceTo(this.waypoints[neighbor].position);

        if (tentG < (gScore.get(neighbor) ?? Infinity)) {
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, tentG);
          fScore.set(neighbor, tentG +
            this.waypoints[neighbor].position.distanceTo(this.waypoints[endIdx].position));
          openSet.add(neighbor);
        }
      }
    }

    // No path found, go direct
    return [target];
  }

  private findNearestWaypoint(pos: THREE.Vector3): number {
    let minDist = Infinity;
    let nearest = 0;
    for (let i = 0; i < this.waypoints.length; i++) {
      const d = pos.distanceTo(this.waypoints[i].position);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return nearest;
  }

  private onPlayerNoise(level: number, position: THREE.Vector3): void {
    const distance = this.monster.position.distanceTo(position);
    const effectiveNoise = level / (1 + distance * 0.08);
    const threshold = CONST.MONSTER_NOISE_THRESHOLD_BASE -
      (this.monster.aggressionLevel * 0.1);

    if (effectiveNoise > Math.max(2, threshold)) {
      this.lastKnownPlayerPos.copy(position);

      if (this.monster.state === MonsterState.Roaming) {
        this.changeState(MonsterState.Investigating);
      } else if (this.monster.state === MonsterState.Investigating) {
        // Escalate to hunting if noise is strong
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

  fixedUpdate(dt: number): void {
    this.monster.stateTimer += dt;

    // Aggression escalation
    this.aggressionTimer += dt;
    if (this.aggressionTimer >= 10) {
      this.aggressionTimer -= 10;
      this.monster.aggressionLevel = Math.min(100, this.monster.aggressionLevel + CONST.MONSTER_AGGRESSION_RATE);
    }

    // Check if inside perimeter
    const mPos = this.monster.position;
    this.isInsidePerimeter =
      Math.abs(mPos.x) < CONST.FENCE_PERIMETER_HALF &&
      Math.abs(mPos.z) < CONST.FENCE_PERIMETER_HALF;

    switch (this.monster.state) {
      case MonsterState.Roaming:
        this.updateRoaming(dt);
        break;
      case MonsterState.Investigating:
        this.updateInvestigating(dt);
        break;
      case MonsterState.Hunting:
        this.updateHunting(dt);
        break;
      case MonsterState.Attacking:
        this.updateAttacking(dt);
        break;
      case MonsterState.Retreating:
        this.updateRetreating(dt);
        break;
    }

    this.monster.updateMeshPosition();
    this.monster.updateVisuals(dt);
  }

  private updateRoaming(dt: number): void {
    const arrived = this.moveToward(this.targetPosition, CONST.MONSTER_ROAM_SPEED, dt);
    if (arrived) {
      this.pickRandomWaypoint();
    }

    // Periodically check fence (siege behavior)
    if (this.monster.aggressionLevel > 30 && this.monster.stateTimer > 20) {
      if (Math.random() < 0.01) {
        this.changeState(MonsterState.Hunting);
        this.targetPosition.set(0, 0, 0); // Head toward cabin
      }
    }
  }

  private updateInvestigating(dt: number): void {
    const arrived = this.moveToward(this.lastKnownPlayerPos, CONST.MONSTER_INVESTIGATE_SPEED, dt);

    // Check line of sight to player
    const toPlayer = this.player.getPosition().clone().sub(this.monster.position);
    const distToPlayer = toPlayer.length();
    if (distToPlayer < 15) {
      this.changeState(MonsterState.Hunting);
      this.lastKnownPlayerPos.copy(this.player.getPosition());
      return;
    }

    if (arrived || this.monster.stateTimer > CONST.MONSTER_INVESTIGATE_TIMEOUT) {
      this.changeState(MonsterState.Roaming);
      this.pickRandomWaypoint();
    }
  }

  private updateHunting(dt: number): void {
    // Update last known player position periodically
    if (this.monster.stateTimer % 2 < dt) {
      this.lastKnownPlayerPos.copy(this.player.getPosition());
    }

    const speed = CONST.MONSTER_HUNT_SPEED *
      (1 + this.monster.aggressionLevel * 0.003);

    // If at fence and fence is electrified, attack fence
    const distToFence = Math.max(
      Math.abs(this.monster.position.x) - CONST.FENCE_PERIMETER_HALF,
      Math.abs(this.monster.position.z) - CONST.FENCE_PERIMETER_HALF
    );

    if (!this.isInsidePerimeter && distToFence < 2) {
      const segIdx = this.fenceSystem.getClosestSegmentIndex(
        this.monster.position.x,
        this.monster.position.z
      );

      if (this.fenceSystem.isSegmentElectrified(segIdx)) {
        // Attack the fence
        this.changeState(MonsterState.Attacking);
        return;
      } else if (this.fenceSystem.segments[segIdx].hp === 0 || !this.isPowerOn) {
        // Fence is down, enter
        this.isInsidePerimeter = true;
        eventBus.emit('monster:entered-perimeter', {});
      }
    }

    // If inside perimeter or fence is down, go straight to player
    if (this.isInsidePerimeter) {
      this.moveToward(this.player.getPosition(), speed, dt);

      const distToPlayer = this.monster.position.distanceTo(this.player.getPosition());
      if (distToPlayer < CONST.MONSTER_PLAYER_ATTACK_RANGE) {
        this.attackPlayer();
      }
    } else {
      // Navigate toward fence
      this.moveToward(this.lastKnownPlayerPos, speed, dt);
    }
  }

  private updateAttacking(dt: number): void {
    this.attackCooldown -= dt;

    if (this.attackCooldown <= 0) {
      this.attackCooldown = CONST.MONSTER_ATTACK_COOLDOWN;

      const segIdx = this.fenceSystem.getClosestSegmentIndex(
        this.monster.position.x,
        this.monster.position.z
      );

      if (this.fenceSystem.isSegmentElectrified(segIdx)) {
        // Takes shock, damages fence
        this.fenceSystem.damageSegment(segIdx);
        eventBus.emit('monster:attack-fence', { segment: segIdx });

        // If aggression < 75, retreat after attacking electrified fence
        if (this.monster.aggressionLevel < 75) {
          this.changeState(MonsterState.Retreating);
          return;
        }
      } else {
        // Fence not electrified, just smash through
        this.fenceSystem.damageSegment(segIdx);
        eventBus.emit('monster:attack-fence', { segment: segIdx });

        if (this.fenceSystem.segments[segIdx].hp === 0) {
          this.changeState(MonsterState.Hunting);
          return;
        }
      }
    }

    // If inside perimeter now, hunt player
    if (this.fenceSystem.isAnySegmentDestroyed()) {
      this.isInsidePerimeter = true;
      this.changeState(MonsterState.Hunting);
      eventBus.emit('monster:entered-perimeter', {});
    }
  }

  private updateRetreating(dt: number): void {
    if (this.monster.stateTimer < 1) {
      // Move away from fence
      const retreatDir = this.monster.position.clone().normalize();
      if (retreatDir.length() < 0.1) retreatDir.set(1, 0, 0);
      const retreatTarget = this.monster.position.clone()
        .add(retreatDir.multiplyScalar(15));
      this.moveToward(retreatTarget, CONST.MONSTER_HUNT_SPEED, dt);
    } else {
      // Find a far waypoint and go there
      const arrived = this.moveToward(this.targetPosition, CONST.MONSTER_ROAM_SPEED, dt);
      if (arrived || this.monster.stateTimer > CONST.MONSTER_RETREAT_DURATION) {
        this.changeState(MonsterState.Roaming);
        this.pickRandomWaypoint();
      }
    }

    if (this.monster.stateTimer > CONST.MONSTER_RETREAT_DURATION) {
      this.changeState(MonsterState.Roaming);
      this.pickRandomWaypoint();
    }
  }

  private attackPlayer(): void {
    this.player.takeDamage(CONST.MONSTER_PLAYER_DAMAGE);
    // Knockback
    const pushDir = this.player.getPosition().clone()
      .sub(this.monster.position).normalize();
    this.player.camera.position.add(pushDir.multiplyScalar(2));
    this.attackCooldown = CONST.MONSTER_ATTACK_COOLDOWN;
  }

  private moveToward(target: THREE.Vector3, speed: number, dt: number): boolean {
    const dir = target.clone().sub(this.monster.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist < 1) return true;

    dir.normalize();

    // Simple obstacle avoidance for trees
    for (const tree of this.treePositions) {
      const toTree = tree.clone().sub(this.monster.position);
      toTree.y = 0;
      const treeDist = toTree.length();
      if (treeDist < 1.5) {
        const avoid = this.monster.position.clone().sub(tree).normalize();
        dir.add(avoid.multiplyScalar(1.5 / treeDist));
        dir.normalize();
      }
    }

    this.monster.position.add(dir.multiplyScalar(speed * dt));
    this.monster.position.y = 0;
    this.monster.faceDirection(dir);

    return false;
  }
}
