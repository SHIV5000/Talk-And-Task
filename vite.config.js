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
  define: {
    __BUILD_BRANCH_NAME__: JSON.stringify(gitInfo.branchName),
    __BUILD_COMMIT_HASH__: JSON.stringify(gitInfo.commitHash),
    __BUILD_COMMIT_SUBJECT__: JSON.stringify(gitInfo.commitSubject),
    __BUILD_COMMIT_DATE__: JSON.stringify(gitInfo.commitDate),
    __BUILD_SOURCE_REPO__: JSON.stringify(gitInfo.sourceRepo),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cacheId: 'talk-task-pwa',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Talk & Task Enterprise',
        short_name: 'Talk&Task',
        description: 'Corporate Coordination Portal',
        theme_color: '#4F46E5',
        background_color: '#f0f2f5',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
  },
});
