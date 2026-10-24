import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';

// Dev: `npm run dev` (vite :5173) + `npm run dev:api` (dev/server.mjs :4321). Prod: ui/dist served statically.
export default defineConfig({
  root: import.meta.dirname,
  envDir: path.resolve(import.meta.dirname, '../..'),
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:4321', '/projects': 'http://localhost:4321' } },
});
