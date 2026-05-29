import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

function getGitInfo() {
  const safeRun = (cmd, fallback = 'unknown') => {
    try {
      return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
    } catch {
      return fallback;
    }
  };

  const branchName = safeRun('git rev-parse --abbrev-ref HEAD');
  const commitHash = safeRun('git rev-parse --short HEAD');
  const commitSubject = safeRun('git log -1 --pretty=%s');
  const commitDate = safeRun('git log -1 --date=format-local:%d-%b-%y %H:%M --pretty=%cd');
  const sourceRepo = safeRun('git config --get remote.origin.url');

  return {
    branchName,
    commitHash,
    commitSubject,
    commitDate,
    sourceRepo,
  };
}

const gitInfo = getGitInfo();

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
