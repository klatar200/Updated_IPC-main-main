/**
 * PLAN-12 Phase 1 — the coverage ledger, DERIVED from the repository, never
 * typed. Every row is one thing the audit must look at, owned by exactly one
 * lens (plans/PLAN-12-full-project-audit.md §6). Earlier ledgers were written
 * by hand and missed the harness itself, `.claude/`, `package-lock.json` and a
 * suite that never ran (audit-runs/missed-coverage.md; WHATS_LEFT history
 * §1aq). A generator cannot forget a file that `git ls-files` lists.
 *
 *   node _harness/audit12-ledger.js              write _harness/out/audit12/ledger.{jsonl,md}, print counts
 *   node _harness/audit12-ledger.js --check      also exit 1 if a derivation produced zero rows or a problem
 *   node _harness/audit12-ledger.js --coverage   merge _harness/out/audit12/rows/*.jsonl into the ledger and
 *                                                print per-lens status; exit 1 on unknown ids, thin
 *                                                evidence or conflicting statuses
 *   node _harness/audit12-ledger.js --final      as --coverage, and exit 1 while any row is still pending
 *   node _harness/audit12-ledger.js --batches    write _harness/out/audit12/batches.json: the rows still
 *                                                pending, cut into per-lens batches (BATCH below) — the
 *                                                Workflow's `args`. INVARIANT rows are left out: they
 *                                                are step M's (serial mutation, PLAN-12 §5.4)
 *   node _harness/audit12-ledger.js --args W2 L3,L4,L5,L15
 *                                                write _harness/out/audit12/args-W2.json: that wave's
 *                                                batches + every title already raised per lens + HEAD
 *   node _harness/audit12-ledger.js --add L9 "<target>" "<where>" "<check>"
 *                                                append one GAP row (a ledger gap a finder reported);
 *                                                never renumbers existing rows
 *   node _harness/audit12-ledger.js --tally      count findings/*.json against verdicts/*.json with the
 *                                                workflow's survival rule; the report's numbers come
 *                                                from here, never typed
 *
 * Row:    { id, kind, lens, target, where, check }
 * Result: { id, status: done|finding|blocked|n-a, evidence, findings?: [ids], by }   (one JSON object per line)
 * IDs are stable for a given commit (kind prefix + ordinal) so results and
 * findings can cite them. Regenerating on a different commit renumbers — the
 * ledger is generated ONCE, in Phase 1, and its commit is recorded.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'audit12');
const FLAG = ['--final', '--coverage', '--batches', '--args', '--add', '--tally', '--check'].find((f) => process.argv.includes(f));
const MODE = FLAG ? FLAG.slice(2) : 'write';
const argAfter = (flag, n) => process.argv[process.argv.indexOf(flag) + n];
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const LENSES = {
  L1: 'Build, dependencies, shipped tree',
  L2: 'PHP 7.4 / host / Apache behaviour',
  L3: 'Security',
  L4: 'Data integrity and admin round-trips',
  L5: 'Server–client parity and merge rules',
  L6: 'Public UX and IA, route × viewport × state',
  L7: 'Accessibility',
  L8: 'Content truth and wording',
  L9: 'Owner journeys and Help',
  L10: 'SEO and sharing',
  L11: 'Performance and robustness',
  L12: 'Documentation and runbook truth',
  L13: 'Harness integrity and invariants',
  L14: 'Records and regression since audit 9',
  L15: 'Code reading, declaration by declaration',
};

// Rows per finder agent. Sized so one agent holds its rows' sources in context
// at once: a route's 20 states share one page; 12 declarations of App.jsx are
// ~400 lines; a Help section round-trip is slow, so L9 stays small.
const BATCH = { L1: 20, L2: 25, L3: 15, L4: 6, L5: 15, L6: 20, L7: 10, L8: 15, L9: 15, L10: 26, L11: 25, L12: 25, L13: 15, L14: 25, L15: 12 };

if (MODE === 'coverage' || MODE === 'final') { coverage(); process.exit(process.exitCode || 0); }
if (MODE === 'batches') { batches(); process.exit(0); }
if (MODE === 'args') { waveArgs(argAfter('--args', 1), String(argAfter('--args', 2) || '').split(',').filter(Boolean)); process.exit(0); }
if (MODE === 'add') { addGap(argAfter('--add', 1), argAfter('--add', 2), argAfter('--add', 3), argAfter('--add', 4)); process.exit(0); }
if (MODE === 'tally') { tally(); process.exit(0); }

const rows = [];
const counters = {};
const problems = [];
const add = (kind, lens, target, where, check) => {
  if (!LENSES[lens]) throw new Error(`unknown lens ${lens}`);
  counters[kind] = (counters[kind] || 0) + 1;
  rows.push({ id: `${kind}-${String(counters[kind]).padStart(4, '0')}`, kind, lens, target, where, check });
};

// ── FILE: every tracked file, owned by the lens that judges its content ─────
const files = sh('git', ['ls-files']).split('\n').filter(Boolean);
const lensForFile = (f) => {
  if (/^dist\//.test(f)) return ['L1', 'byte-identical to a fresh `npm run build`'];
  if (/^src\//.test(f) || f === 'index.html' || f === 'public/index.php') return ['L15', 'read whole; every branch reachable and correct'];
  if (/\.htaccess$|\.user\.ini$/.test(f)) return ['L2', 'every directive does what its comment says, on real Apache'];
  if (/^(admin|public)\/.*\.php$/.test(f)) return ['L3', 'auth, CSRF, escaping, containment, error paths'];
  if (/^admin\/.*\.js$/.test(f)) return ['L9', 'behaviour in the dashboard matches Help'];
  if (/^data\//.test(f)) return ['L8', 'every value true and well-formed'];
  if (/^pdfs\//.test(f)) return ['L8', 'linked from a product, is that product\'s sheet'];
  if (/\.(png|jpe?g|webp|svg|gif|ico|avif)$/i.test(f)) return ['L11', 'used somewhere, weight justified, right subject'];
  if (/^_harness\//.test(f)) return ['L13', 'run by the sweep or classified as a helper/instrument; asserts what it says'];
  if (/^audit-runs\//.test(f)) return ['L14', 'frozen record: live docs cite it correctly'];
  if (/\.md$/.test(f)) return ['L12', 'every factual claim checked against code or a command'];
  return ['L1', 'needed, correct, consistent with the build'];
};
for (const f of files) { const [l, c] = lensForFile(f); add('FILE', l, f, f, c); }
for (const f of files.filter((x) => /\.php$/.test(x) && !/^(_harness|dist)\//.test(x))) add('FILE', 'L2', `${f} (PHP 7.4 syntax, no mb_*, E_ALL clean)`, f, 'php7.4-compat scan + E_ALL run of its paths');

// ── DECL: every top-level declaration in src/App.jsx and the PHP libraries ───
read('src/App.jsx').split('\n').forEach((l, i) => {
  const m = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/.exec(l);
  if (m) add('DECL', 'L15', m[1], `src/App.jsx:${i + 1}`, 'read in full: inputs, empty/missing data, error paths, effect cleanup, keys');
});
for (const f of ['public/index.php', 'public/contact.php', 'public/sitemap.php', 'admin/config.php']) {
  read(f).split('\n').forEach((l, i) => {
    const m = /^function\s+([a-z_][a-z0-9_]*)\s*\(/i.exec(l);
    if (m) add('DECL', f === 'admin/config.php' ? 'L3' : 'L15', `${f} ${m[1]}()`, `${f}:${i + 1}`, 'read in full: every caller, every return path, failure behaviour');
  });
}

// ── ROUTE × viewport × state, PRODUCT × lens ─────────────────────────────────
const seoBlock = read('src/App.jsx').match(/const SEO_DEFAULT = \[([\s\S]*?)\n\];/);
const routes = seoBlock ? [...seoBlock[1].matchAll(/page:\s*"([a-z-]+)"/g)].map((m) => (m[1] === 'home' ? '/' : '/' + m[1])) : [];
if (!routes.length) problems.push('ROUTE: SEO_DEFAULT not found');
const STATES = ['normal', 'javascript-off', 'catalog-503', 'content-json-damaged', 'reduced-motion + 200% zoom'];
for (const r of routes) {
  for (const w of [390, 834, 1024, 1440]) for (const s of STATES) add('ROUTE', 'L6', `${r} @${w} [${s}]`, r, 'renders, reads, works; nothing clipped, overlapping, dead or wrong');
  for (const w of [390, 1440]) add('ROUTE', 'L7', `${r} @${w}`, r, 'axe + keyboard-only + accessible names/order + contrast of every text node');
  add('ROUTE', 'L10', `${r} head`, r, 'title, description, canonical, og:*, JSON-LD; served HTML equals hydrated head');
  add('ROUTE', 'L11', `${r} @390 cold`, r, 'transfer bytes, requests, LCP, CLS, console, failed requests');
}
const cat = JSON.parse(read('data/products-all.json'));
const products = Array.isArray(cat) ? cat : cat.products || [];
for (const p of products) {
  const u = `/products?productId=${p.id}`;
  add('PRODUCT', 'L8', `${u}`, `data/products-all.json id=${p.id}`, 'specs, family, PDF and photo are this part\'s; wording consistent');
  add('PRODUCT', 'L6', `${u} @390`, u, 'layout, spec table, Datasheet/RFQ actions');
  add('PRODUCT', 'L10', `${u} head`, u, 'title fits, description, canonical, Product JSON-LD valid and true');
}

// ── ADMIN: every page view, every <form>, every named action, every input ────
for (const f of files.filter((x) => /^admin\/[^/]+\.php$/.test(x))) {
  const src = read(f);
  add('ADMIN', 'L9', `${f} GET (signed in, at 390 and 1440)`, f, 'Rick can tell what it does and do it; matches Help');
  add('ADMIN', 'L3', `${f} GET signed out / expired session`, f, 'no content leaked; a POST is not discarded (invariant 12)');
  let n = 0;
  for (const m of src.matchAll(/<form\b[^>]*>/g)) {
    n++;
    add('ADMIN', 'L3', `${f} <form> #${n} POST: CSRF missing / stale signature / oversized / hostile`, `${f}:${src.slice(0, m.index).split('\n').length}`, 'refused cleanly, nothing written, message is true');
  }
  for (const a of new Set([...src.matchAll(/(?:name="action" value=|\$action === )['"]([a-z_-]+)['"]/g)].map((m) => m[1]))) {
    add('ADMIN', 'L4', `${f} action=${a}`, f, 'save → disk → public site → backup → restore → audit log');
  }
  for (const k of new Set([...src.matchAll(/\$_(POST|GET|FILES)\[['"]([A-Za-z_]+)['"]\]/g)].map((m) => `${m[1]}.${m[2]}`))) {
    add('ADMIN', 'L3', `${f} input ${k} (absent / empty / array / hostile)`, f, 'no notice, no write, no reflection');
  }
}

// ── ENDPOINT: public PHP entry points and their inputs ───────────────────────
for (const f of ['public/contact.php', 'public/sitemap.php', 'public/index.php']) {
  const src = read(f);
  add('ENDPOINT', 'L3', `${f} method matrix (GET/POST/HEAD/OPTIONS, empty, oversized, wrong content-type)`, f, 'status and body are deliberate');
  for (const k of new Set([...src.matchAll(/\$_(?:POST|GET|SERVER|REQUEST)\[['"]([A-Za-z_]+)['"]\]/g)].map((m) => m[1]))) {
    add('ENDPOINT', 'L3', `${f} input ${k}`, f, 'hostile values: injection, header, path, size, encoding');
  }
}
add('ENDPOINT', 'L4', 'public/contact.php lead path: email AND Inquiries row, both forms', 'public/contact.php', 'a Blocker if either half fails');

// ── HTACCESS: every directive (source trees; L1 proves dist/ equals them) ────
for (const f of files.filter((x) => /\.htaccess$/.test(x) && !/^dist\//.test(x))) {
  read(f).split('\n').forEach((l, i) => {
    if (/^\s*(<FilesMatch|<Files\b|<IfModule|<If\b|Rewrite(Rule|Cond|Engine)|Header|SetEnvIf|Options|DirectoryIndex|AddType|ForceType|ErrorDocument|Order|Deny|Allow|Require|<Limit|Expires|php_)/.test(l)) {
      add('HTACCESS', 'L2', `${f}: ${l.trim().slice(0, 80)}`, `${f}:${i + 1}`, 'measured on real Apache under mod_php, and proxy_fcgi where it differs');
    }
  });
}

// ── DATA: every field shape in the three JSON files ──────────────────────────
const productKeys = new Set();
for (const p of products) for (const k of Object.keys(p)) productKeys.add(k);
for (const k of productKeys) add('DATA', 'L8', `products[].${k}`, 'data/products-all.json', `type, presence across ${products.length}, where it renders, true`);
const flat = (o, pre, out) => {
  if (o && typeof o === 'object' && !Array.isArray(o)) for (const k of Object.keys(o)) flat(o[k], pre ? `${pre}.${k}` : k, out);
  else out.push(pre);
  return out;
};
for (const k of flat(JSON.parse(read('data/site-info.json')), '', [])) add('DATA', 'L5', `site-info.${k}`, 'data/site-info.json', 'blank / missing / wrong type: mergeSiteInfo and index.php agree (invariant 4)');
const content = JSON.parse(read('data/content.json'));
for (const k of Object.keys(content)) {
  if (k === 'copy') for (const g of Object.keys(content.copy)) add('DATA', 'L5', `content.copy.${g}`, 'data/content.json', 'blank / missing: default vs empty is deliberate, both renderers agree');
  else add('DATA', 'L5', `content.${k}${Array.isArray(content[k]) ? ` [${content[k].length} rows]` : ''}`, 'data/content.json', 'an empty array is a deletion (invariant 3); index.php agrees');
}

// ── FIELD: every owner-editable field → where it renders ─────────────────────
try {
  for (const g of JSON.parse(sh('php', [path.join('_harness', 'dump-copy-groups.php')]))) {
    add('FIELD', 'L9', `Page Content copy.${g.group}.${g.key}`, 'admin/content.php $COPY_GROUPS', 'edit → save → renders where Help says → clear → default or empty, as Help says');
  }
} catch (e) { problems.push('FIELD: dump-copy-groups.php failed: ' + e.message.slice(0, 120)); }
const settings = read('admin/settings.php');
for (const n of new Set([...settings.matchAll(/name="([a-z][a-z0-9_]*(?:\[\])?)"/gi)].map((m) => m[1]))) {
  if (/^(csrf|orig_sig|form_complete)$/.test(n)) continue;
  add('FIELD', 'L9', `Business Details ${n}`, 'admin/settings.php', 'round-trip; the public site and index.php both show it');
}
const sections = read('admin/content.php').match(/\$SECTIONS = \[([\s\S]*?)\n\];/);
if (sections) for (const m of sections[1].matchAll(/^    '([a-zA-Z]+)' => \[/gm)) add('FIELD', 'L4', `Page Content section ${m[1]}: add / reorder / remove all / save`, 'admin/content.php $SECTIONS', 'invariants 3 and 6; backup written; restore works');
else problems.push('FIELD: $SECTIONS not found');

// ── DOC: every heading of every live document is a block of claims ───────────
const frozen = /^audit-runs\/|^_harness\/AUDIT1[01]-REPORT\.md$|^DEPLOY_READINESS_v2\.md$|^UX_AUDIT_PREPROD/;
for (const f of files.filter((x) => /\.md$/.test(x) && !frozen.test(x))) {
  read(f).split('\n').forEach((l, i) => {
    if (/^#{1,3} /.test(l)) add('DOC', 'L12', `${f}: ${l.replace(/^#+\s*/, '').slice(0, 90)}`, `${f}:${i + 1}`, 'every claim under this heading checked against code or a command');
  });
}
for (const m of read('admin/help.php').matchAll(/<section class="help-section" id="([a-z0-9-]+)"/g)) {
  add('DOC', 'L9', `admin/help.php #${m[1]}`, 'admin/help.php', 'every instruction performed in the dashboard, as written');
}

