# Audit 9 — coverage ledger (PLAN-11 §5)

**Created:** 2026-09-14 from `audit-runs/endpoint-checklist.md` (E001–E112, statuses reset, `App.jsx:<line>` re-measured on `2121597` by `grep -nE "^(function|const|class) <Name>"`). Extended from E113. **Only C edits this file.** Status: `pending` → `done` | `blocked <reason>`, each with a date. Not in the ledger → not in the audit; C adds the row first (§10.2.1). One owner per row.

| ID | Type | Path / Locator | Area | Pass | Status | Audited at | Notes |
|---|---|---|---|---|---|---|---|
| E001 | page | `/` — `HomePage` (App.jsx:3125) | public | P6 | done | 2026-09-14 |  |
| E002 | page | `/products` — `ProductPage` (App.jsx:9395) | public | P6 | done | 2026-09-14 |  |
| E003 | page | `/dashboard` — `DashboardPage` (App.jsx:10023) | public | P6 | done | 2026-09-14 | A-05 unlabelled category select (2026-08-13, closed since — re-verify, do not re-report) |
| E004 | page | `/datasheets` — `DatasheetsPage` (App.jsx:2935) | public | P6 | done | 2026-09-14 |  |
| E005 | page | `/industries` — `IndustriesPage` (App.jsx:11208) | public | P6 | done | 2026-09-14 | A-03 anchor scroll fails on cold load (2026-08-13, closed since — re-verify, do not re-report) |
| E006 | page | `/services` — `ServicesPage` (App.jsx:11748) | public | P6 | done | 2026-09-14 |  |
| E007 | page | `/about` — `AboutPage` (App.jsx:3622) | public | P6 | done | 2026-09-14 |  |
| E008 | page | `/faq` — `FaqPage` (App.jsx:4237) | public | P6 | done | 2026-09-14 |  |
| E009 | page | `/contact` — `ContactPage` (App.jsx:4656) | public | P6 | done | 2026-09-14 |  |
| E010 | page | `/privacy` — `PrivacyPage` (App.jsx:12136) | public | P6 | done | 2026-09-14 |  |
| E011 | page | unknown route → `NotFoundPage` (App.jsx:7239) | public | P6 | done | 2026-09-14 |  |
| E012 | element | `App` route switch + catalog gate (App.jsx:12973) | public | P7 | done | 2026-09-14 |  |
| E013 | element | routing shim `useSearchParam`/`setSearchParam(s)` (App.jsx:28-197 (`hasExtraSegments` 28, `useSearchParam` 41, `setSearchParam` 114)) | public | P7 | done | 2026-09-14 |  |
| E014 | element | `PageLink` navigation primitive (App.jsx:212) | public | P6 | done | 2026-09-14 |  |
| E015 | element | `Navbar` + mega-menus (App.jsx:406) | public | P6 | done | 2026-09-14 |  |
| E016 | element | `Navbar` mobile drawer dialog (App.jsx:1321) | public | P9 | done | 2026-09-14 |  |
| E017 | element | `Footer` + `FooterSocial` (App.jsx:12410 / 12383) | public | P6 | done | 2026-09-14 | A-01 unvalidated social hrefs (2026-08-13, closed since — re-verify, do not re-report) |
| E018 | element | `SiteInfoProvider` + `mergeSiteInfo` (App.jsx:6625) | public | P7 | done | 2026-09-14 |  |
| E019 | element | `ContentProvider` + `mergeContent` (App.jsx:7161) | public | P7 | done | 2026-09-14 |  |
| E020 | element | `useProducts` fetch/cache/TTL/abort | public | P7 | done | 2026-09-14 |  |
| E021 | element | `PageMeta` title/desc/canonical/og/noindex (App.jsx:7305) | public | P6 | done | 2026-09-14 |  |
| E022 | element | `StructuredData` Organization JSON-LD (App.jsx:7170) | public | P4 | done | 2026-09-14 |  |
| E023 | element | `ThemeInjector` brand vars + ink derivation (App.jsx:7654) | public | P9 | done | 2026-09-14 |  |
| E024 | element | `GlobalStyles` (App.jsx:6057) + `src/index.css` | public | P9 | done | 2026-09-14 |  |
| E025 | element | `ErrorBoundary` keyed on page | public | P7 | done | 2026-09-14 |  |
| E026 | element | `CatalogSkeleton` / `CatalogError` (App.jsx:12723/12931) | public | P7 | done | 2026-09-14 |  |
| E027 | element | `Breadcrumb` + BreadcrumbList JSON-LD (App.jsx:5933) | public | P4 | done | 2026-09-14 |  |
| E028 | element | `Hero` (App.jsx:1761) | public | P5a | done | 2026-09-14 |  |
| E029 | element | `Features` / `FeatureCard` (App.jsx:2339 / 2045) | public | P5a | done | 2026-09-14 |  |
| E030 | element | `StatsBar` (App.jsx:2518) | public | P5a | done | 2026-09-14 |  |
| E031 | element | `SectionHeader` (App.jsx:2131) | public | P5a | done | 2026-09-14 |  |
| E032 | element | `CatalogLanding` search + filters (App.jsx:9176) | public | P7 | done | 2026-09-14 | P7 C3 9/9 empty state (name, Clear control, phone) + `plan8-catalog` 16/16 drives the search box to empty |
| E033 | element | `ApprovalFilter` / `ApprovalMarks` (App.jsx:2851 / 2824) | public | P7 | done | 2026-09-14 | `plan7-approvals` 11/11; P7 C3 established `?approval=` is not a route param (useState in DashboardPage) so an unknown value is inert |
| E034 | element | `ProductSidebar` (App.jsx:7819) | public | P6 | done | 2026-09-14 |  |
| E035 | element | `ProductDetail` (App.jsx:8588) | public | P6 | done | 2026-09-14 |  |
| E036 | element | `SpecTable1` / `SpecTable2` (App.jsx:undefined / undefined) | public | P4 | done | 2026-09-14 |  |
| E037 | element | Dashboard sortable headers + `aria-sort` (App.jsx:10023+) | public | P9 | done | 2026-09-14 |  |
| E038 | element | `DashboardPage` search + family select (App.jsx:10023+; re-measure in pass) | public | P7 | done | 2026-09-14 | family select via `plan10-dashboard` 25/25; search measured by P7 (42→1→empty→42) — `_harness/out/audit9/P7/e038-e091-close.js` |
| E039 | element | `FaqItem` accordion + `#faq-ld` (App.jsx:3974) | public | P9 | done | 2026-09-14 |  |
| E040 | flow | Contact RFQ form (App.jsx:5258, honeypot 5293) | public | P7 | done | 2026-09-14 | A-04 quantity not enforced server-side (2026-08-13, closed since — re-verify, do not re-report) |
| E041 | flow | Contact Message form (App.jsx:5557, honeypot 5591) | public | P7 | done | 2026-09-14 | A-04 subject not enforced server-side (2026-08-13, closed since — re-verify, do not re-report) |
| E042 | element | Contact inline error region + success panels | public | P6 | done | 2026-09-14 |  |
| E043 | flow | Product → "Request Quote" → `/contact?part=SKU` prefill | public | P7 | done | 2026-09-14 | `contactflow` 85/85 asserts `?part=`/`?industry=` prefill reaches the field and the sales email; `plan10-rfqscroll` 24/24, `plan8-lead` 16/16 |
| E044 | element | `scrollToAnchor` + `#industry-*` hash targets (App.jsx:199) | public | P6 | done | 2026-09-14 |  |
| E045 | element | `TeamCard` + cert icons (App.jsx:3403) | public | P5a | done | 2026-09-14 |  |
| E046 | element | `Badge` (App.jsx:11537), `RelatedArrow` (8550), `PageEyebrow` (309) | public | P5a | done | 2026-09-14 |  |
| E047 | api | `POST /contact.php` (public/contact.php) | api | P3 | done | 2026-09-14 | A-04 required-field parity gap (2026-08-13, closed since — re-verify, do not re-report) |
| E048 | api | `GET /sitemap.xml` → `public/sitemap.php` | api | P6 | done | 2026-09-14 |  |
| E049 | config | `public/.htaccess` rewrite + cache + dotfile rules | public | P3 | done | 2026-09-14 | A-02 no HTTPS redirect / no security headers (2026-08-13, closed since — re-verify, do not re-report) |
| E050 | config | `public/.user.ini` | public | P2 | done | 2026-09-14 |  |
| E051 | config | `public/robots.txt`, `manifest.json`, `favicon.svg`, `logo.svg` | public | P4 | done | 2026-09-14 | A-13 manifest icon missing (2026-08-13, closed since — re-verify, do not re-report) |
| E052 | config | `index.html` shell | public | P4 | done | 2026-09-14 |  |
| E053 | config | `vite.config.js` incl. `serveDataDir` dev middleware | build | P1 | done | 2026-09-14 |  |
| E054 | config | `package.json` / `tailwind.config.js` / `postcss.config.js` | build | P1 | done | 2026-09-14 |  |
| E055 | page | `/admin/index.php` dashboard | admin | P3 | done | 2026-09-14 | A-10 delete dialog text wrong (2026-08-13, closed since — re-verify, do not re-report) |
| E056 | flow | `index.php` POST — close password-reset window | admin | P7 | done | 2026-09-14 |  |
| E057 | page | `/admin/auth.php` — login | admin | P3 | done | 2026-09-14 | A-09 no auth audit-logging (2026-08-13, closed since — re-verify, do not re-report) |
| E058 | flow | `auth.php` — logout | admin | P3 | done | 2026-09-14 | A-09 no auth audit-logging (2026-08-13, closed since — re-verify, do not re-report) |
| E059 | flow | `auth.php` — `ALLOW-PASSWORD-RESET` recovery | admin | P7 | done | 2026-09-14 |  |
| E060 | page | `/admin/add.php` | admin | P3 | done | 2026-09-14 | A-06 SKU validation; A-07 unlabelled controls (2026-08-13, closed since — re-verify, do not re-report) |
| E061 | page | `/admin/edit.php?sku=` | admin | P7 | done | 2026-09-14 | A-06 SKU validation; A-11 double-escape (2026-08-13, closed since — re-verify, do not re-report) |
| E062 | page | `/admin/delete.php?sku=` | admin | P3 | done | 2026-09-14 | A-08 no viewport meta (2026-08-13, closed since — re-verify, do not re-report) |
| E063 | page | `/admin/upload-pdf.php?sku=` (+ `action=remove`) | admin | P3 | done | 2026-09-14 |  |
| E064 | page | `/admin/upload-image.php?sku=` (+ `action=remove`) | admin | P3 | done | 2026-09-14 |  |
| E065 | page | `/admin/settings.php` | admin | P7 | done | 2026-09-14 | A-01 social URL validation gap (2026-08-13, closed since — re-verify, do not re-report) |
| E066 | page | `/admin/content.php` | admin | P7 | done | 2026-09-14 | A-16 no-op save rewrites file (2026-08-13, closed since — re-verify, do not re-report) |
| E067 | page | `/admin/backups.php` | admin | P7 | done | 2026-09-14 |  |
| E068 | page | `/admin/audit-log.php` (`?sku=`, `?action=`) | admin | P5b | done | 2026-09-14 | A-12 unlabelled filters; A-15 vocabulary drift (2026-08-13, closed since — re-verify, do not re-report) |
| E069 | page | `/admin/inquiries.php` | admin | P3 | done | 2026-09-14 |  |
| E070 | page | `/admin/password.php` | admin | P7 | done | 2026-09-14 |  |
| E071 | page | `/admin/help.php` | admin | P5b | done | 2026-09-14 |  |
| E072 | element | `/admin/nav.php` partial | admin | P6 | done | 2026-09-14 |  |
| E073 | api | `/admin/ping.php` keepalive | admin | P3 | done | 2026-09-14 |  |
| E074 | element | `admin/config.php` — session + cookie hardening | admin | P3 | done | 2026-09-14 |  |
| E075 | element | `admin/config.php` — CSRF token/check | admin | P3 | done | 2026-09-14 |  |
| E076 | element | `admin/config.php` — `require_auth()` / `is_authenticated()` | admin | P3 | done | 2026-09-14 |  |
| E077 | element | `admin/config.php` — load/save for the 3 JSON files | admin | P7 | done | 2026-09-14 |  |
| E078 | element | `admin/config.php` — `backup_path` / `backup_list` / `backup_before_write` | admin | P7 | done | 2026-09-14 |  |
| E079 | element | `admin/config.php` — `audit_log()` | admin | P7 | done | 2026-09-14 | A-09 no auth events (2026-08-13, closed since — re-verify, do not re-report) |
| E080 | element | `admin/config.php` — login throttle | admin | P3 | done | 2026-09-14 |  |
| E081 | element | `admin/config.php` — `admin_password_write()` + reset-window helpers | admin | P7 | done | 2026-09-14 |  |
| E082 | element | `admin/config.php` — upload validation helpers + `upload_error_message()` | admin | P3 | done | 2026-09-14 |  |
| E083 | element | `admin/config.php` — `product_reference_resolves()` 3-tier SKU lookup | admin | P7 | done | 2026-09-14 | `skuparity` 33/33 holds PHP vs JS lookup on 32 needles; `plan2-sku` 14/14; `contentlinks` 18/18; `deadlinks` 0 of 18 dead |
| E084 | element | `admin/confirm.js` | admin | P6 | done | 2026-09-14 |  |
| E085 | element | `admin/content-editor.js` | admin | P7 | done | 2026-09-14 | `audit5-medium` 20/20 (`ipc:structural-change` contract); P7 C19 9/9 + C32 8/8 drove the real form through concurrency and an encoding round-trip |
| E086 | element | `admin/spectable-editor.js` | admin | P7 | done | 2026-09-14 | `audit5-medium` 20/20 (its half of `ipc:structural-change`); `plan5-spectable` 13/13 over all 42 product pages |
| E087 | element | `admin/product-preview.js` | admin | P5b | done | 2026-09-14 |  |
| E088 | element | `admin/settings-preview.js` | admin | P5b | done | 2026-09-14 |  |
| E089 | element | `admin/contrast-guard.js` | admin | P9 | done | 2026-09-14 |  |
| E090 | element | `admin/unsaved.js` | admin | P7 | done | 2026-09-14 | `audit5-medium` 20/20 (A-5.20/21/22, guard loaded and honouring the event); P3 step 6: 5 unauthenticated ping.php GETs mint 0 session files |
| E091 | element | `admin/search.js` | admin | P7 | done | 2026-09-14 | no suite referenced it — measured by P7: 42→1 with "1 of 42 match", sections 10→1, no-match empty state, restore on clear, 0 page errors |
| E092 | element | `admin/help.js` | admin | P5b | done | 2026-09-14 |  |
| E093 | config | `admin/.htaccess` | admin | P3 | done | 2026-09-14 |  |
| E094 | config | `data/.htaccess` | admin | P3 | done | 2026-09-14 |  |
| E095 | data | `data/products-all.json` integrity | data | P4 | done | 2026-09-14 | A-17 placehold.co photoUrls (2026-08-13, closed since — re-verify, do not re-report) |
| E096 | data | `data/site-info.json` integrity | data | P4 | done | 2026-09-14 |  |
| E097 | data | `data/content.json` integrity | data | P4 | done | 2026-09-14 |  |
| E098 | element | `src/components/`, `src/pages/`, `src/lib/` (unimported tree) | build | C | done | 2026-09-14 | closed by C 2026-09-14: `ls src/` = App.jsx, index.css, main.jsx only; the three directories are gone (deleted 2026-08-12) |
| E099 | element | `src/main.jsx` + router mount | public | P1 | done | 2026-09-14 |  |
| E100 | element | `pdfs/` + `uploads/` asset referential integrity | data | P4 | done | 2026-09-14 |  |
| E101 | element | `public/images/` referential integrity vs. catalog `photoUrl` | data | P4 | done | 2026-09-14 | A-17 placehold.co photoUrls (2026-08-13, closed since — re-verify, do not re-report) |
| E102 | element | `content.json` `form_complete` / copy-contract parity with `content.php` | admin | P4 | done | 2026-09-14 | P4 read the `content.json` half (clean); the `content.php` half is P5b/A's surface |
| E103 | element | `.gitignore` coverage of runtime state | build | P3 | done | 2026-09-14 |  |
| E104 | element | `admin/logo.svg` / `public/logo.svg` / `favicon.svg` parity | public | P1 | done | 2026-09-14 |  |
| E105 | element | `_harness/*.js` regression suites covering surfaces changed in Run 1 | harness | P11 | done | 2026-09-14 | B-01/B-02 — 2 real failures found and fixed |
| E106 | element | `_harness/sync.sh` staleness after a `public/` edit | harness | P11 | done | 2026-09-14 | B-03 — needs `npm run build` first, silently |
| E107 | config | `.claude/launch.json` | build | P11 | done | 2026-09-14 | `.claude/launch.json` — verify exists |
| E108 | config | `package-lock.json` | build | P1 | done | 2026-09-14 | lockfileVersion 3, 183 packages, ranges match `package.json` — clean |
| E109 | data | `plans/audit10/**` (20 JSON files) | docs | C | done | 2026-09-14 | closed by C 2026-09-14: `ls plans/` = GUARDRAILS, PLAN-10, PLAN-11, README; `plans/audit10/` is gone (deleted 2026-08-12) |
| E110 | doc | `Email to Rick - Admin Dashboard Handoff.md` | docs | P5c | done | 2026-09-14 | every claim checked against the shipped admin; holds. Deliberately carries no password — correct |
| E111 | element | `uploads/images/.gitkeep` | uploads | P1 | done | 2026-09-14 | placeholder for the runtime upload folder — clean |
| E112 | element | `_harness` assertion suites never recorded as run | harness | P11 | done | 2026-09-14 | 5 found; 4 pass first time, 1 is D-02 |

