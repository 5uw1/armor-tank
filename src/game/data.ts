import { tr, lang } from '../i18n';
import type { District, Theme } from '../assets/city';

export type Team = 'player' | 'enemy';
export type ProjectileKind = 'shell' | 'bullet' | 'rocket' | 'missile';

export interface WeaponDef {
  kind: ProjectileKind;
  damage: number;
  /** Splash radius (m). */
  splash: number;
  speed: number; // m/s (rocket: flight time is distance / speed)
  reload: number; // seconds between shots/bursts
  burst?: number;
  burstGap?: number;
  spread: number; // radians
  range: number;
  /** Damage multiplier vs buildings. */
  building: number;
  /** Special behaviour: fire field, bomblets, or pierce through vehicles. */
  special?: 'fire' | 'cluster' | 'pierce';
}

export type Behaviour = 'strafe' | 'chase' | 'standoff' | 'artillery' | 'orbit' | 'kamikaze';
export type EnemyKind = 'buggy' | 'light' | 'apc' | 'mlrs' | 'medium' | 'heavy' | 'infantry' | 'rpg' | 'heli' | 'kamikaze' | 'ugv' | 'behemoth' | 'tyrant' | 'titan';

export interface EnemyDef {
  vehicle: string; // id in VEHICLES
  name: string;
  hp: number;
  speed: number;
  turn: number; // rad/s
  turretTurn: number;
  radius: number;
  behaviour: Behaviour;
  /** Distance the AI tries to keep. */
  preferred: number;
  weapon: WeaponDef;
  reward: number;
  /** Knocks down buildings it drives into. */
  crusher?: boolean;
  /** Sight range when it has line of sight to the player. */
  detect: number;
  /** Flies at this altitude, ignoring buildings. */
  flying?: number;
  /** Foot soldier: crushed by tanks, no burning wreck. */
  infantry?: boolean;
  /** Explodes on contact (kamikaze drone). */
  blast?: { damage: number; splash: number };
  /** Shown with a big HP bar. */
  boss?: string;
  /** APC: deploys an infantry squad when it engages. */
  deploys?: boolean;
  /** Boss rocket barrages / drone swarms (Behemoth family). */
  barrage?: boolean;
  /** Fires a fast railgun slug every few seconds (phase 2+). */
  railgun?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  buggy: {
    vehicle: 'buggy', name: 'Scout Buggy', hp: 90, speed: 15, turn: 3.2, turretTurn: 6, radius: 2.1, behaviour: 'strafe', preferred: 17, reward: 15, detect: 60,
    weapon: { kind: 'bullet', damage: 2.5, splash: 0, speed: 55, reload: 2.2, burst: 6, burstGap: 0.1, spread: 0.12, range: 28, building: 0.05 },
  },
  light: {
    vehicle: 'light', name: 'Light Tank', hp: 280, speed: 10, turn: 2.0, turretTurn: 2.2, radius: 3.0, behaviour: 'chase', preferred: 18, reward: 40, detect: 45,
    weapon: { kind: 'shell', damage: 45, splash: 2, speed: 34, reload: 3.2, spread: 0.05, range: 32, building: 1 },
  },
  apc: {
    deploys: true,
    vehicle: 'apc', name: 'APC 8×8', hp: 340, speed: 8.5, turn: 1.6, turretTurn: 2.5, radius: 3.4, behaviour: 'standoff', preferred: 24, reward: 50, detect: 45,
    weapon: { kind: 'bullet', damage: 9, splash: 1, speed: 45, reload: 2.8, burst: 3, burstGap: 0.18, spread: 0.06, range: 34, building: 0.4 },
  },
  mlrs: {
    vehicle: 'mlrs', name: 'Rocket Launcher', hp: 220, speed: 6, turn: 1.2, turretTurn: 1.5, radius: 3.8, behaviour: 'artillery', preferred: 55, reward: 70, detect: 35,
    weapon: { kind: 'rocket', damage: 60, splash: 5.5, speed: 22, reload: 8, burst: 4, burstGap: 0.35, spread: 0, range: 80, building: 1.5 },
  },
  medium: {
    vehicle: 'medium', name: 'Medium Tank', hp: 520, speed: 7.5, turn: 1.6, turretTurn: 1.8, radius: 3.4, behaviour: 'chase', preferred: 24, reward: 70, detect: 45,
    weapon: { kind: 'shell', damage: 70, splash: 2.5, speed: 36, reload: 3.4, spread: 0.04, range: 36, building: 1 },
  },
  heavy: {
    vehicle: 'heavy', name: 'Heavy Tank', hp: 1100, speed: 4.5, turn: 1.0, turretTurn: 1.2, radius: 4.0, behaviour: 'chase', preferred: 14, reward: 120, detect: 40, crusher: true,
    weapon: { kind: 'shell', damage: 110, splash: 3.5, speed: 30, reload: 4.2, spread: 0.04, range: 36, building: 1.5 },
  },
  infantry: {
    vehicle: 'soldier', name: tr('ทหารราบ', 'Infantry'), hp: 30, speed: 3.2, turn: 5, turretTurn: 6, radius: 0.8, behaviour: 'standoff', preferred: 20, reward: 8, detect: 35, infantry: true,
    weapon: { kind: 'bullet', damage: 2, splash: 0, speed: 50, reload: 1.8, burst: 3, burstGap: 0.15, spread: 0.1, range: 26, building: 0.02 },
  },
  rpg: {
    vehicle: 'soldier-rpg', name: tr('พลยิง RPG', 'RPG trooper'), hp: 30, speed: 3, turn: 5, turretTurn: 4, radius: 0.8, behaviour: 'standoff', preferred: 24, reward: 12, detect: 38, infantry: true,
    weapon: { kind: 'shell', damage: 45, splash: 2.5, speed: 28, reload: 5.5, spread: 0.05, range: 32, building: 1.2 },
  },
  heli: {
    vehicle: 'heli', name: tr('เฮลิคอปเตอร์โจมตี', 'Attack helicopter'), hp: 1800, speed: 12, turn: 1.6, turretTurn: 3, radius: 4.5, behaviour: 'orbit', preferred: 30, reward: 400, detect: 90, flying: 12, boss: tr('เฮลิคอปเตอร์โจมตี', 'Attack helicopter'),
    weapon: { kind: 'shell', damage: 26, splash: 3, speed: 45, reload: 3.4, burst: 4, burstGap: 0.25, spread: 0.05, range: 48, building: 1 },
  },
  kamikaze: {
    vehicle: 'drone', name: tr('โดรนพลีชีพ', 'Kamikaze drone'), hp: 40, speed: 15, turn: 4, turretTurn: 6, radius: 1.3, behaviour: 'kamikaze', preferred: 0, reward: 20, detect: 70, flying: 4.5,
    blast: { damage: 120, splash: 5 },
    weapon: { kind: 'bullet', damage: 0, splash: 0, speed: 1, reload: 99, spread: 0, range: 0, building: 0 },
  },
  ugv: {
    vehicle: 'ugv', name: tr('รถถังหุ่นยนต์', 'Robot tank'), hp: 260, speed: 9, turn: 2.6, turretTurn: 3, radius: 2.2, behaviour: 'chase', preferred: 16, reward: 45, detect: 50,
    weapon: { kind: 'bullet', damage: 7, splash: 0, speed: 60, reload: 1.5, burst: 5, burstGap: 0.08, spread: 0.06, range: 30, building: 0.1 },
  },
  behemoth: {
    vehicle: 'behemoth', name: 'Behemoth', hp: 4500, speed: 3, turn: 0.6, turretTurn: 0.9, radius: 6, behaviour: 'chase', preferred: 22, reward: 1500, detect: 95, crusher: true, boss: 'BEHEMOTH', barrage: true,
    weapon: { kind: 'shell', damage: 150, splash: 4.5, speed: 34, reload: 3.5, spread: 0.03, range: 46, building: 2 },
  },
  tyrant: {
    vehicle: 'tyrant', name: 'Desert Tyrant', hp: 4200, speed: 3.5, turn: 0.7, turretTurn: 1, radius: 6.2, behaviour: 'chase', preferred: 24, reward: 2200, detect: 100, crusher: true, boss: 'DESERT TYRANT', barrage: true,
    weapon: { kind: 'shell', damage: 150, splash: 5, speed: 36, reload: 3.2, spread: 0.03, range: 48, building: 2 },
  },
  titan: {
    vehicle: 'titan', name: 'Frost Titan', hp: 3800, speed: 3, turn: 0.55, turretTurn: 0.85, radius: 7, behaviour: 'chase', preferred: 26, reward: 4000, detect: 110, crusher: true, boss: 'FROST TITAN', barrage: true, railgun: true,
    weapon: { kind: 'shell', damage: 170, splash: 5.5, speed: 38, reload: 3, spread: 0.03, range: 50, building: 2 },
  },
};

