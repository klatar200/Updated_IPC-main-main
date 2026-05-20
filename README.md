# IPC Website — Standalone Vite App + PHP Admin

A React + Vite static site for Insulation Products Corporation, plus a small
PHP admin panel that manages the product catalog and PDF data sheets directly
on the hosting server (no external API dependency).

## Prerequisites

- Node.js 18+ and npm 9+ for the local build
- PHP 7.4+ (8.0+ recommended) on the hosting server
- FTP/SFTP access to Network Solutions shared hosting

## Repository layout

```
React App 2/
├── index.html              Vite entry — produces dist/index.html on build
├── package.json
├── vite.config.js          base: './' so assets work from any deploy path
├── tailwind.config.js
├── postcss.config.js
├── public/                 Copied verbatim into dist/ on build
│   └── .htaccess           SPA rewrite + cache headers for the React app
├── src/
│   ├── main.jsx
│   ├── App.jsx             Entire React app (single-file, ~3,700 lines)
│   └── index.css           Tailwind entry
├── data/                   NOT bundled by Vite — deploy separately
│   ├── .htaccess           Blocks backups, dotfiles, PHP execution
│   └── products-all.json   Live catalog — read by the React app, written by admin
├── pdfs/                   NOT bundled by Vite — deploy separately
│   ├── .htaccess           Blocks PHP execution, restricts to GET
│   └── *.pdf               Uploaded data sheets (admin writes here)
└── admin/                  PHP admin panel — deploy separately
    ├── .htaccess           Force HTTPS, security headers, file blocks
    ├── config.php          Shared config + password hash
    ├── auth.php            Login (session-fixation hardened, rate-limited)
    ├── index.php, edit.php, add.php, delete.php
    ├── upload-pdf.php
    ├── import.php
    └── README.md           Admin-specific setup notes
```

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

During `npm run dev`, the React app fetches `/data/products-all.json` from the
dev server. Vite doesn't serve `/data/` by default, so for local testing
either:
- copy `data/products-all.json` to `public/products-all.json` temporarily and
  change `PRODUCTS_JSON_URL` in `src/App.jsx`, **or**
- run a small static server (e.g. `npx serve .` from the repo root) and visit
  http://localhost:3000 — that serves both `/data/` and Vite's HMR bundle would
  not apply, so this is fine only for static smoke-tests.

## Production build

```bash
npm run build        # → /dist
```

This produces:

```
dist/
├── index.html
├── .htaccess               (copied from public/)
└── assets/
    ├── index-[hash].js     (~83 KB gzipped)
    └── index-[hash].css    (~4  KB gzipped)
```

The bundle picks up `base: './'` so assets resolve relatively — safe to drop
into a subfolder if you ever need to.

## Deploying to Network Solutions

Network Solutions cPanel uses Linux Apache. Connect via FTP/SFTP through
**My Account → Web Hosting → Manage → FTP File Manager**, or a desktop client
like FileZilla.

### First deploy

Upload these four trees into `public_html/`:

| Source (local) | Destination (server) | Notes |
|---|---|---|
| `dist/*` (contents) | `public_html/` | React app + assets + .htaccess |
| `admin/` (whole folder) | `public_html/admin/` | PHP admin panel |
| `pdfs/` (whole folder) | `public_html/pdfs/` | PDF storage |
| `data/` (whole folder) | `public_html/data/` | **First deploy only** |

After upload, the server should look like:

```
public_html/
├── index.html        ← from dist/
├── assets/           ← from dist/
├── .htaccess         ← from dist/ (originally public/.htaccess)
├── data/
├── pdfs/
└── admin/
```

### Set permissions in cPanel File Manager

| Path | Permission |
|---|---|
| `public_html/data/` | 755 |
| `public_html/data/products-all.json` | 644 (or 666 if PHP can't write) |
| `public_html/pdfs/` | 755 |
| `public_html/admin/` | 755 |
| `public_html/admin/config.php` | 644 |

### Rotate the admin password

The shipped default is `ipc-admin-2025` and it's documented in this repo, so
anyone with the URL can log in until you change it. See
[admin/README.md](admin/README.md#changing-the-admin-password) for the
two-step server-side hashing flow.

### Verify

Visit `https://yourdomain.com/` — the React app should load and the product
catalog should populate within a second. Then visit
`https://yourdomain.com/admin/` and log in.

### Subsequent deploys

Whenever you change the React source:

```bash
npm run build
```

Then FTP the **contents** of `/dist` into `public_html/`, overwriting
`index.html` and `assets/`. **Do not re-upload `data/`, `pdfs/`, or `admin/`**
on subsequent deploys — those are managed live on the server through the
admin panel. The new build will pick up whatever the admin has written.

## Architecture notes

- **Catalog round-trip.** The React app fetches
  `/data/products-all.json`. The PHP admin writes the same path. Apache caches
  the JSON for 5 minutes (`data/.htaccess`), so admin edits show up on the
  public site within five minutes or instantly on hard refresh.
- **No external runtime dependency.** The site does not need OverAI or any
  third-party API to function — everything is served from your own domain.
- **Single-page app on a single path.** Navigation uses query params
  (`?page=products&productId=…`) on the root URL, so there are no deep paths
  to 404 on refresh. The `.htaccess` in `dist/` still falls through to
  `index.html` for safety.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page after upload | Uploaded `dist/` itself instead of its contents |
| Products don't load | `data/products-all.json` not uploaded, or file is 600 instead of 644 |
| "Failed to save" in admin | `data/products-all.json` not writable — set to 666 |
| PDF upload fails | `pdfs/` is missing or not writable — chmod 755 |
| Admin login loops | Default password not rotated and you tried the wrong one, OR sessions aren't persisting because PHP is below 7.0 |
| CSS looks wrong | Hard refresh (Ctrl+Shift+R) — Vite hashes assets, browser may have stale CSS |
| Refresh on a route gives 404 | `.htaccess` not in `public_html/` (Vite ships it in `dist/.htaccess`) |

## Key files cheat sheet

| File | Purpose |
|---|---|
| [src/App.jsx](src/App.jsx) | Entire React app. `PRODUCTS_JSON_URL` near the top points at `/data/products-all.json` |
| [admin/config.php](admin/config.php) | Admin password hash, session hardening, JSON read/write helpers |
| [admin/README.md](admin/README.md) | Admin-specific docs (password rotation, audit log, import flow) |
| [public/.htaccess](public/.htaccess) | Ships into `dist/` — SPA rewrite + asset caching |
| [data/.htaccess](data/.htaccess) | Blocks backups and PHP in the JSON folder |
| [pdfs/.htaccess](pdfs/.htaccess) | Blocks PHP execution in the upload folder |
