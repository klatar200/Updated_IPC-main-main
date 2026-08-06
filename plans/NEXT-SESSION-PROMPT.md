# Prompt for the next session

Copy everything below the line into a fresh Claude Code session.

Supersedes the previous version, which briefed the Plan 2 session. Plan 2 is
now done — see "What Plan 2 shipped" below.

**Correction to the previous version of this file, on the record:** it opened
with "The working tree is DIRTY. Nothing from Plan 1 part B is committed," and
told the next session to ask before committing it. That was already wrong when
it was read. The Plan 1b work **was** committed and pushed as `e0c6b54`
("updated 8.6.2026") on 2026-08-06; a fresh clone gets it with a clean tree.
Do not go looking for uncommitted 4.21 work. Its `src/App.jsx` line-number
table was correct and is now stale again — re-verify before relying on it.

---

## What you are doing

Plans 0, 1 and 2 are complete. **Plans 3, 4 and 5 remain**, and they are
independent of each other — pick one and execute it end to end.

**Read these two files first, in this order, and follow them:**

1. `plans/GUARDRAILS.md` — binding. Scope discipline, hard prohibitions, the
   twelve invariants, how to arm the harness, the handback format.
2. `plans/PLAN-3-lead-capture.md`, `PLAN-4-accessibility.md` or
   `PLAN-5-correctness-perf.md` — whichever you are told to run.

`plans/README.md` has the wider execution order.

**This is not an audit. Do not go looking for new problems.** If you find one,
append it to `WHATS_LEFT.md` §2 with the date, the evidence and the file:line —
and say so in your handback. Do not fix it.

---

## Read this before you trust any line number or any suite name

**`_harness/` is gitignored (`.gitignore:59`) and is NOT in the repo.** It did
not survive the last clone and it will not survive yours. The Plan 2 session
lost the entire regression baseline this way and had to rebuild it from
scratch. Check whether `_harness/` exists on disk **before** you plan around
any suite named below.

What exists now (rebuilt 2026-08-06, in the working tree, untracked):

| File | What it does |
|---|---|
| `sync.sh` | Re-sync the mirror from `dist/` + `admin/`. **Run after every build and every `admin/` edit** |
| `setpw.php` | Sets the mirror password to `audit-pass-123`. Mirror only |
| `lint.php` | `php -l` ×18, `node --check` ×9, JSON parse, **and the NB-copy drift check** |
| `invariants.js` | The twelve invariants, **17 checks**. A reconstruction — not the original 15 |
| `invariants-selftest.js` | Proves each invariant check can fail, on temp copies |
| `copydrift.js` / `-selftest.js` | `$COPY_GROUPS` vs `COPY_DEFAULTS`; fails on drift |
| `skuparity.js` / `.php` | PHP and JS product-reference resolvers must agree |
| `contrastparity.js` / `.php` | The contrast math in all **three** places must agree |
| `copyroundtrip.js` | admin → POST → `content.json` → `mergeContent` → DOM |
| `plan2-sku.js` | 4.12 |
| `plan2-delete.js` | 4.13, incl. measured gaps at 1440/375/touch |
| `plan2-contrast.js` | 4.23, incl. screenshots into `_harness/out/contrast/` |
| `plan2-formlast.js` / `-selftest.js` | `form_complete` last in the rendered DOM |
| `plan2-trunc.js` | Real `max_input_vars=100` truncation + negative control |
| `browser.js` | **Shared Chromium launcher — use it** (see below) |

**Not reconstructed, and nothing is claimed about them:** `b1`, `b2`, `b3`,
`nb2`, `nb4`, `help`, `ttl`, `sweep`, `overflow`, `adminsweep`, `plan0`,
`plan1a`, `plan1b`. If your plan's acceptance names one, you will have to write
it. Budget for that.

---

## Regression baseline — run it BEFORE you start

Green at the end of the Plan 2 session, on `e0c6b54` plus the uncommitted
Plan 2 work:

```
php -l                    18 files, 0 failing        php _harness/lint.php
node --check              9 admin JS files, 0 failing
JSON parse                content 17 / site-info 10 / products-all 42 entries
copy-key drift            96 matched, 0 PHP-only, 0 JS-only
npm run build             0 errors, 328.42 kB JS / 21.11 kB CSS
invariants                17/17    node _harness/invariants.js
invariants-selftest       15/15    node _harness/invariants-selftest.js
copydrift-selftest         5/5     node _harness/copydrift-selftest.js
skuparity                 33/33    node _harness/skuparity.js
contrastparity            28/28    node _harness/contrastparity.js
copyroundtrip             15/15    node _harness/copyroundtrip.js      (:8123)
plan2-sku                 14/14    node _harness/plan2-sku.js          (:8123)
plan2-delete              18/18    node _harness/plan2-delete.js       (:8123)
plan2-contrast            42/42    node _harness/plan2-contrast.js     (:8123)
plan2-formlast             8/8     node _harness/plan2-formlast.js     (:8123)
plan2-formlast-selftest   PASS     node _harness/plan2-formlast-selftest.js
plan2-trunc               13/13    node _harness/plan2-trunc.js  (:8123 :8124 :8125)
```

