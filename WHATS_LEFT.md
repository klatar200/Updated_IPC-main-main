# What's Left

Replaces `AUDIT.md` and `IMPLEMENTATION_PLAN.md` (both retired 2026-08-04 —
their bug inventories were either shipped or superseded by
`DEPLOY_READINESS_v2.md`, and the plan's Phase-4 completion criterion was
unmeetable and misleading).

**Snapshot as of 2026-08-05.** This is the only file describing current state.
`DEPLOY_READINESS_v2.md` is the audit this release was built against and is
frozen — do not edit it; record outcomes here instead.
`AUDIT_v3_FINDINGS.md` is session 2's adversarial audit of session 1's work and
is likewise a record, not a live document — session 3's outcomes are recorded
here.

**This file is append-only for decisions and evidence.** A line that turns out
to be wrong is marked `SUPERSEDED-BY` with a date and the correction; it is not
silently rewritten. Ten §4 lines were superseded on 2026-08-05 — see §4.

---

## 1. Shipped in this release

Every T1, T2 and T3 item from `DEPLOY_READINESS_v2.md` §9, plus the §4 items
listed below, plus the session-3 fixes in §1b. Verification evidence — command
output and browser measurements — is in §4 and §4b of this file.

> **SUPERSEDED-BY 2026-08-05:** the header sentence above previously read
> "Every T1, T2 and T3 item…" while **T3.1 and T3.4 appeared in no section of
> this file** (AUDIT_v3 §3.9). Both were in fact done; they are now listed in
> the table below, so the sentence is true as written.

| Audit ID | What changed |
|---|---|
| T1.1 | Fresh cost-12 hash in `admin/config.local.php`; `ipc-admin-2025` purged from every doc; handoff email no longer prints a password |
| T1.2 | `preg_replace_callback` in the shared `admin_password_write()`; `opcache_invalidate()` after the write |
| T1.3 | No shipped default password at all — unsatisfiable sentinel + FTP-unlocked `ALLOW-PASSWORD-RESET` recovery screen |
| T1.4 | `mergeContent` treats `[]` as a deletion, not as "unset" |
| T1.5 | Advanced-mode edits sync `groups`/`rows`; save blocked on unparseable JSON; `add.php` validates spec-table JSON and repopulates on error; Advanced/Back are real `<button>`s. **SUPERSEDED-BY 2026-08-05:** the "ported from `edit.php`" framing was **inverted** — `add.php` is the correct implementation and `edit.php` was the one that discarded typed JSON and re-rendered the value from disk under the message "Fix the syntax". `edit.php` fixed in session 3 (NB5). (AUDIT_v3 §3.7) |
| T1.6 | Backups keep 30 (was 5), same-second collision suffix, correct ordering, item counts on the restore page |
| T1.7 | Optimistic-concurrency signatures on `settings.php` and `content.php`; absent POST keys keep the stored value; `mergeSiteInfo` drops blanks. **SUPERSEDED-BY 2026-08-05:** "an EMPTY key is still an intentional clear" was true at *file* level and false *end-to-end* — `mergeSiteInfo` dropped the blank and the hardcoded default rendered, so **no scalar in `site-info.json` could ever be cleared**. Measured by blanking every string in the file: the site rendered byte-identical to pristine. Fixed in session 3 with a narrow allow-list (`contact.fax`, the five `social.*`, `company.shortName`, `company.slogan`); the blank-drop is **kept** for everything else, because `href="tel:"` and `© –2026` are worse than a stale value. Invariant 4 stands. (AUDIT_v3 §3.5 / NB4) |
| T1.8 | Styled session-expired page with a route back to unsaved work; `require_auth()` renders instead of redirecting on POST; `beforeunload` guard + `ping.php` keepalive; 8-hour session lifetime |
| T2.1 | Providers/Navbar/Footer above the catalog gate; 12 s fetch timeout; null-guarded parse |
| T2.2 | `<ErrorBoundary key={page}>` |
| T2.3 | `{replace:true}` on the `?family=` cleanup |
| T2.4 | `onClick`/`onKeyDown`/`aria-haspopup`/`aria-expanded` on both mega-menu triggers |
| T2.5 | `contact.php`'s `s()` no longer strips tags or HTML-escapes; `hdr()` for header-bound values |
| T2.6 | Absent `Referer` accepted; present one compared by parsed host; friendly error carrying the phone number |
| T2.7 | `CC.photoUrl` corrected; `onError` fallback to the branded placeholder |
| T2.8 | `content.json` SKU normalised; anchored segment matcher; real "part not found" banner |
| T2.9 | Sticky RFQ bar wraps; page padding moved to `<body>` so it stops covering the footer |
| T2.10 | `.ipc-skeleton` / `.ipc-page-header` / `.sr-only` moved into `src/index.css` |
| T3.1 | Build artefacts that duplicated live data removed from the tree — `dist/data/`, `dist/products-all.json`, `public/products-all.json` are all gone, so there is no SKU-drift surface left. *(Added 2026-08-05: done in this release but recorded in no section — AUDIT_v3 §3.9.)* |
| T3.4 | Runtime state files kept out of the repo — `admin/admin-log.jsonl`, `admin/inquiries.jsonl`, `admin/.login-throttle.json` are absent from the tree and gitignored. *(Added 2026-08-05, same reason as T3.1.)* |
| T3.2 | `uploads/` in the deploy manifest; runtime `mkdir` checked and writes the protective `.htaccess` |
| T3.3 | `admin_writable()` / `data_writable()` health banner on the dashboard and in Help |
| T3.5 | `public/.user.ini`; per-code upload error messages; dedicated "too large" page for `post_max_size` overruns |
| T3.6 | `pdf_in_use()` check on the upload path — refuses to overwrite another product's data sheet |
| T3.7 | `form_complete` sentinel detects `max_input_vars` truncation and refuses the save |
| 4.2 | Product JSON-LD `description` joined to a string |
| 4.4 | All contact-form controls have `htmlFor`/`id` pairs |
| 4.6 | "Request Quote" carries the SKU to the contact form |
| 4.7 | About-page `tel:` hrefs read from site-info |
| 4.8 | Fax is no longer a `tel:` link anywhere |
| 4.9 | Navbar/footer brand block reads company name, slogan, founded year and certifications from site-info |
| 4.10 | Privacy page no longer reports today's date every day. **AMENDED 2026-08-05:** the fix reproduces, but there is no "Last Updated" string on the page at all — the rendered text is `Effective Date: January 1, 2025`. The original wording described a label that does not exist. (AUDIT_v3 §3.10) |
| 4.11 | `services[].leadTime` drives the Services banner; `certifications.other[]` is read at `App.jsx:8271`. **SUPERSEDED-BY 2026-08-05:** v2 4.11 names *four* dead fields, not one. Two were fixed (`leadTime`, `certifications.other[]`); `catalogPdfUrl` was defined and read nowhere, and the promised footer social icons were still `sameAs`-only. `catalogPdfUrl` is now wired to a "Full product catalog (PDF)" footer link (session 3, NB18). **Footer social icons remain undone and are now tracked in §2 as 4.11b.** (AUDIT_v3 D18) |
| 4.15 | Auto-reply rate-limited per recipient address, not only per IP. **SUPERSEDED-BY 2026-08-05:** the key is `md5(strtolower($replyTo))`, which collapses case correctly but **not plus- or dot-addressing**. Seven variants × four submits delivered **15 auto-replies to one Gmail-style mailbox**; the effective cap reverts to the per-IP 5-per-10-min. Still open — see §2 4.15b. (AUDIT_v3 §3.3) |
| 4.16 | `company_name` CRLF-stripped before the `From:` header |
| 4.17 | `is_string()` guard on `form_type` — no unauthenticated 500 |
| 4.18 | Honeypot rejections are logged instead of vanishing |
| 4.22 | Admin CSP allows `placehold.co` previews |
| 4.25 | 60 s TTL on the products cache. **SUPERSEDED-BY 2026-08-05:** declaring `PRODUCTS_CACHE_TTL_MS` did not fix anything — it was **inert**. It is only read inside `fetchProductsCached()` and `useProducts()`'s initial guard; `useProducts()` has one call site, mounts once, and its effect deps are `[]`, so nothing re-evaluated it during a session, and a full reload resets the module cache anyway. Measured: catalog edited on disk, 100 s of SPA navigation, still the stale 41 products. The ~60 s bound came entirely from the per-minute cache-buster and `data/.htaccess`. **Now genuinely fixed** by a `visibilitychange`/`focus` effect in `useProducts()` that re-checks the TTL when the tab is fronted — proved in §4b. (AUDIT_v3 §3.1 / NB3) |
| 4.28 | `svc.details` null-guarded |
| 4.33 | `delete.php` cleans up the uploaded photo. **AMENDED 2026-08-05:** the *code* half shipped and is correct (shared photo kept, unique photo removed, both audit-logged). The *text* half did not — the confirmation at `delete.php:105-107` still mentioned only the PDF and still claimed "cannot be undone" when `save_products()` writes a backup first. Confirmation text rewritten in session 3 (D13). (AUDIT_v3 §3.6) |
| 4.34 | Audit-log filter lists the actions that actually exist |

---

## 1b. Shipped in session 3 (2026-08-05)

Fixing `AUDIT_v3_FINDINGS.md`. Evidence in §4b.

