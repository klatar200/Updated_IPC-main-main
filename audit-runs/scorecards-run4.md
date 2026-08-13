# Scorecards — Run 4

One scorecard per sprint in `audit-runs/build-plan-run4.md`. Each criterion is
Pass/Fail against a **measurement**. Sprint verdict = Pass only if every
criterion passes.

---

## Sprint 1 scorecard — D-01, D-04, D-05

| # | Criterion | How measured | Result |
|---|---|---|---|
| 1.1 | **The class was enumerated, not just the field that raised it** | list every `href={…}` in `App.jsx` fed by owner-editable data and classify each | Pass — 3 found: `additionalPdfs[].url` already safe (edit.php F6), `catalogPdfUrl` and `brochure.url` unguarded. `tel:`/`mailto:` and `item.href` interpolate into a fixed scheme; `logoUrl`/photo slots are `src`, not `href` |
| 1.2 | **D-01 was real before the fix, proven with a control** | save a script-scheme value through the real admin forms, read the rendered `href` | Pass — both came back as **live** `javascript:` hrefs while the identical payload in `social_facebook` was neutralised |
| 1.3 | The admin now refuses a script scheme and names the field | `run4-urlsink2` against `settings.php` | Pass |
| 1.4 | …and refuses a protocol-relative `//` | same | Pass — `//evil.example.com/x.pdf` rejected |
| 1.5 | …and refuses a scheme-less relative path | same | Pass — `pdfs/catalog.pdf` rejected (it would resolve against the current path) |
| 1.6 | No over-blocking: a site path, an https URL and blank all still save | same | Pass — 3/3 accepted |
| 1.7 | `content.php` refuses a bad brochure link **and names which card** | `run4-urlsink2` against `content.php` | Pass — the message quotes the service title, of six rows |
| 1.8 | **A value already on disk cannot render** — the half no server check can cover | write the payload straight into the mirror's `data/`, load `/` and `/services` | Pass — **zero** script-scheme hrefs on either page |
| 1.9 | …and no orphan label is left behind | look for the poisoned link's text | Pass — the whole element is absent, not an empty anchor |
| 1.10 | Legitimate values still render | `/pdfs/IP52EC-molded-cap.pdf` and `https://example.com/catalog.pdf` in the footer | Pass — both render |
| 1.11 | **Control: A-01 is exactly as it was** | count footer social anchors | Pass — all 5 configured channels still render; `plan5-social` **35/35** |
| 1.12 | `isSafeExternalUrl` was not widened | read the diff | Pass — a second function; social channels still reject relative values |
| 1.13 | `additionalPdfs` untouched | read the diff | Pass — F6 is stricter (requires `.pdf`) and stays that way |
| 1.14 | The new `lint.php` check fails when the guard is removed | three separate mutations | Pass — **3/3 fail**: client guard removed, `//` rejection weakened, server validator removed |
| 1.15 | D-04: `add.php` no longer reads a field its form never renders | read the diff | Pass — `''` plus a comment naming the Upload Image page |
| 1.16 | D-05: the admin heading outline no longer skips a level | re-run the 20-page sweep | Pass — the preview name is a `div`; `.pp-name` carries the styling so the panel is unchanged |
| 1.17 | Regression batch selected **by surface, not by grep** (Run 3's rule) | mechanical match on `settings.php`, `content.php`, `add.php`, `/services`, footer, `pp-name`, `social` | Pass — 29 assertion suites identified, 27 run (2 are the crawls, run separately) |
| 1.18 | No regression across that batch | `run.js` ×2 | Pass — **24/27**; the 3 non-green are `plan2-trunc` (a missing test server, 13/13 once :8124/:8125 were up) and the two standing owner decisions below |
| 1.19 | Gates green | invariants, `lint.php`, build | Pass — **17/17**, **11/11**, build clean |

**Sprint 1 verdict: PASS** (19/19) — verified 2026-08-13.

---

## Sprint 2 scorecard — D-02

| # | Criterion | How measured | Result |
|---|---|---|---|
| 2.1 | **The failure predates this audit branch** | restore `src/App.jsx` to `3fa1c60`, rebuild, re-run | Pass — **28/33, the same five states, the same counts** |
| 2.2 | **Sprint 1 did not move a brand-painted surface** | re-run before the re-base with Sprint 1 in the bundle | Pass — 150 / 89 / 77 / 303 / 55 / 121 / 163 / 153, identical to the pre-Sprint-1 capture |
| 2.3 | **Every difference was named before the file was rewritten** | per-class delta, `run4-repalette-delta.cjs` | Pass — the three `home` states share one delta exactly (one shared component); `products` and the product page share the other. Recorded in `audit4.md` D-02 |
| 2.4 | The palette machinery itself was not the thing that moved | check the other two arms and the gradients | Pass — `owner` and `vars` pass in full; **every gradient on every state** byte-identical |
| 2.5 | The re-base was taken from a tree that builds clean and whose suites pass | Sprint 1's batch finished first | Pass |
| 2.6 | `plan10-repalette` is green | re-run | Pass — **33/33** (was 28/33) |
| 2.7 | **The three previously-identical states are still identical** | compare counts across the re-base | Pass — `dashboard` 303, `contact` 55, `industries` 121, unchanged. Had these moved, the delta analysis had missed something and the re-base would have been wrong |
| 2.8 | **The arm still bites** | set `theme.primaryColor` to `#7a1fa2` in the mirror, re-run, restore | Pass — **16/33, 17 failures**. A stale baseline that cannot fail is not a guard |
| 2.9 | The new baseline explains itself | read `_note` | Pass — records that re-basing is a deliberate reviewed act, what it was re-based over, and that the delta must be named first; plus a `rebased_over` field |
| 2.10 | The `CRAWL_OUT`/`--save-baseline` contract is unchanged | read the diff | Pass — only the note text and one added field; no logic touched |
| 2.11 | Nothing tracked was dirtied by the runs | `git status --short site-screenshots` | Pass — **0** |
| 2.12 | Gates green after the re-base | invariants, `lint.php`, build, mirror | Pass — 17/17, 11/11, build clean, mirror in sync |

**Sprint 2 verdict: PASS** (12/12) — verified 2026-08-13.

---

## Run 4 suite results

| Suite | Result | Note |
|---|---|---|
| plan10-repalette | **33/33** | was 28/33 — D-02 |
| plan10-adminrows | 15/15 | first execution by any audit |
| plan10-header | 8/8 | first execution |
| plan10-helpwidth | 21/21 | first execution |
| plan10-rfqscroll | 24/24 | first execution |
| plan5-social | 35/35 | D-01 control |
| invariants | 17/17 | gate |
| invariants-selftest | 15/15 | negative control |
| plan2-formlast | 8/8 | invariant 6 |
| plan2-formlast-selftest | 8/8 | negative control |
| copyroundtrip | 15/15 | |
| copydrift-selftest | 5/5 | negative control |
| plan2-sku | 14/14 | |
| plan2-delete | 18/18 | |
| plan6-families | 13/13 | |
| plan2-contrast | 42/42 | |
| plan2-trunc | 13/13 | 1/2 until :8124/:8125 were started — a missing test server, not a defect |
| plan10-adminnav | 25/25 | |
| plan10-auditlog | 13/13 | |
| plan5-images | 12/12 | |
| plan5-keys | 11/11 | |
| plan5c-brandink | 6/6 | |
| plan5c-eyebrow | 5/5 | |
| plan8-chrome | 16/16 | |
| plan8-keyboard | 8/8 | |
| plan8-lead | 16/16 | |
| plan8-meta | 15/15 | |
| plan8-mobile | 16/16 | |
| plan8-motion | 8/8 | |
| plan8-polish | 16/17 | C-06, unchanged — owner decision |
| brandtext | 36/47 | the CLOSED `brand-gradient-mixed-ends` decision, unchanged — recorded, not reopened |
| run4-urlsink (probe) | 14/14 | D-01 acceptance, with the A-01 control |
| run4-a11y (probe) | 1 finding / 20 pages | D-05 |

Both non-green results match Run 3's recorded values **exactly**, so neither is
a regression from this run.

**Gates:** invariants **17/17**, `lint.php` **11/11** (the 11th is new this run),
build clean, mirror in sync, `site-screenshots/` untouched.
