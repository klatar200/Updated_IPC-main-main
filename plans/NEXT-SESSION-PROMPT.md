# Prompt for the next session

Copy everything below the line into a fresh Claude Code session.

Supersedes the previous version of this file, which briefed the 4.21 session.
4.21 is now done — see "What you are inheriting" below.

---

## What you are doing

You are continuing the IPC website release. **Plan 1 is complete.** You are
executing **Plan 2 — owner safety**, which is five items:
**NB-copy**, **4.12**, **4.13**, **4.23**, and the **`form_complete` position**
guard.

**Read these two files first, in this order, and follow them:**

1. `plans/GUARDRAILS.md` — binding. Scope discipline, hard prohibitions, the
   twelve invariants, how to arm the harness, the regression baseline, the
   handback format.
2. `plans/PLAN-2-owner-safety.md` — your specification. Do **NB-copy first**;
   it is the one that silently destroys Rick's work.

`plans/README.md` has the execution order for all six plans if you need the
wider picture. Plans 2, 3 and 5 are independent of each other; Plan 4 must come
after Plan 1 (which is done, so Plan 4 is now unblocked too).

**This is not an audit. Do not go looking for new problems.** If you find one,
append it to `WHATS_LEFT.md` §2 with the date, the evidence and the file:line —
and say so in your handback. Do not fix it.

---

## What you are inheriting

### The working tree is DIRTY. Nothing from Plan 1 part B is committed.

`main` is at `a0b07e1`. `git status` shows:

```
 M WHATS_LEFT.md
 D dist/assets/index-BJysecbm.js
 M dist/index.html
 M src/App.jsx
```

Plus untracked `dist/assets/index-CazmPdy-.js` and three new `_harness/` files.
That is the finished, fully verified 4.21 work — it was left uncommitted only
because the previous session was told not to commit.

**Ask the user whether to commit it before you start.** Do not commit without
being asked (GUARDRAILS §2), and do not start Plan 2 on top of uncommitted Plan 1
work without flagging it first — if Plan 2 goes wrong you will have no clean
point to reason from.

If you are asked to commit, `dist/` is **gitignored but partially tracked**, so
a plain `git add dist/...` fails. The sequence is:

```bash
git rm --cached dist/assets/index-BJysecbm.js
```

then delete that file from disk if it is still there, then
`git add -f dist/assets/index-CazmPdy-.js dist/index.html`, then the rest
normally. Use the stdin-heredoc form for the commit message — see
"Environment notes" below.

### What 4.21 shipped (do not redo any of it)

Navigation was `<button onClick>` throughout — **63 `<button>` against 15
`<a href>`** — so crawlers found no internal link graph and Ctrl/Cmd-click,
middle-click and "Copy Link Address" all did nothing.

One new component, `PageLink` (`src/App.jsx:168`, helper `pageHref` at `159`),
now renders a real `<a href>` for every page-changing control. It:

- builds the `href` from the existing `pageToPath` (`src/App.jsx:14`), so an
  href can never drift into a crawlable 404;
- returns early **without** `preventDefault()` when `metaKey`/`ctrlKey`/
  `shiftKey`/`altKey` is set or `button !== 0` — that is what restores
  open-in-new-tab, and it is the requirement most likely to be broken by a
  careless edit;
- otherwise `preventDefault()`s and makes the **single batched**
  `setSearchParams({ ...params, page })` call. Do not split that into two calls;
  react-router v6 reads `prev` from the current URL and the second call loses
  the first.

Converted: `Navbar` (logo, Home, both dropdowns, category chips, CTA, the whole
mobile drawer), `Footer`, hero/CTA buttons, market cards, `FeatureCard`,
`SectionHeader`'s `action` (its shape changed from `{label, onClick}` to
`{label, page, params}`), both "View Product" controls, the industry product
lists, and **`ProductSidebar`'s two product lists** — its `onSelect` prop wrote
`?productId=` to the URL, so it was navigation; it is now `onNavigate` and
carries only the scroll/sticky-bar side effects.

`nav()`, `handleViewProduct()` and `setSelectedId` became dead and were removed.

**Left as `<button>` deliberately** — do not "finish the job" by converting
these; they do not change the page and an anchor would need a meaningless href:
dropdown/accordion/menu toggles including every `setOpenDropdown`, the
hamburger, the catalog-failure reload control, form submits, the search box and
its clear control, "Submit Another", `ProductSidebar`'s family filter pills and
family accordion headers, and the sort headers (**Plan 4 owns those**).

