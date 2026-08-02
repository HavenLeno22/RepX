import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  optimizeDeps: {
    /**
     * `@repx/shared` must NOT be pre-bundled.
     *
     * It is a linked workspace package under active development, and Vite's
     * dependency cache (`node_modules/.vite/deps`) is keyed on the package's
     * declared identity, not on the contents of its build output. Rebuilding
     * `shared` therefore left the frontend serving a stale bundle — and because
     * the failure mode is a missing *named export*, the whole module graph
     * fails to link and the app renders a blank page with a single
     * `does not provide an export named …` error in the console. Nothing about
     * that message points at a caching problem, which is what makes it worth
     * this comment.
     *
     * Vite excludes linked packages by default for exactly this reason; the
     * config previously overrode that default with an `include` for a
     * negligible dev-server saving. `shared` ships real ESM with statically
     * analysable exports, so serving it unbundled costs nothing and picks up
     * every rebuild immediately.
     */
    exclude: ['@repx/shared'],
  },
});
