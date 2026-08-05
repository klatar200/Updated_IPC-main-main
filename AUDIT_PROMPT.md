# Prompt for an adversarial audit session

Paste everything below the line into a **fresh** Cowork session. Attach nothing —
the session reads the repo itself.

---

## Your objective

A previous session executed a large fix workstream on the IPC website repo
against the audit in `DEPLOY_READINESS_v2.md`. It reported every item as fixed
and verified. **Your job is to find what it got wrong, missed, or broke.**

You are not re-running the original audit. You are auditing *the fixes*. Assume
the previous session was competent and that its own claims are the most
dangerous thing in the repo, because they will be believed. Your success
condition is a short list of **specific, reproduced defects** — not a
reassurance that things look fine. If after genuine effort you find nothing in a
category, say so plainly and say what you actually ran to reach that conclusion.

**"I read the code and it looks right" is not an audit result.** Every finding
you report must carry a reproduction: a command and its output, a browser
measurement, or a diff. Every *clean* verdict must carry the same.

**Repo:** `C:\Users\latar\Desktop\Updated_IPC-main\Updated_IPC-main-main`
(connected folder on device "asus")
**Baseline for diffing:** the working tree is dirty against `68d87e5`. Use
`git --no-optional-locks diff` and `git --no-optional-locks status` to see
exactly what changed. Do not `git checkout`, `reset`, `stash`, `commit`, or
`push` anything — the user's uncommitted work is the subject of the audit.

---

## Read these first, in this order

1. **`WHATS_LEFT.md`** — the previous session's own record. §1 is the claim
   list, §2 the open items, §3 the decisions, §4 the verification evidence and
   three self-corrections. **This is the document you are trying to falsify.**
2. **`DEPLOY_READINESS_v2.md`** — the original audit. Frozen. Use it to check
   that each item was actually addressed rather than reinterpreted into
   something easier.
3. **`CLAUDE.md`** — the invariants list. Twelve numbered invariants, each
   claiming to encode a real incident. Verify each one is genuinely enforced by
   the code and not just asserted in a comment.
4. `README.md`, `admin/README.md`, `Editing-Your-Site-Content.md`,
   `Email to Rick - Admin Dashboard Handoff.md` — rewritten. Fact-check them
   against the code, line by line, the way v2 §5 did to their predecessors.

---

## What this project is (so you can judge severity correctly)

An industrial distributor's website (insulationproducts.com — heat-shrink
tubing, sleeving, adhesives). Hybrid static + PHP admin, deployed by FTP to
Network Solutions shared hosting. No database, no runtime backend.

- **Frontend:** React 18 + Vite. `src/App.jsx` is the entire app (~8,500 lines,
  every page inline). `src/pages/`, `src/components/`, `src/lib/` exist but
  **nothing imports them** — ignore those folders entirely.
- **Admin:** PHP 7.4+ under `admin/`, session auth, flat JSON in `data/`.
- **Contract:** React fetches `/data/products-all.json`, `/data/site-info.json`,
  `/data/content.json` at runtime; the PHP admin writes them.
- **The audience for the admin is Rick** — the business owner, non-technical,
  around 60, uses FTP reluctantly. The premise of this release is that he can
  change content, business details, colors, logo and his own password without
  calling the developer. **Weigh every finding by whether it breaks that
  premise or costs a sales lead**, not by how interesting it is.
- **`_localsite/`** is a snapshot of the currently-deployed site — useful as a
  diff baseline for "what is new in this release".

---

## Inventory of what changed — and the claim attached to each

Work through this table. For each row the question is the same: *does the code
do what the claim says, completely, without breaking something adjacent?*

### Admin (PHP)

