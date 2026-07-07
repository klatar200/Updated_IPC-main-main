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

The admin reads and writes one file (`data/products-all.json`) and one folder
(`pdfs/`). The React site reads the same JSON file on every page load. Nothing
else is shared — the React build is fully static.

## Server file layout (on Network Solutions, under `public_html/`)

```
public_html/
├── index.html              ← React app (FTP'd from your local /dist)
├── assets/                 ← Hashed JS/CSS from Vite
├── .htaccess               ← SPA rewrite + cache headers
├── data/
│   ├── .htaccess           ← Blocks backups, dotfiles, PHP execution
│   └── products-all.json   ← Live product catalog (admin edits this)
├── pdfs/
│   ├── .htaccess           ← Blocks PHP execution in this folder
│   └── *.pdf               ← Uploaded data sheets
└── admin/
    ├── .htaccess           ← HTTPS, security headers, file blocks
    ├── config.php          ← Shared config + admin password hash
    ├── auth.php            ← Login / logout
    ├── index.php           ← Product dashboard
    ├── add.php / edit.php / delete.php
    ├── upload-pdf.php      ← Upload, replace, or remove a PDF
    ├── import.php          ← Bulk import / merge JSON
    ├── audit-log.php       ← View every change made through the admin
    └── admin-log.jsonl     ← Audit log (auto-created on first save)
```

## First-time deploy (one-time setup)

1. Run `npm run build` in the repo. This produces `/dist`.
2. FTP four trees into `public_html/`:
   - **Contents of `dist/`** → `public_html/`
   - **`admin/`** folder → `public_html/admin/`
   - **`pdfs/`** folder → `public_html/pdfs/`
   - **`data/`** folder → `public_html/data/` (**first deploy only**)
3. In cPanel File Manager, set permissions:

   | Path | Permissions |
   |---|---|
   | `public_html/data/` | 755 |
   | `public_html/data/products-all.json` | 644 (or 666 if 644 doesn't write) |
   | `public_html/pdfs/` | 755 |
   | `public_html/admin/` | 755 |
   | `public_html/admin/config.php` | 644 |

4. **Rotate the admin password** (see below) — the shipped default is
   documented in this README, which means anyone reading the source can log
   in until you change it.
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
4. **The PDF file (if any) is NOT auto-deleted from `/pdfs/`** — use the
   **Remove PDF** button on the Upload PDF page first if you want a clean
   removal, or leave the orphan PDF on disk (it costs almost nothing).

### Uploading a data sheet (PDF)

1. From the dashboard, click **PDF** on the row.
2. Choose a PDF file (max 20 MB).
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

### Bulk importing many products at once

1. From the dashboard, click **Import JSON**.
2. Upload a `products-all.json` file. The admin shows you a preview:
   how many entries are new, how many will overwrite existing SKUs, and
   how many invalid rows will be skipped.
3. Click **Confirm Import**. A timestamped backup of the current catalog
   is written to `data/products-all.backup.<datetime>.json` before the
   merge, in case you need to roll back.

### Viewing the audit log

Click **Audit Log** in the dashboard nav. Every add, edit, delete, PDF
upload, PDF removal, and import is recorded with timestamp, SKU, detail,
and the IP that made the change.

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
    { "label": "Expanded",    "colspan": 2, "sub": "Min / Max" }
  ],
  "rows": [
    ["3/64", "0.046", "0.062"],
    ["1/16", "0.063", "0.083"]
  ]
}
```

`columnSpans` lists the column headers (with optional sub-headers); each
`rows` entry is one data row.

## Visibility / freshness

- **Public site refresh time**: ~60 seconds after you save. Both the
  browser cache and the server cache are set to `max-age=60`. Hard-refresh
  the page (Ctrl+Shift+R) to see changes instantly.
- **The dashboard count** of products and PDF coverage updates on the next
  admin page load.

## Changing the admin password

The admin password is stored as a **pre-computed bcrypt hash**, not a call
to `password_hash()`. Calling `password_hash()` inline would generate a new
random salt on every request and break login.

`admin/config.php` ships with the shipped-default hash hard-coded as a
fallback. To rotate the password, do NOT edit `config.php` — instead
create a local override file that is gitignored and overrides the constant:

1. On the server, create a temporary file `public_html/_hash.php` with:
   ```php
   <?php echo password_hash('your-new-password', PASSWORD_DEFAULT); ?>
   ```
2. Visit `https://yourdomain.com/_hash.php` in a browser. Copy the output —
   it looks like `$2y$12$…`.
3. On your machine (or via FTP), create a new file `admin/config.local.php`
   containing exactly:
   ```php
   <?php define('ADMIN_PASSWORD_HASH', '<your-bcrypt-hash>');
   ```
   Replace `<your-bcrypt-hash>` with the string you copied in step 2.
4. FTP `config.local.php` into `public_html/admin/` alongside `config.php`.
   `config.php` will detect the local override and use that hash instead of
   the shipped default. **No edit to `config.php` is needed.**
5. **Delete `_hash.php` from the server.**

`admin/config.local.php` is listed in `.gitignore`, so the rotated hash
never enters the repo. Future upgrades that overwrite `admin/` files will
not touch your local override.

> The shipped default hash in `config.php` corresponds to a documented
> string and must be rotated before going live. Anyone who knows the
> shipped default can log in until a local override is in place.

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
| Import skipped rows | The skipped-rows count in the preview shows why (each invalid row has its own reason) |

## Security notes

- **The shipped default password hash is in `admin/config.php`** — rotate before going live by creating an `admin/config.local.php` override.
- Auth is PHP-session-only, over forced HTTPS (`admin/.htaccess`). Session
  cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- After 5 failed logins each subsequent attempt sleeps 1–8 seconds — online
  brute-force is impractical. There is no permanent lockout, so you can't
  lock yourself out by mistyping.
- For an extra layer, add cPanel Basic Auth in front of `/admin/`
  (cPanel → Directory Privacy).
- The audit log records IPs and User-Agents. `admin/.htaccess` blocks direct
  download of `admin-log.jsonl`.
- PHP 7.4+ is supported, 8.0+ is recommended. Confirm under cPanel →
  "Select PHP Version".

## Upgrading the admin

If you receive new admin files (new features, bug fixes), FTP them into
`public_html/admin/` overwriting the old ones. Your password in `config.php`
will be preserved as long as you don't overwrite that one file with the
unmodified copy from the repo.
