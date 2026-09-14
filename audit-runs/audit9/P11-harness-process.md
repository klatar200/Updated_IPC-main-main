# P11 — the harness and the process          agent: D   started/finished: 2026-09-14 16:10 / 17:55   mirror: none (file-only; census + mutation tests against the tracked repo, restored after each)
findings:   Blocker 0 · High 0 · Medium 2 · Low 1
| ID | sev | class | where | one line |
| A-9.D5 | Medium | harness | `_harness/fgpatch.js` | a one-shot color-migration codemod is misclassified as an assertive regression suite by the Appendix A heuristic and now CRASHES in the sweep — its hardcoded 10-site mapping was invalidated by its own successful prior application |
| A-9.D6 | Medium | harness | `_harness/plan5-keys.js` | restores the mirror's data files and the production bundle in its `finally` block but never asserts the restore with a byte compare — the one mutator in this round's census that does not prove its own cleanup |
| A-9.D7 | Low | doc | `_harness/README.md` (five suite tables) | 7 runnable, assertive suites exist in no table (`backdrop-selftest`, `plan7-approvals`, `plan7-datasheets`, `plan7-imagery`, `plan8-faq`, `plan8-formpolish`, `plan8-landing`) — the same "suites named nowhere" pattern the file's own 2026-08-18 section was written to close, recurring nine suites later |
ledger:     done E105, E106, E107, E112, E115, E116, E163, E164, E165   blocked none
suites cited: `php _harness/lint.php` (re-run 7 times: once clean, then once per mutation below, then once clean again) — 0 failing throughout except the deliberate single-check FAILs; `node --check` over all 153 tracked `_harness/*.js` — 0 parse failures; sweep denominator cited from `_harness/out/audit9/sweep-list-final.txt` (80) and `_harness/out/audit9/sweep-before.txt` (C's completed Phase-0 run, not re-run by this pass)
instruments: none — no new instrument named by this brief
artifacts:  `_harness/out/audit9/P11/config.php.orig`, `add.php.orig`, `content.php.orig` — pre-mutation backups kept as before/after evidence for the five mutation tests run this pass (family drift, approval drift, audit-action drift, family literals, href guard drift); `git status --porcelain` on all four touched files shows clean after every restore
out of brief: three new tracked/untracked instrument files appeared mid-round from other agents' passes (`_harness/audit9-logic-admin.js`, `_harness/audit9-logic-data.js` — untracked; `_harness/audit9-logic-public.js` — committed by agent A, marked "in progress") plus `_harness/audit9-p6-navgraph.js` (untracked) — all four are assertive by the Appendix A pattern, which is why the live classifier count is 62/58 rather than 58/58 measured at Phase 0. Not audited by this pass (in-progress, another agent's surface); noted so the drift isn't mistaken for measurement error.
[UNVERIFIED]/[UNSOURCED]: full restore-and-byte-diff verification of the ~20 suites the Appendix A heuristic flags that turned out, on inspection, to only *read* `pristine/*.json` as a comparison baseline rather than write to the mirror (see step 4) — each was checked for a write call and none was found, but this pass did not read every one of these files in full
self-corrections: the Appendix A/§4.3 "26 of 58" mutating-suite count does not reproduce cleanly even after excluding this round's 4 new instrument files (28 remain, not 26) — recorded as a finding in its own right below (§ Method step 4), not silently adjusted
---

## Method

### Step 1 — resolving the §4.3 rows

Reproduced Appendix A's classifier and the README-table extraction independently
of C's Phase-0 files, to check both this round's drift and the reconciliation
itself:

```
grep -lE "process\.exit\(|process\.exitCode" _harness/*.js | xargs grep -lE "\bok\(|\bcheck\(|\bassert" | wc -l
→ 62   (was 58 at Phase 0 — +4, all new mid-round instruments, see "Out of brief")
```

