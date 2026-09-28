import { lang, setLang, tr } from '../i18n';
import { AMMO, LEVELS, type AmmoId } from '../game/data';
import { CHAPTERS, SPEAKERS, STORY, difficultyStars, type Line } from '../game/story';
import { AMMO_PRICE, ARMOR_KITS, DEFAULT_AMMO, SKILLS, STATS, statCost, xpToNext, type ArmorKitId, type SkillId, type StatId } from '../game/progression';
import type { LevelResult } from '../game/game';
import { VEHICLES } from '../assets/vehicles';
import { SLOTS, store, type Quality } from '../save/storage';
import { sfx } from '../game/audio';

export interface MenuActions {
  continueGame(): void;
  newGame(): void;
  playLevel(id: number): void;
  resume(): void;
  restartWave(): void;
  saveAndQuit(): void;
  toMenu(): void;
  garage(on: boolean): void;
  previewArmor(kit: string): void;
  showVehicle(id: string): void;
  settingsChanged(): void;
}

type GarageTab = 'tank' | 'ammo' | 'armor' | 'skills' | 'vehicles';

const MODE = () => ({ survival: tr('เอาตัวรอด', 'Survival'), defend: tr('ป้องกัน', 'Defend'), destroy: tr('ทำลายเป้าหมาย', 'Destroy'), escort: tr('คุ้มกัน', 'Escort'), boss: tr('บอส', 'Boss') });

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmtDate = (ms: number) => new Date(ms).toLocaleString(lang === 'en' ? 'en-GB' : 'th-TH', { dateStyle: 'short', timeStyle: 'short' });

export class Menus {
  private root: HTMLDivElement;
  private stack: string[] = [];

  constructor(parent: HTMLElement, private act: MenuActions) {
    this.root = document.createElement('div');
    this.root.id = 'screens';
    parent.appendChild(this.root);
  }

