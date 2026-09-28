import { lang, tr } from './i18n';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadPhotoTextures } from './assets/photo';
import { sfx } from './game/audio';
import { LEVELS } from './game/data';
import { Game, type LevelResult } from './game/game';
import { Input } from './game/input';
import { store, type Checkpoint } from './save/storage';
import { Hud } from './ui/hud';
import { Menus } from './ui/menus';
import { Viewer } from './ui/viewer';
import { addXp, loadoutOf } from './game/progression';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.setSize(innerWidth, innerHeight, false);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// Static HTML text (e.g. the rotate-device hint)
if (lang === 'en') document.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => (el.textContent = el.dataset.en!));

const hud = new Hud(ui);
const input = new Input(canvas, ui);
let viewer: Viewer | null = null;
let game: Game | null = null;
let levelId = 1;
let mode: 'menu' | 'game' = 'menu';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const menuShift = () => (innerWidth > 800 ? 0.17 : 0.22);

const menus = new Menus(ui, {
  continueGame() {
    const cp = store.profile.checkpoint;
    if (cp) void startLevel(cp.level, cp);
    else menus.levels();
  },
  async newGame() {
    await store.newGame();
    menus.briefing(1, () => menus.main());
  },
  playLevel: (id) => void startLevel(id, null),
  resume,
  restartWave() {
    const cp = store.profile.checkpoint;
    if (cp) void startLevel(cp.level, cp);
  },
  async saveAndQuit() {
    await store.save();
    exitToMenu();
  },
  toMenu: exitToMenu,
  garage(on) {
    if (!viewer) return;
    viewer.orbit.enabled = on;
    viewer.shiftX = on ? (innerWidth > 800 ? 0.16 : 0.2) : menuShift();
  },
  showVehicle: (id) => viewer?.show(id),
  previewArmor: (kit) => viewer?.armor(kit),
  settingsChanged() {
    sfx.setVolume(store.settings.sfx);
    if (game) {
      game.setQuality(store.settings.quality);
      game.fx.shakeEnabled = store.settings.shake;
    }
  },
});

async function startLevel(id: number, cp: Checkpoint | null) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level?.playable) return;
  sfx.unlock();
  levelId = id;
  menus.loading(cp ? tr(`กำลังโหลดด่าน ${id} · Wave ${cp.wave + 1}`, `Loading level ${id} · Wave ${cp.wave + 1}`) : tr(`กำลังสร้างสมรภูมิ: ${level.nameTh}`, `Building battlefield: ${level.name}`), 0.6);
  await nextFrame();
  await nextFrame();
  disposeGame();
  game = new Game(renderer, env, input, store.settings, {
    message: (t, s) => hud.message(t, s),
    checkpoint(c) {
      store.profile.checkpoint = c;
      void store.save();
    },
    end: (r) => void onLevelEnd(r),
    earn(credits, xp) {
      const p = store.profile;
      p.credits += credits;
      const levels = addXp(p, xp);
      if (levels > 0) hud.message(`LEVEL UP! Lv ${p.level}`, tr(`ได้แต้มสกิล +${levels} · ใช้ได้ที่โรงรถ`, `+${levels} skill point${levels > 1 ? 's' : ''} · spend them in the Garage`));
      void store.save();
    },
  }, loadoutOf(store.profile));
  game.load(level, cp);
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  if (!cp) {
    store.profile.checkpoint = game.checkpoint();
    await store.save();
  }
  input.attach();
  hud.show(true);
  hud.resize();
  if (input.touchMode) hud.touchHint();
  menus.hide();
  mode = 'game';
  document.body.classList.add('playing');
}

