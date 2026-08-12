# Plans

**Read [GUARDRAILS.md](GUARDRAILS.md) first.** It is binding on every plan. A
plan may add constraints; it may never relax one from there.

**The last completed plan is [PLAN-10](PLAN-10-audit10-remediation.md)** —
remediation of AUDIT-10's severity A and B tiers, shipped 2026-08-11 and
independently verified by AUDIT-11 the same day.

---

## Where the earlier plans went

**PLAN-0 through PLAN-9 were deleted 2026-08-12.** All ten shipped. A completed
plan is an instruction sheet for a session that has already happened; keeping ten
of them made this directory read as a backlog when none of it was open.

Nothing was lost with them, because a plan was never where the outcome lived:

| What you might have wanted a plan for | Where it actually is |
|---|---|
| What shipped, and what it measured | `WHATS_LEFT.md` §1-series (§1b … §1n) and its §4-series evidence blocks |
| The owner-facing summary of the whole release | `PATCH_NOTES.md` |
| What is still open | `WHATS_LEFT.md` §2-series |
| Which suite proves which item | `_harness/README.md` |
| The regression baseline every plan preserved | GUARDRAILS §4.1 — 65 suites, measured 2026-08-11 |
| Settled decisions and refuted findings | GUARDRAILS §7 |

Two things that lived only in the deleted plans were moved rather than dropped:

- **PLAN-7 item 3b (the image picker) was never built.** Its full specification —
  including the one rule that matters, that the picker may *offer*
  `public/images/site/` but must never *delete* from it, because that folder is
  build output the next deploy would silently restore — is duplicated verbatim in
  `WHATS_LEFT.md` §2h. That is now its only home.
- **PLAN-10 §12's out-of-scope list** — the six severity-C clusters that make the
  natural PLAN-11 — is still in PLAN-10, which stays.

---

## What is open

1. **The 39 severity-C and 9 severity-D findings from AUDIT-10.** Untouched, and
   recorded **only** in `_harness/AUDIT10-REPORT.md`. That file is not an audit
   record to be tidied away — it is the backlog. PLAN-10 §12 names the six
   clusters the report groups as one fix each; that is the shape of a PLAN-11.
2. **Everything in `WHATS_LEFT.md` §2-series**, including PLAN-7 item 3b, the
   `/contact` message tab's four mislabelled fields, and A10-037 (the ISO 9001
   revision contradiction), which is blocked on an owner decision.
3. **Nothing is deployed.** `PATCH_NOTES.md` describes a release that is still
   only in this repo.

---

## Writing the next plan

The pattern every plan here was held to, and the reason each part of it exists:

- **Reproduce the symptom and watch a new check fail before fixing it.** Two
  invariant checks in session 3 passed against a broken assertion because they
  were matching incident comments that quoted the old buggy pattern.
- **Where a negative control exists, run it** — a suite that cannot fail is
  decoration. The live one is `_harness/plan2-trunc.js` against `:8125`
  (`_harness/php-nb2-off.ini`, `display_errors=On`), which asserts the PHP
  truncation warning **does** surface there, proving the production-shaped
  assertion on `:8124` is measuring something. *Corrected 2026-08-11: this named
  `_harness/negctl.php`, which has never been tracked in this repo and is
  superseded by `plan2-trunc.js`. See GUARDRAILS §4.4.*
- **Restore any `data/*.json` a test touched** from `_harness/pristine/`, and
  prove byte-identity with `cmp`.
- **Label anything depending on `.htaccess` or `.user.ini` as `[UNVERIFIED]`.**
  `php -S` ignores both, so the `admin/` and `data/` file-blocking rules are
  never exercised locally. Apache is the real gate.
- **Fields added to `admin/content.php` move the posted-variable count** and must
  stay above the `form_complete` sentinel (invariant 6, enforced positionally).
  Re-run `plan2-formlast` and `plan2-trunc` against the real
  `max_input_vars=100` server after any such change.
- **Run the GUARDRAILS §4.1 baseline before you start**, so you know what you
  inherited rather than what you broke.
