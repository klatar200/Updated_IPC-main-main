Paste everything below the line into a **fresh** Cowork session. Attach nothing —
the session reads the repo itself.

---

## What you are doing

You are the **third** session on the IPC website release. You are not auditing.
You are **executing a fix list that has already been reproduced with evidence.**

- **Session 1** executed a large fix workstream against `DEPLOY_READINESS_v2.md` and
  recorded its own claims in `WHATS_LEFT.md`.
- **Session 2** audited those fixes adversarially and wrote `AUDIT_v3_FINDINGS.md`.
  Every finding in it carries a reproduction — a command and its actual output, a
  browser measurement, or a diff. Three blockers, eighteen non-blockers, ten
  `WHATS_LEFT.md` §4 claims that did not reproduce, thirty documentation errors.
- **You** fix them, prove each fix, and correct the records that are now wrong.

**Repo:** `C:\Users\latar\Desktop\Updated_IPC-main\Updated_IPC-main-main`
(connected folder on device "asus")

The working tree is dirty against `68d87e5` and that is expected — the whole release
is uncommitted. `git status` on the mount fails with `unable to unlink
.git/index.lock`; use `git --no-optional-locks`. Do not `checkout`, `reset`, `stash`,
`commit` or `push` unless asked.

---

## Read these first, in this order

1. **`AUDIT_v3_FINDINGS.md`** — the fix list. This is your work order. Sections:
   §1 blockers (3), §2 non-blockers (18), §3 claims that did not reproduce (10),
   §4 documentation errors (18 + a 12-row `.docx` addendum at the end), §5 coverage.
2. **`CLAUDE.md`** — the twelve invariants. Session 2 traced all twelve to enforcing
   code and confirmed every one is a real mechanism. **Do not break any of them while
   fixing.** Invariant 4 in particular: do NOT revert `mergeSiteInfo`'s blank-drop —
   see NB4 for the correct fix shape.
3. **`WHATS_LEFT.md`** — §1 shipped, §2 the 17 known-open non-blockers, §3 settled
   decisions. §4 is the evidence block; **ten of its lines are now known wrong** and
   you will be correcting them.
4. **`DEPLOY_READINESS_v2.md`** — the original audit. **Frozen. Do not edit it.**

---

## What this project is

An industrial distributor's website (insulationproducts.com — heat-shrink tubing,
sleeving, adhesives). Hybrid static + PHP admin, deployed by FTP to Network Solutions
shared hosting. No database, no runtime backend.

- **Frontend:** React 18 + Vite. `src/App.jsx` is the entire app (~8,738 lines, every
  page inline). `src/pages/`, `src/components/`, `src/lib/` exist but **nothing
  imports them** — ignore those folders entirely.
- **Admin:** PHP 7.4+ under `admin/`, session auth, flat JSON in `data/`.
- **Contract:** React fetches `/data/products-all.json`, `/data/site-info.json`,
  `/data/content.json` at runtime; the PHP admin writes them.
- **The audience for the admin is Rick** — the business owner, non-technical, around
  60, uses FTP reluctantly. The premise of this release is that he can change content,
  business details, colors, logo and his own password without calling the developer.
  **Weigh every judgement call by whether it protects that premise or a sales lead.**
- **`_localsite/`** is a snapshot of the currently-deployed site.

---

## The work, in priority order

### Phase 1 — the three blockers. Nothing ships until these are done.