## Added 2026-09-14 for Audit 9 (PLAN-11 §5 step 3) — surfaces that exist today and were in no row

| ID | Type | Path / Locator | Area | Pass | Status | Audited at | Notes |
|---|---|---|---|---|---|---|---|
| E113 | doc | `GO-LIVE.md` — runbook STEP 0 / A / B / C / D / rollback | docs | P8 | done | 2026-09-14 |runbook dry-run; language only → P5c cites · P8 owns the facts; P5c audited its language only |
| E114 | config | `.gitattributes` (`*.sh text eol=lf`, PR #47) | build | P7 | done | 2026-09-14 | Appendix C row C33 |
| E115 | element | `_harness/sync.sh` — `uploads/images/` mkdir and `admin/logo.svg` copy steps (PR #47) | harness | P11 | done | 2026-09-14 | Phase 0 `ls` is the evidence |
| E116 | element | `_harness/lint.php` — `inquiry-type drift` and `href guard drift` checks (13 lines total) | harness | P11 | done | 2026-09-14 | P11 step 3 mutation-test census |
| E117 | element | `admin/csrf-back.js` (10th admin JS file; map says 9) | admin | P3 | done | 2026-09-14 | what it does on Back after a CSRF failure |
| E118 | config | `public/images/og-card.jpg` | public | P6 | done | 2026-09-14 | P6 step 7: exists, 1200×630, < 300 kB |
| E119 | element | `public/images/_unmatched/` (1 file) | data | P4 | done | 2026-09-14 | referential: is it referenced; GUARDRAILS §2 forbids deleting site images |
| E120 | config | `pdfs/.htaccess` | admin | P3 | done | 2026-09-14 | P3 steps 9, 11 (rule text only; `[UNVERIFIED — Apache]`) |
| E121 | config | `uploads/.htaccess` | admin | P3 | done | 2026-09-14 | P3 steps 9, 11; audit7 §3 deny-by-default deliberately not taken |
| E122 | page | the 42 product pages `/products?productId=<sku>` as a class | public | P6 | done | 2026-09-14 | all by script, 5 by hand (P6); crawl JSON |
| E123 | data | `data/content.json` `copy.hero` | verbiage | P5a | done | 2026-09-14 | COPY_DEFAULTS group 1/12 |
| E124 | data | `data/content.json` `copy.homeFeatures` | verbiage | P5a | done | 2026-09-14 | group 2/12 |
| E125 | data | `data/content.json` `copy.homeMarkets` | verbiage | P5a | done | 2026-09-14 | group 3/12 |
| E126 | data | `data/content.json` `copy.servicesHeader` | verbiage | P5a | done | 2026-09-14 | group 4/12 |
| E127 | data | `data/content.json` `copy.industriesHeader` | verbiage | P5a | done | 2026-09-14 | group 5/12 |
| E128 | data | `data/content.json` `copy.aboutHeader` | verbiage | P5a | done | 2026-09-14 | group 6/12 |
| E129 | data | `data/content.json` `copy.faqHeader` | verbiage | P5a | done | 2026-09-14 | group 7/12 |
| E130 | data | `data/content.json` `copy.contactHeader` | verbiage | P5a | done | 2026-09-14 | group 8/12 |
| E131 | data | `data/content.json` `copy.privacyHeader` | verbiage | P5a | done | 2026-09-14 | group 9/12 |
| E132 | data | `data/content.json` `copy.nav` | verbiage | P5a | done | 2026-09-14 | group 10/12 |
| E133 | data | `data/content.json` `copy.footer` | verbiage | P5a | done | 2026-09-14 | group 11/12 |
| E134 | data | `data/content.json` `copy.contactForm` | verbiage | P5a | done | 2026-09-14 | group 12/12 |
| E135 | data | `data/content.json` `features[6]` | verbiage | P5a | done | 2026-09-14 | section array 1/16 |
| E136 | data | `data/content.json` `stats[4]` | verbiage | P5a | done | 2026-09-14 | 2/16 — P4 truth for the numbers |
| E137 | data | `data/content.json` `markets[5]` | verbiage | P5a | done | 2026-09-14 | 3/16 |
| E138 | data | `data/content.json` `industryDetail[5]` (incl. `products` SKU lines) | verbiage | P5a | done | 2026-09-14 | 4/16 — `deadlinks` cited |
| E139 | data | `data/content.json` `services[6]` | verbiage | P5a | done | 2026-09-14 | 5/16 |
| E140 | data | `data/content.json` `milestones[6]` | verbiage | P5a | done | 2026-09-14 | 6/16 — A-8.9 withdrawn half: "50 Years" is history, correct |
| E141 | data | `data/content.json` `faq[19]` | verbiage | P5a | done | 2026-09-14 | 7/16 — rule 10 for shipping/returns/lead-time answers |
| E142 | data | `data/content.json` `capabilities[4]` | verbiage | P5a | done | 2026-09-14 | 8/16 |
| E143 | data | `data/content.json` `certs[6]` | verbiage | P5a | done | 2026-09-14 | 9/16 — certification claims are P4 step 3 / `decision` |
| E144 | data | `data/content.json` `companyNav[4]` | verbiage | P5a | done | 2026-09-14 | 10/16 — `page` fields must resolve (P4 step 5) |
| E145 | data | `data/content.json` `footerLinks[8]` | verbiage | P5a | done | 2026-09-14 | 11/16 — `page` fields must resolve (P4 step 5) |
| E146 | data | `data/content.json` `heroProofPoints[4]` | verbiage | P5a | done | 2026-09-14 | 12/16 |
| E147 | data | `data/content.json` `heroTrust[10]` | verbiage | P5a | done | 2026-09-14 | 13/16 — carries an ISO claim (A-8.5) |
| E148 | data | `data/content.json` `privacySections[7]` | verbiage | P5a | done | 2026-09-14 | 14/16 — rule 10; A-8.7/A-8.8 text present (P4 step 5); wording changes escalated |
| E149 | data | `data/content.json` `seo[9]` | meta | P4 | done | 2026-09-14 | 15/16 — exactly the 9 routes (P4 step 5); P6 step 7 cites |
| E150 | data | `data/content.json` `contactTips[5]` | verbiage | P5a | done | 2026-09-14 | 16/16 |
| E151 | data | `data/site-info.json` — all leaves as verbiage (company, contact, address, hours, certifications, stats, social, about, theme, catalogPdfUrl) | verbiage | P5a | done | 2026-09-14 | truth → P4 register |
| E152 | element | every admin flash / error / notice / `data-confirm` string in `admin/*.php` | verbiage | P5b | done | 2026-09-14 | from `audit9-strings.json` surface `admin` |
| E153 | element | `public/contact.php` — sales notification email (subject + body) | email | P5b | done | 2026-09-14 | rendered with sample data by I-strings |
| E154 | element | `public/contact.php` — auto-reply email (subject + body) | email | P5b | done | 2026-09-14 | rendered with sample data by I-strings |
| E155 | doc | `README.md` (deploy tables, refetch paragraph A-8.1) | docs | P8 | done | 2026-09-14 | numeric/factual truth |
| E156 | doc | `admin/README.md` | docs | P5c | done | 2026-09-14 | instructional accuracy (P8 numbers only) |
| E157 | doc | `Editing-Your-Site-Content.md` | docs | P5c | done | 2026-09-14 | instructional accuracy; nine menu items vs `nav.php` |
| E158 | doc | `PATCH_NOTES.md` | docs | P8 | done | 2026-09-14 |facts (P5c language) · P8 owns the facts; P5c audited its language only |
| E159 | doc | `DEPLOY_READINESS_v2.md` §7 (frozen; stale by the `sitemap.xml` row) | docs | P8 | done | 2026-09-14 | read-only; never edited |
| E160 | doc | `CLAUDE.md` (invariants, numbers, `file:line` census) | docs | P8 | done | 2026-09-14 | P8 step 6 |
| E161 | doc | `_harness/README.md` (suite tables, "96 fields", expected reds) | docs | P8 | done | 2026-09-14 | P8 step 6 + P11 step 6 |
| E162 | doc | `plans/GUARDRAILS.md` §4.1 baseline table | docs | P8 | done | 2026-09-14 | suite count vs §4.3 union |
| E163 | element | `_harness/audit9-crawl.js` (I-crawl instrument) | harness | P11 | done | 2026-09-14 | exists, runs, deterministic — P11 step 8 |
| E164 | element | `_harness/audit9-adminflows.js` (I-admin instrument) | harness | P11 | done | 2026-09-14 | P11 step 8 |
| E165 | element | `_harness/audit9-strings.js` (I-strings instrument) | harness | P11 | done | 2026-09-14 | P11 step 8 |
| E166 | element | PHP runtime compatibility of `admin/*.php`, `public/contact.php`, `public/sitemap.php` (7.4 floor + 8.x cleanliness) | admin | P2 | done | 2026-09-14 | P2 steps 2–3 |
| E167 | element | production PHP version (`admin/help.php` prints `PHP_VERSION`; launch instruction says `[UNSOURCED]`) | server | P2 | done | 2026-09-14 | P2 step 1 |
| E168 | element | PHP extensions the code needs (`finfo`, `gd`, `json`, `session`, `openssl`, `mbstring`?) vs the health banner | admin | P2 | done | 2026-09-14 | P2 step 4 |
| E169 | element | `mail()` `From:` mailbox + the `mail()===false` phone-number path | api | P2 | done | 2026-09-14 | P2 step 6 |
| E170 | element | the live host — STEP 0 (`_harness/out/audit9/step0.md`) | server | C | done | 2026-09-14 | closed by C 2026-09-14 — `_harness/out/audit9/step0.md` |
| E171 | element | `public/images/site/` — the five photo-slot default files | data | P4 | done | 2026-09-14 | exist, referenced by `COPY_DEFAULTS`; GUARDRAILS §2 forbids deletions |
| E172 | element | dependency advisories (`npm audit`) vs audit7 A-7.10 reachability arguments | build | P1 | done | 2026-09-14 | P1 step 6 |
| E173 | element | second build reproducibility (`dist/` vs `_harness/out/audit9/P1/dist2/`) | build | P1 | done | 2026-09-14 | P1 step 2 |
| E174 | element | time boundaries — copyright range at the year boundary, `effectiveDate` | public | P7 | done | 2026-09-14 | Appendix C row C31 |
| E175 | element | encoding round-trip through each admin form and the contact form | admin | P7 | done | 2026-09-14 | Appendix C rows C13, C32 |
| E176 | element | `@media print` count (A-7.7, open, deferred) | public | P6 | done | 2026-09-14 | P6 step 9: record, do not fix |
| E177 | element | the four `.htaccess` deny rules vs every filename the admin can create | admin | P3 | done | 2026-09-14 | P3 step 11 |
| E178 | element | secrets / runtime files tracked? (`git grep` bcrypt, `git check-ignore`) | build | P3 | done | 2026-09-14 | P3 step 10 |
| E179 | element | `IPCADMIN` session cookie flags from `auth.php`; `ping.php` mints no session | admin | P3 | done | 2026-09-14 | P3 step 6 |
| E180 | element | the `:8140` E_ALL error log (A: P3 + P7 flows, then `plan10-admincrawl`-shaped crawl) | admin | P2 | done | 2026-09-14 | P2 step 3 |
| E181 | element | the two contact-form success panels and every empty/error state (dead-end inventory) | public | P6 | done | 2026-09-14 | P6 step 5 |
| E182 | element | navigation graph: every `KNOWN_ROUTES` route ≤ 2 clicks from `/`; sitemap `<loc>` set | public | P6 | done | 2026-09-14 | P6 step 4 |
| E183 | element | keyboard / reflow 200 % @1440, 400 % @1280 / root 24px / axe | public | P9 | done | 2026-09-14 | P9 steps 2–6 |
| E184 | element | console-clean crawl: 0 errors / 0 failed requests / 0 ≥ 400 over 10 routes + 42 products | public | P10 | done | 2026-09-14 | from I-crawl (single owner) |
| E185 | element | transfer bytes of `/` at 390 and 1440; hero not requested at 390; cache rule text | public | P10 | done | 2026-09-14 | P10 steps 3–4 |
| E186 | element | catalog at 500 products — changed since `1826a6d`? | public | P10 | done | 2026-09-14 | P10 step 5 |

## Suite census (PLAN-11 §4.3 / §5 step 5) — the sweep union, one row each, `Pass = P11`, `pending` until a result is recorded this round

Derived 2026-09-14 on `2121597`: assertive set (Appendix A grep) = **58**; `_harness/README.md` five tables = **67** names (65 literal + `contactflow-selftest` and `plan2-formlast-selftest` named as `/ -selftest.js`); union of those two = **75**, runnable = **72** (minus `backdrop` — a module, `lint` — PHP, run separately, `plan10-shot` — a shooter). **Self-correction (C, Phase 0):** the binding `GUARDRAILS.md` §4.1 baseline table names **8 more** suites that exist and are in neither set (`plan7-slots`, `plan8-contrast`, `plan8-crumbs`, `plan9-band`, `plan9-firstsave`, `plan9-meta`, `plan9-notfound`, `plan9-slots-slash` — they score with a `pass` counter and `process.exit(pass===…)`, so the Appendix A `ok(|check(|assert` classifier misses them, and the README tables never listed them; §4.4 itself expects `plan8-contrast` red). The sweep denominator is therefore the **three-way union: 80 runnable suites** (`_harness/out/audit9/sweep-list-final.txt`), run as 72 + 8. Conversely 16 runnable suites in the union are absent from the GUARDRAILS table (`adminwidth audit5-* audit6 audit7 audit7-lead contactflow contactflow-selftest contentlinks fgpatch imgcheck isoclaims nodupbackups plan10-admincrawl plan2-formlast-selftest`) → the §8.3 refresh. Files: `_harness/out/audit9/{assertive,readme-tables-full,guardrails-table,union-raw,sweep-list,sweep-extra,sweep-list-final}.txt`.

| ID | Suite | In assertive set | In README tables | Status | Score (denominator) | Notes |
|---|---|---|---|---|---|---|
| S001 | `adminwidth` | yes | yes | done 2026-09-14 | 39/39 |  |
| S002 | `audit5-blockers` | yes | yes | done 2026-09-14 | 18/18 |  |
| S003 | `audit5-high` | yes | yes | done 2026-09-14 | 30/30 |  |
| S004 | `audit5-medium` | yes | yes | done 2026-09-14 | 20/20 |  |
| S005 | `audit6` | yes | yes | done 2026-09-14 | 45/45 |  |
| S006 | `audit7` | yes | yes | done 2026-09-14 | 30/30 |  |
| S007 | `audit7-lead` | yes | yes | done 2026-09-14 | 23/23 |  |
| S008 | `backdrop` | no | yes | n/a — not runnable |  | measurement module (`module.exports`), not a suite; `backdrop-selftest` is the runnable |
| S009 | `backdrop-selftest` | yes | no | done 2026-09-14 | 9/9 | P11 step 1: assertive but in no README table → README row needed |
| S010 | `brandtext` | no | yes | done 2026-09-14 | **FAIL** 36/47 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S011 | `contactflow` | yes | yes | done 2026-09-14 | 85/85 |  |
| S012 | `contactflow-selftest` | yes | yes | done 2026-09-14 | 26/26 |  |
| S013 | `contentlinks` | yes | yes | done 2026-09-14 | 18/18 |  |
| S014 | `contrastparity` | no | yes | done 2026-09-14 | 28/28 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S015 | `copydrift` | no | yes | done 2026-09-14 | 110 matched, 0 JS-only (PASS — also wired into `lint.php`) | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S016 | `copydrift-selftest` | yes | yes | done 2026-09-14 | 5/5 |  |
| S017 | `copyroundtrip` | no | yes | done 2026-09-14 | 15/15 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S018 | `deadlinks` | no | yes | done 2026-09-14 | 0 of 18 resolve to nothing | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S019 | `fgpatch` | yes | no | done 2026-09-14 | **FAIL** CRASHED — expected 10 accent-2 text site | P11 step 1: assertive but in no README table → README row needed |
| S020 | `imgcheck` | no | yes | done 2026-09-14 | 0 broken of 79 paths (PASS; 5 external skipped — the placehold.co photoUrls) | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S021 | `invariants` | yes | yes | done 2026-09-14 | 17/17 |  |
| S022 | `invariants-selftest` | yes | yes | done 2026-09-14 | 15/15 |  |
| S023 | `isoclaims` | yes | yes | done 2026-09-14 | **FAIL** 2/4 |  |
| S024 | `lint` | no | yes | n/a — not runnable |  | `lint.php` — run in Phase 0 (green); not a `run.js` suite |
| S025 | `nodupbackups` | yes | yes | done 2026-09-14 | 10/10 |  |
| S026 | `plan10-admincrawl` | yes | yes | done 2026-09-14 | 43 shots, 0 PHP notices / console errors (PASS; exit 0 — reports states, prints no n/n score) |  |
| S027 | `plan10-adminnav` | yes | yes | done 2026-09-14 | 25/25 |  |
| S028 | `plan10-adminrows` | yes | yes | done 2026-09-14 | 15/15 |  |
| S029 | `plan10-auditlog` | yes | yes | done 2026-09-14 | 13/13 |  |
| S030 | `plan10-dashboard` | yes | yes | done 2026-09-14 | 25/25 |  |
| S031 | `plan10-header` | yes | yes | done 2026-09-14 | 8/8 |  |
| S032 | `plan10-help` | yes | yes | done 2026-09-14 | 29/29 |  |
| S033 | `plan10-helpwidth` | yes | yes | done 2026-09-14 | 21/21 |  |
| S034 | `plan10-repalette` | yes | yes | done 2026-09-14 | 33/33 |  |
| S035 | `plan10-rfqscroll` | yes | yes | done 2026-09-14 | 24/24 |  |
| S036 | `plan10-shot` | no | yes | n/a — not runnable |  | shooter, not a suite (README says so) |
| S037 | `plan2-contrast` | no | yes | done 2026-09-14 | 42/42 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S038 | `plan2-delete` | no | yes | done 2026-09-14 | 18/18 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S039 | `plan2-formlast` | yes | yes | done 2026-09-14 | 8/8 |  |
| S040 | `plan2-formlast-selftest` | no | yes | done 2026-09-14 | 8/8 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S041 | `plan2-sku` | yes | yes | done 2026-09-14 | 14/14 |  |
| S042 | `plan2-trunc` | yes | yes | done 2026-09-14 | 13/13 |  |
| S043 | `plan3-autoreply` | yes | yes | done 2026-09-14 | 22/22 |  |
| S044 | `plan3-contact` | yes | yes | done 2026-09-14 | 51/51 |  |
| S045 | `plan4-admin` | yes | yes | done 2026-09-14 | 19/19 |  |
| S046 | `plan4-public` | yes | yes | done 2026-09-14 | 27/27 |  |
| S047 | `plan5-images` | yes | yes | done 2026-09-14 | 12/12 |  |
| S048 | `plan5-keys` | yes | yes | done 2026-09-14 | 11/11 |  |
| S049 | `plan5-listeners` | no | yes | done 2026-09-14 | 11/11 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S050 | `plan5-social` | yes | yes | done 2026-09-14 | 35/35 |  |
| S051 | `plan5-spectable` | no | yes | done 2026-09-14 | 13/13 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S052 | `plan5-throttle` | no | yes | done 2026-09-14 | 12/12 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S053 | `plan5b-pwthrottle` | yes | yes | done 2026-09-14 | 10/10 |  |
| S054 | `plan5b-sidebar` | yes | yes | done 2026-09-14 | 9/9 |  |
| S055 | `plan5b-sitemap` | no | yes | done 2026-09-14 | 9/9 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S056 | `plan5c-brandink` | yes | yes | done 2026-09-14 | 6/6 |  |
| S057 | `plan5c-eyebrow` | yes | yes | done 2026-09-14 | 5/5 |  |
| S058 | `plan5c-sitemap` | yes | yes | done 2026-09-14 | 17/17 |  |
| S059 | `plan6-families` | yes | yes | done 2026-09-14 | 13/13 |  |
| S060 | `plan7-approvals` | yes | no | done 2026-09-14 | 11/11 | P11 step 1: assertive but in no README table → README row needed |
| S061 | `plan7-datasheets` | yes | no | done 2026-09-14 | 8/8 | P11 step 1: assertive but in no README table → README row needed |
| S062 | `plan7-imagery` | yes | no | done 2026-09-14 | 11/11 | P11 step 1: assertive but in no README table → README row needed |
| S063 | `plan8-catalog` | yes | yes | done 2026-09-14 | 16/16 |  |
| S064 | `plan8-certs` | yes | yes | done 2026-09-14 | 5/5 |  |
| S065 | `plan8-chrome` | yes | yes | done 2026-09-14 | 16/16 |  |
| S066 | `plan8-faq` | yes | no | done 2026-09-14 | 19/19 | P11 step 1: assertive but in no README table → README row needed |
| S067 | `plan8-formpolish` | yes | no | done 2026-09-14 | 15/15 | P11 step 1: assertive but in no README table → README row needed |
| S068 | `plan8-keyboard` | yes | yes | done 2026-09-14 | 8/8 |  |
| S069 | `plan8-landing` | yes | no | done 2026-09-14 | 18/18 | P11 step 1: assertive but in no README table → README row needed |
| S070 | `plan8-lead` | yes | yes | done 2026-09-14 | 16/16 |  |
| S071 | `plan8-meta` | yes | yes | done 2026-09-14 | 15/15 |  |
| S072 | `plan8-mobile` | yes | yes | done 2026-09-14 | 16/16 |  |
| S073 | `plan8-motion` | yes | yes | done 2026-09-14 | 8/8 |  |
| S074 | `plan8-polish` | yes | yes | done 2026-09-14 | **FAIL** 16/17 |  |
| S075 | `skuparity` | no | yes | done 2026-09-14 | 33/33 | P11 step 1: in a README table but outside the classifier (bails / no ok()) → verify it runs |
| S076 | `plan7-slots` | no | no | done 2026-09-14 | 16/16 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
| S077 | `plan8-contrast` | no | no | done 2026-09-14 | 34/35 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
| S078 | `plan8-crumbs` | no | no | done 2026-09-14 | 22/22 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
| S079 | `plan9-band` | no | no | done 2026-09-14 | 4/4 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
| S080 | `plan9-firstsave` | no | no | done 2026-09-14 | 8/8 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
| S081 | `plan9-meta` | no | no | done 2026-09-14 | 18/18 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
| S082 | `plan9-notfound` | no | no | done 2026-09-14 | 8/8 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
| S083 | `plan9-slots-slash` | no | no | done 2026-09-14 | 9/9 | P11 step 1: in GUARDRAILS §4.1 only — outside the classifier (scores via a `pass` counter) and in no README table → README row needed; classifier note for Appendix A |
