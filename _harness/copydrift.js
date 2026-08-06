/**
 * NB-copy — the two sides of the page-copy contract, enumerated mechanically.
 *
 * admin/content.php's $COPY_GROUPS declares every `copy` field the admin OFFERS
 * Rick. src/App.jsx's COPY_DEFAULTS declares every `copy` field the site can
 * RENDER. They are declared independently and nothing has ever compared them.
 *
 * mergeContent() iterates Object.keys(defaults). A key the admin posts that has
 * no entry in COPY_DEFAULTS is therefore never read: it is written into
 * content.json, reported saved with a green banner, and never appears on the
 * site. Rick's edit is gone and nothing tells him.
 *
 *   PHP-only  -> the live defect. A field offered that can never render.
 *   JS-only   -> milder. A default rendered that Rick can never edit.
 *
 * Run:  node _harness/copydrift.js          (report + exit 1 on PHP-only drift)
 *       node _harness/copydrift.js --list   (full three-set enumeration)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.env.IPC_ROOT ? path.resolve(process.env.IPC_ROOT) : path.join(__dirname, '..');

// ── PHP side ────────────────────────────────────────────────────────────────
const php = spawnSync('php', [path.join(__dirname, 'dump-copy-groups.php')], {
  encoding: 'utf8',
  env: { ...process.env, IPC_ROOT: root },
});
if (php.status !== 0) {
  console.error('copydrift: dump-copy-groups.php failed\n' + (php.stderr || ''));
  process.exit(2);
}
const phpFields = JSON.parse(php.stdout);

// ── JS side ─────────────────────────────────────────────────────────────────
// Brace-match COPY_DEFAULTS out of App.jsx and evaluate it. It is a plain
// nested object of string literals with no external references, so this is
// exact — no regex guessing at keys.
const appJsx = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const declIdx = appJsx.indexOf('const COPY_DEFAULTS = {');
if (declIdx < 0) { console.error('copydrift: COPY_DEFAULTS not found in src/App.jsx'); process.exit(2); }
const openIdx = appJsx.indexOf('{', declIdx);

let depth = 0, endIdx = -1;
for (let i = openIdx; i < appJsx.length; i++) {
  const c = appJsx[i];
  if (c === '"' || c === "'" || c === '`') {           // skip string literals
    const q = c;
    for (i++; i < appJsx.length; i++) {
      if (appJsx[i] === '\\') { i++; continue; }
      if (appJsx[i] === q) break;
    }
    continue;
  }
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
}
if (endIdx < 0) { console.error('copydrift: COPY_DEFAULTS is unbalanced'); process.exit(2); }

let COPY_DEFAULTS;
try {
  COPY_DEFAULTS = eval('(' + appJsx.slice(openIdx, endIdx + 1) + ')');
} catch (e) {
  console.error('copydrift: COPY_DEFAULTS did not evaluate — ' + e.message);
  process.exit(2);
}

// ── compare ─────────────────────────────────────────────────────────────────
const phpSet = new Set(phpFields.map((f) => `${f.group}.${f.key}`));
const jsSet = new Set();
for (const g of Object.keys(COPY_DEFAULTS)) {
  const grp = COPY_DEFAULTS[g];
  if (grp && typeof grp === 'object' && !Array.isArray(grp)) {
    for (const k of Object.keys(grp)) jsSet.add(`${g}.${k}`);
  }
}

const phpOnly = [...phpSet].filter((k) => !jsSet.has(k)).sort();
const jsOnly  = [...jsSet].filter((k) => !phpSet.has(k)).sort();
const matched = [...phpSet].filter((k) => jsSet.has(k)).sort();

// Groups present on one side entirely are worth calling out separately — a
// whole missing group is a different mistake from a single drifted key.
const phpGroups = new Set([...phpSet].map((k) => k.split('.')[0]));
const jsGroups  = new Set([...jsSet].map((k) => k.split('.')[0]));
const groupsPhpOnly = [...phpGroups].filter((g) => !jsGroups.has(g)).sort();
const groupsJsOnly  = [...jsGroups].filter((g) => !phpGroups.has(g)).sort();

const listMode = process.argv.includes('--list');

console.log('NB-copy — admin/content.php $COPY_GROUPS  vs  src/App.jsx COPY_DEFAULTS\n');
console.log(`  PHP fields offered : ${phpSet.size}  in ${phpGroups.size} groups`);
console.log(`  JS defaults        : ${jsSet.size}  in ${jsGroups.size} groups`);
console.log(`  matched            : ${matched.length}`);
console.log(`  PHP-only (BROKEN)  : ${phpOnly.length}`);
console.log(`  JS-only (uneditable): ${jsOnly.length}\n`);

if (groupsPhpOnly.length) console.log(`  whole groups PHP-only: ${groupsPhpOnly.join(', ')}`);
if (groupsJsOnly.length)  console.log(`  whole groups JS-only : ${groupsJsOnly.join(', ')}`);
if (groupsPhpOnly.length || groupsJsOnly.length) console.log('');

if (phpOnly.length) {
  console.log('PHP-only — the admin offers these; mergeContent can never read them.');
  console.log('Rick edits them, sees "Content saved", and the site never changes:\n');
  for (const k of phpOnly) {
    const f = phpFields.find((x) => `${x.group}.${x.key}` === k);
    console.log(`  ${k.padEnd(34)} ${f ? `[${f.type}] ${f.label}` : ''}`);
  }
  console.log('');
}

if (jsOnly.length) {
  console.log('JS-only — the site renders these defaults; Rick has no editor for them:\n');
  for (const k of jsOnly) console.log(`  ${k}`);
  console.log('');
}

if (listMode) {
  console.log(`matched (${matched.length}):\n`);
  for (const k of matched) console.log(`  ${k}`);
  console.log('');
}

// PHP-only is the failing condition: it is the silent data-loss direction.
// JS-only is reported but does not fail — a default with no editor renders
// correctly, it is merely not owner-editable.
const ok = phpOnly.length === 0;
console.log(ok
  ? `copydrift OK — every offered field has a default (${matched.length} matched, ${jsOnly.length} JS-only)`
  : `copydrift FAIL — ${phpOnly.length} offered field(s) can never render`);
process.exit(ok ? 0 : 1);
