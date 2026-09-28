import { lang, tr } from '../i18n';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildCity, buildPole, car as buildCar, rubbleHeap, tree as buildTree, type BuildingInfo, type CityResult, type PropMarker } from '../assets/city';
import { bake, box, extrudeSide, mat, tube } from '../assets/kit';
import { rng } from '../assets/textures';
import { VEHICLES, buildFuelProp, buildJammer, buildSupportDrone, buildSupportTruck, type VehicleRig } from '../assets/vehicles';
import { sfx, Sfx } from './audio';
import { AIRSTRIKE_SHELL, AMMO, CLUSTER_BOMBLET, DRONE_BLAST, FIRE_FIELD, DRONE_GUN, ENEMIES, MAX_DRONES, GUIDED_MISSILE, LASER, MAX_MINES, MINE, MINES_PER_PICKUP, PICKUPS, SHIELD_HP, PLAYER, PLAYER_MG, type AmmoId, type BuffKind, type Dir, type EnemyDef, type EnemyKind, type LevelDef, type PickupKind, type Team, type WeaponDef } from './data';
import * as T from '../assets/textures';
import { FX } from './fx';
import type { Input } from './input';
import { NavGrid } from './nav';
import { Projectiles, type Projectile } from './projectiles';
import type { Checkpoint, Quality, Settings } from '../save/storage';
import { ARMOR_KITS, type DamageKind, type Loadout } from './progression';
import { applyArmorKit } from '../assets/vehicles';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const V2 = () => new THREE.Vector2();
const V3 = () => new THREE.Vector3();
const M_CANVAS = () => mat('tentCanvas', { color: 0x6f6a4c, roughness: 1 });
const HELI_ROCKET: WeaponDef = { kind: 'rocket', damage: 32, splash: 4, speed: 30, reload: 0, spread: 0, range: 999, building: 1 };
const BOSS_ROCKET: WeaponDef = { kind: 'rocket', damage: 55, splash: 5, speed: 26, reload: 0, spread: 0, range: 999, building: 1.5 };
const TITAN_RAIL: WeaponDef = { kind: 'shell', damage: 160, splash: 2.5, speed: 140, reload: 0, spread: 0, range: 120, building: 3 };
const THEME_LOOK = {
  city: { bg: 0x9fb0bb, fog: 0xa9b6be, sky: 0xd6e4ff, ground: 0x6a5d48, hemi: 0.7, sun: 0xfff0d8, sunI: 3.2, exposure: 0.92 },
  desert: { bg: 0xd8c7a4, fog: 0xdac9a6, sky: 0xf4e6c8, ground: 0x8a6a44, hemi: 0.8, sun: 0xffe4b8, sunI: 3.6, exposure: 0.9 },
  port: { bg: 0x98a4ac, fog: 0xa2acb2, sky: 0xc8d4e0, ground: 0x505860, hemi: 0.85, sun: 0xf2f2ff, sunI: 2.7, exposure: 0.95 },
  winter: { bg: 0xc6d2dc, fog: 0xd2dce4, sky: 0xe4eeff, ground: 0x9aa4b0, hemi: 0.95, sun: 0xe8f0ff, sunI: 2.3, exposure: 0.86 },
} as const;
const BOSS_MG: WeaponDef = { kind: 'bullet', damage: 6, splash: 0, speed: 55, reload: 0, spread: 0, range: 45, building: 0.05 };
const JAMMER_DEF: EnemyDef = {
  vehicle: 'jammer', name: tr('เสาสัญญาณรบกวน', 'Jammer tower'), hp: 900, speed: 0, turn: 0, turretTurn: 0, radius: 2.4, behaviour: 'chase', preferred: 0, reward: 200, detect: 0,
  weapon: { kind: 'bullet', damage: 0, splash: 0, speed: 1, reload: 99, spread: 0, range: 0, building: 0 },
};
const M_STEEL = () => mat('mineCap', { color: 0x8a8d8f, roughness: 0.35, metalness: 0.9 });

