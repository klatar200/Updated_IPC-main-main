# Go-live runbook

One ordered checklist for the deploy. Everything here already exists somewhere —
`README.md`'s manifest, `audit-runs/audit7.md` §5, `WHATS_LEFT.md` §2j — and
that is the problem this file solves: on deploy day nobody reads four documents
and reassembles the order. **`README.md` remains authoritative on *what* to
upload; this file is the *sequence*.**

Written 2026-08-27 for a 2026-08-29/30 launch that did not happen; nothing is
deployed yet (audit-runs/audit8.md). Re-verified against the code 2026-10-05
(WHATS_LEFT §1aq) — the steps hold for whichever day the deploy is.

---

## STEP 0 — Which deploy is this? Answer before touching anything

The rest of the file branches here, and getting it wrong is destructive in both
directions.

```
Open https://www.insulationproducts.com/data/products-all.json in a browser.
```

| What you see | You are doing | Then |
|---|---|---|
| A JSON catalog of products | **a re-deploy** onto a live site | Check **A**, then follow **B** — skipping B2.0 and B2.7. Never upload `data/`, `pdfs/` or `uploads/` contents — they are Rick's live edits and an FTP overwrite creates no backup. |
| 404, or nothing there | **the first deploy** | Do **A** first (before deploy day), then **B**. The three data folders go up exactly once, in B2.7. |
| A certificate / "not secure" warning before any page | **nothing yet** | Stop: that is the §A **certificate GATE** (apex/`www` item) — no deploy until the host fixes it. To answer this step meanwhile, `curl -sk -o /dev/null -w '%{http_code}\n' https://www.insulationproducts.com/data/products-all.json` (`-k` skips the certificate check for this one read-only request) and use the 200 / 404 rows. |

**A catalog here does not always mean a re-deploy.** If an earlier first-deploy
attempt stopped part-way (after B2.7 but before B4) or was backed out with the
first-deploy rollback, the catalog is on the server but the site never went
live. If `/admin/` shows **"Admin Not Configured"**, or `/` still redirects to
`/site/` (STEP 0b), this is **still the first deploy**: do B2.0 and B4. B2.7
can be skipped only if nobody has edited anything since — the `data/` on the
server is the repo's own.

A redirect is not expected here: re-measured 2026-09-27, this URL answers 404
directly and only `/` redirects — STEP 0b handles that
(`audit-runs/audit-2026-09-27.md`, NEW-V4-4). If it does redirect, stop and read
STEP 0b before deciding.

If it loads but the products look wrong or old, stop and diff it against
`data/products-all.json` in the repo before deciding. **Downloading the
server's copy costs a minute; overwriting it is irreversible.**

### STEP 0b — and then check where the front door goes

A 404 above answers "is *this* project live". It does not answer "is anything
live", and on 2026-09-15 those had different answers.

```
curl -sIL http://www.insulationproducts.com/ | grep -iE '^HTTP|^location'
```

`-L` follows every hop. Asking only the `http://` address is not enough: once
the host forces HTTPS, that answers `301 → https://www.…` whether or not a
`/site/` redirect sits behind it on the `https://` side.

**If every hop ends on `https://www.insulationproducts.com/` with no subfolder
in any `location:`**, that is what the code expects; carry on.

**If any hop points into a subfolder — a `302` or `301` to `/site/` — stop and
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

