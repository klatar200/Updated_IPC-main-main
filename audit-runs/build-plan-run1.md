# Build Plan — Run 1

**Source:** `audit-runs/audit1.md` (17 issues: 2 High, 7 Medium, 8 Low)
**Fixable here:** 15. **Human-required:** 2 (A-16 product decision, A-17 owner photography).
**Scorecards:** `audit-runs/scorecards-run1.md`

## Issue IDs

| ID | Title | Sev | Sprint |
|---|---|---|---|
| A-01 | Unvalidated Instagram/TikTok URLs rendered as raw hrefs | High | 1 |
| A-02 | Public site has no HTTPS redirect / security headers | High | 1 |
| A-03 | `/industries#industry-*` never scrolls on a cold load | Medium | 2 |
| A-04 | `contact.php` does not enforce `quantity` / `subject` | Medium | 2 |
| A-05 | Product Index category `<select>` has no accessible name | Medium | 3 |
| A-06 | SKU stored with no character validation | Medium | 4 |
| A-07 | Four `add.php` controls have no label | Medium | 3 |
| A-08 | `delete.php` has no viewport meta tag | Medium | 3 |
| A-09 | Sign-in / sign-out / failed sign-in not audit-logged | Medium | 4 |
| A-10 | Dashboard delete dialog claims delete cannot be undone | Low | 4 |
| A-11 | `edit.php` double-escapes the SKU-clash error | Low | 4 |
| A-12 | `audit-log.php` filter controls have no labels | Low | 3 |
| A-13 | `manifest.json` points at a non-existent icon | Low | 5 |
| A-14 | `sync.sh` never copies `admin/logo.svg` | Low | 5 |
| A-15 | Audit-log action vocabulary duplicated, no drift check | Low | 5 |
| A-16 | No-op "Save Content" rewrites `content.json` | Low | — (No) |
| A-17 | Five products' photos hosted by placehold.co | Low | — (No) |

---

## Global guardrails (all sprints)

1. `node _harness/invariants.js` must stay **17/17** and `php _harness/lint.php`
   must stay **all-pass** after every sprint. Neither may be edited to make a
   fix pass.
2. `npm run build` must succeed; re-run `sh _harness/sync.sh` before any
   browser measurement, or the mirror serves stale code.
3. Every fix is measured on the running mirror, not asserted from the diff.
4. No renames, no extractions, no reformatting. `src/components/`, `src/pages/`
   and `src/lib/` stay untouched — they are not in the bundle.
5. No copy, UX or API-contract change beyond what the listed issue requires.
6. Mirror data is restored to `_harness/pristine` after any sprint that writes
   through the admin.

---

## Sprint 1 — Close the two High-severity holes

**Goal:** No admin-settable value can put an executable or same-site-relative
URL in front of a visitor, and no visitor submits PII over cleartext.

**Issues:** A-01, A-02

**Tasks**
1. `admin/settings.php` — extend the social URL validation loop to cover
   `instagram` and `tiktok`. One-line change to the array it iterates.
2. `src/App.jsx` `FooterSocial` — defence in depth: render a channel only when
   its value parses as `http://` or `https://`. `site-info.json` is also
   FTP-editable, so server-side validation alone is not the whole gate.
3. `public/.htaccess` — add the HTTPS redirect and the response-header block,
   mirroring `admin/.htaccess`'s proven form. **No CSP** on the public site in
   this sprint: the React bundle uses inline styles extensively and a CSP that
   has not been measured against every page is a way to break the site while
   claiming to secure it. Ship the four headers that carry no such risk
   (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS) and record
   CSP as deliberately out of scope.

**Sprint guardrails**
- The HTTPS rule must carry the `X-Forwarded-Proto` condition, or a proxied
  host redirect-loops.
- HSTS must stay `env=HTTPS`-gated so it is never sent over plain HTTP.
- Do not touch the existing `sitemap.xml` rewrite or the SPA catch-all, and the
  new rules must sit so the sitemap rule still runs first.
- `FooterSocial` must keep rendering nothing (not an empty container) when no
  channel qualifies.

**Definition of done**
A `javascript:` value saved through `settings.php` is rejected at save; if
present in `site-info.json` by other means it is not rendered; all five real
social links still render; all 10 routes still 200 with the new `.htaccess` in
the mirror.

---

## Sprint 2 — Broken visitor flows

**Goal:** A shared industry link lands where it says, and a quote request
cannot reach sales without the field the form calls required.

**Issues:** A-03, A-04

**Tasks**
1. `src/App.jsx` — the mount scroll-to-top effect must not run when the URL
   carries a hash. Smallest correct fix; the anchor effect in `IndustriesPage`
   already works and stays untouched.
2. `public/contact.php` — add `quantity` to the RFQ required check and
   `subject` to the message required check, with error text in the same voice
   as the existing 422s.

**Sprint guardrails**
- Scroll-to-top must still fire on every ordinary navigation — a hash-free
  route change is the common case and regressing it is worse than the bug.
