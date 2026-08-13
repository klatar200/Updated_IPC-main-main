# IPC Website + /admin — Project Map

**Generated:** 2026-08-13
**Root:** repository root (hybrid static React site + PHP admin)
**Method:** direct source read of `src/App.jsx`, `admin/*.php`, `public/*`, `data/*`,
`vite.config.js`, `index.html`, `.htaccess` files.

---

## 1. System areas

| Area | Where | Runtime | Notes |
|---|---|---|---|
| Public site (SPA) | `src/App.jsx` (12,744 lines), `src/index.css`, `index.html`, `src/main.jsx` | Browser, React 18 + react-router-dom | Single-file app. `src/components/`, `src/pages/`, `src/lib/` exist but **nothing imports them** — dead extraction. |
| Public dynamic PHP | `public/contact.php`, `public/sitemap.php` | Apache + PHP 7.4+ | Ship into `dist/` → `public_html/`. |
| Admin dashboard | `admin/*.php` + `admin/*.js` | Apache + PHP 7.4+, session auth, no DB | 17 PHP entry points, 9 JS enhancement files. |
| Data layer | `data/products-all.json`, `data/site-info.json`, `data/content.json` | Flat JSON on disk | Read by SPA over HTTP, read/written by admin over the filesystem. |
| Uploads | `pdfs/`, `uploads/images/` | Filesystem | Written by `admin/upload-pdf.php`, `admin/upload-image.php`. |
| Runtime logs / state | `admin/admin-log.jsonl`, `admin/inquiries.jsonl`, `admin/.login-throttle.json`, `admin/config.local.php`, `admin/ALLOW-PASSWORD-RESET` | Filesystem, gitignored | Not in the repo; created at runtime. |
| Server config | `public/.htaccess`, `public/.user.ini`, `admin/.htaccess`, `data/.htaccess` | Apache | `public/.htaccess` rewrite is load-bearing for every deep link. |
| Build | `vite.config.js`, `package.json`, `tailwind.config.js`, `postcss.config.js` | Node/Vite | `npm run dev|build|preview`. No test runner, no linter, no formatter. |
| Verification harness | `_harness/*.js|php` (~180 scripts) | Node + Playwright, `php -S` | Not part of the deploy tree. |

---

## 2. Public route inventory (SPA)

Routing shim lives at `src/App.jsx:9-150`. The `"page"` key maps to the URL
**pathname**; every other key is a search param. Route set is derived from
`SEO_DEFAULT` (`App.jsx:6702`) into `KNOWN_ROUTES` (`App.jsx:6811`); anything
else, or any path with a second segment (`hasExtraSegments`, `App.jsx:28`),
renders `NotFoundPage`.

| # | Path | Component | Line | Needs catalog? | Query params consumed |
|---|---|---|---|---|---|
| 1 | `/` | `HomePage` | 3117 | no | — |
| 2 | `/products` | `ProductPage` | 9141 | **yes** | `productId`, `family`, `approval` |
| 3 | `/dashboard` | `DashboardPage` | 9767 | **yes** | `q` (search), sort state is local |
| 4 | `/datasheets` | `DatasheetsPage` | 2927 | **yes** | `approval` |
| 5 | `/industries` | `IndustriesPage` | 10943 | no | hash anchors (`#industry-*`) |
| 6 | `/services` | `ServicesPage` | 11483 | no | — |
| 7 | `/about` | `AboutPage` | 3614 | no | — |
| 8 | `/faq` | `FaqPage` | 4229 | no | hash anchors |
| 9 | `/contact` | `ContactPage` | 4648 | no | `part` (SKU prefill), `tab` |
| 10 | `/privacy` | `PrivacyPage` | 11871 | no | — |
| — | anything else | `NotFoundPage` | 7085 | no | server still answers 200; `noindex` via `PageMeta` |

### Shell / cross-page components

| Component | Line | Role |
|---|---|---|
| `App` | 12632 | route switch, catalog gate, error boundary keyed on `page` (invariant 7) |
| `SiteInfoProvider` | 6515 | fetches `/data/site-info.json`, `mergeSiteInfo` (invariant 4) |
| `ContentProvider` | 7001 | fetches `/data/content.json`, `mergeContent` (invariant 3) |
| `useProducts` (in-file) | — | fetches `/data/products-all.json`, 60 s TTL, 12 s abort, refresh on tab focus |
| `Navbar` | 406 | logo, primary nav, two mega-menus, mobile drawer, catalog-failed state |
| `Footer` | 12066 | brand block, nav columns, social (`FooterSocial` 12036), catalog PDF link |
| `PageMeta` | 7151 | `<title>`, meta description, canonical, `og:*`, `noindex` on 404 |
| `StructuredData` | 7023 | Organization JSON-LD |
| `ThemeInjector` | 7486 | brand CSS variables + WCAG-derived ink variables |
| `GlobalStyles` | 6025 | injected CSS (complements `src/index.css`, invariant 9) |
| `ErrorBoundary` | (imported inline) | keyed on `page` |
| `CatalogSkeleton` / `CatalogError` | 12378 / 12590 | loading + failure states for the three catalog routes |
| `PageLink` | 212 | the single crawlable navigation primitive (real `<a href>`) |
| `Breadcrumb` | 5901 | trail + BreadcrumbList JSON-LD |

