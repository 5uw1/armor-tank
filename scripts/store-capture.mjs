// Store screenshots + feature graphic.
//   node scripts/store-capture.mjs            → store/screenshots/**, store/graphics/**
//   node scripts/store-capture.mjs city boss  → only these scenes
// Starts a Vite dev server (the capture drives the game through the dev-only window.__game hook),
// then runs Electron with an off-screen window that renders each scene at the exact store sizes.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 5199;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'warn' });
await server.listen();
// The URL goes through the environment: Electron quits straight away when a URL is on its command line
const child = spawn(electron, ['scripts/store-capture.cjs', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, CAPTURE_URL: `http://localhost:${PORT}/` },
});
child.on('exit', async (code) => {
  await server.close();
  if (!code) await finish();
  process.exit(code ?? 0);
});

/**
 * Stores reject or re-encode images with an alpha channel: flatten every screenshot to an RGB JPEG, and
 * turn the 2× feature-graphic renders into the exact 1024×500 Google Play asset.
 */
async function finish() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  // High-quality JPEG: both stores accept it, and it keeps every file well under Play's 8 MB limit
  for (const f of walk('store/screenshots').filter((f) => f.endsWith('.png'))) {
    await sharp(f).flatten({ background: '#000' }).jpeg({ quality: 90, mozjpeg: true }).toFile(f.replace(/\.png$/, '.jpg'));
    fs.rmSync(f);
  }
  for (const f of fs.readdirSync('store/graphics').filter((f) => f.endsWith('@2x.png'))) {
    const lang = f.match(/feature-graphic-(\w+)@2x/)[1];
    await sharp(path.join('store/graphics', f)).resize(1024, 500).flatten({ background: '#000' }).png().toFile(`store/graphics/play-feature-graphic-${lang}.png`);
    fs.rmSync(path.join('store/graphics', f));
  }
  fs.mkdirSync('store/icons', { recursive: true });
  fs.copyFileSync('public/icon-512.png', 'store/icons/play-icon-512.png');
  console.log('post-processed screenshots and graphics');
}
