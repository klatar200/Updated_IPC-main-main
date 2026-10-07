export const meta = {
  name: 'audit12-wave',
  description: 'AUDIT-12: one wave of ledger batches → find → adversarial verify → loop-until-dry gap hunt → completeness critic',
  whenToUse: 'plans/PLAN-12-full-project-audit.md §5. Run once per wave with args built from _harness/out/audit12/batches.json.',
  phases: [
    { title: 'Find', detail: 'one finder per ledger batch' },
    { title: 'Verify', detail: 'reproduce · refute · severity, tiebreak on disagreement' },
    { title: 'Gap hunt', detail: 'per lens, a different method each round, until two dry rounds' },
    { title: 'Critic', detail: 'evidence spot-audit and coverage; re-dispatch what is thin' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// args = { wave: 'W1', head: '<short sha>', lenses: ['L1', ...],
//          batches: [{ batch, lens, ids: [...] }, ...],      // from --batches, filtered to `lenses`
//          prior: { L3: ['title', ...], ... },              // titles already raised in earlier waves
//          portBase: 10000,                                  // above every port a suite binds (8123–9481)
//          methods: { L6: ['...'], ... } }                 // optional: extra gap-hunt methods (W5's
//                                                           //   cross-lens seams) — no script edit needed
// Tested without spending a token by _harness/audit12-workflow-dryrun.js.
// No Date.now()/Math.random(): prompts must be identical on resume.
// ─────────────────────────────────────────────────────────────────────────────

const A = args || {}
const PLAN = 'plans/PLAN-12-full-project-audit.md'
const OUT = '_harness/out/audit12'
const WAVE = A.wave || 'W?'
const LENSES = A.lenses || []
const BATCHES = (A.batches || []).filter((b) => LENSES.includes(b.lens))
const PORT = A.portBase || 10000
const MAX_GAP_ROUNDS = 5
const DRY_TO_STOP = 2
const MAX_CRITIC_ROUNDS = 3

// One different method per gap-hunt round (multi-modal sweep). Round 1 of the
// gap hunt already follows the finders' row-by-row pass, so these deliberately
// start somewhere other than the ledger.
const METHODS = {
  L1: ['clean clone → npm ci → build → diff dist/; then every dependency\'s advisories offline', 'every file in public/ and dist/: is it referenced, is anything referenced missing'],
  L2: ['php7.4-compat static scan of every PHP file', 'real Apache: every .htaccess rule probed with a request designed to slip past it', 'host assumptions: what breaks without mod_headers, mod_expires, with open_basedir, with a read-only admin/'],
  L3: ['an attacker with no account: every URL the server answers, every method', 'a signed-in attacker: CSRF, upload abuse, path tricks, oversized and array inputs', 'source-first: every echo, write, rename, unlink and include in admin/ and public/ followed to its input'],
  L4: ['every write path: interrupt it (kill -STOP the server mid-request), then check data/, backups, locks', 'concurrency: two tabs, stale signatures, simultaneous saves', 'restore every backup kind and every trashed file, then compare the public site'],
  L5: ['mutate site-info.json and content.json field by field (blank, missing, wrong type, huge) and diff index.php against the hydrated DOM', 'contact.php and sitemap.php reading the same mutated files'],
  L6: ['task-first: a buyer finding a part by spec, by family, by data sheet, and requesting a quote', 'every interactive element on every route clicked, at 390 and 1440', 'browser chrome: Back/Forward/refresh/deep link/new tab on every route'],
  L7: ['keyboard only, every route, every dialog and menu', 'screen-reader tree (Playwright accessibility snapshot) read as a list, every route', 'contrast of every text node under every shipped palette'],
  L8: ['every string a buyer reads, grouped by claim: is each claim made the same way everywhere', 'every number on the site traced to its source'],
  L9: ['Rick\'s first week: every task in the handoff email done from a cold start', 'every error message the dashboard can show: trigger it, read it as Rick'],
  L10: ['crawler-eye: curl every route and product without JS and read only the HTML', 'every structured-data block validated against schema.org types offline'],
  L11: ['cold load at 390 on throttled network for every route', 'failure injection: slow data/, 500s, a missing image, a missing PDF'],
  L12: ['every command in every doc executed as written', 'every number in every doc recomputed'],
  L13: ['mutation: break the code each suite guards and confirm it goes red', 'every _harness file classified: suite / helper / instrument / dead'],
  L14: ['every change since audit 9 (git log) checked for a regression in what it touched', 'every Settled row: does the reason still hold'],
  L15: ['every effect and listener: cleanup, stale closures, dependency arrays', 'every place data can be absent, null, empty or the wrong type', 'every string built from data: escaping, truncation, encoding'],
}

const FINDING = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'A12-<batch>-<n>, unique' },
    title: { type: 'string', description: 'one sentence, in the words a buyer or Rick would use' },
    severity: { type: 'string', enum: ['Blocker', 'High', 'Medium', 'Low'] },
    class: { type: 'string', enum: ['code', 'harness', 'doc', 'data-live', 'server', 'decision'] },
    lens: { type: 'string' },
    rows: { type: 'array', items: { type: 'string' }, description: 'ledger row ids this finding belongs to' },
    where: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' }, line: { type: 'integer' }, quote: { type: 'string' },
          url: { type: 'string' }, artifact: { type: 'string' },
        },
      },
      description: '{file,line,quote} for source; {url,artifact} for a rendered observation. audit12-cite.js must pass.',
    },
    reproduce: { type: 'string', description: 'exact commands or numbered steps, runnable cold on a fresh mirror' },
    observed: { type: 'string' },
    expected: { type: 'string' },
    consequence: { type: 'string', description: 'who is harmed and how; this sets the severity' },
    notInPrior: { type: 'string', description: 'which do-not-re-report sources were grepped (PLAN-12 §3.3) and why this differs' },
  },
  required: ['id', 'title', 'severity', 'class', 'lens', 'rows', 'where', 'reproduce', 'observed', 'expected', 'consequence', 'notInPrior'],
}

