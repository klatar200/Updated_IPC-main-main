# P2 — php-runtime-host          agent: A   started/finished: 2026-09-14 15:05 / 2026-09-14 18:20 UTC   mirror: :8140 (E_ALL)
findings:   Blocker 0 · High 0 · Medium 2 · Low 0

| ID | sev | class | where | one line |
| A-9.P2-1 | Medium | code | `admin/config.php:1567` | `sku_problems()` calls `mb_strlen()` with no guard, so on a host without `mbstring` every Add Product and every Edit Product dies with a fatal — while `public/contact.php:402` guards the same extension and falls back, and nothing on the dashboard or the Help page checks for it. |
| A-9.P2-2 | Medium | code | `admin/upload-image.php:159-170` | With no `gd` extension the photo resizer returns `no-gd` and the oversize photo is kept at full size, but only the `too-many-pixels` reason is ever said out loud — so Rick gets the plain "Photo uploaded and product updated." and a multi-megabyte LCP image on the product page, with nothing anywhere naming the missing extension. |

ledger:     done E050, E166, E167, E168, E169, E180   blocked none
suites cited: audit7-lead 23/23 (the `mail()===false` arm and the A-7.4 marker) · plan10-admincrawl (no score line, green) — and re-run against `:8140` under E_ALL, see step 3
instruments: none new (the brief names none). `_harness/audit9-adminflows.js` (I-admin's, not mine) was **replayed** against `:8140` with `PHP_ERROR_LOG` pointed at this pass's log; `_harness/plan10-admincrawl.js` was re-run with `CRAWL_BASE=http://127.0.0.1:8140`.
artifacts:
  _harness/out/audit9/P2/sniff-hitlist.md      — step 2: the PHPCompatibility runs, the negative control, and every grep hit dispositioned
  _harness/out/audit9/P2/phpcompat-74.txt      — testVersion 7.4, 19 files, empty
  _harness/out/audit9/P2/phpcompat-74-84.txt   — testVersion 7.4-8.4, 19 files, empty
  _harness/out/audit9/P2/negctl-84.php · negctl-old.php — the two negative-control fixtures
  _harness/out/audit9/P2/phpcs/ · phpcs4/      — the two temporary composer installs (gitignored, not committed)
  _harness/out/audit9/P2/php-error.log         — step 3: the E_ALL log for the P7 flows + the adminflows replay + the admin crawl. **2 lines, both from the harness.**
  _harness/out/audit9/P2/php-error-p3.log      — the same log for the P3 flows. 6 lines, all from one deliberate over-`post_max_size` probe under `display_errors=On`.
  _harness/out/audit9/P2/negative-control.log  — proof the log pipeline can record anything at all
  _harness/out/audit9/P2/adminflows/steps.md · steps.jsonl — the 80-step replay on :8140
  _harness/out/audit9/P2/admincrawl/           — 43 screenshots, 13 admin pages × 3 viewports + 5 states, driven against :8140
  _harness/out/audit9/P2/extensions.md         — step 4: the extension table
  _harness/out/audit9/P2/php-eall-nomail.ini   — `sendmail_path=/bin/false`, used to induce the step-6 failure independently of the fakemail artifact
  _harness/out/audit9/P2/mailfail-body.txt     — the first (artifact-driven) step-6 capture, kept for the self-correction
out of brief: `_harness/router.php:30` — `rawurldecode(null)` on a `//`-prefixed path. It is the only thing in the E_ALL log and it is the harness, not the site; recorded in step 3 rather than raised as a site finding. (Same file as P3's A-9.P3-1, different line.)
[UNVERIFIED]/[UNSOURCED]:
  **[UNSOURCED] the production PHP version.** `admin/help.php:972` prints `PHP_VERSION` live on the Help page, behind login — an owner-supplied fact, and the launch instruction states it is unsourced. Audited for **both** ends as the brief requires: the 7.4 floor (step 2, clean) and 8.x cleanliness (step 3, clean on 8.4.19). Nothing in this pass is gated on the answer. GO-LIVE C1/C3 is where it gets sourced.
  **[UNVERIFIED] every directive in `public/.user.ini`** — `php -S` ignores it (GUARDRAILS §4.3). Reasoned from the rule text in step 5; GO-LIVE.md C1/C3 verify. Never reported as passing.
  **[UNVERIFIED] the `From:` mailbox** `noreply@insulationproducts.com` — its existence on the Network Solutions account is runbook step A (`GO-LIVE.md:49-50`), an owner action. Only the code path is verified here.
self-corrections:
  1. The first PHPCompatibility run (9.3.5 + PHPCS 3.13) reported **0 violations at testVersion 7.4** and I nearly recorded that as the result. Its negative control reported 0 as well — the package predates PHP 8.0 and has no forward sniffs — so the clean number was meaningless. Re-installed as PHPCS 4 + `dev-develop`, proved the control fires (5 errors on a 5-construct fixture), then re-ran. A tool that cannot fail is decoration (GUARDRAILS §4.4).
  2. The first `mail()===false` measurement was taken while `sendmail_path = "../fakemail.sh"` resolved to a file that did not exist on this mirror (C's environment note, 2026-09-14 15:25). Both paths were re-measured after C placed the file, and the failure path was then re-induced **independently** with `sendmail_path=/bin/false` so the T2.6 result does not rest on the artifact.
  3. Six warnings in the P3-era log (`session_set_cookie_params`/`session_name`/`session_start`/`http_response_code`/`Cannot modify header information`, all "headers already sent") are **not** step-3 findings. They are downstream of one line — `PHP Request Startup: POST Content-Length … exceeds the limit` — printed before any of the site's code runs, because **my own** ini sets `display_errors=On`. That is precisely the incident `public/.user.ini:27-36` documents (NB2), and production sets `display_errors=Off`. Re-run on the same mirror with `display_errors=Off`: 403 and the T3.5 page, "That upload was too large for this server … accepts up to 24M", no warnings.

---

## Step-by-step record

### Step 1 — the production PHP version
`admin/help.php:972` — `<tr><th>PHP version</th><td><code><?= h(PHP_VERSION) ?></code></td></tr>` — inside the
"What your server allows" panel, which also prints `upload_max_filesize`, `post_max_size`, `max_input_vars`
and `session.gc_maxlifetime` live. It is behind `require_auth()`, so only the owner can read it, and the launch
instruction states the value is **`[UNSOURCED]`**. Both ends were therefore audited: step 2 for the 7.4 floor,
step 3 for 8.x cleanliness. The panel is also the mechanism by which the owner sources it — `.user.ini:23-25`
tells him to open that page and compare, which is the C1/C3 check in `GO-LIVE.md`.

### Step 2 — the 7.4 floor
`_harness/out/audit9/P2/sniff-hitlist.md`. **PHPCompatibility at `testVersion 7.4`: 0 violations over 19 files**,
with the negative control proven first (5 errors on a fixture carrying `match`, `?->`, a union type, `: never`
and `str_contains()`). Repeated at `testVersion 7.4-8.4`: also 0. The independent grep for eleven 8.0+-only
constructs returns four hits, all dispositioned as comments or a regex delimiter, none of them code. **No
finding.** The finding criterion ("an 8.0+ construct without a guard while the floor is unknown") is not met,
so the unsourced version gates nothing here.

### Step 3 — 8.x cleanliness  *(run last, as the brief orders)*
Input: `_harness/out/audit9/P2/php-error.log`, written by `:8140` under `error_reporting = E_ALL`,
`display_errors = On`, `log_errors = On`. The pipeline was proven able to record before anything was read —
`negative-control.log` holds a deliberate `Undefined array key` warning produced by swapping the mirror's
`ping.php` for a probe and swapping it back (restored byte-identical to the repo file).

What filled the log:
- the whole of **P3** (17 admin pages × GET+POST signed out; 11 mutating pages × no-token and wrong-token; 27 traversal payloads; 8 uploads including a 26 MB over-`post_max_size` POST; session and throttle probes),
- the whole of **P7** (the four logic instruments — 34 + 74 + 37 + 17 checks — plus the C5 and C6 background runs, every negative-control run, the C23 reproduction and the C18 browser run),
- a **replay of `_harness/audit9-adminflows.js`** against `:8140` with `PHP_ERROR_LOG` set to this log: `steps 80 · statuses {200:39, 302:28, 403:13} · data-changed-steps 11 · error-log-lines 0`, mirror restored `byte-equal` on all three files,
- a **re-run of `_harness/plan10-admincrawl.js`** with `CRAWL_BASE=http://127.0.0.1:8140`: 43 screenshots over 13 admin pages at 1440/834/390 plus five interaction states, every page still authenticated,
- `sitemap.php` under seven catalog shapes (healthy, `null`, `"x"`, `{"products":[]}`, `[{"id":{}}]`, malformed JSON, **file missing**): `200 application/xml` every time, 52 `<loc>` healthy and 10 degraded.

**The log contains two lines.** Both are:

```
PHP Deprecated:  rawurldecode(): Passing null to parameter #1 ($string) of type string is deprecated
  in /home/user/Updated_IPC-main-main/_harness/router.php on line 30
```

`_harness/router.php` is the harness's `php -S` front controller. `parse_url('//products', PHP_URL_PATH)`
returns `null` (PHP reads `//products` as a scheme-relative URL whose path is empty), and line 30 passes that
straight to `rawurldecode()`. Apache never reaches this: `public/.htaccess`'s rewrite handles `//products`
before PHP is invoked, and there is no equivalent line in any shipped file. Recorded under "Out of brief";
it is the same file as P3's A-9.P3-1 but a different defect.

**Zero lines from `admin/*.php`, `public/contact.php` or `public/sitemap.php`** across every flow above.
Specifically searched for and not found: dynamic property creation, `${var}` string interpolation, null passed
to a non-nullable internal parameter, implicit float→int conversion, `strftime`, `utf8_encode`,
`FILTER_SANITIZE_STRING`. Independent grep over the scope for the last three: 0 hits.

The six lines in `php-error-p3.log` are the `display_errors=On` artifact — self-correction 3.

### Step 4 — extensions
`_harness/out/audit9/P2/extensions.md`. The health banner (`admin/index.php:151-232`) and the Help page's server
panel (`admin/help.php:967-977`) check folder writability and ini limits; **neither checks a single PHP
extension**.

| Extension | Needed | Guarded | Degrades | Banner names it | Verdict |
|---|---|---|---|---|---|
| `json` | yes (28 call sites) | no | fatal | no | not a finding — always available on 7.4+ in practice |
| `session` | yes | no | fatal | no | not a finding — bundled, enabled by default |
| `fileinfo` | optional | **yes**, `function_exists('finfo_open')` on both uploaders | PDF falls back to the `%PDF-` magic bytes; the image cross-check is silently skipped while `getimagesize()` still decodes the header | no | not a finding (guarded and commented) |
| `gd` | optional | **yes**, `extension_loaded('gd')` | oversize photo kept at full size | **no**, and the `no-gd` reason is never surfaced | **A-9.P2-2** |
| `mbstring` | `contact.php` treats it as optional; `config.php` assumes it | contact.php **yes**, config.php **no** | contact.php falls back to `strlen()`; `sku_problems()` fatals | no | **A-9.P2-1** |
| `openssl` | **not used** — `random_bytes()` uses the platform CSPRNG, `password_*`/`hash_equals` are core | — | — | — | the ledger row E168 lists it; the code does not use it |
| `iconv`, `intl`, `curl`, `zip`, `dom`, `simplexml` | zero call sites | — | — | — | not needed |

### Step 5 — `.user.ini` / `.htaccess`   `[UNVERIFIED]`
`php -S` ignores both (GUARDRAILS §4.3), so this is reasoning from the rule text and is labelled accordingly.
`public/.user.ini` sets `upload_max_filesize = 24M`, `post_max_size = 32M`, `max_input_vars = 5000`,
`max_file_uploads = 20`, `display_errors = Off`, `log_errors = On`, `session.gc_maxlifetime = 28800`.

Three things follow from the rule text and are worth stating plainly rather than reporting as passing:
1. **`.user.ini` applies only under CGI/FastCGI.** The file says so itself (`:3-7`). Under mod_php it is inert, and `upload_max_filesize` / `post_max_size` / `max_input_vars` are `PHP_INI_PERDIR` — they cannot be set from PHP code, so on a mod_php host they stay at the stock 2M/8M/1000 with nothing in the application able to compensate. The consequence is already designed for: `admin/help.php:968-970` prints all three live and the ini's own `:23-25` tells the owner "if they still read 2M/8M/1000, .user.ini is being ignored on this host; tell the developer". That is C1/C3's job, not this pass's.
2. **`display_errors = Off` is load-bearing, not hygiene.** Self-correction 3 measured what happens without it: an over-`post_max_size` POST prints a request-startup warning before `session_start()` runs, headers are already sent, and the T3.5 "That upload was too large" page cannot render — the admin sees "Your sign-in session expired" instead. `session.gc_maxlifetime` is the one directive here that is `PHP_INI_ALL`, and `admin/config.php:514` sets it at runtime as well, so that one survives a host that ignores the file.
3. `session.gc_maxlifetime = 28800` matches `config.php:514` and `CLAUDE.md`'s "8 hours". No disagreement.

### Step 6 — `mail()`
`public/contact.php:810` — `From: IPC Website <noreply@insulationproducts.com>`, hardcoded with the reason in
the comment above it ("Network Solutions requires the From address to exist on the account to pass their
outbound spam filter"). The auto-reply uses the same mailbox with an RFC-5322-quoted display name
(`:948-949`). **The mailbox must exist: `GO-LIVE.md:49-50` is the runbook A line**, and `GO-LIVE.md:238`
already maps the symptom back to it ("Form says 'mail server could not send' → the `noreply@` mailbox does not
exist on the account (step A)"). `[UNVERIFIED]` here by design — it is an owner action on the live account.

T2.6 confirmed, with the failure induced independently of the fakemail artifact (`sendmail_path=/bin/false`):

```
500  {"ok":false,"error":"The mail server could not send your message.
      Please call 630.771.0700 or email sales@insulationproducts.com directly."}
inquiries.jsonl:  {"ts":"…","type":"rfq","name":"P2Step6 Fail",…,"sent":false}
admin/.inquiry-log-failed.json:  not created  (the A-7.4 control — the log write itself was healthy)
```

The phone number is in the message, the lead is still recorded, and `$logEntry['sent']` is written **before**
the 500 (`contact.php:823-833`), so the failed send cannot lose the lead. Control, same mirror with the harness
sendmail restored: `200 {"ok":true}`, two captured messages (the sales notification `To: sales@…` /
`Reply-To: <visitor>`, and the auto-reply `To: <visitor>` / `From: "Insulation Products Corporation" <noreply@…>`),
JSONL `"sent":true`. Sweep line cited for the rest of the arm: `audit7-lead 23/23`.

---

### A-9.P2-1 — MEDIUM — Add Product and Edit Product die outright on a host without `mbstring`, and nothing warns

class:        code
pass:         P2 step 4     ledger: E168
surface:      `admin/add.php`, `admin/edit.php` (every save), the dashboard health banner, `admin/help.php`'s server panel
where:        `admin/config.php:1567` — `if (mb_strlen($sku) > 64) {` inside `sku_problems()`   (measured on 2121597, 2026-09-14)
not in §11:   checked GUARDRAILS §7/§7.1/§7.2/§7.3, `audit-runs/audit5.md` Refuted + Checked-no-finding, `audit6.md`, `audit7.md` §3/§4, `audit8.md`, `WHATS_LEFT.md` §2/§3, `CLAUDE.md` invariants 1-16. `grep -rn "mbstring\|mb_strlen" audit-runs/*.md plans/GUARDRAILS.md WHATS_LEFT.md` returns exactly one line — `audit-runs/audit9-ledger.md:179`, this round's own E168 row, which asks the question with a question mark. Never raised before.
reproduce:    Static, because the container's PHP has `mbstring` compiled in and it cannot be unloaded at runtime:
  1. `grep -n "mb_strlen\|mb_substr\|mb_str" admin/*.php public/contact.php public/sitemap.php`
     → `admin/config.php:1567`, `public/contact.php:403`, `public/contact.php:404` — three sites, no others.
  2. `sed -n '400,408p' public/contact.php` → `$mb = function_exists('mb_strlen') && function_exists('mb_substr');` on line 402, used on 403, with a `strlen()` fallback on 406.
  3. `sed -n '1556,1570p' admin/config.php` → `mb_strlen($sku)` on 1567, with no `function_exists` and no `extension_loaded` anywhere in the function or its callers.
  4. `grep -n "extension_loaded" admin/*.php` → one hit, `config.php:1674`, and it is for `gd`.
  5. `grep -n "healthProblems\[\]" admin/index.php` → five entries, all folder writability plus the reset window and the inquiry log; none names an extension. `sed -n '967,977p' admin/help.php` → four ini values, the PHP version and three writability rows; no extension row.
observed:     `sku_problems()` is called unconditionally on every Add and every Edit save (`add.php`, `edit.php`), and it is not inside a `try`. Without `mbstring` the request ends in `Fatal error: Uncaught Error: Call to undefined function mb_strlen()`. With `display_errors = Off` (which `public/.user.ini:43` sets) the owner gets a blank page; the product is not saved and nothing is logged.
expected:     One of the two treatments, consistently. Either `mbstring` is a requirement — in which case the dashboard health banner should say so when it is missing, the way it already does for four folders and the temp directory — or it is optional, in which case `config.php:1567` should use the same guard `contact.php:402` already uses (`function_exists('mb_strlen') ? mb_strlen($sku) : strlen($sku)`; for a 64-character SKU limit the difference is immaterial). What is wrong is having it both ways in one codebase: the same extension is treated as optional in the file that faces the public and as guaranteed in the file every admin page includes.
consequence:  If the production host lacks `mbstring`, the two screens Rick uses most — Add Product and Edit Product — are 100% non-functional, with no error text, no audit-log line and no banner. He would have no way to tell that from "the dashboard is broken". `mbstring` is present on most shared-hosting PHP builds, which is why this is Medium and not High; but the production PHP is **`[UNSOURCED]`** (step 1), the code itself already treats the extension as not guaranteed, and the gap is silent — the "needed + unchecked + silent" case the brief names.
evidence:     `_harness/out/audit9/P2/extensions.md`; the greps in `reproduce`. No suite covers extension absence.
verified-by:  —
outcome:      —
fix-proof:    —

### A-9.P2-2 — MEDIUM — without `gd`, a huge photo is accepted at full size and the success message says nothing

class:        code
pass:         P2 step 4     ledger: E168, E064
surface:      `admin/upload-image.php` (Upload Photo), and the product page the photo lands on
where:        `admin/config.php:1674` (`if (!extension_loaded('gd') || !function_exists('imagescale')) { $reason = 'no-gd'; return false; }`) vs `admin/upload-image.php:159-170` (the only place `$resizeReason` is read)   (measured on 2121597, 2026-09-14)
not in §11:   checked GUARDRAILS §7/§7.1/§7.2/§7.3 and the prior audits. `audit-runs/audit7.md:328` records A-7.6 as **fixed** — "`image_downscale_in_place()` takes a `&$reason` out-param; over the ceiling the owner is told the photo was saved at full size and asked to resize it" — and that fix is real and verified in this round (P3 step 5: a 9000×6000 PNG produces the ⚠ message). This is the *other* branch of the same out-param, which A-7.6 added but did not surface. Different reason code, same silence A-7.6 was raised to remove.
reproduce:
  1. `sed -n '1673,1690p' admin/config.php` — `image_downscale_in_place()` returns `false` with `$reason = 'no-gd'` when the extension is absent, and with `$reason = 'too-many-pixels'` over `IMG_MAX_PIXELS`.
  2. `sed -n '156,172p' admin/upload-image.php` — the success string appends a warning only for `$resizeReason === 'too-many-pixels'`. `no-gd`, `unreadable`, `no-loader`, `decode-failed`, `scale-failed`, `write-failed` and `rename-failed` all produce the bare "Photo uploaded and product updated."
  3. Positive control that the surfaced branch works, on any mirror: upload a 9000×6000 PNG to `upload-image.php?sku=CC` — the page says "⚠ It is too large for the server to resize automatically (over 40 megapixels)…" (`_harness/out/audit9/P3/uploads.txt`).
  4. `grep -n "extension_loaded('gd')\|gd" admin/index.php admin/help.php` → no hit: neither the health banner nor the Help page's server panel mentions `gd`.
observed:     Seven of the eight failure reasons are discarded. On a host without `gd` every photo wider than `IMG_MAX_WIDTH` (1600px) is stored at its original size and reported with the same words as a correctly-resized one. A modern phone photo is 3-6 MB at 4032px wide, and `upload-image.php` accepts up to 8 MB.
expected:     The same treatment A-7.6 gave `too-many-pixels`: say what happened. `no-gd` in particular is not a property of the file, so it will recur on every upload until the host changes — it belongs on the dashboard health banner beside the folder-permission rows, not only in a per-upload message. The remaining five reasons (`unreadable`, `no-loader`, `decode-failed`, `scale-failed`, `write-failed`, `rename-failed`) are per-file and a single "the photo was saved at its original size" line covers them.
consequence:  Rick believes the dashboard is protecting page weight; it is not, and he has no way to find out. The photo becomes the product page's eagerly-loaded LCP image — `audit-runs/audit7.md`'s A-7.6 note makes exactly that argument for the `too-many-pixels` branch. The buyer pays for it on mobile. Medium rather than High because it needs a host without `gd` (uncommon but not rare on shared hosting) and because the page still works — it is slow, not broken.
evidence:     `_harness/out/audit9/P2/extensions.md`; `_harness/out/audit9/P3/uploads.txt` (the positive control for the branch that *is* surfaced). No suite covers extension absence; `audit5-medium 20/20` covers per-code refusals, not resize reasons.
verified-by:  —
outcome:      —
fix-proof:    —
