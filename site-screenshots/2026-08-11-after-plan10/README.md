# Public site — after PLAN-10

A visual record of the **public** site as it stands once PLAN-10's remediation of
AUDIT-10 has landed. It exists to be compared, folder against folder, with the
owner's own "before" set from the previous version of the site — drop that set in
as a sibling directory under `site-screenshots/` and the two sort side by side.

Nothing here was fixed, tuned or staged for the camera. These are the pages as
the server rendered them.

---

## What this was taken at

| | |
|---|---|
| Commit | `375eec7` — *Merge PR #34: fix the record errors AUDIT-11 found, refresh the stale suite baseline, and correct CLAUDE.md's line count* |
| Branch | `claude/site-crawl-after`, branched from `origin/main` |
| Date | 2026-08-11 |
| Bundle | `index-C4VDIpwN.js` — 368.07 kB JS / 23.41 kB CSS, matching the GUARDRAILS §4.1 baseline |
| Browser | Chromium **141.0.7390.37**, the image's pinned build at `/opt/pw-browsers/chromium-1194/`, driven by Playwright 1.62.1 via `_harness/browser.js` |
| Runtime | Node v22.22.2, PHP 8.4.19 |
| Server | `php -S 127.0.0.1:8123` over the `_harness/site` mirror |

Captured at `deviceScaleFactor: 1`, so **1 image pixel = 1 CSS pixel** and a
measurement taken off these files in an image editor is a real CSS measurement.

## Viewports

| suffix | size | context |
|---|---|---|
| `__1440` | 1440 × 900 | desktop |
| `__834` | 834 × 1112 | tablet portrait, `isMobile` + `hasTouch` |
| `__390` | 390 × 844 | phone, `isMobile` + `hasTouch` |

The states set adds **1024 × 768** for the one frame that needs it.

## How each shot was taken

`waitUntil: 'networkidle'`, then a 600 ms settle, then the page is scrolled to
the bottom in 600 px steps and back to the top so anything lazy has painted, then
a further 400 ms. Page-set shots are **full-page**.

Three of the six state shots are **viewport-only**, and deliberately so:
`contact-failed-submit`, `home-megadropdown` and `home-drawer` are all evidence
about *where the viewport sits relative to a fixed element* — the sticky header,
the dropdown panel, the drawer. Playwright's full-page compositor paints a
`position: fixed` element once at the top of the tall image, which would erase
the very thing those frames exist to show. The other three state shots are
full-page.

---

## ⚠ The font caveat — read before calling a width difference a defect

`fc-match system-ui` on this machine resolves to **DejaVu Sans**, which is about
**21 % wider** than the face a real visitor gets. This is a known artifact of the
Linux image, not of the site.

It affects **text width**, and therefore wrap points, line counts and any height
that follows from them. If a block of text in this set looks wider, or wraps to
more lines, than the same block in the before-set, **that is very likely the font
and not a regression.** Re-measure before reporting it:

```sh
CRAWL_FONT=liberation node _harness/plan10-crawl.js
```

That forces Liberation Sans, which is metric-compatible with Arial — the same
rule `_harness/audit10-p1font.js` uses, and the one PLAN-10's own before/after
numbers were taken under. Colour, layout structure, column widths and element
geometry are unaffected by any of this.

---

## Regenerating this set

From a clean checkout of `375eec7`:

```sh
npm install && npm run build && sh _harness/sync.sh
PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php &
node _harness/plan10-crawl.js
```

`node _harness/plan10-crawl.js pages` and `… states` run one group on its own.
`CRAWL_BASE` and `CRAWL_OUT` override the server and the output directory.

Two notes worth carrying forward:

- It is **`php-mail.ini`** on :8123, not `php-extra.ini`. GUARDRAILS §4.2's table
  says `php-extra.ini`; `php-mail.ini` is the one that works, because it points
  `sendmail_path` at `_harness/fakemail.sh` and without it a contact-form POST
  dies in `contact.php`'s "mail server could not send" branch.
- Never run `playwright install`. The image ships a pinned Chromium and the npm
  package expects a newer one; `_harness/browser.js` is what resolves this, and
  every harness script launches through it.

`sh _harness/sync.sh` recreates `_harness/site/admin/config.local.php`, which
carries a working throwaway credential. **Delete it when you are done** — it was
deleted before this set was committed.

---

## The page set

Ten public routes plus one representative product detail, three viewports each —
33 files. One product page stands in for all 42; `IP38FE` (FEP Teflon Heat Shrink
Tubing) is the same product `_harness/plan10-repalette.js` drives.

