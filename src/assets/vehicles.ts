import { tr } from '../i18n';
import * as THREE from 'three';
import { M, bake, box, boxOn, cyl, cylX, cylZ, extrudeSide, extrudeTop, mat, mesh, mirrorX, place, tiled, tube } from './kit';
import * as T from './textures';

export interface VehicleRig {
  root: THREE.Group;
  /** Yaw pivot for the weapon (turret / pod / MG mount). */
  turret?: THREE.Object3D;
  /** Recoiling barrel group. */
  gun?: THREE.Object3D;
  muzzle?: THREE.Object3D;
  /** Left/right tread textures for UV scrolling. */
  treads: THREE.Texture[];
  /** Wheels spin around local X. */
  wheels: THREE.Object3D[];
  rotors: THREE.Object3D[];
  /** Hover height for aircraft. */
  hover?: number;
  /** Infantry legs (swing while walking). */
  legs?: THREE.Object3D[];
  halfWidth: number;
}

export interface VehicleInfo {
  id: string;
  name: string;
  role: string;
  faction: 'player' | 'enemy';
  speed: number; // m/s
  hp: number;
  build: () => VehicleRig;
}

// ───────────────────────── Paint schemes ─────────────────────────

const skins = {
  nato: () => mat('skin-nato', { map: tiled(T.camo('nato', ['#4d5a38', '#5f4b33', '#2a2b25', '#6b7148'], 7), 6), roughness: 0.78, metalness: 0.25 }),
  desert: () => mat('skin-desert', { map: tiled(T.camo('desert', ['#b09a70', '#8c7650', '#c7b48b'], 17), 6), roughness: 0.8, metalness: 0.2 }),
  enemy: () => mat('skin-enemy', { map: tiled(T.camo('enemy', ['#55595a', '#3b3e40', '#6c6f69', '#2c2e2f'], 27), 6), roughness: 0.75, metalness: 0.3 }),
  enemyGreen: () => mat('skin-enemyG', { map: tiled(T.camo('enemyG', ['#4a4f3a', '#35382c', '#5a5c47'], 37), 6), roughness: 0.78, metalness: 0.25 }),
  winter: () => mat('skin-winter', { map: tiled(T.camo('winter', ['#d8dcde', '#a6acb0', '#747b80', '#e8ecee'], 57), 6), roughness: 0.7, metalness: 0.25 }),
  future: () => mat('skin-future', { map: tiled(T.camo('future', ['#3d4144', '#2c2f31', '#4c5053'], 47), 6), roughness: 0.5, metalness: 0.55 }),
};

// ───────────────────────── Tracks ─────────────────────────

/** Closed belt surface around a side profile; v coordinate advances along the belt for UV scrolling. */
function beltGeometry(shape: THREE.Shape, width: number, linkTile = 0.8) {
  const pts = shape.getSpacedPoints(120);
  if (pts[0].distanceTo(pts[pts.length - 1]) > 1e-4) pts.push(pts[0].clone());
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new THREE.Vector2().subVectors(b, a).normalize();
    if (i > 0) acc += p.distanceTo(pts[i - 1]);
    const n = new THREE.Vector2(t.y, -t.x);
    for (const s of [-1, 1]) {
      pos.push((s * width) / 2, p.y, p.x);
      nor.push(0, n.y, n.x);
      uv.push(s < 0 ? 0 : 1, acc / linkTile);
    }
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function trackShape(L: number, H: number, r: number) {
  const s = new THREE.Shape();
  const fx = L / 2 - r, fy = H - r;
  const rx = -L / 2 + r, ry = H - r;
  s.moveTo(-L / 2 + r * 1.6, 0.02);
  s.lineTo(L / 2 - r * 1.9, 0.02);
  s.lineTo(fx + r * Math.cos(-Math.PI / 3), fy + r * Math.sin(-Math.PI / 3));
  s.absarc(fx, fy, r, -Math.PI / 3, Math.PI / 2, false);
  s.lineTo(rx, H);
  s.absarc(rx, ry, r, Math.PI / 2, (4 * Math.PI) / 3, false);
  s.lineTo(-L / 2 + r * 1.6, 0.02);
  return s;
}

/** Adds both track runs, road wheels, sprockets. Returns tread textures [left, right]. */
function addTracks(g: THREE.Group, L: number, W: number, tw: number, H: number, wheels: number) {
  const treads: THREE.Texture[] = [];
  const r = Math.min(0.42, H * 0.46);
  const shape = trackShape(L, H, r);
  const geo = beltGeometry(shape, tw);
  const wheelR = r * 0.85;
  for (const side of [-1, 1]) {
    const tex = T.tread().clone();
    tex.needsUpdate = true;
    treads.push(tex);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.55, side: THREE.DoubleSide });
    const belt = mesh(geo, m, side * (W / 2 - tw / 2), 0, 0);
    belt.userData.dynamic = true;
    g.add(belt);
    const x = side * (W / 2 - tw / 2);
    const span = L - r * 3.6;
    for (let i = 0; i < wheels; i++) {
      const z = -span / 2 + (span * i) / (wheels - 1);
      const w = cylX(wheelR, tw * 0.8, M.darkMetal(), 14);
      w.position.set(x, wheelR + 0.06, z);
      g.add(w);
      const hub = cylX(wheelR * 0.4, tw * 0.84, M.steel(), 10);
      hub.position.copy(w.position);
      g.add(hub);
    }
    for (const [zz, rr] of [[L / 2 - r, r * 0.9], [-L / 2 + r, r * 0.95]] as const) {
      const s = cylX(rr, tw * 0.8, M.darkMetal(), 12);
      s.position.set(x, H - r, zz);
      g.add(s);
    }
  }
  return treads;
}

// ───────────────────────── Tank builder ─────────────────────────

interface TankSpec {
  L: number; // hull length
  W: number; // overall width incl. tracks
  tw: number; // track width
  H: number; // track height
  deck: number; // hull deck height
  glacis: number; // glacis length
  wheels: number;
  skin: THREE.Material;
  enemy?: boolean;
  turret: 'western' | 'eastern' | 'light' | 'heavy' | 'robot';
  ts: number; // turret scale
  tz: number; // turret offset
  gunLen: number;
  gunR: number;
  era?: boolean;
  aps?: boolean;
  bustle?: boolean;
  drums?: boolean;
  skirts?: boolean;
  second?: boolean;
}

function turretOutline(kind: TankSpec['turret'], s: number): { pts: [number, number][]; h: number; front: number } {
  const sc = (p: [number, number][]) => p.map(([x, z]) => [x * s, z * s] as [number, number]);
  switch (kind) {
    case 'western':
      return { pts: sc([[-1.1, -1.6], [1.1, -1.6], [1.35, -0.6], [1.35, 0.6], [0.9, 1.6], [0.3, 1.95], [-0.3, 1.95], [-0.9, 1.6], [-1.35, 0.6], [-1.35, -0.6]]), h: 0.72 * s, front: 1.95 * s };
    case 'heavy':
      return { pts: sc([[-1.4, -1.8], [1.4, -1.8], [1.55, 1.0], [1.1, 2.0], [-1.1, 2.0], [-1.55, 1.0]]), h: 0.9 * s, front: 2.0 * s };
    case 'light':
      return { pts: sc([[-0.8, -1.1], [0.8, -1.1], [1.0, 0.3], [0.6, 1.2], [-0.6, 1.2], [-1.0, 0.3]]), h: 0.62 * s, front: 1.2 * s };
    case 'robot':
      return { pts: sc([[-0.5, -0.6], [0.5, -0.6], [0.6, 0.4], [0.3, 0.7], [-0.3, 0.7], [-0.6, 0.4]]), h: 0.45 * s, front: 0.7 * s };
    case 'eastern': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const z = Math.cos(a) * 1.55;
        pts.push([Math.sin(a) * 1.3 * s, (z < -0.9 ? -0.9 - (z + 0.9) * 0.3 : z) * s]);
      }
      return { pts, h: 0.42 * s, front: 1.55 * s };
    }
  }
}

