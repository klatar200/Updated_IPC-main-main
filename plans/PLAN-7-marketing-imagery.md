# PLAN-7 — marketing imagery

Item 2 of the 2026-08-07 admin-surface review, the one held back because it
"needs a decision on scope first, and is the only one of the four that may
require photography rather than code" (`plans/PLAN-6-admin-surface.md`).

Measured 2026-08-07. **It does not require photography.** The customer's own
photographs are already in the tree, already deploy, and are painted on no
route. The work is wiring, and one harness gap that has to close first.

Read first: `CLAUDE.md`, `plans/GUARDRAILS.md`, `WHATS_LEFT.md` §2.

Three items. ~~**Item 1 must land before item 2** — it is the measurement that
makes item 2 checkable, and without it the existing contrast harness reports a
passing number for text sitting on a photograph.~~ Item 3 is independent.

⚠️ **AMENDED 2026-08-07, after the treatments in §2 were built and
photographed.** Item 1 is **no longer a prerequisite** — the hero treatment that
survived rendering puts no ink on a photograph, so the harness gap is never
reached. Item 1 remains worth landing on its own merits and no longer blocks
anything. The full amendment, including two conclusions in §2 that rendering
disproved, is at the end of §2. Read it before §2's scrim arithmetic.

---

## 0. What is actually there

`src/App.jsx` contains **four** `<img>` elements in 9,900 lines, and three of
them are the logo: the navbar logo (`:402`), the product detail photo (`:6514`),
the logo again inside the branded photo placeholder (`:6544`), and the footer
logo (`:9334`). `grep -n 'images/' src/App.jsx` returns **nothing**. The
homepage, About, Services, Industries, FAQ, Contact and Privacy pages paint no
photography at all.

Meanwhile `public/images/site/` holds 22 files, 1.1 MB, referenced by nothing
in `src/`, `data/`, `admin/`, `public/` or `index.html`. They ship to the server
on every deploy. `WHATS_LEFT.md` §2 already settled *keeping* them; it did not
consider using them.

### The originals are bigger than the shipped copies

4.32 re-encoded every image with a **1000 px cap on the long edge**. That was
correct for a file painted nowhere — there is no paint size to target, so the
pipeline used a blanket bound. The moment a file is painted the bound becomes a
constraint, and **it is free to undo**: the originals are in git history at
`febc0b7`, untouched.

| file | original (`febc0b7`) | shipped today | scene |
|---|---|---|---|
| `Slide1.png` | **1948 × 414** | 1000 × 213 | product spread on blue — widest copy |
| `main-banner-1349x414.jpg` | **1349 × 414** | 1000 × 307 | same scene, tighter crop |
| `Marker-Sample-2.jpg` | **2400 × 1600** | 1000 × 667 | printed markers and sleeves |
| `Front-Cover.jpg` | **1700 × 2200** | 773 × 1000 | the printed catalog cover |
| `staff.jpg` | 726 × 408 | 726 × 408 | the team, outside the building |
| `IPC-Building.jpg` | 425 × 281 | 425 × 281 | the facility |

So a 1440-wide hero has a **1948 px** source available, not the 1000 px one on
disk. Nothing needs to be shot and nothing needs to be upscaled.

### Which of the 22 are usable

Judged by opening every one, not by filename.

**Use (6).** `Slide1.png` / `main-banner-*.jpg` (the same scene), `staff.jpg`,
`IPC-Building.jpg`, `Marker-Sample-2.jpg`, `Front-Cover.jpg`.

**Don't use (16).** `staff-image.png` is the *same photograph* as `staff.jpg`
with white padding and a drop shadow baked into the pixels — `staff.jpg` is the
full-bleed copy and is strictly better. `featured-category-1/2/3.jpg` are
360 × 162 in the original too, so they cap at 360 px wide and cannot fill a card
on a 2× screen. `Heat-Shrink-Tape-Product-photo-2.jpg` carries a heavy vignette
and dated processing. The remaining eleven (`conduit-drawing*`, `coulplings*`,
`id-markers`, `spiralwrap*`, `tubingkits-*`, `download`, `header-logo`) are
194–350 px line drawings and thumbnails — fine as inline diagrams if a page ever
wants one, too small for a marketing slot.

