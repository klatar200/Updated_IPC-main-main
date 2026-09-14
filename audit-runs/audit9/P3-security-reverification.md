# P3 — security-reverification          agent: A   started/finished: 2026-09-14 15:08 / 2026-09-14 17:50 UTC   mirror: :8140  (records written 15:35; step 8's mail arm re-run at 17:35 after C's sendmail fix, self-correction 3)
findings:   Blocker 0 · High 0 · Medium 1 · Low 1

| ID | sev | class | where | one line |
| A-9.P3-1 | Medium | harness | `_harness/router.php:28` | Every private mirror on `:814x` resolves file existence — and executes `/sitemap.xml` — against the **sweep** mirror `_harness/site`, not its own docroot, so PLAN-11 §3.4's isolation does not hold. |
| A-9.P3-2 | Low | code | `admin/upload-image.php:104-116` | A 29-byte `GIF89a<?php … ?>` passes both the `getimagesize()` and the `finfo` MIME cross-check, lands as `uploads/images/<SKU>.gif` and becomes the product's live `photoUrl`. |

ledger:     done E047, E049, E055, E057, E058, E060, E062, E063, E064, E069, E073, E074, E075, E076, E080, E082, E093, E094, E103, E117, E120, E121, E177, E178, E179   blocked none
suites cited: plan5-throttle 12/12 · plan5b-pwthrottle 10/10 · audit5-blockers 18/18 · plan3-contact 51/51 · plan3-autoreply 22/22 · contactflow 85/85 (+ contactflow-selftest 26/26) · audit7-lead 23/23 · audit5-high 30/30 · audit5-medium 20/20 · invariants 17/17
instruments: none new (brief names none). Probes are shell/PHP under the artifact dir, all `BASE`-driven.
artifacts:
  _harness/out/audit9/P3/auth-offsets.txt        — step 1a, tokenizer byte offsets, 19 files
  _harness/out/audit9/P3/authoffsets.php         — the scanner that produced it
  _harness/out/audit9/P3/signedout.txt           — step 1b, 17 pages × {GET,POST} signed out
  _harness/out/audit9/P3/signedout.sh            — ″
  _harness/out/audit9/P3/csrf.txt + csrf.sh      — step 2, 11 mutating pages × {no token, wrong token}
  _harness/out/audit9/P3/escaping-raw.txt        — step 3, raw scanner output (273 sites)
  _harness/out/audit9/P3/escaping.php            — the scanner
  _harness/out/audit9/P3/escaping-dispositions.md— step 3, every site dispositioned
  _harness/out/audit9/P3/containment.txt + .sh   — step 4, 27 traversal payloads
  _harness/out/audit9/P3/uploads.txt + .sh       — step 5, 8 upload cases
  _harness/out/audit9/P3/creatable-vs-deny.md    — step 11, coverage table
  _harness/out/audit9/P3/php-dispoff.ini         — the one-off `display_errors=Off` ini used to separate the NB2 artifact from the T3.5 page
  _harness/out/audit9/P2/php-eall-nomail.ini     — `sendmail_path=/bin/false`, used to induce step 8's `mail()===false` independently of the fakemail artifact
  _harness/out/audit9/P7/mail.log                — the captured sales notification + auto-reply for step 8's success control
  _harness/out/audit9/I-admin/steps.md           — I-admin's rows, cross-checked against `signedout.txt` (see the last section)
out of brief: _harness/out/audit9/sweep-before.txt — `fgpatch` CRASHED ("expected 10 accent-2 text sites, found 1"); not one of PLAN-11 §4.4's four expected reds.
[UNVERIFIED]/[UNSOURCED]:
  [UNVERIFIED — Apache] every `.htaccess` rule *effect* (steps 9 and 11): `php -S` ignores `.htaccess` (GUARDRAILS §4.3). Pattern *coverage* is read, not measured.
  [UNVERIFIED — Apache] `public/.user.ini` limits (`display_errors=Off` in particular) — GO-LIVE.md C1/C3 verify.
  [UNVERIFIED — TLS] the `Secure` cookie flag under the live host's own HTTPS. The *logic* is verified: an `X-Forwarded-Proto: https` request to `:8140` returns `Set-Cookie: IPCADMIN=…; path=/; secure; HttpOnly; SameSite=Lax`.
