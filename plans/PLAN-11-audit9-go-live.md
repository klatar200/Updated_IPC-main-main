# PLAN-11 — Audit 9: the full go-live audit

**Status:** OPEN — not started. **Revision 2** (2026-09-14; the revision log is at the end).
**Written:** 2026-09-14 against `main` @ `ad2267e` (PR #53 and PR #47 merged the same day).
**Audience:** the agents executing the audit. Dense by design; agent-parse only.
**Binding order:** [`plans/GUARDRAILS.md`](GUARDRAILS.md) → this file → the pass briefs in §6. A pass brief may add a constraint; nothing here relaxes one from GUARDRAILS.
**Deliverables:** `audit-runs/audit9.md` (§8), `audit-runs/audit9-ledger.md` (§5), a verdict (§9), one PR (§8.4).
**Numbering:** PLAN-10 §12 called the severity-C cluster remediation "the natural PLAN-11". That work is still unplanned and takes the next free number; this file takes 11 because it is the one being executed.

---

## 0. Read order — scoped by role. Nobody reads everything.

Context economy is a rule, not a preference. Each row says who reads it and what to take from it.

| # | File | Who | Take |
|---|---|---|---|
| 1 | `plans/GUARDRAILS.md` | **all** | §0 premise, §1 scope, §2 hard prohibitions, §4.3 what `php -S` cannot test, §4.4 test-first, §5 working rules, §7–§7.3 do-not-re-report / environment artifacts / refuted / settled, §8 handback. C also reads §4.1–4.2. |
| 2 | this file | **all** — but only: §2, §3, §10, §11, §13; **C** everything; **a pass agent** adds its own §6 brief and Appendix rows its brief names; **V** adds §3.3, §7.1, §13.1 | The rules and the brief. A pass agent does not read other passes' briefs. |
| 3 | `CLAUDE.md` | C, P3, P7 | The 16 invariants and the security posture. Re-verify; do not re-derive. |
| 4 | `_harness/README.md` | C, P11 | Bootstrap, servers + fleet, the suite → item map, expected reds, the bailing rule. Pass agents get the rows their brief names, quoted in their launch prompt (§13.4). |
| 5 | `GO-LIVE.md` | C, P8, P4 (step 1 only) | STEP 0, A, B, C, the rollback. |
| 6 | `audit-runs/audit8.md` | C, V | §0 lenses already used, §2 findings, §3a, §4 checked, §5 what is left. |
| 7 | `audit-runs/audit7.md` §3–§5; `audit-runs/audit5.md` "Refuted" + "Checked" | C, V | The refuted / not-taken lists behind §11. Pass agents consult §11's pointers **by grep for the item**, never by reading the files. |
| 8 | `audit-runs/project-map.md`, `endpoint-checklist.md`, `missed-coverage.md` | C | The surface inventory (E001–E112) Phase 1 extends. Line numbers are stale by design; re-measure. |
| 9 | `WHATS_LEFT.md` | C: §2 (~lines 141–641) and §3 (~641–776) only. Everyone else: **grep by item ID only.** | Open items, declined/deferred. **Never read top to bottom (5,896 lines).** |
| 10 | `README.md`, `admin/README.md`, `Editing-Your-Site-Content.md`, `Email to Rick - Admin Dashboard Handoff.md`, `PATCH_NOTES.md`, `DEPLOY_READINESS_v2.md` §7 | the pass that owns them (P5c, P8) | Audit **targets**, not context. `DEPLOY_READINESS_v2.md` is frozen — never edited. |

`src/App.jsx` (13,136 lines on 2026-09-14) is never read end to end: `grep -n` the component or identifier, then read ±40 lines. `HomePage` is at 3125 today; the map says 3117.

---

## 1. Objective and definition of done

**Objective.** Establish, with evidence, whether the project is ready to go live, and close every defect that is closable in code, harness or docs before it does. Four lenses are mandatory and named in the brief: (a) bugs, (b) gaps in logic, (c) verbiage, (d) page structure. Eight prior rounds covered correctness and security deeply; (c) and (d) have never been run as their own passes and are where this round is expected to find most of its findings.

**Done means all of the following are true, with the artifact that proves each:**

1. Phase 0's inherited-state block is recorded verbatim in `audit-runs/audit9.md` §1, measured before anything was read for findings.
2. The coverage ledger (Phase 1) has every row `done` or `blocked` with a reason. No row `pending`.
3. Every assertive harness suite has a recorded result this round (the standing rule from `audit-runs/missed-coverage.md` Run 4).
4. Every finding carries the §13.1 record: ID, severity, class, surface, `file:line`, a reproduction a second agent ran, the artifact path, and its outcome.
5. Every fix has a before-and-after artifact and a check that failed before it and passes after it.
6. The full sweep after the last fix is green except the documented expected reds (§4.4), with denominators equal to the baseline fixed in §4.3.
7. `audit-runs/audit9.md` exists in the §13.2 shape; `WHATS_LEFT.md` has its append-only entries; the verdict (§9) is stated with its list.
8. The handback (§8.5) states plainly what was not done.

"No findings" is not a result. A pass that finds nothing records what it measured and how it could have failed.

---

## 2. Premise and tiebreak

Unchanged from GUARDRAILS §0. The admin's audience is **Rick** — the owner, non-technical, uses FTP reluctantly. The public site's audience is **a buyer looking for a spec-grade part** and a purchasing/quality person qualifying a supplier. Every judgement call — severity, wording, whether a structure is wrong — is settled by asking which option protects one of those two people. A finding that harms neither is Low at most and is in scope only if it is verbiage or structure (P5, P6).

---

## 3. Execution model

### 3.1 Roles

| Role | Count | Does | Must not |
|---|---|---|---|
| **Coordinator (C)** | 1 | Phase 0, Phase 1, the three shared instruments (§3.3), dispatch, triage, dedupe, every fix, consolidation, records, PR. Also runs P10 and P11's mechanical steps itself. | Write a finding without a reproduction of its own. Skip a pass because another "probably covered it". Edit the ledger while passes are running except to add rows. |
| **Pass agent (P1…P11)** | 1 per brief (P5 is three: P5a/b/c) | Executes exactly one §6 brief. Writes to its own working file `audit-runs/audit9/P<n>-<slug>.md` in the §13.3 shape, and to `_harness/out/audit9/P<n>/`. Writes instruments only where its brief names them. | Edit any other file. Fix anything. Touch another pass's surface. Read another pass's brief. Update the ledger. |
| **Verifier (V)** | 1–3, never the agent that raised the finding | Re-runs each assigned reproduction from a fresh private mirror (§3.4) before a finding is accepted. Refutes with a measurement, or accepts. | Accept on the pass agent's word. Change a severity without writing the consequence next to it. |

A single agent may play every role sequentially if parallelism is unavailable. The role boundaries still apply: raising, verifying and fixing a finding are three separately recorded steps, and verification is a re-run from a clean mirror.

**Model tiering (recommendation, not a rule).** Mechanical passes (P1, P10, P11, P2 steps 1–2 and 4, P5 rules 1–5) can run on a smaller model. Judgement passes (P5 rules 7–10, P6 step 3, P7, P3) and every V run on the strongest available. The downside: a smaller model on a mechanical pass will still write prose around its outputs; the §13.3 header format is what keeps that cheap to triage.

### 3.2 Waves — what runs when, and what may run at once

```
Wave 0  (C, serial)         §4.2 bootstrap → §4.3 suite reconciliation → §4.6 STEP 0 → start the sweep in the BACKGROUND
                            → Phase 1 ledger  ‖  three instrument agents I-crawl, I-admin, I-strings in PARALLEL (§3.3)
Wave 1  (parallel)          P1 P2¹ P3 P4 P5a P5b P5c P6² P7 P8 P9² P11   — each on its own mirror copy + port (§3.4)
                            ¹ P2 step 3 waits for P3 and P7 to finish (it reads their E_ALL log)
                            ² P6, P9, P10, P5a wait for I-crawl / I-strings output; everything else starts immediately
Wave 2  (C)                 P10 from the crawl JSON; consolidation + dedupe (§7.0); V assignment
Wave 3  (V, parallel)       reproductions, split by severity then by pass; each V on a fresh mirror copy
Wave 4  (C, serial)         fixes (single fixer) → surface-selected regression batches → FULL sweep in the background → records → PR
```

Concurrency cap: **four** browser-driving agents at once on one box (I-crawl, P3, P6, P7, P9 are browser-driving; P4 step 6, P8 steps 2–5 and V runs also open a browser). Grep/file-only passes (P1, P2 steps 1–2/4, P5b/c rules 1–5, P8 step 6, P11) are uncapped. If the box is smaller, drop the cap; do not drop the private-mirror rule.

**The sweep stays serial.** It is one `run.js` invocation; the suites hardcode `:8123` and 26 of the 58 assertive suites write to or restore the mirror's `data/` (census 2026-09-14, command in Appendix A), so parallel workers on one docroot contaminate each other and `php -S` serves one request at a time. The parallelism gain is that the sweep runs **unattended in the background** while Phase 1 and Wave 1 proceed — nobody waits on it. Honest downside: the sweep's wall-clock is the floor of Wave 0–1.

### 3.3 Shared instruments — measure once, consume many times

Three instruments are built in Wave 0 by three parallel agents (or C), each accepting `BASE_URL` (or `PORT`) and an output directory, deterministic (fixed viewports, `Liberation Sans` forced, no timing assertions without a documented settle), and emitting JSON that passes **query**, never read in full.

| Instrument | Emits, per page/route | Consumed by |
|---|---|---|
| `_harness/audit9-crawl.js` — every public route + all 42 product pages + the 13 admin pages (signed in), at 390/834/1440/1920/2560 (admin: 390/1440) | console messages, failed requests, responses ≥ 400, transfer bytes, heading outline, landmark tree, `<title>`/meta/canonical/`og:*`/`noindex`, every JSON-LD block, Playwright accessibility snapshot, all `<img alt>`, all link texts + hrefs, all form-control labels, a screenshot per viewport | P4 step 7, P5a (public strings), P6, P9, P10 |
| `_harness/audit9-adminflows.js` — drives every admin page GET signed-out and signed-in, and every mutating POST once with valid data (add, edit, delete, both uploads, settings, content, backups restore, password change with a wrong current password, close-reset-window), plus both contact forms and `/sitemap.xml`; against a given port | status, first 200 bytes of body, `Set-Cookie`, byte-diff of the mirror's `data/` before/after each step, the PHP error log delta | P2 (the E_ALL log), P3 (steps 1–2 baseline), P7 (C19–C29 baseline) |
| `_harness/audit9-strings.js` — the string inventory | one record per string `{surface, locator, text, editable_on}` over the surfaces in P5 | P5a/b/c; P4 step 2 (claims register seeds from it) |

Single-owner table for measurements two passes would otherwise both take:

| Measurement | Owner | Others cite, never re-measure |
|---|---|---|
| Console-clean crawl, failed requests, ≥ 400s | I-crawl → P10 | P6, P9 |
| URL / parameter behaviour (`?productId=` unknown, `?family=`, trailing slash, …) | P7 rows C1–C4 | P6 step 6 cites C1–C4 |
| Type tolerance of `content.json` / `site-info.json` | P7 rows C7–C8 | P4 cites; P4 step 6 is deleted |
| Contact-form abuse controls | P3 step 8 (suites) | P7 rows C11–C18 cite P3 for the suite-covered rows and run only the `new` ones |
| Is the site live (STEP 0) and the live/repo data diff | C, §4.6 | P4, P5, P8 consume `_harness/out/audit9/step0.md` |
| Developer-doc numeric/factual truth (`README.md`, `CLAUDE.md`, `_harness/README.md`, `GUARDRAILS.md`, `GO-LIVE.md`) | P8 step 6 | P5c audits only their *language* |
| Owner-doc instructional accuracy (`admin/README.md`, `Editing-Your-Site-Content.md`, `Email to Rick…`, `help.php`) | P5c | P8 does not open them |

### 3.4 Mirrors and ports — one per agent that mutates or drives a browser

`_harness/site/` (built by `sync.sh`, ~21 MB) is the **sweep's** mirror on `:8123`/`:8124`/`:8125` + the fleet. Nothing else touches it. Every pass agent and every V that mutates data or drives a browser makes its own copy and serves it:

```sh
cp -r _harness/site _harness/out/audit9/site-P3 && php -S 127.0.0.1:8141 -t _harness/out/audit9/site-P3 -c _harness/php-mail.ini _harness/router.php &
```

| Port | Owner | ini |
|---|---|---|
| 8123 / 8124 / 8125 / 8130–8139 | the sweep only | per `_harness/README.md` |
| 8140 | P2 — `E_ALL`, `display_errors=On`, `log_errors=On`, `error_log` under `_harness/out/audit9/P2/` (a copy of `php-mail.ini` with those four lines; not committed) | — |
| 8141 P3 · 8142 P4 · 8143 P6 · 8144 P7 · 8145 P8 deploy-sim · 8146 P9 · 8147 I-crawl · 8148 I-admin | one each | `php-mail.ini` |
| 8150–8159 | V, one per verifier | `php-mail.ini` |

P3 and P7's manual flows run against **P2's `:8140`** as well (or P2 replays `audit9-adminflows.js` on `:8140` itself) so the deprecation log is a by-product of work already being done. Existing suites (hardcoded `:8123`) run **only** inside the sweep, never by a pass agent. A private mirror is restored by re-copying; the sweep mirror is restored from `_harness/pristine/` and proven with a byte diff.

### 3.5 Token discipline — the rules that keep twelve agents cheap

1. **Read-scoping is §0.** A pass agent's launch prompt (§13.4) inlines its brief and the `_harness/README.md` rows it needs; the agent opens this file only for §2, §3, §10, §11, §13.
2. **Outputs over 40 lines go to a file** under `_harness/out/audit9/<pass>/` and are cited by path. The working file holds scores, paths and records — never pasted logs, never screenshots described in prose.
3. **Inventories and crawl JSON are queried, never read.** `node -e` / `jq` filters; the agent reads the hit list. Reading `audit9-strings.json` into context is a defect in the pass.
4. **C triages from headers.** Every working file starts with the §13.3 header (counts, one line per finding, ledger rows, out-of-brief lines, artifact index). C reads records on demand, by ID.
5. **Grep, then ±40 lines.** `App.jsx`, `config.php`, `content.php`, `help.php` and `WHATS_LEFT.md` are never opened whole.
6. **Do-not-re-report is a grep.** `grep -n "<ID or phrase>" audit-runs/*.md plans/GUARDRAILS.md` and read the hit; never re-read a prior audit to "get context".
7. **Suites already ran.** A row whose evidence column names a suite is satisfied by the Phase 0 sweep line; the agent cites the score and moves on.
8. **One reproduction, written once.** The §13.1 `reproduce:` field is what V runs; if it is not enough for V to run cold, the pass agent, not V, rewrites it.
9. **Batch by rule, not by instance** (P5, P6): one record, N instances listed in a file.
10. **Do not narrate.** Working files and `audit9.md` carry results; the "why" of a decision is one line.

### 3.6 Acceptance of a finding — the second-agent rule, with sampling

A finding enters `audit9.md` only after V reproduced it, from the record's `reproduce:` field, on a fresh private mirror (§3.4). Blocker / High / Medium: every finding, fully. Low batches: V reproduces **3 instances chosen by V** (all, if fewer than 3) and records which; a batch with a non-reproducing sample goes back to the pass agent whole. If V cannot reproduce, the finding goes to `audit9.md` §4 as "raised, not reproduced" with both measurements. AUDIT-11 precedent: five published numbers did not reproduce, and auditor ≠ verifier is why.

### 3.7 Attempt and stop conditions

- A pass stops when its exit criteria (§6) are met, or when it has written its blocked list. It never widens its scope to compensate for time.
- Fix loops: ≤ 3 attempts, then stop and escalate with what was tried, observed, and now believed (GUARDRAILS §5).
- A pass agent that finds something outside its brief writes one line under `## Out of brief` in its working file (`file:line`, one sentence) and stops thinking about it. C routes it. It is not audited by the agent that noticed it.

---

## 4. Phase 0 — environment and inherited state (C, before any reading for findings)

Everything below is recorded verbatim into `audit9.md` §1 as "The inherited state". A plan that starts from red must say so.

### 4.1 Toolchain, as measured 2026-09-14 in the remote container

| Tool | Version | Note |
|---|---|---|
| PHP (CLI) | 8.4.19 | Production is documented as "PHP 7.4+ (8.0+ recommended)" (`README.md:14`). The production version is **[UNSOURCED]** — see P2 and §4.6. |
| Node | 22.22.2 | |
| npm | 10.9.7 | `node_modules/` is absent on a fresh clone. |
| Playwright Chromium | 1194 at `/opt/pw-browsers` | Do not run `playwright install`. |
| `.gitattributes` | `*.sh text eol=lf` | Merged 2026-09-14 (PR #47). `git ls-files --eol _harness/*.sh` shows `i/lf w/lf`. |

### 4.2 Bootstrap — exact order

```sh
npm ci                                   # lockfile-exact; if it fails, `npm install` and record the lockfile diff as P1 input
npm run build                            # record the JS/CSS kB line
php _harness/lint.php                    # must be all green before anything else
sh _harness/sync.sh                      # builds _harness/site (+ pristine on a fresh clone); copies admin/logo.svg; creates uploads/images/
ls _harness/site/admin/logo.svg _harness/site/uploads/images   # both exist since PR #47 — if not, the checkout predates it
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini    _harness/router.php &
php -S 127.0.0.1:8124 -t _harness/site -c _harness/php-trunc.ini   _harness/router.php &
php -S 127.0.0.1:8125 -t _harness/site -c _harness/php-nb2-off.ini _harness/router.php &
for p in 8130 8131 8132 8133 8134 8135 8136 8137 8138 8139; do php -S 127.0.0.1:$p -t _harness/site -c _harness/php-mail.ini _harness/router.php >/dev/null 2>&1 & done
```

Run from the repo root. `lint.php` on 2026-09-14, PHP 8.4.19, `main` @ `ad2267e` — the state you inherit:

```
php -l                    19 files, 0 failing
node --check              10 admin JS files, 0 failing
JSON parse                content 17 / site-info 10 / products-all 42 entries
copy-key drift            copydrift OK — every offered field has a default (110 matched, 0 JS-only)
family drift              11 families, PHP and JS identical
approval drift            12 approvals, PHP and JS identical
photo-default drift       5 slot defaults, PHP and JS identical
audit-action drift        14 actions, filter list and call sites identical
inquiry-type drift        5 rejection types, contact.php and inquiries.php identical (+2 lead types, correctly not listed)
family literals           none in add.php or edit.php
doc drift                 46 harness file refs in 3 binding docs, all resolve
section drift             61 WHATS_LEFT sections, no number reused
href guard drift          2 owner-editable href fields, guarded client and server side
```

### 4.3 The sweep list — reconciled BEFORE the sweep runs, so the denominator is fixed once

1. Derive the assertive set mechanically (Appendix A). On 2026-09-14: **58** of 164 tracked `_harness/` files.
2. Extract every suite named in `_harness/README.md`'s "Standing regression", "Per-plan acceptance", "Audit-5/6/7 acceptance" and "Suites named nowhere until 2026-08-18" tables.
3. The sweep list = the **union**. Every name in one set and not the other is a P11 row (§6 P11 step 1) — written now, resolved later. Audit 8 ran "79 suites"; the classifier is a heuristic; the union is what runs. Record the three counts.
4. Start the sweep **in the background** and continue with §4.6 and Phase 1: `node _harness/run.js <union…> > _harness/out/audit9/sweep-before.txt 2>&1 &`, then the selftests and `invariants` the same way. One line per suite with the score **and the denominator**.

### 4.4 Expected reds — the only four allowed

| Suite | Expected | Judge by |
|---|---|---|
| `plan8-contrast` | 34/35 | exactly one `EXEMPT_BRAND_SURFACE` |
| `plan8-polish` | 16/17 on Linux | the C49 font check only (DejaVu) |
| `brandtext` | ≤ 13 failing | the **failing count**, not the ratio |
| `isoclaims` | 2/4 | expected red until the registrar answers (A-8.5). If it is green, the owner resolved it — record that. |

Any other red is inherited (record it; it is a finding of this round if no prior audit recorded it) or a **bail** — compare the denominator to `GUARDRAILS.md` §4.1 / `audit-runs/audit8.md` §1. A changed denominator means the suite never ran its checks: check server liveness, the fleet, and `config.local.php` in the mirror before writing anything.

### 4.5 Blocked-if

Phase 0 is blocked, and the audit does not proceed to findings, if: `lint.php` is red; `invariants` is not 17/17; `npm run build` errors; `sync.sh` fails; or `plan2-trunc`/`plan5-throttle` bail after the servers are confirmed up. Record the block and stop. Do not "work around" the harness to start auditing.

### 4.6 STEP 0 — is the site live? Done once, by C, consumed by P4, P5 and P8

```sh
curl -sI https://www.insulationproducts.com/data/products-all.json | head -5
```

Write `_harness/out/audit9/step0.md` with one of: **LIVE** (200 + JSON — then also `curl -s` all three `/data/*.json` into `_harness/out/audit9/live-data/` and `diff` each against the repo copy, classifying every hunk as *owner edit since deploy* or *repo change never applied live*), **NOT LIVE** (404 / nothing), or **[UNVERIFIED — network]** (unreachable from the container; the repo copies are the audit's truth and the label propagates to every claim that depends on it). These GETs are the only permitted requests to the live host besides `GO-LIVE.md` C1's `curl -sI` lines (§10.3).

---

## 5. Phase 1 — the coverage ledger (C only)

The ledger is the scope fence. **If it is not in the ledger, it is not in the audit; add it to the ledger first, then audit it.** That makes every scope change visible in the diff. **Only C edits the ledger**; pass agents report row outcomes in their §13.3 header and C transcribes at consolidation.

1. Copy `audit-runs/endpoint-checklist.md` to `audit-runs/audit9-ledger.md` with every status reset to `pending` and "Audited at" cleared. Keep the E-IDs. (Committed.)
2. Re-measure every `App.jsx:<line>` in it (`grep -n "^function <Name>"`) and correct the row. Stale line numbers are ledger maintenance, not findings.
3. Extend from **E113** with everything that exists today and is named in no row. Known candidates (verify each exists before adding): `GO-LIVE.md`; `.gitattributes`; `_harness/sync.sh`'s `uploads/images/` and `logo.svg` steps; `_harness/isoclaims.js`; the `inquiry-type drift` and `href guard drift` checks in `lint.php`; `admin/csrf-back.js` (10 admin JS files today; the map says 9); `public/images/og-card.jpg`; `public/images/_unmatched/`; `data/.htaccess`, `pdfs/.htaccess`, `uploads/.htaccess`; the 42 product pages as a class; each of the 12 `copy` groups and 16 section arrays in `data/content.json` as verbiage surfaces; every admin flash/error/confirm string as a verbiage surface; the two email bodies in `public/contact.php`; the six owner/developer documents in §0 row 10; the three §3.3 instruments.
4. Add a `Pass` column. Every row has exactly one owner. Rows nobody owns are the first finding of the audit — against this plan.
5. Add the suite census: one row per name in the §4.3 union with `Pass = P11`, status `pending` until it has a recorded result this round.
6. Ledger done = every row `done` or `blocked <reason>` with a date. `blocked` rows are listed in `audit9.md` §5.

---

## 6. Phase 2 — the passes

Each pass: **Objective · Starts after · Scope · Method · Finding criteria · Not a finding · Artifacts · Exit.** Commands illustrate the measurement; anything longer than one line is a `.js`/`.php` file under `_harness/` named `audit9-<pass>-<what>.js`, accepting `BASE_URL`/`PORT`, deterministic, tracked and reviewed like code.

### P1 — Build, dependencies, and the shipped tree

**Objective.** What `npm run build` emits is exactly what the manifest says ships, reproducibly, from a lockfile-exact install, with no known-exploitable dependency reaching `dist/`.
**Starts after.** Wave 0. File-only; no mirror.
**Scope.** `package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `dist/**`, `README.md` deploy tables, `GO-LIVE.md` B1.

**Method.**
1. Cite Phase 0's `npm ci` result. If it fell back to `npm install`, the lockfile diff is this pass's first finding (the lock is not authoritative).
2. Build a second time into `_harness/out/audit9/P1/dist2/` (`vite build --outDir`); `sha256sum` both trees; diff. A *content* hash that differs is a finding; a renamed content-hashed file is not.
3. `ls -A dist` = exactly the eleven items in `GO-LIVE.md` B1 / `README.md`. Any extra is a finding (a source map, a dev artifact, a `products-all.json` copy — the T3.1 incident).
4. `grep -rl "localhost\|127.0.0.1\|example.com\|sourceMappingURL" dist/` — expected empty. (`placehold.co` reaches the page through data, P4 owns it.)
5. Bundle size vs 375.66 kB JS / 23.59 kB CSS (2026-08-27). > 10 % with no PR explaining it is Low.
6. `npm audit --json`; compare with `audit-runs/audit7.md` "What is left after A-7.10" (four advisories, each with a reachability argument). For each **new** advisory, re-derive reachability against this app as A-7.10 did — never copy an old argument onto a new advisory. `npm audit fix` without `--force` is permitted if it changes only the lockfile; record before/after counts.
7. `.htaccess` and `.user.ini` present in `dist/`; `dist/contact.php` and `dist/sitemap.php` byte-equal to `public/`.
8. `_harness/`, `audit-runs/`, `plans/`, root `*.md` absent from `dist/`.

**Finding criteria.** Anything in `dist/` not in the manifest or vice versa; non-reproducible content; a reachable advisory; a lockfile `npm ci` rejects.
**Not a finding.** A-7.10 rows 1–3 unless a new `navigate()` call site takes non-literal input — grep and say so.
**Artifacts.** Both hash lists, `npm audit` JSON, `ls -A dist`, the build line.
**Exit.** Steps 1–8 recorded.

### P2 — PHP runtime compatibility and the production host's assumptions

**Objective.** The PHP the host actually runs executes every entry point with zero deprecations, warnings or notices, and nothing depends on a version or extension the host lacks.
**Starts after.** Wave 0 for steps 1, 2, 4–6. **Step 3 after P3 and P7 finish** (it reads the `:8140` log they produced) — or P2 replays `audit9-adminflows.js` on `:8140` itself if they have not.
**Scope.** `admin/*.php`, `public/contact.php`, `public/sitemap.php`, `public/.user.ini`.

**Method.**
1. **Production version.** `admin/help.php:972` prints `PHP_VERSION` on Help, behind login — an owner-supplied fact. `[UNSOURCED]` unless the launch instruction states it; audit for **both** the 7.4 floor and 8.x cleanliness until known.
2. **7.4 floor.** Preferred: PHPCompatibility (PHP_CodeSniffer sniff; free, installed temporarily with composer under `_harness/out/`, never committed) at `--runtime-set testVersion 7.4`. Fallback: grep for ≥ 8.0-only constructs — `match (`, `?->`, named arguments, union types, `enum `, `readonly`, `never`, `new` in initialisers, `#[`, first-class callable `(...)`, `str_contains|str_starts_with|str_ends_with` — and verify each hit by hand. A hit with no guard is High while the version is unknown, Blocker if it is known to be 7.4.
3. **8.x cleanliness.** `grep -E "Deprecated|Warning|Notice|Fatal"` over the `:8140` error log written by `audit9-adminflows.js` and `plan10-admincrawl.js`. Every line is a finding: dynamic properties, `${var}` interpolation, null to a non-nullable internal parameter, implicit float→int, `strftime`, `utf8_encode`, `FILTER_SANITIZE_STRING`.
4. **Extensions.** For each the code needs (`finfo`, `gd`/`imagick`, `json`, `mbstring` if used, `session`, `openssl`): where used, whether the code degrades when absent, whether the health banner names it. Needed + unchecked + silent = Medium.
5. **`.user.ini` / `.htaccess`.** Not testable here. Reason from rule text; label `[UNVERIFIED]`; `GO-LIVE.md` C1/C3 verify. Never "passing".
6. **`mail()`.** The `From:` mailbox must exist (runbook A — owner). Confirm the `mail()===false` path still shows the phone-number message (T2.6).

**Finding criteria.** An 8.0+ construct without a guard while the floor is unknown; any log line in step 3; a needed extension the banner does not check.
**Not a finding.** `display_errors` on the live host (C3); Apache 2.2 syntax (GUARDRAILS §7).
**Artifacts.** The sniff/grep hit list with dispositions; the error log; the extension table.
**Exit.** Six steps recorded; the version either sourced or `[UNSOURCED]` in `audit9.md` §5.

### P3 — Security re-verification (re-verify, do not re-derive)

**Objective.** The posture in `CLAUDE.md` holds mechanically on today's code, and nothing added since audit 8 opened a hole. Authorised testing of the project's own mirror; nothing touches the live host.
**Starts after.** Wave 0 (I-admin's baseline output is convenient, not required). Own mirror on `:8141`; manual flows also replayed on P2's `:8140`.
**Scope.** `admin/**`, `public/contact.php`, `public/sitemap.php`, all four `.htaccess`, `.gitignore`, `.user.ini`.

**Method — enumerate, then request.**
1. **Auth gate.** Script: byte offset of first output vs byte offset of `require_auth()` for every entry point (15 rows; `auth.php`, `ping.php` and the two includes excepted). Then every page signed out, GET and POST: login page or the invariant-12 page; never data, a 500, or a server path in the body. Start from I-admin's signed-out rows; add only the POST-without-session cases it does not cover.
2. **CSRF.** Every `$_POST` read → nearest preceding `csrf_check()`. POST each mutating page signed in without the token and with a wrong token: rejection, no write (byte-diff `data/`). `csrf_check(false)` only on logout and password-reset.
3. **Escaping.** Every `<?= $…` / `echo $…` in `admin/*.php` not wrapped in `h()` dispositioned (constant / int / finding). `inquiries.php` through `h()` on today's file.
4. **Containment.** For each of the six file operations in `audit5.md` "Refuted" row 7: `?sku=../x`, `..%2f`, `?file=../../config.php`, a backup name outside the whitelist, a null byte. Clean rejection, no read, no write.
5. **Uploads.** `.php` renamed `.jpg`; GIF+PHP polyglot; SVG (must be refused); a 50 MB-declared PNG (`post_max_size` page); dimensions over the A-6.6 ceiling. Refusal with the per-code message; nothing lands.
6. **Session.** `Set-Cookie` from `auth.php`: `HttpOnly`, `SameSite=Lax`, `IPCADMIN`; `Secure` is `[UNVERIFIED]` here. `ping.php` unauthenticated mints no session file (A-7.3) — count before/after.
7. **Throttle.** Cite the sweep's `plan5-throttle` and `plan5b-pwthrottle` lines. Do not re-derive parallelism (audit 5 refuted it).
8. **Contact abuse controls.** Cite the sweep's `audit5-blockers`, `plan3-contact`, `plan3-autoreply`, `contactflow`, `audit7-lead` lines for: slot consumption on every rejected path, honeypot, referer variants, CRLF via `hdr()`, 200/5,000 caps, the Gmail-normalised auto-reply cap. Run by hand only what no suite asserts, and say which.
9. **Headers.** Rule text of public and admin `.htaccess` vs the settled list (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS under `env=IPC_TLS`, admin CSP). `[UNVERIFIED — Apache]`. Public tree has no CSP **deliberately** (`public/.htaccess:31`).
10. **Secrets / runtime files.** `git grep -nE '\$2y\$1[0-9]\$' -- ':!audit-runs' ':!_harness/setpw.php'` empty; no `config.local.php`, `*.jsonl`, `.login-throttle`, `ALLOW-PASSWORD-RESET`, `inquiry-log-failed` tracked; `git check-ignore -v` resolves each.
11. **Creatable files vs deny rules.** Every filename pattern the admin writes matched against `admin/.htaccess` and `data/.htaccess` `FilesMatch` text. Uncovered = High; rule *effect* `[UNVERIFIED — Apache]`, pattern *coverage* verifiable by reading.

**Finding criteria.** Output before `require_auth()`; a `$_POST` read with no `csrf_check()`; an unescaped echo; a containment payload that reads/writes; an upload that lands; a `ping.php` session; an uncovered creatable file; a tracked hash or runtime file.
**Not a finding.** `audit5.md` "Refuted" rows unless today's code differs — quote the diff. A-5.10 (deferred by the owner).
**Artifacts.** Auth-offset table; CSRF map; escaping dispositions; each request/response (status, 200 bytes, `data/` byte-diff); the coverage table.
**Exit.** Eleven steps recorded; `:8141` mirror discarded; mirror credential rule §10.3.

### P4 — Data truth: is what the site says true, and is the data well-formed

**Objective.** Every factual claim a buyer reads is true, sourced, and edited on a known screen; every record in the three JSON files is well-formed for every reader.
**Starts after.** §4.6 STEP 0 (reads `step0.md`); step 7 after I-crawl. Own mirror `:8142` for nothing — this pass is file-based except step 7's crawl JSON.
**Scope.** The three `data/*.json` (live copies if STEP 0 = LIVE), `COPY_DEFAULTS`/`SITE_DEFAULTS`, the JSON-LD emitters, `manifest.json`, `robots.txt`, `index.html` meta, `sitemap.php`.

**Method.**
1. Read `step0.md`. LIVE → audit the live JSON; every live/repo hunk classified as *owner edit* (expected; never "fixed" in the repo, never uploaded) or *repo change never applied live* (owner action via the admin — the A-8.7/A-8.8 privacy sections and the four `photoUrl` case fixes are the known candidates). NOT LIVE → repo copies. UNVERIFIED → repo copies, label carried.
2. **Claims register** (seed from `audit9-strings.json`, surface `public-data` + `public-defaults`): phone, fax, email, address, hours (`text` vs `opens`/`closes`/`days` agree), founded year, "over 50 years", "25 million feet", "$50 minimum", "same day or next business day", "one week or less", "ISO 9001" bare, UL / CSA / MIL-SPEC / AMS / FDA / RoHS, JIT, PPAP/IMDS, "privately held". Columns: where rendered, which admin screen edits it (or hardcoded `file:line`), disagreements between renderings (F13 precedent). `node _harness/isoclaims.js` — expected red (§4.4).
3. **Certification claims** carry commercial weight (A-8.5). A claim not in `site-info.json` `certifications` and not on the owner action list is class `decision`, escalated, never edited. Never write `:2015`.
4. **Products.** Cite the sweep's `imgcheck` (79 paths, byte-exact case) and `checkskus` lines; then a shape script: 42 records, `sku` unique/non-empty, `id` = `sku`, spec tables in the A-7.8 shape, `operatingTemp` formats (list distinct), units consistent per column, `badges` ⊆ the 12 approvals, `partType` ∈ the 11 families, `pdfLabel`/`additionalPdfs` on 1 product rendering and no empty slot on the other 41. The **five `placehold.co` `photoUrl`s** are a live third-party dependency: class `decision`, severity Medium, escalated in the §7 form; `WHATS_LEFT.md` records only "untouched" (2026-08-06), which is not a decision. Do not replace them.
5. **Content and site-info.** Every leaf non-empty or in `SITE_CLEARABLE`/`COPY_CLEARABLE`; every `page`-type field resolves to a known route; `deadlinks` line cited; `seo` = exactly the 9 routes; `privacySections` carries the A-8.7/A-8.8 text (repo: yes since PR #53; live: step 1).
6. *(Deleted in rev 2 — type tolerance is P7 rows C7–C8; cite them.)*
7. **Structured data** from the crawl JSON: parse every JSON-LD block; required properties per type (Organization: `name`, `url`, `telephone`, five address fields, `openingHoursSpecification` consistent with step 2; Product: `name`, `sku`, `description` a string (4.2), `brand`/`manufacturer` URL = `SITE_ORIGIN`; BreadcrumbList: absolute `item`s; FAQPage: count and text equal to the rendered accordion). Offline only.

**Finding criteria.** A false/unsourced/two-ways claim; a repo change never applied live (owner action); a malformed record a reader mishandles; JSON-LD missing a property or disagreeing with the page.
**Not a finding.** The ISO revision strings (registrar-gated); the `photoUrl` corrections in the repo (done); `copy.siteImages` absent (settled, GUARDRAILS §7.3).
**Artifacts.** Claims register; the live/repo diffs; the shape report; the JSON-LD table.
**Exit.** Steps 1–5 and 7 recorded; every register row has a source or `[UNSOURCED]`.

### P5 — Verbiage: every string a person reads (three parallel agents)

**Objective.** Every user-visible string on the public site, in the admin, in the two emails, and in the owner-facing documents is spelled correctly, grammatical, consistent with one controlled vocabulary, true (P4 supplies truth), addressed to the right reader, and accurate about the UI it describes.
**Starts after.** I-strings (all three); P5a also after I-crawl (alt/link/label fields come from it).
**Split.** **P5a** public site + meta + `public-jsx` + `public-defaults` + `public-data`. **P5b** admin pages + `help.php` + the two emails. **P5c** the owner-facing docs (`admin/README.md`, `Editing-Your-Site-Content.md`, `Email to Rick…`) plus the *language only* of `GO-LIVE.md` and `PATCH_NOTES.md` (P8 owns their facts). Each agent applies the ten rules to its surfaces and nothing else.

**The inventory** (`_harness/audit9-strings.js`, built in Wave 0) emits `{surface, locator, text, editable_on}` for: `public-jsx` (literal text nodes and `placeholder`/`aria-label`/`title`/`alt`/`label` props in `App.jsx` outside `COPY_DEFAULTS` — strings the owner cannot edit; each classified fine-as-hardcoded or should-be-editable, the latter one batched Low), `public-defaults` (`COPY_DEFAULTS`, `SITE_DEFAULTS` leaves), `public-data` (three JSON files' leaves — live copies if LIVE), `admin` (text nodes outside PHP blocks, flash/error/notice literals, every `data-confirm`, `help.php` in full), `email` (notification + auto-reply subject/body rendered with sample data), `meta` (`seo[]`, `index.html` title/description/`og:*`, `manifest.json`, `robots.txt` comments, 404, `CatalogError`, session-expired, too-large, `auth.php` no-password state), `docs` (P5c's files as sentences).

**Method — rules 1–5 are scripted over the inventory; the agent reads hit lists only. Rules 6–10 are read-through, per surface.**
1. **Spelling.** `which hunspell aspell`; if present, `en_US` + `_harness/audit9-words.txt` (SKUs, "Bolingbrook", "PPAP", "IMDS", "RoHS", family names…). Else `npx --yes cspell@latest --no-progress` on the exported text (temporary; **never** in `package.json`). Record which ran. Remaining hits dispositioned: typo (Low, batched, fixed) / proper noun (word list) / intentional.
2. **Controlled vocabulary** (Appendix B seed, extended). Per term pair, count every variant per surface; the majority public form is canonical unless the owner's data says otherwise; the rest is one Low per pair. Code/defaults/docs fixed; data strings are `data-live`.
3. **Punctuation / typography.** Curly vs straight quotes; `-` vs `–` vs `—`; Oxford comma; trailing periods on list items and buttons (none); `&` vs "and" in headings; `%`/`°`/`″` spacing; `…` vs `...`. Mixed on one page = Low.
4. **Capitalisation.** Majority style per surface (public h1/h2, admin h1/h2, buttons, nav), minority flagged; catalog case preserved; "ISO 9001", "UL", "CSA", "MIL-SPEC", "RoHS", "PPAP", "IMDS", "FDA" one form each.
5. **Mechanical grammar.** Doubled words, double spaces, `" ."`/`" ,"`, missing space at concatenation boundaries (`{a}{b}` in JSX, `. $x .` in PHP — F17 precedent), sentences > 35 words on the public surface.
6. **Truth.** Cross-reference P4's register; a string P4 marks false is P4's finding, not duplicated.
7. **Audience.** Public: no "JSON", "cache", "deploy", "FTP", "prod". Admin: no developer vocabulary in flash/help text ("JSON" only where Advanced mode introduces it). Emails: full company name and phone number, no chrome assumed.
8. **Instructional accuracy** (P5b for `help.php`, P5c for docs). Every imperative ("click **Save**", "under **Business Details**") checked against the mirror: control exists, exact label, stated location. First check: `Editing-Your-Site-Content.md` lists nine menu items; `admin/nav.php` renders "+ Add Product" and the brand text "Product Manager"; `help.php:322` describes a header bar with four quick links — do the three agree? `plan10-help` covers two abandoned workflows; cite it; audit the rest.
9. **Alt, link and label text** (P5a from crawl JSON; P5b from the admin pages). Informative `alt` describes the subject (not filename/"image"/SKU alone); decorative `alt=""`; logo `alt=""` + `aria-label` on the link is settled. Link names meaningful out of context. Labels name the data. Error messages name the field and the fix.
10. **Legal text** (P5a). The seven `privacySections`, FAQ shipping/returns/lead-time answers, any disclaimer. Internal consistency and truth against code only (A-8.7 method). Wording changes are **escalated**, never made.

**Finding criteria.** A rule violated, with string + locator + rule. Batched by rule.
**Not a finding.** The owner's voice in his own data (observations, no severity, listed for Keagan to forward or drop) unless misspelled or false. Strings in `_harness/`, `audit-runs/`, `plans/`, code comments.
**Artifacts.** `audit9-strings.json`; spell log + word list; vocabulary counts; per-rule lists; screenshots for every rule-8 miss.
**Exit.** Every surface × rule recorded in the three working files.

### P6 — Page structure and information architecture

**Objective.** Every page has one job, a heading outline that says so, landmarks a screen reader can jump by, one consistent header/eyebrow/intro/sections/CTA shape, no dead ends, and every route is reachable and listed in exactly the places it should be.
**Starts after.** I-crawl. Own mirror `:8143` for the cold-load anchor test and dead-end walks.
**Scope.** 10 routes + `NotFoundPage`, 42 product pages (all by script, 5 by hand), 13 admin pages, `Navbar`, `Footer`, `Breadcrumb`, `PageMeta`, `sitemap.php`, `SEO_DEFAULT`/`KNOWN_ROUTES`. Viewports from the crawl.

**Method.**
1. **Outline** (crawl JSON): exactly one `h1` naming the page's subject (F6 precedent: product page = product); no skipped levels; DOM order = visual order. `audit10-headings.js` is the precedent instrument.
2. **Landmarks** (crawl JSON): one `header`/`main`/`footer`; `nav`s distinct by `aria-label`; drawer `role="dialog" aria-modal`.
3. **Shape parity.** Table every inner page's top (eyebrow / title / intro / breadcrumb); majority pattern or a written reason. Every page ends with a path to `/contact` — record which. Home's section order judged against the buyer's job (find a part → trust the supplier → ask for a quote).
4. **Navigation graph** (crawl link lists): every `KNOWN_ROUTES` route reachable ≤ 2 clicks from `/`; every nav/footer/mega-menu link resolves to a route or an anchor that exists **on cold load** (A-03/F4 precedent — live test on `:8143`); sitemap `<loc>` set = `SEO_DEFAULT` + 42 product URLs (cite `plan5b-sitemap`, `plan5c-sitemap`); `robots.txt` allows all; nothing both in the sitemap and `noindex`.
5. **Dead ends.** Every empty state (search none, family none, approval none, datasheet filter — F11, FAQ, Inquiries, Audit Log, Backups), every error state (`CatalogError`, 404, contact failure, session expired, too-large upload), every terminal panel (contact success ×2): at least one forward link that is not Back.
6. **URL/parameter behaviour.** Cite P7 rows C1–C4; do not re-measure.
7. **Meta per route** (crawl JSON). Adopted rules for this audit: title ≤ 60 chars and unique; description 50–160 and unique; canonical = `SITE_ORIGIN` + path (`productId` the only allowed param); `og-card.jpg` exists, 1200×630, < 300 kB; 404 `noindex`. Cite `plan8-meta`/`plan9-meta` where they assert the same.
8. **Admin structure** (crawl JSON, admin pages). `h1` = current nav label; current tab marked; `content.php` primary action is the last focusable before `form_complete` (cite `plan2-formlast`); destructive controls distinct and confirmed (cite `plan2-delete`); health banner above the fold at 390 (cite `plan10-adminnav`, `plan10-helpwidth`).
9. **Print.** A-7.7 is open and deferred as its own change — record the `@media print` count (0 on 2026-08-27), do not fix.

**Finding criteria.** A rule in 1–8 violated; an unreachable or duplicated route; a dead end; meta outside the adopted rules; a route in one inventory and not another.
**Not a finding.** A-7.7; the `?productId=` scheme (settled); `/products` scroll restoration (refuted); PLAN-10 §12's 39 C-clusters unless the instance blocks a buyer path — cite the cluster and say why this instance differs.
**Artifacts.** Outline / landmark / shape / meta tables; the navigation adjacency list; the dead-end inventory.
**Exit.** Steps 1–5, 7–9 recorded.

### P7 — Gaps in logic: the state and edge-case matrix

**Objective.** Every conditional path and every input shape the world can send produces the outcome the site needs — not merely "does not crash". Appendix C is the matrix.
**Starts after.** Wave 0 (I-admin's baseline is convenient). Own mirror `:8144`; flows also replayed on P2's `:8140`.
**Scope.** The routing shim, `useProducts`, both providers and merges, `ErrorBoundary`, `ContactPage` both forms, catalog filters, `contact.php`, `sitemap.php`, `config.php` (`backup_*`, `save_*`, `require_auth`, throttle, `admin_password_write`), `edit/content/settings/backups/delete/upload-*/auth/password/index/ping.php`.

**Method.**
1. **Rows with an existing suite in `Evidence` are satisfied by the sweep line** — cite the score. Only rows marked `new` (in full or in part) are run: C1–C9, C13, C18, C19, C22, C23, C26, C31–C33 — **18 rows**. Each becomes an assertion in `_harness/audit9-logic-<area>.js` with a negative control proven once (remove the guard → the check fails → restore → record).
2. For every `if`/ternary in the four merge/fetch functions and `contact.php`'s decision chain, map branch → Appendix C row. A branch no row reaches is a coverage gap: add the row, run it.
3. **Time.** Browser: Playwright `clock` at 2026-12-31T23:59:59 and 2027-01-01T00:00:01 for the copyright range and effective date. PHP: the reset window and backup ordering are **mtime-based** — test boundaries with `touch -d` on `ALLOW-PASSWORD-RESET` (3599 s / 3601 s) and on backup files, not by freezing PHP's clock.
4. **Concurrency.** Two tabs on `edit.php` for one SKU, save both: the second gets the stale-signature message with typed values kept (B1). Same on `settings.php`, `content.php`. A save during a restore.
5. **Encoding.** `–`, `°`, `″`, `µ`, emoji, an RTL mark through: contact form → email + JSONL → `inquiries.php`; `settings.php` → `site-info.json` → footer; `content.php` → `content.json` → page. Byte-faithful; `JSON_UNESCAPED_UNICODE` on disk or a documented reason.
6. **One of three files failing** (row C5): each file, one at a time on `:8144`: 404 / HTML-200 (SPA fallback — `jsonOrThrow()` must reject) / truncated / wrong `Content-Type` / 12 s stall. Catalog routes → `CatalogError` with the phone number in the footer (invariant 8); other routes fully rendered; recovery on refocus/TTL without reload (4.25). Re-copy the mirror after each.

**Finding criteria.** Any row whose observed outcome differs from expected; any unreached branch after step 2 (the gap is Low; what the added row finds is scored on its own).
**Not a finding.** Rows proven by a green sweep line; the catalog-size cliff (refuted); scalar-field coercion (not taken, audit 7 §3) unless a row shows a non-string reaching a render site through an admin path.
**Artifacts.** Appendix C with an observed column; the branch → row map; every new instrument with its negative-control run.
**Exit.** No empty cell in Appendix C's observed column.

### P8 — The runbook dry-run and developer-document truth

**Objective.** `GO-LIVE.md` executed literally against a simulated server works step by step; every developer document describes today's system.
**Starts after.** §4.6. Own deploy-sim on `:8145`; a mirror copy for step 4's restore.
**Scope.** `GO-LIVE.md`, `README.md`, `CLAUDE.md`, `admin/README.md` (numbers only), `_harness/README.md`, `plans/GUARDRAILS.md` §4.1, `DEPLOY_READINESS_v2.md` §7 (read-only, frozen, known stale by one row), `PATCH_NOTES.md` (facts only).

**Method.**
1. Cite `step0.md`; state which branch (first deploy vs re-deploy) applies.
2. **B1–B3 on the deploy-sim.** Follow B2's order into `_harness/out/audit9/P8/public_html/`; serve on `:8145` after each step; the blank-page window must not appear at any step. Confirm the eleven things; confirm the dotfiles. B3 permissions `[UNVERIFIED]`.
3. **C1–C4 mapped.** Each C check: local (do it) / live read-only (`GO-LIVE.md` C1's `curl -sI` lines only — record or `[UNVERIFIED — network]`) / owner-only (C3 sign-in, C4 real submission — **never** by an agent; say so).
4. **Rollback.** Frontend: overwrite `index.html` with the previous; old `assets/` still resolve. Data: **Admin → Backups** restore on a mirror copy; the restore created a backup first.
5. **"If something is wrong."** Induce each symptom on the deploy-sim (upload `dist/` as a folder; omit `.htaccess` — emulate via the router; serve JSON as `text/plain`; delete `config.local.php`) and confirm the "first thing to check" finds it.
6. **Document truth, mechanically.** `CLAUDE.md`'s `App.jsx` figure (13,136 vs "~12,900" — refresh, not finding); admin page/entry-point/JS counts vs `ls admin/`; `_harness/README.md` "96 fields" vs `lint.php` "110 matched" (they disagree on 2026-09-14 — find which is stale); backup count in every doc vs `config.php`'s constant (A-6.9/A-7.5 precedent); `GO-LIVE.md` "52 URLs" vs the served sitemap; `GUARDRAILS.md` §4.1 suite count vs §4.3's union; `README.md:213-218` vs `useRefetchOnReturn()` (A-8.1); every `file:line` in `CLAUDE.md` and `GUARDRAILS.md` (AUDIT-11 §7 census re-run). Self-described approximations refreshed; a fact stated and wrong is Low; an instruction causing a wrong action (A-8.1/A-8.2 class) Medium or High by consequence.

**Finding criteria.** A runbook step that fails or is ambiguous when followed literally; a symptom row whose check misses the induced fault; a doc statement the code contradicts.
**Not a finding.** `DEPLOY_READINESS_v2.md`'s `sitemap.xml` row; Apache/permission behaviour (`[UNVERIFIED]`).
**Artifacts.** Deploy-sim log with a screenshot per step; the C table; the document-truth table.
**Exit.** Six steps recorded.

### P9 — Accessibility and responsive re-verification

**Objective.** The AUDIT-10/11 and PLAN-8 state holds, and the go-live minimum (keyboard-complete, AA where the palette allows, reduced motion, 200 %/400 % zoom, no horizontal scroll at 390) is measured.
**Starts after.** I-crawl. Own mirror `:8146` for keyboard and zoom runs.
**Scope.** Public routes at 390/834/1440; admin at 390/1440; drawer, both forms, mega-menus, FAQ, dashboard table.

**Method.**
1. Cite the sweep lines: `plan8-keyboard`, `plan8-motion`, `plan8-mobile`, `plan8-chrome`, `plan8-contrast` (34/35), `plan2-contrast`, `plan5c-eyebrow`, `plan5c-brandink`, `brandtext` (≤ 13 failing), `plan4-public`, `plan4-admin`, `plan10-rfqscroll`, `plan10-adminrows`, `plan10-adminnav`, `plan10-helpwidth`.
2. **Keyboard**, real keys only (`:focus-visible` ignores `.focus()` — GUARDRAILS §7.1): every interactive element reachable, visible ring, `Escape` closes every overlay from inside (F10). Focus order per page; any trap.
3. **Reflow**: 200 % at 1440, 400 % at 1280 — no cut content, no horizontal scroll except inside spec-table scrollers.
4. **Large text**: root `font-size: 24px` — `px`-height clipping.
5. **Semantics** from the crawl's accessibility snapshots: every control named; buttons not named by glyph; `role="alert"` for form errors; live region for async catalog states.
6. Optional: `npx --yes @axe-core/cli` (free, temporary, never in `package.json`) on `:8146`. Every axe hit reproduced through steps 2–5 before it is written — six probe defects in AUDIT-11 §7.2 are why.
7. **Colour**: measure under the glyphs on the real background (`backdrop.js`), never on the box. GUARDRAILS §7.3 / `WHATS_LEFT.md` §3 brand decisions are closed; a new finding only on a surface they do not name.

**Finding criteria.** Unreachable / trapped / unnamed / ringless control; reflow failure; contrast failure on an unsettled surface; missing live region.
**Not a finding.** `WHATS_LEFT.md` §2 brand/contrast items; GUARDRAILS §7.3; DejaVu-width artifacts unless re-measured under Liberation Sans.
**Artifacts.** Focus-order lists; zoom screenshots; axe log with per-item reproduction status.
**Exit.** Seven steps recorded.

### P10 — Performance and robustness (run by C from the crawl JSON; no separate agent)

1. From I-crawl: 0 console errors, 0 failed requests, 0 responses ≥ 400 across 10 routes + 42 product pages (audit 7 §4's measurement, repeated).
2. Cite the sweep lines: `plan5-images`, `plan5-listeners`, `plan5-keys`.
3. From I-crawl: transfer bytes of `/` at 390 and 1440; the hero image not requested at 390 (§7.2 — confirm it still holds).
4. Cache rule text: `index.html` `no-cache`; `assets/` immutable; `data/` ~60 s (`[UNVERIFIED — Apache]`); the per-minute cache-buster on all three data URLs (grep).
5. Catalog at 500 products: repeat audit 7's method only if `useProducts`/`DashboardPage`/`CatalogLanding` changed since `1826a6d` (`git log -L` or `git diff 1826a6d -- src/App.jsx | grep -n`); otherwise cite audit 7 §4 and say so.

**Finding criteria.** Any console error or failed request; an image over budget; listener growth; a cache header contradicting the deploy strategy. **Not a finding.** Bundle within 10 % of 375.66 kB; the catalog-size hypothesis.

### P11 — The harness and the process (audit the auditors; C runs the mechanical steps)

1. Resolve the §4.3 rows: every name in `_harness/README.md`'s tables and not runnable, or runnable and in no table. The resolved union becomes the denominator in `audit9.md` §1 and a dated refresh of `GUARDRAILS.md` §4.1.
2. Every `*-selftest.js` runs and **fails its target** as designed (`invariants-selftest` 15/15, `copydrift-selftest` 5/5, `contactflow-selftest`, `backdrop-selftest` 9/9, `plan2-formlast-selftest`). A selftest that passes without its target failing is High — everything downstream is unproven.
3. Every `lint.php` check (the 13 lines in §4.2) has a recorded mutation test (`audit8.md` A-8.6 is the shape). Census; any check without one gets one, run once, restored, recorded.
4. Mutating-suite census: the Appendix A grep gives 26 of 58 on 2026-09-14 (heuristic). For each: does it restore pristine and prove it with a byte diff at the end of its own run? Any that does not is Medium.
5. `node --check` every `_harness/*.js`; a probe that no longer parses is deleted (retire = delete), listed in `audit9.md` §3.
6. `_harness/README.md`: every "must stay green" suite is in the sweep; the expected-reds paragraph names exactly §4.4's four; the bootstrap works on a fresh clone as written (Phase 0 is the evidence).
7. `.gitignore` covers `_harness/site/`, `_harness/pristine/`, `_harness/out/`; nothing tracked under `_harness/` is generated.
8. This plan's own claims: every `_harness/` and `audit-runs/` path it names exists after the round (new instruments included); every command in §4.2 ran as written.

**Finding criteria.** A selftest that cannot fail; a check with no mutation test; a mutating suite with no restore; a suite in a doc and not runnable; a baseline number that does not reproduce; a path in this plan that does not exist.

---

## 7. Phase 3 — consolidation, triage, severity, fix policy (C, then V, then C)

### 7.0 Consolidation and dedupe (C, from §13.3 headers)

Read the twelve headers only. Two records with the same `where:` and the same consequence are **one** finding — keep the earlier ID, cite both passes, and the record that reproduces more cheaply wins the `reproduce:` field. Then assign V by severity first (Blocker/High to the strongest V), then by pass.

### 7.1 Severity — one definition, used everywhere

| Severity | Definition (tiebreak: §2) | Verdict effect |
|---|---|---|
| **Blocker** | Prevents a safe launch: unauthenticated data exposure or write; the lead path (form → email **and** Inquiries row) fails; a legal or certification falsehood on a live page; a blank page in a supported browser; irreversible data loss on a normal owner action. | NO-GO while open |
| **High** | A buyer or Rick is misled or blocked on a main path; a claim the business cannot stand behind; a security control that fails silently; a doc instruction that causes a destructive action. | Fixed, or an owner action with a named step, before GO |
| **Medium** | Wrong with a workaround, or on a secondary path; a control that degrades without a signal; doc/code disagreement that causes rework but not damage. | Fixed this round if in scope; else `WHATS_LEFT.md` §2 |
| **Low** | Verbiage, typography, structure polish, stale numbers in self-describing docs, harness hygiene. | Batched; fixed when the batch is cheap and delta-only |

Severity is by consequence — never by instance count, never by wording, never adjusted after interest is shown in an option. V changes a severity only with the consequence written next to it.

### 7.2 Class — who closes it

`code` (C) · `harness` (C) · `doc` (C) · `data-live` (owner, through the admin; **never** a repo edit of `data/*.json`, never an upload) · `server` (owner: DNS, SPF, 301, permissions, PHP version) · `decision` (escalated in the five-field form; nothing coded until logged in `WHATS_LEFT.md` §3).

### 7.3 What C may fix and what C may not

**May:** any `code`/`harness`/`doc` finding, delta-only, test-first, ≤ 3 attempts, no refactor/rename/reorder, no new dependency, no new file outside `_harness/` and the two `audit-runs/` files this plan names.
**May not, ever:** `data/*.json` (exception: an explicit instruction from Keagan in the executing conversation, recorded verbatim in `WHATS_LEFT.md` — the 2026-08-06 `photoUrl` precedent), `pdfs/`, `uploads/`, `DEPLOY_READINESS_v2.md`, prior `audit-runs/audit<n>.md` beyond a dated correction block, `public/images/site/` deletions, the invariants, the sentinel in `config.php`, public copy with legal or commercial weight (privacy text, certifications, stock/minimum/lead-time claims, pricing) — those are `decision`.
**Verbiage fixes** to hardcoded strings, `COPY_DEFAULTS`, admin text, emails and docs are `code`/`doc`; the same string in the owner's data is `data-live`.

### 7.4 Regression after fixes

Select the batch **by surface, not by grep** (scorecards Run 3): every suite whose README row names a file or page the fix touched. Run after each fix. After the **last** fix, the **full** §4.3 union in the background, recorded as the "after" table beside Phase 0's "before". Denominators equal; only §4.4's reds.

---

## 8. Phase 4 — records, PR, handback

### 8.1 `audit-runs/audit9.md` — the shape (§13.2)

Header (date, base, brief, executors, the totals table **generated from the records by a script, never typed** — audit 8's table under-counted by one), §0 lenses, §1 inherited state (Phase 0 verbatim, before/after tables), §2 findings in severity order, §3 shipped, §4 checked-no-finding / raised-not-reproduced / refuted-with-measurement, §5 what is left (owner actions with the `GO-LIVE.md` A line each, blocked ledger rows, escalations, the `[UNVERIFIED]`/`[UNSOURCED]` list), §6 self-corrections, §7 method (ledger summary, pass → agent map, the denominator and its derivation).

### 8.2 `WHATS_LEFT.md` — append-only

Shipped fixes → next free §1-series letter (`section drift` must still pass). New open items → §2 with date, evidence, `file:line`. Escalations and answers → §3 before dependent code. Evidence → a new §4-series block. Anything an earlier line got wrong → `SUPERSEDED-BY <date>` under it; never rewritten.

### 8.3 Other records

`_harness/README.md`: a row per new suite/instrument (`doc drift` must pass). `GUARDRAILS.md` §4.1: the refreshed table, dated. `CLAUDE.md`: only a new invariant that earned it (incident named inline) or a refreshed number. `PATCH_NOTES.md`: owner-visible changes only. `plans/README.md`: PLAN-11 open → done. This plan: status line flipped, revision log appended; nothing else rewritten. Working files under `audit-runs/audit9/` deleted.

### 8.4 Branch, commit, PR

Only when the executing conversation says to commit (GUARDRAILS §2 forbids `git commit` otherwise — if it does not, stop after 8.5 with the tree dirty and say so). Branch `claude/<slug>` from `main`; commits in the repo's voice (imperative, finding IDs in the subject); one PR titled `Audit 9 — <n> findings, <m> fixed`, body = totals table + §5 + verdict; Keagan merges. No model identifiers anywhere pushed.

### 8.5 Handback (GUARDRAILS §8 order)

1. Fixed — file → change → proof. 2. Not fixed and why. 3. Escalations, five-field form. 4. Records corrected. 5. Regression state, before and after. Then the verdict, the `[UNVERIFIED]`/`[UNSOURCED]` list, and what was not done. Short and dense.

---

## 9. The verdict

Exactly one of:

- **GO** — no open Blocker/High; every Medium fixed or in `WHATS_LEFT.md` §2 with a reason; owner-action list empty or cosmetic.
- **GO-WITH-OWNER-ACTIONS** — no open Blocker; every High fixed **or** `data-live`/`server` with the exact owner step written into `GO-LIVE.md` A (one line, checkbox, where it is done). The list prints in full with the verdict.
- **NO-GO** — any open Blocker, or any High of class `code` unfixed. Name it.

Computed from the findings table by the same script that computes the totals. Not softened by progress, not hardened by refutations.

---

## 10. Guardrails specific to this audit

GUARDRAILS.md applies in full. These add to it. Where a rule was born from an incident, the incident is named.

### 10.1 Honesty — keeping the evidence true

1. **No finding without a reproduction a second agent ran** (§3.6). AUDIT-11: five published numbers did not reproduce.
2. **The probe is not the page.** A symptom seen only through a selector, a full-page screenshot, or programmatic focus is reproduced through the visitor's or Rick's path first. GUARDRAILS §7.1–7.2.
3. **Denominator first.** A red with a changed total is a bail until servers, fleet and mirror credential are confirmed. PLAN-10 phase E.
4. **Counts are computed, not typed.** Totals, verdict, per-pass counts, sweep tables. Audit 8's "eight findings" was nine.
5. **`[UNVERIFIED]`, `[UNSOURCED]`, `NOT-MEASURED` are mandatory.** Silent omission is a defect in the audit.
6. **A refutation is a result** — recorded in §4 with the measurement (audit 7's catalog table), never deleted, never softened into a Low.
7. **Severity is consequence.** Not count, not wording, not effort, not interest.
8. **"Fixed" needs three artifacts:** failing before, the diff, passing after — plus the surface batch green.
9. **Environment artifacts are not site defects.** GUARDRAILS §7.1, plus §12 below.
10. **Self-corrections are recorded** in the working file, then `audit9.md` §6.
11. **Every new check is shown failing once** before its pass counts. GUARDRAILS §4.4.
12. **A private mirror proves nothing on its own.** A finding raised on `:814x` is accepted only after V reproduces it on a fresh copy (§3.6); a fix is proven on the sweep mirror.

### 10.2 Straying — keeping the audit on its objectives

1. **Ledger fence.** Not in the ledger → not audited; C adds the row first.
2. **Finding fence.** Not an `A-9.n` record with a reproduction → not fixed. No "while I was here".
3. **Brief fence.** A pass audits its brief; out-of-brief = one line, routed by C.
4. **Fix fence.** Only C fixes; only `code`/`harness`/`doc`; delta; ≤ 3 attempts.
5. **Decision fence.** Legal text, certifications, commercial claims, brand colours, the placeholder host, prerender/SSR, the print stylesheet, extracting `App.jsx`, the history rewrite, paid tooling — `decision` or settled (§11). Drafting privacy wording or picking a colour is straying.
6. **§11 is consulted before a record is written**, and the record's `not in §11:` field says what was checked.
7. **No re-opening without new dated evidence.**
8. **Exit criteria, not clocks.** Running out of budget produces a blocked list, never a shorter audit reported as complete.
9. **One PR.** Late finds go to `WHATS_LEFT.md` §2.
10. **No new documents beyond the two this plan names** (`audit9.md`, `audit9-ledger.md`) and the instruments under `_harness/`. Working files are deleted before the PR.
11. **Single-owner measurements** (§3.3 table). A pass that re-measures another's surface has strayed, and its number is discarded in favour of the owner's.

### 10.3 Safety — the live host, the data, the credential

1. **The live host is read-only, and only these requests:** §4.6's GETs of the three `/data/*.json` and `GO-LIVE.md` C1's `curl -sI` lines. No form POST, no `/admin/` sign-in, no `contact.php`, no crawling. C4 is Rick's or Keagan's.
2. **`data/`, `pdfs/`, `uploads/` in the repo are never edited** (exception §7.3). Live copies never uploaded. Findings against them are `data-live` with the admin screen named.
3. **Mutable targets are private mirror copies and the sweep mirror.** Private copies are discarded; the sweep mirror is restored from `_harness/pristine/` with a byte diff. `_harness/pristine/` is re-seeded only for the one reason `WHATS_LEFT.md` §2 records.
4. **The mirror credential is `audit-pass-123`**, lives only in `_harness/site/admin/config.local.php` and its private copies, and every copy is deleted at session end. No hash in any pass file, `audit9.md`, commit or PR. `git grep '\$2y\$'` before commit.
5. **Nothing under `_harness/site/`, `_harness/pristine/`, `_harness/out/` is committed.** `git status --porcelain` read before every commit.
6. **No history-destroying verbs.** GUARDRAILS §2.
7. **Nothing external gets project data**: no online validators, no pasted JSON, no spell-check services. Offline tools or temporary local `npx`/composer packages only.

---

## 11. Do-not-re-report index

Consult by grep before writing any record. Pointers, not summaries.

| Where | What it settles |
|---|---|
| `plans/GUARDRAILS.md` §7, §7.1, §7.2, §7.3 | Closed items, environment artifacts, refuted-with-measurement, settled decisions. |
| `audit-runs/audit5.md` "Refuted, corrected, and re-scoped" + "Checked, no finding" | Tearing writes, disk-full, phantom spec rows, react-router advisories (then), reset-flag creation, throttle parallelism, traversal, header injection, page weight; the whole security checklist. |
| `audit-runs/audit6.md` "Re-verified, not re-derived" + "Carried forward" | The posture re-verification; the dependency bump; A-5.10; owner actions. |
| `audit-runs/audit7.md` §3 + §4 | A-7.7 print (open, separate change); scalar coercion; `[object Object]` param; `uploads/.htaccess`; `brandtext`'s 11; the A-7.3 scope; console-clean crawl; catalog size; ReDoS; no user regex; no inline scripts; manifest vs `dist/`; secrets; banner coverage; `sitemap.php` shapes. |
| `audit-runs/audit8.md` §2, §3a, §4, §5 | A-8.5 (registrar-gated); A-8.7/A-8.8 in the repo since PR #53 — live copy is an owner action; placeholder sweep; origin consistency; the A-7.4 marker's rule; cookies; derived copyright. |
| `UX_AUDIT_PREPROD_2026-08-12.md` F1–F17 | All fixed in PR #42 / `WHATS_LEFT.md` §1c. Re-verify by measurement in P6; do not re-report the text. |
| `_harness/AUDIT10-REPORT.md`, `_harness/AUDIT11-REPORT.md`, `plans/PLAN-10-audit10-remediation.md` §12 | 61 AUDIT-10 findings: 13 fixed and verified; 39 C-clusters and 9 D batches deliberately open; A10-056 refuted. |
| `WHATS_LEFT.md` §2 | Every open item; cite the ID. `4.27 residual reorder cost`, `A-7.7`, `A-5.10`, the brand items, the live-copy `photoUrl` note are the ones a fresh reader re-finds. |
| `WHATS_LEFT.md` §3 | Declined/deferred: the extraction; the history rewrite (awaiting Keagan); `products-all.json` upload; paid tooling; the `.docx`; warn-not-block on Industries SKUs; the three brand-colour decisions. |
| `CLAUDE.md` invariants 1–16 | Each names its incident. "Simplifying" one is not a finding. |

---

## 12. Environment artifacts — additions to GUARDRAILS §7.1 for this round

- **Fresh clone has no `node_modules/`**; `npm ci` first.
- **The container's PHP is 8.4.19.** A deprecation it prints is a real P2 finding; a syntax it *accepts* that 7.4 would not is the inverse hazard — `php -l` here proves nothing about 7.4.
- **`sync.sh` now copies `admin/logo.svg` and creates `uploads/images/`** (PR #47, `sync.sh:36,47–48`). GUARDRAILS §7.1's two mirror caveats about them are stale for checkouts at or after `ad2267e`; on an older checkout they still apply.
- **Outbound network goes through a proxy.** A failed `curl` to the live host is `[UNVERIFIED — network]`, not "the site is down".
- **Private mirrors on `:814x` run one request at a time.** A timeout under a parallel pass is contention, not a site defect — re-run on an idle port before writing it.
- **Windows executors:** `_harness/README.md` "On Windows" and GUARDRAILS §4.1a; `plan3-autoreply` `[UNVERIFIED]` there; `.gitattributes` pins `*.sh` to LF — a `set: -` failure means the checkout predates PR #47.

---

## 13. Templates

### 13.1 Finding record — one per finding, in the pass file and in `audit9.md` §2

```
### A-9.<n> — <SEVERITY> — <one sentence, in the words a buyer or Rick would use>

class:        code | harness | doc | data-live | server | decision
pass:         P<n>[, P<m>]     ledger: E<nnn>[, E<nnn>]
surface:      <route / admin page / file / document>
where:        <file:line | JSON path | URL>   (measured on <commit>, <date>)
not in §11:   checked <entries> — <why this is different, one line>
reproduce:    <numbered steps or the exact command; runnable cold on a fresh mirror copy>
observed:     <verbatim output or artifact path>
expected:     <what the site needs, and the rule or invariant that says so>
consequence:  <who is harmed and how — this sets the severity>
evidence:     <_harness/out/audit9/... paths; suite name + score>
verified-by:  <V, date, "reproduced" | "not reproduced: <measurement>" | "sampled 3/N: <which>">
outcome:      fixed <commit> | owner action: <exact admin/server step> | escalated: <five-field form> | deferred: <reason, WHATS_LEFT §2 ref>
fix-proof:    <check failing before> → <diff summary> → <check passing after> → <regression batch: n/n>
```

### 13.2 `audit-runs/audit9.md` skeleton

```
# Audit 9 — the full go-live audit
**Date / Base / Brief / Executors**
| Severity | Count |  ← generated
**Verdict:** GO | GO-WITH-OWNER-ACTIONS | NO-GO  ← generated, with the list
## 0. The lenses — and which are new
## 1. The inherited state          ← Phase 0 verbatim; before and after sweep tables; the denominator and how it was derived
## 2. Findings                     ← §13.1 records, severity order
## 3. Shipped                      ← file → change → evidence; new / retired instruments
## 4. Checked, no finding · Raised, not reproduced · Refuted with measurement
## 5. What is left                 ← owner actions (GO-LIVE.md A line each), blocked ledger rows, escalations, [UNVERIFIED]/[UNSOURCED]
## 6. Self-corrections this round
## 7. Method                       ← ledger summary, pass → agent map, waves as run
```

### 13.3 Pass working file header — `audit-runs/audit9/P<n>-<slug>.md` (C reads only this block)

```
# P<n> — <slug>          agent: <id>   started/finished: <date time>   mirror: :<port>
findings:   Blocker <n> · High <n> · Medium <n> · Low <n>
| ID | sev | class | where | one line |          ← one row per record below
ledger:     done E…, E…   blocked E… (<reason>)
suites cited: <name score, …>
instruments: <_harness/audit9-….js — what it emits>
artifacts:  <_harness/out/audit9/P<n>/… — one line each>
out of brief: <file:line — one sentence>  (or "none")
[UNVERIFIED]/[UNSOURCED]: <list>
self-corrections: <list or "none">
---
<records, §13.1>
```

### 13.4 Launch prompt for a pass agent (C fills the brackets; nothing else is sent)

```
You are pass agent P<n> for Audit 9 of klatar200/Updated_IPC-main-main, branch <branch>, commit <sha>.
Read, in this order, and nothing else before starting: plans/GUARDRAILS.md (§0–§2, §4.3–§4.4, §5, §7–§7.3, §8);
plans/PLAN-11-audit9-go-live.md §2, §3, §10, §11, §13; then your brief, pasted here in full:
<§6 P<n> brief, verbatim> <Appendix rows your brief names, verbatim> <the _harness/README.md rows your brief names, verbatim>
Inputs ready for you: _harness/out/audit9/step0.md; sweep-before.txt; <instrument outputs and paths>.
Your mirror: cp -r _harness/site _harness/out/audit9/site-P<n> and serve it on :<port> with _harness/php-mail.ini. Never touch :8123–:8139.
Write only: audit-runs/audit9/P<n>-<slug>.md (header §13.3 first, records §13.1 below) and _harness/out/audit9/P<n>/.
You do not fix anything. You do not edit the ledger. Out-of-brief observations are one line each under "## Out of brief".
Stop when your brief's Exit line is met or your blocked list is written. Hand back the header block only.
```

---

## Appendix A — the sweep, derived, and the two censuses (all AS-OF 2026-09-14)

```sh
# assertive suites (heuristic — 58 on 2026-09-14; reconcile with the README tables in §4.3 before trusting the count)
grep -lE "process\.exit\(|process\.exitCode" _harness/*.js | xargs grep -lE "\bok\(|\bcheck\(|\bassert" | sed 's#_harness/##; s#\.js$##' | sort
# browser-free among them (9 on 2026-09-14): audit5-blockers audit7-lead contactflow-selftest copydrift-selftest fgpatch invariants invariants-selftest isoclaims plan3-autoreply
grep -LE "require\(['\"]playwright|require\(['\"]\./browser|chromium" <list>
# touch the mirror's data or pristine (26 on 2026-09-14) — why the sweep is serial
grep -lE "site/data|pristine|writeFileSync\([^)]*data/|save_(products|content|site)|restore" <list>
# extra servers among the 58: plan2-trunc (:8124/:8125), plan4-admin, plan8-formpolish.
# plan5-throttle (fleet :8130–8139, literal at plan5-throttle.js:57) is NOT in the classifier's 58 — it bails with
# process.exit(2) and scores without ok()/check() — which is exactly why §4.3 runs the UNION with the README tables, not the grep alone.
# then, in the background:
node _harness/run.js <union…> > _harness/out/audit9/sweep-before.txt 2>&1 &
node _harness/invariants.js; node _harness/invariants-selftest.js; node _harness/copydrift-selftest.js; node _harness/contactflow-selftest.js; node _harness/backdrop-selftest.js; node _harness/plan2-formlast-selftest.js
php _harness/lint.php
```

Record each line with score **and denominator**. `plan5-keys` builds its own dev-React bundle; `plan10-auditlog` and `plan6-families` mutate and must restore.

## Appendix B — controlled-vocabulary seed (P5 rule 2 extends it)

| Concept | Variants seen or likely | Rule |
|---|---|---|
| data sheet | data sheet · datasheet · data-sheet · spec sheet · PDF | one public prose form; the route is `/datasheets` — measured, not assumed |
| part identifier | part number · part # · SKU · item · product code | prose vs catalog labels may differ; one form per surface |
| quote | Request a Quote · Request Quote · RFQ · Get a Quote · quote request | buttons one form; "RFQ" only where introduced |
| company | Insulation Products Corporation · IPC · Insulation Products Corp. | full name first on a page, then IPC; legal pages full name |
| certification | ISO 9001 (bare, A-8.5) · UL-recognized · CSA-listed · MIL-SPEC · RoHS · FDA-compliant · AMS | one spelling/case each; hyphenation consistent |
| contact channel | email · e-mail · E-mail | one form |
| phone | 630.771.0700 (site-info) · (630) 771-0700 · 630-771-0700 | the site-info form everywhere it is not dialled |
| hours | Mon–Fri, 8am–5pm CT (site-info) | en dash, no spaces, one timezone abbreviation |
| admin nav | Products · + Add Product · Business Details · Page Content · Inquiries · Backups · Audit Log · Password · Help · Sign Out (`nav.php`, 2026-09-14) | every doc and help sentence uses these exact labels |
| dashes | `-` `–` `—` | hyphen in compounds, en dash in ranges, em dash for asides — or the measured majority |
| lead time / shipping | same day · next business day · one week or less | agree with P4's register and with each other on one page (F13) |

## Appendix C — logic edge-case matrix (P7). `new` rows are run this round; suite rows are satisfied by the sweep line.

| # | Surface | Input / state | Expected | Evidence |
|---|---|---|---|---|
| C1 | routing shim | `/Products`, `/products/`, `/products/x`, `//products` | 404 page or normalised route, never blank, `noindex` on 404 | `plan9-notfound`, new |
| C2 | routing shim | `?productId=` unknown / alias / lowercase / trailing space | "part not found" banner (T2.8), page renders | `plan8-crumbs`, new |
| C3 | routing shim | `?family=` / `?approval=` unknown | empty state with a way out | `plan8-catalog`, new |
| C4 | routing shim | `{replace:true}` on `?family=` and `?sent=1` | Back not trapped; `?sent=1` reload shows no false success (F5) | new |
| C5 | `useProducts` | 404 / HTML-200 / truncated / wrong type / 12 s stall, each of 3 files | invariant 8; `jsonOrThrow()` rejects HTML-200 | `audit7` (A-7.9), new |
| C6 | `useProducts` | TTL expiry + tab refocus | refresh without reload | new (4.25 §4b is the precedent) |
| C7 | `mergeSiteInfo` | `""` per scalar; `""` per `SITE_CLEARABLE` key; missing key; wrong type | blank-drop vs clear per allow-list; default for missing/wrong type | `invariants`, new |
| C8 | `mergeContent` | `[]` per section; missing section; string-for-array; PHP-only `copy` key | `[]` deletes (inv. 3); default for missing/wrong; NB-copy | `invariants`, `copydrift`, new |
| C9 | `ErrorBoundary` | throw on one page, navigate to another | second page renders (inv. 7) | new |
| C10 | catalog | 0 / 1 products; duplicate SKU; no spec rows; missing `pdfUrl`; non-string `sku` | per 4.29 / A-7.8; sitemap 200 | `plan5-spectable`, `audit7`, `plan5c-sitemap` |
| C11 | contact RFQ | each required field empty, client and server | same set both sides (A-04) | `plan3-contact`, `contactflow` |
| C12 | contact both | 201-char short field; 5,001-char text | truncated with the notice | `audit7-lead` |
| C13 | contact both | CRLF / unicode / emoji / RTL in every field | `hdr()` strips header-bound; body faithful; JSONL valid; `h()` on render | `audit5-blockers`, new |
| C14 | contact both | honeypot filled; referer absent / foreign / `android-app://` | rejected+logged / accepted / rejected / accepted; each consumes a slot | `audit5-high`, `audit7-lead` |
| C15 | contact both | 6 submits in 10 min from one IP; auto-reply to `a+1@`, `a.b@` | 6th refused with the phone number; one auto-reply per normalised mailbox | `audit5-high` (A-5.9 abuse controls), `plan3-autoreply` |
| C16 | contact both | `mail()` returns false | phone-number message; JSONL `sent:false`; A-7.4 marker | `audit7-lead` |
| C17 | contact both | JS disabled | a human page, not `{"ok":true}` (A-7.2) | `audit7-lead` |
| C18 | contact both | double-click submit; Back then resubmit | one email, one row, or a clear duplicate notice | new |
| C19 | admin edit/settings/content | two tabs, save both | stale-signature message, typed values kept (B1) | `plan4-admin`, new |
| C20 | `content.php` | `max_input_vars` truncation | save refused, nothing blanked (T3.7/B1) | `plan2-trunc` |
| C21 | admin saves | unchanged content | no write, no backup, "No changes" (inv. 16) | `nodupbackups` |
| C22 | backups | 90 existing; same-second saves; restore of a malformed backup | max-used+1 (inv. 5); read-side gate (A-7.8) | `audit7`, new |
| C23 | `edit.php` | rename SKU whose PDF/photo is shared / unique | shared kept, unique renamed/removed, audit-logged | `plan2-delete`, new |
| C24 | uploads | same file twice; PDF in use; oversize; wrong type | per-code refusal; `pdf_in_use()` | `audit5-medium` |
| C25 | `password.php` | wrong current; new = old; 6 attempts | throttle shared with login; hash via callback (inv. 1) | `plan5b-pwthrottle`, `invariants` |
| C26 | `auth.php` | reset flag mtime at 3599 s / 3601 s; no `config.local.php` | open / closed; "no password set" state, not a fatal (A-5.7) | `audit5-high`, new |
| C27 | `require_auth()` | expired session on POST | page with the data, not a 302 (inv. 12) | `invariants`, `plan4-admin` |
| C28 | `ping.php` | unauthenticated GET | no session file (A-7.3) | `audit7-lead` |
| C29 | health banner | each folder unwritable; reset window open; inquiry-log failed | banner names it; nothing else fails silently | `audit5-high`, `audit7-lead` |
| C30 | `sitemap.php` | both catalog shapes; non-scalar id; corrupt JSON | 52 / 52 / 10 routes, always 200 XML | `plan5b-sitemap`, `plan5c-sitemap`, `audit7` |
| C31 | time | browser clock at the year boundary; `effectiveDate` fixed | `© 1974–<year>` derived; effective date static (4.10) | new |
| C32 | encoding | `–`, `°`, `″`, `µ`, emoji round-trip through each admin form | byte-faithful on disk and on the page | new |
| C33 | line endings | `git ls-files --eol '*.sh'` | `i/lf w/lf` (PR #47) | new |

---

## Revision log (append-only)

**2026-09-14 — rev 2, self-audit before merge.** Failures of rev 1, each corrected above:
1. §3.2 named parallelism but gave no dependency graph, no concurrency cap, and serialised every mutating pass on one mirror → wave table + private mirror copies per agent (§3.2, §3.4).
2. No read-scoping: every agent was told to read ten files → role-scoped §0 and a launch-prompt template that inlines the brief (§13.4).
3. Four passes each re-crawled the site and three each re-drove the admin → three shared instruments built once (§3.3) and a single-owner table for overlapping measurements.
4. STEP 0 (is the site live) was duplicated in P4 and P8 → done once by C (§4.6).
5. The suite-list reconciliation sat in P11, after the sweep whose denominator it fixes → moved to Phase 0 (§4.3); the sweep now runs in the background.
6. Phase 0 told the executor to copy `logo.svg` and create `uploads/images/` by hand; `sync.sh` has done both since PR #47 (`sync.sh:36,47–48`) → removed; §12 notes the stale GUARDRAILS caveat.
7. P2 step 3 was its own full crawl + POST drive → reads the E_ALL log P3/P7 produce on `:8140`; PHPCompatibility named as the 7.4 tool with the grep as fallback.
8. P5 was one agent reading an inventory that can exceed its context → split P5a/b/c; rules 1–5 scripted, agents read hit lists only; owner-doc vs developer-doc ownership split between P5c and P8.
9. Appendix C said "every cell is run" though 15 rows are already proven by the sweep → 18 `new` rows named; C15 cited the login throttle for the contact rate limit → corrected to `audit5-high`; "freeze PHP's clock" was not testable → mtime manipulation.
10. P4 step 4 both reported the placeholder host as Medium and escalated it → class `decision`, Medium, escalated once; P4 step 6 duplicated P7 C7–C8 → deleted.
11. Pass agents could not safely update a shared ledger in parallel → C-only ledger, outcomes in the §13.3 header.
12. V reproduced every Low instance → sampling rule (§3.6) with the sample recorded.
13. No dedupe step → §7.0.
14. §10.2 rule 10 contradicted §5/§8 by forbidding the two files the plan creates → reworded.
15. P10 was a separate browser-driving pass → C consumes the crawl JSON; P11's mechanical steps also C's.
16. No token-discipline rules at all → §3.5.
17. Two citations in the rev-2 draft itself were wrong and were caught by re-measuring before commit: `sync.sh` "45–49" (the `mkdir` is at 47–48), and "plan5-throttle's port use is computed" (it is literal at `plan5-throttle.js:57`; the suite is simply outside the classifier's 58). Both corrected; the second became the worked example in Appendix A for why §4.3 takes the union.
Honest downside of rev 2: more agents means more fixed overhead (each reads GUARDRAILS + its brief); the instruments and read-scoping are what pay for it, and the sweep's wall-clock is still the floor.