That is the honest count: **six usable images, not 27.** The other sixteen stay
where they are under §2's keep decision.

---

## 1. The harness will lie about text on a photograph — close this first

`_harness/backdrop.js` is the shared contrast core behind `brandtext.js`,
`plan5c-eyebrow.js` and `plan5c-brandink.js`. Its layer walk is:

```js
for (const layer of splitTop(bi)) {
  const g = parseLinear(layer);
  if (!g) continue;              // ← a url() layer lands here
  ...
}
```

`parseLinear` matches `^linear-gradient\((.*)\)$`. A `url(...)` layer returns
`null` and is **silently skipped**, so the walk composites the scrim over
whatever is *below* the photo and reports a number for a background the visitor
never sees. Today that branch is unreachable — no element has a raster
background. Item 2 makes it reachable on the highest-traffic element on the
site.

### 1a. Make the skip loud

`__ipcBackdrop` returns a third value: whether it skipped a layer it could not
evaluate. Every existing suite fails if it ever sees one. This is the guard, and
it is worth having on its own merits — it closes the hazard whether or not any
image ever ships.

### 1b. Add a pixel primitive

Gradient maths cannot answer "what is behind this glyph" over a photograph.
Screenshot the ink rect (`inkRect()` already exists and already solves the
box-vs-ink error) and read the real pixels:

```
__ipcInkBox(el)  ->  the ink rect in page coordinates
                     (node side clips a page.screenshot to it)
worstPixel(png, ink, mode)  ->  lightest / darkest pixel actually painted
```

Score the ink against the **worst** pixel under it, not the mean. A mean passes
a white headline over a photo that is 90 % dark and 10 % chrome highlight; the
headline is illegible exactly where the highlight is.

### 1c. Mutation proof

Revert the scrim change from item 2 (back to the 0.72 → 0.50 ramp) with the
photo in place and the suite must fail. If it passes, the pixel read is not
reaching the photo and the whole item is theatre.

---

## 2. Four slots, and the hero already has the scrim for it

### The hero was designed for a photograph

`Hero()` (`src/App.jsx:1449`) paints **two stacked gradients**:

```css
linear-gradient(135deg, rgba(20,20,20,0.72) 0%, rgba(20,20,20,0.50) 100%),
linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent-2) 55%, var(--brand-accent) 100%)
```

The top layer is a **dark scrim over the brand gradient**. A scrim has exactly
one purpose — keeping ink legible over something busy underneath — and a flat
brand gradient does not need one. Whoever built this expected a photo in that
slot and never got one.

So the photo goes in as a third, bottom layer. But **the ramp is the problem**,
not the photo:

| scrim α | white | white @ 75 % (subhead) | `#00bef2` on the proof card |
|---|---|---|---|
| 0.72 (left end) | 7.36 | 5.00 | 2.82 |
| 0.50 (right end) | **3.48** | **2.67** | **1.43** |

Those are worst-case bounds — a pure-white pixel under the scrim. The right end
of the ramp does not carry white body text over a photograph: the subhead lands
at **2.67:1** against an AA bar of 4.5.

**The fix is to flatten the ramp to 0.72 across the width**, and it makes every
ink on the hero *better than it is today*:

| ink | today, worst end | with photo + flat 0.72 | |
|---|---|---|---|
| `#ffffff` headline | 6.25 | **7.36** | ↑ |
| white @ 75 % subhead | 4.27 | **5.00** | ↑ |
| `#00bef2` proof stat | 2.47 | **2.82** | ↑ |

Every value improves, in the worst case, against a pure-white pixel. The real
banner has no pure-white region, so measured numbers will be better again —
which is what item 1 is for.

Note the third row is below 4.5 in *both* columns. That is the open
`brand-accent-on-dark-surfaces` item in `WHATS_LEFT.md` §2, which is on a
printed ratchet and needs a colour decision from Keagan. **This plan must not
be read as fixing it** — it moves it in the right direction and must not be
allowed to move it back.

### ⚠️ AMENDED 2026-08-07 — the full-bleed hero was built and rejected