export type AmmoId = 'AP' | 'HE' | 'HEAT' | 'INC' | 'CLU' | 'RAIL';
export interface AmmoDef extends WeaponDef {
  label: string;
  name: string;
  desc: string;
  capacity: number;
  color: string;
}
export const AMMO: Record<AmmoId, AmmoDef> = {
  AP: { label: 'AP', name: tr('เจาะเกราะ AP', 'Armor-piercing (AP)'), desc: tr('กระสุนพื้นฐาน ไม่จำกัด', 'Standard round, unlimited'), color: '#e8e2c8', capacity: Infinity, kind: 'shell', damage: 120, splash: 1.5, speed: 120, reload: 1.15, spread: 0.008, range: 60, building: 1 },
  HE: { label: 'HE', name: tr('ระเบิดแรงสูง HE', 'High explosive (HE)'), desc: tr('ระเบิดวงกว้าง พังตึกได้ดี', 'Wide blast, great against buildings'), color: '#e0a02a', capacity: 12, kind: 'shell', damage: 75, splash: 6.5, speed: 75, reload: 1.5, spread: 0.012, range: 55, building: 3 },
  HEAT: { label: 'HEAT', name: tr('หัวรบ HEAT', 'HEAT warhead'), desc: tr('ดาเมจเดี่ยวสูงมาก เหมาะกับรถถังหนัก', 'Huge single-target damage, ideal vs heavy tanks'), color: '#ff7a3a', capacity: 10, kind: 'shell', damage: 210, splash: 1.2, speed: 100, reload: 1.7, spread: 0.008, range: 60, building: 0.8 },
  INC: { label: 'INC', name: tr('กระสุนเพลิง', 'Incendiary'), desc: tr('จุดไฟเป็นวงกว้าง เผาศัตรูต่อเนื่อง 6 วินาที', 'Sets a wide area ablaze, burning enemies for 6 s'), color: '#ff5a1a', capacity: 8, kind: 'shell', damage: 60, splash: 4, speed: 80, reload: 1.5, spread: 0.012, range: 55, building: 1.5, special: 'fire' },
  CLU: { label: 'CLU', name: tr('ลูกปรายคลัสเตอร์', 'Cluster shell'), desc: tr('แตกเป็นลูกระเบิดย่อย 7 ลูก', 'Splits into 7 bomblets'), color: '#c0d040', capacity: 8, kind: 'shell', damage: 50, splash: 3, speed: 75, reload: 1.8, spread: 0.012, range: 55, building: 1.5, special: 'cluster' },
  RAIL: { label: 'RAIL', name: tr('เรลกัน (อนาคต)', 'Railgun (prototype)'), desc: tr('ยิงทะลุศัตรูทุกคันในแนวเส้นตรง', 'Pierces every enemy in a straight line'), color: '#5ae0ff', capacity: 6, kind: 'shell', damage: 260, splash: 0, speed: 420, reload: 2.4, spread: 0, range: 90, building: 1.5, special: 'pierce' },
};
export const CLUSTER_BOMBLET: WeaponDef = { kind: 'shell', damage: 70, splash: 3.2, speed: 0, reload: 0, spread: 0, range: 0, building: 1.5 };
export const FIRE_FIELD = { radius: 5, time: 6, dps: 45, buildingDps: 15 };
export const PLAYER_MG: WeaponDef = { kind: 'bullet', damage: 7, splash: 0, speed: 140, reload: 0.085, spread: 0.035, range: 42, building: 0.08 };

