# Scorecards — Run 1

One scorecard per sprint in `audit-runs/build-plan-run1.md`. Each criterion is
Pass/Fail against a **measurement on the running mirror**, not against the diff.
Sprint verdict = Pass only if every criterion passes.

Fill the Result column as each sprint completes.

---

## Sprint 1 scorecard — A-01, A-02

| # | Criterion | How measured | Result |
|---|---|---|---|
| 1.1 | `social_instagram=instagram.com/x` is refused at save | POST `settings.php`, expect 200 with the error list, not a 302 | Pass — 200 + "should be a full URL…", no 302 |
| 1.2 | `social_tiktok=javascript:alert(1)` is refused at save | same | Pass — same, `javascript:` refused |
| 1.3 | The five previously-validated channels behave exactly as before | POST a bad `social_facebook`, expect the same error as Run 1 | Pass — unchanged |
| 1.4 | A `javascript:` value already in `site-info.json` does not render | hand-write it into the mirror, load `/`, assert it is absent from `[data-testid=footer-social]` | Pass — hand-written `javascript:alert(1)` absent from the footer |
| 1.5 | A scheme-less value already in `site-info.json` does not render | same, with `instagram.com/x` | Pass — hand-written `instagram.com/evil` absent |
| 1.6 | All five real social links still render, in order | `$$eval` the footer, expect the 5 pristine URLs | Pass — 5 pristine URLs, in order |
| 1.7 | No empty container when every channel is blank | blank all seven, assert `[data-testid=footer-social]` is absent | Pass — 0 containers when all seven blank |
| 1.8 | `public/.htaccess` sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy | grep the file; header block present and inside `<IfModule mod_headers.c>` | Pass — all three set inside `<IfModule mod_headers.c>` |
| 1.9 | HSTS is gated on `env=HTTPS` | grep the file | Pass — `env=HTTPS` |
| 1.10 | The HTTPS redirect carries the `X-Forwarded-Proto` condition | grep the file | Pass — line 25 |
| 1.11 | The `sitemap.xml` rewrite still precedes the SPA catch-all | read the file in order | Pass — HTTPS L24-27, sitemap L59, catch-all L68 |
| 1.12 | All 10 public routes still 200 and render their own `<h1>` | re-crawl | Pass — 12/12 routes 200, 0 errs, 0 ≥400, 0 broken images |
| 1.13 | No regression: invariants 17/17, lint all-pass | run both | Pass — invariants 17/17, lint 9/9 |

**Sprint 1 verdict: PASS** (13/13) — verified 2026-08-13 on the mirror. Bundle `index-Dm4sEOqU.js`.

---

## Sprint 2 scorecard — A-03, A-04

| # | Criterion | How measured | Result |
|---|---|---|---|
| 2.1 | All five `#industry-*` anchors scroll on a cold load | fresh page per anchor, assert `scrollY` within 120 px of the target's offsetTop | Pass — all 5 anchors, delta 84 px (sticky header offset) |
| 2.2 | Same with `prefers-reduced-motion: reduce` | reduced-motion context | Pass — identical under `reducedMotion: reduce` |
| 2.3 | A hash-free navigation still lands at scrollY 0 | scroll down on `/`, click a nav link, assert `scrollY === 0` | Pass — scrolled to 2000, clicked `/about`, scrollY 0 |
| 2.4 | A hash-free **cold load** still lands at scrollY 0 | fresh page on `/products`, assert `scrollY === 0` | Pass — cold `/products`, scrollY 0 |
| 2.5 | The in-app homepage → `#industry-medical` click still works | click through, assert scrolled | Pass — scrollY 1301, target 1385 |
| 2.6 | RFQ without `quantity` returns 422 | curl, assert status and `ok:false` | Pass — 422 "Please add the quantity required." |
| 2.7 | Message without `subject` returns 422 | curl | Pass — 422 "Please add a subject." |
| 2.8 | Neither rejected submission is mailed | assert no new `===MESSAGE===` in the mail log | Pass — 0 messages in the mail log after both rejections |
| 2.9 | A complete RFQ and a complete message still return `{"ok":true}` and mail | curl both, assert 2 sales mails + 2 auto-replies | Pass — both `{"ok":true}`, 4 messages (2 sales + 2 auto-reply) |
| 2.10 | Response shape unchanged (`ok`/`error` keys only) | inspect the JSON | Pass — keys are exactly `error`, `ok` |
| 2.11 | Honeypot, referer, rate-limit and cap behaviour unchanged | re-run the Run 1 request matrix, compare outcomes | Pass — 405/honeypot-200/403/absent-200/android-200/subdomain-200/422-not-500/429 at the 6th; cap still 5094; log types unchanged |
| 2.12 | No regression: invariants 17/17, lint all-pass, build succeeds | run all three | Pass — invariants 17/17, lint 9/9, build clean |

