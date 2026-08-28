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
- [ ] **Set up an uptime monitor** on `https://www.insulationproducts.com/`
      (any free tier). The site is one FTP mistake away from a blank page and
      nothing else will tell you.

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