export const PLAYER = { hp: 1000, speed: 9, turn: 1.8, turretTurn: 2.6, radius: 3.3 };

/** Top-attack guided missile fired by the Missile Pod power-up. */
export const GUIDED_MISSILE: WeaponDef = { kind: 'missile', damage: 95, splash: 3.5, speed: 48, reload: 0.75, spread: 0, range: 70, building: 1.2 };
/** Artillery shell called in by the Air Strike pick-up. */
export const AIRSTRIKE_SHELL: WeaponDef = { kind: 'rocket', damage: 140, splash: 6.5, speed: 60, reload: 0, spread: 0, range: 999, building: 2 };

// ───────────────────────── Pick-ups ─────────────────────────

export type PickupKind = 'repair' | 'ammo' | 'missile' | 'armor' | 'nitro' | 'rapid' | 'overcharge' | 'airstrike' | 'shield' | 'mines' | 'laser' | 'drones';
/** Timed effects on the player tank. */
export type BuffKind = 'missile' | 'armor' | 'nitro' | 'rapid' | 'overcharge' | 'shield' | 'laser' | 'drones';

export interface PickupDef {
  name: string;
  desc: string;
  color: string;
  icon: string;
  /** Relative drop chance. */
  weight: number;
  /** Seconds for timed buffs. */
  duration?: number;
}

export const PICKUPS: Record<PickupKind, PickupDef> = {
  repair: { name: tr('ชุดซ่อมบำรุง', 'Repair kit'), desc: '+300 HP', color: '#3fbf57', icon: '+', weight: 22 },
  ammo: { name: tr('กระสุน HE', 'HE ammo'), desc: tr('เติม HE เต็ม', 'Refills special ammo'), color: '#e0a02a', icon: 'HE', weight: 16 },
  missile: { name: tr('จรวดนำวิถี', 'Guided missiles'), desc: tr('ยิงจรวดล็อกเป้าอัตโนมัติ', 'Auto-locking missile pods'), color: '#e0503a', icon: '➶', weight: 12, duration: 20 },
  armor: { name: tr('เกราะเสริม ERA', 'ERA add-on armour'), desc: tr('รับดาเมจลด 60%', '−60% damage taken'), color: '#5b8fd9', icon: '▣', weight: 12, duration: 25 },
  nitro: { name: tr('ไนตรัส', 'Nitro'), desc: tr('ความเร็ว +60%', '+60% speed'), color: '#31c6e8', icon: '»', weight: 12, duration: 14 },
  rapid: { name: tr('ระบบบรรจุอัตโนมัติ', 'Autoloader'), desc: tr('บรรจุกระสุนเร็วขึ้น 2.2 เท่า', '2.2× faster reload'), color: '#c060e0', icon: '⟳', weight: 10, duration: 16 },
  overcharge: { name: tr('กระสุนโอเวอร์ชาร์จ', 'Overcharged rounds'), desc: tr('ดาเมจ ×2', '×2 damage'), color: '#ffd23a', icon: '×2', weight: 9, duration: 15 },
  airstrike: { name: tr('โจมตีทางอากาศ', 'Air strike'), desc: tr('ปืนใหญ่ถล่มศัตรูรอบตัว', 'Artillery barrage on nearby enemies'), color: '#ff7a2a', icon: '✈', weight: 7 },
  shield: { name: tr('โล่พลังงาน', 'Energy shield'), desc: tr('ดูดซับดาเมจ 600', 'Absorbs 600 damage'), color: '#4ff0ff', icon: '◈', weight: 10, duration: 20 },
  mines: { name: tr('ทุ่นระเบิด', 'Mines'), desc: tr('ได้ทุ่นระเบิด 5 ลูก (F / ปุ่ม MINE)', '5 proximity mines (F / MINE button)'), color: '#b8d040', icon: '✹', weight: 10 },
  drones: { name: tr('โดรนจู่โจม', 'Attack drones'), desc: tr('โดรน 2 ลำช่วยยิง แล้วพุ่งชนเป้าตอนหมดเวลา', '2 drones fight for you, then dive-bomb a target'), color: '#8ad8ff', icon: '✢', weight: 9, duration: 25 },
  laser: { name: tr('ปืนเลเซอร์', 'Laser'), desc: tr('ลำแสงต่อเนื่องแทนปืนกล', 'Continuous beam replaces the MG'), color: '#ff4ad0', icon: 'ϟ', weight: 8, duration: 15 },
};

export const SHIELD_HP = 600;
export const MINE: WeaponDef = { kind: 'shell', damage: 350, splash: 5.5, speed: 0, reload: 0, spread: 0, range: 0, building: 1.5 };
export const MINES_PER_PICKUP = 5;
export const MAX_MINES = 10;
export const LASER = { range: 55, dps: 170, buildingDps: 60 };
export const DRONE_GUN: WeaponDef = { kind: 'bullet', damage: 6, splash: 0, speed: 90, reload: 1.1, burst: 6, burstGap: 0.08, spread: 0.05, range: 40, building: 0.05 };
export const DRONE_BLAST: WeaponDef = { kind: 'shell', damage: 160, splash: 4.5, speed: 0, reload: 0, spread: 0, range: 0, building: 1 };
export const MAX_DRONES = 3;

export type Dir = 'N' | 'S' | 'E' | 'W';
export interface SpawnGroup {
  kind: EnemyKind;
  count: number;
  from: Dir;
  /** Seconds after the wave starts. */
  delay: number;
}
export interface WaveDef {
  groups: SpawnGroup[];
}
export type LevelMode = 'survival' | 'defend' | 'destroy' | 'escort' | 'boss';

