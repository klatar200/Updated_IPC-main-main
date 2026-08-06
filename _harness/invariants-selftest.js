/**
 * Proves every check in invariants.js can actually FAIL.
 *
 * GUARDRAILS 4.4: "A check that has never failed proves nothing — two invariant
 * checks in session 3 passed against a broken assertion because they were
 * matching incident comments that quoted the old buggy pattern."
 *
 * Method: copy the five source files invariants.js reads into a temp tree,
 * re-introduce the ORIGINAL defect each invariant was written against, run
 * invariants.js with IPC_ROOT pointed at the copy, and assert that the expected
 * check — and ideally only that check — goes red.
 *
 * The real source tree is never written to.
 *
 * Usage: node _harness/invariants-selftest.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const FILES = [
  'admin/config.php',
  'admin/content.php',
  'public/contact.php',
  'src/App.jsx',
  'src/index.css',
];

/** Each mutation re-introduces the defect named in CLAUDE.md's invariant list. */
const MUTATIONS = [
  {
    id: 'INV1a', why: 'the shipped bug: preg_replace instead of preg_replace_callback',
    file: 'admin/config.php',
    apply: (s) => s.replace(
      /\$newBody = preg_replace_callback\(\$re, static function \(\) use \(\$defineLine\) \{\s*return \$defineLine;\s*\}, \$body, 1, \$replaced\);/,
      '$newBody = preg_replace($re, $defineLine, $body, 1, $replaced);'),
    // INV1b also fires: the mutation introduces a bare preg_replace() too.
    also: ['INV1b'],
  },
  {
    id: 'INV2a', why: 'a real bcrypt hash back in config.php (shipped twice)',
    file: 'admin/config.php',
    apply: (s) => s.replace(
      "define('ADMIN_PASSWORD_SENTINEL', '*not-configured*');",
      "define('ADMIN_PASSWORD_SENTINEL', '$2y$12$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRSTU');"),
    also: ['INV2b'],
  },
  {
    id: 'INV3', why: 'the "&& v.length" re-seed — stale legal text republishing itself',
    file: 'src/App.jsx',
    apply: (s) => s.replace(
      'out[k] = Array.isArray(v) ? v : dv;',
      'out[k] = Array.isArray(v) && v.length ? v : dv;'),
  },
  {
    id: 'INV4a', why: 'blank strings spread over the defaults — "© –2026", href="tel:"',
    file: 'src/App.jsx',
    apply: (s) => s.replace(
      /if \(\s*typeof val === "string" &&\s*val\.trim\(\) === "" &&\s*!SITE_CLEARABLE\.has\(`\$\{k\}\.\$\{key\}`\)\s*\) \{\s*continue;\s*\}/,
      '/* blank-drop removed */'),
    also: ['INV4b'],
  },
  {
    id: 'INV5a', why: 'first-free sequence allocation, which scrambles backup ordering',
    file: 'admin/config.php',
    apply: (s) => s.replace('$next = $used + 1;', '$next = 1;'),
  },
  {
    id: 'INV5b', why: 'ordering backups by filemtime() — 1-second resolution ties',
    file: 'admin/config.php',
    apply: (s) => s.replace(
      /usort\(\$files, static function \(\$a, \$b\) \{[\s\S]*?\}\);/,
      'usort($files, static function ($a, $b) { return filemtime($a) <=> filemtime($b); });'),
  },
  {
    id: 'INV6', why: 'a field added AFTER the truncation sentinel',
    file: 'admin/content.php',
    apply: (s) => s.replace(
      '<input type="hidden" name="form_complete" value="1">',
      '<input type="hidden" name="form_complete" value="1">\n    <input type="hidden" name="added_after_sentinel" value="1">'),
  },
  {
    id: 'INV7', why: 'the unkeyed ErrorBoundary — one bad product bricked every page',
    file: 'src/App.jsx',
    apply: (s) => s.replace('<ErrorBoundary key={page}>', '<ErrorBoundary>'),
  },
  {
    id: 'INV8', why: 'Footer moved above the catalog gate (chrome behind the gate)',
    file: 'src/App.jsx',
    // Removing the Footer entirely models "the chrome is not outside the gate".
    apply: (s) => s.replace('<Footer />', '<FooterMoved />'),
  },
  {
    id: 'INV9', why: 'the skeleton defined only in GlobalStyles — styleless while loading',
    file: 'src/index.css',
    apply: (s) => s.replace(/^\.ipc-skeleton\s*\{/m, '.ipc-skeleton-renamed {'),
  },
  {
    id: 'INV10a', why: 'strip_tags() in s() — ate "<1/4 inch and >" out of a quote request',
    file: 'public/contact.php',
    apply: (s) => s.replace('$v = trim((string)$val);', '$v = strip_tags(trim((string)$val));'),
  },
  {
    id: 'INV10b', why: 'hdr() no longer stripping CRLF — mail header injection',
    file: 'public/contact.php',
    apply: (s) => s.replace(
      "return trim(preg_replace('/[\\r\\n]+/', ' ', s($val)) ?: '');",
      'return trim(s($val));'),
  },
  {
    id: 'INV11', why: 'an absent Referer treated as a rejection — cost real leads',
    file: 'public/contact.php',
    apply: (s) => s.replace(
      "$sameSite = $refHost === '' || (",
      '$sameSite = ('),
  },
  {
    id: 'INV12', why: 'require_auth() redirecting on POST — turns it into a GET, discards typing',
    file: 'admin/config.php',
    apply: (s) => s.replace(
      /if \(\(\$_SERVER\['REQUEST_METHOD'\] \?\? 'GET'\) === 'POST'\) \{\s*csrf_fail_page\('expired'\);\s*\}/,
      '/* POST branch removed */'),
  },
];

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-inv-'));
  for (const rel of FILES) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dest);
  }
  return dir;
}