| ID | File | Fix |
|---|---|---|
| **B1** | `admin/content.php:489` | `$content = $storedContent;` runs unconditionally after the POST block, so every error path (stale `orig_sig`, `form_complete` truncation, `save_content()` failure) re-renders the form from **disk** and throws away everything Rick typed — then hands him a refreshed valid `orig_sig` so his retry commits the disk values under a green "✅ Content saved". Fix: `if (!empty($errors)) { $content = $out; }` before line 489. **Caveat:** on the *truncation* path `$out` holds only what survived, so that path needs a section-wise merge over `$storedContent`, not a straight swap. `settings.php:134`, `edit.php:185` and `add.php:79` are the correct patterns — copy their shape. |
| **B2** | `admin/config.php:68-69`, `admin/auth.php:32-35`, `admin/index.php:105-116` | The `ALLOW-PASSWORD-RESET` window is a bare `file_exists()` — no expiry, no warning, and a signed-in admin is redirected away from the screen so he can never see it is open. While it is open any unauthenticated client on the internet fetches its own CSRF token and sets the admin password. Fix: (a) reject the flag when `filemtime() < time() - 3600`; (b) push a `$healthProblems[]` entry on `index.php` when the flag exists; (c) decide what a signed-in admin should see — the current redirect at `auth.php:32-35` hides the state from the one person who can fix it. Also add `ALLOW-PASSWORD-RESET` to the `FilesMatch` block in `admin/.htaccess:40` (NB14). |
| **B3** | `public/contact.php:112-128`, `admin/inquiries.php:15` | The honeypot branch `exit`s **before** the per-IP rate limiter at `:130`, so honeypot POSTs are unlimited; neither path caps message length while `.user.ini` allows a 32 MB POST; `inquiries.php` reads the whole log with `file()` and fatals on memory. Fix: move the honeypot block below the limiter, cap `message` / `additionalNotes` in the accepted path too, and make `inquiries.php` read the tail rather than the whole file. |

### Phase 2 — non-blockers, in this order

Full detail and reproductions are in `AUDIT_v3_FINDINGS.md` §2. Short form:

1. **NB1** `public/.htaccess:24-27` — the `immutable, max-age=31536000` `FilesMatch` has
   **no path scope**, so it covers `/images/products/*`, `/uploads/images/*` and
   `/logo.svg` — all stable filenames written by the admin. A photo or logo Rick
   uploads never reaches a returning visitor. One-line fix: scope the block to
   `/assets/`. This is filed in `WHATS_LEFT.md` §2 as 4.32 "unoptimised images", which
   is the wrong framing — ship the scoping fix now, leave the image-weight work open.
2. **NB2** `public/.user.ini` — add `display_errors = Off` and `log_errors = On`. With
   display_errors on, an over-`post_max_size` POST emits a startup warning before
   `session_start()`, so the T3.5 "too large" page never renders and absolute server
   paths leak. One line; it makes a shipped fix actually work.
3. **NB4** `src/App.jsx:4397-4409` — allow-list `""` through `mergeSiteInfo` for
   `contact.fax`, the five `social.*`, `company.shortName` and `company.slogan`.
   **Keep the blank-drop for everything else** — invariant 4 is correct; `href="tel:"`
   and `© –2026` are worse than a stale fax number. Same asymmetry exists in
   `mergeContent`'s `copy` branch at `:4715` — lower stakes, same fix shape.
4. **NB5** `admin/edit.php:205` — repopulate the spec-table textarea from `$_POST` on
   invalid JSON. `add.php:88-97` is the correct pattern (the `WHATS_LEFT` note claiming
   add.php was "ported from edit.php" has it backwards).
5. **NB6 / NB7** `public/contact.php:172` and `:190, :246` — `s()` returns `null` and
   fatals on non-UTF-8 input (the `/u` modifier is a new regression from the T2.5
   rewrite); `trim($_POST['email'] ?? '')` has no `is_string()` guard. Both are
   unauthenticated 500s. Fix `s()` with `?: ''` or by dropping `/u`, and guard `email`
   the way `form_type` already is.
6. **NB8** `public/contact.php:102-107, 147-151` — a 403 (bad Referer) and a 429 (rate
   limited) both `exit` before `ipc_log_inquiry()`. The file's own comment at `:84`
   names this exact bug; only the absent-Referer half was fixed. Log the lead before
   returning either status.
