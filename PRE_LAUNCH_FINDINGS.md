# IPC Admin — Pre-Launch End-to-End Findings

**Date:** 2026-07-07
**Method:** Every data-mutating workflow was executed via a Python harness that faithfully mirrors the PHP logic (including PHP quirks like `empty()` and `array_filter`) run against a copy of the live `products-all.json`. Auth, sessions, `.htaccess`, CSP, and browser JS were traced statically (no PHP runtime is available in this environment). Nothing below has been changed — this is a notation pass only.

**Bottom line:** No launch-blocking defects. Every core workflow behaves correctly. There is one medium finding worth a decision (import overwrite semantics) and a handful of low/cosmetic items.

---

## Resolution status (updated 2026-07-07)

All findings except F7 have been fixed and re-verified with the simulation harness (13/13 checks pass):

- **F1 — FIXED.** Import update is now a field-level merge; omitted fields keep their current values. Preview wording updated.
- **F2 — FIXED.** Delete now removes `additionalPdfs` files too (shared-PDF guard applied).
- **F3 — FIXED.** SKU rename realigns the primary custom PDF *and* `additionalPdfs` (prefix-swap, preserves `-suffix`).
- **F4 — FIXED.** Client-IP resolution is proxy-aware via optional `TRUST_PROXY_FORWARDED` (default off = `REMOTE_ADDR`).
- **F5 — FIXED.** A single bare product object now imports as one row.
- **F6 — FIXED.** Additional-PDF URLs are validated (must be a path/URL ending in `.pdf`); invalid entries block the save with a clear message.
- **F7 — ACCEPTED / IGNORED** (a part literally named `0` is not a real case).
- **F8 — FIXED.** `IP12GA` now points at `/pdfs/IP12GA-IP1274.pdf` (shared with `IP12GA-IP1274`; the shared-PDF guards keep it safe on delete/remove).

Original finding details are retained below for reference.

---

## Workflows verified PASSING

| Workflow | What was checked | Result |
|---|---|---|
| **Login** | correct/wrong password path, IP-throttle count→sleep→15-min expiry, session-id regenerate on success, already-authed redirect | ✅ correct |
| **Logout** | POST + CSRF required; GET `?logout=1` no longer logs out | ✅ correct |
| **Add product** | valid add, duplicate-SKU blocked, missing-required blocked, save round-trip render-safe | ✅ correct |
| **Edit product** | field edits, SKU rename + PDF file rename (standard & family), IP52EC custom PDF correctly *skipped*, concurrency signature stable (no false conflicts), non-standard partType preserved, `pdfLabel`/`additionalPdfs` round-trip lossless | ✅ correct |
| **Delete product** | confirm page → POST delete, PDF removed, shared-PDF guard prevents deleting a file another product uses | ✅ correct |
| **Upload / Replace PDF** | replace-in-place reuses existing filename (IP52EC & families), fresh upload derives name from SKU, MIME + extension + 20 MB checks | ✅ correct |
| **Remove PDF** | clears `pdfUrl`, deletes file, shared-PDF guard | ✅ correct |
| **Import JSON** | preview counts (new/updated/skipped), invalid-row + non-object skipping, normalization to render-safe schema, `pdfUrl` preserved on update | ✅ correct (but see F1) |
| **Dashboard** | listing/grouping/stats, live search matches partial part numbers inside compound SKUs | ✅ correct |
| **Audit log** | truncation to newest 500, newest-first order, JSONL parse, SKU/action filters | ✅ correct |
| **.htaccess** | blocks `config.php`, `config.local.php`, `.htaccess`, `admin-log.jsonl`, `.login-throttle.json`, `*.json`, backups; serves all `.php`/`.js` pages; `data/` blocks backups but serves `products-all.json` | ✅ correct |
| **Frontend contract** | parses plain array *and* `{products:[…]}`; product lookup by `id`\|`sku` + compound fuzzy match; `SpecTable1`/`SpecTable2` null-guarded; `badges`/`description`/`pdfUrl`/`photoUrl` guarded; `additionalPdfs`/`pdfLabel` render | ✅ correct |
| **CSRF** | present on every mutating action: add, edit, delete, upload, remove, import-confirm, logout | ✅ correct |

