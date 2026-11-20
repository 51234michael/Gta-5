export type CharacterId = 'marco' | 'luca' | 'tiziano';

export type WeaponId = 'fists' | 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'grenade';

export type VehicleType = 'supercar' | 'muscle' | 'police' | 'suv' | 'moto';

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

export type RadioStationId = 'off' | 'los_solis' | 'vinewood' | 'rebel';

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  surname: string;
  role: string;
  specialName: string;
  specialDesc: string;
  accentColor: string;
  jacketColor: number;
  pantsColor: number;
  skinColor: number;
  hairColor: number;
  hasSunglasses?: boolean;
  hasCap?: boolean;
  capBackward?: boolean;
  hasChain?: boolean;
  duffelColor?: number;
  handDuffelColor?: number;
  outfitStyle?: 'suit' | 'tank' | 'flannel';
  startX: number;
  startZ: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  shortName: string;
  damage: number;
  fireRateMs: number;
  range: number;
  spread: number;
  pellets?: number;
  maxAmmo: number;
  price: number;
  ammoPack: number;
  ammoPrice: number;
  color: string;
  isExplosive?: boolean;
}

export interface VehicleSpec {
  id: string;
  name: string;
  type: VehicleType;
  maxSpeed: number;
  reverseSpeed: number;
  accel: number;
  brake: number;
  turnSpeed: number;
  primaryColor: number;
  secondaryColor: number;
  isMatte?: boolean;
  hasSiren?: boolean;
  length: number;
  width: number;
  height: number;
}

export interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  label?: string;
}

export interface RampBox {
  cx: number;
  cz: number;
  width: number;
  length: number;
  height: number;
  dirX: number;
  dirZ: number;
}

export type PropertyMode = 'online' | 'story';

export type PropertyCategory =
  | 'residenza'
  | 'business'
  | 'veicolo_base'
  | 'club'
  | 'cinema'
  | 'servizio'
  | 'hangar_porto';

export interface WorldProperty {
  id: string;
  name: string;
  mode: PropertyMode;
  category: PropertyCategory;
  district: string;
  x: number;
  z: number;
  color: string;
  shortCode: string;
  price: number;
  incomeBonus: number;
  description: string;
  actionLabel: string;
  effect: 'income' | 'heal_special' | 'repair_clear' | 'armor_ammo' | 'vehicle_spawn';
  spawnVehicleId?: string;
}

export interface InteractiveZone {
  id: string;
  type: 'ammu' | 'paynspray' | 'hospital' | 'mission' | 'property' | 'store';
  name: string;
  x: number;
  z: number;
  radius: number;
  missionId?: string;
  propertyId?: string;
  storeId?: string;
  color: string;
}

export interface MissionDef {
  id: string;
  title: string;
  giver: string;
  description: string;
  reward: number;
  type: 'steal_deliver' | 'escape_wanted' | 'race_checkpoints' | 'eliminate' | 'stunt_jump';
  startX: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  timeLimitSec?: number;
}

export interface ActiveMissionState {
  def: MissionDef;
  objectiveText: string;
  progress: number;
  total: number;
  timeLeftSec: number | null;
  targetX: number;
  targetZ: number;
}

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type TrafficDensity = 'low' | 'normal' | 'high';
export type PoliceDifficulty = 'relaxed' | 'normal' | 'hardcore';
export type TouchControlsMode = 'auto' | 'always' | 'hidden';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  timeOfDay: TimeOfDay;
  trafficDensity: TrafficDensity;
  policeDifficulty: PoliceDifficulty;
  cameraSensitivity: number;
  autoAim: boolean;
  muted: boolean;
  radioVolume: number;
  sfxVolume: number;
  defaultRadio: RadioStationId;
  touchControls: TouchControlsMode;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  graphicsQuality: 'high',
  timeOfDay: 'sunset',
  trafficDensity: 'normal',
  policeDifficulty: 'normal',
  cameraSensitivity: 1.0,
  autoAim: true,
  muted: false,
  radioVolume: 0.75,
  sfxVolume: 0.85,
  defaultRadio: 'los_solis',
  touchControls: 'auto',
};