| File | Claim to test |
|---|---|
| `admin/config.php` | New shared `admin_password_write()` using `preg_replace_callback` + `opcache_invalidate()`. No shipped default password — `ADMIN_PASSWORD_SENTINEL` + `ADMIN_PASSWORD_CONFIGURED`. New `backup_path()` / `backup_list()` / `backup_sort_key()` / `backup_before_write()` with `BACKUP_KEEP = 30`. `csrf_fail_page()` with three reasons (`expired`, `mismatch`, `toolarge`). `csrf_check(bool $requireAuth = true)`. `require_auth()` renders instead of redirecting on POST. `session.gc_maxlifetime` 28800. `upload_error_message()`. `admin_writable()` / `data_writable()`. `audit_log()` returns bool. |
| `admin/config.local.php` | Fresh cost-12 hash. Nothing in the tree verifies `ipc-admin-2025` or `ipc-admin-2026` any more. |
| `admin/auth.php` | Recovery mode: `ALLOW-PASSWORD-RESET` unlocks a one-time "Set admin password" form; "Admin Not Configured" state when no hash exists and no flag file. Login POST is disabled while either state is active. `csrf_check(false)` on logout and on the reset form. |
| `admin/password.php` | Rewired onto `admin_password_write()`. Recovery text corrected in three places. |
| `admin/settings.php` | `orig_sig` optimistic-concurrency guard; `sf()` / `sfList()` helpers so an **absent** POST key keeps the stored value while an **empty** one still clears. |
| `admin/content.php` | `orig_sig` guard; `form_complete` hidden field as a `max_input_vars` truncation sentinel, which must be the last field in the form. |
| `admin/add.php` | Spec-table JSON validation ported from `edit.php`; textareas repopulate from `$_POST` on error. |
| `admin/backups.php` | Filename regex accepts the `-NN` suffix; listing ordered by `backup_list()`; each row shows an item count; copy updated to `BACKUP_KEEP`. |
| `admin/spectable-editor.js` | `adoptFromJson()` called on every Advanced-mode keystroke; `advMode`/`advInvalid` block submit on unparseable JSON; Advanced and Back are real `<button>` elements. |
| `admin/upload-pdf.php` | `upload_error_message()` per error code; `pdf_in_use()` collision check that refuses to overwrite another product's data sheet. |
| `admin/upload-image.php` | Checked `mkdir`; auto-writes `uploads/.htaccess`; per-code error messages. |
| `admin/delete.php` | Removes the uploaded photo unless another product uses it. |
| `admin/index.php` | Server-health banner driven by `admin_writable()` / `data_writable()` / `IMG_DIR` writability. |
| `admin/help.php` | New "What your server allows" section printing live `ini_get()` values and writability. Upload size text now reads from `ini_get()`. |
| `admin/audit-log.php` | Removed the non-existent `import` filter; added the actions that are actually written. |
| `admin/.htaccess` | CSP `img-src` now allows `https://placehold.co`. |
| `admin/unsaved.js` | **New.** `beforeunload` guard on admin forms + 5-minute `ping.php` keepalive with an expiry banner. Included on `edit.php`, `add.php`, `content.php`, `settings.php`, `password.php`. |
| `admin/ping.php` | **New.** Returns `{"ok":bool}`; deliberately does **not** call `require_auth()`. |
| `admin/README.md` | Rewritten: `sub` must be an array; PDFs and photos *are* auto-deleted; recovery flow; `config.local.php` is the file you must not overwrite; throttle claim softened. |

### Frontend