function buildTank(spec: TankSpec): VehicleRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const { L, W, tw, H, deck, skin } = spec;
  const accent = spec.enemy ? M.enemyRed() : M.playerMark();

  const treads = addTracks(body, L, W, tw, H, spec.wheels);

  // Lower hull between tracks
  const inner = W - tw * 2 + 0.1;
  body.add(extrudeSide([[-L / 2 + 0.15, 0.4], [L / 2 - 0.55, 0.4], [L / 2 - 0.05, H], [-L / 2 + 0.05, H]], inner, skin));
  // Upper hull / sponsons: leave part of the tracks visible from above
  const upperW = W - tw * 0.9;
  body.add(
    extrudeSide(
      [[-L / 2 - 0.08, H - 0.06], [L / 2 + 0.12, H - 0.06], [L / 2 + 0.16, H + 0.08], [L / 2 - spec.glacis, deck], [-L / 2 + 0.12, deck], [-L / 2 - 0.1, deck - 0.15]],
      upperW,
      skin,
      { size: 0.03 },
    ),
  );
  // Fender tips over the exposed tracks
  for (const s of [-1, 1]) {
    body.add(box(tw * 0.5, 0.05, 0.55, M.darkMetal(), s * (W / 2 - tw * 0.25), H + 0.02, L / 2 - 0.05));
    body.add(box(tw * 0.5, 0.05, 0.4, M.darkMetal(), s * (W / 2 - tw * 0.25), H + 0.02, -L / 2 + 0.1));
  }
  // Engine deck grille + exhaust
  const grille = mat('grille', { map: T.grille(), roughness: 0.8, metalness: 0.6 });
  body.add(boxOn(upperW * 0.62, 0.05, L * 0.22, grille, 0, deck, -L / 2 + L * 0.16));
  body.add(boxOn(upperW * 0.5, 0.25, 0.12, grille, 0, deck - 0.45, -L / 2 - 0.08));
  // Driver hatch + periscopes
  body.add(cyl(0.28, 0.3, 0.07, M.darkMetal(), 14).translateY(deck + 0.04).translateZ(L / 2 - spec.glacis * 0.95));
  for (const x of [-0.25, 0, 0.25]) body.add(box(0.14, 0.08, 0.07, M.lens(), x, deck + 0.05, L / 2 - spec.glacis * 0.75));
  // Headlights & tow hooks
  for (const s of [-1, 1]) {
    body.add(box(0.18, 0.14, 0.1, M.headlight(), s * (upperW / 2 - 0.25), H + 0.12, L / 2 + 0.14));
    body.add(box(0.12, 0.12, 0.22, M.darkMetal(), s * inner * 0.3, 0.55, L / 2 - 0.35));
    // Toolboxes on fenders
    body.add(boxOn(0.4, 0.28, 1.1, skin, s * (upperW / 2 - 0.3), deck, -L * 0.1));
    body.add(box(0.14, 0.1, 0.1, M.taillight(), s * (upperW / 2 - 0.2), deck - 0.2, -L / 2 - 0.05));
  }
  // Faction marking on the hull (visible from above)
  body.add(boxOn(0.5, 0.012, 0.5, accent, -upperW * 0.28, deck, -L * 0.28).rotateY(0.785));
  // Spare track links on glacis
  if (!spec.enemy) {
    const tr = mat('trackMat', { map: tiled(T.tread(), 0.4, 0.8), roughness: 0.8, metalness: 0.5 });
    const glAngle = Math.atan2(deck - H, spec.glacis);
    const link = box(upperW * 0.55, 0.06, 0.5, tr);
    link.position.set(0, (deck + H) / 2 + 0.08, L / 2 - spec.glacis / 2 + 0.1);
    link.rotation.x = glAngle;
    body.add(link);
  }
  // ERA bricks on glacis
  if (spec.era) {
    const eraMat = spec.enemy ? skin : skin;
    const glAngle = Math.atan2(deck - H, spec.glacis);
    for (let ix = -3; ix <= 3; ix++)
      for (let iz = 0; iz < 3; iz++) {
        const b = box(0.3, 0.1, 0.34, eraMat);
        const t = (iz + 0.5) / 3;
        b.position.set(ix * 0.36, H + (deck - H) * (1 - t) + 0.1, L / 2 - spec.glacis * (1 - t) + 0.05);
        b.rotation.x = glAngle;
        body.add(b);
      }
  }
  // Side skirts over front half
  if (spec.skirts) {
    for (const s of [-1, 1]) {
      const sk = box(0.08, H * 0.55, L * 0.62, skin);
      sk.position.set(s * (W / 2 + 0.02), H * 0.68, L * 0.14);
      body.add(sk);
      for (let i = 0; i < 6; i++) body.add(box(0.1, 0.03, 0.04, M.darkMetal(), s * (W / 2 + 0.04), H * 0.9, L * 0.14 - L * 0.28 + i * L * 0.11));
    }
  }
  // Fuel drums at the rear
  if (spec.drums) {
    for (const s of [-1, 1]) {
      const d = cylX(0.3, 0.9, spec.enemy ? mat('drum', { color: 0x4a4d45, roughness: 0.6, metalness: 0.5 }) : skin, 16);
      d.position.set(s * 0.55, deck + 0.3, -L / 2 - 0.2);
      body.add(d);
    }
  }
  bake(body);

  // ─── Turret ───
  const turret = new THREE.Group();
  turret.position.set(0, deck, spec.tz);
  turret.userData.dynamic = true;
  root.add(turret);
  const tOut = turretOutline(spec.turret, spec.ts);
  const tBody = new THREE.Group();
  turret.add(tBody);
  const ring = cyl(1.0 * spec.ts, 1.05 * spec.ts, 0.12, M.darkMetal(), 24);
  ring.position.y = 0.06;
  tBody.add(ring);
  const shell = extrudeTop(tOut.pts, tOut.h, skin, { size: spec.turret === 'eastern' ? 0.22 : 0.04, seg: spec.turret === 'eastern' ? 4 : 1 });
  shell.position.y = 0.08;
  tBody.add(shell);
  const top = 0.08 + tOut.h;
  const s = spec.ts;

  if (spec.turret === 'eastern') {
    // ERA wedges ("brow") on turret front
    for (const sd of [-1, 1]) {
      const w = extrudeTop([[0, 0], [0.95, -0.2], [0.85, 0.55], [0.1, 0.9]], 0.3, skin, { size: 0.02 });
      w.position.set(sd * 0.1 * s, top - 0.02, 0.55 * s);
      if (sd < 0) w.scale.x = -1;
      tBody.add(w);
    }
    // Enemy band
    tBody.add(boxOn(0.25 * s, 0.02, 1.6 * s, accent, 0.75 * s, top + 0.12, -0.3 * s));
  } else {
    tBody.add(boxOn(0.45 * s, 0.012, 0.45 * s, accent, -0.6 * s, top, -0.9 * s).rotateY(0.785));
  }

  if (spec.turret === 'robot') {
    // Sensor mast + missile box
    const mast = cyl(0.05, 0.06, 1.1, M.darkMetal(), 8);
    mast.position.set(-0.3, top + 0.55, -0.3);
    tBody.add(mast);
    tBody.add(box(0.5, 0.26, 0.26, M.darkMetal(), -0.3, top + 1.2, -0.3));
    tBody.add(box(0.36, 0.14, 0.05, M.lens(), -0.3, top + 1.2, -0.16));
    tBody.add(boxOn(0.4, 0.35, 0.8, skin, 0.62, top - 0.3, -0.1));
    for (const x of [0.54, 0.7]) tBody.add(cylZ(0.07, 0.05, M.enemyRed(), 10).translateX(x).translateY(top - 0.05).translateZ(0.31));
  } else {
    // Commander cupola + hatch
    const cup = cyl(0.36 * s, 0.4 * s, 0.22, M.darkMetal(), 16);
    cup.position.set(0.55 * s, top + 0.11, -0.35 * s);
    tBody.add(cup);
    tBody.add(cyl(0.3 * s, 0.3 * s, 0.05, skin, 16).translateX(0.55 * s).translateY(top + 0.24).translateZ(-0.35 * s));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tBody.add(box(0.1, 0.08, 0.06, M.lens(), 0.55 * s + Math.sin(a) * 0.38 * s, top + 0.14, -0.35 * s + Math.cos(a) * 0.38 * s).rotateY(a));
    }
    // Loader hatch
    tBody.add(cyl(0.3 * s, 0.3 * s, 0.05, M.darkMetal(), 14).translateX(-0.55 * s).translateY(top + 0.03).translateZ(-0.4 * s));
    // Gunner primary sight
    tBody.add(boxOn(0.36 * s, 0.32, 0.5 * s, skin, -0.62 * s, top, 0.75 * s));
    tBody.add(box(0.28 * s, 0.18, 0.05, M.lens(), -0.62 * s, top + 0.18, 1.01 * s));
    // Remote weapon station
    const rws = new THREE.Group();
    rws.position.set(0.55 * s, top + 0.26, 0.05 * s);
    rws.add(boxOn(0.34, 0.26, 0.5, M.darkMetal(), 0, 0, 0));
    rws.add(cylZ(0.035, 1.0, M.darkMetal(), 8).translateY(0.16).translateZ(0.7));
    rws.add(box(0.16, 0.14, 0.18, skin, -0.25, 0.14, 0.05));
    rws.add(box(0.1, 0.08, 0.03, M.lens(), -0.25, 0.14, 0.15));
    tBody.add(rws);
    // Smoke grenade launchers
    for (const sd of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const t = cylZ(0.055, 0.28, M.darkMetal(), 8);
        t.position.set(sd * (1.12 * s - i * 0.05), top - 0.12 + (i % 2) * 0.12, 0.35 * s + i * 0.1);
        t.rotation.y = sd * 0.55;
        t.rotation.x = -0.4;
        tBody.add(t);
      }
    // Antennae
    for (const sd of [-1, 1]) {
      const a = cyl(0.012, 0.02, 2.2, M.darkMetal(), 5);
      a.position.set(sd * 0.95 * s, top + 1.1, -1.35 * s);
      a.rotation.x = -0.18;
      tBody.add(a);
    }
    // Bustle rack with gear
    if (spec.bustle) {
      const z0 = -1.6 * s;
      const rack = M.darkMetal();
      tBody.add(tube(new THREE.Vector3(-1.05 * s, top - 0.05, z0 - 0.8), new THREE.Vector3(1.05 * s, top - 0.05, z0 - 0.8), 0.03, rack));
      for (const x of [-1.05 * s, 1.05 * s]) tBody.add(tube(new THREE.Vector3(x, top - 0.05, z0), new THREE.Vector3(x, top - 0.05, z0 - 0.8), 0.03, rack));
      tBody.add(boxOn(2.1 * s, 0.04, 0.8, rack, 0, 0.3, z0 - 0.4));
      const r = T.rng(spec.L * 100);
      for (let i = 0; i < 5; i++) {
        const bag = mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8), r() > 0.5 ? M.canvas() : M.canvasTan());
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = (r() - 0.5) * 0.5;
        bag.position.set(-0.8 * s + i * 0.4 * s, 0.55, z0 - 0.4 + (r() - 0.5) * 0.3);
        tBody.add(bag);
      }
      tBody.add(boxOn(0.55, 0.3, 0.4, skin, 0.7 * s, 0.34, z0 - 0.45));
    }
    // Near-future Active Protection System radar tiles
    if (spec.aps) {
      const apsMat = mat('aps', { color: 0x2e3336, roughness: 0.4, metalness: 0.6 });
      for (const [x, z, ry] of [[1.25, 0.9, 0.7], [-1.25, 0.9, -0.7], [1.3, -1.2, 2.2], [-1.3, -1.2, -2.2]] as const) {
        const p = boxOn(0.5, 0.35, 0.08, apsMat, x * s, top - 0.15, z * s);
        p.rotation.y = ry;
        tBody.add(p);
      }
      tBody.add(cyl(0.22, 0.26, 0.3, apsMat, 12).translateX(-0.2 * s).translateY(top + 0.15).translateZ(-1.1 * s));
    }
  }
  bake(tBody);

  // ─── Gun ───
  const gun = new THREE.Group();
  gun.userData.dynamic = true;
  const gy = 0.08 + tOut.h * 0.55;
  gun.position.set(0, gy, tOut.front - 0.25 * s);
  turret.add(gun);
  const gunBody = new THREE.Group();
  gun.add(gunBody);
  gunBody.add(box(0.7 * s, 0.5 * s, 0.6, skin, 0, 0, 0.1));
  const R = spec.gunR;
  const barrel = cylZ(R, spec.gunLen, M.darkMetal(), 14);
  barrel.position.z = 0.4 + spec.gunLen / 2;
  gunBody.add(barrel);
  // Thermal sleeve sections
  for (let i = 0; i < 3; i++) {
    const sl = cylZ(R * 1.25, spec.gunLen * 0.16, skin, 14);
    sl.position.z = 0.6 + spec.gunLen * (0.1 + i * 0.22);
    gunBody.add(sl);
  }
  if (spec.turret !== 'robot') {
    const ev = cylZ(R * 1.7, 0.45, skin, 16);
    ev.position.z = 0.4 + spec.gunLen * 0.72;
    gunBody.add(ev);
  }
  gunBody.add(cylZ(R * 1.3, 0.2, M.darkMetal(), 14).translateZ(0.4 + spec.gunLen - 0.1));
  bake(gunBody);
  const muzzle = new THREE.Object3D();
  muzzle.position.z = 0.4 + spec.gunLen + 0.1;
  gun.add(muzzle);

  if (spec.second) {
    // Behemoth rear secondary turret
    const t2 = new THREE.Group();
    t2.position.set(0, deck, -L * 0.3);
    t2.add(extrudeTop(turretOutline('light', 0.8).pts, 0.45, skin, { size: 0.03 }));
    t2.add(cylZ(0.08, 3, M.darkMetal(), 10).translateY(0.3).translateZ(2.2));
    t2.add(boxOn(0.3, 0.012, 1.2, accent, 0, 0.47, -0.2));
    bake(t2);
    t2.rotation.y = Math.PI;
    root.add(t2);
  }

  return { root, turret, gun, muzzle, treads, wheels: [], rotors: [], halfWidth: W / 2 };
}