async function onLevelEnd(r: LevelResult) {
  input.detach();
  const p = store.profile;
  p.totalKills += r.kills;
  p.playTime += r.time;
  const cp = p.checkpoint;
  if (r.victory) {
    // Credits/EXP were already banked by the game (per wave and on victory)
    const prev = p.stars[levelId] ?? [];
    p.stars[levelId] = r.stars.map((s, i) => s || !!prev[i]);
    p.unlocked = Math.max(p.unlocked, levelId + 1);
    p.checkpoint = null;
  }
  // On defeat the checkpoint is kept so the last wave can be retried (earnings of that wave are lost)
  await store.save();
  hud.show(false);
  menus.result(r, levelId, !r.victory && cp ? cp.wave : undefined);
}

function pause() {
  if (!game || game.paused || game.phase === 'victory' || game.phase === 'defeat') return;
  game.paused = true;
  input.reset();
  menus.pause(!!store.profile.checkpoint);
}

function resume() {
  if (!game) return;
  game.paused = false;
  menus.hide();
}

function disposeGame() {
  game?.dispose();
  game = null;
}

function exitToMenu() {
  disposeGame();
  input.detach();
  hud.show(false);
  document.body.classList.remove('playing');
  mode = 'menu';
  if (viewer) {
    viewer.show('striker');
    viewer.shiftX = menuShift();
    viewer.resize();
  }
  menus.main();
}

input.onAction = (a) => {
  if (!game) return;
  if (a === 'pause') {
    if (game.paused) resume();
    else pause();
  } else if (a === 'ammo-next') game.toggleAmmo();
  else if (a.startsWith('ammo-')) game.ammoSlot(Number(a.slice(5)));
  else if (a === 'zoom-in') game.zoom(-4);
  else if (a === 'zoom-out') game.zoom(4);
  else if (a === 'mine') game.dropMine();
};
hud.onPause = pause;
hud.onAmmo = (id) => game?.toggleAmmo(id);
hud.onMine = () => game?.dropMine();

// Native (Android/iOS): hardware back button and app backgrounding
if (Capacitor.isNativePlatform()) {
  void NativeApp.addListener('backButton', () => {
    if (mode === 'game' && game) {
      const end = document.querySelector<HTMLButtonElement>('#screens [data-a=menu]');
      if (end) end.click();
      else if (game.paused) resume();
      else pause();
      return;
    }
    const back = document.querySelector<HTMLButtonElement>('#screens [data-a=back]');
    if (back) back.click();
    else void NativeApp.exitApp();
  });
  void NativeApp.addListener('pause', () => {
    pause();
    void store.save();
  });
}

// Browsers only allow audio after a user gesture
addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    sfx.suspend(true);
    void store.save();
  } else sfx.suspend(false);
});
addEventListener('pagehide', () => void store.save());
addEventListener('resize', () => {
  game?.resize();
  viewer?.resize();
  hud.resize();
});

// ───────────────────────── Loop ─────────────────────────

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (mode === 'game' && game) {
    game.update(dt);
    game.render();
    hud.update(game, dt);
  } else if (viewer) viewer.render(dt, clock.elapsedTime);
  requestAnimationFrame(frame);
}

async function boot() {
  menus.loading(tr('กำลังโหลด...', 'Loading...'), 0.05);
  await store.init();
  sfx.setVolume(store.settings.sfx);
  await loadPhotoTextures((d, t) => menus.loading(tr('กำลังโหลด texture ภาพถ่าย...', 'Loading photo textures...'), 0.1 + (d / t) * 0.8));
  viewer = new Viewer(renderer, env, canvas);
  viewer.show('striker');
  viewer.shiftX = menuShift();
  viewer.resize();
  menus.main();
  frame();
}

boot().catch((e) => {
  console.error(e);
  menus.loading(tr(`เกิดข้อผิดพลาด: ${(e as Error).message}`, `Error: ${(e as Error).message}`));
});

// Installable web app (PWA): offline cache, only on the web build
if (!Capacitor.isNativePlatform() && location.protocol === 'https:' && 'serviceWorker' in navigator && !import.meta.env.DEV) {
  void navigator.serviceWorker.register('./sw.js');
}

// Debug hook (devtools)
Object.assign(window, { armor: { get game() { return game; }, store } });