| File | Claim to test |
|---|---|
| `src/App.jsx` | `mergeContent` treats `[]` as a deletion. `mergeSiteInfo` drops blank strings. `CatalogSkeleton` / `CatalogError` extracted; providers, `Navbar`, `Footer` render above the loading/error gate; `needsCatalog` limits the gate to `/products` and `/dashboard`. `PRODUCTS_FETCH_TIMEOUT_MS` 12 s abort + null-guarded parse + `PRODUCTS_CACHE_TTL_MS` 60 s. `<ErrorBoundary key={page}>`. `useSearchParam` setter takes `{replace}`; `?family=` cleanup uses it. Mega-menu triggers get `onClick`/`onKeyDown`/`aria-haspopup`/`aria-expanded`. `normalizeSku()` / `skuSegmentMatch()` + a `notFound` banner instead of falling through to `products[0]`. `photoFailed` + `onError` in `ProductDetail`. Sticky bar wraps; body padding via `ipc-has-sticky-rfq`. JSON-LD `description` joined to a string. Contact form controls get `htmlFor`/`id`. Fax is no longer a `tel:` link. About-page `tel:` reads from site-info. Footer brand block reads company name / slogan / founded year / certifications. Privacy "Last Updated" no longer `new Date()`. `leadTimeSummary` on the Services page. `?part=` prefills the RFQ. |
| `src/index.css` | `.ipc-skeleton`, `@keyframes ipc-shimmer`, `.ipc-page-header`, `.sr-only`, `body.ipc-has-sticky-rfq` moved here so they exist before React mounts. |
| `public/contact.php` | `s()` no longer strips tags or HTML-escapes; new `hdr()` for header-bound values. Absent `Referer` accepted; present one compared by parsed host with subdomain tolerance. `form_type` type-guarded. Honeypot hits logged. Auto-reply rate-limited per recipient (3 / 24 h). `company_name` CRLF-stripped. |
| `public/.user.ini` | **New.** `upload_max_filesize` 24M, `post_max_size` 32M, `max_input_vars` 5000, `session.gc_maxlifetime` 28800. |
| `data/products-all.json` | `CC.photoUrl` corrected to `/images/products/CC.jpg`. |
| `data/content.json` | Aerospace SKU `IP37SH - IP36TH - IP39LH` → `IP37SH-IP36TH-IP39LH`. |
| `dist/` | Rebuilt; `dist/data/` and `dist/products-all.json` removed; stale hashed assets removed. |
| `.gitignore` | `dist/`, `_localsite/`, `admin/ALLOW-PASSWORD-RESET`, `_c.cjs`, `_check.cjs`, `_to_delete/` added. |

### Documentation

`README.md`, `CLAUDE.md`, `admin/README.md`, `Editing-Your-Site-Content.md`,
`Email to Rick - Admin Dashboard Handoff.md` rewritten;
`WHATS_LEFT.md` and `HANDOFF_PROMPT.md` added;
`AUDIT.md`, `IMPLEMENTATION_PLAN.md`, `MOBILE_AUDIT.md`,
`PRE_LAUNCH_FINDINGS.md`, `SITE_INFO_PLAN.md`, `DEPLOY_READINESS.md` retired
into `_to_delete/`.

---

## Places I would look first if I were you

These are the previous session's own suspicions about its own work. Treat them
as leads, not as a boundary — the point of a fresh pair of eyes is the things
that are not on this list.

1. **`mergeSiteInfo` now drops blank strings — so can Rick ever clear a field?**
   If he deletes the fax number in Business Details and saves, the JSON stores
   `""`, the merger drops it, and the page renders the **hardcoded default fax
   number**. That may be a new defect of exactly the kind T1.4 was about, just
   pointed the other way. Drive it: clear fax, clear a social link, clear
   `catalogPdfUrl`, clear `slogan`. Decide whether "can't clear a field" is
   worse than "blank field breaks the page", and say which fields matter.
2. **`mergeContent` now lets empty arrays through — what renders an empty
   array badly?** `svc.details` was guarded. Check every consumer of every
   array section: `stats` (a 4-up grid with 0 items), `companyNav` (an empty
   mega-menu that may still be focusable), `footerLinks`, `markets`,
   `capabilities`, `certifications`, `industryDetail[].products`,
   `privacySections`. Empty a section at a time in `data/content.json` and load
   every page at 1440 and 375. Look for crashes, invalid DOM, and empty
   bordered ghosts.
3. **`content.php` on a failed save.** The truncation and concurrency guards
   add error paths that did not exist. Does the form repopulate from `$_POST`,
   or does it re-read from disk and silently discard everything the owner
   typed? If it discards, that is the same class of bug as T1.5 and is a
   blocker. Test it by POSTing with a deliberately wrong `orig_sig`.
4. **The `ALLOW-PASSWORD-RESET` recovery is a new authentication path.** Reason
   about it adversarially. While the flag file exists, normal login is
   disabled — is that recoverable? Can any web-reachable code path create that
   file (check `upload-image.php`'s filename handling and the `uploads/`
   `.htaccess` it writes)? Is the reset form CSRF-protected in a session that
   does not exist yet? Does `csrf_check(false)` weaken the logout path?
