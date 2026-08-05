# PLAN 5 — Correctness, performance, and the one unbuilt feature

**Items:** **4.27**, **4.29**, **4.26**, **4.32** (image weight), **4.14**, **4.11b**
**Depends on:** nothing, but run it **last** — 4.32 changes bytes that every
other plan's screenshots depend on.
**Effort:** 4.32 medium-mechanical; 4.14 medium; the rest small.
**Read [GUARDRAILS.md](GUARDRAILS.md) first.**

---

## 4.27 — Duplicate React keys, reachable from the admin

### Evidence

Keys are derived from owner-editable text: `key={link.label}`, `key={f.title}`,
`key={m.year}`, and others.

**Two footer links both named "Contact" silently drop a row.** Rick adds the
second one, saves, sees a green banner — and one of them never appears. Nothing
tells him. He can also produce two milestones in the same year, or two services
with the same title.

### The fix

Key on something the owner cannot collide. Prefer a stable identity from the
data; failing that, combine the value with its index — but understand the
trade-off: index-bearing keys reorder poorly, and the content editor supports
reordering.

The correct answer for a reorderable list is a **stable per-row id assigned at
creation** in `admin/content.php`, carried in `content.json`, and used as the
key. If that is too large for this plan, use `` `${index}-${value}` `` and record
the residual reorder cost in `WHATS_LEFT.md` §2. **State which you chose.**

Also: React logs duplicate-key warnings to the console. `sweep.js` asserts zero
console errors — check whether these are warnings (not caught) or errors
(already caught), and say which.

### Acceptance

- Two footer links both named "Contact": **both render**, both navigate correctly.
- Two milestones in the same year: both render.
- Zero React key warnings in the console across all nine routes.
- Reorder a list with duplicate labels in the admin, save, and confirm the public
  order matches. This is the check that catches a bad index-based key.
- `sweep.js 18/18`, `nb4.js 17/17`.

---

## 4.29 — Three products render an empty, invalid spec table

### Evidence

`IP75AD`, `VALUE-ADDED` and `VT-1100` have `rows: []` and render an empty
bordered table containing `<thead><tr></tr></thead>` — invalid HTML, and a
visible empty box on a product page a buyer is evaluating.

### The fix

When a spec table has no rows, **render nothing** — no table, no header, no
border. Do not render an empty `<tr>` under any circumstance.

Check the neighbouring case too: a table with a title but no rows should also not
emit a heading for an absent table.

This is data-driven, so also confirm the admin cannot easily create the state
without noticing — if it can, note it in §2 rather than fixing it here.

### Acceptance

- `/products?productId=IP75AD`, `VALUE-ADDED` and `VT-1100`: no table element,
  no empty bordered box. Screenshot each.
- Zero `<tr>` elements with no children anywhere in the app — assert across all
  42 product pages.
- A product **with** rows is unchanged — screenshot one for comparison.
- `overflow.js` 0 overflow across 42 pages, `sweep.js 18/18`.

---

## 4.26 — Scroll listeners added in a `ref` callback and never removed

### Evidence

Scroll listeners are attached inside an inline `ref` callback and never removed.
An inline `ref` callback is invoked with `null` on unmount and re-invoked on
**every render** — so listeners accumulate, and none are cleaned up.

On a long browsing session across product pages this is a genuine leak, and each
orphaned listener still runs on every scroll event.

### The fix

Move attachment into a `useEffect` with a cleanup that removes the listener, and
a dependency array that does not re-run on every render. Use `useCallback` for
the handler identity if needed.

Consider `{ passive: true }` — these are read-only scroll handlers and it removes
scroll-blocking. Only if none of them call `preventDefault()`; verify first.

### Acceptance

- Mount and unmount the component 20 times; the listener count on the target is
  the same at the end as after the first mount. Measure it — do not assert by
  inspection.
- The scroll behaviour it drives still works: scroll the page and confirm the
  visual effect at 1440 and 375.
- `sweep.js 18/18`, `ttl.js 3/3`.

---

## 4.32 — 9.1 MB of unoptimised images

### Evidence (measured 2026-08-05)

`public/images/` totals **9.1 MB** — `products/` 4.9 MB, `site/` 4.3 MB.
Largest offenders:

| Bytes | File |
|---|---|
| 1,520,217 | `public/images/site/Front-Cover.jpg` |
| 683,201 | `public/images/products/VALUE-ADDED.png` |
| 554,613 | `public/images/site/Marker-Sample-2.jpg` |
| 545,320 | `public/images/site/Heat-Shrink-Tape-Product-photo-2.jpg` |
| 401,276 | `public/images/products/CC.jpg` |
| 330,057 | `public/images/site/Slide1.png` |
| 267,707 | `public/images/site/staff-image.png` |

The caching half of this item is already fixed (NB1 — `immutable` is now scoped
to `/assets/` so replaced photos actually reach returning visitors). **Only the
weight remains.**

### The fix

- Re-encode at sensible dimensions and quality. A 1.5 MB cover image is being
  displayed at a fraction of its pixel dimensions.
