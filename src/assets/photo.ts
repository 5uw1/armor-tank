import * as THREE from 'three';
import { noiseField } from './textures';

/** Photo-scanned CC0 textures from Poly Haven (see CREDITS.md). */
export const PHOTO_IDS = ['asphalt_02', 'concrete_pavement', 'leafy_grass', 'clay_roof_tiles_02', 'grey_roof_tiles', 'concrete_floor_02', 'rubble', 'aerial_sand', 'dry_ground_01', 'sandstone_brick_wall_01', 'corrugated_iron_02', 'container_side', 'snow_02', 'asphalt_snow'] as const;
export type PhotoId = (typeof PHOTO_IDS)[number];

/** Real-world size of one texture tile in metres (from Poly Haven metadata). */
export const PHOTO_SIZE: Record<PhotoId, number> = {
  asphalt_02: 3,
  concrete_pavement: 1.8,
  leafy_grass: 2,
  clay_roof_tiles_02: 2.5,
  grey_roof_tiles: 3,
  concrete_floor_02: 2,
  rubble: 2,
  aerial_sand: 15,
  dry_ground_01: 4,
  sandstone_brick_wall_01: 2,
  corrugated_iron_02: 2.7,
  container_side: 1.94,
  snow_02: 2,
  asphalt_snow: 2,
};

const photo = {} as Record<PhotoId, { col: THREE.Texture; nrm: THREE.Texture }>;

export async function loadPhotoTextures(onProgress?: (done: number, total: number) => void) {
  const loader = new THREE.TextureLoader();
  const base = import.meta.env.BASE_URL + 'textures/';
  let done = 0;
  const total = PHOTO_IDS.length * 2;
  const load = async (url: string, color: boolean) => {
    const t = await loader.loadAsync(base + url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    onProgress?.(++done, total);
    return t;
  };
  await Promise.all(
    PHOTO_IDS.map(async (id) => {
      const [col, nrm] = await Promise.all([load(`${id}_col.webp`, true), load(`${id}_nrm.webp`, false)]);
      photo[id] = { col, nrm };
    }),
  );
}

let macroTex: THREE.Texture | null = null;
function macro() {
  if (macroTex) return macroTex;
  const n = 256;
  const f = noiseField(n, n, 777, 4, 5);
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = Math.round(f[i] * 255);
    data.set([v, v, v, 255], i * 4);
  }
  macroTex = new THREE.DataTexture(data, n, n);
  macroTex.wrapS = macroTex.wrapT = THREE.RepeatWrapping;
  macroTex.magFilter = THREE.LinearFilter;
  macroTex.minFilter = THREE.LinearMipmapLinearFilter;
  macroTex.generateMipmaps = true;
  macroTex.needsUpdate = true;
  return macroTex;
}

/**
 * Break up visible tiling by modulating albedo with large-scale world-space noise.
 */
export function addMacroVariation(m: THREE.MeshStandardMaterial, scale = 40, strength = 0.35, tint?: THREE.Color) {
  const tex = macro();
  m.onBeforeCompile = (s) => {
    s.uniforms.macroMap = { value: tex };
    s.uniforms.macroScale = { value: 1 / scale };
    s.uniforms.macroStrength = { value: strength };
    s.uniforms.macroTint = { value: tint ?? new THREE.Color(1, 1, 1) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMacroPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroPos;\nuniform sampler2D macroMap;\nuniform float macroScale;\nuniform float macroStrength;\nuniform vec3 macroTint;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float mA = texture2D(macroMap, vMacroPos.xz * macroScale).r;
          float mB = texture2D(macroMap, vMacroPos.xz * macroScale * 0.21 + 0.37).r;
          float m = mA * 0.6 + mB * 0.4 - 0.5;
          diffuseColor.rgb *= 1.0 + m * macroStrength;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * macroTint, clamp(mB * 1.6 - 0.5, 0.0, 1.0));
        }`,
      );
  };
  m.customProgramCacheKey = () => `macro-${scale}-${strength}`;
  return m;
}

/** Photo material whose texture tiles at the texture's real-world size (geometry UVs in metres). */
export function photoMaterial(id: PhotoId, opts: { tileScale?: number; normalScale?: number; color?: THREE.ColorRepresentation; roughness?: number; macro?: number; macroScale?: number; rotation?: number } = {}) {
  const p = photo[id];
  if (!p) throw new Error(`photo texture ${id} not loaded`);
  const size = PHOTO_SIZE[id] * (opts.tileScale ?? 1);
  const rep = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(1 / size, 1 / size);
    c.rotation = opts.rotation ?? 0;
    c.needsUpdate = true;
    return c;
  };
  const m = new THREE.MeshStandardMaterial({
    map: rep(p.col),
    normalMap: rep(p.nrm),
    normalScale: new THREE.Vector2(opts.normalScale ?? 1, opts.normalScale ?? 1),
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.9,
  });
  if (opts.macro) addMacroVariation(m, opts.macroScale ?? 40, opts.macro);
  return m;
}
