# GUARDRAILS — read this before touching any plan

**Audience:** any agent or developer executing `plans/PLAN-*.md`.
**Status:** binding. A plan may add constraints; it may never relax one from here.
**Written:** 2026-08-05, against `main` @ `6284708`.

---

## 0. The premise everything is weighed against

The admin dashboard's audience is **Rick** — the business owner, non-technical,
around 60, who uses FTP reluctantly. The public site's audience is **a buyer
looking for a spec-grade part**.

Every judgement call is settled by asking which option protects one of those two
people. A change that is technically superior but makes the admin harder for
Rick, or that risks a sales lead, is the wrong change. When a plan says
"judgement call", this is the tiebreak.

---

## 1. Scope discipline — the single most important rule

**Execute exactly one plan per branch. Do not fix items belonging to another
plan, even when the fix is obvious and you are already in the file.**

This is not bureaucracy. Every item in these plans has an acceptance test tied
to it, and the regression suites are the only thing standing between this
codebase and the defects that took three sessions to find. A change that arrives
outside its plan arrives without its test, and it is indistinguishable from
scope creep when the suite goes red.

If you find something genuinely broken that no plan covers:

1. Do **not** fix it.
2. Append it to `WHATS_LEFT.md` §2 with the date, the evidence, and the file:line.
3. Say so in your handback.

**Do not refactor anything you were not asked to refactor.** Renaming,
reformatting, extracting helpers, "while I was here" tidying, and reordering
imports all count as straying. If a fix genuinely requires a refactor, stop and
escalate before writing it.

---

## 2. Hard prohibitions

These are absolute. There is no plan-level exception.

| Never | Why |
|---|---|
| `git checkout`, `reset`, `stash`, `revert`, `rebase`, `push --force`, or `commit` **unless explicitly asked in the current conversation** | The working tree has repeatedly been the only copy of hours of work |
| Edit `DEPLOY_READINESS_v2.md` | Frozen. It is the original audit and its value is that it did not change |
| Write a real password hash into `admin/config.php` | It defines an unsatisfiable sentinel on purpose. Two previous hashes shipped: the PHP-manual example for the string `password`, and one printed in four committed docs |
| Commit `admin/config.local.php` | Gitignored (`.gitignore:29`). It holds the live credential. **The repo is public** |
| Modify `data/*.json`, `pdfs/`, or `uploads/` | Live customer state. `_harness/pristine/` holds the reference copies; if a test writes to `data/`, restore from there before finishing |
| Use `preg_replace` on anything that writes a bcrypt hash | Every bcrypt hash contains `$2y$12$`; as a replacement string those are backreferences. Use `preg_replace_callback`. The shipped code once wrote `y$…` and the password page was 0% functional |
| Add a form field after `form_complete` in `admin/content.php` | It is the `max_input_vars` truncation sentinel and is enforced **positionally**. It must remain the last field in the form |
| Introduce a paid dependency, service, or tier | $0 budget. Genuine perpetual free tiers only |
| Resume the `src/pages/` `src/components/` `src/lib/` extraction | Settled and closed. Nothing imports them; editing them has zero effect on the bundle |
| Re-upload `data/products-all.json` or `pdfs/` from the repo | Settled 2026-08-04 |
| Touch `_localsite/` | A reference copy of an older deploy. It is evidence, not source |

---

## 3. The twelve invariants

Each of these caused a real, named defect. `CLAUDE.md` §Invariants carries the
full account and each has an inline comment in the code naming its incident.

**Never "simplify" one back. After any change, run:**

```bash
node _harness/invariants.js
```

Expected: **15 checks, 0 failing.** If your change makes one fail, your change is
wrong — not the test — until you have proven otherwise with an artifact.

Two of them interact with these plans directly and are worth restating:

- **Invariant 3 — `mergeContent` treats an empty array as a deletion, not
  "unset".** Plan 1 touches `mergeContent`'s neighbourhood. `Array.isArray(v) ? v : dv`
  is correct; `Array.isArray(v) && v.length ? v : dv` re-seeds hardcoded defaults
  when Rick deletes every row of a section — including stale legal text
  republishing itself after he removed it.
- **Invariant 4 — `mergeSiteInfo` drops blank strings, except `SITE_CLEARABLE`.**
  `settings.php` rebuilds `site-info.json` wholesale, so a missing field arrives
  as `""`. Spreading those over the defaults produced `© –2026` and `href="tel:"`.
  If a plan adds a newly-clearable field, it goes in the allow-list — the
  blank-drop default stays.

---

## 4. Verification is not optional

**Never report something as fixed without the artifact that proves it.**
"I updated the code and it should now work" is not a result. A command's output,
a browser measurement, or a failing-then-passing test is.

### 4.1 The regression baseline

This is the state on `main` @ `6284708`. Any plan that lands must leave every
one of these at least as green as it found them:

```
php -l                    19 files, 0 failing        php _harness/lint.php
node --check              8 admin JS files, 0 failing
JSON parse               content 17 / site-info 10 / products-all 42 entries
npm run build            0 errors, 325.78 kB JS / 21.02 kB CSS
B1   20/20               node _harness/b1.js
B1 truncation 5/5        node _harness/b1trunc.js      (needs :8124)
B2   18/18               node _harness/b2.js
B3   25/25               node _harness/b3.js
NB2  10/10               node _harness/nb2.js          (needs :8124 and :8125)
NB4  17/17               node _harness/nb4.js
help 22/22               node _harness/help.js
invariants 15/15         node _harness/invariants.js
TTL  3/3                 node _harness/ttl.js
public sweep             18 loads, 0 failing          node _harness/sweep.js
overflow                 42 product pages @375px, 0 overflow   node _harness/overflow.js
admin sweep              5/5                          node _harness/adminsweep.js
```