7. **NB10** `admin/inquiries.php:90-93` — honeypot entries render as ordinary messages
   with a red "Email failed" badge and their `note` field is never shown, so the
   `$failed` counter Rick uses to detect broken mail is permanently non-zero. Render
   honeypot entries distinctly and exclude them from `$failed`.
8. **NB9, NB11, NB12, NB13, NB15, NB16, NB17, NB18** — read them and use judgement.
   NB12 (`content.php` saves the literal string `"Array"` and reports success) and
   NB18's four overflowing product pages at 375 px are the two worth doing; the rest
   are cheap if you are already in the file.

### Phase 3 — correct the records

**`WHATS_LEFT.md` §4 contains ten claims that did not reproduce** (`AUDIT_v3_FINDINGS.md`
§3). Correct them, but the decision/work logs are **append-only** — supersede, do not
silently rewrite. Mark each superseded line `SUPERSEDED-BY` with the date and the
correction. The ones that matter most:

- `4.25` "60 s TTL on the products cache" — `PRODUCTS_CACHE_TTL_MS` is **inert**;
  nothing ever re-evaluates it. Either wire it up or drop the claim and the comment at
  `App.jsx:4239` that still describes the bug as fixed.
- `T1.6` "44 saves, keep=30 → oldest kept = ROTATION 11, newest = LATER 28" —
  arithmetically impossible (34 entries) and the real answer is ROTATION 14 / LATER 27.
  The *behaviour* is correct; the evidence line is wrong and must not be used as a
  regression baseline.
- `4.15` per-recipient auto-reply cap — defeated by plus- and dot-addressing.
- `4.17` "no unauthenticated 500" — only the `form_type` half is true.
- `T1.7` "an empty key is still an intentional clear" — true on disk, false end-to-end.
- `T1.4` "10 other sections emptied; nothing re-seeds" — `seo: []` re-seeds.
- `T1.5` add.php/edit.php framing is inverted.
- `4.33` — the code half shipped, the `delete.php:105` confirmation text did not.
- `WHATS_LEFT.md:16` "Every T1, T2 and T3 item" — **T3.1 and T3.4 are in no section.**
  Both were in fact done; add them to §1.
- `4.10` reproduces but there is no "Last Updated" string on the Privacy page at all.

### Phase 4 — documentation

`AUDIT_v3_FINDINGS.md` §4 lists 18 errors across `README.md`, `admin/README.md`,
`Editing-Your-Site-Content.md`, `Email to Rick…md`, `CLAUDE.md`, `admin/help.php` and
`admin/auth.php`'s comments, plus a 12-row addendum for the `.docx`. Fix all of them.
These four are the ones that break the release premise and should be done first:

- **D1 / D21** — `admin/help.php:244` and the `.docx` both tell Rick to *ask his web
  developer* to change his password. `password.php` is in his nav and the handoff
  email's first instruction is to change it himself.
- **D2 / D22** — `help.php:369, 384` and the `.docx` send him to Google Drive/Dropbox
  for a "direct image link". `admin/index.php:186` renders a **Photo** upload button on
  every row.
- **D5** — `help.php:687`, the new "What your server allows" section, is emitted
  **after `</main>`**, has no nav link, and is excluded from the scroll-spy. Three
  documents point at it as the post-deploy verification step. Move it inside `<main>`
  and add it to the TOC at `help.php:149-170`.
- **D20** — four separate places tell Rick that restoring a backup is a developer job.
  `backups.php` is in his nav and is self-service.

Also settle **D9**: `README.md:94` calls `DEPLOY_READINESS_v2.md` §7 the authoritative
deploy manifest, then prints a table that differs from it in four rows, and `CLAUDE.md`
has a third variant. Resolution recorded by session 2: README's manifest is the live one
and should stop deferring to a frozen §7 — **but README and CLAUDE.md must both name
`data/products-all.json` and `pdfs/` as do-not-upload**, per the settled decision at
`WHATS_LEFT.md:93`. Do not edit §7 itself.