| file | route | PLAN-10 change visible in it |
|---|---|---|
| `home__1440/834/390` | `/` | Phase C — the cyan rule under the header, the "Bolingbrook, IL" badge outline and the stat-tile borders are all accent tints that now read from the palette (A10-045) |
| `products__1440/834/390` | `/products` | — catalog grid, no PLAN-10 item |
| `industries__1440/834/390` | `/industries` | Phase C — the industry-card outlines (A10-045) and the five industry-card header gradients (A10-046) |
| `services__1440/834/390` | `/services` | — |
| `about__1440/834/390` | `/about` | — |
| `faq__1440/834/390` | `/faq` | — |
| `contact__1440/834/390` | `/contact` | the quote form in its resting state; the failed-submit frame is in `states/` |
| `datasheets__1440/834/390` | `/datasheets` | — |
| `dashboard__1440` | `/dashboard` | **A10-001/A10-002 control** — the desktop was the one width that already worked, and is unchanged: Description 300 px, page 5,508 px tall |
| `dashboard__834` | `/dashboard` | **A10-001/A10-002/A10-015** — Description column restored, headers no longer overprint, page 5,593 px instead of 16,097 px |
| `dashboard__390` | `/dashboard` | the phone view is a card list, not a table, and was deliberately left untouched |
| `product-IP38FE__1440` | `/products?productId=IP38FE` | **A10-011 control** — above the breakpoint the header is still the original single row, title left / buttons right. Also A10-046: the header gradient's near end is now mixed from the palette |
| `product-IP38FE__834` | " | as above — the restoring utilities rebuild the row at tablet width too |
| `product-IP38FE__390` | " | **A10-011** — see `states/` |

## The states set

`states/` — the six frames where a PLAN-10 change is actually legible rather than
merely present. Two of them (`product-IP38FE__390`, `dashboard__834`) repeat a
page-set frame, so this folder stands on its own as the evidence set.

| file | shot | what it shows |
|---|---|---|
| `product-IP38FE__390.png` | full-page | **A10-011**, the audit's only severity A. The header strip now stacks: the product name gets the full width of the card, the part number sits under it, and "Download PDF" / "Request Quote" are on their own row beneath. The name used to render on top of both buttons on 42 of 42 products |
| `dashboard__1024.png` | full-page | **A10-001/A10-002** at the width that was worst. Description is 300 px, the header reads `DESCRIPTION` rather than `DESCRTIEMPON`, the operating temperature is back in its own column, and the page is 5,544 px tall instead of 16,048. The table scrolls sideways inside its own card, which is what the card was built to do |
| `dashboard__834.png` | full-page | **A10-015**, the same fix at tablet width — Description 300 px where it previously had no column at all; page 5,593 px instead of 16,097 |
| `contact-failed-submit__390.png` | viewport | **A10-012**. The quote form was submitted with Full Name empty. The field the browser is complaining about, its **Full Name \*** label, and the browser's own "Please fill out this field." bubble are all clear of the sticky navy header. Previously the field was 100 % behind that header and the label was off-screen at −21.8 px |
| `home-megadropdown__1440.png` | viewport | **Phase C** — the Products mega-dropdown panel open. The panel surface is one of the four shades that used to be a fixed navy and is now re-mixed from the palette (A10-046) |
| `home-drawer__390.png` | viewport | **Phase C** — the phone menu drawer open. Same: the drawer surface now follows the palette (A10-046), and the cyan rule on the active item is an accent tint (A10-045) |

### What the phase C frames can and cannot prove

Worth being exact, because it is easy to over-read them. PLAN-10's bar for
phase C was that **the site must look identical today** — the change was to make
fourteen hard-coded accent shades and four hard-coded dark shades read from the
palette instead of being frozen. So these frames are evidence of *no visual
regression at the shipped palette*, which is the whole claim for how the site
looks now.

They cannot show the other half — that those surfaces now **track** a re-picked
palette — because they were shot at the stock palette, where before and after are
by design the same pixels. That half is what `_harness/plan10-repalette.js`
(33/33) measures, by re-skinning the site and counting what stayed cyan.

---

## Not in this set: the admin

**Public pages only.** `/dashboard` here is the public **Product Index**, not the
admin dashboard — different page, despite the name.

Six of PLAN-10's twelve remediated findings live behind the admin login and are
therefore **not represented by any image in this folder**:

- **Phase D** — A10-020 (the sliced Delete button on every product row), A10-021
  (the admin menu falling out of its bar on a phone), A10-022 (the Help page
  689 px wide on a 390 px screen), A10-027 (every content save logged as
  "Homepage content updated").
- **Phase E** — A10-028 (the process diagram telling Rick to paste a photo URL)
  and A10-029 (the worked size chart showing a maximum below its minimum). Both
  are on the admin Help page.

If an admin set is wanted later, it needs a login step and a throwaway credential
in the frame, which is why it was kept out of a committed, public artifact.