// ───────────────────────── Wheeled vehicles ─────────────────────────

function wheel(r: number, w: number, offroad = false) {
  const g = new THREE.Group();
  g.userData.dynamic = true;
  const tire = cylX(r, w, M.rubber(), 22);
  g.add(tire);
  if (offroad) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const lug = box(w * 0.95, 0.06, 0.1, M.rubber(), 0, Math.cos(a) * r, Math.sin(a) * r);
      lug.rotation.x = -a;
      g.add(lug);
    }
  }
  g.add(cylX(r * 0.55, w + 0.02, M.darkMetal(), 12));
  g.add(cylX(r * 0.2, w + 0.06, M.steel(), 8));
  return g;
}

function buildAPC(): VehicleRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = skins.enemyGreen();
  const L = 7.2, W = 2.9;
  body.add(extrudeSide([[-3.55, 0.75], [2.9, 0.75], [3.65, 1.35], [3.05, 2.1], [-3.5, 2.1], [-3.6, 1.2]], W, skin, { size: 0.04 }));
  // Upper side slopes
  for (const s of [-1, 1]) {
    const sl = box(0.5, 0.06, 5.8, skin);
    sl.position.set(s * (W / 2 - 0.12), 2.02, -0.4);
    sl.rotation.z = s * 0.5;
    body.add(sl);
    // Side stowage + slat armor bars
    body.add(boxOn(0.25, 0.5, 2.0, skin, s * (W / 2 + 0.12), 1.25, -1.6));
    for (let i = 0; i < 16; i++) body.add(box(0.04, 0.9, 0.05, M.darkMetal(), s * (W / 2 + 0.32), 1.45, -3.2 + i * 0.4));
    body.add(box(0.05, 0.05, 6.4, M.darkMetal(), s * (W / 2 + 0.32), 1.92, -0.2));
    body.add(box(0.05, 0.05, 6.4, M.darkMetal(), s * (W / 2 + 0.32), 1.0, -0.2));
    body.add(box(0.14, 0.12, 0.08, M.headlight(), s * 0.9, 1.5, 3.4));
  }
  // Roof hatches
  for (const [x, z] of [[-0.6, -1.8], [0.6, -1.8], [-0.6, -2.8], [0.6, -2.8]]) body.add(boxOn(0.8, 0.07, 0.7, M.darkMetal(), x, 2.1, z));
  body.add(cyl(0.3, 0.32, 0.12, M.darkMetal(), 12).translateX(-0.8).translateY(2.16).translateZ(1.9));
  for (const x of [-1.0, -0.8, -0.6]) body.add(box(0.14, 0.08, 0.07, M.lens(), x, 2.12, 2.3));
  body.add(boxOn(1.6, 0.35, 0.14, M.darkMetal(), 0, 0.9, -3.62)); // rear ramp hinge
  body.add(boxOn(0.5, 0.012, 0.5, M.enemyRed(), 0.8, 2.145, -1.1).rotateY(0.785)); // above the 0.04 hull bevel
  bake(body);

  const wheels: THREE.Object3D[] = [];
  for (const z of [2.3, 1.05, -1.0, -2.25])
    for (const s of [-1, 1]) {
      const w = wheel(0.58, 0.42, true);
      w.position.set(s * (W / 2 - 0.05), 0.58, z);
      root.add(w);
      wheels.push(w);
    }

  const turret = new THREE.Group();
  turret.position.set(0.35, 2.1, 0.2);
  turret.userData.dynamic = true;
  root.add(turret);
  const tb = new THREE.Group();
  turret.add(tb);
  tb.add(extrudeTop([[-0.75, -0.9], [0.75, -0.9], [0.85, 0.3], [0.45, 0.85], [-0.45, 0.85], [-0.85, 0.3]], 0.55, skin, { size: 0.03 }));
  tb.add(boxOn(0.35, 0.3, 0.4, M.darkMetal(), -0.5, 0.55, -0.2));
  tb.add(box(0.28, 0.16, 0.04, M.lens(), -0.5, 0.72, 0.02));
  for (const sd of [-1, 1]) tb.add(boxOn(0.25, 0.25, 0.6, skin, sd * 0.85, 0.15, -0.3)); // ATGM tubes
  bake(tb);
  const gun = new THREE.Group();
  gun.userData.dynamic = true;
  gun.position.set(0, 0.3, 0.8);
  turret.add(gun);
  gun.add(box(0.35, 0.3, 0.4, skin, 0, 0, 0));
  gun.add(cylZ(0.05, 2.6, M.darkMetal(), 10).translateZ(1.5));
  gun.add(cylZ(0.08, 0.3, M.darkMetal(), 10).translateZ(2.75));
  const muzzle = new THREE.Object3D();
  muzzle.position.z = 2.9;
  gun.add(muzzle);
  return { root, turret, gun, muzzle, treads: [], wheels, rotors: [], halfWidth: W / 2 };
}