5. **`require_auth()` now renders a 403 page on POST instead of redirecting.**
   Confirm no admin POST endpoint legitimately runs unauthenticated, and that
   the change did not break `auth.php`'s own logout or reset POSTs.
6. **Backup ordering.** The previous session got this wrong twice before
   settling on a parsed `(timestamp, sequence)` sort and a max-used+1 sequence
   allocator. Attack it: legacy filenames already on disk with no suffix, more
   than 99 saves in one second, a hand-placed file with a malformed name, a
   backup whose JSON is corrupt. Verify that pruning always removes the
   **oldest** and never the newest, and that every filename `backup_path()`
   can emit is accepted by `backups.php`'s restore regex.
7. **`needsCatalog` gating.** `Navbar` still receives `products`, which is `[]`
   while the catalog loads. On `/contact` or `/about`, does the Products
   mega-menu render empty and stay empty, or does it populate when the fetch
   resolves? An empty-but-focusable menu is a regression T2.4 would have
   caught.
8. **`skuSegmentMatch` splits on `[-/,]`.** Check it against all 42 real SKUs.
   Does any legitimate deep link that used to resolve now hit the not-found
   banner? Resolve all 18 `industryDetail` SKUs the way v2 §2.8 did, plus every
   `?productId=` value reachable from within the app.
9. **`contact.php`'s `s()` no longer escapes.** Follow every value to every
   sink: the `text/plain` mail body, the mail headers, `inquiries.jsonl`, and
   `admin/inquiries.php`'s rendering. Confirm exactly one escape at render and
   no injection anywhere. Pay attention to the new `honeypot` log entries —
   they carry raw `$_POST` values and an extra `note` field that
   `inquiries.php` was not written to expect.
10. **`unsaved.js`.** Does the `beforeunload` guard fire on normal Save (it
    must not)? Does `submitting` get set even when `spectable-editor.js`
    calls `preventDefault()` on the same submit event — leaving the guard
    permanently disarmed for the rest of that page's life?
11. **The two deploy manifests now disagree.** `README.md` says the
    authoritative manifest is `DEPLOY_READINESS_v2.md` §7, then prints its own
    table that includes `public/.user.ini` — which §7 does not, because §7 is
    frozen. Decide which is right and flag the inconsistency. Also check
    whether `.user.ini` and `.htaccess` are themselves protected from being
    served.
12. **Dangling references.** Six documents were retired. Grep the whole tree —
    including `admin/help.php` and the `.docx` — for links to `AUDIT.md`,
    `IMPLEMENTATION_PLAN.md`, `MOBILE_AUDIT.md`, `PRE_LAUNCH_FINDINGS.md`,
    `SITE_INFO_PLAN.md`, `DEPLOY_READINESS.md`, and for any remaining
    occurrence of `ipc-admin-2025`, `ipc-admin-2026`, or `_hash.php`.

---

## Rebuild the verification harness before you start

Do not audit from reading alone. Stand the site up the same way the fixes were
verified, so you can both reproduce their evidence and try to break it.

