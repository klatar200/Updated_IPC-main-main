# Adversarial audit of the fix workstream — 2026-08-04

Subject: the uncommitted working tree at `68d87e5`, audited against `WHATS_LEFT.md`,
`DEPLOY_READINESS_v2.md` and `CLAUDE.md`. Nothing in the repo was modified.

Harness: repo staged to `/tmp/repo`, five isolated `public_html` mirrors served by
`php -S` (PHP 8.4.21) with SPA-rewrite routers, `mail()` captured via
`sendmail_path = tee`, Chromium 147 via Playwright, admin password reset to a known
value **in the mirrors only**.

---

## 1. Blockers

### B1 — `admin/content.php:489` — every error path re-renders the form from disk; Rick's typed edits are destroyed, and the retry reports success

`$content = $storedContent;` runs unconditionally after the POST block.
`settings.php:134` (`$info = $updated; // repopulate the form with submitted values on error`),
`edit.php:185` (`$product = $updated;`) and `add.php:79` all repopulate from `$_POST`.
`content.php` alone does not. All three of its error paths hit this line: stale
`orig_sig`, `form_complete` truncation guard, and `save_content()` failure.

Failure scenario: Rick spends 40 minutes rewriting FAQ answers and About copy in the
Page Content editor (762 form fields, ~21 KB of long-form text). Another tab — or his
own earlier save — moved the signature. He clicks Save. He gets "Your edits were NOT
saved. Reload… then re-apply your changes — submitting again will overwrite the other
change." The form he is looking at now holds the **disk** values. He follows the
instruction, clicks Save again, and gets a green "✅ Content saved". His work is gone
permanently and he has been told it succeeded. The error page even carries a
**refreshed, valid** `orig_sig`, which is what makes the second save go through.

Reproduction (my own, on `/tmp/site`, independent of the subagent run):

```
$ # 471 fields harvested from the rendered form, 20 fields edited (+390 chars),
$ # orig_sig replaced with garbage
$ curl -s -b jar -X POST --data-binary @body1.txt .../admin/content.php
http=200
--- error text:
<li>This page content was changed by another session (or another browser tab) since
you opened this page. Your edits were NOT saved. Reload to see the current version,
then re-apply your changes — submitting again will overwrite the other change.
--- RICKTYPED occurrences in response: 0
--- new orig_sig in error page: name="orig_sig" value="355bb4abf220c8b726a0ff9148fe40c91f01d151"
```

Confirmed in a real two-tab browser run as well (228 chars typed in tab A, tab B saves,
tab A refused, `typed text still present? false`, second Save → `?saved=1` + green
banner, disk holds the pre-edit values). Same behaviour on the `form_complete` path
(reproduced with a genuine PHP truncation at `max_input_vars=100`) and on the
`save_content()` failure path (`data/` read-only).

Minimal fix: `if (!empty($errors)) { $content = $out; }` before line 489. Caveat: on the
*truncation* path `$out` only holds what survived, so that path wants a section-wise
merge over `$storedContent` rather than a straight swap.

Severity: this is the same class as T1.5, in the one editor that holds the most
irreplaceable typing, and it was introduced by this release's new error paths.

---

### B2 — `admin/config.php:68-69` + `admin/auth.php:51` — the `ALLOW-PASSWORD-RESET` window never expires, is never surfaced, and while open any unauthenticated client on the internet can take the account

`password_reset_unlocked()` is a bare `file_exists()`. There is no mtime check, no
expiry, and no dashboard warning. The design comment argues that creating the file
requires FTP so it is not a login bypass — true for *creating*, irrelevant for *using*.
`csrf_check(false)` binds the token to the requester's own session, so an attacker
fetches the page, takes the token it hands him, and posts.

```
$ touch /tmp/site/admin/ALLOW-PASSWORD-RESET
$ curl -s -c att.txt .../admin/auth.php | grep -oE '<h1>[^<]*'
<h1>Set Admin Password
$ curl -s -b att.txt -c att.txt -X POST \
    -d "set_password=1&csrf_token=$TOK&new_password=attackerownsyou&confirm_password=attackerownsyou" \
    .../admin/auth.php
reset POST: 302 -> .../admin/index.php
$ curl -s -b att.txt .../admin/ping.php        →  {"ok":true}
$ curl -s -b att.txt .../admin/index.php       →  200
$ ls admin/ALLOW-PASSWORD-RESET                →  No such file (consumed)
$ sleep 3; login with audit-pass-123           →  200 (rejected — Rick is locked out)
```

Three things turn a short accepted risk window into an unbounded one:

1. **No expiry** — `grep -n 'PASSWORD_RESET_FLAG\|password_reset_unlocked' admin/*.php`
   shows only `file_exists()` at `config.php:69` and `@unlink()` at `:147`. Nothing
   consults `filemtime()`.
2. **No warning** — `grep -c 'password_reset_unlocked\|ALLOW-PASSWORD-RESET' admin/index.php`
   → `0`. The health banner covers `admin/`, `data/` and `uploads/images/` writability
   but not an open reset window.
3. **A signed-in admin can never see the screen** — `auth.php:32-35` redirects to
   `index.php` before the reset block, so if Rick uploads the flag with a live session
   he is bounced to the dashboard and the file just sits there.

