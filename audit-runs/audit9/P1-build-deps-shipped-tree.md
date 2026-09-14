# P1 — build, dependencies, and the shipped tree          agent: D   started/finished: 2026-09-14 15:10 / 15:35   mirror: none (file-only, no server)
findings:   Blocker 0 · High 0 · Medium 0 · Low 1
| ID | sev | class | where | one line |
| A-9.D1 | Low | code | `package-lock.json` (transitive: browserslist, baseline-browser-mapping, postcss-selector-parser) | 3 new-since-A-7.10 npm advisories are all build-time-only and unreachable, but a free lockfile-only `npm audit fix` (no `--force`) is available and unapplied |
ledger:     done E053, E054, E099, E104, E108, E111, E172, E173   blocked none
suites cited: none (P1 is file-only per brief; no sweep suite covers `dist/` reproducibility or `npm audit`)
instruments: none — no new instrument named by this brief
artifacts:  _harness/out/audit9/P1/hashes-dist.txt, hashes-dist2.txt, hashes-dist2-raw.txt — sha256 of every file in `dist/` and the rebuild, byte-identical
            _harness/out/audit9/P1/dist2/ — second `vite build --outDir` output
            _harness/out/audit9/P1/npm-audit.json — full `npm audit --json`
            _harness/out/audit9/P1/audit-fix-dryrun.json, npm-audit-fix-dryrun-summary.txt — `npm audit fix --dry-run` evidence
out of brief: none
[UNVERIFIED]/[UNSOURCED]: none
self-corrections: none
---

## Method, step by step (brief §Method 1–8)

**1. `npm ci` result (Phase 0).** `_harness/out/audit9/npm-ci.txt`: `added 135
packages, and audited 136 packages in 5s`, `exit=0`. This is a clean `npm ci`
run — no fallback to `npm install`, no lockfile diff. `git log -1` on
`package-lock.json` shows it committed at `62ec58a`, untouched this session.
**Not a finding** — the lockfile is authoritative.

**2. Second build, hash, diff.** `npx vite build --outDir _harness/out/audit9/P1/dist2`
produced the identical content-hashed filenames on the first try
(`index-DyC-SD2K.css`, `index-BdtQUPPl.js`) — Vite's content hash already
proves byte-identity of the hashed assets, and a full-tree `sha256sum` +
`diff` over both trees (files renamed to a common `dist/` prefix for the
comparison) confirms it for every file, hashed name or not:
`diff hashes-dist.txt hashes-dist2.txt` → **exit 0, zero lines of diff**.
Reproducible. **Not a finding.**

**3. `ls -A dist` vs the eleven-item manifest.** `ls -A dist` (repo root) →
`.htaccess .user.ini assets contact.php favicon.svg images index.html logo.svg
manifest.json robots.txt sitemap.php` — **exactly 11**, and exactly the set
named in `GO-LIVE.md` B1 and `README.md:116`. No source map, no dev artifact,
no `products-all.json` copy (the T3.1 incident does not recur). **Not a
finding.**

**4. `grep -rl "localhost\|127.0.0.1\|example.com\|sourceMappingURL" dist/`** →
one hit: `dist/contact.php`. Read in context (`dist/contact.php:377`, byte-equal
to `public/contact.php` per step 7): it is a **code comment** documenting the
A-5.1/A-6.3 phishing-link fix, quoting the attack strings
`evil-example.com/ipc-pay` and `ipc-billing.net/pay` that the shipped regex was
measured to catch. `example.com` there is substring of a security-comment
example, not a leaked dev/test host, not reachable output, not `localhost`/
`127.0.0.1`/a source map. **Checked, no finding.** `placehold.co` appears in
`dist/assets/*.js` and `dist/.htaccess` as expected (P4's data-driven
placeholder host, not this pass's concern per the brief).

**5. Bundle size vs the 2026-08-27 baseline (375.66 kB JS / 23.59 kB CSS).**
`_harness/out/audit9/build.txt`: `index-BdtQUPPl.js 376.23 kB`,
`index-DyC-SD2K.css 23.59 kB`. JS: +0.57 kB = **+0.15%**. CSS: **0%** (byte-for-
byte same figure). Both well under the 10% gate. **Not a finding.**

**6. `npm audit` vs A-7.10's baseline.** `npm audit --json` (exit 1, findings
present): **7 vulnerabilities — 1 low, 4 moderate, 2 high**
(`_harness/out/audit9/P1/npm-audit.json`). `audit-runs/audit7.md` "What is left
after A-7.10" recorded exactly **4**, all re-derived unreachable: `esbuild`/
`vite` (dev-server only, never in `dist/`), `react-router` SSR hydration
(no SSR anywhere in the tree — `createRoot`, not `hydrateRoot`), `react-router`
open-redirect-via-backslash (`navigate()` has exactly 3 call sites, all through
`pageToPath()`, fed only literals and a `content.json` `'page'`-type field
`content.php` validates against a fixed options map). Those four packages are
still present, unchanged, and the argument is unchanged — re-checked
`navigate(` call sites this round: still exactly 3, still all literal/validated
inputs, so **A-7.10's rows 1–3 do not need re-deriving**, per the brief's "not a
finding" clause; recorded here as confirmed, not re-argued.

