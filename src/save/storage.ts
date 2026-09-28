/**
 * Persistence: 3 save slots + global settings, stored in IndexedDB (falls back to localStorage).
 * The adapter is isolated so it can be swapped for Capacitor Preferences/Filesystem later.
 */

import { addXp } from '../game/progression';
import { tr } from '../i18n';

export const SAVE_VERSION = 2;

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  sfx: number;
  music: number;
  quality: Quality;
  shake: boolean;
  damageNumbers: boolean;
  autoAim: boolean;
}

export interface Checkpoint {
  /** Remaining special ammo by type (newer saves). */
  ammo?: Record<string, number>;
  /** Mission objective state: ally HP, convoy progress, jammer HP. */
  objective?: { allies?: number[]; convoy?: number; jammers?: number[] };
  level: number;
  /** Index of the next wave to play. */
  wave: number;
  hp: number;
  he: number;
  x: number;
  z: number;
  yaw: number;
  /** building id → remaining hp */
  buildings: Record<number, number>;
  cars: number[]; // destroyed car ids
  trees: number[]; // felled tree ids
  poles?: number[]; // knocked-down lamp / traffic light ids
  kills: number;
  credits: number; // earned so far in this level
  time: number;
  razed: number;
  savedAt: number;
}

export interface Profile {
  version: number;
  createdAt: number;
  updatedAt: number;
  credits: number;
  unlocked: number;
  /** level id → [cleared, hp star, buildings star, time star] best flags */
  stars: Record<number, boolean[]>;
  totalKills: number;
  playTime: number;
  checkpoint: Checkpoint | null;
  // Progression (v2)
  level: number;
  xp: number;
  skillPoints: number;
  upgrades: Record<string, number>;
  ammo: string[];
  armor: { owned: string[]; equipped: 'none' | 'composite' | 'era' | 'slat' | 'heavy' | 'aps' };
  skills: Record<string, number>;
}

export const defaultSettings = (): Settings => ({ sfx: 0.8, music: 0.5, quality: 'auto', shake: true, damageNumbers: true, autoAim: true });

export const newProfile = (): Profile => ({
  version: SAVE_VERSION,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  credits: 0,
  unlocked: 1,
  stars: {},
  totalKills: 0,
  playTime: 0,
  checkpoint: null,
  level: 1,
  xp: 0,
  skillPoints: 0,
  upgrades: {},
  ammo: [],
  armor: { owned: ['none'], equipped: 'none' },
  skills: {},
});

/** Upgrade older save formats in place. */
function migrate(p: Partial<Profile> & { version?: number }): Profile {
  const base = newProfile();
  const out = { ...base, ...p } as Profile;
  // v1 → v2: progression fields are filled from defaults by the spread above;
  // past kills are converted to EXP so veteran saves start with some skill points.
  out.armor = { ...base.armor, ...(p.armor ?? {}) };
  if ((p.version ?? 1) < 2) addXp(out, (out.totalKills ?? 0) * 6);
  out.version = SAVE_VERSION;
  return out;
}

// ───────────────────────── Adapter ─────────────────────────

interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

function localKV(): KV {
  return {
    async get(k) {
      try {
        return localStorage.getItem('armor-tank:' + k);
      } catch {
        return null;
      }
    },
    async set(k, v) {
      try {
        localStorage.setItem('armor-tank:' + k, v);
      } catch {
        /* storage full or blocked */
      }
    },
    async del(k) {
      try {
        localStorage.removeItem('armor-tank:' + k);
      } catch {
        /* ignore */
      }
    },
  };
}

async function idbKV(): Promise<KV> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('armor-tank', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
      const r = fn(db.transaction('kv', mode).objectStore('kv'));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  return {
    get: async (k) => (await tx<string | undefined>('readonly', (s) => s.get(k) as IDBRequest<string | undefined>)) ?? null,
    set: async (k, v) => void (await tx('readwrite', (s) => s.put(v, k))),
    del: async (k) => void (await tx('readwrite', (s) => s.delete(k))),
  };
}

let kv: KV = localKV();

// ───────────────────────── Public API ─────────────────────────

export const SLOTS = [1, 2, 3] as const;

export const store = {
  slot: 1,
  profile: newProfile(),
  settings: defaultSettings(),
  slots: {} as Record<number, Profile | null>,

  async init() {
    try {
      if ('indexedDB' in window) kv = await idbKV();
    } catch {
      kv = localKV();
    }
    const s = await kv.get('settings');
    if (s) this.settings = { ...defaultSettings(), ...JSON.parse(s) };
    this.slot = Number(await kv.get('activeSlot')) || 1;
    for (const n of SLOTS) {
      const raw = await kv.get(`slot${n}`);
      this.slots[n] = raw ? migrate(JSON.parse(raw)) : null;
    }
    this.profile = this.slots[this.slot] ?? newProfile();
  },

  hasSave(n?: number) {
    return !!this.slots[n ?? this.slot];
  },

  async save() {
    this.profile.updatedAt = Date.now();
    this.slots[this.slot] = this.profile;
    await kv.set(`slot${this.slot}`, JSON.stringify(this.profile));
    await kv.set('activeSlot', String(this.slot));
  },

  async saveSettings() {
    await kv.set('settings', JSON.stringify(this.settings));
  },

  async selectSlot(n: number) {
    this.slot = n;
    this.profile = this.slots[n] ?? newProfile();
    await kv.set('activeSlot', String(n));
  },

  async newGame(n?: number) {
    this.slot = n ?? this.slot;
    this.profile = newProfile();
    await this.save();
  },

  async deleteSlot(n: number) {
    this.slots[n] = null;
    await kv.del(`slot${n}`);
    if (n === this.slot) this.profile = newProfile();
  },

  exportSlot(slot?: number) {
    const n = slot ?? this.slot;
    const p = this.slots[n] ?? this.profile;
    const blob = new Blob([JSON.stringify({ game: 'armor-tank', slot: n, profile: p }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `armor-tank-slot${n}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  async importSlot(n: number, file: File) {
    const data = JSON.parse(await file.text());
    if (data?.game !== 'armor-tank' || !data.profile) throw new Error(tr('ไฟล์ save ไม่ถูกต้อง', 'Invalid save file'));
    this.slots[n] = migrate(data.profile);
    await kv.set(`slot${n}`, JSON.stringify(this.slots[n]));
    if (n === this.slot) this.profile = this.slots[n]!;
  },
};
