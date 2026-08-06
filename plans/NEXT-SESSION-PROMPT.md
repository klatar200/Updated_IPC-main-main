# Next session — PLAN 5 (correctness, performance, and the one unbuilt feature)

Paste everything below the line into a fresh session. It is written to be
self-contained: it assumes you have read nothing and remember nothing.

---

You are picking up an in-flight release of the Insulation Products Corporation
website. Plans 0–4 are shipped and merged. **Your job this session is
[PLAN-5](PLAN-5-correctness-perf.md)** — and nothing else, unless I say so.

## First, orient yourself

Read these three, in this order, before touching anything:

1. **[CLAUDE.md](../CLAUDE.md)** — architecture and the 12 invariants. Every
   invariant listed there caused a real defect. Do not "simplify" any of them.
2. **[plans/GUARDRAILS.md](GUARDRAILS.md)** — the rules for this release.
3. **[WHATS_LEFT.md](../WHATS_LEFT.md)** — §1/§1b for what shipped, §2 for what
   is open, §3 for decisions already taken (do not relitigate them), §4* for the
   evidence behind every claim. It is **append-only**: supersede, never silently
   rewrite.

Then read **[plans/PLAN-5-correctness-perf.md](PLAN-5-correctness-perf.md)**.
Its items are **4.27, 4.29, 4.26, 4.32, 4.14, 4.11b**.

## Stand the harness up before you write any code

The harness is now **tracked in git** (it was not, for the first four plans, and
every session rebuilt it from scratch). Read
**[_harness/README.md](../_harness/README.md)** first — it lists every suite and
what it covers.

```sh
npm install
npm run build
sh _harness/sync.sh        # creates _harness/site/ and, on a fresh clone, pristine/
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php &
```

Run everything **from the repo root**. `-t _harness/site` is not optional.
`plan2-trunc.js` additionally needs `:8124` (`php-trunc.ini`) and `:8125`
(`php-nb2-off.ini`).

**Confirm the whole set is green before you change anything.** If something is
already red, say so and stop — you need to know whether you broke it.

```
php _harness/lint.php
for s in invariants invariants-selftest contrastparity copyroundtrip \
         copydrift-selftest skuparity plan2-sku plan2-delete plan2-contrast \
         plan2-formlast plan2-formlast-selftest plan2-trunc plan3-contact \
         plan3-autoreply plan4-public plan4-admin deadlinks; do
  echo "== $s"; node _harness/$s.js | tail -2
done
```

Expected: `php -l 18/0`, `node --check 9/0`, JSON `17/10/42`, copy drift `96`,
`invariants 17/17`, `invariants-selftest 15/15`, `contrastparity 28/28`,
`copyroundtrip 15/15`, `copydrift-selftest 5/5`, `skuparity 33/33`,
`plan2-sku 14/14`, `plan2-delete 18/18`, `plan2-contrast 42/42`,
`plan2-formlast 8/8` + selftest PASS, `plan2-trunc 13/13`,
`plan3-contact 51/51`, `plan3-autoreply 10/10`, `plan4-public 27/27`,
`plan4-admin 19/19`, `deadlinks 0 of 18 dead`.

`brandtext.js` is **expected to be red at 34/54** — that is a logged open item
(`brand-text-on-brand-surface`, §2), not a regression. Do not let it drift
worse; do not fix it in this plan without asking.

## Method — this is what the previous four plans were run on, and it worked

- **Write the test first, and watch it fail.** Every item in PLAN-5 is a defect
  with a stated acceptance. Build the suite, run it against the unmodified tree,
  and paste the failure. A suite first seen green proves nothing.
- **Prove the test can fail.** Where an assertion is load-bearing, mutate the
  code and show it goes red, then restore. This caught vacuous assertions three
  times in the last two sessions.
- **Measure in the browser, not in the source.** A source scan for "what
  background is this on" both misses one declared after the `className` in the
  same element and attributes one from 12,000 characters away. Six real
  mis-classifications were caught only by measuring — and one auditor that
  printed "check by hand" instead of scoring is the reason
  `page-header-eyebrow-contrast` shipped.
- **Re-sync after every build and every `admin/` edit** (`sh _harness/sync.sh`)
  or the suites test stale code and pass for the wrong reason.
- **At most 3 fix attempts on one problem, then stop and escalate.** Fix rounds
  are delta-only — do not re-run the whole world to check one line.
- **Never report something as fixed without the artifact that proves it.**

## Hard constraints — these are not style preferences

- **Never modify `data/*.json`, `pdfs/` or `uploads/`.** After first deploy these
  are live customer state and an FTP overwrite creates no backup.
  `_harness/pristine/` holds the reference copies; if a test writes to `data/`,
  restore and prove byte-identity with `cmp` before you finish.