The realistic dead-end: `admin_password_write()` returns `ok=false` when `admin/` is not
writable — the exact host condition this release already ships a banner for. Rick
uploads the flag, the reset errors out, he calls the developer, and a world-writable
admin-password endpoint is live on the public site indefinitely.

Also note `auth.php:76`: while the flag is present the *correct* password is refused
(`<h1>Set Admin Password` in response to a valid login POST), so Rick has no way back
except completing the reset or deleting the file over FTP.

Fix is small: reject the flag if `filemtime() < time() - 3600`, and push an entry into
`$healthProblems` on `index.php` when it exists.

Honest scoping: this is only exploitable while the flag file exists, which requires Rick
to have uploaded it. I am calling it a blocker because the release *documents this as
the standard recovery procedure*, the window has no upper bound, and the most likely
reason a reset is needed at all (unwritable `admin/`) is also the reason it will fail
and leave the window open.

---

### B3 — `public/contact.php:112-128` — the honeypot branch bypasses the rate limiter, and neither path caps message length; `admin/inquiries.php` fatals once the log grows

The honeypot `if` at :112 `exit`s **before** the per-IP limiter at :130, so honeypot
POSTs never create or consume a slot. `admin/inquiries.php:15` reads the whole file with
`file()`.

```
$ 20 honeypot POSTs (2 KB message each)
20 reqs / 481 ms -> 44140 bytes; rate-limit files created: 0
   → extrapolates to ~5.3 MB/min from a single IP

$ ls -la admin/inquiries.jsonl   # 65,167,780 bytes
$ curl -s -b cookies .../admin/inquiries.php
Fatal error: Allowed memory size of 134217728 bytes exhausted (tried to allocate 20480
bytes) in /tmp/siteD/admin/inquiries.php on line 15
   (bisected: 43 MB / 20,000 entries still renders 200; 65 MB fatals at memory_limit=128M)
```

The accepted path is worse per-request: there is no `message` / `additionalNotes` length
cap, and `.user.ini` sets `post_max_size = 32M`.

```
$ curl ... --data-binary @1mb-message-body   →  200 {"ok":true}
mail bytes: 1049617   jsonl bytes: 1048735
```

Failure scenario: the page Rick relies on as the "no lead is ever lost" safety net goes
permanently blank, and his only recovery is FTP-deleting a file that also contains every
real lead. A handful of 32 MB submissions gets there in seconds; ordinary bot traffic
gets there slowly on its own.

Minimum fix: move the honeypot block below the rate limiter, cap `message` /
`additionalNotes` in the non-honeypot path, and make `inquiries.php` read the tail
rather than `file()`.

---

## 2. Non-blockers worth fixing

Ranked by value to Rick.

**NB1 — `public/.htaccess:24-27` — the year-long `immutable` cache is not scoped to `/assets`, so a photo or logo Rick uploads never reaches a returning visitor.**
The `FilesMatch "\.(?:js|css|woff2?|…|png|jpg|jpeg|gif|webp|ico)$"` block has no path
scope, so it applies to `/images/products/*`, `/uploads/images/*` and `/logo.svg` — all
of which have **stable filenames** written by the admin. `immutable` means the browser
will not even revalidate. Not a blocker: new visitors see the new image immediately.
Worth calling out because `WHATS_LEFT.md` §2 4.32 files this under "9.3 MB of
unoptimised images", which frames it as an image-weight project; the actual defect is a
mis-scoped rule and the fix is wrapping the block in `<Directory "…/assets">` or
narrowing the pattern. **I think 4.32 is misclassified** — not as a blocker, but the
one-line half of it should ship with this release, because "change your own logo and
product photos" is a headline promise of the handoff.

**NB2 — `public/.user.ini` — no `display_errors = Off`, which defeats the T3.5 "too large" page and leaks absolute server paths.**
Two agents found this independently. With `display_errors` on, PHP's
"POST Content-Length exceeds the limit" startup warning is emitted before
`session_start()`, the session never starts, and `require_auth()` fires the *wrong*
page:
```
display_errors=On  : 30MB upload → HTTP 200  "<h1>Your sign-in session expired</h1>"
                                   + "<b>Warning</b>: … in <b>/tmp/siteC/admin/config.php</b> on line <b>265</b>"
display_errors=Off : 30MB upload → HTTP 403  "<h1>That upload was too large for this server</h1>"
```
Not a blocker only because the target's `post_max_size` will be 32M and the host may
already default to `Off`. `.user.ini` already tunes six directives; this is one more
line, plus `log_errors = On`.

**NB3 — `src/App.jsx:4242` — `PRODUCTS_CACHE_TTL_MS` is inert; the staleness bug it documents is still live.** See §3.

**NB4 — `src/App.jsx:4397-4409` `mergeSiteInfo` — Rick can never clear a scalar Business Details field.**
Every scalar in `site-info.json` is unclearable; `settings.php` writes `""`, the merger
drops it, the hardcoded default renders. Measured by blanking every string in the file:
the site rendered byte-identical to pristine (`fax 630.771.0701` still present twice on
`/contact`, `© 1974–2026`, `foundingDate 1974-01-01`, 5 `sameAs` entries).
Which of these actually matter: **`contact.fax`** (renders in 4 places + JSON-LD
`faxNumber` — a distributor that drops its fax line cannot remove the number) and the
five **`social.*`** URLs (JSON-LD `sameAs` only — a deleted account keeps being
advertised). `slogan`, `shortName`, `stats.*`, `hours.text` are cosmetic.
**Verdict on the framing in your prompt:** "can't clear a field" is clearly the better
failure mode. `href="tel:"` and `© –2026` are visible to every visitor; a stale fax
number is visible only to someone who tries to use it. **Do not revert invariant 4.**
The fix is an allow-list: honour `""` for `contact.fax`, the five `social.*`,
`company.shortName` and `company.slogan`; keep blank-drop for everything else.

