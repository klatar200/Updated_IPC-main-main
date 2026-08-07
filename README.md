# IPC Website — Vite App + PHP Admin

A React + Vite static site for Insulation Products Corporation, plus a PHP
admin panel that manages the product catalog, business details, page content,
data sheets and product photos directly on the hosting server (no database, no
external API).

**Facts in this file were re-verified against the code on 2026-08-04.**
Corrections and the reasoning behind them are in `DEPLOY_READINESS_v2.md`.

## Prerequisites

- Node.js 18+ and npm 9+ for the local build
- PHP 7.4+ (8.0+ recommended) on the hosting server
- FTP/SFTP access to Network Solutions shared hosting

## Repository layout

```
Updated_IPC-main-main/
├── index.html              Vite entry — produces dist/index.html on build
├── package.json
├── vite.config.js          base: './' so assets work from any deploy path
├── tailwind.config.js
├── postcss.config.js
├── public/                 Copied verbatim into dist/ on build
│   ├── .htaccess           SPA rewrite + cache headers  (LOAD-BEARING, see below)
│   ├── .user.ini           PHP upload / form limits for the admin
│   ├── contact.php         Contact + RFQ handler (mail() + inquiry log)
│   ├── sitemap.php         Sitemap, generated from the live catalog per request
│   ├── favicon.svg, logo.svg, manifest.json, robots.txt
│   └── images/             Product and marketing imagery
├── src/
│   ├── main.jsx
│   ├── App.jsx             Entire React app (single file, 8,500+ lines)
│   └── index.css           Tailwind entry + first-paint-critical CSS
├── data/                   NOT bundled by Vite — deploy separately, ONCE
│   ├── .htaccess           Blocks backups, dotfiles, PHP execution
│   ├── products-all.json   Live catalog        — read by React, written by admin
│   ├── site-info.json      Business details    — read by React, written by admin
│   └── content.json        Editable page copy  — read by React, written by admin
├── pdfs/                   NOT bundled by Vite — deploy separately, ONCE
├── uploads/                NOT bundled by Vite — deploy separately, ONCE
│   ├── .htaccess           Blocks script execution on uploaded files
│   └── images/             Customer-uploaded product photos (admin writes here)
│                           NOTE: this folder is NOT in the repo — upload-image.php
│                           creates it (and its .htaccess) on first use. Do not go
│                           looking for it locally. (AUDIT_v3 D10)
└── admin/                  PHP admin panel — deploy separately
    ├── .htaccess           Force HTTPS, security headers, file blocks
    ├── config.php          Shared config, JSON helpers, CSRF, backups, throttle
    ├── config.local.php    THE admin password hash (gitignored, hand-deployed)
    ├── auth.php            Login + FTP-unlocked password recovery
    ├── index.php, edit.php, add.php, delete.php
    ├── settings.php        Business details
    ├── content.php         Page content
    ├── inquiries.php       Contact / RFQ leads
    ├── backups.php         Self-service restore
    ├── password.php        Change the admin password
    ├── audit-log.php, help.php, ping.php
    ├── upload-pdf.php, upload-image.php
    └── README.md           Admin-specific setup notes
```

