# Go-live runbook

One ordered checklist for the deploy. Everything here already exists somewhere —
`README.md`'s manifest, `audit-runs/audit7.md` §5, `WHATS_LEFT.md` §2j — and
that is the problem this file solves: on deploy day nobody reads four documents
and reassembles the order. **`README.md` remains authoritative on *what* to
upload; this file is the *sequence*.**

Written 2026-08-27 for the 2026-08-29/30 launch (audit-runs/audit8.md).

---

## STEP 0 — Which deploy is this? Answer before touching anything

The rest of the file branches here, and getting it wrong is destructive in both
directions.

```
Open https://www.insulationproducts.com/data/products-all.json in a browser.
```

| What you see | You are doing | Then |
|---|---|---|
| A JSON catalog of products | **a re-deploy** onto a live site | Follow **A**. Never upload `data/`, `pdfs/` or `uploads/` contents — they are Rick's live edits and an FTP overwrite creates no backup. |
| 404, or nothing there | **the first deploy** | Follow **B**. The three data folders go up exactly once, now. |

If it loads but the products look wrong or old, stop and diff it against
`data/products-all.json` in the repo before deciding. **Downloading the
server's copy costs a minute; overwriting it is irreversible.**

### STEP 0b — and then check where the front door goes

A 404 above answers "is *this* project live". It does not answer "is anything
live", and on 2026-09-15 those had different answers.

```
curl -sI http://www.insulationproducts.com/
```

**If it answers `301 → https://www.…`**, that is what the code expects; carry on.

**If it answers anything else — a `302` or `301` into a subfolder — stop and
read [`audit-runs/live-triage-2026-09-15.md`](audit-runs/live-triage-2026-09-15.md).**
As measured on 2026-09-15 this line answers `302 → /site/`, and
`public_html/site/` holds a live predecessor of this site, uploaded 2026-09-04,
whose 42 products all show a broken photo and a broken datasheet and whose every
URL but the homepage 404s.

That matters here for one reason: **a first deploy into `public_html/` will be
correct and invisible while the redirect stands** — every visitor is still sent
to the old, broken copy. Removing the redirect is a host action, it has to
happen in the same session as the deploy, and it has a prerequisite (retrieve
`/site/admin/inquiries.jsonl` first, if the predecessor's form was collecting
quote requests). The triage record carries the ordered list.

---

## A — Before deploy day (do these this week, not Saturday)

These are the ones that need someone other than you, so they cannot be done at
the last minute.

- [ ] **Resolve the ISO 9001 revision claims.** The site currently advertises
      **two different withdrawn revisions** of a certification, in six places,
      on two different admin screens. Run `node _harness/isoclaims.js` for the
      exact list. This needs the registrar's answer, not a guess — see
      `audit-runs/audit8.md` **A-8.5**. Nothing in the code will fix it and
      nothing should: writing `:2015` because it is the current standard would
      invent a certification claim for a supplier to aerospace, medical and
      automotive.
- [ ] **Rotate the admin password.** A working hash is in this public repo's
      history. Sign in → **Password**. Do this *before* the site is public, not
      after.
- [ ] **Confirm `noreply@insulationproducts.com` exists** as a real mailbox or
      alias on the account. Network Solutions requires the `From:` address to
      exist on the account to pass their outbound filter, and every quote
      notification and auto-reply is sent from it.
- [ ] **Publish SPF, and DKIM/DMARC if the host offers them.** Without SPF the
      quote notifications land in spam, which looks exactly like "the form is
      broken".
- [ ] **Decide apex vs `www`, and make the server agree with the code.** The
      code has already decided: `SITE_ORIGIN` (`src/App.jsx`), `sitemap.php`'s
      `$ORIGIN`, `robots.txt`'s `Sitemap:` line and `index.html`'s `og:url` all
      say **`https://www.insulationproducts.com`**, consistently. So the server
      needs a 301 from the apex to `www`, and a certificate covering both. If
      the apex is served without redirecting, every page declares a canonical
      it is not being served at, and `sitemap.php` advertises 52 URLs on the
      wrong host.

      ⚠ **2026-09-14 — this is now a GATE, not a checklist item.** Audit 9
      measured the live host (`_harness/out/audit9/step0.md`): both the apex and
      `www` present an **expired** `CN=*.hostingplatform.com` certificate, which
      is not issued for this hostname at all, and plain HTTP answers
      `302 → /site/` rather than `301 → https://www.…`. The privacy policy tells
      visitors their data is transmitted over HTTPS. **Deploying before the host
      fixes this publishes a false statement in a legal document** — see
      `audit-runs/audit9.md` A-9.P5a-1. Nothing in the repo can fix it; it is
      the host's to do, and it has to be done before deploy day, not after.