- [ ] **Confirm which ISO 9001 revision IPC holds.** Since 2026-09-15 the
      site claims plain **`ISO 9001`** everywhere, from one field (Admin →
      Business Details → ISO Certification), and no withdrawn revision renders
      anywhere (`node _harness/isoclaims.js` asserts it). What is still open is
      the registrar's answer: add the revision year to that one field only once
      it is confirmed — see `audit-runs/audit8.md` **A-8.5**. Writing `:2015`
      because it is the current standard would invent a certification claim
      for a supplier to aerospace, medical and automotive. (Until 2026-09-29
      this item said the site "currently advertises two withdrawn revisions in
      six places", which §1aa of `WHATS_LEFT.md` had made false.)
- [ ] **Rotate the admin password — never by uploading a file.** A working
      hash is in this public repo's history. On a **first deploy** there is no
      password on the server, and the admin fails closed ("Admin Not
      Configured"); setting a fresh one through the `ALLOW-PASSWORD-RESET` flow
      in **B4** *is* the rotation, so there is no Sign in → Password step. On a
      **re-deploy**, sign in → **Password** before deploy day. Either way,
      choose the new password now (12–72 characters) and keep it somewhere
      safe.

      ⚠ **Never upload a local `admin/config.local.php`.** The copy in a
      working checkout carries the test-harness password `audit-pass-123`,
      printed in dozens of tracked files of this public repo, and every hash
      in git history is public too. (DEP-6, NEW-V4-2)
- [ ] **Confirm the host runs PHP 7.4 or newer** for this domain — in the
      Network Solutions control panel, or ask their support (where the panel
      shows it is unconfirmed from here). On 7.3 the public site and the contact
      form still work, but every admin page is a parse-error 500 (`fn` arrow
      functions, e.g. `save_products()`'s `usort(… fn(…))` in `admin/config.php`). C3 reads the exact version back
      after deploy. (DEP-7)
- [ ] **Confirm `noreply@insulationproducts.com` exists** as a real mailbox or
      alias on the account. Network Solutions requires the `From:` address to
      exist on the account to pass their outbound filter, and every quote
      notification and auto-reply is sent from it.
- [ ] **Publish SPF, and DKIM/DMARC if the host offers them.** Without SPF the
      quote notifications land in spam, which looks exactly like "the form is
      broken".
- [ ] **Then, and only then, turn on the envelope sender (DEP-2).** SPF is
      checked against the *envelope* sender, and `contact.php` ships with it
      OFF (`IPC_ENVELOPE_FROM` is `''`), so the host picks its own. Once the
      SPF record above is published **and** names Network Solutions' outbound
      mail servers (ask their support for the exact `include:`), set
      `define('IPC_ENVELOPE_FROM', 'noreply@insulationproducts.com');` in
      `public/contact.php`, run `npm run build`, upload `contact.php`, and send
      one test quote. Doing it *before* SPF is right makes every notification
      fail SPF — worse than leaving it off. Rollback: set it back to `''`.
- [ ] **Decide apex vs `www`, and make the server agree with the code.** The
      code has already decided: `SITE_ORIGIN` (`src/App.jsx`), `sitemap.php`'s
      `$ORIGIN`, `index.php`'s `IPC_ORIGIN`, `robots.txt`'s `Sitemap:` line and `index.html`'s `og:url` all
      say **`https://www.insulationproducts.com`**, consistently. So the server
      needs a 301 from the apex to `www`, and a certificate covering both. If
      the apex is served without redirecting, every page declares a canonical
      it is not being served at, and `sitemap.php` advertises 52 URLs on the
      wrong host.

      **Put that 301 in the Network Solutions panel**, not in
      `public_html/.htaccess`: B2.4 overwrites that file on every deploy, and a
      rule hand-added to it on the server silently disappears. (NEW-N3-8)

      ⚠ **2026-09-14 — this is now a GATE, not a checklist item.** Audit 9
      measured the live host (`audit-runs/audit9.md` §1.5, restated in
      `audit-runs/live-triage-2026-09-15.md`): both the apex and
      `www` present an **expired** `CN=*.hostingplatform.com` certificate, which
      is not issued for this hostname at all, and plain HTTP answers
      `302 → /site/` rather than `301 → https://www.…`. The privacy policy tells
      visitors their data is transmitted over HTTPS. **Deploying before the host
      fixes this publishes a false statement in a legal document** — see
      `audit-runs/audit9.md` A-9.P5a-1. Nothing in the repo can fix it; it is
      the host's to do, and it has to be done before deploy day, not after.
- [ ] **Retrieve `/site/admin/inquiries.jsonl` from the server** — or establish
      that the predecessor site's contact form was never wired to one. The
      triage found nothing else under `public_html/site/` that this repo lacks
      (`audit-runs/live-triage-2026-09-15.md` §6) — but from ~19 requests and
      two hash comparisons, with no directory listing, so it is a spot check,
      not proof (NEW-V4-3; B2.10 re-checks before deleting). That log is the
      one thing on the host known to be irreproducible from here. It was not
      opened during the audit: reading it means signing into `/site/admin/`,
      which is yours to do, not the auditor's.
- [ ] **Find** the `/` → `/site/` redirect — in the Network Solutions panel or a
      root `.htaccess` above `public_html/` — and confirm you can change it.
      **Note how it is written.** If it is a `RewriteRule` in a `.htaccess`
      above `public_html/`, the new `public_html/.htaccess` (B2 step 4) turns
      it off the moment it lands — Apache does not apply a parent folder's
      `mod_rewrite` rules below a folder whose own `.htaccess` has
      `RewriteEngine On` — so step 4, not B2.0, is when the root switches, and
      putting that rule back as it was is not a rollback (see "Rolling back
      the frontend"). A redirect in the panel, or written as `RedirectMatch`,
      keeps working beside the new `.htaccess` (measured, AUDIT-12).
      **Do not remove it yet.** Removing it is step B2.0, in the same session as
      the upload: done days early, the domain root serves no working site (this
      project is not in `public_html/` yet) and the old copy's one working page,
      its homepage, goes dark with it. (NEW-V4-1, 2026-09-28.) STEP 0b and
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

All of these render from `data/content.json` or `data/products-all.json`.
**Make the decisions this week; where you apply them depends on STEP 0:**

- **First deploy** — there is no admin to sign into before launch. Either
  apply the decided change to the repo's `data/*.json` before B2.7, so it ships
  with `data/` (as the ticked item below was), or do it in the dashboard
  straight after C passes (D lists it). Nothing here blocks the upload.
- **Re-deploy** — `data/` is live customer state: do them in the dashboard,
  never by re-uploading `data/`.

(NEW-V4-6.) Full records in `audit-runs/audit9.md` §2, summarised in §5.1.

- [ ] **Decide what "42 Products Stocked" counts, then change it**
      (**A-9.P4-4**, extended by **POST-9.1** — `WHATS_LEFT.md` §2p). It is
      typed by hand at **Admin → Page Content**, on a different screen from the
      catalog it counts, with no link between them — so it drifts the first time
      you add a product. Worse, it is already ambiguous: **42 is the catalog's
      page count, but those pages list 52 orderable part numbers** (eight records
      cover 2-4 parts each), and one of the 42 is the Value-Added *services*
      page, not a stocked product. The earlier recommendation here — 52,
      relabelled "Part Numbers Stocked" — was **withdrawn** on 2026-09-15
      (CLAIM-2, `audit-runs/claims-register-2026-09-15.md`): "Stocked" is an
      inventory claim the catalog cannot back. The recommendation on record is
      to relabel the slot **"42 — Datasheets Published"** (every catalog record
      carries a datasheet), or to restore the old site's own figure if IPC
      stands behind it. Nothing should change on the homepage until you have
      chosen — only one is what IPC means.
- [ ] **Rewrite FAQ row #15** — *"Where can I download product data sheets?"*
      (**A-9.P5a-2**), at **Admin → Page Content → FAQ**; in the repo it is
      `faq[14]` of `data/content.json`, which is where the old "answer 14"
      came from (NEW-V4-5). Two things in it are wrong. It tells the buyer to
      click a **"Data Sheet"** button; audit 9 gave that control one name
      across the product page and the name is **`Datasheet`**. It also promises "the full
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

Confirm the build printed no errors and that `dist/` contains **twelve** things:
`index.html`, `index.php`, `assets/`, `images/`, `.htaccess`, `.user.ini`,
`contact.php`, `sitemap.php`, `favicon.svg`, `logo.svg`, `manifest.json`,
`robots.txt`.

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

0. [ ] **First deploy only — in this same session, immediately before step 1:**
       remove the `/` → `/site/` redirect you located in §A, and confirm
       `curl -sIL http://www.insulationproducts.com/ | grep -iE '^HTTP|^location'`
       shows no hop into a subfolder (`-L` follows the `https://` hop too: the
       `http://` answer alone is a `301 → https` either way). Left in place, a
       correct deploy is invisible; removed days early, the root is dark until
       this upload lands. If the deploy has to be backed out, putting this
       redirect back is the rollback — with the two conditions in "Rolling
       back the frontend". (NEW-V4-1)
1. [ ] `dist/assets/` → `public_html/assets/`
2. [ ] `dist/images/` → `public_html/images/`
3. [ ] `dist/index.php`, `contact.php`, `sitemap.php`, `favicon.svg`,
       `logo.svg`, `manifest.json`, `robots.txt` → `public_html/`.
       `index.php` **before step 4**: the new `.htaccess` sends every page,
       `/` included, to it (A-5.10, WHATS_LEFT §1ar). On a first deploy,
       from step 4 until step 9 every page answers 500 "The site is being
       updated" — `index.php` is there but `index.html` is not yet. That is
       expected; keep going.
4. [ ] `dist/.htaccess`, `dist/.user.ini` → `public_html/`
5. [ ] `admin/` → `public_html/admin/` — **mandatory on a first deploy**; on a
       re-deploy, only if the admin code changed since the last deploy (if you
       cannot tell, upload it). Upload the tracked files only
       (`git ls-files admin/`, including the dotfile `admin/.htaccess`). Skip
       everything `.gitignore` lists under `admin/` — `config.local.php*`,
       `*.jsonl`, `.login-throttle.json`, `.inquiries-seen.json`,
       `.inquiry-log-failed.json`, `.pdf-renames.json`, `.sessions/`,
       `ALLOW-PASSWORD-RESET`:
       locally those are test leftovers, on the server they are live state.
       (NEW-V4-8)
6. [ ] **Do NOT upload `admin/config.local.php`.** No step creates a safe one
       on your machine: the local copy carries the harness password
       `audit-pass-123`, and any hash from git history is public. On a first
       deploy the password is set on the server in **B4**; on a re-deploy the
       server's own file is live state — never overwrite it. (DEP-6, NEW-V4-2)
7. [ ] **first deploy only:** `data/`, `pdfs/`, `uploads/` → `public_html/`
8. [ ] **`data/.htaccess`, `pdfs/.htaccess`, `uploads/.htaccess`** — upload the
       **file**, never the folder, whenever it has changed since the last
       deploy. Nothing on the server records which release is live, so if you
       cannot tell, upload it: an unchanged file costs nothing, a skipped
       changed one (a security block in `uploads/.htaccess`, say) fails
       silently. These are the only
       files in the tree Vite never copies into `dist/`, so nothing downstream
       carries them. `data/.htaccess` alone holds the
       `AddType application/json` that the site's `jsonOrThrow()` requires and
       the `X-Robots-Tag: noindex` half of the A-5.2 fix.
9. [ ] **Do B3 (Permissions) now, then `index.html` → `public_html/` — LAST.**
       Step 9 is the moment the site goes public, and from then on every quote
       request is written to `admin/inquiries.jsonl`. If `admin/` is not yet
       writable by PHP, those leads are emailed but never reach Admin →
       Inquiries, and the "log failed" marker lives in the same unwritable
       folder, so nothing ever says they are missing (AUDIT-12
       A12-L2-W5-G2-1). On a re-deploy the permissions are already set;
       glance at the B3 table and go straight on.
10. [ ] **After C has passed — re-check `/site/` for owner edits, then delete
        `public_html/site/`.** The triage was 2026-09-15; anything saved there
        since would be lost with the folder. First download
        `public_html/site/data/*.json` (on 2026-09-15 only `products-all.json`
        existed; `site-info.json` and `content.json` answered 404 — look again)
        and `public_html/site/admin/inquiries.jsonl`, and diff each against the
        repo's `data/` and the copy retrieved in §A. Anything new: carry it into
        the live site through the dashboard, or keep the download, before
        deleting. (NEW-V4-3)

        Then delete it — not before C: it is the only copy of the predecessor
        site and the fallback if the deploy has to be backed out. Once C is
        green it is a second, broken, indexable copy of the catalog sitting one
        path segment away — 42 broken photos, 42 broken datasheets — and `/site/sitemap.xml` is still handing a crawler
        eight URLs. `audit-runs/live-triage-2026-09-15.md`.

### B3. Permissions

Done **inside B2, before step 9** — not after it. On a first deploy the folders
exist from step 7, so this is the first moment it can be done and the last
moment it is safe to.

| Path | Mode | Why |
|---|---|---|
| `public_html/data/` | 755, writable by **PHP** | every admin save |
| `public_html/pdfs/` | 755, writable by PHP | data-sheet uploads |
| `public_html/uploads/images/` | 755, writable by PHP | photo uploads |
| `public_html/uploads/site/` | 755, writable by PHP | page photos and logo uploads (Site Images & Logo) |
| `public_html/pdfs/marketing/` | 755, writable by PHP | catalog and brochure PDFs (Catalog & Brochure PDFs page) |
| `public_html/admin/` | 755, writable by PHP | audit log, **inquiry log**, throttle, password changes |
| `public_html/admin/config.local.php` | readable **and** writable by PHP | the password hash — the admin rewrites it on every password change |

"Writable by PHP" is not the same as "writable by FTP". Where they differ, the
writes fail silently — the dashboard banner in B4 is what catches it (it checks
every folder in this table, `uploads/site/` and `pdfs/marketing/` included since
2026-10-05).

**If the banner stays after 755 and 775**, the host runs PHP as a different user
from your FTP account (NEW-N3-2, measured on real Apache): neither mode lets PHP
write. Ask the host to run PHP as your account user (suEXEC / suPHP / PHP-FPM per
account) — that is the fix. Setting the folder to **777** also works, but it lets
every account on that server write there too, so treat it as a stop-gap and tell
the host. No other mode clears it.

**`config.local.php` has the same trap, with worse symptoms** (NEW-V4-7). 600
or 644 is right only while PHP runs as the file's owner. If PHP is a different
user: at **600** every admin page — the reset screen included — is a blank 500,
and an opcode cache can hide that until the server restarts; at **644** the
password change fails with "Could not write admin/config.local.php — the admin/
folder must be writable by the web server", which points at the wrong thing.
Letting the admin create the file itself in B4 makes PHP its owner and avoids
both.

### B4. Set the admin password — first deploy only

There is no password on the server yet, by design: `/admin/` shows **"Admin Not
Configured"**. That is the product failing closed, not a fault. B3 must be done
first — the admin writes `config.local.php` into `admin/`. (DEP-6, NEW-V4-2)

1. [ ] Have the new password from §A to hand (12–72 characters).
2. [ ] Over FTP, upload an **empty** file named `ALLOW-PASSWORD-RESET` into
       `public_html/admin/`. Only when you are ready to type: until it is used,
       anyone who opens `/admin/` can set the password. The window closes one
       hour after the upload (`PASSWORD_RESET_WINDOW`, `admin/config.php`).
3. [ ] Open `/admin/`, set the password on the **Set admin password** screen.
       The admin writes `config.local.php`, deletes the flag, and signs you in
       to the dashboard — check it for the red **"Server setup problem"**
       banner (B3).
4. [ ] Confirm `ALLOW-PASSWORD-RESET` is **gone** from `public_html/admin/`.
       If it is still there, the write failed — fix `admin/` permissions (B3),
       delete the flag, upload it again, repeat 3.

On a re-deploy, skip B4: the server's password is live state. Rotate it at
Sign in → **Password** (§A).

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
#  a 500 here means mod_access_compat is absent — and then the WHOLE SITE is
#  down, not just the catalog: public/.htaccess uses Order/Deny too (NEW-N3-7)

curl -sI https://www.insulationproducts.com/.user.ini            # expect 403
curl -sI https://www.insulationproducts.com/admin/config.php     # expect 403
#  a 200 here (even an empty one) means admin/.htaccess did not arrive — it is
#  a hidden dotfile. Until it is uploaded, the inquiry log (every buyer's
#  name, email and phone), the activity log and the password-file backups in
#  admin/ can be downloaded by anyone. Upload it now (B2 step 5).
curl -s  https://www.insulationproducts.com/sitemap.xml | head -3
#  expect XML, not the SPA shell

# curl does not expand `*` — read the real bundle name off the live shell first
JS=$(curl -s https://www.insulationproducts.com/ | grep -o 'assets/index-[^"]*\.js' | head -1)
echo "$JS"                                          # expect assets/index-<hash>.js
curl -sI -H 'Accept-Encoding: gzip' "https://www.insulationproducts.com/$JS"
#  expect: Content-Encoding: gzip  (~386 kB vs ~112 kB on every cold load, 2026-10-05 build) (DEP-4)

curl -s 'https://www.insulationproducts.com/products?productId=CC' | grep -E '<title>|rel="canonical"'
#  expect the product's own title and a canonical ending ?productId=CC — not
#  the homepage title. The homepage title means index.php ran and fell back
#  to the plain shell: a PHP error on this host's PHP, or data/site-info.json
#  or data/content.json missing or unparseable — look in data/ and the PHP
#  error log, not at the upload. The page still works, but every shared link
#  previews as the homepage (A-5.10, §1ar). A 404 here instead means
#  index.php or .htaccess is missing.

curl -sI http://www.insulationproducts.com/                      # expect 301 → https
curl -sI https://insulationproducts.com/                         # expect 301 → www

curl -sI https://www.insulationproducts.com/ | grep -i strict-transport
#  expect: Strict-Transport-Security: max-age=31536000   (PUB-1)
curl -sI https://www.insulationproducts.com/pdfs/no-such-sheet.pdf
#  expect 404, NOT 200 text/html                          (PUB-11)
curl -si -X TRACE https://www.insulationproducts.com/ | head -1
#  expect 405 or 403. A 200 means TRACE is on: ask Network Solutions to set
#  "TraceEnable Off" — .htaccess cannot (NEW-N3-6).
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
      `.user.ini` is not being applied on this host (mod_php). Ask Network
      Solutions to raise `upload_max_filesize`, `post_max_size` and
      `max_input_vars`; do **not** upload a `php.ini` — it is ignored there too
      (NEW-N3-1).
- [ ] **Same table: PHP version is 7.4 or newer** (§A, DEP-7). You only get
      this far on 7.4+; on 7.3 every admin page is a 500 before it.
- [ ] **The password was set fresh on this server** — first deploy: through B4,
      and `ALLOW-PASSWORD-RESET` is no longer in `public_html/admin/`;
      re-deploy: rotated at **Password** (§A). `audit-pass-123` must **not**
      sign in. (DEP-6, NEW-V4-2)
- [ ] **PHP errors are not shown to visitors** (`display_errors = Off`, set by
      `.user.ini`). This posts 5,001 dummy fields to the read-only sitemap — it
      writes nothing, starts no session — which makes PHP raise its
      "Input variables exceeded" warning before any of our code runs:

      ```bash
      seq -f 'a%g=1' 5001 | paste -sd'&' - \
        | curl -s --data-binary @- https://www.insulationproducts.com/sitemap.php | head -3
      ```

      Expect it to start with `<?xml`. Any `Warning` text or a server path means
      errors are displayed publicly: set `display_errors` Off in the host's PHP
      settings. A clean result is necessary, not sufficient — it proves only
      that startup warnings are hidden. (NEW-N3-12)

      ⚠ The test only works while 5,001 is **more** than the server's
      `max_input_vars` (the shipped `.user.ini` sets 5000). If Help → **What
      your server allows** reads higher — for example because the host raised it at your request —
      replace `5001` with that number + 1, or the warning never fires and the
      check passes even with errors shown.

### C4. The one journey the site exists for

- [ ] Submit the contact form once, for real.
- [ ] The notification email arrives at the sales address — **check spam**.
- [ ] It also appears under **Admin → Inquiries**. Both must be true: the email
      proves `mail()`, the Inquiries row proves the log. Either alone is a
      half-working form.
- [ ] The auto-reply arrives at the address you submitted.
- [ ] **Is the host behind a proxy?** Open that Inquiries row and read
      **Visitor IP**. On the same device, search "what is my IP" and compare.
      - The same address (either of yours, if it shows IPv4 and IPv6): leave
        `IPC_TRUST_PROXY_FORWARDED` off. Nothing to do.
      - A private address (`10.…`, `172.16.…`–`172.31.…`, `192.168.…`,
        `127.0.0.1`) or one that is not yours — and a second test from a
        phone on mobile data, not Wi-Fi, shows the **same** address: the host
        puts a proxy in front of PHP, and the quote form's "5 per 10 minutes"
        limit is counting every buyer on the site together. In
        `public/contact.php` change `define('IPC_TRUST_PROXY_FORWARDED', false)`
        to `true`, rebuild, upload `contact.php`, submit once more, and check
        that Visitor IP is now your own address. (AUDIT-12 decision 43,
        A12-L2-W5-G3-1. Do not turn it on otherwise: on direct hosting the
        forwarded address is whatever the sender typed.)

---

## D — After launch

- [ ] **Search Console**: verify the property (on whichever of apex/`www` you
      chose in A) and submit `https://www.insulationproducts.com/sitemap.xml`.
- [ ] Re-run C4 a week later. A form that worked on Saturday and silently stops
      is the failure mode with no symptom.
- [ ] **First deploy:** any §A "admin edits" item not already made in the
      repo's `data/` before B2.7 — do it now in the dashboard. (NEW-V4-6)
- [ ] Check **Admin → Inquiries** in the first week even if no email arrived —
      that is exactly what the log is for.

---

## If something is wrong

| Symptom | First thing to check |
|---|---|
| First deploy: every page, the homepage included, is Apache's "404 Not Found". Re-deploy: the old site keeps serving, nothing new appears | Did you upload `dist/` itself instead of its **contents**? Look for a `public_html/dist/` folder |
| Every URL, including `http://` → `https://`, answers 500 | Either `mod_access_compat` is absent: `public/.htaccess` uses `Order`/`Deny` (C1, NEW-N3-7) — host action. Or the host refuses `Options +FollowSymLinks` (its error log says "Option FollowSymLinks not allowed here"): change line 9 of `public/.htaccess` to `Options -MultiViews +SymLinksIfOwnerMatch`, rebuild and upload `.htaccess` (measured, AUDIT-12; edit the repo copy — a hand edit on the server is lost at the next deploy, NEW-N3-8). On a first deploy, while the host acts, see "Rolling back the frontend" |
| Every page 500s with "The site is being updated. Please try again in a minute." | `index.html` is not in `public_html/` yet. Expected on a first deploy from B2 step 4 until step 9 |
| Every admin page is a 500 (often blank), public site fine | PHP older than 7.4 (§A), or `config.local.php` not readable by PHP (B3) |
| Blank page, console error about a missing `assets/…js` | `index.html` went up before `assets/`. Upload `assets/` and it resolves. |
| Deep links 404 on refresh | `.htaccess` is missing from `public_html/` — it is a hidden dotfile |
| Every page 404s (or every page but `/`) right after uploading `.htaccess` | `index.php` is not in `public_html/` yet — upload it (B2 step 3). `.htaccess` sends every page to it |
| "Catalog Unavailable" | `data/products-all.json` missing, unreadable, malformed, or served without `Content-Type: application/json` (that is `data/.htaccess`, step B2.8). If the file opens fine and the site loads for you, the visitor's connection dropped or took over 12 s — the screen is the same; ask them to tap Retry |
| Admin rejects a known-good password | `config.local.php` missing or overwritten (never with a local copy — B2.6). Recovery: FTP an empty file named `ALLOW-PASSWORD-RESET` into `public_html/admin/`, open `/admin/`, set a new password. Deleting `config.local.php` on its own **locks the admin**, it does not reset it |
| Form says "mail server could not send" | The `noreply@` mailbox does not exist on the account (step A) |
| Leads in email but not in Inquiries | `admin/` is not writable by PHP. The dashboard banner says so |

### Rolling back the frontend

Re-upload the **previous release's top-level files** — `index.php`,
`contact.php`, `sitemap.php`, `.htaccess`, `.user.ini`, then `index.html`
last — in B2 order. Content-hashed filenames mean the previous
`assets/index-<hash>.js` and `.css` are still on the server unless someone
deleted them, so the old shell finds its old bundle. `index.html` alone is not
the rollback: since A-5.10 every page is served through `index.php` and the
quote form is `contact.php`, so a fault in either survives it. Keep the whole
`dist/` you deployed last time, or download those files before B2 steps 3–4
overwrite them (`dist/` is also committed, so an earlier release can be taken
from git).

**First deploy:** there is no previous `index.html` to go back to. The rollback
is restoring the `/` → `/site/` redirect removed in B2.0, which sends visitors
back to the predecessor — the reason B2.10 waits until C has passed.
(NEW-V4-8) Two conditions, both measured on Apache (AUDIT-12):

- **If the deploy failed with a whole-site 500** (the `mod_access_compat` or
  `FollowSymLinks` rows above), also rename or delete the new
  `public_html/.htaccess`. It governs `public_html/site/` too, so with it in
  place the redirect only sends visitors into the same 500.
- **If the redirect was a `RewriteRule` in a `.htaccess` above
  `public_html/`** (§A), putting it back as it was does nothing while the new
  `public_html/.htaccess` is there. Restore it in the panel, or as
  `RedirectMatch 302 ^/$ /site/`, instead.

This is the **frontend only**. `data/` rolls back through **Admin → Backups**,
which keeps the 90 most recent saves per file and backs up the current state
before restoring, so a restore can itself be undone.
