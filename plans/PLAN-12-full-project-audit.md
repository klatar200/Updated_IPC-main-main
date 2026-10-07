# PLAN-12 — AUDIT-12: the whole project, every element, read-only

**Written 2026-10-07 against `main` + branch `claude/zen-gates-p801fz` (8e90dcc).**
For a NEW Claude Code session (Opus 5.5) that has never seen this repo. It is
an **audit**: it finds, proves and reports. It fixes nothing. The output is
one report, one filled ledger and one PR. Fixing is a later plan, built from
§12.7's proposed fix plan after Keagan reads it.

Notation: **C** = the coordinating session (you). **Finder / verifier / critic**
= Workflow subagents. **Row** = one ledger line. **Lens** = L1–L15 (§6).
Volatile facts carry `AS-OF:` dates. Re-measure anything load-bearing that is
more than 90 days old.

---

## 0. Rules that bind every agent (finders read this section; it is short on purpose)

1. **Read-only on the repository.** No tracked file changes until §12 (C only).
   Everything an agent writes goes under `_harness/out/audit12/` (gitignored).
   `git status --porcelain` must be identical before and after every agent.
2. **Measured, not inferred.** Every claim carries a command and its output,
   or an artifact path. If you did not run it, label it `[UNVERIFIED — why]`.
   "Looks correct" is not evidence. A screenshot counts only after you open it
   with Read. Numbers are computed by a script, never typed (§12.2).
3. **Every row gets exactly one result** (`done | finding | blocked | n-a`)
   with evidence. Breadth first: give every row of your batch its check
   before going deep on any one. Finding something big is not a reason to
   stop.
4. **Stay in your lens.** Anything outside it is one line in `outOfBrief`
   (`file:line` + a sentence). Then stop thinking about it. C routes it.
5. **No finding without a cold reproduction and passing citations.** The
   `reproduce` field must run on a fresh mirror by a stranger.
   `node _harness/audit12-cite.js <your findings file>` must exit 0.
6. **Check the do-not-re-report sources (§3.3) before writing a finding.**
   Say what you grepped in `notInPrior`. Re-raising a settled item without new
   dated evidence is a defect in the audit, not a finding.
7. **Severity is consequence (§9.2).** It is never set by instance count,
   wording, effort or how interesting the item is.
8. **Zero findings is a valid result.** Never invent one to have something to
   return. Never soften a real one to a Low.
9. **Environment artifacts are not site defects (§11).** Re-measure under the
   listed control before raising anything they could explain.
10. **Safety (§4) overrides everything above.**

---

## 1. Purpose and definition of done

**Purpose.** Before launch, establish with evidence whether every element of
this project does what it should. "Every element" is not a phrase: it is the
§7 ledger, derived by a script from the repository, **2,247 rows** at 8e90dcc
(AS-OF 2026-10-07; regenerate at Phase 1 and record the new count).

The ledger covers:
- every tracked file
- every top-level declaration in `App.jsx` and the four PHP libraries
- every route × viewport × state
- every product
- every admin page, form, action and input
- every public endpoint input
- every `.htaccess` directive
- every data field
- every owner-editable field
- every documentation heading and Help section
- the 19 invariants
- the 121 sweep suites
- every open and settled record

**Done means all of the following, each proven by a command:**

| # | Condition | Proven by |
|---|---|---|
| D1 | Every ledger row (including GAP rows added during the audit) is `done`, `finding`, `blocked` or `n-a`, with evidence | `node _harness/audit12-ledger.js --final` exits 0 |
| D2 | Every finding's citations hold | `node _harness/audit12-cite.js` exits 0 |
| D3 | Every finding was reproduced and attacked by agents other than its author (§10), and none is unverified | `--tally` prints `unverified 0` |
| D4 | Every Blocker and High was re-reproduced on a fresh clone and a fresh build (§5.6) | `audit12.md` §3, `verified-by` lines |
| D5 | The report numbers equal `--tally` and `--coverage` output | §12.2 diff |
| D6 | The Phase 0 baseline is recorded, and any red in it is explained | `audit12.md` §1 |
| D7 | Every cap that was hit, every `blocked` row and every `[UNVERIFIED]` label is listed | `audit12.md` §6 |
| D8 | One PR, ready for review, unmerged | PR link |

Running out of budget or patience produces a **blocked list**, never a shorter
audit reported as complete.

---

## 2. Read order — C only

1. This file, whole.
2. `CLAUDE.md` (auto-loaded), then `WHATS_LEFT.md` (open, settled, done). It is short.
3. `plans/GUARDRAILS.md` §0–§2, §4.1–§4.4 and §7. Grep the rest when needed.
4. `_harness/README.md`: the top section and "Things that have bitten before".
   Grep the suite rows when needed.
5. `plans/PLAN-11-audit9-go-live.md` §3.4 (mirrors and ports), §7.1, §10 and
   §13.1. This plan's §9 and §4 adapt them. Read the originals once.

Do **not** read `audit-runs/WHATS_LEFT-history.md`, prior `audit<n>.md` files
or the AUDIT-10/11 reports to "get context". Grep them by ID or phrase when a
row needs it (§3.3).

---

## 3. Inputs

### 3.1 Inventory, AS-OF 2026-10-07 (re-measure in Phase 0)

| Area | Fact |
|---|---|
| Tracked files | 502. By folder: `_harness` 225, `dist` 73, `public` 70, `pdfs` 45, `admin` 32, `audit-runs` 25, root 17, `plans` 4, `data` 4, `uploads` 3, `src` 3, `.claude` 1 |
| React | `src/App.jsx`, 14,096 lines, 175 top-level declarations; `src/main.jsx`; `src/index.css` |
| PHP, public | `public/index.php` (front controller, A-5.10), `public/contact.php`, `public/sitemap.php` |
| PHP, admin | 19 pages (`add, audit-log, auth, backups, config, content, delete, edit, help, index, inquiries, marketing-pdfs, nav, password, ping, settings, site-images, upload-image, upload-pdf`) |
| Admin JS | 10 files |
| `.htaccess` | `public`, `admin`, `data`, `pdfs`, `uploads` (`dist/.htaccess` is the built copy of `public/`) |
| Routes | `/`, `/products`, `/dashboard`, `/datasheets`, `/industries`, `/services`, `/about`, `/faq`, `/contact`, `/privacy` |
| Data | 3 JSON files, 42 products; 44 PDFs; 61 images |
| Sweep | `_harness/sweep-list.txt`, 121 suites. Last full run 61/61 + 58/59; the only red is `plan8-polish` C49 (font metrics, §11) |
| Real-Apache suites | `lowsE-apache`, `dep3-scriptblock`, `prerender-apache` |
| Toolchain | PHP 8.4.26 CLI (mbstring present here, **not guaranteed in production**); Node 22.22.2; npm 10.9.7; Chromium under `/opt/pw-browsers`; Apache 2.4.58 with `libphp8.4.so` and `mod_proxy_fcgi.so`; `jq`, `xmllint`, `shuf`, Liberation Sans |
| Missing | `pdftotext`, `php-cgi`, `php-fpm`, ImageMagick, axe-core |
| Box | `nproc` 4, which makes Workflow concurrency `min(16, 4−2)` = **2**; 15 GB RAM |

