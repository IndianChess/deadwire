import { GameSystem } from '../core/Engine';
import { CONST } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { Generator } from '../entities/Generator';
import { GeneratorState } from '../types/enums';

export class PowerSystem implements GameSystem {
  generator: Generator;
  isPowerOn = true;

  constructor(generator: Generator) {
    this.generator = generator;
  }

  fixedUpdate(dt: number): void {
    const gen = this.generator;

    if (gen.state === GeneratorState.Running) {
      gen.fuel -= CONST.GENERATOR_FUEL_DRAIN * dt;

      if (gen.fuel <= 0) {
        gen.fuel = 0;
        gen.state = GeneratorState.Off;
        this.setPower(false);
        eventBus.emit('generator:state-changed', { state: GeneratorState.Off });
      }

      // Breakdown timer
      gen.breakdownTimer += dt;
      if (gen.breakdownTimer >= gen.nextBreakdownTime) {
        gen.breakdownTimer = 0;
        gen.nextBreakdownTime = CONST.GENERATOR_BREAKDOWN_MIN +
          Math.random() * (CONST.GENERATOR_BREAKDOWN_MAX - CONST.GENERATOR_BREAKDOWN_MIN);
        gen.state = GeneratorState.Broken;
        this.setPower(false);
        eventBus.emit('generator:breakdown', {});
        eventBus.emit('generator:state-changed', { state: GeneratorState.Broken });
      }
    }

    gen.updateVisuals();
    eventBus.emit('generator:fuel-changed', { level: gen.fuel });
  }

  refuel(): void {
    const gen = this.generator;
    gen.fuel = Math.min(CONST.GENERATOR_FUEL_MAX, gen.fuel + CONST.GENERATOR_REFUEL_AMOUNT);

    if (gen.state === GeneratorState.Off && gen.fuel > 0) {
      this.startGenerator();
    }
  }

  startGenerator(): void {
    const gen = this.generator;
    if (gen.fuel > 0 && gen.state === GeneratorState.Off) {
      gen.state = GeneratorState.Running;
      this.setPower(true);
      eventBus.emit('generator:state-changed', { state: GeneratorState.Running });
    }
  }

  repairGenerator(): void {
    const gen = this.generator;
    if (gen.state === GeneratorState.Broken) {
      gen.state = GeneratorState.Off;
      eventBus.emit('generator:state-changed', { state: GeneratorState.Off });
      // Player must manually restart
      this.startGenerator();
    }
  }

  private setPower(on: boolean): void {
    if (this.isPowerOn !== on) {
      this.isPowerOn = on;
      eventBus.emit('generator:power-toggle', { isOn: on });
      eventBus.emit('fence:electrified-changed', { isElectrified: on });
    }
  }
}
