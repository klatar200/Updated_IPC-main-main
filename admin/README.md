# IPC Admin Panel — Owner Guide

A PHP admin panel for managing the IPC product catalog and PDF data sheets
directly on your Network Solutions hosting account. Every edit you make here
appears on the public website within ~60 seconds.

## How it fits together

```
                          ┌──────────────────────────────┐
   Public visitors  ───→  │ React site at yourdomain.com │  ──┐
                          └──────────────────────────────┘    │  fetches
                                                              ↓
                                                  /data/products-all.json
                                                              ↑
                          ┌──────────────────────────────┐    │  reads / writes
   You (admin)      ───→  │ Admin at yourdomain.com/admin│  ──┘
                          └──────────────────────────────┘
                                       writes ↓
                                   /pdfs/<sku>.pdf
```

**Full I/O surface** (this used to say "one file and one folder", which is
wrong — AUDIT_v3 D7 — and then still missed the dotfiles, temp files, session
store and trash — audit 2026-09-27 DEP-11). It matches the list in `CLAUDE.md`:

| Path | Access |
|---|---|
| `data/products-all.json` | read / write |
| `data/site-info.json` | read / write |
| `data/content.json` | read / write |
| `data/*.json.<pid>-<n>.tmp` | write then rename over the target (atomic save); a leftover means a killed process |
| `data/*.backup.*.json` | write / prune (90 kept per prefix, `BACKUP_KEEP`) |
| `data/.products-write.lock` | create / `flock` around every catalog save (SEC-5) |
| `pdfs/` | read / write / delete (created if absent) |
| `uploads/images/` | read / write / delete (created at runtime if absent); photo resizes go through a `.tmp` beside the target |
| `pdfs/.deleted.*`, `uploads/images/.deleted.*` | Delete Product renames the product's unshared files to these; restoring a catalog backup renames them back. Never pruned (ADM-3) |
| `uploads/.htaccess` | written by `upload-image.php` only if missing; photo uploads are refused while it is still missing |
| `admin/admin-log.jsonl` | append; rotated at 16MB |
| `admin/admin-log-*.jsonl` | read (rotated archives, never deleted) |
| `admin/inquiries.jsonl` | read (written by `public/contact.php`, which rotates it at 16MB) |
| `admin/inquiries-*.jsonl` | read (rotated archives) |
| `admin/.inquiries-seen.json` | read / write (the "new inquiries" badge) |
| `admin/.inquiry-log-failed.json` | read (written and cleared by `public/contact.php`; drives a dashboard warning) |
| `admin/.login-throttle.json` | read / write |
| `admin/.sessions/` | created (0700, with its own `.htaccess`); PHP's session files live here. Falls back to the server default if `admin/` is not writable |
| `admin/config.local.php` | read / write (+ `.bak.*`, 5 kept) |
| `admin/ALLOW-PASSWORD-RESET` | read / delete — you create it over FTP; the admin never does |

`public/contact.php` is a **second** dynamic piece: it ships into `dist/`,
calls `mail()`, and appends to `admin/inquiries.jsonl`.

The React site reads the three `data/*.json` files at runtime. The React build
itself is fully static.

## Server file layout (on Network Solutions, under `public_html/`)

