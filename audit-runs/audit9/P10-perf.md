# P10 — Performance and robustness          agent: C′   started/finished: 2026-09-14 17:53 / 18:30   mirror: :8143 (source data: I-crawl, port :8147 — cited, not re-crawled)
findings:   Blocker 0 · High 0 · Medium 0 · Low 0
| ID | sev | class | where | one line |
|---|---|---|---|---|
| (none) | — | — | — | all five method steps re-verified clean; see records below |
ledger:     done E184,E185,E186   blocked none
suites cited: plan5-images 12/12, plan5-listeners 11/11, plan5-keys 11/11
instruments: none new — step 1 and step 3 are queries over I-crawl's existing JSON (single-owner measurement, PLAN-11 §3.3 table: "console-clean crawl... → I-crawl → P10"); step 4 is a grep; step 5 is a `git log -L`/`git diff` scope check
artifacts:  _harness/out/audit9/P10/console-clean.txt · _harness/out/audit9/P10/transfer-bytes.txt · _harness/out/audit9/P10/cache-rules.txt
out of brief: none
[UNVERIFIED]/[UNSOURCED]: cache header VALUES are [UNVERIFIED — Apache] — `php -S` ignores `.htaccess` entirely (GUARDRAILS §4.3); only the rule TEXT is confirmed present and correct, not a live response header
self-corrections: none
---

## Method record (steps 1-5)

**Step 1 — console-clean crawl.** Queried I-crawl's 265 records covering the 10 `KNOWN_ROUTES` + `/no-such-page` + all 42 product pages, each at all 5 viewports (390/834/1440/1920/2560 — a wider sweep than audit 7 §4's original "ten routes plus three product pages crawled"): **0 console errors, 0 failed requests, 0 responses ≥400** across all 265 page×viewport records. Full command and output: `_harness/out/audit9/P10/console-clean.txt`. Repeats and confirms audit 7 §4's "The shipped site throws nothing" on the full 42-product denominator instead of a 3-product sample.

**Step 2 — sweep lines.** Cited, not re-measured: `plan5-images` 12/12 (image weight/dimensions/lazy-loading — every file under the 300 KB single-file budget, total catalog under 3 MB), `plan5-listeners` 11/11 (no ref-callback listener growth), `plan5-keys` 11/11 (no duplicate React keys, measured on the dev-React bundle then restored to production).

**Step 3 — transfer bytes of `/`.** From I-crawl (single-owner measurement, not re-crawled): 390×844 = 694,085 bytes over 8 requests; 1440×900 = 902,129 bytes over 11 requests. The +208,044-byte delta is exactly the three desktop-only site photos (hero `Marker-Sample-2.jpg` 122,132 B, `staff.jpg` 53,770 B, `IPC-Building.jpg` 32,142 B) that the 390 layout does not request at all. `heroImageRequested: false` at 390, `true` at 1440 — **§7.2's "hero photo downloaded on mobile" refutation still holds** on this checkout (0 requests for the hero at 390). Full breakdown by resource type: `_harness/out/audit9/P10/transfer-bytes.txt`. The served JS bundle is 376,817 bytes, matching `build.txt`'s `dist/assets/index-BdtQUPPl.js 376.23 kB` (gzip 108.15 kB) — 0.15% over CLAUDE.md's quoted 375.66 kB baseline, well inside the "not a finding" ±10% band.

**Step 4 — cache rule text.** Confirmed present and correctly scoped by grep (rule TEXT only — `php -S` ignores `.htaccess`, GUARDRAILS §4.3, so the live header value is `[UNVERIFIED — Apache]`):
- `index.html` (and every `.html`): `Cache-Control: no-cache, no-store, must-revalidate` (public/.htaccess:113-114).
- `/assets/*` (Vite's hashed output, scoped via `SetEnvIf Request_URI "^/assets/"`, public/.htaccess:102-103): `public, max-age=31536000, immutable` (:107) — deliberately NOT a bare extension match, per AUDIT_v3 NB1 (a bare match previously also long-cached owner-uploaded, stable-filename images, which would have hidden Rick's own photo/logo replacements from returning visitors for a year).
- Everything else matching the same extension list (owner-editable images, logo): `public, max-age=3600` (:109) — revalidated hourly so an FTP'd or admin-uploaded replacement lands.
- `data/*.json`: `public, max-age=60, must-revalidate` (data/.htaccess:73) — the ~60s figure CLAUDE.md and the admin's own copy (settings.php/content.php/help.php) promise the owner.
- Per-minute cache-buster on **all three** data URLs, confirmed by grep and cross-checked live in the crawl: `products-all.json` (App.jsx:6276-6277, `Math.floor(Date.now()/60000)`), `site-info.json` and `content.json` (both via the shared `useRefetchOnReturn` helper, App.jsx:6589, called at :6628 and :7164 respectively) — that helper's `load()` fires unconditionally on mount and again on visibility/focus past a 60s TTL, so the buster covers the initial fetch, not only the tab-return refetch. Live confirmation: I-crawl's home-page requests show `/data/content.json?v=29823325`, `/data/site-info.json?v=29823325`, `/data/products-all.json?v=29823325` — same `v` value across all three, i.e. the same one-minute window. Full text: `_harness/out/audit9/P10/cache-rules.txt`.

**Step 5 — catalog at 500 products.** `git log --oneline 1826a6d..HEAD -- src/App.jsx` returns exactly one commit (`43d6065`, "Fix A-8.7 and A-8.8: correct two untrue privacy-policy statements"); `git diff 1826a6d -- src/App.jsx` shows its only hunks touch `StructuredData()` (~App.jsx:7183) and the `PRIVACY_SECTIONS` array (~App.jsx:12099-12109) — neither `useProducts`, `DashboardPage`, nor the `/products` catalog-landing code path. Per the brief: **not re-run.** Cited instead — audit7.md §4, "The catalog scales": 42 products (0.10 MB JSON, /dashboard 844 ms, /products 759 ms) → 200 products (0.50 MB, 835 ms, 779 ms) → 500 products (1.24 MB, 883 ms, 883 ms). A 12× catalog costs 39 ms; no scaling cliff.

## Exit
All five steps recorded above. 0 findings.