export interface OnlinePlayerState {
  id: string;
  name: string;
  characterId: CharacterId;
  x: number;
  y: number;
  z: number;
  heading: number;
  inVehicle: boolean;
  vehicleSpecId: string | null;
  sirenOn: boolean;
  weaponId: WeaponId;
  health: number;
  wantedLevel: number;
  isDodging: boolean;
}

export interface OnlineChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface MinimapBlip {
  x: number;
  z: number;
  kind: 'car' | 'police' | 'mission' | 'shop' | 'enemy' | 'waypoint' | 'character' | 'online_player' | 'property';
  color: string;
  label?: string;
  heading?: number;
  mode?: PropertyMode;
}

export interface HudSnapshot {
  characterId: CharacterId;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  special: number;
  specialActive: boolean;
  damageFlash: number; // 0..1 red screen intensity when taking damage
  isDead: boolean;
  isDodging: boolean;
  dodgeCooldown: number; // 0..1 remaining ratio
  cash: number;
  cashDelta: number;
  wantedLevel: number;
  wantedCooldown: number;
  policeSpotted: boolean;
  weaponId: WeaponId;
  ammo: Record<WeaponId, number>;
  inVehicle: boolean;
  vehicleName: string;
  vehicleType: VehicleType | null;
  vehicleHealth: number;
  speedKmh: number;
  sirenOn: boolean;
  radioStation: RadioStationId;
  district: string;
  gameTimeStr: string;
  timeOfDay: TimeOfDay;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  cameraHeading: number;
  nearVehicleName: string | null;
  nearZone: InteractiveZone | null;
  insideStoreId: string | null;
  activeMission: ActiveMissionState | null;
  completedMissions: string[];
  ownedProperties: string[];
  waypoint: { x: number; z: number } | null;
  blips: MinimapBlip[];
  onlineMode: boolean;
  onlineConnected: boolean;
  onlineRoom: string;
  onlinePlayersCount: number;
  statusBanner: {
    type: 'wasted' | 'busted' | 'mission_passed' | 'mission_failed' | 'stunt';
    title: string;
    subtitle: string;
  } | null;
  toastText: string | null;
}

export const WORLD_BOUNDS = {
  minX: -615,
  maxX: 615,
  minZ: -615,
  maxZ: 855,
};

