import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: `npm run dev` here + `node ui/server.mjs`; the proxy keeps Host as localhost so the
// server's host check passes. Prod: built into ui/dist and served by ui/server.mjs.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:4321', '/projects': 'http://localhost:4321' } },
});