- **Never commit `admin/config.local.php`, and delete
  `_harness/site/admin/config.local.php` when you finish.** It carries a working
  admin credential and **this repo is public.**
- **Never put a real password hash in `admin/config.php`.** It defines an
  unsatisfiable sentinel on purpose (invariant 2).
- **Never use `preg_replace` on anything writing a bcrypt hash** — every hash
  contains `$2y$12$` and those are backreferences. `preg_replace_callback` only
  (invariant 1).
- **Never add a form field after `form_complete` in `admin/content.php`.** It is
  the `max_input_vars` truncation sentinel, enforced positionally. The form posts
  **421** variables; if a change moves that number, stop and say so.
- **Never edit `DEPLOY_READINESS_v2.md`.** Frozen; its value is that it did not
  change.
- **Do not resume the `src/pages/` `src/components/` `src/lib/` extraction.**
  Settled and closed — nothing imports them; `src/App.jsx` is the whole app.
- **Do not touch `_localsite/`.** Evidence, not source.
- **No paid dependency, service or tier. $0 budget.**
- **`WHATS_LEFT.md` is append-only.** Supersede, never silently rewrite.

## Two traps specific to this codebase

- **Tailwind's extractor scans raw source text, comments included.** A bare word
  in `src/App.jsx` prose or an identifier that happens to be a utility class name
  emits that whole rule into the shipped CSS. This has happened twice
  (`.ring`, `.grow`) — and both times the comment written to explain it
  reproduced the bug. After any `src/` change, diff the emitted selectors against
  the previous bundle, don't trust the build summary's byte count.
- **`admin/nav.php` renders a Sign Out form before the page's own form.** A bare
  `form[method=POST]` or `button[type=submit]` selector matches the wrong one.
  Anchor on something the target form actually has (`[name="orig_sig"]`, a
  button's text). This cost two debugging rounds.

## PLAN-5 specifics worth knowing before you start

- **Run 4.32 (images) last.** It changes bytes every other item's screenshots
  depend on.
- **4.32 is the customer's product photography.** Re-encode and resize only — do
  not crop or retouch, keep filenames identical (`products-all.json` and the
  admin photo mapping reference them by name), and **escalate before shipping
  anything visibly degraded.** Quality loss on a product photo is a business
  problem, not a technical one.
- **4.27 asks you to choose** between a stable per-row id assigned in
  `admin/content.php` and carried in `content.json`, versus `` `${index}-${value}` ``.
  The plan requires you to **state which you chose** and record the residual
  reorder cost in §2 if you take the cheaper one.
- **4.14: do not overstate what the throttle buys.** The comment at
  `admin/auth.php:49–54` is deliberate and accurate — the long random password is
  the real control, and per-IP throttling does nothing to a distributed attacker.
  If your fix does not change that, keep the comment honest. And **do not add a
  lockout that can strand Rick from his own admin**: there is no password-reset
  email, the recovery path is FTP, and a permanent lockout is a worse outcome
  than a slow brute force.
- **4.11b interacts with invariant 4 / NB4.** All five social fields are
  clearable, and the docs promise a cleared field "disappears from the site
  properly". All five empty must render **no container at all** — assert the
  element is absent, not merely empty.
- Several PLAN-5 acceptance lines name suites that **do not exist**
  (`sweep.js`, `nb4.js`, `b2.js`, `overflow.js`, `ttl.js`, `adminsweep.js`).
  They were lost with the old harness. Build what the item actually needs and say
  what you built; do not fake a name.

## Who you are building for

- The **admin** (`admin/*.php`) is for **Rick** — a non-technical business owner,
  around 60, who uses FTP reluctantly and whose typing is the most irreplaceable
  thing on the site. Clarity and recoverability beat elegance.
- The **public site** is for a **buyer looking for a spec-grade part**. Every
  contact-form defect costs a sales enquiry; that is the standard invariant 11
  is held to.

## Git

Work on a branch off `main`. Commit with real detail — what was measured, what
moved, and what you got wrong along the way. Push, open a PR, and **do not merge
without asking me.** Do not commit or push anything I have not asked for.

## When you finish

- Full regression green, pasted.
- `data/`, `pdfs/`, `uploads/` byte-identical and untouched (`cmp` against
  `_harness/pristine/`, and `git status --porcelain data pdfs uploads` empty).
- `_harness/site/admin/config.local.php` deleted.
- `WHATS_LEFT.md` updated: §1b rows for what shipped, §2 struck through for what
  closed, a new §4 evidence section with the before/after numbers and **any
  mistakes you made and caught**. That last part is not optional — the §4
  sections are the most useful thing in the repo precisely because they record
  the wrong turns.