const FINDER = {
  type: 'object',
  properties: {
    batch: { type: 'string' },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['done', 'finding', 'blocked', 'n-a'] },
          evidence: { type: 'string', description: 'command + result, or artifact path; never "looks fine"' },
          findings: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'status', 'evidence'],
      },
    },
    findings: { type: 'array', items: FINDING },
    outOfBrief: { type: 'array', items: { type: 'string' }, description: 'file:line + one sentence, for another lens' },
    ledgerGaps: { type: 'array', items: { type: 'string' }, description: 'things that should be ledger rows and are not' },
    citeExit: { type: 'integer', description: 'exit code of audit12-cite.js on your findings file (0 when there are none)' },
  },
  required: ['batch', 'rows', 'findings', 'outOfBrief', 'ledgerGaps', 'citeExit'],
}

const VERDICT = {
  type: 'object',
  properties: {
    findingId: { type: 'string' },
    lens: { type: 'string', enum: ['reproduce', 'refute', 'severity', 'tiebreak'] },
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'not-reproduced', 'duplicate', 'settled', 'environment-artifact'] },
    severity: { type: 'string', enum: ['Blocker', 'High', 'Medium', 'Low'] },
    reason: { type: 'string', description: 'one paragraph; for any kill, the measurement that kills it' },
    measurement: { type: 'string', description: 'the command you ran and its output (trimmed), or the artifact path' },
  },
  required: ['findingId', 'lens', 'verdict', 'severity', 'reason', 'measurement'],
}

const GAP = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: FINDING },
    method: { type: 'string', description: 'what you actually did, in one paragraph' },
    ledgerGaps: { type: 'array', items: { type: 'string' } },
    citeExit: { type: 'integer' },
  },
  required: ['findings', 'method', 'ledgerGaps', 'citeExit'],
}

const CRITIC = {
  type: 'object',
  properties: {
    coverageOutput: { type: 'string', description: 'verbatim output of audit12-ledger.js --coverage' },
    spotAudit: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, holds: { type: 'boolean' }, why: { type: 'string' } }, required: ['id', 'holds', 'why'] } },
    redispatch: { type: 'array', items: { type: 'object', properties: { lens: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } }, why: { type: 'string' } }, required: ['lens', 'ids', 'why'] } },
    unexercised: { type: 'array', items: { type: 'string' }, description: 'modalities, states or surfaces nobody touched' },
  },
  required: ['coverageOutput', 'spotAudit', 'redispatch', 'unexercised'],
}

for (const [l, list] of Object.entries(A.methods || {})) METHODS[l] = [...list, ...(METHODS[l] || [])]