Ways round the missing tools:
- **PDFs:** read them with the Read tool (`pages:`).
- **FPM / CGI:** no handler binary, so it is `[UNVERIFIED]` (already in WHATS_LEFT "cannot be verified").
- **axe-core:** `npm i --prefix _harness/out/audit12/tools axe-core`. If the network refuses, use manual checks and label the row.
- **Image dimensions:** use Playwright `naturalWidth`.

### 3.2 State the audit starts from

- Engineering is complete. Open items wait on Rick, deploy day or a decision.
  The full list is `WHATS_LEFT.md`.
- **Nothing is deployed.** This is a pre-launch audit.
- The verdict question is: *is this safe and right to launch, and what stands
  in the way?*

### 3.3 Do-not-re-report: grep these before writing any finding

| Source | Settles |
|---|---|
| `WHATS_LEFT.md` (all four "Open" tables and "Settled") | Every open item and every settled decision. Cite the row. |
| `plans/GUARDRAILS.md` §7, §7.1, §7.2, §7.3 | Closed items, environment artifacts, refuted-with-measurement, settled decisions |
| `CLAUDE.md` invariants 1–19 | Each names its incident. "Simplifying" one is never a finding; breaking one is. |
| `audit-runs/WHATS_LEFT-history.md` §1at | AUDIT-10 C/D: 31 fixed; 13 **declined with reasons** (A10-010, 015, 019, 025, 026, 036, 044, 047, 048, 052, 053, 054, 062) |
| `audit-runs/audit5.md` … `audit9.md`, `audit-2026-09-27.md` | Each one's "refuted", "checked, no finding" and "re-verified" sections |
| `_harness/AUDIT10-REPORT.md`, `_harness/AUDIT11-REPORT.md` | Earlier AUDIT-10/11 IDs |

**The rule:** grep by ID or by a distinctive phrase, then read ±20 lines
around the hit. A prior item **regressed** (it was fixed and is broken again)
is a finding, and a High at least if the original was. Say so, with the
original ID.

### 3.4 Expected reds in Phase 0

These are the only ones:
- `plan8-polish` 16/17 (C49, Linux font metrics).
- `plan3-autoreply`, but only on a Windows executor.

Any other red is either a Phase 0 bail (§5.1 step 7) or the audit's first
finding.

---

## 4. Safety rails — non-negotiable

| # | Rail | Why (the incident) |
|---|---|---|
| S1 | No edits to tracked files until §12, and then only the files §12 names. No `data/*.json`, `pdfs/`, `uploads/` edits, ever. | `data/` is live customer state after deploy |
| S2 | `_harness/site/` and ports **8123–8139** belong to the sweep and to step M. Agents use private copies on **10000+** (§5.3). | 26+ suites write the mirror's `data/`; parallel runs contaminated each other (PLAN-11 §3.2) |
| S3 | Stop servers by PID, selected with `ps -eo pid,comm,args` where `comm == php` and the port matches. **Never `pkill -f` / `pgrep -f`**: they match the agent's own shell. | Killed the session's own shell |
| S4 | `admin/config.local.php` and every mirror copy of it hold the test credential `audit-pass-123`. Never commit, upload or paste a **hash**. Run `git grep -nE '\$2y\$'` and `git status --porcelain \| grep config.local` before the commit. | Hashes were committed and printed in docs twice (invariant 2) |
| S5 | **No requests to the live host**, with one exception: GO-LIVE STEP 0's read-only GETs, run once by C if the network allows, and recorded. No form POST, no admin sign-in, no crawl. | The old site is live and has a real owner |
| S6 | Send no project data to external services: no online validators, pasted JSON or spell-check APIs. Local tools and temporary `npm i --prefix _harness/out/audit12/tools` only. No new dependency in `package.json`. | $0 budget; the repo is public, but the data is the owner's |
| S7 | No merges, no force-push, no history rewrite. One PR from the designated branch. | GUARDRAILS §2 |
| S8 | Delete every private mirror copy when its agent finishes. Watch `df` (29 GB free AS-OF 2026-10-07; a mirror is ~21 MB). | Disk is a fixed allowance |
| S9 | A live secret, or customer personal data, found anywhere in git (files or history) means: **stop the wave and tell Keagan at once** in one line. Do not paste the secret into any file. The known old hash is settled (WHATS_LEFT "Settled"). Only a *new* one stops the audit. | Public repo |
| S10 | After any container or worker restart, re-check servers before believing any red. Restart them, then re-run. | Exit 137 killed the PHP servers twice (2026-10-06) |

---

## 5. Execution model

### 5.1 Phase 0 — bootstrap and baseline (C, serial)

1. `git status --porcelain` must be empty. Record `git rev-parse --short HEAD`
   as **AUDIT_HEAD**. Every measurement is "at AUDIT_HEAD".
2. `npm ci && npm run build`. Then `git status --porcelain dist/` must be
   empty, i.e. the build reproduces `dist/` (L1 depends on this).
3. Bootstrap the harness:
   - `sh _harness/sync.sh`
   - Write `_harness/site/admin/config.local.php` with the bcrypt hash of
     `audit-pass-123`: run `php _harness/setpw.php`. Re-run it after every
     sync.
   - Start the servers from `_harness/README.md`: :8123 / :8124 / :8125 and
     the :8130–8139 fleet.
   - Use `curl --noproxy '*'`.
4. Run the fast gates: `php _harness/lint.php`,
   `node _harness/audit12-workflow-dryrun.js` (must be 23/23) and
   `node _harness/audit12-ledger.js --check`.
5. Start the sweep **in the background**, capturing its output:
   `node _harness/run.js $(grep -v '^#' _harness/sweep-list.txt) > _harness/out/audit12/sweep-before.txt 2>&1`.
6. While the sweep runs, reconcile `_harness/`. Classify every file as one of:
   - **suite in `sweep-list.txt`**
   - **helper** (required by a suite)
   - **instrument** (run by hand; `_harness/README.md` names it)
   - **orphan**

   A suite-shaped file that is not in the list is the `isowaterfall` lesson
   (Appendix B). It is recorded, not silently added.
7. When the sweep ends:
   - Every red must be one of the §3.4 expected reds.
   - Any other red: check the denominator, servers and credential first
     (S10, GUARDRAILS §4.2). Re-run that suite alone once.
   - Still red means it is finding #1 (L13 confirms it).
8. Run the three real-Apache suites. Record them, skipped or not.
9. GO-LIVE STEP 0 (S5), if the network allows. Otherwise record `[UNVERIFIED — network]`.

Phase 0 output is `audit12.md` §1: AUDIT_HEAD, the toolchain, the sweep
table, the Apache results and the `_harness` classification.

### 5.2 Phase 1 — the ledger (C)

```sh
node _harness/audit12-ledger.js --check      # writes _harness/out/audit12/ledger.{jsonl,md}; must exit 0
node _harness/audit12-ledger.js --batches    # 138 batches at 8e90dcc
```

- **Generate once, at AUDIT_HEAD.** IDs are ordinals: regenerating renumbers
  them and orphans every result.
- **Rows found missing during the audit** are appended with
  `--add <lens> "<target>" "<where>" "<check>"` as `GAP-nnnn` rows. Then
  `--args` picks them up for the next wave or the critic.
- **The ledger is a floor, not a ceiling.** The gap hunts (§5.5) exist for
  what no generator can list.

