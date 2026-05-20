# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # → /dist  (FTP contents to public_html/ on Network Solutions)
npm run preview   # serve the built bundle locally
```

There is no test runner, linter, or formatter configured — `package.json` only defines `dev`, `build`, and `preview`.

### Local dev gotcha

`npm run dev` makes the React app fetch `/data/products-all.json`, but Vite does not serve the top-level `data/` directory. To smoke-test the catalog locally either copy `data/products-all.json` into `public/` and temporarily change `PRODUCTS_JSON_URL` in [src/App.jsx](src/App.jsx) (around line 4044), or run `npx serve .` from the repo root (no HMR in that mode).

## Architecture

This is a **hybrid static + PHP-admin app** with a deliberately narrow contract between the two halves: they share exactly one file (`data/products-all.json`) and one folder (`pdfs/`). Understanding that contract is the key to working on either side without breaking the other.

### Two deployables, four trees on the server

The repo builds to four independent trees that ship to `public_html/` separately:

| Local                    | Server                       | Built by      | Re-deploy when…                       |
|--------------------------|------------------------------|---------------|----------------------------------------|
| `dist/*` (from `npm run build`) | `public_html/`         | Vite          | React source changes                   |
| `admin/`                 | `public_html/admin/`         | (PHP, copied) | Admin code changes                     |
| `pdfs/`                  | `public_html/pdfs/`          | —             | First deploy only (admin writes here)  |
| `data/`                  | `public_html/data/`          | —             | **First deploy only** (admin writes here) |

After first deploy, `data/` and `pdfs/` are live state on the server — never re-upload them, or you will overwrite catalog edits and uploaded PDFs.

### React side ([src/App.jsx](src/App.jsx))

- **Single ~7700-line file.** The entire app — routing shims, data fetch, every page component — lives in `App.jsx`. There is no per-page file split. When editing, search for the section/component by name rather than expecting a conventional `pages/` or `components/` tree.
- **Routing shim layer at the top of the file.** The app originated on the OverAI platform and was ported to standalone Vite + react-router-dom. The top of `App.jsx` defines `useSearchParam` / `pathnameToPage` / `pageToPath` / module-level `_navigateRef` to emulate OverAI's globals. The `"page"` key reads/writes the URL pathname; every other key is a normal search param. Preserve this shim shape when editing routing — many call sites depend on `useSearchParam("page")` behaving like the original global.
- **Data fetch.** `PRODUCTS_JSON_URL = "/data/products-all.json"` is fetched at runtime with a cache-buster query. Apache caches the JSON for 5 min via `data/.htaccess`, so admin edits appear publicly within ~60s or instantly on hard refresh.
- **Vite config** sets `base: './'` so assets resolve relatively — the build can be dropped into any subfolder.

### Admin side (`admin/`)

PHP 7.4+, session auth, no external DB. Every PHP entry point includes [admin/config.php](admin/config.php), which:
- Starts the session with hardened cookies (`HttpOnly`, `Secure` when HTTPS, `SameSite=Lax`, custom name `IPCADMIN`) **before** any output.
- Defines `load_products()` / `save_products()` — the only two functions that touch `data/products-all.json`. `save_products()` writes timestamped backups (`products-all.backup.<datetime>.json`, keeps 5 most recent), sorts by SKU, and uses `LOCK_EX`.
- Provides `csrf_token()` / `csrf_check()` — every mutating page must call `csrf_check()` after `require_auth()`.
- Provides `audit_log($action, $sku, $detail)` writing to `admin/admin-log.jsonl`. Every add/edit/delete/PDF/import flow logs here.
- Stores `ADMIN_PASSWORD_HASH` as a **pre-computed bcrypt string** — do not replace it with an inline `password_hash()` call (would regenerate the salt per request and break login). Rotation is a server-side two-step flow documented in [admin/README.md](admin/README.md).

The admin's I/O surface is exactly: read/write `data/products-all.json`, read/write/delete files in `pdfs/`, append to `admin/admin-log.jsonl`. No other shared state.

### Why this shape

- **No runtime backend, no external API.** Everything is served from the customer's own Network Solutions hosting. The React app is fully static; the PHP admin is the only dynamic piece and only the customer logs into it.
- **Single-page app on a single path.** Public navigation uses query params on `/`, so there are no deep routes to 404; the `.htaccess` SPA-rewrite is a safety net, not a primary mechanism.
- **Catalog round-trip is the entire integration.** If you change the JSON shape, change both the React parsing in [src/App.jsx](src/App.jsx) and the admin form/validation in [admin/edit.php](admin/edit.php) + [admin/add.php](admin/add.php) — they're the same schema by convention only.

## Deploy

Subsequent deploys after first-time setup: `npm run build`, then FTP the **contents** of `/dist` (`index.html` + `assets/`) into `public_html/`. Do not re-upload `data/`, `pdfs/`, or `admin/` unless you intend to change the admin code itself. Full first-deploy steps, permissions table, and password rotation in [README.md](README.md) and [admin/README.md](admin/README.md).
