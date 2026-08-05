import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * DEV ONLY — serve the repo's top-level `data/` folder at `/data/*`.
 *
 * The three runtime JSON files (`products-all.json`, `site-info.json`,
 * `content.json`) live in `data/`, which deploys to `public_html/data/` and is
 * written by the PHP admin. Vite's publicDir is `public/`, so in dev those
 * paths fell through to the SPA fallback and were answered with `index.html`
 * and a **200** — `res.ok` was true and the failure only surfaced as a JSON
 * syntax error. That is how a deleted catalog snapshot looked like a parse bug,
 * and why `mergeSiteInfo`/`mergeContent` were never exercised locally at all
 * (AUDIT_v3 4.24).
 *
 * Replaces the old `public/products-all.json` snapshot, which was a fourth copy
 * of the catalog and drifted from `data/` silently.
 */
function serveDataDir() {
  return {
    name: 'ipc-serve-data-dir',
    apply: 'serve',
    configureServer(server) {
      const dataDir = path.resolve(server.config.root, 'data');
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || '').split('?')[0];
        if (!urlPath.startsWith('/data/')) return next();

        let rel;
        try {
          rel = decodeURIComponent(urlPath.slice('/data/'.length));
        } catch {
          res.statusCode = 400;
          return res.end('{"error":"bad request"}');
        }

        // Containment: a `..` in the request must not escape data/. Mirrors the
        // basename()+realpath() containment every PHP read/write already uses.
        const resolved = path.resolve(dataDir, rel);
        if (resolved !== dataDir && !resolved.startsWith(dataDir + path.sep)) {
          res.statusCode = 403;
          return res.end('{"error":"forbidden"}');
        }

        fs.readFile(resolved, (err, buf) => {
          // Answer a miss with a real 404 rather than next()-ing into the SPA
          // fallback. Apache 404s a missing data file in production; dev must
          // fail the same way or it hides exactly the bug this plugin fixes.
          if (err) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end('{"error":"not found"}');
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          // No caching headers: the app's per-minute cache-buster is enough, and
          // stale data in dev is confusing.
          res.setHeader('Cache-Control', 'no-store');
          res.end(buf);
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveDataDir()],

  // `base` controls the asset URL prefix in the built HTML.
  // - Domain root (e.g. https://yourdomain.com/) → leave as './' or '/'.
  // - Subfolder (e.g. https://yourdomain.com/ipc/) → set to '/ipc/'.
  // './' is the safest default for shared hosting like Network Solutions
  // because it produces relative asset URLs that survive any deploy path.
  base: './',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Bundle into a single chunk per route to keep FTP uploads simple.
    chunkSizeWarningLimit: 1500,
  },

  server: {
    port: 5173,
    open: true,
  },
});
