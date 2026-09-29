// Electron side of scripts/store-capture.mjs – see that file for usage.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const URL = process.env.CAPTURE_URL;
const ONLY = process.argv.slice(2);
const OUT = path.join(__dirname, '..', 'store');

/** Store sizes in device pixels; `zoom` = device pixel ratio, so the HUD is laid out like on the device. */
const SIZES = {
  play: { w: 1920, h: 1080, zoom: 1.5 }, // Google Play phone screenshots (16:9)
  'iphone-6.9': { w: 2868, h: 1320, zoom: 3 }, // App Store iPhone 6.9" (landscape)
  'ipad-13': { w: 2752, h: 2064, zoom: 2 }, // App Store iPad 13" (landscape)
};
const LANGS = ['en', 'th'];

/**
 * Gameplay scenes (no helicopters or MLRS outside the boss scene: the helicopter shows a boss bar
 * and rocket target rings would cover the player's tank): level to load and the enemies to place in view. The player is invulnerable,
 * fires at the nearest enemy and a building nearby is brought down so the shot has some action.
 */
const SCENES = [
  { id: '01-city', level: 6, enemies: ['medium', 'apc', 'light', 'kamikaze', 'infantry', 'infantry'], wreck: 1, collapse: true },
  { id: '02-boss', level: 10, enemies: ['behemoth', 'kamikaze', 'kamikaze'], wait: 900 },
  { id: '03-desert', level: 13, enemies: ['medium', 'heavy', 'buggy', 'rpg', 'infantry'], wreck: 1 },
  { id: '04-port', level: 16, spot: 'harbour', enemies: ['heavy', 'ugv', 'apc', 'light'], wreck: 1, collapse: true },
  { id: '05-winter', level: 21, enemies: ['heavy', 'medium', 'ugv', 'kamikaze'], wreck: 1 },
  { id: '06-garage', menu: 'garage' },
  { id: '07-story', menu: 'briefing', level: 11 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(run).catch((e) => {
  console.error(e);
  app.exit(1);
});

async function run() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, partition: 'store-capture' },
  });
  win.webContents.setAudioMuted(true);
  win.webContents.setFrameRate(30);
  let frame = null;
  win.webContents.on('paint', (_e, _dirty, image) => (frame = image));
  const js = (code) => win.webContents.executeJavaScript(code, true);

  /** Resize to a store size and return the next complete frame as PNG. */
  async function grab(size) {
    win.setContentSize(size.w, size.h);
    win.webContents.setZoomFactor(size.zoom);
    await sleep(900);
    frame = null;
    win.webContents.invalidate();
    for (let i = 0; i < 50 && (!frame || frame.getSize().width !== size.w); i++) await sleep(50);
    return frame.toPNG();
  }
  const save = (rel, png) => {
    const f = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, png);
    console.log('  wrote', rel);
  };

  for (const lang of LANGS) {
    for (const scene of SCENES) {
      if (ONLY.length && !ONLY.some((o) => scene.id.includes(o))) continue;
      console.log(`[${lang}] ${scene.id}`);
      await win.loadURL(URL);
      await js(`localStorage.setItem('armor-tank:lang', ${JSON.stringify(lang)}); 1`);
      await win.loadURL(URL);
      win.setContentSize(SIZES.play.w, SIZES.play.h);
      win.webContents.setZoomFactor(SIZES.play.zoom);
      await js(PAGE_HELPERS);
      await js(`__cap.profile()`);
      await js(`__cap.scene(${JSON.stringify(scene)})`);
      for (const [name, size] of Object.entries(SIZES)) save(`screenshots/${name}/${lang}/${scene.id}.png`, await grab(size));
      if (scene.id === '01-city') {
        // Feature graphic: the same battle without HUD, with the title laid over it (2× then downscaled)
        await js(`__cap.featureOverlay(${JSON.stringify(lang)})`);
        save(`graphics/feature-graphic-${lang}@2x.png`, await grab({ w: 2048, h: 1000, zoom: 2 }));
      }
    }
  }
  app.exit(0);
}