---

## Escalate to Keagan, do not decide yourself

Use the format `decision-needed | recommended | why | trade-off | blocked`. Log the
answer in `WHATS_LEFT.md` §3 **before** writing code.

1. **The `.docx` is his handoff collateral.** It is dated `2026-07-08`, revision 2,
   untouched by this release, and 12 of its statements are now wrong. Does he want it
   re-cut, or retired in favour of the in-app Help (which has the same five-tab hole and
   needs writing either way)? *Recommendation: retire the `.docx`, fix `help.php`, and
   send Rick one short page. Downside: he loses a printable artifact he may have already
   shown someone.*
2. **`.docx` Table 5 is a blank `Password |` row** designed to have the live admin
   password typed into it, and the handoff email attaches the file. That is the delivery
   channel T1.1 was about. *Recommendation: delete the Password row, give Rick the
   password out-of-band. This is his copy and his process — his call.*
3. **Git history rewrite for the exposed `_localsite/admin/config.local.php` hash**
   (commit `169c0d7`, repo confirmed public). Still open in `WHATS_LEFT.md` §3,
   **awaiting Keagan** since 2026-08-04. Restate it, do not re-derive it.
4. **Anything costing money.** $0 budget, genuine perpetual free tiers only.

Already settled — **do not re-open**: do not upload `data/products-all.json` or `pdfs/`
from the repo; do not resume the `src/pages/` / `src/components/` / `src/lib/`
extraction; no paid tooling.

---

## Rebuild the harness before you change anything

You must be able to prove every fix and re-run the regression sweep. This recipe worked
in session 2 — follow it rather than inventing one.

```bash
# 1. Stage the repo into the sandbox with device_stage_files (max 50 files/call).
#    Needed: src/{App.jsx,index.css,main.jsx}, admin/** (~29 files), public/** ,
#    data/*.json, package.json, vite.config.js, tailwind.config.js,
#    postcss.config.js, index.html, dist/**.
#    Code/text files stage fine in batches of ~30.
#    IMAGES AND PDFS WILL TIME OUT — do not try. Synthesize placeholders with the
#    real filenames instead (PIL for images, a two-line %PDF-1.4 stub for PDFs);
#    get the filename lists from device_list_dir. Path correctness is what is
#    testable; pixel content is not.

# 2. Copy out of the read-only staging dir, then build:
cp -r /mnt/user-data/uploads/Updated_IPC-main-main /tmp/repo
cd /tmp/repo && npm install && npm run build
#    Session 2 baseline: a fresh build reproduced the committed dist byte-for-byte —
#    index-CQHYB4O9.js 324,309 B and index-Dsw3_pYS.css 20,649 B. If your build
#    differs before you have edited src/, something is wrong with your tree.

# 3. Build a public_html mirror and serve it. Session 2's /tmp/mkmirror.sh recipe:
#    dist/. + public/{.htaccess,.user.ini,contact.php,robots.txt,sitemap.xml,
#    manifest.json,logo.svg,favicon.svg} + public/images -> <site>/images
#    + admin/ + data/ + pdfs/ + uploads/ (mkdir uploads/images).
#    Keep pristine copies of data/*.json in /tmp/pristine and RESTORE FROM THEM AFTER
#    EVERY DESTRUCTIVE TEST.

# 4. Set a known admin password in the MIRROR ONLY — never in the user's repo.
#    Use preg_replace_CALLBACK. A bcrypt hash contains $2y$12$, and plain
#    preg_replace eats those as backreferences — that exact bug is what T1.2 was.
php -r '$h=password_hash("audit-pass-123",PASSWORD_BCRYPT,["cost"=>12]);
  $t=file_get_contents("/tmp/repo/admin/config.local.php");
  $t=preg_replace_callback("/define\(\s*\x27ADMIN_PASSWORD_HASH\x27\s*,\s*\x27[^\x27]*\x27\s*\)\s*;/",
    function() use ($h){ return "define(\x27ADMIN_PASSWORD_HASH\x27, \x27".$h."\x27);"; }, $t, 1);
  file_put_contents("<site>/admin/config.local.php",$t);'

# 5. Router emulating the .htaccess SPA rewrite: real files and .php pass through
#    (return false), everything else falls back to index.html. Then:
printf 'sendmail_path = "tee -a /tmp/sent-mail.txt > /dev/null"\n' > /tmp/php-extra.ini
nohup php -c /tmp/php-extra.ini -S 127.0.0.1:8123 -t <site> /tmp/router.php > /tmp/php.log 2>&1 &

# 6. Playwright:
npm install playwright
#   chromium.launch({ executablePath: '/opt/pw-browsers/chromium-<ver>/chrome-linux/chrome',
#                     args: ['--no-sandbox'] })   # ls /opt/pw-browsers first
#   NOT `npx playwright install` — disabled in this environment.
```