function runInvariants(treeRoot) {
  const res = spawnSync(process.execPath, [path.join(__dirname, 'invariants.js')], {
    env: { ...process.env, IPC_ROOT: treeRoot },
    encoding: 'utf8',
  });
  const failed = new Set();
  for (const line of (res.stdout || '').split('\n')) {
    const m = line.match(/^FAIL (\S+)/);
    if (m) failed.add(m[1]);
  }
  return failed;
}

let bad = 0;
console.log('Mutating copies of the source and asserting each check goes red.\n');

for (const mut of MUTATIONS) {
  const tree = makeTree();
  const target = path.join(tree, mut.file);
  const before = fs.readFileSync(target, 'utf8');
  const after = mut.apply(before);

  if (after === before) {
    console.log(`FAIL ${mut.id.padEnd(7)} mutation did not apply — the pattern no longer matches ${mut.file}`);
    bad++;
    fs.rmSync(tree, { recursive: true, force: true });
    continue;
  }
  fs.writeFileSync(target, after);

  const failed = runInvariants(tree);
  const expected = new Set([mut.id, ...(mut.also || [])]);
  const caught = failed.has(mut.id);
  const unexpected = [...failed].filter((id) => !expected.has(id));

  if (!caught) {
    console.log(`FAIL ${mut.id.padEnd(7)} defect re-introduced but the check STAYED GREEN — ${mut.why}`);
    bad++;
  } else if (unexpected.length) {
    console.log(`FAIL ${mut.id.padEnd(7)} went red, but so did unrelated check(s): ${unexpected.join(', ')}`);
    bad++;
  } else {
    const extra = [...failed].filter((id) => id !== mut.id);
    console.log(`ok   ${mut.id.padEnd(7)} goes red on: ${mut.why}${extra.length ? `  (also ${extra.join(', ')}, expected)` : ''}`);
  }
  fs.rmSync(tree, { recursive: true, force: true });
}

// And the unmutated tree must be fully green, or the mutations prove nothing.
const clean = makeTree();
const cleanFailed = runInvariants(clean);
fs.rmSync(clean, { recursive: true, force: true });
if (cleanFailed.size) {
  console.log(`\nFAIL control: the UNMUTATED copy already fails ${[...cleanFailed].join(', ')}`);
  bad++;
} else {
  console.log('\nok   control  the unmutated copy is fully green');
}

console.log(`\ninvariants-selftest ${MUTATIONS.length + 1 - bad}/${MUTATIONS.length + 1}`);
process.exit(bad === 0 ? 0 : 1);