### 5.3 Mirrors and ports

| Port | Owner |
|---|---|
| 8123 / 8124 / 8125 / 8130–8139 | Phase 0 sweep and step M only |
| 10000 + batch index | finders (the prompt gives a first port; take the first free one at or above it) |
| 10400–10760 | verifiers (derived from the finding ID) |
| 10800–10920 | gap hunters |

Every agent port is above 9481, the highest port any suite binds (suites use 8123–9481, e.g. `sec4-sessionforge` on :8706). So an agent can never take a port a suite needs, even if a wave and a suite run overlap by mistake.

Each agent that needs a running site does this:

```sh
cp -r _harness/site _harness/out/audit12/m/<label>
php -S 127.0.0.1:<port> -t _harness/out/audit12/m/<label> -c _harness/php-mail.ini _harness/router.php &
```

- Stop it by PID (S3) and delete the copy at the end.
- The router answers for the docroot it was given (A-9.P3-1).
- `php -S` serves one request at a time. A timeout under load is contention:
  re-run on an idle port before believing it.
- **The existing suites hardcode `_harness/site` and `:8123`.** Agents never
  run them. They cite the Phase 0 sweep line.
- Only step M (§5.4) re-runs a suite, and it runs serially.

For E_ALL runs (L2), use a private ini: a copy of `php-mail.ini` plus
`error_reporting=E_ALL`, `display_errors=On`, `log_errors=On` and
`error_log=<agent dir>/php-errors.log`. Keep it under `_harness/out/audit12/`
and never commit it.

### 5.4 Waves, and step M

Run the Workflow once per wave. **Read each wave's result before starting the
next** (C stays in the loop). The order is deliberate: the harness and build
come first, because every later lens cites suites and the build.

| Wave | Lenses | Batches / rows at 8e90dcc | Why here |
|---|---|---|---|
| **W1** | L1, L2, L13, L14 | 38 / 656 | Is the evidence base sound: build, host, harness, records? |
| **M** | invariants + suspect suites | 19 + however many L13 flags | Serial mutation, with exclusive use of `:8123` |
| **W2** | L3, L4, L5, L15 | 45 / 552 | The code: security, data, parity, logic |
| **W3** | L6, L7, L10, L11 | 20 / 388 | The rendered site |
| **W4** | L8, L9, L12 | 35 / 632 | Content, owner, documentation |
| **W5** | all | critic plus cross-lens hunt | The seams between lenses; the final re-verify (§5.6) |

**Launching a wave (C):**

```sh
node _harness/audit12-ledger.js --args W2 L3,L4,L5,L15   # → _harness/out/audit12/args-W2.json
```

Then Read that file and call the Workflow tool with
`scriptPath: "_harness/audit12-workflow.js"` and `args: <the JSON object, not a string>`.

**Resume** after a crash with `resumeFromRunId`. Same args means byte-identical
prompts and cache hits; the dry-run proves this.

**Between waves (C):**
1. `node _harness/audit12-ledger.js --coverage`
2. `node _harness/audit12-cite.js`
3. `node _harness/audit12-ledger.js --tally`
4. Read the return value's `blocked`, `capped`, `ledgerGaps` and `outOfBrief`:
   - Add every ledger gap with `--add`.
   - Route every out-of-brief line to the lens that owns it, as a GAP row.
   - Log every cap in `audit12.md` §6.
5. Re-check servers (S10).

**Step M — mutation, serial, owned by C or one Agent.** Run it after W1, with
the Phase 0 sweep finished.

1. Make a worktree: `git worktree add /tmp/audit12-mut AUDIT_HEAD`. In it run
   `npm ci`, `npm run build`, `sh _harness/sync.sh` and `php _harness/setpw.php`.
2. Stop the main repo's :8123 servers (by PID) and start them from the
   worktree's `_harness/site`.
3. For each of the 19 INVARIANT rows:
   - In the **worktree**, break the invariant the smallest way that matches
     its incident (e.g. invariant 1: `preg_replace_callback` → `preg_replace`).
   - Rebuild and sync if the change is in `src/`. Sync if it is in
     `admin/` or `public/`.
   - Run the named suite. It must go red.
   - `git checkout -- .` in the worktree, re-sync, and confirm the suite is
     green again.
   - Write the row result, quoting the red line.
4. Do the same for every suite L13 flagged as possibly vacuous.
5. **A suite that stays green under its own mutation is a finding** (class
   `harness`, High if it guards an invariant).
6. Remove the worktree (`git worktree remove`) and restart the main
   repo's :8123 servers.

### 5.5 Inside a wave (what `_harness/audit12-workflow.js` does)

1. **Find.** One finder per batch, in a `pipeline()`. Each finder:
   - reads §0, §3.3, §4, §9 and its §6 lens section;
   - fetches its rows;
   - checks each row;
   - writes `rows/<batch>.jsonl` and `findings/<batch>.json`;
   - runs the citation gate.

   Unanswered rows are recorded as blocked, and the critic re-dispatches them.
2. **Verify** (§10). Each finding, deduplicated by where + title, starts as
   soon as its finder returns.
3. **Gap hunt, loop-until-dry.** For each lens, concurrently:
   - Each round uses a **different method** (`METHODS` in the script),
     starting somewhere other than the ledger.
   - The hunter is told every title already raised for the lens, in this wave
     and earlier ones.
   - The hunt stops after **2 consecutive rounds with nothing new**.
   - There is a **hard cap of 5 rounds**. Hitting it is logged in `capped`,
     never silent.
4. **Critic** (§8). It runs coverage and spot-audits 8 "done" rows per lens
   against their evidence. It re-dispatches what is pending or thin through
   find → verify. Up to 3 rounds; a cap that is hit is logged.

**Scale:**
- Every agent inherits the session model (Opus 5.5). Set no per-agent
  `model` or `effort`.
- On a 4-core box only 2 agents run at once. W1–W4 together are about 138
  finders, plus ~2–4 verifiers per finding, plus gap hunts and critics.
  Wall-clock is long, which Keagan explicitly accepted.
- `[NOT-MEASURED]`: there is no time estimate. Run one wave, measure it and
  report the figure before starting W2.
- The per-workflow cap is 1,000 agents. One wave is well under it. If a wave
  approaches it, split the args by lens and run them as two workflows.

### 5.6 W5 — the seams, the final re-verify, then the report

1. **Cross-lens gap hunt.** One Workflow with `lenses` = all and **no**
   batches. The gap hunt and critic run alone. Its hunters get these
   cross-lens methods, passed as `args.methods` (one list per lens; the
   script puts them ahead of its own, so no script edit is needed):
   - owner edit → served head → share card;
   - deploy-day order of uploads → the site in between;
   - a buyer's whole journey on a phone with a bad connection;
   - the first day after launch, as Rick.
2. **Final re-verify.**
   - `git clone` the repo into `/tmp/audit12-final` at AUDIT_HEAD.
   - `npm ci`, build, then sync to a mirror there (its own `_harness/site`) and
     serve it on a free port at or above 11000.
   - Re-run the `reproduce` of **every Blocker and High** on that clone.
   - Each that no longer reproduces moves to "raised, not reproduced", with
     both measurements.
