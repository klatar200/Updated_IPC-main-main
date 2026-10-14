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

/**
 * DEV ONLY — refuse the parts of the repo that are not the website.
 *
 * Vite's dev server serves its root — this whole repository — as raw files.
 * Measured (AUDIT-12 A12-L1-W1-G2-1): /admin/config.php came back as PHP
 * source, /.git/HEAD and /_harness/README.md were served, and so was the
 * harness mirror's admin/config.local.php. A copied-down live admin/ (the real
 * password hash, inquiries.jsonl with customers' names and phone numbers)
 * would be served the same way, to anyone who can reach the port once
 * `npm run dev -- --host` is used to check the site on a phone.
 *
 * The site itself needs none of it: the SPA, /src, /node_modules (incl.
 * /node_modules/.vite), /public's files, /data via serveDataDir, and /pdfs,
 * /images, /uploads for the pages that link them. A refused path gets a real
 * 404, like serveDataDir's miss, not the SPA shell.
 */
function denyRepoInternals() {
  const TOP = new Set(['admin', '_harness', 'audit-runs', 'plans']);
  return {
    name: 'ipc-deny-repo-internals',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let urlPath = (req.url || '').split('?')[0];
        try { urlPath = decodeURIComponent(urlPath); } catch { /* judged as sent */ }
        const top = urlPath.replace(/^\/+/, '').split('/')[0];
        const refused =
          TOP.has(top) ||
          (top.startsWith('.') && top !== '.well-known') ||
          (!urlPath.startsWith('/node_modules/') && /\.(php|jsonl|md|ini|log|bak|sh)$/i.test(urlPath));
        if (!refused) return next();
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not found (refused by the dev server: not part of the website)');
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveDataDir(), denyRepoInternals()],

  // `base` controls the asset URL prefix in the built HTML.
  // - Domain root (e.g. https://yourdomain.com/) → '/'.
  // - Subfolder (e.g. https://yourdomain.com/ipc/) → set to '/ipc/'.
  //
  // This was './', and relative asset URLs are NOT safe here — they are
  // actively broken by the very rewrite that makes this SPA work. Measured
  // 2026-08-08 (PLAN-8 A5):
  //
  //   GET /products/CC/extra          → 200, the SPA shell
  //   shell asks for ./assets/index-*.js
  //   browser resolves that against the CURRENT path, not the site root, so it
  //   requests /products/CC/assets/index-*.js
  //   .htaccess's catch-all rewrite has no such file, so it answers with
  //   index.html — 200, Content-Type text/html
  //   the browser tries to execute HTML as JavaScript and stops
  //
  // The visitor gets a blank white page and a console error. Every URL with
  // two or more path segments did this, on the live site, silently — the audit
  // only sampled single-segment typos (/quality, /prodcuts) where './'
  // happens to resolve correctly, so it reported a soft 404 and never saw the
  // white screen behind it.
  //
  // '/' makes the asset URLs absolute and independent of path depth, which is
  // what the SPA catch-all requires. The deploy target is the domain root —
  // the contents of /dist go into public_html/ (DEPLOY_READINESS_v2 §7) — so
  // there is no subfolder case to protect. If this site is ever moved into a
  // subfolder, set this to that subfolder rather than back to './'.
  base: '/',

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