const COMMON = `You are one agent in AUDIT-12, a read-only audit of this repository at commit ${A.head || '(see git)'}.
Before anything else read ${PLAN} §0 (rules, all of them bind you), §3.3 (do-not-re-report), §4 (safety) and §9 (finding protocol). Do not read the rest of the plan except the section named below.
Hard rules you will be checked on:
- You change NOTHING tracked by git. You write only under ${OUT}/ . \`git status --porcelain\` must be unchanged when you finish.
- Never write to or serve _harness/site/, and never use ports 8123-8139 (the sweep and step M own them); copying FROM _harness/site is how you get a mirror. If you need a running site: cp -r _harness/site ${OUT}/m/<your label> ; serve it with php -S 127.0.0.1:<first free port at or above the one given> -t <that dir> -c _harness/php-mail.ini _harness/router.php ; stop it by PID (ps -eo pid,comm,args, comm == php, your port) — never pkill -f — and delete the copy when done.
- Every claim is measured, not inferred. Unmeasured → write [UNVERIFIED] and why. A screenshot counts only after you open it with Read.
- A finding needs a reproduction a stranger can run cold, and citations that pass \`node _harness/audit12-cite.js <your findings file>\`.
- Stay in your lens. Anything else: one line in outOfBrief, then stop thinking about it.`

const findPrompt = (b, idx) => `${COMMON}

Your lens: ${b.lens}. Read ${PLAN} §6, subsection "### ${b.lens}", in full — charter, method, instruments, exit criteria.
Your batch: ${b.batch} (wave ${WAVE}). Your first port: ${PORT + idx}.
Your ledger rows — fetch them with:
  node -e 'const ids=new Set(process.argv.slice(1));require("fs").readFileSync("${OUT}/ledger.jsonl","utf8").split("\\n").filter(Boolean).map(JSON.parse).filter(r=>ids.has(r.id)).forEach(r=>console.log(JSON.stringify(r)))' ${b.ids.join(' ')}
IDS: ${JSON.stringify(b.ids)}

For EVERY row: do its check, then record exactly one result. Statuses: done (checked, nothing wrong — evidence says how), finding (evidence + finding ids), blocked (what stopped you and what would unblock it), n-a (why the check cannot apply — rare; justify).
Write results as JSON lines to ${OUT}/rows/${b.batch}.jsonl ({id,status,evidence,findings,by:"${b.batch}"}), and findings as a JSON array to ${OUT}/findings/${b.batch}.json (ids A12-${b.batch}-1, -2, …; the schema is in §9.1).
Then run node _harness/audit12-cite.js ${OUT}/findings/${b.batch}.json and fix every failure before returning (skip if you raised none; citeExit 0).
Breadth first: give every row its check before going deep on any one. Do not stop early because you found something big.
Return the same rows and findings in the output schema.`

const verifyPrompt = (f, lens, idx, others) => `${COMMON}

You are a VERIFIER (lens: ${lens}). You did not raise this finding and must not trust its author. Your first port: ${PORT + 400 + idx}. Work from a FRESH mirror copy.
Finding (also in ${OUT}/findings/):
${JSON.stringify(f, null, 1)}

${lens === 'reproduce' ? 'Run its reproduction cold, exactly as written, on your own fresh mirror. confirmed = you observed it yourself; not-reproduced = you did not (give your measurement). If the steps are not runnable as written, that is not-reproduced.'
  : lens === 'refute' ? 'Try to REFUTE it. Is it intended behaviour (a comment, an invariant, a decision)? Settled or already reported (grep every source in PLAN-12 §3.3 and cite the hit)? An environment artifact (PLAN-12 §11)? A duplicate of another finding in ' + OUT + '/findings/? Wrong about the code? Only if every refutation fails, answer confirmed. Default to refuted when you have a measurement that kills it; never kill without one.'
  : lens === 'severity' ? 'Judge only severity, by consequence, per PLAN-12 §9.2. State who is harmed and how. Answer confirmed with the severity you assign (it may differ from the author\'s).'
  : 'Two verifiers disagreed. Their verdicts:\n' + JSON.stringify(others, null, 1) + '\nRe-measure the point they disagree on yourself and decide. confirmed or the kill verdict that the measurement supports.'}
Write your verdict to ${OUT}/verdicts/${f.id}.${lens}.json as well as returning it.`

const gapPrompt = (lens, round, seen) => `${COMMON}

Your lens: ${lens}. Read ${PLAN} §6, subsection "### ${lens}". Wave ${WAVE}, gap hunt round ${round}. Your first port: ${PORT + 800 + round * 20 + Object.keys(METHODS).indexOf(lens)}.
The row-by-row pass is done. Your job is what it MISSED. Use this method, not the ledger order:
  ${(METHODS[lens] || ['start from the buyer\'s or Rick\'s goal, not the file list'])[(round - 1) % (METHODS[lens] || [1]).length]}
Already raised for this lens (confirmed or killed — do NOT raise these again, nor a re-wording of one):
${seen.length ? seen.map((t) => '- ' + t).join('\n') : '- (none)'}
Write new findings to ${OUT}/findings/${lens}-${WAVE}-G${round}.json (ids A12-${lens}-${WAVE}-G${round}-<n>), each tied to the ledger rows it belongs to; if no row fits, it is a ledger gap — say so in ledgerGaps and still raise it with the closest row. Run audit12-cite.js on that file before returning.
Zero findings is a valid and useful answer. Do not invent one to have something to return.`

