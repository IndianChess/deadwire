import { eventBus } from '../core/EventBus';
import { Player } from '../entities/Player';
import { CONST } from '../core/Constants';
import { NoiseSystem } from '../systems/NoiseSystem';
import { GameState } from '../types/enums';

export class HUD {
  private container: HTMLDivElement;
  private staminaBar: HTMLDivElement;
  private staminaFill: HTMLDivElement;
  private flashlightIndicator: HTMLDivElement;
  private noiseMeter: HTMLDivElement;
  private noiseFill: HTMLDivElement;
  private interactionPrompt: HTMLDivElement;
  private timerDisplay: HTMLDivElement;
  private hpDisplay: HTMLDivElement;
  private inventoryDisplay: HTMLDivElement;
  private damageOverlay: HTMLDivElement;
  private crosshair: HTMLDivElement;

  private player: Player;
  private noiseSystem: NoiseSystem;
  private surviveTime = CONST.SURVIVE_TIME;
  private visible = false;

  constructor(player: Player, noiseSystem: NoiseSystem) {
    this.player = player;
    this.noiseSystem = noiseSystem;

    this.container = document.createElement('div');
    this.container.id = 'hud';
    this.container.innerHTML = `
      <style>
        #hud {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          font-family: 'Courier New', monospace;
          color: #88ff88;
          text-shadow: 0 0 4px #44aa44;
          z-index: 100;
          display: none;
        }
        #hud * { pointer-events: none; }
        .hud-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
          opacity: 0.7;
          margin-bottom: 2px;
        }
        #hud-stamina {
          position: absolute;
          bottom: 30px;
          left: 20px;
          width: 200px;
          transition: opacity 0.3s;
        }
        #hud-stamina-bar {
          width: 100%;
          height: 6px;
          background: rgba(30, 60, 30, 0.5);
          border: 1px solid rgba(136, 255, 136, 0.3);
        }
        #hud-stamina-fill {
          height: 100%;
          background: #88ff88;
          transition: width 0.1s;
          box-shadow: 0 0 6px #44aa44;
        }
        #hud-flashlight {
          position: absolute;
          top: 20px;
          right: 20px;
          font-size: 14px;
        }
        #hud-noise {
          position: absolute;
          top: 20px;
          left: 20px;
          width: 8px;
          height: 120px;
        }
        #hud-noise-bar {
          width: 100%;
          height: 100%;
          background: rgba(30, 60, 30, 0.3);
          border: 1px solid rgba(136, 255, 136, 0.2);
          position: relative;
          overflow: hidden;
        }
        #hud-noise-fill {
          position: absolute;
          bottom: 0;
          width: 100%;
          background: #88ff88;
          transition: height 0.1s;
          box-shadow: 0 0 6px #44aa44;
        }
        #hud-interaction {
          position: absolute;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 16px;
          background: rgba(0, 0, 0, 0.6);
          padding: 8px 16px;
          border: 1px solid rgba(136, 255, 136, 0.3);
          opacity: 0;
          transition: opacity 0.2s;
        }
        #hud-timer {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 20px;
          letter-spacing: 3px;
        }
        #hud-hp {
          position: absolute;
          bottom: 30px;
          right: 20px;
          font-size: 18px;
        }
        #hud-inventory {
          position: absolute;
          top: 60px;
          right: 20px;
          font-size: 12px;
        }
        #hud-damage-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(ellipse, transparent 40%, rgba(255,0,0,0.4) 100%);
          opacity: 0;
          transition: opacity 0.15s;
          pointer-events: none;
        }
        #hud-crosshair {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 2px;
          height: 2px;
          background: rgba(136, 255, 136, 0.6);
          box-shadow: 0 0 3px rgba(136, 255, 136, 0.3);
        }
      </style>
      <div id="hud-crosshair"></div>
      <div id="hud-stamina">
        <div class="hud-label">Stamina</div>
        <div id="hud-stamina-bar"><div id="hud-stamina-fill"></div></div>
      </div>
      <div id="hud-flashlight">&#x1F526; <span id="hud-flashlight-pct">100%</span></div>
      <div id="hud-noise">
        <div class="hud-label">N</div>
        <div id="hud-noise-bar"><div id="hud-noise-fill"></div></div>
      </div>
      <div id="hud-interaction"></div>
      <div id="hud-timer">05:00</div>
      <div id="hud-hp"></div>
      <div id="hud-inventory"></div>
      <div id="hud-damage-overlay"></div>
    `;

    document.body.appendChild(this.container);

    this.staminaBar = this.container.querySelector('#hud-stamina') as HTMLDivElement;
    this.staminaFill = this.container.querySelector('#hud-stamina-fill') as HTMLDivElement;
    this.flashlightIndicator = this.container.querySelector('#hud-flashlight') as HTMLDivElement;
    this.noiseMeter = this.container.querySelector('#hud-noise') as HTMLDivElement;
    this.noiseFill = this.container.querySelector('#hud-noise-fill') as HTMLDivElement;
    this.interactionPrompt = this.container.querySelector('#hud-interaction') as HTMLDivElement;
    this.timerDisplay = this.container.querySelector('#hud-timer') as HTMLDivElement;
    this.hpDisplay = this.container.querySelector('#hud-hp') as HTMLDivElement;
    this.inventoryDisplay = this.container.querySelector('#hud-inventory') as HTMLDivElement;
    this.damageOverlay = this.container.querySelector('#hud-damage-overlay') as HTMLDivElement;
    this.crosshair = this.container.querySelector('#hud-crosshair') as HTMLDivElement;

    // Event listeners
    eventBus.on('interaction:available', ({ prompt }) => {
      this.interactionPrompt.textContent = prompt;
      this.interactionPrompt.style.opacity = '1';
    });

    eventBus.on('interaction:cleared', () => {
      this.interactionPrompt.style.opacity = '0';
    });

    eventBus.on('player:damaged', () => {
      this.damageOverlay.style.opacity = '1';
      setTimeout(() => {
        this.damageOverlay.style.opacity = '0';
      }, 300);
    });
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'block';
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  updateTimer(remainingSeconds: number): void {
    this.surviveTime = remainingSeconds;
  }

  update(): void {
    if (!this.visible) return;

    // Stamina
    const staminaPct = this.player.stamina / CONST.STAMINA_MAX;
    this.staminaFill.style.width = `${staminaPct * 100}%`;
    this.staminaBar.style.opacity = staminaPct < 1 ? '1' : '0';

    // Flashlight
    const flashPct = Math.round((this.player.flashlightBattery / CONST.FLASHLIGHT_MAX) * 100);
    const flashSpan = this.flashlightIndicator.querySelector('span')!;
    flashSpan.textContent = `${flashPct}%`;
    this.flashlightIndicator.style.opacity = this.player.flashlightOn ? '1' : '0.4';

    // Noise
    const noisePct = this.noiseSystem.currentLevel / 100;
    this.noiseFill.style.height = `${noisePct * 100}%`;
    if (noisePct > 0.6) {
      this.noiseFill.style.background = '#ff4444';
      this.noiseFill.style.boxShadow = '0 0 8px #ff2222';
    } else if (noisePct > 0.3) {
      this.noiseFill.style.background = '#ffaa44';
      this.noiseFill.style.boxShadow = '0 0 6px #ff8822';
    } else {
      this.noiseFill.style.background = '#88ff88';
      this.noiseFill.style.boxShadow = '0 0 6px #44aa44';
    }

    // Timer
    const mins = Math.floor(this.surviveTime / 60);
    const secs = Math.floor(this.surviveTime % 60);
    this.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (this.surviveTime < 60) {
      this.timerDisplay.style.color = '#ff4444';
    }

    // HP
    const hearts = '♥'.repeat(this.player.hp) + '♡'.repeat(Math.max(0, CONST.PLAYER_HP - this.player.hp));
    this.hpDisplay.textContent = hearts;
    this.hpDisplay.style.color = this.player.hp <= 1 ? '#ff4444' : '#88ff88';

    // Inventory
    const items: string[] = [];
    if (this.player.inventory.has('fuelCanister')) items.push('[Fuel Canister]');
    this.inventoryDisplay.textContent = items.join(' ');

    // Damage overlay from player
    const dmgIntensity = this.player.getDamageFlashIntensity();
    if (dmgIntensity > 0) {
      this.damageOverlay.style.opacity = String(dmgIntensity * 0.5);
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