- Photographs → JPEG or WebP; screenshots/line art with flat color → PNG or
  WebP. `VALUE-ADDED.png` at 683 KB is very likely a photograph saved as PNG.
- Add `width`/`height` attributes so layout does not shift while loading, and
  `loading="lazy"` on below-the-fold images. **Not** on the hero — lazy-loading
  the largest contentful paint makes it worse.
- If you introduce WebP, provide a fallback. Do not drop the original formats.

### Non-negotiable constraints

- **Never touch `uploads/`.** That is Rick's, live, and not yours.
- These are the customer's product photographs. **Do not crop, retouch, or
  alter their content.** Re-encode and resize only.
- Keep filenames identical. `products-all.json` and the admin's photo mapping
  both reference them by name, and renaming breaks the mapping silently.
- Keep the originals somewhere recoverable until the acceptance shots are
  approved. Quality loss on a product photo is a business problem, not a
  technical one — **escalate before shipping anything visibly degraded.**

### Acceptance

- Total `public/images/` under **3 MB** — paste `du -sh` before and after.
- No single file over 300 KB, or a written justification for each exception.
- **Side-by-side screenshots at 1440 and 375 of every page carrying a changed
  image**, before and after. A reviewer must be able to see that nothing degraded.
- All 42 product pages still show their photo — zero broken images across the
  full sweep.
- `overflow.js` 0 overflow (dimension attributes can change layout).
- `dist/` re-synced and `public/`↔`dist/` image parity confirmed.

---

## 4.14 — Login throttle is a delay, not a lockout, and races

### Evidence

`admin/auth.php:108–117`. Measured behaviour, already recorded in the comment at
`49–54`: attempts 1–5 return in ~280 ms, then 1.4 s, 2.3 s, 3.3 s, capped at 8 s.

Two real weaknesses:

- `sleep()` means **parallel connections sleep concurrently** rather than
  queueing. Ten simultaneous attempts all wait once, together.
- The throttle file is a read-modify-write with **no lock**, so concurrent
  failures can lose counts.

### The fix

- Lock the read-modify-write (`flock`) so counts cannot be lost.
- Ensure the delay applies per attempt in a way parallelism cannot amortise;
  consider a short lockout window after a threshold rather than a per-request
  sleep.

**Do not overstate what this buys.** The comment at `49–54` is deliberate and
accurate: the long random password is the real control, and this is per-IP so a
distributed attacker is unaffected. If your fix does not change that, **say so
and keep the comment honest.** Rewriting it to claim more than it delivers is
worse than the current state.

Do not add a lockout that can strand Rick from his own admin. There is no
"forgot password" email; the recovery path is FTP (B2), which he uses
reluctantly. **A permanent lockout is a worse outcome than a slow brute force.**

### Acceptance

- 10 parallel failed attempts produce 10 counted failures — no lost counts.
  Paste the throttle file before and after.
- The delay is not amortised by parallelism — show timings for serial vs
  parallel runs.
- The correct password still signs in **immediately** after the throttle
  disengages, and `login_reset_failures()` clears the streak.
- Rick cannot be locked out permanently: after the window, a correct password
  works. Demonstrate it.
- `b2.js 18/18`, `adminsweep.js 5/5`.

---

## 4.11b — Footer social icons were promised and never built

### Evidence

v2 item 4.11 promised footer social icons. They were never built. `social.*`
currently feeds JSON-LD `sameAs` only.

### The fix

Render the five social links (Twitter/X, Facebook, LinkedIn, YouTube, Pinterest)
as icons in the footer, from `site.social.*`.

**This interacts directly with NB4 (invariant 4).** All five social fields are in
`SITE_CLEARABLE` — Rick is explicitly allowed to empty them, and
`Editing-Your-Site-Content.md` promises that clearing one makes it "disappear
from the site properly". So:

- Render **only** links with a non-empty value.
- If all five are empty, render **no** container, no heading, no empty row.
- `nb4.js` already asserts the cleared-social behaviour for JSON-LD `sameAs`;
  extend it to cover the footer.

Icons must be inline SVG — no icon-font or CDN dependency (the CSP and the
$0-budget rule both forbid it). Each needs an accessible name and
`rel="noopener noreferrer"` on `target="_blank"`.

### Acceptance

- With all five set: five icons, each linking to the configured URL.
- With two cleared: three icons, no gaps, no placeholder.
- With all five cleared: **no footer social container at all** — assert the
  element is absent, not merely empty.
- Each icon has an accessible name; keyboard reachable with a visible focus ring.
- `nb4.js` extended and passing, `sweep.js 18/18`, `overflow.js` 0 overflow.
- Restore `data/site-info.json` from pristine and `cmp` afterwards.

---

## Scope boundary

`src/App.jsx`, `admin/auth.php` (throttle only), `admin/config.php`
(`login_*` helpers only), and `public/images/`.

You are **not**: changing the auth flow, session handling, `regenerate_session_id()`,
or `csrf_check()`; touching `uploads/` or `pdfs/`; adding an image CDN or build-time
image plugin (evaluate cost and escalate first — $0 budget); or altering
`products-all.json` to point at renamed images.