const criticPrompt = (round) => `${COMMON}

You are the COMPLETENESS CRITIC for wave ${WAVE} (lenses ${LENSES.join(', ')}), round ${round}. Read ${PLAN} §8.
1. Run node _harness/audit12-ledger.js --coverage and return its output verbatim.
2. Spot-audit 8 random "done" rows per lens of this wave (pick by \`shuf -n 8 --random-source=<(yes ${WAVE}${round})\` over the row files): does the evidence actually show the check was done (artifact exists, command output supports it)? A row whose evidence would satisfy you without the check having been run does not hold.
3. List every row of this wave's lenses that is still pending, blocked for a reason that is now gone, or has evidence that does not hold, as redispatch batches of at most 15 ids per lens with why.
4. List states, viewports, inputs or surfaces in this wave's lens charters that no evidence mentions (unexercised).
Do not raise findings yourself. Do not re-dispatch a row only because you would have checked it differently.`

// ─────────────────────────────────────────────────────────────────────────────
const key = (f) => ((f.where || []).map((w) => (w.file ? `${w.file}:${w.line}` : w.url)).join('|') + '#' + String(f.title || '').toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 60))
const seen = new Set()
const confirmed = []
const killed = []
const blocked = []
const outOfBrief = []
const ledgerGaps = []
const capped = []
const titlesByLens = {}
for (const l of LENSES) titlesByLens[l] = [...((A.prior || {})[l] || [])]
// Ports come from the finding id, never from a run-order counter: a counter
// makes the prompt depend on scheduling, and a resume would miss its cache.
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

async function verify(f) {
  const lenses = f.severity === 'Low' ? ['reproduce', 'refute'] : ['reproduce', 'refute', 'severity']
  const base = (hash(f.id) % 90) * 4
  const votes = (await parallel(lenses.map((l, i) => () =>
    agent(verifyPrompt(f, l, base + i, null), { label: `verify:${f.id}:${l}`, phase: 'Verify', schema: VERDICT })))).filter(Boolean)
  const rep = votes.find((v) => v.lens === 'reproduce')
  const ref = votes.find((v) => v.lens === 'refute')
  const sev = votes.find((v) => v.lens === 'severity')
  let alive = rep && rep.verdict === 'confirmed' && ref && ref.verdict === 'confirmed'
  let tie = null
  // Disagreement between reproduce and refute goes to a fourth agent rather than
  // to a vote: one confident refuter should not kill a reproduced finding, and
  // one reproducer should not carry a finding the refuter measured away.
  if (rep && ref && (rep.verdict === 'confirmed') !== (ref.verdict === 'confirmed')) {
    tie = await agent(verifyPrompt(f, 'tiebreak', base + 3, [rep, ref]), { label: `verify:${f.id}:tiebreak`, phase: 'Verify', schema: VERDICT })
    alive = !!tie && tie.verdict === 'confirmed'
  }
  const severity = (sev && sev.severity) || f.severity
  const rec = { ...f, severity, authorSeverity: f.severity, votes: [...votes, ...(tie ? [tie] : [])] }
  ;(alive ? confirmed : killed).push(rec)
  titlesByLens[f.lens] = titlesByLens[f.lens] || []
  titlesByLens[f.lens].push(`${alive ? '' : '[killed] '}${f.title}`)
  return rec
}

async function findAndVerify(list, tag) {
  return pipeline(list,
    (b, _o, i) => agent(findPrompt(b, i), { label: `find:${b.batch}`, phase: 'Find', schema: FINDER }),
    async (r, b) => {
      if (!r) { blocked.push({ batch: b.batch, reason: 'finder returned nothing (skipped or died)' }); return null }
      if (r.citeExit) log(`${b.batch}: citations still failing (exit ${r.citeExit}) — its findings go to verification flagged`)
      const answered = new Set(r.rows.map((x) => x.id))
      const missing = b.ids.filter((id) => !answered.has(id))
      if (missing.length) { blocked.push({ batch: b.batch, reason: `${missing.length} rows unanswered`, ids: missing }); log(`${b.batch}: ${missing.length} rows unanswered → critic will re-dispatch`) }
      outOfBrief.push(...r.outOfBrief.map((x) => `${b.batch}: ${x}`))
      ledgerGaps.push(...r.ledgerGaps.map((x) => `${b.batch}: ${x}`))
      const fresh = r.findings.filter((f) => { const k = key(f); if (seen.has(k)) return false; seen.add(k); return true })
      return parallel(fresh.map((f) => () => verify({ ...f, citeFailed: !!r.citeExit, raisedIn: `${tag}:${b.batch}` })))
    })
}