Everything above this heading is kept as written. It was reasoned from CSS, and
three of its conclusions did not survive being rendered. Four hero treatments
were implemented against the real page, built, screenshotted at 1440 and 375 and
then reverted (`_harness/homeshot.js`, artifacts in `_harness/out/plan7/`).

1. **The best photograph is a photograph *of text*.** `Marker-Sample-2.jpg` is a
   spread of custom-printed sleeves — "TRANSDUCER END", "CAUTION: RF SHOCK
   HAZARD", "INSULATION PRODUCTS CORPORATION". Setting the headline over it is
   typography over typography and no scrim fixes that. A neutral scrim heavy
   enough to protect the ink also drains the navy out of the page.
2. **The banner images cannot fill a hero.** `Slide1.png` and
   `main-banner-*.jpg` are **4.7:1** letterbox strips; the hero is **1.7:1**.
   `cover` keeps the middle **37 %** and upscales it **2×**. Legible and on
   brand, but what survives is blue-grey texture — §0's resolution table is
   necessary and not sufficient, because it did not check aspect.
3. **So the scrim arithmetic above, while correct, is moot.** The treatment that
   won puts the photograph in the hero's **already-empty right column**, below
   the proof cards, where no ink crosses it. The scrim ramp is untouched.
   `plan5c-brandink` and `plan5c-eyebrow` were re-run against that build and
   hold at **18 and 18** — unchanged. **This design adds no contrast debt.**

**Item 1 is therefore no longer a prerequisite for item 2** — nothing is going
behind text. It is still worth landing: a silent skip in the one file three
suites trust is a defect whether or not this plan triggers it. It simply stops
being urgent, and stops blocking.

Two further measurements the plan did not anticipate:

- **`IPC-Building.jpg` has a white border baked into the pixels**, the same
  defect as `staff-image.png`. At half-width it upscaled and the frame showed;
  at one-third it lands near 1:1 and the crop removes it. The band's 2:1 column
  split is forced by the source file, not chosen.
- **`staff.jpg` and `IPC-Building.jpg` are at their resolution ceiling.**
  Painted 845 × 300 from a 726 × 408 source, and 411 × 300 from 425 × 281 — the
  first is already upscaling 1.16× at 1×. They are fine at the sizes shown and
  cannot go larger or retina. `Marker-Sample-2.jpg` has 4× headroom.

Measured cost of the shipped set, encoded at paint size from the `febc0b7`
originals: **199 KB total** (110 + 61 + 29), against a 338 KB JS bundle and the
0.97 MB `images/site/` already shipping unrequested. One defect in the mockup to
fix before shipping: the hero image is hidden on mobile with a class, and **a
hidden `<img>` is still downloaded** — needs a `<picture>` with a `min-width`
source, or no element at all below the breakpoint.

### The slots

| # | where | image | notes |
|---|---|---|---|
| 1 | `Hero()` `:1449` **right column, below the proof cards** | `Marker-Sample-2.jpg` @ 1170 × 660 | ~~background, scrim flattened to 0.72~~ — see the amendment. Fills space that was already empty; no ink crosses it |
| 2 | **`HomePage()` band between `Features` and Markets** | `staff.jpg` + `IPC-Building.jpg`, 2:1 | moved from About: it breaks the twelve-identical-cards run at exactly the point the repetition happens. About can link to it |
| 3 | `AboutPage()` sidebar | `IPC-Building.jpg` | 425 px original caps the paint at ~425 |
| 4 | `ServicesPage()` `:8714`, printing & marking | `Marker-Sample-2.jpg` @ 2400 px | the sharpest image in the set |
| 5 | footer `:9412`, beside `catalogPdfUrl` | `Front-Cover.jpg` thumb | the link is bare text today; the cover is the catalog's own artwork |

Every one except the hero is an `<img>` with `loading="lazy"` and explicit
`width`/`height` — the CLS trap from 4.32 does not apply here because these are
fixed, known files whose intrinsic dimensions we have, unlike the product photo
whose dimensions live in owner-editable data.

### Re-encode against the paint size

