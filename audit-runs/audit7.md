# Audit 7 — pre-launch stability audit

**Base:** `ff62280` — `main` immediately after PR #50 merged the audit-6 work.
**Dates:** 2026-08-19 (findings 1–7) and 2026-08-26 (findings 8–10, and the
remediation of all ten).

## This file is the merge of two independent audit-7 passes

Two sessions audited `ff62280` separately and both filed "audit 7". The first
(2026-08-19) ran a **journey and cost** pass — follow one person through a whole
task, and ask what the code costs a stranger — and recorded seven findings
without fixing them, per GUARDRAILS §1. The second (2026-08-26) ran a
**stability and dependency** pass and found three more.

They were merged rather than left as two documents, because two files called
`audit7.md` and two `WHATS_LEFT.md` §2m sections cannot both exist: the second
to merge would conflict, `lint.php`'s section-drift check would fail on the
duplicate `§2m`, and a cross-reference to "A-7.1" would mean two different
things. Findings 1–7 keep their original numbers because that pass came first;
the second pass's three renumbered to **A-7.8, A-7.9, A-7.10**.

**Nine of the ten are fixed** (see §2). A-7.7 is deliberately not taken.

| Severity | Count |
|---|---|
| Blocker | 0 |
| High | 1 |
| Medium | 6 |
| Low | 3 |

---

## 0. The inherited state

Both passes ran the full suite **first**, before anything was read for findings,
so nothing below can be a regression either session introduced.

```
php _harness/lint.php     php -l 19/0 · node --check 10/0 · JSON 17/10/42
                          copy drift 110 matched · 11 families · 12 approvals
                          · 5 photo-slot defaults · 14 audit actions
                          · doc drift 46 refs resolve · section drift, none reused
npm run build             0 errors, 375.51 kB JS / 23.59 kB CSS
invariants                17/17        invariants-selftest   15/15

Full sweep: clean except the two documented expected-reds —
  plan8-polish            16/17  ← EXPECTED RED (DejaVu width artifact, Linux)
  brandtext               36/47  ← EXPECTED RED (11 failing; ceiling 13)
  plan8-contrast          34/35  ← its documented PASSING state
audit6 45/45 · audit5-blockers 18/18 · audit5-high 30/30 · audit5-medium 20/20
```

**PHP compatibility was re-checked rather than assumed.** `CLAUDE.md` targets
PHP 7.4+; the container runs 8.4. All 19 files parse clean under both readings:
no `str_contains`/`?->`/`match()`/attributes (7.4 breakers), and no
implicit-nullable parameters (deprecated in 8.4, and a printed notice on any
host that left `display_errors` on). Arrow functions are the newest construct
and are 7.4.

**The shipped bundle** is production React, no source maps, no `localhost` or
`TODO` strings, `console.error`/`console.warn` only.

---

## 1. Findings

### A-7.1 — MEDIUM — the 422 is the only rejection that leaves no record, and a real customer can reach it

`public/contact.php` — the RFQ branch and the message branch.

Every other exit in this file logs the lead before exiting: the 429, the 403,
the honeypot, the 500 — each with a comment saying why, because each was a
defect once. A-5.3's own words:

> That exit happens before `mail()` **and** before the inquiry log, so the lead
> was not merely undelivered, it left no trace at all.

**The 422 still did that.** A-5.3 fixed one *cause* of reaching it (the missing
`form_type`) without changing the exit.

That would be academic if only a malformed client could get there. It is not,
because **the browser and the server disagree about what an email address is.**
Measured with Chromium's constraint API and PHP side by side:

```
                          browser (type="email")     FILTER_VALIDATE_EMAIL
jane@acmecorp             ACCEPTS → submits          REJECTS
jane@localhost            ACCEPTS → submits          REJECTS
jane.smith@company,com    blocks                     REJECTS
jane@acme.com             ACCEPTS → submits          accepts
```

HTML5 deliberately permits a dotless domain — intranet addresses are legal — so
the browser hands the form over and the server refuses it. A dropped `.com` is
an ordinary typo.

**Measured end to end** against the live harness, watching the inquiry log:

```
  jane@acmecorp            HTTP 422   log delta +0
  jane.smith@company,com   HTTP 422   log delta +0
  jane@@acme.com           HTTP 422   log delta +0
  jane@acme.com            HTTP 200   log delta +1     ← CONTROL
```

