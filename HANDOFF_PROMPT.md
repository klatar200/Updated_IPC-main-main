# Prompt for a new Cowork session

Paste everything below the line into a fresh Cowork session. Attach nothing — the session will read the repo itself.

> **Status 2026-08-04:** the fix workstream described below has been **executed**.
> All T1/T2/T3 items and the folded-in §4 items are shipped and verified — see
> `WHATS_LEFT.md` §1 and §4. This file is kept as the record of how the work was
> scoped and handed off. What is still open is in `WHATS_LEFT.md` §2, and the
> two items still blocked on Keagan are in `WHATS_LEFT.md` §3.
> Delete this file once the release is uploaded.

---

## Task

Continue a deployment-readiness workstream on the IPC website repo. A full audit is already done; your job is to **fix**, not re-audit. Start by reading `DEPLOY_READINESS_v2.md` in the repo root — it is the source of truth for what's broken, with severity tiers and a fix order in §9. Then read `WHATS_LEFT.md`, which records what has already been done against it.

**Repo:** `C:\Users\latar\Desktop\Updated_IPC-main\Updated_IPC-main-main` (connected folder on device "asus")
**Commit at audit time:** `68d87e5`, working tree clean.
**Goal:** get this release uploadable to the customer's Network Solutions hosting file manager.

---

## What this project is

An industrial distributor's website (insulationproducts.com — heat-shrink tubing, sleeving, adhesives). Hybrid static + PHP admin:

- **Frontend:** React 18 + Vite SPA. `src/App.jsx` is the *entire* app — 8,500+ lines, every page and component inline. `src/pages/`, `src/components/`, `src/lib/` exist but **nothing imports them** — they're an abandoned extraction. Edit `App.jsx`.
- **Admin:** PHP 7.4+ under `admin/`, session auth, no database. Flat JSON files in `data/`.
- **Contract:** React fetches `/data/products-all.json`, `/data/site-info.json`, `/data/content.json` at runtime with a per-minute cache-buster; PHP admin writes them. No rebuild needed for content edits.
- **Deploy:** FTP to `public_html/`. `data/`, `pdfs/`, `uploads/` are first-deploy-only — after that they're live server state owned by the customer.
- **`_localsite/`** is a snapshot of what's *currently* deployed. Useful as a diff baseline for "what's new in this release." It is now gitignored — it contains a live admin password hash.

**This release's premise:** the business owner (Rick, non-technical, ~60s, uses FTP reluctantly) can now change site content, business details, colors, logo, and his own password from the admin dashboard without calling the developer. Several of the blockers in the audit were that premise not actually working.

---

## Where things stand

Documents in the repo root:

- `DEPLOY_READINESS_v2.md` — the audit. 14 blockers, 11 reproduced in a running browser. **Frozen — do not edit it.** Record outcomes in `WHATS_LEFT.md` instead.
- `WHATS_LEFT.md` — current state: what shipped, what's open, what was deferred, and the verification evidence.
- `DEPLOY_READINESS.md` (v1, static-only) — superseded; §6 of v2 lists its errors. Safe to delete.
- `audit-evidence/*.png` — four screenshot reproductions.

---

## Blocked on Keagan — do not guess these

Ask him before touching the related code, and log his answer in `WHATS_LEFT.md` §3 before implementing.

| ID | Decision | Status |
|---|---|---|
| **D1** | What admin password ships, and how does Rick receive it? | **Answered 2026-08-04.** Fresh cost-12 hash generated, deployed as `admin/config.local.php`, plaintext sent out-of-band. `ipc-admin-2025` purged from all docs. |
| **D2** | Does `data/products-all.json` from the repo get uploaded? | **Answered 2026-08-04: no.** Download the server's copy, diff, merge only if the repo copy is genuinely ahead. An FTP overwrite is irreversible and creates no backup. |
| **D3** | Is `github.com/klatar200/Updated_IPC-main-main` public? | **Answered 2026-08-04: yes.** The committed `_localsite` admin hash was publicly exposed. Live password rotated as part of this release; the history-rewrite question is still open — see `WHATS_LEFT.md` §3. |

Everything else in §9 of the report is an engineering call — make it and report, per the standing rules.

---

## Rebuilding the verification harness

**Do not accept "looks correct" as evidence.** Every claim marked PROVEN was reproduced by running the thing. Rebuild the same harness before you start fixing so you can prove each fix:

```bash
# 1. Stage the repo into the sandbox (device_stage_files, max 50 files/call).
#    You need: src/**, admin/**, public/** (incl. images), data/*.json, pdfs/**,
#    package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html
#    (dist/ is gitignored now — build it in the sandbox instead of staging it.)

# 2. Build a public_html mirror at /tmp/site:
#    dist/index.html + dist/assets/ + public/{robots,sitemap,manifest,logo,favicon,contact.php,.user.ini}
#    + public/images/ -> /tmp/site/images/ + admin/ + data/ + pdfs/ + uploads/

# 3. Set a KNOWN admin password in the MIRROR ONLY (never in the user's repo).
#    Use preg_replace_CALLBACK — a bcrypt hash contains $2y$12$, and plain
#    preg_replace eats those as backreferences. That exact bug is what T1.2 was.
php -r '$h=password_hash("audit-pass-123",PASSWORD_BCRYPT,["cost"=>12]);
  $t=file_get_contents("admin/config.local.php");
  $t=preg_replace_callback("/define\(\s*\x27ADMIN_PASSWORD_HASH\x27\s*,\s*\x27[^\x27]*\x27\s*\)\s*;/",
    function() use ($h){ return "define(\x27ADMIN_PASSWORD_HASH\x27, \x27".$h."\x27);"; }, $t, 1);
  file_put_contents("/tmp/site/admin/config.local.php",$t);'

# 4. Router that emulates the .htaccess SPA rewrite (real files pass through,
#    PHP executes, everything else falls back to index.html), then:
php -S 127.0.0.1:8123 -t /tmp/site /tmp/router.php &

# 5. Playwright — the bundled Chromium needs an explicit path:
npm install playwright
#   chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
#                     args: ['--no-sandbox'] })
#   NOT `npx playwright install` — it's disabled in this environment.
```