export interface LevelDef {
  id: number;
  name: string;
  nameTh: string;
  chapter: string;
  playable: boolean;
  mode: LevelMode;
  /** Overall enemy strength multiplier for the level (HP and damage). */
  diff: number;
  N: number;
  seed: number;
  district: (ix: number, iz: number) => District;
  start: [number, number];
  waves: WaveDef[];
  /** Secondary objectives for stars 2 and 3. */
  stars: { minHpPct: number; buildings: number; timeLimit: number };
  /** Field hospital to protect (defend mode). */
  defend?: [number, number];
  /** Jammer towers to destroy (destroy mode). */
  jammers?: [number, number][];
  /** Convoy route (escort mode). */
  convoy?: [number, number][];
  /** Explosive fuel tanks / drum clusters. */
  fuel?: { at: [number, number]; kind: 'tank' | 'drums'; ry?: number }[];
  /** Short mission briefing shown before the level. */
  brief: string;
  theme?: Theme;
  seaSouth?: boolean;
  weather?: 'sandstorm' | 'snow' | 'blizzard';
  /** Icy roads: vehicles slide. */
  ice?: boolean;
  defendLabel?: string;
  jammerLabel?: string;
}

const suburbOnly = (ix: number, iz: number): District => (ix === 0 && iz === 0 ? 'park' : 'suburb');
const downtown = (ix: number, iz: number): District => (ix === 0 && iz === 0 ? 'park' : Math.abs(ix) + Math.abs(iz) === 2 ? 'downtown' : 'midtown');
const g = (kind: EnemyKind, count: number, from: Dir, delay = 0): SpawnGroup => ({ kind, count, from, delay });
const W = (...groups: SpawnGroup[]): WaveDef => ({ groups });

// ───────────────────────── Chapters 3–5 ─────────────────────────

const WEIGHT: Partial<Record<EnemyKind, number>> = { buggy: 1.3, infantry: 1.8, rpg: 0.9, light: 1, apc: 0.6, mlrs: 0.35, medium: 0.75, heavy: 0.45, ugv: 0.9, kamikaze: 1.1 };
const DIRS: Dir[] = ['N', 'E', 'S', 'W'];

/** Build `n` escalating waves from per-wave unit pools; `finale` groups join the last wave. */
function genWaves(n: number, pools: EnemyKind[][], base: number, finale: SpawnGroup[] = []): WaveDef[] {
  const waves: WaveDef[] = [];
  for (let i = 0; i < n; i++) {
    const pool = pools[Math.min(pools.length - 1, Math.floor((i / n) * pools.length))];
    const groups = pool.map((k, j) => g(k, Math.max(1, Math.round((base + i * 0.45) * (WEIGHT[k] ?? 1))), DIRS[(i + j) % 4], j * 4));
    if (i === n - 1) groups.push(...finale);
    waves.push({ groups });
  }
  return waves;
}

const desertTown = (ix: number, iz: number): District => (ix === 0 && iz === 0 ? 'oasis' : 'desertTown');
const desertBase = (ix: number, iz: number): District => (ix === 0 && iz === 0 ? 'oasis' : Math.abs(ix) + Math.abs(iz) === 2 ? 'base' : 'desertTown');
const port = (ix: number, iz: number): District => (iz === 1 ? 'dock' : (ix + iz) % 2 === 0 ? 'containers' : 'warehouse');
const diff = (id: number) => 1 + (id - 1) * 0.07;
const stars = (waves: number, buildings = 6): LevelDef['stars'] => ({ minHpPct: 40, buildings, timeLimit: 300 + waves * 75 });

function chapter3(): LevelDef[] {
  const C = 'ทะเลทราย';
  const P: EnemyKind[][] = [['buggy', 'infantry', 'light'], ['light', 'rpg', 'apc'], ['light', 'apc', 'mlrs', 'infantry'], ['medium', 'apc', 'rpg'], ['medium', 'light', 'mlrs', 'kamikaze'], ['heavy', 'medium', 'apc', 'rpg']];
  const base = { chapter: C, playable: true, N: 1, theme: 'desert' as Theme, start: [0, 32] as [number, number] };
  return [
    { ...base, id: 11, name: 'Dune Road', nameTh: tr('ถนนเนินทราย', 'Dune Road'), mode: 'survival', diff: diff(11), seed: 11011, district: desertTown, brief: tr('เมืองกลางทะเลทราย — ศัตรูซ่อนตามบ้านดินและลานกว้าง', 'A desert town — enemies hide among the adobe houses and yards'), waves: genWaves(7, P, 2.4), stars: stars(7) },
    { ...base, id: 12, name: 'Oasis', nameTh: tr('โอเอซิส', 'Oasis'), mode: 'defend', diff: diff(12), seed: 12012, district: desertTown, defend: [0, 14], defendLabel: tr('สถานีสูบน้ำโอเอซิส', 'oasis pumping station'), brief: tr('ปกป้องสถานีสูบน้ำกลางโอเอซิส — แหล่งน้ำสุดท้ายของเมือง', 'Protect the pumping station at the oasis — the town\'s last water source'), waves: genWaves(7, P, 2.4), stars: stars(7) },
    { ...base, id: 13, name: 'Sandstorm', nameTh: tr('พายุทราย', 'Sandstorm'), mode: 'survival', diff: diff(13), seed: 13013, district: desertBase, weather: 'sandstorm', brief: tr('พายุทรายบดบังทัศนวิสัย — ศัตรูอาจโผล่มาใกล้กว่าที่คิด', 'A sandstorm cuts visibility — enemies may appear closer than you expect'), waves: genWaves(8, P, 2.5), stars: stars(8) },
    { ...base, id: 14, name: 'Forward Base', nameTh: tr('ฐานทัพหน้า', 'Forward Base'), mode: 'destroy', diff: diff(14), seed: 14014, district: desertBase, jammers: [[-96, -32], [96, -32], [0, -96], [32, 96]], jammerLabel: tr('เรดาร์ศัตรู', 'enemy radars'), brief: tr('บุกฐานทัพหน้าของศัตรู ทำลายเรดาร์ 4 ต้น — ระวังถังเชื้อเพลิงในฐาน', 'Assault the forward base and destroy 4 radars — mind the fuel tanks'), waves: genWaves(6, P.slice(2), 2.8), stars: stars(6, 8) },
    { ...base, id: 15, name: 'Desert Tyrant', nameTh: tr('จอมทรราชทะเลทราย', 'Desert Tyrant'), mode: 'boss', diff: diff(15), seed: 15015, district: desertBase, weather: 'sandstorm', brief: tr('บอสบทที่ 3: "Desert Tyrant" รถถังยักษ์กลางพายุทราย', 'Chapter 3 boss: the "Desert Tyrant" giant tank in a sandstorm'), waves: genWaves(7, P, 2.7, [g('tyrant', 1, 'N', 6), g('heli', 1, 'E', 20)]), stars: stars(7) },
  ];
}