With JavaScript on the visitor can correct it; with it off they got the raw JSON
of A-7.2. In **both** cases IPC had no record anyone tried.

### A-7.2 — MEDIUM — the no-JS submitter sees `{"ok":true}` and nothing else

`public/contact.php:21` (as it was).

Both forms carry `method="POST" action="/contact.php"` deliberately — that
native-submit path is the reason A-5.3 exists. A-5.3 made that path **succeed**;
it did not make the visitor able to tell. `Content-Type: application/json` was
set unconditionally and there was no HTML branch anywhere in the file.

**Measured** in a real browser with `javaScriptEnabled: false`:

```
--- JavaScript ON  (fetch path) ---
  lands on:  /contact?sent=1
  visitor sees: "… REQUEST SENT  Quote Request Received  Thank you! …"

--- JavaScript OFF (native submit) ---
  lands on:  /contact.php
  has a heading: false      has any link back to the site: false
  visitor sees: "{\"ok\":true}"
```

The lead is captured — that half works. The buyer is left on a white page
showing a machine response, with no confirmation, no phone number and no way
back.

### A-7.3 — MEDIUM — every anonymous request to `/admin/*` mints a session file that lives eight hours

`admin/config.php` (the session bootstrap), `admin/ping.php`.

`config.php` calls `session_start()` unconditionally at include time, and every
admin entry point includes it first. A request with no cookie and no credentials
still creates a session file — and `config.php` raises
`session.gc_maxlifetime` to **28,800 seconds** for the owner's benefit, so each
one is ineligible for collection for eight hours.

**Measured** against the live harness, counting `sess_*` in the save path:

```
  10 × GET /admin/ping.php   →  +10 session files
   5 × GET /admin/auth.php   →  +5
   5 × GET /admin/           →  +5   (these only redirect)
```

A-5.26 fixed the adjacent problem — `session.use_strict_mode`, so an attacker
cannot *choose* the id — and **its own comment already names `ping.php` as the
sharp edge**. A self-minted id still costs a file, which is the half that was
left. `ping.php` is unauthenticated by design, has no throttle, is polled
automatically by every open editing tab, and needs nothing from the session
except `is_authenticated()`, which is `false` by definition when no cookie was
sent. Sustained at 10 req/s for eight hours that is ~288,000 inodes, against
shared-hosting quotas that are typically 100k–500k.

The two failures compound: **A-5.9's own comment names inode exhaustion as the
condition under which the contact form's limiter files stop being written**, so
filling the session store through `ping.php` also switches off the contact
form's rate limit.

### A-7.4 — MEDIUM — the record A-5.6 made authoritative is the one with no failure signal

`public/contact.php` — `ipc_log_inquiry()`.

Return type `void`, the write `@`-suppressed and unchecked, and the loop simply
`return`s if neither candidate `admin/` directory exists. "Best-effort by
design" was a reasonable call when it was written.

**A-5.6 changed what this file is for.** It added the unread-lead badge, the
dashboard panel, and copy that tells the owner in as many words: *"Every quote
request is saved here even when the notification email does not arrive, so this
is the list to trust."* The design intent moved; the failure handling did not
follow.

| `mail()` | log write | visitor sees | record kept |
|---|---|---|---|
| ok | ok | 200 success | yes |
| fails | ok | **500 + phone number** | yes |
| ok | **fails** | **200 success** | **none** |
| fails | fails | 500 + phone number | none |

Row 3 tells the visitor everything worked and leaves nothing behind. The
permission case is caught by the dashboard's `admin_writable()` banner — but
that is a bare `is_writable(__DIR__)`, so a log file that is individually
unwritable, locked, or replaced by a directory returns `true`, and so does a
full disk or an exhausted inode quota.

### A-7.5 — LOW — the owner-facing guide still says 30 backups

`Editing-Your-Site-Content.md:84`. `BACKUP_KEEP` has been **90** since A-5.15.
A-6.9 swept this drift and fixed `admin/README.md` — it grepped the developer
docs and not the owner-facing ones, so the copy Rick actually reads stayed
wrong. A full re-sweep of every `.md` outside the append-only records found this
and nothing else; `help.php` and `backups.php` both render the constant.

### A-7.6 — LOW — a photo too large to resize ships silently at full size

`admin/upload-image.php`, `admin/config.php`.