3. `node _harness/audit12-ledger.js --final`, `node _harness/audit12-cite.js`
   and `--tally` must all pass. Then write §12.

---

## 6. The lenses

Every lens's rows are in the ledger with a `check` column. These are each
lens's charter, method, instruments and exit criteria. **The exit criterion
for every lens includes: every row answered, citations pass, and gap hunt dry
(or capped and logged).**

### L1 — Build, dependencies, shipped tree

**Charter.** What ships is exactly what the source builds, nothing extra and
nothing missing.

**Method.**
- Fresh clone, then `npm ci`, then `npm run build`, then `diff -r dist/` against the committed copy.
- Every `public/*` file appears in `dist/`, and nothing in `dist/` lacks a source.
- `package.json`: scripts, engines, and pinned versus range versions.
- `npm audit --omit=dev`. If the network refuses: `[UNVERIFIED — network]`, plus the `package-lock.json` versions listed.
- `.gitignore` covers every runtime-written path in CLAUDE.md's "Full I/O surface". Walk the list path by path.
- `.gitattributes`.
- `vite.config.mjs`: dev middleware containment, `base: '/'`.
- `.claude/launch.json`.
- README "The deploy manifest" versus the actual `dist/` tree, row by row.
- Secret scan:
  - `git grep -nE '\$2y\$|BEGIN (RSA|OPENSSH)|api[_-]?key|password\s*='`
  - `git log -p -S '$2y$' --oneline | head` (the old hash is settled; a new one is S9).

**Instruments.** `diff -r`, `jq`, `npm ls`.

**Exit.** `dist/` is byte-identical, or the difference is a finding; the
manifest is reconciled in both directions.

### L2 — PHP 7.4, the host, Apache

**Charter.** The site runs on the production host's floor (PHP ≥ 7.4,
mod_rewrite, mod_access_compat, possibly no mbstring), and every `.htaccess`
directive does what its comment says.

**Method.**
1. **Static 7.4 scan** of every non-harness PHP file. Grep for 8.x syntax and
   functions:
   - `match(`, `?->`, named arguments (`\w+:\s` inside calls)
   - `str_contains`, `str_starts_with`, `str_ends_with`, `array_is_list`
   - `enum`, `readonly`, union types, constructor promotion, `never`, `mixed`
   - first-class callables `(...)`
   - `mb_*` and `iconv` without `function_exists`

   Every hit is a row result. `php -l` here proves nothing about 7.4 (it is
   8.4).
2. **E_ALL run.** A private mirror with the E_ALL ini. Drive every admin GET
   and POST and both contact forms (reuse L4's flows if already run; cite
   them). The error log must be empty. Every notice or deprecation is a
   finding.
3. **Real Apache, one probe per directive.** Copy the conf builder from
   `_harness/prerender-apache.js` (mod_php) into your own script under
   `_harness/out/audit12/`, and serve a fresh docroot. For each HTACCESS row,
   send a request designed to slip past that directive:
   - dotfiles, `.git`, `.jsonl`, backups, `*.php.jpg`, trailing-dot names,
     encoded traversal;
   - `/data/products-all.json` headers, `/admin/*.json`, `/uploads/x.php`;
   - `/sitemap.xml`, deep routes, `/index.html` versus `/`;
   - cache headers, HSTS, `X-Robots-Tag`.

   Record the status and the relevant headers.
4. **proxy_fcgi.** There is no php-fpm or php-cgi binary, so every
   handler-dependent row is `[UNVERIFIED — no FPM/CGI binary]`. That is
   already on WHATS_LEFT; do not re-raise it.
5. **`public/.user.ini`**: each limit versus what the code assumes
   (upload size, `max_input_vars` for invariant 6).

**Exit.** Every HTACCESS row has a measured request/response, or a stated
reason it cannot be measured.

### L3 — Security

**Charter.** Re-verify the posture, do not re-derive it (GUARDRAILS §7). Then
attack what changed since audit 9: `index.php`, Site Images, Marketing PDFs,
DI-1 renames, the session store.

**Method, per row kind.**
- **Admin GET signed out / expired:** no content in the body, correct
  redirect or render (invariant 12).
- **Every form:**
  - CSRF token absent, wrong, or from another session → refused, nothing
    written (diff `data/` before and after);
  - stale `orig_sig` → refused with a true message;
  - oversized and array-valued inputs (`x[]=`) → no notice, no write.
- **Uploads:**
  - double extension, `*.php.jpg`, SVG with `<script>`;
  - polyglot JPEG/PHP, zero-byte, oversize, MIME mismatch;
  - name collision with another product's file (SEC-1 regression check).
- **Paths:** every filename/SKU parameter with `../`, encoded `%2e%2e`, NUL,
  absolute paths and symlinks.
- **Session:** cookie flags; fixation (log in with an attacker-chosen ID);
  idle 8 h and absolute 12 h expiry (SEC-3); the login throttle; the
  `ALLOW-PASSWORD-RESET` flow (create, use, deleted after, window close).
- **`public/index.php`:**
  - Put `</title><script>alert(1)</script>`, `"><img onerror>`,
    `]]>`, `</script>` and U+2028 into **every** site-info and content field
    that reaches the head, the body prerender, the noscript block or JSON-LD.
  - The served HTML must stay inert.
  - It must fail closed on damaged JSON.
- **`contact.php`:** header injection via every field into `hdr()`; rate
  limit and auto-reply cap; honeypot; size; method matrix; the Referer rule
  (invariant 11).
