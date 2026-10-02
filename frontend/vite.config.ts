import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the dependencies that never change away from the app code that
         * changes on every deploy.
         *
         * This is a caching decision, not a size one — the bytes are the same
         * either way. In one chunk, shipping a one-line copy fix re-downloads
         * React, the router and the animation library along with it, because the
         * content hash in the filename moves. Split, a returning player fetches
         * only the app chunk and reuses ~150KB from cache.
         *
         * That matters more here than in most apps: RepX is opened on a phone,
         * on gym wifi or mobile data, immediately before someone wants to play,
         * and it already has a ~5MB pose model to fetch on first run. Every
         * kilobyte not spent on the shell is one available to the thing the app
         * cannot start without.
         *
         * `framer-motion` is kept separate from `react` deliberately: it is the
         * largest single dependency and the most likely to be upgraded, so
         * bundling it with React would invalidate both.
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
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
