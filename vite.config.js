import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // This workbox config tells the auto‑generated service worker
      // to NEVER cache any googleapis.com URLs (Firestore, Auth, Storage)
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/,
            handler: 'NetworkOnly',   // always let Firebase requests through
          },
        ],
      },
      manifest: {
        name: 'Talk & Task Enterprise',
        short_name: 'Talk&Task',
        description: 'Corporate Coordination Portal',
        theme_color: '#4F46E5',
        background_color: '#F8F7F4',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  // This line ensures jsPDF and its autotable plugin are pre‑bundled correctly
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
  },
});
