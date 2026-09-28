import { tr } from '../i18n';
import type { AmmoId } from './data';
import type { Profile } from '../save/storage';

// ───────────────────────── Tank upgrades (credits) ─────────────────────────

export type StatId = 'attack' | 'defense' | 'hp' | 'speed' | 'reload';

export interface StatDef {
  name: string;
  icon: string;
  /** Effect per level (fraction). */
  per: number;
  unit: string;
  max: number;
  baseCost: number;
}

export const STATS: Record<StatId, StatDef> = {
  attack: { name: tr('พลังโจมตี', 'Attack'), icon: '⚔', per: 0.08, unit: tr('ดาเมจทุกอาวุธ', 'damage (all weapons)'), max: 10, baseCost: 300 },
  defense: { name: tr('พลังป้องกัน', 'Defense'), icon: '⛨', per: 0.05, unit: tr('ลดดาเมจที่ได้รับ', 'damage taken'), max: 10, baseCost: 300 },
  hp: { name: tr('HP ตัวถัง', 'Hull HP'), icon: '♥', per: 0.1, unit: tr('HP สูงสุด', 'max HP'), max: 10, baseCost: 250 },
  speed: { name: tr('เครื่องยนต์', 'Engine'), icon: '»', per: 0.05, unit: tr('ความเร็วและการเลี้ยว', 'speed and turning'), max: 10, baseCost: 250 },
  reload: { name: tr('ระบบบรรจุ', 'Loader'), icon: '⟳', per: 0.05, unit: tr('ลดเวลาบรรจุกระสุน', 'reload time'), max: 10, baseCost: 280 },
};

export const statCost = (id: StatId, level: number) => Math.round((STATS[id].baseCost * 1.45 ** level) / 10) * 10;

// ───────────────────────── Ammo unlocks (credits) ─────────────────────────

export const AMMO_PRICE: Record<AmmoId, number> = { AP: 0, HE: 0, HEAT: 1200, INC: 1800, CLU: 2600, RAIL: 4000 };

// ───────────────────────── Armour kits (credits, equip one) ─────────────────────────

export type ArmorKitId = 'none' | 'composite' | 'era' | 'slat' | 'heavy' | 'aps';
export type DamageKind = 'shell' | 'bullet' | 'rocket' | 'missile' | 'splash';

export interface ArmorKitDef {
  name: string;
  desc: string;
  price: number;
  hpMul?: number;
  speedMul?: number;
  /** Incoming damage multiplier per damage kind. */
  resist?: Partial<Record<DamageKind, number>>;
  /** Active Protection: shoots down incoming shells/rockets on a cooldown. */
  aps?: number;
}

export const ARMOR_KITS: Record<ArmorKitId, ArmorKitDef> = {
  none: { name: tr('เกราะมาตรฐาน', 'Standard armour'), desc: tr('ไม่มีเกราะเสริม', 'No add-on armour'), price: 0 },
  composite: { name: tr('เกราะคอมโพสิต', 'Composite armour'), desc: tr('HP สูงสุด +25%', '+25% max HP'), price: 1500, hpMul: 1.25 },
  era: { name: tr('เกราะปฏิกิริยา ERA', 'Reactive armour (ERA)'), desc: tr('ดาเมจจากกระสุนปืนใหญ่/จรวด −35%', '−35% damage from shells and rockets'), price: 2200, resist: { shell: 0.65, rocket: 0.65, missile: 0.65 } },
  slat: { name: tr('เกราะกรงซี่ (Slat)', 'Slat cage'), desc: tr('ดาเมจจากจรวดและแรงระเบิด −50%', '−50% damage from rockets and blasts'), price: 2000, resist: { rocket: 0.5, missile: 0.5, splash: 0.5 } },
  heavy: { name: tr('เกราะหนักพิเศษ', 'Heavy plating'), desc: tr('ดาเมจทุกชนิด −22% แต่ช้าลง 12%', '−22% all damage, but 12% slower'), price: 2800, speedMul: 0.88, resist: { shell: 0.78, bullet: 0.78, rocket: 0.78, missile: 0.78, splash: 0.78 } },
  aps: { name: tr('ระบบป้องกันเชิงรุก APS', 'Active Protection (APS)'), desc: tr('ยิงสกัดกระสุน/จรวดที่พุ่งเข้ามา ทุก 5 วินาที', 'Shoots down an incoming shell/rocket every 5 s'), price: 4500, aps: 5 },
};

// ───────────────────────── Passive skills (EXP → skill points) ─────────────────────────

export type SkillId = 'droneTime' | 'buffTime' | 'missile' | 'shield' | 'regen' | 'salvage' | 'mines' | 'airstrike' | 'crit' | 'bounty';

