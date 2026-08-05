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
| D1–D18, D19–D30 | docs | See §5. |

---

## 2. Open — not launch blockers

Ordered by value. Nothing here blocks the upload.

- [ ] **4.11b** Footer social icons were promised by v2 4.11 and never built — `social.*` still feeds JSON-LD `sameAs` only. (Split out 2026-08-05, AUDIT_v3 D18.)
- [ ] **4.15b** Auto-reply per-recipient cap is defeated by plus- and dot-addressing (`a+1@gmail.com`, `a.b@gmail.com`). Normalising Gmail-style addresses is the fix; the per-IP cap still bounds the damage. (Split out 2026-08-05, AUDIT_v3 §3.3.)
- [ ] **NB-copy** `mergeContent` iterates `Object.keys(defaults)` only, so a `copy` key that exists in `content.php` but not in `App.jsx`'s `COPY_DEFAULTS` would have the owner's edit vanish with a success message. ~450 posted keys were never enumerated against the defaults tree. Worth a targeted diff. (AUDIT_v3 §5.)
- [ ] **`form_complete` position** is enforced *positionally* only. Nothing stops a future field being added after `content.php`'s last input, and there is no test runner to assert it. (AUDIT_v3 invariants note.)

- [ ] **4.1** FAQ JSON-LD `useEffect` has `[]` deps and runs before `content.json` loads, so owner-edited FAQs never reach Google's rich results.
- [ ] **4.3** No `rel="canonical"` anywhere; `og:url` is hardcoded to the homepage on all 9 pages.
- [ ] **4.5** Every contact-form error is a browser `alert()` — no inline error, no `aria-live`, no focus move.
- [ ] **4.12** `content.php` promises the Industries SKU "must match a real product" but validates nothing against `load_products()`.
- [ ] **4.13** The ✕ that deletes a whole content card has no `data-confirm`, and sits 4 px from the reorder buttons.
- [ ] **4.14** Login throttle uses `sleep()` (parallel connections sleep concurrently) and a read-modify-write with no lock. A long random password is the real control.
- [ ] **4.19** Product Index sortable headers have no `tabindex`, `scope` or `aria-sort`.
- [ ] **4.20** Collapsed FAQ answers use `max-height:0` — still read by screen readers and find-in-page.
- [ ] **4.21** Navigation is `<button onClick>` throughout: 3–7 `<a href>` vs 14–119 `<button>` per page. No crawlable internal link graph, no Cmd-click.
- [ ] **4.23** Owner-set brand colors are injected with no contrast guard while headings and primary buttons hardcode `#ffffff`.
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
