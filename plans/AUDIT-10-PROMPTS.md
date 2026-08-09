# AUDIT-10 — the copy-paste prompts

Eight sessions, one prompt each, run **in this order**: 0 → 1 → 2 → 3 → 4 → 5
→ 6 → 7. (Passes 1–6 all depend only on pass 0, so after pass 0 you may run
them in any order — or in parallel sessions — as long as pass 7 goes last.)
Paste each block into a **fresh** Claude Code session on this repository.
Run them on Claude Fable 5 at high effort.

If a session dies mid-pass, paste the **Resume prompt** at the bottom instead
of re-pasting the pass prompt.

Everything an agent needs beyond the prompt is in machine-readable files under
`plans/audit10/` — you never need to read those yourself.

---

## Pass 0 — environment, baseline, full screenshot capture

```
You are running AUDIT-10 pass-0 on this repository. This is an AUDIT: you are
a reviewer producing evidence, never a fixer — you change no site code, at any
severity, for any reason.

Binding contract, read in this order before any tool use beyond reading:
1. plans/audit10/guardrails.json  — hard prohibitions, write allowlist,
   evidence standards, the do-not-report list. It binds every step below.
2. plans/audit10/manifest.json    — the pass structure and resume protocol.
3. plans/audit10/passes/pass-0-baseline-capture.json — your entire task, as
   ordered steps. Execute exactly these steps, in order, nothing else.
4. CLAUDE.md and plans/GUARDRAILS.md — the repo's standing constraints; they
   apply underneath the audit guardrails.

Git: create branch claude/audit-10 from up-to-date main (you are explicitly
authorized for the git operations listed in guardrails.json
write_allowlist.git_operations_allowed, and no others). Immediately set
plans/audit10/state/ledger.json pass-0 to in_progress, commit, push — that is
the session lock. On completion set it complete with the deliverables recorded,
commit 'audit10(pass-0): baseline + capture', push.

Your deliverables are exactly the exit_criteria in the pass file: verified
baseline (STOP and report if it deviates beyond baseline.json
expected_exceptions), the complete 4-viewport screenshot capture under
_harness/out/audit10/current/ (gitignored — never commit screenshots), and
plans/audit10/state/candidates.json triaging every automated probe flag.
You judge nothing visually in this pass — later passes own judgment.

Before ending: delete _harness/site/admin/config.local.php, confirm git status
is clean outside the allowlist, and report: baseline table, capture counts,
candidate counts by assigned pass, and anything that blocked you.
```

## Pass 1 — public visual layout, desktop-1440 + tablet-1024

```
You are running AUDIT-10 pass-1 on this repository. This is an AUDIT: findings
only, evidence-backed, zero fixes — not even a one-character typo.

Read in order: plans/audit10/guardrails.json (binding — especially
evidence_standards and known_issues_do_not_report),
plans/audit10/manifest.json, plans/audit10/passes/pass-1-visual-desktop.json
(your entire task), plans/audit10/severity.json,
plans/audit10/findings.schema.json, CLAUDE.md, plans/GUARDRAILS.md.

Git: git fetch origin claude/audit-10 && git checkout claude/audit-10 (you are
authorized for exactly the git operations in guardrails.json). Check
plans/audit10/state/ledger.json: pass-0 must be complete and pass-1 not
already complete — otherwise stop and say so. Lock pass-1 as in_progress
(commit+push) before working.

Stand the server up per plans/audit10/routes.json server block. If
_harness/out/audit10/current/ is empty (fresh container), re-run
node _harness/audit10-crawl.js first and record the re-capture in the ledger.

Your task is the pass file's method + rubric, applied to EVERY page at
desktop-1440 and tablet-1024 — all 10 routes, all 3 family views, all 42
product pages, the error states. Fan out parallel reviewer subagents over
screenshot batches, then verify every suspicion yourself in the live browser
with numeric measurements: a reviewer impression is a lead, never evidence.
Resolve every candidates.json entry assigned to pass-1.

Record findings by appending to plans/audit10/state/findings.jsonl per the
schema (allocate ids from ledger.next_finding_id), save issue evidence to
_harness/out/audit10/issues/, and run node _harness/audit10-findings.js after
every batch of appends — it must be green before any commit.

Spend freely: review every screenshot, sweep every page, sample nothing. The
counterweight is the severity ladder — batch nits as D, and record honest
refutations for candidates that measure clean.

Before ending: ledger complete (with reviewed-screenshot counts), findings
validated, commit 'audit10(pass-1): ...', push, delete
_harness/site/admin/config.local.php. Report findings by severity, refuted
candidates, and coverage counts.
```