  private render(html: string, cls = '') {
    this.root.className = cls;
    this.root.innerHTML = html;
    this.root.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => sfx.ui()));
  }

  private on(sel: string, fn: (el: HTMLElement) => void) {
    this.root.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
  }

  hide() {
    this.root.className = 'hidden';
    this.root.innerHTML = '';
  }

  // ───────────── Main menu ─────────────

  main() {
    this.stack = ['main'];
    const p = store.profile;
    const cp = p.checkpoint;
    const has = store.hasSave();
    const lvl = cp ? LEVELS.find((l) => l.id === cp.level) : null;
    this.render(
      `<div class="panel main-menu">
        <h1>ARMOR<span>TANK</span></h1>
        <div class="tagline">${tr('สมรภูมิเมือง · รถถังปะทะทุกทิศทาง', 'Urban warfare · tank battles from every direction')}</div>
        <div class="menu-buttons">
          ${has ? `<button class="primary" data-a="continue">▶ ${tr('เล่นต่อ', 'Continue')}<small>${cp && lvl ? `${tr('ด่าน', 'Level')} ${lvl.id} ${lvl.nameTh} · Wave ${cp.wave + 1}` : tr(`ปลดล็อกถึงด่าน ${p.unlocked}`, `Unlocked up to level ${p.unlocked}`)}</small></button>` : ''}
          <button class="${has ? '' : 'primary'}" data-a="new">✚ ${tr('เริ่มเกมใหม่', 'New game')}<small>Slot ${store.slot}</small></button>
          <button data-a="levels">◎ ${tr('เลือกด่าน', 'Select level')}</button>
          <button data-a="garage">⚙ ${tr('โรงรถ · อัปเกรด', 'Garage · Upgrades')}<small>${tr('อาวุธ เกราะ สกิล', 'Weapons, armour, skills')}${p.skillPoints ? ` · ${tr('มีแต้มสกิล', 'skill points:')} ${p.skillPoints}` : ''}</small></button>
          <button data-a="settings">☰ ${tr('ตั้งค่า', 'Settings')}</button>
          <button data-a="slots">💾 ${tr('ช่องบันทึก', 'Save slots')}</button>
          <button data-a="credits">ⓘ ${tr('เครดิต', 'Credits')}</button>
        </div>
        <div class="profile-line">Slot ${store.slot} · Lv ${p.level} · ◆ ${p.credits.toLocaleString()} · ☠ ${p.totalKills}${p.skillPoints ? ` · <b class="sp">${tr('แต้มสกิล', 'Skill points')} ${p.skillPoints}</b>` : ''}</div>
      </div>`,
      'menu',
    );
    this.on('[data-a=continue]', () => this.act.continueGame());
    this.on('[data-a=new]', () => {
      if (has && !confirm(tr(`เริ่มใหม่จะลบความคืบหน้าใน Slot ${store.slot} ต่อเลยไหม?`, `Starting over erases the progress in Slot ${store.slot}. Continue?`))) return;
      this.act.newGame();
    });
    this.on('[data-a=levels]', () => this.levels());
    this.on('[data-a=garage]', () => this.garage());
    this.on('[data-a=settings]', () => this.settings(() => this.main()));
    this.on('[data-a=slots]', () => this.slots());
    this.on('[data-a=credits]', () => this.credits());
  }

  // ───────────── Level select ─────────────

  levels() {
    const p = store.profile;
    const card = (l: (typeof LEVELS)[number]) => {
      const locked = l.id > p.unlocked;
      const st = p.stars[l.id] ?? [];
      const stars = [1, 2, 3].map((i) => `<i class="${st[i] ? 'on' : ''}">★</i>`).join('');
      const tag = locked ? `<em>🔒 ${tr('ล็อก', 'Locked')}</em>` : st[0] ? `<span class="stars">${stars}</span>` : `<em>${tr('ใหม่!', 'New!')}</em>`;
      const mode = MODE()[l.mode];
      const extra = [l.weather === 'sandstorm' ? tr('🌪 พายุทราย', '🌪 sandstorm') : l.weather === 'blizzard' ? tr('❄ พายุหิมะ', '❄ blizzard') : l.weather === 'snow' ? tr('❄ หิมะ', '❄ snow') : '', l.ice ? tr('ถนนลื่น', 'icy roads') : ''].filter(Boolean).join(' · ');
      return `<button class="level ${locked ? 'locked' : ''} ${l.mode === 'boss' ? 'bosslvl' : ''} theme-${l.theme ?? 'city'}" data-id="${l.id}" ${locked ? 'disabled' : ''}>
        <span class="num">${l.id}</span><b>${l.nameTh}</b><small>${lang === 'th' ? `${l.name} · ` : ''}${mode}${extra ? ` · ${extra}` : ''}</small>${tag}</button>`;
    };
    const chapters = [...new Set(LEVELS.map((l) => l.chapter))];
    const sections = chapters
      .map((c, i) => {
        const ls = LEVELS.filter((l) => l.chapter === c);
        const done = ls.filter((l) => p.stars[l.id]?.[0]).length;
        return `<div class="chapter">${CHAPTERS[c]?.title ?? c} <span>${done}/${ls.length}</span></div><div class="level-grid">${ls.map(card).join('')}</div>`;
      })
      .join('');
    this.render(
      `<div class="panel wide">
        <h2>${tr('เลือกด่าน', 'Select level')}</h2>
        <div class="level-scroll">${sections}</div>
        <div class="row"><button data-a="back">← ${tr('กลับ', 'Back')}</button></div>
      </div>`,
      'menu',
    );
    // Scroll to the newest unlocked level
    this.root.querySelector(`.level[data-id="${Math.min(p.unlocked, LEVELS.length)}"]`)?.scrollIntoView({ block: 'center' });
    this.on('.level', (el) => this.briefing(Number(el.dataset.id), () => this.levels()));
    this.on('[data-a=back]', () => this.main());
  }

  // ───────────── Garage ─────────────

  garage(tab: GarageTab = 'tank') {
    this.act.garage(true);
    const p = store.profile;
    if (tab !== 'vehicles') {
      this.act.showVehicle('striker');
      this.act.previewArmor(p.armor.equipped);
    }
    const pips = (n: number, max: number) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    const tabs: [GarageTab, string][] = [['tank', tr('รถถัง', 'Tank')], ['ammo', tr('กระสุน', 'Ammo')], ['armor', tr('เกราะ', 'Armour')], ['skills', `${tr('สกิล', 'Skills')}${p.skillPoints ? ` (${p.skillPoints})` : ''}`], ['vehicles', tr('คลังรถ', 'Vehicles')]];
    let body = '';
    if (tab === 'tank') {
      body = (Object.keys(STATS) as StatId[])
        .map((id) => {
          const d = STATS[id];
          const lv = p.upgrades[id] ?? 0;
          const max = lv >= d.max;
          const cost = statCost(id, lv);
          const now = Math.round(d.per * lv * 100), next = Math.round(d.per * (lv + 1) * 100);
          return `<div class="card"><div class="card-h"><b>${d.icon} ${d.name}</b>${pips(lv, d.max)}</div>
            <small>${d.unit}: ${id === 'defense' || id === 'reload' ? '−' : '+'}${now}%${max ? tr(' (สูงสุด)', ' (max)') : ` → ${next}%`}</small>
            <button data-stat="${id}" ${max || p.credits < cost ? 'disabled' : ''}>${max ? tr('เต็มแล้ว', 'Maxed') : `${tr('อัปเกรด', 'Upgrade')} ◆${cost.toLocaleString()}`}</button></div>`;
        })
        .join('');
    } else if (tab === 'ammo') {
      body = (Object.keys(AMMO) as AmmoId[])
        .map((id) => {
          const a = AMMO[id];
          const owned = DEFAULT_AMMO.includes(id) || p.ammo.includes(id);
          const price = AMMO_PRICE[id];
          return `<div class="card" style="--c:${a.color}"><div class="card-h"><b style="color:${a.color}">${a.label}</b><span>${a.name}</span></div>
            <small>${a.desc}</small>
            <small class="stats">${tr('ดาเมจ', 'Damage')} ${a.damage} · ${tr('รัศมี', 'Radius')} ${a.splash} m · ${tr('บรรจุ', 'Reload')} ${a.reload} s · ${a.capacity === Infinity ? tr('ไม่จำกัด', 'unlimited') : tr(`${a.capacity} นัด/ด่าน`, `${a.capacity} per level`)}</small>
            <button data-ammo-buy="${id}" ${owned || p.credits < price ? 'disabled' : ''}>${owned ? tr('✓ มีแล้ว', '✓ Owned') : `${tr('ปลดล็อก', 'Unlock')} ◆${price.toLocaleString()}`}</button></div>`;
        })
        .join('');
    } else if (tab === 'armor') {
      body = (Object.keys(ARMOR_KITS) as ArmorKitId[])
        .map((id) => {
          const k = ARMOR_KITS[id];
          const owned = p.armor.owned.includes(id);
          const on = p.armor.equipped === id;
          const btn = on
            ? `<button disabled>${tr('✓ ติดตั้งอยู่', '✓ Equipped')}</button>`
            : owned
              ? `<button data-armor-equip="${id}">${tr('ติดตั้ง', 'Equip')}</button>`
              : `<button data-armor-buy="${id}" ${p.credits < k.price ? 'disabled' : ''}>${tr('ซื้อ', 'Buy')} ◆${k.price.toLocaleString()}</button>`;
          return `<div class="card ${on ? 'equipped' : ''}" data-preview="${id}"><div class="card-h"><b>${k.name}</b></div><small>${k.desc}</small>${btn}</div>`;
        })
        .join('');
    } else if (tab === 'skills') {
      body =
        `<div class="skill-head">${tr('แต้มสกิล', 'Skill points')} <b>${p.skillPoints}</b> · ${tr('ได้ 1 แต้มทุกครั้งที่เลเวลอัป', '1 point per level-up')} <button data-skill-reset ${Object.values(p.skills).some(Boolean) ? '' : 'disabled'}>${tr('รีเซ็ตสกิล', 'Reset skills')}</button></div>` +
        (Object.keys(SKILLS) as SkillId[])
          .map((id) => {
            const d = SKILLS[id];
            const r = p.skills[id] ?? 0;
            const max = r >= d.max;
            return `<div class="card"><div class="card-h"><b>${d.icon} ${d.name}</b>${pips(r, d.max)}</div>
              <small>${r ? d.desc(r) : tr('ยังไม่ได้เรียน', 'Not learned')}${max ? '' : `<br>${tr('ถัดไป', 'Next')}: ${d.desc(r + 1)}`}</small>
              <button data-skill="${id}" ${max || p.skillPoints < 1 ? 'disabled' : ''}>${max ? tr('เต็มแล้ว', 'Maxed') : tr('+1 (ใช้ 1 แต้ม)', '+1 (1 point)')}</button></div>`;
          })
          .join('');
    } else {
      body = VEHICLES.map((v) => `<button class="veh" data-v="${v.id}"><span class="${v.faction}">●</span> ${v.name}<small>${v.role}</small></button>`).join('');
    }
    this.render(
      `<div class="panel garage">
        <div class="garage-top">
          <h2>${tr('โรงรถ', 'Garage')}</h2>
          <div class="wallet"><span>◆ ${p.credits.toLocaleString()}</span><span>Lv ${p.level}</span><div class="xp"><div class="xp-fill" style="width:${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%"></div></div><small>${p.xp}/${xpToNext(p.level)} EXP</small></div>
        </div>
        <div class="tabs">${tabs.map(([id, label]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${label}</button>`).join('')}</div>
        <div class="garage-body ${tab === 'vehicles' ? 'vehicle-list' : ''}">${body}</div>
        <div class="row"><button data-a="back">← ${tr('กลับ', 'Back')}</button></div>
      </div>`,
      'menu garage-mode',
    );
    const save = async () => {
      await store.save();
      this.garage(tab);
    };
    this.on('[data-tab]', (el) => this.garage(el.dataset.tab as GarageTab));
    this.on('[data-stat]', (el) => {
      const id = el.dataset.stat as StatId;
      const lv = p.upgrades[id] ?? 0;
      const cost = statCost(id, lv);
      if (p.credits < cost || lv >= STATS[id].max) return;
      p.credits -= cost;
      p.upgrades[id] = lv + 1;
      void save();
    });
    this.on('[data-ammo-buy]', (el) => {
      const id = el.dataset.ammoBuy as AmmoId;
      if (p.credits < AMMO_PRICE[id] || p.ammo.includes(id)) return;
      p.credits -= AMMO_PRICE[id];
      p.ammo.push(id);
      void save();
    });
    this.on('[data-armor-buy]', (el) => {
      const id = el.dataset.armorBuy as ArmorKitId;
      if (p.credits < ARMOR_KITS[id].price) return;
      p.credits -= ARMOR_KITS[id].price;
      p.armor.owned.push(id);
      p.armor.equipped = id;
      void save();
    });
    this.on('[data-armor-equip]', (el) => {
      p.armor.equipped = el.dataset.armorEquip as ArmorKitId;
      void save();
    });
    this.root.querySelectorAll<HTMLElement>('[data-preview]').forEach((el) => {
      el.addEventListener('pointerenter', () => this.act.previewArmor(el.dataset.preview!));
      el.addEventListener('pointerleave', () => this.act.previewArmor(p.armor.equipped));
    });
    this.on('[data-skill]', (el) => {
      const id = el.dataset.skill as SkillId;
      if (p.skillPoints < 1 || (p.skills[id] ?? 0) >= SKILLS[id].max) return;
      p.skillPoints--;
      p.skills[id] = (p.skills[id] ?? 0) + 1;
      void save();
    });
    this.on('[data-skill-reset]', () => {
      if (!confirm(tr('คืนแต้มสกิลทั้งหมดเพื่อจัดใหม่?', 'Refund all skill points to respec?'))) return;
      p.skillPoints += Object.values(p.skills).reduce((a, b) => a + b, 0);
      p.skills = {};
      void save();
    });
    this.on('[data-v]', (el) => {
      this.act.showVehicle(el.dataset.v!);
      this.root.querySelectorAll<HTMLElement>('[data-v]').forEach((b) => b.classList.toggle('on', b === el));
    });
    if (tab === 'vehicles') this.act.showVehicle('striker');
    this.on('[data-a=back]', () => {
      this.act.garage(false);
      this.act.showVehicle('striker');
      this.act.previewArmor(p.armor.equipped);
      this.main();
    });
  }

  // ───────────── Settings ─────────────

  settings(back: () => void) {
    const s = store.settings;
    const q = (v: Quality, label: string) => `<option value="${v}" ${s.quality === v ? 'selected' : ''}>${label}</option>`;
    this.render(
      `<div class="panel">
        <h2>${tr('ตั้งค่า', 'Settings')}</h2>
        <label class="field">${tr('ภาษา', 'Language')} <select data-lang><option value="th" ${lang === 'th' ? 'selected' : ''}>ไทย</option><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option></select></label>
        <label class="field">${tr('เสียงเอฟเฟกต์', 'Sound effects')} <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"></label>
        <label class="field">${tr('คุณภาพกราฟิก', 'Graphics quality')}
          <select data-k="quality">${q('auto', tr('อัตโนมัติ', 'Auto'))}${q('low', tr('ต่ำ (ประหยัดแบต)', 'Low (battery saver)'))}${q('medium', tr('กลาง', 'Medium'))}${q('high', tr('สูง (AO + เงาละเอียด)', 'High (AO + sharp shadows)'))}</select></label>
        <label class="field check"><input type="checkbox" data-k="shake" ${s.shake ? 'checked' : ''}> ${tr('สั่นกล้องเมื่อระเบิด', 'Camera shake on explosions')}</label>
        <label class="field check"><input type="checkbox" data-k="damageNumbers" ${s.damageNumbers ? 'checked' : ''}> ${tr('แสดงตัวเลขดาเมจ', 'Show damage numbers')}</label>
        <label class="field check"><input type="checkbox" data-k="autoAim" ${s.autoAim ? 'checked' : ''}> ${tr('ช่วยเล็งอัตโนมัติ (มือถือ)', 'Aim assist (touch)')}</label>
        <div class="controls-help">
          ${tr('<b>คอม:</b> WASD ขับ · เมาส์เล็ง · คลิกซ้ายยิงปืนใหญ่ · คลิกขวา/Space ปืนกล · Q/1–6 เปลี่ยนกระสุน · F วางทุ่นระเบิด · ล้อเมาส์ซูม · Esc หยุด', '<b>PC:</b> WASD drive · mouse aim · left click cannon · right click/Space MG · Q/1–6 switch ammo · F drop mine · wheel zoom · Esc pause')}<br>
          ${tr('<b>มือถือ:</b> นิ้วซ้ายลาก = ขับ · นิ้วขวาลากไปทางเป้า = เล็งและยิง · แตะด้านขวา = ยิงปืนใหญ่ใส่เป้าใกล้สุด', '<b>Touch:</b> left thumb drag = drive · right thumb drag toward a target = aim and fire · tap the right side = fire the cannon at the nearest enemy')}
        </div>
        <div class="row"><button data-a="back">← ${tr('กลับ', 'Back')}</button></div>
      </div>`,
      'menu',
    );
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) =>
      el.addEventListener('input', () => {
        const k = el.dataset.k as keyof typeof s;
        const v = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el instanceof HTMLInputElement && el.type === 'range' ? Number(el.value) : el.value;
        (s as unknown as Record<string, unknown>)[k] = v;
        void store.saveSettings();
        this.act.settingsChanged();
      }),
    );
    this.root.querySelector<HTMLSelectElement>('[data-lang]')?.addEventListener('change', (e) => setLang((e.target as HTMLSelectElement).value as 'th' | 'en'));
    this.on('[data-a=back]', back);
  }

  // ───────────── Save slots ─────────────

  slots() {
    const cards = SLOTS.map((n) => {
      const p = store.slots[n];
      const active = n === store.slot;
      const body = p
        ? `<b>Slot ${n}</b><small>${tr('ด่านที่ปลดล็อก', 'Unlocked level')} ${p.unlocked} · Lv ${p.level} · ◆ ${p.credits} · ☠ ${p.totalKills}</small><small>${p.checkpoint ? tr(`ค้างอยู่: ด่าน ${p.checkpoint.level} Wave ${p.checkpoint.wave + 1}`, `In progress: level ${p.checkpoint.level} wave ${p.checkpoint.wave + 1}`) : tr('ไม่มีเกมค้าง', 'No game in progress')}</small><small>${tr('บันทึกล่าสุด', 'Last saved')} ${fmtDate(p.updatedAt)}</small>`
        : `<b>Slot ${n}</b><small>${tr('ว่าง', 'Empty')}</small>`;
      return `<div class="slot ${active ? 'on' : ''}">${body}
        <div class="slot-actions">
          <button data-s="${n}" data-op="use">${active ? tr('✓ ใช้อยู่', '✓ Active') : tr('ใช้ช่องนี้', 'Use this slot')}</button>
          ${p ? `<button data-s="${n}" data-op="export">Export</button>` : ''}
          <button data-s="${n}" data-op="import">Import</button>
          ${p ? `<button data-s="${n}" data-op="delete" class="danger">${tr('ลบ', 'Delete')}</button>` : ''}
        </div></div>`;
    }).join('');
    this.render(
      `<div class="panel wide">
        <h2>${tr('ช่องบันทึก', 'Save slots')}</h2>
        <div class="garage-note">${tr('เกมบันทึกอัตโนมัติทุกครั้งที่จบ wave / จบด่าน · Export เพื่อสำรองหรือย้ายเครื่อง', 'The game saves automatically after every wave and level · Export to back up or move devices')}</div>
        <div class="slot-grid">${cards}</div>
        <input type="file" accept="application/json,.json" class="hidden" id="import-file">
        <div class="row"><button data-a="back">← ${tr('กลับ', 'Back')}</button></div>
      </div>`,
      'menu',
    );
    const file = this.root.querySelector<HTMLInputElement>('#import-file')!;
    let importSlot = 1;
    file.addEventListener('change', async () => {
      if (!file.files?.[0]) return;
      try {
        await store.importSlot(importSlot, file.files[0]);
        this.slots();
      } catch (e) {
        alert((e as Error).message);
      }
    });
    this.on('[data-op]', async (el) => {
      const n = Number(el.dataset.s);
      switch (el.dataset.op) {
        case 'use':
          await store.selectSlot(n);
          this.slots();
          break;
        case 'export':
          store.exportSlot(n);
          break;
        case 'import':
          importSlot = n;
          file.click();
          break;
        case 'delete':
          if (confirm(tr(`ลบ Slot ${n} ถาวร?`, `Permanently delete Slot ${n}?`))) {
            await store.deleteSlot(n);
            this.slots();
          }
          break;
      }
    });
    this.on('[data-a=back]', () => this.main());
  }

  credits() {
    this.render(
      `<div class="panel">
        <h2>${tr('เครดิต', 'Credits')}</h2>
        <p>Armor Tank</p>
        <p>${tr('โมเดลรถ อาคาร และเอฟเฟกต์ทั้งหมดสร้างด้วยโค้ด (procedural) · Three.js (MIT)', 'All vehicles, buildings and effects are generated in code (procedural) · Three.js (MIT)')}</p>
        <p>${tr('Texture ภาพถ่าย', 'Photo textures')}: <b>Poly Haven</b> (CC0) — Rob Tuytel, Charlotte Baglioni, Amal Kumar, Jenelle van Heerden, Sergej Majboroda, Dimitrios Savva, eye-candy.xyz (${tr('รายละเอียดใน CREDITS.md', 'see CREDITS.md')})</p>
        <div class="row"><button data-a="back">← ${tr('กลับ', 'Back')}</button></div>
      </div>`,
      'menu',
    );
    this.on('[data-a=back]', () => this.main());
  }

  // ───────────── In-game ─────────────

  loading(text: string, pct?: number) {
    this.render(`<div class="loading-box"><div class="loading-title">${text}</div><div class="bar"><div style="width:${(pct ?? 0) * 100}%"></div></div></div>`, 'loading');
  }

  pause(hasCheckpoint: boolean) {
    this.render(
      `<div class="panel pause">
        <h2>${tr('หยุดเกม', 'Paused')}</h2>
        <div class="menu-buttons">
          <button class="primary" data-a="resume">▶ ${tr('เล่นต่อ', 'Resume')}</button>
          ${hasCheckpoint ? `<button data-a="restart">↺ ${tr('เริ่ม wave นี้ใหม่', 'Restart this wave')}</button>` : ''}
          <button data-a="settings">☰ ${tr('ตั้งค่า', 'Settings')}</button>
          <button data-a="quit">💾 ${tr('บันทึกและออกไปเมนู', 'Save & quit to menu')}<small>${tr('กลับมาเล่นต่อที่ต้น wave ปัจจุบัน', 'Resume later from the start of this wave')}</small></button>
        </div>
      </div>`,
      'menu dim',
    );
    this.on('[data-a=resume]', () => this.act.resume());
    this.on('[data-a=restart]', () => this.act.restartWave());
    this.on('[data-a=settings]', () => this.settings(() => this.pause(hasCheckpoint)));
    this.on('[data-a=quit]', () => this.act.saveAndQuit());
  }

  // ───────────── Story ─────────────

  private dialog(lines: Line[]) {
    return `<div class="dialog">${lines
      .map(([who, text], i) => {
        const s = SPEAKERS[who];
        return `<div class="line" style="--c:${s.color};animation-delay:${i * 0.35}s"><div class="who"><i>${s.icon}</i><b>${s.name}</b><small>${s.role}</small></div><p>${text}</p></div>`;
      })
      .join('')}</div>`;
  }

  /** Mission briefing: chapter intro (first level of a chapter), level card and radio dialogue. */
  briefing(levelId: number, back: () => void) {
    const l = LEVELS.find((x) => x.id === levelId)!;
    const story = STORY[levelId];
    const firstOfChapter = LEVELS.find((x) => x.chapter === l.chapter)!.id === levelId;
    const ch = CHAPTERS[l.chapter];
    const mode = MODE()[l.mode];
    const skulls = difficultyStars(l.diff);
    this.render(
      `<div class="panel wide briefing theme-${l.theme ?? 'city'}">
        ${firstOfChapter && ch ? `<div class="chapter-card"><small>${ch.place}</small><h3>${ch.title}</h3><p>${ch.intro}</p></div>` : ''}
        <div class="brief-head">
          <div><small>${ch?.title ?? l.chapter} · ${tr('ด่าน', 'Level')} ${l.id}</small><h2>${l.nameTh}${lang === 'th' ? ` <span>${l.name}</span>` : ''}</h2></div>
          <div class="brief-tags"><span class="tag-mode">${mode}</span><span class="skulls" title="${tr('ความยาก', 'Difficulty')}">${'☠'.repeat(skulls)}<em>${'☠'.repeat(5 - skulls)}</em></span></div>
        </div>
        <div class="brief-obj"><b>${tr('ภารกิจ', 'Objective')}:</b> ${l.brief}</div>
        ${story ? this.dialog(story.intro) : ''}
        <div class="row"><button data-a="back">← ${tr('กลับ', 'Back')}</button><button class="primary" data-a="go">▶ ${tr('เริ่มภารกิจ', 'Start mission')}</button></div>
      </div>`,
      'menu dim',
    );
    this.on('[data-a=go]', () => this.act.playLevel(levelId));
    this.on('[data-a=back]', back);
  }

  /** Campaign ending after the final boss. */
  ending() {
    this.render(
      `<div class="panel wide briefing ending">
        <div class="chapter-card"><small>${tr('ปี 2035 · หลังสงคราม', '2035 · After the war')}</small><h3>${tr('จบภารกิจ — หมาป่าเหล็กกลับบ้าน', 'Mission complete — the Iron Wolves come home')}</h3>
        <p>${tr('RedCore ล่มสลาย แกน AI TITAN ถูกทำลาย และนายพลวอสส์ถูกนำตัวขึ้นศาล เมืองอัลเดน ทะเลทรายคาร์ซ ท่าเรือซาริส และนอร์ดฮาฟน์ เริ่มฟื้นฟู — เพราะรถถังคันเดียวที่ไม่ยอมถอย', 'RedCore has collapsed, the TITAN AI core is destroyed and General Voss faces trial. Alden, the Karz desert, Port Saris and Nordhavn begin to rebuild — all because of one tank that never retreated.')}</p>
        <p>${tr('ขอบคุณที่เล่น <b>Armor Tank</b> — ลองกลับไปเก็บดาวให้ครบทุกด่าน หรืออัปเกรดรถให้สุดในโรงรถ', 'Thanks for playing <b>Armor Tank</b> — go back for every star, or max out your tank in the Garage.')}</p></div>
        <div class="row"><button class="primary" data-a="menu">☰ ${tr('เมนูหลัก', 'Main menu')}</button></div>
      </div>`,
      'menu dim',
    );
    this.on('[data-a=menu]', () => this.act.toMenu());
  }

  result(r: LevelResult, levelId: number, checkpointWave?: number) {
    const lvl = LEVELS.find((l) => l.id === levelId)!;
    const obj = [
      [tr('ผ่านด่าน', 'Level cleared'), r.stars[0]],
      [tr(`HP เหลือ ≥ ${lvl.stars.minHpPct}% (${Math.round(r.hpPct)}%)`, `HP left ≥ ${lvl.stars.minHpPct}% (${Math.round(r.hpPct)}%)`), r.stars[1]],
      [tr(`ทำลายสิ่งปลูกสร้าง ≥ ${lvl.stars.buildings} (${r.razed})`, `Destroy ≥ ${lvl.stars.buildings} structures (${r.razed})`), r.stars[2]],
      [tr(`จบภายใน ${fmtTime(lvl.stars.timeLimit)} (${fmtTime(r.time)})`, `Finish within ${fmtTime(lvl.stars.timeLimit)} (${fmtTime(r.time)})`), r.stars[3]],
    ] as const;
    const next = LEVELS.find((l) => l.id === levelId + 1);
    this.render(
      `<div class="panel result ${r.victory ? 'win' : 'lose'}">
        <h2>${r.victory ? tr('ภารกิจสำเร็จ', 'Mission accomplished') : tr('ภารกิจล้มเหลว', 'Mission failed')}</h2>
        <div class="big-stars">${[1, 2, 3].map((i) => `<i class="${r.stars[i] ? 'on' : ''}">★</i>`).join('')}</div>
        <ul class="objectives">${obj.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✔' : '✘'} ${t}</li>`).join('')}</ul>
        <div class="stats"><span>☠ ${tr('ทำลายศัตรู', 'Kills')} ${r.kills}</span><span>◆ +${r.credits} ${tr('เครดิต', 'credits')}</span></div>
        ${r.victory && STORY[levelId] ? this.dialog(STORY[levelId].outro) : ''}
        <div class="menu-buttons">
          ${r.victory && next ? `<button class="primary" data-a="next">${tr('ด่านถัดไป', 'Next level')} ▶<small>${next.nameTh}</small></button>` : ''}
          ${r.victory && !next ? `<button class="primary" data-a="ending">★ ${tr('ดูตอนจบ', 'Watch the ending')}</button>` : ''}
          ${!r.victory && checkpointWave !== undefined ? `<button class="primary" data-a="cp">↺ ${tr('ลองใหม่จาก Wave', 'Retry from wave')} ${checkpointWave + 1}</button>` : ''}
          <button data-a="retry">↺ ${tr('เริ่มด่านนี้ใหม่ทั้งหมด', 'Restart the level')}</button>
          <button data-a="menu">☰ ${tr('เมนูหลัก', 'Main menu')}</button>
        </div>
      </div>`,
      'menu dim',
    );
    this.on('[data-a=next]', () => next && this.briefing(next.id, () => this.act.toMenu()));
    this.on('[data-a=ending]', () => this.ending());
    this.on('[data-a=retry]', () => this.act.playLevel(levelId));
    this.on('[data-a=cp]', () => this.act.restartWave());
    this.on('[data-a=menu]', () => this.act.toMenu());
  }
}
