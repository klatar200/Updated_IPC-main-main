# PLAN-6 — widening what the owner can change without a developer

Three items, from the review of the admin's editable surface on 2026-08-07.
They are independent and can ship in any order, **except** that items 1 and 3
both add fields to `admin/content.php` and therefore both move the posted
variable count. Read §0 before either.

Read first: `CLAUDE.md`, `plans/GUARDRAILS.md`, `WHATS_LEFT.md`.

Item 2 of that review (marketing imagery) is **not** in this plan — it needs a
decision on scope first, and it is the only one of the four that may require
photography rather than code.

---

## 0. The shared constraint: `content.php` posts 421 variables

Invariant 6. `form_complete` is the **last** field in the form and is the
`max_input_vars` truncation sentinel, enforced *positionally*. Three things
assert the number 421:

| where | what it asserts |
|---|---|
| `_harness/plan2-formlast.js` | `form_complete` is last of 421 named controls in the **rendered DOM**, including after the editor adds and removes rows |
| `_harness/plan4-admin.js:44` | `POSTED_BEFORE = 421` — the count did not change across the accessibility work |
| `_harness/plan2-trunc.js` | a genuinely truncated POST against a real `max_input_vars=100` server is caught |

Both items below add fields. **The number will move, and that is allowed — what
is not allowed is moving it silently.** For each item:

1. Measure the new count in the rendered DOM before touching the assertions.
2. Update `POSTED_BEFORE` and the `plan2-formlast` expectation **in the same
   commit as the field**, with the new number in the commit message.
3. Re-run `plan2-trunc.js` — it must still catch a truncated POST at the new
   count. This is the one that actually matters; the other two are bookkeeping.
4. New fields go **above** `form_complete`. Never after it.

`public/.user.ini` sets `max_input_vars = 10000`, so headroom is not the issue.
The sentinel is.

---

## 1. Product families are hardcoded in three places — ✅ SHIPPED 2026-08-07

### Evidence (measured 2026-08-07)

The eleven category names exist as three separate literals:

| file | symbol | drives |
|---|---|---|
| `src/App.jsx:5567` | `FAMILY_ORDER` | catalogue sidebar grouping and order, category chips, dashboard filter |
| `admin/add.php:90` | `$partTypes` | the Part Type dropdown when adding a product |
| `admin/edit.php:222` | `$partTypes` | the same dropdown when editing |

```
App.jsx FAMILY_ORDER: 11
add.php  $partTypes  : 11
edit.php $partTypes  : 11
all three identical  : True
partTypes in catalog : 10, none outside the list
```

They agree **today**. Nothing makes them agree tomorrow, and this is exactly the
class of defect `_harness/copydrift.js` already exists to catch for
`$COPY_GROUPS` vs `COPY_DEFAULTS`.

Two consequences, and the second is the one the owner feels:

- A product whose `partType` is not one of the eleven falls into `"Other"` on
  the public site. `edit.php:300-305` already handles this defensively — it
  keeps an unrecognised value as a selected option so saving does not silently
  reset the category — so the drift would be *invisible* in the admin while
  being visible on the site.
- **Adding a genuine new product line needs a code change and a redeploy.** For
  a distributor, taking on a new material is routine business, and it is the one
  place where growth hits a wall the owner cannot get past.

### The fix

Make the list data, in **one** place, with the admin editing it.

`content.json` is the right home rather than `site-info.json`: it is catalogue
structure, it is a repeatable ordered list, and `content.php` already renders
exactly that shape. Add a `productFamilies` section to `$SECTIONS` with one
field (`name`), so ordering comes free from the existing row reorder control.

Then:

- `App.jsx`'s `FAMILY_ORDER` becomes a **default**, read through `mergeContent`
  like every other section. Invariant 3 applies unchanged: an empty array is a
  deletion, not "unset" — but see the guard below, because for this list an
  empty array is not a legitimate state.
- `add.php` and `edit.php` read the same list from `load_content()` instead of
  their own literals. The two PHP literals are **deleted**, not synchronised.
- `edit.php`'s unrecognised-value fallback stays exactly as it is. It becomes
  more important, not less: the owner can now rename a family out from under a
  product.

### Non-negotiable constraints

- **An empty family list must not empty the catalogue.** If the owner deletes
  every row, the site must fall back to the hardcoded default. This is the one
  place the plan deliberately departs from invariant 3, and the departure needs
  its own inline comment saying so, because it looks like the `mergeContent` bug
  being reintroduced.

  > **CORRECTED 2026-08-07 during execution.** This paragraph said an empty list
  > would render "42 products under `Other`". **It does not** — grouping is on
  > each product's own `partType`, so every heading still renders, and an
  > assertion built on that story passed with the fallback removed. The real
  > cost, measured: `openFamilies` initialises to
  > `new Set(order.concat(["Other"]))`, so an empty order leaves every accordion
  > CLOSED — **41 reachable product links become 0** — and the curated order
  > degrades to catalogue order. The fallback is still right; the reason was
  > wrong.