- **`sitemap.php`:** XML escaping of product IDs.
- **Response headers** on Apache (from L2's runs): CSP presence or absence,
  HSTS, nosniff, frame options.
- **Information leaks:** error pages, `phpinfo`, version banners, directory
  listing.

**Instruments.** `curl`, Playwright, a diff of `data/` before and after each
step.

**Exit.** Every ADMIN-L3 and ENDPOINT row has an attack recorded with its
response. Each item of the CLAUDE.md "Security posture" paragraph is
re-verified with one command each.

### L4 — Data integrity and admin round-trips

**Charter.** Nothing Rick does can lose, corrupt or silently fail to publish
his data, and every change can be undone.

**Method.** For each `action=` row and each `$SECTIONS` row, on a private
mirror:

1. Save.
2. `jq` diff of the JSON on disk.
3. The public route shows it (Playwright).
4. A backup is written, named per invariant 5.
5. An audit-log line is added.
6. Restore that backup.
7. Disk and site are back.

Then the edge cases:
- **No-op save** writes nothing (invariant 16).
- **Concurrency:** two contexts, a stale signature, two saves at once.
- **Interrupted write:** `kill -STOP` the server mid-POST, then `-CONT`. The
  `.tmp` file plus rename leaves the file whole. Check the locks.
- **SKU rename** with a shared PDF (invariant 17, DI-1); delete, then restore.
- **Trash:** delete product, Remove PDF and Remove Photo each go to
  `.deleted.*` and come back.
- **Empty every section** (invariant 3) and check it **stays** empty after
  reload.
- **`max_input_vars`:** cite `plan2-trunc` (invariant 6).
- **Read-only `admin/` or `data/`:** the banner shows and saves fail loudly.
- **Lead path (ENDPOINT row):** both forms → the mail log (`IPC_MAIL_LOG`) **and**
  an `inquiries.jsonl` row → it shows in admin Inquiries → the seen state
  persists. If either half fails, it is a Blocker.
- **Log rotation at 16 MB:** read the code and test with a pre-filled file.

**Exit.** Every action is round-tripped with before/after artifacts.

### L5 — Server–client parity and merge rules

**Charter.** The same data says the same thing everywhere it is rendered:
- React (`mergeSiteInfo`, `mergeContent`, `PageMeta`);
- `public/index.php` (head, body prerender, noscript);
- `contact.php` (recipient, labels);
- `sitemap.php`;
- the admin previews (`settings-preview.js`, `product-preview.js`).

**Method.** For each DATA row, on a private mirror, mutate that field to:
- blank;
- missing;
- the wrong type;
- 10 KB;
- Unicode with U+2028 and RTL text.

For each value, diff `index.php`'s served head and body against the hydrated
DOM. Extend `_harness/prerender.js`'s comparison by copying it into
`_harness/out/audit12/`; never edit it.

Two rules hold throughout:
- An empty array means "deleted" in both renderers (invariant 3).
- A blank string is dropped in both (invariant 4).

**Exit.** Every DATA row has its mutation matrix with a result per renderer.

### L6 — Public UX and IA

**Charter.** At every viewport and in every state, a buyer can find a part,
read its specs, get its data sheet and ask for a quote. Nothing is clipped,
overlapped, dead or wrong.

**Method per ROUTE row.** Load the route in Playwright. **Force Liberation
Sans** before any width claim (§11). Then, by state:

| State | How |
|---|---|
| normal | as loaded |
| JavaScript off | `javaScriptEnabled: false`; the `index.php` body and noscript must be useful |
| catalog-503 | `page.route('**/data/products-all.json', 503)` |
| content-json-damaged | serve a truncated body |
| reduced-motion + 200% zoom | `reducedMotion: 'reduce'`, CSS width halved, `deviceScaleFactor: 2` |

Measure:
- horizontal overflow;
- overlaps at real scroll positions, with `elementFromPoint`, never full-page
  screenshots (§11);
- every link resolves on the mirror;
- every button does something;
- console errors.

Look at the screenshot with Read. Every PRODUCT @390 row checks the layout,
the spec table, Datasheet and RFQ.

**Exit.** 200 ROUTE-L6 + 42 PRODUCT-L6 rows, each with a screenshot path and a
measurement JSON.

### L7 — Accessibility

**Charter.** WCAG 2.2 AA for a keyboard and screen-reader user, on every
route, and on the admin pages Rick uses.

**Method.**
- axe-core (installed under `tools/`) at 390 and 1440.
- **Real Tab/Enter only**: `:focus-visible` does not match programmatic focus
  (§11). Focus order, focus visible, traps, Escape.
- Playwright accessibility snapshot, read as a list: names, roles, heading
  order, landmarks.
- Contrast of **every** text node, computed against its actual background,
  including the gradient ends. Known exemptions are in WHATS_LEFT "deferred";
  cite, do not re-raise.
- Target size 24 px.
- Reduced motion.
- Form errors announced.

**Exit.** Every route at both widths, plus the admin pages via L9's flows
(cite them).

### L8 — Content truth and wording

**Charter.** Everything the site says is true, consistent and correctly
spelled, and every claim with legal or commercial weight is traceable to an
owner decision.

**Method.**
- **Each PRODUCT-L8 row:**
  - Read its PDF (the Read tool, `pages: "1-2"`) and compare every spec value
    and unit.
  - Look at its photo with Read: is it this part?
  - Check family and description consistency.
- **Each DATA-L8 field:** check the type and presence across all 42 products,
  and where it renders.
- **Claims register:** list every certification, compliance, stock,
  lead-time, "since", count and superlative claim, with each place it appears.
  Each is either consistent and backed by a WHATS_LEFT row, or a finding.
  Owner facts are class `data-live` and point to the dashboard screen;
  hardcoded ones are class `code`.
- **Spelling and grammar:** every hardcoded string in `App.jsx`
  (`COPY_DEFAULTS` and inline) and in `content.json`.
- **Terminology** follows one controlled vocabulary: "Datasheet", "Request a
  Quote", the product noun.

**Exit.** Every product is compared with its PDF, and the claims register is
complete.

### L9 — Owner journeys and Help

**Charter.** Rick, non-technical, can do every task the handoff email and
Help describe, exactly as written, at 390 and 1440, and every error message
tells him what to do.

**Method.**
- **Every Help section:** perform its instructions **literally**, in order,
  in the admin, and record each step that does not match. Help had 19 false
  statements in the 2026-10-05 audit, so expect more.
- **Every FIELD row:** edit, save, find it on the public site where Help says
  it appears, then clear it and check that the default-or-empty behaviour is
  what Help says.
- Every admin page GET at 390: can he tell what it does?
- **Trigger every error message** the dashboard can show (grep `flash(`,
  `$errors[]`, `upload_error_message`) and read it as Rick.
- `Editing-Your-Site-Content.md` and `Email to Rick…`: do each task described.

**Exit.** Every Help section and every field has a step log.

### L10 — SEO and sharing

**Charter.** Crawlers and link unfurlers get the right head on every URL
without running JavaScript.

**Method.**
- **For each route and product:** `curl` with no JS. Check:
  - title (unique, fits), description length;
  - canonical (absolute, `www`, `?productId=` form);
  - `og:*` and `twitter:*`; the og image exists and its size;
  - `noindex` only where intended (unknown routes, settled).
- **JSON-LD:** parse it, check the schema.org types and required properties
  offline, and that it is true (L8).
- **`/sitemap.xml`:** `xmllint --noout`; every URL returns 200 and matches its
  page's canonical.
- **`robots.txt`.**
- **Link graph:** every product is reachable by `<a href>` without JS.
- **Parity:** served head equals hydrated head (`prerender.js` covers this;
  cite it, and add only the mutated-data cases L5 did not).

**Exit.** 10 routes and 42 products, each with the head captured and checked.

### L11 — Performance and robustness

**Charter.** Fast enough on a phone, and graceful when anything fails.

**Method.**
- **Per route at 390, cold:** CDP throttling (Fast 3G, 4× CPU). Record
  transfer bytes, request count, LCP and CLS via PerformanceObserver, console
  output and failed requests.
- **Caching and compression** on real Apache (L2's server): bundle gzip, the
  ~60 s data cache, immutable assets.
- **Every image row:**
  - Is it referenced anywhere (grep plus the crawl)?
  - Natural size versus largest rendered size.
  - Bytes.
- **Failure injection:**
  - a slow `data/*.json`, beyond the 12 s abort;
  - a 500 from `data/*.json`;
  - a missing image, a missing PDF.

  Each must show a message, never a blank page.
- **Memory:** 50 route changes; heap trend.

**Exit.** A per-route table, and a per-image used/unused/oversize table.

### L12 — Documentation and runbook truth

**Charter.** Every factual claim in every live document is true now, and
every command runs as written. The frozen files (`audit-runs/`,
`DEPLOY_READINESS_v2.md`, `UX_AUDIT_PREPROD…`, `AUDIT10/11-REPORT.md`) are
excluded, except that live documents must cite them correctly.

**Method.**
- **Per DOC row:**
  - List the claims under that heading.
  - Check each against code or a command. Numbers are **recomputed** (for
    example `wc -l src/App.jsx`, suite counts, file counts).
  - Paths exist; anchors and links resolve.
  - Commands run, on a mirror, never the live host.
- **GO-LIVE dry run:** follow GO-LIVE.md §B–§C **literally** on a fresh
  local Apache docroot built from `dist/`:
  - the upload order, `index.php` before `.htaccess`;
  - permissions;
  - the `ALLOW-PASSWORD-RESET` password flow;
  - every C1 `curl`, pointed at localhost.

  Every step that does not work as written is a finding (class `doc`).
- **Cross-document contradictions:** README versus CLAUDE.md versus GO-LIVE
  versus `admin/README`.

**Exit.** Every DOC row has its claim list and per-claim result, and the
GO-LIVE dry run has a step log.

### L13 — Harness integrity and invariants

**Charter.** The suites prove what they claim, and they can fail.

**Method.**
- **Each SUITE row:**
  - Read the suite and list what it asserts.
  - Compare that with its `_harness/README.md` description.
  - Look for vacuous passes: empty selectors, loops over zero elements, "pass
    if not found", assertions on comments.

    Lesson: A10-049 and UX-10 passed vacuously, and grep-based tests matched
    incident comments.
- **Each FILE-L13 row:** classify it (Phase 0 step 6) and look for dead
  helpers.
- **Flag "suspect vacuous"** suites as a finding; step M mutation-tests them.
- **INVARIANT rows are step M's** (§5.4).
- **The dry-run itself:** `audit12-workflow-dryrun.js` must catch the five
  mutations recorded in Appendix C.

**Exit.** Every suite is mapped from claim to assertion, and every invariant
mutated and red.

### L14 — Records and regression since audit 9

**Charter.** Every WHATS_LEFT row is still accurate, and nothing shipped since
audit 9 (2026-09-14) broke what it touched.

**Method.**
- **Each RECORD row:** is the item still open (for example, the FAQ answer
  still says "Data Sheet")? Does the settled reason still hold?
- **`git log --since=2026-09-14 --first-parent --oneline origin/main`** (31 commits AS-OF 2026-10-07; PRs are squash-merged, so `--merges` would miss almost all of them): for each, read the diff
  (`git show --stat`, then the hunks). For each touched surface, check that
  the behaviour adjacent to the change still works.

  Lesson: A10-059 was a regression *introduced by a fix*.
- **Each FILE-L14 row** (`audit-runs/`): check that live documents cite it
  correctly.

**Exit.** Every record is re-verified, and every PR since audit 9 has a
touched-surface check.

### L15 — Code reading, declaration by declaration

**Charter.** Every function and component is correct for every input it can
receive.

**Method.** For each DECL row, read the whole declaration (grep for its start,
then ±N lines; never open `App.jsx` whole). Look for:
- absent, null, empty or wrong-type data;
- error paths;
- effects: cleanup, dependency arrays, stale closures, listeners removed;
- keys;
- `setState` after unmount;
- async races (abort and TTL);
- string building (escaping, truncation by code unit versus character);
- dead branches.

For PHP: every caller, every return path, behaviour on failure, and `false`
versus `null` versus `''`.

A suspected defect needs a **runtime reproduction** before it becomes a
finding. A reading alone is `[UNVERIFIED]` and goes in `outOfBrief` for L6 or
L4 to exercise.

**Exit.** Every declaration is read, with one line of evidence each ("read
L1234–1290; handles X, Y; no defect" is a valid result).

---

## 7. The ledger (Phase 1 output)

These files are generated by `_harness/audit12-ledger.js` and are not
committed until §12:
- `_harness/out/audit12/ledger.jsonl` and `ledger.md`;
- `rows/*.jsonl` (results);
- `findings/*.json`;
- `verdicts/*.json`;
- `ledger-status.md` (written by `--coverage`).

| Kind | Rows at 8e90dcc | Derived from |
|---|---|---|
| FILE | 524 | `git ls-files`, plus an L2 row per shipped PHP file |
| DECL | 327 | `App.jsx` top-level declarations, plus the functions in `index.php`, `contact.php`, `sitemap.php` and `config.php` |
| ROUTE | 240 | `SEO_DEFAULT`: 10 routes × (4 viewports × 5 states + 2 a11y + head + perf) |
| PRODUCT | 126 | 42 × (truth, 390 layout, head) |
| ADMIN | 107 | 19 pages × (GET, signed-out, each `<form>`, each `action`, each `$_POST`/`$_GET`/`$_FILES` key) |
| ENDPOINT | 26 | method matrix plus each input of the three public PHP files, plus the lead path |
| HTACCESS | 122 | every directive line in the 5 source `.htaccess` files |
| DATA | 84 | every product key, every `site-info` leaf, every `content` key and copy group |
| FIELD | 176 | `dump-copy-groups.php` + `settings.php` inputs + `$SECTIONS` |
| DOC | 325 | every H1–H3 of every live `.md`, plus every Help section |
| INVARIANT | 19 | CLAUDE.md (a contiguity check guards the regex) |
| SUITE | 121 | `_harness/sweep-list.txt` |
| RECORD | 50 | every WHATS_LEFT table row |

By lens:

| Lens | Rows |
|---|---|
| L1 | 85 |
| L2 | 150 |
| L3 | 231 |
| L4 | 26 |
| L5 | 68 |
| L6 | 242 |
| L7 | 20 |
| L8 | 105 |
| L9 | 212 |
| L10 | 52 |
| L11 | 74 |
| L12 | 315 |
| L13 | 365 |
| L14 | 75 |
| L15 | 227 |

**Known limits of the derivation.** The gap hunts and the critic exist for
these:
- It sees forms, `action` values and request keys by regex. A handler that
  reads input another way is a ledger gap.
- Routes come from `SEO_DEFAULT`. A route outside it is a ledger gap.
- L4 has only 26 rows, because most admin writes are a single form. Its
  method (§6 L4) multiplies each row into a round-trip matrix; it is not light.

---

## 8. The completeness critic

Runs at the end of every wave (in the script), then once more over all lenses
in W5. It must:

1. Return `--coverage` verbatim.
2. Spot-audit 8 random "done" rows per lens. A row whose evidence would
   satisfy a reader **without the check having been run** does not hold: for
   example "checked, fine", a suite name the row's check is not about, or an
   artifact path that does not exist.
3. Re-dispatch, in batches of 15 or fewer:
   - pending rows;
   - blocked rows whose cause is gone;
   - rows that do not hold.
4. List **unexercised** states, viewports, inputs and surfaces from the lens
   charters that no evidence mentions.

C turns each unexercised item into a GAP row (`--add`) for the next wave or
for W5.

The critic does not raise findings. It does not re-dispatch a row only
because it would have checked it differently.

**What C watches for between waves (tunnel vision):**
- One lens with most findings and another with none. Is the quiet lens
  genuinely clean, or under-exercised? Read 5 of its evidence lines yourself.
- Findings clustered in one file while its neighbours are unread.
- Evidence that is a sweep citation where the row's `check` asks for
  something the suite does not do.

---

## 9. Finding protocol

### 9.1 Record (the Workflow `FINDING` schema; the same fields in `audit12.md`)

```
### A12-<batch>-<n> — <SEVERITY> — <one sentence, in the words a buyer or Rick would use>
class:        code | harness | doc | data-live | server | decision
lens:         L<n>          rows: <ledger ids>
where:        <file:line + verbatim quote> | <url + artifact path>     (at AUDIT_HEAD)
notInPrior:   grepped <sources> for <terms> — <why this differs; or "regression of <ID>">
reproduce:    <exact commands / numbered steps; runnable cold on a fresh mirror>
observed:     <verbatim output or artifact path>
expected:     <what the site needs, and the rule, invariant or decision that says so>
consequence:  <who is harmed and how>  → sets severity
verified-by:  reproduce <verdict> · refute <verdict> · severity <verdict> [· tiebreak <verdict>] (verdict files)
fix-sketch:   <one line, what would close it; no code>   (C adds this in §12.7, not the finder)
```

### 9.2 Severity (PLAN-11 §7.1, unchanged)

| Severity | Definition |
|---|---|
| **Blocker** | Prevents a safe launch: unauthenticated data exposure or write; the lead path fails (email **and** Inquiries row); a legal or certification falsehood on a live page; a blank page in a supported browser; irreversible data loss on a normal owner action. |
| **High** | A buyer or Rick is misled or blocked on a main path; a claim the business cannot stand behind; a security control that fails silently; a doc instruction that causes a destructive action; a regression of a fixed High; a suite that cannot fail while guarding an invariant. |
| **Medium** | Wrong, with a workaround, or on a secondary path; a control that degrades without a signal; doc and code disagree in a way that causes rework but not damage. |
| **Low** | Wording, typography, structure polish, stale numbers in self-describing docs, harness hygiene. |

### 9.3 Classes

- `code`, `harness`, `doc`: a later plan fixes these.
- `data-live`: Rick changes it in the dashboard; name the screen. It is never
  a repo edit of `data/`.
- `server`: host or DNS.
- `decision`: escalated to Keagan in this form:

  ```
  decision-needed | recommended | why | trade-off | blocked
  ```

### 9.4 Citation gate

`_harness/audit12-cite.js` checks, and exits 1 on any failure:
- the file exists inside the repo;
- the line is in range;
- the quote (6 or more characters) is on that line, within ±2 lines;
- the ledger rows exist;
- the artifact of a URL observation exists.

On a failure it says where the quote actually is, so the finder can fix it.
A finding whose citations fail is flagged `citeFailed` in the Workflow return,
and C sends it back.

---

## 10. Verification — adversarial, independent, measured

Implemented in `verify()` in `_harness/audit12-workflow.js` and proven by the
dry-run.

| Verifier | Runs for | Task |
|---|---|---|
| **reproduce** | every finding | Runs the reproduction cold on its **own fresh mirror**. `confirmed` only if it saw the result itself. Steps that are not runnable as written mean `not-reproduced`. |
| **refute** | every finding | Tries to kill it: intended (a comment, invariant or decision)? settled or already reported (§3.3, cite the hit)? an environment artifact (§11)? a duplicate? wrong about the code? Never kills without a measurement. |
| **severity** | Blocker / High / Medium | Judges consequence only. Its severity wins; the author's is kept beside it. |
| **tiebreak** | only when reproduce and refute disagree | Re-measures the disputed point and decides. |

**Survival:** reproduce and refute both `confirmed`, or the tiebreak
`confirmed`. Killed findings are **kept** in `audit12.md` §4 with the
measurement that killed them. A refutation is a result, not a deletion.

**Deduplication:**
- Within a wave, the script deduplicates by where + title.
- Across waves, C deduplicates from `--tally` output: same `where` and same
  consequence means one finding, keeping the earlier ID and citing both.

**Final:** every Blocker and High is re-reproduced on a fresh clone (§5.6).

---

## 11. Environment artifacts — re-measure under the control before raising

| Artifact | Control |
|---|---|
| DejaVu Sans is about 21% wider than Arial/system-ui on Linux (`plan8-polish` C49, and five more dead leads) | Force **Liberation Sans** for any width, wrap or overflow claim |
| `php -S` ignores `.htaccess` and `.user.ini` | Any claim about them is measured on real Apache (L2), or `[UNVERIFIED]` |
| PHP 8.4 here accepts syntax PHP 7.4 rejects; mbstring is present here | L2's static scan; `function_exists` guards |
| `:focus-visible` does not match programmatic focus | Real Tab/Enter only |
| Playwright full-page captures paint sticky elements once, anywhere | `elementFromPoint` at real scroll positions |
| `page.click()` scrolls before dispatching | Measure position before the click (GUARDRAILS §7.2) |
| Tailwind emits rules for bare utility words in comments | `cssdiff.js` |
| The mirror is stale after an edit to `admin/`, `public/` or `src/` | `sh _harness/sync.sh` (plus `npm run build` for `src/`); compare `md5sum` of the source and the mirror file before believing a result |
| The Vite dev server answers unknown paths with `index.html` and a 200 | Use the mirror, not `npm run dev`; `jsonOrThrow` asserts Content-Type |
| Worker or container restart kills the PHP servers (exit 137) | S10 |
| Outbound network goes through a proxy | A failed external `curl` is `[UNVERIFIED — network]` |
| `php -S` is single-threaded | A timeout under load is contention; re-run on an idle port |
| `plan3-autoreply` needs POSIX `fakemail.sh` | `[UNVERIFIED]` on Windows |

---

## 12. Reporting

### 12.1 Files (C writes these; they are the only tracked changes)

| File | Content |
|---|---|
| `audit-runs/audit12.md` | The report (§12.3) |
| `audit-runs/audit12-ledger.md` | Copy of `_harness/out/audit12/ledger-status.md` after `--final` |
| `WHATS_LEFT.md` | New section "Open — AUDIT-12 findings": one row per confirmed finding (ID, severity, class, one line, `audit12.md` anchor). `data-live` items are added to the "waits on Rick" table too. Decisions go in as escalations. Settled items are never edited, only superseded. |
| `plans/README.md` | One line: PLAN-12 is run, and points to `audit12.md` |

### 12.2 Numbers

Every count in the report is pasted from these outputs, never typed:
- `--tally` (findings by severity, class and lens; confirmed, killed and unverified);
- `--coverage` (rows by lens and status).

Before committing, re-run both and diff against the report's numbers.

### 12.3 `audit12.md` skeleton

```
# AUDIT-12 — the whole project            AUDIT_HEAD <sha> · <dates> · <workflow run ids>
## 0. Verdict          ← one paragraph + the severity table (from --tally). "Launch-ready" only with 0 Blocker and every High owned.
## 1. Inherited state  ← Phase 0: toolchain, sweep table, Apache suites, _harness classification, STEP 0
## 2. Coverage         ← --coverage table; blocked rows with reasons; GAP rows added and by whom
## 3. Findings         ← §9.1 records, severity order, then lens
## 4. Killed           ← refuted / not reproduced / duplicate / settled / environment, each with its measurement
## 5. Routed           ← out-of-brief lines and where they went
## 6. Limits           ← every cap hit, every [UNVERIFIED], every NOT-MEASURED, every tool that was missing
## 7. Proposed fix plan← findings grouped into fix batches by class and surface, ordered Blocker→Low, each batch naming the suites that guard it and the test-first check; decisions listed in the escalation form. NO time estimates.
## 8. Self-corrections ← anything this audit said and later found wrong
## 9. Method           ← waves as run, agent counts, wall-clock per wave (measured), cost notes
```

### 12.4 PR

- Branch: the session's designated branch.
- One commit series. Files: §12.1 only, after `git status --porcelain` and
  the S4 checks.
- Title: `AUDIT-12: full-project audit report (no fixes)`.
- Body: the §0 verdict, the severity table, the coverage table and links.
- Ready for review. **Do not merge.**

### 12.5 Handback to Keagan (chat), in this order

1. Completed: the verdict line, the counts, the PR link.
2. Errors and limits: caps, blocked rows, `[UNVERIFIED]` items.
3. Decisions needed, in escalation form.
4. Next: the recommended first fix batch.

Short.

---

## 13. Stop and escalate

| Condition | Action |
|---|---|
| S9: a live secret or personal data in git | Stop the wave. Tell Keagan in one line. Do not copy the secret anywhere. |
| A Blocker is confirmed | Do not stop. Tell Keagan in one line as soon as the tiebreak/verify returns, then continue. |
| Phase 0: an unexpected red that does not clear after the S10 checks | Record it as finding #1 and continue. If the **mirror cannot be built or served at all**, stop and escalate. |
| An instrument fails 3 times | Stop that instrument. Mark its rows `blocked` with what was tried, observed and now believed (GUARDRAILS §5). |
| Disk under 2 GB free | Delete `_harness/out/audit12/m/*` and old screenshots, then continue. If you cannot recover, escalate. |
| The critic is still re-dispatching after 3 rounds, or a gap hunt hits its cap | Logged automatically. C decides whether to run one more targeted wave or record the limit. **Never** report the area as covered. |
| Any proposed action outside §12.1's files | It is out of scope. Write it into §12.7 and do not do it. |

---

## 14. Kickoff prompt — paste this into the new session

```
Run the full-project audit in plans/PLAN-12-full-project-audit.md, start to finish.

Use a workflow: I explicitly authorise large multi-agent Workflow runs for this audit — hundreds of agents across five waves, loops and parallel fan-out, as many rounds as the plan's loop-until-dry and critic rules call for. Take as long as it needs; thoroughness beats speed. (If /config "Dynamic workflow size" is limiting, tell me and I will raise it.)

Read the plan's §2 read order first. Follow §5 exactly: Phase 0 baseline, Phase 1 ledger, wave W1, step M, waves W2–W4, then W5 (seams, final re-verify on a fresh clone), then the §12 report and one PR (no fixes, do not merge).

Between waves, run the §5.4 checks and give me a 4-line status: rows done/total, findings by severity, caps hit, measured wall-clock of the wave. Tell me immediately if you confirm a Blocker or find a secret (§13).

Hard rules: the plan's §0 and §4 — read-only repository until §12, private mirrors on 10000+, never pkill -f, no live-host requests beyond STEP 0, no hash in any file, every number from --tally/--coverage.
```

---

## Appendix A — the instruments (all tracked, all tested before this plan was committed)

| File | What it is | Test |
|---|---|---|
| `_harness/audit12-ledger.js` | Ledger generator; modes `--check`, `--batches`, `--args`, `--add`, `--coverage`, `--final`, `--tally` | `--check` exits 0 (13 kinds, 15 lenses, 19 contiguous invariants). Coverage self-test 2026-10-07: a good row exits 0; `--final` with pending rows exits 1; an unknown ID, thin evidence, a conflicting status and "finding" with no ID each print an ERROR and exit 1. Tally self-test: 4 findings → confirmed 1 (severity verifier's Blocker over the author's High), killed 1 (tiebreak), unverified 2 (no tiebreak; no votes). |
| `_harness/audit12-cite.js` | Citation gate | Self-test 2026-10-07: a good citation exits 0. A bad file produces 5 failures and exits 1: a wrong line (and it reports the right one), a missing file, an invented quote, a missing ledger row, a missing artifact. |
| `_harness/audit12-workflow.js` | The per-wave Workflow script (find → verify → gap hunt → critic) | `audit12-workflow-dryrun.js` |
| `_harness/audit12-workflow-dryrun.js` | Runs the script against stub hooks; 23 assertions | 23/23. Shown failing under 5 mutations (Appendix C). |
| `_harness/sweep-list.txt` | The 121-suite sweep, in run order | `isowaterfall` added and verified 19/19 on 2026-10-07 |

## Appendix B — lessons from audits that missed things (why each rail exists)

| Lesson | Rail it produced |
|---|---|
| A10-059 was a regression introduced by the A-5.23 fix | L14's per-PR touched-surface check |
| DEP-3 (`x.php.jpg` executed) and PUB-1 were visible only on real Apache | L2's real-Apache probe per directive; §11 row 2 |
| Help had 19 false statements; nobody had performed them | L9: perform every instruction literally |
| DI-1: a SKU rename broke a restore path no flow exercised | L4's restore leg of every round trip |
| A10-049's arm and UX-10 passed vacuously; grep tests matched incident comments | L13's vacuity read, step M mutation, the dry-run's own mutations |
| AUDIT-11's numbers did not reproduce | §10: the reproduce verifier on a fresh mirror; §12.2 computed numbers |
| `isowaterfall` existed and never ran in the sweep | Phase 0 step 6 classification; SUITE rows from `sweep-list.txt` |
| The mirror was stale after a `contact.php` edit and the suites tested old code | §11 hash check; the S1 read-only rail removes the cause during the audit |
| Font-metric differences produced six false findings | §11 Liberation Sans control |
| Removing the noscript block in `index.php` broke `plan8-polish` C38, found only by the full sweep | Phase 0 full sweep; L5 checks noscript parity |
| Worker restarts killed the PHP servers twice | S10 |
| Hand-written ledgers missed the harness, `.claude/` and `package-lock.json` | §7: the ledger is generated from `git ls-files` |
| A ledger regex hid 9 of 19 invariants (found while building this plan) | The contiguity check in `--check` |

## Appendix C — the dry-run's mutation record (2026-10-07)

| Mutation to `audit12-workflow.js` | Dry-run assertions that went red |
|---|---|
| Stop the gap hunt after 1 dry round instead of 2 | "L6 gap hunt stopped after two dry rounds"; "a clean wave … exactly two dry rounds" |
| Remove the tiebreak | The High-finding and Low-finding verifier sets; "severity verifier's severity wins" |
| Remove deduplication | "a duplicate finding … is not re-verified" |
| Silence the round cap | "L3 gap hunt hit the 5-round cap and the cap is recorded" |
| `Date.now()` in a prompt | "no Date.now()"; the verifier-set assertions (the stub throws) |

## Revision log (append-only)

- 2026-10-07: written, with the instruments in Appendix A. Ledger 2,247 rows
  and 138 batches at 8e90dcc (before this plan's own commit; Phase 1
  regenerates at AUDIT_HEAD).
- 2026-10-07, self-corrections before the first commit:
  - Agent ports moved from 8200+ to 10000+. Suites bind ports up to 9481, so
    the first port map could collide.
  - L14's `git log --merges` would have listed 2 of the 31 commits since
    audit 9, because PRs are squash-merged.
  - The audit-9 date corrected to 2026-09-14.
  - Phase 0's credential step now names `setpw.php`.
