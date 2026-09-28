import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, bake, box, boxGeo, boxOn, cyl, cylX, extrudeSide, extrudeTop, mat, mesh, place, tiled, tube } from './kit';
import { addMacroVariation, photoMaterial } from './photo';
import * as T from './textures';

type Rand = () => number;
const pick = <X>(r: Rand, arr: X[]) => arr[Math.floor(r() * arr.length)];

// ───────────────────────── Layout ─────────────────────────

export const PITCH = 64; // block spacing
export const ROAD = 14; // road width (4 lanes × 3.5 m)
export const BLOCK = PITCH - ROAD; // 50 m incl. sidewalks
export const WALK = 3.5; // sidewalk width
export const LOT = BLOCK - WALK * 2; // 43 m buildable
export const GROUND_Y = 0.19; // top of block lots

export type District = 'suburb' | 'midtown' | 'downtown' | 'park' | 'desertTown' | 'oasis' | 'base' | 'containers' | 'warehouse' | 'dock';
export type Theme = 'city' | 'desert' | 'port' | 'winter';

/** Current visual theme; set by buildCity and used by the material/prop factories. */
let theme: Theme = 'city';
export const currentTheme = () => theme;

export interface CityOptions {
  /** Blocks from -N..N in each axis. */
  N: number;
  seed: number;
  district: (ix: number, iz: number) => District;
  theme?: Theme;
  /** Sea beyond the south edge (harbour levels): no southern spawn roads. */
  seaSouth?: boolean;
}

export interface PropMarker {
  type: 'car' | 'tree' | 'fuel' | 'pole';
  pole?: PoleKind;
  fuel?: 'tank' | 'drums';
  id: number;
  x: number;
  z: number;
  ry: number;
  seed: number;
  burnt?: boolean;
  kind?: TreeKind;
  scale?: number;
}

export type PoleKind = 'lamp' | 'traffic';

export interface BuildingInfo {
  kind: 'house' | 'tower';
  sections: THREE.Group[];
  /** Representative debris colours. */
  colors: number[];
}

export interface CityResult {
  group: THREE.Group;
  buildings: THREE.Group[];
  props: PropMarker[];
  /** Knock-down poles (lamps, traffic lights); ids are separate from `props`. */
  poles: PropMarker[];
  spawns: THREE.Vector3[];
  roads: number[];
  extent: number;
}

export function layout(N: number) {
  const roads: number[] = [];
  for (let k = -N - 0.5; k <= N + 0.5; k++) roads.push(k * PITCH);
  return { roads, extent: (N + 0.5) * PITCH + ROAD / 2 };
}

// ───────────────────────── Materials ─────────────────────────

const mats = {
  asphalt: () =>
    theme === 'winter'
      ? mat('asphalt-w', () => photoMaterial('asphalt_snow', { macro: 0.35, macroScale: 40, roughness: 0.85 }))
      : theme === 'desert'
        ? mat('asphalt-d', () => photoMaterial('asphalt_02', { macro: 0.55, macroScale: 45, normalScale: 0.8, roughness: 0.95, color: 0xc9b89a }))
        : mat('asphalt', () => photoMaterial('asphalt_02', { macro: 0.45, macroScale: 45, normalScale: 0.8, roughness: 0.95, color: 0xb8b8b8 })),
  pavement: () =>
    theme === 'winter'
      ? mat('pavement-w', () => photoMaterial('snow_02', { macro: 0.2, macroScale: 20, roughness: 0.8, color: 0xe8eef4 }))
      : theme === 'desert'
        ? mat('pavement-d', () => photoMaterial('concrete_pavement', { macro: 0.3, macroScale: 30, roughness: 0.9, color: 0xe0cca8 }))
        : mat('pavement', () => photoMaterial('concrete_pavement', { macro: 0.3, macroScale: 30, roughness: 0.9 })),
  concrete: () =>
    mat(`concrete-${theme}`, () =>
      photoMaterial('concrete_floor_02', { macro: 0.3, macroScale: 30, roughness: 0.9, tileScale: 2, color: theme === 'desert' ? 0xdccaa8 : theme === 'winter' ? 0xe6ebf0 : theme === 'port' ? 0xb8b8b4 : 0xffffff }),
    ),
  grass: () =>
    theme === 'desert'
      ? mat('grass-d', () => photoMaterial('dry_ground_01', { macro: 0.4, macroScale: 25, roughness: 1, color: 0xe6d4b0 }))
      : theme === 'winter'
        ? mat('grass-w', () => photoMaterial('snow_02', { macro: 0.22, macroScale: 25, roughness: 0.85, color: 0xf6f8fb }))
        : mat('grass', () => photoMaterial('leafy_grass', { macro: 0.45, macroScale: 25, roughness: 1, color: 0xa9cc8e })),
  outerGrass: () =>
    theme === 'desert'
      ? mat('outer-d', () => photoMaterial('aerial_sand', { macro: 0.5, macroScale: 90, roughness: 1, color: 0xf0dcb8 }))
      : theme === 'winter'
        ? mat('outer-w', () => photoMaterial('snow_02', { macro: 0.3, macroScale: 60, roughness: 0.85, tileScale: 2 }))
        : theme === 'port'
          ? mat('outer-p', () => photoMaterial('dry_ground_01', { macro: 0.4, macroScale: 60, roughness: 1, color: 0x9c988e }))
          : mat('outerGrass', () => photoMaterial('leafy_grass', { macro: 0.6, macroScale: 60, roughness: 1, color: 0x9dba84, tileScale: 1.5 })),
  roof: () =>
    theme === 'winter'
      ? mat('roofFlat-w', () => photoMaterial('snow_02', { macro: 0.2, macroScale: 12, roughness: 0.85, color: 0xf0f4f8 }))
      : mat(`roofFlat-${theme}`, () => photoMaterial('concrete_floor_02', { macro: 0.35, macroScale: 12, roughness: 0.95, color: theme === 'desert' ? 0xcdb994 : 0xa9a59c, tileScale: 1.5 })),
  rubble: () => mat('rubble', () => photoMaterial('rubble', { roughness: 1, normalScale: 1.5 })),
  capSlab: () => mat('capSlab', { color: 0x3b3936, roughness: 1 }),
  paint: () => mat('paintWhite', { color: 0xe6e3da, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  paintY: () => mat('paintYellow', { color: 0xd6a526, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  facade: (style: T.FacadeStyle, seed: number) => mat(`facade-${style}-${seed}`, {
    map: tiled(T.facade(style, seed), T.FACADE_TILE.w, T.FACADE_TILE.h),
    roughness: style === 'glass' ? 0.25 : 0.85,
    metalness: style === 'glass' ? 0.45 : 0.05,
  }),
  store: (seed: number) => mat(`store-${seed}`, { map: tiled(T.storefront(seed), 12, 4.8), roughness: 0.5, metalness: 0.2 }),
  siding: (c: string) => mat(`siding-${c}`, { map: tiled(T.siding(c), 4), roughness: 0.85 }),
  tiles: (id: 'clay_roof_tiles_02' | 'grey_roof_tiles', c: number) =>
    theme === 'winter'
      ? mat('tiles-snow', () => photoMaterial('snow_02', { color: 0xf2f6fa, roughness: 0.8, normalScale: 0.6 }))
      : mat(`tiles-${id}-${c}`, () => photoMaterial(id, { color: c, rotation: Math.PI / 2, roughness: 0.85, normalScale: 1.2 })),
  brick: () => mat('brickChimney', { map: tiled(T.facade('brick', 9), 12, 12.8), roughness: 0.9 }),
  wood: () => mat('wood', { color: 0x7a5a3c, roughness: 0.9 }),
  woodDark: () => mat('woodDark', { color: 0x4f3a28, roughness: 0.9 }),
  hedge: () =>
    theme === 'winter'
      ? mat('hedge-w', () => photoMaterial('snow_02', { color: 0xdfe8e2, roughness: 0.9 }))
      : mat(`hedge-${theme}`, () => photoMaterial('leafy_grass', { color: theme === 'desert' ? 0x9a9058 : 0x87a070, roughness: 1, tileScale: 0.6 })),
  water: () => mat('water', () => new THREE.MeshPhysicalMaterial({ color: 0x2a8fb0, roughness: 0.04, metalness: 0.1, clearcoat: 1 })),
  pond: () => mat('pond', () => new THREE.MeshPhysicalMaterial({ color: 0x33566a, roughness: 0.05, metalness: 0.2, clearcoat: 1 })),
  helipad: () => mat('helipad', { map: T.helipad(), roughness: 0.8 }),
  leaf: (i: number) => mat(`leaf-${i}`, () => photoMaterial('leafy_grass', { color: [0x9dba88, 0xb4c78c, 0x8aa878, 0xc2c07a][i], tileScale: 0.35, roughness: 0.95 })),
  conifer: () =>
    theme === 'winter'
      ? mat('conifer-w', () => photoMaterial('snow_02', { color: 0xc8d8cc, tileScale: 0.5, roughness: 0.9 }))
      : mat('conifer', () => photoMaterial('leafy_grass', { color: 0x6f8f64, tileScale: 0.35, roughness: 0.95 })),
  bark: () => mat('bark', { color: 0x4b3a2c, roughness: 1 }),
  charred: () => mat('charred', { color: 0x1d1b19, roughness: 0.95, metalness: 0.3 }),
  jersey: () => mat('jersey', () => photoMaterial('concrete_floor_02', { color: 0xd8d4c8, roughness: 0.9 })),
  sandbag: () => mat('sandbag', { color: 0x9c8a62, roughness: 1 }),
};
export const cityMats = mats;

// ───────────────────────── Helpers ─────────────────────────

/** Horizontal plane with world-metre UVs, top face at y. */
function plane(w: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w + x, uv.getY(i) * d - z);
  const m = mesh(g, material, x, y, z);
  m.castShadow = false;
  return m;
}

function marker(g: THREE.Object3D, prop: Omit<PropMarker, 'id' | 'x' | 'z' | 'ry'>, x: number, y: number, z: number, ry = 0) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.rotation.y = ry;
  o.userData.prop = prop;
  g.add(o);
}
const carAt = (g: THREE.Object3D, r: Rand, x: number, y: number, z: number, ry: number, burnt = false) =>
  marker(g, { type: 'car', seed: Math.floor(r() * 1e9), burnt }, x, y, z, ry);
const treeAt = (g: THREE.Object3D, r: Rand, x: number, y: number, z: number, kind?: TreeKind, scale?: number) =>
  marker(g, { type: 'tree', seed: Math.floor(r() * 1e9), kind, scale }, x, y, z);

// ───────────────────────── Vegetation ─────────────────────────

function blob(r: Rand, radius: number) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, 2);
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position as THREE.BufferAttribute;
  const seed = r() * 100;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.1 + seed) * Math.cos(v.y * 2.7 - seed) * Math.sin(v.z * 1.9 + seed * 0.5);
    v.multiplyScalar(1 + n * 0.22 + (r() - 0.5) * 0.08);
    v.y *= 0.8;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) + p.getZ(i) * 0.5;
    uv[i * 2 + 1] = p.getY(i) + p.getZ(i) * 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Tree model (unbaked group). */