- **Renaming a family does not rename products.** `partType` is stored per
  product; renaming `"Tape"` to `"Tapes"` orphans every taped product into
  `"Other"`. The editor must say how many products use a family, next to its
  row, and warn before saving a rename that orphans any. Do **not** auto-migrate
  the catalogue — a silent bulk write to `products-all.json` from a content save
  is exactly the kind of thing this codebase has been removing.
- `"Other"` stays reserved and is not editable (`SIDEBAR_EXCLUDED`,
  `App.jsx:5614`).
- §0 applies: 11 new fields. Predicted 421 → 432; **measured 424 → 435** (item 3 had already moved it by three). Measure, don't assume — which is the point.

### Acceptance

New suite `plan6-families.js`, plus one addition to `lint.php`:

- the three literals are down to **two** — a source scan finds `$partTypes` in
  neither `add.php` nor `edit.php`. **Not one**: a single copy across PHP and JS
  is not achievable without a build step, so the pattern is `copydrift`'s —
  two defaults, and `lint.php` fails when they disagree or when a third returns
- a family added in the admin appears in the public sidebar, in the position it
  was placed, without a rebuild
- reordering rows reorders the public sidebar
- deleting **every** row falls back to the 11 defaults and the catalogue still
  groups correctly — asserted, because this is the failure that would matter
- renaming a family in use warns with the affected product count and does not
  write to `products-all.json`
- a product whose `partType` matches nothing still renders under `"Other"` and
  still keeps its value in the edit dropdown
- `plan2-formlast` and `plan2-trunc` green at the new count
- **mutation-proven**: reinstate one PHP literal, the drift check goes red

---

## 3. The auto-reply makes a promise the owner cannot change — ✅ SHIPPED 2026-08-07

### Evidence

`public/contact.php:495-521` builds two auto-reply bodies. Everything around the
promise is already owner-editable — business name, phone, fax, email, hours and
address all interpolate from `site-info.json` — but the commitment itself is a
string literal:

```
"Our sales team will review your request and respond within one business day —\n"
"often the same day for in-stock items.\n\n"
```

and, for the plain message form:

```
"Our team will respond within one business day.\n\n"
```

That is a customer-facing service-level promise the owner cannot soften over a
holiday shutdown, a plant closure, or a week when his estimator is out. It is
also the kind of sentence a business genuinely wants to tune.

`contact.php` currently reads **only** `site-info.json` (`ipc_site_info()`,
line 28). It has no content reader at all.

### The fix

- Add `ipc_content()` alongside `ipc_site_info()`: same shape, same failure
  behaviour, reading `data/content.json`.
- Add three fields to the existing `contactForm` copy group in `content.php`'s
  `$COPY_GROUPS` — `autoReplyRfqPromise`, `autoReplyMsgPromise`, and
  `autoReplySignoff` — with the current text as the defaults.
- `contact.php` reads them, falling back to the current literals.

**Editable is the prose only.** The request summary block (part number,
material, quantity, required-by) stays hardcoded: it is data, not copy, and a
templating syntax in an admin textarea is a way to produce broken emails.

### Non-negotiable constraints

- **A missing, unreadable or corrupt `content.json` must not stop a lead.**
  `contact.php` runs for every enquiry; the auto-reply is best-effort already
  (`@mail`, no error check) and the *sales notification* must fire regardless.
  Fall back to the literals, never fatal. `plan3-autoreply.js` already asserts
  the notification always fires — extend it, don't replace it.
- **Anything reaching a mail header goes through `hdr()`.** Invariant 10 and
  4.16: `company_name` was CRLF-stripped for exactly this reason and a real
  `Bcc:` was produced in testing. These new fields are body-only by design —
  if any of them is ever used in a subject, it gets `hdr()`.
- **`s()` still does not HTML-escape.** Invariant 10. The destination is a
  `text/plain` email; escaping belongs at the render boundary.
- The copy defaults must be added to **both** `content.php`'s `$COPY_GROUPS` and
  `App.jsx`'s `COPY_DEFAULTS`, or `copydrift.js` fails — which is the point of
  it. 96 → 99 fields.
- §0 applies: 3 new fields, count moves 421 → 424 (or 435 with item 1).

### Acceptance

Extend `plan3-autoreply.js`:

- the promise text in a delivered auto-reply matches what is set in the admin,
  for both the RFQ and the message form — asserted against the captured mail,
  not the source
- with `content.json` **deleted**, and again with it **corrupt**: the sales
  notification still fires, the auto-reply still sends, and the body carries the
  default text
- a CRLF injected into any of the three fields cannot produce a header — no
  `Bcc:`, no `Cc:`, in the captured message
- the existing per-recipient cap and the Gmail-normalisation assertions stay
  green
- `copydrift.js` green at 99 fields; `plan2-formlast`/`plan2-trunc` green at the
  new count