| ID | File | What changed |
|---|---|---|
| **B1** | `admin/content.php` | Every error path repopulated the form from **disk**, destroying what was typed, then handed back a refreshed valid `orig_sig` so the retry committed the disk values under a green "✅ Content saved". Now repopulates from `$out`; the truncation path merges section-wise over the stored copy so a cut-off POST cannot blank the back half of the page. Stale-signature message reworded — it used to tell the owner to "reload", which would now throw away the very work the warning protects. |
| **B2** | `admin/config.php`, `auth.php`, `index.php`, `.htaccess` | `ALLOW-PASSWORD-RESET` now expires 1 h after the file's mtime (`PASSWORD_RESET_WINDOW`); an open **or** stale window raises a dashboard health-banner entry with a one-click **Close it now** control (CSRF-guarded POST on `index.php`); the login screen explains a closed window instead of showing an unsatisfiable password box; the flag is added to `admin/.htaccess`'s `FilesMatch` (NB14) so it is no longer a 1-byte "is the window open" probe. |
| **B3** | `public/contact.php`, `admin/inquiries.php` | Rate limiter moved **above** the referer and honeypot checks, so every rejected request consumes a slot (honeypot POSTs were completely unlimited). `message`/`additionalNotes`/`specialReqs` capped at 5,000 chars and short fields at 200, with truncation announced in the value. `inquiries.jsonl` rotates at 16 MB. `inquiries.php` reads the **tail** (2 MB) instead of `file()`-ing the whole log, and counts totals by streaming. |
| NB1 | `public/.htaccess` | `immutable, max-age=31536000` scoped to `/assets/` via `SetEnvIf`; owner-uploaded images and the logo now get `max-age=3600` so a replacement actually reaches returning visitors. |
| NB2 | `public/.user.ini` | `display_errors = Off`, `log_errors = On`. Stronger than recorded: with display_errors on, **any** `max_input_vars` truncation printed a startup warning before `session_start()`, so the session never started, T3.7's guard never ran, and the absolute server path leaked four times in 3,010 bytes. |
| NB4 | `src/App.jsx` | `SITE_CLEARABLE` allow-list on `mergeSiteInfo`; `COPY_CLEARABLE` on `mergeContent`. Six render sites guarded so a cleared fax removes its row/clause rather than leaving a dangling label; JSON-LD omits empty `faxNumber`/`alternateName`/`slogan`/`sameAs`; `localizeProse` substitutes a cleared fax out of prose. Blank-drop kept everywhere else. |
| NB5 | `admin/edit.php` | Spec-table textareas and the section heading repopulate from `$_POST` on any validation error. |
| NB6/NB7 | `public/contact.php` | `s()` no longer carries `/u` (returned `null` on non-UTF-8 → 500) and returns `?: ''`; `email` goes through the same `is_string()` guard as `form_type`. |
| NB8 | `public/contact.php` | A 403 (cross-site referer) and a 429 (rate limited) now log the lead **before** returning, capped at 10 logged rejections per IP per window so the fix cannot become the flood. |
| NB9 | `public/contact.php` | Only `http`/`https` referrers are compared by host. `android-app://com.google.android.gm` (Gmail for Android) was being 403'd as an attack. |
| NB10 | `admin/inquiries.php` | Honeypot / rate-limited / blocked entries render distinctly, show their `note`, are excluded from the `$failed` counter and get their own "Blocked as spam" stat. |
| NB11 | `admin/add.php` | `specTable1_title` repopulates instead of resetting to the hardcoded `"Specifications:"`. |
| NB12 | `admin/config.php` + `add/edit/content` | Shared `post_str()` / `as_str()` guards. `content.php` saved the literal string `"Array"` under a success banner; `add.php`/`edit.php` fatalled on PHP 8 and would have silently stored a blank field on the target's 7.4. |
| NB13 | `admin/config.php`, `backups.php` | Backup sequence counts past 99 instead of switching to a random hex suffix that destroyed ordering and let pruning delete newer backups. Both regexes widened to `\d{2,4}` and kept in sync. |
| NB15 | `public/.htaccess` | Dotfile block added — `public_html/.user.ini` was web-readable. |
| NB16 | `admin/auth.php` | A reset POST arriving after the window closed says so, instead of answering a *reset* form with "Incorrect password." on a Sign In box. |
| NB17 | `admin/backups.php` | A hand-placed non-matching filename is listed without a Restore button that could only ever error; same-second backups are distinguished by sequence in both the listing and the confirmation. |
| NB18 | `src/App.jsx`, `admin/*` | 375 px overflow on `IP35KY` and `IP55FL` fixed at the root (`items-start` on a **column** flex container sizes children to max-content; now `items-stretch lg:items-start`) — 42/42 product pages clean. Products mega-menu no longer says "Loading…" forever after a failed catalog fetch. `catalogPdfUrl` wired to a footer link. Double-escaping removed in `add.php` and `upload-pdf.php`. `upload-pdf.php`'s "replace" hint now names the other product when the filename belongs to one. "a image" → "an image". |
| 4.25 | `src/App.jsx` | The products-cache TTL was inert; now genuinely re-evaluated on tab focus. See the superseded §4 line. |
| **T3.9** | `admin/content.php` | Found on the 2026-08-05 re-verification pass, after B1 was already reported fixed. The truncation merge restored only sections that arrived **empty**, so the one section straddling PHP's cut — `features`, holding 1 of its 6 rows — was left short on the re-rendered error page. Now compares row counts. Display-only; disk was never written. Evidence in §4c. |
| **4.24** | `vite.config.js`, `src/App.jsx` | Shipped 2026-08-05 (Plan 0). A dev-only Vite middleware serves the repo's `data/` folder at `/data/*`, so `npm run dev` now exercises the real files and the real code paths — `mergeSiteInfo` and `mergeContent`, which hold invariants 3 and 4, had **never** run locally. The `import.meta.env.DEV` branch is gone; all three URLs are `/data/…` in both modes. Also fixes a regression introduced by `6284708`: deleting `public/products-all.json` (correctly, as one of three duplicate catalogs) orphaned that DEV branch, and Vite's SPA fallback answered the missing path with `index.html` and a **200**, so `res.ok` passed and `/products` rendered "Catalog Unavailable". New `jsonOrThrow()` asserts `Content-Type` on all three fetches so a wrong-content 200 takes the error path instead of throwing deep in a `.then()`. Evidence in §4d. |
| **4.3** | `src/App.jsx` (`PageMeta`) | Shipped 2026-08-05 (Plan 1). `index.html` is the single shell for all nine routes and shipped **one** `og:url` hardcoded to the site root and **no** canonical at all, so every page announced itself as the homepage. `PageMeta` now upserts a per-route `<link rel="canonical">` and matching `og:url`, built from a new single-source `SITE_ORIGIN` constant (not `window.location.origin` — dev, the mirror and production would each self-canonicalise). `?productId=` is canonical to itself; `?family=` and other view params are canonical to the bare route. Evidence in §4e. |
| **4.1** | `src/App.jsx` (`FaqPage`) | Shipped 2026-08-05 (Plan 1). The FAQ JSON-LD effect had `[]` deps; `ContentProvider` renders children immediately from `contentDefaults` and swaps content in later, so the effect ran once against the **defaults** and never re-ran — every FAQ Rick wrote was absent from the rich-result markup. Now depends on a `useMemo`-stabilised `categories` (raw `groupFaq()` returns a new array each render and would thrash the `<script>`), and removes any existing `#faq-ld` before appending so a re-run cannot leave duplicates. Evidence in §4e. |
| **`seo: []`** | `src/App.jsx` (`PageMeta`) | Shipped 2026-08-05 (Plan 1) — supersedes the `AMENDED` note in §4 (T1.4), which recorded this as benign and left as-is. Two faults, not one: `\|\| document.title` meant emptying the section kept the defaults rather than honouring the deletion; and `\|\| home.title` gave every page **without** its own `seo` row the homepage's title — `terms` and `quality` have no row, so three routes shipped the same `<title>`. Both now fall back to the page's own visible heading plus the company name. Measured: 9 of 9 titles distinct, against **7 of 9** with the old logic re-installed. |
| **4.21** | `src/App.jsx` (new `PageLink`) | Shipped 2026-08-05 (Plan 1). Navigation was `<button onClick>` throughout — **63 `<button>` against 15 `<a href>`** — so a crawler found no internal link to follow and every route but the homepage was an orphan URL reachable only from the sitemap; Ctrl/Cmd-click, middle-click and "Copy Link Address" all did nothing. One new `PageLink` component now renders a real `<a>` whose `href` comes from the existing `pageToPath` (so it can never drift into a crawlable 404), returns early **without** `preventDefault()` on any modified or non-primary click, and otherwise keeps the single batched `setSearchParams` call. Every page-changing control routes through it: `Navbar` (logo, Home, both dropdowns, category chips, CTA, the whole mobile drawer), `Footer`, hero/CTA buttons, market cards, `FeatureCard`, `SectionHeader`'s action, both "View Product" controls, the industry product lists and **`ProductSidebar`'s two product lists** (its `onSelect` wrote `?productId=` to the URL, so it was navigation). Toggles, form submits, the search box, family filter pills and accordion headers stay `<button>`. Counts after: **30 `<button>`, 51 distinct internal `href`s, all 200 through the real rewrite.** Evidence in §4f. |
| **NB-copy** | `_harness/copydrift.js`, `_harness/lint.php` | Shipped 2026-08-06 (Plan 2). The two sides of the page-copy contract — `admin/content.php`'s `$COPY_GROUPS` and `src/App.jsx`'s `COPY_DEFAULTS` — had never been compared, and `mergeContent` iterates `Object.keys(defaults)`, so any PHP-only key was a silent data-loss path with a green banner on it. Enumerated mechanically (PHP side by eval'ing the isolated literal, JS side by brace-matching and eval'ing): **96 fields, 12 groups, matched 96, PHP-only 0, JS-only 0.** No drift existed. The comparison is now a **failing check** in `lint.php`, proven to fail on a bogus key, a bogus group, and a removed default. Round-trip proven end to end for 4 keys across 4 groups. Evidence in §4g. |
| **4.12** | `admin/content.php`, `admin/config.php` | Shipped 2026-08-06 (Plan 2). The Industries product-code field validated against nothing while the help text promised "the SKU must match a real product so the link works". Now checked on save against `load_products()` via a new `product_reference_resolves()` that **mirrors the site's three-tier lookup** (exact → `normalizeSku` → `skuSegmentMatch`), not an exact match — exact matching flagged 5 of the 18 shipped industry references as broken when **all 18 resolve** (`IP44A2 & IP45A3` and the catalog's `IP44A2-IP45A3` both normalize to `IP44A2IP45A3`). Warns and **still saves**, by Keagan's decision (§3), so the card-before-product workflow survives; the warning is carried across the `?saved=1` redirect as a one-shot session flash. Evidence in §4g. |
| **4.13** | `admin/content.php`, `admin/confirm.js` | Shipped 2026-08-06 (Plan 2). The ✕ that deletes an entire content card had no confirmation while every other destructive admin action has one, and the measured gap to the nearest reorder arrow was **6.0 px** (§2 said 4 px). The existing `data-confirm` mechanism was extended to `<button>` and given a `{it}` placeholder resolved **at click time** from the row's own first text field, so the prompt names the row Rick can see; cancelling is reliable because `confirm.js` stops the event in the capture phase before `content-editor.js`'s bubble-phase remove handler runs. Gap now **34 px** at 1440 and 375, **30 px** and a **44×44** hit target on a coarse pointer. Evidence in §4g. |
| **4.23** | `src/App.jsx`, `src/index.css`, `admin/settings.php`, `admin/config.php`, `admin/contrast-guard.js` | Shipped 2026-08-06 (Plan 2), **partially — see `brand-ink-translucent` in §2.** Owner-set brand colors were injected with no contrast guard while headings and primary buttons hardcoded `#ffffff`, so a pale color shipped white-on-white with nothing warning him. Two layers: (1) three new `--brand-{primary,dark,header}-ink` variables, recomputed by WCAG luminance in `ThemeInjector` and defaulted in `index.css` for the first paint, replacing the hardcoded white at **35 brand-colored call sites**; the banner ink is scored on the *worse* of the gradient's two stops. (2) `settings.php` prints a plain-language readability note with the computed ratio under each color, server-rendered and updated live by `contrast-guard.js` as the picker moves. **The save is never blocked** — it is his brand. Measured ≥4.5:1 on every brand-painted element for four colors spanning light to dark. Note the auto-ink changes the premise: a *pale* color is no longer the failure case (`#FFE600` scores 14.5:1 with dark text); the warning band is the mid-tones where neither ink clears AA. Evidence in §4g. |
| **`form_complete` position** | `admin/content.php`, `_harness/` | Shipped 2026-08-06 (Plan 2). The `max_input_vars` truncation sentinel was enforced positionally with nothing asserting it at runtime. The sentinel is unchanged (deliberately — a count-based scheme was rejected); what is new is enforcement: `plan2-formlast.js` asserts it is the last of **421** named controls in the **rendered DOM**, including after the editor adds and removes rows, and `plan2-trunc.js` drives a genuinely truncated POST against a real `max_input_vars=100` server with a working `display_errors` negative control. The inline comment now names the DEPLOY_READINESS_v2 T3.7 incident and says explicitly that new fields go above the line. Evidence in §4g. |
| **brand-ink-translucent** | `src/App.jsx`, `src/index.css` | Shipped 2026-08-06, the follow-on to 4.23. 4.23 replaced the hardcoded white on *solid* brand surfaces; the **de-emphasised** text on those same surfaces — nav links, banner sub-lines, dropdown captions, sidebar chrome — still used `rgba(255,255,255,α)` and went invisible on a pale brand color. Three new `--brand-*-ink-rgb` triples let those say `rgba(var(--brand-dark-ink-rgb), 0.6)` and follow the ink (deliberately not `color-mix()`, whose absence would invalidate the declaration and fall back to `inherit` — failing toward unreadable, which is the bug). **77 inline sites** converted, plus **12** Tailwind `text-white` classes swapped to new `.ipc-ink-*` utilities. Surfaces were **measured in the browser**, not inferred: a source scan both misses a background declared after the className in the same element and attributes one from 12,000 characters away, and it produced three real mis-classifications that a new empirical auditor caught — including `#141414` text on a `#141414` background at 1:1. Result: **357 → 274** brand-sensitive contrast failures, with **zero** white-on-brand-surface remaining. Evidence in §4h. |
| D1–D18, D19–D30 | docs | See §5. |

