import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const src = 'assets-src/polyhaven', out = 'public/textures';
for (const f of readdirSync(src).filter((f) => f.endsWith('.jpg'))) {
  const name = f.replace('_1k.jpg', '').replace('_diff', '_col').replace('_nor_gl', '_nrm');
  await sharp(`${src}/${f}`).webp({ quality: f.includes('nor') ? 85 : 78 }).toFile(`${out}/${name}.webp`);
}