**NB5 — `admin/edit.php:205` — invalid spec-table JSON is discarded and the textarea re-renders the stored value, under the message "Fix the syntax."**
```
POST specTable2_json = <2,510 chars, trailing comma> to edit.php?sku=IP33PO
error: "Size / Dimension Table JSON is invalid (Syntax error). Fix the syntax…"
typed text 'BROKEN-RICK-EDIT' present in re-rendered form? 0
st2 textarea identical to pre-edit disk value? True
```
Not a blocker: `spectable-editor.js:556` blocks the submit client-side while Advanced
text is unparseable, so it needs JS off or broken. Note the `WHATS_LEFT` framing is
inverted — `add.php` does this correctly and `edit.php` does not, not the other way
round.

**NB6 — `public/contact.php:172` — `s()` returns `null` and fatals on any input that is not valid UTF-8.** New regression from the T2.5 rewrite (the `/u` modifier on the control-character `preg_replace`). `HTTP 500`, empty body, nothing logged. Applies on 7.4 too. Browsers always send valid UTF-8, so this is fuzzer/attacker-only. Fix: drop `/u`, or `?: ''` the result.

**NB7 — `public/contact.php:190, 246` — `trim($_POST['email'] ?? '')` has no `is_string()` guard.** `email[]=a@b.test` → uncaught `TypeError`, unauthenticated 500 + path disclosure. Same defect class 4.17 claims to have closed. (PHP 8 behaviour; 7.4 warns and degrades to a 422.)

**NB8 — `public/contact.php:102-107, 147-151` — a rejected `Referer` (403) and a rate-limited submission (429) both `exit` before `ipc_log_inquiry()`.** The file's own comment at :84 names exactly this bug ("the lead was never logged because the 403 exited before `ipc_log_inquiry()`") — only the *absent*-Referer half was fixed. Realistic loss: five engineers behind one corporate NAT filing RFQs inside 10 minutes; the sixth vanishes with no record. Not a blocker because the visitor sees the phone number.

**NB9 — `public/contact.php:97-101` — an unparseable `Referer` is treated as hostile rather than as absent.** `garbage`, a path-only `Referer`, and `android-app://com.google.android.gm` all 403. Same reasoning as invariant 11.

**NB10 — `admin/inquiries.php:90-93` — honeypot entries render as ordinary messages with a red "Email failed" badge, and the `note` field is never shown.** `$failed` (the counter Rick uses to know mail is broken) is permanently non-zero, so he will chase phantom failures. 4.18 logs the hit; the viewer was never taught about it.

**NB11 — `admin/add.php:190` — `specTable1_title` is hardcoded `value="Specifications:"`, not repopulated from `$_POST`.** A custom heading is lost on any validation error while the rows beside it repopulate correctly.

**NB12 — array-typed POST values.** `content.php` saves the literal string `"Array"` and reports success (`copy.hero.subhead == 'Array'`); `add.php`/`edit.php` fatal on 8.4 and, on the target's 7.4, would *silently add a product with the field blank*. `settings.php` handles it correctly via `sf()`'s `is_string()` guard. Not reachable from the rendered forms.

**NB13 — `admin/config.php:345, 375` — beyond 99 same-second saves the hex collision suffix loses all ordering and pruning deletes newer backups.** Measured with 140 saves in one second: `monotonic in save order? NO`. Unreachable through the web UI (100 HTTP saves inside one second). `-01..-99` is fully correct.

**NB14 — `admin/.htaccess:40` — the `FilesMatch` block does not match `ALLOW-PASSWORD-RESET`** (or `README.md`). Apache serves the flag as an empty 200, giving a scanner a 1-byte probe for "is the reset window open". Low severity on its own; it compounds B2.

**NB15 — `public/.htaccess` has no dotfile block, so `public_html/.user.ini` is likely web-readable.** `data/.htaccess` has `<FilesMatch "^\.">`; `public/.htaccess` has nothing equivalent, and Apache's stock `<Files ".ht*">` does not cover `.user.ini`. Contents are non-secret. Reasoning from the rule text, not measured.

**NB16 — `admin/auth.php:55-73` — concurrent reset POSTs resolve last-writer-wins and the loser is shown "Incorrect password" on a Sign In box** after submitting a *reset* form, with no hint that someone else took the account.

**NB17 — `admin/backups.php:76-95` — a hand-placed malformed filename is listed with a Restore button that always errors,** and the restore confirmation prints only a second-granular timestamp, so same-second backups are indistinguishable.

**NB18 — cosmetic:** `src/App.jsx:5423` horizontal overflow at 375 px on 4 of 42 product pages (`IP1274`, `IP25PU`, `IP35KY`, `IP55FL` — `px-8` + non-shrinking button group); `src/App.jsx:606-614` Products mega-menu says "Loading…" forever when the catalog fetch fails; `catalogPdfUrl` is written by `settings.php` and read by nothing (`App.jsx:4376` is its only occurrence); double HTML-escaping in `add.php:20` and `upload-pdf.php:107`; `upload-pdf.php:216` shows "This will replace the existing PDF for this product" when the file belongs to a *different* product; `admin/config.php:647` "Please choose a image to upload."