**Build size: 328.42 kB is the current correct figure.** GUARDRAILS §4.1 still
records 325.78 kB (from `6284708`) and the previous prompt said 326.80 kB
(after Plan 1b). Plan 2's ink variables account for the difference. Not a
regression.

---

## Arming the harness

```bash
npm install
npm run build
./_harness/sync.sh          # includes setpw.php
```

Then start three servers from `_harness/`. **`nohup php -c … -S … &` works
fine in this environment** — the older note claiming the Bash guard blocks it
and that you must use PowerShell's `Start-Process` is wrong for this container,
and there is no PowerShell tool here anyway:

| Port | ini | Purpose |
|---|---|---|
| 8123 | `php-extra.ini` | Main. `display_errors=On`, `max_input_vars=10000` |
| 8124 | `php-trunc.ini` | `display_errors=Off`, `max_input_vars=100` — real truncation |
| 8125 | `php-nb2-off.ini` | `display_errors=On`, `max_input_vars=100` — negative control |

Verify each port really loaded its own ini before trusting a result — write a
one-line probe echoing `ini_get('max_input_vars')`, hit all three, delete it.

**When you finish, delete `_harness/site/admin/config.local.php`** — it carries
a throwaway credential — and stop the three PHP processes.

---

## Environment notes learned the hard way

- **Playwright.** `npm install -D playwright` gets a version whose expected
  Chromium build does **not** exist in this image (`chromium_headless_shell-1234`
  vs the installed `chromium-1194`). Do **not** run `npx playwright install`.
  Launch through `_harness/browser.js`, which points at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Playwright is now in
  `devDependencies` — dev-only, not bundled, $0.
- **`nav.php` renders the Sign Out form BEFORE the page's own form.** This cost
  two debugging rounds in one session. `page.click('button[type="submit"]')`
  logs you out; `document.querySelector('form[method="POST"]')` matches a
  2-control form. Anchor on something unique to the form you want —
  `button:has-text("Save Content")`, `input[name="orig_sig"]`.
- **Measure text contrast only on elements with a DIRECT text node.** A wrapper
  whose text comes from children reports its own inherited color, which nothing
  paints. That produced a false "black on brand" failure.
- **Page-wide `includes()` assertions pass vacuously.** An industry name also
  appears in the form field below the warning, so a body-wide match "passed"
  against code that emitted no warning at all. Scope to the element.
- **Playwright selectors must be visibility-aware.** `/products` renders a
  mobile card list *and* a desktop table; at 1440 the mobile one is
  `display:none` and a naive `querySelectorAll(...)[0]` grabs the hidden twin.
- **`php -S` ignores `.htaccess` and `.user.ini`.** Label anything depending on
  them `[UNVERIFIED]`.
- Multi-line git commit messages: use the stdin heredoc (`git commit -F - <<'EOF'`).
- Vite's dev server answers unknown paths with `index.html` and a **200**, so
  `res.ok` does not detect a missing JSON file.

---

## Guardrails — the short version, but read GUARDRAILS.md in full

**The premise.** The admin's audience is **Rick**: the business owner,
non-technical, around 60, who uses FTP reluctantly. The public site's audience
is a buyer looking for a spec-grade part. Every judgement call is settled by
asking which of those two it protects. A change that is technically superior
but makes the admin harder for Rick, or that risks a sales lead, is the wrong
change.

**Scope discipline is the single most important rule.** Execute exactly one
plan. Do not fix items belonging to another plan even when the fix is obvious
and you are already in the file. Every item has an acceptance test tied to it;
a change that arrives outside its plan arrives without its test. Do not
refactor anything you were not asked to refactor.

**Hard prohibitions, no plan-level exception:**

- No `git checkout`, `reset`, `stash`, `revert`, `rebase`, `push --force`, or
  `commit` **unless explicitly asked in the current conversation**.
- Never edit `DEPLOY_READINESS_v2.md`. Frozen.
- Never write a real password hash into `admin/config.php`.
- Never commit `admin/config.local.php`. **The repo is public.**
- Never modify `data/*.json`, `pdfs/`, or `uploads/` — live customer state.
  `_harness/pristine/` holds the references; restore and `cmp` before finishing.
- Never use `preg_replace` on anything writing a bcrypt hash — use
  `preg_replace_callback`.
- **Never add a form field after `form_complete` in `admin/content.php`.** It is
  the `max_input_vars` sentinel, enforced positionally. It is now asserted three
  ways and your change will go red.
- No paid dependency, service or tier. $0 budget.
- Do not resume the `src/pages/` `src/components/` `src/lib/` extraction.
- Do not touch `_localsite/`.

