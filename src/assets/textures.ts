import * as THREE from 'three';

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LATTICE = 256;

/** Tileable fBm value noise over a w×h pixel grid. Returns values ~0..1. */
export function noiseField(w: number, h: number, seed: number, basePeriod: number, octaves = 4, gain = 0.5) {
  const r = rng(seed);
  const P = new Float32Array(LATTICE * LATTICE);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const out = new Float32Array(w * h);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const period = Math.min(LATTICE, basePeriod << o);
    const off = o * 37;
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * period;
      const yi = Math.floor(fy);
      const ty = smooth(fy - yi);
      const y0 = ((yi + off) % period) * LATTICE;
      const y1 = ((yi + 1 + off) % period) * LATTICE;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * period;
        const xi = Math.floor(fx);
        const tx = smooth(fx - xi);
        const x0 = (xi + off) % period;
        const x1 = (xi + 1 + off) % period;
        const a = P[y0 + x0] + (P[y0 + x1] - P[y0 + x0]) * tx;
        const b = P[y1 + x0] + (P[y1 + x1] - P[y1 + x0]) * tx;
        out[y * w + x] += (a + (b - a) * ty) * amp;
      }
    }
    norm += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

type RGB = [number, number, number];
export const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

const cache = new Map<string, THREE.Texture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, color = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d', { willReadFrequently: true })!, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Fill the canvas per pixel from a noise-driven colour function. */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, fn: (x: number, y: number, i: number) => RGB) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const [r, g, b] = fn(x, y, i);
      d[i * 4] = clamp(r);
      d[i * 4 + 1] = clamp(g);
      d[i * 4 + 2] = clamp(b);
      d[i * 4 + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}

// ───────────────────────── Ground ─────────────────────────