## Pass 2 — public visual layout, tablet-834 + mobile-390

```
You are running AUDIT-10 pass-2 on this repository. This is an AUDIT: findings
only, evidence-backed, zero fixes.

Read in order: plans/audit10/guardrails.json (binding),
plans/audit10/manifest.json, plans/audit10/passes/pass-2-visual-small.json
(your entire task), plans/audit10/severity.json,
plans/audit10/findings.schema.json, CLAUDE.md, plans/GUARDRAILS.md.

Git: fetch+checkout claude/audit-10; verify in
plans/audit10/state/ledger.json that pass-0 is complete and pass-2 is not;
lock pass-2 in_progress (commit+push). Stand the server up per
plans/audit10/routes.json; re-run node _harness/audit10-crawl.js if the
capture folder is empty and record the re-capture.

Your task: the pass file's rubric at tablet-834 and mobile-390 across every
public page — including the small-screen-specific sweeps it names: wrapping of
compound SKUs, stacking order, the WCAG 24px touch-target floor, fixed/sticky
chrome coverage, horizontal overflow, the mobile-menu OPEN state on all 10
routes (the crawler only captured it closed), FAQ accordion states, and the
hero-photo-not-requested-at-390 re-verification. tablet-834 is the
least-tested band on this site — treat it as hostile territory.

Same recording discipline as every pass: findings.jsonl per schema, ids from
the ledger, issue screenshots to _harness/out/audit10/issues/,
node _harness/audit10-findings.js green before every commit, candidates
assigned to pass-2 all resolved, refutations recorded.

Spend freely; sample nothing; batch nits as D. Before ending: ledger complete,
commit 'audit10(pass-2): ...', push, delete
_harness/site/admin/config.local.php. Report findings, refutations, coverage.
```

## Pass 3 — the admin, every page, every viewport, owner journeys

```
You are running AUDIT-10 pass-3 on this repository. This is an AUDIT of the
/admin surface: findings only, zero fixes. The protected person is Rick — a
non-technical owner around 60. Anything that loses or misrepresents his typed
work is severity A.

Read in order: plans/audit10/guardrails.json (binding),
plans/audit10/manifest.json, plans/audit10/passes/pass-3-admin.json (your
entire task — its safety_contract is as binding as the guardrails),
plans/audit10/severity.json, plans/audit10/findings.schema.json, CLAUDE.md,
plans/GUARDRAILS.md.

Git: fetch+checkout claude/audit-10; ledger check (pass-0 complete, pass-3 not
already complete); lock pass-3 in_progress (commit+push). Stand the server up
per plans/audit10/routes.json. The admin password is audit-pass-123 IN THE
MIRROR ONLY (written by sync.sh). Everything runs against
http://127.0.0.1:8123 — never against the repo's data/ directory, which is
live customer state.

Your task: the pass file's steps 3.1–3.8 exactly — all 11 admin pages at all
4 viewports, the signed-out surface, and journeys A–D (content round-trip,
validation display, two-tab conflict banner, upload-refusal display). The
forbidden_journeys list is absolute. After ANY journey that saves, restore
_harness/site/data/*.json from _harness/pristine/ byte-identical (cmp) and
record it in the ledger. PHP notices/warnings printed into any page ARE
findings (:8123 runs display_errors=On).

Recording discipline as every pass: findings.jsonl per schema, validator green
before commits, pass-3 candidates resolved, refutations recorded.

Before ending: mirror restored and verified, ledger complete
(mirror_restored=true), commit 'audit10(pass-3): ...', push, delete
_harness/site/admin/config.local.php. Report findings, journey outcomes,
coverage.
```

