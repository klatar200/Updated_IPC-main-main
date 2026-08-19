# Audit 6

Sixth audit cycle, run against `4d60ad9` — main immediately after PR #49 merged
the audit-5 work (2 Blockers, 7 High, 19 Medium, 22 Low). Verified 2026-08-19.

This round had two jobs, because audit 5 changed 39 files and closed 50
findings in one release:

1. **Regression lens.** Re-run every gate, then re-read the whole audit-5 diff
   looking for what the fixes themselves introduced or left half-done.
2. **Fresh lens.** Areas five audits have not reached — the deploy path as an
   artefact in its own right, the Apache response pipeline, and the
   authenticated-but-unbounded resource paths.

Nine findings. **Two are High**, and both are the same shape: a change that is
correct in the repository and does not reach, or does not work on, the live
server. That shape is exactly what the local harness cannot see
(GUARDRAILS §4.3), which is why it survived five rounds.

| Severity | Count | Status |
|---|---|---|
| Blocker | 0 | — |
| **High** | **2** | **Fixed** 2026-08-19 (`WHATS_LEFT.md` §1u) |
| Medium | 4 | **Fixed** 2026-08-19 (§1u) |
| Low | 3 | **Fixed** 2026-08-19 (§1u) |

All nine are fixed and guarded by `_harness/audit6.js`, which was written
against the unfixed tree and watched to fail first (GUARDRAILS §4.4): **16/41
before, 45/45 after**. The findings below are left exactly as written, because
the finding is the record of what was true at audit time.

## Nothing has regressed

Every gate was stood up and run in full before anything was looked for, with
all thirteen servers up:

```
php _harness/lint.php      every check green (php -l, node --check, JSON,
                           copy-key/family/approval/photo/audit-action drift,
                           doc drift, section drift 54, href guard drift)
node _harness/invariants.js                                          17/17
npm run build              0 errors, 375.51 kB JS / 23.59 kB CSS
_harness/run.js  × 71 suites                               69/71 exited clean
```

The two reds are the two documented expected-reds and nothing else:
`plan8-polish` 16/17 (Linux DejaVu artifact, GUARDRAILS §7.1) and `brandtext`
36/47 — **11 failing against a ceiling of 13**, judged by the failing count as
that section instructs. `plan8-contrast` 34/35 is its documented passing state.
All three audit-5 suites are green: `audit5-blockers` 18/18, `audit5-high`
30/30, `audit5-medium` 20/20.

Catalog data was checked independently of the suites: 42 products, no duplicate
SKUs, no duplicate ids, and every `photoUrl`, `pdfUrl` and `additionalPdfs[].url`
resolves to a file that exists.

---

# High

## A-6.1 — The admin's own CSP makes the session-expiry recovery button inert

> **FIXED 2026-08-19** — external handler in `admin/csrf-back.js`, `data-ipc-back` on both buttons. Evidence in `WHATS_LEFT.md` §1u.

`admin/config.php:436` and `:439` (inside `csrf_fail_page()`),
`admin/.htaccess:33`

`csrf_fail_page()` renders its primary action as
`<button … onclick="history.back()">`. `admin/.htaccess` sets

```
Content-Security-Policy: … script-src 'self'; …
```

with no `'unsafe-inline'`, and an inline event-handler attribute is exactly what
that blocks. So on the live server — and **only** on the live server, because
`php -S` ignores `.htaccess` — the button does nothing at all when clicked.

This is not a cosmetic page. `require_auth()` renders it on an expired POST
rather than redirecting, which is CLAUDE.md **invariant 12**: a 302 would turn
the POST into a GET and silently discard everything typed. The page exists to
say *your typing is still in the previous page, click Back to get it* — and the
button that performs that recovery is the dead one. The owner is left on a 403
with two live links (Sign in again, Dashboard), either of which loses the work
the page was rendered to save.

**The rule was already known here.** `admin/confirm.js` opens with:

