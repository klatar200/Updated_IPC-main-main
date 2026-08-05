# PLAN 2 — Stop the admin from letting Rick hurt himself

**Items:** **NB-copy**, **4.12**, **4.13**, **4.23**, **`form_complete` position**
**Depends on:** nothing (PHP-side; Plan 0 only helps the 4.23 check).
**Effort:** NB-copy medium; 4.23 medium; the rest small.
**Read [GUARDRAILS.md](GUARDRAILS.md) first.**

Every item here is the same shape: the admin accepts an action, reports success,
and produces an outcome Rick did not intend and cannot see. That is the failure
mode this whole release has been about.

Do **NB-copy first** — it is the one that silently destroys work.

---

## NB-copy — an unmatched copy key makes Rick's edit vanish under a success banner

### Evidence

`mergeContent` in `src/App.jsx` iterates **`Object.keys(defaults)`**. A `copy`
key that `admin/content.php` posts, but which does not exist in `COPY_DEFAULTS`
(`src/App.jsx:4620`), is never read — so it is written to `content.json`,
reported saved, and never rendered.

The two sides are declared independently:

- PHP: `$COPY_GROUPS` at `admin/content.php:257`, groups including `hero` (`258`),
  `homeFeatures` (`269`), `homeMarkets`, `servicesHeader`, …
- JS: `COPY_DEFAULTS` at `src/App.jsx:4620`

**Roughly 450 posted keys have never been enumerated against the defaults tree.**
Nobody knows today whether the sets match. If even one differs, that field is a
silent data-loss path with a green banner on it.

### The fix

1. **Enumerate both sides mechanically.** Write a script under `_harness/` that
   extracts every `group.key` pair from `$COPY_GROUPS` in `admin/content.php` and
   every key path from `COPY_DEFAULTS` in `src/App.jsx`, then prints three sets:
   PHP-only, JS-only, and matched. Do not do this by eye.
2. **PHP-only keys** are the live defect: the admin offers a field the site can
   never render. For each, decide — add it to `COPY_DEFAULTS` so it renders, or
   remove the field from `content.php` so it is not offered. Prefer adding; a
   field Rick has already filled in should start working, not disappear.
3. **JS-only keys** are the milder direction: the site renders a default Rick can
   never edit. List them; add editors only where it is clearly intended.
4. **Then make drift impossible.** Add the comparison to `_harness/lint.php` (or
   a sibling) so an unmatched key is a **failing check**, not a future audit
   finding. Without this, the two lists drift again the first time someone adds a
   heading.

### Acceptance

- The enumeration script's output, pasted in full, showing the three sets.
- Zero PHP-only keys remain, or each remaining one is individually justified.
- Round-trip proof for at least three previously-unmatched keys: edit in the
  admin against the mirror → value appears on the public page.
- The new drift check fails when you temporarily add a bogus key to
  `$COPY_GROUPS`, and passes when you remove it. **Show both.**
- `B1 20/20`, `invariants 15/15`.

---

## 4.12 — The Industries SKU field validates nothing

### Evidence

`admin/content.php` tells the owner the Industries SKU "must match a real
product" and then validates it against nothing. `load_products()` is available
in the same request.

A typo produces a card that links to a product page that does not exist. Rick
gets a success banner.

### The fix

Validate the submitted SKU against `load_products()` on save. Follow the page's
existing conventions exactly:

- Add the message to the existing `$errors` array so it renders in the same
  block as the concurrency and truncation warnings.
- **The B1 repopulation path must hold**: on this new error, the form must come
  back with everything Rick typed. `admin/content.php:520` repopulates from
  `$out` when `$_SERVER['REQUEST_METHOD'] === 'POST' && !empty($errors)` — adding
  to `$errors` inherits that, but you must prove it, because B1 is the single
  most expensive defect in this codebase.
- **Do not** add a field to the form. If you need one, it goes **before**
  `form_complete` — see the last item in this plan.

Prefer a warning that still allows the save over a hard block if the SKU is
merely unmatched — Rick may be adding the card before the product. Make it
unmissable. **Escalate if you think it should hard-block**; that is a workflow
decision about how he works, not a code decision.

### Acceptance

- Saving a bogus SKU produces a visible, specific message naming the SKU.
- Every other typed field survives that error — assert a marker string, the way
  `_harness/b1.js` does.
- A valid SKU saves cleanly with the green banner.
- `content.json` is byte-identical to pristine after the rejected save.
- `B1 20/20` and `B1-truncation 5/5` still pass.

---

## 4.13 — The delete-a-card ✕ has no confirmation and sits 4 px from reorder

### Evidence

The ✕ that removes an entire content card has no `data-confirm`, while other
destructive admin actions do. It sits **4 px** from the ↑/↓ reorder buttons.

