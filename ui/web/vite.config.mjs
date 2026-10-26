import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import { spawn } from 'node:child_process';
import react from '@vitejs/plugin-react';

const ROOT = path.resolve(import.meta.dirname, '../..');

// `npm run dev` also starts the API (dev/server.mjs :4321) so /api is never ECONNREFUSED.
// Set STUDIO_NO_API=1 to run it yourself. `--watch` restarts it when api/** changes.
// In --mode mock nothing is spawned: dev/mock.mjs (:4322) is run separately.
function apiServer(mode) {
  return {
    name: 'studio-api-server',
    apply: 'serve',
    configureServer(server) {
      if (process.env.STUDIO_NO_API || mode === 'mock') return;
      const child = spawn(process.execPath, ['--watch', 'dev/server.mjs'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT || '4321' } });
      const stop = () => { if (child.exitCode === null) child.kill(); };
      server.httpServer?.on('close', stop);
      for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { stop(); process.exit(); });
      process.once('exit', stop);
    },
  };
}

// Dev: `npm run dev` (vite :5173, spawns dev/server.mjs :4321). Prod: ui/dist served statically.
// Mock: `vite ui/web --mode mock` reads .env.mock — STUDIO_API retargets the proxy to dev/mock.mjs.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, ['VITE_', 'NEXT_PUBLIC_', 'STUDIO_']);
  const api = env.STUDIO_API || 'http://localhost:4321';
  return {
    root: import.meta.dirname,
    envDir: ROOT,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), apiServer(mode)],
    build: { outDir: '../dist', emptyOutDir: true, rollupOptions: { input: { main: 'index.html', guide: 'guide.html' } } },
    server: { proxy: { '/api': api, '/projects': api, '/mock': api } },
  };
});