---

## 2. Open — not launch blockers

Ordered by value. Nothing here blocks the upload.

- [ ] **4.11b** Footer social icons were promised by v2 4.11 and never built — `social.*` still feeds JSON-LD `sameAs` only. (Split out 2026-08-05, AUDIT_v3 D18.)
- [ ] **4.15b** Auto-reply per-recipient cap is defeated by plus- and dot-addressing (`a+1@gmail.com`, `a.b@gmail.com`). Normalising Gmail-style addresses is the fix; the per-IP cap still bounds the damage. (Split out 2026-08-05, AUDIT_v3 §3.3.)
- [x] **NB-copy** ~~`mergeContent` iterates `Object.keys(defaults)` only, so a `copy` key that exists in `content.php` but not in `App.jsx`'s `COPY_DEFAULTS` would have the owner's edit vanish with a success message. ~450 posted keys were never enumerated against the defaults tree.~~ **ENUMERATED AND CLOSED 2026-08-06 (Plan 2)** — the two sides **match exactly**: 96 fields, 12 groups, zero PHP-only and zero JS-only. The mechanism was real but had never actually drifted. Drift is now a failing check (`_harness/copydrift.js`, wired into `lint.php`). **`AMENDED`: the "~450 posted keys" figure was wrong** — it conflated the whole form (421 named controls, which is what `max_input_vars` truncates) with the `copy` subset, which is 96. See §1b and §4g.
- [x] **`form_complete` position** ~~is enforced *positionally* only. Nothing stops a future field being added after `content.php`'s last input, and there is no test runner to assert it.~~ **SHIPPED 2026-08-06 (Plan 2)** — now asserted three ways: `invariants.js` INV6 (source order), `_harness/plan2-formlast.js` (the **rendered DOM**, which is what actually sets POST order, including after the editor adds/removes rows), and `_harness/plan2-trunc.js` (the guard firing against a real `max_input_vars=100` server). See §1b and §4g.

- [x] **4.1** ~~FAQ JSON-LD `useEffect` has `[]` deps and runs before `content.json` loads, so owner-edited FAQs never reach Google's rich results.~~ **SHIPPED 2026-08-05 (Plan 1)** — see §1b and §4e.
- [x] **4.3** ~~No `rel="canonical"` anywhere; `og:url` is hardcoded to the homepage on all 9 pages.~~ **SHIPPED 2026-08-05 (Plan 1)** — see §1b and §4e.
- [ ] **sitemap/dashboard** `public/sitemap.xml` lists `/dashboard` with priority 0.8, alongside the nine public routes. Whether that route should be publicly indexed was never established. Noticed 2026-08-05 during Plan 1; not investigated, not changed.
- [ ] **4.5** Every contact-form error is a browser `alert()` — no inline error, no `aria-live`, no focus move.
- [x] **4.12** ~~`content.php` promises the Industries SKU "must match a real product" but validates nothing against `load_products()`.~~ **SHIPPED 2026-08-06 (Plan 2)** — warns and still saves, by Keagan's decision (see §3). See §1b and §4g.
- [x] **4.13** ~~The ✕ that deletes a whole content card has no `data-confirm`, and sits 4 px from the reorder buttons.~~ **SHIPPED 2026-08-06 (Plan 2)** — measured gap was **6.0 px**, not 4 px; now 34 px. See §1b and §4g.
- [ ] **4.14** Login throttle uses `sleep()` (parallel connections sleep concurrently) and a read-modify-write with no lock. A long random password is the real control.
- [ ] **4.19** Product Index sortable headers have no `tabindex`, `scope` or `aria-sort`.
- [ ] **4.20** Collapsed FAQ answers use `max-height:0` — still read by screen readers and find-in-page.
- [x] **4.21** ~~Navigation is `<button onClick>` throughout: 3–7 `<a href>` vs 14–119 `<button>` per page. No crawlable internal link graph, no Cmd-click.~~ **SHIPPED 2026-08-05 (Plan 1)** — see §1b and §4f.
- [x] **4.23** ~~Owner-set brand colors are injected with no contrast guard while headings and primary buttons hardcode `#ffffff`.~~ **SHIPPED 2026-08-06 (Plan 2)** for headings, primary buttons and the other solid brand surfaces — see §1b and §4g. **The de-emphasised text on those same surfaces is NOT covered — see `brand-ink-translucent` below.**
- [x] **brand-ink-translucent** ~~The 4.23 ink mechanism is in place but 47 translucent-white foregrounds on owner-controlled brand surfaces still hardcode `rgba(255,255,255,α)` and go invisible when the owner picks a pale color.~~ **SHIPPED 2026-08-06** — see §1b and §4h. The count was **77 inline sites plus 12 Tailwind `text-white` classes**, not 47; the original estimate came from a source scan that only looked at `rgba(255,255,255,α)` and missed both the solid `#ffffff` conditionals and the class-based colors. Measured before/after with a new empirical auditor: **357 → 274 brand-sensitive contrast failures, and zero of the remainder are white-on-a-brand-surface.**
- [ ] **brand-color-as-foreground** Brand colors used as *text on white or on another brand surface* — product feature chips, eyebrow labels, the sidebar's "PRODUCT CATALOG" / family headings, `color: "var(--brand-primary)"` and `var(--brand-accent-2)` at ~30 sites. A pale brand color makes these unreadable and the ink variables do not help: this case needs the brand color **darkened for text use**, not a foreground swapped. **Now quantified** (2026-08-06, `_harness/inkaudit.js`): **262 of the 274 remaining brand-sensitive failures** — 252 at `rgb(255,230,0)` (primary as text) and 10 at `rgb(255,247,192)` (accent as text on `--brand-dark`). This is now the single largest brand-color defect. Visible in `_harness/out/contrast/pale-yellow-1440.png` as the washed-out "UL & CUL LISTED" chips and sidebar headings. Not started.
- [ ] **brand-gradient-mixed-ends** Found 2026-08-06 while fixing `brand-ink-translucent`. Two heading strips use a gradient running from a **hardcoded dark** color to an **owner-controlled** one — `linear-gradient(135deg, #0a2a52, var(--brand-primary))` on the product-detail header (`src/App.jsx:5885`) and `linear-gradient(135deg, #003d7a, var(--brand-primary))` on the industry section headers (`:7789`). No single ink can serve both ends: white is right over the fixed navy, dark is right over a pale primary. Left as `text-white`, which is correct for the default palette and for where the left-aligned heading actually sits, and both carry an inline comment saying so. Accounts for the last **12** of the 274 remaining failures. The real fix is a design decision — either make the fixed end `var(--brand-dark)` so one ink can serve the whole band (a visible change to the current look, `#003d7a` is notably brighter than `#0d2d52`), or stop putting text across a two-owner gradient. **Escalate before changing.**
- [ ] **sidebar-active-border** `ProductSidebar`'s desktop product rows set `borderLeft: active ? "3px solid var(--brand-primary)" : "3px solid transparent"` and then `border: "none"` **two lines later** in the same style object. React applies the keys in order, so `border: none` wipes it: the selected product never gets its left indicator. Measured on the built bundle at 1440 px — the active row's computed `border-left-width` is `0px`. It also makes React log *"Updating a style property during rerender (borderLeft) when a conflicting property is set (border)"* on every selection change in dev. Pre-existing, **not** introduced by 4.21: identical at `HEAD:src/App.jsx:5385-5388` (`a0b07e1`), where the element was still a `<button>`; 4.21 only changed the tag. Found 2026-08-05 while converting that list; **not fixed** — out of Plan 1's scope. Current location `src/App.jsx:5488-5491`.
- [x] **4.24** ~~`SITE_INFO_URL` / `CONTENT_URL` have no `import.meta.env.DEV` branch, so theming and content plumbing are never exercised by `npm run dev`.~~ **SHIPPED 2026-08-05 (Plan 0)** — see §1b and §4d.
- [ ] **4.26** Scroll listeners added inside an inline `ref` callback and never removed.
- [ ] **4.27** Duplicate React keys reachable from the admin (`key={link.label}`, `key={f.title}`, `key={m.year}`, …). Two footer links both named "Contact" drop a row.
- [ ] **4.29** `IP75AD`, `VALUE-ADDED`, `VT-1100` have `rows: []` and render an empty bordered table with an invalid `<thead><tr></tr></thead>`.
- [ ] **4.30** `spectable-editor.js` blows away focus on every structural change; all remove buttons share `aria-label="Remove row"`.
- [ ] **4.31** `content.php` renders 418 unlabelled form controls.
- [ ] **4.32** 9.3 MB of unoptimised images (`Front-Cover.jpg` 1.5 MB, `VALUE-ADDED.png` 683 KB, …). **PARTIALLY SHIPPED 2026-08-05:** the second half of this item — "served `immutable, max-age=31536000`, so an FTP'd photo fix won't reach returning visitors for a year" — was misfiled here as an image-weight problem. It was a mis-scoped `FilesMatch` in `public/.htaccess` with no path restriction, and it is fixed (NB1). **The image-weight work remains open.**

---

## 3. Deliberately deferred / declined

- **`src/pages/`, `src/components/`, `src/lib/` extraction.** Populated, imported by nothing. Not resumed: splitting an 8,500-line file with no test suite is a large uninstrumented refactor with no user-visible benefit. Either finish it behind tests or delete the folders — leaving them looks like completed work and misleads every reader. Not scheduled.
- **Git history rewrite for the exposed `_localsite/admin/config.local.php` hash (commit `169c0d7`).** Escalated 2026-08-04. Repo confirmed **public**, so the live production hash was publicly readable. Removing the file in a new commit does not un-publish it. Recommendation on the table: rotate the live password (done as part of this release) and make the repo private; skip the rewrite, because a force-push over `main` is forbidden by the standing workflow and does not help once the blob has been scraped. **Awaiting Keagan.**
- **`data/products-all.json` upload.** Decided 2026-08-04: **do not upload from the repo.** Download the server's copy, diff, merge only if the repo copy is genuinely ahead. The repo copy (239 KB) looks newer than the deployed one (178 KB) but `data/` has been server-owned since the last deploy, and an FTP overwrite is irreversible with no backup.
- **Paid tooling of any kind.** $0 budget, free tiers only.