---

## 3. Claims in `WHATS_LEFT.md` §4 that did not reproduce

This section is **not** empty.

**3.1 — `4.25` "60 s TTL on the products cache" — the TTL is inert.**
`PRODUCTS_CACHE_TTL_MS` is only read inside `fetchProductsCached()` / `useProducts()`.
`useProducts()` has one call site (`App.jsx:8664`), mounts once, and its effect deps are
`[]`. Nothing re-evaluates it during a page session; across a full reload the
module-level cache is reset anyway.
```
t=0     41 products, fetches=1
--> catalog file edited on disk (+ZZTEST)
t=100s  41 products, fetches=1   ← 100 s of SPA navigation, still stale
reload  42 products, fetches=2
```
The ~60 s staleness bound does hold across reloads — via the per-minute cache-buster and
`data/.htaccess max-age=60`, neither of which is the TTL. The comment at `:4239`
describing the bug still describes current behaviour.

**3.2 — `T1.6` "44 saves, keep=30 → oldest kept = ROTATION 11, newest = LATER 28".**
Actual: `oldest=ROTATION 14, newest=LATER 27`. The recorded pair is also arithmetically
impossible — ROTATION 11–16 (6) + LATER 1–28 (28) = 34 entries, not 30. The *behaviour*
is correct (contiguous newest-30, oldest pruned); the evidence line is wrong and should
not be used as a regression baseline.

**3.3 — `4.15` "Auto-reply rate-limited per recipient address".**
Keys on `md5(strtolower($replyTo))`. Case variation is correctly collapsed; plus- and
dot-addressing are not. Seven variants × four submits delivered **15 auto-replies to one
Gmail-style mailbox**. Effective cap reverts to the per-IP 5/10 min.

**3.4 — `4.17` "`is_string()` guard on `form_type` — no unauthenticated 500".**
The `form_type` half reproduces exactly (array / int / absent / unexpected string all
200). The "no unauthenticated 500" half does not — `email[]` and any non-UTF-8 field
both produce one (NB6, NB7).

**3.5 — `T1.7` "an EMPTY key is still an intentional clear".**
True at file level, proven both directions. False end-to-end: `mergeSiteInfo` drops the
blank and the hardcoded default renders (NB4). The claim as written tells the next
reader that clearing works.

**3.6 — `4.33` "`delete.php` cleans up the uploaded photo".**
The code half shipped and is correct (shared photo kept, unique photo removed, both
audit-logged). The other half of v2 4.33 — the confirmation text at `delete.php:105-107`
mentioning only the PDF, and claiming "cannot be undone" when `save_products()` writes a
backup first — did not.

**3.7 — `T1.5` "`add.php` validates spec-table JSON and repopulates on error" — the "ported from `edit.php`" framing is inverted.** `add.php` is correct; `edit.php` discards (NB5).

**3.8 — `T1.4` "10 other sections emptied → nothing re-seeds".**
True for 15 of 16 array sections. `seo: []` is ignored: `title = entry.title || home.title || document.title`, and `document.title` was already set from the defaults by the first effect pass, so the default per-page titles stick. Benign in effect; contradicts the claim.

**3.9 — `WHATS_LEFT.md:16` "Every T1, T2 and T3 item from `DEPLOY_READINESS_v2.md` §9".**
**T3.1 and T3.4 appear in neither §1, §2 nor §3.** Both were in fact done (`dist/data/`,
`dist/products-all.json`, `public/products-all.json`, the `.jsonl` files and
`.login-throttle.json` are all absent from the tree) — so this is a tracking gap, not
missing work, but the header sentence is false as written.

**3.10 — reproduces but weaker than the wording implies:** `4.10` "Privacy 'Last Updated' no longer reports today's date" — correct, but the rendered string is `Effective Date: January 1, 2025`; there is no "Last Updated" text on the page at all.

Everything else in §4 that I tested reproduced. Notably exact: `T1.8`'s
"1,678 bytes" (**exactly 1678** on all 14 pages), `T1.1`/`T1.2`/`T1.3`, `ping.php`
`{"ok":false}`/`{"ok":true}`, `T2.2`, `T2.3`, `T2.4`, `T2.5`, `T2.6`, `T2.7`, `T2.8`,
`T2.9`, `T2.10`, `T3.6`, `T3.7`, `4.2`, `4.4`, `4.16`, `4.34`, the 14-admin-page sweep,
the 9×2 public sweep, `npm run build`, and `php -l` on all 20 files.

---

## 4. Documentation errors

Same standard v2 §5 applied to the old docs. The two marked **[fix before handoff]**
matter because Rick reads them.

