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
| **brand-color-as-foreground** | `src/App.jsx`, `src/index.css` | Shipped 2026-08-06. The brand colors are also used as **text** — feature chips, eyebrow labels, sidebar headings, inline links, footer captions — at ~59 call sites, where the ink variables cannot help: there the brand color *is* the foreground. A new `textSafeOn()` darkens (on a light background) or lightens (on a dark one) in HSL, so hue and saturation survive, and only as far as legibility requires. Five derived variables — `--brand-primary-text`, `--brand-accent-text`, `--brand-accent-on-dark`, `--brand-accent-on-footer`, `--brand-accent1-on-dark` — because the same accent lands on white, on `--brand-dark`, and on the footer's hardcoded `#0a2240`, which need **opposite** adjustments; every one of those surfaces was measured in the browser first. **274 → 12** brand-sensitive failures. ⚠️ Not a pure no-op: the shipped `--brand-accent-2` on white was **3.1:1**, a real AA failure, so it moves `#119EC8 → #0d7594`; `--brand-primary` as text (258 of the sites) is unchanged. Evidence in §4i. |
| **4.5** | `src/App.jsx` (`ContactPage`) | Shipped 2026-08-06 (Plan 3). Every contact-form failure was a browser `alert()` — four call sites, two per form. A native dialog on mobile reads as "this site is broken", leaves no trace of what went wrong once dismissed, points at no field, announces nothing inside the form to a screen reader, and **some mobile browsers suppress it entirely during certain interactions, so the failure could be completely silent.** Replaced with one inline region rendered inside the form directly above the submit control: `role="alert"`, `aria-live="polite"`, `aria-atomic`, `tabIndex={-1}`, focused and scrolled into view on failure. The server's own specific message is shown **verbatim** (`cf.submitError` is only the fallback for a response that carried none), passed as a JSX text child so invariant 10 holds at the render boundary — `<1/4 inch and >2 inch ID, 1/2" wall` is asserted to arrive as a **text node with zero element children**. Network failure is a separate `kind` carrying `cf.networkError`, so "check your connection" and "your email looks wrong" cannot collapse into one message; both copy keys stay owner-editable. The panel's colors are fixed rather than brand-derived (measured 7.7:1) so an error stays legible whatever is set in Branding. **Adds zero CSS** — verified byte-identical bundle. Evidence in §4j. |
| **4.15b** | `public/contact.php` | Shipped 2026-08-06 (Plan 3). The per-recipient auto-reply cap keyed on the address **as submitted**, which Gmail's own addressing rules defeat: `a@gmail.com`, `a+1@gmail.com` and `a.b@gmail.com` are one mailbox, so a sender cycling `+1/+2/+3` drew a fresh auto-reply every time — the site could be used to mail a third party under IPC's `From:`. New `ipc_ar_cap_key()` lowercases, drops the `+tag`, and strips dots **for `gmail.com`/`googlemail.com` only**; dots stay significant everywhere else, because collapsing them would merge different people at one company onto one cap and silently deny a real prospect their confirmation. **Only the cap key changes** — the reply is still sent to the address as typed and `inquiries.jsonl` still records it as typed, both asserted. The sales notification is asserted to fire for **every** submission, including the capped one. Evidence in §4j. |
| **4.20** | `src/App.jsx` (`FaqItem`) | Shipped 2026-08-06 (Plan 4). Collapsed answers used `max-height: 0`, which hides them from EYES ONLY — they stayed in the accessibility tree and in find-in-page, so a screen-reader user heard every answer to every question continuously with no way to tell which were collapsed. Measured before the change: `window.find()` on a collapsed answer returned **true**, and the answer text was present in the CDP accessibility tree. The panel now carries `hidden`, set at the END of the collapse transition so the animation is unchanged, plus `aria-controls`/`aria-labelledby` and a stable `useId` pair. Two states rather than one (`hidden` gates the tree, the other drives the height) because the panel must be un-hidden *before* it opens and stay so *until* the collapse finishes. A timeout backs up the `transitionend` handler — reduced motion, a background tab or a zero-duration transition would otherwise leave the panel in the tree forever, silently reinstating the bug. `#faq-ld` still carries every answer regardless of collapse state (4.1 builds it from data, not the DOM — confirmed). Evidence in §4j. |
| **4.19** | `src/App.jsx` (`DashboardPage`), `src/index.css` | Shipped 2026-08-06 (Plan 4). The product-index sort headers were bare `<th onClick>`: no `tabindex`, no `scope`, no `aria-sort`. A keyboard user could not sort at all, and a screen-reader user was told neither that the table was sortable nor which column was active. Each sortable header now holds a real `<button>` **inside** the `th` (not a `tabindex` on the `th` — sorting changes state, not the page, so this is the one place in Plan 1's aftermath where a button is right), every `th` has `scope="col"`, and `aria-sort` sits on exactly one column and matches the glyph, which is now `aria-hidden`. Focus indicator is `:focus-visible` only, 3 px of `--brand-accent`, measured **≥3:1** against the dark header row. Asserted with real Tab presses, not programmatic focus — Chromium will not match `:focus-visible` for the latter, so a working indicator would have read as absent. Evidence in §4j. |
| **4.31** | `admin/content.php`, `admin/content-editor.js` | Shipped 2026-08-06 (Plan 4). The page holding the most irreplaceable typing on the site rendered **418 controls and 418 `<label>` elements, with zero `for` attributes and zero ids** — visually labelled, programmatically not. Measured over the real accessibility tree: **397 of 418 had no accessible name**, and the other 21 were named by their *placeholder* ("One item per line"), which is not a label. Every control now has an id derived from the name it already posts under (so it survives reordering), a bound `<label for>`, and — for row-repeated fields — the row's identity appended inside the label and visually hidden, so "Icon" stays on screen and the screen reader hears "Icon — row 3 of Industries Grid". Sections became `<fieldset>`/`<legend>`. `content-editor.js`'s `reindex()` moves the id, the `for` and the hidden row text on every add/remove/reorder — a stale `for` is worse than no label, and that is asserted after a live mutation and proven to fail when broken. **The posted variable count is unchanged at 421** (the plan says 423; measured is 421 — same over-count the §2 `NB-copy` AMENDED note corrected). Evidence in §4j. |
| **4.30** | `admin/spectable-editor.js` | Shipped 2026-08-06 (Plan 4). Both editors in this file rebuild their rows with `innerHTML` on every structural change, so focus went to the **document**: building a 20-row spec table meant 20 round trips back. Measured before: after removing a row, `document.activeElement` was `body`. Removing now lands on the nearest surviving row's equivalent control; adding lands in the new row. Every remove button said "Remove row" — **21 buttons shared 3 names**; they now carry position and identity ("Remove specification row 3: Material", "Remove sub-column 2 (Wall) of Nominal ID", "Remove size row 4: 3/8″"), kept current as the owner types. A polite live region announces adds and removes. No re-architecture. Round-trip proven: five typed rows survive save + reload, and the mirror's `data/` is restored and shown byte-identical afterwards. Evidence in §4j. |
| **4.27** | `src/App.jsx` | Shipped 2026-08-06 (Plan 5). 23 React keys were derived from owner-editable text (`key={link.label}`, `key={f.title}`, `key={m.year}`, `key={svc.title}`, `key={item.question}`, …), so two footer links both named "Contact" produced two identical keys. **The plan's evidence — "silently drop a row" — does NOT reproduce on the shipped production bundle**: both links render with their own hrefs, the second navigates to its own page, two same-year milestones both render, two identically-worded FAQs open the one that was clicked. What IS real is the console, and React emits it as a **`console.error`**, not a warn — which answers 4.27's open question and means a zero-console-errors sweep catches it on a development bundle and can NEVER catch it on the shipped one, because production strips the message entirely. Measured against an adversarial `content.json`: **53 → 0** duplicate-key errors across 9 routes + 3 product pages. **Choice, as the plan requires it be stated: `` `${index}-${value}` ``, not a per-row id** — see the residual-cost note in §2. Three sites (`stats`, `milestones`, `privacySections`) were missed on the first pass because their `.map` already took an index, and were caught by the suite reading 53 → **4** rather than 53 → 0. Evidence in §4k. |
| **4.29** | `src/App.jsx` | Shipped 2026-08-06 (Plan 5). `IP75AD`, `VALUE-ADDED` and `VT-1100` carry `specTable2: {rows: []}`, and `SpecTable2` drew its chrome unconditionally: `<thead><tr></tr></thead>` — a `<tr>` with no cells, which is invalid — inside a bordered panel **measured at 391 × 508 px on IP75AD at 1440**. Both table components now return `null` on an empty `rows`, and the call site drops the padded wrapper with them and collapses the two-column grid to one, so the surviving specs use the full width instead of sitting beside a blank half. The neighbouring case is covered too: a table with a **title** and no rows emitted its heading bar on its own. **3/13 → 13/13**, and the control product's screenshot is byte-identical before and after. Evidence in §4k. |
| **4.26** | `src/App.jsx` (new `RelatedArrow`) | Shipped 2026-08-06 (Plan 5). **The item is titled "scroll listeners" and they are not.** `App.jsx` had exactly one `scroll` listener and it was already a `useEffect` with a cleanup and `{passive:true}`. The leak was the related-product card's "View →" glyph attaching `mouseenter`/`mouseleave` to its parent `<button>` from inside an inline `ref={(el) => …}`; the mechanism 4.26 describes is exactly right. `ProductDetail` re-renders every time the sticky quote bar crosses its scroll threshold, so scrolling a product page is what drives it. Measured over CDP on ONE card: **`{mouseenter:1, mouseleave:1}` → `{mouseenter:51, mouseleave:51}` after 20 scroll cycles.** Now a small dedicated component with `[]` deps and a cleanup that removes both. Proven able to fail — the inline `ref` was reinstalled and the check went red at 1 → 51. Evidence in §4k. |
| **4.14** | `admin/config.php`, `admin/auth.php` | Shipped 2026-08-06 (Plan 5). `sleep(min(8, failures - 4))` is per-connection, and the counter was a read-modify-write with no lock held across both halves. **Neither fault is observable on a single `php -S`**, which answers one request at a time; `PHP_CLI_SERVER_WORKERS` is not enough either (8 workers served 8 concurrent `sleep(2)` in 6 s). A **fleet of ten independent servers over one docroot** shows both. Before: 10 parallel failures counted **5 of 10**; 12 serial guesses 30,681 ms / 12 evaluated; 12 parallel guesses **757 ms / 12 evaluated**. After: **10 of 10** counted; serial 1,368 ms / 6 evaluated; parallel 364 ms / **6 evaluated** — the same number. That last part is not just the lock: counting *failures* under the lock still let a cold-start burst through, so `login_attempt_gate()` takes a slot on **entry** and the decision and the increment happen inside one `flock`. 5 free attempts, then 15/30/60/120/240s capped at **300 s**, enforced by a stored timestamp instead of sleeping. **Not stranding Rick was the binding constraint**: an attempt made during a cool-off is refused *without being counted and without extending the window*, so retrying cannot dig a deeper hole. The comment at `auth.php:49-54` was rewritten only where it became untrue and still says, in as many words, that this is per-IP so a distributed attacker is unaffected and that the long random password is the actual control. Evidence in §4k. |
| **4.11b** | `src/App.jsx` (new `FooterSocial`), `src/index.css` | Shipped 2026-08-06 (Plan 5). v2 4.11 promised footer social icons and nobody built them: `social.*` fed JSON-LD `sameAs` and nothing else, so five fields Rick can edit in Business Details had **no visible effect on the site at all**. Five inline-SVG icons now render in the footer's brand column. The load-bearing half is NB4 / invariant 4 — all five are in `SITE_CLEARABLE` and the docs promise a cleared field "disappears from the site properly" — so all five empty renders **no container**, asserted as element **absent**, not element-empty (a "has no children" check would pass against an empty row that still eats 40 px of footer). Accessible names read from the real AX tree (5/5); `rel="noopener noreferrer"` on all five; focus ring driven by **real Tab presses**, because Chromium will not match `:focus-visible` for programmatic focus. **9/19 → 31/31.** Deliberately **no heading**: every other footer heading is a `copy` key that must exist on both sides of the content contract, and adding one moves `content.php`'s posted-variable count away from the asserted 421. Evidence in §4k. |
| **4.32** | `public/images/`, `src/App.jsx` | Shipped 2026-08-06 (Plan 5). **9,357,354 → 2,668,995 bytes, `du -sh` 9.1M → 2.7M (71.5% smaller), largest single file 198,726 B, zero over 300 KB.** Nothing cropped, nothing retouched, **not one filename changed** (`diff` of the tracked list against the tree is empty). Three measurements drove it: every product photo is painted at most **390 × 260 CSS px** at 1440 *and* 375, so 800 px on the long edge is already 2×; **27 of 60 files are painted on no route at all**; and **every product PNG's alpha channel is fully opaque** — they are 32-bit RGBA photographs whose fourth channel does nothing, which is most of why a 340 × 260 image weighed 190 KB. Quality is not asserted by eye: every output is PSNR-scored against its original *at the output resolution*, painted photos are held to **38 dB** (worst shipped: 38.1), and a file that cannot clear its floor at q95 keeps its original. As rendered, before-vs-after page screenshots score **53–60 dB** on the product pages. Also: the product detail photo was `loading="lazy"` while sitting **above the fold at 1440** (top 490 in a 900 px viewport) — it is the LCP element, so it is now eager; the footer logo, which is below the fold everywhere, is now lazy. Evidence in §4k. |
| **photoUrl case** | `data/products-all.json` | Shipped 2026-08-06 (Plan 5, after handback, on Keagan's explicit instruction). Four `photoUrl`s differed from the file on disk only by case, so on a case-sensitive filesystem the SPA rewrite answered the miss with `index.html` and a **200** and the T2.7 `onError` fallback swapped in the branded placeholder: **4 of 42 product pages showed a placeholder instead of a photograph that exists**. Corrected to the on-disk names. **The only edit to `data/products-all.json` in this release** — four changed lines, verified by `diff`, made under an explicit owner override of the standing "never modify `data/*.json`" rule. 33 → **37 of 42** pages paint a real photo. ⚠️ **Does not reach production by itself** — the deployed copy is server-owned; the same four edits must be made there, ideally through the admin. Evidence in §4k. |
| **page-header-eyebrow-contrast** | `src/App.jsx` (new `PageEyebrow`) | Shipped 2026-08-07 (Plan 5c, on Keagan's decision: "white ink"). The item said one element on `/products` was at 1.20:1 and that "nothing passes AA there without changing the page-header design". Both halves were wrong in the reader's favour and against it. **The measurement was over the wrong extent** — `brandtext.js` sampled the gradient across the element's 1232 px box while the glyphs occupy 83 px of it, so 1150 px of gradient the text never touches governed the score; ink-extent sampling now lives in `_harness/backdrop.js` and full-opacity header ink measures **5.14:1 at its worst across 9 routes × 2 viewports × 2 palettes**. **And it was never one element** — measuring the whole header block found the other **seven** eyebrows at `rgba(var(--brand-header-ink-rgb), 0.7)`, composited rgb(179,208,228), scoring **3.33–3.80:1**. All eight are now one `PageEyebrow` component on `var(--brand-header-ink)` at full opacity: 4.23 recomputes that variable per palette against the *worse* gradient stop, and translucency is precisely what gives that guarantee back. The `/faq` header's inline "Contact our team." link moved off `--brand-accent` for the same reason (1.69 → 3.68 at 375, → passing at 1440). **39 → 18** failing elements in the header block. The residue is not a colour choice and is logged as `page-header-sublines-on-gradient` in §2. Evidence in §4l. |
| **brand-text-on-brand-surface** (light half) | `src/App.jsx` | Shipped 2026-08-07 (Plan 5c, arrow colour chosen by Keagan: teal). The **165** elements painting a bright accent as text on a light surface — 124 `→` and `✓` bullet glyphs on white at 2.18:1, 41 product-type chips on a pale tint at 2.79:1 — now use `--brand-accent-text` (`#0d7594`), which already existed and needed no new colour. Four call sites: the Industries use-case bullets, its "View product →" links, the Services detail checks, and the **mobile** card's type chip, whose desktop twin in the same table had already been converted — the two are visible at different viewports, so a single-width sweep finds one of them. `--brand-accent` itself is **unchanged** and stays bright at all 10 background and 40 border uses; this is a call-site fix, not a repalette, and `plan5c-brandink.js` asserts both halves. `brandtext.js` **35/53 → 35/51** (the two worst combinations gone entirely). The **dark**-surface half is untouched and still open — there `--brand-accent-text` measures 1.34:1, i.e. the same change would make it four times worse. |
| **product URLs in the sitemap** | `public/sitemap.php` (new), `public/.htaccess`, `public/robots.txt` unchanged | Shipped 2026-08-07 (Plan 5c, on Keagan's decision). `public/sitemap.xml` is **deleted**; `sitemap.php` generates the document from `data/products-all.json` on every request and `.htaccess` rewrites `/sitemap.xml` to it, so the advertised address never changes. **9 → 51 URLs.** The item's objection to a hand-written list was right and applies equally to a build-time generator — the build runs from the repo's `data/` on a laptop and the catalog is owned by the admin on the server, so the two diverge at Rick's first save. Reading per request is the only version that cannot be stale, and it is asserted by *adding and deleting a product in a live catalog* and watching the document track it with no rebuild. All 42 product `<loc>`s were compared against the canonical each page declares for itself — including the five ids containing spaces and ampersands (`IP44A2 & IP45A3`), where `rawurlencode()` and `encodeURIComponent()` had to agree exactly. A corrupt or missing catalog degrades to the 9 static routes, still clean XML. Evidence in §4l. |
| **`brandtext.js` ink extent** | `_harness/backdrop.js` (new), `_harness/brandtext.js` | The measurement fix behind the two rows above, landed 2026-08-07. Gradient sampling and alpha compositing moved out of `brandtext.js` into a shared module the moment a second suite needed the same answer — `contrastparity.js` exists because two contrast implementations had already drifted once. The extraction was proved to be a no-op by diffing the full `--verbose` output before and after. **Known property, recorded rather than hidden:** two homepage `✓` rows wobble ±1 in the reported background between runs, because the hero animates and the ink extent is small enough to be position-sensitive. Verdicts are unaffected (the nearest is 5.5 against a 4.5 bar), but the *count* of distinct combinations can move by one. |
| **PLAN-6 item 4** — social platforms | `src/App.jsx`, `admin/settings.php` | Shipped 2026-08-07. Social links were fixed at five with no way to add one; Instagram and TikTok bring it to **seven**, each with its real single-path brand mark. **Both default to `""`, deliberately** — a guessed URL would put a footer link to a non-existent profile on a real business's site and feed it to search engines through JSON-LD `sameAs`, so day one renders the same five icons it does today and `data/site-info.json` needed no edit at all (verified against the untouched live file). **Not a repeater**, and that was the call worth making: a generic platform+URL list needs a globe fallback for platforms with no icon, and the icon is the whole point of a footer social row. `plan5-social.js` **31 → 35**, with every count now derived from `KEYS` so an eighth platform does not mean editing the suite in six places. The four new assertions are the **admin half**, which nothing covered before: the suite wrote `site-info.json` directly and so proved only that the site renders what the file says — a field that renders correctly and cannot be saved is not a feature. Mutation-proven twice: deleting the save-array line takes it to 33/35, and rendering the container when empty takes it to 29/31. Icons visually checked at 96px (`_harness/out/plan6-icons.png`) because no assertion can catch a mistyped SVG path — it renders a garbled shape and still passes every check. |
| **PLAN-6 item 3** — auto-reply copy | `public/contact.php`, `admin/content.php`, `src/App.jsx` | Shipped 2026-08-07. Everything *around* the auto-reply's promise already came from `site-info.json` — name, phone, fax, email, hours, address — but the commitment itself (*"respond within one business day"*) was a string literal, so the owner could not soften it for a holiday shutdown or a week without an estimator. Three new copy fields: the two promises, plus an optional temporary **notice** that is empty by default and adds *nothing at all* when unset (no blank paragraph — asserted, because every auto-reply would otherwise carry a gap for the 51 weeks it is not needed). The prose is editable; the **request summary is not**, deliberately — it is data, and a templating syntax in an admin textarea is a way to produce broken emails. `contact.php` gained `ipc_contact_copy()`, its first content reader; it returns `[]` on any problem and every caller falls back to the built-in text, so a corrupt or missing `content.json` costs the nicety and never the lead. **§0 of PLAN-6 applied: posted variables 421 → 424**, `POSTED_BEFORE` updated in this commit and `plan2-trunc` re-run against a real `max_input_vars=100` server at the new count (13/13). `plan3-autoreply` **10 → 22**. ⚠️ **A comment and an assertion were both overstated and are corrected here** — see §4m. |
| **PLAN-6 item 1** — product families | `src/App.jsx`, `admin/config.php`, `admin/content.php`, `admin/add.php`, `admin/edit.php`, `admin/content-editor.js`, `_harness/lint.php` | Shipped 2026-08-07. The eleven category names were **three** separate literals — `FAMILY_ORDER` plus a `$partTypes` in each of `add.php` and `edit.php` — identical by luck, with nothing keeping them so, and drift would have been *invisible in the admin* because `edit.php` deliberately keeps an unrecognised `partType` as a selected option. They are now an owner-editable ordered list in `content.json`, and adding a product line no longer needs a developer. **The two PHP literals are deleted; two defaults remain (PHP + JS) and that is the right answer, not a compromise** — one copy across two languages needs a build step, so the pattern is `copydrift`'s: `lint.php` now fails when the two disagree *or* when a third literal reappears. `plan6-families` **13/13** new. §0: posted variables **424 → 435**, `plan2-trunc` re-run at the new count (13/13). Two things measurement changed mid-flight: the editor rendered **zero** rows against a real `content.json` (which has no `productFamilies` key until the first save) and now seeds from the list in effect; and the stated reason for the empty-list fallback was **wrong** — see §4n. |
| D1–D18, D19–D30 | docs | See §5. |

---

## 2. Open — not launch blockers

Ordered by value. Nothing here blocks the upload.

- [x] **4.11b** ~~Footer social icons were promised by v2 4.11 and never built — `social.*` still feeds JSON-LD `sameAs` only. (Split out 2026-08-05, AUDIT_v3 D18.)~~ **SHIPPED 2026-08-06 (Plan 5)** — five inline-SVG icons in the footer brand column, only the non-empty ones, and **no container at all** when all five are cleared (asserted absent, not empty). 9/19 → 31/31. See §1b and §4k.
- [x] **4.15b** ~~Auto-reply per-recipient cap is defeated by plus- and dot-addressing (`a+1@gmail.com`, `a.b@gmail.com`). Normalising Gmail-style addresses is the fix; the per-IP cap still bounds the damage. (Split out 2026-08-05, AUDIT_v3 §3.3.)~~ **SHIPPED 2026-08-06 (Plan 3)** — measured before the fix: four spellings of one Gmail mailbox produced **four** distinct cap files and **four** auto-replies. After: **one** cap key, three auto-replies then the cap holds. `a.b@example.com` and `ab@example.com` stay distinct and both get theirs. See §1b and §4j.
- [x] **NB-copy** ~~`mergeContent` iterates `Object.keys(defaults)` only, so a `copy` key that exists in `content.php` but not in `App.jsx`'s `COPY_DEFAULTS` would have the owner's edit vanish with a success message. ~450 posted keys were never enumerated against the defaults tree.~~ **ENUMERATED AND CLOSED 2026-08-06 (Plan 2)** — the two sides **match exactly**: 96 fields, 12 groups, zero PHP-only and zero JS-only. The mechanism was real but had never actually drifted. Drift is now a failing check (`_harness/copydrift.js`, wired into `lint.php`). **`AMENDED`: the "~450 posted keys" figure was wrong** — it conflated the whole form (421 named controls, which is what `max_input_vars` truncates) with the `copy` subset, which is 96. See §1b and §4g.
- [x] **`form_complete` position** ~~is enforced *positionally* only. Nothing stops a future field being added after `content.php`'s last input, and there is no test runner to assert it.~~ **SHIPPED 2026-08-06 (Plan 2)** — now asserted three ways: `invariants.js` INV6 (source order), `_harness/plan2-formlast.js` (the **rendered DOM**, which is what actually sets POST order, including after the editor adds/removes rows), and `_harness/plan2-trunc.js` (the guard firing against a real `max_input_vars=100` server). See §1b and §4g.

- [x] **4.1** ~~FAQ JSON-LD `useEffect` has `[]` deps and runs before `content.json` loads, so owner-edited FAQs never reach Google's rich results.~~ **SHIPPED 2026-08-05 (Plan 1)** — see §1b and §4e.
- [x] **4.3** ~~No `rel="canonical"` anywhere; `og:url` is hardcoded to the homepage on all 9 pages.~~ **SHIPPED 2026-08-05 (Plan 1)** — see §1b and §4e.
- [x] **product detail URLs are in no sitemap** ~~Noticed 2026-08-07 while closing `sitemap/dashboard`. `public/sitemap.xml` lists the 9 routes and none of the **42** `?productId=` pages, each of which 4.3 made canonical to itself. They are not orphans — 4.21 made every internal link a real `<a href>`, so a crawler reaches them from `/products` and `/dashboard` — but they are not declared either. **Deliberately not fixed, and this is the reason:** `sitemap.xml` is a static file in `public/` that Rick cannot edit from the admin, so a hand-written list of 42 product URLs goes stale the moment he adds or deletes a product, and a sitemap that advertises a dead URL is worse than one that omits a live one. Doing this properly means generating the sitemap from `products-all.json` at build time — which is a real feature, not a fix, and it would need a decision about what happens when the built sitemap and the server-owned catalog disagree.~~ **SHIPPED 2026-08-07 (Plan 5c), decision made by Keagan: `sitemap.php`, not a build-time generator.** The objection above was right and the build-time option does not answer it — the build runs from the repo's `data/` on a laptop, the catalog is server-owned and edited in the admin, and `npm run build` is not part of adding a product, so the generated file would be correct exactly until Rick's first save. `public/sitemap.xml` is deleted and `public/sitemap.php` renders the document from `data/products-all.json` per request; `.htaccess` rewrites `/sitemap.xml` to it so `robots.txt`, any Search Console submission and every external reference keep working. **9 → 51 URLs.** See §1b and §4l.
- [ ] **4.27 residual reorder cost** Recorded here because PLAN-5 requires it. The keys chosen are `` `${index}-${value}` ``, **not** a stable per-row id assigned in `admin/content.php` and carried in `content.json`. A per-row id has to be posted from that form, which currently posts **421** named controls under a positionally-enforced `max_input_vars` sentinel; ~90 more hidden fields moves that number and the invariant asserted against it, and existing rows would have no id until Rick re-saved, so a fallback would be needed anyway. The cost of the cheaper option is that an index-bearing key reorders poorly — React would reuse a fiber by position rather than by row. **Measured, that cost is currently zero**: `content.json` is fetched exactly once per page load (`ContentProvider`, `[]` deps), no owner-editable list is reordered in place at runtime, and a reorder in the admin reaches the public site as a fresh page load. It becomes real the day the 4.25 `visibilitychange` refetch is extended from products to content, or any live-refresh of `content.json` is added — at which point the per-row id is the fix. Asserted today by `plan5-keys.js` phase C (reorder in the admin, save, public order matches). (Logged 2026-08-06, Plan 5.)
- [x] **photoUrl case mismatch — 4 products show the placeholder** ~~Found 2026-08-06 while measuring for 4.32.~~ **FIXED 2026-08-06 by Keagan's instruction** — see the closing note at the end of this item. Original wording kept for the record. Found 2026-08-06 while measuring for 4.32. `data/products-all.json` gives `IP12GA` → `/images/products/IP12GA.jpg`, `IP52EC` → `IP52EC.png`, `IP63ES` → `IP63ES.jpg` and `VALUE-ADDED` → `VALUE-ADDED.png`, but the files on disk are `ip12ga.jpg`, `ip52ec.png`, `ip63es.jpg` and `value-added.png`. On a case-sensitive filesystem — which the deploy target is — the SPA rewrite answers the miss with `index.html` and a **200**, so the browser is handed HTML where it asked for an image and the T2.7 `onError` fallback swaps in the branded placeholder. Measured: `curl /images/products/IP52EC.png` → `200 text/html; charset=UTF-8`, 2,094 bytes. So **4 of 42 product pages show a placeholder instead of the photograph that exists**, on top of the 5 that legitimately point at `placehold.co`. **Not fixed, deliberately:** both available fixes are forbidden by PLAN-5's scope boundary — renaming the files ("Keep filenames identical … renaming breaks the mapping silently") and editing `products-all.json` ("You are **not** … altering `products-all.json` to point at renamed images"). The set is pinned in `plan5-images.js` so it cannot silently grow. **Needed a decision: rename the four files, or correct the four `photoUrl` values.** The second is the safer one — it is a data edit the admin itself can make.

  **RESOLVED 2026-08-06 by Keagan: correct the four `photoUrl` values.** Done —
  `IP12GA.jpg → ip12ga.jpg`, `IP52EC.png → ip52ec.png`, `IP63ES.jpg →
  ip63es.jpg`, `VALUE-ADDED.png → value-added.png`. **This is the only edit ever
  made to `data/products-all.json` in this release**, it was made on explicit
  owner instruction overriding the standing prohibition, and `diff` shows
  exactly four changed lines and nothing else. All 37 local `photoUrl`s now
  resolve to a file on disk; the five `placehold.co` URLs are untouched.
  Measured: **33 → 37 of 42 product pages paint a real photograph**, and
  `plan5-images.js` no longer carries an exception list — "every `/images/`
  response is a 2xx with an `image/*` content type" is now a plain zero.
  `_harness/pristine/products-all.json` was re-seeded from `data/`
  **deliberately**, which is the one circumstance that justifies it: the change
  came from the owner, not from a test writing to `data/`.

  ⚠️ **THIS DOES NOT REACH THE LIVE SITE ON ITS OWN.** `data/products-all.json`
  has been server-owned since the last deploy and §3 settles that the repo copy
  is not to be uploaded. The same four corrections have to be applied to the
  **deployed** copy — the least risky route is Rick's own admin (Edit Product →
  Photo URL) for each of `IP12GA`, `IP52EC`, `IP63ES` and `VALUE-ADDED`, which
  also writes a backup first. **Still outstanding.**
- [x] **27 of 60 images are painted on no route** ~~Found 2026-08-06 during 4.32. The whole of `public/images/site/` (`Front-Cover.jpg`, `Marker-Sample-2.jpg`, `Heat-Shrink-Tape-Product-photo-2.jpg`, `Slide1.png`, `staff-image.png`, `staff.jpg`, the three `featured-category-*.jpg`, both `main-banner-*.jpg`, …), plus `_unmatched/adhesiveLined.webp` and the four case-mismatched product files, are referenced by **nothing** in `src/`, `data/`, `admin/`, `public/` or `index.html`. They still deploy. They were re-encoded rather than deleted (deletion is not in PLAN-5's scope, and the admin may reference them later), and they are ~1.1 MB of the remaining 2.7 MB. **Deleting them is a decision, not a cleanup** — some are the customer's photography and the only copy may be here.~~ **DECIDED 2026-08-07 (Plan 5c): keep them, and this is settled.** They cost nothing at runtime — no route requests them, so no visitor ever downloads one; the only cost is ~1.1 MB of FTP space and one slower first upload. Against that, some are the customer's own photography and this repo may hold the only copy, and the admin can be pointed at any of them later from Business Details or Page Content without a redeploy. Deleting to reclaim a megabyte of disk that nobody is paying for is a bad trade against destroying an original. ⚠️ **The one operational consequence**, which is the real content of this item: `images/site/` is in the deploy manifest, so **after the first deploy do not re-upload it wholesale** — the same reasoning that protects `data/`, `pdfs/` and `uploads/` applies the moment the admin starts referencing a file there.
- [x] **product photo has no `width`/`height`** ~~Found 2026-08-06 during 4.32. Every logo `<img>` carries both; the product detail photo cannot, because the component is handed a URL and never the intrinsic dimensions — those live in `products-all.json`, which PLAN-5 forbids altering. Setting a fixed pair (e.g. 390 × 260) would give the element a fixed aspect ratio, and combined with the existing `object-cover` that **crops** every photo whose natural ratio is wider — `CT.jpg` is painted 390 × 217 today and would be cut to 260. Cropping the customer's product photography to win a layout metric is the wrong trade. Measured cost of leaving it: **CLS 0.021** on a product page at 1440 and **0** at 375, against Google's "good" bar of 0.1. The fix, if it is ever wanted, is intrinsic dimensions in the catalog data.~~ **WON'T FIX, decided 2026-08-07 (Plan 5c).** The measured cost is **CLS 0.021** at 1440 and **0** at 375, against Google's "good" threshold of **0.1** — so this is already inside the bar by roughly 5×, and it is the only Core Web Vital the attribute affects. The available fix is worse than the defect: the component is handed a URL and never the intrinsic dimensions, so a fixed pair plus the existing `object-cover` **crops** every photo whose natural ratio is wider than the box — `CT.jpg` is painted 390 × 217 and would be cut to 260. Cropping the customer's product photography to improve a metric that already passes is not a trade worth making, and 4.32's brief said in as many words not to alter the content of these images. **If it is ever wanted, the fix is intrinsic `width`/`height` in `products-all.json`**, written by `admin/upload-photo.php` at upload time from `getimagesize()`, so the component is given the real ratio instead of a guessed one. That is a data-shape change and a new admin field, i.e. a feature.
- [x] **`admin/password.php` still sleeps** ~~ Noted 2026-08-06 while shipping 4.14. It shares the per-IP throttle record and still calls `sleep(min(8, $failures - 4))` on a wrong current-password. It is behind `require_auth()` and outside PLAN-5's scope boundary ("`admin/auth.php` (throttle only), `admin/config.php` (`login_*` helpers only)"), so it was left alone. It **does** now benefit from the lock, because `login_register_failure()` routes through `login_throttle_mutate()`. Two consequences worth knowing: the sleep there is still amortised by parallelism, and six wrong current-password attempts can arm a login cool-off of up to 300 s for that IP.~~

  **SHIPPED 2026-08-07.** It now takes a slot from the same `login_attempt_gate()` the login form uses, so both surfaces share one budget and neither can be parallelised. Measured through the real form, signed in:

  | | before | after |
  |---|---|---|
  | 12 wrong-current-password submits | **31,693 ms** | **2,425 ms** |
  | of those, reaching `password_verify()` | 12 of 12 | **6 of 12** |
  | refused by the clock | 0 | **6** |
  | counter during a cool-off | kept climbing, **c 12 → 16** | unchanged |

  That last row was the real hazard and is why this was worth doing rather than
  leaving logged: under the old code an owner who mistyped and then retried
  impatiently **dug himself a deeper hole**, because every refused attempt still
  incremented the count that sets the next window. It cannot now.

  The refusal also says *"Too many incorrect current-password attempts"* rather
  than *"failed sign-in attempts"* — he is already signed in, and being told
  otherwise on the change-password page is confusing. `login_cooloff_message()`
  took an optional noun for this.

  `login_register_failure()` and `login_failure_count()` now have **no page
  callers**. They are kept, not deleted: `plan5-throttle.js`'s probe needs a
  helper that increments without refusing, in order to prove the `flock` holds
  (10 parallel calls → 10 counts; before the lock, 5). `login_register_failure()`
  carries a ⚠️ NOT FOR PAGES docblock saying so, because counting only failures
  is precisely the hole 4.14 closed. Suite: `plan5b-pwthrottle.js`, **5/10 → 10/10.**
- [x] **sitemap/dashboard** ~~`public/sitemap.xml` lists `/dashboard` with priority 0.8, alongside the nine public routes. Whether that route should be publicly indexed was never established. Noticed 2026-08-05 during Plan 1; not investigated, not changed.~~ **ESTABLISHED AND CLOSED 2026-08-07.** Measured: `/dashboard` renders the public Product Index with **41 product rows**, asks for no credential, carries its own SEO title (`Product Index — Insulation Products Corporation`), declares a self-canonical, and is not `Disallow`ed. It is a legitimate public page and a good one for a distributor — a sortable table of every SKU — so **it stays listed, unchanged.**

  Answering the question turned up the thing nobody had checked: **the sitemap listed 8 URLs while `SEO_DEFAULT` declares 9 public routes.** `/privacy` was absent — a real route with its own title, description, self-canonical and a footer link, so already crawlable, simply undeclared. Added at `yearly` / `0.3` (a legal page, not one anyone searches for). `_harness/plan5b-sitemap.js` now diffs the file against `SEO_DEFAULT`, so a tenth route cannot be added without being listed, and additionally asserts that nothing in the sitemap is `Disallow`ed by `robots.txt` and that every `<loc>` matches the canonical the page declares for itself. **8/9 → 9/9.**
- [x] **4.5** ~~Every contact-form error is a browser `alert()` — no inline error, no `aria-live`, no focus move.~~ **SHIPPED 2026-08-06 (Plan 3)** — see §1b and §4j. All four call sites replaced by one inline `role="alert"` region that is focused on failure and carries the server's own message verbatim. `grep -c "alert(" src/App.jsx` is **0**, checked literally as the plan states.
- [x] **4.12** ~~`content.php` promises the Industries SKU "must match a real product" but validates nothing against `load_products()`.~~ **SHIPPED 2026-08-06 (Plan 2)** — warns and still saves, by Keagan's decision (see §3). See §1b and §4g.
- [x] **4.13** ~~The ✕ that deletes a whole content card has no `data-confirm`, and sits 4 px from the reorder buttons.~~ **SHIPPED 2026-08-06 (Plan 2)** — measured gap was **6.0 px**, not 4 px; now 34 px. See §1b and §4g.
- [x] **4.14** ~~Login throttle uses `sleep()` (parallel connections sleep concurrently) and a read-modify-write with no lock. A long random password is the real control.~~ **SHIPPED 2026-08-06 (Plan 5)** — measured on a ten-server fleet: 10 parallel failures counted **5 of 10** before, **10 of 10** after; 12 parallel guesses took 757 ms and evaluated all 12 before, and evaluate exactly the same **6** as a serial run after. Capped at 300 s and self-clearing, and a refused attempt neither counts nor extends — the last sentence is still true: this is per-IP and the long random password is the real control. See §1b and §4k.
- [x] **4.19** ~~Product Index sortable headers have no `tabindex`, `scope` or `aria-sort`.~~ **SHIPPED 2026-08-06 (Plan 4)** — a real `<button>` inside each `th`, `scope="col"` on all seven, `aria-sort` on exactly one column, and a `:focus-visible` indicator measured ≥3:1. Verified with real Tab presses. See §1b and §4j.
- [x] **4.20** ~~Collapsed FAQ answers use `max-height:0` — still read by screen readers and find-in-page.~~ **SHIPPED 2026-08-06 (Plan 4)** — measured before: `window.find()` returned **true** on collapsed answer text and the text was in the CDP accessibility tree. Now `hidden` is applied at the end of the collapse transition, so the animation is unchanged and the answer genuinely leaves both. See §1b and §4j.
- [x] **4.21** ~~Navigation is `<button onClick>` throughout: 3–7 `<a href>` vs 14–119 `<button>` per page. No crawlable internal link graph, no Cmd-click.~~ **SHIPPED 2026-08-05 (Plan 1)** — see §1b and §4f.
- [x] **4.23** ~~Owner-set brand colors are injected with no contrast guard while headings and primary buttons hardcode `#ffffff`.~~ **SHIPPED 2026-08-06 (Plan 2)** for headings, primary buttons and the other solid brand surfaces — see §1b and §4g. **The de-emphasised text on those same surfaces is NOT covered — see `brand-ink-translucent` below.**
- [x] **brand-ink-translucent** ~~The 4.23 ink mechanism is in place but 47 translucent-white foregrounds on owner-controlled brand surfaces still hardcode `rgba(255,255,255,α)` and go invisible when the owner picks a pale color.~~ **SHIPPED 2026-08-06** — see §1b and §4h. The count was **77 inline sites plus 12 Tailwind `text-white` classes**, not 47; the original estimate came from a source scan that only looked at `rgba(255,255,255,α)` and missed both the solid `#ffffff` conditionals and the class-based colors. Measured before/after with a new empirical auditor: **357 → 274 brand-sensitive contrast failures, and zero of the remainder are white-on-a-brand-surface.**
- [x] **brand-color-as-foreground** ~~Brand colors used as *text on white or on another brand surface*~~ **SHIPPED 2026-08-06** — see §1b and §4i. **274 → 12 brand-sensitive failures**, and all 12 remaining are `brand-gradient-mixed-ends` below. ⚠️ **One visible change to the shipped design**, called out because it is not a no-op: `--brand-accent-2` used as text on white moves `#119EC8 → #0d7594`. The shipped accent measures **3.1:1 on white**, a genuine WCAG AA failure, so it could not be left alone and still called fixed — but reverting is a one-line change to `TEXT_TARGET` if the original cyan is preferred. `--brand-primary` as text (258 of the sites) is **unchanged**. Original wording kept below for the record: Brand colors used as *text on white or on another brand surface* — product feature chips, eyebrow labels, the sidebar's "PRODUCT CATALOG" / family headings, `color: "var(--brand-primary)"` and `var(--brand-accent-2)` at ~30 sites. A pale brand color makes these unreadable and the ink variables do not help: this case needs the brand color **darkened for text use**, not a foreground swapped. **Now quantified** (2026-08-06, `_harness/inkaudit.js`): **262 of the 274 remaining brand-sensitive failures** — 252 at `rgb(255,230,0)` (primary as text) and 10 at `rgb(255,247,192)` (accent as text on `--brand-dark`). This is now the single largest brand-color defect. Visible in `_harness/out/contrast/pale-yellow-1440.png` as the washed-out "UL & CUL LISTED" chips and sidebar headings. Not started.
- [x] **page-header-eyebrow-contrast** *(shipped 2026-08-07 — the close-out is at the end of this entry; the original wording and both corrections are kept above it, unedited)* Found 2026-08-06 while answering a question about `--brand-accent-text`. The small uppercase eyebrow above each page title (`"Products"`, `src/App.jsx:6615`) sits on `.ipc-page-header`, whose background is `linear-gradient(135deg, var(--brand-primary), var(--brand-accent-2))` — **a gradient, not white.** Every candidate was measured against both stops on the shipped navy palette; none reaches AA for 12 px text:

  | candidate | left stop | right stop | worst |
  |---|---|---|---|
  | `#119EC8` `--brand-accent-2` (shipped until 2026-08-06) | 2.18:1 | **1.00:1** | FAIL |
  | `#0d7594` `--brand-accent-text` (current) | 1.29:1 | 1.69:1 | FAIL |
  | `#00BEF2` `--brand-accent1-on-dark` | 3.12:1 | 1.43:1 | FAIL |
  | `#ffffff` `--brand-header-ink` | 6.79:1 | 3.11:1 | large-text only |

  The `<h1>` beside it survives on the same gradient **only because 36 px extrabold is large text**, where the AA bar drops to 3:1. The eyebrow is 12 px and needs 4.5:1. Note the pre-existing value was **1.00:1** — the accent used as text on a gradient *ending in that same accent*, i.e. invisible at the right-hand end.

  **Partly self-inflicted, stated plainly:** commit `4ab7f7f` (`brand-color-as-foreground`) changed this line from `var(--brand-accent-2)` to `var(--brand-accent-text)`. That variable is solved for **white**, so it was the wrong one for a gradient surface. It moved the worst case from 1.00:1 to 1.29:1 — still failing. **`CORRECTED` 2026-08-06 (same day):** the first write-up of this item said `_harness/fgsurfaces.js` "enumerated solid backgrounds only and skipped gradient-backed elements entirely". That is wrong, and the truth is less flattering. `fgsurfaces.js:29-31` detects a gradient and returns the string `GRADIENT`; `:87` prints `<-- GRADIENT, check by hand`. It **did** surface four gradient-backed sites during the `brand-color-as-foreground` work — the session notes even record "4 on a gradient" — and the by-hand check simply never happened. The auditor reported it; the human ignored it. A finding a tool defers to a human is a finding a tool loses, which is why the replacement scores gradients instead of describing them.

  The real fix is a design decision on the page header — darken the gradient's right stop, put the eyebrow on a solid chip, or drop the eyebrow to the same ink as the title and accept losing the two-tone. **Logged, not changed, by Keagan's decision 2026-08-06 (§3).** Affects all nine page headers.

  **`CORRECTED` 2026-08-07 — the table above is measured over the wrong extent,
  and the conclusion drawn from it is wrong.** `brandtext.js` samples a gradient
  across the **element's box**. The eyebrow's `<div>` is **1232 px wide and its
  text ink is 83 px** (7%), so 1150 px of gradient the glyphs never touch was
  being scored. Sampled under the actual glyphs the background barely moves —
  `rgb(1,99,166)` → `rgb(3,103,169)` — and **white measures 5.97–6.29:1**,
  comfortably AA at 12 px. The `#ffffff` row above reads "large-text only" only
  because it was scored to the far end of a box the eyebrow does not occupy.

  The **failure** was never wrong: the shipped colour scores 1.13–1.20 either
  way, and the eyebrow really is close to invisible. What was wrong was the
  evaluation of the **candidates**, and therefore the claim that "nothing passes
  AA there without changing the page-header design". **The fix is one line:
  white ink.** Rendered against the real page in
  `_harness/out/mockups/eyebrow-*.png` (A current, B white, C solid chip,
  D darker gradient, E removed) by `_harness/mockup-brandtext.js`.

  **This affects `brandtext.js` generally.** Any gradient-backed failure whose
  text does not fill its box is a candidate for re-measurement; anything on a
  solid background is unaffected. Measuring ink extent is the outstanding fix.

  **SHIPPED 2026-08-07 (Plan 5c), on Keagan's decision: white ink.** Measuring
  ink extent landed with it (`_harness/backdrop.js`), so the correction above is
  no longer a note — it is what the suite now does.

  Two things were found on the way in, and both changed the size of the job:

  1. **It was never one element.** The item, and every note under it, described
     the `/products` eyebrow. Scoring the whole `.ipc-page-header` block found
     the other **seven** eyebrows at `rgba(var(--brand-header-ink-rgb), 0.7)` —
     composited `rgb(179,208,228)` over the navy header — at **3.33–3.80:1**.
     They were invisible to `brandtext.js` because that suite only scores text
     painted in a *brand* colour, and a translucent white is not one. All eight
     are now a single `PageEyebrow` component.
  2. **Full opacity is the load-bearing half, not whiteness.** `--brand-header-ink`
     is recomputed by 4.23 against the *worse* stop of this gradient, so it is
     the one value here that survives a pale palette; `rgba(…-rgb, α)` hands
     that guarantee straight back. Asserted on two palettes for exactly that
     reason.

  **39 → 18** failing elements in the header block; the eyebrow's worst case
  across 9 routes × 2 viewports × 2 palettes is **5.14:1**. What remains is the
  sub-line text further down the same gradient and is a genuinely different
  problem — see `page-header-sublines-on-gradient` below. Evidence in §4l.

- [x] **brand-text-on-brand-surface** *(light half shipped 2026-08-07; the dark half is split out below as `brand-accent-on-dark-surfaces`. Original wording and the amendment kept unedited)* Found 2026-08-06 by `_harness/brandtext.js`, the gradient-aware replacement for `fgsurfaces.js`. Scoring every element that paints its own text in a brand colour against its **real** composited background gives **34 of 54 (colour × background) combinations meeting AA** — a materially different picture from the "12 remaining, all `brand-gradient-mixed-ends`" recorded in §4i, which was produced by a tool that deferred every gradient. Worst first:

  | ratio | needs | what | where |
  |---|---|---|---|
  | 1.20:1 | 4.5 | `--brand-accent-text` page eyebrow | `/products` (this is `page-header-eyebrow-contrast`, already logged) |
  | 1.69:1 | 4.5 | `--brand-accent` "Contact our team." link | `/faq`, on the header gradient |
  | 2.18:1 | 4.5 | `--brand-accent` `→` bullet glyphs, **124 elements** | `/industries`, `/services`, on **white** |
  | 2.79:1 | 4.5 | `--brand-accent-2` type chips, **41 elements** | `/dashboard`, on the pale chip tint |
  | 2.78 / 2.94:1 | 3.0 | `--brand-accent` stat figures ("ISO 9001", "25M+") | `/` hero, large text |
  | 3.13–4.46:1 | 4.5 | assorted `--brand-accent*` sub-lines | `/products`, `/industries`, `/` |

  The `→` glyphs and the type chips are the volume, and neither is a gradient case — they are plain `--brand-accent` / `--brand-accent-2` used as text on light surfaces, i.e. exactly what `brand-color-as-foreground` was meant to catch. They were missed because that work converted the sites it found by **source scan for `var(--brand-primary)` / `var(--brand-accent-2)` in a `color:` position** and these use `--brand-accent`, a variable that was never in the target list.

  Not started, and **not** a one-line change: `--brand-accent` (`#00BEF2`) is the *bright* accent and darkening it enough for white (needs ~4.5:1) moves it a long way from the brand. Options are a text-safe `--brand-accent-text-strong`, or accepting that these glyphs are decorative and giving them `aria-hidden` plus a non-brand colour. **Escalate the colour question before changing.** Baseline to beat: `node _harness/brandtext.js` → 34/54.

  **`AMENDED` 2026-08-07 — the population splits, and most of it needs no new
  colour at all.** Measured against the surfaces the text really sits on:

  | what | where | on | now | `--brand-accent-text` `#0d7594` |
  |---|---|---|---|---|
  | 124 `→` bullets | `/industries`, `/services` | **white** (solid) | 2.18 | **5.26 PASS** |
  | 41 type chips | `/dashboard` | **flat tint** (solid) | 2.79 | **4.72 PASS** |
  | ~15 accent sub-lines | `/industries`, `/products` | dark navy | 3.25–4.46 | 1.34 — needs a *lighter* accent, not darker (`#7fdcf7` → 4.54, white → 7.07) |
  | 2 hero stat figures | `/` | hero | 2.78–2.94 | large text, bar is 3.0 — marginal |

  So **165 of the failing elements are covered by a variable that already
  exists**, and `--brand-accent` itself does not move: it stays bright
  everywhere it is a background or a border, and only the *text* call sites
  change. That is the completion of `brand-color-as-foreground` — which missed
  these because it scanned for `var(--brand-primary)` / `var(--brand-accent-2)`
  and these use `var(--brand-accent)` — rather than the new design decision the
  paragraph above assumes. The dark-surface group does need a lighter
  derivative, which `textSafeOn()` already knows how to produce.

  The remaining judgement is **taste, not compliance**: the bullets go from
  bright cyan to teal. Rendered at `_harness/out/mockups/arrows-{A,B,C}-*.png`
  (current / teal / neutral grey). The chip change is imperceptible at 10 px —
  41 recoloured and the before/after is indistinguishable.

  ⚠️ Some of the *other* entries in the 34/54 sit on gradients and may be
  over-reported — see the `CORRECTED` note under
  `page-header-eyebrow-contrast`. The four rows above are all on **solid**
  backgrounds, so those numbers are accurate.

  **LIGHT HALF SHIPPED 2026-08-07 (Plan 5c). Arrow colour chosen by Keagan: teal
  (`--brand-accent-text`, `#0d7594`).** All **165** elements painting a bright
  accent as text on a light surface now use it — the 124 `→`/`✓` bullets and the
  41 type chips. Four call sites, and the fourth is the one worth recording: the
  **mobile** card's type chip, whose **desktop twin in the same table already
  said `--brand-accent-text`**. One of the pair had been converted and the other
  missed, and because only one is visible at a time a sweep at a single viewport
  finds exactly one of them.

  `--brand-accent` itself did not move: it is still the brand's bright cyan at
  all 10 background and 40 border uses measured across the sweep, and
  `plan5c-brandink.js` asserts that too — a "fix" that redefined the variable
  would turn every button and rule on the site teal and still show green on a
  text-only check. `brandtext.js` **35/53 → 35/51**: both worst combinations
  gone, not moved.

  The ⚠️ above is now resolved rather than outstanding: ink-extent sampling
  shipped with the eyebrow fix, so the gradient rows were re-measured, and the
  four solid-background rows the amendment relied on were never affected.

- [ ] **page-header-sublines-on-gradient** Found 2026-08-07 (Plan 5c) while fixing `page-header-eyebrow-contrast` — the residue that fix could not reach, with the numbers that show why it is a different problem. **18 elements**: the 16 intro `<p>` sub-lines at `rgba(var(--brand-header-ink-rgb), 0.65)` (2.25–3.14:1), the `/dashboard` header's `<strong>"View Product"</strong>`, and the `/faq` header's inline link. **The last two are already at FULL-opacity header ink and still measure 3.68:1**, which is the whole point: there is nothing left to choose. `.ipc-page-header` is `linear-gradient(135deg, var(--brand-primary), var(--brand-accent-2))` at 135°, so text further down the block sits further along the axis, and on the shipped navy the far end is `#119EC8` — where **white is 3.12:1 and dark ink is 2.72:1 at the near end**. No single ink clears 4.5:1 across that band, so this one really is the "change the page-header design" case the eyebrow was wrongly accused of being. **Pre-existing, not introduced here** — on the navy palette `rgba(ink, 0.65)` composites identically to the `rgba(255,255,255,0.65)` it replaced, and `inkaudit.js` already counted these in its 609 "fail on both palettes" bucket. The `<h1>` is unaffected: 36 px extrabold is large text and 3.11:1 clears its 3:1 bar. Options, in the order I would take them: **(a)** darken the gradient's right stop so one ink serves the whole band — this is mockup `eyebrow-D-darker-gradient.png`, already rendered against the real page, and it is a visible change to the shipped look; **(b)** raise the sub-lines to full opacity, which improves them but does **not** reach AA at 375 and costs the visual hierarchy; **(c)** accept it and record that the page-header sub-line is decorative. **Escalate before changing** — this is a design decision, not a colour pick. Held on a ratchet at 18 by `_harness/plan5c-eyebrow.js`, which lists every one on every run.
- [ ] **brand-accent-on-dark-surfaces** Split out of `brand-text-on-brand-surface` on 2026-08-07 when its light half shipped. **18 elements** paint a bright accent as text on a dark navy surface and miss AA: the Industries panel sub-lines (3.26–4.29:1), `/products`'s "UL Listed" and "PRODUCT DETAIL" labels (3.34–4.46:1), and the homepage's "BOLINGBROOK, IL" and "ISO 9001" lines. **The fix that closed the light half is the exact wrong move here**: `--brand-accent-text` is `textSafeOn(accent2, "#ffffff")`, solved for white, and on these panels it measures **1.34:1** — four times worse than what is there now. They need a *lighter* derivative (`#7fdcf7` reaches 4.54, white 7.07), which `textSafeOn()` can already produce against a dark surface; what does not exist is a decision about whether a lighter cyan is still the brand, or whether these labels should simply be white. Most are within 0.2–1.2 of the bar, so this is legibility polish, not a defect anyone will report. **Escalate the colour question before changing.** Held on a ratchet at 18 by `_harness/plan5c-brandink.js`, which lists every one on every run.
- [x] **datasheet-index** ~~Raised 2026-08-07 in the follow-up review: all 42 products carry a published PDF, 8 MB of the most search-worthy content on the site, reachable only from inside an individual product page. No index, nothing in the sitemap.~~ **SHIPPED 2026-08-07 (PLAN-7 item 3b).** `/datasheets` lists all 42 grouped by product family, filterable, ungated — no form, no email address, because gating datasheets buys lead volume at the cost of lead quality. Banner copy is owner-editable (Page Content → *Datasheets page — banner*); the route is in the sitemap with the same catalogue-derived `<lastmod>` as `/products` and `/dashboard`. Held by `_harness/plan7-datasheets.js`, **8/8**. Costs paid and re-verified: posted variable count **435 → 439**, `plan2-trunc` re-run against a real `max_input_vars=100` server (13/13) and `form_complete` still last of 439 (invariant 6); sitemap static routes **9 → 10** across `sitemap.php`, `SEO_DEFAULT`, `plan5b-sitemap` (9/9) and `plan5c-sitemap` (17/17); `sync.sh` now mirrors `pdfs/`, without which every link 404s for a reason that has nothing to do with the site. **Two things this turned up that are worth more than the page.** (1) *The footer's Quick Links could not carry it.* Adding a row to `FOOTER_LINKS` in `App.jsx` works locally and does nothing on a deployed site: `content.json` already stores the owner's own eight rows and `mergeContent` gives a stored non-empty array priority over the default (**invariant 3**), so the default is reached only by a fresh install. The link is therefore in the Products mega-menu, which is structural — reachable on day one whatever the owner has saved — with the `FOOTER_LINKS` row left as the fresh-install default and an inline comment saying why. (2) *A live broken link*, below.
- [x] **pdfUrl case mismatch — VALUE-ADDED downloads HTML** ~~Found 2026-08-07 while building the datasheet index.~~ **FIXED 2026-08-07**, on Keagan's instruction to "fix the one broken link" as part of that item. `data/products-all.json` gave `VALUE-ADDED` → `/pdfs/VALUE-ADDED.pdf`; the file on disk is `Value-Added.pdf`. On a case-sensitive filesystem the SPA rewrite answers the miss with `index.html` and a **200**, so the visitor downloaded **2,094 bytes of HTML named `.pdf`**. Identical failure class to the four `photoUrl` case mismatches under 4.32. **The reason it survived: no suite anywhere checked a `pdfUrl` at all.** `plan5-images.js` asserts every `/images/` response is a 2xx with an `image/*` content type; nothing did the equivalent for `/pdfs/`. `deadlinks.js` sounds like it would and does not — it resolves industry→SKU references in `content.json` and never makes an HTTP request. `plan7-datasheets.js` now asserts all 42, and the **content-type clause is the load-bearing half**, measured against the pre-fix URL: `200 text/html` → a status-only check *passes and misses it*, the content-type check *fails and catches it*. **The second edit ever made to `data/products-all.json`** — one line, 1 add / 1 delete, verified by `git diff --numstat`; `_harness/pristine/` was re-bootstrapped through `sync.sh`'s documented path after proving `content.json` and `site-info.json` were byte-identical first, rather than copied over (which is the laundering the design warns against). ⚠️ **Does not reach production by itself** — the deployed copy is server-owned, so the same correction must be made on the server through the admin, exactly as with the four `photoUrl` values.
- [ ] **backdrop-skips-raster-layers** Found 2026-08-07 while planning the marketing-imagery item. `_harness/backdrop.js` is the shared contrast core behind `brandtext.js`, `plan5c-eyebrow.js` and `plan5c-brandink.js`. Its layer walk calls `parseLinear(layer)` and does `if (!g) continue;` — and `parseLinear` matches `^linear-gradient\((.*)\)$`, so a **`url(...)` background layer returns `null` and is silently skipped**. The walk then composites whatever translucent layers it *did* understand over whatever sits *below* the image, and returns a contrast number for a background no visitor ever sees. **Not currently reachable** — `grep -n 'images/' src/App.jsx` returns nothing and no element on the site has a raster background, so today this is latent. It stops being latent the moment any photograph goes behind text, which is exactly what PLAN-7 item 2 proposes for the homepage hero. Recorded as its own item rather than as a line in that plan because **it is worth closing whether or not any image ever ships**: a silent skip in the one file three suites trust is the same failure mode as the box-vs-ink error that produced §2's false "nothing passes AA in the page header" claim. The fix is two parts — make the skip loud (return a flag; every existing suite fails if it ever sees one), and add a pixel primitive that screenshots the ink rect and scores against the **worst** pixel actually painted, since gradient maths cannot answer the question over a photograph. `plans/PLAN-7-marketing-imagery.md` §1.
- [ ] **marketing-imagery-unwired** Raised 2026-08-07 as item 2 of the admin-surface review, held back then for a scope decision; measured 2026-08-07 and planned in `plans/PLAN-7-marketing-imagery.md`. `src/App.jsx` contains **four `<img>` elements in 9,900 lines and three of them are the logo** — the homepage, About, Services, Industries, FAQ, Contact and Privacy pages paint no photography at all. Meanwhile `public/images/site/` holds 22 files, 1.1 MB, referenced by nothing, shipping to the server on every deploy. §2's earlier decision settled *keeping* them; it did not consider using them. **The review's framing was off in both directions and the plan corrects it.** It said "27 photographs he can't put anywhere" — opened one by one, **six are usable**: `Slide1.png`/`main-banner-*.jpg` (one scene), `staff.jpg`, `IPC-Building.jpg`, `Marker-Sample-2.jpg`, `Front-Cover.jpg`. `staff-image.png` is the same photograph as `staff.jpg` with white padding and a drop shadow baked into the pixels; the three `featured-category-*.jpg` are 360 × 162 in the **original** too; the remaining eleven are 194–350 px line drawings. It also implied photography might be needed — **it is not**: 4.32 capped unpainted files at 1000 px on the long edge, correctly, because there was no paint size to target, and the originals are intact in git at `febc0b7` (`Slide1.png` **1948 × 414**, `Marker-Sample-2.jpg` **2400 × 1600**, `Front-Cover.jpg` **1700 × 2200**). Re-deriving them at the real paint size is free. **Needs a decision** — three questions in PLAN-7 §5, the sharpest being the hero scrim: `Hero()` already stacks `rgba(20,20,20,0.72) → rgba(20,20,20,0.50)` over the brand gradient, which is a scrim, which is what you put over a photograph, so the slot was designed for one and never got it. But the 0.50 end will not carry white body text over a photo (worst case **2.67:1** for the 75 %-opacity subhead). Flattening the ramp to a constant 0.72 makes **every** ink on the hero better than it is today — headline 6.25 → 7.36, subhead 4.27 → 5.00, accent proof-stat 2.47 → 2.82 — at the cost of a flatter-looking hero. ⚠️ That last row is below 4.5 in both columns because it is `brand-accent-on-dark-surfaces` above; PLAN-7 moves it in the right direction and **must not be read as closing it**.
- [x] **brand-gradient-mixed-ends** ~~while fixing `brand-ink-translucent`. Two heading strips use a gradient running from a **hardcoded dark** color to an **owner-controlled** one — `linear-gradient(135deg, #0a2a52, var(--brand-primary))` on the product-detail header (`src/App.jsx:5885`) and `linear-gradient(135deg, #003d7a, var(--brand-primary))` on the industry section headers (`:7789`). No single ink can serve both ends: white is right over the fixed navy, dark is right over a pale primary. Left as `text-white`, which is correct for the default palette and for where the left-aligned heading actually sits, and both carry an inline comment saying so. Accounts for the last **12** of the 274 remaining failures. The real fix is a design decision — either make the fixed end `var(--brand-dark)` so one ink can serve the whole band (a visible change to the current look, `#003d7a` is notably brighter than `#0d2d52`), or stop putting text across a two-owner gradient.~~ **CLOSED 2026-08-07 (Plan 5c) — decision confirmed, not deferred again.** The escalation was made and answered: **leave both strips as they are.** The reasoning is already recorded in §3 and is unchanged by this session's measurement work — the two headings are left-aligned over the *hardcoded* dark end, where white measures 10.78:1, so the failing end of each gradient is the empty end. Option A (`var(--brand-dark)` as the fixed stop) passes at every palette but costs a visible deepening of `#003d7a → #0d2d52` on the shipped navy and turns an anchoring band into a fully owner-controlled one. A certain visual cost against a hypothetical failure. This item is closed rather than left open because re-asking a settled question every session is how the eyebrow survived two of them.
- [x] **sidebar-active-border** ~~`ProductSidebar`'s desktop product rows set `borderLeft: active ? "3px solid var(--brand-primary)" : "3px solid transparent"` and then `border: "none"` **two lines later** in the same style object. React applies the keys in order, so `border: none` wipes it: the selected product never gets its left indicator. Measured on the built bundle at 1440 px — the active row's computed `border-left-width` is `0px`. It also makes React log *"Updating a style property during rerender (borderLeft) when a conflicting property is set (border)"* on every selection change in dev. Pre-existing, **not** introduced by 4.21: identical at `HEAD:src/App.jsx:5385-5388` (`a0b07e1`), where the element was still a `<button>`; 4.21 only changed the tag. Found 2026-08-05 while converting that list; **not fixed** — out of Plan 1's scope. Current location `src/App.jsx:5488-5491`.~~

  **SHIPPED 2026-08-07.** `border: "none"` deleted; `borderLeft` and
  `borderBottom` are now the only border declarations on the row. Measured on
  the built bundle at 1440: the selected row's `border-left` went
  **`0px none rgb(0, 0, 0)` → `3px solid rgb(0, 93, 163)`**, and React's
  style-conflict complaint went **4 per selection change → 0** (counted on a
  development bundle; production strips the message, so the shipped bundle
  cannot fail that check — same reason `plan5-keys` builds its own).

  **`AMENDED` — the symptom was asymmetric, and that is what hid it.** The
  original note says the indicator is simply absent. Measured, it is absent on
  a **fresh load** and *present* after an **in-page selection change**: on a
  re-render React writes only the style keys that CHANGED, so `border` was not
  re-applied and stopped clobbering `borderLeft`. Click around the catalog and
  it works; arrive by link or refresh and it is gone. Recorded because it
  explains why the defect survived three sessions of review.

  The shorthand was **deleted rather than moved above** the longhands: the row
  has been an `<a>` since 4.21 and has no UA border to reset, and keeping a
  shorthand beside its longhand in one style object is exactly what React warns
  about. Asserted that no UA border returns on the top or right edge.

  ⚠️ **Not a pure no-op, called out because it is visible.** Restoring the
  indicator also restores the 3 px gutter the inactive rows' `transparent`
  border was always meant to reserve, so every sidebar row's text is 3 px
  narrower than it was while the bug was live. On the longest product names
  that can pull one word onto a second line — visible on `IP29CG` in
  `_harness/out/plan5b-sidebar/sidebar-1440-BEFORE.png` vs `sidebar-1440.png`.
  The transparent border is load-bearing and was kept: without it the text
  would shift sideways as the selection moves. Suite: `plan5b-sidebar.js`,
  **4/9 → 9/9**, mutation-proven by reinstating the shorthand.
- [x] **4.24** ~~`SITE_INFO_URL` / `CONTENT_URL` have no `import.meta.env.DEV` branch, so theming and content plumbing are never exercised by `npm run dev`.~~ **SHIPPED 2026-08-05 (Plan 0)** — see §1b and §4d.
- [x] **4.26** ~~Scroll listeners added inside an inline `ref` callback and never removed.~~ **SHIPPED 2026-08-06 (Plan 5)** — **`AMENDED`: they are not scroll listeners.** The only `scroll` listener in `App.jsx` was already a `useEffect` with a cleanup and `{passive:true}`; the leak was `mouseenter`/`mouseleave` on the related-product card. Measured 1 → **51** of each after 20 scroll cycles. See §1b and §4k.
- [x] **4.27** ~~Duplicate React keys reachable from the admin (`key={link.label}`, `key={f.title}`, `key={m.year}`, …). Two footer links both named "Contact" drop a row.~~ **SHIPPED 2026-08-06 (Plan 5)** — **`AMENDED`: the row is not dropped.** On the shipped production bundle both links render with their own hrefs and both navigate correctly; so do two same-year milestones and two identically-titled services. The real, measurable defect is **53 `console.error`s** across 9 routes + 3 product pages on a development bundle, now **0**. See §1b and §4k.
- [x] **4.29** ~~`IP75AD`, `VALUE-ADDED`, `VT-1100` have `rows: []` and render an empty bordered table with an invalid `<thead><tr></tr></thead>`.~~ **SHIPPED 2026-08-06 (Plan 5)** — the empty panel measured **391 × 508 px** on IP75AD at 1440. Nothing is rendered now, wrapper included, and the layout collapses to one column. 3/13 → 13/13. See §1b and §4k.
- [x] **4.30** ~~`spectable-editor.js` blows away focus on every structural change; all remove buttons share `aria-label="Remove row"`.~~ **SHIPPED 2026-08-06 (Plan 4)** — focus was measured landing on `body`; it now lands on the new row (add) or the nearest survivor (remove). **21 remove buttons shared 3 names**; all are distinct now, and a polite live region announces the change. See §1b and §4j.
- [x] **4.31** ~~`content.php` renders 418 unlabelled form controls.~~ **SHIPPED 2026-08-06 (Plan 4)** — **`AMENDED`: the precise figures are 418 controls with zero `for`/`id` association, of which 397 had no accessible name at all** (the remaining 21 were named by their placeholder). All now labelled, ids unique and stable across reordering, sections are `<fieldset>`/`<legend>`. **Posted variable count unchanged at 421 — the plan's "423" was itself an over-count.** See §1b and §4j.
- [x] **4.32** ~~9.3 MB of unoptimised images (`Front-Cover.jpg` 1.5 MB, `VALUE-ADDED.png` 683 KB, …).~~ **SHIPPED 2026-08-06 (Plan 5)** — 9,357,354 → 2,668,995 bytes, `du -sh` **9.1M → 2.7M**, largest file 198,726 B, zero over 300 KB, no filename changed, no crop, no retouch. `AMENDED`: the measured total was 9.1 MB / 9,357,354 bytes, not 9.3 MB. Original wording and the earlier partial note kept below for the record. **PARTIALLY SHIPPED 2026-08-05:** the second half of this item — "served `immutable, max-age=31536000`, so an FTP'd photo fix won't reach returning visitors for a year" — was misfiled here as an image-weight problem. It was a mis-scoped `FilesMatch` in `public/.htaccess` with no path restriction, and it is fixed (NB1). **The image-weight work remains open.**

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

### Decisions taken 2026-08-06 (Plans 3–4 session, on the brand-color questions)

- **`--brand-accent-text` stays at `#0d7594`.** The shipped `#119EC8` measures
  **3.11:1** on white and **2.71:1** on the Product Index chip tint — below AA at
  all four sites where the variable is actually used. Keeping the derived value
  fixes 45 occurrences; the visible change is a slightly deeper blue on the About
  service-card sublines, the type chips and the sidebar arrows.
  (Comparison rendered in `_harness/out/accent-side-by-side.png`.)

- **`brand-gradient-mixed-ends` is NOT being changed.** Measured at a pale
  palette, the failing end of both strips is the **empty** end: the heading and
  sub-line are left-aligned over the hardcoded navy, where white stays at
  10.78:1. Option A (make the fixed end `var(--brand-dark)`) passes at every
  palette — 14.54:1 worst at pale yellow — but costs a visible deepening of
  `#003d7a → #0d2d52` on the shipped navy and turns the strip into an entirely
  owner-controlled band that stops anchoring the page at a light palette.
  Judged a certain visual cost against a hypothetical failure.
  (Rendered at both palettes in `_harness/out/gradient-{navy,pale}-compare.png`.)

  > **CONFIRMED 2026-08-07 (Plan 5c).** Re-put to Keagan alongside the other
  > five open brand items and settled: the decision stands, and the §2 entry is
  > closed against it rather than left open re-asking the same question. Note
  > the ink-extent correction does **not** apply here — it moved the eyebrow's
  > numbers because that text occupies 7% of its box; these two headings are
  > left-aligned over the *hardcoded* end, which is the end the original
  > measurement already said they sit on, and white there is 10.78:1.

- **`page-header-eyebrow-contrast` is logged, not fixed** — see §2. Nothing
  passes AA there without changing the page-header design, so it is not a colour
  pick.

  > **SUPERSEDED-BY 2026-08-07:** the second sentence is wrong, and it was wrong
  > because of a measurement error, not a judgement call. `brandtext.js` scored
  > the gradient across the eyebrow's 1232 px **box** while the glyphs occupy
  > 83 px of it. Sampled under the actual ink, full-opacity `--brand-header-ink`
  > measures **5.14:1 at its worst** across 9 routes × 2 viewports × 2 palettes.
  > It *was* a colour pick, it was a one-line one, and it shipped 2026-08-07 —
  > see §1b and §4l. What genuinely cannot be fixed by picking a colour is the
  > **sub-line** text further down the same gradient, which is now its own item
  > (`page-header-sublines-on-gradient`) with the numbers that show why.

- **The harness code is now tracked.** `.gitignore` no longer ignores
  `_harness/` wholesale; it ignores `_harness/site/`, `_harness/pristine/` and
  `_harness/out/`. Rationale and bootstrap in `_harness/README.md`.

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

## 4i. Verification evidence for `brand-color-as-foreground` (2026-08-06)

**Base:** `727bd60`. **Build:** 0 errors, **330.95 kB JS / 21.51 kB CSS**.

### Result

```
BRAND-SENSITIVE (pass on navy, FAIL on pale):  274  ->  12
pre-existing, fail on both (NOT this item):    556  (from 609)
```

All **12** remaining are `brand-gradient-mixed-ends`, already recorded in §2 and
awaiting a design decision. Across the two brand-color items this session the
figure went **357 → 12**.

### The surfaces were measured, again, and again it mattered

`_harness/fgsurfaces.js` renders every route and reports what background each
brand-colored *text* element actually sits on. `--brand-primary` as text was
uniform — 217 on white, 28 on `#f5f7fa`, 13 on `#f8fafc`, all light — so one
variant serves all 49 source sites. `--brand-accent-2` was not:

```
--brand-accent-2 on rgb(10, 34, 64)    48   <- the footer's hardcoded #0a2240
--brand-accent-2 on rgb(255, 255, 255) 44
--brand-accent-2 on rgb(13, 45, 82)    10   <- --brand-dark
--brand-accent-2 on GRADIENT            4   <- left alone
```

Three backgrounds needing **opposite** adjustments, from ten source sites that
all read `color: "var(--brand-accent-2)"`. A source-level swap would have
lightened the ones that needed darkening.

### Three mistakes, all caught by re-measuring

1. **Backgrounds recoloured.** A patch keyed on `: "var(--brand-primary)",` also
   matched `background: "var(--brand-primary)",` — 28 background declarations
   became the *darkened text* color. The audit caught it instantly as
   `rgb(20,20,20)` text on `rgb(128,115,0)`, 47 occurrences. Reverted.
2. **No headroom.** Solving for exactly 4.5:1 on white gave **4.48:1** on
   `#f5f7fa` — page copy does not sit only on pure white. `TEXT_TARGET = 5.0`
   for the white-background variants covers the near-white tints.
3. **Headroom applied where it hurt.** Carrying that 5.0 to the *dark*-surface
   variants moved `--brand-accent-on-dark` from `#119EC8` to `#12a9d6` for no
   reason — on a dark background the surrounding tints are lighter, so they give
   *more* contrast. Split into `DARK_TARGET = 4.5`.

A line-number table also went stale mid-session when the helpers were added, so
the accent mapping is keyed by **ordinal** with an asserted count rather than by
line.

### What moves in the SHIPPED palette — stated plainly

`_harness/derived.js` prints every derived variable per palette:

```
── shipped navy
   --brand-primary-text       #005DA3    = unchanged (no-op)
   --brand-accent-text        #0d7594    <- MOVED from #119EC8
   --brand-accent-on-dark     #11a2cd    <- MOVED from #119EC8
   --brand-accent-on-footer   #119EC8    = unchanged (no-op)
   --brand-accent1-on-dark    #00BEF2    = unchanged (no-op)
```

- `--brand-primary-text` — **unchanged**, and it covers 258 of the ~300
  rendered occurrences, so the bulk of the site is untouched.
- `--brand-accent-on-dark` — moves 3 RGB points; `#119EC8` on `#0d2d52`
  measures **4.36:1**, just under AA. Imperceptible.
- `--brand-accent-text` — **the one visible change.** `#119EC8` on white is
  **3.1:1**, well under AA, so it darkens to `#0d7594`. This is a genuine
  pre-existing accessibility failure being fixed, not a styling preference, but
  it *is* a change to the shipped design and is flagged for the owner rather
  than slipped in. Reverting is a one-line change to `TEXT_TARGET`.

`_harness/out/navy-after/` holds home, industries and about at 1440 under the
shipped palette for review.

### Regression

```
php -l 18/0 · node --check 9/0 · JSON 17/10/42 · copy drift 96 matched
invariants 17/17 · invariants-selftest 15/15 · contrastparity 28/28
copyroundtrip 15/15 · plan2-sku 14/14 · plan2-delete 18/18
plan2-contrast 42/42 · plan2-formlast 8/8
```

`data/` byte-identical to pristine.

---

## 4j. Verification evidence for Plan 3 — lead capture (2026-08-06)

Items **4.5** and **4.15b**. Every defect here costs a sales enquiry, so both
suites were written and shown to **fail** before either file was touched.

### The suites failed first

```
plan3-contact    1/46      (the only pass: "cf.networkError is readable")
plan3-autoreply  7/10
```

`plan3-contact`'s failures were not "no element found" noise — Playwright
**captured the dialogs**, which is what proves the suite was driving the real
code path rather than a selector that never matched:

```
FAIL rfq@1440: no browser alert() raised
   → raised: ["Name and a valid email address are required."]
```

`plan3-autoreply`'s three failures were exactly the defect, and the seven
passes were the things that **must not break** — so they were guarding the fix
from the start, not scored after it:

```
FAIL gmail: the four spellings collapse to ONE cap key   → distinct cap files: 4
FAIL gmail: exactly 3 auto-replies went out              → all four were replied to
FAIL gmail: the 4th spelling was refused an auto-reply   → ca.pa@gmail.com autoReplied=true
ok   gmail: the SALES NOTIFICATION fired for every submission
ok   inquiries.jsonl records every address EXACTLY as submitted
```

### Two harness pieces this needed

- **`_harness/fakemail.sh` + `php-mail.ini`.** `mail()` cannot succeed in the
  container, and `contact.php` **exits 500 at the "mail server could not send"
  branch, which is above the auto-reply cap** — so 4.15b was untestable end to
  end until `sendmail_path` was pointed at a capturing stub that exits 0. The
  stub logs the full message, headers included, so every `To:` is assertable:
  that is how "the sales notification fired for every submission" is measured
  rather than assumed.
- **Bypassing the browser's own validation.** The forms carry `required`, so
  Chrome blocks the submit and the server's message never comes back. The suite
  sets `form.noValidate` to reach the server path — a state real submissions do
  reach (an older browser, a paste-then-submit, a direct POST).

### After

```
plan3-contact    51/51     (both forms × 1440 and 375)
plan3-autoreply  10/10
```

`plan3-contact` asserts, per form per width: no dialog raised, an inline
`role="alert"` region present **and visibly rendered**, the server's exact
string, focus landed inside it, the spec string as a **text node with zero
element children** (`&lt;1/4` in the DOM, nothing parsed as markup), the network
message distinct and machine-distinguishable via `data-error-kind`, and the
panel's own measured contrast ≥4.5:1.

### Three things worth recording

1. **The escaping assertion was mis-scoped first.** It tested `innerHTML` of the
   whole region, which legitimately contains the decorative `<svg>` — so it was
   really asserting against the icon. Re-scoped to the message node and made
   strictly stronger: `children.length === 0` plus the escaped text. A test that
   fails for the wrong reason is not evidence.
2. **`grep -c "alert(" src/App.jsx` was 4 after the fix — all four in the new
   comments explaining it.** The defect was gone, but the plan's acceptance is a
   literal grep, so the comments were reworded to avoid the token and the suite
   now checks **both** the literal count and a stricter call-site regex.
3. **A comment added a CSS rule to the shipped bundle.** The first draft of the
   `outline: none` comment contained the bare word for a focus indicator, which
   is also a Tailwind utility; the extractor scans **raw file text, comments
   included**, and emitted a `.ring` rule — CSS grew 21.51 → 21.82 kB. Caught by
   diffing the emitted selectors rather than trusting the build summary. The
   replacement comment mentioned the token again and reproduced it. Now worded
   around, and the bundle is **byte-identical** to the pre-change CSS
   (`index-CM7Qbeyx.css`, 21.51 kB, added: none / removed: none) — i.e. the
   whole of 4.5 ships **zero** new CSS. This is a live hazard for anyone writing
   prose in `src/App.jsx`.

### `dist/contact.php` parity

`cmp public/contact.php dist/contact.php` silent after the rebuild, as the plan
requires — `dist/contact.php` is what actually ships.

### Regression

```
php -l 18/0 · node --check 9/0 · JSON 17/10/42 · copy drift 96 matched
invariants 17/17 · invariants-selftest 15/15 · contrastparity 28/28
copyroundtrip 15/15 · copydrift-selftest 5/5 · skuparity 33/33
plan2-sku 14/14 · plan2-delete 18/18 · plan2-contrast 42/42
plan2-formlast 8/8 · plan2-formlast-selftest PASS · plan2-trunc 13/13
plan3-contact 51/51 · plan3-autoreply 10/10 · deadlinks 0 of 18 dead
build: 0 errors, 331.91 kB JS / 21.51 kB CSS
```

`data/`, `pdfs/` and `uploads/` byte-identical to pristine and untouched in git.

### `[UNVERIFIED]`

- The auto-reply cap is exercised against `sys_get_temp_dir()` under `php -S`.
  On the shared Network Solutions host the temp dir is real but may be swept on
  a schedule unknown to this repo; a sweep resets the cap window early. That was
  already true of the pre-existing cap and is not changed by 4.15b.
- `mail()` itself is stubbed. What is verified is **who contact.php addresses
  and in what order**, not that Network Solutions delivers it.

---

## 4j. Verification evidence for Plan 4 — accessibility (2026-08-06)

Items **4.31**, **4.30**, **4.19**, **4.20**. Two audiences: Rick on the admin
(4.31, 4.30) and a buyer using assistive technology on the public site (4.19,
4.20). Both suites were written and shown to **fail** before any file changed.

### The suites failed first

```
plan4-public   8/23   ->  27/27
plan4-admin    9/16   ->  19/19
```

The pre-fix failures are the defects themselves, measured rather than inferred:

```
FAIL 4.20: find-in-page does not match a collapsed answer  -> window.find() returned true
FAIL 4.20: a COLLAPSED answer is absent from the accessibility tree
FAIL 4.19: every <th> has scope="col"                      -> 0/7
FAIL 4.19: aria-sort is present on exactly ONE column      -> found 0
FAIL 4.31: every control has an id                         -> 0/418
FAIL 4.31: ZERO controls without an accessible name        -> 397 of 418 unnamed
FAIL 4.31: no two controls share an accessible name        -> "One item per line" x21
FAIL 4.30: removing a row puts focus on a surviving neighbour -> activeElement = body
FAIL 4.30: no two remove buttons share an accessible name  -> 21 buttons, 3 distinct names
```

### Accessible names are read from the AX tree, not from the markup

Every name assertion goes through CDP `Accessibility.getFullAXTree`. This is not
a detail: content.php **already had 418 `<label>` elements**, so any check that
inferred a name from "is there a label nearby" would have reported the page
fully labelled while 397 controls were anonymous. The tree is the only thing
that knows a `<label>` without `for` labels nothing.

The same reasoning drove the 4.20 method. Playwright's own visibility heuristic
calls a zero-height element hidden, so `toBeHidden()` would have **passed
against the bug**. The tree and `window.find()` — which matches
clipped-but-rendered text and not `display:none` text — are what actually
distinguish "invisible" from "not exposed".

### Two measurement corrections

- **The plan says `content.php` posts 423 variables. It posts 421.** Asserted as
  measured. This is the same over-count the §2 `NB-copy` note already corrected
  once; the figure that matters is unchanged before and after this work, which
  is the check that stops 4.31 from breaking B1.
- **"418 unlabelled controls" is two different true statements.** 418 have no
  `id`/`for` association; **397** have no accessible name. The other 21 were
  named by their `placeholder`, which browsers accept as a last-resort name and
  which is not a label.

### The riskiest part of 4.31, and how it was proven

`content-editor.js` renumbers every field name on add, remove and reorder. The
`id`, the label's `for` and the visually-hidden row text all have to move with
it — **a stale `for` is worse than no label at all**, because it points a screen
reader at a control in a different row. So the suite mutates the live form (add
a row, then move it up) and re-checks id uniqueness, `for` correctness and the
row text. That assertion was then mutation-tested against the mirror:

```
MUTANT (for-attribute not updated):
  FAIL 4.31: every label[for] still points at ITS OWN control after a reorder
      -> 6 labels point elsewhere
RESTORED:
  ok   4.31: every label[for] still points at ITS OWN control after a reorder
```

### The Tailwind prose hazard, twice more

`.grow` appeared in the shipped CSS from a **variable name** (`grow`/`setGrow`)
— Tailwind's extractor scans raw source text, and a bare identifier that is also
a utility class emits that rule. Renamed to `expanded`. The comment written to
explain it then reproduced the bug by containing `.grow{flex-grow:1}` literally,
exactly as the `.ring` comment did in §4j's predecessor. Final emitted-selector
diff against the committed baseline:

```
ADDED:   .ipc-sort-btn, .ipc-sort-btn:focus-visible
REMOVED: none
```

i.e. the only new CSS in this plan is the two rules 4.19 actually needs. **Never
write the literal utility name in `src/App.jsx`, in code or in prose.**

### A flaky harness condition, fixed rather than retried

`plan2-formlast-selftest` failed once, at step 3 (restore the mirror, expect
green). Cause: `opcache.revalidate_freq = 2`. The restore landed inside the
two-second window and PHP served the **still-mutated bytecode** — the suite was
measuring the previous file. Not a regression from this work. All three harness
inis now set `opcache.revalidate_freq = 0`; three consecutive clean runs.

### Deliberately beyond the letter of the plan

The plan scopes 4.31 to labelling form controls. The row `↑ ↓ ✕` buttons are not
form controls, but eighteen buttons all named "Move up" is the same defect, so
they carry row identity too — and `render_copy_field`'s labels carry their group,
because eight boxes called "Title" in a "list all form fields" view are as
ambiguous as eighteen called "Icon" (a `<legend>` reaches the tree as the group,
which that view does not announce). None of it posts a variable.

### Regression

```
php -l 18/0 · node --check 9/0 · JSON 17/10/42 · copy drift 96 matched
invariants 17/17 · invariants-selftest 15/15 · contrastparity 28/28
copyroundtrip 15/15 · copydrift-selftest 5/5 · skuparity 33/33
plan2-sku 14/14 · plan2-delete 18/18 · plan2-contrast 42/42
plan2-formlast 8/8 · plan2-formlast-selftest PASS · plan2-trunc 13/13
plan3-contact 51/51 · plan3-autoreply 10/10
plan4-public 27/27 · plan4-admin 19/19 · deadlinks 0 of 18 dead
build: 0 errors, 332.61 kB JS / 21.78 kB CSS
admin/content.php: 0 horizontal overflow at 1440 and 375
```

`data/`, `pdfs/` and `uploads/` byte-identical to pristine and untouched in git.
4.30's round-trip does save; it restores the mirror from `_harness/pristine` and
proves byte-identity with `cmp` as its own final assertion.

### `[UNVERIFIED]`

- No real screen reader was run. Every claim here is about the accessibility
  **tree** and about focus, which is what the tree is built from — but NVDA and
  VoiceOver each have their own announcement rules, and "the name is correct"
  is not the same as "it reads well aloud".
- `:focus-visible` behaviour is Chromium's. Firefox and Safari apply their own
  heuristics for when a programmatic focus counts as keyboard-initiated.

---

### §4k — Plan 5 (2026-08-06): 4.27, 4.29, 4.26, 4.14, 4.11b, 4.32

Every suite was written first and run against the unmodified tree; the failing
numbers are the left-hand column throughout. Two of the six items' stated
evidence did not reproduce as written, and that is recorded here rather than
quietly worked around.

#### Regression baseline, before and after

Identical, and green in both columns except where a Plan-5 suite is new:

```
                          before      after
php -l                    18 / 0      18 / 0
node --check               9 / 0       9 / 0
JSON parse            17/10/42    17/10/42
copy-key drift              96          96
invariants               17/17       17/17
invariants-selftest      15/15       15/15
contrastparity           28/28       28/28
copyroundtrip            15/15       15/15
copydrift-selftest         5/5         5/5
skuparity                33/33       33/33
plan2-sku                14/14       14/14
plan2-delete             18/18       18/18
plan2-contrast           42/42       42/42
plan2-formlast             8/8         8/8   + selftest PASS
plan2-trunc              13/13       13/13
plan3-contact            51/51       51/51
plan3-autoreply          10/10       10/10
plan4-public             27/27       27/27
plan4-admin              19/19       19/19
deadlinks           0 of 18 dead  0 of 18 dead
brandtext                34/54       34/54   (logged open item, did not drift)
plan5-keys                  --       11/11   (10/11 pre-fix, phase A at 53 errors)
plan5-spectable           3/13       13/13
plan5-listeners             --       11/11   (mutation-proven)
plan5-throttle            3/12       12/12
plan5-social              9/19       31/31
plan5-images                --       12/12
```

`data/`, `pdfs/` and `uploads/` are byte-identical to `_harness/pristine/`
(`cmp` clean on all three) and `git status --porcelain data pdfs uploads` is
empty. The emitted CSS selector set went **320 → 323**: exactly
`.ipc-social-link` and its `:hover` and `:focus-visible`, nothing else — the
Tailwind extractor picked up nothing from the new comments, which is the trap
that has bitten twice before.

#### 4.27 — what the item said, and what is actually true

The plan's evidence says two footer links both named "Contact" "silently drop a
row". **Measured on the shipped production bundle, that does not happen.** Both
render, both keep their own `href`, clicking the second lands on `/about`; two
milestones in the same year both render; two industry cards with the same name
both render; expanding one of two identically-worded FAQ rows opens the one
that was clicked. React 18 tolerates these lists better than the folklore.

What is real is the console — and the answer to the item's open question is
that React emits it as **`console.error`**, not `console.warn`:

```
Warning: Encountered two children with the same key, `%s`. Keys should be
unique so that components maintain their identity across updates. Non-unique
keys may cause children to be duplicated and/or omitted — the behavior is
unsupported and could change in a future version.
```

That has a consequence worth stating plainly: **the shipped bundle is a
production React build, which strips the message entirely.** A console sweep
over the real bundle therefore sees an empty console whether or not the defect
is present — a check that cannot fail. `_harness/vite.devreact.js` exists so it
can: a production-shaped build that links development React. Against an
adversarial `content.json` that collides every owner-editable list the way
`content.php` allows:

```
9 routes + 3 product pages     before  53 duplicate-key console errors
                               after    0
```

23 key sites changed. Three of them — `stats`, `milestones`, `privacySections`
— were missed on the first pass because their `.map` already took an index
parameter and so were not in the batch that needed one added. They were caught
by the suite reading **53 → 4**, not by re-reading the diff.

#### 4.29 — the empty spec table

```
                                        before   after
<tr> with no cells, 42 product pages         3       0
<table> with no data rows                    3       0
empty bordered panel at 1440          391x508,   none
                                      391x277,
                                      391x507
plan5-spectable                           3/13   13/13
```

The control product's screenshot (`IP52EC-1440.png`) is **byte-identical**
before and after — 450,282 bytes both times. IP75AD's page got 147 px shorter
and its surviving spec table now uses the full width.

**A mistake worth recording:** the first draft of the empty-box check ran at
375 px, where the single-column grid gives `h-full` nothing to stretch against
and the panel collapses to 0 px high — it **passed against the unfixed code**.
It runs at 1440 now, which is where the box is actually visible. A second
draft's milestone check used `/^(19|20)\d\d$/` and reported "3 of 7 rendered",
which looks exactly like the dropped-row defect this plan is about; the shipped
milestones are `1980s`/`1990s`/`2000s`/`2010s` as well as `1974`/`2024`. The
code was fine, the assertion was wrong.

#### 4.26 — not scroll listeners

`App.jsx` contained exactly one `scroll` listener and it was **already** a
`useEffect` with a cleanup and `{passive:true}`. The leak was the
related-product card's "View →" glyph attaching `mouseenter`/`mouseleave` to
its parent `<button>` from inside an inline `ref={(el) => …}`. The mechanism
4.26 describes is exactly right — an arrow function written in the markup is a
new identity every render, so React tears the ref down and sets it up again on
each pass, and nothing removed the previous pass's work.

`ProductDetail` re-renders whenever the sticky quote bar crosses its scroll
threshold, so scrolling a product page is what drives the accumulation.
Counted over CDP `DOMDebugger.getEventListeners` on ONE card
(`/products?productId=IP29CG`, 1440):

```
after first mount          {"click":1,"mouseenter":1, "mouseleave":1}
after 20 scroll cycles     {"click":1,"mouseenter":51,"mouseleave":51}
after the fix              {"click":1,"mouseenter":1, "mouseleave":1}
```

React's own `onMouseEnter`/`onMouseLeave` props are delegated to the root
container and never appear on the element, so every pointer listener counted
here is one this code attached by hand. Proven able to fail: the inline `ref`
was reinstalled, rebuilt, and the check went red at 1 → 51, then restored.

`{passive:true}` was considered and deliberately not applied to the two new
listeners — it only relaxes scroll-blocking and these are pointer events.
Neither handler calls `preventDefault()`; the one genuine scroll listener has
carried `{passive:true}` all along and the suite asserts it still does.

#### 4.14 — why the harness had to grow a fleet

**Neither fault is observable on the harness as it stood.** One `php -S`
answers one request at a time, so there is no read-modify-write to interleave
and no two connections to sleep concurrently. Run against `:8123` the UNFIXED
code scores "10 parallel failures produce 10 counts" and "serial and parallel
take the same time" — both green, both worthless. `PHP_CLI_SERVER_WORKERS` was
tried and is not enough either: measured, 8 workers served 8 concurrent
`sleep(2)` requests in **6 s**, about three at a time. Ten independent `php -S`
instances over one docroot — and therefore one `.login-throttle.json`, which is
what the lock protects — served the same load in **2.1 s across 10 PIDs**.

```
                                   before                after
10 parallel failed attempts    counted  5 of 10     counted 10 of 10
12 serial guesses              30,681 ms, 12 eval    1,368 ms, 6 eval
12 parallel guesses               757 ms, 12 eval      364 ms, 6 eval
plan5-throttle                       3/12                12/12
```

The two runs now evaluate **the same number of guesses**. That is not just the
lock: the first version counted *failures* under the lock, which still let a
cold-start burst through, because every connection reads "none so far" before
any of them writes. `login_attempt_gate()` takes a slot on **entry**, and the
decision and the increment happen inside the same `flock`, so simultaneous
connections queue and only the ones inside the free allowance ever reach
`password_verify()`.

Shape: 5 free attempts, then 15 s, 30 s, 60 s, 120 s, 240 s, capped at
**300 s**, enforced by a stored timestamp rather than by sleeping. The record
still expires after the existing 15-minute window.

**Not stranding Rick was the binding constraint, not the brute-force bound.**
There is no "forgot password" email and the recovery path is FTP, so an attempt
made *during* a cool-off is refused without being counted and without extending
the window — hammering Reload cannot dig a deeper hole. Demonstrated: the
correct password is refused during the window (no oracle) and works the moment
it passes.

The comment at `auth.php:49-54` was rewritten **only where it became untrue**.
It still says, in as many words, that this is per-IP so a distributed attacker
is unaffected and that the long random password is the actual control. That did
not change and is not claimed to have.

#### 4.11b — footer social icons

```
                                        before   after
plan5-social (1440 and 375)               9/19   31/31
```

All ten pre-fix failures were "this does not exist". Measured after: five icons
each linking to exactly the configured URL; accessible names read from the real
AX tree, 5/5; `target="_blank"` with `rel="noopener noreferrer"` on all five;
two cleared → exactly three icons with steps of `[48, 48]` between them for
40 px icons at an 8 px gap; **all five cleared → the container is absent from
the DOM**, and JSON-LD omits `sameAs` entirely. The focus ring is driven by
**real `Tab` presses** — Chromium will not match `:focus-visible` for
programmatic focus, so `el.focus()` would report a working indicator as absent.

**Two of my own assertions were wrong and are recorded in the suite.** The
contrast check fed the `rgba()` string straight into the luminance helper,
which takes the first three numbers and drops the alpha — it scored plain white
on navy and reported **15.96:1** for a colour that is nothing like white.
Composited properly (55% white glyph over a 6% white chip over the footer's
`#0a2240`) it is **5.19:1**, which matches the hand calculation. And the
"no gap" check measured the **row's** width; the row is a block-level flex
container and stretches to the footer column whether it holds three icons or
five, so its width says nothing.

No heading was added above the row, deliberately: every other footer heading is
a `copy` key that must exist on both sides of the content contract, so adding
one means a new field in `admin/content.php` and a change to the **421** posted
variables the `max_input_vars` sentinel is asserted against. Confirmed
unchanged — `plan2-formlast 8/8`, `plan2-trunc 13/13`.

#### 4.32 — image weight

```
du -sh public/images            before  9.1M      after  2.7M
  public/images/products                4.9M             1.7M
  public/images/site                    4.3M             1.1M
exact bytes                       9,357,354        2,668,995   (-71.5%)
largest single file               1,520,217          198,726
files over 300 KB                         7                0
file count / names                       60               60   (diff empty)
```

Three measurements drove the whole thing, and none of them was a guess:

1. **Every product photo is painted at most 390 × 260 CSS px**, at 1440 *and*
   375 (`_harness/imgsizes.js`, all 9 routes + all 42 product pages). So 800 px
   on the long edge is already 2× for a retina display, and `CC.jpg` at
   2252 × 1784 was carrying about 8× the pixels it can ever show.
2. **27 of the 60 files are painted on no route at all** — the whole of
   `images/site/`. They were re-encoded, not deleted (see §2).
3. **Every product PNG's alpha channel is fully opaque** (`_harness/imgalpha.js`:
   min alpha 255, 0.0% translucent on all 23). They are 32-bit RGBA
   photographs whose fourth channel does nothing, which is most of why a
   340 × 260 image weighed 190 KB. Only `site/staff-image.png` has real
   transparency, and it keeps its alpha.

Format is pinned by the filename, so a `.png` photograph could not become a
`.jpg`; for those, dropping the dead alpha and quantising to a palette was the
whole budget, which suits these images because they are a product on a plain
sweep and genuinely hold few colours.

**Quality was not asserted by eye.** Every output is PSNR-scored against its
original *at the output resolution*; painted product photos are held to a
**38 dB** floor (worst shipped: **38.1 dB**), never-painted files to 35, and a
file that cannot clear its floor even at q95 keeps its original — which is why
`featured-category-3.jpg` (best 33.1 dB), `IP17TW-IP18SW-IP19LW.jpg` (31.4) and
`header-logo.jpg` (32.3) are untouched, along with a dozen small JPEGs whose
re-encode came out *larger*.

As **rendered**, before-vs-after full-page screenshots score **53–60 dB** on the
product pages, with 0.02–0.10% of pixels differing by more than 8/255. The
worst page in the set is `IP33PO` at 375 (35.8 dB); cropped to the photo and
enlarged 3× with nearest-neighbour, the two are indistinguishable — the blue
tubing, the black cable braid and the fabric texture all survive, with no
banding, blocking or colour shift. Screenshots at 1440 and 375 for every page
carrying a changed image are in `_harness/out/plan5-images/{before,after}/`,
with the crop at `IP33PO-375-sidebyside.png`.

**A PSNR mistake, recorded because it nearly cost the item.** The first version
compared at the **original** resolution, scaling the output back up to meet it.
That measures the resampling, not the encoding: `CC.jpg` went 2252 × 1784 →
800 × 634 and scored 36.5 dB purely because 800 px of detail cannot be
re-inflated to 2252 px, and **21 files were flagged as degraded when most were
nothing of the kind**. Deliberately downscaling to a size the page never paints
above is the *point* of the item; what has to be policed is loss at the size
that actually ships.

`sharp` did the re-encoding and is **not** a new dependency: installed with
`--no-save`, absent from `package.json`, used once, outputs committed. No image
CDN and no build-time plugin were added, per the scope boundary.

Also under 4.32, from the fold measurement: the product detail photo carried
`loading="lazy"` while sitting **above the fold at 1440** (top 490 in a 900 px
viewport). It is the product page's largest contentful paint, which is exactly
what the item says not to lazy-load, so it is now eager; the footer logo, below
the fold on every route (top 2075 on the shortest page, 5218 at 375), is now
lazy. `public/` ↔ `dist/` image parity confirmed by `diff` on names and sizes.

#### Things this plan did not do

- **The four case-mismatched `photoUrl`s were not fixed in the plan itself** —
  both available fixes are forbidden by the scope boundary, so they were logged
  in §2 with the `curl` evidence and pinned in `plan5-images.js`. **Keagan then
  instructed the `photoUrl` fix directly; see the follow-up block below.**
- **The 27 unreferenced images are not deleted.** Logged in §2 — some are the
  customer's photography and this may be the only copy.
- **The product photo still has no `width`/`height`.** A fixed ratio would crop
  photos that currently fit. Measured cost: CLS 0.021 at 1440, 0 at 375. In §2.
- **`admin/password.php` still sleeps.** Outside the scope boundary. In §2.
- **`brandtext` is still 34/54.** Untouched, as instructed, and did not drift.
- Several PLAN-5 acceptance lines name suites lost with the old harness —
  `sweep.js`, `nb4.js`, `b2.js`, `overflow.js`, `ttl.js`, `adminsweep.js`. They
  were not faked. What each item actually needed was built under its own name
  (`plan5-keys`, `plan5-spectable`, `plan5-listeners`, `plan5-throttle`,
  `plan5-social`, `plan5-images`), and the coverage those names stood for —
  console cleanliness across every route, the NB4 cleared-field behaviour,
  375 px overflow across all 42 product pages, the admin login path — is inside
  them.

#### Follow-up, same day: the four `photoUrl` values (owner-instructed)

Keagan's call, overriding the standing prohibition on editing `data/*.json`.

```
                                        before   after
local photoUrls resolving to a file      33/37    37/37
product pages painting a real photo      33/42    37/42   (5 placehold.co, unchanged)
/images/ responses that are not image/*      4        0
plan5-images                             12/12    12/12
```

`diff` against the pre-edit copy shows **exactly four changed lines** and
nothing else:

```
1040  "/images/products/IP12GA.jpg"       -> "/images/products/ip12ga.jpg"
5715  "/images/products/IP52EC.png"       -> "/images/products/ip52ec.png"
6587  "/images/products/IP63ES.jpg"       -> "/images/products/ip63es.jpg"
7160  "/images/products/VALUE-ADDED.png"  -> "/images/products/value-added.png"
```

Served and decoded, measured through the mirror: `ip12ga.jpg` 200 image/jpeg
8,541 B; `ip52ec.png` 200 image/png 52,148 B; `ip63es.jpg` 200 image/jpeg
13,768 B; `value-added.png` 200 image/png 198,726 B — and all four render on
their product pages (`naturalWidth` 317/335/317/708, `complete` true).
Screenshots in `_harness/out/plan5-images/case-fixed/`.

`plan5-images.js` lost its exception list: "every `/images/` response is a 2xx
with an `image/*` content type" is now unqualified, and the placeholder count is
asserted as exactly **5** rather than "no more than 9", so a `photoUrl` that
stops resolving fails the suite.

`_harness/pristine/products-all.json` was re-seeded from `data/`. That is
normally exactly what `sync.sh`'s comment warns against — "refreshing it from
`data/` each time would silently launder exactly the corruption it exists to
detect" — and it is justified here for the one reason that applies: the change
came from the owner, deliberately, not from a test writing to `data/`. Every
suite was re-run against the new reference and is green.

⚠️ **This does not reach the live site.** `data/products-all.json` has been
server-owned since the last deploy and §3 settles that the repo copy is not to
be uploaded. The same four corrections must be applied to the **deployed** copy,
best through Rick's own admin (Edit Product → Photo URL), which writes a backup
first. **Outstanding.**

#### Limits of this evidence

- `php -S` ignores `.htaccess` and `.user.ini`. The throttle work is not
  affected by either, but the four case-mismatched images were confirmed
  against the harness router, which emulates the SPA rewrite; on Apache the
  same rule applies and the result is the same, but that is reasoning from the
  rule text. **[UNVERIFIED on Apache]**
- The duplicate-key count is Chromium's, from a development React build. The
  shipped bundle emits nothing either way — that is the point of the item, not
  a gap in the measurement.
- PSNR is a proxy for perceived quality. It is backed here by rendered-page
  screenshots and a 3× crop of the worst case, but no human other than the
  author has looked at the product photographs yet. **That approval is still
  outstanding**, and the originals are recoverable from git and from
  `_harness/out/images-original/`.

---

## 4l. Verification evidence for Plan 5c — the six open decisions (2026-08-07)

**Base:** `d059033` (PR #11). **Build:** 0 errors, **335.41 kB JS / 22.13 kB CSS**
(from 335.39 / 22.13). Emitted CSS selectors **312 → 312, byte-identical file
hash** across every `src/` change in this session — the Tailwind-extractor trap
did not fire, checked by diffing the selector list after each build and not by
reading the source.

`data/`, `pdfs/` and `uploads/` untouched: `git status` clean for all three, and
all three JSON files `cmp`-identical across `data/` → `_harness/pristine/` →
`_harness/site/data/` after every suite that writes to the mirror.

### The measurement was fixed before anything was decided on it

Two of this session's six items were brand-colour judgements, and the tool that
produced the numbers behind them was scoring the wrong rectangle. `brandtext.js`
sampled a gradient across the **element's box**; the page eyebrow's `<div>` is
1232 px wide and its glyphs occupy 83 px of it, so 1150 px of gradient the text
never touches governed the result.

Ink-extent sampling now lives in `_harness/backdrop.js` (`inkRect()`, a union of
`Range.getClientRects()` per line box), shared by `brandtext.js`,
`plan5c-eyebrow.js` and `plan5c-brandink.js`. One implementation on purpose:
`contrastparity.js` exists because two contrast implementations had already
drifted once, and adding a third the week after writing that down would have
been absurd.

```
eyebrow background, /products, sampled across the element's BOX
   rgb(2,99,166) → rgb(14,148,195)      white scores 3.11 at the far end
eyebrow background, /products, sampled under the GLYPHS
   rgb(2,99,166) → rgb(3,103,169)  @1440
   rgb(2,99,166) → rgb(4,110,173)  @375   white scores 5.47 at the worse end
```

The extraction was proved to be a no-op: full `--verbose` output diffed before
and after. **Recorded because it is a real property of the suite, not hidden:**
two homepage `✓` rows differ by ±1 in the reported background *between two runs
of the same code* — the hero animates and a small ink extent is
position-sensitive. Verdicts are unaffected (nearest is 5.5 against a 4.5 bar)
but the count of distinct combinations can move by one.

### `page-header-eyebrow-contrast` — the item was wrong in both directions

| | before | after |
|---|---|---|
| failing elements in `.ipc-page-header` | **39** | **18** |
| eyebrow, worst of 9 routes × 2 viewports × 2 palettes | **1.04:1** | **5.14:1** |
| eyebrows below AA | 8 of 8 | **0 of 8** |
| `/faq` header link | 1.69:1 @375 | 3.68:1 @375, passing @1440 |

The item described **one** element. Scoring the whole header block found the
other **seven** eyebrows at `rgba(var(--brand-header-ink-rgb), 0.7)` —
composited `rgb(179,208,228)` — at **3.33–3.80:1**. `brandtext.js` had never
seen them: it scores text painted in a *brand* colour, and a translucent white
is not one. Eight copies of one declaration became one `PageEyebrow`.

Full opacity is the load-bearing half, not whiteness. 4.23 recomputes
`--brand-header-ink` against the **worse** stop of this gradient, so it is the
only value in the header that survives a pale palette; `rgba(…-rgb, α)` gives
that guarantee back. `plan5c-eyebrow.js` therefore runs both palettes by
intercepting `site-info.json`, as `inkaudit.js` does — nothing on disk is
touched.

### `brand-text-on-brand-surface`, light half — teal, per Keagan

```
before:  165 elements paint a BRIGHT accent as text on a light background
after:     0 elements paint a BRIGHT accent as text on a light background
         250 paint the text-safe accent there, all ≥ AA
brandtext.js:  35/53  →  35/51     (both worst combinations gone, not moved)
```

124 `→`/`✓` bullets on white 2.18 → **5.26**; 41 type chips on the tint
2.79 → **4.72**. Four call sites. The fourth is the one worth writing down: the
**mobile** card's type chip, whose **desktop twin in the same table already used
`--brand-accent-text`**. Half the pair had been converted; only one is visible at
a time, so a sweep at one viewport finds exactly one of them.

`--brand-accent` did not move — still the bright cyan at **10 background and 40
border** uses across the sweep, asserted, because a "fix" that redefined the
variable would go green on a text-only check while turning every button on the
site teal.

### `sitemap.php` — 9 → 51 URLs, and it tracks the live catalog

`public/sitemap.xml` deleted; `public/sitemap.php` renders from
`data/products-all.json` per request; `.htaccess` rewrites `/sitemap.xml` to it
so `robots.txt`, Search Console and every external reference keep working. The
rewrite is emulated in `_harness/router.php` — without it `/sitemap.xml` falls
through to the SPA shell with a **200**, which is exactly what a broken rewrite
looks like in production, so `plan5b-sitemap.js` now fails loudly on a non-XML
content-type rather than diffing an HTML page.

The decisive assertions do not inspect the code, they change the catalog:

```
add    HARNESS-NEW-SKU to the live catalog  ->  43 product URLs, no rebuild
delete CC from the live catalog             ->  41 product URLs, CC gone
corrupt the catalog                         ->  9 static routes, clean XML, 200
remove the catalog                          ->  9 static routes, clean XML, 200
all 42 product <loc>s vs the canonical each page declares for itself: 42/42
```

That last line is not a sample. Five ids contain spaces or ampersands
(`IP12GA - IP1274`, `IP44A2 & IP45A3`), and PHP's `rawurlencode()` and
JavaScript's `encodeURIComponent()` differ on `!*'()` — no id contains one, but
the suite compares all 42 against the rendered canonical rather than trusting
that.

### The mutation round found two real gaps, and that is the point of it

Three mutations were run. Two behaved as designed; the first did not, and it was
the useful one.

| mutation | expected | actual | outcome |
|---|---|---|---|
| `PageEyebrow` back to `rgba(ink, 0.7)` | eyebrow suite red | **2/4** | as designed |
| mobile chip back to `--brand-accent-2` | brandink suite red | **3/5**, 41 bright-on-light | as designed |
| `sitemap.php`: drop the `is_array()` guard, fake `<lastmod>` | sitemap suite red | **16/16 — passed** | two gaps found |

The third mutation passing is recorded because it was a genuine hole, not a
formality:

1. **`<lastmod>` was never asserted to be the catalog's mtime.** The suite
   checked the ISO *shape* only, so replacing the mtime with `gmdate('Y-m-d')`
   passed — a sitemap claiming every page changed today, every day, which is the
   same defect the privacy page's date had. The suite now **backdates the mirror
   catalog to 2025-03-04** and requires the document to follow.
2. **The document-integrity checks only ran on the happy path.** Deleting the
   guard leaves `foreach (null)`, which under this mirror's `display_errors = On`
   prints a PHP warning *ahead of the XML declaration* — and nothing looked. The
   integrity check now runs on the degraded responses too, which is precisely
   when you need to know the document is still a document.

With both fixed, the same mutation fails **16/17** on the unparseable-catalog
assertion, and the restored file is back to **17/17**.

### The three items that needed no code

- **`brand-gradient-mixed-ends`** — decision re-put and confirmed: unchanged.
  The ink-extent correction does not reach it; those two headings are
  left-aligned over the *hardcoded* end, which is where the original measurement
  already placed them, and white there is 10.78:1.
- **27 unreferenced images** — keep. No route requests them, so no visitor pays
  for them; some are the customer's photography and this may be the only copy.
  The operational half is the part that matters: **do not re-upload
  `images/site/` after the first deploy.**
- **product photo `width`/`height`** — won't fix. **CLS 0.021** at 1440 and **0**
  at 375 against a 0.1 bar, and the available fix crops the customer's
  photography (`CT.jpg` is painted 390 × 217 and would be cut to 260). The real
  fix is intrinsic dimensions written into the catalog at upload time, which is
  a feature.

### Full regression, after

```
lint.php            php -l 19 files 0 failing · node --check 9 files 0 failing
                    JSON 17/10/42 · copydrift 96 matched, 0 JS-only
invariants          17/17          invariants-selftest  15/15
copydrift-selftest   5/5           copyroundtrip        15/15
contrastparity      28/28          skuparity            33/33
deadlinks           0 of 18 resolve to nothing
plan2-formlast       8/8  (+ selftest PASS)   plan2-sku        14/14
plan2-delete        18/18                     plan2-contrast   42/42
plan2-trunc         13/13                     plan3-contact    51/51
plan3-autoreply     10/10                     plan4-admin      19/19
plan4-public        27/27                     plan5-keys       11/11
plan5-spectable     13/13                     plan5-listeners  11/11
plan5-social        31/31                     plan5-images     12/12
plan5-throttle      12/12                     plan5b-sidebar    9/9
plan5b-sitemap       9/9                      plan5b-pwthrottle 10/10
plan5c-eyebrow       4/4   (was 1/4)
plan5c-brandink      5/5   (was 3/4 on the pre-fix shape of the suite)
plan5c-sitemap      17/17  (was 12/16)
```

### What this does NOT cover

- **`.htaccess` is not exercised locally.** `php -S` ignores it, so the
  `^sitemap\.xml$` rewrite is verified only through `_harness/router.php`'s
  emulation of it. The rule itself is [UNVERIFIED] until it runs on Apache, and
  it is the one new deploy-time dependency in this change. First thing to check
  after upload: `curl -sI https://www.insulationproducts.com/sitemap.xml` should
  answer `Content-Type: application/xml`, not `text/html`.
- **`DEPLOY_READINESS_v2.md` §7's manifest is now stale by one row** — it lists
  `sitemap.xml` under the files copied from `public/`. That file is frozen by
  instruction and was not edited; `README.md`'s two deploy tables were updated
  instead and are correct. When following §7, read `sitemap.php` for
  `sitemap.xml`.
- **The 18 + 18 ratcheted failures are not fixed**, only bounded and printed on
  every run. Both are escalations awaiting a brand decision, above.

---

## 4m. Verification evidence for PLAN-6 items 4 and 3 (2026-08-07)

**Base:** `79cdf6e` / `e05d11e`. Emitted CSS selectors **312 → 312** across both.
`data/`, `pdfs/` and `uploads/` untouched and `cmp`-identical to
`_harness/pristine` throughout.

### Item 4 — social platforms, five → seven

Both new fields default to `""`. Measured against the **untouched live file**,
the footer renders the same five icons in the same order, so `site-info.json`
needed no edit and day one is a visual no-op.

`plan5-social` **31 → 35**. The four new assertions are the **admin half**,
which nothing covered before: the suite wrote `site-info.json` directly, so it
only ever proved the site renders what the file says. A field that renders
correctly and cannot be saved is not a feature.

| mutation | result |
|---|---|
| delete the `instagram` line from the save array | **33/35** |
| render the container when `live` is empty | **29/31** |

Icons checked by eye at 96px (`_harness/out/plan6-icons.png`), because no
assertion catches a mistyped SVG path — it renders a garbled shape and still
passes the one-inline-svg, contrast, AX-name and `rel` checks.

### Item 3 — the auto-reply's promise

`plan3-autoreply` **10 → 22**. Posted variables **421 → 424**; `plan2-formlast`
derives its count and passed unchanged, `POSTED_BEFORE` was updated in the same
commit, and `plan2-trunc` re-run against the real `max_input_vars=100` server:
**13/13**. That last one is the assertion that matters — the other two are
bookkeeping (PLAN-6 §0).

| mutation | expected | actual |
|---|---|---|
| remove `ipc_contact_copy()`'s `is_array` guard | corrupt-JSON assertions red | **22/22 — passed** |
| remove the CR/LF strip | injection assertion red | **22/22 — passed**, then **21/22** after the fix below |

### ⚠️ A claim I made and then had to withdraw

The first version of this work carried a docblock saying the CR/LF strip in
`ipc_copy_line()` prevented header injection, and an assertion named
*"a CRLF in the copy fields cannot inject a mail header"*. **Both were wrong,
and the mutation round is what caught it.**

`mail()` takes the body and the headers as **separate arguments**. Measured both
ways, with the strip and without it:

```
with the strip     line 47:  Promise Bcc: attacker@example.com
without the strip  line 47:  Promise
                   line 48:  Bcc: attacker@example.com
```

In both cases that text is in the **body**. The header block is untouched
either way, so the assertion passed with the protection removed — it was
measuring nothing. 4.16 was a genuine injection because `company_name` really
was interpolated into a `From:` header; this is not that, and describing it as
though it were would have left a comment in the tree claiming protection nobody
had added.

The strip is **kept**, for the two smaller reasons that are true: a stray
newline can produce a line that reads like a header to a naive client or a
forwarding chain, and the value stays safe if one of these fields is ever moved
into a subject. The assertion now checks the **normalisation**, which is
falsifiable — and fails at 21/22 when the strip is removed.

The `is_array` mutation passing is the *sitemap `lastmod` lesson repeating*: the
guard's absence is not observable because `foreach` over a non-array is a
warning, not a fatal, and the fallback path produces the same output. It is kept
as defence-in-depth and the suite does not claim to cover it.

---

## 4n. Verification evidence for PLAN-6 item 1 — product families (2026-08-07)

**Base:** `55fe6ec`. CSS selectors **312 → 312**. `data/`, `pdfs/`, `uploads/`
untouched and `cmp`-identical to `_harness/pristine`, including
`products-all.json` — asserted, because the one thing this item must never do is
bulk-migrate the catalogue from a content save.

```
before:  App.jsx FAMILY_ORDER 11 · add.php $partTypes 11 · edit.php $partTypes 11
         all three identical: True — and nothing keeping them that way
after:   one editable list in content.json; two defaults (PHP + JS) under a
         failing drift check; zero literals in add.php / edit.php
plan6-families 13/13 (new)      posted variables 424 -> 435      plan2-trunc 13/13
```

### Why two copies is the right answer

An earlier draft of the suite asserted **one** copy in the tree. That is not
achievable: `admin/*.php` and `src/App.jsx` cannot share a constant without a
build step, and this codebase already settled the same problem for
`$COPY_GROUPS` / `COPY_DEFAULTS` — two copies, kept honest by `copydrift.js`
**failing** when they diverge. `lint.php` gained the same two checks here:

```
family drift              11 families, PHP and JS identical
family literals           none in add.php or edit.php
```

What changed is not the number of copies. It is that a copy which disagrees is
now a build failure instead of an invisible defect.

### Two things measurement changed mid-flight

**1. The editor rendered zero rows on a real `content.json`.** A deployed file
has no `productFamilies` key until the first save, so the section came up empty
while the site rendered eleven families — inviting the owner to retype a list he
already had. It now seeds from `ipc_product_families()`, and the suite drives
the admin against a **pristine** `content.json` specifically so that day-one
state is the one under test.

**2. The stated reason for the empty-list fallback was wrong.** The plan, the
code comment and the suite all said an empty list would put "all 42 products
under `Other`". **It does not.** Grouping is on each product's own `partType`,
so every heading renders whatever the list says — and the assertion built on
that story **passed with the fallback removed**.

What actually breaks, measured:

| | empty list | default list |
|---|---|---|
| reachable product links in the sidebar | **0** | **41** |
| family order | catalogue order | curated order |

`openFamilies` initialises to `new Set(order.concat(["Other"]))`, so an empty
order leaves every accordion **closed**. The fallback was right; the reason was
not. Both numbers are now asserted, and removing the fallback fails the suite at
11/13.

### Mutations

| mutation | result |
|---|---|
| remove the empty-list fallback (`return names`) | **11/13** — order and reachability both red |
| `content-editor.js` anchors on `form[method="POST"]` again | **12/13** — the rename warning never fires |

That second one is not hypothetical: it is the bug the first draft actually had.
`nav.php` renders a Sign Out form **850 lines** before the content form, so
`querySelector('form[method="POST"]')` returns the wrong one and the submit
listener attaches silently to it. The listener now anchors on
`[name="form_complete"]`, which only the content form has.

### What is deliberately NOT done

- **A rename does not rewrite `products-all.json`.** `partType` is stored per
  product; renaming a family leaves its products under the old name until each
  is re-saved. That is correct — a content save silently rewriting the catalogue
  is the class of thing five plans have been removing — but it is not what
  anyone expects, so the editor shows the product count per family and warns
  before the save, naming the count. It **warns, it does not block**: it is his
  catalogue, and re-saving those products may be exactly what he is about to do.
- **`"Other"` stays reserved** and is not editable.

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
