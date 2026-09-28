import { tr } from '../i18n';
import type { Game, Mission } from '../game/game';
import { AMMO, PICKUPS, type AmmoId } from '../game/data';
import { store } from '../save/storage';
import { xpToNext } from '../game/progression';

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

export class Hud {
  readonly el: HTMLDivElement;
  private overlay: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private mini: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private staticMap: HTMLCanvasElement | null = null;
  private mapVersion = -1;
  private msgTimer = 0;
  private hintTimer = 0;
  /** Mission checklist rows by id; `retiring` rows are animating out and ignore further updates. */
  private missionRows = new Map<string, { el: HTMLDivElement; key: string; retiring: boolean }>();
  private missionsGone = new Set<string>();
  onPause = () => {};
  onAmmo = (_id: AmmoId) => {};
  private ammoKey = '';
  onMine = () => {};

  constructor(root: HTMLElement) {
    this.overlay = document.createElement('canvas');
    this.overlay.id = 'overlay';
    root.appendChild(this.overlay);
    this.octx = this.overlay.getContext('2d')!;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="hud-tl">
        <div class="hp"><div class="hp-fill"></div><span class="hp-text"></span></div>
        <div class="lvl"><b class="lvl-n"></b><div class="xp"><div class="xp-fill"></div></div></div>
        <canvas class="minimap" width="150" height="150"></canvas>
        <div class="missions"></div>
      </div>
      <div class="hud-tc">
        <div class="wave"></div>
        <div class="enemies"></div>
        <div class="objective hidden"></div>
        <div class="boss hidden"><span class="boss-name"></span><div class="boss-bar"><div class="boss-fill"></div></div></div>
      </div>
      <div class="hud-tr">
        <div class="credits"></div>
        <button class="pause-btn" aria-label="Pause">❚❚</button>
      </div>
      <div class="hud-ammo">
        <div class="ammo-btns"></div>
        <button class="mine-btn hidden"><b>MINE</b><small class="mine-count"></small></button>
        <div class="reload"><div class="reload-fill"></div></div>
      </div>
      <div class="buffs"></div>
      <div class="touch-hint hidden"><span>◀ ${tr('นิ้วซ้าย: ลากเพื่อขับ', 'Left thumb: drag to drive')}</span><span>${tr('นิ้วขวา: ลากไปทางเป้าเพื่อเล็งและยิง · แตะเพื่อยิงปืนใหญ่ใส่เป้าที่ใกล้ที่สุด', 'Right thumb: drag toward a target to aim and fire · tap to fire the cannon at the nearest enemy')} ▶</span></div>
      <div class="banner hidden"><div class="banner-title"></div><div class="banner-sub"></div></div>`;
    root.appendChild(this.el);
    this.mini = $(this.el, '.minimap');
    this.mctx = this.mini.getContext('2d')!;
    $(this.el, '.pause-btn').addEventListener('click', () => this.onPause());
    $(this.el, '.mine-btn').addEventListener('click', () => this.onMine());

    this.resize();
  }

  show(on: boolean) {
    this.el.classList.toggle('hidden', !on);
    this.overlay.classList.toggle('hidden', !on);
    this.mapVersion = -1;
    // A new mission starts with a fresh checklist
    $(this.el, '.missions').innerHTML = '';
    this.missionRows.clear();
    this.missionsGone.clear();
  }

  /** Sync the corner checklist: rows that drop out of the list are ticked off, failed goals are struck through, then both slide away. */
  private updateMissions(list: Mission[]) {
    const box = $(this.el, '.missions');
    const seen = new Set<string>();
    list.forEach((m, i) => {
      if (this.missionsGone.has(m.id)) return;
      seen.add(m.id);
      let row = this.missionRows.get(m.id);
      if (!row) {
        const el = document.createElement('div');
        el.className = `mission${m.star ? ' star' : ''}`;
        el.innerHTML = '<i></i><span></span>';
        // Keep list order: insert before the next listed row that is already on screen
        const next = list.slice(i + 1).map((n) => this.missionRows.get(n.id)?.el).find(Boolean);
        box.insertBefore(el, next ?? null);
        row = { el, key: '', retiring: false };
        this.missionRows.set(m.id, row);
      }
      if (row.retiring) return;
      const key = `${m.text}|${m.state ?? ''}`;
      if (key === row.key) return;
      row.key = key;
      $(row.el, 'i').textContent = m.state === 'failed' ? '✗' : m.state === 'done' ? '✓' : m.star ? '★' : '▸';
      $(row.el, 'span').textContent = m.text;
      row.el.classList.toggle('warn', m.state === 'warn');
      if (m.state === 'failed' || m.state === 'done') {
        row.el.classList.add(m.state);
        this.retireMission(m.id, m.state === 'failed' ? 2.5 : 1.4);
      }
    });
    for (const [id, row] of this.missionRows)
      if (!seen.has(id) && !row.retiring) {
        row.el.classList.remove('warn');
        row.el.classList.add('done');
        $(row.el, 'i').textContent = '✓';
        this.retireMission(id, 1.4);
      }
  }

  private retireMission(id: string, delay: number) {
    const row = this.missionRows.get(id);
    if (!row) return;
    row.retiring = true;
    this.missionsGone.add(id);
    setTimeout(() => {
      row.el.classList.add('out');
      setTimeout(() => {
        row.el.remove();
        if (this.missionRows.get(id) === row) this.missionRows.delete(id);
      }, 450);
    }, delay * 1000);
  }

  resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    this.overlay.width = innerWidth * dpr;
    this.overlay.height = innerHeight * dpr;
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Show the touch controls hint for a few seconds at the start of a mission. */
  touchHint() {
    this.hintTimer = 9;
    $(this.el, '.touch-hint').classList.remove('hidden');
  }

  message(title: string, sub = '') {
    const b = $(this.el, '.banner');
    $(b, '.banner-title').textContent = title;
    $(b, '.banner-sub').textContent = sub;
    b.classList.remove('hidden');
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    this.msgTimer = 3;
  }

  update(game: Game, dt: number) {
    const s = game.hud();
    const f = s.hp / s.maxHp;
    const fill = $(this.el, '.hp-fill');
    fill.style.width = `${f * 100}%`;
    fill.style.background = f > 0.5 ? '#6fbf4a' : f > 0.25 ? '#e0a32a' : '#e0452f';
    $(this.el, '.hp-text').textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
    const waveLabel = s.loops ? `WAVE ${s.wave}` : `WAVE ${s.wave} / ${s.waves}`;
    $(this.el, '.wave').textContent = s.phase === 'countdown' ? `WAVE ${s.wave} · ${tr('เริ่มใน', 'starts in')} ${Math.ceil(s.countdown)}` : waveLabel;
    if (s.phase !== 'victory' && s.phase !== 'defeat') this.updateMissions(game.missions());
    const boss = $(this.el, '.boss');
    boss.classList.toggle('hidden', !s.boss);
    if (s.boss) {
      $(boss, '.boss-name').textContent = s.boss.name;
      $(boss, '.boss-fill').style.width = `${Math.max(0, (s.boss.hp / s.boss.max) * 100)}%`;
    }
    $(this.el, '.enemies').textContent = s.phase === 'active' ? tr(`ศัตรูเหลือ ${s.enemies}`, `${s.enemies} enemies left`) : '';
    const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
    $(this.el, '.credits').innerHTML = `<span>⏱ ${m}:${String(sec).padStart(2, '0')}</span><span>☠ ${s.kills}</span><span class="cr">◆ ${s.credits}</span>`;
    // Ammo buttons (one per unlocked type)
    const key = s.ammoList.map((a) => a.id).join();
    const box = $(this.el, '.ammo-btns');
    if (key !== this.ammoKey) {
      this.ammoKey = key;
      box.innerHTML = s.ammoList
        .map((a, i) => `<button data-ammo="${a.id}" style="--c:${AMMO[a.id].color}"><b>${AMMO[a.id].label}</b><small data-left></small><i>${i + 1}</i></button>`)
        .join('');
      box.querySelectorAll<HTMLButtonElement>('[data-ammo]').forEach((b) => b.addEventListener('click', () => this.onAmmo(b.dataset.ammo as AmmoId)));
    }
    for (const a of s.ammoList) {
      const b = box.querySelector<HTMLButtonElement>(`[data-ammo="${a.id}"]`)!;
      b.classList.toggle('on', a.id === s.ammo);
      b.classList.toggle('empty', a.left !== null && a.left <= 0);
      b.querySelector('[data-left]')!.textContent = a.left === null ? '∞' : `${a.left}/${AMMO[a.id].capacity}`;
    }
    const p = store.profile;
    $(this.el, '.lvl-n').textContent = `Lv ${p.level}`;
    $(this.el, '.xp-fill').style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`;
    $(this.el, '.reload-fill').style.width = `${(1 - s.reload) * 100}%`;
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) $(this.el, '.touch-hint').classList.add('hidden');
    }
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) $(this.el, '.banner').classList.add('hidden');
    }
    this.drawBuffs(s.buffs);
    $(this.el, '.mine-btn').classList.toggle('hidden', s.mines <= 0);
    $(this.el, '.mine-count').textContent = `×${s.mines}`;
    game.drawOverlay(this.octx, innerWidth, innerHeight);
    this.drawMinimap(game);
  }

  private buffKey = '';
  private drawBuffs(buffs: ReturnType<Game['hud']>['buffs']) {
    const box = $(this.el, '.buffs');
    const key = buffs.map((b) => b.kind).join();
    if (key !== this.buffKey) {
      this.buffKey = key;
      box.innerHTML = buffs
        .map((b) => {
          const d = PICKUPS[b.kind];
          return `<div class="buff" data-b="${b.kind}" style="--c:${d.color}"><i>${d.icon}</i><span>${d.name}</span><div class="bt"><div></div></div></div>`;
        })
        .join('');
    }
    for (const b of buffs) {
      const el = box.querySelector<HTMLElement>(`[data-b=${b.kind}] .bt div`);
      if (el) el.style.width = `${(b.t / b.max) * 100}%`;
      box.querySelector(`[data-b=${b.kind}]`)?.classList.toggle('ending', b.t < 3);
    }
  }

  private drawMinimap(game: Game) {
    const mm = game.minimap();
    const W = this.mini.width;
    const E = mm.extent + 8;
    const sc = W / (E * 2);
    const X = (x: number) => (x + E) * sc;
    if (game.mapVersion !== this.mapVersion || !this.staticMap) {
      this.mapVersion = game.mapVersion;
      const c = (this.staticMap ??= document.createElement('canvas'));
      c.width = c.height = W;
      const g = c.getContext('2d')!;
      g.fillStyle = '#3f4a37';
      g.fillRect(0, 0, W, W);
      g.fillStyle = '#56585a';
      g.fillRect(X(-mm.extent), X(-mm.extent), mm.extent * 2 * sc, mm.extent * 2 * sc);
      g.fillStyle = '#4a5a40';
      for (const b of mm.buildings) {
        // lots: draw blocks lighter by building footprint instead
        const bx = b.box;
        g.fillStyle = b.alive ? (b.left < b.info.sections.length ? '#8d8272' : '#b3ada2') : '#5e5446';
        g.fillRect(X(bx.min.x), X(bx.min.z), (bx.max.x - bx.min.x) * sc, (bx.max.z - bx.min.z) * sc);
      }
    }
    const g = this.mctx;
    g.drawImage(this.staticMap!, 0, 0);
    if (mm.jammed) {
      // Radar jammed: static noise, only the player marker survives
      const img = g.getImageData(0, 0, W, W);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = Math.random() * 120;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      }
      g.putImageData(img, 0, 0);
      g.fillStyle = '#ff5a4a';
      g.font = 'bold 12px system-ui';
      g.textAlign = 'center';
      g.fillText('JAMMED', W / 2, W / 2 - 14);
    }
    g.fillStyle = '#5fe07a';
    for (const a of mm.allies) g.fillRect(X(a.pos.x) - 3.5, X(a.pos.z) - 3.5, 7, 7);
    g.fillStyle = '#ffd23a';
    for (const l of mm.loot) g.fillRect(X(l.x) - 2, X(l.z) - 2, 4, 4);
    for (const k of mm.pickups) {
      g.fillStyle = PICKUPS[k.kind].color;
      g.fillRect(X(k.obj.position.x) - 2.5, X(k.obj.position.z) - 2.5, 5, 5);
    }
    for (const e of mm.jammed ? [] : mm.enemies) {
      g.fillStyle = e.state === 'engage' ? '#ff4433' : e.state === 'patrol' ? 'rgba(255,90,70,0.5)' : '#ffb03a';
      g.beginPath();
      g.arc(X(e.pos.x), X(e.pos.z), 2.6, 0, Math.PI * 2);
      g.fill();
    }
    const p = mm.player;
    g.save();
    g.translate(X(p.pos.x), X(p.pos.z));
    g.rotate(-p.yaw + Math.PI);
    g.fillStyle = '#ffe680';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
}