Rick reorders rows far more often than he deletes them, on a touch-capable
laptop, and the two targets are adjacent. The undo path exists (Backups) but he
has to know he needs it — and a mis-click during reordering does not announce
itself.

### The fix

- Wire the ✕ into the existing confirmation mechanism (`admin/confirm.js`,
  `data-confirm`) rather than inventing a second one. The message must name what
  is being deleted, not say "Are you sure?".
- Increase the separation between ✕ and ↑/↓, and/or visually group ↑/↓ apart.
  Keep the hit target at least 44 px on touch.
- Do not add an undo stack. Backups already covers it and `admin/delete.php`
  now says so.

### Acceptance

- Clicking ✕ shows a confirmation naming the row; cancelling leaves the row and
  the rest of the form untouched.
- Measured gap between ✕ and the nearest reorder control ≥ 24 px at 1440 and
  375 px, with the measurement pasted in.
- `adminsweep.js 5/5`, `help.js 22/22`.

---

## 4.23 — Rick can make his own site unreadable

### Evidence

Owner-set brand colors are injected with **no contrast guard**, while headings
and primary buttons hardcode `#ffffff`. `Business Details` invites him to pick a
color and re-skin the whole site — the guide says exactly that.

Pick a pale color and white-on-white text ships to every visitor. Nothing warns
him, and the damage is on the public site, not the admin.

### The fix

Two layers, both needed:

1. **In the admin (`admin/settings.php`), warn at the point of choice.** Compute
   the WCAG contrast ratio of the chosen color against the white it will carry.
   Below **4.5:1**, show a clear warning next to the field. Below **3:1**, warn
   harder. Show the number and what it means in plain language.
2. **On the site, stop hardcoding `#ffffff`.** Derive the foreground from the
   chosen background — pick white or a dark ink by luminance — so a pale brand
   color yields dark text instead of invisible text.

**Do not block the save.** It is his brand and his decision; the job is to make
the consequence visible before he commits to it. Warning + automatic sane
foreground is the right balance.

Implement the contrast math once. If both sides need it, put the JS copy where
the site uses it and the PHP copy in `admin/config.php`, and note in a comment
that the two must agree.

### Acceptance

- A pale brand color (e.g. `#FFE600`) produces a visible admin warning with the
  computed ratio.
- The same color, saved, yields **dark** heading and button text on the public
  site — screenshot at 1440 and 375.
- A dark brand color still yields white text — no regression to the current look.
- Contrast ratio of primary headings and primary buttons ≥ 4.5:1 for at least
  three sampled brand colors spanning light to dark. Paste the numbers.
- Restore `data/site-info.json` from pristine and `cmp` afterwards.
- `nb4.js 17/17`, `sweep.js 18/18`.

---

## `form_complete` — positional enforcement with nothing asserting it

### Evidence

`admin/content.php:727` renders `<input type="hidden" name="form_complete" value="1">`
as the last field. It is the `max_input_vars` truncation sentinel: if PHP
truncated the POST, it is missing, and the page refuses to save.

Enforcement is **positional only**. Nothing stops a future field being added
after it, and there is no test runner to catch it. `invariants.js` INV 6 checks
the source layout, but nothing checks it at runtime, and INV 6 is easy to
satisfy accidentally.

### The fix

Add a runtime assertion rather than relying on source order alone. On render, in
a dev/debug path — or as a check in `_harness/` that loads the real page —
assert that `form_complete` is the final named control in the form's DOM order.

Then make the consequence explicit: add a comment at `727` stating that any new
field goes **above** this line, naming the truncation incident, matching the
style of the other invariant comments.

**Do not** replace the sentinel with a count-based scheme. It works, it is
proven by `b1trunc.js`, and swapping the mechanism is exactly the kind of
"simplification" GUARDRAILS §3 forbids.

### Acceptance

- The new check passes today.
- **Prove it can fail**: temporarily add a field after `form_complete`, watch the
  check go red, remove it, watch it go green. Paste both.
- `b1trunc.js 5/5`, `nb2.js 10/10` (both exercise the truncation path).

---

## Scope boundary

`admin/content.php`, `admin/settings.php`, `admin/confirm.js`, the content
editor JS, `src/App.jsx`'s `COPY_DEFAULTS` and color handling, and `_harness/`
additions.

You are **not** restructuring `content.php`'s form, changing the save/backup
path, altering `csrf_check()`/`require_auth()`, touching the optimistic-concurrency
signature, or adding fields after `form_complete`.

Every mutating page calls `csrf_check()` after `require_auth()`. If you add a
POST path, it does too — and `adminsweep.js` asserts a rendered 403 with no
`Location` header (invariant 12).