self-corrections:
  1. A 26 MB upload to `:8140` first returned "Your sign-in session expired", which read like a broken T3.5 page. It is the **NB2 artifact of my own E_ALL ini** (`display_errors=On`): PHP prints the request-startup warning before `session_start()`, headers are sent, the session never starts. Re-run on the same mirror with `display_errors=Off` → `403` + `<h1>That upload was too large for this server` + "accepts up to 24M". Not a finding; it is exactly the incident `public/.user.ini:27-36` documents.
  2. `curl` of `/uploads/images/CC.gif` on `:8140` returned `Content-Type: text/html` (the SPA shell). That is A-9.P3-1's router bug, not a MIME finding — the file is not in `_harness/site`, so the router never let `php -S` serve it. Dropped from the polyglot record.
  3. The first `mail()===false` measurement (step 8 / P2 step 6) was taken while `sendmail_path = "../fakemail.sh"` resolved to a non-existent `_harness/out/audit9/fakemail.sh` — C's environment note of 2026-09-14 15:25. Re-run after C placed the file: the **success** path now returns `{"ok":true}` with the sales notification and the auto-reply both captured (`_harness/out/audit9/P7/mail.log`) and `"sent":true` in the JSONL. The failure path was then re-induced **deliberately and independently** of that artifact, with `sendmail_path = "/bin/false"` (`_harness/out/audit9/P2/php-eall-nomail.ini`), and still returns the phone-number message with `"sent":false`. Both rows below are the re-runs.

---

### A-9.P3-1 — MEDIUM — the audit's private mirrors are not private: every `:814x` server answers from the sweep's copy of the site for existence checks and for `/sitemap.xml`

class:        harness
pass:         P3 (found while standing the mirror up; it bites P7 rows C5 and C30 too)     ledger: E180 (adjacent), PLAN-11 §3.4
surface:      `_harness/router.php`, every agent mirror on `:8140`–`:8151`
where:        `_harness/router.php:28` — `$root = __DIR__ . '/site';`   (measured on 2121597, 2026-09-14)
not in §11:   checked GUARDRAILS §7, §7.1, §7.2, §7.3; PLAN-11 §11 and §12; `grep -n "router.php" plans/*.md audit-runs/*.md _harness/README.md`. §12 lists five environment artifacts for this round and this is not among them; every prior use of `router.php` was on `-t _harness/site`, where `__DIR__.'/site'` and the docroot are the same directory, so the bug could not show until PLAN-11 §3.4 introduced per-agent docroots.
reproduce:
  1. `cp -r _harness/site _harness/out/audit9/site-A`
  2. `php -S 127.0.0.1:8140 -t _harness/out/audit9/site-A -c _harness/out/audit9/php-eall.ini _harness/router.php &`
  3. Append one product to `_harness/out/audit9/site-A/data/products-all.json` (43 entries instead of 42).
  4. `curl -s http://127.0.0.1:8140/sitemap.xml  | grep -c '<loc>'`   → 52
  5. `curl -s http://127.0.0.1:8140/sitemap.php  | grep -c '<loc>'`   → 53
  6. Restore the file.
observed:     52 vs 53. `/sitemap.xml` is `require`d by the router from `_harness/site/sitemap.php` (`router.php:33-37`), whose `__DIR__` is `_harness/site`, so `sitemap.php:76` reads `_harness/site/data/products-all.json` — the sweep's catalog. Separately, a file that exists **only** in the private mirror (probe written to `site-A/_p2probe.php`) is answered with the SPA shell and HTTP 200 instead of being executed, because `router.php:41` stats it under `_harness/site`.
expected:     A private mirror serves only its own bytes. PLAN-11 §3.4 exists so that "a private mirror proves nothing on its own" (§10.1.12) is the only caveat on a `:814x` measurement; §3.2 caps concurrency but assumes disjoint docroots. The fix is one line — resolve `$root` from the server's docroot (`$_SERVER['DOCUMENT_ROOT']`, which `php -S -t` sets) and fall back to `__DIR__.'/site'`.
consequence:  Two classes of wrong measurement, both of which an agent would otherwise write up as site defects: (a) anything an agent adds to its own mirror is invisible and reads as "the route 404s / returns HTML"; (b) `/sitemap.xml` on a private mirror measures the sweep mirror's catalog — which is itself being mutated by the running sweep — so a sitemap assertion on `:814x` is neither this agent's data nor stable. It also means a private mirror **reads** the sweep mirror while the sweep is running, which PLAN-11 §3.4's "Nothing else touches `_harness/site`" forbids in spirit.
evidence:     the loc counts above; `_harness/router.php:28,33-37,41`; `public/sitemap.php:76`. No suite covers it — every existing suite runs on `-t _harness/site`.
verified-by:  —
outcome:      —
fix-proof:    —