Caveats that cost time:

- `php -S` **ignores `.htaccess`**, so the `admin/` and `data/` file-blocking rules are not exercised locally. Apache is the real gate. Don't report those as findings.
- The SPA rewrite means a missing image or PDF returns **200 + index.html**, not 404. `curl -w %{http_code}` will lie to you about missing assets — check `naturalWidth === 0` in the browser instead.
- **opcache.** The sandbox runs with `opcache.revalidate_freq=2`, so a rewritten `config.local.php` does not take effect for ~2 seconds. A password-change test run immediately after the write reports a false negative. `admin_password_write()` now calls `opcache_invalidate()`, but sleep 3 in tests anyway.
- **`pkill -f "php -S"` kills your own shell** — the pattern matches the wrapper's command line. Use the PID.
- Sandbox PHP defaults were `post_max_size=8M`, `upload_max_filesize=2M`, `max_input_vars=1000`. **The host's real values are unverified.** `public/.user.ini` tries to raise them; Admin → Help → "What your server allows" prints what actually applied.
- Restore `/tmp/site/data/*.json` from the staged originals after any destructive test.
- **Run the whole-page sweep, not just the targeted checks.** A regression I introduced (a state hook declared in the wrong component) crashed `/products` entirely; the ErrorBoundary swallowed it and three targeted checks reported plausible-looking "not shown" results instead of failing. Only the 9-page × 2-viewport console sweep caught it.

---

## Environment gotchas

- **`device_bash` runs on Keagan's machine** with the repo mounted read/write at `/sessions/<id>/mnt/Updated_IPC-main-main`. `bash` runs in the cloud container. **Separate filesystems** — a file written by one is invisible to the other.
- `device_bash` **cannot delete** — `rm`/`rmdir` fail with "Operation not permitted". To remove files, `mv` them into a `_to_delete/` folder under the repo and tell Keagan to delete it himself.
- `git status` on the mount fails with `unable to unlink .git/index.lock` — use `git --no-optional-locks status`.
- `device_stage_files` caps at 50 files per call, and **fails intermittently** (503s, wall-clock timeouts, "device disconnected"). Stage in batches of ~10 and retry the failures. `mcp__remote-devices__Desktop_Commander__read_multiple_files` / `write_file` is a working fallback when staging is down.
- **Per Keagan's standing rules:** any command you hand *him* must be PowerShell 5.1-valid, one per fenced block, no bash-isms. Never `>` or `Out-File -Encoding utf8` into a parsed file (UTF-16LE / BOM — both have caused incidents). Use the Write tool or tool-native output flags.

---

## Do not re-report these — already verified clean or already corrected

Re-raising any of these wastes a cycle:

- **Sandbox artifacts, not defects:** "41 of 42 datasheet PDFs are missing", "`logo.svg` doesn't exist", "`pdfs/marketing/` doesn't exist". All present on the real machine; earlier sub-audits saw an incomplete file staging.
- **"Six Industries links resolve to the wrong product"** — corrected to **exactly one**, and that one is now fixed in `content.json` plus hardened in the matcher.
- **"Mega-menus broken on touch"** — touch always worked. **Keyboard** was what was locked out, and that is now fixed.
- **Apache 2.2 `.htaccess` syntax** (`Order`/`Deny from all`/`LimitExcept`) — not a risk. `_localsite/` proves the identical syntax is already live on this host.
- **Verified correct, don't re-audit:** `require_auth()` on every admin page before any output; `csrf_check()` on every mutating POST (login excepted); upload validation is a strict allowlist with extension+MIME agreement and non-user-controlled filenames; no path traversal anywhere (`basename()` + `realpath()` containment); no unescaped output sinks; `edit.php`'s optimistic-concurrency guard works (and the same mechanism is now on `settings.php` and `content.php`); `backups.php` routes each of the three file types correctly; session hardening is correct; `php -l` clean on all 20 files under PHP 8.4; 42 products, zero SKU drift.
- **Build is healthy:** `npm install && npm run build` succeeds with 0 errors.

---

## Working style

Keagan's global rules are in effect. Short responses in this exact order: what's completed → errors → clarifying questions → next steps. No play-by-play, no scope restatement. Multi-file changes go in a table. Keep a task list current. Escalate business decisions (spend, credentials, irreversible data, public copy), decide engineering ones yourself. $0 budget — free tiers only. Never report something done without artifact or command output proving it; "looks correct" is not evidence. Own your own defects specifically rather than hedging generically. Commit/push only when asked.
