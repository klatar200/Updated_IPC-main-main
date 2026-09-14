/**
 * Audit 9 — totals and verdict, computed from the §13.1 records in
 * audit-runs/audit9.md §2 (PLAN-11 §8.1, §9, §10.1.4: "counts are computed,
 * not typed" — audit 8's table under-counted by one).
 *
 *   node _harness/audit9-totals.js            # print the table + verdict
 *   node _harness/audit9-totals.js --write    # also rewrite the TOTALS block
 *                                             # and the Verdict line in audit9.md
 *
 * A record is a heading `### A-9.<n> — <SEVERITY> — <sentence>` followed by
 * `class:` and `outcome:` fields (the first of each after the heading). The
 * verdict (§9):
 *   NO-GO                 any open Blocker, or any High of class code unfixed
 *   GO                    no open Blocker/High; every Medium fixed or deferred
 *                         to WHATS_LEFT §2; owner-action list empty or Low-only (cosmetic)
 *   GO-WITH-OWNER-ACTIONS otherwise (no open Blocker; every High fixed or
 *                         data-live/server with the owner step written)
 * "open" = outcome not beginning with `fixed`, `owner action`, `escalated`,
 * `deferred`, `withdrawn` or `refuted`. A High whose outcome is `owner action`
 * is an owner action, not an open High.
 */
