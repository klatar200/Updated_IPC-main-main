# Next session — PLAN 8 (remediating the 2026-08-08 UI/UX audit)

Paste everything below the line into a fresh session. It is written to be
self-contained: it assumes you have read nothing and remember nothing.

Supersedes `NEXT-SESSION-PROMPT.md`, which was written for PLAN-5 and carries
two numbers that have since moved (the posted-variable count and the copy-field
count). Do not use both.

---

You are picking up an in-flight release of the Insulation Products Corporation
website — a hybrid static React site plus a PHP admin, for a real 50-year-old
electrical-insulation distributor in Bolingbrook, IL. Plans 0–6 are shipped and
merged. **Your job this session is [PLAN-8](PLAN-8-audit-remediation.md)** — and
nothing else, unless I say so.

PLAN-8 remediates a UI/UX and user-flow audit run on 2026-08-08 against a live
local copy of the site: 50 findings, 7 severity-A, 21 severity-B, 22
suggestions. The audit itself is `UI_UX_AUDIT_2026-08-08.md` and carries the
measurement behind every claim. **The plan is the instruction; the audit is the
evidence.** Read both.

## First, orient yourself

Read these, in this order, before touching anything:

1. **[CLAUDE.md](../CLAUDE.md)** — architecture and the 12 invariants. Every
   invariant listed there caused a real, named defect. Do not "simplify" any of
   them back.
2. **[plans/GUARDRAILS.md](GUARDRAILS.md)** — the rules for this release. Binding.
   **Except §4.1, which is stale** — see below.
3. **[UI_UX_AUDIT_2026-08-08.md](../UI_UX_AUDIT_2026-08-08.md)** — the 50
   findings and how each was measured.
4. **[plans/PLAN-8-audit-remediation.md](PLAN-8-audit-remediation.md)** — what
   you are building. Start at its **§0**.
5. **[WHATS_LEFT.md](../WHATS_LEFT.md)** — §1/§1b for what shipped, §2 for what
   is open, §3 for decisions already taken (**do not relitigate them**), §4* for
   evidence. It is **append-only**: supersede, never silently rewrite.

The screenshots and JSON records behind the audit are in `_harness/out/audit/`.
They are gitignored, so on a fresh clone they will not exist — re-run the four
`_harness/audit-*.js` scripts to regenerate them.

## Stop at PLAN-8 §0 before you build anything

**Four items need a decision from me and must not be guessed.** Ask me all four
in one go, then start on everything else while you wait — only 4 of the 50 are
blocked.

The one that matters most: **A2, the ISO 9001 revision.** The site claims
`ISO 9001:2008` in three places and that revision was withdrawn in 2018. Writing
`:2015` because it is the current standard would be **inventing a certification
claim** for a company that sells into aerospace, medical and automotive. I have
to get the real answer from the owner. Do not fill it in.

The other three: whether product detail gets its own route (A3 — the plan
recommends the cheaper option and says why), whether the five social accounts are
live (C36), and whether `VALUE-ADDED` belongs in the catalog sidebar (C48, which
gates the count fix B12).

## Stand the harness up before you write any code

The harness is tracked in git. Read **[_harness/README.md](../_harness/README.md)**
first — it lists every suite and what it covers.

```sh
npm install
npm run build
sh _harness/sync.sh        # creates _harness/site/ and, on a fresh clone, pristine/
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php &
```

Run everything **from the repo root**. `-t _harness/site` is not optional.
`plan2-trunc.js` additionally needs `:8124` (`php-trunc.ini`) and `:8125`
(`php-nb2-off.ini`); `plan5-throttle.js` needs a fleet of ten on `:8130–:8139`.

### GUARDRAILS §4.1 is stale — do not run it

Eleven of the thirteen commands it lists name scripts that **no longer exist in
the tree** (`b1.js`, `b1trunc.js`, `b2.js`, `b3.js`, `nb2.js`, `nb4.js`,
`help.js`, `ttl.js`, `sweep.js`, `overflow.js`, `adminsweep.js`). Only
`lint.php` and `invariants.js` survive. A baseline that names missing scripts
produces a green report from a suite that never ran.

**This is the real baseline, measured on `38fde8c` on 2026-08-08.** Confirm it
before you change anything; if something is already red, say so and stop — you
need to know whether you broke it.