### Gotchas that will waste your time

- **`php -S` ignores `.htaccess`.** The `admin/`/`data/` file blocks, the CSP header and
  the HTTPS redirect are not exercised locally. Apache is the real gate. Read the
  `.htaccess` files and reason about them; do not report `php -S` results for them.
- **`php -S` also ignores `.user.ini`.** The sandbox runs PHP's stock 2M / 8M / 1000, not
  the intended 24M / 32M / 5000. To exercise the `form_complete` truncation guard,
  restart the server with an artificially low `max_input_vars=100`.
- **The SPA rewrite makes a missing file return `200` + `index.html`, not 404.**
  `curl -w %{http_code}` will lie about missing images and PDFs. Check
  `naturalWidth === 0` in the browser instead.
- **opcache** revalidates every 2 s — `sleep 3` between rewriting `config.local.php` and
  verifying, or you get a false negative.
- **`pkill -f "php -S"` kills your own shell.** Kill by PID.
- **The container is PHP 8.4; the target is 7.4.** Array-typed input fatals on 8.4 but
  only warns and returns `null` on 7.4 — which for `add.php` is *worse*, not better.
  Check both behaviours when touching input handling.
- **Run the whole-page sweep, not just targeted checks.** Session 1 shipped a
  `ReferenceError` that crashed `/products` at both viewports; the `ErrorBoundary`
  swallowed it and three targeted checks reported plausible "not shown" results instead
  of failing. Only a 9-page × 2-viewport console sweep caught it.