Item 2 changes what "painted" means for six files, so 4.32's pipeline has to run
again for them, from the `febc0b7` originals, targeting the new paint sizes at
1× and 2×. Same rules as 4.32, unchanged: PSNR-scored against the original at
the output resolution, 38 dB floor for painted photos, **no crop, no retouch, no
renamed file**. Expect the tree to grow — that is correct, they are painted now.
Budget it explicitly and record the new `du -sh`.

---

## 3. Give the owner the controls

The point of the review item was not "put photos on the site". It was that the
owner has photographs he cannot put anywhere. Slots alone do not fix that —
they fix it for the six files *I* chose.

### 3a. Every slot reads a URL from owner data

Each of the five slots takes its URL from `content.json` (page copy) or
`site-info.json` (footer), defaulting to the shipped file. Clearing a field
removes the image and its layout; it does not re-seed the default. That is
invariant 3 (`mergeContent` treats empty as deletion) and invariant 4
(`mergeSiteInfo` drops blanks) — both already hold, so this is a new field, not
new merge behaviour.

**Cost: this moves the posted-variable count.** `plans/PLAN-6-admin-surface.md`
§0 is the procedure and it applies unchanged — `POSTED_BEFORE` is **435** today,
new fields go **above** `form_complete` (invariant 6), and `plan2-trunc.js` must
be re-run against the real `max_input_vars=100` server at the new count. That
re-run is the one that matters; the other two assertions are bookkeeping.

### 3b. A site image library

`admin/upload-image.php` already solves every hard part — extension **and**
sniffed MIME, SVG excluded as a script vector, non-user-controlled filenames,
`.htaccess` written into the upload dir at creation, `realpath()` containment,
audit log, and `image_in_use()` reference counting before a delete. It is
scoped to one product via `?sku=`.

Generalise it: a picker that lists `uploads/images/` **and** `public/images/site/`
as thumbnails, and writes the chosen path into whichever field opened it. The
owner clicks a photograph instead of typing `/images/site/Marker-Sample-2.jpg`
and getting the capitalisation wrong — which is not hypothetical, four
`photoUrl` values shipped with exactly that defect and put a placeholder on 4 of
42 product pages.

This is a second consumer of existing machinery, not new security surface. The
one genuinely new rule: **the picker may offer `images/site/` but must never
delete from it.** That folder is build output today and becomes referenced
customer photography under this plan; `uploads/images/` remains the only
writable half.

---

## 4. Costs and consequences, stated up front

- **`public/images/site/` joins the do-not-re-upload list.** §2's keep decision
  already flagged this as "the one operational consequence"; item 2 triggers it.
  After first deploy, that folder is referenced by rendered pages and reachable
  from the admin picker. Treat it like `data/`, `pdfs/` and `uploads/`.
- **NB1's cache split already covers it.** Owner-facing images get
  `max-age=3600`, not the `/assets/` immutable year, so a replaced photo reaches
  returning visitors within the hour.
- **The tree gets bigger.** 4.32 landed at 2.7 MB with a 1000 px cap on
  unpainted files. Six of those become painted at up to 2400 px. The number goes
  up and should; what is not acceptable is it going up unmeasured.
- **`sitemap.php` is unaffected** — it reads `products-all.json` and emits no
  image URLs. If image sitemap entries are ever wanted that is a separate item.
- **Not in scope:** the sixteen unusable files stay unreferenced under §2's keep
  decision; `_unmatched/adhesiveLined.webp` stays unused; no new photography;
  no `src/pages/` extraction; `data/*.json` is not edited.

---

## 5. What needs a decision before item 2 starts

Items 1 and 3b need nothing — 1 closes a hazard that exists today and 3b is a
generalisation of code already written. Item 2 is where taste enters:

1. **The hero photo.** `Slide1.png` (1948 px, wider framing) or
   `main-banner-1349x414.jpg` (1349 px, tighter crop of the same scene)? Both are
   the same shoot. I would take `Slide1.png` for the resolution.
2. **The five slots.** Are these the right five? Slot 5 (catalog cover in the
   footer) is the most arguable — it only appears at all when `catalogPdfUrl` is
   filled in, which it is not today.
3. **The flat 0.72 scrim.** It makes the hero measurably more legible and
   measurably flatter. That is a real aesthetic cost, and the numbers above are
   the argument for paying it.

None of the three blocks item 1, which is the one that should land first
regardless.
