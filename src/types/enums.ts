export enum GameState {
  MainMenu = 'MainMenu',
  Playing = 'Playing',
  Paused = 'Paused',
  GameOver = 'GameOver',
  Victory = 'Victory',
}

export enum GeneratorState {
  Running = 'Running',
  Off = 'Off',
  Broken = 'Broken',
}

export enum MonsterState {
  Roaming = 'Roaming',
  Investigating = 'Investigating',
  Hunting = 'Hunting',
  Attacking = 'Attacking',
  Retreating = 'Retreating',
}

export enum FenceSegmentId {
  North = 0,
  East = 1,
  South = 2,
  West = 3,
}