- [ ] **Retrieve `/site/admin/inquiries.jsonl` from the server** — or establish
      that the predecessor site's contact form was never wired to one. Every
      other file under `public_html/site/` is byte-identical to something in
      this repo (`audit-runs/live-triage-2026-09-15.md` §6), so that log is the
      one thing on the host that cannot be reproduced from here. It was not
      opened during the audit: reading it means signing into `/site/admin/`,
      which is yours to do, not the auditor's.
- [ ] **Remove the `/` → `/site/` redirect**, and confirm
      `curl -sI http://www.insulationproducts.com/` no longer points into a
      subfolder — **before** uploading anything. It is in the Network Solutions
      panel or a root `.htaccess` above `public_html/`. Left in place, a
      perfectly correct deploy is invisible: visitors keep landing on the old
      broken copy. STEP 0b and
      `audit-runs/live-triage-2026-09-15.md` §8.
- [ ] **Apply the two corrected privacy-policy sections.** ⚠ **On a re-deploy
      this is an ADMIN EDIT, not a file upload.** The policy renders from
      `data/content.json`, which is live customer state and is *never*
      re-uploaded — and `mergeContent()` prefers live data over the built-in
      defaults, so the corrected text in the bundle will not appear on a site
      that already has its own `content.json`. Paste it in at
      **Admin → Page Content**, the block headed **"Privacy Policy —
      Sections"**. Find the row whose *Section heading* matches, and replace
      the whole of its *Section text*. Both fields are textareas with no length
      cap, so paste the full paragraph. (On a *first* deploy the repo's `data/`
      is uploaded and this is already done — nothing to do.)

      Why they changed (`audit-runs/audit8.md` A-8.7, A-8.8): the old text
      enumerated only what the visitor types, while every submission also
      stores the IP address — including submissions the spam and rate-limit
      checks reject — and it promised deletion "not to exceed three (3) years"
      when nothing is ever deleted. Both were untrue on a policy that names
      GDPR and CCPA by name.

      **Row headed "Information We Collect"** — replace its Section text with:

      > When you use the contact or quote request form on this website, we collect the information you provide: your name, company name, email address, phone number (optional), and the details of your enquiry — including any part numbers, quantities, materials, required dates and special requirements you enter on a quote request. We also automatically record the IP address the submission was sent from, together with the date and time. That address is not something you type: it is recorded for every submission, including any our spam and rate-limiting checks reject, and we use it only to protect the form from abuse. We do not collect payment information through this website.

      **Row headed "Data Retention"** — replace its Section text with:

      > Inquiry records — the details you submit, together with the IP address and timestamp described above — are kept for as long as they are needed to answer your enquiry and for our ongoing business record-keeping. They are not deleted automatically. If you would like the record of a particular enquiry removed, contact us using the details below and we will remove it.

      These are factual corrections, not legal advice. If the business wants a
      retention *ceiling* back, that is the other way to close A-8.8: keep the
      three-year sentence and add an annual prune of the rotated
      `admin/inquiries-*.jsonl` files. Nothing in the code does that today.
- [ ] **Set up an uptime monitor** on `https://www.insulationproducts.com/`
      (any free tier). The site is one FTP mistake away from a blank page and
      nothing else will tell you.

### Added 2026-09-14 by audit 9 — admin edits, not file uploads

All four render from `data/content.json` or `data/products-all.json`, which are
live customer state. Do them in the dashboard; do not re-upload `data/`.
Full records in `audit-runs/audit9.md` §2, summarised in §5.1.

- [ ] **Decide what "42 Products Stocked" counts, then change it**
      (**A-9.P4-4**, extended by **POST-9.1** — `WHATS_LEFT.md` §2p). It is
      typed by hand at **Admin → Page Content**, on a different screen from the
      catalog it counts, with no link between them — so it drifts the first time
      you add a product. Worse, it is already ambiguous: **42 is the catalog's
      page count, but those pages list 52 orderable part numbers** (eight records
      cover 2-4 parts each), and one of the 42 is the Value-Added *services*
      page, not a stocked product. Recommended: **52, relabelled "Part Numbers
      Stocked", derived from the catalog** rather than typed. Nothing should
      change on the homepage until you have chosen the number — every candidate
      is defensible and only one is what IPC means.
- [ ] **Rewrite FAQ answer 14** (**A-9.P5a-2**), at **Admin → Page Content →
      FAQ**. Two things in it are wrong. It tells the buyer to click a
      **"Data Sheet"** button; audit 9 gave that control one name across the
      product page and the name is **`Datasheet`**. It also promises "the full
      IPC product catalog PDF" on the Products page header and in the footer —
      there is no such file until `catalogPdfUrl` is filled in on **Business
      Details**, so either fill it in or drop the sentence.
