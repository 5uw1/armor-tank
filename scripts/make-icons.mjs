import sharp from 'sharp';
// Master icon + sizes for PWA/Electron; Capacitor native icons are generated from assets/icon.png
const svg = 'assets/icon.svg';
await sharp(svg).resize(1024, 1024).png().toFile('assets/icon.png');
await sharp(svg).resize(1024, 1024).png().toFile('assets/icon-only.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#15171a' } }).png().toFile('assets/icon-background.png');
await sharp(svg).resize(1024, 1024).png().toFile('assets/icon-foreground.png');
await sharp(svg).resize(2732, 2732, { fit: 'contain', background: '#15171a' }).png().toFile('assets/splash.png');
await sharp(svg).resize(2732, 2732, { fit: 'contain', background: '#15171a' }).png().toFile('assets/splash-dark.png');
await sharp(svg).resize(512, 512).png().toFile('build/icon.png');
for (const s of [192, 512]) await sharp(svg).resize(s, s).png().toFile(`public/icon-${s}.png`);
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons done');