**Run the full set before you start**, so you know which failures you inherited
and which you caused. A plan that starts from red must say so.

### 4.2 Arming the harness

`_harness/` is gitignored, ~30 MB, and must never be deployed. It is a
`public_html` mirror served by `php -S`.

```bash
php _harness/setpw.php
```

Sets the admin password to `audit-pass-123` **in the mirror only**, using
`preg_replace_callback`. Then start three servers from `_harness/`:

| Port | ini | Purpose |
|---|---|---|
| 8123 | `php-extra.ini` | Main. `display_errors=On`, default `max_input_vars` |
| 8124 | `php-trunc.ini` | `display_errors=Off`, `max_input_vars=100` — forces a genuine truncation |
| 8125 | `php-nb2-off.ini` | `display_errors=On`, `max_input_vars=100` — the NB2 negative control |

Each runs `php -c <ini> -S 127.0.0.1:<port> -t site router.php`. Launch them
detached; `router.php` emulates the `.htaccess` SPA rewrite.

Re-sync the mirror from source after editing anything under `admin/`, `public/`
or `dist/`, or you will test stale code — this has caused false passes before.

**When you finish, delete `_harness/site/admin/config.local.php`.** It carries a
throwaway credential and must not survive the session.

### 4.3 What `php -S` cannot test

`php -S` ignores **both** `.htaccess` and `.user.ini`. Anything depending on
them is reasoning from the rule text, not measurement, and must be labelled
`[UNVERIFIED]` in your handback. Do not report those as passing.

Concretely unverifiable locally: the `SetEnvIf`-scoped cache (NB1), the dotfile
block (NB15), the `ALLOW-PASSWORD-RESET` block (NB14), and every limit in
`public/.user.ini` — including `display_errors=Off`, on which the B1 truncation
guard depends.

### 4.4 Write the test first when the item is a defect

Every item in these plans that describes wrong behaviour has an observable
symptom. Reproduce the symptom, **watch the new check fail**, then fix it. A
check that has never failed proves nothing — two invariant checks in session 3
passed against a broken assertion because they were matching the incident
comments quoting the old buggy pattern, not the code.

Where a plan names a negative control, run it. `_harness/negctl.php` and
`_harness/php-nb2-off.ini` exist because a suite that cannot fail is decoration.

---

## 5. Working rules

**Fix loops: at most 3 attempts, then stop and escalate.** Three failed attempts
means the model of the problem is wrong. Report what you tried, what you
observed, and what you now believe.

**Fix rounds are delta-only.** Re-applying a whole plan over partially-passing
work regresses it. Change only what the failing check demands.

**The bash mount can lie** — truncated reads and false successes have both
happened here. Confirm any claim about file contents with the `Read` tool. If
`Read` and a shell command disagree, `Read` wins, and say so in the handback.

**Guard-hook constraints.** `$VAR` expansion, `$(...)`, `php -r`, `sed -i` with
`$_POST` in the pattern, and `for f in …; do …$f` are blocked. Inline literal
paths, write `.php`/`.js` script files instead of inline code, and use the
PowerShell tool's `Start-Process` to launch servers.

**Decide engineering calls yourself; escalate business calls.** Escalate spend,
credentials, irreversible data operations, and public-facing copy. Escalations
take the form:

```
decision-needed | recommended | why | trade-off | blocked
```

Log them in `WHATS_LEFT.md` §3 **before** writing dependent code.

---

## 6. Records

`WHATS_LEFT.md` is **append-only**. Supersede, do not silently rewrite. Mark a
corrected line `SUPERSEDED-BY` with the date and the correction, so the history
of what was believed stays legible. `AMENDED` is for a claim that was true in
substance but wrong in detail.

Add shipped items to §1b. Add newly-discovered open items to §2. Put the
evidence in a §4-series block.

---

## 7. Do not re-report these

Closed with evidence by earlier sessions. Raising them again wastes a review
cycle:

- Missing PDFs, `logo.svg`, and `pdfs-marketing` — sandbox artifacts, present here
- "Six Industries links wrong"
- "Mega-menus broken on touch"
- Apache 2.2 `.htaccess` syntax
- `src/pages` / `src/components` / `src/lib` being dead code
- The 17 items already listed in `WHATS_LEFT.md` §2 as open
- The security posture — `require_auth()`, `csrf_check()`, upload validation,
  `basename()`+`realpath()` containment, `h()` on every echo, optimistic
  concurrency. **Re-verify it; do not re-derive it.**

---

## 8. Handback format

Short and dense, in this order:

1. **Fixed** — file → change, each with the output or measurement that proves it.
2. **Not fixed and why** — anything attempted and backed out, with the reason.
3. **Escalations** — in the five-field form above.
4. **Records corrected** — which `WHATS_LEFT.md` lines you superseded, and with what.
5. **Regression state** — the §4.1 table, before and after.

State plainly what you did not do. Scaling the work down is the owner's call,
not the executor's.
