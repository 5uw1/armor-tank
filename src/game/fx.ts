import * as THREE from 'three';
import { noiseField, rng } from '../assets/textures';

// ───────────────────────── Sprite textures ─────────────────────────

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const fireTex = () =>
  canvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

const smokeTex = () =>
  canvasTex(128, (ctx, s) => {
    const n = noiseField(s, s, 99, 4, 4);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const d = Math.hypot(x - s / 2, y - s / 2) / (s / 2);
        const a = Math.max(0, 1 - d) ** 1.4 * (0.45 + n[i] * 0.9);
        const v = 200 + n[i] * 55;
        img.data.set([v, v, v, Math.min(255, a * 255)], i * 4);
      }
    ctx.putImageData(img, 0, 0);
  });

const scorchTex = () =>
  canvasTex(128, (ctx, s) => {
    const r = rng(5);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(8,6,5,0.95)');
    g.addColorStop(0.45, 'rgba(15,12,10,0.8)');
    g.addColorStop(1, 'rgba(20,18,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(10,8,6,0.5)';
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, l = s * (0.25 + r() * 0.25);
      ctx.beginPath();
      ctx.moveTo(s / 2, s / 2);
      ctx.lineTo(s / 2 + Math.cos(a - 0.08) * l, s / 2 + Math.sin(a - 0.08) * l);
      ctx.lineTo(s / 2 + Math.cos(a + 0.08) * l, s / 2 + Math.sin(a + 0.08) * l);
      ctx.fill();
    }
  });

// ───────────────────────── Billboard particles ─────────────────────────

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  s0: number; s1: number;
  rot: number; vr: number;
  r: number; g: number; b: number;
  r1: number; g1: number; b1: number;
  a: number; drag: number; grav: number;
}

const VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iCol;
  attribute vec2 iSR;
  uniform vec3 camRight;
  uniform vec3 camUp;
  varying vec2 vUv;
  varying vec4 vCol;
  void main() {
    vUv = uv;
    vCol = iCol;
    float c = cos(iSR.y), s = sin(iSR.y);
    vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iSR.x;
    vec3 wp = iPos + camRight * p.x + camUp * p.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vCol;
  void main() {
    vec4 t = texture2D(map, vUv);
    gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
    #include <colorspace_fragment>
  }`;

class ParticleSystem {
  readonly mesh: THREE.Mesh;
  private ps: Particle[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private sr: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  readonly uniforms;

  constructor(readonly max: number, map: THREE.Texture, additive: boolean) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.attributes.position);
    this.geo.setAttribute('uv', base.attributes.uv);
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.sr = new Float32Array(max * 2);
    const attr = (a: Float32Array, n: number) => new THREE.InstancedBufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iPos', attr(this.pos, 3));
    this.geo.setAttribute('iCol', attr(this.col, 4));
    this.geo.setAttribute('iSR', attr(this.sr, 2));
    this.uniforms = { map: { value: map }, camRight: { value: new THREE.Vector3(1, 0, 0) }, camUp: { value: new THREE.Vector3(0, 1, 0) } };
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
  }

  emit(p: Partial<Particle> & { x: number; y: number; z: number; max: number }) {
    if (this.ps.length >= this.max) this.ps.shift();
    this.ps.push({
      vx: 0, vy: 0, vz: 0, life: 0, s0: 1, s1: 1, rot: Math.random() * 6.28, vr: 0,
      r: 1, g: 1, b: 1, r1: -1, g1: -1, b1: -1, a: 1, drag: 0, grav: 0, ...p,
    } as Particle);
  }

  update(dt: number, cam: THREE.Camera) {
    cam.matrixWorld.extractBasis(this.uniforms.camRight.value, this.uniforms.camUp.value, new THREE.Vector3());
    let n = 0;
    const alive: Particle[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.grav * dt;
      p.vz *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy = Math.abs(p.vy) * 0.2;
      }
      p.rot += p.vr * dt;
      const t = p.life / p.max;
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      const mix = (a: number, b: number) => (b < 0 ? a : a + (b - a) * t);
      this.pos.set([p.x, p.y, p.z], n * 3);
      this.col.set([mix(p.r, p.r1), mix(p.g, p.g1), mix(p.b, p.b1), p.a * fade], n * 4);
      this.sr.set([p.s0 + (p.s1 - p.s0) * Math.sqrt(t), p.rot], n * 2);
      alive.push(p);
      n++;
    }
    this.ps = alive;
    this.geo.instanceCount = n;
    for (const name of ['iPos', 'iCol', 'iSR']) (this.geo.attributes[name] as THREE.InstancedBufferAttribute).needsUpdate = true;
  }

  clear() {
    this.ps = [];
  }
}

// ───────────────────────── Debris chunks ─────────────────────────

interface Chunk {
  p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; s: THREE.Vector3; life: number; max: number; rest: boolean;
}

class Debris {
  readonly mesh: THREE.InstancedMesh;
  private chunks: (Chunk | null)[];
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private c = new THREE.Color();

  constructor(readonly max: number) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), max);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.chunks = new Array(max).fill(null);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.c.set(0x777777));
    }
  }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, size: number, color: number, life = 6) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const s = new THREE.Vector3(size * (0.6 + Math.random() * 0.8), size * (0.3 + Math.random() * 0.6), size * (0.5 + Math.random() * 0.8));
    this.chunks[i] = {
      p: pos.clone(), v: vel.clone(), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
      w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      s, life: 0, max: life + Math.random() * 2, rest: false,
    };
    this.c.set(color).multiplyScalar(0.75 + Math.random() * 0.4);
    this.mesh.setColorAt(i, this.c);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      const c = this.chunks[i];
      if (!c) continue;
      c.life += dt;
      if (c.life > c.max) {
        this.chunks[i] = null;
        this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
        continue;
      }
      if (!c.rest) {
        c.v.y -= 22 * dt;
        c.p.addScaledVector(c.v, dt);
        c.r.x += c.w.x * dt;
        c.r.y += c.w.y * dt;
        c.r.z += c.w.z * dt;
        const floor = c.s.y * 0.5;
        if (c.p.y < floor) {
          c.p.y = floor;
          c.v.y *= -0.3;
          c.v.x *= 0.6;
          c.v.z *= 0.6;
          c.w.multiplyScalar(0.5);
          if (Math.abs(c.v.y) < 1.2) {
            c.rest = true;
            c.r.x = Math.round(c.r.x / (Math.PI / 2)) * (Math.PI / 2);
            c.r.z = Math.round(c.r.z / (Math.PI / 2)) * (Math.PI / 2);
          }
        }
      }
      const shrink = c.life > c.max - 1 ? Math.max(0, c.max - c.life) : 1;
      this.q.setFromEuler(c.r);
      this.m.compose(c.p, this.q, new THREE.Vector3().copy(c.s).multiplyScalar(shrink));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.chunks.fill(null);
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ───────────────────────── Ground decals ─────────────────────────

class Decals {
  readonly mesh: THREE.InstancedMesh;
  private next = 0;

  constructor(readonly max: number, map: THREE.Texture, opacity: number) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.clear();
  }

  add(x: number, z: number, size: number, rot = Math.random() * Math.PI * 2, y = 0.03, sx = size) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(sx, 1, size));
    this.mesh.setMatrixAt(this.next, m);
    this.next = (this.next + 1) % this.max;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ───────────────────────── FX facade ─────────────────────────

export class FX {
  readonly root = new THREE.Group();
  readonly fire: ParticleSystem;
  readonly smoke: ParticleSystem;
  readonly debris: Debris;
  readonly scorch: Decals;
  readonly tracks: Decals;
  private lights: { l: THREE.PointLight; t: number; max: number; i: number }[] = [];
  private nextLight = 0;
  trauma = 0;
  shakeEnabled = true;
  /** Particle budget multiplier set by the quality level. */
  density = 1;

  constructor() {
    const ft = fireTex(), st = smokeTex();
    this.fire = new ParticleSystem(1200, ft, true);
    this.smoke = new ParticleSystem(1400, st, false);
    this.debris = new Debris(400);
    this.scorch = new Decals(90, scorchTex(), 0.85);
    const trackTex = canvasTex(32, (ctx, s) => {
      ctx.fillStyle = 'rgba(20,18,15,0.9)';
      for (let y = 0; y < s; y += 8) ctx.fillRect(0, y, s, 5);
    });
    this.tracks = new Decals(900, trackTex, 0.32);
    this.root.add(this.scorch.mesh, this.tracks.mesh, this.debris.mesh, this.smoke.mesh, this.fire.mesh);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffa040, 0, 40, 1.6);
      this.root.add(l);
      this.lights.push({ l, t: 0, max: 0, i: 0 });
    }
  }

  private count(n: number) {
    return Math.max(1, Math.round(n * this.density));
  }

  flash(p: THREE.Vector3, intensity: number, dur: number, color = 0xffa040) {
    const s = this.lights[this.nextLight];
    this.nextLight = (this.nextLight + 1) % this.lights.length;
    s.l.position.set(p.x, p.y + 1.5, p.z);
    s.l.color.set(color);
    s.t = dur;
    s.max = dur;
    s.i = intensity;
  }

  shake(amount: number) {
    if (this.shakeEnabled) this.trauma = Math.min(1, this.trauma + amount);
  }

  muzzle(p: THREE.Vector3, dir: THREE.Vector3, big: boolean) {
    const s = big ? 1 : 0.4;
    this.fire.emit({ x: p.x, y: p.y, z: p.z, max: 0.07, s0: 3.2 * s, s1: 4 * s, r: 1, g: 0.85, b: 0.5, a: 1 });
    for (let i = 0; i < (big ? 5 : 1); i++)
      this.fire.emit({ x: p.x, y: p.y, z: p.z, vx: dir.x * (8 + i * 4), vy: 0.5, vz: dir.z * (8 + i * 4), drag: 6, max: 0.12, s0: 1.4 * s, s1: 0.4, r: 1, g: 0.6, b: 0.2 });
    if (big) {
      for (let i = 0; i < this.count(5); i++)
        this.smoke.emit({
          x: p.x, y: p.y, z: p.z, vx: dir.x * (3 + Math.random() * 5) + (Math.random() - 0.5) * 2, vy: 0.6 + Math.random(), vz: dir.z * (3 + Math.random() * 5) + (Math.random() - 0.5) * 2,
          drag: 1.5, max: 1.4 + Math.random(), s0: 1.2, s1: 4, r: 0.75, g: 0.73, b: 0.7, a: 0.45, vr: (Math.random() - 0.5),
        });
      this.flash(p, 250, 0.08, 0xffc070);
    }
  }

  /** Bullet/shell impact without explosion (sparks, dust). */
  impact(p: THREE.Vector3, metal: boolean) {
    for (let i = 0; i < this.count(metal ? 6 : 3); i++)
      this.fire.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 14, vy: 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 14, grav: -25, max: 0.25 + Math.random() * 0.2, s0: 0.25, s1: 0.1, r: 1, g: 0.8, b: 0.4 });
    this.smoke.emit({ x: p.x, y: p.y, z: p.z, vy: 0.8, max: 0.8, s0: 0.6, s1: 1.8, r: 0.6, g: 0.58, b: 0.54, a: 0.4 });
  }

  explosion(p: THREE.Vector3, size: number) {
    const s = size;
    this.fire.emit({ x: p.x, y: p.y + 0.5, z: p.z, max: 0.12, s0: 5 * s, s1: 7 * s, r: 1, g: 0.95, b: 0.8 });
    for (let i = 0; i < this.count(10 + s * 6); i++) {
      const a = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 6) * s;
      this.fire.emit({
        x: p.x, y: p.y + 0.3, z: p.z, vx: Math.cos(a) * sp, vy: (2 + Math.random() * 5) * s, vz: Math.sin(a) * sp, drag: 3.5,
        max: 0.35 + Math.random() * 0.45, s0: (1.5 + Math.random() * 1.5) * s, s1: (2.5 + Math.random()) * s, r: 1, g: 0.62, b: 0.2, r1: 0.5, g1: 0.12, b1: 0.02, vr: (Math.random() - 0.5) * 2,
      });
    }
    for (let i = 0; i < this.count(14 + s * 8); i++) {
      const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * 4) * s;
      const shade = 0.18 + Math.random() * 0.2;
      this.smoke.emit({
        x: p.x + Math.cos(a) * s, y: p.y + 0.5, z: p.z + Math.sin(a) * s, vx: Math.cos(a) * sp, vy: (1 + Math.random() * 3) * s, vz: Math.sin(a) * sp, drag: 1.6, grav: 0.5,
        max: 2.5 + Math.random() * 2.5, s0: 1.8 * s, s1: (5 + Math.random() * 3) * s, r: shade, g: shade, b: shade * 0.95, r1: 0.5, g1: 0.48, b1: 0.45, a: 0.75, vr: (Math.random() - 0.5) * 0.6,
      });
    }
    for (let i = 0; i < this.count(16 + s * 10); i++)
      this.fire.emit({ x: p.x, y: p.y + 0.4, z: p.z, vx: (Math.random() - 0.5) * 30 * s, vy: 6 + Math.random() * 14, vz: (Math.random() - 0.5) * 30 * s, grav: -30, drag: 0.5, max: 0.5 + Math.random() * 0.6, s0: 0.3, s1: 0.1, r: 1, g: 0.75, b: 0.35 });
    for (let i = 0; i < this.count(6 * s); i++)
      this.debris.spawn(new THREE.Vector3(p.x, 0.5, p.z), new THREE.Vector3((Math.random() - 0.5) * 12, 6 + Math.random() * 8, (Math.random() - 0.5) * 12), 0.18 + Math.random() * 0.25, 0x4a4238, 3);
    this.scorch.add(p.x, p.z, 3.5 * s + Math.random() * 1.5);
    this.flash(p, 900 * s, 0.25 + 0.1 * s);
    this.shake(0.18 * s);
  }

  /** Building section collapse: dust wave + chunks. */
  collapse(center: THREE.Vector3, w: number, d: number, height: number, colors: number[], amount: number) {
    const n = this.count(Math.min(80, (w * d) / 5) * amount);
    for (let i = 0; i < n; i++) {
      const x = center.x + (Math.random() - 0.5) * w, z = center.z + (Math.random() - 0.5) * d;
      const out = new THREE.Vector3(x - center.x, 0, z - center.z).normalize().multiplyScalar(2 + Math.random() * 6);
      this.debris.spawn(new THREE.Vector3(x, height * (0.4 + Math.random() * 0.6), z), out.setY(Math.random() * 6), 0.4 + Math.random() * 0.9, colors[i % colors.length], 7);
    }
    for (let i = 0; i < this.count(40 * amount); i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = Math.max(w, d) * 0.5;
      const shade = 0.55 + Math.random() * 0.15;
      this.smoke.emit({
        x: center.x + Math.cos(a) * rad * Math.random(), y: 0.5 + Math.random() * height * 0.7, z: center.z + Math.sin(a) * rad * Math.random(),
        vx: Math.cos(a) * (3 + Math.random() * 6), vy: 0.5 + Math.random() * 1.5, vz: Math.sin(a) * (3 + Math.random() * 6), drag: 0.9,
        max: 4 + Math.random() * 3, s0: 4, s1: 10 + Math.random() * 6, r: shade, g: shade * 0.96, b: shade * 0.9, a: 0.7, vr: (Math.random() - 0.5) * 0.4,
      });
    }
    this.shake(0.35 * amount);
  }

  /** Continuous emitter helpers (called per frame by burning things). */
  burn(p: THREE.Vector3, intensity: number, dt: number) {
    if (Math.random() < dt * 14 * intensity * this.density)
      this.fire.emit({ x: p.x + (Math.random() - 0.5) * 1.2, y: p.y, z: p.z + (Math.random() - 0.5) * 1.2, vy: 2 + Math.random() * 2, drag: 1, max: 0.5 + Math.random() * 0.4, s0: 1.2 * intensity, s1: 0.4, r: 1, g: 0.55, b: 0.15, r1: 0.6, g1: 0.1, b1: 0 });
    this.smokeColumn(p, intensity, dt, 0.12);
  }

  smokeColumn(p: THREE.Vector3, intensity: number, dt: number, shade = 0.2) {
    if (Math.random() < dt * 7 * intensity * this.density)
      this.smoke.emit({
        x: p.x + (Math.random() - 0.5), y: p.y + 0.5, z: p.z + (Math.random() - 0.5), vx: 0.8 + Math.random(), vy: 2.5 + Math.random() * 1.5, vz: -0.6 - Math.random() * 0.5, drag: 0.3,
        max: 4 + Math.random() * 2, s0: 1.5, s1: 6 + Math.random() * 3, r: shade, g: shade, b: shade, r1: 0.45, g1: 0.44, b1: 0.42, a: 0.55, vr: (Math.random() - 0.5) * 0.5,
      });
  }

  dust(p: THREE.Vector3, vx: number, vz: number) {
    this.smoke.emit({ x: p.x, y: 0.4, z: p.z, vx, vy: 0.6, vz, drag: 2, max: 1.2 + Math.random(), s0: 1, s1: 3.2, r: 0.62, g: 0.57, b: 0.5, a: 0.28, vr: (Math.random() - 0.5) });
  }

  update(dt: number, cam: THREE.Camera) {
    this.fire.update(dt, cam);
    this.smoke.update(dt, cam);
    this.debris.update(dt);
    for (const s of this.lights) {
      s.t = Math.max(0, s.t - dt);
      s.l.intensity = s.max > 0 ? s.i * (s.t / s.max) ** 2 : 0;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
  }

  /** Camera offset from accumulated trauma. */
  shakeOffset(t: number, out: THREE.Vector3) {
    const k = this.trauma * this.trauma * 1.4;
    return out.set(Math.sin(t * 47) * k, Math.sin(t * 39 + 1) * k * 0.5, Math.sin(t * 53 + 2) * k);
  }

  clear() {
    this.fire.clear();
    this.smoke.clear();
    this.debris.clear();
    this.scorch.clear();
    this.tracks.clear();
    this.trauma = 0;
  }
}
