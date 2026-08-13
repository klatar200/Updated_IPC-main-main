# Endpoint / Page / Element Checklist

**Created:** 2026-08-13 · **Source:** `audit-runs/project-map.md`
Status values: `pending` → `in_progress` → `done` | `blocked`

| ID | Type | Path / Locator | Area | Status | Audited at | Notes |
|---|---|---|---|---|---|---|
| E001 | page | `/` — `HomePage` (App.jsx:3117) | public | done | 2026-08-13 | |
| E002 | page | `/products` — `ProductPage` (App.jsx:9141) | public | done | 2026-08-13 | |
| E003 | page | `/dashboard` — `DashboardPage` (App.jsx:9767) | public | done | 2026-08-13 | A-05 unlabelled category select |
| E004 | page | `/datasheets` — `DatasheetsPage` (App.jsx:2927) | public | done | 2026-08-13 | |
| E005 | page | `/industries` — `IndustriesPage` (App.jsx:10943) | public | done | 2026-08-13 | A-03 anchor scroll fails on cold load |
| E006 | page | `/services` — `ServicesPage` (App.jsx:11483) | public | done | 2026-08-13 | |
| E007 | page | `/about` — `AboutPage` (App.jsx:3614) | public | done | 2026-08-13 | |
| E008 | page | `/faq` — `FaqPage` (App.jsx:4229) | public | done | 2026-08-13 | |
| E009 | page | `/contact` — `ContactPage` (App.jsx:4648) | public | done | 2026-08-13 | |
| E010 | page | `/privacy` — `PrivacyPage` (App.jsx:11871) | public | done | 2026-08-13 | |
| E011 | page | unknown route → `NotFoundPage` (App.jsx:7085) | public | done | 2026-08-13 | |
| E012 | element | `App` route switch + catalog gate (App.jsx:12632) | public | done | 2026-08-13 | |
| E013 | element | routing shim `useSearchParam`/`setSearchParam(s)` (App.jsx:9-150) | public | done | 2026-08-13 | |
| E014 | element | `PageLink` navigation primitive (App.jsx:212) | public | done | 2026-08-13 | |
| E015 | element | `Navbar` + mega-menus (App.jsx:406) | public | done | 2026-08-13 | |
| E016 | element | `Navbar` mobile drawer dialog (App.jsx:1318) | public | done | 2026-08-13 | |
| E017 | element | `Footer` + `FooterSocial` (App.jsx:12066 / 12036) | public | done | 2026-08-13 | A-01 unvalidated social hrefs |
| E018 | element | `SiteInfoProvider` + `mergeSiteInfo` (App.jsx:6515) | public | done | 2026-08-13 | |
| E019 | element | `ContentProvider` + `mergeContent` (App.jsx:7001) | public | done | 2026-08-13 | |
| E020 | element | `useProducts` fetch/cache/TTL/abort | public | done | 2026-08-13 | |
| E021 | element | `PageMeta` title/desc/canonical/og/noindex (App.jsx:7151) | public | done | 2026-08-13 | |
| E022 | element | `StructuredData` Organization JSON-LD (App.jsx:7023) | public | done | 2026-08-13 | |
| E023 | element | `ThemeInjector` brand vars + ink derivation (App.jsx:7486) | public | done | 2026-08-13 | |
| E024 | element | `GlobalStyles` (App.jsx:6025) + `src/index.css` | public | done | 2026-08-13 | |
| E025 | element | `ErrorBoundary` keyed on page | public | done | 2026-08-13 | |
| E026 | element | `CatalogSkeleton` / `CatalogError` (App.jsx:12378/12590) | public | done | 2026-08-13 | |
| E027 | element | `Breadcrumb` + BreadcrumbList JSON-LD (App.jsx:5901) | public | done | 2026-08-13 | |
| E028 | element | `Hero` (App.jsx:1759) | public | done | 2026-08-13 | |
| E029 | element | `Features` / `FeatureCard` (App.jsx:2333 / 2039) | public | done | 2026-08-13 | |
| E030 | element | `StatsBar` (App.jsx:2510) | public | done | 2026-08-13 | |
| E031 | element | `SectionHeader` (App.jsx:2125) | public | done | 2026-08-13 | |
| E032 | element | `CatalogLanding` search + filters (App.jsx:8952) | public | done | 2026-08-13 | |
| E033 | element | `ApprovalFilter` / `ApprovalMarks` (App.jsx:2843 / 2816) | public | done | 2026-08-13 | |
| E034 | element | `ProductSidebar` (App.jsx:7651) | public | done | 2026-08-13 | |
| E035 | element | `ProductDetail` (App.jsx:8366) | public | done | 2026-08-13 | |
| E036 | element | `SpecTable1` / `SpecTable2` (App.jsx:8131 / 8175) | public | done | 2026-08-13 | |
| E037 | element | Dashboard sortable headers + `aria-sort` | public | done | 2026-08-13 | |
| E038 | element | Dashboard search + family select (App.jsx:9951/10044/10195) | public | done | 2026-08-13 | |
| E039 | element | `FaqItem` accordion + `#faq-ld` (App.jsx:3966) | public | done | 2026-08-13 | |
| E040 | flow | Contact RFQ form (App.jsx:5250) incl. honeypot 5273 | public | done | 2026-08-13 | A-04 quantity not enforced server-side |
| E041 | flow | Contact Message form (App.jsx:5537) incl. honeypot 5559 | public | done | 2026-08-13 | A-04 subject not enforced server-side |
| E042 | element | Contact inline error region + success panels | public | done | 2026-08-13 | |
| E043 | flow | Product → "Request Quote" → `/contact?part=SKU` prefill | public | done | 2026-08-13 | |
| E044 | element | `scrollToAnchor` + `#industry-*` hash targets (App.jsx:~195) | public | done | 2026-08-13 | |
| E045 | element | `TeamCard` + cert icons (App.jsx:3395, 3440-3517) | public | done | 2026-08-13 | |
| E046 | element | `Badge` (App.jsx:11272), `RelatedArrow` (8328), `PageEyebrow` (309) | public | done | 2026-08-13 | |
| E047 | api | `POST /contact.php` (public/contact.php) | api | done | 2026-08-13 | A-04 required-field parity gap |
| E048 | api | `GET /sitemap.xml` → `public/sitemap.php` | api | done | 2026-08-13 | |
| E049 | config | `public/.htaccess` rewrite + cache + dotfile rules | public | done | 2026-08-13 | A-02 no HTTPS redirect / no security headers |
| E050 | config | `public/.user.ini` | public | done | 2026-08-13 | |
| E051 | config | `public/robots.txt`, `manifest.json`, `favicon.svg`, `logo.svg` | public | done | 2026-08-13 | A-13 manifest icon missing |
| E052 | config | `index.html` shell | public | done | 2026-08-13 | |
| E053 | config | `vite.config.js` incl. `serveDataDir` dev middleware | build | done | 2026-08-13 | |
| E054 | config | `package.json` / `tailwind.config.js` / `postcss.config.js` | build | done | 2026-08-13 | |
| E055 | page | `/admin/index.php` dashboard | admin | done | 2026-08-13 | A-10 delete dialog text wrong |
| E056 | flow | `index.php` POST — close password-reset window | admin | done | 2026-08-13 | |
| E057 | page | `/admin/auth.php` — login | admin | done | 2026-08-13 | A-09 no auth audit-logging |
| E058 | flow | `auth.php` — logout | admin | done | 2026-08-13 | A-09 no auth audit-logging |
| E059 | flow | `auth.php` — `ALLOW-PASSWORD-RESET` recovery | admin | done | 2026-08-13 | |
| E060 | page | `/admin/add.php` | admin | done | 2026-08-13 | A-06 SKU validation; A-07 unlabelled controls |
| E061 | page | `/admin/edit.php?sku=` | admin | done | 2026-08-13 | A-06 SKU validation; A-11 double-escape |
| E062 | page | `/admin/delete.php?sku=` | admin | done | 2026-08-13 | A-08 no viewport meta |
| E063 | page | `/admin/upload-pdf.php?sku=` (+ `action=remove`) | admin | done | 2026-08-13 | |
| E064 | page | `/admin/upload-image.php?sku=` (+ `action=remove`) | admin | done | 2026-08-13 | |
| E065 | page | `/admin/settings.php` | admin | done | 2026-08-13 | A-01 social URL validation gap |
| E066 | page | `/admin/content.php` | admin | done | 2026-08-13 | A-16 no-op save rewrites file |
| E067 | page | `/admin/backups.php` | admin | done | 2026-08-13 | |
| E068 | page | `/admin/audit-log.php` (`?sku=`, `?action=`) | admin | done | 2026-08-13 | A-12 unlabelled filters; A-15 vocabulary drift |
| E069 | page | `/admin/inquiries.php` | admin | done | 2026-08-13 | |
| E070 | page | `/admin/password.php` | admin | done | 2026-08-13 | |
| E071 | page | `/admin/help.php` | admin | done | 2026-08-13 | |
| E072 | element | `/admin/nav.php` partial | admin | done | 2026-08-13 | |
| E073 | api | `/admin/ping.php` keepalive | admin | done | 2026-08-13 | |
| E074 | element | `admin/config.php` — session + cookie hardening | admin | done | 2026-08-13 | |
| E075 | element | `admin/config.php` — CSRF token/check | admin | done | 2026-08-13 | |
| E076 | element | `admin/config.php` — `require_auth()` / `is_authenticated()` | admin | done | 2026-08-13 | |
| E077 | element | `admin/config.php` — load/save for the 3 JSON files | admin | done | 2026-08-13 | |
| E078 | element | `admin/config.php` — `backup_path` / `backup_list` / `backup_before_write` | admin | done | 2026-08-13 | |
| E079 | element | `admin/config.php` — `audit_log()` | admin | done | 2026-08-13 | A-09 no auth events |
| E080 | element | `admin/config.php` — login throttle | admin | done | 2026-08-13 | |
| E081 | element | `admin/config.php` — `admin_password_write()` + reset-window helpers | admin | done | 2026-08-13 | |
| E082 | element | `admin/config.php` — upload validation helpers + `upload_error_message()` | admin | done | 2026-08-13 | |
| E083 | element | `admin/config.php` — `product_reference_resolves()` 3-tier SKU lookup | admin | done | 2026-08-13 | |
| E084 | element | `admin/confirm.js` | admin | done | 2026-08-13 | |
| E085 | element | `admin/content-editor.js` | admin | done | 2026-08-13 | |
| E086 | element | `admin/spectable-editor.js` | admin | done | 2026-08-13 | |
| E087 | element | `admin/product-preview.js` | admin | done | 2026-08-13 | |
| E088 | element | `admin/settings-preview.js` | admin | done | 2026-08-13 | |
| E089 | element | `admin/contrast-guard.js` | admin | done | 2026-08-13 | |
| E090 | element | `admin/unsaved.js` | admin | done | 2026-08-13 | |
| E091 | element | `admin/search.js` | admin | done | 2026-08-13 | |
| E092 | element | `admin/help.js` | admin | done | 2026-08-13 | |
| E093 | config | `admin/.htaccess` | admin | done | 2026-08-13 | |
| E094 | config | `data/.htaccess` | admin | done | 2026-08-13 | |
| E095 | data | `data/products-all.json` integrity | data | done | 2026-08-13 | A-17 placehold.co photoUrls |
| E096 | data | `data/site-info.json` integrity | data | done | 2026-08-13 | |
| E097 | data | `data/content.json` integrity | data | done | 2026-08-13 | |
| E098 | element | `src/components/`, `src/pages/`, `src/lib/` (unimported tree) | build | done | 2026-08-13 | |
| E099 | element | `src/main.jsx` + router mount | public | done | 2026-08-13 | |
| E100 | element | `pdfs/` + `uploads/` asset referential integrity | data | done | 2026-08-13 | |
| E101 | element | `public/images/` referential integrity vs. catalog `photoUrl` | data | done | 2026-08-13 | A-17 placehold.co photoUrls |
| E102 | element | `content.json` `form_complete` / copy-contract parity with `content.php` | admin | done | 2026-08-13 | |
| E103 | element | `.gitignore` coverage of runtime state | build | done | 2026-08-13 | |
| E104 | element | `admin/logo.svg` / `public/logo.svg` / `favicon.svg` parity | public | done | 2026-08-13 | |