```
php _harness/lint.php     php -l 19/0 · node --check 9/0 · JSON 17/10/42
                          copy drift 103 matched, 0 JS-only · 11 families · 12 approvals
invariants                17/17          invariants-selftest   15/15
contrastparity            28/28          copyroundtrip         15/15
copydrift-selftest         5/5           skuparity             33/33
deadlinks                 0 of 18 dead
plan2-formlast             8/8 + selftest PASS
plan2-sku                 14/14          plan2-delete          18/18
plan3-contact             51/51          plan4-admin           19/19
plan4-public              27/27          plan5-keys            11/11
plan5-spectable           13/13          plan5-images          12/12
plan5-social              35/35          plan5b-sidebar         9/9
plan5b-sitemap             9/9           plan5c-sitemap        17/17
plan5c-eyebrow             4/4           plan5c-brandink        5/5
plan6-families            13/13          plan7-approvals       11/11
plan7-datasheets           8/8
brandtext                 35/51  ← EXPECTED RED
```

**`brandtext.js` at 35/51 is not a regression.** It is the logged open item
`brand-text-on-brand-surface` (dark half) in `WHATS_LEFT.md` §2. Your Phase E
must not let it drift worse. Closing it is not in this plan.

**Correcting GUARDRAILS §4.1 to the real list is part of this plan** (§7.3).

## Method — this is what six previous plans were run on, and it worked

- **Write the test first, and watch it fail.** Every PLAN-8 item is a defect with
  a stated acceptance. Build the check, run it against the unmodified tree, and
  paste the failure. A suite first seen green proves nothing.
- **Prove the test can fail.** Mutate the code, show it goes red, restore.
  `invariants-selftest.js` is the pattern. This caught vacuous assertions three
  times in earlier sessions.
- **Measure in the browser, not in the source.** A source scan for "what
  background is this on" both misses one declared after the `className` in the
  same element and attributes one from 12,000 characters away. Six real
  mis-classifications were caught only by measuring — and an auditor that printed
  "check by hand" instead of scoring is the reason
  `page-header-eyebrow-contrast` shipped. Phase E is entirely this.
- **Re-sync after every build and every `admin/` or `public/` edit**
  (`sh _harness/sync.sh`) or the suites test stale code and pass for the wrong
  reason.
- **At most 3 fix attempts on one problem, then stop and escalate.** Fix rounds
  are delta-only — do not re-run the whole world to check one line.
- **Never report something as fixed without the artifact that proves it.**
  "I updated the code and it should now work" is not a result.

## Nine of the 50 items are NOT yours to fix

`data/products-all.json`, `data/content.json` and `data/site-info.json` are
**live customer state** — the server copies are authoritative and an FTP
overwrite creates no backup. GUARDRAILS §2 forbids modifying them and this plan
does not lift that.

PLAN-8 tags every item **`CODE`** / **`DATA`** / **`BOTH`**. For a `DATA` item:
fix the *default* in `App.jsx` so a fresh install is right, verify the admin can
express the correct value, and add it to the plan's **§6 owner action list**
with the exact admin page, field, current value and target value. That list is a
deliverable — Rick works through it in the admin without a developer.

**If a `DATA` item cannot be expressed in the admin, that is a `CODE` defect in
the admin and it belongs in this plan.** Say which.

## Hard constraints — these are not style preferences

- **Never modify `data/*.json`, `pdfs/` or `uploads/`.** `_harness/pristine/`
  holds the reference copies; if a test writes to `data/`, restore and prove
  byte-identity with `cmp` before you finish.
- **Never commit `admin/config.local.php`, and delete
  `_harness/site/admin/config.local.php` when you finish.** It carries a working
  admin credential and **this repo is public.**
- **Never put a real password hash in `admin/config.php`** — it defines an
  unsatisfiable sentinel on purpose (invariant 2).
- **Never use `preg_replace` on anything writing a bcrypt hash** — every hash
  contains `$2y$12$` and those are backreferences. `preg_replace_callback` only
  (invariant 1).
- **Never add a form field after `form_complete` in `admin/content.php`.** It is
  the `max_input_vars` truncation sentinel, enforced positionally. The form posts
  **439** variables — the authority is `_harness/plan4-admin.js:52`
  (`POSTED_BEFORE`), not the prose in `WHATS_LEFT.md`, which says 435 and is one
  change out of date. If you move that number, update the constant in the same
  commit and re-run `plan2-trunc.js` against a real `max_input_vars=100` server.
- **Never edit `DEPLOY_READINESS_v2.md`.** Frozen; its value is that it did not
  change.
- **Do not resume the `src/pages/` `src/components/` `src/lib/` extraction.**
  Settled and closed — nothing imports them; `src/App.jsx` is the whole app
  (10,279 lines, one file, search by name).
- **Do not touch `_localsite/`.** Evidence, not source.
- **No paid dependency, service or tier. $0 budget.** `sharp` via
  `npm i --no-save` is the established pattern for image work (A4 needs it).
- **`WHATS_LEFT.md` is append-only.** Supersede, never silently rewrite.

## Traps specific to this codebase

