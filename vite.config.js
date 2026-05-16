import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins:[
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // This glob pattern is more reliable for Vercel builds
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Talk & Task Enterprise',
        short_name: 'Talk&Task',
        description: 'Corporate Coordination Portal',
        theme_color: '#1e293b',
        background_color: '#f8fafc',
        display: 'standalone',
        icons:[
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
  },
});
