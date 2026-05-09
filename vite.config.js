import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Talk & Task Board Edition',
        short_name: 'Talk&Task',
        description: 'Team communication with built‑in task management',
        theme_color: '#4F46E5',
        background_color: '#F8F7F4',
        display: 'standalone',
        icons: [
        { src: 'https://cdn-icons-png.flaticon.com/512/825/825590.png', sizes: '192x192', type: 'image/png' },
        { src: 'https://cdn-icons-png.flaticon.com/512/825/825590.png', sizes: '512x512', type: 'image/png' }
    ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      }
    })
  ]
});
