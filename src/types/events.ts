import { Vector3 } from 'three';
import { GameState, GeneratorState, MonsterState } from './enums';

export interface GameEvents {
  'generator:fuel-changed': { level: number };
  'generator:state-changed': { state: GeneratorState };
  'generator:power-toggle': { isOn: boolean };
  'generator:breakdown': {};
  'fence:electrified-changed': { isElectrified: boolean };
  'monster:state-changed': { from: MonsterState; to: MonsterState };
  'player:noise': { level: number; position: Vector3 };
  'player:damaged': { amount: number; hpRemaining: number };
  'player:died': {};
  'player:pickup': { item: string };
  'player:flashlight-toggle': { isOn: boolean };
  'camera:static-level': { cameraId: number; level: number };
  'game:state-changed': { state: GameState };
  'game:dawn': {};
  'interaction:available': { prompt: string };
  'interaction:cleared': {};
  'minigame:start': { type: string };
  'minigame:end': { type: string; success: boolean };
}