export const CHARACTERS: Record<CharacterId, CharacterProfile> = {
  marco: {
    id: 'marco',
    name: 'Marco',
    surname: 'De Santis',
    role: 'Ex-Rapinatore',
    specialName: 'Focus Tattico',
    specialDesc: 'Rallenta il tempo in combattimento',
    accentColor: '#38bdf8',
    jacketColor: 0x353940,
    pantsColor: 0x242830,
    skinColor: 0xd79b74,
    hairColor: 0x2b221e,
    hasSunglasses: false,
    duffelColor: 0x14161a,
    outfitStyle: 'suit',
    startX: -12,
    startZ: 24,
  },
  luca: {
    id: 'luca',
    name: 'Luca',
    surname: 'Moretti',
    role: 'Pilota Urbano',
    specialName: 'Turbo Guida',
    specialDesc: 'Scatto nitro e tenuta perfetta in auto',
    accentColor: '#22c55e',
    jacketColor: 0x181a1f,
    pantsColor: 0x252d3a,
    skinColor: 0x9b6647,
    hairColor: 0x141414,
    hasCap: true,
    capBackward: true,
    hasChain: true,
    outfitStyle: 'tank',
    startX: 112,
    startZ: 430,
  },
  tiziano: {
    id: 'tiziano',
    name: 'Tiziano',
    surname: 'Rinaldi',
    role: 'Meccanico Rurale',
    specialName: 'Furia Rossa',
    specialDesc: 'Danni doppi e resistenza ai proiettili',
    accentColor: '#f97316',
    jacketColor: 0x8b7765,
    pantsColor: 0x364b63,
    skinColor: 0xdca47d,
    hairColor: 0x3f2e22,
    handDuffelColor: 0x1a1c20,
    outfitStyle: 'flannel',
    startX: -415,
    startZ: -175,
  },
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fists: {
    id: 'fists',
    name: 'Pugni',
    shortName: 'PUGNI',
    damage: 25,
    fireRateMs: 420,
    range: 2.6,
    spread: 0.1,
    maxAmmo: 999,
    price: 0,
    ammoPack: 0,
    ammoPrice: 0,
    color: '#94a3b8',
  },
  pistol: {
    id: 'pistol',
    name: 'Pistola 9mm',
    shortName: 'PISTOLA',
    damage: 34,
    fireRateMs: 300,
    range: 58,
    spread: 0.025,
    maxAmmo: 180,
    price: 0,
    ammoPack: 24,
    ammoPrice: 120,
    color: '#e2e8f0',
  },
  smg: {
    id: 'smg',
    name: 'Mitraglietta SMG',
    shortName: 'SMG',
    damage: 20,
    fireRateMs: 105,
    range: 52,
    spread: 0.055,
    maxAmmo: 360,
    price: 1200,
    ammoPack: 60,
    ammoPrice: 240,
    color: '#38bdf8',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Fucile a Pompa',
    shortName: 'POMPA',
    damage: 22,
    fireRateMs: 780,
    range: 30,
    spread: 0.14,
    pellets: 6,
    maxAmmo: 64,
    price: 1800,
    ammoPack: 12,
    ammoPrice: 200,
    color: '#f59e0b',
  },
  rifle: {
    id: 'rifle',
    name: "Carabina d'Assalto",
    shortName: 'FUCILE',
    damage: 32,
    fireRateMs: 130,
    range: 82,
    spread: 0.03,
    maxAmmo: 300,
    price: 2800,
    ammoPack: 45,
    ammoPrice: 320,
    color: '#22c55e',
  },
  grenade: {
    id: 'grenade',
    name: 'Granate Frag',
    shortName: 'GRANATE',
    damage: 140,
    fireRateMs: 950,
    range: 34,
    spread: 0.02,
    maxAmmo: 15,
    price: 900,
    ammoPack: 3,
    ammoPrice: 450,
    color: '#ef4444',
    isExplosive: true,
  },
};

