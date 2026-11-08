# PLAN-14 — AUDIT-14: every file and every word, public site and dashboard, read-only

**Written 2026-11-08 against `main` at `9d82373`.** For a NEW Claude Code
session (Opus 5.5) that has never seen this repo. It is an **audit**: it finds,
proves and reports. It fixes nothing. The output is one report, one filled
ledger, one text-corpus status file and one PR, which is not merged. Fixing is
a later plan, built from the report's proposed fix plan after Keagan reads it.

It is PLAN-12 (AUDIT-12, 2026-10-13, 529 confirmed findings) re-aimed. It reuses
PLAN-12's machinery and its finding protocol. It adds four things AUDIT-12 did
not have:
1. **A text corpus.** Every user-visible string on the public site, in the
   dashboard, in the emails, in the PDFs and in the owner documents, each with
   its source location.
2. **A live snapshot.** It is taken once, gently, and every agent reads it
   instead of hitting the host.
3. **A signed-in walk of every dashboard screen on a local mirror.**
4. **The lessons of the 2026-11-08 live audit**
   (`audit-runs/live-audit-2026-11-08.md`).

Notation:
- **C** is the coordinating session (you). **Finder**, **verifier**, **critic**
  and **hunter** are Workflow subagents.
- A **row** is one ledger line. A **lane** is one unit of parallel work (§7).
- A **T-check** is one text check (§8). A **lens** is a PLAN-12 lens (L1–L15).
- Volatile facts carry `AS-OF:` dates. Re-measure anything load-bearing.

---

## 0. Rules that bind every agent (finders read this section; it is short on purpose)

1. **Read-only on the repository.** No tracked file changes until §11 (C
   only). Everything an agent writes goes under `_harness/out/audit14/`, which
   is gitignored. `git status --porcelain` must be identical before and after
   every agent.
2. **Measured, not inferred.** Every claim carries a command and its output, a
   corpus row ID, or an artifact path. If you did not run it, label it
   `[UNVERIFIED — why]`. "Looks correct" is not evidence.
   - A screenshot counts only after you have opened it with Read.
   - Numbers are computed by a script, never typed.
3. **Breadth first.** Give every row and every corpus entry in your slice its
   check before going deep on any one. Every row gets exactly one result:
   `done | finding | blocked | n-a`, with evidence. Finding something big is
   not a reason to stop.
4. **Stay in your lane.** Anything outside it is one line in `outOfBrief`
   (`file:line` or corpus ID, plus a sentence). C routes it.
5. **No finding without a cold reproduction and passing citations.**
   - `node _harness/out/audit14/tools/audit14-cite.js <your findings file>`
     must exit 0.
   - Text findings cite the corpus ID **and** the source location: file:line
     with a verbatim quote, or URL + selector + artifact.
6. **Check the do-not-re-report sources (§3.3) before writing a finding.** Say
   what you grepped in `notInPrior`. Re-raising a settled or open item without
   new dated evidence is a defect in the audit, not a finding. Today's live
   audit and AUDIT-12 are both on that list.
7. **Severity is consequence (§9.2).** It is never set by instance count,
   wording or effort.
   - One misspelling repeated 60 times is **one** finding, with every instance
     listed.
   - A wrong phone number on one page is worse than 60 typos.
8. **Zero findings is a valid result.** Never invent one, and never soften a
   real one.
9. **Environment artifacts are not site defects (§10).** Re-measure under the
   listed control before raising anything they could explain.
10. **Safety (§4) overrides everything above.**

---

## 1. Purpose and definition of done

**Purpose.** Establish, with evidence, that **every tracked file** and **every
word a buyer or Rick can read** is correct. That covers the live public site,
the dashboard, the emails the site sends, the PDFs it links, and the documents
Rick was given. It also establishes that the live server serves what the repo
says.

"Every" means two script-generated inventories, never a hand-written list:
- **The ledger** (§6.2). It is PLAN-12's generator extended: every file, every
  declaration, route, product, admin page/form/input, endpoint, `.htaccess`
  directive, data field, owner field, doc heading, Help section, invariant,
  suite and record.
- **The text corpus** (§6.3). Every user-visible string, keyed by surface,
  source and render location.

**Done means all of the following, each proven by a command:**

| # | Condition | Proven by |
|---|---|---|
| D1 | Every ledger row, including GAP rows, is `done`, `finding`, `blocked` or `n-a`, with evidence | `audit14-ledger.js --final` exits 0 |
| D2 | Every corpus entry has passed through at least one lane's T-checks, recorded per entry | `audit14-corpus.js --final` exits 0 |
| D3 | Every finding's citations hold | `audit14-cite.js` exits 0 |
| D4 | Every finding was reproduced **and** attacked by agents other than its author (§9.5), and none is unverified | `--tally` prints `unverified 0` |
| D5 | Every Blocker and High was re-reproduced on a fresh clone and a fresh build | report §3 `verified-by` lines |
| D6 | Report numbers equal `--tally`, `--coverage` and `audit14-corpus.js --coverage` output | §11.2 diff |
| D7 | Phase 0 baseline recorded; every red in it explained | report §1 |
| D8 | Every cap hit, every `blocked` row and every `[UNVERIFIED]` label is listed | report §6 |
| D9 | One PR, ready for review, unmerged | PR link |

Running out of budget produces a **blocked list**, never a shorter audit
reported as complete.

---

## 2. Read order — C only

1. This file, whole.
2. `CLAUDE.md` (auto-loaded), then `WHATS_LEFT.md`: open, settled, and "Done
   since 2026-10-07", especially the 2026-11-08 rows.
3. `audit-runs/live-audit-2026-11-08.md`. It describes what the live site is
   and its known open items.
4. `plans/PLAN-12-full-project-audit.md` §0, §4, §5.3–§5.6, §6 (the lens
   charters, which you will hand to finders by reference), §7–§11 and
   Appendix B.
5. `plans/GUARDRAILS.md` §0–§2, §4.1–§4.4 and §7.
6. `_harness/README.md`: the top section, "On Windows", and "Things that
   have bitten before".

Grep, do not read: `audit-runs/WHATS_LEFT-history.md`, `audit-runs/audit12.md`
(9,320 lines) and older audit files. Look things up by ID or phrase only (§3.3).

---

## 3. Inputs

### 3.1 Inventory, AS-OF 2026-11-08 at 9d82373 (re-measure in Phase 0)