function buildMLRS(): VehicleRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = skins.enemyGreen();
  // Chassis frame
  body.add(boxOn(1.1, 0.35, 8.4, M.darkMetal(), 0, 0.75, -0.3));
  body.add(boxOn(2.5, 0.12, 5.6, skin, 0, 1.15, -1.5));
  // Armored cab
  body.add(extrudeSide([[2.2, 1.0], [3.9, 1.0], [4.0, 1.6], [3.6, 2.7], [2.2, 2.75]], 2.55, skin, { size: 0.04 }));
  for (const s of [-1, 1]) {
    const ws = box(1.0, 0.7, 0.05, M.glass());
    ws.position.set(s * 0.55, 2.2, 3.84);
    ws.rotation.x = -0.35;
    body.add(ws);
    body.add(box(0.05, 0.5, 0.9, M.glass(), s * 1.3, 2.25, 3.0));
    body.add(box(0.18, 0.14, 0.06, M.headlight(), s * 0.95, 1.35, 4.02));
    body.add(boxOn(0.4, 0.6, 0.12, M.darkMetal(), s * 1.3, 1.1, 1.95)); // fenders
    // Stowage lockers
    body.add(boxOn(0.3, 0.6, 2.4, skin, s * 1.15, 1.27, -0.6));
  }
  body.add(boxOn(0.8, 0.07, 0.8, M.darkMetal(), -0.4, 2.76, 2.9)); // roof hatch (clears the 0.04 cab bevel)
  body.add(boxOn(0.6, 0.012, 0.6, M.enemyRed(), 0.5, 2.795, 2.9).rotateY(0.785));
  // Stabiliser jacks
  for (const s of [-1, 1]) body.add(boxOn(0.2, 0.9, 0.2, M.darkMetal(), s * 1.35, 0.35, -3.9));
  bake(body);

  const wheels: THREE.Object3D[] = [];
  for (const z of [3.0, -1.2, -2.7])
    for (const s of [-1, 1]) {
      const w = wheel(0.6, 0.5, true);
      w.position.set(s * 1.12, 0.6, z);
      root.add(w);
      wheels.push(w);
    }

  const turret = new THREE.Group();
  turret.position.set(0, 1.27, -2.0);
  turret.userData.dynamic = true;
  root.add(turret);
  const base = new THREE.Group();
  turret.add(base);
  base.add(cyl(0.9, 1.0, 0.3, M.darkMetal(), 18).translateY(0.15));
  bake(base);
  const pod = new THREE.Group();
  pod.userData.dynamic = true;
  pod.position.set(0, 0.55, -0.6);
  pod.rotation.x = -0.28;
  turret.add(pod);
  const podBody = new THREE.Group();
  pod.add(podBody);
  podBody.add(box(2.2, 1.05, 3.6, skin, 0, 0.5, 1.2));
  podBody.add(box(2.14, 1.0, 0.04, mat('podFace', { map: T.rocketPod(), roughness: 0.7 }), 0, 0.5, 3.02));
  for (const x of [-0.6, 0.6]) podBody.add(box(0.05, 1.06, 3.62, M.darkMetal(), x, 0.5, 1.2));
  bake(podBody);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.5, 3.1);
  pod.add(muzzle);
  return { root, turret, gun: pod, muzzle, treads: [], wheels, rotors: [], halfWidth: 1.3 };
}