function chapter4(): LevelDef[] {
  const C = 'ท่าเรือ';
  const P: EnemyKind[][] = [['ugv', 'infantry', 'light'], ['medium', 'rpg', 'kamikaze'], ['ugv', 'medium', 'mlrs'], ['heavy', 'apc', 'kamikaze'], ['heavy', 'medium', 'ugv', 'mlrs'], ['heavy', 'ugv', 'kamikaze', 'rpg']];
  const base = { chapter: C, playable: true, N: 1, theme: 'port' as Theme, seaSouth: true, start: [0, -32] as [number, number] };
  return [
    { ...base, id: 16, name: 'Container Yard', nameTh: tr('ลานตู้คอนเทนเนอร์', 'Container Yard'), mode: 'survival', diff: diff(16), seed: 16016, district: port, brief: tr('เขาวงกตตู้คอนเทนเนอร์ — ตู้พังเป็นชั้น ๆ ใช้เป็นที่กำบังได้', 'A maze of containers — stacks collapse tier by tier and make good cover'), waves: genWaves(7, P, 2.6), stars: stars(7, 10) },
    { ...base, id: 17, name: 'Dockside Convoy', nameTh: tr('ขบวนริมท่า', 'Dockside Convoy'), mode: 'escort', diff: diff(17), seed: 17017, district: port, start: [-84, -40], convoy: [[-128, -32], [140, -32]], brief: tr('คุ้มกันขบวนรถขนเสบียงผ่านเขตท่าเรือ', 'Escort the supply convoy through the harbour'), waves: genWaves(5, P.slice(0, 4), 2.8), stars: stars(5, 6) },
    { ...base, id: 18, name: 'Warehouse District', nameTh: tr('ย่านโกดัง', 'Warehouse District'), mode: 'survival', diff: diff(18), seed: 18018, district: port, brief: tr('โกดังเต็มไปด้วยถังเชื้อเพลิง — ศัตรูหนักใช้ที่นี่เป็นฐาน', 'Warehouses full of fuel drums — heavy units are based here'), waves: genWaves(8, P, 2.7), stars: stars(8, 8) },
    { ...base, id: 19, name: 'Harbor Radar', nameTh: tr('เรดาร์ท่าเรือ', 'harbour radars'), mode: 'destroy', diff: diff(19), seed: 19019, district: port, jammers: [[-96, -96], [96, -96], [-96, 32], [96, 32]], jammerLabel: tr('เรดาร์ท่าเรือ', 'harbour radars'), brief: tr('ทำลายเรดาร์ 4 ต้นที่มุมท่าเรือ', 'Destroy the 4 radars at the corners of the port'), waves: genWaves(6, P.slice(2), 2.9), stars: stars(6, 8) },
    { ...base, id: 20, name: 'Twin Gunships', nameTh: tr('เฮลิคอปเตอร์คู่', 'Twin Gunships'), mode: 'boss', diff: diff(20), seed: 20020, district: port, brief: tr('บอสบทที่ 4: เฮลิคอปเตอร์โจมตี 2 ลำพร้อมกันเหนือท่าเรือ', 'Chapter 4 boss: two attack helicopters over the port at once'), waves: genWaves(7, P, 2.8, [g('heli', 2, 'N', 4), g('kamikaze', 4, 'E', 12)]), stars: stars(7) },
  ];
}