```bash
# 1. Stage the repo into the sandbox (device_stage_files, max 50 files/call).
#    You need: src/**, admin/**, public/** (including images), data/*.json,
#    pdfs/**, package.json, vite.config.js, tailwind.config.js,
#    postcss.config.js, index.html.
#    Stage in batches of ~10 — the bridge fails intermittently (503,
#    wall-clock timeout, "device disconnected"). Retry the failures.
#    mcp__remote-devices__Desktop_Commander__read_multiple_files is a working
#    fallback when device_stage_files is down.

# 2. Copy the staged tree somewhere writable (/mnt/user-data/uploads is
#    read-only), then build:
cp -r /mnt/user-data/uploads/Updated_IPC-main-main /tmp/repo
cd /tmp/repo && npm install && npm run build

# 3. Build a public_html mirror at /tmp/site:
#    dist/index.html + dist/assets/ + public/{.htaccess,.user.ini,contact.php,
#    robots.txt,sitemap.xml,manifest.json,logo.svg,favicon.svg}
#    + public/images/ -> /tmp/site/images/ + admin/ + data/ + pdfs/ + uploads/
#    Keep pristine copies of data/*.json somewhere for restoring after
#    destructive tests.

# 4. Set a KNOWN admin password in the MIRROR ONLY — never in the user's repo.
#    Use preg_replace_CALLBACK: a bcrypt hash contains $2y$12$, and plain
#    preg_replace eats those as backreferences. That exact bug is what T1.2 was,
#    so getting it wrong here gives you a false negative on the fix.
php -r '$h=password_hash("audit-pass-123",PASSWORD_BCRYPT,["cost"=>12]);
  $t=file_get_contents("/tmp/repo/admin/config.local.php");
  $t=preg_replace_callback("/define\(\s*\x27ADMIN_PASSWORD_HASH\x27\s*,\s*\x27[^\x27]*\x27\s*\)\s*;/",
    function() use ($h){ return "define(\x27ADMIN_PASSWORD_HASH\x27, \x27".$h."\x27);"; }, $t, 1);
  file_put_contents("/tmp/site/admin/config.local.php",$t);'

# 5. Router emulating the .htaccess SPA rewrite: real files pass through, PHP
#    executes, everything else falls back to index.html. Then:
nohup php -S 127.0.0.1:8123 -t /tmp/site /tmp/router.php > /tmp/php.log 2>&1 &
#    To capture mail() instead of sending it:
#      printf 'sendmail_path = "tee -a /tmp/sent-mail.txt > /dev/null"\n' > /tmp/php-extra.ini
#      php -c /tmp/php-extra.ini -S ...

# 6. Playwright — the bundled Chromium needs an explicit path:
npm install playwright
#   chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
#                     args: ['--no-sandbox'] })
#   NOT `npx playwright install` — it is disabled in this environment.
```

### Harness gotchas that will waste your time

- **`php -S` ignores `.htaccess`.** The `admin/` and `data/` file-blocking
  rules, the CSP header, and the HTTPS redirect are **not** exercised locally.
  Apache is the real gate. Do not report those as findings — but *do* read the
  `.htaccess` files and flag anything logically wrong in them.
- **The SPA rewrite makes a missing file return `200` + `index.html`, not 404.**
  `curl -w %{http_code}` will lie to you about missing images and PDFs. Check
  `naturalWidth === 0` in the browser instead.
- **opcache.** The sandbox runs `opcache.revalidate_freq=2`, so a rewritten
  `config.local.php` does not take effect for about two seconds. A
  password-change test run immediately after the write reports a false
  negative. `sleep 3` between the write and the verification.
- **`pkill -f "php -S"` kills your own shell** — the pattern matches the
  wrapper's command line. Kill by PID.
- **Run the whole-page sweep, not just targeted checks.** The previous session
  shipped a `ReferenceError` that crashed `/products` at both viewports; the
  `ErrorBoundary` swallowed it and three targeted checks reported plausible
  "not shown" results instead of failing. Only a 9-page × 2-viewport console
  sweep caught it. Do that sweep first, then the targeted work.
- **Restore `data/*.json` from pristine copies after every destructive test**,
  or later tests inherit corrupted state and you will chase ghosts.

---

## Coverage floor

Below this, the audit is incomplete. Go past it wherever the code invites it.

1. `php -l` on all 20 PHP files; `node --check` on all admin JS.
2. All three `data/*.json` parse; 42 products; no SKU drift between `data/` and
   `public/`.
3. `npm run build` with zero errors, and the committed `dist/` matches a fresh
   build of the current `src/`.
4. All 14 admin pages load signed-in with no PHP notice, warning or fatal in
   the body — and every one of them **while signed out**, confirming the right
   behaviour (redirect on GET, rendered page on POST).
5. 9 public pages × 2 viewports (1440×900, 375×812): zero page errors, zero
   console errors, zero 4xx/5xx, zero horizontal overflow.
6. Every `PROVEN` line in `WHATS_LEFT.md` §4 independently reproduced. Report
   any that does not reproduce, and any whose reproduction is weaker than the
   claim implies.
7. Every one of the 12 invariants in `CLAUDE.md` traced to the code that
   enforces it.
8. A destructive-input pass on the admin: empty every section, submit forms
   with fields omitted, with arrays where scalars are expected, with a stale
   `orig_sig`, with `form_complete` stripped, with a 30 MB upload, with
   malformed spec-table JSON. Nothing may report success while discarding data.