### Decisions taken 2026-08-05 (session 3)

- **The handoff `.docx` is RETIRED.** *Decided by Keagan, 2026-08-05.*
  `IPC Admin Dashboard - Help and Documentation.docx` (internal revision date
  `2026-07-08T18:17Z`, revision 2) was never touched by this release and 12 of
  its statements are now wrong, four of them actively harmful — it tells Rick to
  phone the developer for the password change and the backup restore he now has
  in his own navigation, and sends him to Google Drive/Dropbox to find a "direct
  image link" for a one-click Photo button. Rather than maintain two documents
  that drift, `admin/help.php` becomes the single source and has been rewritten
  to cover all nine nav tabs. The handoff email no longer attaches the `.docx`
  and asks Rick to delete any copy he was sent.
  **The file itself is still on disk in this repo and has NOT been deleted** —
  that is Keagan's call, not something to do silently. It is not deployed.
  Accepted downside: Rick loses a printable artifact he may already have shown
  someone.
- **The `.docx` Table 5 `Password |` row is removed from the handoff path.**
  *Decided by Keagan, 2026-08-05.* No credential goes into an emailed
  attachment — that is the delivery channel T1.1 was about. The password is
  given to Rick out-of-band (the email already says "I'll send this to you by
  text separately"). `help.php`'s equivalent credentials box has had its
  Password row deleted and now explicitly says not to write the password down
  in any document.

### Escalation raised 2026-08-06 (Plan 2, item 4.12)

- **Should an unmatched Industries SKU hard-block the save, or warn and let it
  through?** *Raised before writing the gating code, per GUARDRAILS §5.*

  ```
  decision-needed | recommended | why | trade-off | blocked
  ```

  - **decision-needed** — `admin/content.php` parses `industryDetail.products`
    from `"SKU | Display name"` lines (`:451-459`) and validates the SKU against
    nothing. A typo ships a card linking to a product page that does not exist,
    under a green success banner. The fix must decide whether the save is
    *refused* or merely *flagged*.
  - **recommended** — **warn, do not block.** Render the message in the same
    block as the concurrency and truncation warnings, naming the offending SKU,
    but still write `content.json`.
  - **why** — Rick may legitimately add an industry card before the product
    exists in the catalog. Hard-blocking makes that ordering impossible: he
    cannot save the card at all until he has gone and created the product, on a
    page that also holds his FAQ and About copy. PLAN-2's own prose says
    "Prefer a warning that still allows the save over a hard block if the SKU is
    merely unmatched."
  - **trade-off** — a warning can be ignored, so a dead product link can still
    reach the public Industries page and cost a lead. Blocking guarantees the
    link is live but breaks the card-before-product workflow.
  - **blocked** — **PLAN-2 is internally inconsistent here and this had to go to
    the owner.** The prose prefers a warning, but the implementation instruction
    ("add the message to the existing `$errors` array") and the acceptance
    criterion ("`content.json` is byte-identical to pristine after the rejected
    save") both describe a *hard block* — `content.php:487` only calls
    `save_content()` when `empty($errors)`, so anything appended to `$errors`
    blocks by construction. Warning-without-blocking needs a second array that
    renders but does not gate the save.

  **RESOLVED 2026-08-06 by Keagan: warn, still save.** Implemented with a
  separate `$warnings` array that never gates `save_content()`. Because the
  successful save redirects to `content.php?saved=1`, the warning is carried
  across the redirect in `$_SESSION['content_warnings']` (a one-shot flash,
  unset on read) — otherwise the redirect would swallow the very message the
  item exists to show. **The PLAN-2 acceptance criterion "`content.json` is
  byte-identical to pristine after the rejected save" is therefore not
  applicable and was not met: there is no rejected save on this path.** The
  substituted assertion is that `content.json` *does* change, the warning names
  the SKU, and a valid SKU produces no warning. See §4g.

### Still awaiting Keagan (restated, not re-derived)

- **Git history rewrite for the exposed `_localsite/admin/config.local.php`
  hash (commit `169c0d7`).** Escalated 2026-08-04, **re-raised and explicitly
  left open 2026-08-05.** Repo confirmed **public**, so the live production hash
  was publicly readable. Removing the file in a new commit does not un-publish
  it. Recommendation on the table is unchanged: the live password was already
  rotated as part of this release, so make the repo private and skip the
  rewrite — a force-push over `main` is forbidden by the standing workflow and
  does not help once the blob has been scraped. **No action taken.**

---

## 4. Verification evidence for §1

Reproduced in a `public_html` mirror served by PHP 8.4 with a router
emulating the `.htaccess` SPA rewrite, driven by Chromium via Playwright.
`php -S` ignores `.htaccess`, so the `admin/` and `data/` file-blocking rules
are **not** covered here — Apache is the real gate.

```
T1.1  config.local.php vs 'fathom-…-79'      true      (cost 12)
      vs 'ipc-admin-2025' / 'ipc-admin-2026' false / false
      live login against the mirror           302 -> index.php  |  ipc-admin-2025 -> 200 (rejected)
T1.2  password change, end to end             hash written is well-formed bcrypt: true
      NEW password works / OLD works          true / false
      fresh login with the new password       302 -> index.php
T1.3  config.local.php deleted, no flag       "Admin Not Configured"; 'password' and
                                              'ipc-admin-2025' both rejected (200, no session)
      with ALLOW-PASSWORD-RESET uploaded      "Set Admin Password" -> 302 signed in;
                                              flag file auto-deleted; recovered password logs in
T1.4  footerLinks emptied to []               seeded defaults present BEFORE: 8   AFTER: 0
      10 other sections emptied               0–1 headings render; nothing re-seeds
      ^^ AMENDED 2026-08-05 ^^                True for 15 of 16 array sections. `seo: []` is the exception:
                                              title = entry.title || home.title || document.title, and
                                              document.title was already set from the defaults by the first
                                              effect pass, so the default per-page titles stick. Benign in
                                              effect, but "nothing re-seeds" is not literally true.
                                              (AUDIT_v3 §3.8) — left as-is deliberately; making an empty
                                              seo[] blank every page title would be worse.
T1.6  two saves in one second                 2 backups (old code: 1); oldest holds the pre-mistake value
      14 saves                                14 kept, pre-mistake value still recoverable (old: NO after 8)
      44 saves, keep=30                       oldest kept = ROTATION 11, newest = LATER 28 (correct window)
      ^^ SUPERSEDED-BY 2026-08-05 ^^          WRONG, and arithmetically impossible: ROTATION 11-16 (6) +
                                              LATER 1-28 (28) = 34 entries, not 30. Re-measured actual:
                                              oldest = ROTATION 14, newest = LATER 27. The BEHAVIOUR is
                                              correct (contiguous newest-30, oldest pruned); only this
                                              evidence line was wrong. DO NOT use the old pair as a
                                              regression baseline. (AUDIT_v3 §3.2)
T1.7  tab B saves phone                       phone=999.999.9999, fax='630.771.0701',
                                              foundedYear='1974', phoneDial='+16307710700' (were all blanked)
      tab A saves with a stale signature      refused with a warning; phone unchanged
      blank site-info -> public site          0 dead href="tel:" links, no "© –2026", no empty faxNumber in JSON-LD
T1.8  POST after the session expired          403 with the styled page, "Back to my unsaved page" control,
                                              1,678 bytes (was a 47-byte bare die())
      GET while signed out                    still a normal 302 to auth.php
      ping.php                                {"ok":false} signed out / {"ok":true} signed in
T2.1  catalog blocked, /contact               2 tel:, 2 mailto:, nav+footer+form all present
      catalog blocked, /products              "Catalog Unavailable" shown AND nav + phone still present
      origin hangs, 14 s                      times out into the error state; 0 skeletons left spinning
T2.2  forced throw, then click Home           crash screen gone, URL /  (was: bricked until reload)
T2.3  /dashboard?family=…                     Back -> / then blank. Escaped (was: /dashboard forever)
T2.4  keyboard on the mega-menu               baseline 6 -> Enter 18 (aria-expanded=true) -> Escape 6 -> ArrowDown 18
T2.8  ?productId=IP37SH - IP36TH - IP39LH     resolves to the correct product, no banner
      ?productId=CC90S / NOT-A-REAL-SKU       "couldn't find part" banner shown (was: silently served a different part)
T2.9  sticky bar, 375px, IP52EC               all three controls right-edge <= 359 of 375. Nothing clipped
                                              (was: "Request a Quote" left 316 right 483)
T2.10 throttled load                          48 .ipc-skeleton elements, backgroundImage set, animationName ipc-shimmer
T2.5  RFQ with "<1/4 inch and >2 inch ID, 1/2\" wall" from O'Brien & Sons
                                              logged verbatim, all characters intact
T2.6  POST with no Referer                    200 {"ok":true}   (was 403 "Forbidden", lead never logged)
      POST with Referer: https://evil.example/?x=<host>
                                              403 with a message naming the phone number (was: accepted)
4.2   Product JSON-LD                         typeof description === "string"  (was an array on all 42)
4.4   contact form                            11 controls, 0 unlabelled
4.17  form_type sent as an array              200  (was an unauthenticated 500)
      ^^ SUPERSEDED-BY 2026-08-05 ^^          The form_type half reproduces exactly. The "no unauthenticated
                                              500" half did NOT: `email[]=a@b.test` threw an uncaught
                                              TypeError, and any non-UTF-8 byte made s()'s /u preg_replace
                                              return null. Both were 500 + path disclosure. Fixed in
                                              session 3 (NB6/NB7) and proved in §4b. (AUDIT_v3 §3.4)
4.18  honeypot hit                            logged to inquiries.jsonl
      ^^ AMENDED 2026-08-05 ^^                Logged, but rendered in inquiries.php as an ordinary message
                                              with a red "Email failed" badge, its `note` never shown, and
                                              counted in $failed — so the counter Rick watches to detect
                                              broken mail was permanently non-zero. Fixed (NB10). Honeypot
                                              POSTs also bypassed the rate limiter entirely (B3).
—     all 14 admin pages, signed in           200, zero PHP errors/warnings in the body
—     9 public pages × 2 viewports            0 page errors, 0 console errors, 0 4xx/5xx, 0 horizontal overflow
—     npm run build                           0 errors; 91.3 KB gzipped JS, 4.5 KB gzipped CSS
—     php -l                                  clean on all 20 files under PHP 8.4
```

### Self-corrections from this session

1. **I introduced a crash and the harness caught it.** The `photoFailed` state
   for T2.7's `onError` fallback was declared in `ProductPage` but used in
   `ProductDetail` — a different component. `/products` threw
   `ReferenceError: photoFailed is not defined` at both viewports, and the
   ErrorBoundary swallowed it, which is why the T2.8 and T2.9 checks in the same
   run reported "no banner" and "sticky bar not shown". Moved into
   `ProductDetail`; re-ran; all three pass. Had I only run the targeted checks
   and not the clean-page sweep, I would have shipped it.
2. **My first backup-ordering fix was wrong twice.** `sort()` on the filename
   misorders `-01` against `.json` ("-" < "."), and `filemtime()` has one-second
   resolution so every same-second write ties. Both would have pruned the
   *newest* backup of a pair. Corrected to a parsed (timestamp, sequence) sort,
   and `backup_path()` changed from first-free to max-used+1 so pruning can't
   recycle a slot.
3. **My first T1.4 test asserted the wrong thing** — it counted every control in
   `<footer>`, so the contact block's phone and email read as "defaults that
   reappeared" and it reported FAIL on a passing fix. Re-scoped to the eight
   seeded link labels.

---

## 4b. Verification evidence for §1b (session 3, 2026-08-05)

Harness: a `public_html` mirror under `_harness/site` served by `php -S`
(**PHP 8.3.32**, Windows) with a router emulating the `.htaccess` SPA rewrite,
a second instance on :8124 with `max_input_vars=100` to force a genuine
truncation, a local SMTP sink for `mail()`, and Chromium 141 via Playwright.
Admin password set to a known value **in the mirror only**, with
`preg_replace_callback`. `data/*.json` restored from pristine copies after every
destructive test. `_harness/` is gitignored and is not deployed.

`php -S` still ignores `.htaccess` and `.user.ini`, so NB1, NB14 and NB15 are
reasoning from the rule text, not measurement — Apache is the real gate.

```
B1  20/20 checks
    stale orig_sig            warning shown; typed marker survives (1 occurrence);
                              nothing written to disk; 108 rows in → 108 rows out
    form_complete stripped    truncation warning; marker survives; rows 108→108;
                              copy fields 96→96; disk untouched
    clean save                302 → ?saved=1, green banner, marker IS on disk
    two-tab race              tab A refused with the warning, KEEPS its text, wrote
                              nothing, tab B's write intact; second Save commits
                              RICK's text (was: the disk values, under a green banner)
    NEGATIVE CONTROL          pre-fix behaviour re-installed in the mirror → exactly
                              4 of the 20 fail, incl. "second Save commits Rick's
                              text". The suite is not vacuous.
    GENUINE truncation        473 vars posted into max_input_vars=100:
                              guard fired; marker (var #9) survives; 124 content-row
                              occurrences and 96 copy[] fields — IDENTICAL to the
                              baseline GET; content.json byte-identical to pristine
    display_errors=On         same POST: 3,010 bytes of warnings, NO session, NO
                              page, server path disclosed 4× — the T3.7 guard never
                              ran at all. This is why NB2 is a prerequisite.

B2  18/18 checks
    flag 2 h old              reset form NOT offered; normal Sign In shown; login
                              screen explains the closed window; unauthenticated
                              reset POST does NOT take the account (config.local.php
                              byte-identical); the real password still signs in
    dashboard, stale flag     warns the file is still there + one-click close;
                              close button deletes it and confirms
    flag 60 s old             reset form offered; one-hour window stated; reset
                              accepted (302); flag auto-deleted; recovered password
                              signs in after opcache revalidation
    open window, signed in    red banner "password-reset window is OPEN" inside the
                              health block; auth.php still bounces to the dashboard
                              (which is now where the banner is); closed from there

B3  25/25 checks
    8 honeypot POSTs          200,200,200,200,200,429,429,429 — a rate-limit file is
                              now created (was: 0 files, unlimited); 5 honeypot
                              entries + rate-limited rejections both logged
    1 MB message              logged value 5,094 chars, truncation announced,
                              whole log 5,263 bytes (was: 1,048,735-byte log line)
    non-UTF-8 body            200 {"ok":true}, JSON body      (was: 500, empty)
    email[]=…                 422 with no path disclosed      (was: 500 + path)
    Referer garbage/path-only/android-app://  all 200          (was: 403)
    Referer https://evil.example/?x=127.0.0.1  403 AND logged as blocked-referer
    inquiries.php vs 70.1 MB log   HTTP 200 in 71 ms, 53,001 entries counted,
                              zero PHP diagnostics  (was: memory exhausted, fatal)
    honeypot rendering        "Spam trap" badge, note shown, failed counter = 0,
                              separate "Blocked as spam" stat

NB4 17/17 checks
    fax + 5 social + shortName + slogan cleared:
                              number gone from all 5 pages, no dangling "(Fax)",
                              no "fax , or submit" clause, JSON-LD omits faxNumber /
                              sameAs / alternateName / slogan, navbar fallback does
                              not reappear, 0 dead tel:, 0 console errors
    phone/email/foundedYear/company.name/city cleared (invariant 4 must hold):
                              all fall back to defaults, 0 dead href="tel:",
                              no "© –2026", 0 console errors

4.25 3/3 checks
    catalog edited on disk, 61 s, tab refocused → refetch fires (5→6 requests) and
    the new product appears WITHOUT a reload. Previously inert.

D5/D4 22/22 checks
    #server-limits inside <main> and .help-content, has a TOC link, scroll-spy sees
    22 of 22 sections, left edge 386 = same as every other section (was: parent
    BODY, inMain false, tocHasLink false, full-bleed)
    every section inside <main> and .help-content; every section has a TOC link;
    no TOC link points at a missing section
    help now covers Business Details / Page Content / Inquiries / Backups /
    Password / Product photos (was: 0 of 6)
    none of the misdirecting sentences survive (D1, D2, D19, D20, D26)

Regression
    php -l                    19 shipped PHP files, 0 failing (PHP 8.3.32)
    node --check              8 admin JS files, 0 failing
    data/*.json               all three parse; products-all.json = 42 products
    npm run build             0 errors; 325.78 kB JS / 21.02 kB CSS
    9 public pages × 2 viewports   0 page errors, 0 console errors, 0 4xx/5xx,
                              0 horizontal overflow  (18 loads)
    42 product pages @ 375 px      0 horizontal overflow  (was: 2 — IP35KY 377,
                              IP55FL 381)
    14 admin pages signed in       200, zero PHP diagnostics in the body
    14 admin pages signed out      302 (ping.php answers JSON by design)
    12 mutating endpoints signed-out POST   rendered 403, no Location header
    ping.php                  {"ok":false} signed out / {"ok":true} signed in
```

### Not verified — stated as such

- The host's real `post_max_size`, `upload_max_filesize` and `max_input_vars`.
  The sandbox used PHP's stock defaults (8M / 2M / 1000). **Confirm on the
  target** via Admin → Help → "What your server allows" after deploying.
- Whether Network Solutions honours `.user.ini` at all. Same check confirms it.
- Whether `mail()` behaves the same on Network Solutions as in the sandbox.
- Whether the customer has edited the catalog on the server since the last
  deploy — this is what makes the D2 decision irreversible.
- `admin/.htaccess` and `data/.htaccess` file-blocking rules: `php -S` ignores
  `.htaccess`. `_localsite/` proves the Apache 2.2 syntax already works on this
  host, but the new CSP line is [UNVERIFIED] on the target.
- **New 2026-08-05, all `.htaccess`-dependent and therefore unmeasured locally:**
  the `SetEnvIf`-scoped `immutable` cache (NB1) — confirm a re-uploaded product
  photo actually changes for a returning visitor; the dotfile block (NB15) —
  confirm `https://…/.user.ini` 403s; the `ALLOW-PASSWORD-RESET` entry in
  `admin/.htaccess` (NB14) — confirm it 403s rather than serving an empty 200.
  All three depend on `mod_setenvif` / `mod_headers` being present.
- The two embedded PNGs in the retired `.docx` (`word/media/image1.png`,
  `image2.png`) were never examined. If either is a dashboard screenshot it
  shows the obsolete four-item header nav. Moot now that the document is
  retired, but noted rather than dropped.

---

## 4c. Re-verification pass, 2026-08-05 (same day, harness rebuilt from scratch)

The whole suite was re-run against a mirror re-synced from a fresh
`npm run build`, to check the results above reproduce from a cold start rather
than from accumulated harness state. Everything in §4b reproduced **except one
check, which failed and exposed a real gap.**

**T3.9 — a partially truncated section was not restored. FIXED.**
`content.php`'s truncation merge tested `empty($content[$sec])`, which restores
only sections that arrived with *nothing*. Measured at `max_input_vars=100`
against this form's 423 variables, PHP's cut falls at variable 101 —
`features[0][iconKey]` — so `features` arrives holding **1 of its 6 rows** and
is not empty. Fifteen sections were restored; the one straddling the cut was
silently left 5 rows short, on the page whose entire job at that moment is to
show Rick his work survived.

Nothing was ever written to disk (`content.json` byte-identical, marker absent),
and the guard still refused the save, so this was a **display** defect on an
error page, not data loss. Fixed by comparing row COUNTS instead of emptiness,
which subsumes the empty case:

```php
if (count((array)($content[$sec] ?? [])) < count((array)($storedContent[$sec] ?? []))) {
    $content[$sec] = $storedContent[$sec];
}
```

After the fix: rows 108 → 108 across all 16 sections, and B1 re-ran 20/20 with
no regression.

**Two figures in §4b were measured differently and are corrected here, not
superseded — both were reported accurately, from two different counting
methods:**

- The "124 content-row occurrences" in §4b and the "108 rows" in the B1 suite
  are the *same page*. A `class="content-row"` regex over the HTML sees 124; a
  `form .content-row` DOM query sees 108. The difference is exactly 16 — one
  hidden JS row-template per section. Baselines must be derived with the same
  method they are compared against; hardcoding 108 into a regex-based check
  produced a false failure on this pass.
- `display_errors=On` re-measured at **3,002 bytes and 5 path disclosures**
  (§4b says 3,010 and 4×). The response embeds the posted marker, so the byte
  count moves with the test fixture. The finding is unchanged: no session, no
  page, guard never runs.

```
re-run 2026-08-05, cold harness, after the T3.9 fix
  php -l 19/19 · node --check 8/8 · JSON 17/10/42 · npm run build 0 errors
  B1 20/20 · B1-truncation 5/5 · B2 18/18 · B3 25/25 · NB2 10/10 (new)
  NB4 17/17 · help 22/22 · invariants 15/15 · TTL 3/3
  public sweep 18 loads 0 failing · 42 product pages @375px 0 overflow
  admin sweep 5/5 · dist mirrors public on all 8 copied files
  data/*.json byte-identical to pristine
```

`_harness/nb2.js` is new this pass: it posts the same truncated form to
`display_errors=Off` (:8124) and `=On` (:8125) and asserts the shipped setting
renders the guard while the pre-fix setting renders nothing. It is the standing
negative control for NB2.

**Also verified in a real browser this pass** (not headless): the B2 stale-window
banner renders on the dashboard, its "Close it now" button deletes
`ALLOW-PASSWORD-RESET`, shows "The password-reset window is closed and the file
is gone.", and writes `Password-reset window closed from the dashboard` to
`admin-log.jsonl`. The login screen shows the closed-window explanation and
refuses to offer the reset form.

---

## 4d. Verification evidence for Plan 0 — 4.24 and the dev-loop regression

### The regression, measured before the fix

`6284708` removed `public/products-all.json`. `src/App.jsx:4142`'s
`import.meta.env.DEV` branch pointed at it. Measured against `npm run dev`:

```
GET http://localhost:5173/products-all.json?v=29765958  →  200 OK
body: "<!doctype html>\n<html lang=\"en\">…"   2241 bytes
console: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
/products renders: "⚠️ Catalog Unavailable"
```

Vite's SPA fallback answers an unknown path with `index.html` and a **200**, so
`res.ok` was true and the failure only surfaced when `res.json()` threw.
Production was never affected — the non-DEV branch reads `/data/products-all.json`.

### After the fix — `node _harness/plan0.js`, 9/9

```
PASS  catalog loads in dev from /data/
PASS  catalog renders 41 of 42 SKUs (VALUE-ADDED is SIDEBAR_EXCLUDED)   41 products
PASS  no page/console errors on /products                              none
PASS  mergeContent runs in dev — edited copy.hero.badge is on the page
      was "Bolingbrook, IL — Made in USA Since 1974"
PASS  mergeSiteInfo runs in dev — theme color reaches computed styles
      #BADA55 (was #005da3)
PASS  missing catalog → "Catalog Unavailable", not a silent empty list
PASS  data/content.json restored byte-identical
PASS  data/site-info.json restored byte-identical
PASS  data/products-all.json restored byte-identical
```

The two `merge*` checks are the substance of 4.24: both functions hold invariants
(3 and 4) and **neither had ever executed against real data outside production.**

### Middleware behaviour, measured in the browser

```
/data/products-all.json?v=1   200  application/json; charset=utf-8
/data/site-info.json?v=1      200  application/json; charset=utf-8
/data/content.json?v=1        200  application/json; charset=utf-8
/data/nope.json               404  application/json     (a miss 404s like Apache
                                                         does — it does NOT fall
                                                         through to the SPA
                                                         fallback, which is the
                                                         bug being fixed)
/data/..%2fpackage.json       403                       (containment holds)
```

`/data/%2e%2e/package.json` returns 200 — but that request never reaches the
middleware: Chrome normalises the encoded dot-segments and sends `/package.json`,
which Vite's dev server serves from the project root by default. That is stock
Vite dev behaviour, present before this change and unrelated to it. Noted rather
than dropped.

### Build

```
npm run build   0 errors, 325.96 kB JS / 21.02 kB CSS
bundle contains "/data/products-all.json", "/data/site-info.json",
                "/data/content.json"
bundle contains NO root-level "/products-all.json"
```

### Deviation from the plan as written

PLAN-0 §Step 1 said a miss should `next()` into Vite's own handling. It is a
real **404** instead. `next()` would have re-created the exact failure this plan
exists to remove — a missing data file answered with HTML and a 200. Production
404s a missing file, and dev now matches.

---

## 4e. Verification evidence for Plan 1 part A — 4.3, 4.1, `seo: []`

`node _harness/plan1a.js` against `npm run dev` — **43 checks, 0 failing.**

```
4.3   all 9 routes: exactly ONE <link rel=canonical>, href == the route itself,
      og:url == canonical
      /products?productId=IP35KY  → canonical to itself
      /products?family=Heat Shrink → canonical to /products (a view, not a doc)
      canonical updates after a CLIENT-SIDE navigation, and that navigation was
      confirmed client-side (a module-scope sentinel survived it)
4.1   FAQ JSON-LD contains an EDITED question
      (was: "What types of heat shrink tubing do you …", i.e. defaults only)
      parses as FAQPage; mainEntity 18 == 18 faq rows in content.json
      exactly ONE #faq-ld after 5 round trips to /faq and back
      #faq-ld removed on leaving /faq
seo:[] every route still titled, 9 of 9 distinct, all computed
      e.g. "Terms — Insulation Products Corporation"
      zero page/console errors; data/content.json restored byte-identical
```

### Negative control — the title checks are not vacuous

Re-installing the old line `entry.title || home.title || document.title`:

```
FAIL  titles are distinct across all nine routes   7 distinct of 9
FAIL  seo:[] → titles are still distinct           7 of 9
```

`terms` and `quality` have no `seo` row in `content.json`, so they inherited the
homepage's `<title>` — three routes shipping one title. This is the part of the
`seo` item that the earlier `AMENDED` note did not capture; it recorded the
`document.title` fallback as benign and missed the `home.title` fallback
entirely.

One weakness worth recording: the check *"titles are COMPUTED, not the shipped
defaults"* **passed under the negative control too**, because `document.title`
had already been set from a populated `seo` earlier in the same page context. It
passed for the wrong reason. The two distinctness checks are the load-bearing
ones and they failed correctly.

### Regression, after part A

```
php -l 19/19 · node --check 8/8 · build 0 errors (326.48 kB)
B1 20/20 · B2 18/18 · B3 25/25 · help 22/22 · adminsweep 5/5
NB4 17/17 · invariants 15/15 · TTL 3/3
sweep 18 loads 0 failing · overflow 0/42 @375px
```

### Note, not acted on

`public/sitemap.xml` lists `/dashboard` with priority 0.8. Whether that route
should be publicly indexed was not investigated and is out of Plan 1's scope —
recorded in §2.

---

## 4f. Verification evidence for Plan 1 part B — 4.21, the crawlable link graph

Suite: `node _harness/plan1b.js` — **45 checks, 0 failing**. Client-side
behaviour is measured against `npm run dev` on `:5173`; the link graph, the
crawl and a repeat of the click semantics are measured against the `php -S`
mirror on `:8123`, which applies the real `.htaccess` SPA rewrite.

### The suite failed first, against the unmodified tree

Run at `a0b07e1` before any edit — this is what 4.21 actually was:

```
FAIL  A1 / links to /            0 distinct paths on the page
FAIL  A1 / links to /products    0 distinct paths on the page
… all nine routes …
FAIL  A1 / has a real link graph (≥ 12 internal anchors)   0 internal anchors
FAIL  A3 product links carry ?productId=                   0 product hrefs
FAIL  A4 / — no <button> changes the page (27 buttons clicked)
        #4 "Request a Quote" → /contact | #6 "Browse Products →" → /products
        #7 "Request a Quote" → /contact | #8 "View Full Catalog →" → /products
FAIL  A4 /products — no <button> changes the page (119 buttons clicked)
        #0 "INSULATION PRODUCTS…" → / | #1 "Home" → /
        #17 "IP29CG…" → /products?productId=IP29CG
FAIL  A5 a /products anchor exists to ctrl-click            null
```

Zero internal anchors on the homepage. A4 is the honest form of "no remaining
button calls `nav`": every `<button>` is clicked one at a time from a fresh
load, and the check fails if the URL moves.

### After — `node _harness/plan1b.js`, 45/45

```
PASS  A1 / links to / · /products · /dashboard · /industries · /services
      · /about · /faq · /contact · /privacy        (all nine renderPage() routes)
PASS  A1 / has a real link graph (≥ 12 internal anchors)   30 internal anchors
PASS  A2 every internal href resolves to a route renderPage() handles   51 hrefs
PASS  A2 no href has a trailing slash (pageToPath never emits one)
PASS  A3 product links carry ?productId=   41 product hrefs, e.g. /products?productId=IP29CG
PASS  A4 / — no <button> changes the page (3 buttons clicked)
PASS  A4 /products — no <button> changes the page (24 buttons clicked)
PASS  A5 ctrl-click opened a new tab   http://localhost:5173/products
PASS  A5 the new tab is at the correct URL
PASS  A5 ctrl-click left the current page URL unchanged   / → /
PASS  A6 middle-click opened a new tab at the correct URL  /contact
PASS  A6 middle-click left the current page URL unchanged
PASS  A7 plain click navigated   /about
PASS  A7 that navigation was client-side (sentinel survived, no full reload)
PASS  A8 five navigations: /products /about /services /contact, then into
      /products?productId=CC from the Product Index
PASS  A8 Back returns to the Product Index · Forward returns to the product page
PASS  A9 the BUILT bundle also emits a link graph   51 internal anchors in dist/
PASS  A9 all 51 hrefs return 200 through the real rewrite
PASS  A10 dist: ctrl-click opens a new tab at the right URL, current URL unchanged
PASS  A10 dist: plain click navigated and was client-side (sentinel survived)
PASS  A11 a category chip is an <a href="/dashboard?family=Polyolefin+Heat+Shrink">
PASS  A11 it lands on the Product Index with ?family= consumed and stripped
PASS  A11 the Product Index rendered a filtered table   12 rows
PASS  A11 Back leaves the Index (the { replace: true } cleanup did not trap it)
PASS  no page/console errors across the run   none
```

A11 exists because the navbar category chips are the **only** feed into
`DashboardPage`'s `?family=` cleanup, which is the one place the routing shim
uses `{ replace: true }` — pushing there traps Back on the Product Index
forever. The chips are `PageLink`s now, so the whole path is re-proved: the
`href` the anchor exposes, the filter it applies, the param being consumed and
stripped, and Back still leaving the page.

A4's button count on `/products` fell from **119 to 24**; the 24 that remain are
the family filter pills, the family accordion headers, the search box and its
clear control, and the sort headers — none of which change the page.

### Counts

```
<button   in src/App.jsx     63  →  30
<a href / <PageLink          15  →  59
distinct internal hrefs       0  →  51   (9 routes + 41 ?productId= + /)
```

### No visual change — screenshots, byte-identical

`node _harness/shots.js before` was captured against the **unmodified** `dist/`
before any edit; `… after` against the rebuilt bundle in the same mirror.

```
IDENTICAL  1440-home-header          IDENTICAL  375-home-header
IDENTICAL  1440-products-header      IDENTICAL  375-menu-closed-accordions
IDENTICAL  1440-home-footer          IDENTICAL  375-menu-products-open
IDENTICAL  1440-products-footer      IDENTICAL  375-menu-company-open
IDENTICAL  1440-dropdown-products    IDENTICAL  375-home-footer
```

`ProductSidebar` was **not** in that before/after set — it was converted after
the "before" shots were taken, so no pair exists for it. Verified instead by
measuring the built bundle in the browser (`_harness/out/after/1440-sidebar.png`,
`375-sidebar.png`): the desktop rows compute to `display: block`,
`text-align: left`, `text-decoration: none`, width 276 of a 288 px aside,
height 60, padding `12px 20px` — the same box the `<button>` produced from
`w-full text-left px-5 py-3 block` — and the mobile pill grid still highlights
the active product. The one difference found there is pre-existing and recorded
in §2 as `sidebar-active-border`.

### What was deliberately left as `<button>`

Dropdown and accordion toggles (including every `setOpenDropdown`), the
hamburger, the catalog-failure reload link, form submits, the search box and its
clear control, "Submit Another", the sidebar family filter pills and family
headers, and the sort headers (Plan 4 owns those). None of them change the page;
an anchor would need a meaningless `href` and would break their semantics for
screen readers.

### Styling technique, for the next reader

Tailwind's preflight already resets `a { color: inherit; text-decoration:
inherit }`, so colour and underline needed no work. The two real deltas from
`<button>` are `display` (`inline-block` vs `inline`) and `text-align: center`.
Both are restated inline at each converted call site whose original relied on
the button default — and only there, because a blanket inline `display` would
have overridden the Tailwind `flex` / `hidden lg:flex` classes several call
sites depend on. No rule was added to `src/index.css` or `GlobalStyles`: the
scope boundary is `src/App.jsx` and `index.html`.

### Regression, after part B

```
php -l 19/19 · node --check 8/8 · JSON 17/10/42 · build 0 errors (326.80 kB JS / 21.02 kB CSS)
B1 20/20 · B1-trunc 5/5 · B2 18/18 · B3 25/25 · NB2 10/10 · NB4 17/17
help 22/22 · invariants 15/15 · TTL 3/3 · adminsweep 5/5
sweep 18 loads 0 failing · overflow 42 pages 0 overflow @375px
plan0 9/9 · plan1a 43/43 · plan1b 45/45
```

`data/content.json`, `data/site-info.json` and `data/products-all.json` all
`cmp` byte-identical against `_harness/pristine/` after the run.

### `[UNVERIFIED]`

Nothing in 4.21 depends on `.htaccess` or `.user.ini` beyond the SPA rewrite,
which `_harness/router.php` emulates and A9 exercises against all 51 hrefs. The
standing `php -S` limitations from GUARDRAILS §4.3 are unchanged by this item.

---

## 4g. Verification evidence for Plan 2 — owner safety (2026-08-06)

**Base:** `e0c6b54`. **Build:** 0 errors, **328.42 kB JS / 21.11 kB CSS**
(from 326.80 / 21.02 — the delta is the three ink variables and the 35 call
sites that now read them).

### The harness had to be rebuilt from nothing

`_harness/` is gitignored (`.gitignore:59`) and was never committed, so it did
not survive the clone. Every suite named in the previous session's baseline —
`b1`, `b1trunc`, `b2`, `b3`, `nb2`, `nb4`, `help`, `ttl`, `sweep`, `overflow`,
`adminsweep`, `plan0`, `plan1a`, `plan1b`, `lint.php`, `setpw.php`,
`pristine/`, the three `php-*.ini` — was gone. Rebuilt this session: the
`public_html` mirror, `router.php` (SPA rewrite), the three ini files,
`setpw.php`, `lint.php`, and `invariants.js`. **The other suites were not
reconstructed and their results are NOT claimed anywhere in this document.**

`invariants.js` is a **reconstruction, not the original**, and its count is its
own: **17 checks**, not the 15 earlier sessions reported. Every check asserts
CODE, never an incident comment — GUARDRAILS §4.4 records two session-3 checks
that passed falsely by matching comment prose quoting the old buggy pattern.

`invariants-selftest.js` proves each one can fail, by re-introducing the actual
defect into a **temp copy** of the tree (the real source is never written to):

```
ok   INV1a   goes red on: the shipped bug: preg_replace instead of preg_replace_callback  (also INV1b, expected)
ok   INV2a   goes red on: a real bcrypt hash back in config.php (shipped twice)  (also INV2b, expected)
ok   INV3    goes red on: the "&& v.length" re-seed — stale legal text republishing itself
ok   INV4a   goes red on: blank strings spread over the defaults — "© –2026", href="tel:"  (also INV4b, expected)
ok   INV5a   goes red on: first-free sequence allocation, which scrambles backup ordering
ok   INV5b   goes red on: ordering backups by filemtime() — 1-second resolution ties
ok   INV6    goes red on: a field added AFTER the truncation sentinel
ok   INV7    goes red on: the unkeyed ErrorBoundary — one bad product bricked every page
ok   INV8    goes red on: Footer moved above the catalog gate (chrome behind the gate)
ok   INV9    goes red on: the skeleton defined only in GlobalStyles — styleless while loading
ok   INV10a  goes red on: strip_tags() in s() — ate "<1/4 inch and >" out of a quote request
ok   INV10b  goes red on: hdr() no longer stripping CRLF — mail header injection
ok   INV11   goes red on: an absent Referer treated as a rejection — cost real leads
ok   INV12   goes red on: require_auth() redirecting on POST — turns it into a GET, discards typing
ok   control  the unmutated copy is fully green
invariants-selftest 15/15
```

### NB-copy — the two sides match, and drift is now a failing check

The enumeration, in full. PHP side by eval'ing the isolated `$COPY_GROUPS`
literal, JS side by brace-matching and eval'ing `COPY_DEFAULTS` — not by eye,
and not by regex:

```
NB-copy — admin/content.php $COPY_GROUPS  vs  src/App.jsx COPY_DEFAULTS

  PHP fields offered : 96  in 12 groups
  JS defaults        : 96  in 12 groups
  matched            : 96
  PHP-only (BROKEN)  : 0
  JS-only (uneditable): 0

copydrift OK — every offered field has a default (96 matched, 0 JS-only)
```

`$out['copy']` is built strictly from `$COPY_GROUPS` (`content.php:475-485`), so
that array **is** the complete posted set — the comparison is the right one.

**The "~450 posted keys" in the old §2 line was wrong.** It conflated the whole
form with the `copy` subset. The form has **421** named controls (measured, see
below); the `copy` subset is **96**.

The check fails in both directions and on both sides:

```
ok   control  unmutated tree is clean (96 matched, exit 0)
ok   bogus key added to $COPY_GROUPS (PHP-only drift)   -> exit 1, names "homeFeatures.bogusDriftKey"
ok   whole bogus group added to $COPY_GROUPS            -> exit 1, names "whole groups PHP-only: bogusGroup"
ok   key removed from COPY_DEFAULTS (same defect, JS side) -> exit 1, names "homeFeatures.ctaButton"
ok   default with no editor (JS-only) is reported but does NOT fail -> exit 0
copydrift-selftest 5/5
```

A static key match is only a claim about declarations, so the whole path was
driven end to end — admin form → POST → `content.json` → `mergeContent` →
rendered DOM — for 4 keys across 4 groups (`copyroundtrip 15/15`).

Wired into `lint.php`, so drift is a failing check rather than a future audit
finding.

### 4.12 — Industries product codes

Watched fail against the **pre-fix** `content.php` still in the mirror, then
pass after the sync. Before **10/13**, all three failures reporting
`no .warn-list element on the page`; after **14/14**.

One assertion passed *vacuously* in the first run — the industry name also
appears in the form field below, so a page-wide `includes()` matched against
code that emitted no warning at all. Every warning assertion is now scoped to
the `.warn-list` element.

The important correction is in the matcher. An exact SKU check flagged **5 of
the 18** shipped industry references as broken. They are not:

```
18 industry product references, catalog of 42
  ok    IP44A2 & IP45A3            -> IP44A2-IP45A3
  ok    IP71NS - IP72PS - IP73PP   -> IP71NS-IP72PS-IP73PP
  ok    IP41NE / IP43VT            -> IP41NE-IP43VT
  ok    IP61ES & IP62EF            -> IP61ES-IP62EF
  …
0 of 18 resolve to nothing
```

The site resolves through three tiers (`App.jsx:6181-6188`) and the shipped data
depends on the second: `IP44A2 & IP45A3` and `IP44A2-IP45A3` both normalize to
`IP44A2IP45A3`. `product_reference_resolves()` mirrors all three tiers, and
`skuparity 33/33 (32 needles)` asserts the PHP and JS answers agree — including
a non-degeneracy check (26 resolve, 6 do not), because a parity suite where
everything answers the same way proves nothing.

**Warning a busy owner about five links that work is worse than not warning at
all** — he learns to ignore the banner. That is why this is a three-tier check
and not an `isset()` on a SKU map.

### 4.13 — the delete ✕

Before **0/18**, after **18/18**. The before run is the whole defect in one
table: gap **6.0 px** (§2 said 4 px), hit target **28×28**, no prompt, and the
row already gone on the click that was meant to be cancellable (108 → 107 rows
on "cancel", because there was nothing to cancel).

```
ok   1440px: gap between ✕ and nearest reorder control is 34.0px (>= 24)
ok   1440px: the confirmation names the row ("Heat Shrink Tubing")
ok   1440px: the confirmation is not a bare "Are you sure?"
ok   1440px: the confirmation points at Backups as the undo path
ok   1440px: cancelling leaves the row in place (108 rows before, 108 after)
ok   1440px: cancelling leaves the row's fields untouched
ok   1440px: accepting removes exactly one row (108 -> 107)
   …identical at 375px…
ok   touch: ✕ hit target is 44×44px (>= 44×44)
ok   touch: gap is 30.0px (>= 24)
plan2-delete 18/18
```

Cancel is reliable because `confirm.js` stops the event in the **capture**
phase, which always completes before `content-editor.js`'s bubble-phase remove
handler. That ordering comes from the event phases, not from script order — an
earlier version of the comment claimed the latter and was wrong.

### 4.23 — brand-color contrast

`contrastparity 28/28` — the math exists in three places (`admin/config.php`,
`admin/contrast-guard.js`, `src/App.jsx`) and all three agree across 23 colors,
anchored to the WCAG reference values so agreeing on a *wrong* number still
fails:

```
ok   anchor #000000 on #ffffff = 21.000:1
ok   anchor #ffffff on #ffffff = 1.000:1
ok   anchor #777777 on #ffffff = 4.478:1
ok   anchor #767676 on #ffffff = 4.542:1
ok   color set exercises both inks: 9 white, 14 dark
```

`plan2-contrast 42/42`. Every element the browser actually paints with the brand
color, measured by computed style (not by CSS selector), at 1440 and 375:

| brand primary | ink chosen | worst measured contrast | admin note |
|---|---|---|---|
| `#FFE600` pale yellow | **dark** | **14.54:1** | ok |
| `#1ABC9C` mid teal | **dark** | **7.65:1** | ok |
| `#005DA3` shipped navy | white | **6.79:1** | ok |
| `#101820` near black | white | **17.89:1** | ok |

**The auto-ink changes the item's premise, and the plan's acceptance criterion
"a pale brand color produces a visible admin warning" no longer holds — by
design.** `#FFE600` is not a problem once the ink switches; it scores 14.5:1. A
warning there would be false. Scanning 45 colors, the band where *neither* ink
clears AA is narrow — `#787878` at 4.42:1 and `#7c7c7c` at 4.41:1 — and nothing
single-colored reaches the `cnote-bad` threshold at all. `cnote-bad` is reachable
only through the **banner gradient**, whose two stops can need opposite inks. All
three severities are therefore exercised explicitly, live, through the picker:

```
ok   mid grey #787878: #cnote_primary is cnote-warn
ok   shipped navy: #cnote_primary is cnote-ok
ok   clashing banner black→white: #cnote_header is cnote-bad
```

The measurement had a false positive worth recording: the first version measured
any element with the brand background, including wrappers whose text comes
entirely from children. That reported "black on brand" for the mobile product
pill, whose two children both set their own color — nothing painted that black.
It now only measures elements with a **direct** text node.

**Screenshots: `_harness/out/contrast/`.** `pale-yellow-1440.png` is the honest
artifact for this item — it shows the heading and buttons correctly dark **and**
the nav links, banner sub-line and sidebar chrome washed out, which is the
`brand-ink-translucent` item now open in §2.

### `form_complete`

`plan2-formlast 8/8` — the sentinel is the last of **421** named controls in the
rendered DOM, appears exactly once, and stays last after the editor adds a row
(424 controls) and removes one (421).

Proven to fail, against the real server, by adding a field after the sentinel in
the **mirror's** copy only:

```
[1] unmodified mirror        -> exit 0  plan2-formlast 8/8
[2] field after the sentinel -> exit 1  plan2-formlast 5/8
    caught it: → last was "added_after_the_sentinel"; 1 control(s) follow the sentinel
[3] field removed            -> exit 0  plan2-formlast 8/8
```

`plan2-trunc 13/13` drives a **genuinely** truncated POST — 421 variables into a
`max_input_vars=100` server, so PHP itself discards the sentinel; the test does
not remove it. The save is refused, `content.json` is byte-identical, the message
names `max_input_vars`, B1 repopulation holds, and no PHP warning leaks with
`display_errors=Off`. The `:8125` negative control (same truncation,
`display_errors=On`) **does** surface the warning, so that last assertion is not
vacuous, and `:8123` saves the same form, so "refused" does not just mean
"broken everywhere".

### Two test bugs, both from the same cause

`nav.php` renders the Sign Out form **before** the page's own form, so
`button[type="submit"]` logged the suite out and `form[method="POST"]` matched a
2-control form. Both cost a debugging round and are now anchored on content
unique to the target form. Noted here because the next suite will hit it too.

### Live state

```
data/content.json:      byte-identical to pristine
data/site-info.json:    byte-identical to pristine
data/products-all.json: byte-identical to pristine
```

All writes went to `_harness/site/data/`; every suite restores from
`_harness/pristine/` in a `finally` block and asserts the restore.

### `[UNVERIFIED]`

`php -S` ignores `.htaccess` and `.user.ini` (GUARDRAILS §4.3), so these are
reasoned from the rule text, not measured: the `SetEnvIf`-scoped cache (NB1),
the dotfile block (NB15), the `ALLOW-PASSWORD-RESET` block (NB14), and every
limit in `public/.user.ini`. The `display_errors=Off` behaviour the truncation
guard depends on **was** exercised, but via `_harness/php-trunc.ini` rather than
via `.user.ini` — the production mechanism itself is still unverified locally.

The suites listed in the previous baseline that were not reconstructed —
`b1`, `b2`, `b3`, `nb2`, `nb4`, `help`, `ttl`, `sweep`, `overflow`,
`adminsweep`, `plan0`, `plan1a`, `plan1b` — **were not run and nothing is
claimed about them.** `plan2-trunc.js` covers part of what `b1trunc`/`nb2`
covered; the rest is genuinely unmeasured this session.

---

## 4h. Verification evidence for `brand-ink-translucent` (2026-08-06)

**Base:** `8699279` (Plan 2 merged). **Build:** 0 errors, **329.53 kB JS /
21.35 kB CSS** (from 328.42 / 21.11 — the ink-rgb triples and three utility
classes).

### The auditor was built first, and it is what made this safe

The risk in this item was never the edit; it was **mis-classification** —
deciding by source inspection which brand surface a call site sits on, getting
it wrong, and swapping in an ink that creates a *new* contrast bug. A source
scan cannot detect that. `_harness/inkaudit.js` can:

- renders all 8 public routes at 1440 and 375 under **two palettes**, the
  shipped navy and a pale one, by intercepting `/data/site-info.json` (nothing
  on disk is touched, so there is no restore step and no per-minute
  cache-buster to fight);
- for every element that paints its own text, resolves the **effective**
  background — walks ancestors to the first opaque color, expands a
  `linear-gradient` into its stops and keeps the worst, composites any
  translucent layer over what is behind it;
- composites the (usually translucent) foreground over that background and
  applies the WCAG threshold, 3:1 for large text and 4.5:1 otherwise.

It reports the **difference** between the two palettes: elements that pass on
navy and fail on pale. Anything failing under both is a pre-existing, non-brand
contrast problem and is counted separately rather than folded in — this audit
is not a licence to go and restyle the site.

```
examined 1855 text-painting elements across 8 routes × 2 viewports
BRAND-SENSITIVE (pass on navy, FAIL on pale):  357   ->   274
pre-existing, fail on both (NOT this item):    643   ->   609
```

### Three mis-classifications, all caught by measurement

Every one of these was produced by the "nearest preceding background" heuristic
and would have shipped silently:

| Site | Wrongly given | Actually | Measured |
|---|---|---|---|
| FAQ "Still have questions?" card | `--brand-primary-ink` / `--brand-dark-ink` | background is a **hardcoded `#141414`** | `#141414` text on `#141414` — **1:1** |
| Mega-menu panels `#0e2847`, mobile drawer `#0a2444` | `--brand-dark-ink` | hardcoded, not owner-controlled | reverted, 23 sites |
| Three transparent outline buttons | `--brand-primary-ink` (from a **sibling** button's background) | painted on the **container** | reverted to `--brand-dark-ink` / white |

The lesson for the next reader: the scan is wrong in both directions — it
misses a background declared *after* the className in the same element (both
Submit buttons), and it happily attributes one from 12,000 characters away.
`_harness/whitesurfaces.js` asks the browser instead, which is how the final 15
`text-white` elements were classified.

### What changed

- **77 inline sites** — `rgba(255,255,255,α)` → `rgba(var(--brand-*-ink-rgb), α)`,
  and the solid/conditional `#ffffff` on brand surfaces → `var(--brand-*-ink)`.
- **12 Tailwind `text-white` classes** → new `.ipc-ink-primary` /
  `.ipc-ink-dark` / `.ipc-ink-header` utilities in `index.css`. An inline-style
  patch cannot reach a class-based color.
- **`--brand-{primary,dark,header}-ink-rgb`** set by `ThemeInjector`, defaulted
  in `index.css` for the first paint. `rgba(var(--x), a)` rather than
  `color-mix()`: an unsupported `color-mix()` invalidates the declaration and
  the color falls back to `inherit`, i.e. it fails **toward** unreadable, which
  is precisely the defect. The one `color-mix()` left by 4.23 was converted too.
- One de-emphasised sub-line raised from `0.55` to `0.75` alpha: the ink was
  right but the opacity diluted it to **3.95:1** against a pale `--brand-dark`.

### Left white on purpose, and why

| Surface | Reason |
|---|---|
| the hero | its brand gradient sits under an `rgba(20,20,20,0.72)` scrim, so white is legible at any brand color |
| the footer `#0a2240` | hardcoded, not a brand variable |
| FAQ card `#141414`, mega-menus `#0e2847`, drawer `#0a2444` | hardcoded darks |
| the two mixed-end gradient headings | see `brand-gradient-mixed-ends` in §2 — no single ink serves both ends |

### What is left, and it is NOT this item

All 274 remaining brand-sensitive failures are other defects:

```
252  rgb(255, 230, 0)    brand primary used as TEXT on white    -> brand-color-as-foreground
 10  rgb(255, 247, 192)  brand accent used as TEXT on dark      -> brand-color-as-foreground
 12  rgb(255, 255, 255)  the two mixed-end gradients            -> brand-gradient-mixed-ends
```

**Zero white-on-a-brand-surface failures remain.**

### Regression

```
php -l 18/0 · node --check 9/0 · JSON 17/10/42 · copy drift 96 matched
invariants 17/17 · invariants-selftest 15/15 · contrastparity 28/28
copyroundtrip 15/15 · plan2-sku 14/14 · plan2-delete 18/18
plan2-contrast 42/42 · plan2-formlast 8/8 · plan2-trunc 13/13
```

`plan2-contrast` still measures 14.54 / 7.65 / 6.79 / 17.89:1 across the four
sampled palettes, so 4.23's guarantees are intact and the navy default is
unchanged. `data/` byte-identical to pristine.

`_harness/out/contrast/pale-yellow-1440.png` is regenerated: the nav links,
sidebar "41 products" and banner sub-line are now readable where they were
invisible. The pale text still visible in that shot is
`brand-color-as-foreground`.

---

## 5. Documentation corrected in session 3 (2026-08-05)

All 18 items in `AUDIT_v3_FINDINGS.md` §4 plus the 12-row `.docx` addendum.

| File | What changed |
|---|---|
| `admin/help.php` | Five previously-undocumented nav tabs written from scratch: **Business Details**, **Page Content**, **Inquiries**, **Backups & undo**, **Product photos** — plus the password-change and password-recovery procedures. "What your server allows" moved **inside `<main>`** and into the TOC (D5). D1: no longer says to ask a developer to change the password. D2: no longer sends him to Google Drive/Dropbox for a "direct image link". D20: backup restore is documented as self-service. D6: prints the *effective* limits (`min(ini, 20MB)` / `min(ini, 8MB)`), not the raw ini value. D7: "only two things stored" replaced with the real surface. D19: "five most recent" → `BACKUP_KEEP`. D26-equivalent: the SKU-rename warning no longer describes the pre-T2.8 "shows the wrong product" bug, which this release fixed. Credentials box no longer has a Password row. Four new FAQ entries. |
| `admin/README.md` | D3: no longer claims a shipped default password is documented in the file. D6: real upload ceiling. D7: full I/O surface table, and the server-layout diagram now includes `site-info.json`, `content.json`, `uploads/` and all 18 admin files. D7/D9: the first-deploy section is marked historical and `data/`/`pdfs/` are flagged never-again. |
| `README.md` | D9: the deploy manifest is now **authoritative here** and says so, with an explicit do-not-upload table naming `data/products-all.json` and `pdfs/`; it no longer defers to the frozen `DEPLOY_READINESS_v2.md` §7 it disagrees with. D10: notes `uploads/images/` is created at runtime and is not in the repo. D11: the "60 s in-memory cache" claim corrected — only the products cache re-checks, and only on tab focus. D6: troubleshooting row gives the real ceiling. |
| `CLAUDE.md` | D17: invariant 9 reworded — `.ipc-page-header` is deliberately in **both** `index.css` and `GlobalStyles`; "not in `GlobalStyles`" was false as written. |
| `Editing-Your-Site-Content.md` | D8: the clearing rule is now stated for **Business Details** too, naming the four field groups that genuinely can be emptied. |
| `Email to Rick…md` | The `.docx` attachment is gone; the email points at the in-app Help and asks Rick to delete any copy of the Word document he was sent. D4's "covers every task" claim is now true of `help.php`. |
| `admin/auth.php` | D14: the throttle comments no longer claim "impractical" / "heat death"; they state the measured behaviour (a delay, per-IP, ineffective against a distributed or parallel attacker) and name 4.14 as still open. |
| `admin/delete.php` | D13: confirmation names the photo as well as the PDF, and says the deletion **can** be undone from Backups. |
| `admin/config.php` | D16: two stale "keep 5" comments → `BACKUP_KEEP`. |
| `public/robots.txt` | D15: `Disallow: /_hash.php` removed — the retired FTP flow no longer exists and the line advertised a former admin endpoint. `/uploads/` and `/contact.php` added. |
| `WHATS_LEFT.md` | D18 and the ten §3 items — see the `SUPERSEDED-BY` / `AMENDED` markers in §1 and §4. |
| `IPC Admin Dashboard - Help and Documentation.docx` | **Retired, not edited.** See §3. Still on disk; not deployed; not attached to anything. |