Result: 30 `<button>`, 59 anchors, 51 distinct internal hrefs, all 200 through
the real rewrite. Evidence is in `WHATS_LEFT.md` §4f.

### New harness files

| File | What it does |
|---|---|
| `_harness/plan1b.js` | The 4.21 acceptance suite — **45 checks**. Needs `npm run dev` on `:5173` **and** the mirror on `:8123`. Run it after any change to navigation or `src/App.jsx`'s routing shim |
| `_harness/shots.js` | `node _harness/shots.js <label>` → 10 header/footer/dropdown/mobile-menu screenshots at 1440 and 375 into `_harness/out/<label>/`. Used for byte-identical before/after comparison |
| `_harness/sidebarshot.js` | Same idea for `ProductSidebar` at both viewports |

`_harness/out/before/` and `_harness/out/after/` hold the 4.21 comparison —
all ten pairs are byte-identical. Leave them; they are the evidence.

### One open item was found and deliberately NOT fixed

`WHATS_LEFT.md` §2 now carries **`sidebar-active-border`**: `ProductSidebar`'s
desktop rows set `borderLeft: active ? …` and then `border: "none"` two lines
later in the same style object, so React's in-order application wipes it and the
selected product never shows its left indicator (measured: computed
`border-left-width: 0px`). It is **pre-existing** — identical at
`HEAD:src/App.jsx:5385-5388` where the element was still a `<button>` — and it
belongs to no plan. Current location `src/App.jsx:5488-5491`. **Leave it alone**
unless the user asks; it is parked, not forgotten.

---

## Plan 2's line numbers for `src/App.jsx` are STALE — use these

`plans/PLAN-2-owner-safety.md` was written against `6284708`. `src/App.jsx` has
since grown from Plans 0, 1a and 1b and is now **9,153 lines**. Re-verified
today:

| Plan 2 says | Actually | What it is |
|---|---|---|
| `COPY_DEFAULTS` at `src/App.jsx:4620` | **`src/App.jsx:4760`** | The JS side of the NB-copy comparison |
| — | `src/App.jsx:4958` | `mergeContent` — iterates `Object.keys(defaults)`, the mechanism of the bug |
| — | `src/App.jsx:4622` | `SITE_CLEARABLE` (invariant 4 allow-list) |
| — | `src/App.jsx:4956` | `COPY_CLEARABLE` |
| — | `src/App.jsx:5170` | `ThemeInjector` — where 4.23's color injection lives |
| — | `src/App.jsx:4270` | `SITE_ORIGIN` |
| — | `src/App.jsx:4294` | `GlobalStyles` |

`admin/content.php` was **not** touched this session, and its references still
hold — but they had drifted slightly from the plan anyway:

| Plan 2 says | Actually | What it is |
|---|---|---|
| `$COPY_GROUPS` at `:257` | **`:257`** ✓ | The PHP side of the comparison |
| repopulation at `:520` | **`:527`** | `if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($errors))` — the B1 path 4.12 must not break |
| `form_complete` at `:727` | **`:734`** | The `max_input_vars` sentinel. Its check is at `:400` |

**Verify every one of these yourself with `Read` before you rely on it.** The
bash mount has returned truncated reads in this repo before; if `Read` and a
shell command disagree, `Read` wins, and say so in the handback.

---

## Guardrails — the short version, but read GUARDRAILS.md in full

**The premise.** The admin's audience is **Rick**: the business owner,
non-technical, around 60, who uses FTP reluctantly. The public site's audience is
a buyer looking for a spec-grade part. Every judgement call is settled by asking
which option protects one of those two people. A change that is technically
superior but makes the admin harder for Rick, or that risks a sales lead, is the
wrong change. Plan 2 is entirely about Rick.

**Scope discipline is the single most important rule.** Execute exactly one plan.
Do not fix items belonging to another plan even when the fix is obvious and you
are already in the file. Every item has an acceptance test tied to it; a change
that arrives outside its plan arrives without its test. Do not refactor anything
you were not asked to refactor — renaming, reformatting, extracting helpers,
"while I was here" tidying all count as straying.