| # | Statement | Location | Reality |
|---|---|---|---|
| D1 **[fix before handoff]** | "If you'd ever like it changed, **ask your web developer**" | `admin/help.php:244` | `admin/nav.php` ships a **Password** item; the handoff email's *first* instruction is to change it himself. In-app Help routes him away from the feature T1.2 fixed. |
| D2 **[fix before handoff]** | "The Add Product form doesn't include a photo field… paste a link into the **Photo URL** field"; "a 'share' link from Google Drive, Dropbox… will *not* work here" | `admin/help.php:369, 384` | `admin/index.php:186` renders a **Photo** button per row; `edit.php:313` says the field is filled in automatically. `grep -c "upload-image" admin/help.php` → `0`. Rick will go hunting for third-party image hosting for a one-click feature. |
| D3 | "the shipped default is documented in this README" | `admin/README.md:71-73` | Contradicted 157 lines later by the same file (`:228`) and by `config.php:58-63`. T1.3's doc half was applied to the bottom of the file only. |
| D4 | Help "covers every task step by step" / "available anytime inside the dashboard" | `Email to Rick…md:18, 32` | `help.php` documents **only** the product catalog. `grep -c` for "Business Details", "Inquiries", "settings.php", "content.php", "inquiries.php", "backups.php", "password.php", "upload-image" → **0 each**. Five of nine nav tabs have zero help. |
| D5 | The new "What your server allows" section | `admin/help.php:687` | Emitted **after** `</main>` (closed at `:683`), after `back-to-top` and after `<script src="help.js">`. Rendered measurement: `{"serverLimitsParent":"BODY","inMain":false,"tocHasLink":false,"tocLinks":16}` — full-bleed, no gutter, no nav link, excluded from scroll-spy. It is the post-deploy verification step named in `README.md:153` and `admin/README.md:135` and the answer to `README.md:193`. All three point at an unreachable section. |
| D6 | "The real ceiling is the server's `upload_max_filesize`" / help prints "24M or smaller" | `admin/README.md:134`, `help.php:479, 691` | `upload-pdf.php:79` hard-rejects >**20MB**; `upload-image.php:102` caps images at **8MB**. The real rule is `min(upload_max_filesize, 20MB)` / `min(…, 8MB)`. `README.md:193` ("Raise `public/.user.ini`") is therefore also wrong. |
| D7 | "The admin reads and writes one file (`data/products-all.json`) and one folder (`pdfs/`)… Nothing else is shared" | `admin/README.md:23-25` | `CLAUDE.md:81-89` explicitly records this as already corrected. Actual surface is 3 JSON files + `pdfs/` + `uploads/images/` + 3 files under `admin/` + `config.local.php` + the reset flag. The same file's layout diagram omits `site-info.json`, `content.json`, `uploads/` and 12 of 20 admin files, and `:60` says to upload `data/` — contradicting the settled decision at `WHATS_LEFT.md:93`. |
| D8 | "Clearing a heading resets it… so a page heading can never end up blank" — stated for Page Text only | `Editing-Your-Site-Content.md:57` | Correct for Page Content. The identical rule in `mergeSiteInfo` means **Business Details** silently un-does deletions, and no document tells Rick. Measured: cleared `contact.fax`, `social.twitter`, `company.slogan` → `{"faxOnPage":2,"sloganOnPage":true,"twitterInLd":true}`, admin says "Saved". Unlike a heading, blank is the intended value here. |
| D9 | "The deploy manifest lives in `DEPLOY_READINESS_v2.md` §7… That table is the authoritative list" | `README.md:94` | Then prints a table that differs from §7 in four rows. Diff: `.user.ini` (README yes / §7 absent — **README right**, it ships this release); `data/products-all.json` (README "first deploy only" / §7 do-not-upload — **§7 right**, `WHATS_LEFT.md:93` settled it); `pdfs/` (same shape, **§7 right**); `config.local.php` (README "this release" — **README right**, T1.1 is resolved). `CLAUDE.md:41-51` is a third variant. **Resolution: README's manifest is the live one and should stop deferring to a frozen §7, but README and CLAUDE.md must both name `data/products-all.json` and `pdfs/` as do-not-upload.** |
| D10 | `uploads/images/` listed in three manifests | `README.md:44, 107, 121`, `v2:445` | `ls -a uploads/` → `. .. .htaccess`. `.gitignore` has `!uploads/images/.gitkeep` with no `.gitkeep` present. Harmless because `upload-image.php:72-84` creates it at runtime, but the deployer looks for a folder that isn't there. |
| D11 | "The in-memory cache also expires after 60 s, so a tab left open picks up edits" | `README.md:171-173` | True for one of three files at most, and per §3.1 not even that. `SiteInfoProvider` (`:4446`) and `ContentProvider` (`:4735`) fetch once, deps `[]`. |
| D12 | "contact your web developer right away" for backup restores | `admin/help.php:507` | `backups.php` is in Rick's nav and is self-service; `Editing-Your-Site-Content.md:75` and the email both correctly say he can do it himself. |
| D13 | "The PDF file (if any) will *also* be deleted… This action cannot be undone" | `admin/delete.php:105-107` | The photo is deleted too and isn't mentioned, and `save_products()` writes a backup first, so it *can* be undone from `backups.php`. |
| D14 | "makes online dictionary attacks impractical" / "heat death of…" | `admin/auth.php:40, 81` | `admin/README.md:283-287` was corrected to say the opposite; `WHATS_LEFT.md:74` keeps 4.14 open. Measured: attempts 1-5 ≈ 280 ms, then 1.4 s / 2.3 s / 3.3 s, capped at 8 s. A delay, not a lockout, and nothing against a distributed attacker. |
| D15 | `Disallow: /_hash.php` | `public/robots.txt:7`, `dist/robots.txt:7` | `_hash.php` is the retired FTP flow; no such file exists. Harmless to crawlers but it advertises a former admin endpoint. |
| D16 | "Mirrors `save_products()`: timestamped backup (**keep 5**)" | `admin/config.php:409` | `BACKUP_KEEP = 30` (`config.php:326`). Owner-facing "30" is correct everywhere; only the comment is stale. |
| D17 | `CLAUDE.md:128` "`.ipc-skeleton` and `.ipc-page-header` live in `src/index.css`, **not** in `GlobalStyles`" | `CLAUDE.md:128` | `.ipc-page-header` is in `src/index.css:49` **and** still in `GlobalStyles` (`App.jsx:4131-4145`). The two are complementary and nothing is broken, but the invariant text is false as written. |
| D18 | `WHATS_LEFT.md:52` claims v2 4.11 shipped as `services[].leadTime` | `WHATS_LEFT.md:52` | v2 4.11 names four dead fields. `certifications.other[]` was also fixed (`App.jsx:8271`), but `catalogPdfUrl` (defined at `:4376`, read nowhere) and the promised footer social icons (still `sameAs`-only) remain dead and are in no section of `WHATS_LEFT.md`. |