function chapter5(): LevelDef[] {
  const C = 'เมืองหิมะ';
  const P: EnemyKind[][] = [['medium', 'ugv', 'infantry'], ['heavy', 'kamikaze', 'rpg'], ['medium', 'heavy', 'mlrs', 'ugv'], ['heavy', 'kamikaze', 'apc', 'medium'], ['heavy', 'ugv', 'mlrs', 'kamikaze', 'rpg']];
  const base = { chapter: C, playable: true, N: 1, theme: 'winter' as Theme, ice: true, weather: 'snow' as const, start: [0, 32] as [number, number] };
  return [
    { ...base, id: 21, name: 'Frozen Suburb', nameTh: tr('ชานเมืองน้ำแข็ง', 'Frozen Suburb'), mode: 'survival', diff: diff(21), seed: 21021, district: suburbOnly, brief: tr('ถนนเป็นน้ำแข็ง — รถถังจะลื่นไถล เบรกล่วงหน้า', 'Icy roads — your tank will slide, brake early'), waves: genWaves(7, P, 2.8), stars: stars(7) },
    { ...base, id: 22, name: 'Blizzard', nameTh: tr('พายุหิมะ', 'Blizzard'), mode: 'survival', diff: diff(22), seed: 22022, district: downtown, weather: 'blizzard', brief: tr('พายุหิมะรุนแรง มองเห็นได้ไม่ไกล', 'A heavy blizzard — visibility is short'), waves: genWaves(7, P, 2.85), stars: stars(7, 5) },
    { ...base, id: 23, name: 'Winter Hospital', nameTh: tr('โรงพยาบาลหน้าหนาว', 'Winter Hospital'), mode: 'defend', diff: diff(23), seed: 23023, district: suburbOnly, defend: [0, 14], brief: tr('ปกป้องโรงพยาบาลสนามกลางหิมะ', 'Protect the field hospital in the snow'), waves: genWaves(7, P, 3.0), stars: stars(7) },
    { ...base, id: 24, name: 'Frozen Convoy', nameTh: tr('ขบวนฝ่าหิมะ', 'Frozen Convoy'), mode: 'escort', diff: diff(24), seed: 24024, district: downtown, start: [-84, 24], convoy: [[-128, 32], [140, 32]], brief: tr('คุ้มกันขบวนรถฝ่าเมืองหิมะ', 'Escort the convoy through the snowbound city'), waves: genWaves(5, P, 3.1), stars: stars(5, 4) },
    { ...base, id: 25, name: 'Frost Titan', nameTh: tr('ไททันน้ำแข็ง', 'Frost Titan'), mode: 'boss', diff: diff(25), seed: 25025, district: downtown, weather: 'blizzard', brief: tr('ศึกสุดท้าย: "Frost Titan" รถถังยักษ์ติดเรลกัน — ระวังลำแสงเล็ง', 'Final battle: the railgun-armed "Frost Titan" — watch for its aiming laser'), waves: genWaves(7, P, 3.3, [g('titan', 1, 'N', 6), g('heli', 1, 'W', 24)]), stars: stars(7, 5) },
  ];
}