9. Security regression pass: confirm `require_auth()` still precedes all output
   on every admin page, `csrf_check()` still guards every mutating POST, upload
   validation is still extension+MIME with non-user-controlled filenames, path
   containment (`basename()` + `realpath()`) is intact, and every dynamic echo
   still goes through `h()`. The previous session touched all of these files.

---

## Do not re-report these

Each of these was already investigated and closed. Raising one again costs a
cycle and dilutes your real findings.

- **Sandbox artifacts, not defects:** "41 of 42 datasheet PDFs are missing",
  "`logo.svg` doesn't exist", "`pdfs/marketing/` doesn't exist". All present on
  the real machine; earlier sub-audits saw an incomplete file staging.
- **"Six Industries links resolve to the wrong product"** — it was exactly one,
  it is fixed in the data, and the matcher is hardened.
- **"Mega-menus broken on touch"** — touch always worked. Keyboard was the gap
  and is fixed.
- **Apache 2.2 `.htaccess` syntax** (`Order` / `Deny from all` / `LimitExcept`)
  — not a risk. `_localsite/` proves the identical syntax is live on this host.
- **`src/pages/`, `src/components/`, `src/lib/` are dead code** — known and
  deliberately not resumed. See `WHATS_LEFT.md` §3.
- **Everything already listed in `WHATS_LEFT.md` §2** — those 17 items are
  known, open, and deliberately not launch gates. Do not re-list them. **Do**
  tell me if you think one of them was misclassified and actually is a blocker,
  with the reasoning.

## Known-unverified — confirm, don't rediscover

These are stated as unverified in `WHATS_LEFT.md` §4. Do not report them as
discoveries; do tell me if you can close any of them.

- The host's real `post_max_size`, `upload_max_filesize`, `max_input_vars`.
  The sandbox used PHP defaults (8M / 2M / 1000).
- Whether Network Solutions honours `.user.ini` at all.
- Whether `mail()` behaves the same on Network Solutions.
- Whether the customer has edited the live catalog since the last deploy.
- The `.htaccess` file-blocking rules and the new CSP line on the target.

---

## Environment notes

- **`device_bash` runs on the user's machine** with the repo mounted read/write
  at `/sessions/<id>/mnt/Updated_IPC-main-main`. `bash` runs in the cloud
  container. **Separate filesystems** — a file written by one is invisible to
  the other.
- `device_bash` **cannot delete**. If you need something gone, `mv` it into the
  existing `_to_delete/` folder and say so.
- `git status` on the mount fails with `unable to unlink .git/index.lock` — use
  `git --no-optional-locks`.
- **Do not modify the repo** unless a finding is trivial, unambiguous, and you
  say clearly in your report that you changed it. This is an audit; the default
  is read-only. Never `git commit` or `git push`.
- The bash mount can lie (truncated reads, false success). Any claim about file
  contents should be confirmed with the `Read` tool; if they disagree, `Read`
  wins and you should say so.

---

## What to hand back

Short, dense, in this order. No preamble, no restatement of scope.

1. **Blockers** — defects that must be fixed before this is uploaded. For each:
   file and line, one-sentence statement of the defect, the concrete failure
   scenario (inputs → wrong output), and the reproduction with its output.
   Ranked most severe first.
2. **Non-blockers worth fixing** — same format, one line of reasoning each for
   why it is not a blocker.
3. **Claims in `WHATS_LEFT.md` §4 that did not reproduce** — quote the claim,
   show what you actually got. This section matters even if it is empty; say so
   explicitly if it is.
4. **Documentation errors** — statement, location, reality. Same standard v2 §5
   applied to the old docs.
5. **Coverage statement** — what you ran, what you could not run and why. Be
   specific about what your clean verdicts are actually based on. If you ran out
   of time or context somewhere, say exactly where.

Use the standing rules: escalate business decisions (spend, credentials,
irreversible data, public copy) rather than deciding them; decide engineering
calls yourself and report. `$0` budget, free tiers only. Keep a task list
current. Never report something as verified without the artifact that proves it.
Own your own mistakes specifically rather than hedging generically.