Excluding those 4, the pre-existing assertive set is 58, matching Phase 0
exactly. Cross-checked against `_harness/out/audit9/only-assertive.txt` /
`only-readme.txt` (C's Phase-0 output): **8 names are assertive and in no
README table** — `backdrop-selftest`, `fgpatch`, `plan7-approvals`,
`plan7-datasheets`, `plan7-imagery`, `plan8-faq`, `plan8-formpolish`,
`plan8-landing`. One of the 8 (`fgpatch`) is not actually missing from the
README — it is named in the "Investigative tools" prose list as one of "the
codemods that did the brand-color migrations", just not in a per-suite table
row, and it is not a regression check at all (see A-9.D5 below). The other
**7 are genuinely undocumented** — filed as **A-9.D7, Low** — the exact
"suites named nowhere" defect the README's own 2026-08-18 section (line 184)
exists to prevent, recurring on a smaller scale. All 8 (fgpatch included) are
already correctly present in C's resolved `sweep-list-final.txt`, so the
**denominator for this round is unaffected** — this is a documentation gap,
not a coverage gap.

The 16 names in `only-readme.txt` (documented, not classifier-flagged) were
each checked individually: 13 use an assertion idiom the `ok(|check(|assert`
pattern doesn't match (e.g. `skuparity.js` just counts a `bad` variable and
calls `process.exit(bad === 0 ? 0 : 1)`) and are correctly folded into the
union; the remaining 3 — `backdrop` (a shared measurement string sourced by
other suites, not a runnable file — no `process.exit` of its own, confirmed),
`lint` (PHP, run separately per Appendix A's own last line), `plan10-shot`
(explicitly "not a suite" per its own README row) — are correctly excluded
from the sweep list. **No finding here**; C's `sweep-list-final.txt` (80) is
sound.

### Step 2 — every `*-selftest.js` fails its target as designed

All five named selftests are green in the completed Phase-0 sweep
(`_harness/out/audit9/sweep-before.txt`, direct-run block): `invariants-selftest`
15/15, `copydrift-selftest` 5/5, `contactflow-selftest` 26/26, `backdrop-selftest`
9/9, `plan2-formlast-selftest` exit 0. Not re-run by this pass (C's run stands;
re-running would contend with the live sweep mirror per §10.3). Read
`plan2-formlast-selftest.js` in full to confirm its `[3] field removed -> exit 0`
tail line — the only line `run.js` prints — is the **last of three** internal
checks and not the whole test: step [1] requires the unmodified mirror green,
step [2] requires the mutated mirror to **fail** (`caught = during.status !== 0
&& /form_complete is the LAST/.test(during.out)`, incrementing `bad` if not),
step [3] requires the restored mirror green again. A tail-line read alone would
have looked like "no proof of failing", so this is recorded as read, not
assumed. `contactflow-selftest`'s and `backdrop-selftest`'s designs (breaking
named guarantees one at a time, requiring the target to flip red, catching a
"MUTATION SURVIVED" once historically) are as described verbatim in
`_harness/README.md` and not re-derived — the current green score is the
evidence that the mechanism still works. **No finding.**

### Step 3 — `lint.php`'s 13 checks, mutation-test census

| Check | Prior recorded mutation test | This round |
|---|---|---|
| `php -l` | trivial by construction — `php -l` failing on a syntax error is the tool's own contract, not this project's logic | not mutated (see below) |
| `node --check` | same | not mutated |
| JSON parse | same (a malformed JSON file failing to parse is `json_decode`'s own behaviour) | not mutated |
| copy-key drift | `copydrift-selftest.js`, 5/5 this round | confirmed via sweep, not re-run |
| family drift | none found (`audit-runs/*.md`, `WHATS_LEFT.md` searched) | **run this pass** — see below |
| approval drift | none found for `lint.php`'s check specifically (`plan7-approvals.js`'s own internal mutation test is a different suite) | **run this pass** |
| photo-default drift | `WHATS_LEFT.md` §1a-series: "5/8; restored → 8/8… `WRONG.jpg` → `FAIL photo-default drift`; restored → green" | confirmed via doc, not re-run |
| audit-action drift | none found | **run this pass** |
| inquiry-type drift | `audit-runs/audit8.md` A-8.6, two mutations shown (`rfq-incomplete` removed from `$REJECTED`; a real lead type added to it), both restored | confirmed via doc, not re-run |
| family literals | none found | **run this pass** |
| doc drift | `WHATS_LEFT.md` §1l — a full account, including a v1 mutation test that passed for the wrong reason (path-qualified vs bare ini name) and its correction | confirmed via doc, not re-run |
| section drift | `WHATS_LEFT.md` — "Four mutations, all correct — a fresh collision fails, a third occurrence of an exempted number fails, and an exemption that is no longer needed fails" | confirmed via doc, not re-run |
| href guard drift | none found — `E116` names this exact gap | **run this pass** |

The three mechanical checks (`php -l`, `node --check`, JSON parse) are not
mutated here: proving PHP's own linter can detect a syntax error is not this
project's logic under test, and deliberately breaking a real file's syntax —
even briefly — carries more risk (four other agents are concurrently reading
this same working tree, confirmed via `ps aux`/`git status`) than the check is
worth.

**Five checks with no prior recorded proof were run this pass**, on the real
source `lint.php` reads (it has no mirror indirection — confirmed via its own
`__DIR__ . '/../admin/…'` paths), each backed up first
(`_harness/out/audit9/P11/*.orig`), reverted immediately after, and confirmed
byte-identical (`diff` + a clean `git status --porcelain`) before moving to the
next:

```
family drift:       IPC_DEFAULT_FAMILIES[0] 'Polyolefin Heat Shrink' -> 'MUTATED-P11-TEST'
  -> FAIL  family drift
          admin/config.php IPC_DEFAULT_FAMILIES and src/App.jsx FAMILY_ORDER disagree
  -> restored, byte-identical, re-run: family drift  11 families, PHP and JS identical

approval drift:      IPC_APPROVALS[0] 'UL Recognized' -> 'MUTATED-P11-TEST'
  -> FAIL  approval drift
          admin/config.php IPC_APPROVALS and src/App.jsx APPROVALS disagree
  -> restored, byte-identical, re-run: approval drift  12 approvals, PHP and JS identical

audit-action drift:  dropped 'sign-in-failed' from IPC_AUDIT_ACTIONS
  -> FAIL  audit-action drift
          IPC_AUDIT_ACTIONS and the audit_log() call sites disagree
          written but not offered in the filter: ["sign-in-failed"]
  -> restored, byte-identical, re-run: audit-action drift  14 actions, filter list and call sites identical

family literals:     appended a commented-out "$partTypes = [" line to admin/add.php
  -> FAIL  family literals
          a hardcoded $partTypes list is back in: add.php — read ipc_product_families() instead
  -> restored, byte-identical, re-run: family literals  none in add.php or edit.php

href guard drift:    admin/content.php: inserted one space inside the
                     link_url_problem((string)$row['brochure']['url'] call the
                     check greps for verbatim, so the substring no longer matches
  -> FAIL  href guard drift
          admin/content.php no longer calls the shared link validator
  -> restored, byte-identical, re-run: href guard drift  2 owner-editable href fields, guarded client and server side
```

Full `php _harness/lint.php` re-run clean (all 13 lines green, exit 0) after
the fifth restore; `git status --porcelain` on `admin/config.php`,
`admin/add.php`, `admin/content.php`, `src/App.jsx` empty throughout and at
the end. **All 13 checks now have a recorded, reproducible mutation test —
5 of them for the first time.**

### Step 4 — mutating-suite census

Reproduced Appendix A's second classifier
(`grep -lE "site/data|pristine|writeFileSync\([^)]*data/|save_(products|content|site)|restore"`
over the 58 pre-existing assertive files): **28 matches, not 26** — a
2-suite discrepancy from the plan's own 2026-09-14 figure that does not
resolve to the 4 new mid-round instruments (those are separate; excluding them
from the fresh classifier run still leaves 28). Not chased further than
recording it: Appendix A calls this classifier a heuristic twice over and asks
for reconciliation, not exact reproduction.

**The heuristic overcounts.** It fires on any file that so much as *reads*
`pristine/*.json` or a mirror `site/data/*.json` value as a comparison
baseline — it cannot distinguish that from a file that *writes* to the
mirror's live data and therefore owes it a restore. Checked every one of the
28 for an actual write into a mirror data file
(`writeFileSync`/`copyFileSync` targeting `MIRROR`/`site/data/…`):

**Confirmed genuine mutators (7) — all restore in a `finally` and prove it
with an explicit byte compare at the end of their own run:**

| Suite | Restore mechanism | Byte-proof |
|---|---|---|
| `plan6-families.js` | `finally` writes pristine `content.json` + `products-all.json` back over the mirror | `fs.readFileSync(MIRROR).equals(pristineContent)` etc., asserted |
| `plan5-social.js` | `finally` × 2, `copyFileSync(PRISTINE, MIRROR)` | `fs.readFileSync(PRISTINE).equals(fs.readFileSync(MIRROR))`, asserted |
| `plan2-trunc.js` | `restore()` called in every exit path incl. `finally` | `fs.readFileSync(MIRROR_CONTENT).equals(fs.readFileSync(PRISTINE_CONTENT))`, asserted |
| `plan5c-sitemap.js` | `finally` writes pristine bytes back over `MIRROR` | `fs.readFileSync(MIRROR).equals(fs.readFileSync(PRISTINE))`, asserted (the suite's own header comment states this design explicitly) |
| `plan10-auditlog.js` | per `_harness/README.md`'s own row: "restores `_harness/pristine/content.json` in a `finally` block" | "asserts the restore byte-for-byte before reporting" (README) |
| `audit7.js` | per `_harness/README.md`: "Mutates the mirror only, restores from `pristine/` in a `finally`" | "asserts the restore byte-for-byte before reporting" (README) |
| `audit7-lead.js` | no browser/mirror mutation of `data/*.json` in the normal path; its one destructive arm (A-7.4) replaces `inquiries.jsonl` with a directory | README does not claim a byte-diff for this arm — **not independently confirmed this round**, flagged `[UNVERIFIED]` above rather than asserted |

**Confirmed genuine mutator WITHOUT a byte-diff proof (1) — filed as A-9.D6,
Medium:** `plan5-keys.js` writes `content.json`/`site-info.json`/
`products-all.json` are restored via `restoreMirrorData()` (a plain
`copyFileSync` loop, called in a `finally`), and it also rebuilds and
reinstalls the production JS bundle after its dev-bundle detour — but neither
restore step is followed by any assertion (`note(...)`, `.equals()`, or
otherwise) proving the copy succeeded. Every other genuine mutator in this
census pairs its restore with an explicit check; this one does not.

**Confirmed classifier false positives (~20) — read `pristine/*.json` or a
mirror `data/*.json` value only, as a comparison baseline, and write nothing to
the mirror:** `contactflow.js` (reads `site/data/site-info.json` to trace the
auto-reply's business details), `plan3-contact.js` (reads
`pristine/content.json`), `plan10-header.js` / `plan5-images.js` /
`plan8-catalog.js` (each reads `pristine/products-all.json` as a baseline),
`plan10-admincrawl.js` (whose own comment states "no pristine restore is
owed"), and — by the same "no write call found" test — `plan8-certs`,
`plan8-chrome`, `plan8-landing`, `plan8-meta`, `plan8-mobile`, `plan8-polish`,
`plan7-approvals`, `plan7-datasheets`, `plan2-sku`, `plan2-formlast`,
`plan5c-eyebrow`, `plan3-autoreply`, `contactflow-selftest`, `nodupbackups`.
"Does it restore pristine and prove it with a byte diff" does not apply to
these — there is nothing for them to restore. **Not filed as a finding**: the
suites are not wrong, the classifier's pattern is just wider than "mutates".

### Step 5 — `node --check` over every `_harness/*.js`

```
for f in _harness/*.js; do node --check "$f"; done
→ 153 files checked, 0 failed to parse
```

No probe needs retiring for a parse failure. **No finding.**

### Step 6 — `_harness/README.md` truth

Every suite in the "Standing regression — these must stay green" table
(lines 99–118) is present in `sweep-list-final.txt` or was run directly
(the two compound `file.js` / `-selftest.js` cells both resolve to two real,
present names). The three names that don't resolve to a sweep entry —
`backdrop`, `lint`, `plan10-shot` — are exactly the three step 1 already
established are correctly non-runnable-as-suites. **No finding.**

The expected-reds picture: the completed sweep
(`_harness/out/audit9/sweep-before.txt`, cited, not re-run) shows exactly four
non-clean results out of 80 — `brandtext` (36/47 = 11 failing, ≤ 13 ✓),
`isoclaims` (2/4 ✓), `plan8-polish` (16/17 on Linux ✓), and `fgpatch`
(CRASHED — not one of GUARDRAILS §4.4's four). `plan8-contrast` reports its
documented **passing** state, 34/35, not a red. So: the suites §4.4 permits
as red are exactly the ones that are red, with one addition — `fgpatch` —
which is not a permitted expected-red at all; it is a misclassified codemod
(A-9.D5). This is the same fact C's own `audit-runs/audit9.md` §1.4 already
records ("CRASHED: one-shot codemod… not a site defect → P11 (retire from the
sweep list or the classifier)") — this pass's job was exactly that
resolution, filed below as A-9.D5.

Bootstrap on a fresh clone: Phase 0 is the evidence (`audit-runs/audit9.md`
§1.2), `npm ci` exit 0 with no lockfile fallback, `npm run build` 0 errors,
`php _harness/lint.php` green, `sh _harness/sync.sh` exit 0, the three
named servers plus the 8130–8139 fleet all answering. Not re-run by this
pass (would contend with the live sweep/other agents' mirrors). **No
finding.**

### Step 7 — `.gitignore` coverage

```
.gitignore:78-80   _harness/site/  _harness/pristine/  _harness/out/
git ls-files _harness/site _harness/pristine _harness/out   → empty
git ls-files _harness/ | wc -l                               → 169 tracked
```

All three generated directories are ignored; nothing generated is tracked.
(169 vs Appendix A's "164 tracked" — the +5 matches this round's new
instrument files across all passes, not a gitignore gap.) **No finding.**

### Step 8 — this plan's own paths

Every `_harness/` and `audit-runs/` path named in this plan/brief and checked
this pass exists: `_harness/out/audit9/step0.md`, `sweep-before.txt`,
`lint-before.txt`, `build.txt`, `_harness/audit9-crawl.js`,
`_harness/audit9-adminflows.js`, `_harness/audit9-strings.js`,
`audit-runs/audit9.md`, `audit-runs/audit9-ledger.md`, this pass's own two
prior working files. Every command in Appendix A / §4.2 ran as written per
C's Phase-0 record (`audit-runs/audit9.md` §1.2) — not re-run by this pass.
**No finding.**

## Findings

### A-9.D5 — Medium — a one-shot codemod is misclassified as a regression suite and now crashes the sweep

class:        harness
pass:         P11     ledger: E112
surface:      `_harness/fgpatch.js`
where:        `_harness/fgpatch.js` (whole file is the codemod; header comment lines 1-27), measured on `2121597`, 2026-09-14
not in §11:   not previously recorded as a defect (the crash itself is new evidence this round — `_harness/out/audit9/sweep-before.txt`); `audit-runs/audit9.md` §1.4 independently noticed the same crash and named it a P11 row, so this record resolves that row rather than duplicating it
reproduce:    `node _harness/fgpatch.js` (read-only unless `--write` is passed; this pass ran it without `--write`)
observed:     `CRASHED — expected 10 accent-2 text sites, found 1 — the mapping is stale, re-derive it with _harness/fgsurfaces.js` (`sweep-before.txt`)
expected:     `_harness/README.md`'s own "Investigative tools" section classifies `fgpatch` as one of "the codemods that did the brand-color migrations" — a one-shot script meant to be run once against a specific historical state of `src/App.jsx` (its header comment hardcodes 10 ordinal-indexed line locations from that state) and never again. The Appendix A classifier includes it in "the 58" only because it happens to call `ok()`/`check()`-shaped helpers and exits non-zero on a mismatch — properties of a migration script that verifies its own precondition, not of a regression check
consequence:  every sweep this round (and presumably every one since the classifier started including it) reports a false "FAIL" that is not a site defect and is not one of GUARDRAILS §4.4's four permitted expected reds — an executor comparing sweep output to §4.4 sees an unexplained fifth red and must independently re-derive that it is a classifier artifact, exactly as this pass had to
evidence:     `_harness/out/audit9/sweep-before.txt` (`FAIL fgpatch`); `_harness/fgpatch.js:1-27` (header documents its one-shot, ordinal-hardcoded design); `_harness/README.md:210-211` (classifies it as a codemod, not a check)
verified-by:  (pending V)
outcome:      (pending C) — recommend either excluding `fgpatch`/`inkpatch`/`inkfix`/`inkclass` (the other three named codemods) from the Appendix A classifier's pattern, or adding `fgpatch` to GUARDRAILS §4.4 as a fifth, permanently-expected non-green with its own reason, whichever C judges cheaper; either closes the gap without touching the codemod itself
fix-proof:    n/a — not fixed by this pass

### A-9.D6 — Medium — `plan5-keys.js` restores the mirror and the bundle but never proves either restore

class:        harness
pass:         P11     ledger: (none — not a pre-listed ledger row; census finding under PLAN-11 §6 step 4)
surface:      `_harness/plan5-keys.js`
where:        `_harness/plan5-keys.js:123-127` (`restoreMirrorData()`) and `:306-310` (bundle reinstall in `finally`), measured on `2121597`, 2026-09-14
not in §11:   not previously recorded
reproduce:    read `_harness/plan5-keys.js` in full: `restoreMirrorData()` is a bare `copyFileSync` loop with no return value checked and no caller-side assertion; the `finally` block at the end of `run()` calls it, rebuilds the production bundle, and reinstalls it, then the function returns — no `note(...)`/`.equals()`/byte-compare of any kind follows either restore
observed:     absence — grepped the whole file for `equals(` and `byte`: zero matches, versus every other genuine mutator in this round's census (`plan6-families`, `plan5-social`, `plan2-trunc`, `plan5c-sitemap`) which all end with an explicit `fs.readFileSync(...).equals(fs.readFileSync(...))` assertion
expected:     PLAN-11 §6 P11 step 4's own bar: "does it restore pristine and prove it with a byte diff at the end of its own run?" — every sibling suite that mutates `data/*.json` does exactly this; this is the one exception found
consequence:  if `restoreMirrorData()` or the bundle reinstall ever silently failed partway (a locked file, a full disk, a `build` error swallowed by `sh()`), nothing in the suite itself would notice — the mirror could be left on dev-bundle or partially-restored data for whatever ran after it in the same sweep, and the first symptom would be an unrelated suite's failure with no link back to this one. Medium, not High: this has not been observed to happen, and `sync.sh` re-syncs the mirror before most other work anyway — but the same silence is exactly what made A-8.6's NB10 recurrence possible until a check existed for it
evidence:     `_harness/plan5-keys.js` (whole-file grep, reproduced above); compare `_harness/plan5c-sitemap.js:246-247`, `_harness/plan5-social.js:352-353`, `_harness/plan6-families.js:262-264`, `_harness/plan2-trunc.js:141-142` for the pattern this suite lacks
verified-by:  (pending V)
outcome:      (pending C) — recommend adding one `note(fs.readFileSync(...).equals(...), 'mirror data restored from pristine')` per restored file, matching the four sibling suites' shape; delta-only, no change to what the suite tests
fix-proof:    n/a — not fixed by this pass

### A-9.D7 — Low — seven assertive suites are documented nowhere in `_harness/README.md`

class:        doc
pass:         P11     ledger: E105, E161
surface:      `_harness/README.md` (all five suite tables)
where:        `_harness/README.md` — no row for any of the seven, checked against all five tables (lines 99-118, 120-156, 157-167, 168-183, 184-205), measured on `2121597`, 2026-09-14
not in §11:   the file's own line 184-190 records the *same class* of defect being closed once already (14 suites in 2026-08-18) — this is a recurrence, not the same instance, so it is filed rather than skipped
reproduce:    `grep -lE "process\.exit\(|process\.exitCode" _harness/*.js | xargs grep -lE "\bok\(|\bcheck\(|\bassert"` (Appendix A's own classifier) minus every name appearing anywhere in `_harness/README.md`
observed:     `backdrop-selftest.js`, `plan7-approvals.js`, `plan7-datasheets.js`, `plan7-imagery.js`, `plan8-faq.js`, `plan8-formpolish.js`, `plan8-landing.js` — all seven exist on disk, are well-formed (`node --check` clean, step 5), and all ran green in this round's sweep (`sweep-before.txt`: `plan7-approvals 11/11`, `plan7-datasheets 8/8`, `plan7-imagery 11/11`, `plan8-faq 19/19`, `plan8-formpolish 15/15`, `plan8-landing 18/18`, `backdrop-selftest 9/9`)
expected:     every runnable, assertive suite has a row somewhere in `_harness/README.md`, per the standard the file's own 2026-08-18 section sets for itself
consequence:  Low, not Medium: unlike the 2026-08-18 recurrence, none of these seven suites is missing from the actual sweep — `sweep-list-final.txt` already includes all of them, so no coverage is silently skipped; the gap is purely that a reader of `_harness/README.md` alone would not know these suites exist or what they check
evidence:     `_harness/out/audit9/only-assertive.txt` (C's Phase-0 diff); `_harness/out/audit9/sweep-before.txt` (all seven green); this record's own reproduction above
verified-by:  (pending V)
outcome:      (pending C) — a seven-row addition to the appropriate existing tables (the `plan7-*`/`plan8-*` rows belong in "Per-plan acceptance" or "Suites named nowhere until 2026-08-18"'s successor section; `backdrop-selftest` belongs beside `backdrop.js` in "Standing regression")
fix-proof:    n/a — not fixed by this pass
