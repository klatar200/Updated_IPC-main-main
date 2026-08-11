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

Expected: **17 checks, 0 failing.** (Was 15 when this was written; the file has
gained two since. `invariants-selftest.js` proves they can fail.) If your change makes one fail, your change is
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

**Corrected 2026-08-08 (PLAN-8 §7.3).** This section previously listed thirteen
commands measured on `main` @ `6284708`, eleven of which named scripts that are
not tracked in the repo (`b1.js`, `b1trunc.js`, `b2.js`, `b3.js`, `nb2.js`,
`nb4.js`, `help.js`, `ttl.js`, `sweep.js`, `overflow.js`, `adminsweep.js`).
`_harness/` was gitignored wholesale at the time, so those files existed only on
one machine. A baseline that names missing scripts produces a green report from
a suite that never ran, which is worse than no baseline.

Note that copies of those eleven may still sit **untracked** in a working tree
carried over from `main`. `git ls-files _harness/` is the authority on what
exists; the working directory is not.

The live suite list is `_harness/README.md`.

**Refreshed 2026-08-11 (AUDIT-11).** The previous table listed **30** suites
against a harness that has **65**, so fifteen suites an executor would be judged
on appeared in it nowhere — including every `plan9-*` and every `plan10-*`. A
baseline that omits half the suite set cannot tell an executor what they
inherited, which is the job this section exists to do, and it is why PLAN-10's
fullest sweep was 39 rather than 65. The full table below replaces it. Measured
on `main` @ `33dffb8`, 2026-08-11, with all three servers up **plus the
ten-server fleet on :8130-8139 that `plan5-throttle` needs** — that requirement
is why it had been skipped since PLAN-8.

```
php _harness/lint.php     php -l 19/0 · node --check 9/0 · JSON 17/10/42
                          copy drift 110 matched, 0 JS-only · 11 families · 12 approvals
                          · 5 photo-slot defaults · no family literals
npm run build             0 errors, 368.07 kB JS / 23.41 kB CSS

invariants                17/17          invariants-selftest   15/15
copydrift                     ok         copydrift-selftest     5/5
copyroundtrip             15/15          contrastparity        28/28
skuparity                 33/33          deadlinks       0 of 18 dead
backdrop-selftest           9/9
plan2-formlast              8/8 + selftest PASS
plan2-sku                 14/14          plan2-delete          18/18
plan2-contrast            42/42          plan2-trunc           13/13
plan3-contact             51/51          plan3-autoreply       22/22
plan4-public              27/27          plan4-admin           19/19
plan5-keys                11/11          plan5-spectable       13/13
plan5-images              12/12          plan5-social          35/35
plan5-listeners           11/11          plan5-throttle        12/12
plan5b-sidebar              9/9          plan5b-sitemap         9/9
plan5b-pwthrottle         10/10          plan5c-eyebrow         5/5
plan5c-brandink             6/6          plan5c-sitemap        17/17
plan6-families            13/13          plan7-approvals       11/11
plan7-datasheets            8/8          plan7-slots           16/16
plan7-imagery             11/11
plan8-certs                 5/5          plan8-meta            15/15
plan8-catalog             16/16          plan8-lead            16/16
plan8-motion                8/8          plan8-chrome          16/16
plan8-keyboard              8/8          plan8-mobile          16/16
plan8-landing             18/18          plan8-crumbs          22/22
plan8-faq                 19/19          plan8-formpolish      15/15
plan9-firstsave             8/8          plan9-band             4/4
plan9-meta                18/18          plan9-notfound         8/8
plan9-slots-slash           9/9
plan10-header               8/8          plan10-dashboard      25/25
plan10-rfqscroll          24/24          plan10-repalette      33/33
plan10-adminrows          15/15          plan10-adminnav       25/25
plan10-helpwidth          21/21          plan10-auditlog       13/13
plan10-help               29/29

plan8-contrast            34/35  ← EXPECTED RED (EXEMPT_BRAND_SURFACE)
plan8-polish              16/17  ← EXPECTED RED (DejaVu width artifact, Linux)
brandtext                 34/45  ← EXPECTED RED (11 failing; ceiling 13)
```

Two suites score **higher** than the 2026-08-08 table because they gained checks,
not because anything improved: `plan5c-eyebrow` 4/4 → 5/5 and `plan5c-brandink`
5/5 → 6/6. `plan3-autoreply` is `[UNVERIFIED]` on Windows and verifies **22/22**
on Linux. `plan5-throttle` needs `:8130-8139`; without the fleet it does not
report a low score, it bails — see the note on bailing below.

`plan8-contrast` is 34/**35**, not 35/35, and that is its passing state: one
named exemption (`EXEMPT_BRAND_SURFACE`) for a computed brand ink on a computed
brand surface, which belongs to 4.23. It is a counter rather than a blanket
rule so a second brand-surface failure cannot hide behind it.

`node _harness/run.js <suite> [suite...]` runs a list and prints one line each.

Three of these need saying out loud:

- **A suite whose TOTAL changes is BAILING, not failing — and that is a
  different thing.** `plan2-trunc` reports `1/2` instead of `13/13` when
  `:8124`/`:8125` are down; `plan5-throttle` does the same without the
  `:8130-8139` fleet. Both look like catastrophic regressions and are neither.
  **Before treating any red as a finding, compare its DENOMINATOR to the table
  above.** A changed denominator means the suite never got to run its checks —
  check server liveness first. This cost PLAN-10 phase E a false alarm, and it
  is the most likely reason a suite gets quietly dropped from a sweep and then
  from the baseline.

- **`brandtext` is expected red.** It is the logged open item
  `brand-text-on-brand-surface` in `WHATS_LEFT.md` §2. Judge it by the FAILING
  count, not the ratio: the number of scored combinations wobbles by one between
  runs of identical code (the hero animates and a small ink extent is
  position-sensitive), so 37/50 and 37/51 can be the same result. It must not
  get worse than **13 failing**.
- **`plan3-autoreply` is `[UNVERIFIED]` on Windows.** It runs, but every mail
  assertion fails: `php-mail.ini` points `sendmail_path` at `../fakemail.sh`, a
  POSIX shell script Windows PHP cannot exec, so no mail log is written.

`php -l` counts 20 files where a clean checkout counts 19 — the extra is a local
gitignored `admin/config.local.php`. 0 failing either way.

**Run the full set before you start**, so you know which failures you inherited
and which you caused. A plan that starts from red must say so.

#### 4.1a Running the harness on Windows

The suites assume POSIX in places. Four were fixed in PLAN-8 and the pattern is
worth knowing, because more will surface:

- Node resolves a bare `/tmp` to `C:\tmp`, which does not exist. PHP writes its
  temp files to `sys_get_temp_dir()`, so `os.tmpdir()` is the portable match.
- `npm` and `npx` are `.cmd` shims. `execFileSync` cannot run them, and naming
  the shim does not help — since the CVE-2024-27980 mitigation Node returns
  `EINVAL` for a `.cmd` without a shell. Use `shell: true` with the command as
  ONE string (an argv array plus a shell is `DEP0190`).
- `core.autocrlf=true` with no `.gitattributes` means the working tree is CRLF
  while the blobs are LF. Any check that mutates source by exact string match
  must normalise first, or it silently no-ops and reports drift that is not
  there.

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