### Per-page key UI elements / flows

| Page | Elements & flows |
|---|---|
| Home (3117) | `Hero` (1759), `Features`/`FeatureCard` (2333/2039), `StatsBar` (2510), `SectionHeader` (2125), market cards, CTAs |
| Products (9141) | `CatalogLanding` (8952) with search box (`App.jsx:8977`), family filter pills, `ApprovalFilter` (2843); `ProductSidebar` (7651) product lists + family filter; `ProductDetail` (8366) with `SpecTable1` (8131), `SpecTable2` (8175), `ApprovalMarks` (2816), datasheet link, related products (`RelatedArrow` 8328), "Request Quote" → `/contact?part=SKU` |
| Dashboard (9767) | search input (10044/10195), family `<select>` (9951), sortable table headers (buttons inside `th`, `aria-sort`), per-row links |
| Datasheets (2927) | `ApprovalFilter`, family grouping, PDF download links |
| Industries (10943) | industry cards, `#industry-*` anchor scroll (`scrollToAnchor`, App.jsx:~195), product-code links resolved via 3-tier SKU lookup |
| Services (11483) | service cards, lead-time banner from `site-info.services[].leadTime` |
| About (3614) | `TeamCard` (3395), cert icon set (3440–3517), `tel:`/`mailto:` from site-info |
| FAQ (4229) | `FaqItem` accordion (3966) with `hidden` gating, FAQPage JSON-LD (`#faq-ld`) |
| Contact (4648) | **two forms**: RFQ (`<form>` 5250, honeypot 5273, fields 5334–5472) and Message (`<form>` 5537, honeypot 5559, fields 5629–5677); tab switcher; inline `role="alert"` error region; success panels; contact tips sidebar |
| Privacy (11871) | `privacySections` from content.json (invariant 3), effective date |
| 404 (7085) | message + links home |
| Modal | `role="dialog" aria-modal` at 1318 (mobile nav drawer in `Navbar`) |

---

## 3. Backend / endpoint inventory

### 3a. Public PHP endpoints (ship into `public_html/`)

| Endpoint | File | Method | Auth | Purpose |
|---|---|---|---|---|
| `POST /contact.php` | `public/contact.php` (610 ln) | POST only (405 otherwise) | none (public) | RFQ + message submission → `mail()` + append `admin/inquiries.jsonl` |
| `GET /sitemap.xml` → `sitemap.php` | `public/sitemap.php` (180 ln) | GET | none | XML sitemap built from `data/products-all.json`; rewrite in `public/.htaccess`; **no `sitemap.xml` file exists on purpose** |

`contact.php` internals: rate limiter (per-IP, before referer/honeypot),
referer check (absent = accept, invariant 11), honeypot `website` field,
`form_type` switch (`rfq` | `message`), field caps (`IPC_MAX_LINE` 200 /
`IPC_MAX_TEXT` 5000), `s()` (no HTML escape — invariant 10), `hdr()` for
header-bound values, auto-reply with `ipc_ar_cap_key()` gmail-aware cap,
`ipc_log_inquiry()`, 16 MB JSONL rotation.

### 3b. Admin endpoints (`public_html/admin/`)

All include `admin/config.php`. All call `require_auth()` before output except
`auth.php` and `ping.php`. All mutating POSTs call `csrf_check()`.

| Endpoint | File | Lines | Methods | Auth | Purpose |
|---|---|---|---|---|---|
| `/admin/` `index.php` | dashboard | 244 | GET, POST | yes | product list, health banners, flash messages, POST = close password-reset window |
| `auth.php` | login / logout / reset | 232 | GET, POST | no (gate) | login throttle, logout (`csrf_check(false)`), `ALLOW-PASSWORD-RESET` recovery flow |
| `add.php` | new product | 256 | GET, POST | yes | create SKU, spec-table JSON validation, repopulate on error |
| `edit.php` | edit product | 460 | GET, POST | yes | `?sku=`; optimistic-concurrency signature; spec tables |
| `delete.php` | delete product | 132 | GET, POST | yes | `?sku=`; confirm page; removes unique photo, keeps shared |
| `upload-pdf.php` | datasheet upload | 249 | GET, POST | yes | `?sku=`; `action=remove`; `pdf_in_use()` guard |
| `upload-image.php` | photo upload | 236 | GET, POST | yes | `?sku=`; `action=remove`; ext + sniffed MIME |
| `settings.php` | site info | 447 | GET, POST | yes | rebuilds `site-info.json` wholesale; brand colors; contrast note |
| `content.php` | page copy | 1107 | GET, POST | yes | 12 copy groups / 96 fields + section rows; `form_complete` sentinel **must stay last** (invariant 6) |
| `backups.php` | backup/restore | 208 | GET, POST | yes | list + restore per data file |
| `audit-log.php` | audit log viewer | 155 | GET | yes | filters `?sku=`, `?action=` |
| `inquiries.php` | lead inbox | 204 | GET | yes | tail-reads `inquiries.jsonl` (2 MB), streams count |
| `password.php` | change password | 143 | GET, POST | yes | `admin_password_write()` (invariant 1) |
| `help.php` | in-app documentation | 996 | GET | yes | — |
| `nav.php` | shared nav partial | 82 | include | yes | `require_auth()` defense in depth |
| `ping.php` | session keepalive | 16 | GET | **no** (deliberate) | returns without redirecting so the keepalive can't bounce to login |
| `config.php` | shared bootstrap | 1158 | include | — | session, loaders/savers, CSRF, audit log, throttle, uploads helpers |