- The 422 body shape (`{ok:false,error:…}`) is a contract the React handler
  renders verbatim; do not change the shape, only add to the messages.
- Field caps, the honeypot, the referer rule and the rate limiter are not
  touched — the new check must sit with the other required-field checks, after
  them.

**Definition of done**
All five `#industry-*` anchors scroll on a cold load; a hash-free navigation
still lands at scrollY 0; RFQ without `quantity` and message without `subject`
both return 422 and are not mailed.

---

## Sprint 3 — Accessible names and mobile chrome

**Goal:** Every interactive control on the public site and in the admin has an
accessible name; the destructive admin page is readable on a phone.

**Issues:** A-05, A-07, A-08, A-12

**Tasks**
1. `src/App.jsx:9937-9951` — give the category `<select>` an `id` and point the
   existing label at it with `htmlFor`.
2. `admin/add.php` — add `for`/`id` pairs to Badges, Description,
   `specTable1_rows` and `specTable2_json`, matching how `edit.php` does it.
3. `admin/delete.php:79` — add the viewport meta tag the other 12 pages carry.
4. `admin/audit-log.php` — label the SKU input and the action select.

**Sprint guardrails**
- Labels only. No layout, style or copy changes — these fields are inside a
  form whose control count is asserted by `_harness/plan2-formlast.js` for
  `content.php`; do not add or remove controls anywhere.
- New `id`s must be unique on the page (the crawl asserts zero duplicate ids).
- `spectable-editor.js` and `product-preview.js` bind by `name` and by existing
  selectors; adding an `id` must not change either.

**Definition of done**
Zero unlabelled controls across all 10 public routes and all 13 admin pages;
zero duplicate ids; `delete.php` reports a viewport meta tag.

---

## Sprint 4 — Admin data integrity and honesty

**Goal:** A SKU cannot be entered that breaks its own uploads; the admin
records who signed in; the two remaining wrong-text defects are corrected.

**Issues:** A-06, A-09, A-10, A-11

**Tasks**
1. `admin/config.php` — one shared `sku_problems()` validator (the codebase's
   established shape for a rule two pages must agree on), enforcing at minimum
   "contains at least one alphanumeric character" plus a sane character set and
   length. `add.php` and `edit.php` both call it.
2. `admin/auth.php` — `audit_log()` on successful sign-in, on sign-out and on a
   failed attempt. Add the new action names to `audit-log.php`'s filter list
   and `action_color()`.
3. `admin/index.php:230` — correct the delete confirm text to match
   `delete.php:115` ("This can be undone — a backup is written first").
4. `admin/edit.php:141` — drop the inner `h()`.

**Sprint guardrails**
- The SKU rule must **accept every SKU already in the catalog** — all 42,
  including `IP12GA - IP1274`, `IP44A2 & IP45A3`, `IP41NE / IP43VT` and
  `IP71NS - IP72PS - IP73PP`. Assert that before shipping the rule; a validator
  that locks the owner out of editing his own products is worse than the bug.
- The failed-attempt log line must not record the attempted password or any
  part of it.
- Do not change `login_attempt_gate()` or any throttle behaviour — logging only.

**Definition of done**
All 42 existing SKUs pass the validator; `...` and `<script>x</script>` are
refused with a readable message; sign-in, sign-out and a failed attempt each
produce one audit-log line, all three filterable; the delete dialog and
`delete.php` agree; the SKU-clash error renders `O'Brien` correctly.

---

## Sprint 5 — Manifest, harness and drift

**Goal:** No asset the site declares is missing; the harness mirrors what
actually deploys; the audit-log vocabulary cannot drift silently.

**Issues:** A-13, A-14, A-15

**Tasks**
1. `public/manifest.json` — remove the `apple-touch-icon.png` entry. The SVG
   favicon already carries `sizes: "any"`; adding a PNG is a new asset and is
   out of scope for a fix.
2. `_harness/sync.sh` — copy `admin/logo.svg` (and any other non-PHP/JS asset
   in `admin/`) into the mirror.
3. `admin/audit-log.php` + `_harness/lint.php` — make the action vocabulary a
   single named list and add a `lint.php` drift check comparing it against the
   `audit_log()` call sites, in the same shape as the existing family and
   approval checks.

**Sprint guardrails**
- The new lint check must be proven to **fail** on an injected bogus action,
  the same standard the copy-drift check was held to.
- `sync.sh` must stay idempotent and must not start copying `admin/.htaccess`
  into the mirror — `php -S` ignores it and its presence would imply coverage
  the harness does not have.

**Definition of done**
`/apple-touch-icon.png` is no longer referenced anywhere; the mirror's admin
logo loads; `lint.php` gains a passing action-drift check that has been
demonstrated to fail on a planted mismatch.

---

## Not scheduled (human required)

| ID | Why | What is needed |
|---|---|---|
| A-16 | The behaviour is defensible — `content.php` offers those fields, so persisting them on save is consistent. Suppressing empty values would change what a save means. | A decision on whether an untouched empty field should be written. |
| A-17 | Five products need real photography. | Product photos from the owner; until then the placeholders are the honest state. |