const fs = require('fs');
const path = require('path');
const FILE = process.env.AUDIT9_FILE || path.join(__dirname, '..', 'audit-runs', 'audit9.md');
const md = fs.readFileSync(FILE, 'utf8');
const sec2 = md.split(/^## 2\. Findings/m)[1]?.split(/^## 3\. /m)[0] || '';
// Ids are pass-scoped (A-9.P5a-10, A-9.B2-08, A-9.D7), not a flat counter.
const re = /^### (A-9\.[A-Za-z0-9-]+) — (Blocker|High|Medium|Low) — (.*)$/gm;
const recs = [];
let m;
while ((m = re.exec(sec2))) {
  const start = m.index + m[0].length;
  const next = sec2.slice(start).search(/^### A-9\./m);
  const body = sec2.slice(start, next === -1 ? undefined : start + next);
  const f = (k) => (body.match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [, ''])[1].trim();
  recs.push({ id: m[1], sev: m[2], title: m[3].trim(), cls: f('class'), pass: f('pass'), outcome: f('outcome'), verified: f('verified-by') });
}
const SEV = ['Blocker', 'High', 'Medium', 'Low'];
const count = (fn) => recs.filter(fn).length;
// Outcomes are written in the document's voice, so the leading marker may be
// bolded (`**fixed.**`) or qualified (`**code half fixed**`). Strip markup
// before classifying, and treat a half-fix as fixed for the count only when
// the record says so in its first clause.
const lead = (r) => String(r.outcome).replace(/[*_`]/g, "").trim().toLowerCase();
const isFixed = (r) => /^([a-z ]*\bfixed\b)/.test(lead(r)) && !/^not fixed/.test(lead(r));
const isOwner = (r) => /^owner action/.test(lead(r));
const isClosed = (r) => isFixed(r) || /^(owner action|escalated|deferred|withdrawn|refuted)/.test(lead(r));
const isEsc = (r) => /^(escalated|deferred)/.test(lead(r));
let table = '| Severity | Count | Fixed | Owner action | Escalated / deferred | Open |\n|---|---|---|---|---|---|\n';
for (const s of SEV) {
  const rs = recs.filter((r) => r.sev === s);
  table += `| ${s} | ${rs.length} | ${rs.filter(isFixed).length} | ${rs.filter(isOwner).length} | ${rs.filter(isEsc).length} | ${rs.filter((r) => !isClosed(r)).length} |\n`;
}
table += `| **Total** | **${recs.length}** | **${count(isFixed)}** | **${count(isOwner)}** | **${count(isEsc)}** | **${count((r) => !isClosed(r))}** |\n`;
const byClass = {};
for (const r of recs) byClass[r.cls] = (byClass[r.cls] || 0) + 1;
const byPass = {};
for (const r of recs) for (const p of (r.pass.split(/[,\s]+/)[0] ? r.pass.match(/P\d+[abc]?/g) || ['?'] : ['?'])) byPass[p] = (byPass[p] || 0) + 1;
const openBlocker = recs.filter((r) => r.sev === 'Blocker' && !isClosed(r));
const openHighCode = recs.filter((r) => r.sev === 'High' && r.cls === 'code' && !isFixed(r));
const openHigh = recs.filter((r) => r.sev === 'High' && !isClosed(r));
const ownerActions = recs.filter(isOwner);
const mediumOpen = recs.filter((r) => r.sev === 'Medium' && !isClosed(r));
let verdict, why;
if (openBlocker.length || openHighCode.length) {
  verdict = 'NO-GO';
  why = [...openBlocker, ...openHighCode].map((r) => `${r.id} (${r.sev}, ${r.cls}: ${r.outcome || 'no outcome'})`).join('; ');
} else if (!openHigh.length && !mediumOpen.length && ownerActions.every((r) => r.sev === 'Low')) {
  verdict = 'GO';
  why = 'no open Blocker/High; every Medium fixed or deferred; owner-action list ' + (ownerActions.length ? 'cosmetic (Low only): ' + ownerActions.map((r) => r.id).join(', ') : 'empty');
} else {
  verdict = 'GO-WITH-OWNER-ACTIONS';
  // The header line has to stay a line: name the owner actions, do not
  // reproduce them. Their full text is in the §2 records and in §5.
  const brief = (r) => String(r.outcome).replace(/[*_`]/g, '').split(/[.(]/)[0].trim();
  why = `no open Blocker, no open High; ${ownerActions.length} owner actions (` + ownerActions.map((r) => `${r.id} ${r.sev}`).join(', ') + `), ${recs.filter(isEsc).length} escalated (` + recs.filter(isEsc).map((r) => r.id).join(', ') + `). The gating one is ${ownerActions.filter((r)=>r.sev==='High').map((r)=>`${r.id}: ${brief(r)}`).join('; ') || 'none'}`;
}
// Verified by the SEPARATE verifier agents only. C reproducing its own
// finding through a test-first acceptance arm is evidence, but it is not
// §3.6 verification and must not be counted as it.
const unverified = recs.filter((r) => !/^V[12] — /.test(String(r.verified).trim()));
const out = `${table}\nBy class: ${Object.entries(byClass).map(([k, v]) => `${k} ${v}`).join(' · ')}\nBy pass: ${Object.entries(byPass).map(([k, v]) => `${k} ${v}`).join(' · ')}\nVerified by V: ${recs.length - unverified.length}/${recs.length}${unverified.length ? ' — NOT verified: ' + unverified.map((r) => r.id).join(', ') : ''}\n\n**Verdict: ${verdict}** — ${why}\n`;
process.stdout.write(out);
if (process.argv.includes('--write')) {
  let next = md.replace(/<!-- TOTALS:BEGIN[^\n]*-->[\s\S]*?<!-- TOTALS:END -->/, `<!-- TOTALS:BEGIN — generated by _harness/audit9-totals.js from the §2 records; never typed -->\n${table}By class: ${Object.entries(byClass).map(([k, v]) => `${k} ${v}`).join(' · ')} · by pass: ${Object.entries(byPass).map(([k, v]) => `${k} ${v}`).join(' · ')} · verified by V: ${recs.length - unverified.length}/${recs.length}\n<!-- TOTALS:END -->`);
  next = next.replace(/^\*\*Verdict:\*\* .*$/m, `**Verdict:** **${verdict}** — ${why} (computed by \`_harness/audit9-totals.js\`)`);
  fs.writeFileSync(FILE, next);
  console.log('audit9.md updated');
}
if (unverified.length && process.argv.includes('--strict')) process.exit(1);