- **The device bridge drops intermittently** (503, wall-clock timeout, "device
  disconnected"). Retry; `mcp__remote-devices__Desktop_Commander__read_multiple_files`
  is a working fallback for reads. `device_bash` cannot delete — `mv` into `_to_delete/`
  and say so.
- **The bash mount can lie** (truncated reads, false success). Confirm any claim about
  file contents with the `Read` tool; if they disagree, `Read` wins and say so.

---

## Definition of done

Do not report a fix as done without the artifact that proves it. Specifically:

1. `php -l` clean on all 20 PHP files; `node --check` clean on all admin JS.
2. All three `data/*.json` parse; 42 products.
3. `npm run build` with zero errors, and `dist/` regenerated to match the edited `src/`.
4. **9 public pages × 2 viewports (1440×900, 375×812): zero page errors, zero console
   errors, zero 4xx/5xx, zero horizontal overflow.** Run this after every frontend
   change, not once at the end.
5. All 14 admin pages: signed-in GET → 200 with zero `Warning:` / `Notice:` /
   `Deprecated:` / `Fatal error` in the body; signed-out GET → 302; signed-out POST →
   a rendered 403, not a redirect.
6. **B1 specifically:** POST `content.php` with a wrong `orig_sig` and a typed marker,
   and prove the marker survives in the re-rendered form. Then do the same with
   `form_complete` stripped and with a genuine `max_input_vars` truncation. Then confirm
   a *successful* save still works and the two-tab warning still fires — the fix must not
   defeat the concurrency guard it sits inside.
7. **B2 specifically:** with the flag file present and older than an hour, prove the
   reset form is refused and normal login works. With a fresh flag, prove the reset still
   works. Prove the dashboard banner appears.
8. **B3 specifically:** prove honeypot POSTs now consume rate-limit slots, that an
   oversized message is truncated, and that `inquiries.php` renders against a large log.
9. Re-verify the twelve `CLAUDE.md` invariants still hold after your edits. Session 2
   confirmed all twelve are genuinely enforced — a regression here is worse than the bug
   you were fixing.

Fix loops: **≤3 attempts, then stop and escalate.** Fix rounds are delta-only —
over-applying regresses passing work.

---

## Do not re-report or re-investigate these

Closed by session 2 with evidence. Raising one again costs a cycle.

- Sandbox artifacts, not defects: "41 of 42 datasheet PDFs are missing", "`logo.svg`
  doesn't exist", "`pdfs/marketing/` doesn't exist". All present on the real machine.
- "Six Industries links resolve to the wrong product" — it was one, it is fixed, and all
  42 SKUs + 42 ids + 18 industryDetail SKUs were re-resolved with zero misses.
- "Mega-menus broken on touch" — touch always worked; keyboard was the gap and is fixed.
- Apache 2.2 `.htaccess` syntax (`Order` / `Deny from all` / `LimitExcept`) — proven live
  on this host by `_localsite/`.
- `src/pages/`, `src/components/`, `src/lib/` are dead code — known and deliberate.
- The 17 items in `WHATS_LEFT.md` §2 — known, open, not launch gates. Session 2 examined
  them and reclassified exactly one (4.32 → the NB1 scoping half ships now).
- Security posture: `require_auth()` precedes all output on all 14 pages; `csrf_check()`
  guards all 9 mutating POST sites with no gaps; upload validation is extension + sniffed
  MIME with non-user-controlled filenames; `basename()` + `realpath()` containment is
  intact on every read/write/delete; every attacker-controlled echo goes through `h()`;
  session fixation is defeated; the sentinel is unsatisfiable against 200,007 candidates.
  All measured. **Re-verify after your edits, but do not re-derive from scratch.**

Still genuinely unverified (do not present as discoveries; close them if you can):
the host's real `post_max_size` / `upload_max_filesize` / `max_input_vars`; whether
Network Solutions honours `.user.ini`; whether `mail()` behaves the same there; whether
the customer has edited the live catalog since the last deploy; the `.htaccess` blocks
and the CSP line on the target. Also **not checked at all**: the two embedded PNGs in the
`.docx` (`word/media/image1.png`, `image2.png`) — if either is a dashboard screenshot it
shows the obsolete four-item header nav and needs recapturing.

---

## How to work and what to hand back

Standing rules apply: escalate business decisions (spend, credentials, irreversible data,
public copy) rather than deciding them; decide engineering calls yourself and report.
Keep a task list current. Multi-file changes go in a table (file → change). Root cause in
one line, before the fix. State kill/decision dates up front and restate them at every
check-in. Never report something as verified without the artifact that proves it. Own
your own mistakes specifically rather than hedging generically.

Hand back, short and dense, in this order:

1. **Fixed** — table of file → change, each with the command output or browser
   measurement that proves it.
2. **Not fixed and why** — anything you attempted and backed out of, with the reason.
3. **Escalations** — the four above plus anything new, in
   `decision-needed | recommended | why | trade-off | blocked` form.
4. **Records corrected** — which `WHATS_LEFT.md` lines you superseded and with what.
5. **Regression state** — the results of the nine "definition of done" checks.

Deploy is FTP of the **contents** of `/dist` into `public_html/`, plus `admin/`,
`admin/config.local.php`, and `public/.user.ini`. Do not upload `data/products-all.json`
or `pdfs/` — they are live customer state and an FTP overwrite creates no backup.