// ── INVARIANT: CLAUDE.md's numbered invariants ───────────────────────────────
const claude = read('CLAUDE.md');
const inv = claude.slice(claude.indexOf('## Invariants'), claude.indexOf('## Security posture'));
const invNums = [];
for (const m of inv.matchAll(/^(\d+)\. \*\*([\s\S]+?)\*\*/gm)) {
  invNums.push(+m[1]);
  add('INVARIANT', 'L13', `#${m[1]} ${m[2].replace(/\s+/g, ' ').slice(0, 90)}`, 'CLAUDE.md', 'still true in code; break it on a scratch copy and the named suite goes red');
}
// A bold title that wraps a line once hid 9 of 19 invariants from this regex.
if (!invNums.length || invNums.some((n, i) => n !== i + 1)) problems.push(`INVARIANT: numbering not contiguous from 1 (${invNums.join(',')})`);

// ── SUITE: every sweep suite ─────────────────────────────────────────────────
for (const s of read('_harness/sweep-list.txt').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
  add('SUITE', 'L13', s, `_harness/${s}.js`, 'asserts what _harness/README says; can fail (one mutation shown red)');
}

// ── RECORD: open and settled items must still be true ────────────────────────
read('WHATS_LEFT.md').split('\n').forEach((l, i) => {
  if (/^\| (?!Item|Topic|When|---)/.test(l)) add('RECORD', 'L14', l.split('|')[1].trim().slice(0, 90), `WHATS_LEFT.md:${i + 1}`, 'still open / still settled / still accurate — re-verify, never re-propose');
});