/** Asphalt, 1 tile = 8 m. */
export const asphalt = () =>
  make('asphalt', 512, 512, (ctx, w, h) => {
    const n = noiseField(w, h, 11, 4, 5);
    const m = noiseField(w, h, 12, 16, 3);
    const r = rng(13);
    paint(ctx, w, h, (_x, _y, i) => {
      let v = 52 + (n[i] - 0.5) * 26 + (m[i] - 0.5) * 18;
      const s = r();
      if (s > 0.985) v += 38 * r();
      else if (s < 0.02) v -= 18;
      return [v, v + 1, v + 3];
    });
    // Tar-sealed cracks
    ctx.strokeStyle = 'rgba(22,22,24,0.28)';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = 0.8 + r();
      ctx.beginPath();
      let x = r() * w, y = r() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 14; s++) {
        x += (r() - 0.5) * 40;
        y += (r() - 0.2) * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Oil stains
    for (let k = 0; k < 5; k++) {
      const x = r() * w, y = r() * h, rad = 14 + r() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(10,10,12,0.35)');
      g.addColorStop(1, 'rgba(10,10,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });

/** Bump map for asphalt / concrete. */
export const roughBump = () =>
  make('roughBump', 256, 256, (ctx, w, h) => {
    const n = noiseField(w, h, 21, 32, 3);
    const r = rng(22);
    paint(ctx, w, h, (_x, _y, i) => {
      const v = 128 + (n[i] - 0.5) * 120 + (r() - 0.5) * 70;
      return [v, v, v];
    });
  }, false);

/** Sidewalk paving slabs, 1 tile = 4 m (4×4 slabs of 1 m). */
export const pavement = () =>
  make('pavement', 512, 512, (ctx, w, h) => {
    const n = noiseField(w, h, 31, 8, 4);
    const r = rng(32);
    const slabShade = new Float32Array(16).map(() => (r() - 0.5) * 14);
    paint(ctx, w, h, (x, y, i) => {
      const sx = Math.floor((x / w) * 4), sy = Math.floor((y / h) * 4);
      let v = 150 + (n[i] - 0.5) * 30 + slabShade[sy * 4 + sx];
      const jx = x % (w / 4), jy = y % (h / 4);
      if (jx < 2 || jy < 2) v -= 45;
      return [v, v - 2, v - 6];
    });
    grain(ctx, w, h, 33, 14);
  });

/** Plaza/concrete large tiles, 1 tile = 8 m. */
export const concrete = () =>
  make('concrete', 512, 512, (ctx, w, h) => {
    const n = noiseField(w, h, 41, 6, 5);
    const m = noiseField(w, h, 42, 3, 2);
    paint(ctx, w, h, (x, y, i) => {
      let v = 138 + (n[i] - 0.5) * 34 + (m[i] - 0.5) * 20;
      if (x % 256 < 2 || y % 256 < 2) v -= 35;
      return [v, v - 1, v - 4];
    });
    grain(ctx, w, h, 43, 10);
  });

/** Lawn grass, 1 tile = 6 m. */
export const grass = () =>
  make('grass', 512, 512, (ctx, w, h) => {
    const n = noiseField(w, h, 51, 4, 5);
    const m = noiseField(w, h, 52, 32, 2);
    paint(ctx, w, h, (_x, _y, i) => {
      const t = n[i], u = m[i];
      return [62 + t * 40 + u * 20, 96 + t * 50 + u * 22, 38 + t * 18];
    });
    const r = rng(53);
    for (let k = 0; k < 9000; k++) {
      const x = r() * w, y = r() * h, l = 2 + r() * 5, a = r() * Math.PI;
      const g = 90 + r() * 90;
      ctx.strokeStyle = `rgba(${g * 0.55 | 0},${g | 0},${g * 0.35 | 0},0.5)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  });

// ───────────────────────── Buildings ─────────────────────────

export type FacadeStyle = 'glass' | 'office' | 'apartment' | 'brick';

/**
 * Facade: tile covers 4 bays × 4 floors, each bay 3 m, floor 3.2 m → 12 m × 12.8 m.
 */
export const FACADE_TILE = { w: 12, h: 12.8 };

export const facade = (style: FacadeStyle, seed = 1) =>
  make(`facade-${style}-${seed}`, 512, 512, (ctx, w, h) => {
    const r = rng(100 + seed * 7 + style.length);
    const bw = w / 4, fh = h / 4;
    const n = noiseField(w, h, 60 + seed, 8, 4);
    const wall: Record<FacadeStyle, RGB> = {
      glass: hex('#6f7f86'),
      office: hex('#c9c4b8'),
      apartment: [196 + r() * 30, 186 + r() * 20, 168 + r() * 20],
      brick: hex('#8a4f3a'),
    };
    const base = wall[style];
    paint(ctx, w, h, (x, y, i) => {
      let [cr, cg, cb] = base;
      const v = (n[i] - 0.5) * 22;
      if (style === 'brick') {
        const row = Math.floor(y / 6);
        const bx = (x + (row % 2) * 7) % 14;
        if (y % 6 < 1 || bx < 1) return [150 + v, 142 + v, 130 + v];
        const tone = ((row * 131 + Math.floor((x + (row % 2) * 7) / 14) * 71) % 23) - 11;
        return [cr + tone + v, cg + tone * 0.6 + v, cb + tone * 0.4 + v];
      }
      // Grime streaks running down
      const streak = Math.sin(x * 0.9) * Math.sin(x * 0.13) * 6 * (y % fh) / fh;
      return [cr + v - streak, cg + v - streak, cb + v - streak];
    });

    for (let fy = 0; fy < 4; fy++)
      for (let bx = 0; bx < 4; bx++) {
        const x0 = bx * bw, y0 = fy * fh;
        const lit = r();
        const glassCol = () => {
          const k = r();
          const tint = style === 'glass' ? [40, 70, 84] : [52, 62, 72];
          const bright = lit > 0.82 ? 60 : 0;
          return `rgb(${tint[0] + k * 25 + bright},${tint[1] + k * 25 + bright},${tint[2] + k * 25 + bright * 0.6})`;
        };
        if (style === 'glass') {
          // Curtain wall: full glass panels, thin mullions, spandrel band.
          ctx.fillStyle = glassCol();
          ctx.fillRect(x0, y0, bw, fh);
          const g = ctx.createLinearGradient(x0, y0, x0 + bw, y0 + fh);
          g.addColorStop(0, 'rgba(255,255,255,0.18)');
          g.addColorStop(0.5, 'rgba(255,255,255,0)');
          g.addColorStop(1, 'rgba(255,255,255,0.08)');
          ctx.fillStyle = g;
          ctx.fillRect(x0, y0, bw, fh);
          ctx.fillStyle = '#2d3438';
          ctx.fillRect(x0, y0 + fh - 18, bw, 18);
          ctx.fillStyle = '#9aa3a8';
          ctx.fillRect(x0, y0, 3, fh);
          ctx.fillRect(x0 + bw / 2 - 1, y0, 2, fh - 18);
          ctx.fillRect(x0, y0 + fh - 19, bw, 2);
          continue;
        }
        const ww = style === 'office' ? bw * 0.82 : bw * 0.5;
        const wh = style === 'office' ? fh * 0.52 : fh * 0.5;
        const wx = x0 + (bw - ww) / 2, wy = y0 + fh * 0.2;
        // Sill shadow & frame
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 8);
        ctx.fillStyle = style === 'brick' ? '#d9d2c3' : '#e8e4da';
        ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        ctx.fillStyle = glassCol();
        ctx.fillRect(wx, wy, ww, wh);
        // Curtains / blinds
        if (r() > 0.5) {
          ctx.fillStyle = `rgba(${200 + r() * 55 | 0},${180 + r() * 60 | 0},${150 + r() * 60 | 0},0.55)`;
          ctx.fillRect(wx, wy, ww * (0.2 + r() * 0.3), wh);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(wx, wy, ww, wh * 0.35);
        ctx.fillStyle = style === 'brick' ? '#d9d2c3' : '#e8e4da';
        ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
        // Sill
        ctx.fillStyle = '#b8b2a6';
        ctx.fillRect(wx - 6, wy + wh + 2, ww + 12, 5);
        // Apartment balconies + AC units
        if (style === 'apartment') {
          if ((bx + fy) % 2 === 0) {
            ctx.fillStyle = 'rgba(40,40,40,0.35)';
            ctx.fillRect(x0 + 6, y0 + fh * 0.72, bw - 12, 4);
            ctx.fillStyle = '#d7d3ca';
            for (let k = 0; k < 9; k++) ctx.fillRect(x0 + 8 + k * ((bw - 16) / 8), y0 + fh * 0.72, 2, fh * 0.26);
            ctx.fillRect(x0 + 6, y0 + fh * 0.72, bw - 12, 3);
          } else if (r() > 0.4) {
            ctx.fillStyle = '#dcdcd6';
            ctx.fillRect(x0 + bw - 36, y0 + fh * 0.76, 28, 22);
            ctx.fillStyle = '#6b6e70';
            ctx.beginPath();
            ctx.arc(x0 + bw - 22, y0 + fh * 0.76 + 11, 8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (style === 'office') {
          ctx.fillStyle = 'rgba(30,30,30,0.18)';
          ctx.fillRect(x0, y0 + fh - 10, bw, 10);
        }
      }
    grain(ctx, w, h, 70 + seed, 10);
  });

/** Ground-floor storefront strip: 4 shop bays (12 m) × 4.8 m. */
export const storefront = (seed = 1) =>
  make(`storefront-${seed}`, 512, 256, (ctx, w, h) => {
    const r = rng(200 + seed);
    ctx.fillStyle = '#3b3a38';
    ctx.fillRect(0, 0, w, h);
    const awning = ['#a8322b', '#2f5d8a', '#2e6b45', '#c48a1c', '#5a3f6e', '#444'];
    for (let b = 0; b < 4; b++) {
      const x0 = b * (w / 4);
      const bw = w / 4;
      // Fascia sign
      ctx.fillStyle = awning[Math.floor(r() * awning.length)];
      ctx.fillRect(x0 + 2, 10, bw - 4, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 5; k++) ctx.fillRect(x0 + 16 + k * 20, 24, 12, 12);
      // Glass shopfront
      const g = ctx.createLinearGradient(0, 60, 0, h);
      g.addColorStop(0, '#5c7078');
      g.addColorStop(1, '#27323a');
      ctx.fillStyle = g;
      ctx.fillRect(x0 + 8, 62, bw - 16, h - 72);
      // Goods silhouettes
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `hsla(${r() * 360},40%,60%,0.35)`;
        ctx.fillRect(x0 + 14 + r() * (bw - 40), 120 + r() * 80, 10 + r() * 18, 12 + r() * 30);
      }
      ctx.fillStyle = '#b7b9b4';
      ctx.fillRect(x0 + 8, 60, bw - 16, 4);
      ctx.fillRect(x0 + bw / 2 - 2, 62, 4, h - 72);
      ctx.fillRect(x0 + 6, 60, 4, h - 64);
      // Door
      ctx.fillStyle = 'rgba(20,20,20,0.5)';
      ctx.fillRect(x0 + bw / 2 + 6, 110, 34, h - 120);
    }
    ctx.fillStyle = '#8f8b84';
    ctx.fillRect(0, h - 10, w, 10);
    grain(ctx, w, h, 210 + seed, 8);
  });

/** Flat roof membrane with gravel and stains, 1 tile = 10 m. */
export const roofFlat = () =>
  make('roofFlat', 512, 512, (ctx, w, h) => {
    const n = noiseField(w, h, 81, 4, 5);
    const r = rng(82);
    paint(ctx, w, h, (x, y, i) => {
      let v = 118 + (n[i] - 0.5) * 40 + (r() - 0.5) * 22;
      if (x % 128 < 2 || y % 128 < 2) v -= 18;
      return [v, v - 2, v - 5];
    });
    for (let k = 0; k < 8; k++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(60,55,45,0.28)');
      g.addColorStop(1, 'rgba(60,55,45,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });

/** Clay/asphalt shingle roof tiles; tile = 4 m. */
export const roofTiles = (color: string) =>
  make(`roofTiles-${color}`, 512, 512, (ctx, w, h) => {
    const base = hex(color);
    const r = rng(90 + base[0]);
    const n = noiseField(w, h, 91, 8, 3);
    const rowH = 16, tileW = 24;
    paint(ctx, w, h, (x, y, i) => {
      const row = Math.floor(y / rowH);
      const col = Math.floor((x + (row % 2) * tileW * 0.5) / tileW);
      const tone = (((row * 97 + col * 57) % 17) - 8) * 2.2;
      const ly = (y % rowH) / rowH;
      const shade = ly < 0.14 ? -40 : ly * 16;
      const edge = (x + (row % 2) * tileW * 0.5) % tileW < 1.5 ? -30 : 0;
      const v = (n[i] - 0.5) * 30 + tone + shade + edge;
      return [base[0] + v, base[1] + v * 0.8, base[2] + v * 0.7];
    });
    // Moss / weathering
    for (let k = 0; k < 40; k++) {
      const x = r() * w, y = r() * h, rad = 6 + r() * 20;
      ctx.fillStyle = `rgba(${60 + r() * 30 | 0},${70 + r() * 30 | 0},40,0.15)`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  });

/** Horizontal lap siding; tile = 4 m. */
export const siding = (color: string) =>
  make(`siding-${color}`, 256, 256, (ctx, w, h) => {
    const base = hex(color);
    const n = noiseField(w, h, 95, 4, 3);
    paint(ctx, w, h, (_x, y, i) => {
      const ly = (y % 12) / 12;
      const v = (n[i] - 0.5) * 14 + (ly < 0.12 ? -34 : ly * 10);
      return [base[0] + v, base[1] + v, base[2] + v];
    });
  });

// ───────────────────────── Vehicles ─────────────────────────

/** Multi-colour camouflage with grime, 1 tile = 6 m. */
export const camo = (key: string, colors: string[], seed: number) =>
  make(`camo-${key}`, 512, 512, (ctx, w, h) => {
    const cols = colors.map(hex);
    const a = noiseField(w, h, seed, 3, 4, 0.55);
    const b = noiseField(w, h, seed + 1, 3, 4, 0.55);
    const grime = noiseField(w, h, seed + 2, 16, 3);
    paint(ctx, w, h, (_x, _y, i) => {
      let c = cols[0];
      if (cols.length > 1 && a[i] > 0.56) c = cols[1];
      if (cols.length > 2 && b[i] > 0.6) c = cols[2];
      if (cols.length > 3 && a[i] < 0.36 && b[i] < 0.45) c = cols[3];
      const g = (grime[i] - 0.5) * 30;
      return [c[0] + g, c[1] + g, c[2] + g * 0.8];
    });
    // Chipped paint / scratches
    const r = rng(seed + 3);
    for (let k = 0; k < 260; k++) {
      ctx.fillStyle = `rgba(${40 + r() * 40 | 0},${38 + r() * 30 | 0},${30 + r() * 20 | 0},${0.2 + r() * 0.3})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
    }
    grain(ctx, w, h, seed + 4, 12);
  });

/** Track links; tile = 4 links, u across belt width. */
export const tread = () =>
  make('tread', 128, 256, (ctx, w, h) => {
    const n = noiseField(w, h, 301, 4, 3);
    paint(ctx, w, h, (x, y, i) => {
      const link = (y % 64) / 64;
      let v = 46 + (n[i] - 0.5) * 20;
      if (link < 0.12) v -= 22; // gap between links
      else if (link < 0.5) v += 26 * Math.sin(((link - 0.12) / 0.38) * Math.PI); // grouser bar
      if (x > w * 0.44 && x < w * 0.56 && link > 0.55) v += 30; // centre guide horn
      if (x < 6 || x > w - 6) v -= 12;
      return [v + 6, v + 3, v];
    });
  });

/** Rocket pod face: grid of launch tubes. */
export const rocketPod = () =>
  make('rocketPod', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4b5143';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 6; x++) {
        const cx = 22 + x * 42.4, cy = 32 + y * 64;
        ctx.fillStyle = '#1b1d1a';
        ctx.beginPath();
        ctx.arc(cx, cy, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7d2a22';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
  });

/** Exhaust / ventilation grille. */
export const grille = () =>
  make('grille', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1e1f1c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4a4b45';
    for (let y = 0; y < h; y += 10) ctx.fillRect(0, y, w, 4);
  });

/** Helipad marking on roof. */
export const helipad = () =>
  make('helipad', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#50565a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(w * 0.34, h * 0.3, 34, h * 0.4);
    ctx.fillRect(w * 0.66 - 34, h * 0.3, 34, h * 0.4);
    ctx.fillRect(w * 0.34, h * 0.47, w * 0.32, 30);
    grain(ctx, w, h, 5, 18);
  });

/** Return a clone of the texture with its own repeat/offset (shares the image). */
export function variant(tex: THREE.Texture, rx = 1, ry = 1) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