**Hard prohibitions, no plan-level exception:**

- No `git checkout`, `reset`, `stash`, `revert`, `rebase`, `push --force`, or
  `commit` **unless explicitly asked in the current conversation**. The working
  tree has repeatedly been the only copy of hours of work — and right now it
  literally holds all of Plan 1 part B.
- Never edit `DEPLOY_READINESS_v2.md`. Frozen; its value is that it did not change.
- Never write a real password hash into `admin/config.php`. It defines an
  unsatisfiable sentinel on purpose.
- Never commit `admin/config.local.php`. **The repo is public.**
- Never modify `data/*.json`, `pdfs/`, or `uploads/` — live customer state.
  `_harness/pristine/` holds the reference copies; if a test writes to `data/`,
  restore and prove byte-identity with `cmp` before finishing. **Plan 2's
  NB-copy and 4.23 items both write to `data/`, so this will bite you.**
- Never use `preg_replace` on anything writing a bcrypt hash — every hash
  contains `$2y$12$` and those are backreferences. Use `preg_replace_callback`.
- **Never add a form field after `form_complete` in `admin/content.php`.** It is
  the `max_input_vars` truncation sentinel, enforced positionally. Plan 2's last
  item is literally about protecting this — do not violate it while doing so.
- No paid dependency, service or tier. $0 budget.
- Do not resume the `src/pages/` `src/components/` `src/lib/` extraction. Settled
  and closed — nothing imports them, editing them has zero effect on the bundle.
- Do not touch `_localsite/`. It is evidence, not source.

**The twelve invariants** are in `CLAUDE.md`; each caused a real named defect and
carries an inline comment naming its incident. After any change run:

```bash
node _harness/invariants.js
```

Expected **15 checks, 0 failing**. If your change makes one fail, your change is
wrong — not the test — until you prove otherwise with an artifact.

Three matter directly to Plan 2:

- **Invariant 3** — `mergeContent` treats an empty array as a *deletion*, not
  "unset". `Array.isArray(v) ? v : dv` is correct; adding `&& v.length` re-seeds
  hardcoded defaults when Rick deletes every row of a section, including stale
  legal text republishing itself. **NB-copy works inside `mergeContent`.**
- **Invariant 4** — `mergeSiteInfo` drops blank strings except `SITE_CLEARABLE`.
  `settings.php` rebuilds `site-info.json` wholesale, so a missing field arrives
  as `""`. **4.23 edits `settings.php`.** A newly-clearable field goes in the
  allow-list; the blank-drop default stays.
- **Invariant 6** — `form_complete` stays last. See above.

**Security posture is verified — re-verify it, do not re-derive it.**
`require_auth()` on every admin page before any output; `csrf_check()` after it
on every mutating POST (login excepted); uploads validated by extension **and**
sniffed MIME; `basename()` + `realpath()` containment; every dynamic echo through
`h()`; optimistic-concurrency signatures on `edit.php`, `settings.php`,
`content.php`. If you add a POST path it gets `csrf_check()` too, and
`adminsweep.js` asserts a rendered 403 with **no `Location` header** — invariant
12 exists because a 302 turns a POST into a GET and silently discards everything
Rick typed.

---

## Verification is not optional

**Never report something as fixed without the artifact that proves it.** "I
updated the code and it should now work" is not a result. A command's output, a
browser measurement, or a failing-then-passing test is.

**Write the test first when the item is a defect.** Reproduce the symptom, watch
the new check fail, *then* fix it. A check that has never failed proves nothing —
two invariant checks in session 3 passed against a broken assertion because they
were matching incident comments that quoted the old buggy pattern. Plan 2 asks
for this explicitly twice: the NB-copy drift check must be shown failing on a
bogus `$COPY_GROUPS` key, and the `form_complete` check must be shown failing
with a field temporarily added after the sentinel. **Show both directions.**

Follow `_harness/plan1b.js`'s shape for anything new — it is the most recent
example and it was watched failing before the fix went in.

### Regression baseline — run the whole set BEFORE you start

This is the state you are inheriting. It was fully green at the end of the 4.21
session. Anything you land must leave every line at least as green:

```
php -l                    19 files, 0 failing        php _harness/lint.php
node --check              8 admin JS files, 0 failing
JSON parse                content 17 / site-info 10 / products-all 42 entries
npm run build             0 errors, 326.80 kB JS / 21.02 kB CSS
B1   20/20                node _harness/b1.js
B1 truncation 5/5         node _harness/b1trunc.js      (needs :8124)
B2   18/18                node _harness/b2.js
B3   25/25                node _harness/b3.js
NB2  10/10                node _harness/nb2.js          (needs :8124 and :8125)
NB4  17/17                node _harness/nb4.js
help 22/22                node _harness/help.js
invariants 15/15          node _harness/invariants.js
TTL  3/3                  node _harness/ttl.js
public sweep              18 loads, 0 failing          node _harness/sweep.js
overflow                  42 product pages @375px, 0 overflow   node _harness/overflow.js
admin sweep               5/5                          node _harness/adminsweep.js
plan0  9/9                node _harness/plan0.js        (needs :5173)
plan1a 43/43              node _harness/plan1a.js       (needs :5173)
plan1b 45/45              node _harness/plan1b.js       (needs :5173 and :8123)
```

Note the build size: GUARDRAILS §4.1 still records **325.78 kB**, which is the
figure from `6284708`, before Plans 0 and 1 landed. **326.80 kB is the current
correct baseline** — do not treat the difference as a regression.

Plan 2 is heavily admin-side, so `b1`, `b1trunc`, `b2`, `b3`, `nb2`,
`adminsweep` and `help` are the suites most likely to move. Run them often, not
just at the end.

### Arming the harness

`_harness/` is gitignored, ~30 MB, and must never be deployed. It is a
`public_html` mirror served by `php -S`.

```bash
php _harness/setpw.php
```

Sets the admin password to `audit-pass-123` **in the mirror only**, via
`preg_replace_callback`. Then start three servers from `_harness/`:

| Port | ini | Purpose |
|---|---|---|
| 8123 | `php-extra.ini` | Main. `display_errors=On`, default `max_input_vars` |
| 8124 | `php-trunc.ini` | `display_errors=Off`, `max_input_vars=100` — forces genuine truncation |
| 8125 | `php-nb2-off.ini` | `display_errors=On`, `max_input_vars=100` — the NB2 negative control |

Each runs `php -c <ini> -S 127.0.0.1:<port> -t site router.php`. **The Bash guard
blocks `php -c … -S`**, so launch them with the PowerShell tool's
`Start-Process … -WindowStyle Hidden`, then confirm with `Test-NetConnection`.

**When you finish, delete `_harness/site/admin/config.local.php`** — it carries a
throwaway credential and must not survive the session — and stop the three PHP
processes.

### Re-sync the mirror after every build, or you will test stale code

This has caused false passes before:

```bash
rm -rf _harness/site/assets
cp -r dist/. _harness/site/
cp admin/*.php _harness/site/admin/
cp admin/*.js  _harness/site/admin/
cp _harness/pristine/content.json      _harness/site/data/content.json
cp _harness/pristine/site-info.json    _harness/site/data/site-info.json
cp _harness/pristine/products-all.json _harness/site/data/products-all.json
php _harness/setpw.php
```

Then confirm the mirror's `index.html` names the hash you just built —
`grep -o 'index-[A-Za-z0-9_-]*\.js' _harness/site/index.html` — before believing
any result. **Plan 2 edits `admin/*.php` heavily, so the `cp admin/*` lines are
the ones that will catch you out.**

### What `php -S` cannot test

It ignores **both** `.htaccess` and `.user.ini`. Anything depending on them is
reasoning from the rule text, not measurement, and must be labelled
`[UNVERIFIED]` in your handback. Concretely unverifiable locally: the
`SetEnvIf`-scoped cache (NB1), the dotfile block (NB15), the
`ALLOW-PASSWORD-RESET` block (NB14), and every limit in `public/.user.ini` —
including `display_errors=Off`, which the B1 truncation guard depends on. Do not
report those as passing.

---

## Environment notes learned the hard way

- **`npm run dev` on `:5173`** now serves the real `data/` folder through a Vite
  middleware in `vite.config.js` (Plan 0). `plan0.js`, `plan1a.js` and
  `plan1b.js` all need it. **A dev server belonging to a different chat session
  may already be holding port 5173** — `preview_start` will refuse with a
  port-in-use error. That is fine: check it is live and serving this project
  (`curl -s http://localhost:5173/data/content.json`) and just use it. Do not
  try to kill another session's server.