```
public_html/
├── index.html              ← React app (FTP'd from your local /dist)
├── assets/                 ← Hashed JS/CSS from Vite
├── contact.php             ← Contact/RFQ mail handler (ships inside dist/)
├── .htaccess               ← SPA rewrite + cache headers + dotfile block
├── .user.ini               ← PHP limits for public_html/ and everything under it
├── images/                 ← Static site imagery
├── data/
│   ├── .htaccess           ← Blocks backups, dotfiles, PHP execution
│   ├── products-all.json   ← Live product catalog (admin edits this)
│   ├── site-info.json      ← Business details (admin edits this)
│   ├── content.json        ← Page content (admin edits this)
│   └── *.backup.*.json     ← Auto-written before every save, 90 kept per prefix
├── pdfs/
│   ├── .htaccess           ← Blocks PHP execution in this folder
│   └── *.pdf               ← Uploaded data sheets (+ .deleted.* after a Delete Product)
├── uploads/
│   ├── .htaccess           ← Blocks PHP execution in this folder — must be deployed
│   ├── images/             ← Uploaded product photos (ships empty)
│   └── site/               ← Your own Site Images photos (ships empty)
└── admin/
    ├── .htaccess           ← HTTPS, security headers, file blocks
    ├── config.php          ← Shared config, helpers, password hashing, backups
    ├── config.local.php    ← Admin password hash (hand-deployed, gitignored)
    ├── nav.php             ← Shared header/nav, included on every page
    ├── auth.php            ← Login / logout / FTP-unlocked password recovery
    ├── index.php           ← Product dashboard + server-health banner
    ├── add.php / edit.php / delete.php
    ├── settings.php        ← Business Details editor  (site-info.json)
    ├── content.php         ← Page Content editor      (content.json)
    ├── inquiries.php       ← Contact-form lead viewer (inquiries.jsonl)
    ├── backups.php         ← Self-service restore of any data/*.json backup
    ├── password.php        ← Signed-in password change
    ├── upload-pdf.php      ← Upload, replace, or remove a PDF
    ├── upload-image.php    ← Upload or remove a product photo
    ├── ping.php            ← Session keepalive probe for unsaved.js
    ├── help.php            ← In-app help & documentation
    ├── audit-log.php       ← View every change made through the admin
    ├── *.js                ← confirm / search / spectable-editor / content-editor /
    │                         unsaved / help / product-preview / settings-preview /
    │                         contrast-guard / csrf-back  (ten files; `ls admin/*.js`)
    ├── admin-log.jsonl     ← Audit log (auto-created on first save)
    ├── inquiries.jsonl     ← Contact-form leads (written by contact.php)
    ├── .login-throttle.json ← Per-IP failed-login counters
    └── .sessions/          ← Sign-in session files (created by the admin)
```

(The previous version of this diagram omitted `site-info.json`, `content.json`,
`uploads/` and 12 of the 18 admin files — AUDIT_v3 D7.)

## First-time deploy (one-time setup)

> **Which deploy is this? Answer before following anything below.** Open
> `https://www.insulationproducts.com/data/products-all.json`. A catalog of
> products means the site is live and this section is history — use the
> manifest in the root [README.md](../README.md), and **never upload the
> contents of `data/`, `pdfs/` or `uploads/` from the repo**, because they are live customer state, an FTP
> overwrite creates no backup, and it destroys every edit the owner has made.
> A 404 means this is the **first** deploy, the steps below are the ones to
> follow, and `data/`, `pdfs/` and `uploads/` go up exactly once, now.
> [`GO-LIVE.md`](../GO-LIVE.md) STEP 0 is the same question with the full
> branch either way.
>
> This paragraph opened "**This site is already live.**" until 2026-09-14,
> when audit 9 measured the host answering **404** for all three data files:
> the guidance was the exact opposite of what the operator needed, on the one
> deploy where skipping `data/` means shipping a site with no catalog.
> (A-9.B2-12. Settled 2026-08-04 for the re-deploy branch; AUDIT_v3 D7/D9.)

The full checklist is [`GO-LIVE.md`](../GO-LIVE.md) §B; the file list is the
root [README.md](../README.md) deploy tables. In short:

1. Run `npm run build` in the repo. This produces `/dist`.
2. **Turn on "show hidden files" in your FTP client first.** `.htaccess` and
   `.user.ini` start with a dot, most FTP clients hide them, and several of them
   are what stop the server running scripts in the upload folders.
3. FTP into `public_html/`, **in this order**:
   1. `dist/assets/`, then everything else in `dist/` **except `index.html`**
      (including `dist/.htaccess` and `dist/.user.ini`)
   2. **`admin/`** → `public_html/admin/` (tracked files only, including
      `admin/.htaccess`; not your local `*.jsonl`, `.login-throttle.json`,
      `.sessions/` or `config.local.php*`)
   3. **`data/`**, **`pdfs/`** and **`uploads/`** folders, each **with its
      `.htaccess`** (**first deploy only — never again**). Upload `uploads/`
      from the repo; never create it by hand on the server — without its
      `.htaccess`, PHP can execute files placed in it (NEW-N3-3).
   4. `dist/index.html` **last**.
4. In cPanel File Manager, set permissions. The four folders must be writable
   **by PHP**, not just by FTP — see the root README's Permissions section if
   the dashboard banner stays:

   | Path | Permissions |
   |---|---|
   | `public_html/data/` | 755 |
   | `public_html/data/*.json` | 644 (or 666 if 644 doesn't write) |
   | `public_html/pdfs/` | 755 |
   | `public_html/uploads/images/` | 755 |
   | `public_html/admin/` | 755 |
   | `public_html/admin/config.php` | 644 |

5. **Set the admin password.** There is **no shipped default** — see the
   section at the bottom of this file. `/admin/` shows "Admin Not Configured";
   upload an empty `ALLOW-PASSWORD-RESET` into `public_html/admin/` and set the
   password on the screen that appears ([`GO-LIVE.md`](../GO-LIVE.md) §B4).
   Do not upload a `config.local.php` from your machine. (This step used to claim
   "the shipped default is documented in this README", contradicting both
   `config.php:69-77` and this file's own bottom section — AUDIT_v3 D3.)
6. Visit `https://yourdomain.com/` — the site should load.
7. Visit `https://yourdomain.com/admin/` — log in with the new password.

### Subsequent deploys

When you change the React source and rebuild:

```bash
npm run build
```

FTP only the **contents** of `/dist` (`index.html` + `assets/`) into
`public_html/`, overwriting the old `index.html` and `assets/` folder — and
upload `assets/` **before** `index.html`, or every visitor between the two
uploads gets a shell pointing at a bundle that is not there yet.
**Do NOT re-upload `data/`, `pdfs/`, or `admin/`** — those are live on the
server and your local copies are stale.

**With one exception:** `data/.htaccess`, `pdfs/.htaccess` and
`uploads/.htaccess` are repo code that happens to live inside those folders.
Vite never copies them into `dist/`, so nothing downstream carries them.
Upload the **file**, never the folder, whenever one of them has changed.
`data/.htaccess` alone holds the `AddType application/json` the site's loader
requires and the `X-Robots-Tag: noindex` half of the catalog-indexing fix.
(A-6.2 closed this in the root README; the same unqualified rule was still
here — A-9.B2-12.)

## Owner workflows

### Adding a new product

1. Sign in at `https://yourdomain.com/admin/`.
2. Click **+ Add Product** (top right).
3. Fill in the required fields:
   - **SKU** — unique identifier, e.g. `IP33PO`. This becomes the product's
     URL slug and the PDF filename.
   - **Part Type** — pick the category from the dropdown.
   - **Product Name** — full name as shown on the site.
4. Fill in optional fields (Operating Temp, Image Caption, Specifications
   Summary, Photo URL, badges, description paragraphs).
5. Spec tables (Specifications + Size/Dimension) are filled in with a
   **visual builder** — a grid of rows and columns with *+ Add row* and
   *+ Add column* buttons, and a *Split into sub-columns* control for a
   Min/Max style pair. No JSON is required. The raw JSON is still there
   behind **Advanced**, for pasting a table someone sends you; the reference
   below documents that shape. Leave the tables empty if you don't have spec
   data yet; you can fill them in later via Edit.

   *(This step read "take **JSON** — see the examples below" until 2026-09-14.
   The dashboard replaced that workflow with the builder and the Help page was
   updated; this file was not, so it taught the owner to hand-write JSON for a
   screen that has not needed it in months. A-9.B2-13.)*
6. Click **Add Product**.
7. On the dashboard, click **View ↗** next to the new product to see how it
   renders on the public site. Allow ~60 seconds for the change to propagate.

### Editing a product

1. From the dashboard, click **Edit** on the row.
2. Change any field. SKU can be renamed — but if the new SKU matches another
   existing product the admin will block the save with an error.
3. **If you edited a spec table under Advanced and the JSON is invalid**,
   the save will fail with a parse error message — fix the syntax and
   resubmit. The visual builder cannot produce invalid JSON.
4. Click **Save Changes**. Click **View ↗** afterwards to verify.

### Deleting a product

1. From the dashboard, click **Delete** on the row.
2. Confirm.
3. The product disappears from the public site within ~60 seconds.
4. **The PDF files and the uploaded photo are moved aside**, unless another
   product still references the same file — `delete.php` renames each one to
   `.deleted.<name>` in the same folder (hidden from the web) and reports what
   it removed or kept in the audit log. Restoring the catalog from **Backups**
   renames them back, so undoing a delete brings the data sheet and photo back
   too (ADM-3). Do not clean up manually: a file you delete by hand may be one
   a second product is still using.

### Uploading a data sheet (PDF)

1. From the dashboard, click **Manage PDF** on the row.
2. Choose a PDF file. The real ceiling is
   **`min(upload_max_filesize, 20MB)`** — `upload-pdf.php:82` hard-rejects
   anything over 20MB regardless of the ini value, and `upload-image.php:160`
   caps photos at 8MB the same way. Raising `.user.ini` alone will not lift
   either. Admin → Help → "What your server allows" prints both the live ini
   values and the effective limits. (AUDIT_v3 D6)
   If the upload is rejected for size you now get a message that names the
   actual limit instead of "Please select a PDF file to upload".
3. The file is saved as `/pdfs/<sanitized-sku>.pdf` and the product record's
   `pdfUrl` is updated automatically.
4. On the public site, the product's button switches from **Request
   Datasheet** to **Datasheet** (or the **Primary PDF Button Label** set on the
   product's Edit page) within ~60 seconds.

### Replacing or removing a PDF

- **Replace**: upload a new file from the same page — the old file is
  overwritten in place.
- **Remove**: click the red **Remove PDF** button. The product record's
  `pdfUrl` is cleared, the PDF file is deleted from `/pdfs/`, and the
  public site reverts to the **Request Datasheet** button.

### Viewing the audit log

Click **Audit Log** in the dashboard nav. Every entry has a timestamp, SKU,
detail, and the IP that made the change. The actions recorded are:
`add`, `edit`, `delete`, `upload-pdf`, `remove-pdf`, `upload-image`,
`remove-image`, `settings`, `content`, `restore`, `password`, `sign-in`,
`sign-out` and `sign-in-failed` — the same fourteen the page's filter offers
(`IPC_AUDIT_ACTIONS` in `config.php`).

### The navigation bar

Every authenticated admin page shares the same header/nav, rendered from
`admin/nav.php`. It's included (not copy-pasted) on every page, so
**Products**, **+ Add Product**, **Business Details**, **Page Content**,
**Inquiries**, **Backups**, **Audit Log**, **Password**, **Help**,
**View Live Site ↗** and **Sign Out** are always one click away no matter where
you are in the admin.

## Spec-table JSON examples

### Spec Table 1 — Specifications (left)

```json
[
  { "label": "Material",   "value": "Polyolefin" },
  { "label": "Color",      "value": "Black" },
  { "label": "Shrink Ratio", "value": "2:1" },
  { "label": null,         "value": "RoHS Compliant · UL 224" }
]
```

`label: null` rows render as a wide note without a label column.

### Spec Table 2 — Size / Dimension chart (right)

```json
{
  "columnSpans": [
    { "label": "Order\nSize", "colspan": 1, "sub": null },
    { "label": "Expanded",    "colspan": 2, "sub": ["Min", "Max"] }
  ],
  "rows": [
    ["3/64", "0.046", "0.062"],
    ["1/16", "0.063", "0.083"]
  ]
}
```

`columnSpans` lists the column headers (with optional sub-headers); each
`rows` entry is one data row.

> **`sub` must be an ARRAY, one entry per sub-column — never a string.**
> Earlier revisions of this file showed `"sub": "Min / Max"`. React requires an
> array, and the visual editor TRUNCATES EVERY ROW when it sees a non-array
> `sub`: following the old example turned `["3/64","0.046","0.062"]` into
> `["3/64","0.046"]`. The documentation was the trigger for a data-loss bug.
> `colspan` must equal `count(sub)`. For a plain column use
> `"colspan": 1, "sub": null`.

> **Advanced mode.** The "Advanced" button under the size-chart editor lets you
> paste raw JSON. It now refuses to save while the text does not parse, instead
> of silently saving the pre-Advanced table and telling you it worked.

## Visibility / freshness

- **Public site refresh time**: ~60 seconds after you save. Both the
  browser cache and the server cache are set to `max-age=60`. Hard-refresh
  the page (Ctrl+Shift+R) to see changes instantly.
- **The dashboard count** of products and PDF coverage updates on the next
  admin page load.

## Changing the admin password

**Normal case: use the admin.** Sign in and click **Password** in the top
navigation. It rewrites `admin/config.local.php` in place, preserving any other
defines in that file, backs the old one up, and re-verifies the new hash before
declaring success. `admin/` must be writable by the PHP user for this to work —
the dashboard shows a red banner if it isn't.

The old two-step `_hash.php` FTP flow this file used to document is superseded
and no longer needed.

**There is no shipped default password.** `admin/config.php` defines an
intentionally-unsatisfiable sentinel, so a missing or damaged
`config.local.php` fails CLOSED: nobody can sign in. That is deliberate — the
previous "shipped default" was printed in plaintext in four committed documents.

### If the password is lost

1. Over FTP, upload an **empty file named `ALLOW-PASSWORD-RESET`** into
   `public_html/admin/`.
2. Open `https://yourdomain.com/admin/` in a browser. A one-time
   **"Set Admin Password"** screen appears instead of the login box.
3. Set a new password. You are signed straight in, and the flag file is
   deleted automatically.

Creating that file requires FTP or file-manager access — a stronger credential
than the admin password itself — so this is not a login bypass.

**Deleting `config.local.php` on its own does NOT reset anything.** It leaves an
admin no password can open. Earlier revisions of this file, and the on-screen
text in `password.php`, both said it resets to "the original password"; there is
no original password to reset to.

### Hand-editing the hash (rarely needed)

The password is stored as a **pre-computed bcrypt string**, never an inline
`password_hash()` call — that would regenerate the salt every request and break
login. To generate one:

```bash
php -r "echo password_hash('your-new-password', PASSWORD_BCRYPT, ['cost'=>12]);"
```

Paste the result between the single quotes in `config.local.php`. Note that if
an opcode cache is enabled, a hand-edit can take a few seconds to apply; the
admin's own Password page calls `opcache_invalidate()` so it applies at once.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Login loops back to the login page | Cookies blocked, or password wrong. Six tries in a row are checked; after the sixth wrong one the page pauses before the next try: 15 seconds, doubling each time, up to a 5-minute ceiling (`LOGIN_FREE_ATTEMPTS` / `LOGIN_COOLOFF_BASE` / `LOGIN_COOLOFF_MAX`). This row said "1-8 second delay" until 2026-09-14 — A-9.B2-14 — and "after 5" until 2026-09-28 — NEW-N3-10. |
| "Failed to save" on Add or Edit | `data/products-all.json` is not writable. Set `data/` to 755 (or 775) and the file to 644 — try 666 only if 644 still will not write, which is what the permissions table above says. |
| PDF upload errors with "Upload failed" | `pdfs/` is not writable — chmod 755 (or 775) |
| Public site doesn't show my edit | Wait 60 seconds, then hard-refresh (Ctrl+Shift+R) |
| Public site says "Catalog Unavailable" | `data/products-all.json` is missing on the server, or the JSON is malformed (open it directly to check) |
| "Another product already uses SKU X" | You tried to rename an SKU to one that already exists — pick a different SKU |
| Spec table change won't save | The JSON has a syntax error — the message shows what's wrong (missing comma, bad bracket, etc.) |

## Security notes

- **There is no shipped default password.** `config.php` holds an unsatisfiable
  sentinel; the real hash lives only in the hand-deployed `config.local.php`.
- Auth is PHP-session-only, over forced HTTPS (`admin/.htaccess`). Session
  cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Every attempt is counted as it arrives (`login_attempt_gate()`). The first
  six are checked; the sixth failure puts the address in a cool-off, so a
  seventh try inside it is refused. The cool-off doubles from 15s to a 300s
  ceiling. (This said "after 5 failed logins" until 2026-09-28; the code's
  `LOGIN_FREE_ATTEMPTS = 5` is the count *before* the one that starts the
  cool-off — NEW-N3-10.) The count and the decision happen inside ONE `flock`, so
  parallel connections queue and each takes its own number — an attacker cannot
  amortize the wait across concurrent requests, and an attempt refused during a
  cool-off is neither counted nor logged. (This paragraph described the
  pre-4.14 implementation until 2026-08-18: a bare `sleep()` and an unlocked
  read-modify-write. Both were replaced on 2026-08-06; the text was not.)
- That control depends on `admin/` being writable. If it is not,
  `login_throttle_mutate()` cannot open its file, the gate falls through with no
  wait, and `audit_log()` no-ops in the same failure — so guessing is neither
  slowed nor recorded. Failing open is deliberate (it must not lock the owner
  out) and the dashboard health banner says so explicitly.
- Treat a long, random password as the actual defense. (Earlier revisions of
  this file claimed "online brute-force is impractical"; that was not supported
  by the implementation then and is not the claim being made now.)
- For an extra layer, add cPanel Basic Auth in front of `/admin/`
  (cPanel → Directory Privacy).
- The audit log records IPs and User-Agents. `admin/.htaccess` blocks direct
  download of `admin-log.jsonl`.
- PHP 7.4+ is supported, 8.0+ is recommended. Confirm under cPanel →
  "Select PHP Version".

## Upgrading the admin

If you receive new admin files (new features, bug fixes), FTP them into
`public_html/admin/` overwriting the old ones.

**Overwriting `config.php` is harmless — it contains no password.** The one file
you must not overwrite (or delete) is **`config.local.php`**: it holds the only
working hash, and it is gitignored precisely so a repo copy can never clobber
it. Earlier revisions of this file had this backwards.