Three advisories are **new since A-7.10** and each was re-derived fresh, never
copied from the old argument:

| Package | Advisory | Where it comes from | Reachability |
|---|---|---|---|
| `baseline-browser-mapping` | GHSA-w5vr-8v7q-w6rv, moderate — process termination on invalid input | transitive: `autoprefixer` → `browserslist` → `baseline-browser-mapping` (`npm ls --all` confirms the chain) | **Unreachable.** `devDependency`-only, invoked once per `npm run build` against this repo's own static `browserslist` targets (none configured beyond the packages' defaults — no `.browserslistrc`/`browserslist` key in `package.json`). No user or network input ever reaches it; nothing it does ships into `dist/`. |
| `browserslist` | GHSA-c83g-rgw3-j3cx (unbounded memory growth) and GHSA-73wf-gq98-2v4g (crash via untrusted `browserslist-stats.json`) | same chain, direct | **Unreachable.** The crash needs a `browserslist-stats.json` the build loads; `find . -iname browserslist-stats.json` (repo, excl. `node_modules`) is empty and no config references one. Build-time only, static queries, no external data source. |
| `postcss-selector-parser` | GHSA-w9m9-85wc-3x92, low — DoS via uncontrolled AST recursion | transitive: `tailwindcss` → `postcss-selector-parser` (direct dep of `tailwindcss`, also via `postcss-nested`) | **Unreachable.** Parses this repo's own `src/index.css` and Tailwind's utility selectors at build time; no visitor-supplied or admin-supplied CSS/selector ever reaches PostCSS. |

All three are build-tooling-only, matching the *class* of A-7.10's `esbuild`/
`vite` row but independently re-derived per the brief (not copied). **`npm audit
fix` (no `--force`) closes all three** — dry run
(`_harness/out/audit9/P1/audit-fix-dryrun.json`,
`npm-audit-fix-dryrun-summary.txt`) shows 7 lockfile-only version bumps
(`postcss-selector-parser`, `update-browserslist-db`, `browserslist`,
`baseline-browser-mapping`, `caniuse-lite`, `node-releases`,
`electron-to-chromium`), `package.json` untouched, and the audit count would
return to **7 → 4**, landing exactly on A-7.10's remaining four. **Not applied**
— this pass does not fix (GUARDRAILS §1, launch prompt). Recorded as **A-9.D1,
Low** below for C to action, mirroring A-7.10's own precedent (a free,
reachability-irrelevant `npm audit fix` sitting unrun is itself the finding,
not the advisories).

**7. Dotfiles and PHP parity.** `.htaccess` and `.user.ini` both present in
`dist/` (step 3). `cmp dist/contact.php public/contact.php` and
`cmp dist/sitemap.php public/sitemap.php` — both **identical**, no output, exit
0. `cmp dist/.htaccess public/.htaccess` and `cmp dist/.user.ini
public/.user.ini` — also identical. **Not a finding.**

**8. Repo-only paths absent from `dist/`.** `find dist -iname "*.md"` → empty.
`find dist -path "*_harness*" -o -path "*audit-runs*" -o -path "*plans*"` →
empty (only match was the search root `dist` itself, excluded). **Not a
finding.**

## Findings

### A-9.D1 — Low — a free, unreachable-only dependency cleanup is sitting unapplied

class:        code
pass:         P1     ledger: E172
surface:      `package-lock.json`
where:        `package-lock.json` (transitive deps of `autoprefixer`/`tailwindcss`), measured on `2121597`, 2026-09-14
not in §11:   checked `audit-runs/audit7.md` "What is left after A-7.10" — different set of packages (that row is `esbuild`/`vite`/`react-router`/`react-router-dom`, still open and still correctly unreachable, not re-argued here); this finding is the **three new** advisories (`baseline-browser-mapping`, `browserslist`, `postcss-selector-parser`) that appeared since then
reproduce:    `npm audit --json` on a clean `npm ci` install → 7 vulnerabilities (1 low, 4 moderate, 2 high); `npm audit fix --dry-run --json` → 7 changed lockfile entries, 0 `package.json` changes, resulting count 4
observed:     `_harness/out/audit9/P1/npm-audit.json`, `audit-fix-dryrun.json`
expected:     Per `audit-runs/audit7.md` A-7.10's own lesson ("recommended twice and never run"), a lockfile-only fix with no functional risk should be taken when found, rather than left for a future audit to re-discover
consequence:  None today (all three are build-time-only, unreachable per the table above) — this is hygiene, not a live exposure. Left alone, it recreates A-7.10's exact pattern: the fix stays free and un-taken until a future audit re-flags it, and `npm audit`'s headline count (7) reads worse than the site's real exposure (0 reachable) to anyone skimming it.
evidence:     `_harness/out/audit9/P1/npm-audit.json`, `_harness/out/audit9/P1/audit-fix-dryrun.json`, `_harness/out/audit9/P1/npm-audit-fix-dryrun-summary.txt`
verified-by:  (pending V)
outcome:      (pending C/V — recommend: `npm audit fix` with no `--force`, verify `package.json` untouched and `npm run build` unchanged after, per this pass's steps 2/5)
fix-proof:    n/a — not fixed by this pass