// ── write ────────────────────────────────────────────────────────────────────
const head = sh('git', ['rev-parse', '--short', 'HEAD']).trim();
fs.mkdirSync(path.join(OUT, 'rows'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'ledger.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const esc = (s) => String(s).replace(/\|/g, '\\|');
fs.writeFileSync(path.join(OUT, 'ledger.md'), [`# AUDIT-12 ledger — generated at ${head}, ${rows.length} rows`, '', '| ID | Lens | Target | Where | Check |', '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.lens} | ${esc(r.target)} | ${esc(r.where)} | ${esc(r.check)} |`)].join('\n') + '\n');
console.log(`audit12 ledger @ ${head}: ${rows.length} rows`);
console.log('  by kind: ' + Object.entries(counters).map(([k, v]) => `${k} ${v}`).join(' · '));
const byLens = {};
for (const r of rows) byLens[r.lens] = (byLens[r.lens] || 0) + 1;
console.log('  by lens: ' + Object.keys(LENSES).map((l) => `${l} ${byLens[l] || 0}`).join(' · '));
const zero = ['FILE', 'DECL', 'ROUTE', 'PRODUCT', 'ADMIN', 'ENDPOINT', 'HTACCESS', 'DATA', 'FIELD', 'DOC', 'INVARIANT', 'SUITE', 'RECORD'].filter((k) => !counters[k]);
const emptyLens = Object.keys(LENSES).filter((l) => !byLens[l]);
for (const p of problems) console.log(`  PROBLEM ${p}`);
if (zero.length) console.log(`  ZERO ROWS (kind): ${zero.join(', ')}`);
if (emptyLens.length) console.log(`  ZERO ROWS (lens): ${emptyLens.join(', ')}`);
if (MODE === 'check' && (zero.length || emptyLens.length || problems.length)) process.exit(1);

// ── --coverage / --final ─────────────────────────────────────────────────────
function coverage() {
  const ledger = fs.readFileSync(path.join(OUT, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byId = new Map(ledger.map((r) => [r.id, r]));
  const status = new Map();
  const errors = [];
  const dir = path.join(OUT, 'rows');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl')).sort() : []) {
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => {
      if (!l.trim()) return;
      let r;
      try { r = JSON.parse(l); } catch { errors.push(`${f}:${i + 1} not JSON`); return; }
      if (!byId.has(r.id)) { errors.push(`${f}:${i + 1} unknown row ${r.id}`); return; }
      if (!['done', 'finding', 'blocked', 'n-a'].includes(r.status)) { errors.push(`${f}:${i + 1} ${r.id} bad status ${r.status}`); return; }
      if (!r.evidence || String(r.evidence).trim().length < 12) { errors.push(`${f}:${i + 1} ${r.id} evidence missing or too thin`); return; }
      if (r.status === 'finding' && !(r.findings || []).length) { errors.push(`${f}:${i + 1} ${r.id} status finding with no finding id`); return; }
      const prev = status.get(r.id);
      // A later result may upgrade done → finding (a verifier found more); any other disagreement is a conflict.
      if (prev && prev.status !== r.status && !(prev.status === 'done' && r.status === 'finding')) errors.push(`${r.id} conflicting status ${prev.status} (${prev.file}) vs ${r.status} (${f})`);
      status.set(r.id, { ...r, file: f });
    });
  }
  const tally = {};
  for (const r of ledger) {
    const s = status.has(r.id) ? status.get(r.id).status : 'pending';
    tally[r.lens] = tally[r.lens] || { pending: 0, done: 0, finding: 0, blocked: 0, 'n-a': 0, total: 0 };
    tally[r.lens][s]++; tally[r.lens].total++;
  }
  console.log('lens  total  done  finding  blocked  n-a  pending');
  let pending = 0;
  for (const l of Object.keys(LENSES)) {
    const t = tally[l]; if (!t) continue;
    pending += t.pending;
    console.log(`${l.padEnd(5)} ${String(t.total).padStart(5)} ${String(t.done).padStart(5)} ${String(t.finding).padStart(8)} ${String(t.blocked).padStart(8)} ${String(t['n-a']).padStart(4)} ${String(t.pending).padStart(8)}`);
  }
  console.log(`pending ${pending} of ${ledger.length}`);
  // The filled ledger — what audit-runs/audit12-ledger.md is copied from (PLAN-12 §12).
  const e = (x) => String(x == null ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  fs.writeFileSync(path.join(OUT, 'ledger-status.md'), ['| ID | Lens | Target | Status | Evidence | Findings |', '|---|---|---|---|---|---|',
    ...ledger.map((r) => { const s = status.get(r.id); return `| ${r.id} | ${r.lens} | ${e(r.target)} | ${s ? s.status : 'pending'} | ${e(s ? s.evidence : '').slice(0, 300)} | ${e(s ? (s.findings || []).join(' ') : '')} |`; })].join('\n') + '\n');
  for (const e of errors) console.log('ERROR ' + e);
  if (errors.length || (MODE === 'final' && pending)) process.exitCode = 1;
}

function results() {
  const done = new Set();
  const dir = path.join(OUT, 'rows');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl')) : []) {
    for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      try { const r = JSON.parse(l); if (r.id && r.status && String(r.evidence || '').trim().length >= 12) done.add(r.id); } catch { /* --coverage reports it */ }
    }
  }
  return done;
}

function batches() {
  const ledger = fs.readFileSync(path.join(OUT, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const done = results();
  const out = [];
  for (const lens of Object.keys(LENSES)) {
    const ids = ledger.filter((r) => r.lens === lens && r.kind !== 'INVARIANT' && !done.has(r.id)).map((r) => r.id);
    for (let i = 0; i < ids.length; i += BATCH[lens]) {
      out.push({ batch: `${lens}-${String(out.filter((b) => b.lens === lens).length + 1).padStart(2, '0')}`, lens, ids: ids.slice(i, i + BATCH[lens]) });
    }
  }
  fs.writeFileSync(path.join(OUT, 'batches.json'), JSON.stringify(out) + '\n');
  const per = {};
  for (const b of out) per[b.lens] = (per[b.lens] || 0) + 1;
  console.log(`audit12 batches: ${out.length} batches over ${out.reduce((n, b) => n + b.ids.length, 0)} pending rows → _harness/out/audit12/batches.json`);
  console.log('  ' + Object.entries(per).map(([l, n]) => `${l} ${n}`).join(' · '));
  return out;
}

function readJsonDir(sub) {
  const dir = path.join(OUT, sub);
  const out = [];
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort() : []) {
    try { const v = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); out.push(...(Array.isArray(v) ? v : [v]).map((x) => ({ ...x, _file: f }))); } catch { console.log(`  unreadable ${sub}/${f}`); }
  }
  return out;
}

function waveArgs(wave, lenses) {
  if (!wave || !lenses.length || lenses.some((l) => !LENSES[l])) { console.log('usage: --args <wave> <L1,L2,...>'); process.exit(2); }
  const all = batches().filter((b) => lenses.includes(b.lens));
  const prior = {};
  for (const f of readJsonDir('findings')) if (f.lens && f.title) (prior[f.lens] = prior[f.lens] || []).push(f.title);
  const head = sh('git', ['rev-parse', '--short', 'HEAD']).trim();
  const a = { wave, head, lenses, portBase: 10000, batches: all, prior };
  const file = path.join(OUT, `args-${wave}.json`);
  fs.writeFileSync(file, JSON.stringify(a) + '\n');
  console.log(`${file}: ${all.length} batches, ${all.reduce((n, b) => n + b.ids.length, 0)} rows, ${Object.values(prior).flat().length} prior titles, ${fs.statSync(file).size} bytes`);
}

function addGap(lens, target, where, check) {
  if (!LENSES[lens] || !target || !where || !check) { console.log('usage: --add <lens> "<target>" "<where>" "<check>"'); process.exit(2); }
  const file = path.join(OUT, 'ledger.jsonl');
  const ledger = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const n = ledger.filter((r) => r.kind === 'GAP').length + 1;
  const row = { id: `GAP-${String(n).padStart(4, '0')}`, kind: 'GAP', lens, target, where, check };
  fs.appendFileSync(file, JSON.stringify(row) + '\n');
  console.log(`added ${row.id} (${lens}) ${target}`);
}

// The workflow's survival rule (audit12-workflow.js verify()), restated over the
// files on disk: reproduce AND refute confirmed, or a tiebreak that confirmed.
function tally() {
  const findings = readJsonDir('findings');
  const votes = readJsonDir('verdicts');
  const byF = {};
  for (const v of votes) (byF[v.findingId] = byF[v.findingId] || {})[v.lens] = v;
  const rows = { confirmed: [], killed: [], unverified: [] };
  const ids = new Set();
  for (const f of findings) {
    if (ids.has(f.id)) { console.log(`  duplicate finding id ${f.id}`); continue; }
    ids.add(f.id);
    const v = byF[f.id] || {};
    if (!v.reproduce || !v.refute) { rows.unverified.push(f); continue; }
    const agree = (v.reproduce.verdict === 'confirmed') === (v.refute.verdict === 'confirmed');
    const alive = agree ? v.reproduce.verdict === 'confirmed' : !!(v.tiebreak && v.tiebreak.verdict === 'confirmed');
    if (!agree && !v.tiebreak) { rows.unverified.push(f); continue; }
    const sev = (v.severity && v.severity.severity) || f.severity;
    (alive ? rows.confirmed : rows.killed).push({ ...f, severity: sev });
  }
  const count = (list, k) => list.reduce((m, f) => ((m[f[k]] = (m[f[k]] || 0) + 1), m), {});
  console.log(`findings ${findings.length} · confirmed ${rows.confirmed.length} · killed ${rows.killed.length} · unverified ${rows.unverified.length}`);
  for (const k of ['severity', 'class', 'lens']) console.log(`  confirmed by ${k}: ` + Object.entries(count(rows.confirmed, k)).sort().map(([a, b]) => `${a} ${b}`).join(' · '));
  for (const f of rows.unverified) console.log(`  UNVERIFIED ${f.id} (${f._file})`);
  fs.writeFileSync(path.join(OUT, 'tally.json'), JSON.stringify({ confirmed: rows.confirmed.map((f) => f.id), killed: rows.killed.map((f) => f.id), unverified: rows.unverified.map((f) => f.id) }, null, 1) + '\n');
}