- [ ] **Settle the certification marks first, then spell them consistently**
      (**A-9.P4-3** then **A-9.P5a-5**), at **Admin → Products → Edit**. The
      catalog cites three certification categories that no issuing body
      publishes, and the marks that *are* real are spelled several ways
      (`U/L` and `UL`, `Mil-Spec` / `MIL-Spec` / `MIL-SPEC`, `ROHS` and `RoHS`,
      `AMS-1234` and `AMS 1234`, `USFDA` and `FDA`). **Order matters**: A-9.P4-3
      changes which mark each string names, so a spelling pass done first has to
      be done twice.
- [x] ~~**One sitting on Products → Edit for the rest**~~ — **done in the repo
      2026-09-15**, before first deploy, so it ships with `data/`: the six
      misspellings (**A-9.P5a-4**), the inch mark on 21 cells across three SKUs
      (**A-9.P4-10**), and the three badge families whose majority form the
      catalog itself names (**A-9.P5a-8**, part). Nothing to do here on a first
      deploy. ⚠ On a **re-deploy** this does not apply: `data/` is live customer
      state and is never re-uploaded, so the same corrections would have to be
      made in the dashboard instead.
- [ ] **Two badge pairs and the certification marks still need you**
      (**A-9.P5a-8** remainder, **A-9.P5a-5**), at **Admin → Products → Edit**.
      `Low Temperature Flexibility` vs `Low-Temperature Flexibility` and
      `125°C Rated` vs `Rated 125°C` are one product each — there is no majority
      to normalise to, so pick the one you want. The certification marks are
      blocked behind **A-9.P4-3** above and must not be spelled until it is
      settled.

---

## B — The deploy

### B1. Build

```bash
npm install
npm run build
```

Confirm the build printed no errors and that `dist/` contains **eleven** things:
`index.html`, `assets/`, `images/`, `.htaccess`, `.user.ini`, `contact.php`,
`sitemap.php`, `favicon.svg`, `logo.svg`, `manifest.json`, `robots.txt`.

⚠ `.htaccess` and `.user.ini` are **dotfiles**. Most FTP clients hide them by
default. In FileZilla: *Server → Force showing hidden files*. If they do not
reach `public_html/`, every deep link 404s and the PHP limits stay at their
2M/8M defaults.

### B2. Upload, in this order

**Order matters. `assets/` first, `index.html` last.**

Vite content-hashes the bundle, so the new `assets/index-<hash>.js` lands
*beside* the old one and nothing points at it yet — the site keeps serving the
old pair the entire time. Overwriting `index.html` is then the single moment
the site switches, and it switches to a bundle that is already on disk. Done the
other way round, every visitor between the two uploads gets an `index.html`
pointing at a file that does not exist.

1. [ ] `dist/assets/` → `public_html/assets/`
2. [ ] `dist/images/` → `public_html/images/`
3. [ ] `dist/contact.php`, `sitemap.php`, `favicon.svg`, `logo.svg`,
       `manifest.json`, `robots.txt` → `public_html/`
4. [ ] `dist/.htaccess`, `dist/.user.ini` → `public_html/`
5. [ ] `admin/` → `public_html/admin/` *(only if the admin code changed)*
6. [ ] `admin/config.local.php` → `public_html/admin/` — **hand-deployed,
       gitignored, carries the only working password hash**
7. [ ] **first deploy only:** `data/`, `pdfs/`, `uploads/` → `public_html/`
8. [ ] **`data/.htaccess`, `pdfs/.htaccess`, `uploads/.htaccess`** — upload the
       **file**, never the folder, whenever it has changed. These are the only
       files in the tree Vite never copies into `dist/`, so nothing downstream
       carries them. `data/.htaccess` alone holds the
       `AddType application/json` that the site's `jsonOrThrow()` requires and
       the `X-Robots-Tag: noindex` half of the A-5.2 fix.
9. [ ] **`index.html` → `public_html/` — LAST**
10. [ ] **After C has passed — delete `public_html/site/`.** Not before: it is
        the only copy of the predecessor site and the fallback if the deploy has
        to be backed out. Once C is green it is a second, broken, indexable copy
        of the catalog sitting one path segment away — 42 broken photos, 42
        broken datasheets — and `/site/sitemap.xml` is still handing a crawler
        eight URLs. `audit-runs/live-triage-2026-09-15.md`.

### B3. Permissions

