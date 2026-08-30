import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// PWA support (manifest.json + service worker) is hand-rolled in /public
// rather than via a plugin, so it's predictable with zero extra config —
// see public/manifest.json and public/sw.js, registered in src/main.tsx.
export default defineConfig({
  plugins: [react()],
  server: {
    // Required so getDisplayMedia / Clipboard API work when testing across
    // two devices on the same LAN — those APIs need a "secure context".
    // Run `npm run dev -- --host` and open the printed HTTPS/LAN address,
    // or use a tool like mkcert for a trusted local cert.
    host: true,
  },
});