---

## 4. Social platforms are fixed at five — ✅ SHIPPED 2026-08-07

### Evidence

`site-info.json` has exactly five: `twitter`, `facebook`, `linkedin`, `youtube`,
`pinterest`. They are hardcoded in three coordinated places, all added by 4.11b:

| file | symbol |
|---|---|
| `src/App.jsx:9071` | `SOCIAL_CHANNELS` — key, label, inline SVG path |
| `src/App.jsx:4805-4809` | `SITE_CLEARABLE` — so each can be cleared |
| `admin/settings.php` | `social_twitter` … `social_pinterest` inputs |

No Instagram, no TikTok. Adding one is a code change. Low urgency for an
industrial distributor — but it is a hard limit on a settings page that has none
anywhere else.

### The fix

**Add Instagram and TikTok as two more fixed fields.** Not a generic
"platform + URL" repeater.

The repeater is the tempting design and it is the wrong one here. The icon is
the whole point of these links — a row of recognisable marks in the footer — and
an arbitrary platform has no icon, so a repeater needs a generic-globe fallback
that looks broken next to five real marks. Seven named platforms with real SVGs
covers every channel this business plausibly uses, and the cost of adding an
eighth later is the same three-file change it is today, which is small and
already documented.

Per platform: one entry in `SOCIAL_CHANNELS` with a real SVG path and an
accurate accessible label, one `SITE_CLEARABLE` entry, one field in
`settings.php`. `settings.php` is not under the `form_complete` sentinel, so
§0 does not apply.

### Non-negotiable constraints

- **All seven cleared still renders no container**, asserted as element
  *absent*, not element-empty. This is the NB4 half of 4.11b and a "has no
  children" check passes against an empty row that still eats 40 px of footer.
- Each new icon needs a real accessible name in the AX tree and
  `rel="noopener noreferrer"`, matching the existing five.
- The new keys go into JSON-LD `sameAs` alongside the others, and are omitted
  when empty (NB4).
- Icon SVG paths must be the platforms' own marks. Do not approximate.

### Acceptance

Extend `plan5-social.js`:

- 7 icons render when all 7 are set; 7 accessible names read from the real AX
  tree
- clearing any subset renders exactly the remainder, in order
- clearing **all seven** renders no container — asserted absent
- `rel="noopener noreferrer"` on all seven
- focus ring driven by **real Tab presses** — Chromium will not match
  `:focus-visible` for programmatic focus, which cost a false pass before
- JSON-LD `sameAs` contains exactly the non-empty ones
- `_harness/invariants.js` still 17/17 — `SITE_CLEARABLE` is invariant 4's
  allow-list and this touches it

---

## Scope boundary

In scope: `src/App.jsx`, `admin/content.php`, `admin/add.php`, `admin/edit.php`,
`admin/settings.php`, `public/contact.php`, `_harness/*`.

Out of scope, and deliberately:

- **`data/*.json`, `pdfs/`, `uploads/`.** Live customer state. Item 1 in
  particular must not bulk-write `products-all.json` on a family rename.
- **Marketing imagery** (item 2 of the review) — needs a scope decision first.
- **`DEPLOY_READINESS_v2.md`** — frozen.
- **The `src/pages/` `src/components/` `src/lib/` extraction** — not resumed.
- **`SITE_ORIGIN`, sitemap priorities, the `noreply@` sender.** These are not
  content. Exposing them adds ways to break email delivery and canonical URLs
  for no business benefit. The `noreply@insulationproducts.com` literal appears
  twice in `contact.php` and should become one constant the day the domain
  changes — that is a config change, not an admin field.

## Status

| item | state |
|---|---|
| 4 — social platforms | ✅ **shipped** 2026-08-07. `plan5-social` 31 → 35. See `WHATS_LEFT.md` §1b. |
| 3 — auto-reply copy | ✅ **shipped** 2026-08-07. `plan3-autoreply` 10 → 22, posted count 421 → 424. Third field is `autoReplyNotice`, not the `autoReplySignoff` this plan named — a temporary-closure line is worth more than renaming the urgent-contact lead-in. See `WHATS_LEFT.md` §4m. |
| 1 — product families | ✅ **shipped** 2026-08-07. New suite `plan6-families` 13/13, posted count 424 → 435. Two defaults remain (PHP + JS) held together by a new `lint.php` drift check — one copy across two languages needs a build step. See `WHATS_LEFT.md` §4n. |

## Order I would take them

**4, then 3, then 1.** Ascending risk and ascending blast radius: item 4 touches
a footer row, item 3 touches an email that already fails soft, item 1 restructures
how the catalogue groups itself. Doing 4 first also re-exercises `plan5-social`'s
absent-container assertion before anything harder depends on that pattern.

Item 1 is the one worth doing even if the other two are dropped — it is the only
one of the three that is currently a *latent defect* (three literals that can
drift) as well as a missing feature.
