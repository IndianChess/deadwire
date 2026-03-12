import { eventBus } from '../core/EventBus';
import { Player } from '../entities/Player';
import { CONST } from '../core/Constants';
import { NoiseSystem } from '../systems/NoiseSystem';
import { GeneratorState } from '../types/enums';

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
  private fpsDisplay: HTMLDivElement;
  private cameraOverlay: HTMLDivElement;
  private frames = 0;
  private lastFpsUpdate = 0;

  // Objectives panel elements
  private objTimerValue: HTMLSpanElement;
  private objGenStatus: HTMLSpanElement;
  private objFuelCount: HTMLSpanElement;
  private objFenceStatus: HTMLSpanElement;

  private player: Player;
  private noiseSystem: NoiseSystem;
  private surviveTime = CONST.SURVIVE_TIME;
  private visible = false;

  // Objectives state
  private generatorState = GeneratorState.Running;
  private generatorFuel = CONST.GENERATOR_FUEL_MAX;
  private canistersCollected = 0;

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
        #hud-objectives {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 8, 0, 0.6);
          border: 1px solid rgba(136, 255, 136, 0.2);
          padding: 10px 16px;
          font-size: 11px;
          line-height: 1.7;
          min-width: 280px;
        }
        #hud-objectives .obj-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 3px;
          opacity: 0.5;
          margin-bottom: 6px;
        }
        #hud-objectives .obj-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        #hud-objectives .obj-check {
          opacity: 0.5;
          margin-right: 6px;
        }
        #hud-objectives .obj-value {
          opacity: 0.7;
          text-align: right;
        }
        #hud-objectives .obj-value.status-running { color: #88ff88; }
        #hud-objectives .obj-value.status-off { color: #ff4444; }
        #hud-objectives .obj-value.status-low { color: #ffaa44; }
      </style>
      <div id="hud-crosshair"></div>
      <div id="hud-objectives">
        <div class="obj-title">Objectives</div>
        <div class="obj-row">
          <span><span class="obj-check">></span>Survive until dawn</span>
          <span class="obj-value" id="obj-timer">05:00</span>
        </div>
        <div class="obj-row">
          <span><span class="obj-check">></span>Keep generator fueled</span>
          <span class="obj-value status-running" id="obj-gen-status">Running</span>
        </div>
        <div class="obj-row">
          <span><span class="obj-check">></span>Collect fuel from woods</span>
          <span class="obj-value" id="obj-fuel-count">0 collected</span>
        </div>
        <div class="obj-row">
          <span><span class="obj-check">></span>Stay inside the fence</span>
          <span class="obj-value" id="obj-fence-status">Safe</span>
        </div>
      </div>
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
      <div id="hud-fps" style="position: absolute; top: 150px; left: 20px; font-size: 10px; opacity: 0.5;">FPS: 0</div>
      <div id="hud-damage-overlay"></div>
      <div id="camera-overlay" style="display: none; position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); border: 1px solid #88ff88; padding: 10px; text-align: center;">
        <div style="font-size: 16px; margin-bottom: 5px;">CAM <span id="camera-id">1</span> &mdash; <span id="camera-dir">NORTH</span></div>
        <div style="font-size: 12px; opacity: 0.7;">[A/D] Switch Camera</div>
        <div style="font-size: 12px; opacity: 0.7;">[TAB/ESC] Exit</div>
      </div>
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
    this.fpsDisplay = this.container.querySelector('#hud-fps') as HTMLDivElement;
    this.cameraOverlay = this.container.querySelector('#camera-overlay') as HTMLDivElement;

    // Objectives elements
    this.objTimerValue = this.container.querySelector('#obj-timer') as HTMLSpanElement;
    this.objGenStatus = this.container.querySelector('#obj-gen-status') as HTMLSpanElement;
    this.objFuelCount = this.container.querySelector('#obj-fuel-count') as HTMLSpanElement;
    this.objFenceStatus = this.container.querySelector('#obj-fence-status') as HTMLSpanElement;

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

    // Objectives tracking
    eventBus.on('generator:state-changed', ({ state }) => {
      this.generatorState = state;
    });

    eventBus.on('generator:fuel-changed', ({ level }) => {
      this.generatorFuel = level;
    });

    eventBus.on('player:pickup', ({ item }) => {
      if (item === 'fuelCanister') {
        this.canistersCollected++;
      }
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

  private static readonly CAMERA_LABELS = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

  showCameraOverlay(cameraId: number): void {
    this.visible = true;
    this.container.style.display = 'block';

    // Hide standard HUD elements manually while showing camera overlay
    this.staminaBar.style.display = 'none';
    this.flashlightIndicator.style.display = 'none';
    this.noiseMeter.style.display = 'none';
    this.interactionPrompt.style.display = 'none';
    this.timerDisplay.style.display = 'none';
    this.hpDisplay.style.display = 'none';
    this.inventoryDisplay.style.display = 'none';
    this.crosshair.style.display = 'none';
    this.container.querySelector('#hud-objectives')!.setAttribute('style', 'display: none !important');

    this.cameraOverlay.style.display = 'block';
    this.cameraOverlay.querySelector('#camera-id')!.textContent = (cameraId + 1).toString();
    this.cameraOverlay.querySelector('#camera-dir')!.textContent = HUD.CAMERA_LABELS[cameraId] ?? '';
  }

  updateCameraOverlay(cameraId: number): void {
    if (this.cameraOverlay.style.display === 'block') {
      this.cameraOverlay.querySelector('#camera-id')!.textContent = (cameraId + 1).toString();
      this.cameraOverlay.querySelector('#camera-dir')!.textContent = HUD.CAMERA_LABELS[cameraId] ?? '';
    }
  }

  hideCameraOverlay(): void {
    this.cameraOverlay.style.display = 'none';

    // Restore standard HUD elements
    this.staminaBar.style.display = 'block';
    this.flashlightIndicator.style.display = 'block';
    this.noiseMeter.style.display = 'block';
    this.interactionPrompt.style.display = 'block';
    this.timerDisplay.style.display = 'block';
    this.hpDisplay.style.display = 'block';
    this.inventoryDisplay.style.display = 'block';
    this.crosshair.style.display = 'block';
    this.container.querySelector('#hud-objectives')!.setAttribute('style', '');
  }

  updateTimer(remainingSeconds: number): void {
    this.surviveTime = remainingSeconds;
  }

  update(): void {
    if (!this.visible) return;

    // FPS Counter
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsUpdate > 1000) {
      this.fpsDisplay.textContent = `FPS: ${this.frames}`;
      this.frames = 0;
      this.lastFpsUpdate = now;
    }

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
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.timerDisplay.textContent = timeStr;
    if (this.surviveTime < 60) {
      this.timerDisplay.style.color = '#ff4444';
    }

    // HP
    const hearts = '\u2665'.repeat(this.player.hp) + '\u2661'.repeat(Math.max(0, CONST.PLAYER_HP - this.player.hp));
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

    // --- Objectives Panel ---

    // Timer objective
    this.objTimerValue.textContent = timeStr;
    if (this.surviveTime < 60) {
      this.objTimerValue.style.color = '#ff4444';
    }

    // Generator status
    let genLabel: string;
    let genClass: string;
    if (this.generatorState === GeneratorState.Running) {
      if (this.generatorFuel < 20) {
        genLabel = 'Low Fuel';
        genClass = 'status-low';
      } else {
        genLabel = 'Running';
        genClass = 'status-running';
      }
    } else if (this.generatorState === GeneratorState.Broken) {
      genLabel = 'Broken';
      genClass = 'status-off';
    } else {
      genLabel = 'Off';
      genClass = 'status-off';
    }
    this.objGenStatus.textContent = genLabel;
    this.objGenStatus.className = `obj-value ${genClass}`;

    // Fuel canisters
    this.objFuelCount.textContent = `${this.canistersCollected} collected`;

    // Fence safety (based on player position)
    const pos = this.player.getPosition();
    const inside = Math.abs(pos.x) < CONST.FENCE_PERIMETER_HALF &&
      Math.abs(pos.z) < CONST.FENCE_PERIMETER_HALF;
    if (inside) {
      this.objFenceStatus.textContent = 'Safe';
      this.objFenceStatus.className = 'obj-value status-running';
    } else {
      this.objFenceStatus.textContent = 'OUTSIDE!';
      this.objFenceStatus.className = 'obj-value status-off';
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