`admin/import.php` does not exist and never did — earlier revisions of this file
listed it.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run dev` fetches `/data/products-all.json`, which Vite does not serve from
the repo root. `PRODUCTS_JSON_URL` has an `import.meta.env.DEV` branch for this;
`SITE_INFO_URL` and `CONTENT_URL` do not, so theming and editable content run on
their hardcoded defaults in dev. To exercise the real files, run a static server
over the repo root (`npx serve .`) — no HMR in that mode.

## Production build

```bash
npm run build        # → /dist
```

Produces `dist/index.html`, `dist/assets/index-[hash].{js,css}` (≈91 KB gzipped
JS, ≈4.5 KB gzipped CSS as of 2026-08-04) plus a verbatim copy of everything in
`public/`.

`dist/` is gitignored. It is a build artifact; rebuild it, don't commit it.

## Deploying to Network Solutions

Network Solutions cPanel uses Linux Apache. Connect via FTP/SFTP through
**My Account → Web Hosting → Manage → FTP File Manager**, or FileZilla.

### The deploy manifest

**This table is the authoritative list.** `DEPLOY_READINESS_v2.md` §7 is frozen
audit history and differs from this table in four rows; where they disagree, this
one wins. (Resolved 2026-08-05 — AUDIT_v3 D9.)

Everything you FTP is in `dist/` after `npm run build`, except `admin/` and the
hand-deployed password file.

| Upload to `public_html/` | From | When |
|---|---|---|
| `index.html`, `assets/` | `dist/` | every frontend deploy |
| `.htaccess`, `.user.ini`, `contact.php`, `sitemap.php`, `favicon.svg`, `logo.svg`, `manifest.json`, `robots.txt` | `dist/` (copied from `public/`) | when changed |
| `images/` | `dist/images/` (copied from `public/images/`) | when changed |
| `admin/` | `admin/` | this release |
| `admin/config.local.php` | (hand-deployed, gitignored) | this release — carries the password |

**Do NOT upload:**

| Path | Why |
|---|---|
| `data/products-all.json` | Live customer state. Settled 2026-08-04: download the server's copy, diff, and merge only if the repo copy is genuinely ahead. An FTP overwrite is irreversible and creates no backup. |
| `data/site-info.json`, `data/content.json` | Same — the owner edits these through the admin. |
| `pdfs/` | Live customer state. Same rule. |
| `uploads/` | Live customer state (product photos). `upload-image.php` creates `uploads/images/` and its `.htaccess` at runtime if absent. |
| `_localsite/`, `_harness/`, `node_modules/`, `src/`, `*.md` | Not part of the deployed site. |

`data/`, `pdfs/` and `uploads/` were uploaded once, on the first deploy, and are
now owned by the customer. Re-uploading them destroys his edits.

### Permissions

| Path | Permission | Why |
|---|---|---|
| `public_html/data/` | 755, **writable by PHP** | every admin save writes here |
| `public_html/data/*.json` | 644 (666 if PHP can't write) | |
| `public_html/pdfs/` | 755, **writable by PHP** | data-sheet uploads |
| `public_html/uploads/images/` | 755, **writable by PHP** | product photo uploads |
| `public_html/admin/` | 755, **writable by PHP** | see below |
| `public_html/admin/config.php` | 644 | |
| `public_html/admin/config.local.php` | 600 or 644 | contains the password hash |

**`admin/` must be writable by the PHP user, not just by FTP.** Four things are
written into it: `admin-log.jsonl` (the activity log), `inquiries.jsonl` (**every
inbound sales lead**), `.login-throttle.json`, and `config.local.php` (password
changes). On a host where the PHP user differs from the FTP user, all four fail
silently. The admin dashboard now detects this and shows a red banner; check it
after deploying.

### The admin password

There is **no shipped default password**. `admin/config.php` defines an
unsatisfiable sentinel, so a missing or damaged `config.local.php` fails closed —
nobody can sign in — rather than falling back to a password printed in the docs.

Deploy `admin/config.local.php` by hand. It is gitignored and carries the only
working hash.

**If the password is lost:** over FTP, upload an empty file named
`ALLOW-PASSWORD-RESET` into `public_html/admin/`, then open `/admin/` in a
browser. A one-time "Set admin password" screen appears and deletes the flag file
once a new password is set. Deleting `config.local.php` on its own does **not**
reset anything — it locks the admin completely.

### Verify after deploying

1. `https://yourdomain.com/` loads and the catalog populates within a second.
2. `https://yourdomain.com/admin/` — sign in, and check for a red "Server setup
   problem" banner on the dashboard.
3. Admin → Help → **What your server allows** — confirms the live PHP limits. If
   it reads 2M / 8M / 1000, `public/.user.ini` is not being applied on this host.
4. Submit the contact form once and confirm it appears under Admin → Inquiries.

### Subsequent deploys

```bash
npm run build
```

Then FTP the **contents** of `/dist` into `public_html/`, overwriting
`index.html` and `assets/`. Do not re-upload `data/`, `pdfs/`, `uploads/`, or
`admin/` unless you intend to change the admin code itself.

## Architecture notes

- **Three-file round-trip.** React fetches `/data/products-all.json`,
  `/data/site-info.json` and `/data/content.json` at runtime with a per-minute
  cache-buster; `data/.htaccess` caches for ~60 s. Admin edits appear publicly
  within about a minute of a page load.
  For a tab that is *already open*, only the **product catalog** refreshes
  itself: `useProducts()` re-checks its 60 s TTL whenever the tab is brought
  back to the front. `SiteInfoProvider` and `ContentProvider` fetch once with
  `[]` deps and do not — business details and page content need a reload.
  (The previous wording claimed all three expired after 60 s; measured, none of
  them did — AUDIT_v3 §3.1 / D11.)
- **`public/contact.php` is a second dynamic piece.** It ships into `dist/`,
  calls `mail()`, and appends to `admin/inquiries.jsonl`. The PHP admin is not
  the only server-side code.
- **Routing uses real path segments** (`/products`, `/contact`, `/dashboard`)
  plus search params for sub-page state (`?productId=`, `?family=`, `?part=`).
  **`public/.htaccess`'s rewrite is load-bearing, not a safety net** — without
  it, every direct navigation and every refresh on a deep path 404s. Earlier
  revisions of this file claimed navigation was query-param-only on the root
  URL; that was false, and acting on it would have deleted the rewrite.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page after upload | Uploaded `dist/` itself instead of its contents |
| Refresh on a deep path 404s | `.htaccess` missing from `public_html/` — it ships in `dist/` (from `public/`) |
| Products don't load | `data/products-all.json` not uploaded, or not readable (644) |
| "Failed to save" in admin | `data/` not writable by PHP |
| Inquiries page always empty | `admin/` not writable by PHP — leads are being dropped. The dashboard banner says so |
| Upload rejected as "too large" | Admin → Help → What your server allows. The effective ceiling is `min(upload_max_filesize, 20MB)` for PDFs and `min(…, 8MB)` for photos — the second figure is hardcoded in `upload-pdf.php:79` / `upload-image.php:102`, so raising `public/.user.ini` alone will not lift it (AUDIT_v3 D6) |
| "Content saved" but the page didn't change | Hard-refresh; the JSON is cached ~60 s |
| Admin login rejects a known-good password | `config.local.php` missing or overwritten. Use the `ALLOW-PASSWORD-RESET` recovery above |
| CSS looks wrong | Hard refresh (Ctrl+Shift+R) — assets are content-hashed |

## Key files cheat sheet

| File | Purpose |
|---|---|
| [src/App.jsx](src/App.jsx) | Entire React app. `PRODUCTS_JSON_URL` / `SITE_INFO_URL` / `CONTENT_URL` near the data-fetch section |
| [admin/config.php](admin/config.php) | Password plumbing, session hardening, JSON read/write, backup rotation, CSRF, upload errors |
| [admin/README.md](admin/README.md) | Admin-specific docs (password recovery, audit log, spec-table formats) |
| [public/.htaccess](public/.htaccess) | Ships into `dist/` — **load-bearing** SPA rewrite + asset caching |
| [public/.user.ini](public/.user.ini) | PHP upload and form-field limits |
| [data/.htaccess](data/.htaccess) | Blocks backups and PHP in the JSON folder |
| [DEPLOY_READINESS_v2.md](DEPLOY_READINESS_v2.md) | The audit this release was built against — deploy manifest in §7 |
| [WHATS_LEFT.md](WHATS_LEFT.md) | Open work, deliberately deferred items, and settled decisions |