function buildBuggy(): VehicleRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = skins.desert();
  const frame = M.darkMetal();
  body.add(boxOn(1.5, 0.12, 3.6, frame, 0, 0.55, 0));
  body.add(extrudeSide([[0.8, 0.67], [2.1, 0.67], [2.2, 0.95], [1.0, 1.05]], 1.6, skin, { size: 0.03 })); // hood
  body.add(boxOn(1.7, 0.35, 1.3, skin, 0, 0.67, -1.2)); // rear bed
  // Seats
  for (const s of [-1, 1]) {
    body.add(boxOn(0.45, 0.12, 0.5, M.canvas(), s * 0.35, 0.67, 0.2));
    body.add(box(0.45, 0.55, 0.1, M.canvas(), s * 0.35, 1.05, -0.05));
  }
  // Roll cage
  const cage = (a: number[], b: number[]) => body.add(tube(new THREE.Vector3(...a), new THREE.Vector3(...b), 0.04, frame));
  for (const s of [-0.75, 0.75]) {
    cage([s, 0.67, 0.9], [s, 1.75, 0.5]);
    cage([s, 1.75, 0.5], [s, 1.75, -0.6]);
    cage([s, 1.75, -0.6], [s, 0.67, -1.9]);
  }
  cage([-0.75, 1.75, 0.5], [0.75, 1.75, 0.5]);
  cage([-0.75, 1.75, -0.6], [0.75, 1.75, -0.6]);
  // Light bar + spare tire
  body.add(box(1.2, 0.1, 0.12, M.darkMetal(), 0, 1.8, 0.52));
  for (let i = 0; i < 4; i++) body.add(box(0.16, 0.08, 0.04, M.headlight(), -0.45 + i * 0.3, 1.8, 0.59));
  const spare = cylX(0.4, 0.3, M.rubber(), 18);
  spare.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  spare.position.set(0, 1.25, -1.95);
  body.add(spare);
  body.add(boxOn(0.4, 0.012, 0.4, M.enemyRed(), 0, 1.06, 1.5).rotateY(0.785));
  bake(body);

  const wheels: THREE.Object3D[] = [];
  for (const z of [1.45, -1.3])
    for (const s of [-1, 1]) {
      const w = wheel(0.46, 0.38, true);
      w.position.set(s * 0.95, 0.46, z);
      root.add(w);
      wheels.push(w);
    }

  const turret = new THREE.Group();
  turret.userData.dynamic = true;
  turret.position.set(0, 1.02, -1.2);
  root.add(turret);
  const mount = new THREE.Group();
  turret.add(mount);
  mount.add(cyl(0.05, 0.07, 0.6, frame, 8).translateY(0.3));
  mount.add(box(0.6, 0.35, 0.05, frame, 0, 0.85, 0.35)); // gun shield
  bake(mount);
  const gun = new THREE.Group();
  gun.userData.dynamic = true;
  gun.position.set(0, 0.68, 0);
  turret.add(gun);
  gun.add(box(0.14, 0.18, 0.7, frame, 0, 0, 0));
  gun.add(cylZ(0.035, 1.1, frame, 8).translateZ(0.85));
  gun.add(box(0.2, 0.12, 0.25, M.canvasTan(), 0.14, -0.05, 0.05)); // ammo can
  const muzzle = new THREE.Object3D();
  muzzle.position.z = 1.45;
  gun.add(muzzle);
  return { root, turret, gun, muzzle, treads: [], wheels, rotors: [], halfWidth: 1.1 };
}

function buildDrone(): VehicleRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = skins.future();
  body.add(extrudeTop([[-0.22, -0.5], [0.22, -0.5], [0.28, 0.1], [0.12, 0.55], [-0.12, 0.55], [-0.28, 0.1]], 0.22, skin, { size: 0.04, seg: 2 }));
  body.add(cylZ(0.1, 0.5, M.enemyRed(), 12).translateY(-0.08).translateZ(0.35)); // warhead
  body.add(box(0.16, 0.08, 0.04, M.lens(), 0, 0.08, 0.58));
  const rotors: THREE.Object3D[] = [];
  for (const [x, z] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
    body.add(tube(new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(x, 0.18, z), 0.035, M.darkMetal()));
    body.add(cyl(0.07, 0.08, 0.14, M.darkMetal(), 10).translateX(x).translateY(0.2).translateZ(z));
  }
  bake(body);
  for (const [x, z] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
    const r = new THREE.Group();
    r.position.set(x, 0.29, z);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2),
      mat('rotorDisc', { color: 0x222222, transparent: true, opacity: 0.28, roughness: 0.5, depthWrite: false }),
    );
    r.add(disc);
    const blade = box(0.84, 0.01, 0.06, M.darkMetal());
    blade.castShadow = true;
    r.add(blade);
    root.add(r);
    rotors.push(r);
  }
  return { root, treads: [], wheels: [], rotors, hover: 3.2, halfWidth: 1 };
}

/** Friendly support drone: player colours, chin-mounted gun instead of a warhead. */
export function buildSupportDrone(): VehicleRig {
  const rig = buildDrone();
  const skin = mat('skin-ally-drone', { map: tiled(T.camo('nato', ['#4d5a38', '#5f4b33', '#2a2b25', '#6b7148'], 7), 2), roughness: 0.6, metalness: 0.35 });
  const blue = mat('allyNav', { color: 0x3a9cff, emissive: 0x1a6cff, emissiveIntensity: 1.2 });
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.material === M.enemyRed()) m.material = M.darkMetal();
    else if (m.material === skins.future()) m.material = skin;
  });
  const gun = new THREE.Group();
  gun.add(cylZ(0.035, 0.7, M.darkMetal(), 8).translateZ(0.45));
  gun.add(box(0.14, 0.12, 0.3, M.darkMetal()));
  gun.position.set(0, -0.14, 0.2);
  rig.root.add(gun);
  for (const s of [-1, 1]) rig.root.add(box(0.08, 0.06, 0.08, blue, s * 0.3, 0.22, -0.45));
  rig.root.scale.setScalar(1.25);
  return rig;
}


// ───────────────────────── M2 models ─────────────────────────

/** Infantry soldier (rifle or RPG). The torso is the aim pivot; legs swing when walking. */
function buildSoldier(rpg: boolean): VehicleRig {
  const root = new THREE.Group();
  const uni = mat('soldierUni', { map: tiled(T.camo('enemyG', ['#4a4f3a', '#35382c', '#5a5c47'], 37), 1.2), roughness: 0.9 });
  const gear = mat('soldierGear', { color: 0x2f3129, roughness: 0.85 });
  const skinM = mat('soldierSkin', { color: 0xb08a6a, roughness: 0.8 });
  const legs: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.12, 0.92, 0);
    leg.add(box(0.17, 0.82, 0.2, uni, 0, -0.42, 0));
    leg.add(box(0.19, 0.12, 0.3, gear, 0, -0.86, 0.05));
    root.add(leg);
    legs.push(leg);
  }
  const torso = new THREE.Group();
  torso.position.y = 0.92;
  root.add(torso);
  torso.add(box(0.44, 0.58, 0.26, uni, 0, 0.3, 0));
  torso.add(box(0.48, 0.4, 0.32, gear, 0, 0.36, 0)); // plate carrier
  torso.add(box(0.36, 0.34, 0.16, gear, 0, 0.36, -0.22)); // backpack
  torso.add(place(mesh(new THREE.SphereGeometry(0.12, 10, 8), skinM), 0, 0.74, 0.02));
  torso.add(place(mesh(new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), gear), 0, 0.76, 0));
  for (const s of [-1, 1]) torso.add(box(0.12, 0.12, 0.5, uni, s * 0.22, 0.42, 0.2).rotateY(-s * 0.25));
  const muzzle = new THREE.Object3D();
  if (rpg) {
    const tube = cylZ(0.07, 1.15, mat('rpgTube', { color: 0x4d5237, roughness: 0.7 }), 10);
    tube.position.set(0.2, 0.62, 0.1);
    torso.add(tube);
    const war = mesh(new THREE.ConeGeometry(0.1, 0.35, 10).rotateX(Math.PI / 2), M.darkMetal());
    war.position.set(0.2, 0.62, 0.84);
    torso.add(war);
    muzzle.position.set(0.2, 0.62, 1.0);
  } else {
    torso.add(box(0.06, 0.09, 0.85, M.darkMetal(), 0.1, 0.42, 0.42));
    torso.add(box(0.05, 0.16, 0.08, M.darkMetal(), 0.1, 0.32, 0.4)); // magazine
    muzzle.position.set(0.1, 0.42, 0.88);
  }
  torso.add(muzzle);
  root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return { root, turret: torso, muzzle, treads: [], wheels: [], rotors: [], legs, halfWidth: 0.3 };
}