**Sprint 2 verdict: PASS** (12/12) — verified 2026-08-13. Bundle `index-ChUNoVMu.js`.

Note recorded during the sprint: the first pass of criterion 2.6/2.7 measured a **stale mirror**.
`_harness/sync.sh` copies `dist/.`, and `public/contact.php` only reaches `dist/` via `npm run build`,
so a `public/` edit followed by a bare `sync.sh` serves the previous file — and the two bundle hashes
sync.sh prints are unchanged by a `contact.php` edit, so the staleness is invisible. Re-measured after
a rebuild. Carried into Run 2 as a harness finding.

---

## Sprint 3 scorecard — A-05, A-07, A-08, A-12

| # | Criterion | How measured | Result |
|---|---|---|---|
| 3.1 | Zero unlabelled controls across all 10 public routes | re-crawl with the Run 1 label probe | Pass — 12/12 public routes report `inputsNoLabel: []` |
| 3.2 | The category `<select>` reports the accessible name "Filter by Category" | read the computed accessible name | Pass — accessible name "FILTER BY CATEGORY", role combobox (measured via CDP at 375 px, where the `<details>` drawer that holds it is used) |
| 3.3 | Zero unlabelled controls across all 13 admin pages | re-crawl signed in | Pass — 13/13 admin pages report `inputsNoLabel: []` |
| 3.4 | Zero duplicate ids on every crawled page | same crawl | Pass — `dupIds: []` on all 25 crawled pages |
| 3.5 | `delete.php` has a viewport meta tag | crawl assertion | Pass — `viewportMeta: true` on all 13 |
| 3.6 | `add.php` still saves a complete product end to end | POST a full product, assert 302 + present in JSON | Pass — 302 + badges, description and specTable1 all stored correctly |
| 3.7 | `add.php` spec-table editor still populates its textareas | load the page, assert `spectable-editor.js` wired the grid | Pass — `specTable2_json` still populated, editor grid renders. Note: `spectable-editor.js` hides both raw JSON textareas *and their wrappers*, so the two labels added for them are visible only in the no-JS fallback — measured hidden on both `add.php` and `edit.php`, no orphaned label |
| 3.8 | `audit-log.php` filters still work | GET `?action=add`, assert filtered rows | Pass — `?action=add` 1 hit, `?action=edit` 0, `?sku=` 2 |
| 3.9 | Named-control count on `content.php` unchanged and `form_complete` still last | re-run the Run 1 probe | Pass — 449 named controls, `form_complete` still last (unchanged from Run 1) |
| 3.10 | No regression: invariants 17/17, lint all-pass, build succeeds | run all three | Pass — invariants 17/17, lint 9/9, build clean |

**Sprint 3 verdict: PASS** (10/10) — verified 2026-08-13. Bundle `index-BC_TWnf-.js`.

---

## Sprint 4 scorecard — A-06, A-09, A-10, A-11

