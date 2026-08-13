/**
 * Proves `contactflow.js` can fail.
 *
 * `contactflow.js` passed 71/71 the first time it was ever run. That is exactly
 * the shape of a suite that asserts nothing, and this repo has been bitten by
 * one before — which is why `invariants-selftest.js`, `plan2-formlast-selftest.js`
 * and `copydrift-selftest.js` all exist. A check that cannot fail is not a check.
 *
 * Each mutation below breaks ONE guarantee in the MIRROR (`_harness/site`),
 * never in the source tree, and the run is a pass only if the named assertion
 * flips to FAIL. A mutation that leaves the suite green is reported as
 * "MUTATION SURVIVED" — the suite, not the site, is the thing that failed.
 *
 * The mirror is restored in a `finally`, and the restore is verified byte for
 * byte before anything is reported, on the same reasoning as
 * `plan10-auditlog.js`: a selftest that leaves a mutated mirror behind poisons
 * every suite run after it.
 *
 * Six mutations are server-side (`site/contact.php`) and two are client-side
 * (the built bundle) — deliberately both, because the whole point of
 * `contactflow.js` is that it spans the two halves that no other suite spans.
 *
 * Needs the mirror on :8123, as `contactflow.js` does.
 *
 * Usage: node _harness/contactflow-selftest.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = path.join(__dirname, 'site');
const PHP = path.join(SITE, 'contact.php');
const ASSETS = path.join(SITE, 'assets');

const bundlePath = () => {
  const f = fs.readdirSync(ASSETS).find((x) => /^index-.*\.js$/.test(x));
  if (!f) throw new Error('no built bundle in the mirror — run npm run build && sh _harness/sync.sh');
  return path.join(ASSETS, f);
};

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/**
 * Run one scenario of contactflow.js and return the lines it printed.
 * A non-zero exit is expected here — that is the point — so the throw carries
 * the output and is unwrapped rather than propagated.
 */
function runScenario(tag) {
  try {
    return execFileSync('node', [path.join(__dirname, 'contactflow.js'), `--only=${tag}`],
      { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

/** Did the named assertion report FAIL in this output? */
const failed = (out, needle) =>
  out.split('\n').some((l) => l.startsWith('FAIL') && l.includes(needle));

/** Did the named assertion appear at all? A typo'd needle must not read as a pass. */
const present = (out, needle) => out.includes(needle);

// ── The mutations ──────────────────────────────────────────────────────────
// `find` must match the pristine mirror exactly; a silent no-op replace would
// make the mutation vacuous and the survival report meaningless, so every
// application is verified to have changed the file.
const MUTATIONS = [
  {
    name: 'strip_tags() in s() — the incident invariant 10 names',
    file: () => PHP,
    find: '    $v = trim((string)$val);',
    repl: '    $v = trim(strip_tags((string)$val));',
    tag: 'rfq',
    expect: 'the angle-bracketed spec survived',
  },
  {
    name: 'htmlspecialchars() in s() — the double-escape incident',
    file: () => PHP,
    find: '    $v = trim((string)$val);',
    repl: '    $v = htmlspecialchars(trim((string)$val), ENT_QUOTES);',
    tag: 'rfq',
    expect: 'the company name is not HTML-escaped',
  },
  {
    name: 'the Reply-To header is dropped — sales can no longer just hit reply',
    file: () => PHP,
    find: '$headers .= "Reply-To: " . hdr($replyTo) . "\\r\\n";',
    repl: '',
    tag: 'rfq',
    expect: 'Reply-To is the visitor',
  },
  {
    name: 'the auto-reply is suppressed — the visitor gets no confirmation',
    file: () => PHP,
    find: 'if ($autoReplyOk) {',
    repl: 'if (false) {',
    tag: 'rfq',
    expect: 'exactly two messages left',
  },
  {
    name: 'a honeypot hit is dropped instead of logged (4.18)',
    file: () => PHP,
    // Anchored on the CALL, not on the note string inside it: the first draft
    // of this mutation replaced the note and left the log call standing, so the
    // entry was still written and the mutation survived — reported by this
    // selftest, which is what it is for.
    find: "    ipc_log_inquiry(ipc_partial_entry(\n        'honeypot',",
    repl: "    if (false) ipc_log_inquiry(ipc_partial_entry(\n        'honeypot',",
    tag: 'honeypot',
    expect: 'the submission is still logged',
  },
  {
    name: 'the length cap is removed — a 1MB message reaches the inbox whole',
    file: () => PHP,
    find: '    if ($max > 0 && strlen($v) > $max) {',
    repl: '    if (false) {',
    tag: 'truncation',
    expect: 'the cut is announced in the email',
  },
  {
    name: 'a posted field is renamed in the shipped bundle (partNumber -> partNo)',
    file: bundlePath,
    find: 'name:"partNumber"',
    repl: 'name:"partNo"',
    tag: 'drift',
    expect: 'every field the rfq form posts is one contact.php reads',
  },
  {
    name: 'the message-tab label bug is put back (four labels -> one input)',
    file: bundlePath,
    // A REGEX, not a fixed string. This anchored on `${j.name}` — and `j` is a
    // name esbuild chose for a local, not anything the source controls. The
    // bundle emits `${P.name}` today and emitted `${P.name}` before this
    // release too, so the anchor had been dead for some time: the selftest
    // correctly refused to give a vacuous pass, and correctly reported the
    // drift, but its negative control for the label bug was not running.
    // Any edit anywhere in App.jsx can re-roll that letter, so pinning it is a
    // trap that resets itself. (audit-runs/audit3.md C-03)
    find: /htmlFor:`msg-\$\{\w+\.name\}`/,
    repl: 'htmlFor:"msg-subject"',
    tag: 'labels',
    expect: 'every message field has an associated label',
  },
];

(async () => {
  const originals = new Map();
  const remember = (f) => { if (!originals.has(f)) originals.set(f, fs.readFileSync(f, 'utf8')); };

  try {
    for (const m of MUTATIONS) {
      const file = m.file();
      remember(file);
      const before = originals.get(file);
      const anchored = m.find instanceof RegExp ? m.find.test(before) : before.includes(m.find);
      if (!anchored) {
        note(false, `mutation applies: ${m.name}`,
          `the anchor was not found in ${path.basename(file)} — the mirror has drifted from what this selftest was written against, so the result below would be vacuous`);
        continue;
      }
      const after = before.replace(m.find, m.repl);
      note(after !== before, `mutation applies: ${m.name}`, 'the replace was a no-op');
      fs.writeFileSync(file, after);

      const out = runScenario(m.tag);
      fs.writeFileSync(file, before);   // restore immediately; the finally is the backstop

      note(present(out, m.expect), `the assertion under test ran: "${m.expect}"`,
        `it never appeared in the --only=${m.tag} output, so the mutation proves nothing`);
      note(failed(out, m.expect), `MUTATION CAUGHT: ${m.name}`,
        `contactflow.js stayed green with this broken — "${m.expect}" did not fail`);
    }
  } finally {
    for (const [f, body] of originals) {
      fs.writeFileSync(f, body);
      const ok = fs.readFileSync(f, 'utf8') === body;
      note(ok, `mirror restored byte-for-byte: ${path.basename(f)}`, 'the mirror is STILL MUTATED — re-run sh _harness/sync.sh');
    }
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\ncontactflow-selftest: ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})();
