# PLAN 4 — Accessibility

**Items:** **4.31**, **4.20**, **4.19**, **4.30**
**Depends on:** Plan 1 (4.21 changes what is a link vs a button — do not fight it).
**Effort:** 4.31 large but mechanical; 4.30 medium; 4.19/4.20 small.
**Read [GUARDRAILS.md](GUARDRAILS.md) first.**

Two audiences: buyers using assistive technology on the public site, and Rick
on the admin. 4.31 and 4.30 are Rick's; 4.19 and 4.20 are the buyer's.

**Sequence this plan after Plan 1.** 4.21 converts navigational buttons to
anchors. Doing 4.19 first means re-doing it.

---

## 4.31 — `content.php` renders 418 unlabelled form controls

### Evidence

`admin/content.php` renders **418** form controls with no programmatic label.
Visually they sit under section headings and in a grid; to a screen reader they
are 418 anonymous edit boxes.

This is the page holding the most irreplaceable typing on the site — the page B1
was about.

### The fix

Labels are generated, not hand-written — the fields come from `$SECTIONS` and
`$COPY_GROUPS` (`admin/content.php:257`), so the label text already exists in
those definitions.

- Render a real `<label for="…">` bound to each control's `id`, or an
  `aria-label` where a visible label would break the grid. Prefer visible labels.
- Ids must be **unique and stable** across rows. The field `name` already encodes
  section and index (`features[0][iconKey]`); derive the id from the same source
  so it survives reordering.
- Row-repeated controls need the row's identity in the accessible name — "Icon,
  row 3 of Industries Grid", not 18 controls all called "Icon".
- Use `<fieldset>`/`<legend>` for each section so the grouping is conveyed.

### The constraint that governs this item

**Do not add any control after `form_complete` (`admin/content.php:727`).** It is
the `max_input_vars` truncation sentinel and is enforced positionally.

**More importantly: labels must not add form *variables*.** `<label>` elements
and `id`/`for` attributes do not post. Anything that would add a posted control
increases the variable count — the form already posts **423**, and the whole
truncation-guard machinery exists because of that number. If a change adds
posted variables, stop and escalate.

### Acceptance

- Zero unlabelled form controls on `content.php`: assert programmatically that
  every `input`/`select`/`textarea` has a non-empty accessible name.
- Every control id is unique — assert no duplicates.
- **The posted variable count is unchanged at 423.** Count `form [name]` before
  and after and paste both. This is the check that stops this plan from breaking
  B1.
- `b1.js 20/20`, `b1trunc.js 5/5`, `nb2.js 10/10`, `invariants.js 15/15` (INV 6).
- Keyboard-only pass: tab through the first section, reach every control, no trap.

---

## 4.30 — The spec-table editor destroys focus, and every remove button says the same thing

### Evidence

`admin/spectable-editor.js` blows away focus on **every structural change** —
add row, remove row, reorder. All remove buttons share `aria-label="Remove row"`.

For a keyboard or screen-reader user, adding a row throws focus to the top of the
document. Building a 20-row spec table becomes 20 round trips.

### The fix

- After a structural change, place focus deliberately: adding a row focuses the
  new row's first input; removing a row focuses the nearest surviving row's
  equivalent control, or the add button if none remain.
- Give each remove button a distinct accessible name including its row identity —
  the row number and, where available, the row's first cell value.
- Announce structural changes via a polite live region, so a screen-reader user
  knows a row was added or removed.

Do not rewrite the editor. This is focus management and naming, not a
re-architecture.

### Acceptance

- Add a row: focus lands in the new row. Remove a row: focus lands on a sensible
  neighbour. Both asserted via `document.activeElement`.
- No two remove buttons share an accessible name — assert across a table with
  at least five rows.
- Adding and removing produce a live-region announcement.
- Round-trip: build a 5-row spec table by keyboard only, save, reload, and
  confirm all five rows persisted with correct values.
- `adminsweep.js 5/5`; `node --check admin/spectable-editor.js` clean.

---

## 4.19 — Product index sort headers are not operable

### Evidence

Sortable headers on the product index have no `tabindex`, no `scope`, and no
`aria-sort`. A keyboard user cannot sort; a screen-reader user is not told the
table is sortable or which column is active.

### The fix

- Make each sortable header a real `<button>` **inside** the `<th>` — do not put
  `tabindex` on the `<th>` itself. (This is the one place in Plan 1's aftermath
  where a button is correct: sorting changes state, not the page.)
- `scope="col"` on every header cell.
- `aria-sort` on the active column, `ascending`/`descending`, updated on change
  and removed from inactive columns.
- Visible focus indicator meeting contrast.

### Acceptance

- Tab reaches every sortable header; Enter and Space both sort.
- `aria-sort` is present on exactly one column and matches the visible direction.
- Every `<th>` has `scope`.
- Sort order after keyboard activation matches mouse activation.
- `sweep.js 18/18`, `overflow.js` 0 overflow.

---

## 4.20 — Collapsed FAQ answers are hidden visually but not from assistive tech

### Evidence

Collapsed FAQ answers use `max-height: 0`. That hides them visually while leaving
them in the accessibility tree and in find-in-page. A screen-reader user hears
every answer to every question continuously, with no indication of which are
collapsed. Ctrl-F matches invisible text.

### The fix

- Drive collapse from a state that removes the content from the accessibility
  tree when closed — `hidden`, or `display: none` at the end of the transition —
  rather than `max-height` alone.
- Wire the trigger properly: `aria-expanded` on the control, `aria-controls`
  pointing at the panel, panel id stable.
- Preserve the animation if it is currently animated; apply the hiding at
  transition end rather than losing the effect.

**Interaction with 4.1 (Plan 1):** the FAQ JSON-LD is built from
`useContent()` data, **not** from the DOM, so changing DOM visibility does not
affect structured data. Confirm that after your change — the two must stay
independent.

### Acceptance

- With all answers collapsed, the accessible name/description tree exposes **no**
  answer text; assert programmatically, not by eye.
- Find-in-page does not match collapsed answer text.
- `aria-expanded` flips correctly, and `aria-controls` resolves to the panel.
- Expanding still animates as before — screenshot or a recorded height sequence.
- `#faq-ld` still contains **all** FAQ answers regardless of collapse state.
- `sweep.js 18/18`.

---

## Scope boundary

`admin/content.php` (labels only), `admin/spectable-editor.js`, and the product
index and FAQ in `src/App.jsx`.

You are **not**: adding an accessibility framework or audit dependency (free
tooling for *checking* is fine; a runtime dependency is not), restyling anything
beyond focus indicators and the minimum labels require, changing the FAQ data
shape or `groupFaq`, or converting sort headers to anchors.

**Every change here must leave the posted-variable count and the form structure
of `content.php` untouched.** If an accessibility fix and the truncation
sentinel conflict, the sentinel wins and you escalate.
