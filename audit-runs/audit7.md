# Audit 7

Seventh audit cycle, against `ff62280` — main immediately after PR #50 merged
the audit-6 work. Verified 2026-08-19.

**No Blockers and no High findings.** After two consecutive remediation rounds
that closed 59 items, that is the honest result, and it is stated rather than
padded: nothing found this round rises above Medium. Seven findings, four
Medium and three Low, plus four re-checks that came back clean and are recorded
so nobody re-derives them — including one hypothesis that the measurement
retired outright.

| Severity | Count |
|---|---|
| Blocker | 0 |
| High | 0 |
| Medium | 4 |
| Low | 3 |

## Method, and what was new about it

Two lenses, both chosen because the previous six rounds did not use them:

1. **Follow one visitor and one owner through a whole task**, rather than
   asserting properties of the code. What does a person actually see at each
   outcome? That produced A-7.1 and A-7.2, and both were measured in a real
   browser rather than read.
2. **Ask what the code costs a stranger**, not what it lets them do. Six rounds
   examined the session's *hardening* — cookie flags, strict mode,
   regeneration. None asked what starting one for an anonymous caller costs.
   That produced A-7.3.

## Nothing has regressed

Run first, with all thirteen servers up:

```
php _harness/lint.php      every check green (55 WHATS_LEFT sections)
node _harness/invariants.js                                     17/17
npm run build              0 errors, 375.51 kB JS / 23.59 kB CSS
_harness/run.js × 72 suites                        70/72 exited clean
```

The two reds are the documented expected-reds and nothing else: `plan8-polish`
16/17 (Linux DejaVu artifact, GUARDRAILS §7.1) and `brandtext` 36/47 — **11
failing against a ceiling of 13**. `audit6` is **45/45**, and all three audit-5
suites hold: `audit5-blockers` 18/18, `audit5-high` 30/30, `audit5-medium`
20/20.

---

# Medium

## A-7.1 — The one rejection path that leaves no record is the one a real customer can reach

`public/contact.php:551-555` (RFQ) and `:613-617` (message)

Every rejection in this file logs the lead before exiting. The 429 logs, the
403 logs, the honeypot logs, and the 500 logs — each with a comment saying why,
because each was a defect once. A-5.3's finding was written in exactly these
terms: *"That exit happens before `mail()` **and** before the inquiry log, so
the lead was not merely undelivered, it left no trace at all."*

**The 422 still does that.** It is the only exit in the file with no
`ipc_log_inquiry()` call, and A-5.3 fixed one *cause* of reaching it (the
missing `form_type`) without changing the exit itself.

That would be academic if only a malformed client could get there. It is not,
because **the browser and the server disagree about what an email address is.**
Measured with the constraint API in Chromium and with PHP side by side:

```
                          browser (type="email")     FILTER_VALIDATE_EMAIL
jane@acmecorp             ACCEPTS → submits          REJECTS
jane@localhost            ACCEPTS → submits          REJECTS
jane.smith@company,com    blocks                     REJECTS
jane@acme.com             ACCEPTS → submits          accepts
```

HTML5's email rule deliberately permits a dotless domain — intranet addresses
are legal — so the browser hands the form over and the server refuses it. A
dropped `.com` is an ordinary typo.

**Measured end to end** against the live harness, watching the inquiry log:

```
  jane@acmecorp            HTTP 422   log delta +0
  jane.smith@company,com   HTTP 422   log delta +0
  jane@@acme.com           HTTP 422   log delta +0
  jane@acme.com            HTTP 200   log delta +1
```

With JavaScript on the visitor sees "Please add a valid email address" and can
correct it, so most attempts self-recover. With it off they get the raw JSON of
A-7.2. In **both** cases IPC has no record that anyone tried.

**Fix.** `ipc_partial_entry()` and `ipc_log_inquiry()` already exist and are
already used by the three exits around it; the 422 needs the same four lines,
with a note naming which field was missing.

## A-7.2 — The no-JS submitter gets `{"ok":true}` and nothing else

`public/contact.php:21`

Both forms carry `method="POST" action="/contact.php"` deliberately — that
native-submit path is the reason A-5.3 exists. A-5.3 made that path **succeed**.
It did not make the visitor able to tell.

`header('Content-Type: application/json; charset=utf-8')` is set unconditionally
on line 21 and there is no HTML branch anywhere in the file. Measured in a real
browser with `javaScriptEnabled: false`:

```
--- JavaScript ON  (fetch path) ---
  lands on:  /contact?sent=1
  visitor sees: "… REQUEST SENT  Quote Request Received  Thank you! Your quote
                 request has been…"

--- JavaScript OFF (native submit) ---
  lands on:  /contact.php
  has a heading: false      has any link back to the site: false
  visitor sees: "{\"ok\":true}"
```

The lead is captured — that is the half that matters and it works. But the buyer
is left on a white page showing a machine response, with no confirmation, no
phone number, and no way back to the site except the Back button. On a 422 they
get `{"ok":false,"error":"Please add a valid email address."}` in the same form.

**Fix.** Content-negotiate. A native form navigation sends
`Accept: text/html,…`; `fetch()` with no explicit Accept sends `*/*` — verified
in this codebase, the two handlers at `src/App.jsx:4823` and `:4871` set no
Accept header. That is a clean discriminator. One `respond()` helper and the
seven `echo json_encode` sites become one call each, emitting either JSON or a
minimal styled page carrying the same message plus the phone number.

## A-7.3 — Every anonymous request to `/admin/*` mints a session file that lives eight hours

`admin/config.php` (the session bootstrap), `admin/ping.php`

`config.php` calls `session_start()` unconditionally at include time, and every
admin entry point includes it before doing anything else. So a request with no
cookie and no credentials still creates a session file — and `config.php` raises
`session.gc_maxlifetime` to **28,800 seconds** for the owner's benefit, so each
one is ineligible for collection for eight hours.

**Measured** against the live harness, counting `sess_*` in the save path:

```
  10 × GET /admin/ping.php   →  +10 session files
   5 × GET /admin/auth.php   →  +5
   5 × GET /admin/           →  +5   (these only redirect)
```

Each is zero bytes, and `ls -la` confirms they persist.

A-5.26 fixed the adjacent problem — `session.use_strict_mode`, so an attacker
cannot *choose* the id — but a self-minted id still costs a file. `ping.php` is
the sharp edge: it is unauthenticated by design, has no throttle, is polled
automatically by every open editing tab, and needs nothing from the session
except `is_authenticated()`, which is `false` by definition when no cookie was
sent. Sustained at 10 req/s for eight hours that is ~288,000 inodes, against
shared-hosting quotas that are typically 100k–500k.

The two failures compound: A-5.9's own comment names inode exhaustion as the
condition under which the contact form's limiter files stop being written, so
filling the store through `ping.php` also switches off the contact form's rate
limit.

**Fix, scoped narrowly.** `ping.php` should answer `{"ok":false}` without
starting a session when the request carries no `IPCADMIN` cookie — a caller with
no cookie cannot be authenticated, so the answer is unchanged and no file is
created. `auth.php` genuinely needs a session on GET (it renders a CSRF token),
so it stays as it is; a human's browser keeps one cookie and one file.

## A-7.4 — The record A-5.6 made authoritative is the one with no failure signal

`public/contact.php:107-124`

```php
function ipc_log_inquiry(array $entry): void {
    …
    @file_put_contents($path, json_encode(…) . "\n", FILE_APPEND | LOCK_EX);
    return;
}
```

Return type `void`, the write `@`-suppressed and unchecked, and the loop simply
`return`s if neither candidate `admin/` directory exists. The header comment
says "Best-effort by design", and at the time it was written that was a
reasonable call.

**A-5.6 changed what this file is for.** It added the unread-lead badge, the
dashboard panel, and copy that now tells the owner in as many words: *"Every
quote request is saved here even when the notification email does not arrive,
so this is the list to trust."* The design intent moved; the failure handling
did not follow.

The resulting matrix — only one row is silent, and it is the one that matters:

| `mail()` | log write | visitor sees | record kept |
|---|---|---|---|
| ok | ok | 200 success | yes |
| fails | ok | **500 + phone number** | yes |
| ok | **fails** | **200 success** | **none** |
| fails | fails | 500 + phone number | none |

Row 3 tells the visitor everything worked, and leaves nothing behind. The
permission case is caught by the dashboard's `admin_writable()` banner, which
says the right thing. A full disk or an exhausted inode quota is not:
`is_writable()` returns true for both, and A-5.9 already establishes inode
exhaustion as a live scenario on this host.

**Fix.** Return `bool`. When the write fails on an otherwise-successful
submission the visitor should still get 200 — the mail did go, and telling them
to resend would be wrong — so the signal belongs on the **owner's** side: a
marker the dashboard health banner reads, worded as "leads are arriving but
cannot be recorded".

---

# Low

