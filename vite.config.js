import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';  // ← This line must be exactly like this

VitePWA({
  registerType: 'autoUpdate',
  injectManifest: false,
  // 🧹 New workbox config to aggressively remove old caches
  workbox: {
    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
  },
  manifest: {
    name: 'Talk & Task Enterprise',
    short_name: 'Talk&Task',
    description: 'Corporate Coordination Portal',
    theme_color: '#008069',
    background_color: '#f0f2f5',
    display: 'standalone',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
})