| Surface | Count | Notes |
|---|---|---|
| Tracked files | ~570 | `git ls-files \| wc -l`. `_harness/` 212, `dist/` 93, `public/` 72, `admin/` 61, `pdfs/` 45, `audit-runs/` 28, `rick-email/` 26 |
| `src/App.jsx` | 16,661 lines | The whole React app. `SITE_DEFAULTS` :8331, `COPY_DEFAULTS` :9069, `SEO_DEFAULT` :9335 (re-grep) |
| `src/index.css` | 1,127 lines | |
| Public PHP | `index.php` 1,080 · `contact.php` 1,449 · `sitemap.php` 204 lines | |
| Admin PHP | 20 files, ~12,200 lines | Including `home.php` (PLAN-13 Overview), `nav.php`, `config.php` |
| Admin JS | 14 files | `nav.js`, `longform.js` and `listfilter.js` are PLAN-13 |
| Help | `admin/help.php`, 26 anchored sections | Plus 24 annotated screenshots in `admin/help-img/` |
| Flash/status messages | ~26 call sites | Grep **`flash_redirect(` and `$flash[`**. Not `flash(`, which matches nothing; that was AUDIT-12's own A12-L12-14-6 |
| Data | 3 JSON files in `site-data/` | 42 products. The live copies differ only by `catalogPdfUrl` and FAQ #15 (AS-OF 2026-11-08) |
| PDFs | 43 data sheets in `pdfs/`, 2 brochures in `pdfs/marketing/` | Live adds `pdfs/marketing/IPC-Product-Catalog.pdf` (6.2 MB, Rick's upload, not in the repo) |
| Images | 63 under `public/images/` | Live also has `uploads/` (Rick's) |
| Owner documents | `Email to Rick - Admin Dashboard Handoff.md`, `rick-email/` (HTML + 24 images), `Editing-Your-Site-Content.md`, `admin/README.md` | |
| Markdown docs | 47 tracked `.md` | `DEPLOY_READINESS_v2.md` §7 and the PLAN-10/11/12 bodies are **frozen history**: check internal references only, never "truth vs today" |
| Sweep | `_harness/sweep-list.txt` | Re-count with `grep -vc '^#'`. Docs say 121, 123 and 124; it is ~125 |
| Routes | 10 + unknown | `/`, `/products`, `/dashboard`, `/datasheets`, `/industries`, `/services`, `/about`, `/faq`, `/contact`, `/privacy` |
| Homepage layouts | 6 | `HOME_LAYOUTS` in `src/App.jsx` and `admin/settings.php`. Every layout's text is in scope |

### 3.2 State the audit starts from

- **Phase 0 STEP L (§6.1) decides what live is.** On 2026-11-08 the live
  public bundle was the 2026-10-19 build with a hand edit. The live admin was
  pre-PLAN-13, and `home.php` and `help-img/` gave 404s (live audit M1/M2).
  Keagan may have deployed since.
  - If live ≠ `dist/`, every text difference that the old bundle explains is
    **one** finding, M1 re-confirmed, not hundreds.
  - In that case the live lanes audit live **content** (Rick's data, PDFs,
    uploads) against the repo's **current** code, rendered locally with the
    live data (§6.4).
- **The host is flaky** (live audit H1: about 10% of requests got openresty
  500s, TLS alert 80, or 5–12 s stalls).
  - A live 5xx or TLS failure is retried once after 10 s, then recorded as
    `host-flaky` with its timestamp.
  - It is not a finding unless the rate differs materially from H1. In that
    case it is one finding, `server` class.
- **The nine live-audit code fixes are in `main` (9d82373).** They are M3,
  M4, L2, L4, L5, L6, L8, L10 and L11. A regression of any of them is a
  finding (L14).

### 3.3 Do-not-re-report: grep these before writing any finding

`WHATS_LEFT.md` (all open tables, Settled, Done) · `audit-runs/live-audit-2026-11-08.md`
· `audit-runs/audit12.md` (by ID and phrase) · `plans/GUARDRAILS.md` §7 ·
`audit-runs/WHATS_LEFT-history.md` (grep only) · `audit-runs/claims-register-2026-09-15.md`.

The content claims already open with Rick must be cited, not re-raised:
- RoHS, AMS, Ford LP, M23053/8 QPL, Class C, cable ties;
- the ISO revision year;
- the `U/L` marks;
- the five photo-less products;
- the privacy effective date;
- the badge pairs.

A **new instance** of an open claim (a new page or string that repeats it) is
recorded as an instance on the existing row, not as a new finding.

### 3.4 Expected reds in Phase 0 (AS-OF 2026-11-08, Windows host)

| Suite | Red | Why |
|---|---|---|
| `plan10-dashboard` | mobile-390 card heights | Fails identically with 65051f7's bundle: a baseline captured with other font metrics |
| `prerender` | crash at cleanup (EPERM) after 35/35 checks | `php.exe` still holds the folder on Windows |
| `plan8-polish` C49 | Linux only | DejaVu metrics (WHATS_LEFT "cannot be verified") |
| `audit9-logic-public` | not in the sweep | Needs a private `:8140` audit-9 site |
| `plan3-autoreply` | Windows | Needs a POSIX `fakemail.sh` and an SMTP sink |

Any other red: check servers, credential and denominator first (GUARDRAILS
§4.2), then re-run that suite alone once. If it is still red, it is finding #1.

---

## 4. Safety rails — non-negotiable

| # | Rail | Why (the incident) |
|---|---|---|
| S1 | No edits to tracked files until §11, and then only the files §11 names. **Never** edit `site-data/`, `pdfs/` or `uploads/`, in the repo or anywhere else. No `npm run build` in the repo folder after Phase 0 step 2. | `site-data/` is Rick's live state. `dist/` is committed, so a rebuild is a tracked change |
| S2 | **Live host: GET and HEAD only.** Only the Live lane (§7, lane V) and C may send requests to `insulationproducts.com`. Global budget: **at most one request every 2 s, one connection at a time, across the whole audit.** Every other agent reads the snapshot in `_harness/out/audit14/live/`. | A shared host that already fails ~10% of requests (H1) |
| S3 | **Never submit the contact form, never POST to `contact.php`.** A live POST emails IPC sales and writes a real lead. Local mirrors only, with `fakemail.sh`. On live: render and client-side validation only, with a Playwright route that aborts any non-GET. Log that it never fired. | Real leads, a real inbox |
| S4 | **Never sign in to the live `/admin/`** and never type or guess a password there. It has a login throttle and an audit log. Live admin is anonymous GET only. | Throttle, audit log, Rick's account |
| S5 | **Signed-in dashboard work happens only on local mirrors.** Use the test credential `audit-pass-123`, written by `php _harness/setpw.php` into the mirror's `admin/config.local.php`. Never commit, paste or print a bcrypt hash. Before the commit run `git grep -nE '\$2y\$'` and `git status --porcelain \| grep config.local`. | Invariant 2; hashes were committed twice |
| S6 | Mirrors and ports: `_harness/site/` and ports **8123–8139** belong to the sweep (Phase 0) and step M. Each agent copies the site to `_harness/out/audit14/m/<label>` and serves it on its own port block **≥ 10000**. Stop servers **by PID**, never `pkill -f` or `pgrep -f`. On Windows, select `php.exe` with `Get-CimInstance Win32_Process` and the port in `CommandLine`. | Parallel runs contaminated each other (PLAN-11 §3.2); `pkill -f` killed the session's own shell |
| S7 | No FTP, no host file manager, no DNS or account changes, no email sent to anyone. | Production |
| S8 | Send no project data to external services: no online validators, spell-check APIs or pasted JSON. Use local tools only: `pdftotext`, `@babel/parser`, PHP's tokenizer, and a temporary `npm i --prefix _harness/out/audit14/tools …` (for example `cspell` with its offline dictionaries, `axe-core`). No new dependency in `package.json`. | $0 budget; the data is the owner's |
| S9 | A live secret or customer personal data found anywhere (git files, git history, the live snapshot, a 200 where a 403 was expected) means: **stop that lane and tell Keagan at once** in one line. Do not copy it anywhere. The live inquiry log is refused by `admin/.htaccess` (measured 2026-11-08). If it ever answers, that is a Blocker. | Public repo; buyers' names, emails and phones |
| S10 | No merges, no force-push, no history rewrite. One PR from a branch `claude/audit14`. Never switch the branch of a folder another session is using. If another session shares this folder, work in a worktree. | GUARDRAILS §2 |
| S11 | After any restart, re-check the servers before believing any red. | Exit 137 killed the PHP servers twice |
| S12 | Delete each private mirror copy when its agent finishes. Watch free disk space (190 GB AS-OF 2026-11-08; a mirror is ~15–21 MB). | Fixed allowance |

---

## 5. Environment (this machine, AS-OF 2026-11-08)

- **Windows 11, 32 logical cores.** Shells: PowerShell 5.1 and Git Bash.
  - A **guard hook blocks `$(...)`, `$VAR` / `${VAR}`, and `node -e` / `-c`
    inline code in Bash**, and blocks writing files outside the repo folder.
  - So put logic in script files under `_harness/out/audit14/` and run them
    with literal arguments.
  - Scratch files go there too, not in `/tmp` or the temp scratchpad.
- **Node 24, Playwright chromium 151** (resolvable with the repo as cwd).
  Also available: `npx lighthouse` 13.6, PHP 8.3 (winget), `pdftotext`
  (mingw64), and Python 3.14 (run it `-I` on any downloaded input).
- **Real Apache lives in WSL Ubuntu.**
  - It has Apache 2.4, `libapache2-mod-php` (PHP 8.5), `mod_ssl` and Node 22.
  - Run as `wsl -u root -e sh -c "cd /mnt/c/Users/latar/Desktop/Updated_IPC-main-main-1 && node _harness/<suite>.js"`.
  - git `safe.directory` is already set for that path.
  - `prerender-apache` (24 checks), `dep3-scriptblock` and `lowsE-apache` run
    there, not on Windows.
- **Harness on Windows:**
  - Run `bash _harness/sync.sh` through Git Bash.
  - Start the sweep servers with `node _harness/servers.js`.
  - `run.js` sets `PHP_INI_SCAN_DIR` from `_harness/php-local.js`.
  - `php -S` is single-threaded: one mirror per agent, never shared.
- **Tailwind scans `src/App.jsx` comments.** Not relevant while read-only. Do
  not mistake a stray utility class for a code defect without `cssdiff.js`.

---

## 6. Execution model

### 6.1 Phase 0 — baseline, live state, and instruments (C, serial, ~1 agent)

1. `git status --porcelain`: record it (`plans/mockups/` and
   `plans/references/` may be untracked, and are not yours). Record `git
   rev-parse --short HEAD` as **AUDIT_HEAD**. Every measurement is "at
   AUDIT_HEAD".
2. `npm ci && npm run build`, then `git status --porcelain dist/` must be
   empty. The build must reproduce `dist/`; 93/93 did on 2026-11-08.
3. Run `bash _harness/sync.sh`, then `php _harness/setpw.php`, then `node
   _harness/servers.js`. Gates: `php _harness/lint.php` and `node
   _harness/run.js invariants`.
4. **Sweep in the background:** `node _harness/run.js <every line of sweep-list.txt>`
   into `_harness/out/audit14/sweep-before.txt`. Then run the three real-Apache
   suites in WSL. Explain every red against §3.4.
   - **While the sweep runs, nobody edits `src/`, `public/` or `admin/`.**
     Nobody would anyway: S1.
5. **STEP L — what is live** (C alone, S2 budget):
   - GET `/`. Record the `assets/index-*.js` / `.css` names and compare them
     with `dist/index.html`.
   - GET `/admin/home.php` and `/admin/help-img/overview.png`. A 404 there
     means the pre-PLAN-13 admin.
   - GET `/robots.txt`. Is it the repo's file?
   - Record all of it in report §1. It decides §3.2's branch.
6. **Instruments.** PLAN-12's are tracked but hard-wired to `audit12`. Copy
   them into `_harness/out/audit14/tools/` (untracked), renamed
   `audit14-ledger.js`, `audit14-cite.js`, `audit14-workflow.js` and
   `audit14-workflow-dryrun.js`. Change `OUT` to `_harness/out/audit14` and the
   ID prefix to `A14`, and fix the four instrument defects AUDIT-12 recorded
   about itself:
   - **A12-L12-13-2:** `--check` rewrites the ledger from scratch and
     silently deletes GAP rows. Make generation a separate `--generate`,
     refuse to run it when `ledger.jsonl` exists, and make `--check` read-only.
   - **A12-L12-14-3:** gap-hunt methods cycle after 2–3 per lens. Give every
     lane **at least 5 distinct methods** (§7 lists them per lane) and make
     the script refuse to repeat one.
   - **A12-L12-15-2:** `--tally` does not print `where` or `consequence`, so
     cross-wave duplicates were counted twice. Print both, and add `--dupes`,
     which groups by normalised `where` + consequence.
   - **A12-L12-14-6:** the flash grep. Use `flash_redirect(` and `$flash[`.

   Then `node _harness/out/audit14/tools/audit14-workflow-dryrun.js` must pass
   all its assertions (PLAN-12 Appendix A records 23 for the original), plus
   new ones for the four fixes.
   Mutate each fix once and show the dry-run go red: the PLAN-12 Appendix C
   method.
7. Extend the ledger generator with four kinds:

   | Kind | One row per |
   |---|---|
   | `TEXTSRC` | string-bearing source unit: each `COPY_DEFAULTS` / `SITE_DEFAULTS` / `SEO_DEFAULT` group, each admin page's static text, each email template, each Help section |
   | `PDF` | PDF in `pdfs/`, `pdfs/marketing/`, and live-only PDFs |
   | `HELPSHOT` | `admin/help-img/*` and `rick-email/img/*` image |
   | `LIVE` | live URL class: route, product, data file, asset, admin anonymous page |

   Run `--generate` **once** at AUDIT_HEAD and record the row count. IDs are
   ordinals; never regenerate. Missing rows are added with `--add` as GAP rows.

### 6.2 Phase 1 — the ledger (C)

As PLAN-12 §5.2 and §7, plus the four new kinds. Batches of ≤ 15 rows.
Record the count by kind and by lens in report §2.

### 6.3 Phase 1b — the text corpus (C + 4 extractor agents in parallel)

`_harness/out/audit14/corpus/*.jsonl`, one JSON object per string:

```
{ id, surface, source, render, text, context, states, owner_editable, lang_hint }
```

| Field | Meaning |
|---|---|
| `id` | e.g. `T-000123` (ordinal, assigned once by `audit14-corpus.js --merge`) |
| `surface` | `public` \| `admin` \| `email` \| `pdf` \| `doc` \| `server` (`index.php` no-JS body, 405 page, sitemap, robots, manifest) |
| `source` | file:line (+ JSON path for data) or PDF page |
| `render` | route/page × state × viewport where it was SEEN, or `not-rendered` |
| `owner_editable` | true when Rick can change it from the dashboard (and which screen) |

Four extractors, run in parallel, each writing its own file:

| Extractor | Method |
|---|---|
| **X1 static-public** | `@babel/parser` over `src/App.jsx`: every JSXText, every string literal in `alt` / `aria-label` / `title` / `placeholder` / `label` props, and every string in `COPY_DEFAULTS`, `SITE_DEFAULTS`, `SEO_DEFAULT`, `HOME_LAYOUTS` and the error, empty and loading states. PHP's `token_get_all` over `public/index.php`, `contact.php` (both email bodies, the auto-reply, the HTML 405/error pages, the JSON error strings) and `sitemap.php` |
| **X2 static-admin** | `token_get_all` over every `admin/*.php`: `T_INLINE_HTML`, echoed literals, `flash_redirect(` / `$flash[` messages, `upload_error_message()`, form labels and hints (`content_label_parts()`), `$PAGE_MAP` / `$SECTIONS` titles, `data-confirm` texts. `@babel/parser` over `admin/*.js`: `confirm()` / `alert()` / textContent literals |
| **X3 rendered** | Playwright on a private mirror, signed in for admin pages. Capture `innerText` plus accessible names, per state: every public route × {1440, 768, 390} × {loaded, catalog-loading, catalog-failed, empty-list, long-text} and all 6 homepage layouts. Every admin page × {1440, 390} × {signed-out, signed-in, after-save flash, validation error, JavaScript off}. Rows that X1/X2 found but no render saw become `not-rendered`: a dead string or a missed state, which the critic chases |
| **X4 documents** | `pdftotext -layout` of every PDF, repo and live snapshot. The owner documents (`Email to Rick…md`, `rick-email/email.html` rendered, `Editing-Your-Site-Content.md`, `admin/README.md`), Help (`admin/help.php` rendered) and the README/GO-LIVE sections addressed to Rick. Also the text inside the 24 Help screenshots' callouts, which `help.php` describes: compare the captions with the current UI |

Then `audit14-corpus.js --merge` dedupes identical `(text, surface)` while
keeping every source and render. `--coverage` counts entries by surface and by
T-check status. `--final` fails on any entry with no T-check result.

### 6.4 Phase 1c — the live snapshot (lane V, one agent, S2 budget)

One agent fetches, once, into `_harness/out/audit14/live/`:
- every route;
- all 42 product URLs (from the live `/sitemap.xml`);
- `/site-data/*.json`, `robots.txt`, `manifest.json`, `sitemap.xml`;
- the live bundle JS and CSS;
- every PDF and image the live data references;
- the anonymous admin `auth.php` sign-in page.

Rules for the snapshot:
- Raw bytes plus headers and a timestamp for each URL.
- After it, a Playwright render of each live route at 1440 and 390, saved as
  `innerText` + screenshot. Block any non-GET.
- At most one request every 2 s; retry a 5xx or TLS failure once after 10 s.
- Expect about 200 requests, so at least ~7 minutes.

**No other agent touches the live host.** Lanes that need "live" read this
folder. If the live data differs from the repo's, X3 also renders the repo's
**current** bundle over the **live** data on a private mirror. Then text that
comes from Rick's data is audited in the code that will serve it next.

### 6.5 Waves

Run the Workflow once per wave, with `scriptPath:
"_harness/out/audit14/tools/audit14-workflow.js"`, `args` as a JSON object (not
a string), and `resumeFromRunId` after a crash. **Read each wave's result before
starting the next.**

| Wave | Lanes (§7) | Why here |
|---|---|---|
| **W1** | F-BUILD, F-HARNESS, F-RECORDS, V (if Phase 1c is not finished), X-verify | The evidence base: build, harness and records |
| **M** | Step M: mutation of the 19 invariants and of the suites W1 flags; serial, C or one agent, exclusive `:8123` (PLAN-12 §5.4) | Do the guards still guard? |
| **W2** | F-APP (12 slices), F-PHP-PUBLIC, F-ADMIN-PHP (5 slices), F-ADMIN-JS, F-HTACCESS, F-CSS, F-DATA | Every code file read, with PLAN-12 lenses L2–L5 and L15 |
| **W3** | T-PUBLIC (10 route lanes + home-layouts + products ×6 + chrome), T-ADMIN (one per dashboard screen, 19), T-EMAIL, T-SERVER | Every word on screen, against §8 |
| **W4** | T-PDF (43 + marketing, 5 slices), T-DOCS-OWNER, T-HELP + T-HELPSHOT, F-DOCS, X-CONSIST (cross-surface consistency, over the whole corpus) | Documents, Help, and consistency across everything |
| **W5** | All: cross-lane gap hunt, critic, final re-verify on a fresh clone (PLAN-12 §5.6) | The seams |

**Concurrency.** The machine has 32 cores, but every agent runs a browser and
its own `php -S`.
- **At most 10 agents run at once.** Verifiers count toward the 10.
- Every lane stagger-starts by 5 s, so ten sync-copies and ten chromium
  launches do not collide.
- The workflow's own size cap: one wave is ≈ 40–70 finders plus verifiers,
  well under 1,000. Split a wave by lane if it approaches the cap.
- No time estimates: measure W1, report its wall-clock, and project from it.

**Between waves (C):** run `--coverage`, `audit14-corpus.js --coverage`,
`audit14-cite.js`, `--tally` and `--dupes`. Turn every ledger gap,
out-of-brief line and `not-rendered` corpus entry into a GAP row (`--add`).
Log caps in report §6. Re-check servers (S11). Give Keagan a 5-line status:
rows done/total, corpus checked/total, findings by severity, caps hit, measured
wall-clock.

### 6.6 Inside a wave (what `audit14-workflow.js` does)

This is PLAN-12 §5.5, unchanged except for three things:
- finders get **corpus slices** as well as ledger rows;
- gap hunts use the lane's own ≥ 5 methods (§7) and never repeat one;
- the critic also spot-audits 10 corpus entries per lane.

The flow is find → verify (as soon as each finder returns) → gap hunt,
loop-until-dry (2 dry rounds, hard cap 6) → critic (≤ 3 rounds). Caps are
logged, never silent.

---

## 7. Lanes

Each lane is a set of Workflow finders with one charter. The PLAN-12 lens
sections are handed **by reference**: "read PLAN-12 §6 L<n>". Gap-hunt
methods are listed per lane, and each round must use a new one.

### File lanes (W1–W2): every tracked file, read

| Lane | Scope | Charter | Gap-hunt methods (≥ 5) |
|---|---|---|---|
| F-BUILD | `package*.json`, `vite.config.mjs`, `tailwind.config.js`, `postcss.config.mjs`, `index.html`, `.gitattributes`, `.gitignore`, `.claude/`, `dist/` vs build | L1 | `npm ls` drift; a build from an LF checkout; a dist file with no source; a source with no dist; `.gitignore` hiding a needed file |
| F-HARNESS | all 212 `_harness/` files | L13: classify suite / helper / instrument / orphan; vacuity read of every assertion; the two suites changed 2026-11-08 (`plan7-imagery`, `plan8-landing`) and `prerender-apache`'s five new checks | grep each assertion's incident comment; mutate one input per suite; a suite whose denominator can be 0; a hard-coded count; a port collision |
| F-RECORDS | `WHATS_LEFT.md`, `audit-runs/*.md` (references only), `plans/*.md` | L14: every open row still true; every Done row's PR or commit exists and says what the row says; every 2026-11-08 row (incl. the live audit's "Update, same day" note) matches the code | follow every § link; follow every commit SHA; count claims vs `git log`; settled rows vs current code; dates vs `git log` |
| F-APP ×12 | `src/App.jsx` in 12 slices by top-level declaration (~1,400 lines each; slice boundaries at declarations) | L15 code reading (declaration by declaration), plus L5 parity where the slice holds a `PageMeta` twin, plus every invariant the slice touches | read callers of each export; trace one prop from data to DOM; error and empty paths; every `useEffect` dependency list; every `{ replace: true }` |
| F-PHP-PUBLIC | `public/index.php`, `contact.php`, `sitemap.php`, `.user.ini`, `robots.txt`, `manifest.json` | L2, L3, L5 | PHP 7.4 syntax scan; every `$_SERVER` read; every header sent; every exit path's body; mail headers via `hdr()` |
| F-ADMIN-PHP ×5 | `admin/*.php` in 5 slices (config.php alone; auth/password/home/nav/ping; add/edit/delete/upload-*; content/settings/site-images/marketing-pdfs; index/inquiries/audit-log/backups/help) | L2, L3, L4 | every `$_POST` key vs every form field; every `require_auth()` / `csrf_check()` before output; every `save_*()` and its backup; every file path through `basename()` + `realpath()`; every `h()` |
| F-ADMIN-JS | `admin/*.js` (14) | L3, L15 | every DOM query whose target may be absent; every `fetch`; every `confirm()` text; JavaScript-off fallbacks; keyboard paths |
| F-HTACCESS | 5 source `.htaccess` + `uploads_runtime_htaccess()` / `pdfs` runtime writers | L2 on **real Apache in WSL** (one probe per directive) | directive order (invariant 19); `(\.|$)` anchors; a request line vs a normalised path (live audit L2); both PHP handler models; the runtime copy vs the shipped file |
| F-CSS | `src/index.css`, `GlobalStyles`, the admin `<style>` blocks, `admin_head()` | invariants 9, 13, 14, 15; specificity; dead rules | `cssdiff.js`; unused selectors; a rule that loses to a utility; admin pages that opt out of `.admin-wide` |
| F-DATA | `site-data/*.json` (repo) + the live snapshot's copies | L4, L5: every key read by code, every key written by the admin, `mergeContent` / `mergeSiteInfo` rules (invariants 3, 4), repo-vs-live diff | a key the admin writes that nothing reads; a key read with no default; empty arrays; blank strings; type drift between repo and live |
| F-DOCS | `README.md`, `GO-LIVE.md`, `CLAUDE.md`, `_harness/README.md`, `PATCH_NOTES.md`, `UX_AUDIT_PREPROD…`, `plans/README.md`, `plans/GUARDRAILS.md` | L12: every command runs as written (dry, read-only); every number re-measured; every file:line still points at the quoted thing. `DEPLOY_READINESS_v2.md` §7 is frozen: check only that it still says so | run each command block in a scratch copy; grep each quoted identifier; count each stated number; check each link; compare each "AS-OF" with today |

### Text lanes (W3–W4): every word, against §8

| Lane | Scope (corpus slice + render) | Gap-hunt methods (≥ 5) |
|---|---|---|
| T-HOME | `/` in all 6 layouts × 3 widths × states, plus every Page Content box each layout shows (WHATS_LEFT 2026-10-17 rows) | read as a first-time buyer; read with every list emptied; read with the longest live strings; read on the pale and dark palettes; read with JavaScript off (the `index.php` body) |
| T-CATALOG | `/products` landing, family filter states (incl. the L4 fix), search empty states | every family; every search no-result; `?family=` misspelled; a slow catalog; the skeleton (the M3 fix) |
| T-PRODUCT ×6 | the 42 product pages, 7 each: every spec label/value, size chart header/cell, badge, breadcrumb, related card, Request a Quote, the not-found state (the L5 fix), the server head | spec value vs datasheet PDF (claims-pdfs); units and symbols; identical rows across products; the photo-less five; the head at 160 chars |
| T-INDEX | `/dashboard` and `/datasheets`: column names, chips, filters, `?q=` / `?approval=`, empty states | every chip; every sort; every empty state; counts vs the catalog; datasheet rows vs product rows |
| T-PAGES ×5 | `/industries`, `/services`, `/about`, `/faq`, `/privacy` | each claim vs the claims register; every FAQ answer vs the current UI's labels (the FAQ #15 lesson); every legal sentence vs what the site actually does (cookies, logs, retention vs `contact.php` / `inquiries.jsonl`); links inside prose; dates |
| T-CONTACT | `/contact` both forms: labels, hints, required markers, native validation text, `?part=`, `?industry=`, the honeypot, success / failure / rate-limit / mail-failed panels (render each state on a **mirror**, never live), the 405 page | every state of `contact.php`'s responses; a 200-character part; each industry; a bad email; JavaScript off |
| T-CHROME | header, nav, dropdowns, mobile drawer, footer (incl. the M4 targets), skip link, the error boundary, "Catalog Unavailable", the not-found page | each at 3 widths; each label vs its destination's `h1`; tel / mailto vs `site-info.json`; © years; social names |
| T-SERVER | the `index.php` no-JS body and head per route and product; `<noscript>`; `sitemap.xml`; `robots.txt`; `manifest.json`; the JSON-LD texts | server text vs client text, word for word; the noscript contact copy vs `site-info.json`; the manifest name; the sitemap's comments (the `data/` lesson) |
| T-EMAIL | the sales notification, the auto-reply, their subjects, `From` / `Reply-To` display names, plain-text wrapping (rendered by submitting on a **mirror** with `fakemail.sh`; read the mail log) | each form type; each optional field empty; a long message; non-ASCII names; invariant 10 (no HTML-escaping in plain text) |
| T-ADMIN ×19 | one finder per dashboard screen: Sign-in, Overview (`home.php`), Products list, Add, Edit, Delete, Upload PDF, Upload Photo, Page Content, Business Details, Site Images & Logo, Catalog & Brochure PDFs, Inquiries, Audit Log, Backups, Password, Help, the menu bar (`nav.php`), and the server-problem banners. Each signed in on its own mirror at 1440 and 390: headings, labels, hints, buttons, empty states, every flash message (trigger each), every validation error (trigger each), every `confirm()` text, JavaScript-off text | trigger every `flash_redirect(` / `$flash[` site; trigger every `upload_error_message()` case; empty every list; the longest product; every "this cannot be undone" claim vs what the code does |
| T-HELP | `admin/help.php`: every instruction **performed literally** on a mirror (the AUDIT-12 lesson: Help had 19 false statements); every menu path it names vs the PLAN-13 menu | perform each step; follow each anchor; compare each named label with the screen; each "what your server allows" figure; each limit vs `config.php` |
| T-HELPSHOT | the 24 `admin/help-img/*` and `rick-email/img/*` pictures: each callout's number and label vs `help.php` / the email text; each picture vs the current screen. To re-shoot, copy `_harness/helpshots.js` into `_harness/out/audit14/tools/` and change its `OUTS` (line ~28, hard-wired to `admin/help-img` and `rick-email/img`, which are tracked: S1) to a folder under `_harness/out/audit14/`. Copy `helpshots-site.js` too, and change its hard-wired `PORT = 8140` and `DST` (`_harness/out/shots-site`), and `helpshots.js`'s `BASE` (`:8140`), to this lane's own ≥10000 port and folder. Then diff the new pictures against the tracked ones | callout numbers; cropped-out labels; stale UI; the "after saving" picture (65051f7); alt text |
| T-DOCS-OWNER | `Email to Rick - Admin Dashboard Handoff.md`, `rick-email/email.html` + `build.js` output, `Editing-Your-Site-Content.md`, `admin/README.md` | every instruction vs the dashboard; every promise vs the code; every number; tone for a non-technical owner; links |
| T-PDF ×5 | the 43 data sheets + 2 brochures + live catalog PDF: text extracted; part numbers, specs, units, standards and certifications vs the product JSON (`_harness/claims-pdfs.js` is the existing instrument); PDF metadata title; broken text layers | sheet vs JSON spec; sheet vs page name; shared sheets (`IP12GA` / `IP12GA-IP1274`); brochure promises vs Services; the catalog's prices / phone / address vs `site-info.json` |
| X-CONSIST | the whole corpus at once (W4, after all T-lanes) | glossary drift ("datasheet" / "data sheet", `U/L` / `UL`, `°C` / `C`, `RFQ` / quote); phone / fax / email / address format; company name forms; product name vs SKU spellings across page, PDF, JSON-LD and sitemap; the same fact stated twice with two values; terms the dashboard uses vs the public label they control |
| V | the live snapshot (§6.4) and every live-vs-repo comparison: bytes of every static file, behaviour of the 4 PHP entry points (run the repo's file locally over the live data and diff the output, as on 2026-11-08), anonymous admin pages, headers | covered by §6.4; its own gap hunt is "a URL class not yet fetched" |

---

## 8. Text checks (the T-checks every text lane applies to its slice)

Every corpus entry gets a result per applicable T-check: `pass`, `finding:<id>`
or `n-a`.

| ID | Check | How (measured) |
|---|---|---|
| T1 | Spelling | offline `cspell` with en-US plus a project word list built from the catalog (SKUs, materials, standards). Every unknown word is listed and judged; none is auto-accepted |
| T2 | Grammar and punctuation | read; agreement ("1 products"), doubled words, sentence fragments in body copy, curly vs straight quotes in one surface, `—` vs `-` usage |
| T3 | Facts vs source of truth | phone / fax / email / address / hours vs `site-info.json`; specs vs datasheet; counts vs the catalog (computed); claims vs the claims register and the open Rick rows (§3.3) |
| T4 | Consistency | the X-CONSIST glossary: one spelling per term per surface, and one value per fact |
| T5 | Placeholders and leftovers | `TODO`, `lorem`, `TBD`, `xxx`, `example.com`, `coming soon` (except the designed photo-less panel), `undefined`, `NaN`, `[object Object]`, `{…}` template tokens, test SKUs, test names, `audit-pass` |
| T6 | Encoding | mojibake (`â€`, `Ã`), double-escaped entities (`&amp;amp;`, invariant 10's incident), stray `\n`, non-breaking spaces where wrapping matters, `°`/`±`/`µ` rendered correctly in HTML, email and PDF |
| T7 | Dates and years | © range, privacy effective date, "since 1974", "AS-OF" phrases visible to buyers, relative dates that rot ("new this year") |
| T8 | Links in text | every href inside prose resolves (repo mirror; live via the snapshot), and the link text matches the destination's `h1` / file |
| T9 | Labels vs behaviour | a button's text describes what it does; Help's menu paths exist; "cannot be undone" / "backed up" / "saved" claims match the code path (trash, backups, no-op saves: invariant 16) |
| T10 | Accessibility of text | alt text present and meaningful (decorative = `alt=""`); accessible name contains the visible label (2.5.3); headings in order; link text not "click here"; error messages tied to fields |
| T11 | Length and truncation | titles ≤ 60, descriptions ≤ 160 (live audit L3), product names in cards, admin labels at 390, the longest live string in each box |
| T12 | Tone and audience | public: a B2B buyer's words, no internal jargon (audit IDs, "SKU parity"); admin: Rick's words, no developer terms; every error says what to do next |
| T13 | Server / client parity | `index.php` text = rendered text for the same route (word for word for head tags; same facts for the no-JS body) |
| T14 | Owner-editable mapping | every owner-editable string is reachable from the dashboard screen the corpus names, and the label on that screen says where the text appears |
| T15 | Dead or unreachable text | `not-rendered` corpus entries: is the state reachable? If not, it is dead code (Low) unless it is legal or contact text |
| T16 | Legal and certification | every certification mark, standard number and regulatory claim; every privacy statement vs actual data handling (`contact.php` logs, retention, `mail()` recipients) |

---

## 9. Finding protocol

### 9.1 Record

PLAN-12 §9.1's schema with these changes:
- IDs are `A14-<lane>-<n>`.
- There are two extra fields:
  - `corpus:` — every corpus ID the finding covers (instances);
  - `surface:` — public | admin | email | pdf | doc | server | code | harness.

`where` is file:line with a verbatim quote at AUDIT_HEAD, or URL + selector +
artifact path. For live, it is the snapshot path and the timestamp.

### 9.2 Severity

PLAN-12 §9.2, unchanged. For text:
- A wrong phone, email, address, price, spec, certification or legal statement
  on a public page or PDF is **High**, and **Blocker** if it is a legal or
  certification falsehood.
- A dashboard instruction that leads Rick to a destructive action is **High**.
- A typo is **Low** unless it changes meaning.

### 9.3 Classes

PLAN-12 §9.3, plus `content-repo`: shipped default text in the code, fixed by
a code change. `data-live` stays "Rick changes it in the dashboard"; name the
screen and the box.

### 9.4 Citation gate

`audit14-cite.js`, with corpus IDs checked against `corpus/*.jsonl` and
snapshot paths checked to exist.

### 9.5 Verification

PLAN-12 §10, unchanged: reproduce (cold, own fresh mirror), refute, severity
(for Blocker/High/Medium), and a tiebreak when they disagree. Killed findings
are kept with the measurement that killed them.

For text findings, the reproduce verifier opens the source **and** the render
and quotes both.

---

## 10. Environment artifacts — re-measure under the control before raising

PLAN-12 §11 in full, plus:

| Artifact | Control |
|---|---|
| The live host fails ~10% of requests (H1) | Retry once after 10 s. Count it in the `host-flaky` log, never as a page defect |
| Live ≠ `dist/` (an old bundle) | One finding (M1), not one per string. Audit Rick's live content in the current bundle (§6.4) |
| The Windows font stack differs from the baselines captured on Linux | Check a width or wrap claim at the same viewport with the repo bundle on this machine **and** the baseline. `plan10-dashboard` mobile-390 is the known case |
| `prerender`'s cleanup EPERM on Windows | Read its check lines, not the exit code |
| The guard hook blocks `$VAR` and inline `node -e` | Not a harness failure; use a script file |
| LinkedIn (and other social sites) answer 403/999 to scripts | Inconclusive; check the href is well-formed, never "broken link" |
| `pdftotext` column order on multi-column sheets | Re-read with `-raw` and look at the page image before claiming a missing value |
| `cspell` does not know industry terms (polyolefin, Kynar, PVDF, M23053) | The project word list. An unknown word is judged by a person-like read, never auto-flagged |
| Playwright `innerText` drops `display:none` and `aria-hidden` text | Accessible names come from the accessibility tree; hidden text is audited from the source corpus |

---

## 11. Reporting

### 11.1 Files (C writes these; they are the only tracked changes, on branch `claude/audit14`)

| File | Content |
|---|---|
| `audit-runs/audit14.md` | The report (§11.3) |
| `audit-runs/audit14-ledger.md` | `--final` status |
| `audit-runs/audit14-corpus.md` | `audit14-corpus.js --coverage` output, plus the X-CONSIST glossary (term → spellings found → count → surfaces) |
| `WHATS_LEFT.md` | New section "Open — AUDIT-14 findings", one row each. `data-live` rows go into "waits on Rick" too. Decisions use the escalation form |
| `plans/README.md` | One line: PLAN-14 is run, and points to `audit14.md` |

The instrument copies stay untracked in `_harness/out/audit14/tools/`.
Proposing to track them is a §11.3 §7 item, not something the audit does.

### 11.2 Numbers

Every count comes from `--tally`, `--coverage`, `--dupes` or
`audit14-corpus.js --coverage`. Re-run them before committing and diff them
against the report.

### 11.3 `audit14.md` skeleton

```
# AUDIT-14 — every file and every word      AUDIT_HEAD <sha> · <dates> · <workflow run ids>
## 0. Verdict          ← one paragraph + severity table (--tally); live state (STEP L) in one line
## 1. Inherited state  ← toolchain, sweep table, WSL Apache suites, _harness classification, STEP L, host-flaky log summary
## 2. Coverage         ← ledger by kind/lens/status; corpus by surface/T-check; blocked rows; GAP rows
## 3. Findings         ← records, severity order, then surface
## 4. Killed           ← each with its killing measurement
## 5. Routed           ← out-of-brief lines and where they went
## 6. Limits           ← caps, [UNVERIFIED], NOT-MEASURED, missing tools
## 7. Proposed fix plan← batches by class × surface, Blocker→Low; for data-live, the dashboard screen and box per item, written so Keagan can forward it to Rick; decisions in escalation form. No time estimates.
## 8. Self-corrections
## 9. Method           ← waves as run, agent counts, measured wall-clock per wave, the S2 live-request log total
```

### 11.4 PR

The PR goes from branch `claude/audit14`:
- **Files:** §11.1 only, after the S5 checks.
- **Title:** `AUDIT-14: every file and every word (report, no fixes)`.
- **Body:** the verdict, the severity table, the coverage tables and links.
- Ready for review. **Do not merge.**

### 11.5 Handback to Keagan (chat)

1. The verdict, the counts and the PR link.
2. Limits: caps, blocked rows, `[UNVERIFIED]` items, and the host-flaky rate
   measured.
3. Decisions needed, in escalation form.
4. What to forward to Rick: the `data-live` list, by dashboard screen.
5. The recommended first fix batch.

Keep it short.

---

## 12. Stop and escalate

| Condition | Action |
|---|---|
| S9: a secret or personal data exposed (git, live) | Stop that lane, tell Keagan in one line, copy nothing |
| A Blocker is confirmed | Tell Keagan in one line, and continue |
| The live host fails > 25% of snapshot requests for 10 minutes | Pause lane V, wait 30 minutes, then resume. If it is still failing, finish the snapshot as `[UNVERIFIED — host]` rows and tell Keagan |
| Phase 0: the build does not reproduce `dist/` | Record it as finding #1 (L1) and continue from the committed `dist/` |
| Phase 0: the mirror cannot be built or served | Stop and escalate |
| An instrument fails 3 times | Stop it; mark its rows `blocked` with what was tried (GUARDRAILS §5) |
| The dry-run fails after the instrument copies | Do not start W1. Fix the copy (it is untracked), re-run, and record the self-correction |
| Any action outside §11.1's files, any live POST, any sign-in on live | Out of scope; write it into §7 of the report, do not do it |

---

## 13. Kickoff prompt — paste this into the new session

```
Run the audit in plans/PLAN-14-every-file-every-word-audit.md, start to finish: every tracked file and every word on the public site, in the dashboard, in the emails, the PDFs and the owner documents.

Use a workflow. I explicitly authorise multi-agent Workflow runs for this audit: many parallel agents per wave (at most 10 running at once, per the plan), across all five waves, loop-until-dry gap hunts and critic rounds as the plan specifies. Take as long as it needs; thoroughness beats speed. If the workflow size setting is limiting you, tell me and I will raise it.

Read the plan's §2 read order first. Follow §6 exactly: Phase 0 (baseline, STEP L, instruments and their dry-run), Phase 1 ledger, Phase 1b text corpus (four extractors in parallel), Phase 1c live snapshot (one agent, the S2 budget), waves W1, M, W2–W5, then the §11 report and one PR from branch claude/audit14 (no fixes, do not merge).

Between waves give me the 5-line status from §6.5. Tell me at once if you confirm a Blocker, find a secret or personal data, or the live host goes down (§12).

Hard rules (§0, §4): read-only repository until §11; site-data/, pdfs/ and uploads/ are never touched; live host GET/HEAD only, one request per 2 s, only lane V and you; never POST to contact.php and never submit the live form; never sign in to the live /admin/ — signed-in dashboard work only on local mirrors with the test credential from _harness/setpw.php; no hash in any file; private mirrors on ports 10000+; stop servers by PID; every number from the instruments.
```

---

## Appendix A — lessons this plan builds on (why each new rail exists)

| Lesson | Rail |
|---|---|
| Live audit 2026-11-08: the live bundle was a hand-edited old build, and WHATS_LEFT said "rebuilt" | Phase 0 STEP L; one finding for bundle drift, not hundreds |
| Live audit H1: ~10% host failures, confounded at first by 8 agents' load | S2: one live agent, one request per 2 s, a snapshot everyone reads |
| Live audit M4: a 2.5.8 failure visible only with Rick's `catalogPdfUrl` set | X3 renders the current code over the **live** data |
| Live audit M3: CLS that Lighthouse lab runs scored 0 | Measure in a real browser with a delayed catalog, never trust lab CLS alone |
| Live audit L6: two suites asserted "no marketing image is the LCP", which Lighthouse disproved | F-HARNESS's vacuity read of every assertion's premise |
| FAQ #15: an answer named a button label that no longer existed | T9 and T-PAGES: every answer vs the current UI's labels |
| AUDIT-12: Help had 19 false statements | T-HELP performs every instruction literally |
| AUDIT-12 A12-L12-13-2 / 14-3 / 15-2 / 14-6 | The four instrument fixes in Phase 0 step 6 |
| `sitemap.php`'s comment and `robots.txt` still said `data/` live | T-SERVER reads comments that ship in responses |
| Tailwind turned a comment word into a CSS class (2026-11-08) | §5 note; `cssdiff.js` before calling a CSS defect |

## Revision log (append-only)

- 2026-11-08: written at 9d82373 from PLAN-12 and the 2026-11-08 live audit.
  Not yet run. The instruments in Phase 0 step 6 are to be derived by the
  running session (untracked); nothing in this plan has been dry-run yet.
