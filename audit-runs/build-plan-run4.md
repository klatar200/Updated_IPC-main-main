# Build Plan — Run 4

**Source:** `audit-runs/audit4.md` (5 issues: 1 High, 2 Medium, 2 Low)
**Fixable here:** 4. **Human-required:** 1 new (D-03) + 3 carried (A-16, A-17, C-06).
**Scorecards:** `audit-runs/scorecards-run4.md`

## Issue IDs

| ID | Title | Sev | Sprint |
|---|---|---|---|
| D-01 | Two owner-editable URL fields reach `href` unfiltered | High | 1 |
| D-04 | `add.php` reads a `photoUrl` field its form never renders | Low | 1 |
| D-05 | `add.php` skips a heading level | Low | 1 |
| D-02 | `plan10-repalette`'s `default` arm is permanently red | Medium | 2 |
| D-03 | `react-router-dom` advisories, no in-range patch | Medium | — (No) |

Two sprints: finish the class A-01 opened, then re-base the one stale guard.

---

## Global guardrails

Runs 1–3's guardrails carry over. Three additions, each earned by this run:

1. **A fix for a class is not done until every member of the class is
   enumerated.** D-01 exists because A-01 fixed the field that raised it and not
   the other two of its kind. Any fix to a sink must be accompanied by a list of
   every sink of that shape, and each entry marked fixed, already-safe, or
   not-applicable with the reason.
2. **A guard is not proven by the payload being blocked — it is proven by the
   same payload being live somewhere the guard is absent.** Every D-01 criterion
   is measured with a control.
3. **Re-baselining a snapshot suite requires the delta to be named first.**
   Regenerating a baseline that a regression is hiding in launders the
   regression. The per-class delta goes in the audit before the file is
   rewritten, and the new file records what it was re-based over.

---

## Sprint 1 — Close the D-01 class, and two nits in `add.php`

**Goal:** No owner-editable string can become a live `href` with a scheme the
browser will execute, and the owner is told when a URL is rejected instead of
watching the link silently vanish.

**Issues:** D-01, D-04, D-05

**Tasks**

1. `src/App.jsx` — add `isSafeLinkUrl()` next to `isSafeExternalUrl()`. Same
   shape, but it also accepts a **same-origin path** (`/…`, not `//…`), because
   both new sinks legitimately hold `/pdfs/x.pdf`. Guard `site.catalogPdfUrl`
   (`:12307`) and `svc.brochure.url` (`:11731`) with it. When the value is
   unsafe the link is not rendered at all — the same behaviour `FooterSocial`
   already has for an unsafe channel.
2. `admin/settings.php` — reject a `catalogPdfUrl` that is neither a `/` path
   nor `http(s)://`, with a message naming the field, following `edit.php`'s
   F6 precedent (block the save, keep the typed value on screen to fix).
3. `admin/content.php` — same validation for every `brochure_url` row, naming
   the row so the owner knows which card.
4. `admin/add.php` — replace the dead `post_str('photoUrl')` with `''` and a
   comment naming the Upload Image page as where a photo is actually set.
5. `admin/add.php` — demote the skipped `h3` to `h2`, or promote nothing: pick
   whichever keeps the rendered size unchanged.
6. Add a `lint.php` drift check: every `href={…}` in `App.jsx` that is fed by a
   `site.*` or content-derived string must be inside a guard. Anchored on the
   two fields by name, so re-introducing an unguarded one fails the lint.

**Sprint guardrails**
- The client guard is the security fix; the server validation is the usability
  half. Neither substitutes for the other — data already on disk predates any
  server-side check.
- `isSafeExternalUrl` is not to be widened to accept paths. Social channels are
  external by definition and a `/`-path there is a mistake; a second function is
  correct, not duplication.
- Do not touch `additionalPdfs` — F6 already covers it, and its regex is
  stricter than the new one on purpose (`.pdf` required).
- Every payload check needs the `social_*` control alongside it.

**Definition of done**
Through the real admin forms: a script-scheme value in `catalogPdfUrl` and in a
`brochure_url` is refused at save with a named message; the same value written
directly into `data/` renders no link at all on `/` and `/services`; the
`social_*` control still behaves as A-01 left it; `plan5-social`, `plan9-*` and
the contact suites still pass; invariants and `lint.php` green with the new
check proven to fail when the guard is removed.

---

## Sprint 2 — Re-base the one stale guard

**Goal:** `plan10-repalette` is green, and the arm that catches a repalette
regression is armed against today's site rather than August 10th's.

**Issues:** D-02

**Tasks**
1. Confirm the delta is fully explained (already recorded in `audit4.md`) and
   that both live arms and every gradient pass unchanged.
2. Re-capture with `--save-baseline` on the **unmodified** tree — before
   Sprint 1's `App.jsx` edit lands in the bundle, or after, but never with a
   dirty working tree.
3. Rewrite the baseline's `_note` so it says what it was re-based over and when,
   and that a re-base is a deliberate reviewed act rather than a way to make the
   suite quiet.

**Sprint guardrails**
- The re-baseline must be taken from a tree that builds clean and whose other
  32 suites pass. A baseline captured over a broken build is worse than a stale
  one.
- `dashboard`, `contact` and `industries` were byte-identical before the
  re-base and must still be byte-identical after it. If the re-base changes
  them, something moved that the delta analysis missed and the re-base is wrong.
- Prove the arm still bites: perturb a brand colour, confirm the suite fails,
  restore.

**Definition of done**
`plan10-repalette` exits 0 at 33/33; the three previously-identical states are
still identical; the arm demonstrably fails on an injected change; the new
baseline's note explains itself.

---

## Not scheduled (human required)

| ID | Why | What is needed |
|---|---|---|
| D-03 | The only patched version is a major upgrade (`>= 7.18`) of the routing library under a 12,800-line SPA with a hand-written shim. Measured as unreachable today: no SSR, and every `navigate()` target is a literal page key. | A decision to accept the advisories or to schedule the v7 upgrade with a full re-verification. |
| C-06 | Every honest fix costs more than the defect. | Which of the three to accept. |
| A-16 | Behaviour is defensible; no user-visible effect. | Whether an untouched empty field should be written on save. |
| A-17 | Five products need real photography. | Product photos from the owner. |