export type TreeKind = 'broad' | 'conifer' | 'palm' | 'shrub' | 'bare';

function defaultTree(r: Rand): TreeKind {
  if (theme === 'desert') return r() > 0.45 ? 'palm' : 'shrub';
  if (theme === 'winter') return r() > 0.4 ? 'conifer' : 'bare';
  return r() > 0.8 ? 'conifer' : 'broad';
}

export function tree(r: Rand, kind: TreeKind = defaultTree(r), scale = 0.8 + r() * 0.6) {
  if (theme === 'desert' && (kind === 'broad' || kind === 'conifer')) kind = r() > 0.5 ? 'palm' : 'shrub';
  if (theme === 'winter' && kind === 'broad') kind = r() > 0.5 ? 'bare' : 'conifer';
  if (kind === 'palm') {
    const p = palm(r, scale * 0.9);
    p.rotation.y = r() * Math.PI * 2;
    return p;
  }
  const g = new THREE.Group();
  if (kind === 'shrub') {
    for (let i = 0; i < 3; i++) g.add(mesh(blob(r, 0.6 + r() * 0.4), tmats.dryBush(), (r() - 0.5) * 1.2, 0.5, (r() - 0.5) * 1.2));
  } else if (kind === 'bare') {
    const h = 3 + r() * 1.5;
    g.add(place(cyl(0.12, 0.2, h, mats.bark(), 7), 0, h / 2, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r();
      const b = cyl(0.03, 0.07, 1.8 + r(), mats.bark(), 5);
      b.position.set(Math.cos(a) * 0.5, h * 0.7 + r() * h * 0.3, Math.sin(a) * 0.5);
      b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(b);
    }
  } else if (kind === 'conifer') {
    g.add(place(cyl(0.12, 0.18, 2, mats.bark(), 7), 0, 1, 0));
    for (let i = 0; i < 3; i++) {
      const c = mesh(new THREE.ConeGeometry(1.9 - i * 0.5, 2.6, 9), mats.conifer());
      c.position.y = 2.2 + i * 1.4;
      c.rotation.y = r() * 3;
      g.add(c);
    }
  } else {
    const h = 2.4 + r() * 1;
    g.add(place(cyl(0.14, 0.22, h, mats.bark(), 7), 0, h / 2, 0));
    const leaf = mats.leaf(Math.floor(r() * 4));
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      const rr = i === 0 ? 0 : 0.9 + r() * 0.5;
      g.add(mesh(blob(r, 1.3 + r() * 0.8), leaf, Math.cos(a) * rr, h + 0.8 + r() * 0.9, Math.sin(a) * rr));
    }
  }
  g.scale.setScalar(scale);
  g.rotation.y = r() * Math.PI * 2;
  return g;
}

// ───────────────────────── Cars ─────────────────────────

