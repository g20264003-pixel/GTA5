export interface Point {
  x: number;
  y: number;
}

export type VehicleType = 'sedan' | 'sports' | 'truck' | 'police' | 'taxi';
export type PedestrianType = 'civilian' | 'gang' | 'police' | 'bodyguard';
export type PedestrianState = 'walking' | 'fleeing' | 'dead' | 'hostile' | 'patrolling' | 'chasing';
export type WeaponType = 'fist' | 'pistol' | 'smg' | 'shotgun' | 'rocket';

export interface WeaponInfo {
  type: WeaponType;
  name: string;
  damage: number;
  fireRate: number; // ms between shots
  ammoCost: number;
  maxAmmo: number;
  range: number;
  color: string;
  bulletSpeed: number;
  soundType: 'punch' | 'pistol' | 'smg' | 'shotgun' | 'rocket';
}

export interface Player {
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  cash: number;
  currentWeapon: WeaponType;
  weaponsOwned: WeaponType[];
  ammo: Record<WeaponType, number>;
  stamina: number;
  maxStamina: number;
  insideVehicleId: string | null;
  wantedLevel: number; // 0 to 5 stars
  wantedPoints: number; // raw value for level increases
  lastCrimeTime: number;
  isDead: boolean;
}

export interface Car {
  id: string;
  type: VehicleType;
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxSpeed: number;
  accel: number;
  friction: number;
  color: string;
  health: number;
  maxHealth: number;
  width: number;
  height: number;
  isPlayerDriving: boolean;
  // Simple AI traffic controls
  aiActive: boolean;
  targetX: number;
  targetY: number;
  roadNodeIndex: number;
  stopTimer: number; // traffic lights or player in front
  sirenOn: boolean;
}

export interface Pedestrian {
  id: string;
  type: PedestrianType;
  state: PedestrianState;
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxSpeed: number;
  health: number;
  maxHealth: number;
  color: string;
  targetX: number;
  targetY: number;
  shootCooldown: number;
  isInsideVehicle: boolean;
  dropCash: number;
  alertedByWeapon: boolean;
  shotCount?: number;
  isFadingGray?: boolean;
  fadeAlpha?: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'civilian' | 'police' | 'gang';
  damage: number;
  range: number;
  distanceTraveled: number;
  color: string;
  size: number;
  isRocket: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
  type: 'blood' | 'spark' | 'smoke' | 'fire' | 'tire_track' | 'casing' | 'explosion_flash';
  angle?: number; // for tyre tracks
}

export interface Building {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  roofColor: string;
  type: 'residential' | 'commercial' | 'skyscrapers' | 'shop' | 'industrial' | 'police' | 'hospital' | 'park_bush';
  name?: string;
}

export interface RoadNode {
  x: number;
  y: number;
  connections: number[]; // indices of connected nodes
}

export interface GameMission {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: 'locked' | 'available' | 'active' | 'completed' | 'failed';
  steps: {
    description: string;
    type: 'goto' | 'steal_car' | 'kill_target' | 'escape_wanted' | 'buy_weapon';
    targetX?: number;
    targetY?: number;
    targetVehicleType?: VehicleType;
    targetPedType?: PedestrianType;
    escapeDuration?: number; // escape wanted level for N seconds
    targetWeapon?: WeaponType;
  }[];
  currentStepIndex: number;
}

export interface GameState {
  player: Player;
  cars: Car[];
  pedestrians: Pedestrian[];
  bullets: Bullet[];
  particles: Particle[];
  buildings: Building[];
  missions: GameMission[];
  activeMissionId: string | null;
  shopOpen: 'ammu_nation' | 'burger_shot' | 'spray' | 'safehouse' | 'bank' | null;
  score: number;
  timeOfDay: number; // 0 to 2400 (clock ticks)
  gameStatus: 'intro' | 'playing' | 'gameover' | 'completed';
  killNotification?: {
    message: string;
    timestamp: number;
  } | null;
}