export interface SkillDef {
  name: string;
  icon: string;
  max: number;
  desc: (rank: number) => string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  droneTime: { name: tr('ผู้บังคับโดรน', 'Drone Operator'), icon: '✢', max: 5, desc: (r) => tr(`โดรนบินนานขึ้น +${r * 4} วินาที`, `Drones fly +${r * 4} s longer`) },
  buffTime: { name: tr('ช่างอุปกรณ์', 'Field Engineer'), icon: '⏱', max: 5, desc: (r) => tr(`ไอเทมแบบมีเวลา (เกราะ โล่ ไนตรัส ฯลฯ) นานขึ้น +${r * 12}%`, `Timed pick-ups (armour, shield, nitro…) last +${r * 12}%`) },
  missile: { name: tr('ผู้เชี่ยวชาญจรวด', 'Missile Specialist'), icon: '➶', max: 5, desc: (r) => tr(`จรวดนำวิถีนานขึ้น +${r * 3} วินาที และยิงถี่ขึ้น ${r * 10}%`, `Missile pods last +${r * 3} s and fire ${r * 10}% faster`) },
  shield: { name: tr('วิศวกรพลังงาน', 'Power Engineer'), icon: '◈', max: 5, desc: (r) => tr(`โล่พลังงานดูดซับเพิ่ม +${r * 120}`, `Energy shield absorbs +${r * 120}`) },
  regen: { name: tr('ซ่อมบำรุงภาคสนาม', 'Field Repairs'), icon: '✚', max: 5, desc: (r) => tr(`ฟื้น HP ${r * 2}/วินาที เมื่อไม่โดนยิง 4 วินาที`, `Regenerate ${r * 2} HP/s after 4 s without taking hits`) },
  salvage: { name: tr('นักค้นซาก', 'Scavenger'), icon: '?', max: 5, desc: (r) => tr(`โอกาสเจอของในซาก +${r * 6}% และกล่องร่มมาถี่ขึ้น ${r * 8}%`, `+${r * 6}% salvage chance, airdrops ${r * 8}% more often`) },
  mines: { name: tr('ผู้เชี่ยวชาญทุ่นระเบิด', 'Mine Expert'), icon: '✹', max: 5, desc: (r) => tr(`ได้ทุ่นเพิ่ม +${r} ลูก/กล่อง ดาเมจ +${r * 12}%`, `+${r} mines per crate, +${r * 12}% damage`) },
  airstrike: { name: tr('ผู้ประสานปืนใหญ่', 'Artillery Spotter'), icon: '✈', max: 5, desc: (r) => tr(`Air Strike เพิ่ม +${r * 2} นัด`, `Air strike +${r * 2} shells`) },
  crit: { name: tr('พลแม่นปืน', 'Marksman'), icon: '✦', max: 5, desc: (r) => tr(`โอกาสคริติคอล ${r * 4}% (ดาเมจ ×2)`, `${r * 4}% critical chance (×2 damage)`) },
  bounty: { name: tr('นักล่าค่าหัว', 'Bounty Hunter'), icon: '◆', max: 5, desc: (r) => tr(`เครดิตจากการทำลายศัตรู +${r * 8}%`, `+${r * 8}% credits from kills`) },
};

// ───────────────────────── EXP / levels ─────────────────────────

/** EXP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => 200 + 120 * (level - 1);

/** Add EXP to the profile; returns how many levels were gained (each gives 1 skill point). */
export function addXp(p: Profile, xp: number) {
  p.xp += xp;
  let gained = 0;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.skillPoints++;
    gained++;
  }
  return gained;
}

// ───────────────────────── Loadout (what the game applies) ─────────────────────────

export interface Loadout {
  dmgMul: number;
  /** Incoming damage multiplier from the Defense stat. */
  defMul: number;
  hpMul: number;
  speedMul: number;
  reloadMul: number;
  ammo: AmmoId[];
  armor: ArmorKitId;
  skills: Record<SkillId, number>;
}

export const DEFAULT_AMMO: AmmoId[] = ['AP', 'HE'];

export function loadoutOf(p: Profile): Loadout {
  const s = (id: StatId) => p.upgrades[id] ?? 0;
  const kit = ARMOR_KITS[p.armor.equipped] ?? ARMOR_KITS.none;
  const skills = {} as Record<SkillId, number>;
  for (const id of Object.keys(SKILLS) as SkillId[]) skills[id] = p.skills[id] ?? 0;
  const order: AmmoId[] = ['AP', 'HE', 'HEAT', 'INC', 'CLU', 'RAIL'];
  return {
    dmgMul: 1 + s('attack') * STATS.attack.per,
    defMul: 1 - s('defense') * STATS.defense.per,
    hpMul: (1 + s('hp') * STATS.hp.per) * (kit.hpMul ?? 1),
    speedMul: (1 + s('speed') * STATS.speed.per) * (kit.speedMul ?? 1),
    reloadMul: 1 - s('reload') * STATS.reload.per,
    ammo: order.filter((a) => DEFAULT_AMMO.includes(a) || p.ammo.includes(a)),
    armor: p.armor.equipped,
    skills,
  };
}
