# Prompt for the next session

Copy everything below the line into a fresh Claude Code session.

---

## What you are doing

You are continuing the IPC website release. Working tree is clean, `main` is at
`4d369d5` and pushed. **You are executing exactly one item: 4.21.** It is the
last item in Plan 1 and the highest-risk change in the whole set.

**Read these two files first, in this order, and follow them:**

1. `plans/GUARDRAILS.md` — binding. Scope discipline, hard prohibitions, the
   twelve invariants, how to arm the harness, the regression baseline, handback
   format.
2. `plans/PLAN-1-seo.md` — the §4.21 section is your specification. 4.3, 4.1 and
   `seo: []` in that plan are **already shipped**; do not redo them.

This is not an audit. Do not go looking for new problems. If you find one, append
it to `WHATS_LEFT.md` §2 with evidence and say so — do not fix it.

## 4.21 — no crawlable internal link graph

Navigation is `<button onClick>` throughout. Verified in the current tree:
**63 `<button` against 15 `<a href` in `src/App.jsx`.**

The mechanism, `Navbar` at `src/App.jsx:219`:

```js
const nav = (p, params = {}) => {
  setSearchParams({ ...params, page: p });   // line 234
  setMenuOpen(false);
  setOpenDropdown(null);
  setMobileOpen(null);
};
```

Call sites look like `src/App.jsx:295`:

```jsx
<button onClick={() => nav(null)} … aria-label="Insulation Products Corporation — Home">
```

`setSearchParams` is the module-level ref wired by `useSetSearchParamRef()`
(defined at `src/App.jsx:60`, called at `~8861`). The `"page"` key writes the URL
**pathname** through `pageToPath` (`src/App.jsx:14`); every other key is a search
param. `Footer` is at `~8310`.

Consequences: a crawler finds no `href` to follow, so pages beyond the homepage
may never be indexed; Ctrl/Cmd-click and middle-click do nothing, which is a real
cost on a catalog where buyers compare parts side by side; and right-click →
Copy Link Address is unavailable.

## The shape of the fix

One shared `PageLink` component, and route every *navigational* control through
it. Do not hand-convert call sites individually. The full requirements are in
`plans/PLAN-1-seo.md` — the ones people get wrong:

- **Let the browser handle non-plain clicks.** Return early, *without*
  `preventDefault()`, if any of `e.metaKey`, `e.ctrlKey`, `e.shiftKey`,
  `e.altKey` is set, or `e.button !== 0`. This is the entire point; getting it
  wrong reintroduces the bug in a form that looks fixed.
- **`href` must match what the router produces.** Reuse `pageToPath`. A wrong
  `href` is worse than a button — it becomes a crawlable 404.
- **Keep the single batched `setSearchParams` call.** The comment at
  `src/App.jsx:231–233` records that react-router v6 reads `prev` from the
  current URL, so splitting it into two calls loses updates.
- **Only page-changing controls become anchors.** Form submits, the search box
  and its clear control, dropdown/accordion/menu toggles including
  `setOpenDropdown`, and sort headers all stay `<button>`. If unsure, it stays a
  button.

Convert in this order, verifying after each: `Navbar` (incl. the logo at `295`
and the mobile menu) → `Footer` → hero/CTA buttons → product cards and category
chips.

## Styling risk

Existing nav buttons carry `background: none; border: none; cursor: pointer;
padding: 0` plus Tailwind classes (see `src/App.jsx:296–306`). An `<a>` has
different default `display`, `color` and `text-decoration`. Expect drift in the
flex header at `285–292` and the mobile menu. The suites that catch it are
`sweep.js` and `overflow.js` — the 375 px overflow class of bug has already bitten
this codebase twice.

## Acceptance

`plans/PLAN-1-seo.md` §4.21 lists eight criteria. Every one needs a pasted
measurement. The two most likely to be silently wrong:

- **Ctrl-click and middle-click open a new tab at the correct URL** and leave the
  current page's URL unchanged. Test explicitly.
- **Plain click still navigates client-side with no full reload.** Assert a
  module-scope sentinel survives the navigation (`_harness/plan1a.js` does this —
  copy the technique).

Also: every `href` must resolve to a real route. Crawl them all against the
`php -S` mirror, which applies the real rewrite.

Write the checks as `_harness/plan1b.js`, following `_harness/plan1a.js`'s shape.
Watch a new check fail before you fix what it covers.

## Environment notes learned the hard way

- **Arm the harness** per GUARDRAILS §4.2: `php _harness/setpw.php`, then three
  `php -S` instances on 8123/8124/8125 launched via the PowerShell tool's
  `Start-Process` (the Bash guard blocks `php -c … -S`). Delete
  `_harness/site/admin/config.local.php` when you finish.
- **Re-sync the mirror after every build** — `rm -rf _harness/site/assets`, copy
  `dist/.` and `admin/*.php|*.js` in, restore `_harness/pristine/*.json` — or you
  will test stale code and get a false pass.
- `npm run dev` now serves the real `data/` folder via a Vite middleware in
  `vite.config.js` (Plan 0). Use it; `plan1a.js` runs against `:5173`.
- **`dist/` is gitignored but partially tracked.** Committing a rebuild means
  `git rm --cached` the old hashed asset, delete it from disk, and
  `git add -f` the new one plus `dist/index.html`. Plain `git add dist/...`
  fails.
- **The Bash guard blocks** `$VAR` expansion, `$(...)`, `php -r`, `node -e`,
  `python -c`, and `for f in …; do …$f`. Write script files instead.
- **The browser tool's console log accumulates across navigations.** Open a fresh
  tab before asserting "zero console errors".
- A stale `.git/index.lock` from a crashed process appeared once. Check for a
  running `git` process before removing it.

## Still open, not yours to decide

`SITE_ORIGIN` in `src/App.jsx` is `https://www.insulationproducts.com`, matching
`sitemap.xml`, `robots.txt` and `index.html`. Keagan has been asked to confirm
`www` vs the apex and has not answered. Do not change it; do not block on it.

## Handback

GUARDRAILS §8 format: Fixed (with proof) / Not fixed and why / Escalations /
Records corrected / Regression state. State plainly what you did not do.

Update `WHATS_LEFT.md`: 4.21 into §1b, struck in §2, evidence in a new §4f.
Append-only — supersede, never silently rewrite.

Do not commit or push unless asked.
