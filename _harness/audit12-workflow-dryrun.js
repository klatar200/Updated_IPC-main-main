/**
 * PLAN-12 — proves _harness/audit12-workflow.js's control flow without
 * spending a token. The Workflow hooks are stubbed with deterministic fakes
 * and the script is run as the Workflow tool would run it (body of an async
 * function, `export` stripped). Asserts:
 *   - every batch reaches a finder, and every finder's rows are answered
 *   - every finding gets reproduce + refute (+ severity unless Low)
 *   - a reproduce/refute disagreement goes to a tiebreak, and the tiebreak decides
 *   - a finding raised twice (same where + title) is verified once
 *   - the gap hunt stops after two dry rounds, and the round cap is recorded
 *   - the critic's re-dispatch runs through find → verify, then stops
 *   - no Date.now()/Math.random() (they throw in the real tool)
 *   - args.methods (W5's cross-lens seams) reach the gap hunt
 *
 *   node _harness/audit12-workflow-dryrun.js [script]   (default: audit12-workflow.js)
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(process.argv[2] || path.join(__dirname, 'audit12-workflow.js'), 'utf8');
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

ok(!/Date\.now\(\)|Math\.random\(\)|new Date\(\)/.test(src.replace(/\/\/.*$/gm, '')), 'no Date.now()/Math.random()/new Date() outside comments');
ok(/^export const meta = \{/.test(src), 'starts with export const meta');
const metaBlock = src.slice(0, src.indexOf('\n}\n') + 2);
ok(!/\$\{|\.\.\.|\w\(/.test(metaBlock.replace(/'[^']*'/g, "''")), 'meta is a pure literal');
const metaPhases = [...metaBlock.matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
const usedPhases = [...src.matchAll(/phase\('([^']+)'\)|phase: '([^']+)'/g)].map((m) => m[1] || m[2]);
ok(usedPhases.every((p) => metaPhases.includes(p)), `every phase used is declared in meta (${[...new Set(usedPhases)].join(', ')})`);

function run(args, behaviour) {
  const calls = [];
  const logs = [];
  const agent = async (prompt, opts) => {
    calls.push({ label: opts.label, prompt });
    return behaviour(opts.label, prompt, calls);
  };
  const pipeline = (items, ...stages) => Promise.all(items.map(async (it, i) => {
    let v = it;
    for (const s of stages) { try { v = await s(v, it, i); } catch { return null; } }
    return v;
  }));
  const parallel = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)));
  const body = src.replace(/^export const meta/m, 'const meta');
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const fn = new AsyncFunction('agent', 'pipeline', 'parallel', 'phase', 'log', 'args', 'budget', 'workflow', 'Date', 'Math', body);
  const SafeMath = Object.create(Math); SafeMath.random = () => { throw new Error('Math.random'); };
  const SafeDate = function () { throw new Error('Date'); }; SafeDate.now = () => { throw new Error('Date.now'); };
  return fn(agent, pipeline, parallel, () => {}, (m) => logs.push(m), args, { total: null }, null, SafeDate, SafeMath)
    .then((ret) => ({ ret, calls, logs }));
}

const idsOf = (prompt) => JSON.parse(/IDS: (\[.*\])/.exec(prompt)[1]);
const finding = (id, sev, lens, file, title) => ({ id, title, severity: sev, class: 'code', lens, rows: ['FILE-0001'], where: [{ file, line: 1, quote: 'x' }], reproduce: 'r', observed: 'o', expected: 'e', consequence: 'c', notInPrior: 'n' });
const verdict = (label, v, sev) => { const [, id, lens] = label.split(':'); return { findingId: id, lens, verdict: v, severity: sev || 'Medium', reason: 'r', measurement: 'm' }; };

(async () => {
  const args = {
    wave: 'WT', head: 'abc1234', lenses: ['L3', 'L6'], portBase: 10000,
    batches: [
      { batch: 'L3-01', lens: 'L3', ids: ['ADMIN-0001', 'ADMIN-0002'] },
      { batch: 'L3-02', lens: 'L3', ids: ['ADMIN-0003'] },
      { batch: 'L6-01', lens: 'L6', ids: ['ROUTE-0001', 'ROUTE-0002'] },
      { batch: 'L9-01', lens: 'L9', ids: ['FIELD-0001'] }, // not in this wave's lenses: must be ignored
    ],
    prior: { L3: ['an old title'] },
  };
  let gapRounds = { L3: 0, L6: 0 };
  let critic = 0;
  const { ret, calls, logs } = await run(args, (label, prompt) => {
    if (label.startsWith('find:')) {
      const b = label.slice(5);
      const ids = idsOf(prompt);
      // L3-02 leaves one row unanswered; L3-01 raises a Low and a High; L6-01 raises a duplicate of L3-01's High.
      const rows = (b === 'L3-02' ? [] : ids).map((id) => ({ id, status: 'done', evidence: 'measured: curl -s … → 403' }));
      const f = b === 'L3-01' ? [finding('A12-L3-01-1', 'High', 'L3', 'admin/edit.php', 'Edit page loses typing'), finding('A12-L3-01-2', 'Low', 'L3', 'admin/help.php', 'Typo in Help')]
        : b === 'L6-01' ? [finding('A12-L6-01-1', 'High', 'L6', 'admin/edit.php', 'Edit page loses typing')]
          : /-R1-/.test(b) ? [finding(`A12-${b}-1`, 'Medium', 'L3', 'admin/config.php', 'Redispatched row finding')] : [];
      return { batch: b, rows, findings: f, outOfBrief: b === 'L6-01' ? ['src/App.jsx:1 something for L7'] : [], ledgerGaps: [], citeExit: 0 };
    }
    if (label.startsWith('verify:')) {
      const [, id, lens] = label.split(':');
      if (id === 'A12-L3-01-1' && lens === 'refute') return verdict(label, 'settled'); // disagreement → tiebreak
      if (id === 'A12-L3-01-1' && lens === 'tiebreak') return verdict(label, 'confirmed', 'High');
      if (id === 'A12-L3-01-2' && lens === 'reproduce') return verdict(label, 'not-reproduced', 'Low'); // → tiebreak → killed
      if (id === 'A12-L3-01-2' && lens === 'tiebreak') return verdict(label, 'not-reproduced', 'Low');
      if (lens === 'severity') return verdict(label, 'confirmed', 'Blocker');
      return verdict(label, 'confirmed');
    }
    if (label.startsWith('gap:')) {
      const [, lens, round] = label.split(':');
      gapRounds[lens] = +round;
      // L3: new findings in rounds 1–5 (never dry) → must hit the cap. L6: one in round 1, then dry → stops at round 3.
      if (lens === 'L3') return { findings: [finding(`A12-L3-WT-G${round}-1`, 'Low', 'L3', 'admin/auth.php', `Gap ${round}`)], method: 'm', ledgerGaps: [], citeExit: 0 };
      return { findings: round === '1' ? [finding('A12-L6-WT-G1-1', 'Medium', 'L6', 'src/App.jsx', 'Gap L6')] : [], method: 'm', ledgerGaps: round === '1' ? ['a gap'] : [], citeExit: 0 };
    }
    if (label.startsWith('critic:')) {
      critic++;
      return { coverageOutput: 'pending 1', spotAudit: [{ id: 'ADMIN-0001', holds: true, why: 'w' }], redispatch: critic === 1 ? [{ lens: 'L3', ids: ['ADMIN-0003'], why: 'unanswered' }, { lens: 'L9', ids: ['FIELD-0001'], why: 'other wave' }] : [], unexercised: [] };
    }
    throw new Error('unexpected label ' + label);
  });

  const labels = calls.map((c) => c.label);
  ok(['find:L3-01', 'find:L3-02', 'find:L6-01'].every((l) => labels.includes(l)), 'every batch of this wave reached a finder');
  ok(!labels.includes('find:L9-01'), 'a batch outside the wave\'s lenses was not dispatched');
  ok(ret.blocked.some((b) => b.batch === 'L3-02' && b.ids && b.ids[0] === 'ADMIN-0003'), 'an unanswered row is recorded as blocked with its id');
  ok(labels.filter((l) => l.startsWith('verify:A12-L3-01-1:')).length === 4, 'High finding: reproduce + refute + severity + tiebreak');
  ok(labels.filter((l) => l.startsWith('verify:A12-L3-01-2:')).sort().join() === 'verify:A12-L3-01-2:refute,verify:A12-L3-01-2:reproduce,verify:A12-L3-01-2:tiebreak', 'Low finding: reproduce + refute (+ tiebreak on disagreement), no severity agent');
  ok(!labels.some((l) => l.startsWith('verify:A12-L6-01-1:')), 'a duplicate finding (same where + title) from another batch is not re-verified');
  const hi = ret.confirmed.find((f) => f.id === 'A12-L3-01-1');
  ok(hi && hi.severity === 'Blocker' && hi.authorSeverity === 'High', 'the severity verifier\'s severity wins and the author\'s is kept beside it');
  ok(ret.killed.some((f) => f.id === 'A12-L3-01-2'), 'a finding the tiebreak could not reproduce is killed, with who killed it');
  ok(gapRounds.L6 === 3, `L6 gap hunt stopped after two dry rounds (ran ${gapRounds.L6})`);
  ok(gapRounds.L3 === 5 && ret.capped.some((c) => /^L3: gap hunt stopped at the 5-round cap/.test(c)), 'L3 gap hunt hit the 5-round cap and the cap is recorded, not silent');
  ok(labels.includes('find:L3-WT-R1-1') && !labels.some((l) => /find:L9-WT-R1/.test(l)), 'critic re-dispatch runs through find for this wave\'s lenses only');
  ok(ret.confirmed.some((f) => f.id === 'A12-L3-WT-R1-1-1'), 're-dispatched finding is verified and confirmed');
  ok(critic === 2, `critic stops when it has nothing to re-dispatch (ran ${critic})`);
  ok(ret.outOfBrief.length === 1 && ret.ledgerGaps.length === 1, 'out-of-brief notes and ledger gaps are carried to the return value');
  const gp = calls.find((c) => c.label === 'gap:L3:2').prompt;
  ok(/Gap 1/.test(gp) && /an old title/.test(gp), 'gap-hunt round 2 is told every title already raised, including earlier waves\'');
  ok(/first port: 10000\b/.test(calls.find((c) => c.label === 'find:L3-01').prompt), 'finder port derives from portBase');
  const again = await run(args, (() => { let c = 0; return (label, prompt) => {
    if (label.startsWith('find:')) return { batch: label.slice(5), rows: idsOf(prompt).map((id) => ({ id, status: 'done', evidence: 'measured: ok ok ok' })), findings: [], outOfBrief: [], ledgerGaps: [], citeExit: 0 };
    if (label.startsWith('gap:')) return { findings: [], method: 'm', ledgerGaps: [], citeExit: 0 };
    if (label.startsWith('critic:')) { c++; return { coverageOutput: '', spotAudit: [], redispatch: [], unexercised: [] }; }
    throw new Error(label);
  }; })());
  ok(again.ret.confirmed.length === 0 && again.calls.filter((c) => c.label.startsWith('gap:')).length === 4, 'a clean wave: no findings, each lens gap-hunts exactly two dry rounds');
  const p1 = again.calls.map((c) => c.prompt).join('\n');
  const { calls: c2 } = await run(args, (() => { return (label, prompt) => {
    if (label.startsWith('find:')) return { batch: label.slice(5), rows: idsOf(prompt).map((id) => ({ id, status: 'done', evidence: 'measured: ok ok ok' })), findings: [], outOfBrief: [], ledgerGaps: [], citeExit: 0 };
    if (label.startsWith('gap:')) return { findings: [], method: 'm', ledgerGaps: [], citeExit: 0 };
    return { coverageOutput: '', spotAudit: [], redispatch: [], unexercised: [] };
  }; })());
  ok(c2.map((c) => c.prompt).join('\n') === p1, 'same args → byte-identical prompts (resume hits its cache)');
  const { calls: c3 } = await run({ wave: 'W5', lenses: ['L6'], batches: [], methods: { L6: ['SEAM: owner edit → served head → share card'] } }, (label) => {
    if (label.startsWith('gap:')) return { findings: [], method: 'm', ledgerGaps: [], citeExit: 0 };
    return { coverageOutput: '', spotAudit: [], redispatch: [], unexercised: [] };
  });
  ok(/SEAM: owner edit/.test((c3.find((c) => c.label === 'gap:L6:1') || {}).prompt || ''), 'args.methods (W5 seams) reach gap round 1 without editing the script');
  console.log(`\n${fails ? 'FAILED' : 'ALL PASS'} — ${logs.length} log lines in the main run; last: ${logs[logs.length - 1]}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL  threw: ' + e.stack); process.exit(1); });
