import { defineConfig } from 'vite';
import path from 'node:path';
import { spawn } from 'node:child_process';
import react from '@vitejs/plugin-react';

const ROOT = path.resolve(import.meta.dirname, '../..');

// `npm run dev` also starts the API (dev/server.mjs :4321) so /api is never ECONNREFUSED.
// Set STUDIO_NO_API=1 to run it yourself. `--watch` restarts it when api/** changes.
function apiServer() {
  return {
    name: 'studio-api-server',
    apply: 'serve',
    configureServer(server) {
      if (process.env.STUDIO_NO_API) return;
      const child = spawn(process.execPath, ['--watch', 'dev/server.mjs'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT || '4321' } });
      const stop = () => { if (child.exitCode === null) child.kill(); };
      server.httpServer?.on('close', stop);
      for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { stop(); process.exit(); });
      process.once('exit', stop);
    },
  };
}

// Dev: `npm run dev` (vite :5173, spawns dev/server.mjs :4321). Prod: ui/dist served statically.
export default defineConfig({
  root: import.meta.dirname,
  envDir: ROOT,
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react(), apiServer()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:4321', '/projects': 'http://localhost:4321' } },
});