### A-9.P3-2 — LOW — a 29-byte file that is not a usable image passes the "extension and content must match" check and becomes a product photo

class:        code
pass:         P3 step 5     ledger: E064, E082
surface:      `admin/upload-image.php` (Upload Photo), `uploads/images/`
where:        `admin/upload-image.php:104-116` (`getimagesize()` + `finfo` cross-check)   (measured on 2121597, 2026-09-14)
not in §11:   checked GUARDRAILS §7/§7.1/§7.2/§7.3; `audit-runs/audit5.md:410,420` (the traversal and upload-validation "Refuted" rows — they settle *filenames* and *SVG*, not the sniffer's tolerance); `audit-runs/audit7.md:411` (the `uploads/.htaccess` deny-by-default decision — a different rule); `grep -rni polyglot audit-runs plans _harness` returns only `PLAN-11 §6 P3 step 5`, i.e. the brief that asked for it. Not previously raised.
reproduce:
  1. `printf 'GIF89a' > /tmp/poly.gif && printf '<?php echo "PWNED"; ?>\n' >> /tmp/poly.gif`   (29 bytes)
  2. Sign in to the mirror admin, take the CSRF token from any page.
  3. `curl -b <jar> -F "csrf_token=$T" -F "image_file=@/tmp/poly.gif;type=image/gif" "http://127.0.0.1:8140/admin/upload-image.php?sku=CC"`
  4. `ls -la _harness/out/audit9/site-A/uploads/images/`
  5. read `photoUrl` for SKU `CC` out of `_harness/out/audit9/site-A/data/products-all.json`
observed:     HTTP 200, page message **"Photo uploaded and product updated."** — the same success text a real photo gets. `uploads/images/CC.gif` exists, 29 bytes. `photoUrl` is now `/uploads/images/CC.gif`. `getimagesize()` reports `16188 × 26736`, `mime image/gif`; `finfo` reports `image/gif`; the two agree, so the cross-check at `upload-image.php:112-115` passes. `image_downscale_in_place()` returns `'animation'` immediately for `gif` (`config.php:1676`), so the 432-megapixel claim is never acted on.
expected:     The brief's step 5 expects a refusal with the per-code message and nothing landing. The message on the page and `admin/help.php`'s own wording promise "extension and content must match"; here the content is six bytes of magic followed by PHP source.
consequence:  Post-authentication only (require_auth + CSRF both hold — this upload needed a signed-in session and a valid token), and **not** executable: `uploads/.htaccess:8-11` denies `.php|.phtml|.php[0-9]|.pht|.phar|…` and Apache does not hand `.gif` to PHP, so the stored bytes are served as an image and never run. The real harm is to Rick: a corrupt file is accepted with a success message and silently becomes the live product photo, so the product page shows a broken image with nothing in the admin saying why. Severity is Low by consequence (§7.1): no unauthenticated exposure, no execution, and the damage is visible on the page it breaks.
evidence:     `_harness/out/audit9/P3/uploads.txt` (row `GIF+PHP polyglot … LANDED`); `_harness/out/audit9/P3/uploads.sh`; the isolated re-run above. Suite coverage: none — `audit5-medium 20/20` covers `pdf_in_use()`, per-code refusals, same-file-twice and wrong-type, not a well-formed-header-only image.
verified-by:  —
outcome:      —
fix-proof:    —

---

## Step-by-step record

### Step 1 — auth gate
**1a (static).** `_harness/out/audit9/P3/authoffsets.php` walks `token_get_all()` and reports, per file, the byte offset of the first output token (`T_INLINE_HTML` with non-whitespace, `T_OPEN_TAG_WITH_ECHO`, `T_ECHO`, `T_PRINT`, or a call to `header/echo/print/printf/readfile/…`) against the byte offset of the first `require_auth`. Output: `auth-offsets.txt`.

All **13** gated entry points (`add, audit-log, backups, content, delete, edit, help, index, inquiries, password, settings, upload-image, upload-pdf`) are byte-identical at the top: `<?php\nrequire_once 'config.php';\nrequire_auth();` — `require_auth` at offset **33**, first output at offsets 242 … 46065. All top-level, none inside a function or a conditional. Excepted per the brief: `auth.php`, `ping.php`, and the two includes `config.php`, `nav.php` — and `nav.php` self-protects anyway (`require_auth` at 808, first output at 953). `public/contact.php` and `public/sitemap.php` are public by design.

**1b (live, `:8140`).** `signedout.sh`, 17 pages × {GET, POST}, no cookie. `signedout.txt`:
- 13 gated pages + `nav.php`: **GET → 302, 0 bytes.** No data, no 500, no server path.
- the same 14: **POST → 403, 1703 bytes, the sign-in page rendered** — invariant 12 (no 302 on POST). 14/14.
- `auth.php`: 200 sign-in page on both. `ping.php`: 200 `{"ok":false}`, 12 bytes. `config.php`: 200, **0 bytes** (it is an include; it emits nothing when requested directly, and `admin/.htaccess:58` denies it outright `[UNVERIFIED — Apache]`).
- server-path leak (`grep '/home/user/Updated_IPC-main-main'`): **0 of 34 responses.**
I-admin's `_harness/out/audit9/I-admin/steps.jsonl` had not been written when this ran, so these are my own rows, taken independently; I-admin's signed-out rows agree (see `## I-admin cross-check` below). The POST-without-session column is the part the brief says I-admin does not cover in any case.

### Step 2 — CSRF
Static map (`grep -n 'csrf_check' admin/*.php` vs the first `$_POST` per file). Eleven mutating entry points, every one with `csrf_check()` before any `$_POST` **read that executes**. Three needed reading rather than line-number comparison:
- `auth.php:17` — `isset($_POST['logout'])` is the dispatch condition; `csrf_check(false)` is line 18, before `audit_log()`/`session_destroy()`.
- `index.php:10` — `isset($_POST['close_reset_window'])` dispatch; `csrf_check()` line 11, before `@unlink()`.
- `settings.php:18` — inside the **definition** of `sf()`; the definitions at 18-42 do not execute. The first executing read is `sf()`/`sfList()` called after `csrf_check()` at line 46.
`csrf_check(false)` appears exactly twice, both in `auth.php`: `:18` logout, `:86` the FTP-unlocked password-reset form. As specified.

Live (`csrf.sh`, signed in, token withheld then wrong): `add, edit, delete, content, settings, backups, password, upload-image, upload-pdf, index, auth` — **22/22 rejected with 403**, `data/` md5 unchanged on every one, and the session survived (the logout POST was refused too). `edit/delete/upload-*` were re-run with `?sku=CC` in the query string because they redirect on an unresolvable SKU before reaching the POST branch; with a valid SKU they also return 403 and write nothing.

### Step 3 — escaping
`escaping-dispositions.md`. 273 non-literal echo sites; 181 `h()`, 20 int/`count()`/`number_format()`/`*urlencode()`, 58 code-authored constants or literal-branch ternaries, 14 helpers that escape internally. **0 findings.** `inquiries.php` re-read on today's file: all 15 visitor-supplied fields through `h()`, including both the `mailto:` href and the link text.

### Step 4 — containment
`containment.txt`, 27 requests. `?sku=../x`, `?sku=..%2fx`, `?sku=../../config.php`, `?sku=x%00.json`, `?sku[]=x` against `edit/delete/upload-pdf/upload-image` — **20/20 → 302 to `index.php?msg=Product+not+found`, 0 bytes, tree unchanged.** `backups.php` with `backup=../../config.php`, `..%2f..%2fconfig.php`, `evil.json`, `products-all.json`, `x%00.json`, `backup[]=x` — **6/6 → 200 with `Unrecognized backup filename.`**, nothing read, nothing written (the whitelist at `backups.php:59` runs after `basename()`+`as_str()`). The one `TREE-CHANGED` row is `upload-pdf.php?sku=CC` with `action=remove&file=../../etc/passwd`: the `file` parameter does not exist in the code and was ignored — what changed is `pdfs/CC.pdf` and `CC`'s own `pdfUrl`, i.e. the legitimate "Remove PDF" action the valid CSRF token authorised. `audit-runs/audit5.md:410` re-verified, not re-derived; today's code is unchanged in substance.

### Step 5 — uploads
`uploads.txt`, 8 cases against `upload-image.php?sku=CC` / `upload-pdf.php?sku=CC`:

| Case | Result |
|---|---|
| `.php` renamed `.jpg` | refused — "Only JPG, PNG, WEBP, or GIF images are accepted (extension and content must match)." nothing landed |
| SVG | refused, same message, nothing landed (SVG is not in `$IMG_TYPES`) |
| GIF+PHP polyglot | **landed** → A-9.P3-2 |
| valid 10×10 PNG (control) | accepted, `CC.png`, old `CC.gif` cleaned up |
| 9000×6000 PNG (54 MPx > `IMG_MAX_PIXELS` 40 MPx) | accepted **and the A-7.6 warning fires**: "⚠ It is too large for the server to resize automatically (over 40 megapixels), so it has been saved at its original size … Please resize it to about 1600 pixels wide and upload it again." |
| 26 MB PNG (> `post_max_size` 24M) | 403 + "That upload was too large for this server … accepts up to **24M** … **24M** per file" (see self-correction 1) |
| `.php` renamed `.pdf` | refused — "Only PDF files are accepted (extension and content must both be PDF)." |
| valid PDF (control) | accepted |

### Step 6 — session
`Set-Cookie` from `auth.php` on a signed-out GET: `IPCADMIN=…; path=/; HttpOnly; SameSite=Lax`. Name, `HttpOnly` and `SameSite=Lax` confirmed. `Secure` is absent over plain HTTP by design (`config.php:506-507,527`); with `X-Forwarded-Proto: https` the same request returns `…; path=/; secure; HttpOnly; SameSite=Lax`, so the flag logic is verified and only the live host's own `HTTPS` variable is `[UNVERIFIED — TLS]`.
A-7.3: `session.save_path` is `/var/lib/php/sessions`; **185 → 185** across 5 unauthenticated `ping.php` GETs, and `ping.php` sends no `Set-Cookie`. Control: one `auth.php` GET takes it to 186. A-5.26 strict mode also re-verified — a request carrying `IPCADMIN=deadbeefdeadbeefdeadbeefdeadbeef` does not create `sess_deadbeef…`; PHP mints its own id. The cookie-bearing `ping.php` case starting a session is the documented scope of A-7.3 (`audit-runs/audit7.md:325,418-422`), not a gap.

### Step 7 — throttle
Cited, not re-derived (the brief and `audit-runs/audit5.md:409` both forbid re-deriving parallelism): `plan5-throttle 12/12` and `plan5b-pwthrottle 10/10` in `_harness/out/audit9/sweep-before.txt`.

### Step 8 — contact abuse controls
All eight sub-items are asserted by suites that are green in this round's sweep, cited and not re-run:
`audit5-blockers 18/18` (CRLF through `hdr()`, the auto-reply relay, values stored as typed) ·
`plan3-contact 51/51` (inline errors, required-field parity) ·
`plan3-autoreply 22/22` (the Gmail-normalised cap key, sales notification always fires) ·
`contactflow 85/85` + `contactflow-selftest 26/26` (the happy path field-by-field into mail and JSONL, honeypot invisibility and keyboard-unreachability, the 429 panel carrying the phone number, double-submit, Back) ·
`audit7-lead 23/23` (slot consumption on every rejected path, the 200/5,000 caps, `mail()===false` → `sent:false` + the A-7.4 marker, referer variants).
Run by hand, because no suite asserts it on **this** mirror (both re-run after C's sendmail fix — see self-correction 3):
- success (`sendmail_path` = the harness `fakemail.sh`): `200 {"ok":true}`; `_harness/out/audit9/P7/mail.log` holds two messages — `To: sales@insulationproducts.com` / `From: IPC Website <noreply@insulationproducts.com>` / `Reply-To: p2success@example.com`, and the auto-reply `To: p2success@example.com` / `From: "Insulation Products Corporation" <noreply@insulationproducts.com>`; JSONL `"sent":true`.
- induced failure (`sendmail_path = "/bin/false"`): `500 {"ok":false,"error":"The mail server could not send your message. Please call 630.771.0700 or email sales@insulationproducts.com directly."}`; JSONL `"sent":false`; **no** `admin/.inquiry-log-failed.json` marker written, which is the A-7.4 control (the log write itself was healthy).

### Step 9 — headers
Rule text vs the settled list. `[UNVERIFIED — Apache]` throughout.

| Header | `public/.htaccess` | `admin/.htaccess` |
|---|---|---|
| `X-Frame-Options` | `:41` `SAMEORIGIN` | `:31` `DENY` |
| `X-Content-Type-Options` | `:42` `nosniff` | `:32` `nosniff` |
| `Referrer-Policy` | `:43` `strict-origin-when-cross-origin` | `:33` `same-origin` |
| HSTS under `env=IPC_TLS` | `:52-54` (`SetEnvIf` on **both** `X-Forwarded-Proto` and `HTTPS`) | `:45-47` (same pair) |
| CSP | **absent, deliberately** — `public/.htaccess:31` | `:49` `default-src 'self'; img-src 'self' data: https://placehold.co; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` |
| `X-Powered-By` | `ServerSignature Off` `:58` | `Header always unset X-Powered-By` `:10-11` |
Matches the settled list exactly. The admin CSP's `script-src 'self'` with no `'unsafe-inline'` is what `csrf-back.js` (E117) exists for — `config.php:445-452` names the measurement.

### Step 10 — secrets and runtime files
- `git grep -nE '\$2y\$1[0-9]\$' -- ':(exclude)audit-runs' ':(exclude)_harness/setpw.php'` → 10 hits, **all prose or synthetic**: `CLAUDE.md:128`, `PATCH_NOTES.md:13`, `GUARDRAILS.md:57`, `admin/config.php:149`, `_harness/invariants.js:89` (the incident comments, quoting the pattern); `WHATS_LEFT.md:4373`; `DEPLOY_READINESS_v2.md:35,53,77,78` (frozen, truncated, historical); `_harness/invariants-selftest.js:48` (`$2y$12$abcdefgh…` — the selftest's fixture, not a digest of anything). **No live hash tracked.**
- Invariant 2 holds: `admin/config.php:72` `define('ADMIN_PASSWORD_SENTINEL', '*not-configured*')` — not a valid bcrypt digest; `ADMIN_PASSWORD_CONFIGURED` additionally requires `/^\$2[aby]\$\d{2}\$.{53}$/` (`:76-77`).
- `git ls-files | grep -E 'config\.local\.php|\.jsonl$|\.login-throttle|ALLOW-PASSWORD-RESET|inquiry-log-failed'` → **empty**.
- `git check-ignore -v` resolves each: `.gitignore:29` `config.local.php`, `:31` `admin-log.jsonl`, `:37` `.login-throttle.json`, `:39` `.inquiry-log-failed.json`, `:40` `inquiries.jsonl`, `:41` `ALLOW-PASSWORD-RESET`, `:78` `_harness/site/`, `:80` `_harness/out/`.
- `git status --porcelain` at the end of this pass: `M _harness/audit9-adminflows.js`, `M _harness/audit9-strings.js` (I-crawl/I-admin agents, not mine), `?? audit-runs/audit9/`. Nothing of mine outside `audit-runs/audit9/` and `_harness/out/audit9/`.

### Step 11 — creatable files vs deny rules
`creatable-vs-deny.md`. Every filename the admin can emit, enumerated from the write sites (`file_put_contents`, `fopen('x')`, `rename`, `copy`, `move_uploaded_file`) and matched against the four rule sets. **All covered except `uploads/images/<name>.<pid>-<rand>.tmp`** (`config.php:1707`), which is the already-settled "no deny-by-default in `uploads/.htaccess`" decision (`audit-runs/audit7.md:411`, ledger E121) and is recorded there rather than raised: the file exists for two statements, holds a downscaled copy of an image that is about to be public at a stable URL, and needs an authenticated admin uploading a >1600px photo to exist at all.

### I-admin cross-check (step 1 baseline)
`_harness/out/audit9/I-admin/steps.md` rows 1-15 (signed-out GET) and 16+ (signed-out POST) agree with `signedout.txt` row for row: 13 gated pages + `nav.php` → 302 on GET, 403 on POST; `auth.php` and `ping.php` → 200. Two independent instruments, same result; no row differs.