> The admin Content-Security-Policy is `script-src 'self'` (no 'unsafe-inline'),
> which blocks inline onclick/onsubmit handlers. So instead of inline
> `onclick="return confirm(...)"`, elements carry a `data-confirm="message"`
> attribute and this external script wires up the prompts.

An entire external script exists to obey this rule. These two `onclick`s are the
only ones left in the tree, and they are in the one page that renders from
`config.php` rather than from a page with its own `<script>` tags.

**Measured**, in Chromium, against the real page captured from a live CSRF
failure and the real policy string copied from `admin/.htaccess`, with a control
run that must pass or the probe proves nothing:

```
CONTROL (no CSP header)
   button: "← Back to my unsaved page"
   after click, path = /start    went back: true
   violations: (none)

LIVE (admin/.htaccess CSP: script-src 'self')
   button: "← Back to my unsaved page"
   after click, path = /fail     went back: false
   violations: Refused to execute inline event handler because it violates
               the following Content Security Policy directive: "script-src
               'self'". … Note that hashes do not apply to event handlers …
```

**Fix.** Move the handler into an external file the way `confirm.js` already
does — `script-src 'self'` permits a same-origin `<script src>`, and the page is
served from `/admin/` so the request resolves even with the session gone. A
`javascript:` href is not an alternative; CSP blocks those too.

## A-6.2 — Three `.htaccess` files changed this release, and the deploy manifest says never to upload their folders

> **FIXED 2026-08-19** — a new row and two paragraphs in `README.md`, which already declares itself authoritative over the frozen §7. Evidence in `WHATS_LEFT.md` §1u.

`data/.htaccess` (+25 lines), `pdfs/.htaccess` (±15), `uploads/.htaccess` (±17),
against `README.md:113-133` and `DEPLOY_READINESS_v2.md:445-456`

Audit 5 edited all three of these files. None of them is in `dist/` — verified,
`dist/` contains `assets/`, `images/`, `index.html`, `.htaccess`, `.user.ini`,
`contact.php`, `sitemap.php`, `favicon.svg`, `logo.svg`, `manifest.json`,
`robots.txt`, and nothing else. Vite only copies `public/*`, and these three
live in top-level folders it never sees.

Now read what the deploy documents tell the person doing the FTP:

* `README.md`'s upload table lists `dist/` items plus `admin/`. Neither
  `data/.htaccess` nor `pdfs/.htaccess` appears in it.
* `README.md`'s **Do NOT upload** table names `data/`, `pdfs/` and `uploads/`
  wholesale, on the correct grounds that they are live customer state.
* `DEPLOY_READINESS_v2.md:454` lists `uploads/.htaccess` as **"first time
  only"**. `data/.htaccess` and `pdfs/.htaccess` appear in neither manifest at
  all.

So a deployer following the documents exactly will not upload any of the three,
and nothing anywhere will tell them they were supposed to.

**This half-undoes A-5.2, and in the harmful direction.** That fix has two
halves in two different trees:

| Half | Ships in | Reaches the server? |
|---|---|---|
| `robots.txt` — `Disallow: /data/` removed | `dist/` | **yes** |
| `data/.htaccess` — `X-Robots-Tag: noindex` added | `data/` | **no** |

The crawl block lifts and the compensating header never arrives. The raw
`products-all.json`, `site-info.json` and `content.json` become crawlable **and
indexable** — the exact outcome the fix's own comment says the header exists to
prevent ("The files stay out of the index by header instead — which a crawl
block cannot do"). The site's whole catalog, and the business address and phone
number, become directly indexable JSON.

Two more fixes are lost in the same way:

* `AddType application/json .json`, added to `data/.htaccess` in the Low tier
  precisely because `jsonOrThrow()` (`src/App.jsx:6047`) hard-requires
  `application/json` and throws on anything else. On a host that does not map
  `.json`, all three fetches fail at once and the site renders Catalog
  Unavailable with hardcoded defaults for the business details.
* `pdfs/.htaccess`'s widened script-execution block (case-insensitive, and the
  `x.php.pdf` double-extension form).