/** Enemy attack helicopter (mini-boss). Chin gun is the aim pivot. */
function buildHelicopter(): VehicleRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = skins.enemy();
  body.add(extrudeSide([[-1.6, 0.25], [4.2, 0.35], [5.4, 0.95], [5.1, 1.65], [2.6, 2.25], [-1.9, 2.05], [-2.1, 1.1]], 1.7, skin, { size: 0.08, seg: 2 }));
  // Tandem canopy
  body.add(extrudeSide([[1.2, 1.9], [4.6, 1.5], [3.4, 2.6], [1.4, 2.7]], 1.2, M.glass(), { size: 0.06 }));
  // Tail boom, fin, stabilisers
  const boom = cylZ(0.38, 7, skin, 12, 0.14);
  boom.position.set(0, 1.55, -5.2);
  body.add(boom);
  body.add(extrudeSide([[-8.6, 1.4], [-7.6, 1.5], [-8.1, 3.3], [-8.9, 3.4]], 0.15, skin));
  body.add(box(2.4, 0.08, 0.7, skin, 0, 1.55, -7.6));
  // Stub wings with rocket pods
  body.add(box(4.2, 0.12, 0.9, skin, 0, 1.05, 0.2));
  for (const s of [-1, 1]) {
    body.add(cylZ(0.26, 1.5, M.darkMetal(), 12).translateX(s * 1.55).translateY(0.8).translateZ(0.3));
    body.add(cylZ(0.18, 1.1, mat('heliPodTip', { color: 0x6e231d, roughness: 0.6 }), 8).translateX(s * 2.05).translateY(0.8).translateZ(0.2));
    // Skids
    body.add(tube(new THREE.Vector3(s * 1.1, 0.05, -1.8), new THREE.Vector3(s * 1.1, 0.05, 2.4), 0.06, M.darkMetal()));
    body.add(tube(new THREE.Vector3(s * 1.1, 0.05, 1.5), new THREE.Vector3(s * 0.6, 0.45, 1.5), 0.05, M.darkMetal()));
    body.add(tube(new THREE.Vector3(s * 1.1, 0.05, -1.2), new THREE.Vector3(s * 0.6, 0.45, -1.2), 0.05, M.darkMetal()));
  }
  body.add(boxOn(0.9, 0.02, 0.9, M.enemyRed(), 0, 2.08, -0.8).rotateY(0.785));
  // Rotor mast & engine
  body.add(boxOn(1.3, 0.5, 2.2, skin, 0, 2.05, -0.6));
  body.add(place(cyl(0.12, 0.16, 0.6, M.darkMetal(), 10), 0, 2.85, -0.4));
  bake(body);
  const rotors: THREE.Object3D[] = [];
  const bladeMat = mat('heliBlade', { color: 0x1d1f20, roughness: 0.6 });
  const discMat = mat('heliDisc', { color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false });
  const main = new THREE.Group();
  main.position.set(0, 3.15, -0.4);
  main.add(new THREE.Mesh(new THREE.CircleGeometry(6.2, 36).rotateX(-Math.PI / 2), discMat));
  for (let i = 0; i < 4; i++) {
    const b = box(12.2, 0.05, 0.35, bladeMat);
    b.rotation.y = (i * Math.PI) / 4;
    b.castShadow = true;
    main.add(b);
  }
  root.add(main);
  rotors.push(main);
  const tailHub = new THREE.Group();
  tailHub.position.set(0.2, 2.6, -8.3);
  tailHub.rotation.z = Math.PI / 2;
  const tail = new THREE.Group();
  tail.add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 20).rotateX(-Math.PI / 2), discMat));
  for (let i = 0; i < 2; i++) tail.add(box(2.2, 0.03, 0.18, bladeMat).rotateY((i * Math.PI) / 2));
  tailHub.add(tail);
  root.add(tailHub);
  rotors.push(tail);
  // Chin gun turret
  const turret = new THREE.Group();
  turret.position.set(0, 0.25, 4.3);
  turret.add(mesh(new THREE.SphereGeometry(0.35, 12, 8), M.darkMetal()));
  const gun = new THREE.Group();
  gun.add(cylZ(0.06, 1.4, M.darkMetal(), 8).translateZ(0.8));
  turret.add(gun);
  root.add(turret);
  const muzzle = new THREE.Object3D();
  muzzle.position.z = 1.55;
  gun.add(muzzle);
  return { root, turret, gun, muzzle, treads: [], wheels: [], rotors, hover: 12, halfWidth: 2.5 };
}

/** Friendly military truck: cargo (convoy) or ambulance (field hospital). */
export function buildSupportTruck(kind: 'cargo' | 'ambulance'): VehicleRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = kind === 'ambulance' ? mat('ambWhite', { color: 0xe6e3da, roughness: 0.6 }) : skins.nato();
  const red = mat('redCross', { color: 0xb3261e, roughness: 0.6 });
  body.add(boxOn(1.1, 0.35, 7.0, M.darkMetal(), 0, 0.72, -0.3));
  body.add(extrudeSide([[1.6, 0.95], [3.4, 0.95], [3.5, 1.5], [3.1, 2.45], [1.6, 2.5]], 2.4, skin, { size: 0.04 }));
  for (const s of [-1, 1]) {
    body.add(box(0.9, 0.6, 0.05, M.glass(), s * 0.55, 2.0, 3.28).rotateX(-0.35));
    body.add(box(0.2, 0.14, 0.06, M.headlight(), s * 0.9, 1.25, 3.52));
  }
  if (kind === 'cargo') {
    body.add(boxOn(2.5, 0.3, 4.4, skin, 0, 1.0, -1.3));
    body.add(extrudeSide([[-3.5, 1.3], [0.9, 1.3], [0.9, 2.4], [0.6, 2.8], [-3.2, 2.8], [-3.5, 2.4]], 2.5, M.canvas(), { size: 0.05, seg: 2 }));
  } else {
    body.add(boxOn(2.5, 2.1, 4.4, skin, 0, 1.0, -1.3));
    for (const [x, y, z, w, h] of [[0, 3.11, -1.3, 1.4, 0.35], [0, 3.11, -1.3, 0.35, 1.4]] as const) body.add(boxOn(w, 0.02, h, red, x, y, z));
    for (const s of [-1, 1]) {
      body.add(box(0.02, 0.9, 0.28, red, s * 1.26, 2.05, -1.3));
      body.add(box(0.02, 0.28, 0.9, red, s * 1.26, 2.05, -1.3));
    }
    body.add(box(1.2, 0.12, 0.25, mat('ambLight', { color: 0x3a6cff, emissive: 0x2244ff, emissiveIntensity: 0.9 }), 0, 2.55, 2.0));
  }
  bake(body);
  const wheels: THREE.Object3D[] = [];
  for (const z of [2.4, -1.8, -3.0])
    for (const s of [-1, 1]) {
      const w = cylX(0.55, 0.45, M.rubber(), 18);
      const g = new THREE.Group();
      g.add(w, cylX(0.3, 0.47, M.darkMetal(), 10));
      g.position.set(s * 1.1, 0.55, z);
      root.add(g);
      wheels.push(g);
    }
  return { root, treads: [], wheels, rotors: [], halfWidth: 1.3 };
}

