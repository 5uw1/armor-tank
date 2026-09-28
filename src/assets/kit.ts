import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ───────────────────────── Materials ─────────────────────────

const mats = new Map<string, THREE.Material>();

/** Cached MeshStandardMaterial; `key` must uniquely describe params. */
export function mat(key: string, p: THREE.MeshStandardMaterialParameters | (() => THREE.Material)) {
  let m = mats.get(key);
  if (!m) {
    m = typeof p === 'function' ? p() : new THREE.MeshStandardMaterial(p);
    mats.set(key, m);
  }
  return m;
}

/** Texture with repeat so that 1 texture tile spans `tileW`×`tileH` metres (geometry UVs are in metres). */
export function tiled(tex: THREE.Texture, tileW: number, tileH = tileW, rotation = 0) {
  const t = tex.clone();
  t.repeat.set(1 / tileW, 1 / tileH);
  t.rotation = rotation;
  t.needsUpdate = true;
  return t;
}

export const M = {
  darkMetal: () => mat('darkMetal', { color: 0x2b2c2a, roughness: 0.55, metalness: 0.7 }),
  steel: () => mat('steel', { color: 0x8a8d8f, roughness: 0.35, metalness: 0.9 }),
  rubber: () => mat('rubber', { color: 0x1c1c1c, roughness: 0.92, metalness: 0 }),
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x1d2830, roughness: 0.06, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.6 })),
  lens: () => mat('lens', { color: 0x223a44, roughness: 0.1, metalness: 0.4, emissive: 0x0a2530 }),
  canvas: () => mat('canvas', { color: 0x5d5a3f, roughness: 0.95 }),
  canvasTan: () => mat('canvasTan', { color: 0x7a6a4c, roughness: 0.95 }),
  headlight: () => mat('headlight', { color: 0xf2f0e6, emissive: 0x6d6a55, roughness: 0.2 }),
  taillight: () => mat('taillight', { color: 0x8a0f0f, emissive: 0x3a0303, roughness: 0.3 }),
  white: () => mat('white', { color: 0xe9e7e0, roughness: 0.7 }),
  concreteGrey: () => mat('concreteGrey', { color: 0xb3afa6, roughness: 0.9 }),
  enemyRed: () => mat('enemyRed', { color: 0x6e231d, roughness: 0.7, metalness: 0.2 }),
  playerMark: () => mat('playerMark', { color: 0xd8d4c4, roughness: 0.8 }),
};

// ───────────────────────── Geometry helpers ─────────────────────────

/** Set BoxGeometry UVs to metres so textures tile consistently across differently sized boxes. */
export function boxGeo(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const sizes: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * sizes[f][0], uv.getY(i) * sizes[f][1]);
    }
  return g;
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const box = (w: number, h: number, d: number, material: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) =>
  mesh(boxGeo(w, h, d), material, x, y, z);

/** Box whose bottom sits on y. */
export const boxOn = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) =>
  box(w, h, d, material, x, y + h / 2, z);

export function cyl(rTop: number, rBot: number, h: number, material: THREE.Material, seg = 16) {
  return mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
}

/** Cylinder oriented along Z (e.g. gun barrels). */
export function cylZ(r: number, len: number, material: THREE.Material, seg = 16, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  g.rotateX(Math.PI / 2);
  return mesh(g, material);
}

/** Cylinder oriented along X (e.g. wheels). */
export function cylX(r: number, w: number, material: THREE.Material, seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, w, seg);
  g.rotateZ(Math.PI / 2);
  return mesh(g, material);
}

/** Tube between two points. */
export function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material, seg = 8) {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

type Bevel = { size: number; seg?: number } | undefined;

/**
 * Extrude a side profile. Points are [forward, up]; the result spans `width` across X (centred),
 * forward = +Z. Material may be [caps, sides].
 */
export function extrudeSide(pts: [number, number][], width: number, material: THREE.Material | THREE.Material[], bevel?: Bevel) {
  const shape = new THREE.Shape(pts.map(([f, u]) => new THREE.Vector2(f, u)));
  const b = bevel?.size ?? 0;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - 2 * b,
    bevelEnabled: !!bevel,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: bevel?.seg ?? 1,
  });
  g.translate(0, 0, -(width - 2 * b) / 2);
  g.rotateY(-Math.PI / 2); // shape x → +Z, extrusion z → X
  return mesh(g, material);
}

/**
 * Extrude a top-view outline upward. Points are [x, forward]; result spans y∈[0,height].
 */
export function extrudeTop(pts: [number, number][], height: number, material: THREE.Material | THREE.Material[], bevel?: Bevel) {
  const shape = new THREE.Shape(pts.map(([x, f]) => new THREE.Vector2(x, -f)));
  const b = bevel?.size ?? 0;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, height - 2 * b),
    bevelEnabled: !!bevel,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: bevel?.seg ?? 1,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2); // extrusion → +Y, shape -y → +Z (forward)
  g.translate(0, b, 0);
  return mesh(g, material);
}

export function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

/** Mirror helper: add object and its X-mirrored clone. */
export function mirrorX(parent: THREE.Object3D, o: THREE.Object3D) {
  parent.add(o);
  const c = o.clone();
  c.position.x *= -1;
  c.rotation.y *= -1;
  c.rotation.z *= -1;
  parent.add(c);
  return c;
}

// ───────────────────────── Baking ─────────────────────────

const KEEP = ['position', 'normal', 'uv'];

function slice(g: THREE.BufferGeometry, start: number, count: number) {
  const out = new THREE.BufferGeometry();
  for (const name of KEEP) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) return null;
    const arr = (a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}

/**
 * Merge every static mesh under `root` into one mesh per material (huge draw-call saving).
 * Meshes with `userData.dynamic` are left untouched.
 */
export function bake(root: THREE.Object3D, shadows = true) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const victims: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.dynamic || (m as THREE.InstancedMesh).isInstancedMesh) return;
    let skip = false;
    for (let p = m.parent; p && p !== root; p = p.parent) if (p.userData.dynamic) skip = true;
    if (skip) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld),
    );
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    const groups = Array.isArray(m.material) && g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const grp of groups) {
      const part = slice(g, grp.start, grp.count);
      const material = materials[grp.materialIndex ?? 0];
      if (!part || !material) continue;
      if (!buckets.has(material)) buckets.set(material, []);
      buckets.get(material)!.push(part);
    }
    victims.push(m);
  });
  for (const v of victims) v.removeFromParent();
  // Remove now-empty groups
  const empties: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && !o.userData.dynamic && !o.userData.prop && o.children.length === 0 && !(o as THREE.Mesh).isMesh && !(o as THREE.Light).isLight) empties.push(o);
  });
  for (const e of empties) e.removeFromParent();
  for (const [material, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = shadows;
    m.receiveShadow = true;
    root.add(m);
  }
  return root;
}