**Invariants:** all 12 in `CLAUDE.md` are enforced by a mechanism, not merely asserted,
and 12/12 carry the inline incident comment they claim. Two notes: #6 (`form_complete`
last) is *positionally* enforced — the guard works, but nothing prevents a future field
being added after `content.php:679`, and there is no test runner to assert it; #9's
wording is wrong (D17). The security-posture claim of optimistic-concurrency signatures
on all three editors holds: `edit.php:17,28,385`; `settings.php:9,46,365`;
`content.php:383,403,646`.

---

## 5. Coverage statement

### What I ran

- **Static:** `php -l` clean on all 20 PHP files (PHP 8.4.21); `node --check` clean on all 8 admin JS files; all three `data/*.json` parse; 42 products; **`npm run build` produced byte-identical hashed filenames and sizes to the committed `dist/`** (`index-CQHYB4O9.js` 324,309 B, `index-Dsw3_pYS.css` 20,649 B) — `dist/` matches the current `src/`. `public/products-all.json` and `dist/data/` are gone, so there is no SKU drift surface left.
- **Frontend:** 9 pages × 2 viewports → 0 page errors, 0 console errors, 0 4xx/5xx, 0 horizontal overflow. Extended to 114 loads (all 42 `?productId=`, all `?family=`, empty and `<script>` params) → same, no swallowed `ReferenceError` this time. All 16 array sections of `content.json` emptied one at a time across every consuming page × 2 viewports → 0 crashes, 0 invalid table DOM, 0 new ghost containers. All 42 SKUs + all 42 `id`s (6 differ) + all 18 `industryDetail` SKUs resolved through the matcher and through the live app → **0 legitimate deep links hit the banner, 0 resolve to the wrong product**. 12 s abort measured firing between t=11 s and t=14 s.
- **Admin:** all 14 pages signed-in → 200, zero PHP diagnostics in the body; all 14 signed-out GET → 302; all 14 signed-out POST → 403 + a 1,678-byte rendered page with no `Location:` header. `csrf_check()` enumerated on all 9 mutating POST sites — no gaps. All three `csrf_fail_page()` reasons triggered. Path containment attacked on every read/write/delete site (traversal, `....//`, embedded `../`) — all rejected. Upload validation attacked with PHP-in-JPEG, double extensions, traversal filenames, `.htaccess`, truncated JFIF. Session fixation defeated (id regenerates on login); cookie flags and `gc_maxlifetime=28800` confirmed in-request. `ADMIN_PASSWORD_SENTINEL` tested against 200,007 candidate inputs → 0 hits, plus the structural reason (`crypt()` returns `*0`, length 2 ≠ 16, `password_verify` bails). Password change end-to-end through the UI with a deliberately `$`-heavy password → hash written byte-intact, new works, old doesn't, `php -l` clean. Backups: legacy no-suffix, `-NN`, malformed, corrupt-JSON, 1970 and 9999 timestamps all mixed in one directory; emitter↔restore-regex set equality tested over all 3 prefixes × plain × `-01..-99` × 20,000 random hex suffixes → 0 emitter shapes rejected. Health banner tested under a genuinely non-root PHP process (`setpriv --reuid=65534`).
- **contact.php:** every value traced to every sink with captured raw mail; CRLF injection attempted in every header-bound field; the real-world `<1/4 inch and >2 inch ID, 1/2" wall` / `O'Brien & Sons` string round-tripped verbatim; stored-XSS attempted into `inquiries.php` through five fields plus a raw honeypot entry → **0 `<script` tags in the rendered page, every payload escaped**; nine `Referer` shapes tested including the two classic suffix bypasses.
- **Docs:** all five rewritten docs fact-checked line by line against code; 12 invariants traced to enforcing code; full-tree grep for the six retired documents (**3 hits, all deliberate prose citations, 0 broken links**), for `ipc-admin-2025`/`2026` (only inside the frozen audit and `WHATS_LEFT`'s own evidence of removal — never a live credential), `_hash.php` (only the robots.txt line, D15), `dashboard-preview.png` (0).

### What I could not run, and what my clean verdicts do *not* rest on

- **Apache.** `php -S` ignores `.htaccess`, so the `admin/`/`data/` file blocks, the CSP line, the HTTPS redirect, `max-age=60` on `data/*.json`, and NB1/NB14/NB15 are reasoning from the rule text only. I read all four `.htaccess` files; the only logical error I found is NB1's unscoped `FilesMatch`.
- **PHP 7.4.** Container is 8.4.21. The array-input and `email[]` findings behave differently on the target (warning + `null` instead of `TypeError`), which in `add.php`'s case is *worse*, not better. I verified there are no PHP-8-only constructs (`match(`, `?->`, `str_contains`, `#[`, `enum`, `readonly`) in `admin/` or `public/contact.php`.
- **`.user.ini`.** `php -S` does not honour it, so the intended 24M/32M/5000 were never exercised; the `form_complete` guard was proven with an artificially low `max_input_vars=100` instead. The host's real limits and whether Network Solutions honours `.user.ini` at all remain the known-open items.
- **`IPC Admin Dashboard - Help and Documentation.docx` — NOT CHECKED.** The device bridge dropped before I could stage it and did not come back. This is the document the handoff email attaches and the one Rick will actually open. It needs the same pass: the D1 password contradiction, whether it documents Business Details / Page Content / Inquiries / Backups / photo upload (the in-app Help does not — D4), any surviving `ipc-admin-2025` plaintext, the old `_hash.php` FTP flow, any stated upload limit other than 20MB PDF / 8MB image, and the pre-fix "PDFs are not auto-deleted, clean up manually" instruction, which is now actively harmful. **This is the one gap I would close before handing anything to Rick.**
- **Real concurrency.** `php -S` is single-process, so "concurrent" reset POSTs, password changes and `backup_path()` allocations were serialized. B2's last-writer-wins outcome is real; a genuine TOCTOU inside `admin_password_write()` was not exercised.
- **Mail quota.** Delivery is captured by `tee`. I can count messages but cannot confirm that ~1,440/day/IP exhausts Network Solutions' outbound cap — that part of §3.3's impact is labelled reasoning, not measurement.
- **Image pixels.** Product images and PDFs in the sandbox are synthesized placeholders with the real filenames (the bridge timed out staging 9.1 MB of real images). Path correctness and `naturalWidth` are tested; pixel content is not.
- **Real devices.** Everything is headless Chromium 147. `tel:` activation and iOS Safari sticky/`100vh` behaviour on the four overflowing product pages (NB18) are untested.
- **`content.php` keys with no counterpart in `COPY_DEFAULTS`.** `mergeContent` iterates `Object.keys(defaults)` only, so a `copy` key that exists in `content.php` and not in `App.jsx` would have Rick's edit vanish with a success message. I did not enumerate all ~450 posted keys against the defaults tree. Worth a targeted diff.

### Where I stopped

I did not run out of context. I stopped at the `.docx` because the device bridge went
down mid-session and did not recover; everything else in the coverage floor was
completed.

---

# Addendum — `IPC Admin Dashboard - Help and Documentation.docx` (gap closed)

Staged after the bridge reconnected. 226 paragraphs + 27 tables extracted with
`python-docx`. **Internal revision date: `2026-07-08T18:17Z`, revision 2** — the
document has not been touched by this release (the Aug 4 filesystem mtime is a copy,
not an edit). It is the file `Email to Rick - Admin Dashboard Handoff.md:7` attaches
and calls a guide that *"covers every task step by step."*

## What is clean — the three things the prior gap-note worried about are fine

| Feared | Actual |
|---|---|
| Surviving `ipc-admin-2025` plaintext | **None.** `grep -ic "ipc-admin"` → `0`, `"2025"` → `0`. Table 5 is a blank fill-in grid (`Admin dashboard address \| ` / `Password \| `). |
| The old `_hash.php` FTP flow | **Absent.** `grep -ic "_hash"` → `0`. |
| "PDFs are not auto-deleted, clean up manually" | **Absent and superseded correctly.** `grep -ic "manually"` / `"clean up"` → `0`. Table 20 ("SHARED DATA SHEETS") and Table 21 both describe the *current* `pdf_delete_if_unused()` behaviour accurately. |

Also correct, verified against code: the PDF ceiling **"a genuine PDF, 20MB or smaller"**
(¶95) matches `upload-pdf.php:79` — this is *more* accurate than `help.php:479`'s "24M"
(report §4 D6); the throttle description "pause briefly… not a lockout" (Table 3, ¶140)
matches `auth.php:78-83`; the 60-second cache + hard-refresh story (Table 0, ¶130)
matches `data/.htaccess`; the two-tab concurrency warning (Table 14) matches
`edit.php`'s `orig_sig`; the 11 Part Type values (Table 8) match `admin/add.php:80`
exactly; SKU-rename PDF renaming and the uniqueness errors (Tables 12, 10) are accurate.

## Findings — 12 new, four of them handoff-blocking

| # | Statement | Location in the .docx | Reality |
|---|---|---|---|
| D19 **[fix before handoff]** | "the **five most recent** are always kept" | Table 1, "YOUR SAFETY NET" | `admin/config.php:326` `define('BACKUP_KEEP', 30);`. Understates his safety net 6×, and it is the exact number T1.6 changed. |
| D20 **[fix before handoff]** | Restoring a backup is a developer job — stated four times: "contact your web developer and mention you need a catalog backup restored" (Table 1); "contact your web developer right away" (Table 21); "Not directly through the dashboard — deletion is immediate and permanent from this side" (¶148); and listed under things that "sit outside of it on purpose… best left to your web developer" (¶161) | Tables 1, 21; ¶148, ¶161 | `admin/nav.php` ships a **Backups** item; `backups.php` is fully self-service and this release added item counts and a working restore. Rick will phone the developer for a two-click operation, and ¶148 tells him a recoverable deletion is permanent. |
| D21 **[fix before handoff]** | "If you'd ever like it changed, **ask your web developer**" (Table 6); "Resetting it requires direct server access… Contact your web developer and ask them to rotate the admin password" (¶142); "Resetting the admin password" listed as developer-only (¶160) | Table 6, ¶142, ¶160 | `admin/nav.php` ships a **Password** item. ¶142 is defensible *for a forgotten* password (that genuinely needs the FTP flag), but Table 6 and ¶160 cover the ordinary change, which `password.php` does. Directly contradicts the handoff email's *first* instruction to Rick. Identical to §4 D1 in `help.php` — the same wrong sentence is in both documents he is pointed at. |
| D22 **[fix before handoff]** | "The Add Product form doesn't include a photo field — new products start with a branded placeholder… open it with **Edit** and paste a link into the **Photo URL** field" (Table 9); "Paste the full web address of a hosted image… a 'share' link from Google Drive, Dropbox, or a photo gallery site opens a viewer webpage instead of the raw image and **will not work here**" (Table 11, and again at ¶138); "The Add form has no photo field, so this always happens as a second step" (¶115) | Tables 9, 11; ¶115, ¶138 | `admin/index.php:186` renders a **Photo** button on every row (`upload-image.php?sku=…`) and `admin/edit.php:313` says "upload a photo… and this field is filled in automatically". The document sends a non-technical 60-year-old to hunt for Dropbox direct-link syntax for a feature that is one click away. Identical to §4 D2. |
| D23 | "quick links to **Products, Add Product, Audit Log, and Help**" | ¶39 | `admin/nav.php` has nine: Products, + Add Product, Business Details, Page Content, Inquiries, Backups, Audit Log, Password, Help. Five tabs Rick will see are not named anywhere in the document. |
| D24 | "There are really only **two things** stored behind this dashboard: your product catalog… and your PDF data sheets" | ¶16-18 | Same false I/O-surface claim as §4 D7. Actual: 3 JSON files + `pdfs/` + `uploads/images/` + `admin-log.jsonl` + `inquiries.jsonl` + `.login-throttle.json` + `config.local.php` + the reset flag (`CLAUDE.md:81-89` records this as already corrected elsewhere). |
| D25 | Audit-log actions are "add, edit, delete, upload-pdf, remove-pdf" | ¶123, Table 24 | `grep -ohE "audit_log\('[a-z-]+'"` → 11 actions: the five listed plus `upload-image`, `remove-image`, `settings`, `content`, `restore`, `password`. The filter dropdown offers all 11; the doc explains 5. |
| D26 | "OLD LINKS WON'T JUST BREAK — THEY CAN SHOW THE WRONG PRODUCT… instead of an error page, it **silently shows whatever product happens to be first in the catalog**… Avoid renaming a SKU once its link has been shared publicly" | Table 13 | **This is the pre-T2.8 bug, fixed in this release.** `src/App.jsx:5823` (`// No blind fall-through to products[0] — see notFound below.`), `:5836`, `:5944` (`We couldn't find part "…"`). Verified live: `?productId=CC90S` and `NOT-A-REAL-SKU` both show the banner. The document now scares Rick away from a safe operation by describing a defect that no longer exists. |
| D27 | The document covers only the product catalog | whole file | Business Details, Page Content, Inquiries, Backups, Password and photo upload have **zero** coverage — the same five-tab hole as `help.php` (§4 D4). Combined with the email's "covers every task step by step with examples", Rick is handed two documents that between them explain four of nine screens. |
| D28 | "Replacing a PDF… The new file **overwrites the old one in place**" | ¶99 | Since T3.6, `pdf_in_use()` **refuses** the upload when the target filename is another product's data sheet ("A different product (IP12GA) already uses the file…"). Table 20 documents the *removal* side of shared PDFs but not the upload side, so the new refusal will read as a bug. |
| D29 | "Prepared for the new website owner — **July 8, 2026**" | ¶7 / `docProps/core.xml` | `dcterms:modified 2026-07-08T18:17Z`, `cp:revision 2`. Every fix in this release post-dates it. Nothing in `WHATS_LEFT.md` §1 records that this document was left unrevised. |
| D30 | Table 5 is a blank two-row grid: `Admin dashboard address` / `Password`, with Table 6 saying "Store this password somewhere secure" | Tables 5-6 | No credential is *in* the file, but the file is designed to have the live admin password typed into it and is attached to an email. That is the delivery channel T1.1 was about. Recommend deleting the Password row and telling Rick the password separately. |

## Coverage

Extraction was `python-docx` over `word/document.xml` — 226 paragraphs and 27 tables, all
read. The two embedded PNGs (`word/media/image1.png`, `image2.png`) were **not** examined;
if either is a screenshot of the dashboard it will show the four-item header nav of D23
and needs recapturing. Everything above was checked against the code with the greps and
line references shown; nothing rests on reading the .docx alone.