## Pass 4 — copy: every rendered character

```
You are running AUDIT-10 pass-4 on this repository. This is an AUDIT of every
character a visitor or Rick can read: typos, encoding artifacts, punctuation
and casing drift, factual contradictions between pages. Findings only, zero
fixes — you quote exact current text, you never propose rewrites.

Read in order: plans/audit10/guardrails.json (binding),
plans/audit10/manifest.json, plans/audit10/passes/pass-4-copy-characters.json
(your entire task), plans/audit10/severity.json,
plans/audit10/findings.schema.json, CLAUDE.md, plans/GUARDRAILS.md.

Git: fetch+checkout claude/audit-10; ledger check (pass-0 complete, pass-4
not); lock pass-4 in_progress (commit+push). Stand the server up per
plans/audit10/routes.json.

Your task: the pass file's steps 4.1–4.9 exactly. Build the full text dump as
a committed census (_harness/audit10-textdump.js →
plans/audit10/state/textdump.json), run every mechanical scan as committed
code (new files _harness/audit10-*.js only), triage the unique-word list IN
FULL, run the cross-page factual-consistency sweep (including the documented
second copy in index.html's noscript block), and read every admin message for
comprehensibility to a non-technical owner. Verify every hit in the rendered
page before recording it — the dump locates, the browser confirms.

Scope fences from the pass file are absolute: drift, errors and
contradictions are in; style and tone opinions are out; the owner's data
content is server-owned and never the finding.

Recording discipline as every pass; batch drift classes as single D findings
with instances[]. Before ending: ledger complete, commit
'audit10(pass-4): ...', push, delete _harness/site/admin/config.local.php.
Report findings, the scans run, and the size of what was swept (pages, text
nodes, unique words).
```

## Pass 5 — color and design-token consistency

```
You are running AUDIT-10 pass-5 on this repository. This is an AUDIT of every
color and design token the site actually paints: off-palette one-offs,
near-duplicate values, component-class drift, and hardcode leaks that defeat
the owner's repalette mechanism. Findings only, zero fixes, no taste
opinions — drift and leaks, measured.

Read in order: plans/audit10/guardrails.json (binding — its known_issues
lists the LOGGED contrast items, which are never findings),
plans/audit10/manifest.json, plans/audit10/passes/pass-5-color-design.json
(your entire task), plans/audit10/severity.json,
plans/audit10/findings.schema.json, CLAUDE.md, plans/GUARDRAILS.md.

Git: fetch+checkout claude/audit-10; ledger check (pass-0 complete, pass-5
not); lock pass-5 in_progress (commit+push). Stand the server up per
plans/audit10/routes.json.

Your task: the pass file's steps 5.1–5.8 exactly. Build the computed-style
census as committed code and data, run the color clustering and singleton
hunts, run the repalette drill EXACTLY as specified (runtime CSS-variable
injection via addStyleTag on 5 pages — no source edits, screenshots to
issues/), the typography-scale and radii/shadow consistency sweeps, and the
contrast NEW-DRIFT check — run the existing suites rather than rebuilding
their measurement (backdrop.js is the single implementation on purpose), and
hand-measure only what they do not cover, like the admin's own text.

Recording discipline as every pass; hardcode leaks that defeat repalette are
B; same-class drift is C; near-duplicate singletons are batched D with
instances[]. Before ending: ledger complete, commit 'audit10(pass-5): ...',
push, delete _harness/site/admin/config.local.php. Report findings, the
census sizes, the leak list from the repalette drill, and the suite-vs-logged
contrast diff.
```

## Pass 6 — interaction states, keyboard, motion

