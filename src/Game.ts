import * as THREE from 'three';
import { Engine, GameSystem } from './core/Engine';
import { CONST } from './core/Constants';
import { eventBus } from './core/EventBus';
import { GameState, GeneratorState, MonsterState } from './types/enums';

import { Player } from './entities/Player';
import { Monster } from './entities/Monster';
import { Generator } from './entities/Generator';
import { FenceSegment } from './entities/Fence';

import { buildLevel, LevelData } from './world/LevelBuilder';
import { PowerSystem } from './systems/PowerSystem';
import { FenceSystem } from './systems/FenceSystem';
import { MonsterAI } from './systems/MonsterAI';
import { InteractionSystem } from './systems/InteractionSystem';
import { NoiseSystem } from './systems/NoiseSystem';
import { ScavengeSystem } from './systems/ScavengeSystem';
import { CameraSystem } from './systems/CameraSystem';

import { HUD } from './ui/HUD';
import { MainMenu } from './ui/MainMenu';
import { PauseMenu } from './ui/PauseMenu';
import { GameOverScreen } from './ui/GameOverScreen';
import { VictoryScreen } from './ui/VictoryScreen';
import { WrenchMinigame } from './ui/minigames/WrenchMinigame';

import { createPostProcessing } from './shaders/PostProcessing';
import { AudioManager } from './core/AudioManager';

export class Game {
  private engine: Engine;
  private state = GameState.MainMenu;
  private level!: LevelData;
  private player!: Player;
  private monster!: Monster;
  private generator!: Generator;
  private fenceSegments!: FenceSegment[];

  private powerSystem!: PowerSystem;
  private fenceSystem!: FenceSystem;
  private monsterAI!: MonsterAI;
  private interactionSystem!: InteractionSystem;
  private noiseSystem!: NoiseSystem;
  private scavengeSystem!: ScavengeSystem;
  private cameraSystem!: CameraSystem;

  private hud!: HUD;
  private mainMenu!: MainMenu;
  private pauseMenu!: PauseMenu;
  private gameOverScreen!: GameOverScreen;
  private victoryScreen!: VictoryScreen;
  private wrenchMinigame!: WrenchMinigame;

  private audioManager!: AudioManager;
  private composer!: ReturnType<typeof createPostProcessing>['composer'];
  private horrorPass!: ReturnType<typeof createPostProcessing>['horrorPass'];