| Path | Mode | Why |
|---|---|---|
| `public_html/data/` | 755, writable by **PHP** | every admin save |
| `public_html/pdfs/` | 755, writable by PHP | data-sheet uploads |
| `public_html/uploads/images/` | 755, writable by PHP | photo uploads |
| `public_html/admin/` | 755, writable by PHP | audit log, **inquiry log**, throttle, password changes |
| `public_html/admin/config.local.php` | 600 or 644 | the password hash |

"Writable by PHP" is not the same as "writable by FTP". Where they differ, all
four writes fail silently — the dashboard banner in B4 is what catches it.

---

## C — Verify, in this order (ten minutes)

Each of these fails in a different way, so run all of them.

### C1. The five `.htaccess` files actually took effect

Nothing local can check this: `php -S` ignores `.htaccess` entirely, and every
one of these files uses Apache 2.2 `Order`/`Deny` syntax, served on 2.4 only by
`mod_access_compat`.

```bash
curl -sI https://www.insulationproducts.com/data/products-all.json
#  expect: 200 · Content-Type: application/json · X-Robots-Tag: noindex
#  a 500 here means mod_access_compat is absent and the catalog is DOWN

curl -sI https://www.insulationproducts.com/.user.ini            # expect 403
curl -sI https://www.insulationproducts.com/admin/config.php     # expect 403
curl -s  https://www.insulationproducts.com/sitemap.xml | head -3
#  expect XML, not the SPA shell

curl -sI -H 'Accept-Encoding: gzip' https://www.insulationproducts.com/assets/index-*.js
#  expect: Content-Encoding: gzip  (376 kB vs 108 kB on every cold load)

curl -sI http://www.insulationproducts.com/                      # expect 301 → https
curl -sI https://insulationproducts.com/                         # expect 301 → www
```

### C2. The site

- [ ] `https://www.insulationproducts.com/` loads and the catalog populates.
- [ ] **Deep link and refresh**: open `/products`, press F5. If it 404s,
      `.htaccess` did not reach `public_html/`.
- [ ] A product page renders its spec tables — e.g. `/products?productId=IP38FE`.
- [ ] The footer shows the phone number.

### C3. The admin

- [ ] `/admin/` — sign in.
- [ ] **No red "Server setup problem" banner.** It names any folder PHP cannot
      write, the open password-reset window, and (since A-7.4) an inquiry log
      that cannot be written.
- [ ] **Help → What your server allows.** If it reads **2M / 8M / 1000**,
      `.user.ini` is not being applied on this host — move the same directives
      into a `php.ini` in `public_html/`.

### C4. The one journey the site exists for

- [ ] Submit the contact form once, for real.
- [ ] The notification email arrives at the sales address — **check spam**.
- [ ] It also appears under **Admin → Inquiries**. Both must be true: the email
      proves `mail()`, the Inquiries row proves the log. Either alone is a
      half-working form.
- [ ] The auto-reply arrives at the address you submitted.

---

## D — After launch

- [ ] **Search Console**: verify the property (on whichever of apex/`www` you
      chose in A) and submit `https://www.insulationproducts.com/sitemap.xml`.
- [ ] Re-run C4 a week later. A form that worked on Saturday and silently stops
      is the failure mode with no symptom.
- [ ] Check **Admin → Inquiries** in the first week even if no email arrived —
      that is exactly what the log is for.

---

## If something is wrong

| Symptom | First thing to check |
|---|---|
| Blank page | Did you upload `dist/` itself instead of its **contents**? |
| Blank page, console error about a missing `assets/…js` | `index.html` went up before `assets/`. Upload `assets/` and it resolves. |
| Deep links 404 on refresh | `.htaccess` is missing from `public_html/` — it is a hidden dotfile |
| "Catalog Unavailable" | `data/products-all.json` missing, unreadable, or served without `Content-Type: application/json` (that is `data/.htaccess`, step B2.8) |
| Admin rejects a known-good password | `config.local.php` missing or overwritten. Recovery: FTP an empty file named `ALLOW-PASSWORD-RESET` into `public_html/admin/`, open `/admin/`, set a new password. Deleting `config.local.php` on its own **locks the admin**, it does not reset it |
| Form says "mail server could not send" | The `noreply@` mailbox does not exist on the account (step A) |
| Leads in email but not in Inquiries | `admin/` is not writable by PHP. The dashboard banner says so |

### Rolling back the frontend

Re-upload the **previous `index.html`**. Content-hashed filenames mean the
previous `assets/index-<hash>.js` and `.css` are still on the server unless
someone deleted them, so the old shell finds its old bundle. Keep the `dist/`
you deployed last time, or download `index.html` before overwriting it — that
one file is the entire rollback.

This is the **frontend only**. `data/` rolls back through **Admin → Backups**,
which keeps the 90 most recent saves per file and backs up the current state
before restoring, so a restore can itself be undone.
