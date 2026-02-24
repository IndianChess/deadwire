import { GameSystem } from '../core/Engine';
import { CONST } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { Player } from '../entities/Player';

export class NoiseSystem implements GameSystem {
  private player: Player;
  currentLevel = 0;

  constructor(player: Player) {
    this.player = player;
  }

  fixedUpdate(dt: number): void {
    const playerNoise = this.player.noiseLevel;

    // Smoothly approach the target noise
    if (playerNoise > this.currentLevel) {
      this.currentLevel = Math.min(100, this.currentLevel + playerNoise * dt * 3);
    } else {
      this.currentLevel = Math.max(0, this.currentLevel - CONST.NOISE_DECAY * dt);
    }

    // Broadcast noise to monster AI
    if (this.currentLevel > 1) {
      eventBus.emit('player:noise', {
        level: this.currentLevel,
        position: this.player.getPosition(),
      });
    }
  }
}