  private surviveTimer = CONST.SURVIVE_TIME;
  private gameActive = false;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.setupUI();
  }

  private setupUI(): void {
    this.mainMenu = new MainMenu(() => this.startGame());
    this.pauseMenu = new PauseMenu(() => this.resumeGame());
    this.gameOverScreen = new GameOverScreen(() => this.restartGame());
    this.victoryScreen = new VictoryScreen(() => this.restartGame());
    this.wrenchMinigame = new WrenchMinigame();

    // Show main menu
    this.mainMenu.show();
    this.engine.start();
  }

  private startGame(): void {
    // Clear previous game state if any
    this.cleanup();

    // Build level
    this.level = buildLevel(this.engine.scene);

    // Create player
    this.player = new Player(this.engine.camera, this.engine.input);
    this.player.camera.position.set(0, CONST.PLAYER_HEIGHT, 0);
    this.engine.scene.add(this.player.camera);

    // Set collision geometry
    this.player.setCollisionGeometry(
      this.level.collisionBoxes,
      this.level.woods.treePositions
    );

    // Create generator
    this.generator = new Generator(this.level.cabin.generatorPosition);
    this.engine.scene.add(this.generator.mesh);

    // Create fence segments
    this.fenceSegments = this.level.fence.segments.map((data, i) =>
      new FenceSegment(i, data)
    );

    // Create monster
    this.monster = new Monster();
    this.engine.scene.add(this.monster.mesh);

    // Create systems
    this.powerSystem = new PowerSystem(this.generator);
    this.fenceSystem = new FenceSystem(this.fenceSegments);
    this.noiseSystem = new NoiseSystem(this.player);

    // Scavenge system (creates fuel canisters)
    this.scavengeSystem = new ScavengeSystem(
      this.engine.scene,
      this.level.woods.fuelSpawnPoints
    );

    // Interaction system
    this.interactionSystem = new InteractionSystem(
      this.player,
      this.engine.input,
      this.generator,
      this.powerSystem,
      this.scavengeSystem.canisters,
      this.level.cabin.monitorPosition,
    );

    // Wire up repair minigame
    this.interactionSystem.onRepairMinigame = () => this.wrenchMinigame.start();

    // Monster AI
    this.monsterAI = new MonsterAI(
      this.monster,
      this.player,
      this.fenceSystem,
      this.level.woods.monsterWaypoints,
      this.level.woods.treePositions,
    );

    // Camera system
    this.cameraSystem = new CameraSystem(
      this.engine.renderer,
      this.engine.scene,
      this.monster,
      this.level.fence.segments.map(s => ({
        midpoint: s.midpoint,
        normal: s.normal,
      })),
      this.level.cabin.monitorPosition,
    );

    // Audio
    this.audioManager = new AudioManager(this.engine.camera);
    this.audioManager.init().then(() => {
      this.audioManager.createGeneratorHum(
        this.level.cabin.generatorPosition,
        this.engine.scene
      );
      this.audioManager.createFenceCrackle(
        this.level.fence.segments[0].midpoint,
        this.engine.scene
      );
      this.audioManager.createAmbience();
    });

    // HUD
    this.hud = new HUD(this.player, this.noiseSystem);
    this.hud.show();

    // Post-processing
    const pp = createPostProcessing(
      this.engine.renderer,
      this.engine.scene,
      this.engine.camera
    );
    this.composer = pp.composer;
    this.horrorPass = pp.horrorPass;

    // Register systems
    this.engine.addSystem(this.player);
    this.engine.addSystem(this.powerSystem);
    this.engine.addSystem(this.fenceSystem);
    this.engine.addSystem(this.noiseSystem);
    this.engine.addSystem(this.interactionSystem);
    this.engine.addSystem(this.monsterAI);
    this.engine.addSystem(this.cameraSystem);
    this.engine.addSystem(this.createGameLoopSystem());

    // Override render to use composer
    this.engine.onRender(() => {
      this.horrorPass.uniforms.time.value = performance.now() * 0.001;
      this.horrorPass.uniforms.damageFlash.value = this.player.getDamageFlashIntensity();
      this.hud.update();
    });

    // Store original render and override
    const origRender = this.engine.renderer.render.bind(this.engine.renderer);
    let composerRendering = false;
    this.engine.renderer.render = (scene: THREE.Scene, camera: THREE.Camera) => {
      if (composerRendering) {
        origRender(scene, camera);
        return;
      }
      composerRendering = true;
      this.composer.render();
      composerRendering = false;
    };

    // Event listeners
    this.setupEventListeners();

    // Request pointer lock
    this.engine.input.requestPointerLock();

    // Link cabin light to power
    eventBus.on('generator:power-toggle', ({ isOn }) => {
      this.level.cabin.cabinLight.intensity = isOn ? 1.5 : 0;
      this.audioManager?.setGeneratorActive(isOn);
    });

    this.surviveTimer = CONST.SURVIVE_TIME;
    this.gameActive = true;
    this.state = GameState.Playing;
    eventBus.emit('game:state-changed', { state: GameState.Playing });
  }

  private createGameLoopSystem(): GameSystem {
    return {
      fixedUpdate: (dt: number) => {
        if (!this.gameActive) return;

        // Survive timer
        this.surviveTimer -= dt;
        this.hud.updateTimer(this.surviveTimer);

        if (this.surviveTimer <= 0) {
          this.victory();
        }
      },
    };
  }

  private setupEventListeners(): void {
    eventBus.on('player:died', () => {
      this.gameOver();
    });

    eventBus.on('player:pickup', ({ item }) => {
      this.audioManager?.playOneShot('pickup');
    });

    eventBus.on('player:damaged', () => {
      this.audioManager?.playOneShot('hit');
    });

    eventBus.on('monster:entered-perimeter', () => {
      this.audioManager?.playOneShot('scare');
    });

    eventBus.on('minigame:end', ({ success }) => {
      if (success) {
        this.audioManager?.playOneShot('repair');
      }
    });

    // Pause
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state === GameState.Playing) {
          this.pauseGame();
        } else if (this.state === GameState.Paused) {
          this.resumeGame();
        }
      }
    });
  }

  private pauseGame(): void {
    this.gameActive = false;
    this.state = GameState.Paused;
    this.engine.input.exitPointerLock();
    this.pauseMenu.show();
    this.hud.hide();
  }

  private resumeGame(): void {
    this.gameActive = true;
    this.state = GameState.Playing;
    this.pauseMenu.hide();
    this.hud.show();
    this.engine.input.requestPointerLock();
  }

  private gameOver(): void {
    this.gameActive = false;
    this.state = GameState.GameOver;
    this.engine.input.exitPointerLock();
    this.hud.hide();

    // Dramatic camera drop
    const startY = this.player.camera.position.y;
    const dropDuration = 800;
    const startTime = performance.now();

    const drop = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / dropDuration);
      this.player.camera.position.y = startY * (1 - t) + 0.3 * t;
      this.player.camera.rotation.z = t * 0.3;

      if (t < 1) {
        requestAnimationFrame(drop);
      } else {
        setTimeout(() => {
          this.gameOverScreen.show();
        }, 500);
      }
    };
    drop();
  }

  private victory(): void {
    this.gameActive = false;
    this.state = GameState.Victory;
    this.engine.input.exitPointerLock();
    this.hud.hide();

    // Dawn: ramp up ambient light
    const startIntensity = this.level.ambientLight.intensity;
    const targetIntensity = 1.5;
    const dawnDuration = 5000;
    const startTime = performance.now();

    this.level.ambientLight.color.setHex(0xffeedd);
    this.level.moonLight.color.setHex(0xffddaa);

    const dawn = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / dawnDuration);
      this.level.ambientLight.intensity = startIntensity + (targetIntensity - startIntensity) * t;
      this.level.moonLight.intensity = 0.3 + t * 2;

      // Reduce fog
      if (this.engine.scene.fog instanceof THREE.FogExp2) {
        this.engine.scene.fog.density = 0.04 * (1 - t * 0.8);
      }

      if (t < 1) {
        requestAnimationFrame(dawn);
      } else {
        setTimeout(() => {
          this.victoryScreen.show();
        }, 1000);
      }
    };
    dawn();
  }

  private restartGame(): void {
    this.cleanup();
    this.startGame();
  }

  private cleanup(): void {
    this.gameActive = false;
    eventBus.clear();

    // Remove all objects from scene
    while (this.engine.scene.children.length > 0) {
      this.engine.scene.remove(this.engine.scene.children[0]);
    }

    // Reset engine systems
    this.engine.clearSystems();

    // Dispose audio
    this.audioManager?.dispose();

    // Dispose HUD
    this.hud?.dispose();

    // Reset fog
    this.engine.scene.fog = new THREE.FogExp2(0x010208, 0.04);
  }
}