## A-7.5 — The owner-facing guide still says 30 backups

`Editing-Your-Site-Content.md:84`

> Backups are kept for the 30 most recent saves of each file.

`BACKUP_KEEP` has been **90** since A-5.15. A-6.9 swept this drift and fixed
`admin/README.md`; it grepped the developer docs and did not grep the two
owner-facing ones, so the copy Rick actually reads is the copy still wrong. A
full re-sweep of every `.md` outside the append-only records found this and
nothing else — `help.php` and `backups.php` both render the constant.

## A-7.6 — A photo too large to resize ships silently at full size

`admin/upload-image.php:138,157`

A-6.6 added `IMG_MAX_PIXELS` so an oversized image is left alone instead of
killing the request — the right trade. But the success message only speaks when
the resize *happened*:

```php
$wasResized = image_downscale_in_place($destPath, $ext);
… . ($wasResized ? ' It was very large, so it has been scaled down to …' : '')
```

Over the ceiling, `image_downscale_in_place()` returns `false`, so the owner
sees "Photo uploaded and product updated." — **identical to the message for a
photo that was already a sensible size**. A 60-megapixel file is now the eagerly
loaded LCP image on that product page and nothing said so. This is a gap in
audit 6's own fix, stated as such.

**Fix.** Distinguish the two `false` cases and say the third thing: too large to
resize automatically, the page may load slowly, please resize before uploading.

## A-7.7 — There is no print stylesheet, on a site whose buyers print spec pages

`src/index.css`, `src/App.jsx` (`GlobalStyles`)

This company sells specification-grade parts, and a product page is what a buyer
attaches to a purchase requisition. Measured on a product page with
`emulateMedia({ media: 'print' })`:

```
@media print rules in the entire stylesheet:   0
document height:                            1800 px  (~2 Letter pages)
header, printed:                              65 px
footer, printed:                             440 px   ← half a page of nav links
<h1> (the part name) starts at:              364 px   ← top third is banner first
dark background blocks ≥200×30:                 94    (~13.1M px² of toner)
```

Nothing is broken and nothing ever claimed print support, so this is a gap
rather than a defect — but it is a cheap one to close: one `@media print` block
hiding the header, footer and CTAs, forcing white backgrounds, and setting
`break-inside: avoid` on the spec table.

---

# Re-verified clean — recorded so nobody re-derives them

- **The shipped site throws nothing.** All ten routes plus three product pages
  crawled in Chromium: **0 console errors, 0 failed requests, 0 responses ≥400.**
- **The catalog scales, and the measurement retired the hypothesis.** "1.24 MB
  of JSON on every page load at 500 products" looked like a finding until it was
  measured against the real pages:

  ```
    42 products  JSON 0.10 MB   /dashboard 844 ms (42 rows)   /products 759 ms
   200 products  JSON 0.50 MB   /dashboard 835 ms (200 rows)  /products 779 ms
   500 products  JSON 1.24 MB   /dashboard 883 ms (500 rows)  /products 883 ms
  ```

  A 12× catalog costs 39 ms. There is no scaling cliff to report, and saying so
  is more useful than a speculative finding would have been.
- **A-6.3's broadened redaction has no catastrophic backtracking.** The new
  pattern nests a quantifier, which is the classic ReDoS shape, so it was timed
  rather than reasoned about: six adversarial 200-character inputs (no dots, 99
  labels, hyphen runs, dots-then-fail) at **0.029 ms per call** worst case. The
  dot separator makes the iteration boundaries unambiguous, so there is no
  ambiguity to backtrack through.
- **No regex is ever built from user input.** `new RegExp` appears nowhere in
  `src/App.jsx` or the admin JS, and every `preg_*` pattern in PHP is a literal
  with user data only ever as the subject.

# Carried forward — already recorded, still open

- **A-5.10** — client-only rendering with no prerender.
- **§2k's D-03 correction** — the free `react-router-dom@6.30.6` bump.
- **Owner actions**, unchanged and still gating: rotate the live admin password
  (a working hash is in this public repo's history); resolve the four
  contradictory ISO 9001 claims; publish SPF/DKIM/DMARC; Search Console; an
  uptime monitor; apex-vs-www; verify `display_errors` is Off on the server.
- **A-6.2's deploy note** — `data/.htaccess`, `pdfs/.htaccess` and
  `uploads/.htaccess` all changed across audits 5 and 6 and none is in `dist/`.
  `README.md`'s upload table now names them; the next FTP deploy has to include
  them or half of A-5.2 stays on the laptop.