| # | Criterion | How measured | Result |
|---|---|---|---|
| 4.1 | **All 42 catalog SKUs pass the validator** | run `sku_problems()` over every SKU in `data/products-all.json`, expect 42 empty results | Pass — 42/42 `sku` **and** 42/42 `id` values return no problems, including the space/`&`/`/` id forms |
| 4.2 | `...` is refused with a readable message | POST `add.php`, assert 200 + error text, and that no product was created | Pass — 200 + "must contain at least one letter or number", nothing written |
| 4.3 | `<script>x</script>` is refused | same | Pass — 200 + the character-set message, nothing written |
| 4.4 | An ordinary new SKU still saves | POST `AUDIT-OK-1`, assert 302 + present | Pass — `AUDIT-OK-1` 302 and present in the catalog |
| 4.5 | `edit.php` renaming to an invalid SKU is refused and the typed values survive | POST, assert error + the form still holds the submitted name | Pass — rename to `...` refused, `name` repopulated as "Typed Name Survives", disk unchanged |
| 4.6 | Successful sign-in writes exactly one audit line | sign in, tail `admin-log.jsonl` | Pass — one `sign-in` line |
| 4.7 | Sign-out writes exactly one audit line | sign out, tail | Pass — one `sign-out` line |
| 4.8 | A failed attempt writes exactly one audit line | wrong password, tail | Pass — one `sign-in-failed` line carrying the failure number |
| 4.9 | No audit line contains any part of an attempted password | grep the log for the string used | Pass — 0 occurrences of the attempted passwords in `admin-log.jsonl` |
| 4.10 | All three new actions appear in the filter select and filter correctly | GET `audit-log.php?action=login` | Pass — all three in the `<option>` list and each filters. Note: an attempt refused by the cool-off gate is not logged, because it never reaches the hash — consistent with the 4.14 design that a refused attempt is not counted |
| 4.11 | Throttle behaviour unchanged | 6 failed attempts, assert the cool-off message still appears at the same point | Pass — 5 "Incorrect password" then cool-off from the 6th, identical to Run 1 |
| 4.12 | Dashboard delete dialog text agrees with `delete.php` | read both strings | Pass — dialog now says "A backup is saved first, so this can be undone from Backups"; `delete.php` says "This can be undone." |
| 4.13 | SKU-clash error renders `O'Brien`, not `O&amp;#039;Brien` | reproduce the Run 1 case | Pass — `AA & BB` renders `AA &amp; BB` (single escape). `O'Brien` is now rejected by the new SKU rule, so the equivalent `&` case was used |
| 4.14 | Delete still works and still writes a backup | delete a test product, assert backup file appears | Pass — delete 302, backup count 10 → 11 |
| 4.15 | No regression: invariants 17/17, lint all-pass | run both | Pass — invariants 17/17, lint 9/9 |

**Sprint 4 verdict: PASS** (15/15) — verified 2026-08-13. Mirror restored to pristine afterwards.

---

## Sprint 5 scorecard — A-13, A-14, A-15

| # | Criterion | How measured | Result |
|---|---|---|---|
| 5.1 | `apple-touch-icon.png` is referenced nowhere in the tree | grep `public/`, `dist/`, `index.html` | Pass — 0 references in `public/`, `dist/`, `index.html`, `src/`, `admin/` |
| 5.2 | `manifest.json` is still valid JSON and still declares the SVG icon | parse it; load `/` and assert no manifest console error | Pass — valid JSON, one SVG icon `sizes: "any"`, 0 manifest console messages on `/` |
| 5.3 | The mirror's `admin/logo.svg` loads | re-sync, crawl admin, assert zero broken images | Pass — `_harness/site/admin/logo.svg` 2721 bytes; admin crawl reports 0 broken images (was 1 on all 13 pages) |
| 5.4 | `sync.sh` is idempotent | run twice, assert identical mirror | Pass with a correction to the criterion — two consecutive syncs differ in exactly one file, `admin/config.local.php`, because `setpw.php` re-hashes with a fresh bcrypt salt. That is inherent, pre-existing and cannot be deterministic. Every other file is byte-identical |
| 5.5 | `sync.sh` does not copy `admin/.htaccess` into the mirror | assert absent | Pass — `_harness/site/admin/.htaccess` absent |
| 5.6 | `lint.php` gains an action-drift check that passes | run it | Pass — "audit-action drift  14 actions, filter list and call sites identical" |
| 5.7 | **The new check fails on a planted mismatch** | inject a bogus action name, assert lint fails, then revert | **Pass — proven on three planted faults:** (a) `import` added to the list but written nowhere → FAIL "offered in the filter but never written"; (b) a call site changed to `bogus-action` → FAIL naming both directions; (c) a hardcoded list put back in `audit-log.php` → FAIL "carries a hardcoded action list again". All three reverted |
| 5.8 | No regression: invariants 17/17, full lint all-pass, build succeeds | run all three | Pass — invariants 17/17, lint 10/10 checks, build clean, 12/12 routes with 0 errs / 0 ≥400 / 0 broken images / 0 unlabelled / 0 dup ids / 0 overflow |

**Sprint 5 verdict: PASS** (8/8) — verified 2026-08-13. `lint.php` now runs 10 checks, up from 9.