### 3c. Admin client-side JS

| File | Attached to | Role |
|---|---|---|
| `confirm.js` | all destructive controls | `data-confirm` with `{it}` placeholder resolved at click time, capture-phase |
| `content-editor.js` | `content.php` | add/remove/reorder rows |
| `spectable-editor.js` | `add.php`, `edit.php` | spec-table grid ↔ JSON |
| `product-preview.js` | `add.php`, `edit.php` | live product preview |
| `settings-preview.js` | `settings.php` | live site-info preview |
| `contrast-guard.js` | `settings.php` | live WCAG ratio readout on color pickers |
| `unsaved.js` | forms | `beforeunload` guard |
| `search.js` | `index.php` | client-side product filter |
| `help.js` | `help.php` | TOC / section nav |

### 3d. Dev-only endpoint

| Endpoint | Where | Notes |
|---|---|---|
| `/data/*` | `vite.config.js` `serveDataDir` middleware (`apply: 'serve'`) | maps onto the repo's top-level `data/`, `..` containment, real 404 on miss. Dev only. |

---

## 4. Data contracts

| File | Written by | Read by | Merge rule |
|---|---|---|---|
| `data/products-all.json` (239 KB) | `add.php`, `edit.php`, `delete.php`, `upload-*.php`, `backups.php` | SPA `useProducts`, `sitemap.php`, `content.php` (`product_reference_resolves`) | none — used as-is |
| `data/site-info.json` (3 KB) | `settings.php`, `backups.php` | SPA `SiteInfoProvider`, `contact.php` | `mergeSiteInfo` — drops blank strings except `SITE_CLEARABLE` allow-list (invariant 4) |
| `data/content.json` (39 KB) | `content.php`, `backups.php` | SPA `ContentProvider`, `contact.php` (auto-reply copy) | `mergeContent` — empty array = deletion (invariant 3), `COPY_CLEARABLE` allow-list |

Every write routes through `backup_before_write()` → `backup_path()` (max-used
+ 1 sequence, invariant 5); `backup_list()` sorts on parsed (timestamp, seq).

---

## 5. Auth / role boundaries

- **One role**: the owner. No user table, no DB. Password hash lives in
  `admin/config.local.php` (gitignored); `config.php` ships an unsatisfiable
  sentinel (invariant 2).
- **Session**: name `IPCADMIN`, `HttpOnly`, `Secure` on HTTPS, `SameSite=Lax`,
  `gc_maxlifetime` 8 h. `regenerate_session_id()` on login.
- **Gate**: `require_auth()` (config.php:354) — renders a session-expired page on
  POST rather than redirecting (invariant 12), 302 to `auth.php` on GET.
- **CSRF**: `csrf_token()` / `csrf_check()` (config.php:228/289); `csrf_check(false)`
  for logout and password-reset (no session/auth yet).
- **Throttle**: IP-keyed login throttle in `admin/.login-throttle.json`.
- **Recovery**: `admin/ALLOW-PASSWORD-RESET` file placed by FTP, expires 1 h after
  mtime (`PASSWORD_RESET_WINDOW`); dashboard health banner + one-click close.
- **File blocking**: `admin/.htaccess` and `data/.htaccess` deny direct access to
  `.jsonl`, dotfiles, the reset flag, and config includes. **Not exercised by
  `php -S`** — Apache is the real gate.

---

## 6. Deploy trees

| Local | Server | Re-deploy when |
|---|---|---|
| `dist/*` | `public_html/` | React source changes |
| `public/*` | `public_html/` | `.htaccess`, `.user.ini`, `contact.php`, `sitemap.php`, images |
| `admin/` | `public_html/admin/` | admin code changes |
| `admin/config.local.php` | `public_html/admin/` | password changes (hand-deployed, gitignored) |
| `data/`, `pdfs/`, `uploads/` | same names | **first deploy only** — live customer state afterwards |

---

## 7. Documentation surface (in repo, not deployed)

`README.md`, `CLAUDE.md`, `WHATS_LEFT.md` (317 KB, append-only state of record),
`DEPLOY_READINESS_v2.md` (frozen), `AUDIT_v3_FINDINGS.md` (frozen),
`PATCH_NOTES.md`, `UI_UX_AUDIT_2026-08-08.md`, `UX_AUDIT_PREPROD_2026-08-12.md`,
`plans/PLAN-0…10`, `plans/GUARDRAILS.md`, `_harness/README.md`,
`admin/README.md`, `Editing-Your-Site-Content.md`,
`IPC Admin Dashboard - Help and Documentation.docx`.
