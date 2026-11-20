import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { soundManager } from './audio';
import { CharacterRig, createCharacterRig, createVehicleRig, VehicleRig } from './models';
import { MultiplayerClient, MultiplayerShotEvent } from './multiplayer';
import { WORLD_PROPERTIES } from './properties';
import { WALK_IN_STORES, WalkInStore } from './stores';
import {
  createContactShadowTexture,
  createGlowSpriteTexture,
  createNameplateTexture,
  createSkyGradientTexture,
} from './textures';
import {
  ActiveMissionState,
  BuildingBox,
  CHARACTERS,
  CharacterId,
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  HudSnapshot,
  InteractiveZone,
  MinimapBlip,
  MISSIONS,
  OnlineChatMessage,
  OnlinePlayerState,
  RadioStationId,
  TimeOfDay,
  VEHICLE_SPECS,
  VehicleSpec,
  WEAPONS,
  WeaponId,
  WORLD_BOUNDS,
} from './types';
import { buildLosSolisWorld, getDistrictAt, ROAD_COORDS, WorldData } from './world';

const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _toSun = new THREE.Vector3();

const SoCalGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uHeatAmount: { value: 0.45 },
    uWarmth: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uHeatAmount;
    uniform float uWarmth;
    varying vec2 vUv;

    void main() {
      // Subtle horizon-banded asphalt heat haze shimmer
      float horizonBand = smoothstep(0.08, 0.48, vUv.y) * (1.0 - smoothstep(0.48, 0.72, vUv.y));
      float wave = sin(vUv.y * 135.0 - uTime * 8.5) * cos(vUv.x * 55.0 + uTime * 3.2);
      vec2 uv = vUv + vec2(wave * 0.00055 * uHeatAmount * horizonBand, 0.0);

      vec4 tex = texture2D(tDiffuse, uv);
      vec3 col = tex.rgb;

      // Subtle 35mm optical peripheral depth-of-field softness keeping center tack-sharp
      vec2 centered = vUv - 0.5;
      float edgeDist = length(centered);
      float dofMix = smoothstep(0.38, 0.92, edgeDist) * 0.28;
      vec3 blurCol = (
        texture2D(tDiffuse, uv + vec2(0.0014, 0.0008)).rgb +
        texture2D(tDiffuse, uv - vec2(0.0014, 0.0008)).rgb +
        texture2D(tDiffuse, uv + vec2(-0.0012, 0.0012)).rgb +
        texture2D(tDiffuse, uv - vec2(-0.0012, 0.0012)).rgb
      ) * 0.25;
      col = mix(col, blurCol, dofMix);

      // Southern California golden-hour lift/gamma/gain color grading
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.92, 0.96, 1.06);
      vec3 highlightTint = mix(vec3(1.0), vec3(1.10, 1.01, 0.87), uWarmth);
      col *= mix(shadowTint, highlightTint, smoothstep(0.12, 0.82, luma));

      // Vibrant contrast & saturation punch
      col = mix(vec3(luma), col, 1.12);

      // Subtle 35mm optical lens vignette
      float vignette = smoothstep(0.96, 0.36, edgeDist);
      col *= mix(0.85, 1.0, vignette);

      gl_FragColor = vec4(col, tex.a);
    }
  `,
};

interface CharacterRuntime {
  id: CharacterId;
  x: number;
  y: number;
  z: number;
  vy: number;
  heading: number;
  health: number;
  armor: number;
  special: number;
  walkPhase: number;
  rig: CharacterRig;
}

interface VehicleRuntime {
  uid: string;
  spec: VehicleSpec;
  rig: VehicleRig;
  x: number;
  y: number;
  z: number;
  vy: number;
  heading: number;
  speed: number;
  steerAngle: number;
  health: number;
  occupiedByPlayer: boolean;
  hasDriver: boolean;
  isTraffic: boolean;
  isPolice: boolean;
  trafficDirX: number;
  trafficDirZ: number;
  sirenOn: boolean;
  exploded: boolean;
  airborneTime: number;
  maxAirSpeedKmh: number;
  isMissionTarget?: boolean;
  turboUpgraded?: boolean;
}

interface PedRuntime {
  uid: string;
  rig: CharacterRig;
  x: number;
  y: number;
  z: number;
  heading: number;
  health: number;
  walkPhase: number;
  dirX: number;
  dirZ: number;
  kind: 'civilian' | 'police' | 'gang';
  fleeing: boolean;
  fireCooldown: number;
  deadTimer: number;
}

interface EnemyBullet {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
}

interface RemotePlayerRuntime {
  id: string;
  name: string;
  characterId: CharacterId;
  x: number;
  y: number;
  z: number;
  heading: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetHeading: number;
  inVehicle: boolean;
  vehicleSpecId: string | null;
  sirenOn: boolean;
  weaponId: WeaponId;
  health: number;
  isDodging: boolean;
  walkPhase: number;
  charRig: CharacterRig;
  vehicleRig: VehicleRig | null;
  activeVehSpecId: string | null;
  nameSprite: THREE.Sprite;
  root: THREE.Group;
}

interface PickupRuntime {
  uid: string;
  mesh: THREE.Mesh;
  x: number;
  z: number;
  kind: 'cash' | 'health' | 'armor' | 'ammo';
  amount: number;
  life: number;
}

interface ProjectileTracer {
  mesh: THREE.Mesh;
  life: number;
}

interface ThrownGrenade {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
}

interface ExplosionEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface InputState {
  joyX: number;
  joyY: number;
  sprint: boolean;
  firing: boolean;
  aiming: boolean;
  gas: boolean;
  brake: boolean;
  handbrake: boolean;
}

export class LosSolisEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private sunOffset = new THREE.Vector3(-110, 34, 58);
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gradePass: ShaderPass | null = null;
  private world!: WorldData;
  private shadowTex: THREE.Texture;
  private glowTex: THREE.Texture;

  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  private menuMode = true;
  private menuShowcaseGroup: THREE.Group | null = null;

  private characters = new Map<CharacterId, CharacterRuntime>();
  private activeCharId: CharacterId = 'marco';
  private vehicles: VehicleRuntime[] = [];
  private peds: PedRuntime[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private remotePlayers = new Map<string, RemotePlayerRuntime>();
  private pickups: PickupRuntime[] = [];
  private tracers: ProjectileTracer[] = [];
  private grenades: ThrownGrenade[] = [];
  private explosions: ExplosionEffect[] = [];
  private smokePuffs: SmokePuff[] = [];
  private smokeAccum = 0;
  private muzzleTimer = 0;

  private activeVehicle: VehicleRuntime | null = null;
  private cash = 5400;
  private cashDelta = 0;
  private cashDeltaTimer = 0;
  private damageFlash = 0;
  private isDead = false;
  private deathTimer = 0;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private dodgeDirX = 0;
  private dodgeDirZ = 1;
  private wantedLevel = 0;
  private wantedTimer = 0;
  private policeSpotted = false;
  private lastKnownX = 0;
  private lastKnownZ = 0;
  private currentWeapon: WeaponId = 'pistol';
  private ammo: Record<WeaponId, number> = {
    fists: 0,
    pistol: 24,
    smg: 30,
    shotgun: 6,
    rifle: 20,
    grenade: 2,
  };
  private unlockedWeapons = new Set<WeaponId>(['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'grenade']);
  private ownedProperties = new Set<string>(
    WORLD_PROPERTIES.filter((p) => p.price === 0).map((p) => p.id)
  );
  private propertyCooldowns = new Map<string, number>();
  private insideStoreId: string | null = null;
  private robbedStores = new Map<string, number>();
  private lastFireTime = 0;
  private specialActive = false;
  private timeScale = 1;

  private timeOfDay: TimeOfDay = 'sunset';
  private gameMinutes = 17 * 60 + 25;
  private radioStation: RadioStationId = 'los_solis';

  private cameraYaw = Math.PI;
  private cameraPitch = 0.34;
  private cameraDistMode = 0;
  private switchAnim: {
    active: boolean;
    phase: number;
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
  } = { active: false, phase: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0 };

  private activeMission: ActiveMissionState | null = null;
  private completedMissions = new Set<string>();
  private missionCheckpoints: { x: number; z: number }[] = [];
  private missionBeaconMesh: THREE.Group | null = null;
  private waypoint: { x: number; z: number } | null = null;
  private waypointMesh: THREE.Group | null = null;

  private statusBanner: HudSnapshot['statusBanner'] = null;
  private statusBannerTimer = 0;
  private toastText: string | null = null;
  private toastTimer = 0;

  private multiplayer: MultiplayerClient;
  private onlineMode = false;
  private onlineConnected = false;
  private onlineRoom = 'PUBBLICA';
  private onChatMessageCb?: (msg: OnlineChatMessage) => void;

  public input: InputState = {
    joyX: 0,
    joyY: 0,
    sprint: false,
    firing: false,
    aiming: false,
    gas: false,
    brake: false,
    handbrake: false,
  };
  private keys = new Set<string>();

  private onHudUpdate: (snap: HudSnapshot) => void;
  private onOpenStoreCb?: (store: WalkInStore) => void;
  private hudEmitAccum = 0;
  private policeSpawnTimer = 0;
  private uidCounter = 1;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onChatMessage?: (msg: OnlineChatMessage) => void,
    onOpenStore?: (store: WalkInStore) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onChatMessageCb = onChatMessage;
    this.onOpenStoreCb = onOpenStore;

    this.multiplayer = new MultiplayerClient({
      onConnectionChange: (connected, _selfId, room) => {
        this.onlineConnected = connected;
        this.onlineRoom = room;
        if (connected && this.onlineMode) {
          this.showToast(`Connesso alla stanza ${room}`);
        }
        this.emitHud();
      },
      onPlayersSnapshot: (players) => this.syncRemotePlayers(players),
      onPlayerLeft: (id) => this.removeRemotePlayer(id),
      onChatMessage: (msg) => {
        this.onChatMessageCb?.(msg);
      },
      onCombatShot: (ev) => this.handleRemoteShot(ev),
    });

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.25, 1450);

    this.hemiLight = new THREE.HemisphereLight(0xfed7aa, 0x3b3556, 0.82);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffb878, 2.35);
    this.sunLight.position.set(-110, 34, 58);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(this.isSoftwareGl ? 1024 : 2048, this.isSoftwareGl ? 1024 : 2048);
    const d = 72;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 280;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.62);
    this.rimLight.position.set(70, 46, -65);
    this.scene.add(this.rimLight);

    this.shadowTex = createContactShadowTexture();
    this.glowTex = createGlowSpriteTexture();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.world = buildLosSolisWorld(this.scene, maxAniso, !this.isSoftwareGl);

    if (!this.isSoftwareGl) {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.19, 0.42, 0.92);
      composer.addPass(bloom);
      const grade = new ShaderPass(SoCalGradeShader);
      composer.addPass(grade);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloomPass = bloom;
      this.gradePass = grade;
    }

    this.initProtagonists();
    this.initVehicles();
    this.initPedestrians();
    this.initMissionHelpers();
    this.applyTimeOfDay(this.timeOfDay);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud();
    this.tick();
  }

  public setMenuMode(active: boolean) {
    this.menuMode = active;
    if (this.menuShowcaseGroup) {
      this.menuShowcaseGroup.visible = active;
    }
    if (!active) {
      const ch = this.getActiveChar();
      this.camera.position.set(ch.x, 4.2, ch.z + 8);
    }
  }

  public applySettings(next: GameSettings) {
    this.settings = { ...next };
    if (this.timeOfDay !== next.timeOfDay) {
      this.applyTimeOfDay(next.timeOfDay);
    }
    this.radioStation = next.defaultRadio;
    if (this.activeVehicle) {
      soundManager.setRadioStation(this.radioStation);
    }
    soundManager.setMuted(next.muted);
    soundManager.setVolumes(next.sfxVolume, next.radioVolume);

    if (!this.isSoftwareGl) {
      const maxDpr = next.graphicsQuality === 'low' ? 1 : next.graphicsQuality === 'medium' ? 1.5 : 2;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
      this.sunLight.castShadow = next.graphicsQuality !== 'low';
      this.renderer.shadowMap.enabled = next.graphicsQuality !== 'low';
      if (this.bloomPass) {
        this.bloomPass.enabled = next.graphicsQuality === 'high';
      }
      if (this.composer) {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.composer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
        this.composer.setSize(w, h);
      }
    }
    this.camera.far = next.graphicsQuality === 'low' ? 760 : next.graphicsQuality === 'medium' ? 1100 : 1500;
    this.camera.updateProjectionMatrix();

    // Update traffic count dynamically
    const desiredTraffic = next.trafficDensity === 'low' ? 14 : next.trafficDensity === 'normal' ? 28 : 42;
    const currentTraffic = this.vehicles.filter((v) => v.isTraffic && !v.isPolice);
    if (currentTraffic.length < desiredTraffic) {
      const specs = ['banshee', 'banshee_orange', 'gauntlet_matte', 'gauntlet', 'sandking', 'moto', 'police'];
      for (let i = currentTraffic.length; i < desiredTraffic; i++) {
        const isHoriz = i % 2 === 0;
        const laneOffset = i % 4 < 2 ? 3.8 : -3.8;
        const roadLine = ROAD_COORDS[i % ROAD_COORDS.length];
        const posAlong = -460 + ((i * 89) % 920);
        const x = isHoriz ? posAlong : roadLine + laneOffset;
        const z = isHoriz ? roadLine + laneOffset : posAlong;
        const dir = laneOffset > 0 ? 1 : -1;
        const heading = Math.atan2(isHoriz ? dir : 0, isHoriz ? 0 : dir);
        const v = this.spawnVehicle(specs[i % specs.length], x, z, heading, true, true);
        v.trafficDirX = isHoriz ? dir : 0;
        v.trafficDirZ = isHoriz ? 0 : dir;
        v.speed = 13 + (i % 4) * 2.2;
      }
    } else if (currentTraffic.length > desiredTraffic) {
      let toRemove = currentTraffic.length - desiredTraffic;
      for (let i = this.vehicles.length - 1; i >= 0 && toRemove > 0; i--) {
        const v = this.vehicles[i];
        if (v.isTraffic && !v.isPolice && !v.occupiedByPlayer) {
          this.scene.remove(v.rig.root);
          this.vehicles.splice(i, 1);
          toRemove--;
        }
      }
    }

    this.emitHud();
  }

  public setOnlineMode(enabled: boolean, playerName: string, room: string) {
    this.onlineMode = enabled;
    const cleanRoom = room.trim().toUpperCase() || 'PUBBLICA';
    this.onlineRoom = cleanRoom;

    if (enabled) {
      const ch = this.getActiveChar();
      const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
      const py = this.activeVehicle ? this.activeVehicle.y : ch.y;
      const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
      const heading = this.activeVehicle ? this.activeVehicle.heading : ch.heading;
      this.multiplayer.connect(playerName, this.activeCharId, cleanRoom, { x: px, y: py, z: pz, heading });
    } else {
      this.multiplayer.disconnect();
      this.clearAllRemotePlayers();
    }
    this.emitHud();
  }

  public sendOnlineChat(text: string) {
    if (!this.onlineMode) return;
    this.multiplayer.sendChat(text);
  }

  private clearAllRemotePlayers() {
    for (const rp of this.remotePlayers.values()) {
      this.scene.remove(rp.root);
    }
    this.remotePlayers.clear();
  }

  private removeRemotePlayer(id: string) {
    const rp = this.remotePlayers.get(id);
    if (rp) {
      this.scene.remove(rp.root);
      this.remotePlayers.delete(id);
    }
  }

  private syncRemotePlayers(players: OnlinePlayerState[]) {
    const selfId = this.multiplayer.getSelfId();
    const seen = new Set<string>();

    for (const p of players) {
      if (p.id === selfId) continue;
      seen.add(p.id);

      let rp = this.remotePlayers.get(p.id);
      if (!rp) {
        const root = new THREE.Group();
        const prof = CHARACTERS[p.characterId] || CHARACTERS.marco;
        const charRig = createCharacterRig(prof, this.shadowTex, !this.isSoftwareGl);
        root.add(charRig.root);

        const tex = createNameplateTexture(p.name, '#22d3ee');
        const nameSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
        );
        nameSprite.scale.set(2.2, 0.55, 1);
        nameSprite.position.set(0, 2.35, 0);
        root.add(nameSprite);

        root.position.set(p.x, p.y, p.z);
        this.scene.add(root);

        rp = {
          id: p.id,
          name: p.name,
          characterId: p.characterId,
          x: p.x,
          y: p.y,
          z: p.z,
          heading: p.heading,
          targetX: p.x,
          targetY: p.y,
          targetZ: p.z,
          targetHeading: p.heading,
          inVehicle: p.inVehicle,
          vehicleSpecId: p.vehicleSpecId,
          sirenOn: p.sirenOn,
          weaponId: p.weaponId,
          health: p.health,
          isDodging: p.isDodging,
          walkPhase: 0,
          charRig,
          vehicleRig: null,
          activeVehSpecId: null,
          nameSprite,
          root,
        };
        this.remotePlayers.set(p.id, rp);
      }

      rp.targetX = p.x;
      rp.targetY = p.y;
      rp.targetZ = p.z;
      rp.targetHeading = p.heading;
      rp.inVehicle = p.inVehicle;
      rp.sirenOn = p.sirenOn;
      rp.weaponId = p.weaponId;
      rp.health = p.health;
      rp.isDodging = p.isDodging;

      if (p.inVehicle && p.vehicleSpecId && rp.activeVehSpecId !== p.vehicleSpecId) {
        if (rp.vehicleRig) {
          rp.root.remove(rp.vehicleRig.root);
        }
        const spec = VEHICLE_SPECS[p.vehicleSpecId] || VEHICLE_SPECS.banshee;
        const vRig = createVehicleRig(spec, this.shadowTex, this.glowTex, !this.isSoftwareGl);
        vRig.driverGroup.visible = true;
        rp.root.add(vRig.root);
        rp.vehicleRig = vRig;
        rp.activeVehSpecId = p.vehicleSpecId;
      }

      rp.charRig.root.visible = !p.inVehicle;
      rp.charRig.weaponMesh.visible = !p.inVehicle && p.weaponId !== 'fists';
      if (rp.vehicleRig) {
        rp.vehicleRig.root.visible = p.inVehicle;
      }
      rp.nameSprite.position.y = p.inVehicle ? 2.65 : 2.35;
    }

    for (const id of Array.from(this.remotePlayers.keys())) {
      if (!seen.has(id)) {
        this.removeRemotePlayer(id);
      }
    }
  }

  private handleRemoteShot(ev: MultiplayerShotEvent) {
    const start = new THREE.Vector3(ev.fromX, ev.fromY, ev.fromZ);
    const end = new THREE.Vector3(ev.toX, ev.toY, ev.toZ);
    const dist = start.distanceTo(end);
    if (dist > 0.2) {
      const tracerGeo = new THREE.CylinderGeometry(0.035, 0.035, dist, 4);
      tracerGeo.rotateX(Math.PI / 2);
      const tracerMesh = new THREE.Mesh(
        tracerGeo,
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
      );
      tracerMesh.position.lerpVectors(start, end, 0.5);
      tracerMesh.lookAt(end);
      this.scene.add(tracerMesh);
      this.tracers.push({ mesh: tracerMesh, life: 0.09 });
    }

    const selfId = this.multiplayer.getSelfId();
    if (selfId && ev.targetPlayerId === selfId && ev.damage > 0 && !this.isDead && this.dodgeTimer <= 0.08) {
      this.damagePlayer(ev.damage * 0.45);
    }
  }

  private initProtagonists() {
    (['marco', 'luca', 'tiziano'] as CharacterId[]).forEach((id) => {
      const prof = CHARACTERS[id];
      const rig = createCharacterRig(prof, this.shadowTex, !this.isSoftwareGl);
      rig.root.position.set(prof.startX, 0, prof.startZ);
      this.scene.add(rig.root);
      this.characters.set(id, {
        id,
        x: prof.startX,
        y: 0,
        z: prof.startZ,
        vy: 0,
        heading: 0,
        health: 100,
        armor: id === 'marco' ? 50 : 25,
        special: 100,
        walkPhase: 0,
        rig,
      });
    });

    const active = this.getActiveChar();
    this.camera.position.set(active.x, 4.2, active.z + 8);

    // Build dedicated 3-protagonist & 2-car golden-hour Soliswood Overlook showcase for menuMode
    const showcase = new THREE.Group();
    const muscleShow = createVehicleRig(VEHICLE_SPECS.gauntlet_matte, this.shadowTex, this.glowTex, !this.isSoftwareGl);
    muscleShow.root.position.set(-42.5, 0, -574.5);
    muscleShow.root.rotation.y = -2.35;
    showcase.add(muscleShow.root);

    const sportShow = createVehicleRig(VEHICLE_SPECS.banshee_orange, this.shadowTex, this.glowTex, !this.isSoftwareGl);
    sportShow.root.position.set(-37.8, 0, -574.2);
    sportShow.root.rotation.y = -2.55;
    showcase.add(sportShow.root);

    const marcoShow = createCharacterRig(CHARACTERS.marco, this.shadowTex, !this.isSoftwareGl);
    marcoShow.root.position.set(-41.2, 0, -577.2);
    marcoShow.root.rotation.y = Math.PI - 0.12;
    marcoShow.leftArm.rotation.z = 0.08;
    marcoShow.rightArm.rotation.z = -0.06;
    showcase.add(marcoShow.root);

    const lucaShow = createCharacterRig(CHARACTERS.luca, this.shadowTex, !this.isSoftwareGl);
    lucaShow.root.position.set(-38.6, 0, -577.5);
    lucaShow.root.rotation.y = Math.PI + 0.04;
    lucaShow.leftArm.rotation.x = -0.75;
    lucaShow.leftArm.rotation.z = 0.48;
    lucaShow.rightArm.rotation.x = -0.75;
    lucaShow.rightArm.rotation.z = -0.48;
    showcase.add(lucaShow.root);

    const tizianoShow = createCharacterRig(CHARACTERS.tiziano, this.shadowTex, !this.isSoftwareGl);
    tizianoShow.root.position.set(-35.6, 0, -576.9);
    tizianoShow.root.rotation.y = Math.PI + 0.14;
    showcase.add(tizianoShow.root);

    showcase.visible = this.menuMode;
    this.scene.add(showcase);
    this.menuShowcaseGroup = showcase;
  }

  private initVehicles() {
    const parked: [string, number, number, number][] = [
      ['banshee_orange', -19, 26, Math.PI / 2],
      ['gauntlet_matte', -4, 34, 0],
      ['moto', -14, 15, Math.PI / 4],
      ['sandking', 128, 420, -Math.PI / 2],
      ['police', 108, -72, Math.PI],
      ['police', -24, 34, 0],
      ['banshee', -410, -238, 0],
      ['adder_gold', -6, 46, Math.PI / 2],
      ['banshee', -428, 415, 0], // Airport runway supercar!
      ['moto', 215, -80, -Math.PI / 3], // Central Park moto
      ['sandking', 310, -220, Math.PI / 2], // Stadio Solis SUV
    ];
    for (const [specId, x, z, h] of parked) {
      this.spawnVehicle(specId, x, z, h, false, false);
    }

    // AI Traffic cruising on the huge 9x9 road grid
    const trafficSpecs = ['banshee', 'banshee_orange', 'gauntlet_matte', 'gauntlet', 'sandking', 'moto', 'police'];
    for (let i = 0; i < 28; i++) {
      const isHoriz = i % 2 === 0;
      const laneOffset = i % 4 < 2 ? 3.8 : -3.8;
      const roadLine = ROAD_COORDS[i % ROAD_COORDS.length];
      const posAlong = -460 + ((i * 97) % 920);
      const x = isHoriz ? posAlong : roadLine + laneOffset;
      const z = isHoriz ? roadLine + laneOffset : posAlong;
      const dir = laneOffset > 0 ? 1 : -1;
      const dirX = isHoriz ? dir : 0;
      const dirZ = isHoriz ? 0 : dir;
      const heading = Math.atan2(dirX, dirZ);
      const specId = trafficSpecs[i % trafficSpecs.length];
      const v = this.spawnVehicle(specId, x, z, heading, true, true);
      v.trafficDirX = dirX;
      v.trafficDirZ = dirZ;
      v.speed = 13 + (i % 4) * 2.2;
    }
  }

  private spawnVehicle(
    specId: string,
    x: number,
    z: number,
    heading: number,
    isTraffic: boolean,
    hasDriver: boolean
  ): VehicleRuntime {
    const spec = VEHICLE_SPECS[specId] || VEHICLE_SPECS.banshee;
    const rig = createVehicleRig(spec, this.shadowTex, this.glowTex, !this.isSoftwareGl);
    rig.root.position.set(x, 0, z);
    rig.root.rotation.y = heading;
    rig.driverGroup.visible = hasDriver;
    if (rig.headlightBeams) {
      rig.headlightBeams.visible = this.timeOfDay === 'night' || this.timeOfDay === 'sunset';
    }
    this.scene.add(rig.root);

    const v: VehicleRuntime = {
      uid: `veh_${this.uidCounter++}`,
      spec,
      rig,
      x,
      y: 0,
      z,
      vy: 0,
      heading,
      speed: 0,
      steerAngle: 0,
      health: 100,
      occupiedByPlayer: false,
      hasDriver,
      isTraffic,
      isPolice: spec.type === 'police',
      trafficDirX: Math.sin(heading),
      trafficDirZ: Math.cos(heading),
      sirenOn: false,
      exploded: false,
      airborneTime: 0,
      maxAirSpeedKmh: 0,
    };
    this.vehicles.push(v);
    return v;
  }

  private initPedestrians() {
    const outfits = [
      { jacketColor: 0x3b82f6, pantsColor: 0x1e293b, skinColor: 0xd9a077, hairColor: 0x262626 },
      { jacketColor: 0xec4899, pantsColor: 0x334155, skinColor: 0xf1c27d, hairColor: 0x713f12 },
      { jacketColor: 0xf59e0b, pantsColor: 0x1f2937, skinColor: 0x8d5524, hairColor: 0x111827 },
      { jacketColor: 0x10b981, pantsColor: 0x1e293b, skinColor: 0xe0ac69, hairColor: 0x451a03 },
    ];
    for (let i = 0; i < 42; i++) {
      const roadLine = ROAD_COORDS[i % ROAD_COORDS.length];
      const side = i % 2 === 0 ? 11.2 : -11.2;
      const along = -480 + ((i * 71) % 960);
      const horiz = i % 3 === 0;
      const x = horiz ? along : roadLine + side;
      const z = horiz ? roadLine + side : along;
      this.spawnPed(x, z, 'civilian', outfits[i % outfits.length]);
    }
  }

  private spawnPed(
    x: number,
    z: number,
    kind: 'civilian' | 'police' | 'gang',
    customOutfit?: { jacketColor: number; pantsColor: number; skinColor: number; hairColor: number }
  ): PedRuntime {
    const outfit =
      kind === 'police'
        ? { jacketColor: 0x1d4ed8, pantsColor: 0x0f172a, skinColor: 0xd9a077, hairColor: 0x111827, hasCap: true }
        : kind === 'gang'
        ? { jacketColor: 0x6b21a8, pantsColor: 0x1f2937, skinColor: 0xc68642, hairColor: 0x111827, hasSunglasses: true }
        : customOutfit || { jacketColor: 0x64748b, pantsColor: 0x1f2937, skinColor: 0xd9a077, hairColor: 0x262626 };

    const rig = createCharacterRig(outfit, this.shadowTex, !this.isSoftwareGl);
    if (kind === 'gang' || (kind === 'police' && this.wantedLevel > 0)) {
      rig.weaponMesh.visible = true;
    }
    rig.root.position.set(x, 0, z);
    this.scene.add(rig.root);

    const ang = Math.random() * Math.PI * 2;
    const ped: PedRuntime = {
      uid: `ped_${this.uidCounter++}`,
      rig,
      x,
      y: 0,
      z,
      heading: ang,
      health: kind === 'gang' ? 95 : kind === 'police' ? 90 : 60,
      walkPhase: Math.random() * 6,
      dirX: Math.sin(ang),
      dirZ: Math.cos(ang),
      kind,
      fleeing: false,
      fireCooldown: 0.7,
      deadTimer: 0,
    };
    this.peds.push(ped);
    return ped;
  }

  private initMissionHelpers() {
    const wpGroup = new THREE.Group();
    const wpRing = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    wpRing.rotation.x = -Math.PI / 2;
    wpRing.position.y = 0.1;
    const wpBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 48, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    wpBeam.position.y = 24;
    wpGroup.add(wpRing, wpBeam);
    wpGroup.visible = false;
    this.scene.add(wpGroup);
    this.waypointMesh = wpGroup;

    const mGroup = new THREE.Group();
    const mRing = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 4.1, 28),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    mRing.rotation.x = -Math.PI / 2;
    mRing.position.y = 0.12;
    const mBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    mBeam.position.y = 20;
    mGroup.add(mRing, mBeam);
    mGroup.visible = false;
    this.scene.add(mGroup);
    this.missionBeaconMesh = mGroup;
  }

  private updateEnvironmentMap(tod: TimeOfDay) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();

    const zenithColor =
      tod === 'sunset' ? 0x35254d : tod === 'night' ? 0x050a18 : tod === 'morning' ? 0x2563eb : 0x0284c7;
    const horizonColor =
      tod === 'sunset' ? 0xf5a45b : tod === 'night' ? 0x1e293b : tod === 'morning' ? 0xfde68a : 0xbae6fd;
    const groundColor = tod === 'night' ? 0x0f172a : tod === 'sunset' ? 0x5c4f44 : 0x475569;

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 16),
      new THREE.MeshBasicMaterial({ color: zenithColor, side: THREE.BackSide })
    );
    envScene.add(dome);

    const horizonRing = new THREE.Mesh(
      new THREE.CylinderGeometry(18, 18, 8, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: horizonColor, side: THREE.BackSide })
    );
    horizonRing.position.y = 0;
    envScene.add(horizonRing);

    const floorDisc = new THREE.Mesh(
      new THREE.CircleGeometry(19, 24),
      new THREE.MeshBasicMaterial({ color: groundColor, side: THREE.DoubleSide })
    );
    floorDisc.rotation.x = -Math.PI / 2;
    floorDisc.position.y = -4;
    envScene.add(floorDisc);

    if (tod !== 'night') {
      const sunOrb = new THREE.Mesh(
        new THREE.SphereGeometry(3.4, 12, 10),
        new THREE.MeshBasicMaterial({ color: tod === 'sunset' ? 0xffd27d : 0xfffbeb })
      );
      sunOrb.position.copy(this.sunOffset).normalize().multiplyScalar(14);
      envScene.add(sunOrb);
    }

    const rt = pmrem.fromScene(envScene, 0.035);
    this.envRenderTarget?.dispose();
    this.envRenderTarget = rt;
    this.scene.environment = rt.texture;
    pmrem.dispose();
  }

  public applyTimeOfDay(tod: TimeOfDay) {
    this.timeOfDay = tod;
    const oldSkyTex = this.world.skyMat.map;
    this.world.skyMat.map = createSkyGradientTexture(tod);
    this.world.skyMat.needsUpdate = true;
    oldSkyTex?.dispose();

    const beamsVisible = tod === 'night' || tod === 'sunset';
    for (const v of this.vehicles) {
      if (v.rig.headlightBeams) v.rig.headlightBeams.visible = beamsVisible;
    }

    const sunMat = this.world.sunDisc.material as THREE.MeshBasicMaterial;
    if (tod === 'morning') {
      this.scene.background = new THREE.Color(0x93c5fd);
      this.scene.fog = new THREE.FogExp2(0xdfd6c7, 0.00095);
      this.sunLight.color.setHex(0xfef3c7);
      this.sunLight.intensity = 2.05;
      this.sunOffset.set(95, 58, -65);
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x525d6d);
      this.hemiLight.intensity = 0.85;
      this.world.sunDisc.position.set(580, 320, -480);
      sunMat.color.setHex(0xfef9c3);
      this.world.godRayGroup.visible = true;
      this.world.godRayMat.color.setHex(0xfef3c7);
      this.world.godRayMat.opacity = 0.22;
      this.world.cloudMat.color.setHex(0xfff1db);
      this.world.cloudMat.opacity = 0.56;
      this.world.dustMat.color.setHex(0xfef3c7);
      this.world.dustMat.opacity = 0.34;
      this.renderer.toneMappingExposure = 1.12;
      if (this.gradePass) {
        this.gradePass.uniforms.uHeatAmount.value = 0.28;
        this.gradePass.uniforms.uWarmth.value = 0.55;
      }
      this.gameMinutes = 8 * 60 + 30;
    } else if (tod === 'day') {
      this.scene.background = new THREE.Color(0x60a5fa);
      this.scene.fog = new THREE.FogExp2(0x9ecae8, 0.0008);
      this.sunLight.color.setHex(0xfffbeb);
      this.sunLight.intensity = 2.4;
      this.sunOffset.set(45, 118, -45);
      this.hemiLight.color.setHex(0x93c5fd);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 0.94;
      this.world.sunDisc.position.set(240, 620, -340);
      sunMat.color.setHex(0xfffbeb);
      this.world.godRayGroup.visible = true;
      this.world.godRayMat.color.setHex(0xfffbeb);
      this.world.godRayMat.opacity = 0.14;
      this.world.cloudMat.color.setHex(0xffffff);
      this.world.cloudMat.opacity = 0.65;
      this.world.dustMat.color.setHex(0xf8fafc);
      this.world.dustMat.opacity = 0.25;
      this.renderer.toneMappingExposure = 1.1;
      if (this.gradePass) {
        this.gradePass.uniforms.uHeatAmount.value = 0.52;
        this.gradePass.uniforms.uWarmth.value = 0.3;
      }
      this.gameMinutes = 13 * 60 + 15;
    } else if (tod === 'sunset') {
      // Southern California Late-Afternoon Golden Hour (natural sunlit roads & warm coastal haze, zero purple tint)
      this.scene.background = new THREE.Color(0xe89c62);
      this.scene.fog = new THREE.FogExp2(0xe2a06c, 0.00086);
      this.sunLight.color.setHex(0xffd29a);
      this.sunLight.intensity = 2.85;
      this.sunOffset.set(-65, 36, 130);
      this.hemiLight.color.setHex(0xffe8c8);
      this.hemiLight.groundColor.setHex(0x6b5b4e);
      this.hemiLight.intensity = 1.04;
      this.world.sunDisc.position.set(-260, 165, 580);
      sunMat.color.setHex(0xffe4a0);
      this.world.godRayGroup.visible = true;
      this.world.godRayMat.color.setHex(0xffcb85);
      this.world.godRayMat.opacity = 0.32;
      this.world.cloudMat.color.setHex(0xffd4aa);
      this.world.cloudMat.opacity = 0.68;
      this.world.dustMat.color.setHex(0xfde68a);
      this.world.dustMat.opacity = 0.42;
      this.renderer.toneMappingExposure = 1.16;
      if (this.gradePass) {
        this.gradePass.uniforms.uHeatAmount.value = 0.42;
        this.gradePass.uniforms.uWarmth.value = 0.88;
      }
      this.gameMinutes = 18 * 60 + 25;
    } else {
      this.scene.background = new THREE.Color(0x0b1220);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.0018);
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.86;
      this.sunOffset.set(40, 82, -40);
      this.hemiLight.color.setHex(0x1e3a8a);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.56;
      this.world.sunDisc.position.set(340, 480, -520);
      sunMat.color.setHex(0xe2e8f0);
      this.world.godRayGroup.visible = false;
      this.world.cloudMat.color.setHex(0x334155);
      this.world.cloudMat.opacity = 0.35;
      this.world.dustMat.color.setHex(0x93c5fd);
      this.world.dustMat.opacity = 0.14;
      this.renderer.toneMappingExposure = 1.08;
      if (this.gradePass) {
        this.gradePass.uniforms.uHeatAmount.value = 0.0;
        this.gradePass.uniforms.uWarmth.value = 0.0;
      }
      this.gameMinutes = 23 * 60 + 10;
    }
    this.updateEnvironmentMap(tod);
    this.emitHud();
  }

  private getActiveChar(): CharacterRuntime {
    return this.characters.get(this.activeCharId)!;
  }

  public setTimeScale(scale: number) {
    this.timeScale = scale;
  }

  public selectWeapon(id: WeaponId) {
    if (!this.unlockedWeapons.has(id) || this.isDead) return;
    if (id !== 'fists' && this.ammo[id] <= 0) {
      this.showToast(`Colpi ${WEAPONS[id].shortName} esauriti! Compra munizioni in Armeria`);
      return;
    }
    this.currentWeapon = id;
    const ch = this.getActiveChar();
    ch.rig.weaponMesh.visible = id !== 'fists' && !this.activeVehicle;
    this.emitHud();
  }

  public switchCharacter(id: CharacterId) {
    if (id === this.activeCharId || this.isDead) return;
    const current = this.getActiveChar();
    const target = this.characters.get(id)!;

    if (this.activeVehicle) {
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle.hasDriver = false;
      this.activeVehicle.rig.driverGroup.visible = false;
      current.x = this.activeVehicle.x + 2.2;
      current.z = this.activeVehicle.z;
      current.rig.root.visible = true;
      current.rig.root.position.set(current.x, 0, current.z);
      this.activeVehicle = null;
    }

    this.specialActive = false;
    this.wantedLevel = 0;
    this.wantedTimer = 0;
    this.policeSpotted = false;
    this.activeCharId = id;
    soundManager.playSwitchSwoosh();

    this.switchAnim = {
      active: true,
      phase: 0,
      fromX: current.x,
      fromZ: current.z,
      toX: target.x,
      toZ: target.z,
    };
    this.showToast(`Personaggio: ${CHARACTERS[id].name} ${CHARACTERS[id].surname}`);
    this.emitHud();
  }

  public triggerDodge() {
    if (this.isDead || this.activeVehicle || this.dodgeTimer > 0 || this.dodgeCooldown > 0) return;
    soundManager.unlock();
    soundManager.playDodge();

    let moveX = this.input.joyX;
    let moveY = this.input.joyY;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY -= 1;

    const camFwdX = -Math.sin(this.cameraYaw);
    const camFwdZ = -Math.cos(this.cameraYaw);
    const camRightX = Math.cos(this.cameraYaw);
    const camRightZ = -Math.sin(this.cameraYaw);

    let dx = camFwdX * moveY + camRightX * moveX;
    let dz = camFwdZ * moveY + camRightZ * moveX;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) {
      // Sideways evasive roll relative to camera when standing still
      dx = camRightX;
      dz = camRightZ;
    } else {
      dx /= len;
      dz /= len;
    }

    this.dodgeDirX = dx;
    this.dodgeDirZ = dz;
    this.dodgeTimer = 0.42;
    this.dodgeCooldown = 0.85;
    this.emitHud();
  }

  public toggleEnterExitVehicle() {
    if (this.isDead) return;
    soundManager.unlock();
    const ch = this.getActiveChar();

    if (this.activeVehicle) {
      const v = this.activeVehicle;
      v.occupiedByPlayer = false;
      v.hasDriver = false;
      v.rig.driverGroup.visible = false;
      v.sirenOn = false;
      const exitX = v.x - Math.cos(v.heading) * (v.spec.width * 0.8 + 0.9);
      const exitZ = v.z + Math.sin(v.heading) * (v.spec.width * 0.8 + 0.9);
      ch.x = exitX;
      ch.y = 0;
      ch.z = exitZ;
      ch.heading = v.heading;
      ch.rig.root.visible = true;
      ch.rig.root.position.set(ch.x, ch.y, ch.z);
      ch.rig.weaponMesh.visible = this.currentWeapon !== 'fists';
      this.activeVehicle = null;
      soundManager.setRadioStation('off');
      this.emitHud();
      return;
    }

    const nearest = this.findNearestVehicle(ch.x, ch.z, 5.4);
    if (!nearest || nearest.exploded) return;

    if (nearest.hasDriver && !nearest.occupiedByPlayer) {
      const ejectX = nearest.x + Math.cos(nearest.heading) * 2.1;
      const ejectZ = nearest.z - Math.sin(nearest.heading) * 2.1;
      const ejectedKind = nearest.isPolice ? 'police' : 'civilian';
      const ped = this.spawnPed(ejectX, ejectZ, ejectedKind);
      if (ejectedKind === 'civilian') ped.fleeing = true;
      if (nearest.isPolice) {
        this.addWanted(2);
      } else if (Math.random() < 0.35) {
        this.addWanted(1);
      }
    }

    if (nearest.isTraffic) {
      nearest.isTraffic = false;
    }

    nearest.occupiedByPlayer = true;
    nearest.hasDriver = true;
    nearest.rig.driverGroup.visible = true;
    this.activeVehicle = nearest;
    ch.rig.root.visible = false;
    soundManager.setRadioStation(this.radioStation);
    this.showToast(`Alla guida: ${nearest.spec.name}`);

    if (this.activeMission?.def.id === 'm1_supercar' && nearest.isMissionTarget) {
      this.activeMission.objectiveText = 'Porta la Adder Oro al Garage del Porto';
      this.activeMission.targetX = this.activeMission.def.targetX;
      this.activeMission.targetZ = this.activeMission.def.targetZ;
    }
    this.emitHud();
  }

  public toggleSpecialAbility() {
    if (this.isDead) return;
    const ch = this.getActiveChar();
    if (!this.specialActive && ch.special < 20) {
      this.showToast('Abilità speciale scarica');
      return;
    }
    this.specialActive = !this.specialActive;
    if (this.specialActive) {
      this.showToast(`${CHARACTERS[ch.id].specialName} attivato!`);
    }
    this.emitHud();
  }

  public triggerJumpOrHorn() {
    if (this.isDead) return;
    soundManager.unlock();
    if (this.activeVehicle) {
      if (this.activeVehicle.spec.hasSiren) {
        this.activeVehicle.sirenOn = !this.activeVehicle.sirenOn;
      } else {
        soundManager.playHorn();
      }
      this.emitHud();
      return;
    }
    const ch = this.getActiveChar();
    if (ch.y <= 0.05) {
      ch.vy = 7.4;
    }
  }

  public triggerFireOnce() {
    if (this.isDead) return;
    soundManager.unlock();
    this.performFire();
  }

  public cycleCameraDistance() {
    this.cameraDistMode = (this.cameraDistMode + 1) % 3;
    const labels = ['Visuale Media', 'Visuale Larga', 'Visuale Ravvicinata'];
    this.showToast(labels[this.cameraDistMode]);
  }

  public orbitCamera(deltaX: number, deltaY: number) {
    const sens = this.settings.cameraSensitivity || 1.0;
    this.cameraYaw -= deltaX * 0.0065 * sens;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + deltaY * 0.0045 * sens, 0.08, 1.05);
  }

  public setRadioStation(station: RadioStationId) {
    this.radioStation = station;
    if (this.activeVehicle) {
      soundManager.unlock();
      soundManager.setRadioStation(station);
    }
    this.emitHud();
  }

  public setWaypoint(x: number | null, z: number | null) {
    if (x === null || z === null) {
      this.waypoint = null;
      if (this.waypointMesh) this.waypointMesh.visible = false;
    } else {
      this.waypoint = { x, z };
      if (this.waypointMesh) {
        this.waypointMesh.position.set(x, 0, z);
        this.waypointMesh.visible = true;
      }
      this.showToast('Destinazione GPS impostata');
    }
    this.emitHud();
  }

  public fastTravelTo(x: number, z: number, label?: string) {
    if (this.isDead) return;
    const ch = this.getActiveChar();
    const clampedX = THREE.MathUtils.clamp(x, WORLD_BOUNDS.minX + 8, WORLD_BOUNDS.maxX - 8);
    const clampedZ = THREE.MathUtils.clamp(z, WORLD_BOUNDS.minZ + 8, WORLD_BOUNDS.maxZ - 8);
    if (this.activeVehicle) {
      this.activeVehicle.x = clampedX;
      this.activeVehicle.z = clampedZ;
      this.activeVehicle.y = 0;
      this.activeVehicle.vy = 0;
      this.activeVehicle.speed = 0;
      this.activeVehicle.rig.root.position.set(clampedX, 0, clampedZ);
    }
    ch.x = clampedX;
    ch.z = clampedZ;
    ch.y = 0;
    ch.vy = 0;
    ch.rig.root.position.set(clampedX, 0, clampedZ);
    this.setWaypoint(null, null);
    this.showToast(label ? `Arrivato a: ${label}` : 'Viaggio rapido completato');
    this.emitHud();
  }

  public callMechanic(specId: string) {
    const ch = this.getActiveChar();
    const sx = ch.x + Math.sin(ch.heading + 0.8) * 6.5;
    const sz = ch.z + Math.cos(ch.heading + 0.8) * 6.5;
    const clampedX = THREE.MathUtils.clamp(sx, WORLD_BOUNDS.minX + 10, WORLD_BOUNDS.maxX - 10);
    const clampedZ = THREE.MathUtils.clamp(sz, WORLD_BOUNDS.minZ + 10, WORLD_BOUNDS.maxZ - 10);
    const v = this.spawnVehicle(specId, clampedX, clampedZ, ch.heading, false, false);
    this.showToast(`Meccanico: ${v.spec.name} consegnata vicino a te!`);
    this.emitHud();
  }

  public buyWeaponOrAmmo(weaponId: WeaponId) {
    const def = WEAPONS[weaponId];
    if (def.ammoPack === 0) return;
    if (this.cash < def.ammoPrice) {
      this.showToast('Contanti insufficienti!');
      return;
    }
    this.addCash(-def.ammoPrice);
    this.unlockedWeapons.add(weaponId);
    this.ammo[weaponId] = Math.min(def.maxAmmo, this.ammo[weaponId] + def.ammoPack);
    this.currentWeapon = weaponId;
    soundManager.playCash();
    this.showToast(`Acquistato: +${def.ammoPack} colpi ${def.shortName}`);
    this.emitHud();
  }

  public buyArmorAndHeal() {
    if (this.cash < 400) {
      this.showToast('Servono $400!');
      return;
    }
    this.addCash(-400);
    const ch = this.getActiveChar();
    ch.health = 100;
    ch.armor = 100;
    soundManager.playCash();
    this.showToast('Salute e Giubbotto al 100%');
    this.emitHud();
  }

  public repairAndClearWanted() {
    if (this.activeVehicle) {
      this.activeVehicle.health = 100;
      this.activeVehicle.exploded = false;
      const randomPalette = [0xe11d48, 0x0284c7, 0xf59e0b, 0x10b981, 0x7c3aed, 0xf8fafc];
      const nextColor = randomPalette[Math.floor(Math.random() * randomPalette.length)];
      if (!this.activeVehicle.isPolice) {
        this.activeVehicle.rig.bodyMat.color.setHex(nextColor);
      }
    }
    this.wantedLevel = 0;
    this.wantedTimer = 0;
    this.policeSpotted = false;
    soundManager.playCash();
    this.showToast('Veicolo riparato e livello ricercato azzerato!');
    this.emitHud();
  }

  public buyStoreSnack(healthGain: number, specialGain: number, price: number, label: string) {
    if (this.cash < price) {
      this.showToast(`Servono $${price} per ${label}!`);
      return;
    }
    this.addCash(-price);
    const ch = this.getActiveChar();
    ch.health = Math.min(100, ch.health + healthGain);
    ch.special = Math.min(100, ch.special + specialGain);
    soundManager.playCash();
    this.showToast(`Acquistato: ${label}`);
    this.emitHud();
  }

  public customizeCharacterStyle(
    opts: {
      jacketColor?: number;
      pantsColor?: number;
      toggleAccessory?: 'sunglasses' | 'cap' | 'chain';
      hairColor?: number;
    },
    price: number,
    label: string
  ) {
    if (this.cash < price) {
      this.showToast(`Servono $${price} per ${label}!`);
      return;
    }
    this.addCash(-price);
    const ch = this.getActiveChar();
    if (opts.jacketColor !== undefined) {
      ch.rig.jacketMat.map = null;
      ch.rig.jacketMat.color.setHex(opts.jacketColor);
      ch.rig.jacketMat.needsUpdate = true;
    }
    if (opts.pantsColor !== undefined) {
      ch.rig.pantsMat.color.setHex(opts.pantsColor);
    }
    if (opts.hairColor !== undefined) {
      ch.rig.hairMat.color.setHex(opts.hairColor);
      ch.health = 100;
    }
    if (opts.toggleAccessory === 'sunglasses') {
      ch.rig.glassesGroup.visible = !ch.rig.glassesGroup.visible;
    } else if (opts.toggleAccessory === 'cap') {
      ch.rig.capGroup.visible = !ch.rig.capGroup.visible;
    } else if (opts.toggleAccessory === 'chain') {
      ch.rig.chainMesh.visible = !ch.rig.chainMesh.visible;
    }
    soundManager.playCash();
    this.showToast(`Applicato: ${label}`);
    this.emitHud();
  }

  public customizeVehicleAtLsc(
    opts: { repair?: boolean; colorHex?: number; turbo?: boolean; clearWanted?: boolean },
    price: number,
    label: string
  ) {
    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
    const targetVeh = this.activeVehicle ?? this.findNearestVehicle(px, pz, 12);

    if (!targetVeh && (opts.colorHex !== undefined || opts.turbo)) {
      this.showToast('Porta o parcheggia un veicolo dentro Los Santos Customs!');
      return;
    }
    if (price > 0 && this.cash < price) {
      this.showToast(`Servono $${price}!`);
      return;
    }
    if (price > 0) this.addCash(-price);

    if (targetVeh) {
      if (opts.repair) {
        targetVeh.health = 100;
        targetVeh.exploded = false;
      }
      if (opts.colorHex !== undefined && !targetVeh.isPolice) {
        targetVeh.rig.bodyMat.color.setHex(opts.colorHex);
      }
      if (opts.turbo) {
        targetVeh.turboUpgraded = true;
      }
    }
    if (opts.clearWanted) {
      this.wantedLevel = 0;
      this.wantedTimer = 0;
      this.policeSpotted = false;
    }
    soundManager.playCash();
    this.showToast(`LSC: ${label}`);
    this.emitHud();
  }

  public robStore(storeId: string, storeName: string) {
    const now = performance.now();
    const readyAt = this.robbedStores.get(storeId) ?? 0;
    if (now < readyAt) {
      const wait = Math.ceil((readyAt - now) / 1000);
      this.showToast(`Cassa vuota! Riprova tra ${wait}s`);
      return;
    }
    const loot = 280 + Math.floor(Math.random() * 380);
    this.robbedStores.set(storeId, now + 45000);
    this.addCash(loot);
    this.addWanted(2);
    soundManager.playCash();
    this.showToast(`Rapina a ${storeName}: +$${loot}! Scappa dalla Polizia!`);
    this.emitHud();
  }

  public startMission(missionId: string) {
    if (this.isDead) return;
    const def = MISSIONS.find((m) => m.id === missionId);
    if (!def) return;

    this.missionCheckpoints = [];

    if (def.type === 'steal_deliver') {
      const gold = this.spawnVehicle('adder_gold', -10, 42, Math.PI / 2, false, false);
      gold.isMissionTarget = true;
      this.activeMission = {
        def,
        objectiveText: 'Ruba la Adder Oro davanti alla Solis Tower',
        progress: 0,
        total: 1,
        timeLeftSec: def.timeLimitSec || 150,
        targetX: gold.x,
        targetZ: gold.z,
      };
    } else if (def.type === 'race_checkpoints') {
      this.missionCheckpoints = [
        { x: 120, z: 560 },
        { x: 360, z: 560 },
        { x: 360, z: 120 },
        { x: 0, z: 120 },
        { x: -360, z: 240 },
      ];
      this.activeMission = {
        def,
        objectiveText: 'Raggiungi il Checkpoint 1 / 5',
        progress: 0,
        total: 5,
        timeLeftSec: def.timeLimitSec || 130,
        targetX: this.missionCheckpoints[0].x,
        targetZ: this.missionCheckpoints[0].z,
      };
    } else if (def.type === 'eliminate') {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        this.spawnPed(def.targetX + Math.cos(ang) * 18, def.targetZ + Math.sin(ang) * 18, 'gang');
      }
      this.activeMission = {
        def,
        objectiveText: 'Elimina i trafficanti al Porto (0/6)',
        progress: 0,
        total: 6,
        timeLeftSec: null,
        targetX: def.targetX,
        targetZ: def.targetZ,
      };
    } else if (def.type === 'escape_wanted') {
      this.addWanted(3);
      this.activeMission = {
        def,
        objectiveText: 'Semina la Polizia e azzera le 3 Stelle!',
        progress: 0,
        total: 1,
        timeLeftSec: null,
        targetX: this.getActiveChar().x,
        targetZ: this.getActiveChar().z,
      };
    } else if (def.type === 'stunt_jump') {
      this.activeMission = {
        def,
        objectiveText: 'Prendi la Rampa Costiera (o Aeroporto) a 115+ km/h',
        progress: 0,
        total: 1,
        timeLeftSec: null,
        targetX: 0,
        targetZ: 560,
      };
    }

    this.showToast(`Missione avviata: ${def.title}`);
    this.emitHud();
  }

  public cancelMission() {
    this.activeMission = null;
    if (this.missionBeaconMesh) this.missionBeaconMesh.visible = false;
    this.emitHud();
  }

  public interactWithNearbyZone() {
    if (this.isDead) return;
    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
    const zone = this.findNearestZone(px, pz);
    if (!zone) return;

    if (zone.type === 'store' && zone.storeId) {
      const store = WALK_IN_STORES.find((s) => s.id === zone.storeId);
      if (store) {
        this.onOpenStoreCb?.(store);
      }
    } else if (zone.type === 'ammu') {
      this.buyArmorAndHeal();
    } else if (zone.type === 'paynspray') {
      this.repairAndClearWanted();
    } else if (zone.type === 'hospital') {
      ch.health = 100;
      soundManager.playCash();
      this.showToast('Cure mediche completate: Salute 100%');
    } else if (zone.type === 'mission' && zone.missionId) {
      this.startMission(zone.missionId);
    } else if (zone.type === 'property' && zone.propertyId) {
      const prop = WORLD_PROPERTIES.find((p) => p.id === zone.propertyId);
      if (prop) {
        if (!this.ownedProperties.has(prop.id) && prop.price > 0) {
          if (this.cash < prop.price) {
            this.showToast(`Servono $${prop.price.toLocaleString('it-IT')} per acquistare ${prop.name}`);
            this.emitHud();
            return;
          }
          this.addCash(-prop.price);
          this.ownedProperties.add(prop.id);
          soundManager.playCash();
          this.showToast(`Proprietà acquistata: ${prop.name}!`);
          this.emitHud();
          return;
        }

        const now = performance.now();
        const readyAt = this.propertyCooldowns.get(prop.id) ?? 0;

        if (prop.effect === 'repair_clear') {
          this.repairAndClearWanted();
        } else if (prop.effect === 'armor_ammo') {
          ch.health = 100;
          ch.armor = 100;
          this.ammo.pistol = Math.min(WEAPONS.pistol.maxAmmo, this.ammo.pistol + 24);
          this.ammo.smg = Math.min(WEAPONS.smg.maxAmmo, this.ammo.smg + 60);
          this.ammo.shotgun = Math.min(WEAPONS.shotgun.maxAmmo, this.ammo.shotgun + 12);
          this.ammo.rifle = Math.min(WEAPONS.rifle.maxAmmo, this.ammo.rifle + 45);
          soundManager.playCash();
          this.showToast(`${prop.name}: Salute, Giubbotto & Munizioni al massimo!`);
        } else if (prop.effect === 'vehicle_spawn' && prop.spawnVehicleId) {
          if (this.activeVehicle) {
            this.activeVehicle.health = 100;
            this.activeVehicle.exploded = false;
          }
          const sx = THREE.MathUtils.clamp(px + 4.8, WORLD_BOUNDS.minX + 10, WORLD_BOUNDS.maxX - 10);
          const sz = THREE.MathUtils.clamp(pz + 3.2, WORLD_BOUNDS.minZ + 10, WORLD_BOUNDS.maxZ - 10);
          const v = this.spawnVehicle(prop.spawnVehicleId, sx, sz, ch.heading, false, false);
          soundManager.playCash();
          this.showToast(`${prop.name}: ${v.spec.name} pronta!`);
        } else if (prop.effect === 'heal_special') {
          ch.health = 100;
          ch.special = 100;
          if (prop.incomeBonus > 0 && now >= readyAt) {
            this.addCash(prop.incomeBonus);
            this.propertyCooldowns.set(prop.id, now + 15000);
            this.showToast(`${prop.name}: Salute 100% + $${prop.incomeBonus}!`);
          } else {
            this.showToast(`${prop.name}: Salute & Speciale al 100%!`);
          }
          soundManager.playCash();
        } else {
          if (now < readyAt) {
            const waitSec = Math.ceil((readyAt - now) / 1000);
            this.showToast(`${prop.name}: Prossimo incasso tra ${waitSec}s`);
          } else {
            const bonus = prop.incomeBonus || 500;
            this.addCash(bonus);
            this.propertyCooldowns.set(prop.id, now + 15000);
            soundManager.playCash();
            this.showToast(`${prop.name}: Incassati +$${bonus.toLocaleString('it-IT')}!`);
          }
        }
      }
    }
    this.emitHud();
  }

  private findNearestVehicle(x: number, z: number, maxDist: number): VehicleRuntime | null {
    let best: VehicleRuntime | null = null;
    let bestD = maxDist * maxDist;
    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const dx = v.x - x;
      const dz = v.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) {
        bestD = d2;
        best = v;
      }
    }
    return best;
  }

  private findNearestZone(x: number, z: number): InteractiveZone | null {
    let best: InteractiveZone | null = null;
    let bestD2 = Infinity;
    for (const zItem of this.world.zones) {
      const dx = zItem.x - x;
      const dz = zItem.z - z;
      const d2 = dx * dx + dz * dz;
      const reach = zItem.type === 'store' && this.insideStoreId === zItem.storeId ? zItem.radius + 2.4 : zItem.radius + 1.2;
      if (d2 <= reach * reach && d2 < bestD2) {
        bestD2 = d2;
        best = zItem;
      }
    }
    return best;
  }

  private addCash(delta: number) {
    this.cash = Math.max(0, this.cash + delta);
    this.cashDelta = delta;
    this.cashDeltaTimer = 2.2;
  }

  private addWanted(stars: number) {
    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
    const next = Math.min(5, Math.max(this.wantedLevel, stars));
    if (next > this.wantedLevel) {
      this.wantedLevel = next;
    }
    this.lastKnownX = px;
    this.lastKnownZ = pz;
    this.policeSpotted = true;
    this.wantedTimer = 18;
  }

  private showToast(text: string) {
    this.toastText = text;
    this.toastTimer = 3.0;
  }

  private showBanner(type: NonNullable<HudSnapshot['statusBanner']>['type'], title: string, subtitle: string, dur = 3.2) {
    this.statusBanner = { type, title, subtitle };
    this.statusBannerTimer = dur;
  }

  private performFire() {
    const ch = this.getActiveChar();
    if (this.activeVehicle || this.isDead) return;

    const now = performance.now();
    const wDef = WEAPONS[this.currentWeapon];
    if (now - this.lastFireTime < wDef.fireRateMs) return;

    if (this.currentWeapon !== 'fists' && this.ammo[this.currentWeapon] <= 0) {
      this.showToast(`Munizioni ${wDef.shortName} esauriti!`);
      this.currentWeapon = 'fists';
      ch.rig.weaponMesh.visible = false;
      this.emitHud();
      return;
    }

    this.lastFireTime = now;
    if (this.currentWeapon !== 'fists') {
      this.ammo[this.currentWeapon] = Math.max(0, this.ammo[this.currentWeapon] - 1);
      ch.rig.muzzleFlash.visible = true;
      this.muzzleTimer = 0.055;
    }

    soundManager.playWeaponSound(this.currentWeapon);

    let aimHeading = ch.heading;
    if (this.settings.autoAim) {
      let bestTargetDist = wDef.range;
      for (const ped of this.peds) {
        if (ped.health <= 0) continue;
        const dx = ped.x - ch.x;
        const dz = ped.z - ch.z;
        const dist = Math.hypot(dx, dz);
        if (dist < bestTargetDist) {
          const angTo = Math.atan2(dx, dz);
          const diff = Math.abs(Math.atan2(Math.sin(angTo - ch.heading), Math.cos(angTo - ch.heading)));
          if (diff < 1.15 || dist < 9) {
            bestTargetDist = dist;
            aimHeading = angTo;
          }
        }
      }
      for (const rp of this.remotePlayers.values()) {
        const dx = rp.x - ch.x;
        const dz = rp.z - ch.z;
        const dist = Math.hypot(dx, dz);
        if (dist < bestTargetDist) {
          const angTo = Math.atan2(dx, dz);
          const diff = Math.abs(Math.atan2(Math.sin(angTo - ch.heading), Math.cos(angTo - ch.heading)));
          if (diff < 1.15 || dist < 9) {
            bestTargetDist = dist;
            aimHeading = angTo;
          }
        }
      }
    }
    ch.heading = aimHeading;
    ch.rig.rightArm.rotation.x = -1.35;

    if (wDef.isExplosive) {
      const gMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.4, metalness: 0.5 })
      );
      gMesh.position.set(ch.x, ch.y + 1.4, ch.z);
      this.scene.add(gMesh);
      this.grenades.push({
        mesh: gMesh,
        x: ch.x,
        y: ch.y + 1.4,
        z: ch.z,
        vx: Math.sin(aimHeading) * 18,
        vy: 6.5,
        vz: Math.cos(aimHeading) * 18,
        fuse: 1.5,
      });
      this.addWanted(2);
      return;
    }

    const dmgMult = this.specialActive && ch.id === 'tiziano' ? 2.0 : 1.0;
    const pellets = wDef.pellets || 1;
    const originX = ch.x + Math.sin(aimHeading) * 0.5;
    const originY = ch.y + 1.35;
    const originZ = ch.z + Math.cos(aimHeading) * 0.5;

    for (let p = 0; p < pellets; p++) {
      const ang = aimHeading + (Math.random() - 0.5) * wDef.spread;
      const dirX = Math.sin(ang);
      const dirZ = Math.cos(ang);

      let hitDist = wDef.range;
      let hitPed: PedRuntime | null = null;
      let hitVeh: VehicleRuntime | null = null;
      let hitRemote: RemotePlayerRuntime | null = null;

      for (const ped of this.peds) {
        if (ped.health <= 0) continue;
        const px = ped.x - originX;
        const pz = ped.z - originZ;
        const proj = px * dirX + pz * dirZ;
        if (proj > 0 && proj < hitDist) {
          const perp = Math.abs(px * dirZ - pz * dirX);
          if (perp < 0.72) {
            hitDist = proj;
            hitPed = ped;
            hitVeh = null;
            hitRemote = null;
          }
        }
      }

      for (const rp of this.remotePlayers.values()) {
        const rx = rp.x - originX;
        const rz = rp.z - originZ;
        const proj = rx * dirX + rz * dirZ;
        if (proj > 0 && proj < hitDist) {
          const perp = Math.abs(rx * dirZ - rz * dirX);
          if (perp < (rp.inVehicle ? 1.35 : 0.75)) {
            hitDist = proj;
            hitRemote = rp;
            hitPed = null;
            hitVeh = null;
          }
        }
      }

      for (const v of this.vehicles) {
        if (v.exploded) continue;
        const vx = v.x - originX;
        const vz = v.z - originZ;
        const proj = vx * dirX + vz * dirZ;
        if (proj > 0 && proj < hitDist) {
          const perp = Math.abs(vx * dirZ - vz * dirX);
          if (perp < v.spec.width * 0.75) {
            hitDist = proj;
            hitVeh = v;
            hitPed = null;
            hitRemote = null;
          }
        }
      }

      if (this.currentWeapon !== 'fists') {
        const tracerGeo = new THREE.CylinderGeometry(0.03, 0.03, hitDist, 4);
        tracerGeo.rotateX(Math.PI / 2);
        const tracerMesh = new THREE.Mesh(
          tracerGeo,
          new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
        );
        tracerMesh.position.set(originX + dirX * hitDist * 0.5, originY, originZ + dirZ * hitDist * 0.5);
        tracerMesh.rotation.y = ang;
        this.scene.add(tracerMesh);
        this.tracers.push({ mesh: tracerMesh, life: 0.07 });

        if (this.onlineMode && this.onlineConnected) {
          this.multiplayer.sendShot({
            fromX: originX,
            fromY: originY,
            fromZ: originZ,
            toX: originX + dirX * hitDist,
            toY: originY,
            toZ: originZ + dirZ * hitDist,
            targetPlayerId: hitRemote ? hitRemote.id : null,
            damage: hitRemote ? wDef.damage * dmgMult : 0,
          });
        }
      }

      if (hitPed) {
        this.damagePed(hitPed, wDef.damage * dmgMult, true);
      } else if (hitVeh) {
        hitVeh.health -= wDef.damage * 0.45 * dmgMult;
        if (hitVeh.isPolice && hitVeh.hasDriver && !hitVeh.occupiedByPlayer && hitVeh.health < 55) {
          hitVeh.hasDriver = false;
          hitVeh.rig.driverGroup.visible = false;
          hitVeh.sirenOn = false;
          hitVeh.isTraffic = false;
        }
        if (hitVeh.health <= 0 && !hitVeh.exploded) {
          this.explodeVehicle(hitVeh, true);
        }
        if (this.currentWeapon !== 'fists' || hitVeh.hasDriver || hitVeh.isPolice) {
          this.addWanted(1);
        }
      }
    }

    if (this.currentWeapon !== 'fists') {
      this.panicNearbyPeds(ch.x, ch.z, 26);
      if (this.ammo[this.currentWeapon] <= 0) {
        this.showToast(`Colpi ${wDef.shortName} esauriti!`);
        this.currentWeapon = 'fists';
        ch.rig.weaponMesh.visible = false;
      }
      this.emitHud();
    }
  }

  private spawnEnemyBullet(fromX: number, fromY: number, fromZ: number, targetX: number, targetY: number, targetZ: number, dmg: number) {
    const dx = targetX - fromX;
    const dy = targetY - fromY;
    const dz = targetZ - fromZ;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const spread = this.settings.policeDifficulty === 'relaxed' ? 0.14 : this.settings.policeDifficulty === 'hardcore' ? 0.04 : 0.09;
    const spd = this.settings.policeDifficulty === 'hardcore' ? 40 : 33;

    const dirX = dx / dist + (Math.random() - 0.5) * spread;
    const dirY = dy / dist;
    const dirZ = dz / dist + (Math.random() - 0.5) * spread;
    const norm = Math.hypot(dirX, dirY, dirZ) || 1;

    const bulletMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.08, 0.42, 4, 6),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    bulletMesh.position.set(fromX, fromY, fromZ);
    bulletMesh.rotation.x = Math.PI / 2;
    bulletMesh.rotation.z = -Math.atan2(dirX, dirZ);
    this.scene.add(bulletMesh);

    this.enemyBullets.push({
      mesh: bulletMesh,
      x: fromX,
      y: fromY,
      z: fromZ,
      vx: (dirX / norm) * spd,
      vy: (dirY / norm) * spd,
      vz: (dirZ / norm) * spd,
      damage: dmg,
      life: 1.75,
    });
  }

  private damagePed(ped: PedRuntime, dmg: number, byPlayer = false) {
    ped.health -= dmg;
    if (ped.kind === 'civilian') {
      ped.fleeing = true;
      if (byPlayer) this.addWanted(1);
    } else if (ped.kind === 'police') {
      if (byPlayer) this.addWanted(2);
    }

    if (ped.health <= 0) {
      ped.rig.bodyPivot.rotation.x = -Math.PI / 2;
      ped.rig.bodyPivot.position.y = 0.25;
      ped.deadTimer = 8;

      this.spawnCashPickup(ped.x, ped.z, ped.kind === 'gang' ? 250 : 95);
      if (ped.kind === 'police' || ped.kind === 'gang') {
        this.spawnAmmoPickup(ped.x + 0.65, ped.z + 0.65, 12);
      }

      if (ped.kind === 'police' && byPlayer) {
        this.addWanted(3);
      }

      if (this.activeMission?.def.type === 'eliminate' && ped.kind === 'gang') {
        this.activeMission.progress++;
        this.activeMission.objectiveText = `Elimina i trafficanti al Porto (${this.activeMission.progress}/${this.activeMission.total})`;
        if (this.activeMission.progress >= this.activeMission.total) {
          this.completeMission();
        }
      }
    }
  }

  private spawnCashPickup(x: number, z: number, amount: number) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.45 })
    );
    mesh.position.set(x, 0.35, z);
    this.scene.add(mesh);
    this.pickups.push({ uid: `pk_${this.uidCounter++}`, mesh, x, z, kind: 'cash', amount, life: 30 });
  }

  private spawnAmmoPickup(x: number, z: number, amount: number) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.26, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5 })
    );
    mesh.position.set(x, 0.35, z);
    this.scene.add(mesh);
    this.pickups.push({ uid: `pk_${this.uidCounter++}`, mesh, x, z, kind: 'ammo', amount, life: 30 });
  }

  private spawnSmokePuff(x: number, y: number, z: number, colorHex = 0xe2e8f0) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 7, 6),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.45 })
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.smokePuffs.push({ mesh, life: 0.55, maxLife: 0.55 });
  }

  private explodeAt(x: number, y: number, z: number, radius: number, maxDmg: number, byPlayer = false) {
    soundManager.playExplosion();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 })
    );
    sphere.position.set(x, Math.max(0.8, y), z);
    this.scene.add(sphere);
    this.explosions.push({ mesh: sphere, life: 0.55, maxLife: 0.55 });

    for (const ped of this.peds) {
      if (ped.health <= 0) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        this.damagePed(ped, maxDmg * (1 - d / radius), byPlayer);
      }
    }

    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < radius && d > 0.2) {
        v.health -= maxDmg * (1 - d / radius);
        if (v.health <= 0) this.explodeVehicle(v, byPlayer);
      }
    }

    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
    const pd = Math.hypot(px - x, pz - z);
    if (pd < radius) {
      this.damagePlayer(maxDmg * 0.55 * (1 - pd / radius));
    }
    if (byPlayer) {
      this.addWanted(2);
    }
  }

  private explodeVehicle(v: VehicleRuntime, byPlayer = false) {
    v.exploded = true;
    v.speed = 0;
    v.sirenOn = false;
    v.hasDriver = false;
    v.rig.driverGroup.visible = false;
    v.rig.bodyMat.color.setHex(0x1f2937);
    if (v.occupiedByPlayer) {
      this.toggleEnterExitVehicle();
      this.damagePlayer(85);
    }
    this.explodeAt(v.x, v.y + 0.8, v.z, 9.5, 130, byPlayer);
  }

  private damagePlayer(dmg: number) {
    if (this.isDead || this.menuMode) return;
    const ch = this.getActiveChar();
    const resist = this.specialActive && ch.id === 'tiziano' ? 0.4 : 1.0;
    let rem = dmg * resist;

    this.damageFlash = Math.min(1, this.damageFlash + 0.72);

    if (ch.armor > 0) {
      const absorbed = Math.min(ch.armor, rem * 0.75);
      ch.armor -= absorbed;
      rem -= absorbed;
    }
    ch.health = Math.max(0, ch.health - rem);
    if (ch.health <= 0) {
      this.triggerWasted();
    }
    this.emitHud();
  }

  private triggerWasted() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathTimer = 3.2;
    this.damageFlash = 1.0;
    this.specialActive = false;
    this.dodgeTimer = 0;

    const ch = this.getActiveChar();
    if (this.activeVehicle) {
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle.hasDriver = false;
      this.activeVehicle.rig.driverGroup.visible = false;
      ch.x = this.activeVehicle.x - Math.cos(this.activeVehicle.heading) * 2.1;
      ch.z = this.activeVehicle.z + Math.sin(this.activeVehicle.heading) * 2.1;
      ch.y = 0;
      this.activeVehicle = null;
    }

    ch.rig.root.visible = true;
    ch.rig.root.position.set(ch.x, ch.y, ch.z);
    ch.rig.bodyPivot.rotation.x = -Math.PI / 2;
    ch.rig.bodyPivot.rotation.z = 0;
    ch.rig.bodyPivot.position.y = 0.28;

    soundManager.setRadioStation('off');
    this.showBanner('wasted', 'SEI MORTO', 'Rianimazione al Centro Medico Solis (-$300)', 3.2);
    if (this.activeMission) {
      this.activeMission = null;
    }
    this.emitHud();
  }

  private respawnPlayer() {
    this.isDead = false;
    this.damageFlash = 0;
    const ch = this.getActiveChar();
    ch.health = 100;
    ch.x = 108;
    ch.z = 118;
    ch.y = 0;
    ch.vy = 0;
    ch.rig.bodyPivot.rotation.x = 0;
    ch.rig.bodyPivot.rotation.z = 0;
    ch.rig.bodyPivot.position.y = 0;
    ch.rig.root.visible = true;
    ch.rig.root.position.set(ch.x, 0, ch.z);
    this.wantedLevel = 0;
    this.wantedTimer = 0;
    this.policeSpotted = false;
    this.addCash(-300);
    this.showToast('Sei rinato al Centro Medico Solis');
    this.emitHud();
  }

  private completeMission() {
    if (!this.activeMission) return;
    const def = this.activeMission.def;
    this.completedMissions.add(def.id);
    this.addCash(def.reward);
    soundManager.playMissionPassed();
    this.showBanner('mission_passed', 'MISSIONE COMPITA', `${def.title}  ·  +$${def.reward.toLocaleString('it-IT')}`, 3.8);
    this.activeMission = null;
    if (this.missionBeaconMesh) this.missionBeaconMesh.visible = false;
    this.emitHud();
  }

  private panicNearbyPeds(x: number, z: number, radius: number) {
    for (const ped of this.peds) {
      if (ped.health <= 0) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius && ped.kind === 'civilian') {
        ped.fleeing = true;
        const ang = Math.atan2(ped.x - x, ped.z - z);
        ped.dirX = Math.sin(ang);
        ped.dirZ = Math.cos(ang);
      }
    }
  }

  private pointHitsBuilding(x: number, y: number, z: number): boolean {
    for (let i = 0; i < this.world.buildings.length; i++) {
      const b = this.world.buildings[i];
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y <= b.height) {
        return true;
      }
    }
    return false;
  }

  private hasLineOfSight(x1: number, z1: number, x2: number, z2: number): boolean {
    const dx = x2 - x1;
    const dz = z2 - z1;
    if (dx === 0 && dz === 0) return true;

    for (let i = 0; i < this.world.buildings.length; i++) {
      const b = this.world.buildings[i];
      if (b.height < 2.0) continue;

      let tmin = 0.01;
      let tmax = 0.99;

      if (Math.abs(dx) < 1e-6) {
        if (x1 < b.minX || x1 > b.maxX) continue;
      } else {
        const invX = 1 / dx;
        let t1 = (b.minX - x1) * invX;
        let t2 = (b.maxX - x1) * invX;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (Math.abs(dz) < 1e-6) {
        if (z1 < b.minZ || z1 > b.maxZ) continue;
      } else {
        const invZ = 1 / dz;
        let t1 = (b.minZ - z1) * invZ;
        let t2 = (b.maxZ - z1) * invZ;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (tmin <= tmax) {
        return false;
      }
    }
    return true;
  }

  private updateWantedSight() {
    if (this.wantedLevel <= 0 || this.isDead) {
      this.policeSpotted = false;
      return;
    }

    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;

    let spotted = false;

    for (let i = 0; i < this.peds.length; i++) {
      const ped = this.peds[i];
      if (ped.kind !== 'police' || ped.health <= 0) continue;
      if (Math.hypot(px - ped.x, pz - ped.z) < 62 && this.hasLineOfSight(ped.x, ped.z, px, pz)) {
        spotted = true;
        break;
      }
    }

    if (!spotted) {
      for (let i = 0; i < this.vehicles.length; i++) {
        const v = this.vehicles[i];
        if (!v.isPolice || !v.hasDriver || v.exploded || v.occupiedByPlayer) continue;
        if (Math.hypot(px - v.x, pz - v.z) < 85 && this.hasLineOfSight(v.x, v.z, px, pz)) {
          spotted = true;
          break;
        }
      }
    }

    this.policeSpotted = spotted;
    if (spotted) {
      this.lastKnownX = px;
      this.lastKnownZ = pz;
      this.wantedTimer = 18;
    }
  }

  private resolveBuildingCollision(x: number, z: number, radius: number): { x: number; z: number; hit: boolean } {
    let nx = THREE.MathUtils.clamp(x, WORLD_BOUNDS.minX + 5, WORLD_BOUNDS.maxX - 5);
    let nz = THREE.MathUtils.clamp(z, WORLD_BOUNDS.minZ + 5, WORLD_BOUNDS.maxZ - 5);
    let hit = nx !== x || nz !== z;

    for (let i = 0; i < this.world.buildings.length; i++) {
      const b: BuildingBox = this.world.buildings[i];
      const closestX = THREE.MathUtils.clamp(nx, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(nz, b.minZ, b.maxZ);
      const dx = nx - closestX;
      const dz = nz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        hit = true;
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          nx += (dx / dist) * push;
          nz += (dz / dist) * push;
        } else {
          nx += radius;
        }
      }
    }
    return { x: nx, z: nz, hit };
  }

  private getGroundHeightAt(
    x: number,
    z: number
  ): { y: number; slopeVyBoost: number; dirX: number; dirZ: number; rampT: number } {
    for (const r of this.world.ramps) {
      const dx = x - r.cx;
      const dz = z - r.cz;
      const along = dx * r.dirX + dz * r.dirZ;
      const across = Math.abs(-dx * r.dirZ + dz * r.dirX);
      if (across <= r.width * 0.55 && Math.abs(along) <= r.length * 0.5) {
        const t = THREE.MathUtils.clamp((along + r.length * 0.5) / r.length, 0, 1);
        const y = (0.52 * t + 0.48 * t * t) * r.height;
        const slope = ((0.52 + 0.96 * t) * r.height) / r.length;
        return { y, slopeVyBoost: slope, dirX: r.dirX, dirZ: r.dirZ, rampT: t };
      }
    }
    return { y: 0, slopeVyBoost: 0, dirX: 0, dirZ: 0, rampT: 0 };
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDt = Math.min(0.05, this.clock.getDelta());
    const slowMult = this.isDead ? 0.28 : this.specialActive && this.activeCharId === 'marco' ? 0.42 : 1.0;
    const dt = rawDt * slowMult * this.timeScale;
    const elapsed = this.clock.elapsedTime;

    this.gameMinutes = (this.gameMinutes + rawDt * 2.5) % (24 * 60);

    this.updateZoneAnimations(elapsed);

    if (!this.menuMode) {
      this.updateWantedSight();
      this.updateTimers(rawDt);
      this.updatePlayer(dt);
      this.updateVehicles(dt);
      this.updatePedestrians(dt);
      this.updateEnemyBullets(dt);
      this.updatePoliceSpawns(dt);
      this.updatePickupsAndFx(dt);
      this.updateMissions(dt);
      this.updateRemotePlayers(rawDt);
      this.sendOnlineStateIfActive();

      const curCh = this.getActiveChar();
      const curX = this.activeVehicle ? this.activeVehicle.x : curCh.x;
      const curZ = this.activeVehicle ? this.activeVehicle.z : curCh.z;
      let foundStoreId: string | null = null;
      for (const s of WALK_IN_STORES) {
        if (Math.abs(curX - s.x) < s.width * 0.5 - 0.15 && Math.abs(curZ - s.z) < s.depth * 0.5 - 0.15) {
          foundStoreId = s.id;
          break;
        }
      }
      if (foundStoreId !== this.insideStoreId) {
        this.insideStoreId = foundStoreId;
        this.world.storeRoofs.forEach((roof, sid) => {
          roof.visible = sid !== foundStoreId;
        });
      }
    } else {
      this.updateVehicles(dt * 0.65);
    }

    this.updateCamera(rawDt, elapsed);

    this.world.oceanTexture.offset.x = (elapsed * 0.014) % 1;
    this.world.oceanTexture.offset.y = (elapsed * 0.009) % 1;
    this.world.oceanBumpTexture.offset.x = (-elapsed * 0.011) % 1;
    this.world.oceanBumpTexture.offset.y = (elapsed * 0.013) % 1;

    this.world.cloudGroup.rotation.y = elapsed * 0.0045;

    const ch = this.getActiveChar();
    const px = this.menuMode ? -39 : this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.menuMode ? -575 : this.activeVehicle ? this.activeVehicle.z : ch.z;
    this.world.skyDome.position.set(px, 0, pz);
    this.world.godRayGroup.position.copy(this.world.sunDisc.position).multiplyScalar(0.72);
    this.world.godRayGroup.lookAt(px, 32, pz);
    this.world.dustPoints.position.set(
      px + Math.sin(elapsed * 0.16) * 6,
      Math.sin(elapsed * 0.35) * 0.8,
      pz + Math.cos(elapsed * 0.13) * 6
    );

    this.sunLight.target.position.set(px, 0, pz);
    this.sunLight.position.set(px + this.sunOffset.x, this.sunOffset.y, pz + this.sunOffset.z);

    // Dynamic 35mm anamorphic sun flare intensity based on camera look alignment
    this.camera.getWorldDirection(_camFwd);
    _toSun.copy(this.world.sunDisc.position).normalize();
    const sunAlign = Math.max(0, _camFwd.dot(_toSun));
    const flareFactor = Math.pow(sunAlign, 3.2);
    const isDaylight = this.timeOfDay !== 'night';
    this.world.sunHalo.material.opacity = isDaylight ? 0.42 + flareFactor * 0.55 : 0.18;
    this.world.sunAnamorphicStreak.material.opacity = isDaylight ? 0.14 + flareFactor * 0.85 : 0.0;
    this.world.sunAnamorphicStreak.scale.set(420 + flareFactor * 360, 56 + flareFactor * 44, 1);

    if (this.gradePass) {
      this.gradePass.uniforms.uTime.value = elapsed;
    }

    if (this.composer && !this.isSoftwareGl && this.settings.graphicsQuality !== 'low') {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.hudEmitAccum += rawDt;
    if (this.hudEmitAccum >= 0.066) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private sendOnlineStateIfActive() {
    if (!this.onlineMode || !this.onlineConnected) return;
    const ch = this.getActiveChar();
    this.multiplayer.sendState({
      characterId: this.activeCharId,
      x: this.activeVehicle ? this.activeVehicle.x : ch.x,
      y: this.activeVehicle ? this.activeVehicle.y : ch.y,
      z: this.activeVehicle ? this.activeVehicle.z : ch.z,
      heading: this.activeVehicle ? this.activeVehicle.heading : ch.heading,
      inVehicle: !!this.activeVehicle,
      vehicleSpecId: this.activeVehicle ? this.activeVehicle.spec.id : null,
      sirenOn: this.activeVehicle?.sirenOn ?? false,
      weaponId: this.currentWeapon,
      health: ch.health,
      wantedLevel: this.wantedLevel,
      isDodging: this.dodgeTimer > 0,
    });
  }

  private updateRemotePlayers(dt: number) {
    for (const rp of this.remotePlayers.values()) {
      const prevX = rp.x;
      const prevZ = rp.z;
      rp.x = THREE.MathUtils.damp(rp.x, rp.targetX, 12, dt);
      rp.y = THREE.MathUtils.damp(rp.y, rp.targetY, 12, dt);
      rp.z = THREE.MathUtils.damp(rp.z, rp.targetZ, 12, dt);

      const diff = Math.atan2(Math.sin(rp.targetHeading - rp.heading), Math.cos(rp.targetHeading - rp.heading));
      rp.heading += diff * Math.min(1, dt * 12);

      rp.root.position.set(rp.x, rp.y, rp.z);
      if (rp.inVehicle && rp.vehicleRig) {
        rp.vehicleRig.root.rotation.y = rp.heading;
      } else {
        rp.charRig.root.rotation.y = rp.heading;
        const moved = Math.hypot(rp.x - prevX, rp.z - prevZ);
        if (moved > 0.01) {
          rp.walkPhase += moved * 2.2;
          const sw = Math.sin(rp.walkPhase) * 0.6;
          rp.charRig.leftLeg.rotation.x = sw;
          rp.charRig.rightLeg.rotation.x = -sw;
        }
        rp.charRig.bodyPivot.rotation.z = rp.isDodging ? Math.PI * 0.45 : 0;
      }
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateTimers(dt: number) {
    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    }
    if (this.dodgeCooldown > 0) {
      this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    }

    if (this.isDead) {
      this.deathTimer -= dt;
      this.damageFlash = 1.0;
      if (this.deathTimer <= 0) {
        this.respawnPlayer();
      }
    } else if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.9);
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.getActiveChar().rig.muzzleFlash.visible = false;
      }
    }

    if (this.cashDeltaTimer > 0) {
      this.cashDeltaTimer -= dt;
      if (this.cashDeltaTimer <= 0) this.cashDelta = 0;
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastText = null;
    }
    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) this.statusBanner = null;
    }

    const ch = this.getActiveChar();
    if (this.specialActive) {
      ch.special = Math.max(0, ch.special - dt * 16);
      if (ch.special <= 0) this.specialActive = false;
    } else if (!this.isDead) {
      ch.special = Math.min(100, ch.special + dt * 6);
    }

    if (this.wantedLevel > 0) {
      if (!this.policeSpotted) {
        this.wantedTimer -= dt;
        if (this.wantedTimer <= 0) {
          this.wantedLevel = 0;
          this.wantedTimer = 0;
          this.policeSpotted = false;
          this.showToast('Hai seminato la Polizia!');
          if (this.activeMission?.def.type === 'escape_wanted') {
            this.completeMission();
          }
        }
      }
    }
  }

  private updateZoneAnimations(elapsed: number) {
    this.world.zoneMeshes.forEach((group) => {
      const diamond = group.getObjectByName('beaconDiamond');
      if (diamond) {
        diamond.rotation.y = elapsed * 2.2;
        diamond.position.y = 2.4 + Math.sin(elapsed * 3) * 0.28;
      }
    });
    if (this.missionBeaconMesh?.visible) {
      this.missionBeaconMesh.rotation.y = elapsed * 1.4;
    }
  }

  private updatePlayer(dt: number) {
    const ch = this.getActiveChar();
    if (this.isDead) return;

    let moveX = this.input.joyX;
    let moveY = this.input.joyY;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY -= 1;
    moveX = THREE.MathUtils.clamp(moveX, -1, 1);
    moveY = THREE.MathUtils.clamp(moveY, -1, 1);

    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const gas = this.input.gas || moveY > 0.15;
      const brake = this.input.brake || moveY < -0.25;
      const handbrake = this.input.handbrake || this.keys.has('Space');
      const steer = Math.abs(moveX) > 0.08 ? -moveX : 0;

      const specialMult = this.specialActive && ch.id === 'luca' ? 1.38 : 1.0;
      const turboMult = specialMult * (v.turboUpgraded ? 1.22 : 1.0);
      const maxSpd = v.spec.maxSpeed * turboMult;

      if (gas) {
        v.speed = Math.min(maxSpd, v.speed + v.spec.accel * turboMult * dt);
      } else if (brake) {
        if (v.speed > 0.5) {
          v.speed = Math.max(0, v.speed - v.spec.brake * dt);
        } else {
          v.speed = Math.max(-v.spec.reverseSpeed, v.speed - v.spec.accel * 0.75 * dt);
        }
      } else {
        v.speed *= Math.exp(-1.4 * dt);
      }

      if (handbrake) {
        v.speed *= Math.exp(-3.6 * dt);
      }

      const speedFactor = Math.min(1, Math.abs(v.speed) / 8);
      const turnDir = v.speed >= -0.2 ? 1 : -1;
      const driftBoost = handbrake ? 1.35 : 1.0;
      v.steerAngle = THREE.MathUtils.damp(v.steerAngle, steer * 0.45, 10, dt);
      v.heading += steer * v.spec.turnSpeed * speedFactor * turnDir * driftBoost * dt;

      this.smokeAccum += dt;
      if ((handbrake || (Math.abs(steer) > 0.5 && Math.abs(v.speed) > 18)) && this.smokeAccum > 0.06) {
        this.smokeAccum = 0;
        const backX = v.x - Math.sin(v.heading) * (v.spec.length * 0.42);
        const backZ = v.z - Math.cos(v.heading) * (v.spec.length * 0.42);
        this.spawnSmokePuff(backX, v.y + 0.25, backZ);
      }

      soundManager.updateVehicleAudio(true, v.speed / v.spec.maxSpeed, v.sirenOn || this.wantedLevel > 0, dt);
      v.rig.taillightMat.emissiveIntensity = brake || handbrake ? 2.4 : 0.65;
      ch.x = v.x;
      ch.z = v.z;
      return;
    }

    soundManager.updateVehicleAudio(false, 0, false, dt);
    const prevChX = ch.x;
    const prevChZ = ch.z;

    if (this.dodgeTimer > 0) {
      const dodgeSpd = 15.5;
      const nextX = ch.x + this.dodgeDirX * dodgeSpd * dt;
      const nextZ = ch.z + this.dodgeDirZ * dodgeSpd * dt;
      const res = this.resolveBuildingCollision(nextX, nextZ, 0.55);
      ch.x = res.x;
      ch.z = res.z;
      const rollProg = 1 - this.dodgeTimer / 0.42;
      ch.rig.bodyPivot.rotation.z = Math.sin(rollProg * Math.PI) * 1.15;
      ch.rig.bodyPivot.position.y = Math.sin(rollProg * Math.PI) * 0.35;
    } else {
      ch.rig.bodyPivot.rotation.z = THREE.MathUtils.damp(ch.rig.bodyPivot.rotation.z, 0, 14, dt);
      ch.rig.bodyPivot.position.y = THREE.MathUtils.damp(ch.rig.bodyPivot.position.y, 0, 14, dt);

      const mag = Math.min(1, Math.hypot(moveX, moveY));
      if (mag > 0.08) {
        const sprint = this.input.sprint || this.keys.has('ShiftLeft') || mag > 0.85;
        const speed = sprint ? 9.8 : 5.4;

        const camFwdX = -Math.sin(this.cameraYaw);
        const camFwdZ = -Math.cos(this.cameraYaw);
        const camRightX = Math.cos(this.cameraYaw);
        const camRightZ = -Math.sin(this.cameraYaw);

        const dirX = camFwdX * moveY + camRightX * moveX;
        const dirZ = camFwdZ * moveY + camRightZ * moveX;
        const len = Math.hypot(dirX, dirZ) || 1;
        const nx = dirX / len;
        const nz = dirZ / len;

        const targetHeading = Math.atan2(nx, nz);
        const diff = Math.atan2(Math.sin(targetHeading - ch.heading), Math.cos(targetHeading - ch.heading));
        ch.heading += diff * Math.min(1, dt * 12);

        const nextX = ch.x + nx * speed * mag * dt;
        const nextZ = ch.z + nz * speed * mag * dt;
        const res = this.resolveBuildingCollision(nextX, nextZ, 0.55);
        ch.x = res.x;
        ch.z = res.z;

        ch.walkPhase += dt * speed * 1.9;
        const swing = Math.sin(ch.walkPhase) * 0.68;
        ch.rig.leftLeg.rotation.x = swing;
        ch.rig.rightLeg.rotation.x = -swing;
        ch.rig.leftArm.rotation.x = -swing * 0.7;
        if (!this.input.firing) {
          ch.rig.rightArm.rotation.x = THREE.MathUtils.damp(ch.rig.rightArm.rotation.x, swing * 0.7, 10, dt);
        }
      } else {
        ch.rig.leftLeg.rotation.x = THREE.MathUtils.damp(ch.rig.leftLeg.rotation.x, 0, 10, dt);
        ch.rig.rightLeg.rotation.x = THREE.MathUtils.damp(ch.rig.rightLeg.rotation.x, 0, 10, dt);
        ch.rig.leftArm.rotation.x = THREE.MathUtils.damp(ch.rig.leftArm.rotation.x, 0, 10, dt);
        if (!this.input.firing) {
          ch.rig.rightArm.rotation.x = THREE.MathUtils.damp(ch.rig.rightArm.rotation.x, 0, 10, dt);
        }
      }
    }

    if (this.input.firing) {
      this.performFire();
      ch.rig.rightArm.rotation.x = -1.45;
    }

    let ground = this.getGroundHeightAt(ch.x, ch.z);
    if (ground.y - ch.y > 1.15) {
      ch.x = prevChX;
      ch.z = prevChZ;
      ground = this.getGroundHeightAt(ch.x, ch.z);
    }
    ch.vy -= 21 * dt;
    ch.y += ch.vy * dt;
    if (ch.y <= ground.y) {
      ch.y = ground.y;
      ch.vy = 0;
    }

    ch.rig.root.position.set(ch.x, ch.y, ch.z);
    ch.rig.root.rotation.y = ch.heading;
  }

  private updateVehicles(dt: number) {
    const ch = this.getActiveChar();
    const playerX = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const playerZ = this.activeVehicle ? this.activeVehicle.z : ch.z;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.exploded) continue;

      if (!v.occupiedByPlayer) {
        if (!v.hasDriver) {
          v.speed *= Math.exp(-5.5 * dt);
          if (Math.abs(v.speed) < 0.08) v.speed = 0;
          v.sirenOn = false;
          v.rig.driverGroup.visible = false;
        } else if (v.isTraffic) {
          if (v.isPolice && this.wantedLevel > 0 && !this.menuMode) {
            v.sirenOn = true;
            const dxPlayer = playerX - v.x;
            const dzPlayer = playerZ - v.z;
            const distToPlayer = Math.hypot(dxPlayer, dzPlayer);
            const seesPlayer = distToPlayer < 85 && this.hasLineOfSight(v.x, v.z, playerX, playerZ);

            if (seesPlayer) {
              const targetAngle = Math.atan2(dxPlayer, dzPlayer);
              const diff = Math.atan2(Math.sin(targetAngle - v.heading), Math.cos(targetAngle - v.heading));
              v.heading += THREE.MathUtils.clamp(diff, -2.1 * dt, 2.1 * dt);

              if (distToPlayer > 14.5) {
                v.speed = 24 + this.wantedLevel * 2.2;
              } else {
                v.speed = 0;
                v.hasDriver = false;
                v.rig.driverGroup.visible = false;
                v.sirenOn = false;
                v.isTraffic = false;
                const exitX = v.x - Math.cos(v.heading) * 1.9;
                const exitZ = v.z + Math.sin(v.heading) * 1.9;
                this.spawnPed(exitX, exitZ, 'police');
              }
            } else {
              // Out of sight: head to last known position and patrol around it
              const dxSearch = this.lastKnownX - v.x;
              const dzSearch = this.lastKnownZ - v.z;
              const distSearch = Math.hypot(dxSearch, dzSearch);
              const angleToLast = Math.atan2(dxSearch, dzSearch);
              const targetAngle = distSearch > 22 ? angleToLast : angleToLast + Math.PI * 0.45;
              const diff = Math.atan2(Math.sin(targetAngle - v.heading), Math.cos(targetAngle - v.heading));
              v.heading += THREE.MathUtils.clamp(diff, -1.9 * dt, 1.9 * dt);
              v.speed = distSearch > 22 ? 19.5 + this.wantedLevel * 1.4 : 13.5;
            }
          } else {
            v.sirenOn = false;
            v.speed = 13.0;
            const laneHeading = Math.atan2(v.trafficDirX, v.trafficDirZ);
            const hDiff = Math.atan2(Math.sin(laneHeading - v.heading), Math.cos(laneHeading - v.heading));
            v.heading += THREE.MathUtils.clamp(hDiff, -2.5 * dt, 2.5 * dt);
            if (Math.abs(v.x) > 565) v.x = -Math.sign(v.x) * 550;
            if (Math.abs(v.z) > 565) v.z = -Math.sign(v.z) * 550;
          }
        } else {
          v.speed *= Math.exp(-3.0 * dt);
        }
      }

      const vx = Math.sin(v.heading) * v.speed;
      const vz = Math.cos(v.heading) * v.speed;
      const nextX = v.x + vx * dt;
      const nextZ = v.z + vz * dt;
      const res = this.resolveBuildingCollision(nextX, nextZ, v.spec.width * 0.58);

      if (res.hit) {
        if (v.occupiedByPlayer && Math.abs(v.speed) > 12) {
          soundManager.playCrash(Math.abs(v.speed) / 30);
          v.health -= Math.abs(v.speed) * 0.35;
          if (Math.abs(v.speed) > 25) {
            this.damagePlayer(8);
          }
        }
        v.speed *= -0.35;
        if (v.isTraffic && !v.isPolice && v.hasDriver) {
          v.heading += Math.PI * 0.5;
        }
      }
      const prevVX = v.x;
      const prevVZ = v.z;
      v.x = res.x;
      v.z = res.z;

      let g = this.getGroundHeightAt(v.x, v.z);
      // Block driving into the vertical back/side wall of a tall ramp from the wrong direction
      if (g.y - v.y > 1.35) {
        v.x = prevVX;
        v.z = prevVZ;
        if (v.occupiedByPlayer && Math.abs(v.speed) > 10) {
          soundManager.playCrash(Math.abs(v.speed) / 35);
        }
        v.speed *= -0.35;
        g = this.getGroundHeightAt(v.x, v.z);
      }

      const speedKmh = Math.abs(v.speed) * 3.6;
      const rampForwardSpeed = vx * g.dirX + vz * g.dirZ;

      if (v.y <= g.y + 0.2 && g.slopeVyBoost > 0 && rampForwardSpeed > 4) {
        const launchBoost = g.rampT >= 0.65 && rampForwardSpeed > 12 ? 1.32 : 1.05;
        v.vy = Math.max(v.vy, rampForwardSpeed * g.slopeVyBoost * launchBoost);
      }
      v.vy -= 20 * dt;
      v.y += v.vy * dt;

      if (v.y > g.y + 0.35) {
        v.airborneTime += dt;
        v.maxAirSpeedKmh = Math.max(v.maxAirSpeedKmh, speedKmh);
      } else {
        if (v.airborneTime > 0.65 && v.occupiedByPlayer) {
          const bonus = Math.round(v.airborneTime * 450);
          this.addCash(bonus);
          soundManager.playCash();
          this.showBanner('stunt', 'SALTO ACROBATICO!', `Tempo in volo ${v.airborneTime.toFixed(1)}s  ·  +$${bonus}`, 2.6);

          if (this.activeMission?.def.type === 'stunt_jump' && v.maxAirSpeedKmh >= 110) {
            this.completeMission();
          }
        }
        v.airborneTime = 0;
        v.maxAirSpeedKmh = 0;
      }

      if (v.y <= g.y) {
        v.y = g.y;
        v.vy = 0;
      }

      for (let j = i + 1; j < this.vehicles.length; j++) {
        const o = this.vehicles[j];
        if (o.exploded) continue;
        const dx = v.x - o.x;
        const dz = v.z - o.z;
        const minDist = (v.spec.width + o.spec.width) * 0.62;
        const d2 = dx * dx + dz * dz;
        if (d2 < minDist * minDist && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const overlap = (minDist - d) * 0.5;
          v.x += (dx / d) * overlap;
          v.z += (dz / d) * overlap;
          o.x -= (dx / d) * overlap;
          o.z -= (dz / d) * overlap;
          if ((v.occupiedByPlayer || o.occupiedByPlayer) && Math.abs(v.speed - o.speed) > 10) {
            soundManager.playCrash(0.7);
            v.speed *= 0.6;
            o.speed *= 0.6;
          }
        }
      }

      if (Math.abs(v.speed) > 6 && !this.menuMode) {
        for (const ped of this.peds) {
          if (ped.health <= 0) continue;
          if (Math.hypot(ped.x - v.x, ped.z - v.z) < v.spec.width * 0.72) {
            this.damagePed(ped, 100, v.occupiedByPlayer);
            if (v.occupiedByPlayer) {
              this.addWanted(1);
            }
          }
        }
      }

      const wheelSpin = (v.speed / 0.35) * dt;
      for (const w of v.rig.wheels) {
        w.rotation.x += wheelSpin;
      }
      for (const fp of v.rig.frontWheelPivots) {
        fp.rotation.y = v.steerAngle;
      }

      if (v.rig.sirenRed && v.rig.sirenBlue) {
        const redMat = v.rig.sirenRed.material as THREE.MeshStandardMaterial;
        const blueMat = v.rig.sirenBlue.material as THREE.MeshStandardMaterial;
        if (v.sirenOn && (v.hasDriver || v.occupiedByPlayer)) {
          const flash = Math.floor(this.clock.elapsedTime * 10) % 2 === 0;
          redMat.emissiveIntensity = flash ? 3.5 : 0.15;
          blueMat.emissiveIntensity = flash ? 0.15 : 3.5;
          if (v.rig.sirenRedGlow) v.rig.sirenRedGlow.material.opacity = flash ? 0.85 : 0;
          if (v.rig.sirenBlueGlow) v.rig.sirenBlueGlow.material.opacity = flash ? 0 : 0.85;
        } else {
          redMat.emissiveIntensity = 0.2;
          blueMat.emissiveIntensity = 0.2;
          if (v.rig.sirenRedGlow) v.rig.sirenRedGlow.material.opacity = 0;
          if (v.rig.sirenBlueGlow) v.rig.sirenBlueGlow.material.opacity = 0;
        }
      }

      v.rig.root.position.set(v.x, v.y, v.z);
      v.rig.root.rotation.y = v.heading;
      v.rig.chassisGroup.rotation.x = THREE.MathUtils.clamp(-v.vy * 0.03, -0.25, 0.25);
    }
  }

  private updatePedestrians(dt: number) {
    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const py = this.activeVehicle ? this.activeVehicle.y + 1.1 : ch.y + 1.15;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;

    const rateMult = this.settings.policeDifficulty === 'relaxed' ? 1.45 : this.settings.policeDifficulty === 'hardcore' ? 0.72 : 1.0;
    const dmgVal = this.settings.policeDifficulty === 'relaxed' ? 6 : this.settings.policeDifficulty === 'hardcore' ? 13 : 9;

    for (let i = this.peds.length - 1; i >= 0; i--) {
      const ped = this.peds[i];
      if (ped.health <= 0) {
        ped.deadTimer -= dt;
        if (ped.deadTimer <= 0) {
          this.scene.remove(ped.rig.root);
          this.peds.splice(i, 1);
        }
        continue;
      }

      const distToPlayer = Math.hypot(px - ped.x, pz - ped.z);

      if (ped.kind === 'police' && this.wantedLevel > 0 && distToPlayer > 42) {
        let enteredCruiser = false;
        for (const v of this.vehicles) {
          if (v.isPolice && !v.exploded && !v.occupiedByPlayer && !v.hasDriver) {
            const dCar = Math.hypot(v.x - ped.x, v.z - ped.z);
            if (dCar < 6.5) {
              v.hasDriver = true;
              v.rig.driverGroup.visible = true;
              v.isTraffic = true;
              this.scene.remove(ped.rig.root);
              this.peds.splice(i, 1);
              enteredCruiser = true;
              break;
            }
          }
        }
        if (enteredCruiser) continue;
      }

      if ((ped.kind === 'police' && this.wantedLevel > 0) || ped.kind === 'gang') {
        ped.rig.weaponMesh.visible = true;
        const seesPlayer =
          ped.kind === 'gang'
            ? distToPlayer < 55
            : distToPlayer < 62 && this.hasLineOfSight(ped.x, ped.z, px, pz);

        if (seesPlayer) {
          const ang = Math.atan2(px - ped.x, pz - ped.z);
          ped.heading = ang;
          ped.dirX = Math.sin(ang);
          ped.dirZ = Math.cos(ang);

          if (distToPlayer > 7.5) {
            const spd = ped.kind === 'police' ? 5.6 : 4.6;
            const res = this.resolveBuildingCollision(ped.x + ped.dirX * spd * dt, ped.z + ped.dirZ * spd * dt, 0.5);
            ped.x = res.x;
            ped.z = res.z;
            ped.walkPhase += dt * 9;
          }

          ped.fireCooldown -= dt;
          if (ped.fireCooldown <= 0 && distToPlayer < 42 && !this.isDead) {
            ped.fireCooldown = (ped.kind === 'police' ? 1.1 : 1.3) * rateMult;
            ped.rig.rightArm.rotation.x = -1.4;
            this.spawnEnemyBullet(
              ped.x + Math.sin(ped.heading) * 0.55,
              1.35,
              ped.z + Math.cos(ped.heading) * 0.55,
              px,
              py,
              pz,
              ped.kind === 'police' ? dmgVal : dmgVal + 1
            );
          }
        } else if (ped.kind === 'police') {
          // Cannot see player: search around last known position instead of homing onto hidden player
          ped.rig.rightArm.rotation.x = THREE.MathUtils.damp(ped.rig.rightArm.rotation.x, 0, 10, dt);
          const dxSearch = this.lastKnownX - ped.x;
          const dzSearch = this.lastKnownZ - ped.z;
          const distSearch = Math.hypot(dxSearch, dzSearch);
          const spd = 4.6;
          if (distSearch > 10) {
            const ang = Math.atan2(dxSearch, dzSearch);
            ped.dirX = Math.sin(ang);
            ped.dirZ = Math.cos(ang);
          } else if (Math.random() < 0.025) {
            const randAng = Math.random() * Math.PI * 2;
            ped.dirX = Math.sin(randAng);
            ped.dirZ = Math.cos(randAng);
          }
          const res = this.resolveBuildingCollision(ped.x + ped.dirX * spd * dt, ped.z + ped.dirZ * spd * dt, 0.5);
          if (res.hit) {
            const bounceAng = Math.atan2(ped.dirX, ped.dirZ) + Math.PI * (0.45 + Math.random() * 0.5);
            ped.dirX = Math.sin(bounceAng);
            ped.dirZ = Math.cos(bounceAng);
          }
          ped.x = res.x;
          ped.z = res.z;
          ped.heading = Math.atan2(ped.dirX, ped.dirZ);
          ped.walkPhase += dt * 7.5;
        }
      } else {
        if (ped.kind === 'police') {
          ped.rig.weaponMesh.visible = false;
          ped.rig.rightArm.rotation.x = THREE.MathUtils.damp(ped.rig.rightArm.rotation.x, 0, 10, dt);
        }
        const spd = ped.fleeing ? 7.2 : 2.3;
        const nx = ped.x + ped.dirX * spd * dt;
        const nz = ped.z + ped.dirZ * spd * dt;
        const res = this.resolveBuildingCollision(nx, nz, 0.5);
        if (res.hit || Math.random() < 0.004) {
          const newAng = Math.random() * Math.PI * 2;
          ped.dirX = Math.sin(newAng);
          ped.dirZ = Math.cos(newAng);
        }
        ped.x = res.x;
        ped.z = res.z;
        ped.heading = Math.atan2(ped.dirX, ped.dirZ);
        ped.walkPhase += dt * spd * 2.1;
      }

      const swing = Math.sin(ped.walkPhase) * 0.6;
      ped.rig.leftLeg.rotation.x = swing;
      ped.rig.rightLeg.rotation.x = -swing;
      ped.rig.root.position.set(ped.x, ped.y, ped.z);
      ped.rig.root.rotation.y = ped.heading;
    }
  }

  private updateEnemyBullets(dt: number) {
    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const py = this.activeVehicle ? this.activeVehicle.y + 1.05 : ch.y + 1.1;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
    const hitRadius = this.activeVehicle ? 1.5 : 0.72;

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);

      const hitWall = this.pointHitsBuilding(b.x, b.y, b.z) || b.y <= 0;
      const distToPlayer = Math.hypot(b.x - px, b.y - py, b.z - pz);

      if (distToPlayer < hitRadius && !this.isDead) {
        if (this.dodgeTimer > 0.08) {
          // Player actively dodged the bullet!
          continue;
        }
        this.damagePlayer(b.damage);
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (hitWall || b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  private updatePoliceSpawns(dt: number) {
    if (this.wantedLevel <= 0 || this.isDead) return;

    this.policeSpawnTimer -= dt;
    if (this.policeSpawnTimer > 0) return;
    this.policeSpawnTimer = Math.max(4.5, 11 - this.wantedLevel * 1.5);

    const activePoliceCars = this.vehicles.filter((v) => v.isPolice && v.hasDriver && !v.occupiedByPlayer && !v.exploded).length;
    const activePolicePeds = this.peds.filter((p) => p.kind === 'police' && p.health > 0).length;

    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
    const anchorX = this.policeSpotted ? px : this.lastKnownX;
    const anchorZ = this.policeSpotted ? pz : this.lastKnownZ;
    const ang = Math.random() * Math.PI * 2;

    if (activePoliceCars < this.wantedLevel + 1) {
      const dist = this.policeSpotted ? 85 : 95;
      const sx = THREE.MathUtils.clamp(anchorX + Math.sin(ang) * dist, WORLD_BOUNDS.minX + 15, WORLD_BOUNDS.maxX - 15);
      const sz = THREE.MathUtils.clamp(anchorZ + Math.cos(ang) * dist, WORLD_BOUNDS.minZ + 15, WORLD_BOUNDS.maxZ - 15);
      const spawnsWithLos = !this.policeSpotted && Math.hypot(sx - px, sz - pz) < 85 && this.hasLineOfSight(sx, sz, px, pz);
      if (!spawnsWithLos && !this.pointHitsBuilding(sx, 1, sz)) {
        this.spawnVehicle('police', sx, sz, ang + Math.PI, true, true);
      }
    }

    if (activePolicePeds < this.wantedLevel * 2) {
      const dist = this.policeSpotted ? 40 : 28;
      const sx = THREE.MathUtils.clamp(anchorX + Math.sin(ang + 0.4) * dist, WORLD_BOUNDS.minX + 15, WORLD_BOUNDS.maxX - 15);
      const sz = THREE.MathUtils.clamp(anchorZ + Math.cos(ang + 0.4) * dist, WORLD_BOUNDS.minZ + 15, WORLD_BOUNDS.maxZ - 15);
      const spawnsWithLos = !this.policeSpotted && Math.hypot(sx - px, sz - pz) < 62 && this.hasLineOfSight(sx, sz, px, pz);
      if (!spawnsWithLos && !this.pointHitsBuilding(sx, 1, sz)) {
        this.spawnPed(sx, sz, 'police');
      }
    }
  }

  private updatePickupsAndFx(dt: number) {
    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.mesh.rotation.y += dt * 3;
      const d = Math.hypot(pk.x - px, pk.z - pz);
      if (d < 2.6 && !this.isDead) {
        if (pk.kind === 'ammo') {
          const targetWeapon: WeaponId = this.currentWeapon !== 'fists' ? this.currentWeapon : 'pistol';
          const def = WEAPONS[targetWeapon];
          this.ammo[targetWeapon] = Math.min(def.maxAmmo, this.ammo[targetWeapon] + pk.amount);
          this.showToast(`+${pk.amount} colpi ${def.shortName}`);
          this.emitHud();
        } else {
          this.addCash(pk.amount);
        }
        soundManager.playCash();
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.life <= 0) {
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        (tr.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vy -= 18 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      if (g.y < 0.2) {
        g.y = 0.2;
        g.vy *= -0.35;
        g.vx *= 0.65;
        g.vz *= 0.65;
      }
      g.mesh.position.set(g.x, g.y, g.z);
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        this.explodeAt(g.x, g.y, g.z, 10, 140, true);
        this.grenades.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      const prog = 1 - ex.life / ex.maxLife;
      const s = 1 + prog * 9.5;
      ex.mesh.scale.set(s, s, s);
      (ex.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - prog));
      if (ex.life <= 0) {
        this.scene.remove(ex.mesh);
        ex.mesh.geometry.dispose();
        (ex.mesh.material as THREE.Material).dispose();
        this.explosions.splice(i, 1);
      }
    }

    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const sm = this.smokePuffs[i];
      sm.life -= dt;
      const prog = 1 - sm.life / sm.maxLife;
      const s = 1 + prog * 2.4;
      sm.mesh.scale.set(s, s, s);
      sm.mesh.position.y += dt * 1.4;
      (sm.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.45 * (1 - prog));
      if (sm.life <= 0) {
        this.scene.remove(sm.mesh);
        sm.mesh.geometry.dispose();
        (sm.mesh.material as THREE.Material).dispose();
        this.smokePuffs.splice(i, 1);
      }
    }
  }

  private updateMissions(dt: number) {
    if (!this.activeMission) {
      if (this.missionBeaconMesh) this.missionBeaconMesh.visible = false;
      return;
    }

    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;

    if (this.activeMission.timeLeftSec !== null) {
      this.activeMission.timeLeftSec -= dt;
      if (this.activeMission.timeLeftSec <= 0) {
        this.showBanner('mission_failed', 'MISSIONE FALLITA', 'Tempo scaduto!', 3.2);
        this.activeMission = null;
        if (this.missionBeaconMesh) this.missionBeaconMesh.visible = false;
        return;
      }
    }

    if (this.missionBeaconMesh) {
      this.missionBeaconMesh.position.set(this.activeMission.targetX, 0, this.activeMission.targetZ);
      this.missionBeaconMesh.visible = this.activeMission.def.type !== 'escape_wanted';
    }

    if (this.activeMission.def.type === 'steal_deliver') {
      if (this.activeVehicle?.isMissionTarget) {
        const d = Math.hypot(px - this.activeMission.def.targetX, pz - this.activeMission.def.targetZ);
        if (d < 9.5) {
          this.completeMission();
        }
      }
    } else if (this.activeMission.def.type === 'race_checkpoints') {
      const cp = this.missionCheckpoints[this.activeMission.progress];
      if (cp && Math.hypot(px - cp.x, pz - cp.z) < 10.5) {
        soundManager.playCash();
        this.activeMission.progress++;
        if (this.activeMission.progress >= this.missionCheckpoints.length) {
          this.completeMission();
        } else {
          const next = this.missionCheckpoints[this.activeMission.progress];
          this.activeMission.targetX = next.x;
          this.activeMission.targetZ = next.z;
          this.activeMission.objectiveText = `Raggiungi il Checkpoint ${this.activeMission.progress + 1} / 5`;
        }
      }
    }
  }

  private updateCamera(dt: number, elapsed: number) {
    if (this.menuMode) {
      // Cinematic 35mm Soliswood Overlook framing across the 3 protagonists, matte/orange cars, overpass & skyline
      const driftX = Math.sin(elapsed * 0.25) * 1.4;
      const driftY = Math.cos(elapsed * 0.32) * 0.14;
      _camDesired.set(-38.6 + driftX, 2.0 + driftY, -585.4);
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-3 * dt));
      this.camera.lookAt(-39.0, 2.2, -555.0);
      return;
    }

    if (this.switchAnim.active) {
      this.switchAnim.phase += dt * 0.78;
      const t = Math.min(1, this.switchAnim.phase);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cx = THREE.MathUtils.lerp(this.switchAnim.fromX, this.switchAnim.toX, ease);
      const cz = THREE.MathUtils.lerp(this.switchAnim.fromZ, this.switchAnim.toZ, ease);
      const arcHeight = 4 + Math.sin(t * Math.PI) * 120;
      this.camera.position.set(cx, arcHeight, cz + (1 - Math.sin(t * Math.PI)) * 8);
      this.camera.lookAt(cx, 1.4, cz);
      if (t >= 1) {
        this.switchAnim.active = false;
      }
      return;
    }

    const ch = this.getActiveChar();

    if (this.isDead) {
      const prog = Math.min(1, (3.2 - this.deathTimer) / 3.2);
      _camDesired.set(
        ch.x + Math.sin(this.cameraYaw + prog * 0.6) * (4.5 + prog * 4.5),
        ch.y + 3.2 + prog * 5.2,
        ch.z + Math.cos(this.cameraYaw + prog * 0.6) * (4.5 + prog * 4.5)
      );
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-4 * dt));
      _camLook.set(ch.x, ch.y + 0.4, ch.z);
      this.camera.lookAt(_camLook);
      return;
    }

    const targetX = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const targetY = this.activeVehicle ? this.activeVehicle.y + 1.4 : ch.y + 1.45;
    const targetZ = this.activeVehicle ? this.activeVehicle.z : ch.z;

    if (this.activeVehicle && Math.abs(this.activeVehicle.speed) > 4) {
      const desiredYaw = this.activeVehicle.heading + Math.PI;
      const diff = Math.atan2(Math.sin(desiredYaw - this.cameraYaw), Math.cos(desiredYaw - this.cameraYaw));
      this.cameraYaw += diff * Math.min(1, dt * 1.4);
    }

    const isInsideStore = this.insideStoreId !== null;
    const baseDist = isInsideStore
      ? this.activeVehicle
        ? 4.8
        : 3.25
      : this.activeVehicle
      ? this.cameraDistMode === 1
        ? 11.5
        : this.cameraDistMode === 2
        ? 6.4
        : 8.6
      : this.cameraDistMode === 1
      ? 7.8
      : this.cameraDistMode === 2
      ? 3.8
      : 5.4;

    const horiz = Math.cos(this.cameraPitch) * baseDist;
    const vert = isInsideStore
      ? Math.min(2.05, Math.sin(this.cameraPitch) * baseDist + 0.48)
      : Math.sin(this.cameraPitch) * baseDist + 0.8;

    _camDesired.set(
      targetX + Math.sin(this.cameraYaw) * horiz,
      targetY + vert,
      targetZ + Math.cos(this.cameraYaw) * horiz
    );

    const smooth = 1 - Math.exp(-10 * dt);
    this.camera.position.lerp(_camDesired, smooth);
    _camLook.set(targetX, targetY + 0.25, targetZ);
    this.camera.lookAt(_camLook);

    // 35mm cinematic lens FOV profile
    const targetFov = this.activeVehicle ? 52 + Math.min(13, Math.abs(this.activeVehicle.speed) * 0.3) : 48;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud() {
    const ch = this.getActiveChar();
    const px = this.activeVehicle ? this.activeVehicle.x : ch.x;
    const pz = this.activeVehicle ? this.activeVehicle.z : ch.z;
    const nearVeh = this.activeVehicle ? null : this.findNearestVehicle(px, pz, 5.4);
    const nearZone = this.findNearestZone(px, pz);

    if (this.waypoint && Math.hypot(px - this.waypoint.x, pz - this.waypoint.z) < 12) {
      this.setWaypoint(null, null);
    }

    const blips: MinimapBlip[] = [];
    for (const v of this.vehicles) {
      if (v.exploded || v.occupiedByPlayer) continue;
      if (v.isPolice && this.wantedLevel > 0 && v.hasDriver) {
        blips.push({ x: v.x, z: v.z, kind: 'police', color: '#ef4444' });
      } else if (v.isMissionTarget) {
        blips.push({ x: v.x, z: v.z, kind: 'mission', color: '#facc15' });
      } else if (!v.isTraffic) {
        blips.push({ x: v.x, z: v.z, kind: 'car', color: '#cbd5e1' });
      }
    }
    for (const z of this.world.zones) {
      if (z.type === 'property' && z.propertyId) {
        const prop = WORLD_PROPERTIES.find((p) => p.id === z.propertyId);
        blips.push({
          x: z.x,
          z: z.z,
          kind: 'property',
          color: z.color,
          label: prop?.shortCode || 'P',
          mode: prop?.mode,
        });
      } else if (z.type === 'store' && z.storeId) {
        const st = WALK_IN_STORES.find((s) => s.id === z.storeId);
        const label =
          st?.type === 'supermarket'
            ? '24'
            : st?.type === 'ammu_store'
            ? 'A'
            : st?.type === 'clothing'
            ? 'V'
            : st?.type === 'lsc'
            ? 'LS'
            : st?.type === 'barber'
            ? 'B'
            : 'S';
        blips.push({
          x: z.x,
          z: z.z,
          kind: 'shop',
          color: z.color,
          label,
        });
      } else {
        blips.push({
          x: z.x,
          z: z.z,
          kind: z.type === 'mission' ? 'mission' : 'shop',
          color: z.color,
          label: z.type === 'ammu' ? 'A' : z.type === 'paynspray' ? 'P' : z.type === 'hospital' ? '+' : 'M',
        });
      }
    }
    for (const ped of this.peds) {
      if (ped.health <= 0) continue;
      if (ped.kind === 'gang') {
        blips.push({ x: ped.x, z: ped.z, kind: 'enemy', color: '#f43f5e' });
      }
    }
    for (const rp of this.remotePlayers.values()) {
      blips.push({
        x: rp.x,
        z: rp.z,
        kind: 'online_player',
        color: '#22d3ee',
        label: rp.name,
        heading: rp.heading,
      });
    }
    if (this.waypoint) {
      blips.push({ x: this.waypoint.x, z: this.waypoint.z, kind: 'waypoint', color: '#a855f7' });
    }

    const hrs = Math.floor(this.gameMinutes / 60) % 24;
    const mins = Math.floor(this.gameMinutes % 60);
    const gameTimeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    this.onHudUpdate({
      characterId: this.activeCharId,
      health: Math.round(ch.health),
      maxHealth: 100,
      armor: Math.round(ch.armor),
      maxArmor: 100,
      special: Math.round(ch.special),
      specialActive: this.specialActive,
      damageFlash: this.damageFlash,
      isDead: this.isDead,
      isDodging: this.dodgeTimer > 0,
      dodgeCooldown: Math.min(1, this.dodgeCooldown / 0.85),
      cash: this.cash,
      cashDelta: this.cashDelta,
      wantedLevel: this.wantedLevel,
      wantedCooldown: this.wantedLevel > 0 ? this.wantedTimer / 18 : 0,
      policeSpotted: this.policeSpotted,
      weaponId: this.currentWeapon,
      ammo: { ...this.ammo },
      inVehicle: !!this.activeVehicle,
      vehicleName: this.activeVehicle ? this.activeVehicle.spec.name : '',
      vehicleType: this.activeVehicle ? this.activeVehicle.spec.type : null,
      vehicleHealth: this.activeVehicle ? Math.round(this.activeVehicle.health) : 100,
      speedKmh: this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 3.6) : 0,
      sirenOn: this.activeVehicle?.sirenOn ?? false,
      radioStation: this.radioStation,
      district: getDistrictAt(px, pz),
      gameTimeStr,
      timeOfDay: this.timeOfDay,
      playerX: px,
      playerZ: pz,
      playerHeading: this.activeVehicle ? this.activeVehicle.heading : ch.heading,
      cameraHeading: this.cameraYaw,
      nearVehicleName: nearVeh ? nearVeh.spec.name : null,
      nearZone,
      insideStoreId: this.insideStoreId,
      activeMission: this.activeMission ? { ...this.activeMission } : null,
      completedMissions: Array.from(this.completedMissions),
      ownedProperties: Array.from(this.ownedProperties),
      waypoint: this.waypoint,
      blips,
      onlineMode: this.onlineMode,
      onlineConnected: this.onlineConnected,
      onlineRoom: this.onlineRoom,
      onlinePlayersCount: this.onlineMode ? this.remotePlayers.size + 1 : 0,
      statusBanner: this.statusBanner,
      toastText: this.toastText,
    });
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    const maxDpr = this.settings.graphicsQuality === 'low' ? 1 : this.settings.graphicsQuality === 'medium' ? 1.5 : 2;
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, maxDpr);
    this.renderer.setPixelRatio(dpr);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (this.menuMode) return;
    this.keys.add(e.code);
    if (e.code === 'KeyF') this.toggleEnterExitVehicle();
    if (e.code === 'Space' && !this.activeVehicle) this.triggerJumpOrHorn();
    if (e.code === 'KeyE') this.interactWithNearbyZone();
    if (e.code === 'KeyQ') this.triggerDodge();
    if (e.code === 'KeyZ') this.toggleSpecialAbility();
    if (e.code === 'KeyV') this.cycleCameraDistance();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public dispose() {
    this.disposed = true;
    this.multiplayer.disconnect();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    soundManager.dispose();
    this.envRenderTarget?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