// Runs inside the page. window.__game is exposed by main.ts in dev builds only.
const PAGE_HELPERS = `
window.__cap = (() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 30000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout: ' + fn); await sleep(100); } };
  const click = (sel) => document.querySelector(sel).click();
  async function store() {
    await waitFor(() => performance.getEntriesByType('resource').some((e) => e.name.includes('/src/save/storage.ts')));
    const u = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/src/save/storage.ts')).pop();
    return (await import(u)).store;
  }
  return {
    /** A mid-campaign profile so menus and the garage look lived-in. */
    async profile() {
      await waitFor(() => document.querySelector('[data-a=levels]'));
      const s = await store();
      Object.assign(s.settings, { quality: 'high', shake: false, sfx: 0, music: 0, damageNumbers: true });
      await s.saveSettings();
      await s.newGame(1);
      Object.assign(s.profile, {
        credits: 18450, unlocked: 25, level: 14, xp: 820, skillPoints: 2, totalKills: 1284,
        upgrades: { attack: 5, defense: 4, hp: 6, speed: 3, reload: 4 },
        ammo: ['HEAT', 'INC', 'CLU'],
        armor: { owned: ['composite', 'era', 'slat'], equipped: 'era' },
        skills: { droneTime: 2, buffTime: 1, missile: 2, shield: 1, regen: 2, salvage: 1, crit: 2 },
        stars: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, [true, true, i % 3 !== 1, i % 2 === 0]])),
      });
      await s.save();
      click('[data-a=levels]');
      await sleep(300);
    },
    async scene(sc) {
      if (sc.menu === 'garage') {
        click('[data-a=back]');
        await waitFor(() => document.querySelector('[data-a=garage]'));
        click('[data-a=garage]');
        await sleep(2500);
        return;
      }
      document.querySelector('.level[data-id="' + sc.level + '"]').click();
      await waitFor(() => document.querySelector('[data-a=go]'));
      if (sc.menu === 'briefing') { await sleep(2000); return; }
      click('[data-a=go]');
      await waitFor(() => window.__game && window.__game.level && window.__game.level.id === sc.level && !document.querySelector('#hud').classList.contains('hidden'), 60000);
      const g = window.__game, P = g.player;
      setInterval(() => { P.hp = P.maxHp; }, 50);
      g.camDist = 54;
      g.phaseT = 0.05;
      if (sc.spot === 'harbour') {
        // Next to the container stacks on the quay, so the sea and the cargo ship are in the bottom of the shot
        const ext = g.city.extent, size = P.pos.clone();
        const stacks = g.buildings.filter((b) => { b.box.getSize(size); return Math.min(size.x, size.z) < 3 && b.box.max.z > ext - 70; });
        const c = stacks.length ? stacks[Math.floor(stacks.length / 2)].box.getCenter(P.pos.clone()) : P.pos.clone();
        for (let i = 0; i < 200; i++) {
          const x = c.x + (Math.random() - 0.5) * 30, z = ext - 12 - Math.random() * 10;
          if (!g.nav.isTight(x, z)) { P.pos.set(x, 0, z); P.yaw = Math.PI; break; }
        }
      }
      await sleep(sc.spot ? 2500 : 600);
      // Place the enemies in view, 12–30 m ahead of the tank, on open ground
      const placed = [];
      for (const kind of sc.enemies) {
        for (let i = 0; i < 60; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, d = kind === 'behemoth' ? 26 : 12 + Math.random() * 18;
          const x = P.pos.x + Math.cos(a) * d * 1.3, z = P.pos.z + Math.sin(a) * d * 0.8;
          if (g.nav.isTight(x, z) || placed.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 6)) continue;
          const e = g.spawnUnit(kind, new P.pos.constructor(x, 0, z), Math.atan2(P.pos.x - x, P.pos.z - z), true);
          e.state = 'engage'; e.lastKnown.copy(P.pos); e.lastSeen = g.elapsed;
          placed.push(e);
          break;
        }
      }
      // Player fires at the nearest ground target (cannon + machine gun)
      const target = placed.filter((e) => !(e.def && e.def.flying)).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0] || placed[0];
      const aimAt = () => { if (!target) return; const v = target.pos.clone().project(g.camera); g.input.mouse = { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
      g.input.touchMode = false; aimAt(); setInterval(aimAt, 100);
      g.input.mouseFire = true; g.input.mouseMg = true;
      await sleep(1200);
      for (const e of placed.slice(-(sc.wreck || 0))) if (e !== target) g.destroyVehicle(e, 'player');
      if (sc.collapse) {
        const b = g.buildings.filter((b) => b.alive).map((b) => ({ b, c: b.box.getCenter(P.pos.clone()) })).filter(({ c }) => c.z < P.pos.z && Math.abs(c.x - P.pos.x) < 40).sort((m, n) => m.c.distanceTo(P.pos) - n.c.distanceTo(P.pos))[0];
        if (b) for (let i = 0; i < 3; i++) g.damageBuilding(b.b, 4000, b.c);
      }
      await sleep(sc.wait || 1500);
    },
    /** Hide the HUD and lay the title over the battle for the Play feature graphic. */
    featureOverlay(lang) {
      document.querySelector('#hud').style.display = 'none';
      document.querySelector('#overlay').style.display = 'none';
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:50;pointer-events:none;background:linear-gradient(90deg,rgba(10,12,14,.9) 0%,rgba(10,12,14,.65) 38%,rgba(10,12,14,0) 62%);display:flex;flex-direction:column;justify-content:center;padding-left:56px;font-family:system-ui,"Leelawadee UI","Segoe UI",sans-serif';
      const tag = lang === 'th' ? '25 ด่าน · ตึกพังได้ทั้งเมือง · ศึกบอสยักษ์' : '25 levels · Destructible cities · Epic boss battles';
      d.innerHTML = '<div style="font-weight:900;font-size:88px;line-height:.95;letter-spacing:10px;color:#f1eee6;text-shadow:0 4px 24px rgba(0,0,0,.6)">ARMOR<br><span style="color:#e2b84a">TANK</span></div>'
        + '<div style="margin-top:18px;font-size:22px;font-weight:700;color:#e8e6e1;letter-spacing:.5px;text-shadow:0 2px 8px rgba(0,0,0,.8)">' + tag + '</div>';
      document.body.appendChild(d);
    },
  };
})(); 1`;