/** Enemy radio jammer tower (objective). The dish slowly turns. */
export function buildJammer(): VehicleRig {
  const root = new THREE.Group();
  const base = new THREE.Group();
  root.add(base);
  const steel = mat('jammerSteel', { color: 0x5b5f60, roughness: 0.5, metalness: 0.7 });
  base.add(boxOn(3.4, 0.5, 3.4, mat('jammerBase', { color: 0x3a3c3a, roughness: 0.9 }), 0, 0, 0));
  base.add(boxOn(1.4, 1.1, 1.0, skins.enemy(), 1.1, 0.5, 1.1)); // generator
  base.add(boxOn(1.0, 0.8, 1.4, skins.enemy(), -1.1, 0.5, -1.0));
  const top = 10;
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    base.add(tube(new THREE.Vector3(x * 0.8, 0.5, z * 0.8), new THREE.Vector3(x * 0.25, top, z * 0.25), 0.06, steel, 6));
  }
  for (let y = 1.5; y < top; y += 1.6) {
    const k = 0.8 - ((y - 0.5) / (top - 0.5)) * 0.55;
    for (const [a, b] of [[[1, 1], [-1, 1]], [[-1, 1], [-1, -1]], [[-1, -1], [1, -1]], [[1, -1], [1, 1]]] as const)
      base.add(tube(new THREE.Vector3(a[0] * k, y, a[1] * k), new THREE.Vector3(b[0] * k, y + 0.8, b[1] * k), 0.03, steel, 4));
  }
  base.add(place(cyl(0.02, 0.04, 3, steel, 5), 0, top + 1.5, 0));
  base.add(boxOn(0.8, 0.02, 0.8, M.enemyRed(), 0, 0.5, 0));
  bake(base);
  const turret = new THREE.Group();
  turret.position.y = 7;
  const dish = mesh(new THREE.SphereGeometry(1.4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat('dish', { color: 0xd0d0cc, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }));
  dish.rotation.x = -Math.PI / 2;
  dish.position.z = 0.6;
  turret.add(dish);
  turret.add(box(0.2, 0.2, 1.0, steel, 0, 0, 0.1));
  root.add(turret);
  const light = mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
  light.position.y = top + 3;
  light.name = 'beacon';
  root.add(light);
  return { root, turret, treads: [], wheels: [], rotors: [], halfWidth: 1.7 };
}

/** Explosive fuel hazards: big fuel tank on saddles or a cluster of drums. */
export function buildFuelProp(kind: 'tank' | 'drums', seed: number) {
  const g = new THREE.Group();
  const r = T.rng(seed);
  if (kind === 'tank') {
    const tankM = mat('fuelTank', { color: 0xe4e0d6, roughness: 0.45, metalness: 0.4 });
    const t = cylZ(1.2, 5.2, tankM, 20);
    t.position.y = 1.55;
    g.add(t);
    for (const z of [-2.61, 2.61]) g.add(place(mesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(z > 0 ? Math.PI / 2 : -Math.PI / 2), tankM), 0, 1.55, z));
    for (const z of [-1.7, 1.7]) g.add(boxOn(2.0, 0.5, 0.3, M.darkMetal(), 0, 0, z));
    g.add(box(0.05, 0.35, 5.2, mat('fuelStripe', { color: 0xc0281e, roughness: 0.5 }), 1.19, 1.55, 0));
    g.add(box(0.05, 0.35, 5.2, mat('fuelStripe', { color: 0xc0281e, roughness: 0.5 }), -1.19, 1.55, 0));
  } else {
    const cols = [0xb3261e, 0xc9a227, 0x2f5d8a];
    for (let i = 0; i < 5; i++) {
      const d = cyl(0.3, 0.3, 0.9, mat(`drum-${i % 3}`, { color: cols[i % 3], roughness: 0.5, metalness: 0.5 }), 12);
      d.position.set((i % 3) * 0.66 - 0.66 + (r() - 0.5) * 0.1, 0.45, Math.floor(i / 3) * 0.66 - 0.33);
      g.add(d);
    }
  }
  bake(g);
  return g;
}

// ───────────────────────── Catalogue ─────────────────────────

export const VEHICLES: VehicleInfo[] = [
  {
    id: 'striker', name: 'Striker MBT', role: tr('รถถังผู้เล่น · Main Battle Tank (มี APS)', 'Player tank · Main battle tank (with APS)'), faction: 'player', speed: 9, hp: 1000,
    build: () => buildTank({ L: 7.8, W: 3.66, tw: 0.66, H: 0.95, deck: 1.45, glacis: 1.6, wheels: 7, skin: skins.nato(), turret: 'western', ts: 1, tz: -0.35, gunLen: 5.0, gunR: 0.1, bustle: true, aps: true, skirts: true }),
  },
  {
    id: 'viper', name: 'Viper Light Tank', role: tr('รถถังผู้เล่น · เร็ว คล่อง เกราะบาง', 'Player tank · fast, agile, thin armour'), faction: 'player', speed: 13, hp: 650,
    build: () => buildTank({ L: 6.2, W: 3.0, tw: 0.5, H: 0.8, deck: 1.25, glacis: 1.1, wheels: 6, skin: skins.desert(), turret: 'light', ts: 1.05, tz: -0.1, gunLen: 3.8, gunR: 0.075, bustle: true }),
  },
  {
    id: 'buggy', name: 'Scout Buggy', role: tr('ศัตรู · เร็วมาก HP ต่ำ ปืนกล', 'Enemy · very fast, low HP, machine gun'), faction: 'enemy', speed: 16, hp: 80,
    build: buildBuggy,
  },
  {
    id: 'apc', name: 'APC 8×8', role: tr('ศัตรู · ปืนใหญ่ 30mm ปล่อยทหารราบ', 'Enemy · 30 mm autocannon, deploys infantry'), faction: 'enemy', speed: 10, hp: 300,
    build: buildAPC,
  },
  {
    id: 'light', name: 'Light Tank', role: tr('ศัตรู · เร็ว ไล่ตามตรง', 'Enemy · fast, charges straight in'), faction: 'enemy', speed: 11, hp: 280,
    build: () => buildTank({ L: 6.0, W: 3.0, tw: 0.5, H: 0.78, deck: 1.2, glacis: 1.0, wheels: 5, skin: skins.enemy(), enemy: true, turret: 'light', ts: 1, tz: 0, gunLen: 3.4, gunR: 0.07 }),
  },
  {
    id: 'medium', name: 'Medium Tank (T-series)', role: tr('ศัตรู · ระยะกลาง เกราะ ERA', 'Enemy · mid range, ERA armour'), faction: 'enemy', speed: 8, hp: 520,
    build: () => buildTank({ L: 7.0, W: 3.5, tw: 0.6, H: 0.9, deck: 1.35, glacis: 1.7, wheels: 6, skin: skins.enemy(), enemy: true, turret: 'eastern', ts: 1, tz: -0.2, gunLen: 4.8, gunR: 0.095, era: true, drums: true }),
  },
  {
    id: 'heavy', name: 'Heavy Tank', role: tr('ศัตรู · ช้ามาก เกราะหนา พังอาคาร', 'Enemy · very slow, thick armour, smashes buildings'), faction: 'enemy', speed: 5, hp: 1100,
    build: () => buildTank({ L: 8.6, W: 4.0, tw: 0.75, H: 1.05, deck: 1.6, glacis: 1.8, wheels: 8, skin: skins.enemy(), enemy: true, turret: 'heavy', ts: 1.1, tz: -0.4, gunLen: 5.6, gunR: 0.13, skirts: true, era: true }),
  },
  {
    id: 'mlrs', name: 'Rocket Launcher (MLRS)', role: tr('ศัตรู · ยิงจรวดวิถีโค้งจากระยะไกล', 'Enemy · long-range artillery rockets'), faction: 'enemy', speed: 6, hp: 220,
    build: buildMLRS,
  },
  {
    id: 'ugv', name: 'Robot Tank (UGV)', role: tr('ศัตรู · หุ่นยนต์ไร้คนขับ (อนาคต)', 'Enemy · unmanned robot (near future)'), faction: 'enemy', speed: 9, hp: 260,
    build: () => buildTank({ L: 3.6, W: 2.2, tw: 0.45, H: 0.6, deck: 0.9, glacis: 0.6, wheels: 4, skin: skins.future(), enemy: true, turret: 'robot', ts: 1.2, tz: 0, gunLen: 1.6, gunR: 0.05 }),
  },
  {
    id: 'drone', name: 'Kamikaze Drone', role: tr('ศัตรู · บินข้ามตึก ระเบิดพลีชีพ', 'Enemy · flies over buildings, suicide blast'), faction: 'enemy', speed: 14, hp: 40,
    build: buildDrone,
  },
  {
    id: 'soldier', name: 'Infantry (Rifle)', role: tr('ศัตรู · ทหารราบ รถถังบดขยี้ได้', 'Enemy · infantry, can be crushed'), faction: 'enemy', speed: 3.2, hp: 30,
    build: () => buildSoldier(false),
  },
  {
    id: 'soldier-rpg', name: 'Infantry (RPG)', role: tr('ศัตรู · ทหารยิงจรวดต่อต้านรถถัง', 'Enemy · anti-tank rocket soldier'), faction: 'enemy', speed: 3, hp: 30,
    build: () => buildSoldier(true),
  },
  {
    id: 'heli', name: 'MINI-BOSS: Attack Helicopter', role: tr('ศัตรู · บินวนยิงจากฟ้า ข้ามตึกได้', 'Enemy · circles and strafes from the air'), faction: 'enemy', speed: 12, hp: 1800,
    build: buildHelicopter,
  },
  {
    id: 'tyrant', name: 'BOSS: Desert Tyrant', role: tr('บอสบทที่ 3 · รถถังยักษ์ทะเลทราย', 'Chapter 3 boss · giant desert tank'), faction: 'enemy', speed: 3.5, hp: 5500,
    build: () => buildTank({ L: 12, W: 5.4, tw: 1.05, H: 1.35, deck: 2.05, glacis: 2.4, wheels: 10, skin: skins.desert(), enemy: true, turret: 'heavy', ts: 1.5, tz: 0.6, gunLen: 7.6, gunR: 0.18, skirts: true, era: true, drums: true, second: true }),
  },
  {
    id: 'titan', name: 'BOSS: Frost Titan', role: tr('บอสสุดท้าย · ยักษ์น้ำแข็ง ติดเรลกัน', 'Final boss · frost giant with a railgun'), faction: 'enemy', speed: 3, hp: 8000,
    build: () => buildTank({ L: 13.5, W: 6, tw: 1.15, H: 1.45, deck: 2.2, glacis: 2.6, wheels: 12, skin: skins.winter(), enemy: true, turret: 'heavy', ts: 1.7, tz: 0.9, gunLen: 9, gunR: 0.2, skirts: true, era: true, second: true, aps: true }),
  },
  {
    id: 'behemoth', name: 'BOSS: Behemoth', role: tr('บอส · Super-heavy 2 ป้อมปืน', 'Boss · super-heavy, twin turrets'), faction: 'enemy', speed: 3, hp: 8000,
    build: () => buildTank({ L: 11.5, W: 5.2, tw: 1.0, H: 1.3, deck: 2.0, glacis: 2.2, wheels: 10, skin: skins.enemy(), enemy: true, turret: 'heavy', ts: 1.45, tz: 0.8, gunLen: 7.2, gunR: 0.17, skirts: true, era: true, drums: true, second: true, aps: true }),
  },
];

