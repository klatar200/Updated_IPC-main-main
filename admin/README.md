# IPC Admin Panel — Customer Guide

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
wrong and is already recorded as corrected in `CLAUDE.md` — AUDIT_v3 D7):

| Path | Access |
|---|---|
| `data/products-all.json` | read / write |
| `data/site-info.json` | read / write |
| `data/content.json` | read / write |
| `data/*.backup.*.json` | write / prune (30 kept per prefix) |
| `pdfs/` | read / write / delete |
| `uploads/images/` | read / write / delete (created at runtime if absent) |
| `admin/admin-log.jsonl` | append |
| `admin/inquiries.jsonl` | read (written by `public/contact.php`), rotated at 16MB |
| `admin/inquiries-*.jsonl` | read (rotated archives) |
| `admin/.login-throttle.json` | read / write |
| `admin/config.local.php` | read / write (+ `.bak.*`, 5 kept) |
| `admin/ALLOW-PASSWORD-RESET` | read / delete |

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
│   └── *.backup.*.json     ← Auto-written before every save, 30 kept per prefix
├── pdfs/
│   ├── .htaccess           ← Blocks PHP execution in this folder
│   └── *.pdf               ← Uploaded data sheets
├── uploads/
│   ├── .htaccess           ← Blocks PHP execution in this folder
│   └── images/             ← Uploaded product photos (created at runtime)
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
    ├── *.js                ← confirm / search / spectable / content / unsaved / help
    ├── admin-log.jsonl     ← Audit log (auto-created on first save)
    ├── inquiries.jsonl     ← Contact-form leads (written by contact.php)
    └── .login-throttle.json ← Per-IP failed-login counters
```

(The previous version of this diagram omitted `site-info.json`, `content.json`,
`uploads/` and 12 of the 18 admin files — AUDIT_v3 D7.)

## First-time deploy (one-time setup)

> **This site is already live.** The steps below are the historical
> first-time setup, kept for reference. For the release you are actually
> shipping, use the manifest in the root [README.md](../README.md) — and note
> that **`data/` and `pdfs/` are now live customer state and must NOT be
> uploaded from the repo.** An FTP overwrite creates no backup and destroys
> every edit the owner has made. (Settled 2026-08-04; AUDIT_v3 D7/D9.)

1. Run `npm run build` in the repo. This produces `/dist`.
2. FTP four trees into `public_html/`:
   - **Contents of `dist/`** → `public_html/`
   - **`admin/`** folder → `public_html/admin/`
   - **`pdfs/`** folder → `public_html/pdfs/` (**first deploy only — never again**)
   - **`data/`** folder → `public_html/data/` (**first deploy only — never again**)
3. In cPanel File Manager, set permissions:

   | Path | Permissions |
   |---|---|
   | `public_html/data/` | 755 |
   | `public_html/data/products-all.json` | 644 (or 666 if 644 doesn't write) |
   | `public_html/pdfs/` | 755 |
   | `public_html/admin/` | 755 |
   | `public_html/admin/config.php` | 644 |

4. **Set the admin password.** There is **no shipped default** — see the
   section at the bottom of this file. Hand-deploy `admin/config.local.php`,
   or use the `ALLOW-PASSWORD-RESET` recovery flow. (This step used to claim
   "the shipped default is documented in this README", contradicting both
   `config.php:58-63` and this file's own bottom section — AUDIT_v3 D3.)
5. Visit `https://yourdomain.com/` — the site should load.
6. Visit `https://yourdomain.com/admin/` — log in with the new password.

### Subsequent deploys

When you change the React source and rebuild:

```bash
npm run build
```

FTP only the **contents** of `/dist` (`index.html` + `assets/`) into
`public_html/`, overwriting the old `index.html` and `assets/` folder.
**Do NOT re-upload `data/`, `pdfs/`, or `admin/`** — those are live on the
server and your local copies are stale.

## Customer workflows

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
5. Spec tables (Specifications + Size/Dimension) take **JSON** — see the
   examples below. Leave them at the defaults if you don't have spec data
   yet; you can fill them in later via Edit.
6. Click **Add Product**.
7. On the dashboard, click **View ↗** next to the new product to see how it
   renders on the public site. Allow ~60 seconds for the change to propagate.

### Editing a product

1. From the dashboard, click **Edit** on the row.
2. Change any field. SKU can be renamed — but if the new SKU matches another
   existing product the admin will block the save with an error.
3. **If a spec-table JSON is invalid**, the save will fail with a parse
   error message — fix the syntax and resubmit.
4. Click **Save Changes**. Click **View ↗** afterwards to verify.

### Deleting a product

1. From the dashboard, click **Delete** on the row.
2. Confirm.
3. The product disappears from the public site within ~60 seconds.
4. **The PDF files and the uploaded photo ARE auto-deleted**, unless another
   product still references the same file — `delete.php` calls
   `pdf_delete_if_unused()` and `image_in_use()` and reports what it removed
   or kept in the audit log. Earlier revisions of this file said the opposite
   and told you to clean up manually; following that would now delete a file a
   second product may still be using.

### Uploading a data sheet (PDF)

1. From the dashboard, click **PDF** on the row.
2. Choose a PDF file. The real ceiling is
   **`min(upload_max_filesize, 20MB)`** — `upload-pdf.php:79` hard-rejects
   anything over 20MB regardless of the ini value, and `upload-image.php:102`
   caps photos at 8MB the same way. Raising `.user.ini` alone will not lift
   either. Admin → Help → "What your server allows" prints both the live ini
   values and the effective limits. (AUDIT_v3 D6)
   If the upload is rejected for size you now get a message that names the
   actual limit instead of "Please select a PDF file to upload".
3. The file is saved as `/pdfs/<sanitized-sku>.pdf` and the product record's
   `pdfUrl` is updated automatically.
4. On the public site, the product's button switches from **Request Data
   Sheet** to **Download PDF** within ~60 seconds.

### Replacing or removing a PDF

- **Replace**: upload a new file from the same page — the old file is
  overwritten in place.
- **Remove**: click the red **Remove PDF** button. The product record's
  `pdfUrl` is cleared, the PDF file is deleted from `/pdfs/`, and the
  public site reverts to the **Request Data Sheet** button.

### Viewing the audit log

Click **Audit Log** in the dashboard nav. Every add, edit, delete, PDF
upload, and PDF removal is recorded with timestamp, SKU, detail, and the
IP that made the change.

### The navigation bar

Every authenticated admin page shares the same header/nav, rendered from
`admin/nav.php`. It's included (not copy-pasted) on every page, so Products,
+ Add Product, Audit Log, Help, View Live Site, and Sign Out are always one
click away no matter where you are in the admin.

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
   **"Set admin password"** screen appears instead of the login box.
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
| Login loops back to the login page | Cookies blocked, or password wrong (5 failures triggers a 1-8 second delay) |
| "Failed to save" on Add or Edit | `data/products-all.json` is not writable — chmod 666 |
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
- After 5 failed logins each subsequent attempt sleeps 1–8 seconds. This slows
  a serial attacker but is **not** a strong control: the delay is `sleep()`, so
  parallel connections sleep concurrently, and the failure counter is a
  read-modify-write with no lock. Treat a long, random password as the actual
  defence. (Earlier revisions of this file claimed "online brute-force is
  impractical"; that is not supported by the implementation.)
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