```
You are running AUDIT-10 pass-6 on this repository. This is an AUDIT of every
interactive element's full state set — default, hover, focus-visible, active —
plus keyboard traversal, overlays, motion and scroll behavior. A control with
a missing or inconsistent state is a design defect even when it works.
Findings only, zero fixes.

Read in order: plans/audit10/guardrails.json (binding),
plans/audit10/manifest.json, plans/audit10/passes/pass-6-interaction.json
(your entire task), plans/audit10/severity.json,
plans/audit10/findings.schema.json, CLAUDE.md, plans/GUARDRAILS.md.

Git: fetch+checkout claude/audit-10; ledger check (pass-0 complete, pass-6
not); lock pass-6 in_progress (commit+push). Stand the server up per
plans/audit10/routes.json.

Your task: the pass file's steps 6.1–6.8 exactly. Build the interactives
census as committed code and data, sweep states per component class with REAL
key presses (Chromium will not match :focus-visible on programmatic focus —
drive real Tab/Enter, the repo learned this the hard way), walk all 10 routes
keyboard-only, exercise the mobile menu and mega-menus at their assigned
viewports, run the motion checks in both default and reduced-motion, verify
anchor/scroll behaviors, and check the /contact interaction contract. The
existing suites cover a known-green set — confirm still-green once, then
audit what they do NOT cover and the consistency between component classes.

Recording discipline as every pass. Before ending: ledger complete, commit
'audit10(pass-6): ...', push, delete _harness/site/admin/config.local.php.
Report findings, the state-sweep counts per class, and the keyboard-traversal
notes per route.
```

## Pass 7 — synthesis and final report

```
You are running AUDIT-10 pass-7, the final pass. Passes 1–6 must all be
complete in plans/audit10/state/ledger.json — verify that first and stop if
not. This pass turns the accumulated findings into the final deliverable and
opens the PR. Zero fixes, zero new sweeps.

Read in order: plans/audit10/guardrails.json (binding),
plans/audit10/manifest.json, plans/audit10/passes/pass-7-synthesis.json (your
entire task), plans/audit10/severity.json, plans/audit10/findings.schema.json,
plans/AUDIT-PROMPT-2026-08-09.md §8 (the house report format), CLAUDE.md,
plans/GUARDRAILS.md.

Git: fetch+checkout claude/audit-10; lock pass-7 in_progress (commit+push).
Stand the server up per plans/audit10/routes.json — you will need it: EVERY
severity A and B finding must be re-verified from a fresh browser context
using only the record's own reproduce steps. A record that does not reproduce
drops to LIKELY/C with a note. This step is where previous audits' confident
wrong findings died — do not soften it.

Then: dedupe per the pass file (fold, never delete), run the
severity-consistency review, account for coverage honestly (every
candidates.json entry resolved or listed as unresolved), and write
_harness/AUDIT10-REPORT.md in the house format with Coverage, [UNVERIFIED],
Refuted, and Regression state sections. Refutations are as valuable as
findings — they stop the next session re-chasing ghosts.

Final hygiene per the pass file: mirror byte-identical to pristine, credential
deleted, git clean outside the allowlist. Commit 'audit10(pass-7): final
report', push, open a ready-for-review PR claude/audit-10 → main titled
'AUDIT-10: final full-site inspection report' whose body carries the summary
table, per-severity counts, coverage, and the three expected regression
exceptions called out. Report the PR URL and the headline numbers.
```

## Resume prompt (any interrupted pass)

```
You are resuming an interrupted AUDIT-10 pass on this repository. Read
plans/audit10/guardrails.json (binding), plans/audit10/manifest.json (the
resume_protocol), then plans/audit10/state/ledger.json: exactly one pass
should be in_progress — that pass is yours. Read its pass file under
plans/audit10/passes/, skip every step id already in steps_done, and continue
from the first incomplete step under the same rules, recording discipline,
and exit criteria as the original prompt for that pass. git fetch+checkout
claude/audit-10 first; re-run node _harness/audit10-crawl.js if a step needs
screenshots and _harness/out/audit10/current/ is empty (fresh container),
recording the re-capture in the ledger. If NO pass is in_progress, report the
ledger state and stop — do not guess which pass to run. Before ending: ledger
updated, findings validated, commit, push, delete
_harness/site/admin/config.local.php.
```
