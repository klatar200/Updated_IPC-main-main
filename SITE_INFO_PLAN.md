# Business Details ("Site Info") — Implementation Plan

**Scope chosen:** Phase 1 — structured business fields editable from the dashboard and reflected across the whole website, including the SEO Schema.org data (rendered from the data). The About-page narrative and FAQ prose stay static in this phase.

**Goal:** Let the customer change phone, fax, email, address, business hours, ISO/certifications, company stats, and social links from the admin dashboard, and have those changes appear everywhere on the public site within ~60 seconds — no code changes, no rebuild.

---

## Architecture (mirrors the existing products pattern)

Today the React site fetches `data/products-all.json` at runtime and the PHP admin edits that file. We add the identical round-trip for business info:

```
data/site-info.json   ← single source of truth (new)
        ▲   read at runtime by React          ▼ read/written by admin
   React site                            admin/settings.php
```

After a one-time frontend refactor, editing business details is live within ~60 s (same cache behavior as products). No rebuild per edit.

---

## 1. Data file — `data/site-info.json`

Seeded with the current live values so the site looks identical the moment it ships:

```json
{
  "company": {
    "name": "Insulation Products Corporation",
    "shortName": "IPC",
    "slogan": "Materials for the Electrical & Electronic Industry",
    "foundedYear": "1974",
    "description": "A major supplier of heat-shrinkable and extruded tubing, sleeving and adhesives for the electrical and electronic industry since 1974."
  },
  "contact": {
    "phone": "630.771.0700",
    "phoneDial": "+16307710700",
    "fax": "630.771.0701",
    "email": "sales@insulationproducts.com"
  },
  "address": {
    "street": "250 Gibraltar Dr",
    "city": "Bolingbrook",
    "state": "IL",
    "zip": "60440",
    "country": "US"
  },
  "hours": {
    "text": "Mon–Fri, 8am–5pm CT",
    "opens": "08:00",
    "closes": "17:00",
    "days": ["Monday","Tuesday","Wednesday","Thursday","Friday"]
  },
  "certifications": { "iso": "ISO 9001", "other": [] },
  "stats": { "feetInStock": "25 million", "minimumOrder": "$50" },
  "social": {
    "twitter": "https://twitter.com/InsulProdCorp",
    "facebook": "https://www.facebook.com/insulationproductscorporation",
    "linkedin": "https://www.linkedin.com/company/insulation-products-corporation",
    "youtube": "https://www.youtube.com/channel/UC0JRr_IxMwbRGOFZhbJGbNw",
    "pinterest": "https://www.pinterest.com/insulprodcorp"
  },
  "catalogPdfUrl": ""
}
```

Deployed once to `public_html/data/site-info.json` (first deploy only, like `products-all.json`), then it is live server state the admin owns.

---

## 2. Admin — `admin/settings.php` (a "Business Details" page)

Behaves like `edit.php`, reusing existing infrastructure:

- Loads/saves `data/site-info.json` with **new `load_site_info()` / `save_site_info()` helpers in `config.php`** modeled on `load_products()` / `save_products()` (LOCK_EX write, timestamped backups, keeps 5).
- Cards of labeled fields: **Contact**, **Address**, **Hours**, **Certifications**, **Company & stats**, **Social links**.
- `csrf_check()` on save, `audit_log('settings', ...)`, backup-on-write — all already exist.
- A **live preview** (reusing the pattern we built) showing a header/footer snippet as the site will render it.
- Add a **"Business Details"** link to `nav.php`.
- Validation: email format, phone not empty, URLs for socials optional-but-validated.

Low risk, self-contained, no build step (deploys like any admin file).

---

## 3. Frontend — read `site-info.json` and replace the hardcoded literals

- Add `SiteInfoProvider` + `useSiteInfo()` near the top of `App.jsx` that fetches `/data/site-info.json` once (same `?v=` cache-buster as products), with the current values hardcoded as a **fallback** so the site never breaks if the file is briefly unavailable.
- Replace the hardcoded literals with `useSiteInfo()` values at the structured touchpoints identified in the audit:
  - Top header / contact bar (phone, email, hours)
  - Footer (phone, fax, email, address, hours, social icons, ISO, founded year)
  - Contact page (all of the above)
  - "Request a Quote" / CTA blocks (phone, email)
  - Error-boundary screen (phone, email)
  - Assorted "since 1974", "ISO 9001", "$50 minimum", "25 million feet" references
- **Schema.org JSON-LD**: remove the static block from `index.html` and render it from `site-info` via a small React component injected into `<head>`, so structured data stays in sync with the visible site.

Requires **one** `npm run build` + redeploy of `dist/`. After that, business edits are live without rebuilds.

Left static in Phase 1 (by design): the About-page narrative paragraphs and the few FAQ answers that embed the phone number in a sentence. (Phase 2 covers these.)

---

## 4. Build order (tasks)

1. Create `data/site-info.json` (seed with current values).
2. `config.php`: add `load_site_info()` / `save_site_info()` (+ backup + validation helper).
3. `admin/settings.php`: the Business Details editor (+ live preview).
4. `nav.php`: add the "Business Details" nav link.
5. `App.jsx`: add `useSiteInfo()` + fallback; replace structured literals; render Schema.org from data.
6. Build, verify, and deploy: `npm run build` → upload `dist/` contents + `data/site-info.json` (first time) + the admin files.

---

## 5. Verification

- Admin: load `settings.php`, change the phone, save, confirm `site-info.json` updates and a backup is written; confirm audit-log entry.
- Frontend (local `_localsite`): confirm header/footer/contact/error screen/JSON-LD all read the new value; confirm fallback works if the file is missing.
- Confirm no visual change when seeded with current values (byte-for-byte same rendered contact info).

## 6. Risks & notes

- Main risk is the `App.jsx` refactor surface (large file, many touchpoints) — done carefully in one pass with a verification build; the fallback guarantees the site still renders if the JSON is absent.
- Schema.org becomes JS-rendered; Google executes JS and reads JSON-LD, so SEO is preserved, but it's a change from static HTML worth noting.
- Deploy contract unchanged: `data/` is first-deploy-only thereafter; the admin owns `site-info.json` as live state.