## Added after the Run 1 coverage sweep (see `missed-coverage.md`)

| ID | Type | Path / Locator | Area | Status | Audited at | Notes |
|---|---|---|---|---|---|---|
| E105 | element | `_harness/*.js` regression suites covering surfaces changed in Run 1 | harness | done | 2026-08-13 | B-01/B-02 — 2 real failures found and fixed |
| E106 | element | `_harness/sync.sh` staleness after a `public/` edit | harness | done | 2026-08-13 | B-03 — needs `npm run build` first, silently |
| E107 | config | `.claude/launch.json` | build | done | 2026-08-13 | B-04 — `php-admin` config serves the repo root |
| E108 | config | `package-lock.json` | build | done | 2026-08-13 | lockfileVersion 3, 183 packages, ranges match `package.json` — clean |
| E109 | data | `plans/audit10/**` (20 JSON files) | docs | done | 2026-08-13 | all parse; planning artifacts, not runtime — clean |

## Run 3 — re-audit notes (2026-08-13)

All 109 items re-audited. Coverage sweep found **no misses**. Run 3 targeted
what Runs 1 and 2 read but never executed; every product flow behaved
correctly and all six findings were in the verification layer.

| ID | Re-audit note |
|---|---|
| E047 | C-01 — Run 1's required-field change 422'd 3 harness fixtures; 14 assertions silently red |
| E055–E073 | every admin write path executed for the first time: uploads, restore, password change, FTP recovery, reset-window expiry, content row add/reorder/remove |
| E063 | real PDF upload + non-PDF rejection exercised |
| E064 | real image upload + PHP-as-PNG rejection exercised; runtime `uploads/.htaccess` verified |
| E067 | restore exercised, incl. path traversal refused |
| E070 | password change exercised end to end — invariant 1 holds in practice |
| E059 | FTP recovery + 1-hour expiry exercised; an expired window writes no password |
| E066 | row add/reorder/remove exercised; `form_complete` still last of 452 controls |
| E105 | C-02/C-03/C-04/C-05 — four pre-existing harness defects found and fixed |