export const VEHICLE_SPECS: Record<string, VehicleSpec> = {
  banshee: {
    id: 'banshee',
    name: 'Banshee GT',
    type: 'supercar',
    maxSpeed: 46,
    reverseSpeed: 14,
    accel: 26,
    brake: 36,
    turnSpeed: 2.35,
    primaryColor: 0xe11d48,
    secondaryColor: 0x111827,
    length: 4.5,
    width: 1.98,
    height: 1.18,
  },
  banshee_orange: {
    id: 'banshee_orange',
    name: 'Banshee Sunset GT',
    type: 'supercar',
    maxSpeed: 48,
    reverseSpeed: 14,
    accel: 27,
    brake: 37,
    turnSpeed: 2.38,
    primaryColor: 0xd9581a,
    secondaryColor: 0x14171c,
    length: 4.5,
    width: 1.98,
    height: 1.18,
  },
  adder_gold: {
    id: 'adder_gold',
    name: 'Adder Oro',
    type: 'supercar',
    maxSpeed: 50,
    reverseSpeed: 15,
    accel: 28,
    brake: 38,
    turnSpeed: 2.25,
    primaryColor: 0xf59e0b,
    secondaryColor: 0x0f172a,
    length: 4.6,
    width: 2.02,
    height: 1.15,
  },
  gauntlet: {
    id: 'gauntlet',
    name: 'Gauntlet Muscle',
    type: 'muscle',
    maxSpeed: 39,
    reverseSpeed: 13,
    accel: 23,
    brake: 30,
    turnSpeed: 2.15,
    primaryColor: 0x0284c7,
    secondaryColor: 0xf8fafc,
    length: 4.65,
    width: 1.96,
    height: 1.32,
  },
  gauntlet_matte: {
    id: 'gauntlet_matte',
    name: 'Gauntlet Nero Opaco',
    type: 'muscle',
    maxSpeed: 41,
    reverseSpeed: 13,
    accel: 24,
    brake: 31,
    turnSpeed: 2.18,
    primaryColor: 0x25282c,
    secondaryColor: 0x111317,
    isMatte: true,
    length: 4.65,
    width: 1.96,
    height: 1.32,
  },
  sandking: {
    id: 'sandking',
    name: 'Sandking 4x4',
    type: 'suv',
    maxSpeed: 33,
    reverseSpeed: 12,
    accel: 19,
    brake: 28,
    turnSpeed: 1.95,
    primaryColor: 0xeab308,
    secondaryColor: 0x1e293b,
    length: 4.85,
    width: 2.12,
    height: 1.78,
  },
  police: {
    id: 'police',
    name: 'Volante LSPD',
    type: 'police',
    maxSpeed: 41,
    reverseSpeed: 14,
    accel: 24,
    brake: 34,
    turnSpeed: 2.3,
    primaryColor: 0x0f172a,
    secondaryColor: 0xf8fafc,
    hasSiren: true,
    length: 4.65,
    width: 1.96,
    height: 1.4,
  },
  moto: {
    id: 'moto',
    name: 'Bati 801 RR',
    type: 'moto',
    maxSpeed: 44,
    reverseSpeed: 8,
    accel: 30,
    brake: 38,
    turnSpeed: 2.85,
    primaryColor: 0x16a34a,
    secondaryColor: 0x090d16,
    length: 2.3,
    width: 0.78,
    height: 1.05,
  },
};

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1_supercar',
    title: 'Colpo alla Adder Oro',
    giver: 'Lester V.',
    description: 'Ruba la Adder Oro parcheggiata davanti al Solis Tower e portala al garage del Porto.',
    reward: 3500,
    type: 'steal_deliver',
    startX: -12,
    startZ: 24,
    targetX: -410,
    targetZ: 180,
    timeLimitSec: 150,
  },
  {
    id: 'm2_race',
    title: 'Sprint sulla Costa',
    giver: 'Hao',
    description: 'Attraversa tutti e 5 i checkpoint sul lungomare di Vespucci e sulla pista prima dello scadere del tempo.',
    reward: 3800,
    type: 'race_checkpoints',
    startX: 120,
    startZ: 545,
    targetX: 360,
    targetZ: 560,
    timeLimitSec: 130,
  },
  {
    id: 'm3_docks',
    title: 'Pulizia al Porto',
    giver: 'Tiziano',
    description: "Elimina i 6 trafficanti armati nell'area industriale dell'Aeroporto/Porto.",
    reward: 4500,
    type: 'eliminate',
    startX: -415,
    startZ: -175,
    targetX: -435,
    targetZ: 220,
  },
  {
    id: 'm4_getaway',
    title: 'Fuga ad Alta Tensione',
    giver: 'Marco',
    description: "Scatta l'allarme: sopravvivi e azzera un livello di ricercato a 3 stelle!",
    reward: 5000,
    type: 'escape_wanted',
    startX: 120,
    startZ: -120,
    targetX: 120,
    targetZ: -120,
  },
  {
    id: 'm5_stunt',
    title: 'Salto Acrobatico Solis',
    giver: 'Dom',
    description: 'Prendi la rampa sul lungomare o sulla pista ad almeno 115 km/h e vola in cielo!',
    reward: 3200,
    type: 'stunt_jump',
    startX: 0,
    startZ: 560,
    targetX: 0,
    targetZ: 560,
  },
];

export const RADIO_STATIONS: { id: RadioStationId; name: string; genre: string }[] = [
  { id: 'los_solis', name: 'Radio Los Solis', genre: 'West Coast Groove' },
  { id: 'vinewood', name: 'Soliswood FM', genre: 'Synthwave Tramonto' },
  { id: 'rebel', name: 'Channel X Rebel', genre: 'Rock Urbano' },
  { id: 'off', name: 'Radio Spenta', genre: 'Silenzio' },
];