A-6.6 added `IMG_MAX_PIXELS` so an oversized image is left alone instead of
killing the request — the right trade. But the success message only spoke when
the resize *happened*, so over the ceiling the owner saw *"Photo uploaded and
product updated."* — **identical to the message for a photo that was already a
sensible size** — while a 60-megapixel file became the eagerly loaded LCP image
on that product page. A gap in audit 6's own fix.

### A-7.7 — LOW — there is no print stylesheet *(deliberately not taken — see §3)*

`src/index.css`, `src/App.jsx`. Measured with `emulateMedia({media:'print'})`:
**0** `@media print` rules, 440 px of footer and 65 px of header printed, the
`<h1>` starting at y=364 on a ~1800 px (two-page) document, 94 dark blocks
totalling ~13.1M px². A gap rather than a defect.

### A-7.8 — HIGH — the spec-table shape gate was write-side only, and a backup restore walks past it

`src/App.jsx` — `SpecTable1`, `SpecTable2`, `additionalPdfs`.

`audit-runs/audit5.md` **A-5.12** (*"a malformed-but-savable spec table crashes
the product page"*) was closed on 2026-08-18. `grep -rn 'A-5.12'` finds the
marker in `admin/add.php`, `admin/edit.php` and `admin/config.php`. It finds it
in **no JSX**. The renderer was never touched.

That is the same reasoning this codebase already rejected, in writing, for
`pdfUrl`. From the L4 comment above `safeHref()`:

> `pdfUrl` and `additionalPdfs[].url` are gated where they are WRITTEN … but not
> where they are rendered, which is the same argument A1 rejected for the footer
> link: **data/ is a plain file, so an FTP edit or a backup restored from before
> those gates existed reaches the component with nothing in between.**

For spec tables the consequence is worse than a dead link, and the reachable
path needs no FTP at all:

- `admin/backups.php:25-29` restores the catalog by calling `save_products()`
  directly.
- `save_products()` sorts by SKU, encodes and writes. It runs **none** of the
  form-level shape checks — those live in the `add.php` and `edit.php` POST
  handlers, which a restore does not go through.
- `BACKUP_KEEP` is **90 per prefix**, so every backup written before 2026-08-18
  predates the gate and carries the pre-gate shape.

The owner opens Backups, clicks Restore on a version from before the gate
landed, gets a success message — and the product page is gone.

**Measured** — six shapes, each with an untouched neighbouring product as a
control on the same catalog load:

| Arm | Shape written into the catalog | Before |
|---|---|---|
| `T2-FLAT` | `specTable2.rows = ["8.0","9.0"]` — A-5.12's own repro | ErrorBoundary, no `<h1>` |
| `T2-NULLROW` | `specTable2.rows = [null]` | ErrorBoundary, no `<h1>` |
| `T2-NULLCOL` | `specTable2.columnSpans = [null]` | ErrorBoundary, no `<h1>` |
| `T1-NULLROW` | `specTable1.rows = [null]` | ErrorBoundary, no `<h1>` |
| `T1-OBJVAL` | `specTable1.rows = [{label:{},value:{}}]` | ErrorBoundary, no `<h1>` |
| `PDF-NULLROW` | `additionalPdfs = [null]` | ErrorBoundary, no `<h1>` |

In all six the **control product rendered correctly on the same load**, and the
navbar and footer survived — a contained per-page crash, not the whole-root
unmount L2 fixed. `/datasheets` was checked in the same pass and does not crash
on `additionalPdfs = [null]`; only the two product-page render sites do.

### A-7.9 — MEDIUM — the fetch timeout reached one of the three files it protects

`src/App.jsx` — `useRefetchOnReturn()`.

`PRODUCTS_FETCH_TIMEOUT_MS` (12 s, `AbortController`) exists because of
`DEPLOY_READINESS_v2` **T2.1**: *"An origin that accepts the connection and then
hangs used to leave the site on the loading skeleton forever, with no error and
no retry."* It was applied in `fetchProductsCached()` and nowhere else.
`site-info.json` and `content.json` — the same three files, in the same folder,
from the same origin — go through `useRefetchOnReturn()`, which had a bare
`fetch()`.

A hang there does not blank the chrome; the providers render defaults, which is
invariant 8 doing its job. The cost is compounding: `last` is stamped when the
fetch **starts**, so every visibility change past the TTL opens another request
that will also never settle. Six exhaust the browser's per-origin connection
pool, and the next request to queue is whichever one the visitor needs —
including the catalog fetch, whose own 12 s abort cannot fire before it has a
socket to abort.

**Measured**, with the guarded fetch as the control:

```
                                    BEFORE            AFTER
catalog     (has the 12 s guard)    failed            failed      ← CONTROL
site-info   (useRefetchOnReturn)    pending           failed
```

### A-7.10 — MEDIUM — `npm audit fix` was recommended twice and never run

`WHATS_LEFT.md` §2k *Corrected records* and §2l *Carried forward* both say the
same thing across two consecutive audits:

> Recommendation: take the free `react-router-dom@6.30.6` bump — re-verified
> this round that no `navigate()` call site takes anything but a literal, so
> nothing is reachable; the v7 migration stays the owner's call.

It was never executed. `npm audit` at audit time: **8 vulnerabilities (1 low,
4 moderate, 3 high)**. Only one group ships:

| Package | Ships? | In-range fix |
|---|---|---|
| `react-router-dom` / `react-router` / `@remix-run/router` | **yes, in the bundle** | 6.30.3 → **6.30.6** |
| `postcss`, `nanoid`, `@babel/*` | no — build only | patch bumps |
| `esbuild` / `vite` | no — **dev server only** | **none in range** — needs `vite@8` |

---

## 2. Fixed

Nine of the ten, on one branch. Each finding above is left as written, because
it is the record of what was true at audit time.

| ID | File | What changed |
|---|---|---|
| **A-7.1** | `public/contact.php`, `admin/inquiries.php` | Both 422 exits call `ipc_log_inquiry(ipc_partial_entry(…))` first, with a note naming the missing fields. The two new types are **registered in `$REJECTED`** — see below. |
| **A-7.2** | `public/contact.php` | `respond()` — one exit for every response, content-negotiating on `Accept`. Plus `hesc()`, the file's first HTML render boundary. |
| **A-7.3** | `admin/config.php`, `admin/ping.php` | `IPC_SESSION_OPTIONAL`: a caller may decline to have a session *started*, honoured only when the request carries no `IPCADMIN` cookie. `ping.php` opts in; `auth.php` does not. |
| **A-7.4** | `public/contact.php`, `admin/index.php`, `.gitignore` | `ipc_log_inquiry()` returns `bool`, checks the byte count, clears or writes `admin/.inquiry-log-failed.json`, and the dashboard health banner reads it. |
| **A-7.5** | `Editing-Your-Site-Content.md` | 30 → 90. |
| **A-7.6** | `admin/config.php`, `admin/upload-image.php` | `image_downscale_in_place()` takes a `&$reason` out-param; over the ceiling the owner is told the photo was saved at full size and asked to resize it. |
| **A-7.7** | — | **Not taken.** See §3. |
| **A-7.8** | `src/App.jsx` | `specRows1()`/`specRows2()`, one definition each of "a row this component can draw", with `specHasRows()` counting the same thing. `asText()` on every spec slot; `productExtraPdfs()` filters `additionalPdfs` at both render sites. |
| **A-7.9** | `src/App.jsx` | The same `AbortController` + `PRODUCTS_FETCH_TIMEOUT_MS` pair `fetchProductsCached()` carries, with the timer cleared on both settle paths. |
| **A-7.10** | `package-lock.json` | `npm audit fix`. 21 patch bumps; `vite`/`esbuild` deliberately not taken. |

### A-7.1's fix had a trap in it, and the suite caught it

Adding the logging is four lines. Adding it **without** registering
`rfq-incomplete` and `message-incomplete` in `admin/inquiries.php`'s `$REJECTED`
map would have re-created the **NB10** defect that map exists for: an entry the
map does not know is counted as a real inquiry with `sent = false`, so it lands
in `$failed` — the number Rick watches to decide whether mail is broken. One
mistyped email address would have pinned it above zero and sent him chasing a
mail problem that did not exist.

### A-7.4's marker, and the limit of it

The visitor still gets **200** when only the log write fails, deliberately: the
mail did go, so telling them to resend would be wrong. The signal belongs on the
owner's side.

The marker is best-effort too, and the limit is stated rather than papered over:
if the whole filesystem is out of space or inodes, creating it fails as well.
What it covers is what `admin_writable()` cannot — a log file that is
individually unwritable, locked, or replaced by a directory. It is cleared by
the next write that succeeds, so the banner says *"this is happening now"*, not
*"this happened once"*.

### What is left after A-7.10, and why each one is unreachable here

`npm audit` goes **8 → 4**. No package added or removed, `package.json`
untouched: 21 patch bumps in the lock file. The four that remain all need
`--force` and a breaking major, and each was re-derived against this app:

| Advisory | Why it does not reach this site |
|---|---|
| GHSA-67mh-4wv8-2f99 (`esbuild`/`vite`) | A **dev-server** issue. `vite` is a `devDependency`, the dev server never runs on the host, and nothing esbuild emits carries it into `dist/`. |
| GHSA-337j-9hxr-rhxg (`react-router`, SSR hydration) | Requires SSR. `src/main.jsx` is `createRoot` — no `hydrateRoot`, no `renderToString`, no `StaticRouter` anywhere in the tree. |
| GHSA-wrjc-x8rr-h8h6 (`react-router`, open redirect via **backslash** in `<Link>`/`useNavigate`) | Needs an attacker-controlled path. Exactly **three** `navigate()` call sites, all through `pageToPath()`. Its input is a literal at 38 `PageLink` sites; the other seven read a `page` field from `content.json`, and `content.php` validates every `'page'`-type field against a fixed options map (`:575-577`, `:665-666`). The remaining source is the URL, and `location.pathname` returns a backslash percent-encoded, so `/\evil.com` arrives as `%5Cevil.com` and resolves same-origin. |

This is the same conclusion audit 4's D-03 and audit 5 reached about the *older*
advisory, but it is re-derived here for the **new** one — the backslash bypass
did not exist when those were written, and it is the same backslash class as
A-5.13, so it was worth checking rather than assuming.

### The five `(X || []).map(...)` sites went with A-7.8

The audit-5 Low tier introduced `asList()`/`asText()`, and its comment in
`src/App.jsx` names the exact pattern it was written to kill:

> the product page did `(product.description || []).map(...)`, **which throws on
> a string** … Coerce instead of crashing — a wrong type should degrade to
> something renderable, exactly as a missing one already does.

It was then applied to "the five sites that crashed" and left five others
carrying it: `ind.useCases`, `ind.products`, `ind.certs`, `svc.details` and the
`services` lead-time scan — every one reading an owner-editable `content.json`
field. `(x || [])` guards null and undefined and does nothing about a string,
which is the case the comment is about. Same finding in a different file, not a
second one.

---

## 3. Considered and NOT taken

- **A-7.7, the print stylesheet.** The only finding left open. It is a genuine
  gap — buyers do print spec pages into requisitions — but closing it means
  adding `@media print` rules, and this remediation was scoped explicitly to
  *no structural or UI changes*. It is cheap and self-contained (hide header,
  footer and CTAs; force white backgrounds; `break-inside: avoid` on the spec
  table) and should be its own change, judged by eye, rather than folded into a
  stability pass. **Still open.**
- **Coercing the scalar product fields** (`product.name`, `product.sku`,
  `product.caption`, `partType`, …) at their ~15 render sites. An object in one
  of those is the same React throw A-7.8 fixes. Not taken: unlike the spec
  tables, this would *invent* a rule rather than finish one. These fields are
  written through `as_str()` on every path and no backup era exists in which
  they held anything but strings, so the only way in is an FTP hand-edit that
  types an object into a field that has always been a line of text.
- **`{prod.sku}` reaching a URL param.** A non-string stringifies to
  `[object Object]` and soft-404s. Ugly, not a crash, and the soft-404 path is
  already tested (`plan9-notfound`).
- **A real deny-by-default in `uploads/.htaccess`.** Still the right call to
  leave alone, for the reason written into the file: it cannot be tested here
  (`php -S` ignores `.htaccess`) and getting it wrong 404s every product photo.
- **A-5.10 — no prerender.** Unchanged: deliberately deferred, owner's call.
- **`brandtext`'s 11 failing combinations.** The logged open item
  `brand-text-on-brand-surface`, held at a ceiling of 13. A contrast decision,
  not a stability defect, and touching it is a UI change.
- **Extending the A-7.3 opt-out beyond `ping.php`.** `auth.php` genuinely needs
  a session on GET — it renders a CSRF token — and `index.php` needs one to
  decide whether to render the login screen (invariant 12 forbids redirecting a
  POST). `ping.php` is the sharp edge: machine-polled, unthrottled, and needing
  nothing from the session. Narrow on purpose.

---

## 4. Checked, no finding

- **The shipped site throws nothing.** Ten routes plus three product pages
  crawled in Chromium: 0 console errors, 0 failed requests, 0 responses ≥400.
- **The catalog scales — and the measurement retired the hypothesis.** "1.24 MB
  of JSON on every load at 500 products" looked like a finding until measured:

  ```
    42 products  JSON 0.10 MB   /dashboard 844 ms (42 rows)   /products 759 ms
   200 products  JSON 0.50 MB   /dashboard 835 ms (200 rows)  /products 779 ms
   500 products  JSON 1.24 MB   /dashboard 883 ms (500 rows)  /products 883 ms
  ```

  A 12× catalog costs 39 ms. There is no scaling cliff, and saying so is worth
  more than a speculative finding.
- **A-6.3's broadened redaction has no catastrophic backtracking.** It nests a
  quantifier — the classic ReDoS shape — so it was timed rather than reasoned
  about: six adversarial 200-character inputs at **0.029 ms per call** worst
  case.
- **No regex is ever built from user input.** `new RegExp` appears nowhere in
  `src/App.jsx` or the admin JS; every `preg_*` pattern is a literal with user
  data only as the subject.
- **The A-6.1 CSP class has no stragglers.** The whole admin was re-swept:
  **zero** inline event handlers, **zero** inline `<script>` blocks (the one
  grep hit is `<script>x</script>` inside a comment at `config.php:1509`), zero
  `eval`, zero `new Function`. All 21 script tags carry `src`.
- **The deploy manifest vs what the build emits.** `dist/` holds exactly
  `index.html`, `assets/`, `images/`, `.htaccess`, `.user.ini`, `contact.php`,
  `sitemap.php`, `favicon.svg`, `logo.svg`, `manifest.json`, `robots.txt` — and
  `README.md`'s upload table names every one, plus the three `.htaccess` files
  that travel from the repo. This is what A-6.2 was, and it holds.
- **Secrets.** No bcrypt hash in any tracked file outside frozen audit history
  and the harness's own synthetic sentinel. `config.local.php`, both JSONL logs,
  the throttle file and `ALLOW-PASSWORD-RESET` are all gitignored — and
  `.inquiry-log-failed.json` was added alongside them.
- **The health banner** covers `admin/`, `data/`, `uploads/images/`, `pdfs/`,
  the system temp folder, the password-reset window — and now the inquiry-log
  failure A-7.4 added.
- **`sitemap.php`.** Both catalog shapes, non-scalar ids skipped per row, 200
  with the ten static routes on any failure.

---

## 5. Owner actions — not code, and still outstanding

The two that are genuinely launch-gating:

- **Rotate the live admin password.** A working hash is in this public repo's
  history.
- **Resolve the four contradictory ISO 9001 claims.**

And the rest of the launch list:

- Publish SPF/DKIM/DMARC and confirm the `noreply@` mailbox exists.
- Search Console: verify the property and submit `/sitemap.xml`.
- Add an uptime monitor and a contact-form self-test.
- Decide apex-vs-`www` and check the certificate covers both.
- Verify `display_errors` is actually `Off` on the live server, and that
  `.user.ini` is being honoured — the admin Help page prints the live values.
- **Upload the three data-tree `.htaccess` files by hand** on the next deploy.
  `data/.htaccess`, `pdfs/.htaccess` and `uploads/.htaccess` all changed across
  audits 5 and 6, none is in `dist/`, and nothing downstream carries them.
  `README.md`'s upload table names them (A-6.2); the FTP session has to include
  them or half of A-5.2 stays on the laptop.
- **Confirm the five `.htaccess` files actually took effect**, once, after the
  deploy. Nothing local can check this — `php -S` ignores `.htaccess` entirely
  (GUARDRAILS §4.3) — and every one of them uses `Order Allow,Deny`, Apache 2.2
  syntax served by `mod_access_compat` on 2.4. Four one-request checks settle
  it:
  - `curl -sI https://…/data/products-all.json` → `200`, `Content-Type:
    application/json`, `X-Robots-Tag: noindex`. A `500` means
    `mod_access_compat` is absent and the catalog is down.
  - `curl -sI https://…/.user.ini` → `403`.
  - `curl -sI https://…/sitemap.xml` → `200` and XML, not the SPA shell.
  - `curl -sI -H 'Accept-Encoding: gzip' https://…/assets/index-*.js` →
    `Content-Encoding: gzip` (A-6.4's fix — 376 kB vs 108 kB on every cold
    load).