**The twelve invariants** are in `CLAUDE.md`. After any change run
`node _harness/invariants.js` — expected **17/17**. If your change makes one
fail, your change is wrong until you prove otherwise with an artifact.

**Verification is not optional.** Never report something as fixed without the
artifact that proves it. **Write the test first when the item is a defect** —
reproduce the symptom, watch the check fail, then fix it. A check that has
never failed proves nothing. Every Plan 2 suite has a matching `-selftest` or a
recorded before/after for exactly this reason; follow that shape.

**Escalate business calls; decide engineering calls yourself.** Escalate spend,
credentials, irreversible data operations, and public-facing copy. Form:

```
decision-needed | recommended | why | trade-off | blocked
```

Log escalations in `WHATS_LEFT.md` §3 **before** writing dependent code.

---

## What Plan 2 shipped (do not redo any of it)

- **NB-copy** — `$COPY_GROUPS` and `COPY_DEFAULTS` enumerated mechanically:
  **96 fields, 12 groups, zero drift in either direction.** The feared defect
  had never actually occurred. Drift is now a failing check in `lint.php`. The
  old "~450 posted keys" figure was wrong — that is the whole form (421 named
  controls), not the `copy` subset.
- **4.12** — Industries product codes validated on save, **warning without
  blocking** (Keagan's decision, `WHATS_LEFT.md` §3). Uses a three-tier matcher
  mirroring the site's own lookup, because exact matching produced 5 false
  alarms out of 18 shipped references.
- **4.13** — the delete ✕ confirms and names the row; measured gap 6.0 px →
  34 px, touch target 28×28 → 44×44.
- **4.23** — three `--brand-*-ink` variables derived by WCAG luminance replace
  hardcoded white at 35 sites; the admin prints the ratio in plain language,
  live, and never blocks the save. **Partial — see below.**
- **`form_complete`** — asserted in the rendered DOM (421 named controls) and
  against a real truncating server.

## Three things Plan 2 left open, all in `WHATS_LEFT.md` §2

- **`brand-ink-translucent`** — the largest, and the obvious next piece of
  4.23. **47 translucent-white foregrounds on owner-controlled brand surfaces**
  still hardcode `rgba(255,255,255,α)` and wash out on a pale brand color.
  Already classified by `_harness/findtranslucent.js`: header 17, primary 14,
  dark 8, navbar 8 — plus hero-scrim 1 and footer-fixed 5 that must **stay**
  white. The clean fix is `--brand-*-ink-rgb` variables consumed as
  `rgba(var(--brand-dark-ink-rgb), 0.6)`. Not done because per-site surface
  classification is heuristic and a wrong guess creates a new contrast bug the
  4.23 suite would not catch — it only measures elements painted with
  `--brand-primary`. See `_harness/out/contrast/pale-yellow-1440.png`: it shows
  the fixed and unfixed surfaces side by side.
- **`brand-color-as-foreground`** — brand colors used as *text on white*
  (~30 sites: feature chips, eyebrow labels). The ink variables do not help;
  that case needs the color darkened for text use.
- **`sidebar-active-border`** — unchanged, still parked. `src/App.jsx` sets
  `borderLeft` then `border: "none"` two lines later in the same style object,
  so the selected product never shows its indicator. Pre-existing, belongs to
  no plan. Leave it alone unless asked.

---

## Still awaiting Keagan, not yours to decide

- **`SITE_ORIGIN`** — `https://www.insulationproducts.com`, matching
  `sitemap.xml`, `robots.txt` and `index.html`. `www` vs apex never confirmed.
  Do not change it; do not block on it.
- **The `169c0d7` git-history rewrite** for the exposed config hash, and the
  **`products-all.json` upload** question — both in `WHATS_LEFT.md` §3.
- **`sitemap.xml` lists `/dashboard`** at priority 0.8; whether that route
  should be publicly indexed was never established.

---

## Working rules

- **At most 3 fix attempts, then stop and escalate.** Three failures means your
  model of the problem is wrong.
- **Fix rounds are delta-only.** Change only what the failing check demands.
- `WHATS_LEFT.md` is **append-only**. Supersede, never silently rewrite. Mark a
  corrected line `SUPERSEDED-BY` with the date; `AMENDED` is for a claim true in
  substance but wrong in detail. Shipped items go in §1b, new open items in §2,
  evidence in a new §4-series block — the next one is **§4h**.
- **Do not re-report** the items closed with evidence in GUARDRAILS §7.

## Handback

GUARDRAILS §8 format, short and dense: **Fixed** (each with the output or
measurement that proves it) → **Not fixed and why** → **Escalations** →
**Records corrected** → **Regression state, before and after**.

State plainly what you did **not** do. Scaling the work down is the owner's
call, not the executor's.

**Do not commit or push unless asked.**