- **The Bash guard blocks** `$VAR` expansion, `$(...)`, `php -r`, `node -e`,
  `python -c`, `for f in …; do …$f`, `sed -i` with `$_POST` in the pattern, and
  redirects to paths outside the project. Write `.php`/`.js` script files into
  `_harness/` instead of inlining code, and inline literal paths.
- **Multi-line git commit messages** must use the stdin heredoc — it is the one
  supported path:
  ```
  git commit -F - <<'EOF'
  <title>

  <body>
  EOF
  ```
  Not `git commit -m "$(cat <<EOF)"` (blocked), not a `.git/COMMIT_*` temp file,
  not `/tmp/*_msg.txt`.
- **The browser tool's console log accumulates across navigations.** Open a fresh
  tab before asserting "zero console errors". Its screenshot action also fails
  with "the Browser pane is not displayed" when the pane is hidden — use a
  Playwright script in `_harness/` for screenshots instead, which is what
  `shots.js` and `sidebarshot.js` do.
- **Playwright selectors must be visibility-aware.** `/products` renders a mobile
  card list *and* a desktop table; at 1440 the mobile one is `display:none`, and
  a naive `querySelectorAll(...)[0]` grabs the hidden twin and hangs for 30 s.
  Filter on `offsetParent !== null || getClientRects().length > 0`.
- A stale `.git/index.lock` from a crashed process appeared once. Check for a
  running `git` process before removing it.

---

## Still open, not yours to decide

- **`SITE_ORIGIN`** (`src/App.jsx:4270`) is `https://www.insulationproducts.com`,
  matching `sitemap.xml`, `robots.txt` and `index.html`. Keagan has been asked to
  confirm `www` vs the apex and has not answered. Do not change it; do not block
  on it.
- **The `169c0d7` git-history rewrite** for the exposed config hash, and the
  **`products-all.json` upload** question — both in `WHATS_LEFT.md` §3, both
  awaiting Keagan.
- **`sitemap.xml` lists `/dashboard`** at priority 0.8; whether that route should
  be publicly indexed was never established. Recorded in §2, noticed during
  Plan 1, out of scope.

**Escalate business calls; decide engineering calls yourself.** Escalate spend,
credentials, irreversible data operations, and public-facing copy. Plan 2 has one
built-in escalation: whether a bad Industries SKU should *hard-block* the save
(4.12) is a workflow decision about how Rick works, not a code decision. The form
is:

```
decision-needed | recommended | why | trade-off | blocked
```

Log escalations in `WHATS_LEFT.md` §3 **before** writing dependent code.

---

## Working rules

- **At most 3 fix attempts, then stop and escalate.** Three failures means your
  model of the problem is wrong. Report what you tried, what you observed, and
  what you now believe.
- **Fix rounds are delta-only.** Re-applying a whole plan over partially-passing
  work regresses it. Change only what the failing check demands.
- `WHATS_LEFT.md` is **append-only**. Supersede, never silently rewrite. Mark a
  corrected line `SUPERSEDED-BY` with the date and the correction; `AMENDED` is
  for a claim true in substance but wrong in detail. Shipped items go in §1b,
  newly-discovered open items in §2, evidence in a new §4-series block — Plan 2's
  would be **§4g**.
- **Do not re-report** the closed-with-evidence items in GUARDRAILS §7: missing
  PDFs / `logo.svg` / `pdfs-marketing`, "Six Industries links wrong", "mega-menus
  broken on touch", Apache 2.2 `.htaccess` syntax, the `src/pages` dead code, the
  items already listed in §2 as open, and the security posture.

---

## Handback

GUARDRAILS §8 format, short and dense, in this order:

1. **Fixed** — file → change, each with the output or measurement that proves it.
2. **Not fixed and why** — anything attempted and backed out, with the reason.
3. **Escalations** — in the five-field form above.
4. **Records corrected** — which `WHATS_LEFT.md` lines you superseded, and with what.
5. **Regression state** — the baseline table, before and after.

State plainly what you did **not** do. Scaling the work down is the owner's call,
not the executor's.

Update `WHATS_LEFT.md`: Plan 2's items into §1b, struck in §2, evidence in a new
§4g. Then rewrite this file for the session after you.

**Do not commit or push unless asked.**
