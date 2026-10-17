import { defineConfig } from 'vite';

/**
 * Vite configuration of the studio. `vite build` writes `dist/`, which the crew server serves at
 * `/` (relative asset paths, so it also works under a sub-path). The development server proxies
 * `/api` to the crew server on port 8790; `STUDIO_API` overrides it (a port such as `8791` for the
 * fake run, or a full URL).
 */
const api = process.env['STUDIO_API'];
const target = !api ? 'http://127.0.0.1:8790' : /^\d+$/.test(api) ? `http://127.0.0.1:${api}` : api;

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/fake': { target, changeOrigin: true },
    },
  },
});