**Fix is documentation, not code.** Add a row to `README.md`'s upload table
naming the three files, with the distinction spelled out — the folders are
do-not-upload because of their *contents*; the `.htaccess` inside them is repo
code and must be re-uploaded whenever it changes. `DEPLOY_READINESS_v2.md` is
frozen (GUARDRAILS §2) and `README.md` already declares itself authoritative
over §7, so `README.md` is the correct and sufficient place.

---

# Medium

## A-6.3 — `reply_slot()`'s link redaction does not cover scheme-less hosts

> **FIXED 2026-08-19** — a second redaction pass in `reply_slot()` for host-shaped tokens. Evidence in `WHATS_LEFT.md` §1u.

`public/contact.php`, `reply_slot()`

A-5.1's `reply_slot()` redacts `https?://`, `ftp://`, `mailto:` and `www.`
tokens. Measured against the real function:

```
plain https URL        "Pay online now: [link removed]"      ✓
www form               "Pay at [link removed]"               ✓
uppercase scheme       "Pay [link removed]"                  ✓
newline injection      "Jane ACTION REQUIRED: invoice…"      ✓  collapsed
scheme-less domain     "Pay at evil-example.com/ipc-pay"     ✗  survives
scheme-less .net       "invoice portal: ipc-billing.net/pay" ✗  survives
word-prefixed https    "Pay now xhttps://evil.example/pay"   ✗  survives
```

Outlook and Gmail both autolink a bare `domain.tld/path` in a `text/plain` body,
so a surviving token is a clickable link in the delivered mail.

**The blocker itself is not reopened.** The load-bearing guarantee — nothing the
sender writes can open a line of its own — holds; the newline case above is
collapsed, and the length caps hold. What does not hold is the *stated*
guarantee in the PR body, "nothing the sender writes can … carry a link". This
is the hardening layer, not the fix.

**Fix.** None of the five guarded slots — sender name, part number, material,
quantity, required-by date — has any legitimate reason to contain a
host-shaped token, so a `[a-z0-9-]+\.[a-z]{2,}` redaction is safe for them
(`8.0` does not match; it needs two or more letters after the dot). The
alternative the PR already offers is to drop the request-summary echo from the
auto-reply entirely — the sales notification and the JSONL record keep the raw
values either way.

## A-6.4 — The compression list omits the MIME type modern Apache gives `.js`

> **FIXED 2026-08-19** — `text/javascript`, `application/x-javascript`, `application/xml`, `text/xml`, `text/plain` added. Evidence in `WHATS_LEFT.md` §1u.

`public/.htaccess:120`

```apache
AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
```

`AddOutputFilterByType` matches the **response** `Content-Type`. Apache assigns
that from `mime.types`, and the current IANA-derived table maps `.js` to
`text/javascript`, not `application/javascript` — confirmed on this machine:

```
$ grep -E "^(text|application)/(x-)?javascript" /etc/mime.types
text/javascript					es js mjs
```

httpd has shipped that mapping since 2.4.53. On any host with a current
`mime.types`, `dist/assets/index-*.js` therefore matches nothing in the list and
is served **uncompressed: 376 kB instead of 108 kB gzip**, on the critical path
of every cold load — for a buyer looking up a part on a phone in a plant. CSS and
HTML are unaffected; they are listed under types that did not change.

`[UNVERIFIED on the live host]` per GUARDRAILS §4.3 — `php -S` ignores
`.htaccess`, and the Network Solutions Apache version is not knowable from here.
The point is that the current line is only correct on older builds and the fix
is correct on both.

**Fix.** Add `text/javascript` (and `application/x-javascript` for very old
hosts) to the list. While there: `sitemap.php` returns `application/xml`, which
is also absent.

## A-6.5 — The HSTS proxy fix landed on the public tree and not on the admin

