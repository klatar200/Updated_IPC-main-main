# P8 — the runbook dry-run and developer-document truth          agent: D   started/finished: 2026-09-14 15:12 / 16:05   mirror: :8145
findings:   Blocker 0 · High 0 · Medium 1 · Low 2
| ID | sev | class | where | one line |
| A-9.D2 | Medium | doc | `plans/GUARDRAILS.md` §4.1 baseline table | the regression baseline names 64 suites; the reconciled §4.3 union runs 80 — 16 live suites (incl. `contactflow`, `isoclaims`, `nodupbackups`) are absent from the table an executor is told is the inherited state |
| A-9.D3 | Low | doc | `_harness/README.md:106` | `copydrift.js` row says "96 fields"; `copydrift.js` measures **110** today (confirmed by running it) — stale by 14 |
| A-9.D4 | Low | doc | `plans/GUARDRAILS.md:62` | cites `admin/content.php:295-299` for the five photo-slot fields; those lines now hold `productFamilies`, added since GUARDRAILS was written — the five slots are at `:341-345` |
ledger:     done E113, E155, E158, E159, E160, E161, E162   blocked none
suites cited: none run by this pass (P8 is a manual dry-run per its brief, not a sweep-suite pass); `copydrift.js` run directly as a doc-truth check (not part of the background sweep) → 110 matched, 0 JS-only
instruments: none — no new instrument named by this brief (a throwaway `p8-shot.js` screenshot helper and two throwaway routers live under `_harness/out/audit9/P8/`, not committed as suites)
artifacts:  _harness/out/audit9/P8/site/ — the deploy-sim tree, built B2-step-by-step
            _harness/out/audit9/P8/shots/*.png — one screenshot per B2 step, per C-check, per rollback action, per induced symptom (22 files)
            _harness/out/audit9/P8/c1-live/c1-curl-output.txt — the permitted live `curl -sI` lines
            _harness/out/audit9/P8/servers/*.log — php -S logs for every port this pass opened (8145, 8146 sequentially)
out of brief: `_harness/router.php`'s `$root` is hardcoded to `__DIR__.'/site'`, so any mirror served with `-t <other-docroot> _harness/router.php` (docroot elsewhere) silently serves `_harness/site`'s content instead, not the passed docroot — a copy of `router.php` must sit next to any mirror that isn't literally named `site` beside it. Cost this pass an hour on step 1 before catching it (`_harness/router.php:32`, `$root = __DIR__ . '/site';`).
[UNVERIFIED]/[UNSOURCED]: C1's five `.htaccess`-dependent checks (local — GUARDRAILS §4.3, `php -S` ignores `.htaccess`/`.user.ini` entirely); all `https://` lines in C1's live table (`[UNVERIFIED — TLS]`, expired cert, same as `step0.md`); B3 permissions (brief says `[UNVERIFIED]` — not FTP/PHP-user testable here); the "omit `.htaccess`" induced-symptom row (see Method step 5 — genuinely unreproducible locally, in EITHER router configuration, for a reason not previously written down); the `.user.ini`-specific half of C3's "2M/8M/1000" check (this pass's server was launched with an explicit `-c` ini, so it never exercises `.user.ini` at all — a different, stronger form of the same GUARDRAILS §4.3 limitation)
self-corrections: none
---

## STEP 0 / branch (Method 1)

`_harness/out/audit9/step0.md`: **NOT LIVE** (both hostnames' HTTPS certificates
are expired/wrong-CN; plain HTTP 302s to `/site/`; all three `/data/*.json`
404 on the stock host page). Classification: **first deploy (branch B)** —
`data/`, `pdfs/`, `uploads/` go up exactly once, GO-LIVE.md's "Apply the two
corrected privacy sections" A-item does not apply (repo `content.json` already
carries the corrected text — P4's to confirm), and there is no live/repo data
diff to classify.

## B1–B3 on the deploy-sim (Method 2)

Built `_harness/out/audit9/P8/site/` **exactly** in GO-LIVE.md B2's numbered
order, serving on `:8145` after each step (screenshots
`_harness/out/audit9/P8/shots/step1…step7-*.png`):

| Step | Added | `curl`/render result |
|---|---|---|
| 1 | `assets/` | 404, harness's own "no index.html in the mirror" message — no page content at all, i.e. no blank-*page* window, just no page |
| 2 | `images/` | same 404 |
| 3 | `contact.php`, `sitemap.php`, `favicon.svg`, `logo.svg`, `manifest.json`, `robots.txt` | same 404 |
| 4 | `.htaccess`, `.user.ini` | same 404 |
| 5 | `admin/` | `/admin/` now 200s to the real sign-in screen |
| 5b | `admin/config.local.php` (harness test credential, `_harness/site/admin/config.local.php`) | sign-in works |
| 6 | `data/`, `pdfs/`, `uploads/` (first deploy) | still 404 at `/` — correct, nothing serves the SPA shell yet |
| 7 | `index.html` **last** | full site 200s, catalog populates (52,402 chars of body text, hero copy present) |

**The blank-page window never appears at any step** — B2's stated reason (Vite
content-hashes the bundle, so `assets/` sits inert until `index.html` points at
it) holds: every intermediate step is either a clean 404 (nothing to look at)
or, from step 5 on, a fully working admin sign-in page. Confirmed the eleven
B1 items and both dotfiles present in the finished tree
(`ls -A _harness/out/audit9/P8/site/`: `.htaccess .user.ini assets contact.php
favicon.svg images index.html logo.svg manifest.json robots.txt sitemap.php`
— all eleven, plus `admin/ data/ pdfs/ uploads/` for the first-deploy-only
folders). `data/.htaccess`, `pdfs/.htaccess`, `uploads/.htaccess` all present
(uploaded as part of the whole-folder copy — B2.8 is a no-op on a first
deploy, as GO-LIVE.md itself notes parenthetically).

**B3 permissions: `[UNVERIFIED]`** per the brief — `php -S`'s process owns
every file it serves; there is no FTP-vs-PHP-user distinction to reproduce
locally.

## C1–C4 mapped (Method 3)

**C1 — `.htaccess` effects.**
- *Local:* not testable — `php -S` ignores `.htaccess` and `.user.ini`
  entirely (GUARDRAILS §4.3). `[UNVERIFIED]`.
- *Live read-only:* ran exactly GO-LIVE.md C1's `curl -sI`/`curl -s` lines
  against the two permitted hostnames (`_harness/out/audit9/P8/c1-live/c1-curl-output.txt`).
  Every `https://` line fails TLS verification (`curl` exit 60 — cert expired,
  same finding as `step0.md`; not re-derived, cited) → `[UNVERIFIED — TLS]`.
  The one `http://` line: `curl -sI http://www.insulationproducts.com/` →
  `302 Found` → `Location: http://www.insulationproducts.com/site/` — matches
  `step0.md` exactly (not a 301 to https, HSTS already present). Not a new
  finding — same evidence, cited once.
- *Owner-only:* n/a — C1 has no owner-only line.

**C2 — the site.** *Local, done on the deploy-sim:*
- Homepage loads, catalog populates (confirmed above).
- Deep link `/products` loads directly (200, full catalog grid) —
  `_harness/out/audit9/P8/shots/c2-products.png`.
- `/products?productId=IP38FE` renders with **1** spec `<table>` present and a
  full breadcrumb trail — `c2-product-detail.png`.
- Footer contains `630.771.0700` — confirmed via `innerText`.

**C3 — the admin.** *Local, done on the private mirror (the credential is
provided for exactly this):*
- Signed in with the mirror's test password; dashboard renders
  ("42 products across 10 categories…") — `c3-dashboard.png`.
- **No red "Server setup problem" banner** — `locator('text=Server setup
  problem').count()` → 0.
- **Help → What your server allows**: renders the three server-limit rows
  (`upload_max_filesize`/`post_max_size`/`max_input_vars` via `ini_get()`),
  reading **24M / 24M / 10000** here — this pass's `-c _harness/php-mail.ini`
  values, not `.user.ini`'s. The GO-LIVE.md "if it reads 2M/8M/1000" check is
  a symptom of `.user.ini` NOT being applied; since `php -S` never applies
  `.user.ini` at all (GUARDRAILS §4.3) and this pass supplied its own `-c`
  ini, the row exercises the *display* logic correctly but cannot exercise the
  *diagnostic* the runbook actually needs live. `[UNVERIFIED]` for that half.

**C4 — the one journey.** *Local, done on the private mirror* (the "never by
an agent" restriction in the brief and GUARDRAILS §10.3.1 is explicit about
the **live host**, not a disposable private mirror — this is exactly what
`contactflow.js`/`plan3-autoreply.js` already do against `:8123` for the same
reason):
- Submitted the Request-a-Quote form for real, typing into the rendered
  controls (name, email, quantity, part number, notes) —
  `c4-contact-form.png`, `c4-after-submit-2.png`.
- **Both** the sales notification and the auto-reply were captured by
  `fakemail.sh` into a private log (`IPC_MAIL_LOG` scoped to this pass, not
  the shared default, to avoid colliding with any other agent's mail-log
  reads) — full headers and bodies recorded, Reply-To correct on both,
  auto-reply's business details (phone/fax/address) match `site-info.json`.
- **The lead also appears under Admin → Inquiries** as "SENT TO MAIL SERVER"
  — `c4-inquiries.png`. Both halves of the C4 checklist are true, independently
  confirmed (mail log + Inquiries row), exactly as GO-LIVE.md requires.
- First attempt at this failed with the runbook's own documented symptom
  ("mail server could not send") — traced to this pass's own mirror-path
  choice (`fakemail.sh` resolved relative to the docroot's parent, which for
  a nested mirror under `_harness/out/audit9/P8/site` is not `_harness/`);
  fixed by placing a copy of `fakemail.sh` beside the mirror, not a site
  defect. Recorded under "Out of brief" as the router path issue, not filed
  as a finding.

## Rollback (Method 4)

**Data rollback — Admin → Backups, on the mirror.** Saved Business Details
twice through the real form (`company_slogan` field), producing two
timestamped backups; confirmed via disk read which backup held which value;
restored the **older** one through the real "Restore this version" button.
Result: the live `site-info.json` slogan reverted to the pre-test original,
**and** the pre-restore state (`[rollback-test-B]`) was itself written to a
**third** backup file before the restore applied — confirmed by reading its
content directly. Matches `backups.php`'s own copy ("backs up the current
state first, so a restore can always be undone") exactly.
Screenshot: `rollback-backups-list.png`.

**Frontend rollback — mechanism only.** No source file changed this session
(none is permitted to), so there is no genuinely different second bundle to
roll back *from* — P1 independently confirmed the build is bit-for-bit
reproducible. Exercised the operation itself: saved a copy of `index.html`,
overwrote it back onto the mirror, confirmed the site still 200s and both
content-hashed assets (`index-BdtQUPPl.js`, `index-DyC-SD2K.css`) still
resolve unchanged (`rollback-frontend-after.png`). This confirms the
mechanics ("old `assets/` still resolve") but not a true before/after swap;
the actual guarantee (content-hashed filenames never collide across builds)
was independently proven in P1 step 2's reproducibility check, not re-derived
here.

## "If something is wrong" (Method 5)

Induced the four symptoms the brief names, each on its own throwaway
port/mirror, never touching `:8123`–`:8139`:

| Induced | First-thing-to-check row | Result |
|---|---|---|
| `dist/` uploaded as a folder (`site/dist/index.html` instead of `site/index.html`) | "Did you upload `dist/` itself instead of its contents?" | `/` 404s (no `index.html` at the root) — matches: an owner checking `public_html/` would see a `dist/` folder sitting there instead of files at the root. `symptom-a-dist-as-folder.png` |
| Omit `.htaccess` | "`.htaccess` is missing… hidden dotfile" | **Not reproducible, in either router configuration.** With `router.php`, the SPA fallback is emulated regardless of whether `.htaccess` physically exists (the router never reads it). Running `php -S` with **no router at all** was tried as the brief's "emulate via the router" instruction suggests — but PHP 8.4.19's built-in server, with no router script and no matching file, itself falls back to serving the docroot's `index.html` for *any* unresolved path (confirmed on a two-file isolated docroot: `HELLO INDEX` served for `/some/random/path`, 200, correct `Content-Length`; removing `index.html` then correctly 404s). So `php -S` cannot produce the real symptom (a bare 404 with no rewrite) under any flag combination — a stronger, more specific version of GUARDRAILS §4.3's existing "`.htaccess` is unverifiable locally" than what is currently written down. `[UNVERIFIED]`, not a finding per the brief's own Apache-behaviour carve-out. |
| `data/products-all.json` served with `Content-Type: text/plain` instead of `application/json` | `"Catalog Unavailable"` / `data/.htaccess` | Reproduced with a one-off test router overriding only that one path's header. `/products` renders the exact `⚠️ Catalog Unavailable` panel, phone number still visible in the header/footer (invariant 8 holding), console shows `jsonOrThrow()`'s own message verbatim: `Expected JSON for product catalog, got "text/plain; charset=UTF-8"`. `symptom-c-catalog-unavailable.png` |
| Delete `admin/config.local.php` | "`config.local.php` missing or overwritten" → `ALLOW-PASSWORD-RESET` recovery | `/admin/` shows **"Admin Not Configured"**, names the exact cause (`admin/config.local.php` is missing or damaged) and the exact recovery (FTP an empty `ALLOW-PASSWORD-RESET` into `admin/`, reload, set a new password, file self-deletes, one-hour window) — word for word matching GO-LIVE.md's row. Placing the empty file switches the same screen straight to a "Set Admin Password" form. `symptom-d-no-config-local.png`, `symptom-d-recovery.png` |

Three of four fully confirmed; the `.htaccess` row is confirmed unreproducible
locally (not merely "confirmed reproducible") and is recorded as
`[UNVERIFIED]`, consistent with the brief's explicit "not a finding: Apache/
permission behaviour" carve-out — it is filed here as a sharper statement of
an existing, already-documented limitation, not a new one.

## Document truth (Method 6)

| Check | Result |
|---|---|
| `CLAUDE.md`'s `App.jsx` figure | `wc -l src/App.jsx` → **13,136**. Doc says "~12,900" (already self-marked as approximate and already tracked as drifting: "Said 8,500 until 2026-08-11 and 12,270 until 2026-08-13"). **Refresh, not a finding**, per the brief. |
| admin page/entry-point/JS counts vs `ls admin/` | `ls admin/*.php` → 17; `ls admin/*.js` → 10. `lint-before.txt`'s own counts (`php -l 19 files`, `node --check 10 admin JS files`) match exactly (19 = 17 admin `.php` + `contact.php` + `sitemap.php`). No stale count found in any in-scope doc (none of `README.md`/`CLAUDE.md`/`GO-LIVE.md`/`admin/README.md` states a specific admin-page/entry-point count to check). **Checked, no finding.** |
| `_harness/README.md` "96 fields" vs `lint.php` "110 matched" | Ran `node _harness/copydrift.js` directly: **110 matched, 110 PHP fields in 14 groups, 110 JS defaults in 14 groups, 0 PHP-only, 0 JS-only** — matches `lint-before.txt` exactly. `_harness/README.md:106`'s "96 fields" is **stale**; **110 is current**. Filed as **A-9.D3, Low**. |
| Backup count vs `config.php`'s constant | `admin/config.php:642`: `define('BACKUP_KEEP', 90);`. `GO-LIVE.md:250` says "90 most recent"; `admin/README.md:31,62` both say "90 kept per prefix". Both match. No other in-scope doc states a number. A-6.9/A-7.5 already fixed this drift once (30 → 90); it has held. **Checked, no finding.** |
| `GO-LIVE.md` "52 URLs" vs the served sitemap | Served `/sitemap.xml` from the deploy-sim: `grep -c "<loc>"` → **52**. Matches exactly. **Checked, no finding.** |
| `GUARDRAILS.md` §4.1 suite count vs §4.3's union | §4.1's baseline table names **64** distinct suites (counted mechanically from the code block, `plans/GUARDRAILS.md:136-173`). The reconciled §4.3 union (`_harness/out/audit9/sweep-list-final.txt`, C's Phase-0 output) has **80**. Every one of the 64 is in the 80 (no orphans the other way), but **16 live, runnable suites are absent from §4.1's table**: `adminwidth`, `audit5-blockers`, `audit5-high`, `audit5-medium`, `audit6`, `audit7`, `audit7-lead`, `contactflow`, `contactflow-selftest`, `contentlinks`, `fgpatch`, `imgcheck`, `isoclaims`, `nodupbackups`, `plan10-admincrawl`, `plan2-formlast-selftest`. This is the same completeness gap §4.1 itself names as a recurring failure mode ("a baseline that omits half the suite set cannot tell an executor what they inherited"). Filed as **A-9.D2, Medium** — P11's own step 1 is where the replacement table gets written (by C), so this finding feeds that refresh directly rather than duplicating it. |
| `README.md:213-218` vs `useRefetchOnReturn()` (A-8.1) | The cited line range has **moved** — today's `README.md:213-218` is the "upload `assets/` before `index.html`" paragraph, not the refetch paragraph (content has shifted down as the file grew). The refetch paragraph itself now lives at `README.md:246-256` and is **accurate**: both `SiteInfoProvider` (`App.jsx:6628`) and `ContentProvider` (`App.jsx:7164`) call `useRefetchOnReturn()`, matching the doc's claim that both re-check on tab focus past the 60 s TTL — confirmed by `grep -n useRefetchOnReturn src/App.jsx` (three hits: the definition at `6565`, the two call sites at exactly `6628` and `7164`, unchanged since A-8.1 was written). **A-8.1 has held; checked, no finding.** (The stale `:213-218` line-anchor is inside `audit-runs/audit8.md`, a historical record outside this pass's doc scope — not re-filed.) |
| Every `file:line` in `CLAUDE.md` and `GUARDRAILS.md` | Mechanical census (`grep -noE` for `<file>.<ext>:<line>` patterns) over both files found exactly **two** citations total: `CLAUDE.md:157` → `index.css:341` (verified: `.ipc-page-header` IS at `src/index.css:341`, exact match — **accurate**) and `GUARDRAILS.md:62` → `admin/content.php:295-299` (verified: those lines now hold the `productFamilies` field group, added since GUARDRAILS was written 2026-08-05; the five photo slots the sentence describes — `heroPhoto`, `bandTeamPhoto`, `bandBuildingPhoto`, `aboutPhoto`, `servicesPhoto` — are at `:341-345` today). Filed as **A-9.D4, Low**. |

## Findings

### A-9.D2 — Medium — the harness's own regression baseline undercounts today's live suites by 16

class:        doc
pass:         P8, P11     ledger: E162, E105
surface:      `plans/GUARDRAILS.md` §4.1
where:        `plans/GUARDRAILS.md:136-173` (the "Refreshed 2026-08-11" baseline table), measured on `2121597`, 2026-09-14
not in §11:   checked AUDIT-11's own prior refresh of this same section (`GUARDRAILS.md:117-121` narrates the last time this exact gap was found and closed, 30 named vs 65 live) — this is the same failure mode recurring nine suites' worth of drift later, not a re-report of that closed instance
reproduce:    count distinct suite names in the code block at `plans/GUARDRAILS.md:136-173` (64); diff against `_harness/out/audit9/sweep-list-final.txt` (the §4.3-reconciled union, 80) — `comm -13` on the two sorted, de-duplicated lists
observed:     16 names present in the union and absent from the table: `adminwidth`, `audit5-blockers`, `audit5-high`, `audit5-medium`, `audit6`, `audit7`, `audit7-lead`, `contactflow`, `contactflow-selftest`, `contentlinks`, `fgpatch`, `imgcheck`, `isoclaims`, `nodupbackups`, `plan10-admincrawl`, `plan2-formlast-selftest`
expected:     §4.1's own stated purpose is "so you know which failures you inherited" — a table missing a fifth of the live suite set, including the entire contact-form happy-path suite (`contactflow`), the ISO-claims check (`isoclaims`), and the no-op-save invariant-16 check (`nodupbackups`), cannot do that job
consequence:  an executor who runs only the suites named in §4.1 as "the regression baseline" believes they have covered the inherited state and has not; a red in one of the 16 omitted suites would not be recognisable against this table at all. Medium, not High: the suites still run fine on their own and nothing is silently broken by the gap itself — it is the document's completeness, not the code, that is wrong, and P11 step 1 already schedules the replacement table this round
evidence:     `_harness/out/audit9/sweep-list-final.txt`, `plans/GUARDRAILS.md:136-173`
verified-by:  (pending V)
outcome:      (pending C — P11's own §4.3 resolution produces the dated §4.1 refresh; this record and P11's E105/E162 rows are the same finding, filed once)
fix-proof:    n/a — not fixed by this pass

### A-9.D3 — Low — `_harness/README.md`'s copydrift field count is stale

class:        doc
pass:         P8, P11     ledger: E161
surface:      `_harness/README.md:106`
where:        `_harness/README.md:106`, measured on `2121597`, 2026-09-14
not in §11:   not previously recorded — no prior audit's do-not-re-report entry names this row
reproduce:    `node _harness/copydrift.js` (read-only, no mutation, no server needed)
observed:     `PHP fields offered : 110 in 14 groups` / `JS defaults : 110 in 14 groups` / `matched : 110` — matches `_harness/out/audit9/lint-before.txt`'s Phase-0 measurement exactly. `_harness/README.md:106` reads "(96 fields)"
expected:     the doc row should state the number `copydrift.js` actually reports, since it is described as "wired into `lint.php`" — i.e. presented as a live, checked fact, not an approximation
consequence:  a developer reading the suite table to gauge `COPY_DEFAULTS`'s size undercounts it by 14 fields; no wrong action follows, so this is Low per PLAN-11 §10.1.4 ("a fact stated and wrong is Low")
evidence:     `node _harness/copydrift.js` output (reproduced in this record); `_harness/out/audit9/lint-before.txt`
verified-by:  (pending V)
outcome:      (pending C)
fix-proof:    n/a — not fixed by this pass

### A-9.D4 — Low — a GUARDRAILS hard-prohibition cites the wrong line range for the five photo-slot fields

class:        doc
pass:         P8     ledger: E160
surface:      `plans/GUARDRAILS.md:62`
where:        `plans/GUARDRAILS.md:62` cites `admin/content.php:295-299`; measured against `admin/content.php` on `2121597`, 2026-09-14
not in §11:   not previously recorded
reproduce:    read `admin/content.php:295-299` (currently the `productFamilies` field group) and compare against a search for the five `*Photo` keys (`heroPhoto`, `bandTeamPhoto`, `bandBuildingPhoto`, `aboutPhoto`, `servicesPhoto`), found at `admin/content.php:341-345`
observed:     lines 295-299 hold `'productFamilies' => [ 'title' => 'Product Families / Categories', … ]`, not photo fields
expected:     the cited range should still point at the five photo-slot fields the sentence is about, since new fields (`productFamilies`, added after GUARDRAILS was written 2026-08-05) shifted everything below it down
consequence:  low — the prohibition's text is self-contained and correct without the line number (a reader does not need the citation to obey "don't delete unreferenced `public/images/site/` files"), but the citation itself is now wrong and would send a verifier to the wrong code. Low per PLAN-11 §10.1.4
evidence:     `admin/content.php:295-299` and `:341-345`, this record
verified-by:  (pending V)
outcome:      (pending C)
fix-proof:    n/a — not fixed by this pass
