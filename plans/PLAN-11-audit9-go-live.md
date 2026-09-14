# PLAN-11 — Audit 9: the full go-live audit

**Status:** OPEN — not started.
**Written:** 2026-09-14 against `main` @ `ad2267e` (PR #53 and PR #47 merged the same day).
**Audience:** the agents executing the audit. Dense by design; agent-parse only.
**Binding order:** [`plans/GUARDRAILS.md`](GUARDRAILS.md) → this file → the pass briefs in §6. A pass brief may add a constraint; nothing here relaxes one from GUARDRAILS.
**Deliverables:** `audit-runs/audit9.md` (§8), a verdict (§9), one PR (§8.4).
**Numbering:** PLAN-10 §12 called the severity-C cluster remediation "the natural PLAN-11". That work is still unplanned and takes the next free number; this file takes 11 because it is the one being executed.

---

## 0. Read order — read these, in this order, and nothing else before Phase 0

Context economy is a rule, not a preference. Each entry says what to take from it.

| # | File | Take |
|---|---|---|
| 1 | `plans/GUARDRAILS.md` | Everything. §1 scope, §2 hard prohibitions, §4 verification, §5 working rules, §7 do-not-re-report, §7.1 environment artifacts, §7.2 refuted, §8 handback. Binding. |
| 2 | this file | Everything. |
| 3 | `CLAUDE.md` | The 16 invariants and the security posture. Re-verify; do not re-derive. |
| 4 | `_harness/README.md` | Bootstrap, the three servers + the fleet, the suite → item map, the expected reds, the bailing rule. |
| 5 | `GO-LIVE.md` | STEP 0 (which deploy), A (owner actions), B (upload order), C (verification), the rollback. This is the runbook P8 dry-runs. |
| 6 | `audit-runs/audit8.md` | §0 the two lenses already used, §2 findings, §3a the privacy corrections, §4 checked-no-finding, §5 what is left. |
| 7 | `audit-runs/audit7.md` §3–§5, `audit-runs/audit5.md` "Refuted" + "Checked" | The refuted and not-taken lists. They are the do-not-re-report index (§11). |
| 8 | `audit-runs/project-map.md`, `audit-runs/endpoint-checklist.md`, `audit-runs/missed-coverage.md` | The surface inventory (E001–E112) that Phase 1 extends. Line numbers in them are stale by design; re-measure. |
| 9 | `WHATS_LEFT.md` | **Do not read it top to bottom (5,896 lines).** Read §2 (open items, lines ~141–641) and §3 (declined/deferred, ~641–776). Grep §4-series blocks by item ID only when a pass needs the evidence behind one item. |
| 10 | `PATCH_NOTES.md`, `README.md`, `admin/README.md`, `Editing-Your-Site-Content.md`, `Email to Rick - Admin Dashboard Handoff.md`, `DEPLOY_READINESS_v2.md` §7 | Read only inside P5 and P8, where they are audit **targets**, not context. `DEPLOY_READINESS_v2.md` is frozen — never edited. |

Do not read `src/App.jsx` end to end. Search it by component name (the map in `audit-runs/project-map.md` §2 gives the names; line numbers have drifted — `HomePage` is at 3125 today, the map says 3117).

---

## 1. Objective and definition of done

**Objective.** Establish, with evidence, whether the project is ready to go live, and close every defect that is closable in code, harness or docs before it does. Four lenses are mandatory and named in the brief: (a) bugs, (b) gaps in logic, (c) verbiage, (d) page structure. Eight prior rounds covered correctness and security deeply; (c) and (d) have never been run as their own passes and are where this round is expected to find most of its findings.

**Done means all of the following are true, with the artifact that proves each:**

1. Phase 0's inherited-state block is recorded verbatim in `audit-runs/audit9.md` §1, measured before anything was read for findings.
2. The coverage ledger (Phase 1) has every row `done` or `blocked` with a reason. No row `pending`.
3. Every assertive harness suite has a recorded result this round (the standing rule from `audit-runs/missed-coverage.md` Run 4).
4. Every finding carries the record in §13.1: ID, severity, class, surface, `file:line`, a reproduction a second agent ran, the artifact path, and its outcome (fixed / owner action / escalated / deferred with reason).
5. Every fix has a before-and-after artifact and a check that failed before it and passes after it.
6. The full sweep after the last fix is green except the documented expected reds (§4.4), with denominators equal to the baseline.
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
| **Coordinator (C)** | 1 | Phase 0, Phase 1, dispatches passes, runs the second-agent reproduction (§3.3), triages, owns every fix, consolidates `audit9.md`, does the records and the PR. | Write a finding without a reproduction of its own. Skip a pass because another pass "probably covered it". |
| **Pass agent (P1…P11)** | 1 per pass, parallel where §3.2 allows | Executes exactly one pass brief from §6. Writes its findings to its own working file `audit-runs/audit9/P<n>-<slug>.md` in the §13.1 record shape. Writes instruments under `_harness/` only if the brief permits it. | Edit any file outside its working file, `_harness/out/`, and any instrument its brief names. Fix anything. Touch another pass's surface. Read `WHATS_LEFT.md` outside §2/§3. |
| **Verifier (V)** | 1 (may be C, but never the pass agent that raised the finding) | Re-runs every reproduction from scratch on a clean mirror before a finding is accepted. Refutes with a measurement, or accepts. | Accept a finding on the pass agent's word. Soften or harden a severity to match the pass agent's. |

A single agent may play every role sequentially if parallelism is unavailable. The role boundaries still apply: the same agent does not raise, verify and fix a finding in one uninterrupted step — verification is a separate re-run from a clean mirror, written down as such.

### 3.2 Parallelism and file ownership

- Passes P1–P11 are read-only on the tree except their own working file, `_harness/out/`, and named instruments. They may run in parallel on one checkout.
- Passes that **mutate the mirror** (P3 requests, P7's admin flows, any suite marked "mutates real content" in `_harness/README.md`) run serially, and each ends by restoring `_harness/site/data/` from `_harness/pristine/` and confirming with a byte diff. Running two mutating passes at once against one mirror produces findings that are artifacts of each other.
- The `:8123`/`:8124`/`:8125` servers and the `:8130–8139` fleet are shared read-only infrastructure. No pass restarts them; a pass that needs a different ini starts its own server on a port ≥ 8140 and says so in its file.
- Working files under `audit-runs/audit9/` are merged into `audit-runs/audit9.md` by C and then **deleted**. They are never committed. Retire = delete, no stubs.

### 3.3 Acceptance of a finding — the second-agent rule

A finding enters `audit9.md` only after V reproduced it independently, from the instructions in the record, on a mirror restored from pristine. If V cannot reproduce it, it goes to `audit9.md` §4 as "raised, not reproduced" with both measurements. This is the AUDIT-11 precedent (five published numbers did not reproduce) and the reason auditor ≠ verifier.

### 3.4 Attempt and stop conditions

- A pass stops when its exit criteria (§6) are met, or when it has written its blocked list. It never widens its scope to compensate for time.
- Fix loops: ≤ 3 attempts, then stop and escalate with what was tried, observed, and now believed (GUARDRAILS §5).
- A pass agent that finds something outside its brief writes one line in its working file under `## Out of brief` with the `file:line` and stops thinking about it. C routes it to the right pass or the ledger. It is not audited by the agent that noticed it.

---

## 4. Phase 0 — environment and inherited state (C, before any reading for findings)

Everything below is recorded verbatim into `audit9.md` §1 as "The inherited state". A plan that starts from red must say so.

### 4.1 Toolchain, as measured 2026-09-14 in the remote container

| Tool | Version | Note |
|---|---|---|
| PHP (CLI) | 8.4.19 | Production is documented as "PHP 7.4+ (8.0+ recommended)" (`README.md:14`). The production version is **[UNSOURCED]** — see P2. |
| Node | 22.22.2 | |
| npm | 10.9.7 | `node_modules/` is absent on a fresh clone. |
| Playwright Chromium | 1194 at `/opt/pw-browsers` | Do not run `playwright install`. |
| `.gitattributes` | `*.sh text eol=lf` | Merged 2026-09-14. `git ls-files --eol _harness/*.sh` shows `i/lf w/lf`. |

### 4.2 Bootstrap — exact order

```sh
npm ci                                   # lockfile-exact; if it fails, `npm install` and record the diff to package-lock.json as a P1 input
npm run build                            # record the JS/CSS kB line
php _harness/lint.php                    # must be all green before anything else
sh _harness/sync.sh                      # builds _harness/site and, on a fresh clone, _harness/pristine
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini    _harness/router.php &
php -S 127.0.0.1:8124 -t _harness/site -c _harness/php-trunc.ini   _harness/router.php &
php -S 127.0.0.1:8125 -t _harness/site -c _harness/php-nb2-off.ini _harness/router.php &
for p in 8130 8131 8132 8133 8134 8135 8136 8137 8138 8139; do php -S 127.0.0.1:$p -t _harness/site -c _harness/php-mail.ini _harness/router.php >/dev/null 2>&1 & done
```

Run from the repo root. Copy `admin/logo.svg` into `_harness/site/admin/` and create `_harness/site/uploads/images/` before any admin screenshot or image count (GUARDRAILS §7.1 — both have produced false findings).

`lint.php` on 2026-09-14, PHP 8.4.19, `main` @ `ad2267e` — the state you inherit:

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

### 4.3 The full sweep — derive the list, do not type it

The suite list is derived mechanically, every round, because a typed list is how `plan10-*` went unrun for a month:

```sh
grep -lE "process\.exit\(|process\.exitCode" _harness/*.js | xargs grep -lE "\bok\(|\bcheck\(|\bassert" | sort
```

On 2026-09-14 that classifier returns **58** files (of 164 tracked under `_harness/`). Audit 8 ran "79 suites". Reconcile the two numbers in P11 before trusting either — the classifier is a heuristic and `_harness/README.md`'s "Standing regression" + per-plan + audit tables are the authority; anything in the tables and not in the classifier output, or vice versa, is a P11 row.

Run the derived list through `node _harness/run.js <suites…>`, plus `node _harness/invariants.js`, `node _harness/invariants-selftest.js` and every `*-selftest.js`. Record one line per suite with the score **and the denominator**.

### 4.4 Expected reds — the only four allowed

| Suite | Expected | Judge by |
|---|---|---|
| `plan8-contrast` | 34/35 | exactly one `EXEMPT_BRAND_SURFACE` |
| `plan8-polish` | 16/17 on Linux | the C49 font check only (DejaVu) |
| `brandtext` | ≤ 13 failing | the **failing count**, not the ratio |
| `isoclaims` | 2/4 | expected red until the registrar answers (A-8.5). If it is green, the owner resolved it — record that. |

Any other red is either inherited (record it; it is a finding of this round if no prior audit recorded it) or a **bail** — compare the denominator to the last recorded table (`GUARDRAILS.md` §4.1, `audit-runs/audit8.md` §1). A changed denominator means the suite never ran its checks: check server liveness, the fleet, and `config.local.php` in the mirror before writing anything.

### 4.5 Blocked-if

Phase 0 is blocked, and the audit does not proceed to findings, if: `lint.php` is red; `invariants` is not 17/17; `npm run build` errors; `sync.sh` fails; or `plan2-trunc`/`plan5-throttle` bail after the servers are confirmed up. Record the block and stop. Do not "work around" the harness to start auditing.

---

## 5. Phase 1 — the coverage ledger (C)

The ledger is the scope fence. **If it is not in the ledger, it is not in the audit; add it to the ledger first, then audit it.** That makes every scope change visible in the diff.

1. Copy `audit-runs/endpoint-checklist.md` to `audit-runs/audit9-ledger.md` with every status reset to `pending` and the "Audited at" column cleared. Keep the E-IDs. (The ledger is the one new file under `audit-runs/` besides `audit9.md`; it is committed.)
2. Re-measure every `App.jsx:<line>` in it (`grep -n "^function <Name>"`) and correct the row. Stale line numbers are not findings; they are ledger maintenance.
3. Extend from **E113** with everything that exists today and is named in no row. Known candidates (verify each exists before adding): `GO-LIVE.md`; `.gitattributes`; `_harness/sync.sh`'s `uploads/images/` creation; `_harness/isoclaims.js`; the `inquiry-type drift` and `href guard drift` checks in `lint.php`; `admin/csrf-back.js` (10 admin JS files today, the map says 9); `public/images/og-card.jpg`; `public/images/_unmatched/`; `data/.htaccess`, `pdfs/.htaccess`, `uploads/.htaccess`; the 42 product pages as a class; each of the 12 `copy` groups and 16 section arrays in `data/content.json` as verbiage surfaces; every admin flash/error/confirm string as a verbiage surface; the two email bodies in `public/contact.php`; the six owner-facing documents in §0 row 10.
4. Add one column `Pass` naming which of P1–P11 owns the row. Every row has exactly one owner. Rows nobody owns are the first finding of the audit — against this plan.
5. Add the suite census: one row per assertive suite (§4.3) with `Pass = P11` and status `pending` until it has a recorded result this round.
6. Ledger done = every row `done` or `blocked <reason>` and a "Audited at" date. Rows `blocked` are listed in `audit9.md` §5.

---

## 6. Phase 2 — the passes

Each pass: **Objective · Scope · Method · Finding criteria · Not a finding · Artifacts · Exit.** Commands are illustrative of the measurement, not a script to paste blindly — write the probe as a `.js`/`.php` file under `_harness/` when it is more than one line (GUARDRAILS §5, guard-hook constraints). Name instruments `_harness/audit9-<pass>-<what>.js`. They are tracked and reviewed like code; they must be deterministic (fixed viewports, forced fonts, no timing-dependent assertions without a documented settle).

### P1 — Build, dependencies, and the shipped tree

**Objective.** What `npm run build` emits is exactly what the manifest says ships, reproducibly, from a lockfile-exact install, with no known-exploitable dependency reaching `dist/`.

**Scope.** `package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `dist/**`, `README.md` deploy tables, `GO-LIVE.md` B1.

**Method.**
1. `npm ci` on a clean clone; record whether it succeeds without lockfile changes. If `npm ci` fails and `npm install` rewrites the lock, that is a finding (the lock is not authoritative).
2. Build twice; `find dist -type f -exec sha256sum {} +` both times; diff. Non-deterministic output is a finding only if a *content* hash differs — an unchanged file with a new name is Vite's hashing and is expected.
3. `ls -A dist` = exactly the eleven items in `GO-LIVE.md` B1 and `README.md`'s table. Any extra item is a finding (a leaked source map, a dev artifact, a `products-all.json` copy — that last one is the incident behind T3.1).
4. `grep -rl "localhost\|127.0.0.1\|example.com\|placehold\|sourceMappingURL" dist/` — expected: only `placehold.co` reachable through data (P4 owns that), nothing else.
5. Bundle size vs the last recorded (375.66 kB JS / 23.59 kB CSS, 2026-08-27). A rise > 10 % with no PR explaining it is Low.
6. `npm audit --json`; compare with `audit-runs/audit7.md` §2 "What is left after A-7.10" (four advisories, each with a written reachability argument). For each *new* advisory since, re-derive reachability against this app the way A-7.10 did — do not copy the old argument onto a new advisory. `npm audit fix` (no `--force`) is permitted if it changes only the lockfile; record the before/after counts.
7. `.htaccess` and `.user.ini` present in `dist/` (dotfiles); `dist/contact.php` byte-equal to `public/contact.php`; `dist/sitemap.php` byte-equal to `public/sitemap.php`.
8. Confirm `_harness/`, `audit-runs/`, `plans/`, `*.md` at root are absent from `dist/`.

**Finding criteria.** Anything in `dist/` not in the manifest; anything in the manifest not in `dist/`; non-reproducible content; a reachable advisory; a lockfile that `npm ci` rejects.
**Not a finding.** Dev-server advisories in `vite`/`esbuild` (A-7.10 row 1); SSR-only advisories (row 2); the react-router backslash advisory (row 3) unless a new `navigate()` call site takes non-literal input — grep for it and say so.
**Artifacts.** Both hash lists, `npm audit` JSON, `ls -A dist`, the build log line.
**Exit.** Steps 1–8 recorded with outputs.

### P2 — PHP runtime compatibility and the production host's assumptions

**Objective.** The PHP the host actually runs executes every admin and public entry point with zero deprecations, warnings or notices, and nothing in the tree depends on a PHP version or extension the host lacks.

**Scope.** `admin/*.php`, `public/contact.php`, `public/sitemap.php`, `public/.user.ini`, `_harness/php-*.ini` (as instruments only).

**Method.**
1. **Establish the production PHP version.** `admin/help.php:972` prints `PHP_VERSION` on the Help page ("What your server allows"). It is behind login, so C cannot read it; it is an owner-supplied fact. Record it as `[UNSOURCED]` unless Keagan has supplied it, and audit for **both** 7.4 compatibility and 8.x cleanliness until it is known.
2. **7.4 floor.** Grep the PHP surface for ≥ 8.0-only constructs: `match (`, `?->`, named arguments (`\w+: ` inside a call — verify by hand), `str_contains|str_starts_with|str_ends_with`, union types in signatures, `enum `, `readonly`, `never`, `new` in initialisers, `#[` attributes, first-class callable `(...)`. Every hit is either wrapped in a polyfill/`function_exists` guard (record where) or is a finding of severity High if the production version is unknown, Blocker if it is known to be 7.4.
3. **8.x cleanliness.** Start a server on a port ≥ 8140 with `error_reporting=E_ALL`, `display_errors=On`, `log_errors=On`, `error_log=<path under _harness/out/>`. Crawl every admin page signed out and signed in (`_harness/plan10-admincrawl.js` is the precedent — reuse or extend), drive every mutating POST once with valid data (add, edit, delete, both uploads, settings, content, backups restore, password change with a wrong current password, close-reset-window), POST both contact forms, GET `/sitemap.xml`. Then `grep -E "Deprecated|Warning|Notice|Fatal" <error_log>`. Every line is a finding: dynamic property creation, `${var}` string interpolation, null to a non-nullable internal parameter, implicit float-to-int, `strftime`, `utf8_encode`, `FILTER_SANITIZE_STRING` are the usual 8.1–8.4 offenders.
4. **Extensions.** List every extension the code needs (`finfo`, `gd` or `imagick` for the photo downscale, `json`, `mbstring` if used, `openssl` for `random_bytes` fallbacks, `session`). For each: where it is used, whether the code degrades when it is absent, and whether the dashboard health banner names it. An extension the code needs, that the banner does not check, and whose absence fails silently is Medium.
5. **`.user.ini` and `.htaccess` are not testable here** (`php -S` ignores both). Reason from the rule text; label every conclusion `[UNVERIFIED]`; `GO-LIVE.md` C1/C3 is where they are verified. Do not report them as passing.
6. `mail()` assumptions: the `From:` mailbox must exist on the host (runbook A). Owner action; confirm the code's user-facing failure message when `mail()` returns false is still the phone-number-carrying one (T2.6).

**Finding criteria.** Any 8.0+ construct without a guard while the floor is unknown; any Deprecated/Warning/Notice line; a needed extension the health banner does not check.
**Not a finding.** `display_errors` state on the live host (owner verifies via C3); Apache 2.2 syntax in `.htaccess` (GUARDRAILS §7).
**Artifacts.** The grep hit list with dispositions; the error log; the extension table.
**Exit.** All six steps recorded; the production version either sourced or explicitly `[UNSOURCED]` in `audit9.md` §5.

### P3 — Security re-verification (re-verify, do not re-derive)

**Objective.** The posture in `CLAUDE.md` "Security posture" holds mechanically on today's code, and nothing added since audit 8 (PR #53, PR #47, the harness) opened a hole. This is authorised testing of the project's own mirror; nothing here touches the live host.

**Scope.** `admin/**`, `public/contact.php`, `public/sitemap.php`, all four `.htaccess`, `.gitignore`, `.user.ini`, the mirror on `:8123`.

**Method — enumerate, then request.**
1. **Auth gate, mechanically.** For every PHP entry point, the byte offset of the first output vs the byte offset of `require_auth()`. Script it; the answer is a table of 15 rows (all except `auth.php`, `ping.php`, and the two includes). Then request every page signed out with GET and POST: expect the login page or the invariant-12 "session expired, here is your data" page, never data, never a 500, never a path in the response body.
2. **CSRF, mechanically.** Every `$_POST` read → the nearest preceding `csrf_check()`. POST each mutating page signed in **without** the token and with a wrong token: expect rejection with no write (byte-diff `_harness/site/data/` before/after). Logout and password-reset use `csrf_check(false)` — confirm those two and only those two.
3. **Output escaping.** `grep -nE "<\?=\s*\\\$|echo\s+\\\$" admin/*.php | grep -v "h("` — every hit is dispositioned (a constant, an int, or a finding). `inquiries.php` renders every field through `h()` (audit 5); confirm on today's file.
4. **File containment.** For each of the six file operations named in `audit-runs/audit5.md` "Refuted" row 7, send `?sku=../x`, `?sku=..%2fx`, `?file=../../config.php`, a backup name outside the whitelist, and a null byte. Expect a clean rejection page, no read, no write.
5. **Uploads.** A `.php` renamed `.jpg`; a polyglot GIF+PHP; an SVG (must be refused — audit 5); a 1×1 PNG at 50 MB declared size (`post_max_size` page); an image whose pixel dimensions exceed the A-6.6 ceiling. Expect refusal with the per-code message; nothing lands in `uploads/images/` or `pdfs/`.
6. **Session cookie flags** on the `Set-Cookie` from `auth.php` on the mirror: `HttpOnly`, `SameSite=Lax`, name `IPCADMIN`; `Secure` is conditional on HTTPS and is `[UNVERIFIED]` here. `ping.php` unauthenticated must not mint a session file (A-7.3) — count files in the session dir before/after.
7. **Throttle** — `plan5-throttle` (needs the fleet) and `plan5b-pwthrottle` are the evidence; run and record. Do not re-derive the parallelism argument (audit 5 refuted it).
8. **Contact form abuse controls** — rate limit slot consumption on every rejected path (B3), honeypot, referer variants (absent → accept, invariant 11; `android-app://` → accept), CRLF in every field (`hdr()`), a 6,000-char message (truncation announced in the value), the auto-reply cap with Gmail plus/dot variants (4.15b). `audit5-blockers`, `plan3-contact`, `plan3-autoreply`, `contactflow` are the evidence.
9. **Headers.** On the mirror the `.htaccess` headers are not applied; read the rule text for the public and admin trees and diff against the list audit 6/run 1 settled (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS under `env=IPC_TLS`, admin CSP). Record as `[UNVERIFIED — Apache]`; `GO-LIVE.md` C1 is where it is measured. Public tree carries no CSP **deliberately** (`public/.htaccess:31`) — not a finding.
10. **Secrets and runtime files.** `git grep -nE '\$2y\$1[0-9]\$' -- ':!audit-runs' ':!_harness/setpw.php'` must be empty; `git ls-files | grep -E "config\.local\.php|\.jsonl$|\.login-throttle|ALLOW-PASSWORD-RESET|inquiry-log-failed"` must be empty; `git check-ignore -v` each of those paths must resolve. The mirror's `config.local.php` carries `audit-pass-123` and is deleted at the end of the session (§10.3).
11. **Everything the admin can create, vs the deny rules.** Enumerate every filename pattern the admin writes (`config.php`'s `backup_path()`, both uploads, the logs, the throttle, the marker, the reset flag) and match each against `admin/.htaccess` and `data/.htaccess` `FilesMatch` text. A creatable file no rule covers is High. Label `[UNVERIFIED — Apache]` for the rule taking effect; the *coverage* of the pattern is verifiable by reading.

**Finding criteria.** Any entry point outputting before `require_auth()`; any `$_POST` read with no `csrf_check()` on its path; an unescaped dynamic echo; any containment payload that reads or writes; any upload that lands; a session minted by `ping.php`; a creatable file outside every deny rule; a hash or runtime file tracked.
**Not a finding.** Items in `audit-runs/audit5.md` "Refuted" (tearing writes, disk-full, reset-flag creation, throttle parallelism, traversal, header injection) unless today's code differs from what that row describes — quote the diff if so. A-5.10 (no prerender) is deferred by the owner.
**Artifacts.** The auth-offset table; the CSRF map; the escaping grep with dispositions; each request/response pair (status, first 200 bytes of body, byte-diff of `data/`); the `.htaccess` coverage table.
**Exit.** All eleven steps recorded; mirror restored from pristine; `config.local.php` in the mirror deleted at session end.

### P4 — Data truth: is what the site says true, and is the data well-formed

**Objective.** Every factual claim a visitor or buyer reads is true, sourced, and edited on a known screen; every record in the three JSON files is well-formed for every reader of it.

**Scope.** `data/products-all.json`, `data/site-info.json`, `data/content.json`, the `COPY_DEFAULTS`/`SITE_DEFAULTS` fallbacks in `src/App.jsx`, the JSON-LD emitters, `public/manifest.json`, `public/robots.txt`, `index.html` meta, `public/sitemap.php`. **And, if the site is live, the three live JSON files** (see step 1).

**Method.**
1. **STEP 0 first** (`GO-LIVE.md`). `curl -sI https://www.insulationproducts.com/data/products-all.json`. If it is a 200 JSON catalog, the site is live and the **live** `data/*.json` are the truth for this pass: `curl -s` all three (public, read-only GETs — the SPA fetches them on every visit), store under `_harness/out/live-data/`, and `diff` against the repo copies. Every difference is classified: owner edit since deploy (expected — never "fix" it in the repo, never upload), or a repo-side change that never reached live (owner action via the admin, e.g. the A-8.7/A-8.8 privacy sections, the four `photoUrl` case fixes recorded as "still outstanding" in `WHATS_LEFT.md` §2). If the URL 404s, the site is not live and the repo copies are the truth. If unreachable from the container, record `[UNVERIFIED — network]` and audit the repo copies.
2. **Claims register.** Build a table of every factual claim: phone, fax, email, street/city/state/zip, hours (`text` vs `opens`/`closes`/`days` — they must agree), founded year, "over 50 years" (1974 → 2026 is 52; fine, but check the wording is not a fixed number anywhere), "25 million feet", "$50 minimum", "same day or next business day", "one week or less", "ISO 9001" (bare, per A-8.5), UL / CSA / MIL-SPEC / AMS / FDA / RoHS, JIT, PPAP/IMDS, "privately held, independent". For each: where it renders (`file:line` or JSON path), which admin screen edits it (or "hardcoded"), and whether any two renderings disagree (the UX audit's F13 — two shipping claims on one screen — is the precedent). Run `node _harness/isoclaims.js` and record; it is expected red (§4.4).
3. **Certification claims** are business facts with commercial weight (A-8.5). Any claim not present in `site-info.json`'s `certifications` and not on the owner action list is escalated, never edited. Do not write `:2015`.
4. **Products.** `node _harness/imgcheck.js` (79 paths, byte-exact case) and `node _harness/checkskus.js`; then a shape pass: 42 records, `sku` unique and non-empty, `id` = `sku`, `specTable1`/`specTable2` in the A-7.8 shape, `operatingTemp` in one consistent format (list the distinct formats), units consistent per column across products (`"in"` vs `"inch"` vs `"″"`, `°C`/`°F`), `badges` from the 12-approval vocabulary only, `partType` from the 11-family vocabulary only, `pdfLabel`/`additionalPdfs` present on 1 product — confirm that product renders them and the others do not render an empty slot. The **five `placehold.co` `photoUrl`s** are a live external dependency on a third-party host: report as Medium unless `WHATS_LEFT.md` §2/§3 shows a decision on them (grep `placehold` — on 2026-09-14 the only record is "untouched", which is not a decision); escalate as a decision in the §7 format, do not replace them.
5. **Content and site-info.** Every leaf string non-empty or in the clearable allow-lists (`SITE_CLEARABLE`, `COPY_CLEARABLE`); every `page`-type field resolves to a known route; every `industryDetail.products` SKU resolves (`deadlinks.js`); `seo` has exactly the 9 routes and each has title + description within the length rule P6 states; `privacySections` carries the corrected A-8.7/A-8.8 text (repo: yes since PR #53; live: step 1).
6. **Type tolerance beyond products.** A-7.8 added a read-side gate for spec tables. Do the same test for `content.json` and `site-info.json`: write, one at a time, a string where an array is expected, an object where a string is expected, `null`, and a number, into the mirror's copy; load every route; expect a rendered page with the default in place of the bad value, never a blank page or an `ErrorBoundary` fallback. Restore pristine after each.
7. **Structured data.** Extract every JSON-LD block on every route and product page; parse; check required properties per type (Organization: `name`, `url`, `telephone`, `address` with all five fields, `openingHoursSpecification` days/opens/closes consistent with step 2; Product: `name`, `sku`, `description` string not array (4.2), `brand`/`manufacturer` URL = `SITE_ORIGIN`; BreadcrumbList: absolute `item`s; FAQPage: count = rendered FAQ count and text byte-equal to the rendered accordion). Offline validation only; do not paste data into an external validator.

**Finding criteria.** A claim that is false, unsourced, or rendered two ways; a live/repo difference that is a repo-side change never applied live (owner action, not a repo fix); a malformed record any reader mishandles; JSON-LD missing a required property or disagreeing with the page.
**Not a finding.** The ISO revision strings themselves (A-8.5, registrar-gated); the four `photoUrl` case corrections in the repo (done; live copy is an owner action); `content.json` lacking `copy.siteImages` (settled, GUARDRAILS §7.3).
**Artifacts.** The claims register; the live/repo diffs; the shape report; the JSON-LD table; the type-tolerance matrix with screenshots of any failure.
**Exit.** Steps 1–7 recorded; every claim in the register has a source column filled or `[UNSOURCED]`.

### P5 — Verbiage: every string a person reads

**Objective.** Every user-visible string on the public site, in the admin, in the two emails, and in the six owner-facing documents is spelled correctly, grammatical, consistent with one controlled vocabulary, true (P4 supplies truth), addressed to the right reader, and accurate about the UI it describes.

**Scope — build the inventory first, then audit the inventory, never the code directly.**
Write `_harness/audit9-strings.js` that emits `_harness/out/audit9-strings.json`, one record per string with `{surface, locator, text, editable_on}`:
- `public-jsx`: literal text nodes and string props (`placeholder`, `aria-label`, `title`, `alt`, `label`) in `src/App.jsx` **outside** `COPY_DEFAULTS` — these are strings the owner cannot edit, and each one is classified: fine as hardcoded (structural, e.g. "Skip to content"), or should be owner-editable (Low, batch into one finding with the list).
- `public-defaults`: every leaf of `COPY_DEFAULTS` and `SITE_DEFAULTS`.
- `public-data`: every leaf string in the three JSON files (live copies if P4 step 1 says the site is live).
- `admin`: every text node in `admin/*.php` outside PHP blocks, plus every string literal passed to the flash/error/notice helpers and every `data-confirm` attribute, plus `admin/help.php` in full.
- `email`: the notification and auto-reply subject and body templates in `public/contact.php`, rendered once with sample data.
- `meta`: `seo[]`, `index.html` `<title>`/description/`og:*`, `manifest.json` `name`/`short_name`/`description`, `robots.txt` comments, the 404 page, `CatalogError`, the session-expired page, the "too large" page, the no-password-set state of `auth.php`.
- `docs`: `README.md`, `admin/README.md`, `Editing-Your-Site-Content.md`, `Email to Rick - Admin Dashboard Handoff.md`, `GO-LIVE.md`, `PATCH_NOTES.md` — audited as **instructions**: every sentence that tells Rick to click something is checked against the rendered admin (nav label, button text, page heading). `Editing-Your-Site-Content.md` lists nine menu items; `admin/nav.php` renders "+ Add Product" and the brand text "Product Manager"; `help.php:322` describes a header bar with four quick links. Whether those three agree is the first check of this surface.

**Method — per record, in this order, each with a rule that makes the check binary:**
1. **Spelling.** `which hunspell aspell`; if present, run over the inventory with an `en_US` dictionary plus a project word list (`_harness/audit9-words.txt`: SKU names, "Bolingbrook", "PPAP", "IMDS", "RoHS", family names…). If neither is present, `npx --yes cspell@latest --no-progress` on the exported text (temporary, **never added to `package.json`**). Record which tool ran. Every remaining hit is read by a human-shaped pass and dispositioned: typo (Low, fixed in batch), proper noun (added to the word list), or intentional.
2. **Controlled vocabulary.** Seed table in Appendix B. For each term pair, `grep -c` every variant across the inventory; the variant with the most occurrences on the *public* surface is the canonical form unless the owner's data says otherwise; every other occurrence is a Low finding, batched per pair, fixed only in code/defaults/docs — data strings are owner edits (P4 rule).
3. **Punctuation and typography.** One rule per surface, recorded: curly vs straight quotes; hyphen `-` vs en dash `–` (ranges, "Mon–Fri") vs em dash `—`; Oxford comma; trailing periods on list items and on button labels (none); `&` vs "and" in headings; `%`/`°`/`″` spacing; ellipsis character vs three dots. Mixed usage on one page is Low; a range written with a hyphen in one place and an en dash in another on the same page is the concrete case.
4. **Capitalisation.** Headings: Title Case or Sentence case — measure what the majority does per surface (public h1/h2, admin h1/h2, buttons, nav), then flag the minority. Product names and part types keep the catalog's case. "ISO 9001", "UL", "CSA", "MIL-SPEC", "RoHS", "PPAP", "IMDS", "FDA" have one correct form each.
5. **Grammar and clarity.** Subject–verb agreement, dangling modifiers, sentences > 35 words on the public surface, double spaces, doubled words ("the the"), stray trailing spaces inside strings that render (`" ."`, `" ,"`), missing spaces at concatenation boundaries (UX audit F17 is the precedent — check every place two strings are joined in JSX and in PHP: `{a}{b}`, `. $x .`).
6. **Truth.** Cross-reference every claim-bearing string against P4's register; a string P4 marks false is P4's finding, not duplicated here.
7. **Audience.** Public strings speak to a buyer: no internal jargon ("SKU" is fine in the catalog; "JSON", "cache", "deploy", "FTP", "prod" are not). Admin strings speak to Rick: no developer vocabulary in a flash message or help text ("JSON" appears in the spec-table Advanced mode by design — check it is introduced, not assumed). Emails speak to a customer who has not seen the site's chrome: they carry the phone number and the company name in full.
8. **Instructional accuracy (admin + docs).** For every imperative ("click **Save**", "under **Business Details**", "the **Photo** button"), open the mirror page and confirm the control exists with that exact label and is where the text says. `help.php` is the owner's single source of truth (decided 2026-08-05) and is 996 lines; every one of its claims is checked. `plan10-help.js` covers two abandoned workflows — run it; it does not cover the rest.
9. **Labels, alt text, link text.** Every `<img>`'s `alt`: informative images describe the subject (not the filename, not "image", not the product SKU alone); decorative images `alt=""` (logo `alt=""` with `aria-label` on the link is settled — GUARDRAILS §7.3). Every link's accessible name is meaningful out of context (no "click here", "here", "read more" without the subject). Every form control's label names the data ("Quantity" not "Qty*"). Every error message names the field and what to do.
10. **Legal text.** The seven `privacySections` (post-PR #53), the FAQ's shipping/returns/lead-time answers, any warranty or specification-accuracy disclaimer on product pages. Check only for **internal consistency and truth against the code** (A-8.7/A-8.8 method). Wording changes to legal text are **escalated**, never made (§7.3, public-facing copy).

**Finding criteria.** A binary rule above, violated, with the string, its locator, and the rule. Batch by rule, not by string: one finding "hyphen/en-dash inconsistency, 14 instances" with the list, not 14 findings.
**Not a finding.** House style the owner chose in his own data (his product descriptions, his About paragraphs) — record as observations under "owner's voice", no severity, unless a spelling error or a false claim. Strings inside `_harness/`, `audit-runs/`, `plans/`, comments in code.
**Artifacts.** `audit9-strings.json`; the spell-check log and word list; the vocabulary counts table; per-rule finding lists; screenshots for every instructional-accuracy miss.
**Exit.** Every surface in the inventory has all ten checks recorded; the "owner's voice" observations are listed separately for Keagan to forward or drop.

### P6 — Page structure and information architecture

**Objective.** Every page has one job, a heading outline that says so, landmarks a screen reader can jump by, a consistent header/eyebrow/intro/sections/CTA shape, no dead ends, and every route is reachable from the site's own navigation and appears in exactly the places it should (nav, footer, sitemap, SEO table).

**Scope.** The 10 public routes + `NotFoundPage`, the 42 product pages as a class (sample 5 by hand, all 42 by script), the 13 admin pages, `Navbar`, `Footer`, `Breadcrumb`, `PageMeta`, `public/sitemap.php`, `SEO_DEFAULT`/`KNOWN_ROUTES`. Viewports 390, 834, 1440, 1920, 2560 (invariant 13's 80vw rule is measured at the top three).

**Method.**
1. **Outline.** For every page and viewport: exactly one `h1`; no skipped levels; the `h1` names the page's subject (UX audit F6 is the precedent: the product page's dominant heading must be the product); section headings in DOM order match visual order. `_harness/audit10-headings.js` is the precedent instrument; extend it to the admin.
2. **Landmarks.** One `<header>`, one `<nav>` (or several with distinct `aria-label`s), one `<main>`, one `<footer>` per page; the mobile drawer is `role="dialog" aria-modal`; every landmark region has an accessible name where there is more than one of its kind.
3. **Shape parity.** Table every inner page's top: eyebrow present? title? intro? breadcrumb? Every inner page follows the majority pattern or has a written reason not to. Every page ends with a path to `/contact` (a CTA or the footer's contact block) — record which. The Home page's section order is judged against the buyer's job (find a part → trust the supplier → ask for a quote): record the actual order and whether any section interrupts it.
4. **Navigation graph.** Derive: nav links, footer links, mega-menu links, breadcrumb links, in-body `PageLink`s. Assert: every `KNOWN_ROUTES` route is reachable in ≤ 2 clicks from `/`; every nav/footer link resolves to a known route or an in-page anchor that exists (`scrollToAnchor` on cold load — A-03/F4 precedent — verify on cold load, not after a client-side navigation); `/sitemap.xml` `<loc>` set = `SEO_DEFAULT` routes + 42 product URLs (`plan5b-sitemap`, `plan5c-sitemap`); `robots.txt` allows all of them (A-5.2); no route is in the sitemap but `noindex`, or `noindex` but linked as primary nav.
5. **Dead ends.** Repeat the UX audit's dead-end inventory method on today's site: every empty state (search with no results, family filter with no products, approval filter with no matches, datasheet filter empty — F11 precedent, FAQ search if any, Inquiries empty, Audit Log empty, Backups empty), every error state (`CatalogError`, 404, contact failure, session expired, too-large upload), every terminal panel (contact success ×2). Each must offer at least one forward link that is not the browser Back button.
6. **URL and parameter structure.** `?productId=` unknown / alias / mixed case / trailing slash / double segment / uppercase path / `?family=` unknown / `?approval=` unknown / `?part=` unknown SKU / `?tab=` unknown / `?sent=1` replay (F5) / `?q=` with HTML. Each yields a rendered page with a clear message and `noindex` where appropriate; none yields a blank page, a 500, or a console error. `plan9-notfound` and `plan8-crumbs` are evidence for part of this.
7. **Meta per route.** Title ≤ 60 chars and unique per route; description 50–160 chars and unique; canonical = `SITE_ORIGIN` + path (no params except `productId`); `og:image` = `og-card.jpg` exists, 1200×630, < 300 kB; 404 carries `noindex`. `plan8-meta`, `plan9-meta` are evidence; extend for the length rules if they do not assert them.
8. **Admin structure.** Every admin page: `h1` = nav label of the current tab; the current tab is marked; the form's primary action is the last focusable control before `form_complete`'s hidden field on `content.php` (invariant 6 — `plan2-formlast`); destructive controls are visually distinct and confirm (`plan2-delete`); the health banner is above the fold at 390 (`plan10-adminnav`, `plan10-helpwidth`).
9. **Print.** A-7.7 (no print stylesheet) is **open and deferred as its own change** — record the current `@media print` rule count (0 on 2026-08-27) and do not fix it here.

**Finding criteria.** Outline/landmark rule violated; a page without the majority shape and without a reason; an unreachable or duplicated route; a dead end; a parameter that blanks a page; meta outside the rules; a route in one inventory and not another.
**Not a finding.** A-7.7; the `?productId=` URL scheme (settled, GUARDRAILS §7.3 Option B); scroll restoration on `/products` (refuted, §7.2); the 39 severity-C clusters in PLAN-10 §12 unless the specific instance blocks a buyer path (then cite the cluster and say why this instance is different).
**Artifacts.** Outline tables per page; landmark table; shape-parity table; the navigation graph as an adjacency list; the dead-end inventory; the parameter matrix; the meta table.
**Exit.** All nine steps recorded across all viewports.

### P7 — Gaps in logic: the state and edge-case matrix

**Objective.** Every conditional path the code has, and every input shape the world can send, produces the outcome the site needs — not merely "does not crash". Appendix C is the matrix; every cell is run.

**Scope.** `src/App.jsx` (routing shim, `useProducts`, `SiteInfoProvider`/`mergeSiteInfo`, `ContentProvider`/`mergeContent`, `ErrorBoundary`, `ContactPage` both forms, catalog filters), `public/contact.php`, `public/sitemap.php`, `admin/config.php` (`backup_*`, `save_*`, `require_auth`, throttle, `admin_password_write`), `admin/edit.php`, `content.php`, `settings.php`, `backups.php`, `delete.php`, both uploads, `auth.php`, `password.php`, `index.php`, `ping.php`.

**Method.**
1. Run every row of Appendix C. Each row names the surface, the input or state, the expected outcome, and the evidence suite if one exists. Where a suite exists, run it and record; where none exists, write `_harness/audit9-logic-<area>.js` with the row as an assertion and a negative control (a row that must fail when the guard is removed — prove it once, restore, record).
2. For every `if`/ternary in the four merge/fetch functions and in `contact.php`'s decision chain, list the branch and the row in Appendix C that exercises it. A branch no row reaches is a coverage gap: add the row, run it.
3. **Time.** Freeze the browser clock (Playwright `clock`) at 2026-12-31T23:59:59 and 2027-01-01T00:00:01 in the site's timezone and check every date-bearing string (copyright range, effective date, hours "open now" if any). Freeze the PHP side with a fixed `$_SERVER['REQUEST_TIME']` where the code reads it (backup timestamps, throttle windows, reset-window expiry at exactly 3600 s and 3601 s).
4. **Concurrency.** Two tabs on `edit.php` for the same SKU, save in both — second gets the signature warning with its typed values preserved (T1.7/B1). Same on `settings.php` and `content.php`. A save while a backup restore runs.
5. **Encoding.** En dashes, `°`, `″`, `µ`, emoji, and a right-to-left mark through: the contact form → email body and JSONL → `inquiries.php` render; `settings.php` → `site-info.json` → the footer; `content.php` → `content.json` → the page. Expect byte-faithful round-trips and `JSON_UNESCAPED_UNICODE` on disk (or a documented reason for escaping).
6. **Failure of one of three files.** For each of the three JSON files, one at a time on the mirror: missing (404), served as HTML 200 (the SPA fallback — `jsonOrThrow()` must reject it), truncated JSON, wrong `Content-Type`, 12 s stall. Expect: catalog routes show `CatalogError` with the phone number reachable in the footer (invariant 8); non-catalog routes render fully; a later successful fetch (tab refocus, TTL) recovers without reload (4.25). Restore after each.

**Finding criteria.** Any row whose observed outcome differs from its expected outcome; any branch no row reaches after step 2 (the gap itself is Low; what the added row finds is scored on its own).
**Not a finding.** Rows already proven by a green suite this round — record the suite, do not re-run by hand. The catalog-size cliff (refuted, audit 7 §4). Scalar-field coercion (considered and not taken, audit 7 §3) unless a row shows a non-string reaching a render site through an admin path — the FTP hand-edit case stays out.
**Artifacts.** The completed Appendix C with an observed column; the branch → row map; every new instrument with its negative-control run.
**Exit.** No empty cell in Appendix C's observed column.

### P8 — The runbook dry-run and document truth

**Objective.** `GO-LIVE.md` executed literally against the mirror works step by step; every document that describes the system describes today's system.

**Scope.** `GO-LIVE.md`, `README.md`, `CLAUDE.md`, `admin/README.md`, `_harness/README.md`, `plans/GUARDRAILS.md` §4.1 baseline, `DEPLOY_READINESS_v2.md` §7 (read-only, frozen — known stale by one row: `sitemap.xml`), `PATCH_NOTES.md`.

**Method.**
1. **STEP 0** — as P4 step 1. Record which branch (first deploy vs re-deploy) applies today.
2. **B1–B3 on the mirror.** Follow B2's order into a fresh `_harness/out/deploy-sim/public_html/`, treating it as the server: upload `assets/` first, `index.html` last; at each step serve the folder with `php -S` on a port ≥ 8140 and load `/` — the blank-page window B2 describes must not appear at any step. Confirm the "eleven things"; confirm the dotfiles are in the list the FTP client would hide. B3's permissions table cannot be tested here — `[UNVERIFIED]`.
3. **C1–C4 mapped.** For each C check: verifiable locally (do it), verifiable on the live host read-only (the exact `curl -sI` lines in C1 are permitted against the live host — record the responses, or `[UNVERIFIED — network]`), or owner-only (C3 sign-in, C4 the real form submission — **never** done by an agent against the live site; state so).
4. **Rollback.** Perform the documented frontend rollback on the deploy-sim: overwrite `index.html` with the previous one; the previous `assets/` pair must still resolve. Perform a `data/` rollback through **Admin → Backups** on the mirror and confirm the restore itself created a backup first.
5. **"If something is wrong" table.** For each symptom row, induce it on the deploy-sim (upload `dist/` itself as a folder; omit `.htaccess` — emulate via the router; remove `data/.htaccess`'s `AddType` — emulate by serving the JSON as `text/plain`; delete `config.local.php`) and confirm the "first thing to check" would have found it.
6. **Document truth, mechanically where possible.** Every number and name in the docs that the code can contradict: `CLAUDE.md`'s `App.jsx` line figure (13,136 on 2026-09-14 vs "~12,900"); `CLAUDE.md` "13 admin pages"/"17 entry points"/"9 JS files" vs `ls admin/`; `_harness/README.md`'s "96 fields" vs `lint.php`'s "110 matched" (they disagree on 2026-09-14 — one is stale, find which); `admin/README.md`'s backup count vs `config.php`'s constant (A-6.9/A-7.5 precedent — check it did not regress to 30 in any doc); `GO-LIVE.md`'s "52 URLs" vs the served sitemap; `GUARDRAILS.md` §4.1's suite count vs §4.3's derived list; `README.md:213-218` (A-8.1's paragraph) vs `useRefetchOnReturn()` today; every `file:line` cited in `CLAUDE.md` and `GUARDRAILS.md` (AUDIT-11 §7 found 14 drifted/wrong — re-run that census). Numbers that are self-described as approximate and instruct re-measuring are refreshed, not findings; a number stated as fact and wrong is Low; a doc instruction that would cause a wrong action (A-8.1, A-8.2 class) is Medium or High by consequence.

**Finding criteria.** A runbook step that fails or is ambiguous when followed literally; a symptom row whose "first thing to check" would not find the induced fault; a doc statement the code contradicts.
**Not a finding.** `DEPLOY_READINESS_v2.md`'s `sitemap.xml` row (known, frozen, recorded in `CLAUDE.md`); `.htaccess`/`.user.ini`/permissions behaviour on Apache (`[UNVERIFIED]`, runbook-verified).
**Artifacts.** The deploy-sim log per step with a screenshot at each; the C-table with verified/unverified/owner-only per row; the document-truth table.
**Exit.** All six steps recorded; STEP 0's answer stated.

### P9 — Accessibility and responsive re-verification

**Objective.** The AUDIT-10/11 and PLAN-8 accessibility state holds on today's code, and the go-live minimum (keyboard-complete, AA contrast where the owner's palette allows, reduced motion, 200 % zoom, no horizontal scroll at 390) is measured, not assumed.

**Scope.** All public routes at 390/834/1440; admin at 390/1440; the mobile drawer; both contact forms; the mega-menus; the FAQ accordion; the dashboard table.

**Method.**
1. Run and record `plan8-keyboard`, `plan8-motion`, `plan8-mobile`, `plan8-chrome`, `plan8-contrast` (34/35 expected), `plan2-contrast`, `plan5c-eyebrow`, `plan5c-brandink`, `brandtext` (≤ 13 failing), `plan4-public`, `plan4-admin`, `plan10-rfqscroll`, `plan10-adminrows`, `plan10-adminnav`, `plan10-helpwidth`.
2. Keyboard: drive **real** `Tab`/`Shift+Tab`/`Enter`/`Escape`/arrows (never `.focus()` — `:focus-visible` does not match programmatic focus, GUARDRAILS §7.1) through every page; every interactive element is reachable, has a visible focus ring, and `Escape` closes every overlay from inside it (F10 precedent). Record the focus order per page and any trap.
3. 200 % browser zoom at 1440 and 400 % at 1280 (WCAG reflow): no content cut, no horizontal scroll except inside spec tables' own scroller.
4. Text-only zoom / large font: `document.documentElement.style.fontSize = '24px'` — layouts that use `px` heights clip; record any.
5. Screen-reader semantics: run Playwright's accessibility snapshot on every route; every form control has a name; every button has a name that is not its icon glyph; live regions exist for form errors (`role="alert"`) and for async catalog states.
6. Optional instrument: `npx --yes @axe-core/cli` (free, MIT, temporary — **never** added to `package.json`) on the mirror URLs. Every axe finding is reproduced through steps 2–5 before it is written down — a probe finding that does not reproduce by hand is a probe artifact (AUDIT-11 §7.2's six probe defects).
7. Colour: any Medium/High contrast finding must be measured under the glyphs on the real background (`_harness/backdrop.js` is the measurement core), not on the element box. The three brand decisions in GUARDRAILS §7.3 and `WHATS_LEFT.md` §3 are closed; a new colour finding is a finding only if it is on a surface those decisions do not name.

**Finding criteria.** Unreachable/untrappable control; missing name; no focus ring; reflow failure; a contrast failure on a surface not covered by a settled decision; a live region absent where a state changes without focus moving.
**Not a finding.** Everything in `WHATS_LEFT.md` §2 brand/contrast items and GUARDRAILS §7.3; DejaVu-width artifacts unless re-measured under Liberation Sans.
**Artifacts.** Suite results; focus-order lists; zoom screenshots; the accessibility snapshots; axe log with per-item reproduction status.
**Exit.** All seven steps recorded.

### P10 — Performance and robustness at go-live

**Objective.** No visitor-facing regression in weight, errors, or leaks since audit 7 §4, measured the same way.

**Method.**
1. Crawl all 10 routes + all 42 product pages in Chromium: 0 console errors, 0 failed requests, 0 responses ≥ 400 (audit 7's measurement — repeat it).
2. `plan5-images` (weight, dimensions, lazy-loading), `plan5-listeners` (leak), `plan5-keys` (needs the dev-React build it makes itself).
3. Transfer size of `/` cold at 390 and 1440 with cache disabled; the hero image is not requested at 390 (refuted-as-problem in §7.2 — confirm it still holds).
4. The three fetches' cache behaviour: `index.html` `no-cache`; `assets/` immutable; `data/` ~60 s (`data/.htaccess` — `[UNVERIFIED — Apache]`, rule text only); the per-minute cache-buster present on all three data URLs.
5. Catalog at 500 products (audit 7's method) — repeat only if `useProducts`/`DashboardPage`/`CatalogLanding` changed since `1826a6d`; otherwise cite audit 7 §4 and skip, saying so.

**Finding criteria.** Any console error or failed request; an image over its recorded budget; a listener count that grows across 20 scroll cycles; a cache header contradicting the deploy strategy.
**Not a finding.** Bundle size within 10 % of 375.66 kB; the catalog-size hypothesis (retired).
**Artifacts.** The crawl table; suite results; the transfer-size table.
**Exit.** All five steps recorded.

### P11 — The harness and the process (audit the auditors)

**Objective.** The evidence this audit relies on can fail, is complete, and describes itself accurately.

**Method.**
1. Reconcile §4.3's derived list (58 on 2026-09-14) with `_harness/README.md`'s tables and with "79 suites" in `audit-runs/audit8.md` §1. Every suite in a table and not runnable, or runnable and in no table, is a row; the reconciled number becomes this round's denominator and is written into `audit9.md` §1 and, as a refresh, into `GUARDRAILS.md` §4.1.
2. Every `*-selftest.js` runs and **fails its target** as designed (`invariants-selftest` 15/15, `copydrift-selftest` 5/5, `contactflow-selftest`, `backdrop-selftest` 9/9, `plan2-formlast-selftest`). A selftest that passes without its target failing is a broken selftest — High, because everything downstream of that check is then unproven.
3. Every check `lint.php` runs (the 13 lines in §4.2) has a recorded mutation test somewhere (`audit-runs/audit8.md` A-8.6 shows the shape for `inquiry-type drift`). List which do and which do not; a check with no mutation test gets one this round, run once, restored, recorded.
4. Suites that mutate the mirror restore pristine and prove it with a byte diff at the end of their own run — list which do; any that does not is Medium (it is how a later suite inherits a false state).
5. `node --check` every `_harness/*.js` (the probes too); a probe that no longer parses is deleted, not kept (retire = delete) — record the list in `audit9.md` §3.
6. `_harness/README.md`: every suite in "Standing regression — these must stay green" is in the sweep; the expected-reds paragraph names exactly the four in §4.4; the bootstrap commands work on a fresh clone as written (Phase 0 is the evidence).
7. `.gitignore` covers `_harness/site/`, `_harness/pristine/`, `_harness/out/` and nothing under `_harness/` that is tracked is generated.
8. Confirm this plan's own claims: every command in §4.2 ran as written; every file this plan names exists (`doc drift`-style: extract every backticked path from this file and `test -e` it).

**Finding criteria.** A selftest that cannot fail; a check with no mutation test; a mutating suite with no restore; a suite in a doc and not runnable; a documentation/baseline number that does not reproduce; a path in this plan that does not exist.
**Artifacts.** The reconciliation table; selftest outputs; the mutation-test census; the restore census.
**Exit.** All eight steps recorded; the denominator for the final sweep is fixed and written.

---

## 7. Phase 3 — triage, severity, and the fix policy (C, after V)

### 7.1 Severity — one definition, used everywhere

| Severity | Definition (tiebreak: §2) | Verdict effect |
|---|---|---|
| **Blocker** | Prevents a safe launch: unauthenticated data exposure or write; the lead path (form → email **and** Inquiries row) fails; a legal or certification falsehood on a live page; a blank page in a supported browser; irreversible data loss on a normal owner action. | NO-GO while open |
| **High** | A buyer or Rick is misled or blocked on a main path; a claim the business cannot stand behind; a security control that fails silently; a doc instruction that causes a destructive action. | Must be fixed, or an owner action with a named step, before GO |
| **Medium** | Wrong with a workaround, or on a secondary path; a control that degrades without a signal; doc/code disagreement that causes rework but not damage. | Fixed this round if in scope; else recorded in `WHATS_LEFT.md` §2 |
| **Low** | Verbiage, typography, structure polish, stale numbers in self-describing docs, harness hygiene. | Batched; fixed when the batch is cheap and delta-only |

Severity is assigned by consequence, never by how many instances (14 typos are one Low finding) and never by wording. V may change a severity only with the consequence written next to it.

### 7.2 Class — who closes it

`code` (C fixes) · `harness` (C fixes) · `doc` (C fixes) · `data-live` (owner action through the admin; **never** a repo edit of `data/*.json`, never an upload) · `server` (owner action: DNS, SPF, 301, permissions, PHP version) · `decision` (escalated in the five-field form; nothing coded until logged in `WHATS_LEFT.md` §3).

### 7.3 What C may fix and what C may not

**May:** any `code`/`harness`/`doc` finding, delta-only, test-first (watch the new check fail, then fix, then watch it pass), ≤ 3 attempts, no refactor, no rename, no reordering, no new dependency, no new file outside `_harness/` and the two `audit-runs/` files this plan names.
**May not, ever:** `data/*.json` (exception: an explicit instruction from Keagan in the executing conversation, recorded verbatim in `WHATS_LEFT.md` — the 2026-08-06 `photoUrl` precedent), `pdfs/`, `uploads/`, `DEPLOY_READINESS_v2.md`, any prior `audit-runs/audit<n>.md` beyond appending a dated correction block, `public/images/site/` deletions, the invariants, the sentinel in `config.php`, public-facing copy with legal or commercial weight (privacy text, certifications, stock/minimum/lead-time claims, pricing) — those are `decision`.
**Verbiage fixes** to hardcoded strings, `COPY_DEFAULTS`, admin text, emails and docs are `code`/`doc` and may be fixed; the same string living in the owner's data is `data-live`.

### 7.4 Regression after fixes

Select the regression batch **by surface, not by grep** (scorecards Run 3 rule): every suite whose README row names a file or page the fix touched. Run it after each fix. After the **last** fix run the **full** derived sweep (§4.3) and record it as the "after" table next to the "before" table from Phase 0. Denominators must match; the only reds are §4.4's.

---

## 8. Phase 4 — records, PR, handback

### 8.1 `audit-runs/audit9.md` — the shape (§13.2)

Header block (date, base, brief, the totals table **generated from the findings list by a script, not typed** — audit 8's table under-counted by one and had to be corrected), §0 the lenses, §1 the inherited state (Phase 0 verbatim), §2 findings in severity order in the §13.1 record shape, §3 shipped (file → change → evidence), §4 checked-no-finding and raised-not-reproduced (with both measurements), §5 what is left (owner actions, `blocked` ledger rows, escalations), §6 the verdict (§9).

### 8.2 `WHATS_LEFT.md` — append-only

- Shipped fixes → a new §1-series block (`§1p` or the next free letter — check `section drift` in `lint.php` passes after).
- New open items → §2 with date, evidence, `file:line`.
- Escalations and their answers → §3, before any dependent code.
- Evidence → a new §4-series block; per-fix before/after outputs.
- Anything an earlier line got wrong → `SUPERSEDED-BY 2026-xx-xx` under it; never rewrite it.

### 8.3 Other records

`_harness/README.md` gains a row per new suite/instrument (and `doc drift` must still pass). `GUARDRAILS.md` §4.1 gets its refreshed table (a refresh, dated). `CLAUDE.md` changes **only** if a new invariant earned its place (a defect that would have shipped, with the incident named inline) or a stated number is refreshed. `PATCH_NOTES.md` only for owner-visible changes. `plans/README.md`: one line pointing at this plan as open, then as done. This plan: status line flipped to DONE with the date; nothing else in it rewritten.

### 8.4 Branch, commit, PR

Only when the executing conversation says to commit (GUARDRAILS §2 forbids `git commit` otherwise — if it does not, stop after 8.5 and hand back with the tree dirty and say so). Branch `claude/<slug>` from `main`; commits in the repo's voice (imperative, the finding IDs in the subject); one PR titled `Audit 9 — <n> findings, <m> fixed`, body = the totals table + §5 + the verdict; Keagan merges (every prior merge to `main` is his). No model identifiers in commits or the PR.

### 8.5 Handback (GUARDRAILS §8 order)

1. Fixed — file → change → proof. 2. Not fixed and why. 3. Escalations, five-field form. 4. Records corrected. 5. Regression state, before and after. Then: the verdict, the `[UNVERIFIED]`/`[UNSOURCED]` list, and what was not done. Short and dense.

---

## 9. The verdict

Exactly one of:

- **GO** — no open Blocker/High; every Medium fixed or in `WHATS_LEFT.md` §2 with a reason; owner actions list empty or cosmetic.
- **GO-WITH-OWNER-ACTIONS** — no open Blocker; every High is fixed **or** is `data-live`/`server` with the exact owner step written in `GO-LIVE.md` A (one line, checkbox, where it is done). The list is printed in full with the verdict.
- **NO-GO** — any open Blocker, or any High of class `code` unfixed. Name it.

The verdict is computed from the findings table by the same script that computes the totals. It is not softened by progress made and not hardened by findings refuted.

---

## 10. Guardrails specific to this audit

GUARDRAILS.md applies in full. These add to it. Where a rule was born from an incident, the incident is named — that is what makes it a rule rather than a preference.

### 10.1 Honesty — keeping the evidence true

1. **No finding without a reproduction a second agent ran** (§3.3). AUDIT-11: five published numbers did not reproduce.
2. **The probe is not the page.** A symptom seen only through a harness selector, a full-page screenshot, or programmatic focus is reproduced through the visitor's or Rick's path before it is written. GUARDRAILS §7.1–7.2: six probe defects, the sticky-bar false finding, A10-056.
3. **Denominator first.** A red suite whose total differs from the baseline is a bail, not a finding, until the servers, fleet and mirror credential are confirmed. PLAN-10 phase E false alarm.
4. **Counts are computed, not typed.** The totals table, the verdict, the per-pass finding counts, the sweep table — all generated from the records. Audit 8's "eight findings" was nine.
5. **`[UNVERIFIED]`, `[UNSOURCED]`, `NOT-MEASURED` are mandatory labels.** `php -S` ignores `.htaccess`/`.user.ini`; the production PHP version is not in the repo; network reachability of the live host is not guaranteed. Silent omission of the label is a defect in the audit.
6. **A refutation is a result.** A hypothesis that does not reproduce is recorded in §4 with the measurement that retired it (audit 7's catalog-size table). It is not deleted, and it is not softened into a Low to "keep it".
7. **Severity is consequence.** Not instance count, not wording, not how long it took to find. Not adjusted after the owner shows interest in an option.
8. **"Fixed" needs three artifacts:** the check failing before, the diff, the check passing after. Plus the surface-selected regression batch, green.
9. **Environment artifacts are not site defects.** GUARDRAILS §7.1 list, plus: `node_modules` absent on a fresh clone; the mirror has no `uploads/` and no `admin/logo.svg` until copied; Linux `system-ui` is DejaVu; the container's PHP is 8.4.
10. **Self-corrections are recorded**, in the pass file and then in `audit9.md`, so the next round does not repeat them.
11. **Every check written this round must be shown failing once** (negative control) before its pass counts. GUARDRAILS §4.4: two invariant checks passed against a broken assertion.

### 10.2 Straying — keeping the audit on its objectives

1. **Ledger fence.** Not in the ledger → not audited. Add the row first (§5). The diff of the ledger is the record of every scope change.
2. **Finding fence.** Not an `A-9.n` record with a reproduction → not fixed. No "while I was here". GUARDRAILS §1.
3. **Brief fence.** A pass agent audits its brief and nothing else; out-of-brief observations are one line under `## Out of brief`, unaudited, routed by C.
4. **Fix fence.** Only C fixes; only `code`/`harness`/`doc`; only delta; ≤ 3 attempts.
5. **Decision fence.** Legal text, certification claims, commercial claims, brand colours, the placeholder-image host, prerender/SSR, the print stylesheet, the extraction of `App.jsx`, the git-history rewrite, paid tooling — all `decision` or already settled (§11). An agent that finds itself drafting privacy wording or picking a colour has strayed.
6. **Do-not-re-report index** (§11) is consulted **before** a record is written, and the record says which entry was checked ("not in §11" is an explicit field in §13.1).
7. **No re-opening without new dated evidence.** A settled decision is re-raised only with a measurement that did not exist when it was settled, cited by date; otherwise it is cited and left.
8. **Timeboxes are exit criteria, not clocks.** A pass ends on its exit list or its blocked list. Running out of budget produces a blocked list, never a shorter audit that reports as complete.
9. **One PR.** No side branches, no "quick follow-up PR" for something found late — it goes in `WHATS_LEFT.md` §2.
10. **No new planning documents.** Findings go in `audit9.md`; open work in `WHATS_LEFT.md`; process changes in `GUARDRAILS.md` as dated additions. This plan is the last new `.md` until Keagan asks for another.

### 10.3 Safety — the live host, the data, the credential

1. **The live host is read-only, and only these URLs:** `GO-LIVE.md` STEP 0's URL and the C1 `curl -sI` lines, plus GET of the three `/data/*.json` for P4. `HEAD`/`GET` only. No form POST, no `/admin/` sign-in, no `contact.php`, no crawling beyond that list. C4 (the real form submission) is Rick's or Keagan's action and is written as such.
2. **`data/`, `pdfs/`, `uploads/` in the repo are never edited** by the audit (exception in §7.3). Live copies are never uploaded. Findings against them are `data-live` owner actions with the admin screen named.
3. **The mirror is the only mutable target.** Every mutating step restores `_harness/site/data/` from `_harness/pristine/` and proves it (`cmp -r` or byte diff). `_harness/pristine/` is re-seeded only for the one reason `WHATS_LEFT.md` §2 records (an owner-instructed data change), never to make a suite pass.
4. **The mirror credential is `audit-pass-123`, lives only in `_harness/site/admin/config.local.php`, and is deleted at the end of the session.** No hash is printed into any pass file, `audit9.md`, a commit, or the PR. `git grep '\$2y\$'` before the commit (P3 step 10) is the check.
5. **No secret leaves the repo's ignore rules.** Nothing under `_harness/site/`, `_harness/pristine/`, `_harness/out/` is committed. `git status --porcelain` is read before every commit; anything unexpected is dispositioned before `git add`.
6. **No history-destroying verbs.** No force-push, no reset --hard on a shared branch, no rebase of `main`. GUARDRAILS §2.
7. **Nothing external gets project data**: no online validators, no pasted JSON into third-party tools, no spell-check services. Offline tools or temporary local `npx` packages only.

---

## 11. Do-not-re-report index

Consult before writing any record. Each entry is a pointer; the pass agent reads the pointer, not this summary, before deciding.

| Where | What it settles |
|---|---|
| `plans/GUARDRAILS.md` §7, §7.1, §7.2, §7.3 | Closed items, environment artifacts, refuted-with-measurement, settled decisions (logo alt, `?productId=` URLs, C34/C40/C31/slot 5, `copy.siteImages`, the three expected reds). |
| `audit-runs/audit5.md` "Refuted, corrected, and re-scoped" + "Checked, no finding" | Tearing writes, disk-full, phantom spec rows, react-router advisories (as of then), reset-flag creation, throttle parallelism, traversal, header injection, page weight; the auth/CSRF/session/upload/XSS/sitemap/exposure/backup/concurrency/orphan/browser-floor/origin/cache/data-integrity checks. |
| `audit-runs/audit6.md` "Re-verified, not re-derived" + "Carried forward" | The security posture re-verification; the dependency bump; A-5.10; the owner actions. |
| `audit-runs/audit7.md` §3 "Considered and NOT taken" + §4 "Checked, no finding" | A-7.7 print (open, separate change); scalar coercion; `[object Object]` param; `uploads/.htaccess` deny-by-default; A-5.10; `brandtext`'s 11; the A-7.3 opt-out scope; console-clean crawl; catalog size; ReDoS timing; no user-built regex; no inline scripts; manifest vs `dist/`; secrets; health banner coverage; `sitemap.php` shapes. |
| `audit-runs/audit8.md` §2 (A-8.1–A-8.9), §3a, §4, §5 | A-8.5 ISO revisions (registrar-gated, expected red); A-8.7/A-8.8 fixed in the repo 2026-08-28 and merged 2026-09-14 (PR #53) — live copy is an owner action; placeholder/stale-marker sweep; origin consistency; the A-7.4 marker's deny rule; cookies; derived copyright year. |
| `UX_AUDIT_PREPROD_2026-08-12.md` F1–F17 | All fixed in PR #42 (2026-08-12) and `WHATS_LEFT.md` §1c. Re-verify by measurement in P6; do not re-report the finding text. |
| `_harness/AUDIT10-REPORT.md`, `_harness/AUDIT11-REPORT.md`, `plans/PLAN-10-audit10-remediation.md` §12 | The 61 AUDIT-10 findings: 13 fixed in PLAN-10 and verified; 39 severity-C clusters and 9 D batches deliberately open; A10-056 refuted. |
| `WHATS_LEFT.md` §2 | Every open item there is already recorded; cite the ID, do not re-describe. `4.27 residual reorder cost`, `A-7.7`, `A-5.10`, the brand/contrast items, and the "still outstanding on the live copy" `photoUrl` note are the ones a fresh reader re-finds. |
| `WHATS_LEFT.md` §3 | Declined/deferred: the extraction (deleted, closed); the git-history rewrite (awaiting Keagan); `products-all.json` upload (never from the repo); paid tooling; the `.docx` retirement; the Industries SKU warn-not-block decision; the three brand-colour decisions. |
| `CLAUDE.md` invariants 1–16 | Each names its incident. A finding that proposes "simplifying" one is not a finding. |

---

## 12. Environment artifacts — additions to GUARDRAILS §7.1 for this round

- **Fresh clone has no `node_modules/`**; `npm ci` first. A suite that fails with `Cannot find module 'playwright'` is an environment state, not a finding.
- **The container's PHP is 8.4.19.** A deprecation it prints is a real P2 finding; a syntax it *accepts* that 7.4 would not is the inverse hazard — `php -l` here proves nothing about 7.4.
- **The container's outbound network goes through a proxy.** A failed `curl` to the live host is `[UNVERIFIED — network]`, not "the site is down".
- **Windows executors:** everything in `_harness/README.md` "On Windows" and GUARDRAILS §4.1a; `plan3-autoreply` is `[UNVERIFIED]` there; `.gitattributes` now pins `*.sh` to LF, so the `set: -` failure it describes should not recur — if it does, the checkout predates the merge.

---

## 13. Templates

### 13.1 Finding record — one per finding, in the pass file and in `audit9.md` §2

```
### A-9.<n> — <SEVERITY> — <one-sentence statement of the defect, in the words a buyer or Rick would use>

class:        code | harness | doc | data-live | server | decision
pass:         P<n>            ledger: E<nnn>[, E<nnn>]
surface:      <route / admin page / file / document>
where:        <file:line | JSON path | URL>   (measured on <commit>, <date>)
not in §11:   checked <entries> — <why this is different, one line>
reproduce:    <numbered steps or the exact command; a second agent must be able to run it cold>
observed:     <what happened, verbatim output or artifact path>
expected:     <what the site needs, and the rule or invariant that says so>
consequence:  <who is harmed and how — this is what sets the severity>
evidence:     <_harness/out/... paths; suite name + score>
verified-by:  <V's name/role, date, "reproduced" | "not reproduced: <measurement>">
outcome:      fixed <commit> | owner action: <exact admin/server step> | escalated: <five-field form> | deferred: <reason, WHATS_LEFT §2 ref>
fix-proof:    <check failing before> → <diff summary> → <check passing after> → <regression batch: n/n>
```

### 13.2 `audit-runs/audit9.md` skeleton

```
# Audit 9 — the full go-live audit
**Date / Base / Brief / Executors**
| Severity | Count |  ← generated
**Verdict:** GO | GO-WITH-OWNER-ACTIONS | NO-GO  ← generated, with the list

## 0. The lenses — and which of them are new
## 1. The inherited state          ← Phase 0 verbatim, before and after tables
## 2. Findings                     ← §13.1 records, severity order
## 3. Shipped                      ← file → change → evidence; new/retired instruments
## 4. Checked, no finding · Raised, not reproduced · Refuted with measurement
## 5. What is left                 ← owner actions (with the GO-LIVE.md A line each), blocked ledger rows, escalations, [UNVERIFIED]/[UNSOURCED] list
## 6. Self-corrections this round
## 7. Method                       ← the ledger summary, the pass → agent map, the sweep denominator and how it was derived
```

---

## Appendix A — the sweep, derived

```sh
# assertive suites (heuristic — reconcile in P11 before trusting the count)
grep -lE "process\.exit\(|process\.exitCode" _harness/*.js | xargs grep -lE "\bok\(|\bcheck\(|\bassert" | sed 's#_harness/##; s#\.js$##' | sort
# then
node _harness/run.js $(…that list…)
node _harness/invariants.js && node _harness/invariants-selftest.js
node _harness/copydrift-selftest.js && node _harness/contactflow-selftest.js && node _harness/backdrop-selftest.js && node _harness/plan2-formlast-selftest.js
php _harness/lint.php
```

Record each line with score **and denominator**. `plan2-trunc` needs `:8124`+`:8125`; `plan5-throttle` needs `:8130–8139`; `plan5-keys` builds its own dev-React bundle; `plan10-auditlog` and `plan6-families` mutate and must restore.

## Appendix B — controlled-vocabulary seed (P5 step 2 extends it with what it finds)

| Concept | Variants seen or likely | Rule |
|---|---|---|
| data sheet | data sheet · datasheet · data-sheet · spec sheet · PDF | one public form; "datasheet" appears in the route name `/datasheets` — the prose form is measured, not assumed |
| part identifier | part number · part # · SKU · item · product code | buyer-facing prose vs catalog labels may legitimately differ; one form per surface |
| quote | Request a Quote · Request Quote · RFQ · Get a Quote · quote request | button labels one form; "RFQ" only where it is introduced |
| company | Insulation Products Corporation · IPC · Insulation Products Corp. | full name first on a page, then IPC; legal pages full name |
| certification | ISO 9001 (bare, per A-8.5) · UL-recognized · CSA-listed · MIL-SPEC · RoHS · FDA-compliant · AMS | one spelling and case each; hyphenation consistent |
| contact channel | email · e-mail · E-mail | one form |
| phone formatting | 630.771.0700 (site-info) · (630) 771-0700 · 630-771-0700 | the site-info form everywhere it is not dialled |
| hours | Mon–Fri, 8am–5pm CT (site-info) | en dash, no spaces, one timezone abbreviation |
| admin nav | Products · + Add Product · Business Details · Page Content · Inquiries · Backups · Audit Log · Password · Help · Sign Out (`nav.php`, 2026-09-14) | every doc and every help sentence uses these exact labels |
| ranges and dashes | `-` `–` `—` | hyphen in compounds, en dash in ranges, em dash for asides — or the majority rule, measured |
| lead time / shipping | same day · next business day · one week or less | must agree with P4's register and with each other on one page (F13) |

## Appendix C — logic edge-case matrix (P7). `Evidence` names the existing suite or `new`.

| # | Surface | Input / state | Expected | Evidence |
|---|---|---|---|---|
| C1 | routing shim | `/Products` (uppercase), `/products/`, `/products/x`, `//products` | 404 page or normalised route, never blank, `noindex` on 404 | `plan9-notfound`, new |
| C2 | routing shim | `?productId=` unknown / alias / lowercase / trailing space | "part not found" banner (T2.8), page still renders | `plan8-crumbs`, new |
| C3 | routing shim | `?family=`/`?approval=` unknown | empty state with a way out | `plan8-catalog`, new |
| C4 | routing shim | `{replace:true}` cleanup on `?family=` and `?sent=1` | Back is not trapped; `?sent=1` reload shows no false success (F5) | T2.3 evidence, new |
| C5 | `useProducts` | 404 / HTML-200 / truncated / wrong type / 12 s stall on each of 3 files | invariant 8 behaviour; `jsonOrThrow()` rejects HTML-200 | A-7.9 (`audit7`), new |
| C6 | `useProducts` | TTL expiry + tab refocus | catalog refreshes without reload | 4.25 §4b, new |
| C7 | `mergeSiteInfo` | `""` for each scalar; `""` for each `SITE_CLEARABLE` key; missing key; wrong type | blank-drop vs clear per allow-list; default for missing; default for wrong type | `invariants`, NB4 §4b, new |
| C8 | `mergeContent` | `[]` for each section; missing section; string where array; `copy` key present in PHP not JS | `[]` deletes (invariant 3); missing → default; wrong type → default; NB-copy | `invariants`, `copydrift`, new |
| C9 | `ErrorBoundary` | throw on one page, navigate to another | second page renders (invariant 7) | T2.2 evidence, new |
| C10 | catalog | 0 products; 1 product; duplicate SKU; product with no spec rows; missing `pdfUrl`; non-string `sku` | rendered states per §4.29/A-7.8; sitemap still 200 | `plan5-spectable`, `audit7`, `plan5c-sitemap` |
| C11 | contact RFQ | each required field empty, client and server | same field set enforced both sides (A-04) | `plan3-contact`, `contactflow` |
| C12 | contact both | 201-char short field; 5,001-char text | truncated with the notice in the value | B3 evidence, `audit7-lead` |
| C13 | contact both | CRLF/unicode/emoji/RTL in every field | `hdr()` strips header-bound; body byte-faithful; JSONL valid; `inquiries.php` renders through `h()` | `audit5-blockers`, new |
| C14 | contact both | honeypot filled; referer absent / foreign / `android-app://` | rejected+logged / accepted / rejected / accepted; each consumes a rate slot | `audit5-*`, `audit7-lead` |
| C15 | contact both | 6 submits in 10 min from one IP; auto-reply to `a+1@`, `a.b@` | 6th refused with the phone number; one auto-reply per normalised mailbox | `plan5-throttle` (login), `plan3-autoreply` |
| C16 | contact both | `mail()` returns false | user sees the phone-number message; JSONL row written with `sent:false`; A-7.4 marker | `audit7-lead` |
| C17 | contact both | JS disabled | no-JS submission produces a human page, not `{"ok":true}` (A-7.2) | `audit7-lead` |
| C18 | contact both | double-click submit; Back then resubmit | one email, one row; or a clear duplicate notice | new |
| C19 | admin `edit/settings/content` | two tabs, save both | second sees the stale-signature message with its typed values kept (B1) | `plan4-admin`, new |
| C20 | admin `content.php` | `max_input_vars` truncation | save refused, nothing blanked (T3.7/B1) | `plan2-trunc` |
| C21 | admin saves | unchanged content | no write, no backup, "No changes" (invariant 16) | `nodupbackups` |
| C22 | admin backups | 90 existing; same-second saves; restore of a malformed backup | max-used+1 (invariant 5); read-side gate (A-7.8) | `audit7`, new |
| C23 | admin `edit.php` | rename SKU whose PDF/photo is shared / unique | shared kept, unique renamed/removed, audit-logged | `plan2-delete`, new |
| C24 | admin uploads | same file twice; PDF in use by another SKU; oversize; wrong type | refused with the per-code message; `pdf_in_use()` | T3.5/T3.6 evidence, `audit5-medium` |
| C25 | admin `password.php` | wrong current; new = old; 6 attempts | throttle shared with login; hash written via callback (invariant 1) | `plan5b-pwthrottle`, `invariants` |
| C26 | admin `auth.php` | `ALLOW-PASSWORD-RESET` at 3599 s / 3601 s; no `config.local.php` | window open / closed; "no password set" state, not a fatal (A-5.7) | `audit5-high`, new |
| C27 | admin `require_auth()` | expired session on POST | page rendered with the data, not a 302 (invariant 12) | `invariants`, `plan4-admin` |
| C28 | admin `ping.php` | unauthenticated GET | no session file minted (A-7.3) | `audit7-lead` |
| C29 | admin health banner | each of `admin/`, `data/`, `pdfs/`, `uploads/images/`, tmp unwritable; reset window open; inquiry-log failed | banner names it; nothing else fails silently | `audit5-high`, `audit7-lead` |
| C30 | `sitemap.php` | both catalog shapes; non-scalar id; corrupt JSON | 52 / 52 / 10 routes, always 200 XML | `plan5b-sitemap`, `plan5c-sitemap`, `audit7` |
| C31 | time | clock at year boundary; `effectiveDate` fixed | `© 1974–<year>` derived; effective date static (4.10) | new |
| C32 | encoding | `–`, `°`, `″`, `µ`, emoji round-trip through each admin form | byte-faithful on disk and on the page | new |
| C33 | line endings | `git ls-files --eol '*.sh'` | `i/lf w/lf` (PR #47) | new |

---

**When this plan is done:** flip the status line, add the date and the `audit9.md` link, and touch nothing else in it.