// ── 1. Find + verify, every batch ────────────────────────────────────────────
phase('Find')
log(`${WAVE}: ${BATCHES.length} batches over ${BATCHES.reduce((n, b) => n + b.ids.length, 0)} rows, lenses ${LENSES.join(' ')}`)
await findAndVerify(BATCHES, 'rows')
log(`${WAVE}: row pass done — ${confirmed.length} confirmed, ${killed.length} killed, ${blocked.length} blocked batches`)

// ── 2. Gap hunt, loop-until-dry, per lens (lenses run concurrently) ─────────
phase('Gap hunt')
await pipeline(LENSES, async (lens) => {
  let dry = 0
  let round = 0
  while (dry < DRY_TO_STOP && round < MAX_GAP_ROUNDS) {
    round++
    const g = await agent(gapPrompt(lens, round, titlesByLens[lens] || []), { label: `gap:${lens}:${round}`, phase: 'Gap hunt', schema: GAP })
    if (!g) { dry++; continue }
    ledgerGaps.push(...g.ledgerGaps.map((x) => `${lens} G${round}: ${x}`))
    const fresh = g.findings.filter((f) => { const k = key(f); if (seen.has(k)) return false; seen.add(k); return true })
    if (!fresh.length) { dry++; continue }
    dry = 0
    await parallel(fresh.map((f) => () => verify({ ...f, lens, citeFailed: !!g.citeExit, raisedIn: `gap:${lens}:${round}` })))
  }
  if (dry < DRY_TO_STOP) { capped.push(`${lens}: gap hunt stopped at the ${MAX_GAP_ROUNDS}-round cap while still finding`); log(`${lens}: gap hunt CAPPED at ${MAX_GAP_ROUNDS} rounds, still finding — recorded`) }
  return round
})

// ── 3. Completeness critic, re-dispatching until it has nothing to send ─────
phase('Critic')
const critics = []
for (let round = 1; round <= MAX_CRITIC_ROUNDS; round++) {
  const c = await agent(criticPrompt(round), { label: `critic:${WAVE}:${round}`, phase: 'Critic', schema: CRITIC })
  if (!c) { capped.push(`critic round ${round} returned nothing`); break }
  critics.push(c)
  const re = c.redispatch.filter((r) => LENSES.includes(r.lens) && r.ids.length)
  if (!re.length) break
  if (round === MAX_CRITIC_ROUNDS) { capped.push(`critic still re-dispatching ${re.reduce((n, r) => n + r.ids.length, 0)} rows after ${MAX_CRITIC_ROUNDS} rounds`); break }
  log(`critic round ${round}: re-dispatching ${re.reduce((n, r) => n + r.ids.length, 0)} rows`)
  await findAndVerify(re.map((r, i) => ({ batch: `${r.lens}-${WAVE}-R${round}-${i + 1}`, lens: r.lens, ids: r.ids.slice(0, 15), why: r.why })), `critic${round}`)
}

const bySev = {}
for (const f of confirmed) bySev[f.severity] = (bySev[f.severity] || 0) + 1
log(`${WAVE} done: ${confirmed.length} confirmed (${Object.entries(bySev).map(([s, n]) => `${s} ${n}`).join(', ') || 'none'}), ${killed.length} killed, ${capped.length} caps hit`)
return {
  wave: WAVE,
  lenses: LENSES,
  batches: BATCHES.length,
  confirmed: confirmed.map((f) => ({ id: f.id, severity: f.severity, authorSeverity: f.authorSeverity, class: f.class, lens: f.lens, title: f.title, citeFailed: f.citeFailed, raisedIn: f.raisedIn })),
  killed: killed.map((f) => ({ id: f.id, lens: f.lens, title: f.title, by: f.votes.filter((v) => v.verdict !== 'confirmed').map((v) => `${v.lens}:${v.verdict}`) })),
  blocked,
  outOfBrief,
  ledgerGaps,
  capped,
  critic: critics.map((c) => ({ redispatched: c.redispatch.reduce((n, r) => n + r.ids.length, 0), spotFails: c.spotAudit.filter((s) => !s.holds).length, unexercised: c.unexercised })),
}