export const LEVELS: LevelDef[] = [
  {
    id: 1, name: 'Quiet Street', nameTh: tr('ถนนสงบ', 'Quiet Street'), chapter: 'ชานเมือง', playable: true, mode: 'survival', diff: 1, N: 1, seed: 1001, district: suburbOnly, start: [0, 32],
    brief: tr('ศัตรูลาดตระเวนในย่านชานเมือง กวาดล้างให้หมด 5 ระลอก', 'Enemy patrols in the suburbs — clear all 5 waves'),
    stars: { minHpPct: 50, buildings: 6, timeLimit: 420 },
    waves: [
      W(g('buggy', 3, 'N'), g('buggy', 2, 'E', 5)),
      W(g('buggy', 4, 'W'), g('light', 2, 'S', 4)),
      W(g('light', 3, 'E'), g('apc', 2, 'N', 6), g('buggy', 3, 'S', 10)),
      W(g('buggy', 5, 'S'), g('mlrs', 1, 'N', 3), g('light', 3, 'W', 6), g('apc', 2, 'E', 12)),
      W(g('apc', 3, 'N'), g('mlrs', 2, 'W', 4), g('light', 4, 'E', 8), g('buggy', 6, 'S', 12), g('medium', 1, 'N', 18)),
    ],
  },
  {
    id: 2, name: 'Cul-de-sac', nameTh: tr('ซอยตัน', 'Cul-de-sac'), chapter: 'ชานเมือง', playable: true, mode: 'survival', diff: 1.07, N: 1, seed: 2002, district: suburbOnly, start: [-32, 0],
    brief: tr('ทหารราบศัตรูแทรกซึมตามบ้านเรือน — ขับทับได้ ระวังพลยิงจรวด RPG', 'Enemy infantry among the houses — run them over, watch out for RPGs'),
    stars: { minHpPct: 50, buildings: 8, timeLimit: 480 },
    waves: [
      W(g('infantry', 6, 'N'), g('buggy', 2, 'E', 4)),
      W(g('infantry', 6, 'W'), g('rpg', 2, 'W', 2), g('buggy', 3, 'S', 6)),
      W(g('light', 2, 'E'), g('infantry', 6, 'S', 3), g('rpg', 2, 'N', 6)),
      W(g('buggy', 4, 'N'), g('light', 3, 'W', 4), g('rpg', 3, 'E', 8)),
      W(g('apc', 2, 'S'), g('light', 3, 'N', 5), g('infantry', 6, 'E', 8)),
      W(g('light', 4, 'W'), g('apc', 2, 'E', 4), g('rpg', 4, 'N', 8), g('buggy', 4, 'S', 12)),
      W(g('light', 4, 'N'), g('rpg', 4, 'E', 3), g('infantry', 8, 'S', 6), g('apc', 2, 'W', 10)),
    ],
  },
  {
    id: 3, name: 'School Yard', nameTh: tr('สนามโรงเรียน', 'School Yard'), chapter: 'ชานเมือง', playable: true, mode: 'defend', diff: 1.14, N: 1, seed: 3003, district: suburbOnly, start: [0, 32], defend: [0, 14],
    brief: tr('ปกป้องโรงพยาบาลสนามกลางสวนสาธารณะ ศัตรูบางส่วนจะพุ่งเป้าไปที่โรงพยาบาล — ถ้าถูกทำลาย ภารกิจล้มเหลว', 'Protect the field hospital in the park — some enemies go straight for it; if it falls, the mission fails'),
    stars: { minHpPct: 40, buildings: 6, timeLimit: 540 },
    waves: [
      W(g('buggy', 4, 'N'), g('infantry', 4, 'E', 4)),
      W(g('apc', 2, 'W'), g('buggy', 3, 'S', 4)),
      W(g('light', 3, 'N'), g('apc', 1, 'E', 5), g('rpg', 3, 'S', 8)),
      W(g('apc', 2, 'S'), g('light', 3, 'W', 5), g('buggy', 4, 'N', 9)),
      W(g('light', 4, 'E'), g('apc', 2, 'N', 5), g('rpg', 4, 'W', 9)),
      W(g('apc', 3, 'N'), g('light', 4, 'S', 4), g('mlrs', 1, 'E', 8), g('buggy', 5, 'W', 12)),
    ],
  },
  {
    id: 4, name: 'Gas Station', nameTh: tr('ปั๊มน้ำมัน', 'Gas Station'), chapter: 'ชานเมือง', playable: true, mode: 'survival', diff: 1.21, N: 1, seed: 4004, district: suburbOnly, start: [0, 32],
    brief: tr('ถังน้ำมันและถังเชื้อเพลิงระเบิดได้ — ยิงให้ระเบิดใส่ศัตรู แต่อย่าอยู่ใกล้เอง', 'Fuel tanks and drums explode — blow them up on enemies, but keep your distance'),
    fuel: [
      { at: [-40, 25], kind: 'tank', ry: Math.PI / 2 }, { at: [40, -25], kind: 'tank', ry: Math.PI / 2 }, { at: [25, 58], kind: 'tank' }, { at: [-25, -62], kind: 'tank' },
      { at: [-40, 20], kind: 'drums' }, { at: [40, -20], kind: 'drums' }, { at: [29, 58], kind: 'drums' }, { at: [-29, -62], kind: 'drums' },
      { at: [-24, 40], kind: 'drums' }, { at: [24, 24], kind: 'drums' }, { at: [-40, -40], kind: 'drums' }, { at: [60, 39], kind: 'drums' },
      { at: [-60, -25], kind: 'drums' }, { at: [40, -60], kind: 'drums' }, { at: [-92, 60], kind: 'drums' }, { at: [92, -60], kind: 'drums' },
    ],
    stars: { minHpPct: 50, buildings: 8, timeLimit: 560 },
    waves: [
      W(g('light', 2, 'N'), g('buggy', 3, 'E', 3)),
      W(g('light', 3, 'W'), g('infantry', 5, 'S', 4)),
      W(g('apc', 2, 'E'), g('light', 3, 'N', 5), g('rpg', 2, 'W', 8)),
      W(g('mlrs', 1, 'S'), g('light', 4, 'E', 3), g('buggy', 4, 'N', 7)),
      W(g('light', 4, 'W'), g('apc', 2, 'S', 5), g('rpg', 4, 'E', 9)),
      W(g('medium', 1, 'N'), g('light', 4, 'E', 4), g('mlrs', 1, 'W', 8), g('infantry', 6, 'S', 10)),
      W(g('medium', 2, 'S'), g('apc', 3, 'N', 4), g('light', 4, 'W', 8), g('mlrs', 2, 'E', 12)),
    ],
  },
  {
    id: 5, name: 'Suburb Gate', nameTh: tr('ประตูชานเมือง', 'Suburb Gate'), chapter: 'ชานเมือง', playable: true, mode: 'boss', diff: 1.28, N: 1, seed: 5005, district: suburbOnly, start: [0, 32],
    brief: tr('ยึดทางเข้าเมือง — ระลอกสุดท้ายมีเฮลิคอปเตอร์โจมตีบินข้ามตึกมาถล่ม', 'Take the city gate — the last wave brings an attack helicopter over the rooftops'),
    stars: { minHpPct: 40, buildings: 8, timeLimit: 660 },
    waves: [
      W(g('buggy', 4, 'N'), g('light', 2, 'E', 4)),
      W(g('light', 3, 'W'), g('infantry', 6, 'S', 3), g('rpg', 2, 'S', 5)),
      W(g('apc', 2, 'N'), g('light', 3, 'E', 5), g('buggy', 4, 'W', 9)),
      W(g('medium', 1, 'S'), g('light', 4, 'N', 4), g('rpg', 3, 'E', 8)),
      W(g('mlrs', 1, 'W'), g('apc', 3, 'E', 4), g('light', 3, 'S', 8)),
      W(g('medium', 2, 'N'), g('light', 4, 'W', 5), g('buggy', 5, 'E', 9)),
      W(g('heli', 1, 'N'), g('light', 3, 'S', 6), g('apc', 2, 'E', 12)),
    ],
  },
  {
    id: 6, name: 'Main Avenue', nameTh: tr('ถนนสายหลัก', 'Main Avenue'), chapter: 'ใจกลางเมือง', playable: true, mode: 'survival', diff: 1.36, N: 1, seed: 6006, district: downtown, start: [0, 32],
    brief: tr('บุกเข้าใจกลางเมือง ระวังโดรนพลีชีพที่บินข้ามตึก — ยิงปืนกลสกัดก่อนถึงตัว', 'Push downtown — shoot down kamikaze drones with the MG before they reach you'),
    stars: { minHpPct: 45, buildings: 5, timeLimit: 660 },
    waves: [
      W(g('light', 3, 'N'), g('kamikaze', 3, 'E', 5)),
      W(g('medium', 1, 'W'), g('infantry', 6, 'S', 3), g('kamikaze', 3, 'N', 8)),
      W(g('medium', 2, 'E'), g('light', 3, 'N', 5), g('rpg', 3, 'W', 8)),
      W(g('apc', 2, 'S'), g('kamikaze', 5, 'W', 4), g('light', 3, 'E', 8)),
      W(g('medium', 2, 'N'), g('mlrs', 1, 'S', 4), g('kamikaze', 4, 'E', 10)),
      W(g('medium', 3, 'W'), g('light', 4, 'E', 5), g('rpg', 4, 'S', 9)),
      W(g('medium', 3, 'S'), g('apc', 2, 'N', 4), g('kamikaze', 6, 'W', 8), g('mlrs', 1, 'E', 12)),
    ],
  },
  {
    id: 7, name: 'Crossroads', nameTh: tr('สี่แยกวัดใจ', 'Crossroads'), chapter: 'ใจกลางเมือง', playable: true, mode: 'destroy', diff: 1.44, N: 1, seed: 7007, district: downtown, start: [0, 32],
    jammers: [[-96, -32], [32, -96], [96, 32]],
    brief: tr('ทำลายเสาสัญญาณรบกวน 3 ต้น (เรดาร์ของคุณใช้ไม่ได้จนกว่าจะทำลายหมด) ศัตรูจะส่งกำลังเสริมมาเรื่อย ๆ', 'Destroy 3 jammer towers (your radar is down until they fall) — reinforcements keep coming'),
    stars: { minHpPct: 45, buildings: 5, timeLimit: 480 },
    waves: [
      W(g('light', 3, 'N'), g('infantry', 5, 'E', 3)),
      W(g('mlrs', 1, 'W'), g('light', 3, 'S', 3), g('rpg', 3, 'N', 6)),
      W(g('medium', 2, 'E'), g('apc', 2, 'W', 4), g('kamikaze', 3, 'S', 8)),
      W(g('mlrs', 2, 'N'), g('medium', 2, 'S', 4), g('light', 3, 'E', 8)),
      W(g('medium', 2, 'S'), g('mlrs', 1, 'E', 4), g('rpg', 4, 'W', 8), g('kamikaze', 3, 'N', 10)),
      W(g('medium', 3, 'N'), g('kamikaze', 4, 'E', 5), g('mlrs', 2, 'S', 10), g('apc', 2, 'W', 12)),
    ],
  },
  {
    id: 8, name: 'Financial District', nameTh: tr('ย่านการเงิน', 'Financial District'), chapter: 'ใจกลางเมือง', playable: true, mode: 'survival', diff: 1.52, N: 1, seed: 8008, district: downtown, start: [0, 32],
    brief: tr('รถถังหนักบุกย่านตึกสูง — ใช้ HEAT หรือเรลกันเจาะเกราะหนา', 'Heavy tanks among the towers — use HEAT or the railgun'),
    stars: { minHpPct: 40, buildings: 5, timeLimit: 780 },
    waves: [
      W(g('medium', 2, 'N'), g('light', 3, 'E', 4)),
      W(g('heavy', 1, 'W'), g('infantry', 6, 'S', 3), g('rpg', 3, 'S', 5)),
      W(g('medium', 3, 'E'), g('kamikaze', 4, 'N', 5)),
      W(g('heavy', 1, 'S'), g('medium', 2, 'W', 4), g('mlrs', 1, 'N', 8)),
      W(g('heavy', 2, 'N'), g('apc', 2, 'E', 5), g('rpg', 4, 'W', 9)),
      W(g('medium', 3, 'W'), g('heavy', 1, 'S', 4), g('kamikaze', 5, 'E', 8)),
      W(g('heavy', 2, 'E'), g('medium', 3, 'N', 5), g('mlrs', 2, 'S', 10)),
      W(g('heavy', 3, 'S'), g('medium', 3, 'W', 5), g('kamikaze', 6, 'N', 9), g('apc', 2, 'E', 12)),
    ],
  },
  {
    id: 9, name: 'Convoy Run', nameTh: tr('คุ้มกันขบวนรถ', 'Convoy Run'), chapter: 'ใจกลางเมือง', playable: true, mode: 'escort', diff: 1.6, N: 1, seed: 9009, district: downtown, start: [-84, 24],
    convoy: [[-128, 32], [140, 32]],
    brief: tr('คุ้มกันขบวนรถ 3 คันข้ามเมือง ขบวนจะวิ่งเมื่อคุณอยู่ใกล้ (35 ม.) — ให้เหลือรอดอย่างน้อย 1 คันถึงปลายทาง', 'Escort 3 trucks across the city — they move while you are within 35 m; at least 1 must arrive'),
    stars: { minHpPct: 40, buildings: 4, timeLimit: 420 },
    waves: [
      W(g('ugv', 3, 'N'), g('infantry', 5, 'S', 3)),
      W(g('light', 3, 'E'), g('ugv', 2, 'N', 4), g('rpg', 3, 'S', 7)),
      W(g('medium', 2, 'N'), g('kamikaze', 4, 'E', 4), g('ugv', 3, 'S', 8)),
      W(g('heavy', 1, 'E'), g('ugv', 4, 'N', 4), g('mlrs', 1, 'S', 8)),
      W(g('medium', 2, 'S'), g('ugv', 4, 'E', 4), g('kamikaze', 4, 'N', 8), g('rpg', 3, 'W', 10)),
    ],
  },
  {
    id: 10, name: 'City Hall', nameTh: tr('ศาลาว่าการ', 'City Hall'), chapter: 'ใจกลางเมือง', playable: true, mode: 'boss', diff: 1.7, N: 1, seed: 10010, district: downtown, start: [0, 32],
    brief: tr('ศึกตัดสิน: ทำลาย "Behemoth" รถถังยักษ์ 2 ป้อมปืน — มันถล่มด้วยจรวดและปล่อยโดรนเมื่อบาดเจ็บหนัก', 'The decisive battle: destroy the twin-turret "Behemoth" — rocket barrages, and drones when badly hurt'),
    stars: { minHpPct: 35, buildings: 6, timeLimit: 900 },
    waves: [
      W(g('medium', 2, 'N'), g('ugv', 3, 'E', 4)),
      W(g('heavy', 1, 'W'), g('infantry', 6, 'S', 3), g('rpg', 3, 'S', 5)),
      W(g('medium', 3, 'E'), g('kamikaze', 4, 'N', 5), g('mlrs', 1, 'W', 8)),
      W(g('heavy', 2, 'S'), g('ugv', 3, 'N', 4), g('apc', 2, 'E', 8)),
      W(g('heli', 1, 'W'), g('medium', 2, 'E', 5), g('kamikaze', 4, 'S', 9)),
      W(g('heavy', 2, 'N'), g('medium', 3, 'W', 5), g('mlrs', 2, 'E', 9)),
      W(g('behemoth', 1, 'N'), g('medium', 2, 'E', 8), g('ugv', 3, 'W', 14)),
    ],
  },
  ...chapter3(),
  ...chapter4(),
  ...chapter5(),
];

// Display name: `nameTh` is shown in the UI, so use the English name in English mode
if (lang === 'en') for (const l of LEVELS) l.nameTh = l.name;