- **Tailwind's extractor scans raw source text, comments included.** A bare word
  in `src/App.jsx` prose that happens to be a utility class name emits that whole
  rule into the shipped CSS. This has happened twice (`.ring`, `.grow`) — and
  both times the comment written to explain it reproduced the bug. After any
  `src/` change, diff the emitted selectors against the previous bundle; do not
  trust the build summary's byte count. **Phase E writes a lot of colour-related
  prose — this is the phase most likely to trip it.**
- **`admin/nav.php` renders a Sign Out form before the page's own form.** A bare
  `form[method=POST]` or `button[type=submit]` selector matches the wrong one.
  Anchor on something the target form actually has (`[name="orig_sig"]`, a
  button's text). This cost two debugging rounds.
- **Chromium will not match `:focus-visible` for programmatic focus.** Every
  focus assertion must use real `Tab`/`Enter` presses or a working indicator
  reads as absent. B15 (skip link) and B13 (drawer focus trap) both depend on
  this.
- **Vite's dev server answers an unknown path with `index.html` and a 200**, so
  `res.ok` never detects a missing JSON file. All three fetches go through
  `jsonOrThrow()`, which asserts `Content-Type`. Same trap applies to the SPA
  rewrite in production — it is why A5's soft-404 exists at all.
- **`mergeContent` treats an empty array as a deletion, not "unset"** (invariant
  3), and **`mergeSiteInfo` drops blank strings** except the `SITE_CLEARABLE`
  allow-list (invariant 4). Several PLAN-8 items sit next to both. `App.jsx`
  carries inline comments naming the incident behind each; read them before you
  change anything nearby.

## Order of work

Six phases. The order is by blast radius, not severity — PLAN-8 §2 has the table.
The two that matter:

- **Phase B (indexability) runs second, not last.** It changes routing,
  canonicals and possibly the sitemap, so every later phase's screenshots and URL
  assertions depend on its outcome.
- **Phase E (legibility) runs last.** It recolours ~270 elements and adds a
  focusable skip link, moving every screenshot baseline and tab-order assertion
  the other phases wrote. Same reason 4.32 went last in PLAN-5.

Phases C, D and F are independent of each other. Phase A is independent of
everything and is the highest severity — start there while you wait on §0.

## Who you are building for

- The **admin** (`admin/*.php`) is for **Rick** — a non-technical business owner,
  around 60, who uses FTP reluctantly and whose typing is the most irreplaceable
  thing on the site. Clarity and recoverability beat elegance.
- The **public site** is for a **buyer looking for a spec-grade part**. Every
  contact-form defect costs a sales enquiry — that is the standard invariant 11
  is held to, and it is why Phase D exists.
- **A1 is not a UI bug.** 18 of 42 product pages print a UL certification
  category the product's own data does not claim. Treat it as a factual
  correctness problem on a document a purchasing engineer may rely on.

## Git

Work on a branch off `main`. Commit with real detail — what was measured, what
moved, and what you got wrong along the way. Push, open a PR, and **do not merge
without asking me.** Do not commit or push anything I have not asked for.

## When you finish

- **`PATCH_NOTES.md` updated — appended, never overwritten.** That file is the
  record of 12 merged PRs from the 2026-07-08 → 2026-08-07 release; overwriting
  it destroys that. Add a new dated section below the existing one, in the same
  register: **name the defect in terms of what it did to a real person, then the
  fix, then the number that was measured.** Not "improved contrast" — rather
  "product part numbers were painted at 1.64:1 against white, so the one string a
  buyer scans a catalog for was nearly invisible on a phone." Carry each audit ID
  in parentheses. Mark deferred items as deferred and unapplied owner actions as
  not yet live, so a later reader cannot mistake a live defect for a fixed one.
  PLAN-8 §7.1 has the full spec.
- **`WHATS_LEFT.md` updated**: §1b rows for what shipped, §2 for what is newly
  open, a new §4 evidence section with before/after numbers **and any mistakes
  you made and caught**. That last part is not optional — the §4 sections are the
  most useful thing in the repo precisely because they record the wrong turns.
- **GUARDRAILS §4.1 corrected** to the real suite list, and `plans/README.md`
  updated.
- **A table of all 50 audit IDs with their outcome** — shipped / deferred / owner
  action — so the next agent sees what is left without re-reading the audit.
- **The §6 owner action list**, ready to hand to Rick.
- Full regression green, pasted, with `brandtext` no worse than 35/51.
- `data/`, `pdfs/`, `uploads/` byte-identical and untouched (`cmp` against
  `_harness/pristine/`, and `git status --porcelain data pdfs uploads` empty).
- `_harness/site/admin/config.local.php` deleted.

State plainly what you did not do. Scaling the work down is my call, not yours.
