import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectManifest: false,          // we use our own service worker
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'service-worker.js',
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
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
  },
});