/** Fresnel energy bubble with a scrolling hex-like grid; flares when hit. */
function shieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0x4ff0ff) }, time: { value: 0 }, hit: { value: 0 }, fade: { value: 1 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color; uniform float time; uniform float hit; uniform float fade;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec2 g = vec2(vP.x * 6.0 + vP.z * 3.5, vP.z * 6.0 - vP.x * 3.5 + vP.y * 4.0);
        float grid = step(0.9, fract(g.x)) + step(0.9, fract(g.y));
        float band = smoothstep(0.85, 1.0, sin(vP.y * 6.0 - time * 4.0));
        float a = (f * 0.9 + grid * 0.08 + band * 0.12 + hit * 0.55 + 0.03) * fade;
        gl_FragColor = vec4(color * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ───────────────────────── Entities ─────────────────────────

let nextId = 1;

class Vehicle {
  readonly id = nextId++;
  hp: number;
  yaw = 0;
  turretYaw = 0;
  speed = 0;
  omega = 0;
  alive = true;
  reload = 0;
  burstLeft = 0;
  burstT = 0;
  lastHit = -99;
  trackDist = 0;
  recoil = 0;
  /** Outgoing damage multiplier (enemies scale up each wave). */
  dmgMul = 1;
  /** Suspension bump when rolling over wrecks. */
  bump = 0;
  /** Throttle for ramming effects. */
  ramT = 0;
  // AI
  los = false;
  losT = 0;
  strafeDir = Math.random() > 0.5 ? 1 : -1;
  stuckT = 0;
  reverseT = 0;
  /** patrol → (hears/is told) alert → (sees) engage → (loses sight) search → patrol */
  state: 'patrol' | 'alert' | 'engage' | 'search' = 'patrol';
  lastKnown = V3();
  lastSeen = -99;
  spotT = -99;
  searchT = 0;
  /** Road-graph navigation. */
  node = -1;
  prevNode = -1;
  goalNode = -1;
  /** Holds one of the limited "attack slots" (allowed to close in and fire). */
  token = false;
  /** Seconds the current attack slot has been held (slots rotate). */
  tokenT = 0;
  restT = 0;
  /** Side-step to clear a friendly unit out of the line of fire. */
  flankT = 0;
  flankDir = 1;
  lastPos = V3();
  /** Has driven into the playable area (after which it may not leave). */
  entered = false;
  gunZ0 = 0;
  /** Assigned to attack the mission objective (hospital / convoy) instead of the player. */
  focus = false;
  /** Structures (objective, jammer): never move. */
  isStatic = false;
  deployed = false;
  bossT = 4;
  bossPhase = 1;
  mgT = 2;
  spawnT = 6;
  orbitA = Math.random() * Math.PI * 2;
  railT = 6;
  railAim = V3();
  stepPhase = 0;
  vel = V3();
  constructor(readonly team: Team, readonly rig: VehicleRig, readonly maxHp: number, readonly radius: number, readonly def: EnemyDef | null, readonly kind: EnemyKind | 'player' | 'ally' | 'jammer') {
    this.hp = maxHp;
    this.gunZ0 = rig.gun?.position.z ?? 0;
    rig.root.rotation.order = 'YXZ'; // so rotation.x is the hull's own pitch
  }
  get pos() {
    return this.rig.root.position;
  }
}

class Building {
  hp: number;
  readonly maxHp: number;
  alive = true;
  left: number;
  box: THREE.Box3;
  burnT = 0;
  faded = false;
  constructor(readonly id: number, readonly group: THREE.Group, readonly info: BuildingInfo) {
    this.box = new THREE.Box3().setFromObject(group);
    this.left = info.sections.length;
    this.maxHp = info.kind === 'house' ? 320 : info.sections.length * 260;
    this.hp = this.maxHp;
  }
  top() {
    return this.left > 0 ? new THREE.Box3().setFromObject(this.info.sections[this.left - 1]).max.y : 0;
  }
}

class Car {
  hp = 60;
  alive: boolean;
  radius = 1.4;
  /** Explosive fuel prop instead of a civilian car. */
  hazard?: 'tank' | 'drums';
  burnT = 0;
  /** 0..1 flattening progress once a tank rolls over the wreck. */
  crush = 0;
  crushing = false;
  constructor(readonly m: PropMarker, public obj: THREE.Object3D) {
    this.alive = !m.burnt;
  }
}

class Tree {
  fallen = false;
  t = 0;
  axis = new THREE.Vector3(1, 0, 0);
  constructor(readonly m: PropMarker, readonly pivot: THREE.Group) {}
}

/** Enemy wrecks kept at once; older ones sink early and are freed. */
const MAX_WRECKS = 24;

/** A knock-down lamp / traffic light, drawn as one instance of a shared InstancedMesh set. */
class Pole {
  fallen = false;
  t = 0;
  axis = new THREE.Vector3(1, 0, 0);
  constructor(readonly m: PropMarker, readonly meshes: THREE.InstancedMesh[], readonly idx: number) {}
}

interface Wreck {
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  radius: number;
  t: number;
  turret?: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; rest: boolean; crushing?: boolean; crush?: number };
  crushing?: boolean;
  crush?: number;
  /** Salvageable loot marker (rolled when collected). */
  loot?: THREE.Sprite;
  /** Infantry: falls over, no fire. */
  soft?: boolean;
  /** Aircraft: falls to the ground first. */
  fallV?: number;
}

interface Pickup {
  kind: PickupKind;
  obj: THREE.Group;
  chute: THREE.Object3D | null;
  icon: THREE.Sprite;
  /** Seconds since landing (negative while falling). */
  t: number;
  landed: boolean;
  vy: number;
}

interface FloatText {
  pos: THREE.Vector3;
  text: string;
  color: string;
  t: number;
}

interface AllyDrone {
  rig: VehicleRig;
  vel: THREE.Vector3;
  target: Vehicle | null;
  retargetT: number;
  reload: number;
  burstLeft: number;
  burstT: number;
  slot: number;
  /** Seconds of flight left; dives onto a target when it runs out. */
  life: number;
  diving: boolean;
  t: number;
}

interface PendingSpawn {
  kind: EnemyKind;
  at: number;
  point: THREE.Vector3;
  from: Dir;
  /** Placed somewhere inside the map (vs. arriving from an edge spur). */
  inside?: boolean;
}

export interface HudState {
  hp: number;
  maxHp: number;
  wave: number;
  waves: number;
  enemies: number;
  ammo: AmmoId;
  he: number;
  ammoList: { id: AmmoId; left: number | null }[];
  reload: number;
  credits: number;
  kills: number;
  time: number;
  phase: Game['phase'];
  countdown: number;
  buffs: { kind: BuffKind; t: number; max: number }[];
  mines: number;
  objective: string | null;
  boss: { name: string; hp: number; max: number } | null;
  loops: boolean;
}

/** One line of the on-screen mission checklist. An item that drops out of the list counts as completed. */
export interface Mission {
  id: string;
  text: string;
  /** Bonus (star) goal rather than a mission requirement. */
  star?: boolean;
  /** `warn`: currently not met; `failed`: can no longer be achieved; `done`: just completed (final text). */
  state?: 'warn' | 'failed' | 'done';
}

export interface LevelResult {
  victory: boolean;
  stars: boolean[];
  credits: number;
  kills: number;
  time: number;
  razed: number;
  hpPct: number;
}

export interface GameCallbacks {
  message(text: string, sub?: string): void;
  checkpoint(cp: Checkpoint): void;
  end(r: LevelResult): void;
  /** Bank credits/EXP into the profile (at every wave clear and on victory). */
  earn(credits: number, xp: number): void;
}

// ───────────────────────── Game ─────────────────────────

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 1, 900);
  private composer!: EffectComposer;
  private ao: GTAOPass | null = null;
  private sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
  private sunOffset = new THREE.Vector3(-45, 100, 32);
  private shadowHalf = 70;
  fx = new FX();
  proj = new Projectiles();
  nav!: NavGrid;
  city!: CityResult;
  player!: Vehicle;
  enemies: Vehicle[] = [];
  buildings: Building[] = [];
  cars: Car[] = [];
  trees: Tree[] = [];
  poles: Pole[] = [];
  wrecks: Wreck[] = [];
  pickups: Pickup[] = [];
  texts: FloatText[] = [];
  rings: { mesh: THREE.Mesh; target: THREE.Vector3; t: number; T: number; r: number }[] = [];
  private ringPool: THREE.Mesh[] = [];

  // Power-ups
  buffs: Record<BuffKind, number> = { missile: 0, armor: 0, nitro: 0, rapid: 0, overcharge: 0, shield: 0, laser: 0, drones: 0 };
  private drones: AllyDrone[] = [];
  shieldHp = 0;
  private shieldHit = 0;
  mineCount = 0;
  private mines: { obj: THREE.Group; light: THREE.Object3D; t: number }[] = [];
  private beam: THREE.Group | null = null;
  private laserFx = 0;
  private attachments: Partial<Record<BuffKind, THREE.Object3D[]>> = {};
  private missileT = 0;
  private missileSide = 1;
  private dropT = 10;

  // Player weapon state
  ammo: AmmoId = 'AP';
  he: number = AMMO.HE.capacity;
  mgReload = 0;
  aim = V3();
  /** Pending tap-to-fire (touch): seconds left to line up the turret, and the chosen target. */
  private tapShot = 0;
  private tapTarget: Vehicle | null = null;
  camDist = 62;
  private camTarget = V3();

  // Waves
  level!: LevelDef;
  waveIdx = 0;
  phase: 'countdown' | 'active' | 'victory' | 'defeat' = 'countdown';
  phaseT = 0;
  waveT = 0;
  pending: PendingSpawn[] = [];
  warnings: { point: THREE.Vector3; t: number }[] = [];

  // Stats
  kills = 0;
  credits = 0;
  time = 0;
  razed = 0;
  paused = false;
  /** Increments whenever the static map changes (minimap cache). */
  mapVersion = 0;
  elapsed = 0;

  private quality: Exclude<Quality, 'auto'> = 'high';
  private autoQuality = true;
  private fpsAcc = 0;
  private fpsN = 0;
  private fpsT = 0;
  private raycaster = new THREE.Raycaster();
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6);
  private fadeCache = new Map<THREE.Material, THREE.Material>();

  allies: Vehicle[] = [];
  /** Tall non-destructible structures (cranes) that fade when blocking the view. */
  private occluders: { group: THREE.Group; box: THREE.Box3; faded: boolean }[] = [];
  private navB: NavGrid | null = null;
  private convoy: { path: THREE.Vector3[]; total: number; d: number; moving: boolean } | null = null;
  /** Earnings not yet banked into the profile. */
  private bankCredits = 0;
  private bankXp = 0;
  /** Remaining special ammo. */
  ammoLeft: Partial<Record<AmmoId, number>> = {};
  private fires: { pos: THREE.Vector3; t: number }[] = [];
  private bomblets: { pos: THREE.Vector3; t: number }[] = [];
  private apsT = 0;
  private sinceHit = 99;

  constructor(private renderer: THREE.WebGLRenderer, private env: THREE.Texture, private input: Input, private settings: Settings, private cb: GameCallbacks, readonly loadout: Loadout) {
    for (const a of loadout.ammo) if (AMMO[a].capacity !== Infinity) this.ammoLeft[a] = AMMO[a].capacity;
  }

  private get sk() {
    return this.loadout.skills;
  }

  /** Duration of a timed pick-up after skills. */
  buffDuration(b: BuffKind) {
    const base = PICKUPS[b].duration!;
    if (b === 'drones') return base + this.sk.droneTime * 4;
    if (b === 'missile') return (base + this.sk.missile * 3) * (1 + this.sk.buffTime * 0.12);
    return base * (1 + this.sk.buffTime * 0.12);
  }

  get shieldMax() {
    return SHIELD_HP + this.sk.shield * 120;
  }

  // ───────────────── Setup ─────────────────

  load(level: LevelDef, cp: Checkpoint | null) {
    this.level = level;
    const s = this.scene;
    // Lighting/atmosphere per theme, then weather
    const look = THEME_LOOK[level.theme ?? 'city'];
    s.background = new THREE.Color(look.bg);
    const [near, far] = level.weather === 'sandstorm' ? [30, 150] : level.weather === 'blizzard' ? [35, 160] : level.weather === 'snow' ? [110, 380] : [150, 430];
    s.fog = new THREE.Fog(level.weather === 'sandstorm' ? 0xc9a878 : look.fog, near, far);
    s.environment = this.env;
    s.environmentIntensity = 0.35;
    s.add(new THREE.HemisphereLight(look.sky, look.ground, look.hemi));
    this.sun.color.set(look.sun);
    this.sun.intensity = level.weather === 'sandstorm' || level.weather === 'blizzard' ? look.sunI * 0.6 : look.sunI;
    this.renderer.toneMappingExposure = look.exposure;
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);

    this.city = buildCity({ N: level.N, seed: level.seed, district: level.district, theme: level.theme, seaSouth: level.seaSouth });
    s.add(this.city.group);
    this.nav = new NavGrid(this.city.extent + 60, 2);
    if (level.defend || level.convoy) this.navB = new NavGrid(this.city.extent + 60, 2);
    this.buildRoadGraph();

    this.city.group.traverse((o) => {
      if (o.userData.occluder) this.occluders.push({ group: o as THREE.Group, box: new THREE.Box3().setFromObject(o), faded: false });
    });
    for (const g of this.city.buildings) {
      const b = new Building(g.userData.id, g, g.userData.building);
      this.buildings.push(b);
      this.setBlock(b.box, b.id, true);
    }
    this.buildPoles(s);
    for (const m of this.city.props) {
      if (m.type === 'fuel') this.addHazard(m.fuel ?? 'drums', m.x, m.z, m.ry, 20000 + m.id);
      else if (m.type === 'car') {
        const obj = bake(buildCar(rng(m.seed), m.burnt));
        obj.position.set(m.x, obj.position.y, m.z);
        obj.rotation.y = m.ry;
        s.add(obj);
        this.cars.push(new Car(m, obj));
      } else {
        const t = bake(buildTree(rng(m.seed), m.kind, m.scale));
        const pivot = new THREE.Group();
        pivot.position.set(m.x, 0, m.z);
        pivot.add(t);
        s.add(pivot);
        this.trees.push(new Tree(m, pivot));
      }
    }

    const rig = VEHICLES.find((v) => v.id === 'striker')!.build();
    this.player = new Vehicle('player', rig, Math.round(PLAYER.hp * this.loadout.hpMul), PLAYER.radius, null, 'player');
    applyArmorKit(rig, this.loadout.armor);
    rig.root.position.set(level.start[0], 0, level.start[1]);
    this.player.yaw = this.player.turretYaw = Math.PI;
    s.add(rig.root);

    s.add(this.fx.root, this.proj.root);
    this.fx.shakeEnabled = this.settings.shake;

    this.setupObjectives();
    if (cp) this.applyCheckpoint(cp);
    this.camTarget.copy(this.player.pos);
    this.aim.copy(this.player.pos).add(new THREE.Vector3(0, 0, -20));
    this.startCountdown(cp ? 4 : 3);
    this.setQuality(this.settings.quality);
    this.mapVersion++;
  }

  /**
   * Take a destroyed/expired object out of the scene and free its GPU buffers.
   * Geometry is never shared between objects; materials and textures are (mat() cache), so only
   * one-off sprite materials are released.
   */
  private discard(o: THREE.Object3D | undefined) {
    if (!o) return;
    o.removeFromParent();
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
      else if ((m as THREE.Sprite).isSprite) ((m as THREE.Sprite).material as THREE.Material).dispose();
    });
  }

  dispose() {
    this.renderer.toneMappingExposure = 0.92;
    sfx.laserUpdate(false);
    sfx.engineUpdate(0, false);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.scene.clear();
    this.composer?.dispose();
  }

  setQuality(q: Quality) {
    this.autoQuality = q === 'auto';
    const touch = matchMedia('(pointer: coarse)').matches;
    const level: Exclude<Quality, 'auto'> = q === 'auto' ? (touch ? 'medium' : 'high') : q;
    this.applyQuality(level);
  }

  private applyQuality(q: Exclude<Quality, 'auto'>) {
    this.quality = q;
    const pr = q === 'low' ? 1 : q === 'medium' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    const size = q === 'low' ? 1024 : q === 'medium' ? 2048 : 4096;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.renderer.shadowMap.enabled = true;
    this.fx.density = q === 'low' ? 0.5 : q === 'medium' ? 0.75 : 1;
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (q === 'high') {
      this.ao = new GTAOPass(this.scene, this.camera, innerWidth, innerHeight);
      this.ao.updateGtaoMaterial({ radius: 3, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 12 });
      this.ao.blendIntensity = 0.9;
      this.composer.addPass(this.ao);
    }
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    // Keep a similar horizontal view on narrow (portrait-ish) screens
    this.camera.fov = w / h < 1.2 ? 50 : 38;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
  }

  // ───────────────── Checkpoints ─────────────────

  checkpoint(): Checkpoint {
    const p = this.player;
    const buildings: Record<number, number> = {};
    for (const b of this.buildings) if (b.hp < b.maxHp) buildings[b.id] = Math.max(0, b.hp);
    return {
      level: this.level.id,
      wave: this.waveIdx,
      hp: p.hp,
      he: this.ammoLeft.HE ?? 0,
      ammo: { ...this.ammoLeft } as Record<string, number>,
      x: p.pos.x,
      z: p.pos.z,
      yaw: p.yaw,
      buildings,
      cars: this.cars.filter((c) => !c.alive && !c.m.burnt).map((c) => c.m.id),
      trees: this.trees.filter((t) => t.fallen).map((t) => t.m.id),
      poles: this.poles.filter((t) => t.fallen).map((t) => t.m.id),
      kills: this.kills,
      credits: this.credits,
      time: this.time,
      razed: this.razed,
      savedAt: Date.now(),
      objective: {
        allies: this.allies.map((a) => (a.alive ? a.hp : 0)),
        convoy: this.convoy?.d,
        jammers: this.enemies.filter((e) => e.kind === 'jammer').map((e) => (e.alive ? e.hp : 0)),
      },
    };
  }

  private applyCheckpoint(cp: Checkpoint) {
    this.waveIdx = cp.wave;
    const p = this.player;
    p.hp = cp.hp;
    this.ammoLeft.HE = cp.he;
    for (const [k, v] of Object.entries(cp.ammo ?? {})) if (k in this.ammoLeft) this.ammoLeft[k as AmmoId] = v;
    p.pos.set(cp.x, 0, cp.z);
    p.yaw = p.turretYaw = cp.yaw;
    this.kills = cp.kills;
    this.credits = cp.credits;
    this.time = cp.time;
    this.razed = cp.razed;
    for (const b of this.buildings) {
      const hp = cp.buildings[b.id];
      if (hp === undefined) continue;
      b.hp = hp;
      const want = hp <= 0 ? 0 : Math.ceil((b.info.sections.length * hp) / b.maxHp);
      while (b.left > want) b.info.sections[--b.left].visible = false;
      if (hp <= 0) this.razeBuilding(b, true);
    }
    const ob = cp.objective;
    if (ob) {
      ob.allies?.forEach((hp, i) => {
        const a = this.allies[i];
        if (!a) return;
        a.hp = hp;
        if (hp <= 0) {
          a.alive = false;
          this.discard(a.rig.root);
        }
      });
      if (this.convoy && ob.convoy !== undefined) this.convoy.d = ob.convoy;
      const js = this.enemies.filter((e) => e.kind === 'jammer');
      ob.jammers?.forEach((hp, i) => {
        const j = js[i];
        if (!j) return;
        j.hp = hp;
        if (hp <= 0) {
          j.alive = false;
          this.discard(j.rig.root);
        }
      });
      this.enemies = this.enemies.filter((e) => e.alive);
    }
    const carSet = new Set(cp.cars), treeSet = new Set(cp.trees);
    for (const c of this.cars) if (carSet.has(c.m.id)) this.wreckCar(c, true);
    for (const t of this.trees)
      if (treeSet.has(t.m.id)) {
        t.fallen = true;
        t.t = 1;
        t.pivot.rotation.set(Math.PI * 0.45, t.m.ry, 0, 'YXZ');
      }
    const poleSet = new Set(cp.poles ?? []);
    for (const t of this.poles)
      if (poleSet.has(t.m.id)) {
        const a = Math.random() * Math.PI * 2;
        this.fellPole(t, Math.cos(a), Math.sin(a));
        t.t = 1;
        this.poseP(t);
      }
  }

  // ───────────────── Waves ─────────────────

  private startCountdown(sec: number) {
    this.phase = 'countdown';
    this.phaseT = sec;
    const wave = this.waveDef(this.waveIdx);
    const dirs = [...new Set(wave.groups.map((g) => g.from))];
    const dirTh: Record<Dir, string> = { N: tr('เหนือ', 'north'), S: tr('ใต้', 'south'), E: tr('ตะวันออก', 'east'), W: tr('ตะวันตก', 'west') };
    const w = this.waveIdx;
    this.cb.message(
      this.loops ? `WAVE ${w + 1}` : `WAVE ${w + 1} / ${this.level.waves.length}`,
      w === 0 ? this.level.brief : tr(`กำลังเสริมจากทิศ${dirs.map((d) => dirTh[d]).join(' · ')} · ศัตรู HP +${w * 12}% ดาเมจ +${w * 7}%`, `Reinforcements from the ${dirs.map((d) => dirTh[d]).join(' · ')} · enemy HP +${w * 12}% damage +${w * 7}%`),
    );
    // Pre-plan spawns: wave 1 is scattered around the map away from the player;
    // later waves mix scattered units with reinforcements from the map edges.
    this.pending = [];
    const pts = this.spawnPoints();
    const taken: THREE.Vector3[] = [];
    for (const g of wave.groups) {
      const options = pts[g.from].length ? pts[g.from] : [...pts.N, ...pts.E, ...pts.S, ...pts.W];
      for (let i = 0; i < g.count; i++) {
        const fromEdge = w > 0 && Math.random() < 0.4;
        const inner = fromEdge ? null : this.interiorSpawn(g.from, taken);
        const point = inner ?? options[(i + Math.floor(Math.random() * options.length)) % options.length].clone();
        taken.push(point);
        this.pending.push({ kind: g.kind, from: g.from, at: inner && w === 0 ? i * 0.3 : g.delay + i * 0.9, point, inside: !!inner });
      }
    }
    this.pending.sort((a, b) => a.at - b.at);
    // Warn only about edge reinforcements (scattered units are for the player to find)
    for (const p of this.pending) if (!p.inside && !this.warnings.some((x) => x.point.distanceTo(p.point) < 20)) this.warnings.push({ point: p.point, t: sec + 2 });
  }

  private roadPoints: THREE.Vector3[] = [];

  /** Random road position inside the map, far from (and ideally hidden from) the player. */
  private interiorSpawn(from: Dir, taken: THREE.Vector3[]) {
    const ext = this.city.extent - 8;
    if (!this.roadPoints.length)
      for (const c of this.city.roads)
        for (let t = -ext; t <= ext; t += 6) this.roadPoints.push(new THREE.Vector3(c, 0, t), new THREE.Vector3(t, 0, c));
    const p = this.player.pos;
    const side = (q: THREE.Vector3) => (from === 'N' ? q.z < 0 : from === 'S' ? q.z > 0 : from === 'E' ? q.x > 0 : q.x < 0);
    const ok = (q: THREE.Vector3, minD: number) =>
      q.distanceTo(p) >= minD && !this.nav.isTight(q.x, q.z) && taken.every((t) => t.distanceTo(q) > 12);
    const tiers = [
      this.roadPoints.filter((q) => ok(q, 60) && side(q) && !this.nav.los(q, p)),
      this.roadPoints.filter((q) => ok(q, 60) && !this.nav.los(q, p)),
      this.roadPoints.filter((q) => ok(q, 50)),
    ];
    for (const list of tiers) if (list.length) return list[Math.floor(Math.random() * list.length)].clone();
    return null;
  }

  private spawnPoints() {
    const e = this.city.extent;
    const out: Record<Dir, THREE.Vector3[]> = { N: [], S: [], E: [], W: [] };
    for (const p of this.city.spawns) {
      if (p.z < -e) out.N.push(p);
      else if (p.z > e) out.S.push(p);
      else if (p.x > e) out.E.push(p);
      else out.W.push(p);
    }
    return out;
  }

  private updateWaves(dt: number) {
    if (this.phase === 'countdown') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = 'active';
        this.waveT = 0;
      }
      return;
    }
    if (this.phase !== 'active') return;
    this.waveT += dt;
    while (this.pending.length && this.pending[0].at <= this.waveT) {
      const s = this.pending.shift()!;
      this.spawnEnemy(s);
    }
    // Warn about spawns in the next 2.5 s
    for (const p of this.pending) if (p.at - this.waveT < 2.5 && !this.warnings.some((w) => w.point === p.point)) this.warnings.push({ point: p.point, t: 2.5 });
    if (!this.pending.length && this.enemies.every((e) => e.isStatic)) {
      const bonus = 50 * (this.waveIdx + 1);
      this.credits += bonus;
      this.bankCredits += bonus;
      this.bankXp += 40 * (this.waveIdx + 1);
      this.waveIdx++;
      if (this.waveIdx >= this.level.waves.length && !this.loops) {
        this.finish(true);
        return;
      }
      this.cb.message('WAVE CLEARED', tr(`+${bonus} เครดิต · +${40 * this.waveIdx} EXP · บันทึกแล้ว`, `+${bonus} credits · +${40 * this.waveIdx} EXP · progress saved`));
      this.bank();
      this.cb.checkpoint(this.checkpoint());
      this.startCountdown(7);
    }
  }

  private spawnEnemy(s: PendingSpawn) {
    const def = ENEMIES[s.kind];
    let pos: THREE.Vector3, yaw: number;
    if (s.inside) {
      pos = s.point.clone();
      const onX = this.city.roads.some((c) => Math.abs(s.point.z - c) < 1);
      yaw = onX ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : Math.random() < 0.5 ? 0 : Math.PI;
    } else {
      const lateral = (Math.random() - 0.5) * 7;
      const horizontal = s.from === 'E' || s.from === 'W';
      pos = new THREE.Vector3(s.point.x + (horizontal ? 0 : lateral), 0, s.point.z + (horizontal ? lateral : 0));
      yaw = Math.atan2(-s.point.x, -s.point.z);
    }
    void def;
    this.spawnUnit(s.kind, pos, yaw, !!s.inside);
  }

  /** Create an enemy unit; stats scale with the wave number and the level difficulty. */
  private spawnUnit(kind: EnemyKind, pos: THREE.Vector3, yaw: number, inside: boolean) {
    const def = ENEMIES[kind];
    const rig = VEHICLES.find((v) => v.id === def.vehicle)!.build();
    const w = this.waveIdx, diff = this.level.diff;
    const hp = def.boss ? def.hp * diff : def.hp * (1 + w * 0.12) * diff;
    const e = new Vehicle('enemy', rig, Math.round(hp), def.radius, def, kind);
    e.dmgMul = (1 + w * 0.07) * (1 + (diff - 1) * 0.6);
    rig.root.position.set(pos.x, def.flying ?? 0, pos.z);
    e.yaw = e.turretYaw = yaw;
    rig.root.rotation.y = yaw;
    e.reload = 1 + Math.random() * 2;
    e.lastPos.copy(e.pos);
    e.entered = inside;
    if ((this.level.defend || this.level.convoy) && !def.boss && Math.random() < 0.45) e.focus = true;
    this.scene.add(rig.root);
    this.enemies.push(e);
    if (def.boss) {
      e.state = 'engage';
      e.lastKnown.copy(this.player.pos);
      e.lastSeen = this.elapsed;
      this.cb.message(`BOSS: ${def.boss}`, tr('ปรากฏตัวแล้ว!', 'has appeared!'));
    }
    return e;
  }

  /** APC drops an infantry squad when it engages. */
  private deploySquad(e: Vehicle) {
    e.deployed = true;
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
    for (let i = 0; i < 3; i++) {
      const lat = (i - 1) * 1.6;
      const pos = new THREE.Vector3(e.pos.x - fx * (e.radius + 1.5) + fz * lat, 0, e.pos.z - fz * (e.radius + 1.5) - fx * lat);
      const u = this.spawnUnit(i === 2 ? 'rpg' : 'infantry', pos, e.yaw + Math.PI, true);
      u.state = 'engage';
      u.lastSeen = this.elapsed;
      u.lastKnown.copy(this.player.pos);
    }
    this.texts.push({ pos: e.pos.clone().setY(4), text: tr('ทหารลงจากรถ!', 'Troops deployed!'), color: '#ffb03a', t: 0 });
  }

  // ───────────────── Objectives ─────────────────

  private setupObjectives() {
    const L = this.level;
    if (L.defend) {
      const [x, z] = L.defend;
      const rig = buildSupportTruck('ambulance');
      rig.root.position.set(x, 0.19, z);
      rig.root.rotation.y = Math.PI / 2;
      // Field hospital tent + sandbags beside the ambulance
      const tent = new THREE.Group();
      tent.add(extrudeSide([[-3, 0], [3, 0], [3, 1.6], [0, 3.2], [-3, 1.6]], 7, [mat('tentEnd', { color: 0x7d7a5a, roughness: 1 }), M_CANVAS()]));
      tent.add(box(0.4, 0.02, 1.8, mat('redCross2', { color: 0xb3261e }), 0, 3.25, 0).rotateY(Math.PI / 2));
      tent.add(box(0.4, 0.02, 1.8, mat('redCross2', { color: 0xb3261e }), 0, 3.25, 0));
      tent.position.set(x, 0.19, z - 7);
      tent.traverse((o) => ((o as THREE.Mesh).castShadow = (o as THREE.Mesh).receiveShadow = true));
      this.scene.add(tent);
      const v = new Vehicle('player', rig, 2200, 4.5, null, 'ally');
      v.isStatic = true;
      v.yaw = Math.PI / 2;
      this.scene.add(rig.root);
      this.allies.push(v);
    }
    if (L.convoy) {
      const path = L.convoy.map(([x, z]) => new THREE.Vector3(x, 0, z));
      let total = 0;
      for (let i = 1; i < path.length; i++) total += path[i].distanceTo(path[i - 1]);
      this.convoy = { path, total, d: 22, moving: false };
      for (let i = 0; i < 3; i++) {
        const rig = buildSupportTruck('cargo');
        const v = new Vehicle('player', rig, 750, 3.3, null, 'ally');
        this.scene.add(rig.root);
        this.allies.push(v);
      }
      this.placeConvoy(0);
    }
    if (L.jammers)
      L.jammers.forEach(([x, z]) => {
        const rig = buildJammer();
        rig.root.position.set(x, 0, z);
        const j = new Vehicle('enemy', rig, Math.round(900 * L.diff), 2.4, JAMMER_DEF, 'jammer');
        j.isStatic = true;
        j.entered = true;
        this.scene.add(rig.root);
        this.enemies.push(j);
      });
    L.fuel?.forEach((f, i) => this.addHazard(f.kind, f.at[0], f.at[1], f.ry ?? 0, 10000 + i));
  }

  /** Explosive fuel tank / drum cluster (behaves like a car that blows up hard). */
  private addHazard(kind: 'tank' | 'drums', x: number, z: number, ry: number, id: number) {
    const obj = buildFuelProp(kind, id * 17 + 3);
    obj.position.set(x, 0.19, z);
    obj.rotation.y = ry;
    this.scene.add(obj);
    const c = new Car({ type: 'car', id, x, z, ry, seed: id }, obj);
    c.hazard = kind;
    c.hp = kind === 'tank' ? 60 : 30;
    c.radius = kind === 'tank' ? 2.6 : 1.3;
    this.cars.push(c);
  }

  /** Point and heading at distance `d` along the convoy path. */
  private pathAt(d: number) {
    const path = this.convoy!.path;
    d = THREE.MathUtils.clamp(d, 0, this.convoy!.total);
    for (let i = 1; i < path.length; i++) {
      const seg = path[i].distanceTo(path[i - 1]);
      if (d <= seg || i === path.length - 1) {
        const k = Math.min(1, d / seg);
        const p = path[i - 1].clone().lerp(path[i], k);
        return { p, yaw: Math.atan2(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z) };
      }
      d -= seg;
    }
    return { p: path[0].clone(), yaw: 0 };
  }

  private placeConvoy(dt: number) {
    const c = this.convoy!;
    this.allies.forEach((a, i) => {
      if (!a.alive) return;
      const { p, yaw } = this.pathAt(c.d - i * 11);
      // Trucks keep to the right-hand lane
      a.pos.set(p.x - Math.cos(yaw) * 3.4, 0, p.z + Math.sin(yaw) * 3.4);
      a.yaw = yaw;
      a.rig.root.rotation.y = yaw;
      a.speed = c.moving ? 5 : 0;
      for (const w of a.rig.wheels) w.rotation.x += (a.speed * dt) / 0.55;
    });
  }

  private objectiveHp() {
    return this.allies.filter((a) => a.alive);
  }

  /** The ally a focused enemy goes after. */
  private focusTarget(e: Vehicle) {
    if (this.level.defend) return this.allies[0]?.alive ? this.allies[0] : null;
    if (this.convoy) {
      let best: Vehicle | null = null;
      for (const a of this.allies) if (a.alive && (!best || a.pos.distanceTo(e.pos) < best.pos.distanceTo(e.pos))) best = a;
      return best;
    }
    return null;
  }

  /** Snowfall / blizzard / sandstorm particles around the camera focus. */
  private updateWeather(dt: number) {
    const w = this.level.weather;
    if (!w) return;
    const c = this.camTarget;
    const d = this.fx.density;
    if (w === 'snow' || w === 'blizzard') {
      const rate = (w === 'blizzard' ? 700 : 300) * d;
      const wind = w === 'blizzard' ? 9 : 2;
      // Flakes fill the volume between the ground and the camera so near ones read larger
      const cam = this.camera.position;
      for (let i = 0; i < rate * dt; i++) {
        const k = Math.random();
        const y = 2 + k * (cam.y - 8);
        const z = THREE.MathUtils.lerp(c.z, cam.z, k * 0.9) + (Math.random() - 0.5) * 60;
        this.fx.smoke.emit({
          x: c.x + (Math.random() - 0.5) * (80 - k * 40) - wind * 2, y, z,
          vx: wind + (Math.random() - 0.5), vy: -4 - Math.random() * 2, vz: (Math.random() - 0.5) * 1.5, max: 3, s0: 0.3, s1: 0.3, r: 1, g: 1, b: 1, a: 0.85, vr: 2,
        });
      }
    } else if (w === 'sandstorm') {
      for (let i = 0; i < 40 * d * dt; i++)
        this.fx.smoke.emit({
          x: c.x - 60 + Math.random() * 30, y: 1 + Math.random() * 8, z: c.z + (Math.random() - 0.5) * 90,
          vx: 16 + Math.random() * 6, vy: 0.3, vz: (Math.random() - 0.5) * 2, max: 6, s0: 8, s1: 16, r: 0.78, g: 0.64, b: 0.44, a: 0.22, vr: 0.3,
        });
    }
  }

  private updateObjectives(dt: number) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    const L = this.level;
    if (L.defend) {
      const h = this.allies[0];
      if (!h?.alive) return this.finish(false, tr(`${L.defendLabel ?? 'โรงพยาบาลสนาม'}ถูกทำลาย`, `The ${L.defendLabel ?? 'field hospital'} was destroyed`));
      this.navB?.update(h.pos);
    }
    if (this.convoy) {
      const c = this.convoy;
      const lead = this.allies.find((a) => a.alive);
      if (!lead) return this.finish(false, tr('ขบวนรถถูกทำลายทั้งหมด', 'The whole convoy was destroyed'));
      // Distance to the lead truck clamped into the map: the route starts/ends outside the drivable area
      const lim = this.city.extent - 2;
      const lp = new THREE.Vector3(THREE.MathUtils.clamp(lead.pos.x, -lim, lim), 0, THREE.MathUtils.clamp(lead.pos.z, -lim, lim));
      c.moving = this.player.alive && this.player.pos.distanceTo(lp) < 35;
      if (c.moving) c.d += 5 * dt;
      this.placeConvoy(dt);
      this.navB?.update(lead.pos);
      if (c.d - this.allies.indexOf(lead) * 11 >= c.total) return this.finish(true, tr('ขบวนรถถึงปลายทางแล้ว', 'The convoy reached its destination'));
    }
    if (L.jammers && this.phase === 'active' && !this.enemies.some((e) => e.kind === 'jammer' && e.alive)) this.finish(true, tr(`ทำลาย${L.jammerLabel ?? 'เสาสัญญาณรบกวน'}ครบแล้ว`, `All ${L.jammerLabel ?? 'jammer towers'} destroyed`));
  }

  /** Mission checklist for the HUD corner: objectives first, then star goals. */
  missions(): Mission[] {
    const L = this.level;
    const out: Mission[] = [];
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    if (L.jammers) {
      const label = L.jammerLabel ?? tr('เสาสัญญาณรบกวน', 'jammer towers');
      const one = lang === 'en' ? label.replace(/s$/, '') : label;
      for (const e of this.enemies)
        if (e.kind === 'jammer' && e.alive) out.push({ id: `j${e.id}`, text: `${tr('ทำลาย', 'Destroy')} ${lang === 'en' ? `the ${one}` : one} · ${this.compass(e.pos)}` });
    }
    if (L.defend) {
      const h = this.allies[0];
      out.push({ id: 'defend', text: this.objectiveText()!, state: h && h.hp / h.maxHp < 0.35 ? 'warn' : undefined });
    }
    if (this.convoy) out.push({ id: 'convoy', text: this.objectiveText()! });
    // The wave just cleared is reported once more as done, so its row is ticked off with its final text
    if (!this.loops && this.waveIdx > 0) out.push({ id: `w${this.waveIdx - 1}`, state: 'done', text: tr(`เคลียร์ Wave ${this.waveIdx}/${L.waves.length}`, `Clear wave ${this.waveIdx}/${L.waves.length}`) });
    if (!this.loops && this.waveIdx < L.waves.length) {
      const n = this.enemies.filter((e) => !e.isStatic && e.alive).length + this.pending.length;
      const left = this.phase === 'active' ? ` · ${tr(`เหลือ ${n}`, `${n} left`)}` : '';
      out.push({ id: `w${this.waveIdx}`, text: tr(`เคลียร์ Wave ${this.waveIdx + 1}/${L.waves.length}`, `Clear wave ${this.waveIdx + 1}/${L.waves.length}`) + left });
    }
    for (const b of this.enemies) if (b.alive && b.def?.boss) out.push({ id: `boss${b.id}`, text: `${tr('ทำลาย', 'Destroy')} ${b.def.boss}` });
    const st = L.stars;
    const razed = Math.min(this.razed, st.buildings);
    out.push({ id: 's-bld', star: true, state: razed >= st.buildings ? 'done' : undefined, text: tr(`ทำลายสิ่งปลูกสร้าง ${razed}/${st.buildings}`, `Destroy buildings ${razed}/${st.buildings}`) });
    const over = this.time > st.timeLimit;
    out.push({
      id: 's-time',
      star: true,
      state: over ? 'failed' : undefined,
      text: over ? tr(`จบภายใน ${mmss(st.timeLimit)}`, `Finish within ${mmss(st.timeLimit)}`) : tr(`จบภายใน ${mmss(st.timeLimit)} · เหลือ ${mmss(st.timeLimit - this.time)}`, `Finish within ${mmss(st.timeLimit)} · ${mmss(st.timeLimit - this.time)} left`),
    });
    const hpPct = (this.player.hp / this.player.maxHp) * 100;
    out.push({ id: 's-hp', star: true, state: hpPct < st.minHpPct ? 'warn' : undefined, text: tr(`จบด่านด้วย HP ≥ ${st.minHpPct}%`, `Finish with HP ≥ ${st.minHpPct}%`) });
    return out;
  }

  /** Compass direction of a map position from the centre (north = up on screen). */
  private compass(p: THREE.Vector3) {
    if (Math.hypot(p.x, p.z) < 30) return tr('กลางแผนที่', 'centre');
    const dirs = [tr('ทิศเหนือ', 'north'), tr('ทิศตะวันออกเฉียงเหนือ', 'north-east'), tr('ทิศตะวันออก', 'east'), tr('ทิศตะวันออกเฉียงใต้', 'south-east'), tr('ทิศใต้', 'south'), tr('ทิศตะวันตกเฉียงใต้', 'south-west'), tr('ทิศตะวันตก', 'west'), tr('ทิศตะวันตกเฉียงเหนือ', 'north-west')];
    const a = Math.atan2(p.x, -p.z); // 0 = north (−z), clockwise
    return dirs[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }

  private objectiveText(): string | null {
    const L = this.level;
    if (L.defend) {
      const h = this.allies[0];
      return tr(`ปกป้อง${L.defendLabel ?? 'โรงพยาบาลสนาม'}`, `Protect the ${L.defendLabel ?? 'field hospital'}`) + ` ${Math.max(0, Math.round(h?.hp ?? 0))}/${h?.maxHp ?? 0}`;
    }
    if (this.convoy) {
      const n = this.objectiveHp().length;
      const pct = Math.min(100, Math.round((this.convoy.d / this.convoy.total) * 100));
      return tr(`คุ้มกันขบวนรถ ${pct}% · เหลือ ${n}/3 คัน${this.convoy.moving ? '' : ' · เข้าใกล้ขบวนเพื่อออกตัว'}`, `Escort the convoy ${pct}% · ${n}/3 trucks left${this.convoy.moving ? '' : ' · move closer to get it rolling'}`);
    }
    if (L.jammers) {
      const alive = this.enemies.filter((e) => e.kind === 'jammer' && e.alive).length;
      return tr(`ทำลาย${L.jammerLabel ?? 'เสาสัญญาณรบกวน'}`, `Destroy the ${L.jammerLabel ?? 'jammer towers'}`) + ` ${L.jammers.length - alive}/${L.jammers.length}`;
    }
    return null;
  }

  // ───────────────── Special units ─────────────────

  /** Jammer towers: dish turns, beacon blinks. */
  private updateStatic(e: Vehicle, dt: number) {
    if (e.rig.turret) e.rig.turret.rotation.y += dt * 0.6;
    const b = e.rig.root.getObjectByName('beacon');
    if (b) b.visible = Math.sin(this.elapsed * 6 + e.id) > 0;
  }

  /** Helicopters orbit and strafe from altitude; kamikaze drones dive onto their target. */
  private updateFlyer(e: Vehicle, dt: number) {
    const def = e.def!;
    const ally = e.focus ? this.focusTarget(e) : null;
    const p = ally ?? this.player;
    const pos = e.pos;
    const dist = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
    if (ally) e.state = 'engage';
    else if (e.state !== 'engage' && p.alive && dist < def.detect) this.engage(e);
    if (e.state === 'engage' && !ally) e.lastSeen = this.elapsed;
    let goal: THREE.Vector3;
    if (e.state !== 'engage') {
      if (e.goalNode < 0 || this.roadNodes[e.goalNode].distanceTo(pos.clone().setY(0)) < 10) e.goalNode = Math.floor(Math.random() * this.roadNodes.length);
      goal = this.roadNodes[e.goalNode].clone();
    } else if (def.behaviour === 'kamikaze') goal = p.pos.clone();
    else {
      e.orbitA += (dt * def.speed * 0.7) / def.preferred;
      goal = new THREE.Vector3(p.pos.x + Math.cos(e.orbitA) * def.preferred, 0, p.pos.z + Math.sin(e.orbitA) * def.preferred);
    }
    const dir = goal.sub(pos).setY(0);
    const d = dir.length();
    const speed = e.state === 'engage' ? def.speed : def.speed * 0.6;
    const want = d > 0.01 ? dir.multiplyScalar(Math.min(speed, d * 2) / d) : dir;
    e.vel.lerp(want, Math.min(1, dt * 2));
    pos.x += e.vel.x * dt;
    pos.z += e.vel.z * dt;
    if (this.insideMap(pos, 3)) e.entered = true;
    if (e.entered) {
      const lim = this.city.extent - 2;
      pos.x = THREE.MathUtils.clamp(pos.x, -lim, lim);
      pos.z = THREE.MathUtils.clamp(pos.z, -lim, lim);
    }
    const alt = def.flying!;
    pos.y = def.behaviour === 'kamikaze' && e.state === 'engage' ? THREE.MathUtils.lerp(alt, 1.2, THREE.MathUtils.clamp(1 - dist / 14, 0, 1)) : alt + Math.sin(this.elapsed * 1.3 + e.id) * 0.4;
    const face = e.state === 'engage' ? Math.atan2(p.pos.x - pos.x, p.pos.z - pos.z) : Math.atan2(e.vel.x, e.vel.z);
    e.yaw = wrap(e.yaw + THREE.MathUtils.clamp(wrap(face - e.yaw), -def.turn * dt, def.turn * dt));
    e.rig.root.rotation.set(Math.min(0.3, e.vel.length() * 0.02), e.yaw, 0, 'YXZ');
    for (const r of e.rig.rotors) r.rotation.y += dt * 40;
    if (!p.alive || e.state !== 'engage') return;
    if (def.blast) {
      // Kamikaze: detonate on contact
      if (pos.distanceTo(p.pos.clone().setY(1.2)) < p.radius + 1.2) {
        const w: WeaponDef = { kind: 'shell', damage: def.blast.damage, splash: def.blast.splash, speed: 0, reload: 0, spread: 0, range: 0, building: 1 };
        const blast = { kind: 'shell', team: 'enemy', pos: pos.clone(), prev: pos.clone(), vel: V3(), weapon: w, travelled: 0, alive: true, mult: e.dmgMul, owner: e.id } as Projectile;
        this.detonate(blast, pos.clone(), p);
        e.alive = false;
        e.hp = 0;
        this.discard(e.rig.root);
      }
      return;
    }
    // Helicopter: chin-gun bursts aimed down at the target + rocket salvos
    if (e.rig.turret) e.rig.turret.rotation.y = wrap(Math.atan2(p.pos.x - pos.x, p.pos.z - pos.z) - e.yaw);
    const w = def.weapon;
    e.reload -= dt;
    const inside = this.insideMap(pos, 3);
    if (inside && dist < w.range) {
      if (e.burstLeft > 0) {
        e.burstT -= dt;
        if (e.burstT <= 0) {
          e.burstLeft--;
          e.burstT = w.burstGap ?? 0.2;
          this.airShot(e, p, w);
        }
      } else if (e.reload <= 0) {
        e.reload = w.reload;
        e.burstLeft = (w.burst ?? 1) - 1;
        e.burstT = w.burstGap ?? 0.2;
        this.airShot(e, p, w);
      }
      e.mgT -= dt;
      if (e.mgT <= 0) {
        e.mgT = 9;
        for (let i = 0; i < 4; i++) this.fireWeapon(e, HELI_ROCKET, p.pos.clone());
      }
    }
  }

  private airShot(e: Vehicle, p: Vehicle, w: WeaponDef) {
    const from = V3();
    (e.rig.muzzle ?? e.rig.root).getWorldPosition(from);
    const dir = p.pos.clone().setY(1).sub(from).normalize();
    dir.x += (Math.random() - 0.5) * w.spread * 2;
    dir.z += (Math.random() - 0.5) * w.spread * 2;
    this.proj.fire({ kind: w.kind, team: 'enemy', pos: from, vel: dir.normalize().multiplyScalar(w.speed), weapon: w, mult: e.dmgMul, owner: e.id });
    this.fx.muzzle(from, dir.clone().setY(0).normalize(), false);
    sfx.enemyCannon(Sfx.att(from.distanceTo(this.player.pos)) * 0.7);
  }

  private sight: THREE.Mesh | null = null;

  /** Red aiming beam that locks 0.4 s before the railgun fires (dodge window). */
  private railSight(e: Vehicle, p: Vehicle) {
    if (!this.sight) {
      this.sight = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 1).translate(0, 0, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }),
      );
      this.scene.add(this.sight);
    }
    const from = V3();
    (e.rig.muzzle ?? e.rig.root).getWorldPosition(from);
    if (e.railT > 0.4) e.railAim.copy(p.pos).setY(from.y); // tracking, then locks
    this.sight.visible = Math.sin(this.elapsed * 30) > -0.3;
    this.sight.position.copy(from);
    this.sight.lookAt(e.railAim);
    this.sight.scale.z = from.distanceTo(e.railAim) + 20;
  }

  /** Behemoth: phase-based rocket barrages, secondary MG, drone swarms. */
  private updateBoss(e: Vehicle, dt: number, p: Vehicle) {
    const f = e.hp / e.maxHp;
    const phase = f > 0.5 ? 1 : f > 0.25 ? 2 : 3;
    const name = e.def!.boss!;
    if (phase !== e.bossPhase) {
      e.bossPhase = phase;
      this.cb.message(phase === 2 ? tr(`${name} บาดเจ็บหนัก!`, `${name} is badly damaged!`) : tr(`${name} คลั่ง!`, `${name} is enraged!`), phase === 2 ? tr('ปล่อยโดรนพลีชีพ — จรวดถล่มถี่ขึ้น', 'Launching kamikaze drones — barrages come faster') : tr('จรวดถล่มต่อเนื่อง!', 'Non-stop rocket barrages!'));
      this.fx.shake(0.35);
    }
    if (e.state !== 'engage' || !p.alive || !this.insideMap(e.pos, 3)) return;
    e.bossT -= dt;
    if (e.bossT <= 0) {
      e.bossT = [12, 9, 6][phase - 1];
      for (let i = 0; i < 6 + phase * 2; i++) this.fireWeapon(e, BOSS_ROCKET, p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)));
    }
    e.mgT -= dt;
    if (e.mgT <= 0 && e.pos.distanceTo(p.pos) < 40) {
      e.mgT = 2.5;
      const from = e.pos.clone().add(new THREE.Vector3(-Math.sin(e.yaw) * 3.4, 3, -Math.cos(e.yaw) * 3.4));
      for (let i = 0; i < 6; i++) {
        const dir = p.pos.clone().setY(1.2).sub(from).normalize();
        dir.x += (Math.random() - 0.5) * 0.12;
        dir.z += (Math.random() - 0.5) * 0.12;
        this.proj.fire({ kind: 'bullet', team: 'enemy', pos: from.clone(), vel: dir.normalize().multiplyScalar(55), weapon: BOSS_MG, mult: e.dmgMul, owner: e.id });
      }
      sfx.mg(0.6);
    }
    // Frost Titan: telegraphed railgun slug
    if (e.def!.railgun && phase >= 2) {
      e.railT -= dt;
      if (e.railT < 1.2 && e.railT > 0) this.railSight(e, p);
      if (e.railT <= 0) {
        e.railT = phase === 3 ? 4 : 6;
        if (this.sight) this.sight.visible = false;
        const from = V3();
        (e.rig.muzzle ?? e.rig.root).getWorldPosition(from);
        const dir = e.railAim.clone().sub(from).setY(0).normalize();
        this.proj.fire({ kind: 'shell', team: 'enemy', pos: from, vel: dir.multiplyScalar(140), weapon: TITAN_RAIL, mult: e.dmgMul, owner: e.id });
        this.fx.muzzle(from, dir.clone().normalize(), true);
        this.fx.flash(from, 600, 0.15, 0x5ae0ff);
        sfx.cannon(Sfx.att(from.distanceTo(this.player.pos)));
      }
    }
    if (phase >= 2) {
      e.spawnT -= dt;
      if (e.spawnT <= 0) {
        e.spawnT = 18;
        for (let i = 0; i < 3; i++) {
          const u = this.spawnUnit('kamikaze', e.pos.clone().add(new THREE.Vector3((i - 1) * 4, 0, 0)), e.yaw, true);
          u.state = 'engage';
        }
        this.texts.push({ pos: e.pos.clone().setY(6), text: tr('ปล่อยโดรน!', 'Drones launched!'), color: '#ff5a3a', t: 0 });
      }
    }
  }

  /** Block/unblock a building footprint in every navigation grid. */
  private setBlock(box: THREE.Box3, id: number, value: boolean) {
    this.nav.setBox(box, id, value);
    this.navB?.setBox(box, id, value);
  }

  /** Objective modes keep sending waves until the objective is complete. */
  private get loops() {
    return this.level.mode === 'destroy' || this.level.mode === 'escort';
  }

  private waveDef(i: number) {
    return this.level.waves[Math.min(i, this.level.waves.length - 1)];
  }

  private finish(victory: boolean, reason?: string) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.phase = victory ? 'victory' : 'defeat';
    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    const st = this.level.stars;
    const stars = [victory, victory && hpPct >= st.minHpPct, victory && this.razed >= st.buildings, victory && this.time <= st.timeLimit];
    let credits = this.credits;
    if (victory) {
      const bonus = 200 + stars.filter(Boolean).length * 50;
      credits += bonus;
      this.bankCredits += bonus;
      this.bankXp += 150;
      this.bank();
    }
    setTimeout(() => this.cb.end({ victory, stars, credits, kills: this.kills, time: this.time, razed: this.razed, hpPct }), victory ? 1500 : 2500);
    this.cb.message(victory ? 'MISSION COMPLETE' : reason ? 'MISSION FAILED' : 'TANK DESTROYED', reason ?? (victory ? tr('ภารกิจสำเร็จ', 'Mission accomplished') : tr('ภารกิจล้มเหลว', 'Mission failed')));
  }

  // ───────────────── Main update ─────────────────

  update(dt: number) {
    this.elapsed += dt;
    this.trackFps(dt);
    if (!this.paused) {
      if (this.phase === 'active' || this.phase === 'countdown') this.time += dt;
      this.updateWaves(dt);
      if (this.player.alive) this.updatePlayer(dt);
      this.updateIntel(dt);
      this.assignAttackSlots(dt);
      for (const e of this.enemies) this.updateEnemy(e, dt);
      this.separate();
      this.updateProjectiles(dt);
      this.updateProps(dt);
      this.updateWrecks(dt);
      this.updateDrones(dt);
      this.updateSpecials(dt);
      this.updateObjectives(dt);
      this.updateWeather(dt);
      this.updatePickups(dt);
      this.updateRings(dt);
      this.enemies = this.enemies.filter((e) => e.alive);
      for (const w of this.warnings) w.t -= dt;
      this.warnings = this.warnings.filter((w) => w.t > 0);
      for (const t of this.texts) {
        t.t += dt;
        t.pos.y += dt * 3;
      }
      this.texts = this.texts.filter((t) => t.t < 1.1);
      this.fx.update(dt, this.camera);
      sfx.engineUpdate(Math.min(1, Math.abs(this.player.speed) / PLAYER.speed), this.player.alive && this.phase !== 'victory');
    } else sfx.engineUpdate(0, false);
    if (this.paused || !this.player.alive) {
      if (this.beam) this.beam.visible = false;
      sfx.laserUpdate(false);
    }
    this.proj.render();
    this.updateCamera(dt);
    this.updateFade();
    this.nav.update(this.player.pos);
  }

  render() {
    this.composer.render();
  }

  private trackFps(dt: number) {
    if (!this.autoQuality) return;
    this.fpsAcc += dt;
    this.fpsN++;
    this.fpsT += dt;
    if (this.fpsT < 4) return;
    const fps = this.fpsN / this.fpsAcc;
    this.fpsAcc = this.fpsN = this.fpsT = 0;
    if (fps < 38 && this.quality !== 'low') this.applyQuality(this.quality === 'high' ? 'medium' : 'low');
  }

  // ───────────────── Player ─────────────────

  private updatePlayer(dt: number) {
    const p = this.player;
    const mv = this.input.move();
    let targetSpeed = 0;
    if (mv.lengthSq() > 0) {
      let target = Math.atan2(mv.x, mv.y);
      let dir = 1;
      if (Math.abs(wrap(target - p.yaw)) > Math.PI * 0.6) {
        target = wrap(target + Math.PI);
        dir = -1;
      }
      const diff = wrap(target - p.yaw);
      const turn = PLAYER.turn * this.loadout.speedMul * (this.buffs.nitro > 0 ? 1.35 : 1);
      p.omega = THREE.MathUtils.clamp(diff * 4, -turn, turn);
      targetSpeed = dir * PLAYER.speed * this.loadout.speedMul * (this.buffs.nitro > 0 ? 1.6 : 1) * mv.length() * Math.max(0, Math.cos(diff)) * (dir < 0 ? 0.6 : 1);
    } else p.omega = 0;
    this.drive(p, targetSpeed, dt, 3);

    // Aim
    const stick = this.input.aimStick();
    let wantFire = false;
    let tapAim = false;
    if (this.input.takeTap() && !stick) {
      this.tapShot = 1.2;
      this.tapTarget = this.nearestTarget();
    }
    if (stick) {
      this.tapShot = 0;
      const dir = new THREE.Vector3(stick.x, 0, stick.y).normalize();
      this.aim.copy(p.pos).addScaledVector(dir, 30);
      if (this.settings.autoAim) {
        const t = this.autoTarget(dir);
        if (t) this.aim.copy(t.pos);
      }
      wantFire = stick.length() > 0.55;
    } else if (this.tapShot > 0) {
      this.tapShot -= dt;
      if (this.tapTarget && !this.tapTarget.alive) this.tapTarget = null;
      if (this.tapTarget) this.aim.copy(this.tapTarget.pos);
      else this.holdHeading(p);
      tapAim = true;
    } else if (this.input.mouse && !this.input.touchMode) {
      const m = this.input.mouse;
      this.raycaster.setFromCamera(new THREE.Vector2((m.x / innerWidth) * 2 - 1, -(m.y / innerHeight) * 2 + 1), this.camera);
      this.raycaster.ray.intersectPlane(this.aimPlane, this.aim);
      wantFire = this.input.mouseFire;
    } else {
      // Touch, thumb lifted: hold the turret's current heading. A fixed world aim point would make the
      // turret swing round to face backwards once the tank drives past it.
      this.holdHeading(p);
    }
    const want = Math.atan2(this.aim.x - p.pos.x, this.aim.z - p.pos.z);
    p.turretYaw = wrap(p.turretYaw + THREE.MathUtils.clamp(wrap(want - p.turretYaw), -PLAYER.turretTurn * dt, PLAYER.turretTurn * dt));
    p.rig.turret!.rotation.y = wrap(p.turretYaw - p.yaw);
    // Tap-to-fire: shoot once the turret is on target (or straight away when there is none)
    if (tapAim && p.reload <= 0 && (!this.tapTarget || Math.abs(wrap(want - p.turretYaw)) < 0.06)) {
      wantFire = true;
      this.tapShot = 0;
    }

    p.reload -= dt;
    this.mgReload -= dt;
    if (wantFire && p.reload <= 0 && this.phase !== 'victory') {
      if ((this.ammoLeft[this.ammo] ?? Infinity) <= 0) this.ammo = 'AP';
      const w = AMMO[this.ammo];
      if (this.ammoLeft[this.ammo] !== undefined) this.ammoLeft[this.ammo]!--;
      this.fireWeapon(p, w);
      p.reload = w.reload * this.loadout.reloadMul * (this.buffs.rapid > 0 ? 0.45 : 1);
    }
    const mgWant = this.input.mg() || (!!stick && stick.length() > 0.55);
    this.updateLaser(mgWant && this.buffs.laser > 0 && p.alive, dt);
    if (mgWant && this.buffs.laser <= 0 && this.mgReload <= 0) {
      this.mgReload = PLAYER_MG.reload * this.loadout.reloadMul * (this.buffs.rapid > 0 ? 0.6 : 1);
      if (Math.random() < 0.1) this.noise(p.pos, 45);
      const yaw = p.turretYaw;
      const from = new THREE.Vector3(Math.sin(yaw) * 2.2 + Math.cos(yaw) * 0.45, 2.1, Math.cos(yaw) * 2.2 - Math.sin(yaw) * 0.45).add(p.pos);
      this.spawnProjectile(p, PLAYER_MG, from, yaw);
      if (Math.random() < 0.5) sfx.mg(0.5);
      if (Math.random() < 0.3) this.fx.muzzle(from, new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), false);
    }
    this.updateBuffs(dt);
    this.animate(p, dt);
  }

  /** Aim 30 m ahead along the turret's current heading. */
  private holdHeading(p: Vehicle) {
    this.aim.set(p.pos.x + Math.sin(p.turretYaw) * 30, 0, p.pos.z + Math.cos(p.turretYaw) * 30);
  }

  /** Closest enemy in cannon range with a clear line of fire. */
  private nearestTarget() {
    let best: Vehicle | null = null;
    let bestD = 60;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(this.player.pos);
      if (d < bestD && this.nav.los(this.player.pos, e.pos)) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private autoTarget(dir: THREE.Vector3) {
    let best: Vehicle | null = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      const to = V3().subVectors(e.pos, this.player.pos);
      const d = to.length();
      if (d > 55) continue;
      const ang = to.normalize().angleTo(dir);
      if (ang > 0.45) continue;
      const score = ang * 30 + d;
      if (score < bestScore && this.nav.los(this.player.pos, e.pos)) {
        best = e;
        bestScore = score;
      }
    }
    return best;
  }

  /** Select an ammo type (or cycle to the next one that has rounds left). */
  toggleAmmo(id?: AmmoId) {
    const list = this.loadout.ammo;
    const has = (a: AmmoId) => (this.ammoLeft[a] ?? Infinity) > 0;
    if (id) {
      if (list.includes(id) && has(id)) this.ammo = id;
      return;
    }
    for (let i = 1; i <= list.length; i++) {
      const a = list[(list.indexOf(this.ammo) + i) % list.length];
      if (has(a)) {
        this.ammo = a;
        return;
      }
    }
  }

  /** Select ammo by its slot number (1-based) in the loadout. */
  ammoSlot(n: number) {
    const a = this.loadout.ammo[n - 1];
    if (a) this.toggleAmmo(a);
  }

  /** Integrate hull motion with acceleration, collisions, tracks and dust. */
  private drive(v: Vehicle, targetSpeed: number, dt: number, accel: number) {
    v.yaw = wrap(v.yaw + v.omega * dt);
    v.speed += (targetSpeed - v.speed) * Math.min(1, dt * accel);
    const p = v.pos;
    let dx = Math.sin(v.yaw) * v.speed * dt, dz = Math.cos(v.yaw) * v.speed * dt;
    if (this.level.ice) {
      // Ice: momentum lags behind the hull heading, so vehicles slide through turns
      v.vel.x += (Math.sin(v.yaw) * v.speed - v.vel.x) * Math.min(1, dt * 2.2);
      v.vel.z += (Math.cos(v.yaw) * v.speed - v.vel.z) * Math.min(1, dt * 2.2);
      dx = v.vel.x * dt;
      dz = v.vel.z * dt;
    }
    p.x += dx;
    p.z += dz;
    this.collideStatic(v, dt);
    v.rig.root.rotation.y = v.yaw;
    const moved = Math.hypot(dx, dz) + Math.abs(v.omega) * dt * v.radius * 0.5;
    v.trackDist += moved;
    if (v.rig.treads.length && v.trackDist > 0.7) {
      v.trackDist = 0;
      const hw = v.rig.halfWidth - 0.3;
      for (const s of [-1, 1]) this.fx.tracks.add(p.x + Math.cos(v.yaw) * hw * s, p.z - Math.sin(v.yaw) * hw * s, 0.75, v.yaw, 0.025, 0.55);
    }
    if (!v.def?.infantry && Math.abs(v.speed) > 3 && Math.random() < dt * 6 * this.fx.density) {
      const back = -Math.sign(v.speed) * v.radius;
      this.fx.dust(new THREE.Vector3(p.x + Math.sin(v.yaw) * back, 0, p.z + Math.cos(v.yaw) * back), -Math.sin(v.yaw) * v.speed * 0.2, -Math.cos(v.yaw) * v.speed * 0.2);
    }
  }

  private collideStatic(v: Vehicle, dt: number) {
    const p = v.pos, r = v.radius;
    for (const b of this.buildings) {
      if (!b.alive) continue;
      const bx = b.box;
      if (p.x < bx.min.x - r || p.x > bx.max.x + r || p.z < bx.min.z - r || p.z > bx.max.z + r) continue;
      const cx = THREE.MathUtils.clamp(p.x, bx.min.x, bx.max.x), cz = THREE.MathUtils.clamp(p.z, bx.min.z, bx.max.z);
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        p.x += (dx / d) * (r - d);
        p.z += (dz / d) * (r - d);
        if (v.def?.crusher) this.damageBuilding(b, 90 * dt, p.clone());
        else if (v === this.player && Math.abs(v.speed) > 1.5) this.ram(v, b, new THREE.Vector3(cx, 1.2, cz), dt);
      }
    }
    for (const c of this.cars) {
      const cp = c.obj.position;
      const rr = r + c.radius + 0.2;
      const dx = p.x - cp.x, dz = p.z - cp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr * rr) continue;
      if (!c.alive) {
        // Burnt-out cars are rolled flat under the tracks
        if (!c.crushing && !v.def?.vehicle.startsWith('buggy')) this.crushFx(v, c.obj.position, 0x2a2622, (c.crushing = true));
        continue;
      }
      const d = Math.sqrt(d2) || 0.001;
      p.x += (dx / d) * (rr - d) * 0.8;
      p.z += (dz / d) * (rr - d) * 0.8;
      // Tanks crush cars
      if (Math.abs(v.speed) > 2) this.damageCar(c, 55 * dt * Math.abs(v.speed) * 0.25);
    }
    for (const t of this.trees) {
      if (t.fallen) continue;
      const tp = t.pivot.position;
      const dx = tp.x - p.x, dz = tp.z - p.z;
      if (dx * dx + dz * dz < (r + 0.6) ** 2) this.fellTree(t, dx, dz);
    }
    for (const t of this.poles) {
      if (t.fallen) continue;
      const dx = t.m.x - p.x, dz = t.m.z - p.z;
      if (dx * dx + dz * dz < (r + 0.3) ** 2) {
        this.fellPole(t, dx, dz);
        if (v === this.player) sfx.hit(0.4);
      }
    }
    for (const w of this.wrecks) {
      if (w.obj === v.rig.root) continue;
      const rr = r * 0.8 + w.radius;
      const dx = p.x - w.pos.x, dz = p.z - w.pos.z;
      if (!w.crushing && dx * dx + dz * dz < rr * rr) this.crushFx(v, w.pos, 0x221f1c, (w.crushing = true));
      const t = w.turret;
      if (t?.rest && !t.crushing && Math.hypot(p.x - t.obj.position.x, p.z - t.obj.position.z) < r + 1) this.crushFx(v, t.obj.position, 0x221f1c, (t.crushing = true));
    }
    const lim = v.team === 'enemy' && !v.entered ? this.city.extent + 60 : this.city.extent - 2;
    p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
    p.z = THREE.MathUtils.clamp(p.z, -lim, lim);
  }

  /** Inside the playable area (the square the player can drive in), with a margin. */
  private insideMap(p: THREE.Vector3, margin = 0) {
    const lim = this.city.extent - margin;
    return Math.abs(p.x) < lim && Math.abs(p.z) < lim;
  }

  /** Vehicle-vs-vehicle separation. */
  private separate() {
    const all = [...(this.player.alive ? [this.player] : []), ...this.allies.filter((a) => a.alive), ...this.enemies.filter((e) => e.alive && !e.def?.flying)];
    const weight = (v: Vehicle) => (v.isStatic ? 0 : v === this.player ? 0.3 : v.kind === 'ally' ? 0.15 : 1);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        // Tanks crush infantry
        const soldier = a === this.player && b.def?.infantry ? b : b === this.player && a.def?.infantry ? a : null;
        if (soldier) {
          this.texts.push({ pos: soldier.pos.clone().setY(3), text: tr('บดขยี้!', 'Crushed!'), color: '#ffd23a', t: 0 });
          this.destroyVehicle(soldier, 'player');
          continue;
        }
        const wa = weight(a), wb = weight(b);
        if (wa + wb === 0) continue;
        const d = Math.sqrt(d2) || 0.01;
        const over = rr - d;
        a.pos.x -= (dx / d) * over * (wa / (wa + wb));
        a.pos.z -= (dz / d) * over * (wa / (wa + wb));
        b.pos.x += (dx / d) * over * (wb / (wa + wb));
        b.pos.z += (dz / d) * over * (wb / (wa + wb));
      }
  }

  private animate(v: Vehicle, dt: number) {
    const r = v.rig;
    if (r.legs) {
      v.stepPhase += Math.abs(v.speed) * dt * 3.2;
      const k = Math.min(1, Math.abs(v.speed) / 2);
      r.legs[0].rotation.x = Math.sin(v.stepPhase) * 0.6 * k;
      r.legs[1].rotation.x = -Math.sin(v.stepPhase) * 0.6 * k;
    }
    for (const ro of r.rotors) ro.rotation.y += dt * 40;
    if (r.treads.length) {
      r.treads[0].offset.y -= ((v.speed + v.omega * r.halfWidth) * dt) / 0.8;
      r.treads[1].offset.y -= ((v.speed - v.omega * r.halfWidth) * dt) / 0.8;
    }
    for (const w of r.wheels) w.rotation.x += (v.speed * dt) / 0.55;
    v.recoil = Math.max(0, v.recoil - dt * 3);
    if (r.gun) r.gun.position.z = v.gunZ0 - Math.sin(v.recoil * Math.PI * 0.5) * 0.6;
    v.bump = Math.max(0, v.bump - dt * 2.5);
    r.root.rotation.x = Math.sin(v.bump * 18) * 0.06 * v.bump;
    v.ramT -= dt;
  }

  /** Crunching over a wreck: debris, dust, a jolt and a lurch in speed. */
  private crushFx(v: Vehicle, at: THREE.Vector3, color: number, _flag: boolean) {
    v.bump = 1;
    v.speed *= 0.75;
    for (let i = 0; i < 6 * this.fx.density; i++)
      this.fx.debris.spawn(new THREE.Vector3(at.x + (Math.random() - 0.5) * 2, 0.6, at.z + (Math.random() - 0.5) * 2), new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6), 0.15 + Math.random() * 0.25, color, 3);
    this.fx.dust(at, 0, 0);
    this.fx.impact(at.clone().setY(0.8), true);
    if (v === this.player) {
      this.fx.shake(0.08);
      sfx.hit(0.5);
      sfx.collapse(0.25);
    }
  }

  /** Player ramming a building: damage scales with speed; walls crumble until it collapses. */
  private ram(v: Vehicle, b: Building, at: THREE.Vector3, dt: number) {
    const impact = Math.abs(v.speed);
    this.damageBuilding(b, 40 * impact * dt, at);
    if (v.ramT > 0) return;
    v.ramT = 0.12;
    v.bump = Math.max(v.bump, 0.4);
    this.fx.shake(0.05);
    this.fx.impact(at, false);
    this.fx.dust(at, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    for (let i = 0; i < 3; i++)
      this.fx.debris.spawn(at.clone().setY(1 + Math.random() * 2), new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5), 0.2 + Math.random() * 0.35, b.info.colors[i % b.info.colors.length], 4);
    if (Math.random() < 0.3) sfx.collapse(0.3);
  }

  // ───────────────── Enemy AI ─────────────────

  private slotT = 0;
  private roadNodes: THREE.Vector3[] = [];
  private roadAdj: number[][] = [];
  /** Seconds since any enemy last had eyes on the player. */
  private contactT = 0;
  /** Last time any enemy saw the player (artillery needs a spotter). */
  private spottedAt = -99;

  /** Intersections of the road grid (+ neighbours) for patrol routes. */
  private buildRoadGraph() {
    const R = this.city.roads;
    const n = R.length;
    this.roadNodes = [];
    this.roadAdj = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        this.roadNodes.push(new THREE.Vector3(R[i], 0, R[j]));
        const adj: number[] = [];
        if (i > 0) adj.push((i - 1) * n + j);
        if (i < n - 1) adj.push((i + 1) * n + j);
        if (j > 0) adj.push(i * n + j - 1);
        if (j < n - 1) adj.push(i * n + j + 1);
        this.roadAdj.push(adj);
      }
  }

  private nearestNode(p: THREE.Vector3) {
    let best = 0, bd = Infinity;
    this.roadNodes.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** Steer along the road graph toward `e.goalNode`, keeping to the right-hand lane. */
  private roadSteer(e: Vehicle): THREE.Vector2 | null {
    if (e.node < 0) e.node = this.nearestNode(e.pos);
    if (e.goalNode < 0) e.goalNode = Math.floor(Math.random() * this.roadNodes.length);
    const node = this.roadNodes[e.node];
    const dx = node.x - e.pos.x, dz = node.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 7) {
      if (e.node === e.goalNode) return null;
      const goal = this.roadNodes[e.goalNode];
      let options = this.roadAdj[e.node].filter((k) => k !== e.prevNode);
      if (!options.length) options = this.roadAdj[e.node];
      const score = (k: number) => Math.abs(this.roadNodes[k].x - goal.x) + Math.abs(this.roadNodes[k].z - goal.z) + Math.random() * 30;
      options.sort((a, b) => score(a) - score(b));
      e.prevNode = e.node;
      e.node = options[0];
      return this.roadSteer(e);
    }
    // Right-hand lane offset, easing back to the centre line near intersections
    const ux = dx / d, uz = dz / d;
    const lane = 3.4 * Math.min(1, (d - 7) / 12);
    return V2().set(dx + -uz * lane, dz + ux * lane).normalize();
  }

  /** Put an enemy on alert toward a position (heard gunfire, radio call, intel). */
  private alert(e: Vehicle, at: THREE.Vector3) {
    if (e.state === 'engage') return;
    e.state = 'alert';
    e.lastKnown.copy(at);
    e.goalNode = this.nearestNode(at);
    e.searchT = 0;
    if (e.spotT < this.elapsed - 3) e.spotT = this.elapsed - 1; // shows "?"
  }

  /** The enemy has eyes on the player. Radios nearby allies. */
  private engage(e: Vehicle) {
    const first = e.state !== 'engage';
    e.state = 'engage';
    e.lastSeen = this.elapsed;
    e.lastKnown.copy(this.player.pos);
    this.spottedAt = this.elapsed;
    this.contactT = 0;
    if (!first) return;
    e.spotT = this.elapsed;
    for (const a of this.enemies) if (a !== e && a.alive && a.pos.distanceTo(e.pos) < 70) this.alert(a, this.player.pos);
  }

  /** Gunfire is loud: enemies within `radius` come to investigate. */
  private noise(at: THREE.Vector3, radius: number) {
    for (const e of this.enemies) if (e.alive && e.state !== 'engage' && e.pos.distanceTo(at) < radius) this.alert(e, at);
  }

  private updateIntel(dt: number) {
    if (this.phase !== 'active' || !this.enemies.length || !this.player.alive) return;
    this.contactT += dt;
    if (this.contactT < 25) return;
    this.contactT = 0;
    const hunters = this.enemies.filter((e) => e.state !== 'engage' && !e.isStatic && !e.def?.flying).sort((a, b) => a.pos.distanceTo(this.player.pos) - b.pos.distanceTo(this.player.pos)).slice(0, 2);
    for (const h of hunters) this.alert(h, this.player.pos);
    if (hunters.length) this.cb.message(tr('ถูกดักฟังวิทยุ', 'RADIO INTERCEPTED'), tr('ศัตรูได้รับพิกัดของคุณ', 'The enemy has your coordinates'));
  }

  /**
   * Only a few enemies may press the attack at once; the rest hang back at a longer range
   * until a slot frees up. Keeps big waves readable instead of a point-blank dogpile.
   */
  private assignAttackSlots(dt: number) {
    this.slotT -= dt;
    if (this.slotT > 0) return;
    const step = 0.6 - this.slotT;
    this.slotT = 0.6;
    const max = 3 + Math.floor(this.waveIdx / 3);
    const p = this.player.pos;
    // Slots rotate: after ~8 s of attacking a unit backs off for a few seconds
    for (const e of this.enemies) {
      if (e.token) e.tokenT += step;
      if (e.tokenT > 8) {
        e.tokenT = 0;
        e.restT = 4;
      }
      e.restT = Math.max(0, e.restT - step);
    }
    for (const e of this.enemies) if (e.state !== 'engage') e.token = false;
    const ranked = this.enemies
      .filter((e) => e.alive && !e.isStatic && e.state === 'engage' && e.def!.behaviour !== 'artillery')
      // Current holders get a bonus so slots don't flicker between units
      .map((e) => ({ e, score: e.pos.distanceTo(p) - (e.token ? 12 : 0) - (e.los ? 6 : 0) + (e.restT > 0 ? 60 : 0) }))
      .sort((a, b) => a.score - b.score);
    // At most 2 slots per enemy type so a wave attacks with a mix of units
    const perKind = new Map<string, number>();
    let given = 0;
    for (const { e } of ranked) {
      const n = perKind.get(e.kind) ?? 0;
      e.token = given < max && n < 2;
      if (e.token) {
        given++;
        perKind.set(e.kind, n + 1);
      } else e.tokenT = 0;
    }
    // Fill leftover slots if the wave has few types
    for (const e of this.enemies) if (e.def!.behaviour === 'artillery' && e.state !== 'engage') e.token = false;
    for (const { e } of ranked) if (!e.token && given < max && e.restT <= 0) {
      e.token = true;
      given++;
    }
    // Only one rocket launcher shells the player at a time
    const arty = this.enemies
      .filter((e) => e.alive && e.state === 'engage' && e.def!.behaviour === 'artillery')
      .sort((a, b) => (b.token ? 1 : 0) - (a.token ? 1 : 0) || a.pos.distanceTo(p) - b.pos.distanceTo(p));
    arty.forEach((e, i) => (e.token = i === 0));
  }

  /** Movement while not in contact: patrol the roads, or head to the last known position. */
  private patrolMove(e: Vehicle, dt: number) {
    const def = e.def!;
    let desired: THREE.Vector2 | null;
    let speedScale = e.state === 'patrol' ? 0.55 : 0.85;
    const lk = e.lastKnown;
    const toLk = V2().set(lk.x - e.pos.x, lk.z - e.pos.z);
    if (e.state === 'patrol') {
      desired = this.roadSteer(e);
      if (!desired) {
        e.goalNode = Math.floor(Math.random() * this.roadNodes.length);
        desired = this.roadSteer(e);
      }
    } else if (toLk.length() > 10) {
      // Road network until close to the last known position, then cut straight in
      const nodeD = e.goalNode >= 0 ? this.roadNodes[e.goalNode].distanceTo(lk) : Infinity;
      desired = toLk.length() < nodeD + 8 ? (this.nav.flow(e.pos.x, e.pos.z) && lk.distanceTo(this.player.pos) < 15 ? this.nav.flow(e.pos.x, e.pos.z) : toLk.normalize()) : this.roadSteer(e) ?? toLk.normalize();
    } else {
      // Arrived: sweep around, then give up and resume patrolling
      e.searchT += dt;
      desired = V2().set(Math.cos(this.elapsed * 0.8 + e.id), Math.sin(this.elapsed * 0.8 + e.id));
      speedScale = 0.35;
      if (e.searchT > 5) {
        e.state = 'patrol';
        e.goalNode = -1;
        e.node = -1;
      }
    }
    // Keep spacing
    const rep = V2();
    for (const a of this.enemies) {
      if (a === e || !a.alive) continue;
      const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z;
      const sep = e.radius + a.radius + 4;
      const d = Math.hypot(dx, dz);
      if (d < sep && d > 0.01) rep.addScaledVector(V2().set(dx / d, dz / d), (sep - d) / sep);
    }
    if (desired) desired.addScaledVector(rep, 1.2).normalize();
    if (e.reverseT > 0) {
      e.reverseT -= dt;
      e.omega = def.turn * 0.6 * e.strafeDir;
      this.drive(e, -def.speed * 0.4, dt, 3);
    } else {
      let targetSpeed = 0;
      if (desired) {
        const diff = wrap(Math.atan2(desired.x, desired.y) - e.yaw);
        e.omega = THREE.MathUtils.clamp(diff * 3, -def.turn, def.turn);
        targetSpeed = def.speed * speedScale * Math.max(0.15, Math.cos(diff));
        e.stuckT += dt;
        if (e.stuckT > 2) {
          if (e.pos.distanceTo(e.lastPos) < 1) {
            e.reverseT = 1 + Math.random();
            e.strafeDir *= -1;
          }
          e.stuckT = 0;
          e.lastPos.copy(e.pos);
        }
      } else e.omega = 0;
      this.drive(e, targetSpeed, dt, 2);
    }
    // Turret scans: toward the last known position when alerted, otherwise sweeping ahead
    const want = e.state === 'patrol' ? e.yaw + Math.sin(this.elapsed * 0.6 + e.id * 1.7) * 0.9 : Math.atan2(lk.x - e.pos.x, lk.z - e.pos.z);
    e.turretYaw = wrap(e.turretYaw + THREE.MathUtils.clamp(wrap(want - e.turretYaw), -def.turretTurn * dt * 0.6, def.turretTurn * dt * 0.6));
    if (e.rig.turret) e.rig.turret.rotation.y = wrap(e.turretYaw - e.yaw);
    e.burstLeft = 0;
    e.reload = Math.max(e.reload - dt, 0.6);
    this.animate(e, dt);
  }

  /** First ally that a shot from `e` toward (tx, tz) would hit, or whose position the blast would catch. */
  private allyInLine(e: Vehicle, tx: number, tz: number, w: WeaponDef) {
    if (w.kind === 'rocket') {
      for (const a of this.enemies) if (a !== e && a.alive && Math.hypot(a.pos.x - tx, a.pos.z - tz) < w.splash + a.radius + 4) return a;
      return null;
    }
    const dx = tx - e.pos.x, dz = tz - e.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    for (const a of this.enemies) {
      if (a === e || !a.alive) continue;
      const rx = a.pos.x - e.pos.x, rz = a.pos.z - e.pos.z;
      const along = rx * ux + rz * uz;
      if (along <= 0 || along > len + a.radius) continue;
      const perp = Math.abs(rx * uz - rz * ux);
      if (perp < a.radius + 1.2 + w.splash * 0.5) return a;
    }
    return null;
  }

  private updateEnemy(e: Vehicle, dt: number) {
    if (e.isStatic) return this.updateStatic(e, dt);
    const def = e.def!;
    if (def.flying) return this.updateFlyer(e, dt);
    const ally = e.focus ? this.focusTarget(e) : null;
    const p = ally ?? this.player;
    const to = V2().set(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    const dist = to.length();
    const dirTo = to.clone().normalize();
    e.losT -= dt;
    if (e.losT <= 0) {
      e.los = this.nav.los(e.pos, p.pos);
      e.losT = 0.25 + Math.random() * 0.2;
      // Perception: sight within detect range, or hearing the engine up close
      if (!ally && p.alive && ((e.los && dist < def.detect * (e.state === 'patrol' ? 1 : 1.3)) || dist < 18)) this.engage(e);
    }
    if (ally) {
      e.state = 'engage';
      e.lastSeen = this.elapsed;
      e.lastKnown.copy(p.pos);
      e.token = true;
    }
    if (def.deploys && !e.deployed && e.state === 'engage' && dist < 45 && this.insideMap(e.pos, 3)) this.deploySquad(e);
    if (e.state === 'engage' && e.los && dist < def.detect * 1.5) {
      e.lastSeen = this.elapsed;
      e.lastKnown.copy(p.pos);
      this.spottedAt = this.elapsed;
      this.contactT = 0;
    }
    if (e.state === 'engage' && this.elapsed - e.lastSeen > 6) {
      e.state = 'search';
      e.goalNode = this.nearestNode(e.lastKnown);
      e.searchT = 0;
    }
    const inside = this.insideMap(e.pos, 3);
    if (inside) e.entered = true;
    if (e.state !== 'engage') {
      this.patrolMove(e, dt);
      return;
    }
    const flow = (ally && this.navB ? this.navB : this.nav).flow(e.pos.x, e.pos.z) ?? dirTo.clone();
    let desired: THREE.Vector2 | null = null;
    let speedScale = 1;
    const away = dirTo.clone().negate();
    const freeAhead = (d: THREE.Vector2) => !this.nav.isTight(e.pos.x + d.x * 6, e.pos.z + d.y * 6);
    const w = def.weapon;
    // Units without an attack slot wait further out
    const hold = e.token ? def.preferred : def.preferred + 16;
    switch (def.behaviour) {
      case 'strafe':
        if (dist > hold + 12 || !e.los) desired = flow;
        else {
          const tang = V2().set(-to.y, to.x).normalize().multiplyScalar(e.strafeDir);
          desired = tang.addScaledVector(dirTo, (dist - hold) / 8).normalize();
          if (!freeAhead(desired)) {
            e.strafeDir *= -1;
            desired = flow;
          }
          if (!e.token) speedScale = 0.6;
        }
        break;
      case 'chase':
      case 'standoff':
        if (dist > hold || !e.los) desired = flow;
        else if (dist < hold - (e.token ? 8 : 4) && freeAhead(away)) {
          desired = away;
          speedScale = 0.6;
        }
        break;
      case 'artillery':
        if (dist > w.range * (e.token ? 0.85 : 1.15)) desired = flow;
        else if (dist < def.preferred - 15 && freeAhead(away)) desired = away;
        break;
    }
    if (!inside) {
      desired = flow;
      speedScale = 1;
    }
    // Side-step to open a clear line of fire
    if (e.flankT > 0) {
      e.flankT -= dt;
      const side = V2().set(-dirTo.y, dirTo.x).multiplyScalar(e.flankDir);
      if (freeAhead(side)) {
        desired = side.addScaledVector(dirTo, dist > hold ? 0.3 : -0.2).normalize();
        speedScale = 0.8;
      } else e.flankDir *= -1;
    }
    // Keep spacing from other enemies instead of bunching up
    const rep = V2();
    for (const a of this.enemies) {
      if (a === e || !a.alive) continue;
      const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z;
      const sep = e.radius + a.radius + 6;
      const d = Math.hypot(dx, dz);
      if (d < sep && d > 0.01) rep.addScaledVector(V2().set(dx / d, dz / d), (sep - d) / sep);
    }
    if (desired) desired = desired.addScaledVector(rep, 1.4).normalize();
    else if (rep.length() > 0.3) {
      desired = rep.clone().normalize();
      speedScale = 0.45;
    }
    if (!p.alive) desired = null;
    // Stuck recovery
    if (e.reverseT > 0) {
      e.reverseT -= dt;
      e.omega = def.turn * 0.6 * e.strafeDir;
      this.drive(e, -def.speed * 0.5, dt, 3);
    } else {
      let targetSpeed = 0;
      if (desired) {
        const diff = wrap(Math.atan2(desired.x, desired.y) - e.yaw);
        e.omega = THREE.MathUtils.clamp(diff * 3, -def.turn, def.turn);
        targetSpeed = def.speed * speedScale * Math.max(0.15, Math.cos(diff));
        e.stuckT += dt;
        if (e.stuckT > 1.5) {
          if (e.pos.distanceTo(e.lastPos) < 1.2 && speedScale > 0.5) {
            e.reverseT = 1 + Math.random();
            e.strafeDir *= -1;
          }
          e.stuckT = 0;
          e.lastPos.copy(e.pos);
        }
      } else e.omega = 0;
      this.drive(e, targetSpeed, dt, 2);
    }

    // Turret aim with lead
    const flight = w.kind === 'rocket' ? 0 : dist / w.speed;
    const pv = V2().set(Math.sin(p.yaw) * p.speed, Math.cos(p.yaw) * p.speed);
    // Only partial lead: a tank that keeps moving or changes direction can dodge slow rounds
    const lead = flight * 0.5;
    const aimX = p.pos.x + pv.x * lead, aimZ = p.pos.z + pv.y * lead;
    const want = Math.atan2(aimX - e.pos.x, aimZ - e.pos.z);
    const tdiff = wrap(want - e.turretYaw);
    e.turretYaw = wrap(e.turretYaw + THREE.MathUtils.clamp(tdiff, -def.turretTurn * dt, def.turretTurn * dt));
    if (e.rig.turret) e.rig.turret.rotation.y = wrap(e.turretYaw - e.yaw);

    e.reload -= dt;
    const spotted = e.los || (w.kind === 'rocket' && this.elapsed - this.spottedAt < 2);
    // No shooting from outside the playable area (its wreck/loot would be unreachable)
    const inArc = inside && p.alive && dist <= w.range && spotted && Math.abs(tdiff) < 0.12 && this.phase === 'active';
    // Check the line of fire only when about to shoot
    const blocker = inArc && (e.burstLeft > 0 || e.reload <= 0) ? this.allyInLine(e, aimX, aimZ, w) : null;
    if (blocker) {
      e.burstLeft = 0;
      if (e.flankT <= 0) {
        // Step to the side away from the ally blocking the shot
        const cross = dirTo.x * (blocker.pos.z - e.pos.z) - dirTo.y * (blocker.pos.x - e.pos.x);
        e.flankDir = cross > 0 ? 1 : -1;
        e.flankT = 1 + Math.random() * 0.8;
      }
    } else if (e.burstLeft > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burstLeft--;
        e.burstT = w.burstGap ?? 0.1;
        this.fireWeapon(e, w, new THREE.Vector3(aimX, 0, aimZ));
      }
    } else if (inArc && e.token && e.reload <= 0) {
      e.reload = w.reload * (0.85 + Math.random() * 0.3);
      e.burstLeft = (w.burst ?? 1) - 1;
      e.burstT = w.burstGap ?? 0.1;
      this.fireWeapon(e, w, new THREE.Vector3(aimX, 0, aimZ));
    }
    if (def.barrage) this.updateBoss(e, dt, p);
    this.animate(e, dt);
  }

  // ───────────────── Weapons ─────────────────

  private fireWeapon(v: Vehicle, w: WeaponDef, target?: THREE.Vector3) {
    const from = V3();
    (v.rig.muzzle ?? v.rig.root).getWorldPosition(from);
    const yaw = v.turretYaw;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const att = Sfx.att(from.distanceTo(this.player.pos));
    if (w.kind === 'rocket') {
      const t = (target ?? this.player.pos).clone();
      t.x += (Math.random() - 0.5) * 8;
      t.z += (Math.random() - 0.5) * 8;
      t.y = 0.2;
      const d = from.distanceTo(t);
      const proj = this.proj.fire({ kind: 'rocket', team: v.team, pos: from.clone(), vel: dir.clone(), weapon: w, start: from.clone(), target: t, t: 0, T: Math.max(2, d / w.speed), apex: 10 + d * 0.25, mult: v.dmgMul, owner: v.id });
      if (proj) this.addRing(t, w.splash, proj.T!);
      this.fx.smoke.emit({ x: from.x, y: from.y, z: from.z, vy: 1, max: 1.5, s0: 2, s1: 5, r: 0.7, g: 0.68, b: 0.65, a: 0.5 });
      sfx.rocketLaunch(att);
      return;
    }
    this.spawnProjectile(v, w, from, yaw);
    if (w.kind === 'shell') {
      v.recoil = 1;
      this.fx.muzzle(from, dir, true);
      if (v === this.player) {
        sfx.cannon();
        this.fx.shake(0.12);
        this.noise(v.pos, 90);
      } else sfx.enemyCannon(att);
    } else {
      this.fx.muzzle(from, dir, false);
      sfx.mg(att * 0.8);
    }
  }

  private spawnProjectile(v: Vehicle, w: WeaponDef, from: THREE.Vector3, yaw: number) {
    const a = yaw + (Math.random() - 0.5) * 2 * w.spread;
    const vel = new THREE.Vector3(Math.sin(a) * w.speed, 0, Math.cos(a) * w.speed);
    const mult = v === this.player ? (this.buffs.overcharge > 0 ? 2 : 1) : v.dmgMul;
    this.proj.fire({ kind: w.kind, team: v.team, pos: from.clone(), vel, weapon: w, mult, owner: v.id });
  }

  private updateProjectiles(dt: number) {
    this.proj.step(dt);
    const seg = new THREE.Line3();
    const closest = V3();
    for (const pr of this.proj.list) {
      if (!pr.alive) continue;
      if (pr.kind === 'rocket') {
        if (Math.random() < 0.9) this.fx.smoke.emit({ x: pr.pos.x, y: pr.pos.y, z: pr.pos.z, vy: 0.3, max: 1 + Math.random(), s0: 0.6, s1: 2.2, r: 0.8, g: 0.78, b: 0.75, a: 0.45 });
        this.fx.fire.emit({ x: pr.pos.x, y: pr.pos.y, z: pr.pos.z, max: 0.08, s0: 0.9, s1: 0.3, r: 1, g: 0.7, b: 0.3 });
        const kit = ARMOR_KITS[this.loadout.armor];
        if (kit.aps && pr.team === 'enemy' && this.apsT <= 0 && this.player.alive && pr.t! / pr.T! > 0.6 && pr.pos.distanceTo(this.player.pos) < 14) {
          this.apsIntercept(pr);
          continue;
        }
        if (pr.t! >= pr.T!) {
          // Guided strike shells that land on their target count as direct hits
          const seek = pr.seek as Vehicle | undefined;
          const direct = seek?.alive && Math.hypot(seek.pos.x - pr.target!.x, seek.pos.z - pr.target!.z) < seek.radius + 1.5 ? seek : null;
          this.detonate(pr, pr.target!.clone(), direct);
        }
        continue;
      }
      const high = pr.kind === 'missile' && pr.pos.y > 3.2;
      if (pr.kind === 'missile') {
        this.fx.smoke.emit({ x: pr.pos.x, y: pr.pos.y, z: pr.pos.z, vy: 0.2, max: 0.8 + Math.random() * 0.6, s0: 0.45, s1: 1.8, r: 0.85, g: 0.84, b: 0.82, a: 0.5 });
        this.fx.fire.emit({ x: pr.pos.x, y: pr.pos.y, z: pr.pos.z, max: 0.06, s0: 0.7, s1: 0.2, r: 1, g: 0.75, b: 0.4 });
        // Proximity fuse
        const seek = pr.seek as Vehicle | undefined;
        if (seek?.alive && pr.pos.distanceTo(seek.pos.clone().setY(1.2)) < seek.radius) {
          this.detonate(pr, pr.pos.clone(), seek);
          continue;
        }
        if (pr.pos.y < 0.4 || (pr.life ?? 0) > 6) {
          this.detonate(pr, pr.pos.clone().setY(0.3), null);
          continue;
        }
      }
      seg.set(pr.prev, pr.pos);
      // Active Protection System: shoot down incoming shells/rockets near the tank
      const kit = ARMOR_KITS[this.loadout.armor];
      if (kit.aps && pr.team === 'enemy' && pr.kind === 'shell' && this.apsT <= 0 && this.player.alive && pr.pos.distanceTo(this.player.pos) < 9) {
        this.apsIntercept(pr);
        continue;
      }
      if (pr.weapon.special === 'pierce') {
        // Railgun: bright trail, passes through every vehicle it touches
        for (let i = 0; i < 4; i++) {
          const q = pr.prev.clone().lerp(pr.pos, i / 4);
          this.fx.fire.emit({ x: q.x, y: q.y, z: q.z, max: 0.35, s0: 0.7, s1: 0.1, r: 0.35, g: 0.85, b: 1 });
        }
        pr.pierced ??= new Set();
        for (const v of this.enemies) {
          if (!v.alive || pr.pierced.has(v.id)) continue;
          seg.closestPointToPoint(v.pos.clone().setY(pr.pos.y), true, closest);
          if (closest.distanceTo(v.pos.clone().setY(pr.pos.y)) < v.radius * 0.9) {
            pr.pierced.add(v.id);
            const crit = Math.random() < this.sk.crit * 0.04;
            this.damageVehicle(v, pr.weapon.damage * pr.mult * this.loadout.dmgMul * (crit ? 2 : 1), closest.clone(), 'player', false, 'shell', crit);
            this.fx.impact(closest.clone(), true);
            this.fx.flash(closest, 200, 0.1, 0x5ae0ff);
          }
        }
      }
      // Vehicles
      // Enemy fire can hit other enemies (friendly fire); player fire never hits the player
      const targets = this.vehiclesHitBy(pr.team, pr.owner);
      let hit = false;
      for (const v of targets) {
        if (!v.alive || high || pr.weapon.special === 'pierce') continue;
        seg.closestPointToPoint(v.pos.clone().setY(pr.pos.y), true, closest);
        if (closest.distanceTo(v.pos.clone().setY(pr.pos.y)) < v.radius * 0.85) {
          this.detonate(pr, closest.clone(), v);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // Cars
      for (const c of this.cars) {
        if (!c.alive || high) continue;
        const cp = c.obj.position;
        seg.closestPointToPoint(new THREE.Vector3(cp.x, pr.pos.y, cp.z), true, closest);
        if (Math.hypot(closest.x - cp.x, closest.z - cp.z) < c.radius) {
          this.damageCar(c, pr.weapon.damage * (pr.kind === 'bullet' ? 1.5 : 1));
          if (pr.kind === 'shell' || pr.kind === 'missile') this.detonate(pr, closest.clone(), null);
          else {
            this.fx.impact(closest, true);
            pr.alive = false;
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // Buildings
      const k = this.nav.idx(pr.pos.x, pr.pos.z);
      if (k >= 0 && this.nav.blocked[k]) {
        const b = this.buildings[this.nav.owner[k]];
        if (b && b.alive && pr.pos.y < b.top()) {
          this.detonate(pr, pr.pos.clone(), null, b);
          continue;
        }
      }
      if (pr.kind === 'shell' && pr.pos.y < 0.15) {
        this.detonate(pr, pr.pos.clone().setY(0.3), null);
        continue;
      }
      if (pr.kind === 'bullet' && pr.pos.y < 0.1) {
        this.fx.impact(pr.pos.clone().setY(0.2), false);
        pr.alive = false;
        continue;
      }
      if (pr.kind !== 'missile' && pr.travelled > pr.weapon.range) {
        if (pr.kind === 'shell') this.detonate(pr, pr.pos.clone().setY(0.3), null);
        else pr.alive = false;
      }
    }
    this.proj.sweep();
  }

  /** Impact: direct damage + splash to vehicles, buildings, cars, trees. */
  private detonate(pr: Projectile, at: THREE.Vector3, direct: Vehicle | null, building?: Building) {
    pr.alive = false;
    const w = pr.weapon;
    const own = pr.team === 'player' ? this.loadout.dmgMul : 1;
    if (direct) {
      const crit = pr.team === 'player' && Math.random() < this.sk.crit * 0.04;
      this.damageVehicle(direct, w.damage * pr.mult * own * (crit ? 2 : 1), at, pr.team, false, w.kind, crit);
    }
    if (building) this.damageBuilding(building, w.damage * w.building * own, at);
    if (w.special === 'fire') this.igniteField(at);
    if (w.special === 'cluster') this.scatterBomblets(at);
    const big = w.kind !== 'bullet';
    if (big) {
      const size = Math.max(0.6, w.splash / 3.2);
      this.fx.explosion(at, size);
      sfx.explosion(size * 0.8, Sfx.att(at.distanceTo(this.player.pos)));
    } else this.fx.impact(at, !!direct);
    if (direct && !big && direct === this.player) sfx.hit(0.6);
    if (w.splash <= 0) return;
    const r = w.splash;
    const falloff = (d: number) => Math.max(0, 1 - d / r);
    for (const v of this.vehiclesHitBy(pr.team, pr.owner)) {
      if (v === direct) continue;
      const d = Math.hypot(v.pos.x - at.x, v.pos.z - at.z) - v.radius * 0.5;
      if (d < r) this.damageVehicle(v, w.damage * 0.6 * falloff(Math.max(0, d)) * pr.mult * own, at, pr.team, false, 'splash');
    }
    for (const b of this.buildings) {
      if (!b.alive || b === building) continue;
      const cx = THREE.MathUtils.clamp(at.x, b.box.min.x, b.box.max.x), cz = THREE.MathUtils.clamp(at.z, b.box.min.z, b.box.max.z);
      const d = Math.hypot(at.x - cx, at.z - cz);
      if (d < r) this.damageBuilding(b, w.damage * w.building * 0.5 * falloff(d), at);
    }
    for (const c of this.cars) {
      if (!c.alive) continue;
      const d = c.obj.position.distanceTo(at);
      if (d < r + 1) this.damageCar(c, w.damage * falloff(Math.max(0, d - 1)));
    }
    for (const t of this.trees) {
      if (t.fallen) continue;
      const dx = t.pivot.position.x - at.x, dz = t.pivot.position.z - at.z;
      if (dx * dx + dz * dz < (r * 0.8) ** 2) this.fellTree(t, dx, dz);
    }
    for (const t of this.poles) {
      if (t.fallen) continue;
      const dx = t.m.x - at.x, dz = t.m.z - at.z;
      if (dx * dx + dz * dz < (r * 0.8) ** 2) this.fellPole(t, dx, dz);
    }
  }

  private apsIntercept(pr: Projectile) {
    pr.alive = false;
    this.apsT = ARMOR_KITS[this.loadout.armor].aps!;
    this.fx.explosion(pr.pos.clone(), 0.5);
    this.fx.flash(pr.pos, 300, 0.1, 0x9ad8ff);
    this.texts.push({ pos: this.player.pos.clone().setY(5), text: tr('APS สกัด!', 'APS intercept!'), color: '#9ad8ff', t: 0 });
    sfx.hit(0.6);
  }

  /** Commit earnings to the profile. */
  private bank() {
    if (this.bankCredits || this.bankXp) this.cb.earn(this.bankCredits, this.bankXp);
    this.bankCredits = this.bankXp = 0;
  }

  // ───────────────── Special ammo effects ─────────────────

  private igniteField(at: THREE.Vector3) {
    this.fires.push({ pos: at.clone().setY(0.3), t: FIRE_FIELD.time });
    this.fx.scorch.add(at.x, at.z, FIRE_FIELD.radius * 2);
  }

  private scatterBomblets(at: THREE.Vector3) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.6, r = 2.5 + Math.random() * 4.5;
      const pos = new THREE.Vector3(at.x + Math.cos(a) * r, 0.4, at.z + Math.sin(a) * r);
      this.bomblets.push({ pos, t: 0.25 + Math.random() * 0.5 });
      this.fx.debris.spawn(at.clone().setY(1), new THREE.Vector3(Math.cos(a) * r * 2, 5, Math.sin(a) * r * 2), 0.18, 0x2a2a26, 0.8);
    }
  }

  private updateSpecials(dt: number) {
    for (const f of this.fires) {
      f.t -= dt;
      const k = Math.min(1, f.t / 2);
      for (let i = 0; i < 3 * this.fx.density; i++)
        if (Math.random() < dt * 20) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * FIRE_FIELD.radius;
          this.fx.fire.emit({ x: f.pos.x + Math.cos(a) * r, y: 0.3, z: f.pos.z + Math.sin(a) * r, vy: 2 + Math.random() * 2, drag: 1, max: 0.6 + Math.random() * 0.4, s0: 1.4 * k + 0.3, s1: 0.4, r: 1, g: 0.5, b: 0.12, r1: 0.6, g1: 0.1, b1: 0 });
        }
      if (Math.random() < dt * 3) this.fx.smokeColumn(f.pos, 0.6 * k, 0.1);
      for (const e of this.enemies)
        if (e.alive && Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z) < FIRE_FIELD.radius + e.radius * 0.5)
          this.damageVehicle(e, FIRE_FIELD.dps * dt * this.loadout.dmgMul, e.pos.clone().setY(1), 'player', true, 'splash');
      for (const b of this.buildings) {
        if (!b.alive) continue;
        const cx = THREE.MathUtils.clamp(f.pos.x, b.box.min.x, b.box.max.x), cz = THREE.MathUtils.clamp(f.pos.z, b.box.min.z, b.box.max.z);
        if (Math.hypot(f.pos.x - cx, f.pos.z - cz) < FIRE_FIELD.radius) this.damageBuilding(b, FIRE_FIELD.buildingDps * dt, f.pos);
      }
    }
    this.fires = this.fires.filter((f) => f.t > 0);
    for (const b of this.bomblets) {
      b.t -= dt;
      if (b.t > 0) continue;
      const blast = { kind: 'shell', team: 'player', pos: b.pos.clone(), prev: b.pos.clone(), vel: V3(), weapon: CLUSTER_BOMBLET, travelled: 0, alive: true, mult: 1, owner: this.player.id } as Projectile;
      this.detonate(blast, b.pos.clone(), null);
    }
    this.bomblets = this.bomblets.filter((b) => b.t > 0);
    // APS cooldown & field-repair regeneration
    this.apsT = Math.max(0, this.apsT - dt);
    this.sinceHit += dt;
    const p = this.player;
    if (p.alive && this.sk.regen > 0 && this.sinceHit > 4 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + this.sk.regen * 2 * dt);
  }

  /** Vehicles a shot from `team` can damage: enemies hurt each other, the player never hurts itself. */
  private vehiclesHitBy(team: Team, owner: number) {
    const out: Vehicle[] = [];
    if (team === 'enemy') {
      if (this.player.alive) out.push(this.player);
      for (const a of this.allies) if (a.alive) out.push(a);
    }
    for (const e of this.enemies) if (e.alive && e.id !== owner && !(team === 'enemy' && e.isStatic)) out.push(e);
    return out;
  }

  private damageVehicle(v: Vehicle, amount: number, at: THREE.Vector3, source: Team = 'player', quiet = false, kind: DamageKind = 'splash', crit = false) {
    if (!v.alive || amount <= 0) return;
    if (v === this.player) {
      // Defense upgrade + equipped armour kit
      amount *= this.loadout.defMul * (ARMOR_KITS[this.loadout.armor].resist?.[kind] ?? 1);
      this.sinceHit = 0;
    }
    if (v === this.player && this.buffs.shield > 0 && this.shieldHp > 0) {
      const absorbed = Math.min(amount, this.shieldHp);
      this.shieldHp -= absorbed;
      amount -= absorbed;
      this.shieldHit = 1;
      this.fx.impact(at.clone().setY(Math.max(1.2, at.y)), true);
      if (this.shieldHp <= 0) {
        this.buffs.shield = 0.001; // expires next frame
        this.texts.push({ pos: v.pos.clone().setY(4.5), text: tr('โล่แตก!', 'Shield down!'), color: '#4ff0ff', t: 0 });
      }
      if (amount <= 0) return;
    }
    if (v === this.player && this.buffs.armor > 0) {
      amount *= 0.4;
      this.fx.impact(at.clone().setY(Math.max(1, at.y)), true);
    }
    v.hp -= amount;
    v.lastHit = this.elapsed;
    // A unit that is hit knows where the player is (unless it was friendly fire)
    if (v !== this.player && source === 'player' && v.state !== 'engage') this.alert(v, this.player.pos);
    if (v === this.player) {
      this.fx.shake(Math.min(0.5, amount / 150));
      sfx.hit(1);
    } else if (this.settings.damageNumbers && !quiet)
      this.texts.push({ pos: at.clone().setY(3), text: crit ? `✦${Math.round(amount)}` : String(Math.round(amount)), color: crit ? '#ff5aff' : source === 'enemy' ? '#ff9a50' : amount >= 100 ? '#ffd24a' : '#ffffff', t: 0 });
    if (v.hp <= 0) this.destroyVehicle(v, source);
  }

  private destroyVehicle(v: Vehicle, source: Team = 'player') {
    if (!v.alive) return;
    v.alive = false;
    v.hp = 0;
    if (v.def?.infantry) {
      // Soldiers fall over; no fire
      this.fx.dust(v.pos, 0, 0);
      this.wrecks.push({ obj: v.rig.root, pos: v.pos, radius: 0, t: 0, soft: true, crushing: true });
      this.reward(v, source);
      return;
    }
    if (v.kind === 'kamikaze') {
      this.fx.explosion(v.pos.clone(), 0.8);
      this.discard(v.rig.root);
      this.reward(v, source);
      return;
    }
    const size = Math.max(0.6, v.radius / 2.2);
    this.fx.explosion(v.pos.clone().setY(Math.max(1, v.pos.y)), size * 1.3);
    if (v.kind === 'behemoth') for (let i = 1; i <= 3; i++) setTimeout(() => this.fx.explosion(v.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 1, (Math.random() - 0.5) * 8)), 2), i * 350);
    sfx.explosion(1.3, Sfx.att(v.pos.distanceTo(this.player.pos)));
    // Turn the model into a burning wreck; tanks lose their turret
    const charred = mat('wreck', { color: 0x221f1c, roughness: 0.95, metalness: 0.4 });
    const wreck: Wreck = { obj: v.rig.root, pos: v.pos, radius: v.radius * 0.8, t: 0 };
    if (v.rig.treads.length && v.rig.turret) {
      const t = v.rig.turret;
      const wp = V3(), wq = new THREE.Quaternion();
      t.getWorldPosition(wp);
      t.getWorldQuaternion(wq);
      this.scene.attach(t);
      wreck.turret = { obj: t, vel: new THREE.Vector3((Math.random() - 0.5) * 6, 9 + Math.random() * 5, (Math.random() - 0.5) * 6), spin: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5), rest: false };
    }
    for (const o of [v.rig.root, wreck.turret?.obj])
      o?.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).material = charred;
      });
    if (v.def?.flying) wreck.fallV = 0;
    this.wrecks.push(wreck);
    if (v === this.player) {
      this.finish(false);
      return;
    }
    if (v.kind === 'ally') return;
    this.reward(v, source);
  }

  /** Credits/EXP/salvage for a destroyed enemy. */
  private reward(v: Vehicle, source: Team) {
    this.kills++;
    const reward = Math.round(v.def!.reward * (1 + this.sk.bounty * 0.08) * (1 + this.waveIdx * 0.05));
    const xp = Math.round(v.def!.reward * 0.6 * (1 + this.waveIdx * 0.05));
    this.credits += reward;
    this.bankCredits += reward;
    this.bankXp += xp;
    this.texts.push({ pos: v.pos.clone().setY(4), text: `${source === 'enemy' ? tr('ยิงพวกเดียวกัน! ', 'Friendly fire! ') : ''}+${reward} ◆ +${xp} EXP`, color: source === 'enemy' ? '#ff9a50' : '#8fe07a', t: 0 });
    // Tougher vehicles are more likely to carry salvage
    const base: Partial<Record<string, number>> = { buggy: 0.3, light: 0.4, apc: 0.5, mlrs: 0.55, medium: 0.6, heavy: 0.75, infantry: 0.08, rpg: 0.12, kamikaze: 0.05, ugv: 0.45, heli: 1, behemoth: 1, jammer: 0.8 };
    // Badly damaged players find salvage more often
    const lootChance = (base[v.kind] ?? 0.4) + this.sk.salvage * 0.06 + (this.hpFrac() < 0.4 ? 0.15 : 0);
    if (Math.random() < lootChance) {
      const own = this.wrecks.find((w) => w.obj === v.rig.root && !w.soft);
      if (own && this.insideMap(v.pos, 4)) this.addWreckLoot(own);
      else {
        const lim = this.city.extent - 6;
        this.spawnPickup(this.rollPickup(), new THREE.Vector3(THREE.MathUtils.clamp(v.pos.x, -lim, lim), 0, THREE.MathUtils.clamp(v.pos.z, -lim, lim)), true);
      }
    }
  }

  // ───────────────── Destructible environment ─────────────────

  private damageBuilding(b: Building, amount: number, at: THREE.Vector3) {
    if (!b.alive || amount <= 0) return;
    b.hp -= amount;
    const want = b.hp <= 0 ? 0 : Math.ceil((b.info.sections.length * b.hp) / b.maxHp);
    while (b.left > want) this.collapseSection(b);
    if (b.hp <= 0) this.razeBuilding(b, false);
    void at;
  }

  private collapseSection(b: Building) {
    const s = b.info.sections[b.left - 1];
    const box = new THREE.Box3().setFromObject(s);
    const c = box.getCenter(V3()), size = box.getSize(V3());
    s.visible = false;
    b.left--;
    b.burnT = 25;
    this.fx.collapse(c, size.x, size.z, box.max.y, b.info.colors, b.info.kind === 'house' ? 0.7 : 1);
    sfx.collapse(Sfx.att(c.distanceTo(this.player.pos), 40));
    this.mapVersion++;
  }

  private razeBuilding(b: Building, silent: boolean) {
    b.alive = false;
    for (const s of b.info.sections) s.visible = false;
    b.left = 0;
    const size = b.box.getSize(V3()), c = b.box.getCenter(V3());
    const heap = rubbleHeap(rng(b.id * 13 + 7), size.x, size.z, b.info.colors);
    heap.position.set(c.x, 0.19, c.z);
    this.scene.add(heap);
    this.setBlock(b.box, b.id, false);
    this.mapVersion++;
    if (!silent) {
      this.razed++;
      this.fx.collapse(c, size.x, size.z, 3, b.info.colors, 0.8);
      this.fx.explosion(c.clone().setY(1), 1.2);
      b.burnT = 30;
      this.credits += 10;
    }
  }

  private damageCar(c: Car, amount: number) {
    if (!c.alive) return;
    c.hp -= amount;
    if (c.hp > 0) return;
    this.wreckCar(c, false);
    const at = c.obj.position.clone().setY(0.8);
    const big = c.hazard === 'tank' ? 2.4 : c.hazard === 'drums' ? 1.5 : 1;
    this.fx.explosion(at, big);
    sfx.explosion(0.9 * big, Sfx.att(at.distanceTo(this.player.pos)));
    // Secondary blast hurts everything nearby (and sets off other fuel)
    const r = c.hazard === 'tank' ? 10 : c.hazard === 'drums' ? 6.5 : 5.5;
    const dmg = c.hazard === 'tank' ? 170 : c.hazard === 'drums' ? 95 : 45;
    for (const v of [this.player, ...this.allies, ...this.enemies]) {
      if (!v.alive || v.isStatic) continue;
      const d = Math.hypot(v.pos.x - at.x, v.pos.z - at.z);
      if (d < r + v.radius) this.damageVehicle(v, dmg * Math.max(0.2, 1 - d / (r + v.radius)), at, 'player', false, 'splash');
    }
    if (c.hazard) {
      if (c.hazard === 'tank') this.igniteField(at);
      for (const o of this.cars) if (o.alive && o !== c && o.obj.position.distanceTo(at) < r) this.damageCar(o, dmg);
    }
  }

  private wreckCar(c: Car, silent: boolean) {
    c.alive = false;
    if (c.hazard) {
      const charred = mat('charredFuel', { color: 0x1f1c19, roughness: 0.95, metalness: 0.3 });
      c.obj.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).material = charred;
      });
      c.obj.scale.y = c.hazard === 'drums' ? 0.4 : 0.75;
      c.burnT = silent ? 0 : 20;
      return;
    }
    const burnt = bake(buildCar(rng(c.m.seed), true));
    burnt.position.set(c.obj.position.x, burnt.position.y, c.obj.position.z);
    burnt.rotation.y = c.obj.rotation.y + (silent ? 0 : (Math.random() - 0.5) * 0.4);
    this.discard(c.obj);
    this.scene.add(burnt);
    c.obj = burnt;
    c.burnT = silent ? 0 : 14;
  }

  private fellTree(t: Tree, dx: number, dz: number) {
    t.fallen = true;
    const d = Math.hypot(dx, dz) || 1;
    // Fall away from the pusher: rotate around the horizontal axis perpendicular to the push
    t.axis.set(dz / d, 0, -dx / d);
    t.t = 0;
  }

  /** One InstancedMesh per material and pole kind, so hundreds of poles cost a handful of draw calls. */
  private buildPoles(s: THREE.Scene) {
    const byKind = new Map<string, PropMarker[]>();
    for (const m of this.city.poles) {
      const k = m.pole ?? 'lamp';
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(m);
    }
    for (const [kind, list] of byKind) {
      const proto = bake(buildPole(kind as 'lamp' | 'traffic'));
      const meshes: THREE.InstancedMesh[] = [];
      proto.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        meshes.push(im);
        s.add(im);
      });
      list.forEach((m, i) => {
        const t = new Pole(m, meshes, i);
        this.poles.push(t);
        this.poseP(t);
      });
    }
  }

  private fellPole(t: Pole, dx: number, dz: number) {
    t.fallen = true;
    const d = Math.hypot(dx, dz) || 1;
    t.axis.set(dz / d, 0, -dx / d);
    t.t = 0;
    this.fx.dust(new THREE.Vector3(t.m.x, 0.3, t.m.z), 0, 0);
  }

  /** Write a pole's instance matrix: base on the kerb, tipped over around its foot. */
  private poseP(t: Pole) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.m.ry);
    if (t.fallen) q.premultiply(new THREE.Quaternion().setFromAxisAngle(t.axis, t.t * t.t * Math.PI * 0.48));
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(t.m.x, 0.18, t.m.z), q, new THREE.Vector3(1, 1, 1));
    for (const im of t.meshes) {
      im.setMatrixAt(t.idx, mtx);
      im.instanceMatrix.needsUpdate = true;
    }
  }

  private updateProps(dt: number) {
    for (const t of this.poles) {
      if (!t.fallen || t.t >= 1) continue;
      t.t = Math.min(1, t.t + dt * 1.8);
      this.poseP(t);
    }
    for (const t of this.trees) {
      if (!t.fallen || t.t >= 1) continue;
      t.t = Math.min(1, t.t + dt * 1.6);
      const ease = t.t * t.t;
      t.pivot.quaternion.setFromAxisAngle(t.axis, ease * Math.PI * 0.46);
    }
    for (const c of this.cars) {
      if (c.crushing && c.crush < 1) {
        c.crush = Math.min(1, c.crush + dt * 5);
        c.obj.scale.y = 1 - 0.7 * c.crush;
        c.obj.scale.x = 1 + 0.12 * c.crush;
      }
      if (c.burnT <= 0) continue;
      c.burnT -= dt;
      this.fx.burn(c.obj.position.clone().setY(1), Math.min(1, c.burnT / 6), dt);
    }
    for (const b of this.buildings) {
      if (b.burnT <= 0) continue;
      b.burnT -= dt;
      const c = b.box.getCenter(V3());
      c.y = b.alive ? b.top() : 1.5;
      c.x += (Math.random() - 0.5) * (b.box.max.x - b.box.min.x) * 0.5;
      c.z += (Math.random() - 0.5) * (b.box.max.z - b.box.min.z) * 0.5;
      if (b.info.kind === 'house' && b.burnT > 12) this.fx.burn(c, 1, dt);
      else this.fx.smokeColumn(c, Math.min(1, b.burnT / 10), dt);
    }
  }

  private updateWrecks(dt: number) {
    for (const w of this.wrecks) {
      w.t += dt;
      if (w.soft) {
        w.obj.rotation.x = Math.min(Math.PI / 2, w.t * 5);
        if (w.t > 6) w.obj.position.y -= dt * 0.4;
        if (w.t > 9) w.t = 99;
        continue;
      }
      if (w.fallV !== undefined) {
        w.fallV -= 18 * dt;
        w.obj.position.y += w.fallV * dt;
        w.obj.rotation.y += dt * 3;
        if (w.obj.position.y <= 0.3) {
          w.obj.position.y = 0.3;
          w.fallV = undefined;
          this.fx.explosion(w.pos.clone().setY(1), 2);
          this.fx.shake(0.3);
          sfx.explosion(1.5, Sfx.att(w.pos.distanceTo(this.player.pos)));
        }
      }
      for (const o of [w, w.turret]) {
        if (!o?.crushing || (o.crush ?? 0) >= 1) continue;
        o.crush = Math.min(1, (o.crush ?? 0) + dt * 4);
        o.obj.scale.set(1 + 0.1 * o.crush, 1 - 0.65 * o.crush, 1 + 0.05 * o.crush);
      }
      if (w.t < 10) this.fx.burn(w.pos.clone().setY(1.6), 1 - w.t / 12, dt);
      else if (w.t < 25) this.fx.smokeColumn(w.pos.clone().setY(1.4), 0.6, dt);
      else w.obj.position.y -= dt * 0.25;
      const tr = w.turret;
      if (tr && !tr.rest) {
        tr.vel.y -= 22 * dt;
        tr.obj.position.addScaledVector(tr.vel, dt);
        tr.obj.rotation.x += tr.spin.x * dt;
        tr.obj.rotation.y += tr.spin.y * dt;
        tr.obj.rotation.z += tr.spin.z * dt;
        if (tr.obj.position.y < 0.6) {
          tr.obj.position.y = 0.6;
          tr.rest = true;
          this.fx.impact(tr.obj.position, true);
          this.fx.shake(0.05);
        }
      }
      if (w.t > 25 && tr) tr.obj.position.y -= dt * 0.25;
    }
    // Salvage: drive into a wreck carrying loot
    const p = this.player;
    for (const w of this.wrecks) {
      if (!w.loot) continue;
      w.loot.position.set(w.pos.x, 4.2 + Math.sin(this.elapsed * 3 + w.pos.x) * 0.3, w.pos.z);
      const s = 2.4 + Math.sin(this.elapsed * 6) * 0.25;
      w.loot.scale.set(s, s, 1);
      w.loot.material.opacity = w.t > 26 ? (Math.sin(w.t * 12) > 0 ? 1 : 0.25) : 1;
      if (Math.random() < dt * 4 * this.fx.density)
        this.fx.fire.emit({ x: w.pos.x + (Math.random() - 0.5) * 2, y: 1 + Math.random() * 2, z: w.pos.z + (Math.random() - 0.5) * 2, vy: 1.5, max: 0.8, s0: 0.35, s1: 0.05, r: 1, g: 0.85, b: 0.3 });
      if (p.alive && Math.hypot(p.pos.x - w.pos.x, p.pos.z - w.pos.z) < p.radius + w.radius + 0.5) this.salvage(w);
      else if (w.t > 30) {
        this.discard(w.loot);
        w.loot = undefined;
      }
    }
    const dead = this.wrecks.filter((w) => w.t > 38);
    for (const w of dead) {
      this.discard(w.obj);
      this.discard(w.turret?.obj);
      this.discard(w.loot);
    }
    this.wrecks = this.wrecks.filter((w) => w.t <= 38);
    // Keep the number of wrecks bounded: the oldest start sinking early once there are too many
    const solid = this.wrecks.filter((w) => !w.soft && w.t < 25);
    for (let i = 0; i < solid.length - MAX_WRECKS; i++) {
      solid[i].t = 25;
      if (solid[i].loot) {
        this.discard(solid[i].loot);
        solid[i].loot = undefined;
      }
    }
  }

  // ───────────────── Pick-ups & power-ups ─────────────────

  /** Weighted random pick-up, biased toward what the player needs. */
  private rollPickup(): PickupKind {
    const hpPct = this.player.hp / this.player.maxHp;
    const w = (Object.keys(PICKUPS) as PickupKind[]).map((k) => {
      let weight = PICKUPS[k].weight;
      // The lower the HP, the more likely a repair kit: ×0.4 at full HP, ×3.3 at 40%, ×5.5 at 20%
      if (k === 'repair') weight *= 0.4 + (1 - hpPct) ** 2 * 8;
      if (k === 'ammo') {
        const low = Object.entries(this.ammoLeft).some(([a, n]) => n! < AMMO[a as AmmoId].capacity * 0.35);
        weight *= low ? 2 : 0.6;
      }
      if (k in this.buffs && this.buffs[k as BuffKind] > 0) weight *= 0.4;
      if (k === 'mines' && this.mineCount >= MAX_MINES - 2) weight *= 0.2;
      return [k, weight] as const;
    });
    let r = Math.random() * w.reduce((a, [, x]) => a + x, 0);
    for (const [k, x] of w) if ((r -= x) <= 0) return k;
    return 'repair';
  }

  /** Random open spot (not inside/against buildings) some distance from the player. */
  private dropSpot() {
    const e = this.city.extent - 6;
    const p = this.player.pos;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 45;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.abs(x) > e || Math.abs(z) > e || this.nav.isTight(x, z)) continue;
      if (this.pickups.some((k) => Math.hypot(k.obj.position.x - x, k.obj.position.z - z) < 10)) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  private static iconCache = new Map<PickupKind, THREE.Texture>();
  private iconTexture(kind: PickupKind) {
    let t = Game.iconCache.get(kind);
    if (t) return t;
    const d = PICKUPS[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(12,14,16,0.85)';
    x.beginPath();
    x.arc(64, 64, 58, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = d.color;
    x.stroke();
    x.fillStyle = d.color;
    x.font = `900 ${d.icon.length > 1 ? 48 : 64}px system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(d.icon, 64, 68);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    Game.iconCache.set(kind, t);
    return t;
  }

  private static lootTex: THREE.Texture | null = null;

  /** Golden "?" over a wreck that can be salvaged. */
  private addWreckLoot(w: Wreck | undefined) {
    if (!w) return;
    if (!Game.lootTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      x.fillStyle = 'rgba(12,14,16,0.85)';
      x.beginPath();
      x.arc(64, 64, 58, 0, Math.PI * 2);
      x.fill();
      x.lineWidth = 8;
      x.strokeStyle = '#ffd23a';
      x.stroke();
      x.fillStyle = '#ffd23a';
      x.font = '900 72px system-ui, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('?', 64, 70);
      Game.lootTex = new THREE.CanvasTexture(c);
      Game.lootTex.colorSpace = THREE.SRGBColorSpace;
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Game.lootTex, transparent: true, depthWrite: false }));
    s.renderOrder = 5;
    s.position.set(w.pos.x, 4.2, w.pos.z);
    this.scene.add(s);
    w.loot = s;
  }

  private salvage(w: Wreck) {
    this.discard(w.loot);
    w.loot = undefined;
    const kind = this.rollPickup();
    // Every salvaged wreck also patches the hull a little (more when badly damaged) and gives EXP
    const p = this.player;
    const heal = Math.round(Math.min(p.maxHp * (this.hpFrac() < 0.4 ? 0.12 : 0.06), p.maxHp - p.hp));
    p.hp += heal;
    const xp = 15 + this.waveIdx * 4;
    this.bankXp += xp;
    this.texts.push({ pos: p.pos.clone().setY(6), text: `${tr('ค้นซาก', 'Salvaged')}: ${PICKUPS[kind].name}`, color: '#ffd23a', t: 0 });
    this.texts.push({ pos: p.pos.clone().setY(8), text: `${heal > 0 ? `+${heal} HP · ` : ''}+${xp} EXP`, color: '#8fe07a', t: 0 });
    for (let i = 0; i < 14 * this.fx.density; i++)
      this.fx.fire.emit({ x: w.pos.x, y: 1.5, z: w.pos.z, vx: (Math.random() - 0.5) * 10, vy: 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 10, grav: -18, max: 0.6, s0: 0.4, s1: 0.1, r: 1, g: 0.85, b: 0.3 });
    this.applyPickup(kind);
  }

  private hpFrac() {
    return this.player.hp / this.player.maxHp;
  }

  /** Supply crate; `airdrop` parachutes it in from the sky. */
  private spawnPickup(kind: PickupKind, at: THREE.Vector3, airdrop: boolean) {
    const d = PICKUPS[kind];
    const color = new THREE.Color(d.color).getHex();
    const g = new THREE.Group();
    const crate = new THREE.Group();
    crate.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), mat('crate', { color: 0x5a5e44, roughness: 0.85 })));
    for (const y of [-0.32, 0.32]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.14, 1.44), mat('crateStrap', { color: 0x2c2d28, roughness: 0.7, metalness: 0.4 }));
      strap.position.y = y;
      crate.add(strap);
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.22, 1.46), mat(`pickupBand-${kind}`, { color, emissive: color, emissiveIntensity: 0.7 }));
    crate.add(band);
    crate.position.y = 0.5;
    crate.traverse((m) => ((m as THREE.Mesh).castShadow = true));
    g.add(crate);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.iconTexture(kind), depthWrite: false, transparent: true }));
    icon.scale.setScalar(2.6);
    icon.position.y = 2.6;
    icon.renderOrder = 5;
    g.add(icon);
    let chute: THREE.Object3D | null = null;
    if (airdrop) {
      chute = new THREE.Group();
      const canopyMat = mat(`chute-${kind}`, { color: new THREE.Color(d.color).lerp(new THREE.Color(0xd8d2c0), 0.55), roughness: 0.9, side: THREE.DoubleSide });
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), canopyMat);
      canopy.scale.y = 0.6;
      canopy.position.y = 5.5;
      canopy.castShadow = true;
      chute.add(canopy);
      for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]])
        chute.add(tube(new THREE.Vector3(cx * 0.6, 1, cz * 0.6), new THREE.Vector3(cx * 2.4, 5.2, cz * 2.4), 0.025, mat('chuteLine', { color: 0x2a2a28 }), 4));
      g.add(chute);
    }
    g.position.set(at.x, airdrop ? 38 : 0, at.z);
    this.scene.add(g);
    this.pickups.push({ kind, obj: g, chute, icon, t: airdrop ? -99 : 0, landed: !airdrop, vy: airdrop ? -6.5 : 0 });
  }

  private updatePickups(dt: number) {
    const p = this.player;
    // Random airdrops while fighting
    if (this.phase === 'active' || this.phase === 'countdown') {
      this.dropT -= dt;
      if (this.dropT <= 0) {
        // Supplies arrive sooner while the player is badly damaged
        this.dropT = (13 + Math.random() * 10) * (1 - this.sk.salvage * 0.08) * (this.hpFrac() < 0.4 ? 0.6 : 1);
        const spot = this.pickups.length < 4 ? this.dropSpot() : null;
        if (spot) this.spawnPickup(this.rollPickup(), spot, true);
      }
    }
    for (const k of this.pickups) {
      const pos = k.obj.position;
      if (!k.landed) {
        pos.y += k.vy * dt;
        k.obj.rotation.y += dt * 0.4;
        pos.x += Math.sin(this.elapsed * 0.7 + pos.z) * dt * 0.6;
        if (pos.y <= 0) {
          pos.y = 0;
          k.landed = true;
          k.t = 0;
          this.fx.dust(pos, 1.5, 0);
          this.fx.dust(pos, -1.5, 0);
        }
      } else {
        k.t += dt;
        // Collapse the parachute after landing
        if (k.chute) {
          const f = Math.min(1, k.t / 1.2);
          k.chute.scale.set(1 + f * 0.3, 1 - f * 0.95, 1 + f * 0.3);
          k.chute.position.x = f * 2;
          if (f >= 1) {
            k.obj.remove(k.chute);
            k.chute = null;
          }
        }
        // Coloured smoke flare marks the drop
        if (k.t < 12 && Math.random() < dt * 8 * this.fx.density) {
          const c = new THREE.Color(PICKUPS[k.kind].color);
          this.fx.smoke.emit({ x: pos.x + 0.8, y: 0.6, z: pos.z + 0.8, vx: 0.8, vy: 2 + Math.random(), vz: -0.4, drag: 0.4, max: 3 + Math.random() * 2, s0: 0.8, s1: 4, r: c.r, g: c.g, b: c.b, r1: 0.7, g1: 0.7, b1: 0.7, a: 0.45 });
        }
      }
      k.icon.position.y = (k.chute ? 9 : 2.8) + Math.sin(this.elapsed * 3 + pos.x) * 0.25;
      const blink = k.landed && k.t > 40 ? (Math.sin(k.t * 12) > 0 ? 1 : 0.2) : 1;
      k.icon.material.opacity = blink;
      if (p.alive && (k.landed || pos.y < 2.5) && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) < 4) {
        this.applyPickup(k.kind);
        k.t = 999;
      }
    }
    for (const k of this.pickups) if (k.t > 45) this.discard(k.obj);
    this.pickups = this.pickups.filter((k) => k.t <= 45);
  }

  private applyPickup(kind: PickupKind) {
    const p = this.player;
    const d = PICKUPS[kind];
    sfx.ui();
    const say = (text: string) => this.texts.push({ pos: p.pos.clone().setY(4.5), text, color: d.color, t: 0 });
    switch (kind) {
      case 'repair': {
        const heal = Math.min(300, p.maxHp - p.hp);
        p.hp += heal;
        say(`+${Math.round(heal)} HP`);
        break;
      }
      case 'ammo':
        for (const a of Object.keys(this.ammoLeft) as AmmoId[]) this.ammoLeft[a] = AMMO[a].capacity;
        say(tr('กระสุนพิเศษเต็ม!', 'Special ammo refilled!'));
        break;
      case 'mines':
        this.mineCount = Math.min(MAX_MINES + this.sk.mines, this.mineCount + MINES_PER_PICKUP + this.sk.mines);
        say(`${tr('ทุ่นระเบิด', 'Mines')} ×${this.mineCount}`);
        break;
      case 'airstrike':
        if (!this.airstrike()) {
          this.airstrikePending++;
          this.cb.message(tr('AIR STRIKE พร้อม', 'AIR STRIKE READY'), tr('จะโจมตีทันทีที่มีศัตรูเข้ามาในแมป', 'It will fire as soon as an enemy enters the map'));
        }
        break;
      default: {
        const b = kind as BuffKind;
        this.buffs[b] = this.buffDuration(b);
        if (b === 'shield') this.shieldHp = this.shieldMax;
        if (b === 'drones') this.launchDrones(2);
        else this.attach(b);
        say(`${d.name} ${Math.round(this.buffDuration(b))}s`);
      }
    }
  }

  /** Visual add-ons for active buffs. */
  private attach(b: BuffKind) {
    if (this.attachments[b]) return;
    const p = this.player.rig;
    const objs: THREE.Object3D[] = [];
    if (b === 'missile') {
      const face = mat('podFaceSmall', { map: T.rocketPod(), roughness: 0.7 });
      const skin = mat('podSkin', { color: 0x4d5a38, roughness: 0.7, metalness: 0.3 });
      for (const s of [-1, 1]) {
        const pod = new THREE.Group();
        pod.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.3), skin));
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.46), face);
        f.position.z = 0.66;
        pod.add(f);
        pod.position.set(s * 1.5, 0.95, -0.3);
        pod.rotation.x = -0.12;
        pod.traverse((m) => ((m as THREE.Mesh).castShadow = true));
        p.turret!.add(pod);
        objs.push(pod);
      }
    } else if (b === 'armor') {
      const era = mat('eraBlock', { color: 0x5b6647, roughness: 0.75, metalness: 0.25 });
      const hull = new THREE.Group();
      for (const s of [-1, 1])
        for (let i = 0; i < 7; i++) {
          const blk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.85), era);
          blk.position.set(s * 1.93, 1.15, -2.8 + i * 0.95);
          blk.castShadow = true;
          hull.add(blk);
        }
      for (let i = -2; i <= 2; i++) {
        const blk = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.5), era);
        blk.position.set(i * 0.66, 1.45, 3.35);
        blk.rotation.x = 0.35;
        hull.add(blk);
      }
      p.root.add(hull);
      const tur = new THREE.Group();
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), era);
        w.position.set(s * 0.8, 0.45, 1.75);
        w.rotation.y = -s * 0.5;
        w.castShadow = true;
        tur.add(w);
      }
      p.turret!.add(tur);
      objs.push(hull, tur);
    }
    else if (b === 'shield') {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), shieldMaterial());
      bubble.scale.set(2.9, 2.3, 4.9);
      bubble.position.y = 1.2;
      bubble.renderOrder = 6;
      p.root.add(bubble);
      objs.push(bubble);
    } else if (b === 'laser') {
      const emitter = new THREE.Group();
      emitter.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 1.1), mat('laserBody', { color: 0x2b2d31, roughness: 0.35, metalness: 0.8 })));
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4ad0, toneMapped: false }));
      lens.position.z = 0.58;
      emitter.add(lens);
      emitter.position.set(-0.65, 1.05, 1.2);
      emitter.traverse((m) => ((m as THREE.Mesh).castShadow = true));
      p.turret!.add(emitter);
      objs.push(emitter);
    }
    this.attachments[b] = objs;
  }

  private updateBuffs(dt: number) {
    const p = this.player;
    const bubble = this.attachments.shield?.[0] as THREE.Mesh | undefined;
    if (bubble) {
      this.shieldHit = Math.max(0, this.shieldHit - dt * 3);
      const u = (bubble.material as THREE.ShaderMaterial).uniforms;
      u.time.value = this.elapsed;
      u.hit.value = this.shieldHit;
      u.fade.value = Math.min(1, this.buffs.shield * 2) * (this.buffs.shield < 3 && Math.sin(this.elapsed * 20) > 0 ? 0.4 : 1);
    }
    this.updateMines(dt);
    if (this.airstrikePending > 0 && this.airstrike()) this.airstrikePending--;
    for (const b of Object.keys(this.buffs) as BuffKind[]) {
      if (this.buffs[b] <= 0 || b === 'drones') continue;
      this.buffs[b] -= dt;
      if (this.buffs[b] <= 0) {
        this.buffs[b] = 0;
        for (const o of this.attachments[b] ?? []) o.removeFromParent();
        delete this.attachments[b];
        this.texts.push({ pos: p.pos.clone().setY(4.5), text: tr(`${PICKUPS[b].name} หมดเวลา`, `${PICKUPS[b].name} expired`), color: '#bbbbbb', t: 0 });
      }
    }
    // Nitro exhaust flames
    if (this.buffs.nitro > 0 && Math.random() < dt * 30) {
      for (const s of [-0.7, 0.7]) {
        const bx = p.pos.x - Math.sin(p.yaw) * 4 + Math.cos(p.yaw) * s, bz = p.pos.z - Math.cos(p.yaw) * 4 - Math.sin(p.yaw) * s;
        this.fx.fire.emit({ x: bx, y: 1.3, z: bz, vx: -Math.sin(p.yaw) * 6, vy: 0.5, vz: -Math.cos(p.yaw) * 6, drag: 4, max: 0.25, s0: 1.1, s1: 0.3, r: 0.4, g: 0.75, b: 1, r1: 0.1, g1: 0.2, b1: 0.9 });
      }
    }
    // Overcharge: crackling barrel
    if (this.buffs.overcharge > 0 && Math.random() < dt * 10) {
      const m = V3();
      p.rig.muzzle!.getWorldPosition(m);
      this.fx.fire.emit({ x: m.x, y: m.y, z: m.z, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, max: 0.3, s0: 0.35, s1: 0.1, r: 1, g: 0.85, b: 0.3 });
    }
    // Missile pod: auto-launch at the nearest enemies (top attack, no line of sight needed)
    if (this.buffs.missile > 0) {
      this.missileT -= dt;
      if (this.missileT <= 0) {
        const inFlight = new Map<object, number>();
        for (const pr of this.proj.list) if (pr.kind === 'missile' && pr.seek) inFlight.set(pr.seek, (inFlight.get(pr.seek) ?? 0) + 1);
        const target = this.enemies
          .filter((e) => e.alive && e.pos.distanceTo(p.pos) < GUIDED_MISSILE.range && (inFlight.get(e) ?? 0) * 95 < e.hp)
          .sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0];
        if (target) {
          this.missileT = GUIDED_MISSILE.reload * (1 - this.sk.missile * 0.1) * (this.buffs.rapid > 0 ? 0.6 : 1);
          this.missileSide *= -1;
          const pod = this.attachments.missile?.[this.missileSide > 0 ? 1 : 0];
          const from = V3();
          (pod ?? p.rig.turret!).getWorldPosition(from);
          from.y += 0.3;
          const dir = new THREE.Vector3(Math.sin(p.turretYaw), 0.9, Math.cos(p.turretYaw)).normalize();
          this.proj.fire({ kind: 'missile', team: 'player', pos: from, vel: dir.multiplyScalar(14), weapon: GUIDED_MISSILE, mult: this.buffs.overcharge > 0 ? 2 : 1, owner: p.id, seek: target, life: 0 });
          this.fx.smoke.emit({ x: from.x, y: from.y, z: from.z, vy: 1, max: 1.2, s0: 1, s1: 3, r: 0.8, g: 0.8, b: 0.78, a: 0.5 });
          sfx.rocketLaunch(0.7);
        } else this.missileT = 0.3;
      }
    }
  }

  // ───────────────── Laser ─────────────────

  /** March along the beam and return the first thing it touches. */
  private laserTrace(from: THREE.Vector3, dir: THREE.Vector3) {
    const pt = V3();
    for (let d = 1.5; d <= LASER.range; d += 0.6) {
      pt.copy(from).addScaledVector(dir, d);
      for (const e of this.enemies) if (e.alive && Math.hypot(e.pos.x - pt.x, e.pos.z - pt.z) < e.radius * 0.85) return { point: pt, vehicle: e };
      for (const c of this.cars) if (c.alive && Math.hypot(c.obj.position.x - pt.x, c.obj.position.z - pt.z) < c.radius) return { point: pt, car: c };
      const k = this.nav.idx(pt.x, pt.z);
      if (k >= 0 && this.nav.blocked[k]) {
        const b = this.buildings[this.nav.owner[k]];
        if (b?.alive && pt.y < b.top()) return { point: pt, building: b };
      }
    }
    return { point: pt };
  }

  private updateLaser(on: boolean, dt: number) {
    if (!this.beam) {
      this.beam = new THREE.Group();
      const geo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
      const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff3ac8, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      glow.scale.set(0.28, 0.28, 1);
      const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe6fa, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      core.scale.set(0.07, 0.07, 1);
      this.beam.add(glow, core);
      this.beam.renderOrder = 7;
      this.scene.add(this.beam);
    }
    this.beam.visible = on;
    sfx.laserUpdate(on);
    if (!on) return;
    const p = this.player;
    const from = V3();
    const lens = this.attachments.laser?.[0];
    (lens ?? p.rig.muzzle!).getWorldPosition(from);
    if (lens) from.add(new THREE.Vector3(Math.sin(p.turretYaw), 0, Math.cos(p.turretYaw)).multiplyScalar(0.65));
    const dir = new THREE.Vector3(Math.sin(p.turretYaw), 0, Math.cos(p.turretYaw));
    const hit = this.laserTrace(from, dir);
    const len = from.distanceTo(hit.point);
    this.beam.position.copy(from);
    this.beam.lookAt(hit.point);
    const flicker = 0.85 + Math.random() * 0.3;
    for (const m of this.beam.children) m.scale.z = len;
    this.beam.children[0].scale.x = this.beam.children[0].scale.y = 0.28 * flicker;
    const mult = this.buffs.overcharge > 0 ? 2 : 1;
    if (hit.vehicle) this.damageVehicle(hit.vehicle, LASER.dps * dt * mult, hit.point, 'player', true);
    if (hit.car) this.damageCar(hit.car, 150 * dt);
    if (hit.building) this.damageBuilding(hit.building, LASER.buildingDps * dt * mult, hit.point);
    this.laserFx -= dt;
    if (this.laserFx <= 0) {
      this.laserFx = 0.05;
      const hp = hit.point;
      for (let i = 0; i < 3 * this.fx.density; i++)
        this.fx.fire.emit({ x: hp.x, y: hp.y, z: hp.z, vx: (Math.random() - 0.5) * 10, vy: 2 + Math.random() * 6, vz: (Math.random() - 0.5) * 10, grav: -25, max: 0.3, s0: 0.3, s1: 0.1, r: 1, g: 0.5, b: 0.9 });
      this.fx.fire.emit({ x: hp.x, y: hp.y, z: hp.z, max: 0.08, s0: 1.8, s1: 2.4, r: 1, g: 0.4, b: 0.85 });
      if (hit.vehicle || hit.building) this.fx.smokeColumn(hp.clone().setY(hp.y - 0.5), 0.8, 0.2);
      this.fx.flash(hp, 120, 0.06, 0xff4ad0);
      if (Math.random() < 0.15) this.fx.scorch.add(hp.x, hp.z, 1.2);
    }
  }

  // ───────────────── Mines ─────────────────

  /** Drop a proximity mine behind the tank. */
  dropMine() {
    const p = this.player;
    if (!p.alive || this.mineCount <= 0 || this.mines.length >= MAX_MINES) return;
    this.mineCount--;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.16, 16), mat('mineBody', { color: 0x4a5236, roughness: 0.7, metalness: 0.4 }));
    body.position.y = 0.08;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.08, 12), M_STEEL());
    cap.position.y = 0.2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
    light.position.y = 0.27;
    g.add(body, cap, light);
    g.traverse((m) => ((m as THREE.Mesh).castShadow = true));
    g.position.set(p.pos.x - Math.sin(p.yaw) * 4.6, 0.02, p.pos.z - Math.cos(p.yaw) * 4.6);
    this.scene.add(g);
    this.mines.push({ obj: g, light, t: 0 });
    sfx.ui();
  }

  private updateMines(dt: number) {
    for (const m of this.mines) {
      m.t += dt;
      const armed = m.t > 0.8;
      m.light.visible = armed ? Math.sin(m.t * 8) > 0 : Math.sin(m.t * 30) > 0;
      if (!armed) continue;
      const pos = m.obj.position;
      const victim = this.enemies.find((e) => e.alive && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < e.radius + 1.2);
      if (!victim) continue;
      m.t = -1;
      this.discard(m.obj);
      const blast = { kind: 'shell', team: 'player', pos: pos.clone(), prev: pos.clone(), vel: V3(), weapon: MINE, travelled: 0, alive: true, mult: 1 + this.sk.mines * 0.12, owner: this.player.id } as Projectile;
      this.detonate(blast, pos.clone().setY(0.5), victim);
      this.fx.explosion(pos.clone().setY(0.5), 1.6);
    }
    this.mines = this.mines.filter((m) => m.t >= 0);
  }

  // ───────────────── Support drones ─────────────────

  private launchDrones(n: number) {
    const p = this.player;
    for (let i = 0; i < n && this.drones.filter((d) => !d.diving).length < MAX_DRONES; i++) {
      const rig = buildSupportDrone();
      rig.root.position.set(p.pos.x + (i ? 2 : -2), 2.5, p.pos.z);
      this.scene.add(rig.root);
      this.drones.push({ rig, vel: new THREE.Vector3(0, 6, 0), target: null, retargetT: 0, reload: 0.5, burstLeft: 0, burstT: 0, slot: this.drones.length, life: this.buffDuration('drones'), diving: false, t: 0 });
    }
    sfx.rocketLaunch(0.4);
  }

  private updateDrones(dt: number) {
    const p = this.player;
    for (const d of this.drones) {
      d.t += dt;
      if (!d.diving) {
        d.life -= dt;
        if (d.life <= 0) {
          d.diving = true;
          d.retargetT = 0;
        }
      }
      const pos = d.rig.root.position;
      for (const r of d.rig.rotors) r.rotation.y += dt * 45;
      // Choose a target near the tank
      d.retargetT -= dt;
      if (d.retargetT <= 0 || (d.target && !d.target.alive)) {
        d.retargetT = 0.5;
        const range = d.diving ? 70 : 45;
        d.target = this.enemies.filter((e) => e.alive && e.pos.distanceTo(p.pos) < range).sort((a, b) => a.pos.distanceTo(pos) - b.pos.distanceTo(pos))[0] ?? null;
      }
      let goal: THREE.Vector3;
      let maxSpeed = 22;
      if (d.diving) {
        if (!d.target) {
          // Nothing to hit: climb away and disappear
          goal = pos.clone().add(new THREE.Vector3(0, 30, -20));
          if (d.t > 60 || pos.y > 35) d.t = -1;
        } else {
          goal = d.target.pos.clone().setY(0.8);
          maxSpeed = 30;
          if (pos.distanceTo(goal) < d.target.radius * 0.9 || pos.y < 0.9) {
            const blast = { kind: 'shell', team: 'player', pos: pos.clone(), prev: pos.clone(), vel: V3(), weapon: DRONE_BLAST, travelled: 0, alive: true, mult: 1, owner: p.id } as Projectile;
            this.detonate(blast, pos.clone(), d.target);
            d.t = -1;
            continue;
          }
        }
      } else {
        // Orbit the target (or escort the tank) at altitude
        const center = d.target ? d.target.pos : p.pos;
        const r = d.target ? 11 : 6;
        const a = this.elapsed * (d.target ? 1.1 : 0.8) + d.slot * ((Math.PI * 2) / MAX_DRONES);
        goal = new THREE.Vector3(center.x + Math.cos(a) * r, d.target ? 8 : 6.5, center.z + Math.sin(a) * r);
      }
      const want = goal.sub(pos);
      const k = d.diving && d.target ? 4 : 2.5;
      d.vel.lerp(want.multiplyScalar(k), Math.min(1, dt * 3));
      if (d.vel.length() > maxSpeed) d.vel.setLength(maxSpeed);
      pos.addScaledVector(d.vel, dt);
      pos.y += Math.sin(this.elapsed * 3 + d.slot) * dt * 0.4;
      // Face the target (or direction of travel) and bank with speed
      const look = d.target ? d.target.pos : pos.clone().add(d.vel);
      const yaw = Math.atan2(look.x - pos.x, look.z - pos.z);
      d.rig.root.rotation.set(Math.min(0.5, d.vel.length() * 0.025), yaw, 0, 'YXZ');
      if (d.diving && d.target) d.rig.root.rotation.x = 0.9;
      // Gun bursts
      d.reload -= dt;
      if (!d.diving && d.target && pos.distanceTo(d.target.pos) < 24) {
        if (d.burstLeft > 0) {
          d.burstT -= dt;
          if (d.burstT <= 0) {
            d.burstLeft--;
            d.burstT = DRONE_GUN.burstGap!;
            this.droneShot(d);
          }
        } else if (d.reload <= 0) {
          d.reload = DRONE_GUN.reload * (0.8 + Math.random() * 0.4);
          d.burstLeft = DRONE_GUN.burst! - 1;
          d.burstT = DRONE_GUN.burstGap!;
          this.droneShot(d);
        }
      }
    }
    for (const d of this.drones) if (d.t < 0) this.discard(d.rig.root);
    this.drones = this.drones.filter((d) => d.t >= 0);
    this.drones.forEach((d, i) => (d.slot = i));
    // The HUD bar shows the longest-lived drone still flying
    this.buffs.drones = this.drones.reduce((m, d) => (d.diving ? m : Math.max(m, d.life)), 0);
  }

  private droneShot(d: AllyDrone) {
    const from = d.rig.root.position.clone().add(new THREE.Vector3(0, -0.3, 0));
    const aim = d.target!.pos.clone().setY(1);
    const dir = aim.sub(from).normalize();
    dir.x += (Math.random() - 0.5) * DRONE_GUN.spread * 2;
    dir.z += (Math.random() - 0.5) * DRONE_GUN.spread * 2;
    dir.normalize();
    const mult = this.buffs.overcharge > 0 ? 2 : 1;
    this.proj.fire({ kind: 'bullet', team: 'player', pos: from, vel: dir.multiplyScalar(DRONE_GUN.speed), weapon: DRONE_GUN, mult, owner: this.player.id });
    if (Math.random() < 0.5) this.fx.muzzle(from, dir.clone().setY(0).normalize(), false);
    if (Math.random() < 0.4) sfx.mg(Sfx.att(from.distanceTo(this.player.pos)) * 0.5);
  }

  /** Artillery barrage on the nearest enemies (or ahead of the turret). */
  /** Strikes held until an enemy is inside the map. */
  private airstrikePending = 0;

  /**
   * Artillery on enemies inside the map, nearest to the player first. Shells are split by the
   * HP each target needs (max 3 each) and home on their target until just before impact.
   */
  private airstrike(): boolean {
    const p = this.player;
    const SHELLS = 12 + this.sk.airstrike * 2;
    const targets = this.enemies.filter((e) => e.alive && this.insideMap(e.pos)).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos));
    if (!targets.length) return false;
    const plan: Vehicle[] = [];
    const need = new Map(targets.map((e) => [e, Math.ceil(e.hp / (AIRSTRIKE_SHELL.damage * 0.9))]));
    // First pass: up to 3 shells each, nearest first
    for (const e of targets) {
      const n = Math.min(3, need.get(e)!);
      for (let i = 0; i < n && plan.length < SHELLS; i++) plan.push(e);
      need.set(e, need.get(e)! - n);
    }
    // Leftovers: targets that still need more (nearest first), then the nearest again
    for (const e of targets)
      while (need.get(e)! > 0 && plan.length < SHELLS) {
        plan.push(e);
        need.set(e, need.get(e)! - 1);
      }
    for (let i = 0; plan.length < SHELLS; i++) plan.push(targets[i % targets.length]);
    plan.forEach((e, i) => {
      const T = 1.1 + i * 0.25;
      // Lead the target a little; the shell keeps correcting in flight
      const t = e.pos.clone().add(new THREE.Vector3(Math.sin(e.yaw) * e.speed * 0.4 + (Math.random() - 0.5) * 2, 0, Math.cos(e.yaw) * e.speed * 0.4 + (Math.random() - 0.5) * 2)).setY(0.2);
      const start = t.clone().add(new THREE.Vector3(-35, 80, -20));
      this.proj.fire({ kind: 'rocket', team: 'player', pos: start.clone(), vel: V3(), weapon: AIRSTRIKE_SHELL, start, target: t, t: 0, T, apex: 0, mult: 1, owner: p.id, seek: e });
      this.addRing(t, AIRSTRIKE_SHELL.splash, T, 0x3aa0ff);
    });
    this.cb.message('AIR STRIKE', tr(`ถล่มเป้าหมาย ${new Set(plan).size} คันที่ใกล้คุณที่สุด`, `Shelling the ${new Set(plan).size} nearest targets`));
    return true;
  }

  private addRing(target: THREE.Vector3, r: number, T: number, color = 0xff3020) {
    let mesh = this.ringPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
      );
      const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.15, depthWrite: false }));
      fill.name = 'fill';
      mesh.add(fill);
      mesh.renderOrder = 4;
    }
    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    ((mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color);
    mesh.position.set(target.x, 0.25, target.z);
    mesh.scale.setScalar(r);
    this.scene.add(mesh);
    this.rings.push({ mesh, target, t: 0, T, r });
  }

  private updateRings(dt: number) {
    for (const r of this.rings) {
      r.t += dt;
      const k = r.t / r.T;
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.5 * Math.abs(Math.sin(r.t * (6 + k * 14)));
      const fill = r.mesh.getObjectByName('fill') as THREE.Mesh;
      fill.scale.setScalar(Math.min(1, k));
      r.mesh.position.set(r.target.x, 0.25, r.target.z);
    }
    for (const r of this.rings.filter((x) => x.t >= x.T)) {
      this.scene.remove(r.mesh);
      this.ringPool.push(r.mesh);
    }
    this.rings = this.rings.filter((x) => x.t < x.T);
  }

  // ───────────────── Camera & occlusion ─────────────────

  private updateCamera(dt: number) {
    const p = this.player.pos;
    const look = V3().lerpVectors(p, this.aim, this.input.touchMode ? 0.08 : 0.15);
    this.camTarget.lerp(look, Math.min(1, dt * 4));
    const pitch = THREE.MathUtils.degToRad(70);
    const shake = this.fx.shakeOffset(this.elapsed, V3());
    const t = this.camTarget;
    this.camera.position.set(t.x + shake.x, t.y + Math.sin(pitch) * this.camDist + shake.y, t.z + Math.cos(pitch) * this.camDist + shake.z);
    this.camera.lookAt(t.x + shake.x * 0.5, t.y, t.z + shake.z * 0.5);
    const S = this.shadowHalf;
    Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 10, far: 300 });
    this.sun.shadow.camera.updateProjectionMatrix();
    const texel = (S * 2) / this.sun.shadow.mapSize.x;
    const sx = Math.round(t.x / texel) * texel, sz = Math.round(t.z / texel) * texel;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunOffset.x, this.sunOffset.y, sz + this.sunOffset.z);
  }

  /** Buildings between the camera and the player turn translucent (FR-D5). */
  private updateFade() {
    const ray = new THREE.Ray(this.camera.position, V3().subVectors(this.player.pos.clone().setY(1.5), this.camera.position).normalize());
    const dist = this.camera.position.distanceTo(this.player.pos);
    const items = [...this.buildings.filter((b) => b.alive), ...this.occluders];
    for (const b of items) {
      const hit = ray.intersectBox(b.box, V3());
      const occ = !!hit && hit.distanceTo(this.camera.position) < dist - 2;
      if (occ === b.faded) continue;
      b.faded = occ;
      b.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (occ) {
          m.userData.orig = m.material;
          m.material = this.fadeMat(m.material as THREE.Material);
        } else if (m.userData.orig) m.material = m.userData.orig;
      });
    }
  }

  private fadeMat(m: THREE.Material) {
    let f = this.fadeCache.get(m);
    if (!f) {
      f = m.clone();
      f.transparent = true;
      f.opacity = 0.28;
      f.depthWrite = false;
      this.fadeCache.set(m, f);
    }
    return f;
  }

  zoom(delta: number) {
    this.camDist = THREE.MathUtils.clamp(this.camDist + delta, 45, 90);
  }

  // ───────────────── Overlay (2D) ─────────────────

  private toScreen(p: THREE.Vector3, w: number, h: number) {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, behind: v.z > 1 };
  }

  drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
    // Enemy health bars & off-screen indicators
    for (const e of this.enemies) {
      const s = this.toScreen(e.pos.clone().setY(3.5), w, h);
      const on = s.x > 0 && s.x < w && s.y > 0 && s.y < h && !s.behind;
      if (on) {
        if (this.elapsed - e.lastHit < 4 || e.hp < e.maxHp) {
          const bw = 44 * Math.min(1.6, e.radius / 3);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(s.x - bw / 2 - 1, s.y - 1, bw + 2, 6);
          const f = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = f > 0.5 ? '#e0483a' : f > 0.25 ? '#e89a2a' : '#ffdf40';
          ctx.fillRect(s.x - bw / 2, s.y, bw * f, 4);
        }
        const since = this.elapsed - e.spotT;
        const mark = e.state === 'engage' && since < 1.6 ? '!' : e.state === 'alert' || e.state === 'search' ? '?' : '';
        if (mark) {
          ctx.font = '900 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          const y = s.y - 10 - (mark === '!' ? Math.max(0, 0.3 - since) * 30 : 0);
          ctx.strokeText(mark, s.x, y);
          ctx.fillStyle = mark === '!' ? '#ff3a2a' : '#ffd23a';
          ctx.fillText(mark, s.x, y);
        }
      } else this.edgeMarker(ctx, w, h, s.x, s.y, e.state === 'engage' ? '#ff4a3a' : 'rgba(255,90,70,0.45)', e.state === 'engage' ? 9 : 7);
    }
    for (const k of this.pickups) {
      const s = this.toScreen(k.obj.position, w, h);
      if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) this.edgeMarker(ctx, w, h, s.x, s.y, PICKUPS[k.kind].color, 8);
    }
    for (const wr of this.wrecks) {
      if (!wr.loot) continue;
      const s = this.toScreen(wr.pos, w, h);
      if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) this.edgeMarker(ctx, w, h, s.x, s.y, '#ffd23a', 7, '?');
    }
    // Drone lifetime rings
    for (const d of this.drones) {
      if (d.diving) continue;
      const s = this.toScreen(d.rig.root.position.clone().setY(d.rig.root.position.y + 1.2), w, h);
      const f = Math.max(0, d.life / this.buffDuration('drones'));
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = f < 0.2 && Math.sin(this.elapsed * 14) > 0 ? '#ff5a3a' : '#8ad8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
      ctx.stroke();
    }
    // Allies (hospital / convoy) health bars
    for (const a of this.allies) {
      if (!a.alive) continue;
      const s = this.toScreen(a.pos.clone().setY(4.5), w, h);
      if (s.x > 0 && s.x < w && s.y > 0 && s.y < h) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(s.x - 31, s.y - 1, 62, 7);
        ctx.fillStyle = '#5fe07a';
        ctx.fillRect(s.x - 30, s.y, 60 * Math.max(0, a.hp / a.maxHp), 5);
      } else this.edgeMarker(ctx, w, h, s.x, s.y, '#5fe07a', 9);
    }
    // Spawn warnings
    const blink = Math.sin(this.elapsed * 10) > 0;
    for (const wr of this.warnings) {
      const s = this.toScreen(wr.point, w, h);
      if (blink) this.edgeMarker(ctx, w, h, s.x, s.y, '#ffb020', 16, '!');
    }
    // Floating texts
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const t of this.texts) {
      const s = this.toScreen(t.pos, w, h);
      ctx.globalAlpha = 1 - t.t / 1.1;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(t.text, s.x + 1, s.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    // Desktop crosshair with reload arc
    if (!this.input.touchMode && this.input.mouse && this.player.alive) {
      const { x, y } = this.input.mouse;
      const r = AMMO[this.ammo].reload;
      const k = 1 - Math.max(0, this.player.reload) / r;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = k >= 1 ? '#f2e6c0' : '#c9a227';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.fillStyle = '#f2e6c0';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(x + dx * 18 - (dy ? 1 : 0) - (dx < 0 ? 5 : 0), y + dy * 18 - (dx ? 1 : 0) - (dy < 0 ? 5 : 0), dx ? 5 : 2, dy ? 5 : 2);
    }
  }

  private edgeMarker(ctx: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, color: string, size: number, label?: string) {
    const cx = w / 2, cy = h / 2;
    const dx = x - cx, dy = y - cy;
    const m = 26;
    const k = Math.min((w / 2 - m) / Math.abs(dx || 1e-3), (h / 2 - m) / Math.abs(dy || 1e-3));
    const ex = cx + dx * Math.min(1, k), ey = cy + dy * Math.min(1, k);
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, size * 0.75);
    ctx.lineTo(-size * 0.7, -size * 0.75);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    if (label) {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, ex, ey + 5);
    }
  }

  hud(): HudState {
    return {
      hp: Math.max(0, this.player.hp),
      maxHp: this.player.maxHp,
      wave: Math.min(this.waveIdx + 1, this.level.waves.length),
      waves: this.level.waves.length,
      enemies: this.enemies.filter((e) => !e.isStatic).length + (this.phase === 'active' ? this.pending.length : 0),
      ammo: this.ammo,
      he: this.ammoLeft.HE ?? 0,
      ammoList: this.loadout.ammo.map((a) => ({ id: a, left: this.ammoLeft[a] ?? null })),
      reload: Math.max(0, this.player.reload) / (AMMO[this.ammo].reload * this.loadout.reloadMul),
      credits: this.credits,
      kills: this.kills,
      time: this.time,
      phase: this.phase,
      countdown: this.phaseT,
      buffs: (Object.keys(this.buffs) as BuffKind[])
        .filter((k) => this.buffs[k] > 0)
        .map((k) => {
          const max = this.buffDuration(k);
          // The shield bar shows whichever runs out first: time or absorb capacity
          const t = k === 'shield' ? Math.min(this.buffs[k], (this.shieldHp / this.shieldMax) * max) : this.buffs[k];
          return { kind: k, t, max };
        }),
      mines: this.mineCount,
      objective: this.objectiveText(),
      boss: (() => {
        const b = this.enemies.find((e) => e.alive && e.def?.boss);
        return b ? { name: b.def!.boss!, hp: b.hp, max: b.maxHp } : null;
      })(),
      loops: this.loops,
    };
  }

  /** Data for the minimap. */
  minimap() {
    return {
      extent: this.city.extent,
      roads: this.city.roads,
      buildings: this.buildings,
      enemies: this.enemies,
      player: this.player,
      pickups: this.pickups,
      allies: this.allies.filter((a) => a.alive),
      jammed: this.enemies.some((e) => e.kind === 'jammer' && e.alive),
      loot: this.wrecks.filter((w) => w.loot).map((w) => w.pos),
    };
  }
}