// ───────────────────────── Armour kits (player tank) ─────────────────────────

/** Bolt the visual parts of an armour kit onto the Striker rig (replaces any previous kit). */
export function applyArmorKit(rig: VehicleRig, kit: string) {
  const old = rig.root.userData.kit as THREE.Object3D[] | undefined;
  for (const o of old ?? []) o.removeFromParent();
  const hull = new THREE.Group();
  const tur = new THREE.Group();
  const W = 3.66, L = 7.8;
  const green = mat('kitGreen', { color: 0x566444, roughness: 0.7, metalness: 0.3 });
  const dark = M.darkMetal();
  if (kit === 'composite') {
    for (const s of [-1, 1]) {
      hull.add(box(0.2, 0.62, L * 0.82, green, s * (W / 2 + 0.12), 0.78, 0.2));
      for (let i = 0; i < 6; i++) hull.add(box(0.24, 0.04, 0.05, dark, s * (W / 2 + 0.14), 1.05, -2.6 + i * 1.1));
    }
    hull.add(box(W * 0.7, 0.14, 1.2, green, 0, 1.28, L / 2 - 0.7).rotateX(0.32));
    tur.add(box(2.2, 0.4, 0.3, green, 0, 0.45, 2.0));
  } else if (kit === 'era') {
    for (const s of [-1, 1])
      for (let i = 0; i < 8; i++) hull.add(box(0.16, 0.5, 0.78, green, s * (W / 2 + 0.08), 0.95, -3.1 + i * 0.86));
    for (let i = -3; i <= 3; i++) hull.add(box(0.5, 0.1, 0.45, green, i * 0.52, 1.35, L / 2 - 0.35).rotateX(0.35));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) tur.add(box(0.5, 0.36, 0.4, green, s * (0.45 + i * 0.4), 0.45, 1.85 - i * 0.18).rotateY(-s * 0.35));
  } else if (kit === 'slat') {
    const bar = mat('slatBar', { color: 0x3c3f38, roughness: 0.6, metalness: 0.7 });
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 0.4);
      for (let i = 0; i <= 18; i++) hull.add(box(0.04, 1.0, 0.05, bar, x, 1.1, -3.6 + i * 0.4));
      for (const y of [0.65, 1.55]) hull.add(box(0.06, 0.06, 7.3, bar, x, y, 0));
      for (let i = 0; i <= 7; i++) tur.add(box(0.04, 0.7, 0.05, bar, s * 1.6, 0.4, -1.8 + i * 0.3));
      tur.add(box(0.05, 0.05, 2.2, bar, s * 1.6, 0.72, -0.75));
    }
    for (let i = 0; i <= 9; i++) hull.add(box(0.05, 1.0, 0.04, bar, -1.8 + i * 0.4, 1.1, -L / 2 - 0.45));
    hull.add(box(3.7, 0.06, 0.06, bar, 0, 1.55, -L / 2 - 0.45));
  } else if (kit === 'heavy') {
    for (const s of [-1, 1]) hull.add(box(0.34, 0.85, L * 0.9, green, s * (W / 2 + 0.16), 0.9, 0));
    hull.add(box(W + 0.4, 0.3, 1.5, green, 0, 1.25, L / 2 - 0.55).rotateX(0.3));
    tur.add(box(2.6, 0.55, 0.5, green, 0, 0.45, 2.05));
    for (const s of [-1, 1]) tur.add(box(0.35, 0.55, 2.4, green, s * 1.5, 0.4, 0.2));
  } else if (kit === 'aps') {
    const sensor = mat('apsSensor', { color: 0x2e3336, roughness: 0.35, metalness: 0.7 });
    const glow = mat('apsGlow', { color: 0x9ad8ff, emissive: 0x3a9cff, emissiveIntensity: 0.8 });
    const mast = cyl(0.06, 0.08, 1.2, sensor, 8);
    mast.position.set(-0.6, 1.3, -1.3);
    tur.add(mast);
    tur.add(box(0.8, 0.3, 0.3, sensor, -0.6, 1.95, -1.3));
    tur.add(box(0.6, 0.1, 0.05, glow, -0.6, 1.95, -1.14));
    for (const s of [-1, 1]) {
      const l = box(0.5, 0.35, 0.7, sensor, s * 1.45, 0.6, 0.6);
      l.rotation.y = s * 0.4;
      tur.add(l);
      tur.add(box(0.3, 0.08, 0.04, glow, s * 1.55, 0.62, 0.97).rotateY(s * 0.4));
    }
  }
  hull.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  tur.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  rig.root.add(hull);
  rig.turret?.add(tur);
  rig.root.userData.kit = [hull, tur];
}
