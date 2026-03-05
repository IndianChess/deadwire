import * as THREE from 'three';
import { GameSystem } from '../core/Engine';
import { CONST } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { Player } from '../entities/Player';
import { Generator } from '../entities/Generator';
import { FuelCanister } from '../entities/FuelCanister';
import { PowerSystem } from './PowerSystem';
import { InputManager } from '../core/InputManager';

interface Interactable {
  position: THREE.Vector3;
  interactionRadius: number;
  getPrompt(): string | null;
  interact(): void;
}

export class InteractionSystem implements GameSystem {
  private player: Player;
  private input: InputManager;
  private interactables: Interactable[] = [];
  private currentPrompt: string | null = null;
  private currentInteractable: Interactable | null = null;
  private minigameActive = false;

  onRepairMinigame: (() => Promise<boolean>) | null = null;
  onCameraViewToggle: (() => void) | null = null;

  constructor(
    player: Player,
    input: InputManager,
    generator: Generator,
    powerSystem: PowerSystem,
    fuelCanisters: FuelCanister[],
    cameraMonitorPosition: THREE.Vector3 | null,
  ) {
    this.player = player;
    this.input = input;

    // Generator interaction
    this.interactables.push({
      position: generator.position,
      interactionRadius: generator.interactionRadius,
      getPrompt: () => generator.getPrompt(player.inventory.has('fuelCanister')),
      interact: () => {
        if (generator.state === 'Broken') {
          if (this.onRepairMinigame) {
            this.minigameActive = true;
            eventBus.emit('minigame:start', { type: 'repair' });
            this.onRepairMinigame().then(success => {
              this.minigameActive = false;
              eventBus.emit('minigame:end', { type: 'repair', success });
              if (success) {
                powerSystem.repairGenerator();
              }
            });
          }
        } else if (player.inventory.has('fuelCanister')) {
          player.inventory.delete('fuelCanister');
          powerSystem.refuel();
        } else if (generator.state === 'Off' && generator.fuel > 0) {
          powerSystem.startGenerator();
        }
      },
    });

    // Fuel canister interactions
    for (const canister of fuelCanisters) {
      this.interactables.push({
        position: canister.position,
        interactionRadius: canister.interactionRadius,
        getPrompt: () => {
          if (canister.collected) return null;
          if (this.player.inventory.has('fuelCanister')) return null;
          return '[E] Pick up Fuel Canister';
        },
        interact: () => {
          if (!canister.collected && !this.player.inventory.has('fuelCanister')) {
            canister.collect();
            this.player.inventory.add('fuelCanister');
            eventBus.emit('player:pickup', { item: 'fuelCanister' });
          }
        },
      });
    }

    // Camera monitor interaction
    if (cameraMonitorPosition) {
      this.interactables.push({
        position: cameraMonitorPosition,
        interactionRadius: 2,
        getPrompt: () => '[TAB] View Security Cameras',
        interact: () => {
          if (this.onCameraViewToggle) this.onCameraViewToggle();
        },
      });
    }
  }

  fixedUpdate(_dt: number): void {
    if (this.minigameActive) return;

    const playerPos = this.player.getPosition();
    let closestDist = Infinity;
    let closestInteractable: Interactable | null = null;
    let closestPrompt: string | null = null;

    for (const inter of this.interactables) {
      const dist = playerPos.distanceTo(inter.position);
      if (dist < inter.interactionRadius && dist < closestDist) {
        const prompt = inter.getPrompt();
        if (prompt) {
          closestDist = dist;
          closestInteractable = inter;
          closestPrompt = prompt;
        }
      }
    }

    if (closestPrompt !== this.currentPrompt) {
      this.currentPrompt = closestPrompt;
      this.currentInteractable = closestInteractable;
      if (closestPrompt) {
        eventBus.emit('interaction:available', { prompt: closestPrompt });
      } else {
        eventBus.emit('interaction:cleared', {});
      }
    }

    // Handle interaction input
    if (this.currentInteractable && this.currentPrompt) {
      // E key for general interactions
      if (this.input.wasFixedPressed('e')) {
        this.currentInteractable.interact();
      }
      // Tab key for camera view toggle
      if (this.input.wasFixedPressed('tab') && this.currentPrompt.includes('TAB')) {
        this.currentInteractable.interact();
      }
    }
  }
}
