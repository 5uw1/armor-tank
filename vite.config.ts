import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the same build works on the web, inside Capacitor (Android/iOS) and in Electron (file://).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    VitePWA({
      // Registered manually in main.ts (only on the web, not in the native/desktop apps)
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Armor Tank',
        short_name: 'Armor Tank',
        description: 'เกมรถถังสมรภูมิเมือง 2.5D',
        lang: 'th',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#15171a',
        theme_color: '#15171a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the whole game (code + photo textures) for offline play
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