> **FIXED 2026-08-19** — the same `SetEnvIf IPC_TLS` pair the public tree already carries. Evidence in `WHATS_LEFT.md` §1u.

`admin/.htaccess:33` vs `public/.htaccess:47-56`

Audit 5's Low tier fixed HSTS in `public/.htaccess`, with the reasoning written
into the file: `env=HTTPS` is set by mod_ssl only when TLS terminates on *this*
server, and the HTTPS-redirect rule immediately above it exists precisely
because it often does not — `%{HTTPS}` reads `off` on every request behind a
TLS-terminating proxy. The two rules assumed opposite topologies, so in the
proxy case the header was silently never sent. The fix:

```apache
SetEnvIf X-Forwarded-Proto "^https$" IPC_TLS=1
SetEnvIf HTTPS             "^on$"    IPC_TLS=1
Header always set Strict-Transport-Security "…" env=IPC_TLS
```

`admin/.htaccess` still has the un-fixed form, `env=HTTPS`, and carries the same
`X-Forwarded-Proto` redirect three lines above it — the same contradiction, on
the half of the site that posts a password and holds the session cookie. The
public tree's comment even describes itself as "mirroring admin/.htaccess",
which is how the asymmetry stayed invisible.

**Fix.** The same three lines.

## A-6.6 — Photo downscaling decodes with no pixel ceiling, and `memory_limit` does not bound it

> **FIXED 2026-08-19** — `IMG_MAX_PIXELS` (40 MP) checked before the decode; an over-budget upload is kept at full size. Evidence in `WHATS_LEFT.md` §1u.

`admin/config.php`, `image_downscale_in_place()`; `admin/upload-image.php:137`

A-5.16 added GD downscaling for uploads wider than 1600px. The guard is on
**width only** — `if ($w <= IMG_MAX_WIDTH) return false;` — and nothing bounds
the decode above that. `imagecreatefromjpeg()` then allocates for the full
bitmap regardless of how large it is.

Two measurements make this worse than it first reads:

```
image 4032x3024 (12.2 MP), file 1.38 MB
RSS before decode: 35.8 MB
RSS after  decode: 83.4 MB   (php memory_get_peak_usage: 2 MB)
RSS after  scale : 90.5 MB
```

`memory_get_peak_usage()` reports **2 MB** while real process memory grows by
55 MB, because GD's buffers come from libgd's own allocator rather than the Zend
one on this build. Confirmed directly: the downscale still succeeds at
`memory_limit=8M`. **`memory_limit` gives no protection here at all** — the real
ceiling is the host's per-process RAM cap, which is unknown.

`public/.user.ini` allows `upload_max_filesize = 24M`, and `upload-image.php`
caps photos at 8 MB. An 8 MB JPEG can be 60+ MP, which is several hundred MB of
RSS. An OOM kill is a fatal PHP cannot catch, and the call sits **after**
`move_uploaded_file()` and **before** `save_products()`, so the failure mode is:
file lands on disk, catalog never updated, owner gets a blank page and a photo
that did not take. Retrying reproduces it exactly.

**Fix.** `getimagesize()` is already called two lines above and returns the
height as well as the width. Skip the downscale (keeping the upload) when
`$w * $h` exceeds a budget — 40 MP covers every real phone and DSLR — so the
oversized case degrades to "uploaded at full size" instead of a dead page.

---

# Low

## A-6.7 — `sitemap.php` accepts only one of the two catalog shapes the rest of the code accepts

> **FIXED 2026-08-19** — `sitemap_product_ids()` unwraps `{ "products": [...] }`. Evidence in `WHATS_LEFT.md` §1u.

`public/sitemap.php`, `sitemap_product_ids()`

`config.php`'s `load_products()` handles both a bare array and
`{"products": […]}` — and the Medium tier just hardened the second path. So does
`App.jsx`'s `fetchProductsCached()`. `sitemap_product_ids()` iterates the top
level only, so against a wrapper-shaped file every row fails `isset($p['id'])`
and it emits **zero** product URLs — with a 200 and the ten static routes, so
nothing looks wrong. Self-heals on the next admin save, since `save_products()`
always writes a bare array. Three readers of one file, two tolerant, one not,
and the intolerant one fails silently.