const PAINTS = [0xe8e8e6, 0xb9bcbf, 0x1b1c1e, 0x8e1f1f, 0x1f3f78, 0x555a5e, 0x2f4a36, 0xc9bb9a, 0xd6d2c4, 0x6e7a86];
const paint = (c: number) => mat(`carpaint-${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 }));

/** Civilian car model (unbaked group), front = +Z. */
export function car(r: Rand, burnt = false) {
  const g = new THREE.Group();
  const kind = pick(r, ['sedan', 'sedan', 'suv', 'hatch', 'pickup', 'van'] as const);
  const body = burnt ? mats.charred() : paint(pick(r, PAINTS));
  const glass = burnt ? mats.charred() : M.glass();
  const W = kind === 'suv' || kind === 'van' || kind === 'pickup' ? 1.95 : 1.8;
  const L = kind === 'hatch' ? 4.0 : kind === 'van' ? 5.0 : kind === 'pickup' ? 5.3 : 4.6;
  const h = L / 2;
  const base = kind === 'suv' || kind === 'pickup' || kind === 'van' ? 0.45 : 0.32;
  const belt = base + (kind === 'van' ? 0.7 : 0.5);
  g.add(extrudeSide([[-h, base], [h - 0.1, base], [h, base + 0.3], [h - 0.15, belt], [-h + 0.05, belt + 0.05], [-h, base + 0.3]], W, body, { size: 0.06, seg: 2 }));
  let roofY = belt + 0.6;
  if (kind === 'van') {
    roofY = belt + 0.95;
    g.add(extrudeSide([[-h + 0.05, belt], [h - 0.9, belt], [h - 1.5, roofY], [-h + 0.1, roofY]], W - 0.1, [glass, body], { size: 0.05 }));
    g.add(box(W - 0.3, 0.04, 0.9, glass, 0, belt + 0.5, h - 1.25).rotateX(-0.9));
  } else {
    const cabFront = kind === 'pickup' ? h - 1.4 : kind === 'hatch' ? h - 1.2 : h - 1.5;
    const cabBack = kind === 'pickup' ? -0.4 : kind === 'suv' || kind === 'hatch' ? -h + 0.25 : -h + 0.9;
    const backTop = cabBack + (kind === 'sedan' ? 0.55 : 0.15);
    roofY = belt + (kind === 'suv' ? 0.75 : 0.58);
    g.add(extrudeSide([[cabBack, belt], [cabFront, belt], [cabFront - 0.65, roofY], [backTop, roofY]], W - 0.18, glass, { size: 0.04 }));
    const rl = cabFront - 0.65 - backTop;
    // The cabin's 0.04 bevel lifts the glass top to roofY + 0.04; keep the roof panel clearly above it (no z-fighting)
    g.add(boxOn(W - 0.24, 0.09, rl - 0.06, body, 0, roofY, (cabFront - 0.65 + backTop) / 2));
    if (kind === 'pickup') g.add(boxOn(W - 0.1, 0.05, 1.9, M.darkMetal(), 0, belt - 0.05, -h + 1.05));
  }
  if (!burnt) {
    for (const s of [-1, 1]) {
      g.add(box(0.35, 0.12, 0.06, M.headlight(), s * (W / 2 - 0.3), base + 0.32, h - 0.02));
      g.add(box(0.3, 0.12, 0.06, M.taillight(), s * (W / 2 - 0.25), base + 0.36, -h + 0.02));
      g.add(box(0.08, 0.1, 0.18, body, s * (W / 2 + 0.02), belt + 0.05, h - 1.55));
    }
  }
  for (const zz of [h - 0.85, -h + 0.85])
    for (const s of [-1, 1]) {
      g.add(place(cylX(0.34, 0.24, burnt ? mats.charred() : M.rubber(), 14), s * (W / 2 - 0.12), 0.34, zz));
      if (!burnt) g.add(place(cylX(0.2, 0.26, M.steel(), 10), s * (W / 2 - 0.12), 0.34, zz));
    }
  if (burnt) g.position.y = -0.12; // sits on rims
  return g;
}

// ───────────────────────── Street furniture ─────────────────────────

/** Street lamps and traffic lights are knock-down props: only a marker goes into the city, the game instances them. */
function lamp(g: THREE.Group, x: number, z: number, ry: number) {
  marker(g, { type: 'pole', pole: 'lamp', seed: 0 }, x, 0.18, z, ry);
}

function trafficLight(g: THREE.Group, x: number, z: number, ry: number) {
  marker(g, { type: 'pole', pole: 'traffic', seed: 0 }, x, 0.18, z, ry);
}

export function buildPole(kind: PoleKind) {
  return kind === 'lamp' ? buildLamp() : buildTrafficLight();
}

function buildLamp() {
  const l = new THREE.Group();
  l.add(place(cyl(0.07, 0.11, 7.5, M.darkMetal(), 8), 0, 3.75, 0));
  l.add(tube(new THREE.Vector3(0, 7.3, 0), new THREE.Vector3(0, 7.5, 1.8), 0.05, M.darkMetal()));
  l.add(box(0.35, 0.14, 0.7, M.darkMetal(), 0, 7.45, 2.0));
  l.add(box(0.28, 0.03, 0.55, M.headlight(), 0, 7.37, 2.0));
  l.add(place(cyl(0.18, 0.2, 0.5, M.darkMetal(), 8), 0, 0.25, 0));
  return l;
}

function buildTrafficLight() {
  const t = new THREE.Group();
  t.add(place(cyl(0.1, 0.13, 6.5, M.darkMetal(), 8), 0, 3.25, 0));
  t.add(tube(new THREE.Vector3(0, 6.2, 0), new THREE.Vector3(0, 6.2, 6.5), 0.07, M.darkMetal()));
  for (const zz of [3.2, 6.2]) {
    t.add(box(0.35, 1.0, 0.35, M.darkMetal(), 0, 5.6, zz));
    [0x5a0a08, 0x5a4a08, 0x0f9a3a].forEach((c, i) =>
      t.add(box(0.2, 0.2, 0.05, mat(`tl-${c}`, { color: c, emissive: i === 2 ? 0x0c8a30 : 0x000000, roughness: 0.3 }), 0.18, 5.9 - i * 0.3, zz).rotateY(Math.PI / 2)),
    );
  }
  return t;
}

function hydrant(g: THREE.Group, x: number, z: number) {
  const red = mat('hydrant', { color: 0xa8241c, roughness: 0.5, metalness: 0.3 });
  g.add(place(cyl(0.14, 0.16, 0.6, red, 10), x, 0.48, z));
  g.add(place(cyl(0.16, 0.12, 0.12, red, 10), x, 0.84, z));
  g.add(place(cylX(0.06, 0.45, red, 8), x, 0.6, z));
}

function bench(g: THREE.Group, x: number, z: number, ry: number) {
  const b = new THREE.Group();
  for (let i = 0; i < 3; i++) b.add(box(1.8, 0.05, 0.12, mats.wood(), 0, 0.45, -0.15 + i * 0.15));
  b.add(box(1.8, 0.35, 0.05, mats.wood(), 0, 0.72, -0.25));
  for (const s of [-0.8, 0.8]) b.add(boxOn(0.06, 0.45, 0.5, M.darkMetal(), s, 0, 0));
  g.add(place(b, x, 0.18, z, ry));
}

function bin(g: THREE.Group, x: number, z: number) {
  g.add(place(cyl(0.28, 0.25, 0.9, mat('bin', { color: 0x2f4a3a, roughness: 0.6, metalness: 0.3 }), 10), x, 0.63, z));
}

function busStop(g: THREE.Group, x: number, z: number, ry: number) {
  const s = new THREE.Group();
  s.add(boxOn(4, 0.08, 1.6, M.steel(), 0, 2.5, 0));
  s.add(boxOn(4, 2.4, 0.04, M.glass(), 0, 0.1, -0.75));
  for (const xx of [-1.9, 1.9]) s.add(boxOn(0.08, 2.5, 0.08, M.steel(), xx, 0, -0.7));
  s.add(boxOn(2.4, 0.08, 0.4, mats.wood(), 0, 0.45, -0.45));
  g.add(place(s, x, 0.18, z, ry));
}

/** Concrete Jersey barrier, 3 m long, along X. */
export function jersey(g: THREE.Group, x: number, z: number, ry: number) {
  const b = extrudeSide([[-0.3, 0], [0.3, 0], [0.12, 0.25], [0.08, 0.8], [-0.08, 0.8], [-0.12, 0.25]], 3, mats.jersey());
  g.add(place(new THREE.Group().add(b.rotateY(Math.PI / 2)), x, 0, z, ry));
}

function sandbags(g: THREE.Group, x: number, z: number, ry: number, r: Rand) {
  const s = new THREE.Group();
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 6 - row; i++) {
      const b = mesh(new THREE.CapsuleGeometry(0.2, 0.45, 3, 8).rotateZ(Math.PI / 2).scale(1, 0.55, 0.8), mats.sandbag());
      b.position.set(-1.2 + i * 0.55 + row * 0.27, 0.12 + row * 0.2, (r() - 0.5) * 0.08);
      b.rotation.y = (r() - 0.5) * 0.2;
      s.add(b);
    }
  g.add(place(s, x, 0, z, ry));
}

// ───────────────────────── Houses ─────────────────────────

const SIDING = ['#e7e2d4', '#cfd8dc', '#d9c9a8', '#b8c7b0', '#eee8dc', '#c9b8a6', '#9fb2c2'];
const ROOFS: ['clay_roof_tiles_02' | 'grey_roof_tiles', number][] = [
  ['clay_roof_tiles_02', 0xffffff],
  ['clay_roof_tiles_02', 0xc9a48f],
  ['grey_roof_tiles', 0xffffff],
  ['grey_roof_tiles', 0xb7a28c],
  ['grey_roof_tiles', 0x9fb0bd],
];

function gableRoof(w: number, d: number, rise: number, wallMat: THREE.Material, roofMat: THREE.Material, over = 0.5) {
  return extrudeSide([[-d / 2 - over, -0.15], [d / 2 + over, -0.15], [0, rise]], w + over * 2, [wallMat, roofMat]);
}

function windowsOn(g: THREE.Group, faceW: number, faceZ: number, ry: number, stories: number, skipCentre = false) {
  const n = Math.max(1, Math.floor(faceW / 2.8));
  const wrap = new THREE.Group();
  wrap.rotation.y = ry;
  for (let s = 0; s < stories; s++)
    for (let i = 0; i < n; i++) {
      const x = -faceW / 2 + (faceW / n) * (i + 0.5);
      if (skipCentre && s === 0 && Math.abs(x) < 1.2) continue;
      const y = 0.5 + s * 2.9 + 1.5;
      wrap.add(box(1.15, 1.35, 0.08, M.white(), x, y, faceZ + 0.03));
      wrap.add(box(0.95, 1.15, 0.06, M.glass(), x, y, faceZ + 0.06));
      wrap.add(box(1.3, 0.06, 0.18, M.white(), x, y - 0.72, faceZ + 0.08));
    }
  g.add(wrap);
}

/** Detached house, front facing +Z. Two collapse sections: [walls, roofs]. */
export function house(r: Rand) {
  const g = new THREE.Group();
  const base = new THREE.Group();
  const roofs = new THREE.Group();
  g.add(base, roofs);
  const w = 9 + r() * 3, d = 7.5 + r() * 1.5;
  const stories = r() > 0.45 ? 2 : 1;
  const wallH = 0.5 + stories * 2.9;
  const sidingC = pick(r, SIDING);
  const wall = mats.siding(sidingC);
  const [roofId, roofTint] = pick(r, ROOFS);
  const roof = mats.tiles(roofId, roofTint);
  base.add(boxOn(w + 0.2, 0.5, d + 0.2, M.concreteGrey(), 0, 0, 0));
  base.add(boxOn(w, wallH - 0.5, d, wall, 0, 0.5, 0));
  base.add(boxOn(w - 0.3, 0.05, d - 0.3, mats.capSlab(), 0, wallH, 0));
  windowsOn(base, w, d / 2, 0, stories, true);
  windowsOn(base, w, d / 2, Math.PI, stories);
  windowsOn(base, d, w / 2, Math.PI / 2, stories);
  windowsOn(base, d, w / 2, -Math.PI / 2, stories);
  base.add(boxOn(1.1, 2.2, 0.1, mats.woodDark(), 0, 0.5, d / 2 + 0.02));
  base.add(boxOn(2.6, 0.35, 1.6, M.concreteGrey(), 0, 0, d / 2 + 0.8));
  roofs.add(boxOn(3.0, 0.1, 1.9, roof, 0, 3.0, d / 2 + 0.85));
  for (const s of [-1.3, 1.3]) base.add(boxOn(0.15, 2.65, 0.15, M.white(), s, 0.35, d / 2 + 1.6));
  const rise = 1.6 + r() * 1.2;
  const rf = r() > 0.35 ? gableRoof(w, d, rise, wall, roof) : gableRoof(d, w, rise, wall, roof).rotateY(Math.PI / 2);
  rf.position.y = wallH;
  roofs.add(rf);
  if (r() > 0.4) roofs.add(boxOn(0.8, rise + 1.2, 0.8, mats.brick(), (r() - 0.5) * w * 0.5, wallH, (r() - 0.5) * d * 0.3));
  // Garage wing
  const gs = r() > 0.5 ? 1 : -1;
  const gx = gs * (w / 2 + 3.1);
  base.add(boxOn(6.2, 2.9, 6.6, wall, gx, 0.2, d / 2 - 2.7));
  base.add(boxOn(5.9, 0.05, 6.3, mats.capSlab(), gx, 3.1, d / 2 - 2.7));
  base.add(boxOn(5, 2.3, 0.08, mats.siding('#f2f0ea'), gx, 0.2, d / 2 + 0.64));
  const grf = gableRoof(6.6, 6.2, 1.3, wall, roof, 0.35).rotateY(Math.PI / 2);
  grf.position.set(gx, 3.1, d / 2 - 2.7);
  roofs.add(grf);
  // Back wing (L-shape)
  let backD = 0;
  if (r() > 0.55) {
    const bx = -gs * w * 0.2;
    base.add(boxOn(5, wallH - 0.5, 5, wall, bx, 0.5, -d / 2 - 2.2));
    base.add(boxOn(4.7, 0.05, 4.7, mats.capSlab(), bx, wallH, -d / 2 - 2.2));
    const wr = gableRoof(5, 5, rise * 0.8, wall, roof, 0.35).rotateY(Math.PI / 2);
    wr.position.set(bx, wallH, -d / 2 - 2.4);
    roofs.add(wr);
    backD = 4.7;
  }
  base.add(boxOn(0.9, 0.8, 0.5, mat('ac', { color: 0xc9c9c3, roughness: 0.6, metalness: 0.4 }), -gs * (w / 2 + 0.6), 0, -1));
  bin(base, gx + 2.6 * gs, d / 2 + 0.2);
  bake(base);
  bake(roofs);
  const info: BuildingInfo = { kind: 'house', sections: [base, roofs], colors: [new THREE.Color(sidingC).getHex(), roofTint === 0xffffff ? 0x8a4a33 : roofTint, 0x9a968c] };
  g.userData.building = info;
  g.userData.dynamic = true; // never merged into surrounding statics
  return { g, gx, gs, backD };
}

function fence(g: THREE.Group, a: THREE.Vector2, b: THREE.Vector2, h = 1.8) {
  const len = a.distanceTo(b);
  const f = new THREE.Group();
  f.add(boxOn(len, h, 0.06, mats.wood(), 0, 0, 0));
  for (let i = 0; i <= Math.floor(len / 2.4); i++) f.add(boxOn(0.12, h + 0.1, 0.12, mats.woodDark(), -len / 2 + i * 2.4, 0, 0));
  f.position.set((a.x + b.x) / 2, 0, (a.y + b.y) / 2);
  f.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  g.add(f);
}

/** One suburban lot. Returns the static yard group and the house (building). */
function suburbLot(r: Rand, size: number) {
  const lot = new THREE.Group();
  const hs = size / 2;
  const { g: h, gx, gs } = house(r);
  h.position.z = -0.5;
  const back = -hs + 0.3;
  const sideZ = -3;
  lot.add(boxOn(5, 0.04, hs - 3.2, mats.concrete(), gx, 0, (hs + 3.2) / 2 + 0.1));
  lot.add(boxOn(1.2, 0.03, hs - 5.6, mats.pavement(), 0, 0, (hs + 5.6) / 2 - 0.3));
  fence(lot, new THREE.Vector2(-hs + 0.3, back), new THREE.Vector2(hs - 0.3, back));
  fence(lot, new THREE.Vector2(-hs + 0.3, back), new THREE.Vector2(-hs + 0.3, sideZ));
  fence(lot, new THREE.Vector2(hs - 0.3, back), new THREE.Vector2(hs - 0.3, sideZ));
  lot.add(boxOn(0.9, 1.1, 2 * hs - 9, mats.hedge(), -gs * (hs - 0.6), 0, (sideZ + hs - 3) / 2));
  if (r() > 0.45) {
    lot.add(boxOn(7.2, 0.12, 3.8, M.concreteGrey(), -gs * 3, 0, back + 3.1));
    lot.add(boxOn(6.4, 0.13, 3.0, mats.water(), -gs * 3, 0, back + 3.1));
  } else {
    lot.add(boxOn(4, 0.05, 3, mats.woodDark(), -gs * 3, 0, back + 3.2));
    for (const dx of [-1, 1]) lot.add(boxOn(0.6, 0.45, 0.6, mats.wood(), -gs * 3 + dx, 0, back + 3.2));
  }
  for (const [x, z] of [[-gs * (hs - 3), hs - 3], [gs * (hs - 2.5), back + 2.5], [-gs * (hs - 2.5), back + 2.5]])
    if (r() > 0.3) treeAt(lot, r, x + (r() - 0.5), 0, z + (r() - 0.5));
  if (r() > 0.3) carAt(lot, r, gx, 0.05, hs - 3.5 - r(), r() > 0.5 ? 0 : Math.PI);
  return { lot, house: h };
}

// ───────────────────────── Towers / apartments ─────────────────────────

function rooftop(g: THREE.Group, r: Rand, w: number, d: number, y: number, big: boolean) {
  const conc = M.concreteGrey();
  g.add(boxOn(w, 0.3, d, mats.roof(), 0, y, 0));
  const ph = 1.0;
  g.add(boxOn(w, ph, 0.3, conc, 0, y, d / 2 - 0.15));
  g.add(boxOn(w, ph, 0.3, conc, 0, y, -d / 2 + 0.15));
  g.add(boxOn(0.3, ph, d - 0.6, conc, w / 2 - 0.15, y, 0));
  g.add(boxOn(0.3, ph, d - 0.6, conc, -w / 2 + 0.15, y, 0));
  const sx = (r() - 0.5) * w * 0.4, sz = (r() - 0.5) * d * 0.4;
  g.add(boxOn(4, 3, 3.4, mats.facade('office', 3), sx, y + 0.3, sz));
  g.add(boxOn(4.3, 0.2, 3.7, conc, sx, y + 3.3, sz));
  const acMat = mat('rooftopAC', { color: 0xbfc1bd, roughness: 0.55, metalness: 0.5 });
  const nAc = 2 + Math.floor(r() * (big ? 6 : 3));
  for (let i = 0; i < nAc; i++) {
    const ax = (r() - 0.5) * (w - 5), az = (r() - 0.5) * (d - 5);
    if (Math.abs(ax - sx) < 3.5 && Math.abs(az - sz) < 3) continue;
    g.add(boxOn(2.2, 1.1, 1.4, acMat, ax, y + 0.3, az));
    for (const f of [-0.5, 0.5]) g.add(place(cyl(0.45, 0.45, 0.06, M.darkMetal(), 14), ax + f, y + 1.43, az));
  }
  // Roof vents & skylights
  for (let i = 0; i < 3; i++) {
    const vx = (r() - 0.5) * (w - 4), vz = (r() - 0.5) * (d - 4);
    g.add(place(cyl(0.25, 0.25, 0.6, M.steel(), 10), vx, y + 0.6, vz));
  }
  if (r() > 0.4) {
    const tx = -sx * 0.8, tz = -sz * 0.8 + 2;
    for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) g.add(boxOn(0.12, 1.6, 0.12, M.darkMetal(), tx + lx, y + 0.3, tz + lz));
    g.add(place(cyl(1.3, 1.3, 2.2, mat('tank', { color: 0x8c7a62, roughness: 0.8 }), 16), tx, y + 3.0, tz));
    g.add(place(new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.6, 16), mat('tankTop', { color: 0x5b5048, roughness: 0.8 })), tx, y + 4.4, tz));
  }
  if (big && r() > 0.5) {
    const solar = mat('solar', { color: 0x1d2a3d, roughness: 0.15, metalness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const p = box(3, 0.06, 1.4, solar, -w / 2 + 3, y + 0.8, -d / 2 + 2.5 + i * 1.8);
      p.rotation.x = 0.35;
      g.add(p);
    }
  }
  if (r() > 0.5) g.add(place(cyl(0.05, 0.1, 6, M.darkMetal(), 6), sx + 1.5, y + 6.3, sz));
}

const FACADE_COLOR: Record<T.FacadeStyle, number> = { glass: 0x55666d, office: 0xc9c4b8, apartment: 0xcdbfa8, brick: 0x8a4f3a };

/** Multi-storey building split into collapse sections (podium, 4-floor chunks, crown). */
function building(r: Rand, w: number, d: number, floors: number, style: T.FacadeStyle, shops: boolean, helipad = false) {
  const g = new THREE.Group();
  const sections: THREE.Group[] = [];
  const seed = 1 + Math.floor(r() * 3);
  const facadeMat = mats.facade(style, seed);
  const cap = (s: THREE.Group, y: number, cw: number, cd: number) => s.add(boxOn(cw - 0.3, 0.05, cd - 0.3, mats.capSlab(), 0, y, 0));
  let y = 0;
  if (shops) {
    const s = new THREE.Group();
    s.add(boxOn(w, 4.8, d, mats.store(1 + Math.floor(r() * 3)), 0, 0, 0));
    s.add(boxOn(w + 1.4, 0.25, d + 1.4, M.concreteGrey(), 0, 4.6, 0));
    y = 4.8;
    cap(s, y, w, d);
    sections.push(s);
  }
  for (let f = 0; f < floors; f += 4) {
    const n = Math.min(4, floors - f);
    const s = new THREE.Group();
    s.add(boxOn(w, n * 3.2, d, facadeMat, 0, y, 0));
    y += n * 3.2;
    if (style !== 'glass' && f + n < floors) s.add(boxOn(w + 0.3, 0.2, d + 0.3, M.concreteGrey(), 0, y - 0.1, 0));
    cap(s, y, w, d);
    sections.push(s);
  }
  let rw = w, rd = d;
  const crown = new THREE.Group();
  if (floors >= 9 && r() > 0.4) {
    crown.add(boxOn(w + 0.2, 0.4, d + 0.2, M.concreteGrey(), 0, y, 0));
    crown.add(boxOn(w, 0.1, d, mats.roof(), 0, y + 0.4, 0));
    rw = w * 0.7;
    rd = d * 0.7;
    const extra = 2 + Math.floor(r() * 3);
    crown.add(boxOn(rw, extra * 3.2, rd, facadeMat, 0, y + 0.4, 0));
    y += 0.4 + extra * 3.2;
  }
  rooftop(crown, r, rw, rd, y, floors > 6);
  if (helipad) crown.add(boxOn(10, 0.05, 10, mats.helipad(), -rw * 0.1, y + 0.3, rd * 0.1));
  // Merge the crown into the last body section so the roof goes with it
  const last = sections[sections.length - 1];
  for (const c of [...crown.children]) last.add(c);
  for (const s of sections) {
    bake(s);
    g.add(s);
  }
  const info: BuildingInfo = { kind: 'tower', sections, colors: [FACADE_COLOR[style], 0x9e9a92, 0x6d6a64] };
  g.userData.building = info;
  g.userData.dynamic = true;
  return g;
}

// ───────────────────────── Blocks ─────────────────────────

function sidewalkProps(g: THREE.Group, r: Rand, district: District) {
  const hb = BLOCK / 2;
  const inset = hb - 0.9;
  for (let i = -1; i <= 1; i++) {
    const t = i * 16;
    lamp(g, t, inset, 0);
    lamp(g, t, -inset, Math.PI);
    lamp(g, inset, t, Math.PI / 2);
    lamp(g, -inset, t, -Math.PI / 2);
  }
  if (district === 'downtown' || district === 'midtown') {
    const pit = mat('treePit', { color: 0x3b3128, roughness: 1 });
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const t = i * 9 + 4;
      for (const [x, z] of [[t, hb - 1.8], [t, -hb + 1.8], [hb - 1.8, t], [-hb + 1.8, t]]) {
        if (r() < 0.35) continue;
        g.add(boxOn(1.4, 0.03, 1.4, pit, x, 0.18, z));
        treeAt(g, r, x, 0.18, z, 'broad', 0.75 + r() * 0.3);
      }
    }
  }
  hydrant(g, hb - 1, hb - 5);
  hydrant(g, -hb + 1, -hb + 7);
  bin(g, hb - 1.2, -7);
  bin(g, -7, hb - 1.2);
  if (district !== 'suburb') {
    bench(g, -hb + 2.2, 4, Math.PI / 2);
    busStop(g, 6, hb - 2.2, Math.PI);
  }
}

function buildBlock(ix: number, iz: number, d: District, seed: number) {
  const r = T.rng(seed + ix * 31 + iz * 977);
  const g = new THREE.Group();
  g.position.set(ix * PITCH, 0, iz * PITCH);
  g.add(box(BLOCK, 0.18, BLOCK, mats.pavement(), 0, 0.09, 0));
  const statics = new THREE.Group();
  g.add(statics);
  sidewalkProps(statics, r, d);
  const buildings: THREE.Group[] = [];

  if (d === 'desertTown') desertTownBlock(g, statics, r, buildings);
  else if (d === 'oasis') oasisBlock(statics, r);
  else if (d === 'base') baseBlock(g, statics, r, buildings);
  else if (d === 'containers') containerBlock(g, statics, r, buildings);
  else if (d === 'warehouse') warehouseBlock(g, statics, r, buildings);
  else if (d === 'dock') dockBlock(g, statics, r, buildings);
  else if (d === 'suburb') {
    statics.add(plane(LOT, LOT, mats.grass(), 0, GROUND_Y, 0));
    const ls = LOT / 2;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const { lot, house: h } = suburbLot(r, ls);
        const holder = new THREE.Group();
        holder.position.set((sx * ls) / 2, GROUND_Y, (sz * ls) / 2);
        holder.rotation.y = sz > 0 ? 0 : Math.PI;
        holder.add(lot, h);
        statics.add(holder);
        buildings.push(h);
      }
  } else if (d === 'park') {
    statics.add(plane(LOT, LOT, mats.grass(), 0, GROUND_Y, 0));
    for (const a of [Math.PI / 4, -Math.PI / 4]) statics.add(boxOn(3, 0.04, LOT * 1.35, mats.pavement(), 0, GROUND_Y, 0).rotateY(a));
    statics.add(boxOn(3, 0.04, LOT, mats.pavement(), 0, GROUND_Y, 0));
    statics.add(boxOn(LOT, 0.04, 3, mats.pavement(), 0, GROUND_Y, 0));
    statics.add(place(cyl(7, 7, 0.1, mats.concrete(), 32), 0, 0.24, 0));
    statics.add(place(new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.3, 8, 40).rotateX(Math.PI / 2), M.concreteGrey()), 0, 0.55, 0));
    statics.add(place(cyl(4.4, 4.4, 0.4, mats.pond(), 32), 0, 0.35, 0));
    statics.add(place(cyl(0.8, 1.1, 1.8, M.concreteGrey(), 16), 0, 1.0, 0));
    statics.add(place(cyl(1.6, 1.6, 0.2, M.concreteGrey(), 20), 0, 1.9, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      bench(statics, Math.cos(a) * 9, Math.sin(a) * 9, -a + Math.PI / 2);
    }
    for (let i = 0; i < 26; i++) {
      const x = (r() - 0.5) * (LOT - 4), z = (r() - 0.5) * (LOT - 4);
      if (Math.hypot(x, z) < 11 || Math.abs(x) < 2.5 || Math.abs(z) < 2.5 || Math.abs(Math.abs(x) - Math.abs(z)) < 2.5) continue;
      treeAt(statics, r, x, GROUND_Y, z);
    }
  } else {
    statics.add(plane(LOT, LOT, mats.concrete(), 0, GROUND_Y, 0));
    const downtown = d === 'downtown';
    const lay = r();
    const styles: T.FacadeStyle[] = downtown ? ['glass', 'office', 'glass', 'apartment'] : ['apartment', 'brick', 'office'];
    const floors = () => (downtown ? 6 + Math.floor(r() * 7) : 3 + Math.floor(r() * 3));
    const add = (w: number, dd: number, x: number, z: number, helipad = false) => {
      const b = building(r, w, dd, floors(), pick(r, styles), true, helipad);
      b.position.set(x, GROUND_Y, z);
      buildings.push(b);
    };
    if (downtown && lay < 0.35) {
      add(30, 28, 0, -3, r() > 0.5);
      for (const x of [-12, 0, 12]) {
        statics.add(boxOn(3, 0.6, 3, M.concreteGrey(), x, GROUND_Y, 16.5));
        treeAt(statics, r, x, 0.79, 16.5, 'broad', 0.7);
      }
    } else if (lay < 0.7) {
      add(19, 38, -10.5, 0);
      add(19, 26, 10.5, -6);
      carAt(statics, r, 10, GROUND_Y, 14, Math.PI / 2);
      carAt(statics, r, 13, GROUND_Y, 17, Math.PI / 2 + 0.1);
    } else {
      for (const [x, z] of [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]]) add(19, 19, x, z);
    }
    for (const b of buildings) g.add(b);
  }
  bake(statics);
  return { group: g, buildings };
}

// ───────────────────────── Themed districts (chapters 3–5) ─────────────────────────

const SAND_TINTS = [0xf2e3c8, 0xe9d4b2, 0xdcc3a0, 0xf6ecdc, 0xe2c9a6];
const CONTAINER_TINTS = [0xc04a3a, 0x3f6f9e, 0x3e7d55, 0xe0943a, 0x9aa0a6, 0xd8c85a, 0x8a4a8a];

const tmats = {
  sandstone: (c: number) => mat(`sandstone-${c}`, () => photoMaterial('sandstone_brick_wall_01', { color: c, roughness: 0.95, normalScale: 0.8 })),
  plaster: (c: number) => mat(`plaster-${c}`, () => photoMaterial('concrete_floor_02', { color: c, roughness: 0.95, macro: 0.3, macroScale: 8, tileScale: 1.5 })),
  corrugated: (c: number) => mat(`corrugated-${c}`, () => photoMaterial('corrugated_iron_02', { color: c, roughness: 0.6, normalScale: 1.2 })),
  container: (c: number) => mat(`container-${c}`, () => photoMaterial('container_side', { color: c, roughness: 0.6 })),
  shutter: () => mat('shutter', { color: 0x6b4a2e, roughness: 0.9 }),
  recess: () => mat('windowRecess', { color: 0x1c1a17, roughness: 1 }),
  steelYellow: () => mat('steelYellow', { color: 0xd8a526, roughness: 0.5, metalness: 0.5 }),
  steelRed: () => mat('steelRed', { color: 0xa8321e, roughness: 0.55, metalness: 0.4 }),
  hull: () => mat('hull', { color: 0x7a2a20, roughness: 0.6, metalness: 0.3 }),
  hullDark: () => mat('hullDark', { color: 0x22262a, roughness: 0.6, metalness: 0.3 }),
  frond: () => mat('palmFrond', () => photoMaterial('leafy_grass', { color: 0x7fa04a, tileScale: 0.35, roughness: 0.9 })),
  dryBush: () => mat('dryBush', () => photoMaterial('leafy_grass', { color: 0xa39a5a, tileScale: 0.35, roughness: 1 })),
  sea: () => mat('sea', () => new THREE.MeshPhysicalMaterial({ color: 0x2b4a5c, roughness: 0.12, metalness: 0.1, clearcoat: 1 })),
};

/** Sectioned building helper: bakes each section and tags the group as destructible. */
function sectioned(sections: THREE.Group[], colors: number[]) {
  const g = new THREE.Group();
  for (const s of sections) {
    bake(s);
    g.add(s);
  }
  g.userData.building = { kind: 'tower', sections, colors } as BuildingInfo;
  g.userData.dynamic = true;
  return g;
}

function palm(r: Rand, scale: number) {
  const g = new THREE.Group();
  const bark = mat('palmBark', { color: 0x8a7050, roughness: 1 });
  let x = 0, z = 0;
  const lean = (r() - 0.5) * 0.25, leanZ = (r() - 0.5) * 0.25;
  for (let i = 0; i < 6; i++) {
    const seg = cyl(0.2 - i * 0.015, 0.24 - i * 0.015, 1.1, bark, 7);
    seg.position.set(x, 0.55 + i * 1.05, z);
    seg.rotation.set(leanZ * i * 0.3, 0, -lean * i * 0.3);
    g.add(seg);
    x += lean * 0.4;
    z += leanZ * 0.4;
  }
  const top = new THREE.Vector3(x, 6.6, z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.3;
    const f = box(0.9, 0.04, 3.4, tmats.frond());
    f.geometry.translate(0, 0, 1.7);
    f.position.copy(top);
    f.rotation.set(0.45 + r() * 0.3, a, 0, 'YXZ');
    g.add(f);
  }
  g.scale.setScalar(scale);
  return g;
}

/** Flat-roofed adobe/sandstone house; one collapse section per storey. */
function adobeHouse(r: Rand) {
  const w = 8 + r() * 5, d = 7.5 + r() * 4;
  const stories = r() > 0.55 ? 2 : 1;
  const tint = pick(r, SAND_TINTS);
  // Most desert houses are plastered; some show bare sandstone brick
  const wall = r() > 0.3 ? tmats.plaster(tint) : tmats.sandstone(tint);
  const sections: THREE.Group[] = [];
  for (let s = 0; s < stories; s++) {
    const sec = new THREE.Group();
    const y = s * 3.4;
    sec.add(boxOn(w, 3.4, d, wall, 0, y, 0));
    sec.add(boxOn(w - 0.3, 0.05, d - 0.3, mats.capSlab(), 0, y + 3.4, 0));
    // Small deep windows with wooden shutters
    for (const [faceW, off, ry] of [[w, d / 2, 0], [w, d / 2, Math.PI], [d, w / 2, Math.PI / 2], [d, w / 2, -Math.PI / 2]] as const) {
      const n = Math.max(1, Math.floor(faceW / 3.2));
      const wrap = new THREE.Group();
      wrap.rotation.y = ry;
      for (let i = 0; i < n; i++) {
        const x = -faceW / 2 + (faceW / n) * (i + 0.5);
        if (s === 0 && ry === 0 && Math.abs(x) < 1) continue;
        wrap.add(box(0.8, 1.0, 0.1, tmats.recess(), x, y + 1.9, off + 0.02));
        if (r() > 0.4) wrap.add(box(0.4, 1.0, 0.06, tmats.shutter(), x - 0.62, y + 1.9, off + 0.06));
      }
      sec.add(wrap);
    }
    if (s === 0) sec.add(boxOn(1.1, 2.2, 0.1, tmats.shutter(), 0, 0, d / 2 + 0.03));
    sections.push(sec);
  }
  // Roof: parapet lip, water tank, dish
  const top = sections[sections.length - 1];
  const h = stories * 3.4;
  top.add(boxOn(w, 0.1, d, mats.roof(), 0, h, 0));
  for (const [bw, bd, x, z] of [[w, 0.25, 0, d / 2 - 0.12], [w, 0.25, 0, -d / 2 + 0.12], [0.25, d, w / 2 - 0.12, 0], [0.25, d, -w / 2 + 0.12, 0]] as const) top.add(boxOn(bw, 0.6, bd, wall, x, h, z));
  if (r() > 0.3) {
    const tx = (r() - 0.5) * (w - 3), tz = (r() - 0.5) * (d - 3);
    for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) top.add(boxOn(0.08, 1.0, 0.08, M.darkMetal(), tx + lx, h, tz + lz));
    top.add(place(cyl(0.75, 0.75, 1.3, mat('roofTankBlack', { color: 0x2a2b2c, roughness: 0.6 }), 14), tx, h + 1.65, tz));
  }
  if (r() > 0.5) top.add(place(mesh(new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(-1.1), M.white()), (r() - 0.5) * (w - 2), h + 0.9, (r() - 0.5) * (d - 2)));
  return { g: sectioned(sections, [tint, 0xc8b08a, 0x8a7a64]), w, d };
}

function desertTownBlock(g: THREE.Group, statics: THREE.Group, r: Rand, buildings: THREE.Group[]) {
  statics.add(plane(LOT, LOT, mats.grass(), 0, GROUND_Y, 0));
  const ls = LOT / 2;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const cx = (sx * ls) / 2, cz = (sz * ls) / 2;
      const { g: h } = adobeHouse(r);
      h.position.set(cx + (r() - 0.5) * 3, GROUND_Y, cz + (r() - 0.5) * 3);
      h.rotation.y = (Math.floor(r() * 4) * Math.PI) / 2;
      g.add(h);
      buildings.push(h);
      // Courtyard wall with a gate gap
      const wall = tmats.plaster(pick(r, SAND_TINTS));
      const e = ls / 2 - 0.6;
      statics.add(boxOn(ls - 1.2, 1.9, 0.35, wall, cx, GROUND_Y, cz - e));
      statics.add(boxOn(0.35, 1.9, ls - 1.2, wall, cx - e, GROUND_Y, cz));
      statics.add(boxOn(0.35, 1.9, ls - 1.2, wall, cx + e, GROUND_Y, cz));
      statics.add(boxOn(ls / 2 - 3, 1.9, 0.35, wall, cx - ls / 4 - 1.2, GROUND_Y, cz + e));
      statics.add(boxOn(ls / 2 - 3, 1.9, 0.35, wall, cx + ls / 4 + 1.2, GROUND_Y, cz + e));
      for (let i = 0; i < 2; i++) if (r() > 0.3) treeAt(statics, r, cx + (r() - 0.5) * (ls - 5), GROUND_Y, cz + (r() > 0.5 ? 1 : -1) * (ls / 2 - 2.5));
      if (r() > 0.5) carAt(statics, r, cx + (r() - 0.5) * 6, GROUND_Y, cz + ls / 2 - 3, Math.PI / 2);
    }
}

function oasisBlock(statics: THREE.Group, r: Rand) {
  statics.add(plane(LOT, LOT, mats.grass(), 0, GROUND_Y, 0));
  statics.add(place(cyl(9, 9.6, 0.4, mats.pond(), 40), 0, 0.2, 0));
  statics.add(place(new THREE.Mesh(new THREE.TorusGeometry(9.3, 0.5, 8, 48).rotateX(Math.PI / 2), tmats.sandstone(0xe9d4b2)), 0, 0.45, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3, d = 11 + r() * 8;
    treeAt(statics, r, Math.cos(a) * d, GROUND_Y, Math.sin(a) * d, 'palm');
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    bench(statics, Math.cos(a) * 19, Math.sin(a) * 19, -a + Math.PI / 2);
  }
}

function hangar(r: Rand, L: number, R: number) {
  const roofMat = tmats.corrugated(pick(r, [0xf0ece0, 0xd8e0c8, 0xfff0d8]));
  const walls = new THREE.Group();
  const roof = new THREE.Group();
  // End walls (half discs) and a dark open door
  for (const s of [-1, 1]) {
    const endG = new THREE.CircleGeometry(R, 20, 0, Math.PI);
    const end = mesh(endG, roofMat);
    end.position.set(0, 0, (s * L) / 2);
    if (s < 0) end.rotation.y = Math.PI;
    walls.add(end);
  }
  walls.add(boxOn(R * 1.2, R * 0.75, 0.1, tmats.recess(), 0, 0, L / 2 + 0.03));
  walls.add(boxOn(R * 2 - 0.4, 0.05, L - 0.4, mats.capSlab(), 0, 0.8, 0));
  const arc = new THREE.CylinderGeometry(R, R, L, 24, 1, true, -Math.PI / 2, Math.PI);
  arc.rotateX(-Math.PI / 2); // axis along Z, arch above the ground
  const uv = arc.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * R, uv.getY(i) * L);
  const shellMat = mat('hangarShell', () => {
    const m = photoMaterial('corrugated_iron_02', { color: 0xffffff, roughness: 0.55, normalScale: 1.2 });
    m.side = THREE.DoubleSide;
    return m;
  });
  roof.add(mesh(arc, shellMat));
  return sectioned([walls, roof], [0xb8b4a8, 0x8a8a80, 0x6a6a64]);
}

function baseBlock(g: THREE.Group, statics: THREE.Group, r: Rand, buildings: THREE.Group[]) {
  statics.add(plane(LOT, LOT, mats.concrete(), 0, GROUND_Y, 0));
  // Perimeter T-walls with gates in the middle of each side
  const tw = mat('tWall', () => photoMaterial('concrete_floor_02', { color: 0xd8ccb4, roughness: 0.95 }));
  const e = LOT / 2 - 0.6;
  for (let t = -e + 1; t <= e - 1; t += 1.35) {
    if (Math.abs(t) < 4) continue;
    statics.add(boxOn(1.25, 3.2, 0.35, tw, t, GROUND_Y, e));
    statics.add(boxOn(1.25, 3.2, 0.35, tw, t, GROUND_Y, -e));
    statics.add(boxOn(0.35, 3.2, 1.25, tw, e, GROUND_Y, t));
    statics.add(boxOn(0.35, 3.2, 1.25, tw, -e, GROUND_Y, t));
  }
  const add = (b: THREE.Group, x: number, z: number, ry = 0) => {
    b.position.set(x, GROUND_Y, z);
    b.rotation.y = ry;
    g.add(b);
    buildings.push(b);
  };
  if (r() > 0.5) {
    add(hangar(r, 22, 8), -9, -4);
    // Barracks
    for (const z of [-12, 4]) {
      const wall = tmats.sandstone(0xe2d2b4);
      const s1 = new THREE.Group();
      s1.add(boxOn(8, 3.6, 16, wall, 0, 0, 0));
      s1.add(boxOn(7.7, 0.05, 15.7, mats.capSlab(), 0, 3.6, 0));
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) s1.add(box(0.1, 1, 1.2, tmats.recess(), sx * 4.02, 2, -6 + i * 4));
      const s2 = new THREE.Group();
      s2.add(boxOn(8.6, 0.25, 16.6, tmats.corrugated(0xe8e8e0), 0, 3.6, 0));
      add(sectioned([s1, s2], [0xe2d2b4, 0xa8a8a0]), 12, z);
    }
  } else {
    // Bunkers + watchtower + helipad
    for (const [x, z] of [[-10, -10], [10, 8]]) {
      const s = new THREE.Group();
      const c = mat('bunkerConc', () => photoMaterial('concrete_floor_02', { color: 0xcfc2a8, roughness: 1 }));
      s.add(boxOn(10, 2.8, 7, c, 0, 0, 0));
      s.add(boxOn(11, 0.6, 8, c, 0, 2.8, 0));
      s.add(box(6, 0.35, 0.1, tmats.recess(), 0, 1.9, 3.52));
      for (let i = 0; i < 10; i++) s.add(box(1.2, 0.35, 0.6, mats.sandbag(), -5 + i * 1.1, 3.6, 3.2));
      add(sectioned([s], [0xcfc2a8, 0x9c8a62]), x, z);
    }
    statics.add(plane(12, 12, mats.helipad(), 10, GROUND_Y + 0.02, -10));
    const tower = new THREE.Group();
    for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) tower.add(boxOn(0.25, 7, 0.25, M.darkMetal(), lx, 0, lz));
    const cabin = new THREE.Group();
    cabin.add(boxOn(3.4, 0.2, 3.4, mats.wood(), 0, 7, 0));
    cabin.add(boxOn(3.4, 1.1, 0.12, mats.woodDark(), 0, 7.2, 1.65));
    cabin.add(boxOn(3.4, 1.1, 0.12, mats.woodDark(), 0, 7.2, -1.65));
    cabin.add(boxOn(3.8, 0.15, 3.8, tmats.corrugated(0x8a8a80), 0, 9.3, 0));
    for (const [lx, lz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) cabin.add(boxOn(0.12, 2.1, 0.12, M.darkMetal(), lx, 7.2, lz));
    add(sectioned([tower, cabin], [0x5a5a54, 0x7a5a3c]), -12, 12);
  }
  // Sandbag positions + fuel dump
  sandbags(statics, -4, 18, 0, r);
  sandbags(statics, 18, -2, Math.PI / 2, r);
  marker(statics, { type: 'fuel', seed: Math.floor(r() * 1e9), fuel: 'drums' }, 3, GROUND_Y, 14);
  if (r() > 0.4) marker(statics, { type: 'fuel', seed: Math.floor(r() * 1e9), fuel: 'tank' }, -16, GROUND_Y, 16, Math.PI / 2);
}

function containerStack(r: Rand, tiers: number, long: boolean) {
  const L = long ? 12.2 : 6.1, W = 2.44, H = 2.6;
  const sections: THREE.Group[] = [];
  const tints: number[] = [];
  for (let t = 0; t < tiers; t++) {
    const c = pick(r, CONTAINER_TINTS);
    tints.push(c);
    const s = new THREE.Group();
    s.add(boxOn(W, H, L, tmats.container(c), 0, t * H, 0));
    s.add(box(W + 0.02, H - 0.2, 0.05, mat(`contDoor-${c}`, { color: new THREE.Color(c).multiplyScalar(0.6).getHex(), roughness: 0.6, metalness: 0.3 }), 0, t * H + H / 2, L / 2 + 0.01));
    sections.push(s);
  }
  return sectioned(sections, [...tints, 0x5a5a54]);
}

function gantryCrane(statics: THREE.Group, x: number, z: number, span: number, h: number, ry: number) {
  const c = new THREE.Group();
  const y = tmats.steelYellow();
  for (const sx of [-1, 1]) {
    c.add(boxOn(0.6, h, 0.6, y, (sx * span) / 2, 0, -3));
    c.add(boxOn(0.6, h, 0.6, y, (sx * span) / 2, 0, 3));
    c.add(boxOn(0.8, 0.8, 7, y, (sx * span) / 2, 0, 0));
  }
  c.add(boxOn(span + 1, 1.2, 1, y, 0, h, -3));
  c.add(boxOn(span + 1, 1.2, 1, y, 0, h, 3));
  c.add(boxOn(3, 2, 7, mat('craneCab', { color: 0xe6e2d6, roughness: 0.6 }), span * 0.2, h - 1.5, 0));
  c.position.set(x, GROUND_Y, z);
  c.rotation.y = ry;
  occluder(c);
  statics.add(c);
}

/** Tall decoration that should turn translucent when it blocks the view of the tank. */
function occluder(g: THREE.Group) {
  bake(g);
  g.userData.dynamic = true; // keep it out of the merged statics
  g.userData.occluder = true;
}

function containerBlock(g: THREE.Group, statics: THREE.Group, r: Rand, buildings: THREE.Group[]) {
  statics.add(plane(LOT, LOT, mats.concrete(), 0, GROUND_Y, 0));
  // Rows of stacks along X with drivable aisles
  for (const z of [-15, -6.5, 6.5, 15]) {
    for (const x of [-13, 0.5, 14]) {
      if (r() < 0.15) continue;
      const long = r() > 0.35;
      const tiers = 1 + Math.floor(r() * 3);
      for (const dz of [-1.3, 1.3]) {
        if (r() < 0.25) continue;
        const st = containerStack(r, Math.max(1, tiers - (r() > 0.6 ? 1 : 0)), long);
        st.position.set(x + (long ? 0 : (r() - 0.5) * 6), GROUND_Y, z + dz);
        st.rotation.y = Math.PI / 2;
        g.add(st);
        buildings.push(st);
      }
    }
  }
  gantryCrane(statics, 0, -10.8, 40, 14, 0);
  marker(statics, { type: 'fuel', seed: Math.floor(r() * 1e9), fuel: 'drums' }, 20, GROUND_Y, 0.2);
}

function warehouseBlock(g: THREE.Group, statics: THREE.Group, r: Rand, buildings: THREE.Group[]) {
  statics.add(plane(LOT, LOT, mats.concrete(), 0, GROUND_Y, 0));
  const one = r() > 0.5;
  const specs: [number, number, number, number][] = one ? [[36, 24, 0, -4]] : [[17, 34, -10.5, 0], [17, 26, 10.5, -4]];
  for (const [w, d, x, z] of specs) {
    const h = 8 + r() * 3;
    const wallMat = tmats.corrugated(pick(r, [0xf4f6f8, 0xc8dcf0, 0xfff0d8, 0xd8ecd0]));
    const walls = new THREE.Group();
    walls.add(boxOn(w, h, d, wallMat, 0, 0, 0));
    walls.add(boxOn(w - 0.3, 0.05, d - 0.3, mats.capSlab(), 0, h, 0));
    for (let i = 0; i < Math.floor(w / 7); i++) walls.add(box(4, 4.5, 0.1, mat('rollerDoor', { color: 0x6a6e72, roughness: 0.5, metalness: 0.5 }), -w / 2 + 3.5 + i * 7, 2.25, d / 2 + 0.03));
    walls.add(boxOn(w, 1.2, 2.5, mats.concrete(), 0, 0, d / 2 + 1.25)); // loading dock
    const roof = new THREE.Group();
    const rf = gableRoof(w, d, 1.6, wallMat, tmats.corrugated(0x7a7e82), 0.4);
    rf.position.y = h;
    roof.add(rf);
    for (let i = 0; i < 3; i++) roof.add(boxOn(1.4, 0.8, 1.4, M.steel(), (r() - 0.5) * (w - 4), h + 0.9, (r() - 0.5) * (d - 6)));
    const b = sectioned([walls, roof], [0xc8ccd0, 0x7a7e82, 0x5a5a54]);
    b.position.set(x, GROUND_Y, z);
    g.add(b);
    buildings.push(b);
  }
  for (let i = 0; i < 8; i++) statics.add(boxOn(1.2, 0.9, 1.2, mats.wood(), (r() - 0.5) * 38, GROUND_Y, 17 + r() * 3));
  marker(statics, { type: 'fuel', seed: Math.floor(r() * 1e9), fuel: 'drums' }, -18, GROUND_Y, 18);
}

/** Quay along the sea: container stacks, big ship-to-shore cranes, bollards. */
function dockBlock(g: THREE.Group, statics: THREE.Group, r: Rand, buildings: THREE.Group[]) {
  statics.add(plane(LOT, LOT, mats.concrete(), 0, GROUND_Y, 0));
  for (const x of [-12, 12]) {
    const st = containerStack(r, 1 + Math.floor(r() * 2), true);
    st.position.set(x, GROUND_Y, -8);
    st.rotation.y = Math.PI / 2;
    g.add(st);
    buildings.push(st);
  }
  // Ship-to-shore cranes straddling the quay edge
  for (const x of [-14, 14]) {
    const c = new THREE.Group();
    const red = tmats.steelRed();
    for (const [lx, lz] of [[-4, 10], [4, 10], [-4, 20], [4, 20]]) c.add(boxOn(0.7, 17, 0.7, red, lx, 0, lz));
    c.add(boxOn(9.5, 1.2, 1, red, 0, 17, 10));
    c.add(boxOn(9.5, 1.2, 1, red, 0, 17, 20));
    c.add(boxOn(1.8, 1.6, 36, red, 0, 18.2, 32)); // boom out toward the water
    c.add(boxOn(2.6, 2.4, 3.4, mat('craneCab', { color: 0xe6e2d6, roughness: 0.6 }), 0, 15.5, 16));
    c.position.set(x, GROUND_Y, 0);
    occluder(c);
    statics.add(c);
  }
  for (let x = -22; x <= 22; x += 5.5) statics.add(place(cyl(0.3, 0.35, 0.8, M.darkMetal(), 10), x, GROUND_Y + 0.4, 23.5));
}

/** Sea south of the map with a moored cargo ship. */
function harbour(city: THREE.Group, extent: number, r: Rand) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1200, 400).rotateX(-Math.PI / 2), tmats.sea());
  water.position.set(0, -1.2, extent + 200);
  water.receiveShadow = true;
  city.add(water);
  city.add(box(extent * 6, 3, 2, mats.concrete(), 0, -1.3, extent + 1));
  const ship = new THREE.Group();
  const Ls = 130, Ws = 22;
  ship.add(extrudeTop([[-Ws / 2, -Ls / 2], [Ws / 2, -Ls / 2], [Ws / 2, Ls / 2 - 14], [0, Ls / 2], [-Ws / 2, Ls / 2 - 14]], 9, tmats.hull()));
  ship.add(extrudeTop([[-Ws / 2 + 0.3, -Ls / 2 + 0.3], [Ws / 2 - 0.3, -Ls / 2 + 0.3], [Ws / 2 - 0.3, Ls / 2 - 14], [0, Ls / 2 - 0.5], [-Ws / 2 + 0.3, Ls / 2 - 14]], 0.3, tmats.hullDark()).translateY(9));
  for (let row = -4; row <= 3; row++)
    for (let col = -3; col <= 3; col++) {
      const tiers = 1 + Math.floor(r() * 4);
      ship.add(boxOn(2.44, 2.6 * tiers, 12, tmats.container(pick(r, CONTAINER_TINTS)), col * 2.7, 9.3, row * 13 - 4));
    }
  ship.add(boxOn(Ws - 2, 14, 10, M.white(), 0, 9.3, -Ls / 2 + 8));
  ship.add(boxOn(Ws + 2, 1.5, 4, M.white(), 0, 21, -Ls / 2 + 8));
  ship.add(boxOn(3, 8, 3, tmats.hull(), 0, 23, -Ls / 2 + 5));
  bake(ship);
  ship.rotation.y = Math.PI / 2;
  ship.position.set(10, -1.2, extent + 20);
  city.add(ship);
}

// ───────────────────────── Roads ─────────────────────────

function roadMarkings(roads: number[], extent: number, spur: number, noSouth = false) {
  const white: THREE.BufferGeometry[] = [];
  const yellow: THREE.BufferGeometry[] = [];
  const quad = (arr: THREE.BufferGeometry[], cx: number, cz: number, sx: number, sz: number) => {
    arr.push(boxGeo(sx, 0.02, sz).translate(cx, 0.012, cz).toNonIndexed());
  };
  const hw = ROAD / 2;
  const inner = roads.slice(1, -1);
  for (const c of roads) {
    const stops = [...roads];
    // Interior roads continue out of the map as spawn spurs
    const ends = inner.includes(c) ? [-extent - spur, ...stops, extent + spur] : stops;
    for (let i = 0; i < ends.length - 1; i++) {
      const a = ends[i] + (roads.includes(ends[i]) ? hw + 4.5 : 0);
      const b = ends[i + 1] - (roads.includes(ends[i + 1]) ? hw + 4.5 : 0);
      if (b <= a) continue;
      const len = b - a, mid = (a + b) / 2;
      for (const horizontal of [true, false]) {
        const Q = (arr: THREE.BufferGeometry[], along: number, across: number, lAlong: number, lAcross: number) => {
          if (!horizontal && noSouth && along > extent) return;
          if (horizontal) quad(arr, along, c + across, lAlong, lAcross);
          else quad(arr, c + across, along, lAcross, lAlong);
        };
        Q(yellow, mid, -0.15, len, 0.12);
        Q(yellow, mid, 0.15, len, 0.12);
        Q(white, mid, -hw + 0.4, len, 0.15);
        Q(white, mid, hw - 0.4, len, 0.15);
        for (let t = a + 1; t < b - 3; t += 9) {
          Q(white, t + 1.5, -3.5, 3, 0.13);
          Q(white, t + 1.5, 3.5, 3, 0.13);
        }
        for (const [edge, dir] of [[a, 1], [b, -1]] as const) {
          if (!roads.includes(edge - dir * (hw + 4.5))) continue;
          Q(white, edge + dir * 0.2, dir > 0 ? 3.5 : -3.5, 0.45, ROAD / 2 - 0.4);
          for (let k = -6; k <= 6; k += 1.2) Q(white, edge - dir * 2.3, k, 3, 0.55);
        }
      }
    }
  }
  const g = new THREE.Group();
  const mw = new THREE.Mesh(mergeGeometries(white), mats.paint());
  const my = new THREE.Mesh(mergeGeometries(yellow), mats.paintY());
  mw.receiveShadow = my.receiveShadow = true;
  g.add(mw, my);
  return g;
}

// ───────────────────────── City ─────────────────────────

export function buildCity(opts: CityOptions): CityResult {
  const { roads, extent } = layout(opts.N);
  theme = opts.theme ?? 'city';
  const sea = !!opts.seaSouth;
  const SPUR = 45;
  const city = new THREE.Group();
  const r = T.rng(opts.seed);
  // Outer ground (stops at the quay when there is sea to the south)
  const OD = extent * 6;
  city.add(plane(OD, OD, mats.outerGrass(), 0, -0.05, sea ? extent + 1 - OD / 2 : 0));
  if (sea) harbour(city, extent, r);
  city.add(plane(extent * 2, extent * 2, mats.asphalt(), 0, 0, 0));
  const inner = roads.slice(1, -1);
  // Spawn spurs: roads continuing beyond the map edge
  const spawns: THREE.Vector3[] = [];
  for (const c of inner) {
    for (const s of [-1, 1]) {
      const mid = s * (extent + SPUR / 2);
      if (!(sea && s > 0)) {
        city.add(plane(ROAD, SPUR, mats.asphalt(), c, 0.001, mid));
        spawns.push(new THREE.Vector3(c, 0, s * (extent + SPUR - 8)));
      }
      city.add(plane(SPUR, ROAD, mats.asphalt(), mid, 0.001, c));
      spawns.push(new THREE.Vector3(s * (extent + SPUR - 8), 0, c));
    }
  }
  city.add(roadMarkings(roads, extent, SPUR, sea));

  const buildings: THREE.Group[] = [];
  for (let ix = -opts.N; ix <= opts.N; ix++)
    for (let iz = -opts.N; iz <= opts.N; iz++) {
      const b = buildBlock(ix, iz, opts.district(ix, iz), opts.seed);
      city.add(b.group);
      buildings.push(...b.buildings);
    }

  const clutter = new THREE.Group();
  for (const c of roads)
    for (let i = 0; i < roads.length - 1; i++) {
      const a = roads[i] + ROAD / 2 + 6, b = roads[i + 1] - ROAD / 2 - 6;
      for (let t = a; t < b; t += 6 + r() * 10) {
        if (r() < 0.55) continue;
        const side = r() > 0.5 ? 1 : -1;
        const horizontal = r() > 0.5;
        const pos = side * (ROAD / 2 - 1.4);
        const ry = (horizontal ? Math.PI / 2 : 0) + (side > 0 ? Math.PI : 0);
        if (horizontal) carAt(clutter, r, t, 0, c + pos, ry, r() < 0.12);
        else carAt(clutter, r, c + pos, 0, t, ry, r() < 0.12);
      }
      const m = cyl(0.4, 0.4, 0.03, mat('manhole', { color: 0x3c3a36, roughness: 0.6, metalness: 0.6 }), 16);
      clutter.add(place(m, (a + b) / 2 + (r() - 0.5) * 10, 0.01, c + 1.75));
    }
  const span = extent * 0.9;
  for (let i = 0; i < 4 + opts.N * 4; i++) {
    const c = pick(r, roads), t = (r() - 0.5) * 2 * span;
    const lane = (r() - 0.5) * 8;
    if (r() > 0.5) carAt(clutter, r, t, 0, c + lane, Math.PI / 2 + (r() - 0.5) * 1.2, r() < 0.4);
    else carAt(clutter, r, c + lane, 0, t, (r() - 0.5) * 1.2, r() < 0.4);
  }
  for (let i = 0; i < 2 + opts.N; i++) {
    const c = pick(r, inner), t = (pick(r, inner) + pick(r, [-1, 1]) * PITCH * 0.3);
    const vertical = r() > 0.5;
    const [x, z, ry] = vertical ? [c, t, 0] : [t, c, Math.PI / 2];
    jersey(clutter, x + (vertical ? -2 : 0), z + (vertical ? 0 : -2), ry);
    jersey(clutter, x + (vertical ? 2 : 0), z + (vertical ? 0 : 2), ry);
    sandbags(clutter, x + (vertical ? 0 : 3.5), z + (vertical ? 3.5 : 0), ry, r);
  }
  for (const x of inner)
    for (const z of inner) {
      const dx = opts.district(Math.round((x - PITCH / 2) / PITCH), Math.round((z - PITCH / 2) / PITCH));
      if (dx === 'suburb') continue;
      trafficLight(clutter, x - ROAD / 2 - 1, z + ROAD / 2 + 1, Math.PI);
      trafficLight(clutter, x + ROAD / 2 + 1, z - ROAD / 2 - 1, 0);
    }
  city.add(clutter);

  // Tree belt around the map (kept clear of the spawn spurs)
  const belt = new THREE.Group();
  for (let i = 0; i < 90 + opts.N * 70; i++) {
    const a = r() * Math.PI * 2;
    const rad = extent + 8 + r() * 70;
    const x = Math.max(-1, Math.min(1, Math.cos(a) * 1.5)) * rad;
    const z = Math.max(-1, Math.min(1, Math.sin(a) * 1.5)) * rad;
    if (inner.some((c) => Math.abs(x - c) < ROAD || Math.abs(z - c) < ROAD)) continue;
    if (sea && z > extent) continue;
    belt.add(place(tree(r, theme === 'city' ? (r() > 0.5 ? 'conifer' : 'broad') : undefined, 1 + r() * 0.6), x, 0, z));
  }
  bake(belt);
  city.add(belt);

  // Collect prop markers (world transforms), then bake the remaining clutter
  city.updateMatrixWorld(true);
  const props: PropMarker[] = [];
  const poles: PropMarker[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const found: THREE.Object3D[] = [];
  city.traverse((o) => o.userData.prop && found.push(o));
  for (const o of found) {
    o.getWorldPosition(p);
    o.getWorldQuaternion(q);
    e.setFromQuaternion(q, 'YXZ');
    const m = o.userData.prop as PropMarker;
    const list = m.type === 'pole' ? poles : props;
    list.push({ ...m, id: list.length, x: p.x, z: p.z, ry: e.y });
    o.removeFromParent();
  }
  bake(clutter);
  buildings.forEach((b, i) => (b.userData.id = i));
  return { group: city, buildings, props, poles, spawns, roads, extent };
}

/** Irregular rubble heap for a destroyed building footprint. */
export function rubbleHeap(r: Rand, w: number, d: number, colors: number[]) {
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(w * 0.95, 0.6, d * 0.95), mats.rubble());
  base.position.y = 0.3;
  const uv = base.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  g.add(base);
  const n = Math.min(60, Math.floor((w * d) / 4));
  for (let i = 0; i < n; i++) {
    const s = 0.35 + r() * 0.9;
    const geo = new THREE.DodecahedronGeometry(s, 0);
    geo.scale(1 + r() * 0.8, 0.35 + r() * 0.35, 1 + r() * 0.6);
    const c = new THREE.Color(colors[Math.floor(r() * colors.length)]).multiplyScalar(0.55 + r() * 0.2).getHex() & 0xf0f0f0;
    const m = mesh(geo, mat(`rubbleChunk-${c}`, () => photoMaterial('rubble', { color: c, roughness: 1, tileScale: 0.5 })));
    m.position.set((r() - 0.5) * w * 0.85, 0.45 + r() * 0.4, (r() - 0.5) * d * 0.85);
    m.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
    g.add(m);
  }
  for (let i = 0; i < 6; i++) {
    const beam = box(0.2, 0.2, 2 + r() * 3, M.darkMetal());
    beam.position.set((r() - 0.5) * w * 0.7, 0.9 + r() * 0.6, (r() - 0.5) * d * 0.7);
    beam.rotation.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.5);
    g.add(beam);
  }
  bake(g);
  return g;
}

export { addMacroVariation };