---

## Findings (notated, not fixed)

### F1 — Import "update" is a full-row replace *(MEDIUM)*
Importing a JSON row whose SKU matches an existing product **overwrites the entire record**. Only `pdfUrl` is carried over; every field not present in the imported row is wiped — `description`, `badges`, `specTable1`, `specTable2`, `photoUrl`, `operatingTemp`, `pdfLabel`, `additionalPdfs`.

**Reproduced:** importing `{sku, name, partType}` for `IP17TW-IP18SW-IP19LW` dropped its 3 description paragraphs, 38 spec rows, and 4 badges.

- **Mitigations already in place:** a timestamped backup is written to `data/` before every merge, so it is recoverable; the README documents matching SKUs as "overwritten."
- **Why it still matters:** the preview labels these rows "Updated," giving no hint that unfilled fields will be blanked. A user fixing a typo via a small import could silently gut a product.
- **Options:** (a) document/train "always import complete records"; (b) change import-update to merge field-by-field (keep existing values where the import omits a field); (c) add a preview warning listing fields that will be cleared.

### F2 — Additional PDFs are not cleaned up on delete *(LOW)*
Deleting a product removes its primary PDF (with the shared-file guard) but leaves any `additionalPdfs` files on disk (e.g. IP52EC's `IP52EC-plugged-cap.pdf`). Harmless orphan; the admin has no UI to manage secondary PDFs on delete.

### F3 — SKU rename leaves secondary/custom PDF names misaligned *(LOW, cosmetic)*
Renaming a product renames the primary auto-named PDF, but custom-named files (IP52EC) and `additionalPdfs` keep their old names. Links still work — the filenames just no longer match the new SKU.

### F4 — Login throttle keys on `REMOTE_ADDR` *(LOW)*
Fine for direct Network Solutions hosting. If the site is ever placed behind a CDN/proxy that presents a single IP, the throttle could over-count across users. (Same caveat applies to the audit-log IP column.)

### F5 — Import of a single bare object imports nothing *(LOW)*
Uploading one product as a bare JSON object (not wrapped in an array and not under a `products` key) silently imports 0 rows — the loop iterates the object's fields as if they were product rows and skips them all. Confusing, but not destructive.

### F6 — `additionalPdfs` edit field uses `|` as delimiter *(LOW)*
In the new edit form, an additional-PDF URL containing a literal `|` would mis-parse. PDF filenames never contain pipes in practice; no validation enforces it.

### F7 — A part literally named `0` can't be added *(LOW, effectively theoretical)*
PHP's `empty()` treats the string `"0"` as empty, so a SKU/name of exactly `0` is rejected as "required." No such part exists here.

### F8 — `IP12GA` has no datasheet while `IP12GA-IP1274` does *(CONTENT, not a bug)*
The standalone `IP12GA` product has no `pdfUrl` (site shows "Request Data Sheet"), while the compound `IP12GA-IP1274` has the datasheet. Worth a content decision — possibly point `IP12GA` at the same PDF, or leave as-is.

---

## Operational notes (not defects)

- **Password:** the shipped default (`ipc-admin-2025`) must be overridden by deploying `admin/config.local.php` (already generated). Confirm login uses the new password after first deploy.
- **Writability:** the audit log and login throttle write into `admin/`. If that directory isn't writable by PHP on the server, both silently no-op (login still works; no persisted log/throttle). Verify `admin/` is writable after deploy.
- **Frontend deploys:** any change to `src/App.jsx` requires `npm run build` and re-uploading the contents of `/dist`; the admin, `data/`, and `pdfs/` are not re-uploaded.
- **Freshness:** public site reflects admin edits within ~60 s (cache), or instantly on hard refresh.

---

## Suggested pre-launch checklist

1. Rotate password (deploy `config.local.php`); verify login.
2. Do not upload the `.zip` archives to `public_html/`.
3. Confirm `data/products-all.json` is writable (644/666) and `pdfs/` + `admin/` are writable.
4. Smoke-test on the live server: login → add → edit → upload PDF → replace PDF → remove PDF → delete → import (with a **complete** record) → check the public product page and datasheet link.
5. Decide on F1 (import merge vs. overwrite) and F8 (IP12GA datasheet).