## A-6.8 — One of the five Site Images labels carries the deploy warning

> **FIXED 2026-08-19** — the warning is on all five labels. Evidence in `WHATS_LEFT.md` §1u.

`admin/content.php:337-341`

A-5.18's section comment says "The label carries the warning because there is no
other place on this page the owner would see it". It is on `heroPhoto` only.
`bandTeamPhoto`, `bandBuildingPhoto`, `aboutPhoto` and `servicesPhoto` have
plain labels — and all four default to `images/site/…`, the folder the warning
exists to say gets overwritten on every deploy.

## A-6.9 — `admin/README.md` still documents 30 backups

> **FIXED 2026-08-19** — `90 kept per prefix` in both places, with `BACKUP_KEEP` named. Evidence in `WHATS_LEFT.md` §1u.

`admin/README.md:31` and `:62`

A-5.15 raised `BACKUP_KEEP` from 30 to 90. `help.php` (seven sites) and
`backups.php` all render the constant, so they followed automatically. These two
lines hardcode "30 kept per prefix" and did not.

---

# Re-verified, not re-derived

Per GUARDRAILS §7, the security posture was checked rather than re-argued, and
it holds: `require_auth()` before output on every admin page; `csrf_check()` on
every mutating POST; uploads validated by extension and sniffed MIME with
non-user-controlled filenames; `basename()` + `realpath()` containment;
every dynamic echo through `h()`; optimistic-concurrency signatures on
`edit.php`, `settings.php` and `content.php`.

Two specific re-checks are worth recording because they came back **clean**:

* **The A-5.7 array-input class was swept for stragglers.** Every remaining
  unguarded `$_GET`/`$_POST` read was traced. `settings.php`'s `sf()`/`sfList()`
  guard with `is_string()`; `content.php`'s row loop guards with `is_array()`
  and coerces through `as_str()`; the rest compare with `===`/`in_array()`,
  which is array-safe. The one remaining raw read, `admin/index.php:24`, reaches
  only `h()`, which casts rather than throwing — a warning, not the 500 that
  A-5.7 was about. Nothing to fix.
* **`spectable-editor.js`'s new empty-row filter.** `String(r.label).trim()`
  would keep a row whose label is literal `null`, and the `.map()` after it
  would throw on `null.trim()`. It cannot happen: `enhanceSpecs()` normalises
  every row through `r.label != null ? String(r.label) : ""` before `data` is
  built, so `label` is always a string. Clean.

# Carried forward — already recorded, still open

Not re-reported as new; listed so the go-live picture is in one place.

* **`WHATS_LEFT.md` §2k, D-03 correction** — take the free dependency bump.
  `react-router-dom@6.30.6` pulls `@remix-run/router@1.23.4`, which is outside
  the GHSA-2j2x-hqr9-3h42 range, and it is a patch move inside the declared
  `^6.22.0`. Re-verified this round that no `navigate()`/`setSearchParam("page")`
  call site takes anything but a literal from a static table, so nothing is
  reachable — the bump is hygiene, not a patch.
* **A-5.10** — client-only rendering with no prerender. Bing, the AI answer
  engines and every social unfurler still see the shell.
* **Owner actions**, unchanged and still gating: rotate the live admin password
  (a working hash is in this public repo's history); resolve the four
  contradictory ISO 9001 claims; publish SPF/DKIM/DMARC and confirm the
  `noreply@` mailbox; set up Search Console; add an uptime monitor; decide
  apex-vs-www; verify `display_errors` is Off on the live server.

`CLAUDE.md`'s "~12,900-line" figure for `src/App.jsx` now measures 13,037. The
file already instructs the reader to re-measure rather than trust it, so this is
a refresh rather than a finding.
